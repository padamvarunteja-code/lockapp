// Postgres persistence mirror for OnlyUs.
//
// Problem: cheap hosts (e.g. Render free tier) wipe local files on every
// restart, deleting all accounts, messages, and password changes.
//
// Solution: when DATABASE_URL is set (e.g. a free Supabase Postgres), this
// module mirrors every mutation into Postgres and reloads it at boot.
// The app keeps serving from memory + JSON files exactly as before, so the
// entire synchronous API (routers, middleware, tests) is untouched:
//
//   - Structured collections are snapshotted as JSONB rows (one row per
//     collection) on every save (debounced), inside a transaction.
//   - Vault ciphertext blobs are stored as base64 TEXT rows, written
//     immediately on upload and deleted immediately on removal.
//   - At boot, collections are reloaded and vault files are restored to
//     disk from blobs (or adopted into blobs if only the file exists).
//   - Single-instance assumption (already true for the JSON store).
//
// Without DATABASE_URL every function is a no-op and the app behaves
// exactly like the original file-only version.

import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSchema } from './db';
import type { AdminStorageSchema } from './admin_db';

export interface QueryableClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(): void;
}

export interface QueryablePool {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  connect(): Promise<QueryableClient>;
  end(): Promise<void>;
}

export interface UserStoreLike {
  getDataRef(): DatabaseSchema;
  replaceData(data: DatabaseSchema): void;
  getVaultDirPath(): string;
}

export interface AdminStoreLike {
  getDataRef(): AdminStorageSchema;
  replaceData(data: AdminStorageSchema): void;
}

const USER_KEYS = [
  'users',
  'sessions',
  'connections',
  'conversations',
  'messages',
  'vault_media',
] as const;

const ADMIN_KEYS = ['admin_users', 'admin_sessions', 'audit_logs', 'failed_attempts'] as const;

const SAVE_DEBOUNCE_MS = 1500;

function parseJson(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

class PgMirror {
  private pool: QueryablePool | null = null;
  private schemaPool: QueryablePool | null = null;
  private userStore: UserStoreLike | null = null;
  private adminStore: AdminStoreLike | null = null;
  private ready = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private retryTimer: ReturnType<typeof setInterval> | null = null;

  public isEnabled(): boolean {
    return !!process.env.DATABASE_URL;
  }

  public isReady(): boolean {
    return this.ready;
  }

  private createPool(): QueryablePool {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg') as typeof import('pg');
    const ssl =
      process.env.PGSSLMODE === 'disable' ? undefined : { rejectUnauthorized: false };
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
      max: 3,
      connectionTimeoutMillis: 10000,
    }) as unknown as QueryablePool;
  }

  public async attach(
    userStore: UserStoreLike,
    adminStore: AdminStoreLike,
    poolOverride?: QueryablePool
  ): Promise<void> {
    if (!this.isEnabled() && !poolOverride) return;
    this.userStore = userStore;
    this.adminStore = adminStore;
    if (poolOverride) {
      this.pool = poolOverride;
    } else if (!this.pool) {
      this.pool = this.createPool();
    }
    try {
      await this.initSchema();
      await this.loadIntoStores();
      this.ready = true;
      if (this.retryTimer) {
        clearInterval(this.retryTimer);
        this.retryTimer = null;
      }
      console.log('[OnlyUs] Postgres persistence mirror attached.');
    } catch (err) {
      console.error('[OnlyUs] Postgres mirror init failed, continuing file-only:', err);
      this.ready = false;
      // Retry in the background (e.g. DB was briefly unreachable at boot).
      if (!this.retryTimer) {
        this.retryTimer = setInterval(() => {
          void this.attach(userStore, adminStore).catch(() => {
            // stay silent until it succeeds; next retry in 60s
          });
        }, 60 * 1000);
        this.retryTimer.unref?.();
      }
    }
  }

  private async initSchema(): Promise<void> {
    // DDL is issued once per pool: repeats are redundant on real Postgres
    // and trip a pg-mem emulator bug (duplicate CREATE ... IF NOT EXISTS
    // with constraints). A fresh process always starts with schemaPool unset.
    if (this.pool && this.schemaPool === this.pool) return;
    const pool = this.pool!;
    await pool.query(
      `CREATE TABLE IF NOT EXISTS kv_snapshots (
         store_key TEXT,
         data JSONB,
         PRIMARY KEY (store_key)
       )`
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS vault_blobs (
         media_id TEXT,
         data_base64 TEXT,
         PRIMARY KEY (media_id)
       )`
    );
    this.schemaPool = this.pool;
  }

  private async loadIntoStores(): Promise<void> {
    const pool = this.pool!;
    const userStore = this.userStore!;
    const adminStore = this.adminStore!;

    const res = await pool.query(`SELECT store_key, data FROM kv_snapshots`);
    const rows = new Map<string, unknown>();
    for (const row of res.rows) {
      rows.set(row.store_key as string, parseJson(row.data));
    }

    if (rows.size === 0) {
      // First boot with Postgres: seed it from current (file) state.
      await this.flushNow();
      return;
    }

    // Merge snapshot over current state; missing keys keep file state.
    const u = { ...userStore.getDataRef() };
    let userChanged = false;
    for (const key of USER_KEYS) {
      const v = rows.get(key);
      if (Array.isArray(v)) {
        (u as Record<string, unknown>)[key] = v;
        userChanged = true;
      }
    }
    if (userChanged) userStore.replaceData(u);

    const a = { ...adminStore.getDataRef() };
    let adminChanged = false;
    for (const key of ADMIN_KEYS) {
      const v = rows.get(key);
      if (Array.isArray(v)) {
        (a as Record<string, unknown>)[key] = v;
        adminChanged = true;
      }
    }
    if (adminChanged) adminStore.replaceData(a);

    await this.restoreVaultFiles();
    await this.collectOrphanBlobs();
  }

  /** Ensure every vault metadata row has its bytes on disk, and vice versa. */
  private async restoreVaultFiles(): Promise<void> {
    const pool = this.pool!;
    const userStore = this.userStore!;
    const vaultDir = userStore.getVaultDirPath();
    if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });

    const items = userStore.getDataRef().vault_media || [];
    for (const item of items) {
      const fullPath = path.resolve(vaultDir, item.storage_path);
      const fileExists = fs.existsSync(fullPath);
      let blob: string | null = null;
      try {
        const res = await pool.query(`SELECT data_base64 FROM vault_blobs WHERE media_id = $1`, [
          item.id,
        ]);
        const row = res.rows[0] as { data_base64?: unknown } | undefined;
        if (row && typeof row.data_base64 === 'string') blob = row.data_base64;
      } catch (err) {
        console.error('[OnlyUs] Vault blob lookup failed:', err);
      }
      if (!fileExists && blob) {
        fs.writeFileSync(fullPath, Buffer.from(blob, 'base64'));
      } else if (fileExists && !blob) {
        const buf = fs.readFileSync(fullPath);
        await this.upsertBlob(item.id, buf);
      }
    }
  }

  /** Delete blobs whose metadata row is gone (e.g. after offline cleanup). */
  private async collectOrphanBlobs(): Promise<void> {
    try {
      const pool = this.pool!;
      const ids = new Set((this.userStore!.getDataRef().vault_media || []).map((v) => v.id));
      const res = await pool.query(`SELECT media_id FROM vault_blobs`);
      const orphans = res.rows
        .map((r) => r.media_id as string)
        .filter((id) => !ids.has(id));
      for (const id of orphans) {
        await pool.query(`DELETE FROM vault_blobs WHERE media_id = $1`, [id]);
      }
      if (orphans.length > 0) {
        console.log(`[OnlyUs] Cleaned ${orphans.length} orphan vault blobs.`);
      }
    } catch (err) {
      console.error('[OnlyUs] Orphan blob collection failed:', err);
    }
  }

  private async upsertBlob(mediaId: string, buf: Buffer): Promise<void> {
    if (!this.ready || !this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO vault_blobs (media_id, data_base64) VALUES ($1, $2)
         ON CONFLICT (media_id) DO UPDATE SET data_base64 = EXCLUDED.data_base64`,
        [mediaId, buf.toString('base64')]
      );
    } catch (err) {
      console.error('[OnlyUs] Vault blob mirror failed:', err);
    }
  }

  private async deleteBlob(mediaId: string): Promise<void> {
    if (!this.ready || !this.pool) return;
    try {
      await this.pool.query(`DELETE FROM vault_blobs WHERE media_id = $1`, [mediaId]);
    } catch (err) {
      console.error('[OnlyUs] Vault blob delete failed:', err);
    }
  }

  /** Called by Database.addVaultMedia after the ciphertext hits disk. */
  public noteVaultWrite(mediaId: string, buf: Buffer): void {
    if (!this.isEnabled() && !this.pool) return;
    void this.upsertBlob(mediaId, buf);
  }

  /** Called by Database.deleteVaultMedia / deleteUserAccount. */
  public noteVaultDelete(mediaId: string): void {
    if (!this.isEnabled() && !this.pool) return;
    void this.deleteBlob(mediaId);
  }

  /** Called by Database.save(). Debounced so message bursts coalesce. */
  public scheduleSave(): void {
    if (!this.isEnabled() && !this.pool) return;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flushNow();
    }, SAVE_DEBOUNCE_MS);
    this.saveTimer.unref?.();
  }

  /** Immediate, serialized snapshot write (used on shutdown). */
  public flush(): Promise<void> {
    if ((!this.isEnabled() && !this.pool) || !this.ready) return Promise.resolve();
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    return this.flushNow();
  }

  private flushNow(): Promise<void> {
    const run = async () => {
      if (!this.ready || !this.pool || !this.userStore || !this.adminStore) return;
      const u = this.userStore.getDataRef();
      const a = this.adminStore.getDataRef();
      const entries: Array<[string, unknown]> = [];
      for (const key of USER_KEYS) entries.push([key, u[key]]);
      for (const key of ADMIN_KEYS) {
        entries.push([key, (a as unknown as Record<string, unknown>)[key]]);
      }
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        for (const [key, value] of entries) {
          await client.query(
            `INSERT INTO kv_snapshots (store_key, data) VALUES ($1, $2::jsonb)
             ON CONFLICT (store_key) DO UPDATE SET data = EXCLUDED.data`,
            [key, JSON.stringify(value ?? [])]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore
        }
        console.error('[OnlyUs] Snapshot mirror failed:', err);
      } finally {
        client.release();
      }
    };
    this.chain = this.chain.then(run, run);
    return this.chain;
  }
}

export const pgMirror = new PgMirror();
