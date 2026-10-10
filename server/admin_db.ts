import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: number;
}

export interface AdminSession {
  token: string;
  admin_id: string;
  username: string;
  created_at: number;
  last_active_at: number;
  expires_at: number; // Max session lifetime (e.g. 4 hours)
  reauthenticated_at?: number; // Recent reauth timestamp for sensitive ops (5 min)
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  event_type:
    | 'ADMIN_LOGIN_SUCCESS'
    | 'ADMIN_LOGIN_FAILURE'
    | 'ADMIN_LOGOUT'
    | 'ADMIN_REAUTH_SUCCESS'
    | 'ADMIN_SESSION_REVOKED'
    | 'ADMIN_CREDENTIALS_CHANGED'
    | 'USER_LOGIN_FAILURE'
    | 'RATE_LIMIT_TRIGGERED'
    | 'UNAUTHORIZED_ACCESS_ATTEMPT'
    | 'DATA_PURGE_EXECUTED'
    | 'INTEGRITY_CHECK_RUN';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  actor: string; // Masked or username
  ip_address: string;
  details: string; // Strictly NO passwords, NO PINs, NO keys, NO message contents
  prev_hash: string;
  current_hash: string; // HMAC-SHA256(prev_hash + entry_data, audit_secret)
}

import { getAppEnvironment } from './db';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const env = getAppEnvironment();
const envSuffix = env === 'production' ? 'prod' : env === 'test' ? 'test' : 'dev';
const ADMIN_DB_FILE = process.env.ADMIN_DATABASE_FILE
  ? path.resolve(process.cwd(), process.env.ADMIN_DATABASE_FILE)
  : path.resolve(DATA_DIR, `admin.${envSuffix}.json`);

// Legacy hardcoded key — kept ONLY as a one-time migration fallback so
// pre-existing audit chains (signed with it) still verify. Fresh installs
// never use it; they get a random persisted secret instead.
const LEGACY_AUDIT_SECRET = 'aegis-secops-audit-hmac-v1-key';

function resolveAuditSecret(): string {
  // 1. Explicit env var always wins (required in production).
  if (process.env.AUDIT_CHAIN_SECRET && process.env.AUDIT_CHAIN_SECRET.length >= 16) {
    return process.env.AUDIT_CHAIN_SECRET;
  }
  if (getAppEnvironment() === 'production') {
    throw new Error(
      '[AdminDB] FATAL: AUDIT_CHAIN_SECRET must be set to a random value >= 16 chars in production. ' +
        'To migrate an existing install, set it to your previous secret first, then rotate.'
    );
  }
  // 2. Dev/test: reuse a persisted secret so the hash chain survives restarts
  //    without committing a hardcoded key to source control.
  try {
    const secretFile = path.resolve(DATA_DIR, '.audit_secret');
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf-8').trim();
      if (saved.length >= 16) return saved;
    }
    // One-time migration: if an audit DB already exists with chained entries,
    // keep verifying them with the legacy key and persist it (with warning)
    // instead of silently invalidating the whole chain.
    try {
      if (fs.existsSync(ADMIN_DB_FILE)) {
        const raw = fs.readFileSync(ADMIN_DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.audit_logs) && parsed.audit_logs.length > 0) {
          if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
          fs.writeFileSync(secretFile, LEGACY_AUDIT_SECRET, { encoding: 'utf-8', mode: 0o600 });
          console.warn('[AdminDB] Migrated existing audit chain to persisted secret file. Set AUDIT_CHAIN_SECRET to rotate.');
          return LEGACY_AUDIT_SECRET;
        }
      } else {
        const legacyAdminFile = path.resolve(DATA_DIR, 'admin.json');
        if (fs.existsSync(legacyAdminFile)) {
          const raw = fs.readFileSync(legacyAdminFile, 'utf-8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.audit_logs) && parsed.audit_logs.length > 0) {
            if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(secretFile, LEGACY_AUDIT_SECRET, { encoding: 'utf-8', mode: 0o600 });
            console.warn('[AdminDB] Migrated legacy audit chain to persisted secret file. Set AUDIT_CHAIN_SECRET to rotate.');
            return LEGACY_AUDIT_SECRET;
          }
        }
      }
    } catch { /* fall through to fresh generation */ }
    const generated = crypto.randomBytes(32).toString('hex');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(secretFile, generated, { encoding: 'utf-8', mode: 0o600 });
    console.warn('[AdminDB] Generated ephemeral audit-chain secret for non-production use.');
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const AUDIT_SECRET = resolveAuditSecret();

interface AdminStorageSchema {
  admin_users: AdminUser[];
  admin_sessions: AdminSession[];
  audit_logs: AuditLogEntry[];
  failed_attempts: Array<{ ip: string; timestamp: number }>;
}

class AdminDatabase {
  private data: AdminStorageSchema = {
    admin_users: [],
    admin_sessions: [],
    audit_logs: [],
    failed_attempts: [],
  };

  public static readonly INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes inactivity timeout (matches docs, UI, and security tests)
  public static readonly REAUTH_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes reauthentication validity
  public static readonly MAX_LOGIN_ATTEMPTS = 5;
  public static readonly LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout window

  constructor() {
    this.load();
    this.bootstrapMasterAdmin();
  }

  private load() {
    try {
      const legacyAdminFile = path.resolve(DATA_DIR, 'admin.json');
      if (fs.existsSync(ADMIN_DB_FILE)) {
        const raw = fs.readFileSync(ADMIN_DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else if (fs.existsSync(legacyAdminFile)) {
        const raw = fs.readFileSync(legacyAdminFile, 'utf-8');
        this.data = JSON.parse(raw);
        this.migrateLegacyAdminUsername();
        this.save();
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[AdminDB] Error loading admin DB, initializing clean:', err);
      this.save();
    }
  }

  /** One-time rebrand migration: rename the legacy default admin username. */
  private migrateLegacyAdminUsername() {
    const targetName = process.env.ADMIN_BOOTSTRAP_USER || 'onlyus_admin';
    if (targetName === 'aegis_admin') return;
    const users = this.data.admin_users || [];
    if (users.some((a) => a.username === targetName)) return;
    let renamed = false;
    for (const a of users) {
      if (a.username === 'aegis_admin') {
        a.username = targetName;
        renamed = true;
      }
    }
    if (renamed) {
      for (const s of this.data.admin_sessions || []) {
        if (s.username === 'aegis_admin') s.username = targetName;
      }
      console.warn(`[AdminDB] Migrated legacy admin username to '${targetName}'.`);
    }
  }

  public save() {
    try {
      const tempPath = `${ADMIN_DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      let lastErr: unknown;
      for (let i = 0; i < 3; i++) {
        try {
          fs.renameSync(tempPath, ADMIN_DB_FILE);
          return;
        } catch (err: any) {
          lastErr = err;
          if (err?.code === 'EPERM' || err?.code === 'EBUSY' || err?.code === 'EACCES') {
            const start = Date.now();
            while (Date.now() - start < 50) { /* busy-wait 50ms for file lock release */ }
            continue;
          }
          throw err;
        }
      }
      throw lastErr;
    } catch (err) {
      console.error('[AdminDB] Error saving admin DB:', err);
    }
  }

  // Securely bootstrap an initial secops administrator if none exists
  // Credentials cannot be registered publicly via an open route.
  // In production the bootstrap credentials MUST come from env vars.
  // In dev/test a random password is generated (or test defaults when APP_ENV=test
  // for backward compatibility with the automated suite) and must be rotated.
  private bootstrapMasterAdmin() {
    if (this.data.admin_users.length === 0) {
      const env = getAppEnvironment();
      const hasEnvCreds =
        !!process.env.ADMIN_BOOTSTRAP_USER &&
        !!process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (env === 'production' && !hasEnvCreds) {
        throw new Error(
          '[AdminDB] FATAL: ADMIN_BOOTSTRAP_USER/PASSWORD must be set in production. Refusing to start with default credentials.'
        );
      }
      const defaultUsername = process.env.ADMIN_BOOTSTRAP_USER || 'onlyus_admin';
      let defaultPassword: string;
      if (process.env.ADMIN_BOOTSTRAP_PASSWORD) {
        defaultPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      } else if (env === 'test') {
        // Preserve deterministic test credentials only for the automated suite.
        defaultPassword = 'SecOps@Defense2026!';
      } else {
        defaultPassword = `OnlyUs-${crypto.randomBytes(12).toString('hex')}!`;
        console.warn(
          '[AdminDB] No ADMIN_BOOTSTRAP_* env vars set — generated random one-time admin credentials. Set env vars to make them stable.'
        );
        console.warn(`[AdminDB] Bootstrap admin user: ${defaultUsername}`);
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = `${salt}:${crypto.scryptSync(defaultPassword, salt, 64).toString('hex')}`;

      const masterAdmin: AdminUser = {
        id: crypto.randomUUID(),
        username: defaultUsername,
        password_hash: passwordHash,
        created_at: Date.now(),
      };

      this.data.admin_users.push(masterAdmin);
      this.save();

      this.recordAuditLog(
        'INTEGRITY_CHECK_RUN',
        'INFO',
        'SYSTEM_BOOTSTRAP',
        '127.0.0.1',
        'Initial administrator account bootstrapped securely from server environment.'
      );
    }
  }

  // --- Cryptographic Hash-Chained Audit Logging ---
  public recordAuditLog(
    eventType: AuditLogEntry['event_type'],
    severity: AuditLogEntry['severity'],
    actor: string,
    ip: string,
    details: string
  ): AuditLogEntry {
    const timestamp = Date.now();
    const id = crypto.randomUUID();

    // Previous hash in the tamper-resistant chain
    const lastEntry = this.data.audit_logs[this.data.audit_logs.length - 1];
    const prevHash = lastEntry ? lastEntry.current_hash : 'GENESIS_AEGIS_SEC_CHAIN_0000000000000';

    // Compute HMAC-SHA256
    const payload = `${prevHash}|${id}|${timestamp}|${eventType}|${severity}|${actor}|${ip}|${details}`;
    const currentHash = crypto.createHmac('sha256', AUDIT_SECRET).update(payload).digest('hex');

    const entry: AuditLogEntry = {
      id,
      timestamp,
      event_type: eventType,
      severity,
      actor,
      ip_address: ip,
      details,
      prev_hash: prevHash,
      current_hash: currentHash,
    };

    this.data.audit_logs.push(entry);

    // Keep up to 1000 audit records
    if (this.data.audit_logs.length > 1000) {
      this.data.audit_logs.shift();
    }

    this.save();
    return entry;
  }

  // Verify full cryptographic audit chain integrity
  public verifyAuditChainIntegrity(): { valid: boolean; verifiedCount: number; brokenAtId?: string } {
    let prev = 'GENESIS_AEGIS_SEC_CHAIN_0000000000000';
    for (let i = 0; i < this.data.audit_logs.length; i++) {
      const entry = this.data.audit_logs[i];
      if (entry.prev_hash !== prev) {
        return { valid: false, verifiedCount: i, brokenAtId: entry.id };
      }

      const payload = `${entry.prev_hash}|${entry.id}|${entry.timestamp}|${entry.event_type}|${entry.severity}|${entry.actor}|${entry.ip_address}|${entry.details}`;
      const expectedHash = crypto.createHmac('sha256', AUDIT_SECRET).update(payload).digest('hex');

      if (entry.current_hash !== expectedHash) {
        return { valid: false, verifiedCount: i, brokenAtId: entry.id };
      }
      prev = entry.current_hash;
    }
    return { valid: true, verifiedCount: this.data.audit_logs.length };
  }

  public getAuditLogs(limit = 100): AuditLogEntry[] {
    return [...this.data.audit_logs].reverse().slice(0, limit);
  }

  // --- Brute Force Protection ---
  public isIpLockedOut(ip: string): boolean {
    const now = Date.now();
    const cutoff = now - AdminDatabase.LOCKOUT_WINDOW_MS;
    const recentFailures = this.data.failed_attempts.filter(
      (a) => a.ip === ip && a.timestamp > cutoff
    );
    return recentFailures.length >= AdminDatabase.MAX_LOGIN_ATTEMPTS;
  }

  public recordFailedAttempt(ip: string) {
    this.data.failed_attempts.push({ ip, timestamp: Date.now() });
    // Clean old
    const cutoff = Date.now() - AdminDatabase.LOCKOUT_WINDOW_MS;
    this.data.failed_attempts = this.data.failed_attempts.filter((a) => a.timestamp > cutoff);
    this.save();
  }

  public resetFailedAttempts(ip: string) {
    this.data.failed_attempts = this.data.failed_attempts.filter((a) => a.ip !== ip);
    this.save();
  }

  // --- Password & Verification ---
  public verifyAdminPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  public findAdminByUsername(username: string): AdminUser | undefined {
    return this.data.admin_users.find((a) => a.username === username);
  }

  // --- Admin Session Management ---
  public createAdminSession(admin: AdminUser): AdminSession {
    const now = Date.now();
    const token = `adm_${crypto.randomBytes(36).toString('hex')}`;
    const session: AdminSession = {
      token,
      admin_id: admin.id,
      username: admin.username,
      created_at: now,
      last_active_at: now,
      expires_at: now + 4 * 60 * 60 * 1000, // 4 hours maximum lifetime
      reauthenticated_at: now, // Initial login counts as fresh reauth
    };

    this.data.admin_sessions.push(session);
    this.save();
    return session;
  }

  public getAdminSession(token: string): AdminSession | undefined {
    const now = Date.now();
    const session = this.data.admin_sessions.find((s) => s.token === token);
    if (!session) return undefined;

    // Check absolute expiration
    if (session.expires_at < now) {
      this.revokeAdminSession(token);
      return undefined;
    }

    // Check inactivity timeout (15 minutes)
    if (now - session.last_active_at > AdminDatabase.INACTIVITY_TIMEOUT_MS) {
      this.revokeAdminSession(token);
      return undefined;
    }

    // Touch last active
    session.last_active_at = now;
    return session;
  }

  public revokeAdminSession(token: string): boolean {
    const idx = this.data.admin_sessions.findIndex((s) => s.token === token);
    if (idx === -1) return false;
    this.data.admin_sessions.splice(idx, 1);
    this.save();
    return true;
  }

  public revokeAllAdminSessions(): number {
    const count = this.data.admin_sessions.length;
    this.data.admin_sessions = [];
    this.save();
    return count;
  }

  public markReauthenticated(token: string): boolean {
    const session = this.data.admin_sessions.find((s) => s.token === token);
    if (!session) return false;
    session.reauthenticated_at = Date.now();
    this.save();
    return true;
  }

  public isReauthenticated(session: AdminSession): boolean {
    if (!session.reauthenticated_at) return false;
    return Date.now() - session.reauthenticated_at <= AdminDatabase.REAUTH_VALIDITY_MS;
  }

  public updateAdminCredentials(username: string, newPassword?: string): boolean {
    const admin = this.data.admin_users.find((a) => a.username === username);
    if (!admin) return false;

    if (newPassword && newPassword.trim().length >= 8) {
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = `${salt}:${crypto.scryptSync(newPassword.trim(), salt, 64).toString('hex')}`;
      admin.password_hash = passwordHash;
    }

    this.save();
    return true;
  }
}

export const adminDb = new AdminDatabase();
