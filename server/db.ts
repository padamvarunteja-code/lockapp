import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface User {
  id: string;
  username: string;
  username_normalized: string;
  password_hash: string;
  vault_pin_hash?: string | null;
  created_at: number;
  must_change_password?: boolean;
  must_change_vault_pin?: boolean;
}

export interface Session {
  id: string; // Stable device identifier (never a token prefix — avoids prefix-collision revocation)
  token: string;
  user_id: string;
  device_name?: string;
  user_agent?: string;
  created_at: number;
  last_active_at: number;
  expires_at: number;
}

export interface Connection {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: number;
  updated_at: number;
}

export interface Conversation {
  id: string;
  user_one_id: string;
  user_two_id: string;
  created_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string; // Base64 JSON of { ciphertext, iv, salt }
  created_at: number; // Server-recorded timestamp
  expires_at: number; // created_at + 24 hours (86,400,000 ms)
}

export interface VaultMedia {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string; // Relative path in data/vault
  media_type: 'photo' | 'video';
  mime_type: string;
  file_size: number;
  iv: string; // Base64
  salt: string; // Base64
  created_at: number;
}

export interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  connections: Connection[];
  conversations: Conversation[];
  messages: Message[];
  vault_media: VaultMedia[];
}

export type AppEnvironment = 'development' | 'test' | 'production';

export function getAppEnvironment(): AppEnvironment {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase().trim();
  if (env === 'production' || env === 'prod') return 'production';
  if (env === 'test' || env === 'testing') return 'test';
  return 'development';
}

export interface DbConfig {
  environment: AppEnvironment;
  dataDir: string;
  dbFilePath: string;
  vaultDir: string;
}

export function resolveDbConfig(env: AppEnvironment = getAppEnvironment()): DbConfig {
  // DATA_DIR points at a persistent disk mount in production (e.g. /data on
  // Render). Without it, everything lives in ./data and is wiped on restart.
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), 'data');
  const envSuffix = env === 'production' ? 'prod' : env === 'test' ? 'test' : 'dev';
  
  const customDbFile = process.env.DATABASE_FILE || process.env.DB_FILE;
  const dbFilePath = customDbFile
    ? path.resolve(process.cwd(), customDbFile)
    : path.resolve(dataDir, `db.${envSuffix}.json`);

  const vaultDir = path.resolve(dataDir, 'vault', envSuffix);

  return {
    environment: env,
    dataDir,
    dbFilePath,
    vaultDir,
  };
}

export class Database {
  private config: DbConfig;
  private lastSessionTouchSave = 0;
  public data: DatabaseSchema = {
    users: [],
    sessions: [],
    connections: [],
    conversations: [],
    messages: [],
    vault_media: [],
  };

  constructor(customConfig?: Partial<DbConfig>) {
    const baseConfig = resolveDbConfig();
    this.config = {
      ...baseConfig,
      ...customConfig,
    };

    // Ensure storage directories exist
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.vaultDir)) {
      fs.mkdirSync(this.config.vaultDir, { recursive: true });
    }

    this.initializeAndLoad();

    // Start automatic 24-hour message deletion cleaner
    const cleanupTimer = setInterval(() => this.purgeExpiredMessages(), 30 * 1000);
    cleanupTimer.unref();
  }

  public getEnvironment(): AppEnvironment {
    return this.config.environment;
  }

  public getDbFilePath(): string {
    return this.config.dbFilePath;
  }

  public getVaultDirPath(): string {
    return this.config.vaultDir;
  }

  private initializeAndLoad() {
    const { dbFilePath, environment } = this.config;
    const legacyDbFile = path.resolve(this.config.dataDir, 'db.json');

    try {
      if (fs.existsSync(dbFilePath)) {
        // Load existing environment database - NEVER automatically wipe or reset
        const raw = fs.readFileSync(dbFilePath, 'utf-8');
        this.data = JSON.parse(raw);
        if (this.backfillSessionIds()) this.save();
        console.log(`[DB] Loaded ${environment} database (${this.data.users.length} accounts) from ${dbFilePath}`);
      } else {
        // Database does not exist yet. Safe initialization per environment:
        if (environment === 'production') {
          // If legacy db.json exists, safely filter out all development test accounts
          if (fs.existsSync(legacyDbFile)) {
            console.log('[DB] Initializing production database: migrating from legacy db while isolating test accounts...');
            try {
              const legacyRaw = fs.readFileSync(legacyDbFile, 'utf-8');
              const legacyData: DatabaseSchema = JSON.parse(legacyRaw);
              
              // Only transfer accounts that are NOT test/sample accounts
              const legitimateAccounts = (legacyData.users || []).filter((u) => {
                const norm = (u.username_normalized || u.username || '').toLowerCase().trim();
                const isTest =
                  norm === 'alice' ||
                  norm === 'bob' ||
                  norm === 'charlie' ||
                  norm === 'eve' ||
                  norm === 'david' ||
                  norm.startsWith('test') ||
                  norm.startsWith('sample') ||
                  norm.startsWith('demo') ||
                  /^(david|eve|charlie)_[0-9]+/i.test(norm);
                return !isTest;
              });

              if (legitimateAccounts.length > 0) {
                const legitIds = new Set(legitimateAccounts.map((u) => u.id));
                this.data = {
                  users: legitimateAccounts,
                  sessions: (legacyData.sessions || []).filter((s) => legitIds.has(s.user_id)),
                  connections: (legacyData.connections || []).filter(
                    (c) => legitIds.has(c.requester_id) && legitIds.has(c.recipient_id)
                  ),
                  conversations: (legacyData.conversations || []).filter(
                    (c) => legitIds.has(c.user_one_id) && legitIds.has(c.user_two_id)
                  ),
                  messages: [],
                  vault_media: (legacyData.vault_media || []).filter((v) => legitIds.has(v.user_id)),
                };
                console.log(`[DB] Production initialized with ${legitimateAccounts.length} legitimate accounts and 0 test accounts.`);
              } else {
                console.log('[DB] Production environment initialized with 0 test accounts.');
              }
            } catch (err) {
              console.warn('[DB] Could not migrate legacy db for production, starting fresh:', err);
            }
          } else {
            console.log('[DB] Fresh production database initialized (0 test accounts).');
          }
        } else if (environment === 'development') {
          // In development, preserve legacy data if available
          if (fs.existsSync(legacyDbFile)) {
            try {
              const legacyRaw = fs.readFileSync(legacyDbFile, 'utf-8');
              this.data = JSON.parse(legacyRaw);
              this.backfillSessionIds();
              console.log(`[DB] Development database initialized from legacy db (${this.data.users.length} accounts).`);
            } catch (err) {
              console.warn('[DB] Error copying legacy db for development:', err);
            }
          }
        }
        this.save();
      }
    } catch (err) {
      console.error('[DB] Failed to load DB file, initializing clean state:', err);
      this.save();
    }
  }

  public reload() {
    if (fs.existsSync(this.config.dbFilePath)) {
      const raw = fs.readFileSync(this.config.dbFilePath, 'utf-8');
      this.data = JSON.parse(raw);
      this.backfillSessionIds();
    }
  }

  /** Assign stable device IDs to legacy sessions that predate the `id` field. */
  private backfillSessionIds(): boolean {
    let changed = false;
    for (const s of this.data.sessions || []) {
      if (!(s as any).id) {
        (s as any).id = crypto.randomUUID();
        changed = true;
      }
    }
    return changed;
  }

  public save() {
    try {
      const tempPath = `${this.config.dbFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.atomicRename(tempPath, this.config.dbFilePath);
    } catch (err) {
      console.error('[DB] Error persisting DB file:', err);
    }
  }

  /** Atomic rename with retries for Windows file locks (OneDrive/AV scanners). */
  private atomicRename(tmp: string, dest: string, attempts = 3): void {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        fs.renameSync(tmp, dest);
        return;
      } catch (err: any) {
        lastErr = err;
        if (err?.code === 'EPERM' || err?.code === 'EBUSY' || err?.code === 'EACCES') {
          // Brief backoff then retry; file is likely locked by sync/antivirus.
          const start = Date.now();
          while (Date.now() - start < 50) { /* busy-wait 50ms */ }
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  // --- Password & Security Helpers ---
  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  public verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  public normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  // --- User Methods ---
  public findUserByUsername(username: string): User | undefined {
    const normalized = this.normalizeUsername(username);
    return this.data.users.find((u) => u.username_normalized === normalized);
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public createUser(username: string, passwordHash: string): User {
    const normalized = this.normalizeUsername(username);
    if (this.findUserByUsername(normalized)) {
      throw new Error('Username is already taken');
    }

    const user: User = {
      id: crypto.randomUUID(),
      username: username.trim(),
      username_normalized: normalized,
      password_hash: passwordHash,
      vault_pin_hash: null,
      created_at: Date.now(),
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  public updatePassword(userId: string, newPasswordHash: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;
    user.password_hash = newPasswordHash;
    this.save();
    return true;
  }

  public updateVaultPin(userId: string, pinHash: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;
    user.vault_pin_hash = pinHash;
    user.must_change_vault_pin = false;
    this.save();
    return true;
  }

  // --- Administrator User Management Methods ---

  /**
   * Resets an individual user's account password to temporary default password hash.
   * Enforces that only the selected account is modified.
   * Immediately revokes all active device sessions so the user must re-authenticate.
   * Sets must_change_password = true so the user is required to change it on next login.
   */
  public resetUserPassword(userId: string, tempPasswordHash: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;

    user.password_hash = tempPasswordHash;
    user.must_change_password = true;

    // Invalidate all active sessions for this user immediately
    this.data.sessions = this.data.sessions.filter((s) => s.user_id !== userId);

    this.save();
    return true;
  }

  /**
   * Resets an individual user's vault PIN to default PIN hash.
   * Enforces that only the selected account's vault is modified.
   * Sets must_change_vault_pin = true so the user is prompted to set a new personal PIN.
   */
  public resetUserVaultPin(userId: string, defaultPinHash: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;

    user.vault_pin_hash = defaultPinHash;
    user.must_change_vault_pin = true;

    this.save();
    return true;
  }

  public clearMustChangePassword(userId: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;
    user.must_change_password = false;
    this.save();
    return true;
  }

  public clearMustChangeVaultPin(userId: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;
    user.must_change_vault_pin = false;
    this.save();
    return true;
  }

  /**
   * Computes the number of currently active user accounts based on real database records.
   * Activity rule: An account is considered active if it has an active session within the past
   * 7 days (or unexpired session) or was created within the past 7 days.
   */
  public getActiveAccountsCount(activeWindowMs = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const cutoff = now - activeWindowMs;
    const activeUserIds = new Set<string>();

    for (const session of this.data.sessions) {
      if (session.expires_at > now || session.last_active_at > cutoff) {
        activeUserIds.add(session.user_id);
      }
    }

    for (const user of this.data.users) {
      if (user.created_at > cutoff) {
        activeUserIds.add(user.id);
      }
    }

    return activeUserIds.size;
  }

  /**
   * Retrieves the searchable list of user accounts for administrator inspection.
   * Does NOT expose password hashes, vault PIN hashes, or private encryption keys.
   */
  public getUsersListForAdmin(query?: string) {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const normalizedQuery = query ? query.trim().toLowerCase() : '';

    return this.data.users
      .filter((u) => {
        if (!normalizedQuery) return true;
        return (
          u.username_normalized.includes(normalizedQuery) ||
          u.username.toLowerCase().includes(normalizedQuery) ||
          u.id.toLowerCase().includes(normalizedQuery)
        );
      })
      .map((user) => {
        const userSessions = this.data.sessions.filter(
          (s) => s.user_id === user.id && s.expires_at > now
        );
        const lastActiveSession = [...this.data.sessions]
          .filter((s) => s.user_id === user.id)
          .sort((a, b) => b.last_active_at - a.last_active_at)[0];

        const lastActiveAt = lastActiveSession ? lastActiveSession.last_active_at : user.created_at;
        const isActive =
          userSessions.length > 0 || lastActiveAt > sevenDaysAgo || user.created_at > sevenDaysAgo;

        const vaultItems = this.data.vault_media.filter((vm) => vm.user_id === user.id);

        return {
          id: user.id,
          username: user.username,
          created_at: user.created_at,
          status: isActive ? ('active' as const) : ('inactive' as const),
          activeSessionsCount: userSessions.length,
          lastActiveAt,
          hasVaultPin: !!user.vault_pin_hash,
          vaultItemsCount: vaultItems.length,
          mustChangePassword: !!user.must_change_password,
          mustChangeVaultPin: !!user.must_change_vault_pin,
        };
      })
      .sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Retrieves full administrative details for an individual user account.
   */
  public getUserAdminDetails(userId: string) {
    const user = this.findUserById(userId);
    if (!user) return null;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const userSessions = this.data.sessions.filter((s) => s.user_id === user.id);
    const activeSessions = userSessions.filter((s) => s.expires_at > now);

    const lastActiveSession = [...userSessions].sort((a, b) => b.last_active_at - a.last_active_at)[0];
    const lastActiveAt = lastActiveSession ? lastActiveSession.last_active_at : user.created_at;

    const isActive =
      activeSessions.length > 0 || lastActiveAt > sevenDaysAgo || user.created_at > sevenDaysAgo;

    const userVault = this.data.vault_media.filter((vm) => vm.user_id === user.id);
    const aggregateVaultBytes = userVault.reduce((acc, item) => acc + (item.file_size || 0), 0);

    const userConnections = this.data.connections.filter(
      (c) => (c.requester_id === user.id || c.recipient_id === user.id) && c.status === 'accepted'
    );

    return {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
      status: isActive ? ('active' as const) : ('inactive' as const),
      lastActiveAt,
      mustChangePassword: !!user.must_change_password,
      mustChangeVaultPin: !!user.must_change_vault_pin,
      sessions: {
        totalSessionsCount: userSessions.length,
        activeSessionsCount: activeSessions.length,
        maxDevicesAllowed: Database.MAX_DEVICES_PER_USER,
        activeSessions: activeSessions.map((s) => ({
          deviceName: s.device_name || this.detectDeviceType(s.user_agent),
          created_at: s.created_at,
          last_active_at: s.last_active_at,
          expires_at: s.expires_at,
        })),
      },
      vault: {
        hasVaultPin: !!user.vault_pin_hash,
        mustChangePin: !!user.must_change_vault_pin,
        itemsCount: userVault.length,
        totalBytes: aggregateVaultBytes,
      },
      connectionsCount: userConnections.length,
    };
  }

  public deleteUserAccount(userId: string): boolean {
    // 1. Remove user
    const uIdx = this.data.users.findIndex((u) => u.id === userId);
    if (uIdx === -1) return false;
    this.data.users.splice(uIdx, 1);

    // 2. Remove sessions
    this.data.sessions = this.data.sessions.filter((s) => s.user_id !== userId);

    // 3. Remove connections
    this.data.connections = this.data.connections.filter(
      (c) => c.requester_id !== userId && c.recipient_id !== userId
    );

    // 4. Find all conversations involving this user
    const affectedConvs = this.data.conversations.filter(
      (c) => c.user_one_id === userId || c.user_two_id === userId
    );
    const convIds = new Set(affectedConvs.map((c) => c.id));
    this.data.conversations = this.data.conversations.filter((c) => !convIds.has(c.id));

    // 5. Delete all messages from those conversations
    this.data.messages = this.data.messages.filter((m) => !convIds.has(m.conversation_id));

    // 6. Delete all vault media and disk files
    const userVault = this.data.vault_media.filter((vm) => vm.user_id === userId);
    for (const item of userVault) {
      const fullPath = path.resolve(this.config.vaultDir, item.storage_path);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.error('[DB] Error deleting vault file during account delete:', e);
        }
      }
    }
    this.data.vault_media = this.data.vault_media.filter((vm) => vm.user_id !== userId);

    this.save();
    return true;
  }

  // --- Session Methods (Maximum 3 Active Devices) ---
  public static readonly MAX_DEVICES_PER_USER = 3;

  private detectDeviceType(userAgent?: string): string {
    if (!userAgent) return 'Device';
    if (/android/i.test(userAgent)) return 'Android Device';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS Device';
    if (/macintosh|mac os x/i.test(userAgent)) return 'Mac Desktop';
    if (/windows/i.test(userAgent)) return 'Windows PC';
    if (/linux/i.test(userAgent)) return 'Linux Device';
    return 'Web Client';
  }

  public createSession(userId: string, userAgent?: string, customDeviceName?: string): Session {
    const now = Date.now();
    // 1. Purge expired sessions
    this.data.sessions = this.data.sessions.filter((s) => s.expires_at > now);

    // 2. Enforce maximum 3 devices limit per account
    const userSessions = this.data.sessions
      .filter((s) => s.user_id === userId)
      .sort((a, b) => (a.last_active_at || a.created_at) - (b.last_active_at || b.created_at));

    if (userSessions.length >= Database.MAX_DEVICES_PER_USER) {
      // Remove oldest session to allow new device without lockouts (strict maximum 3 active devices maintained)
      const toEvictCount = userSessions.length - (Database.MAX_DEVICES_PER_USER - 1);
      const evictedTokens = new Set(userSessions.slice(0, toEvictCount).map((s) => s.token));
      this.data.sessions = this.data.sessions.filter((s) => !evictedTokens.has(s.token));
    }

    const currentCount = this.data.sessions.filter((s) => s.user_id === userId).length + 1;
    const deviceType = this.detectDeviceType(userAgent);
    const deviceName = customDeviceName || `${deviceType} #${currentCount}`;

    // 30 days session
    const token = crypto.randomBytes(32).toString('hex');
    const session: Session = {
      id: crypto.randomUUID(),
      token,
      user_id: userId,
      device_name: deviceName,
      user_agent: userAgent,
      created_at: now,
      last_active_at: now,
      expires_at: now + 30 * 24 * 60 * 60 * 1000,
    };
    this.data.sessions.push(session);
    this.save();
    return session;
  }

  public getSession(token: string): Session | undefined {
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return undefined;
    if (session.expires_at < Date.now()) {
      this.deleteSession(token);
      return undefined;
    }
    // Update last active (persist throttled to avoid rewriting db.json on every request)
    session.last_active_at = Date.now();
    if (Date.now() - this.lastSessionTouchSave > 30 * 1000) {
      this.lastSessionTouchSave = Date.now();
      this.save();
    }
    return session;
  }

  public getUserSessions(userId: string, currentToken: string) {
    const now = Date.now();
    const userSessions = this.data.sessions
      .filter((s) => s.user_id === userId && s.expires_at > now)
      .sort((a, b) => (b.last_active_at || b.created_at) - (a.last_active_at || a.created_at));

    return {
      activeDevices: userSessions.map((s) => ({
        id: s.id || s.token.substring(0, 10), // Stable device ID (legacy fallback: token prefix)
        deviceName: s.device_name || 'Active Device',
        createdAt: s.created_at,
        lastActiveAt: s.last_active_at || s.created_at,
        isCurrent: s.token === currentToken,
      })),
      totalCount: userSessions.length,
      maxAllowed: Database.MAX_DEVICES_PER_USER,
    };
  }

  public revokeOtherSessions(userId: string, currentToken: string): number {
    const beforeCount = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(
      (s) => s.user_id !== userId || s.token === currentToken
    );
    const removed = beforeCount - this.data.sessions.length;
    if (removed > 0) this.save();
    return removed;
  }

  public revokeSessionById(userId: string, deviceId: string): boolean {
    // Prefer exact stable device-ID match; fall back to legacy token-prefix
    // match for clients created before the `id` field existed.
    let idx = this.data.sessions.findIndex(
      (s) => s.user_id === userId && (s as Session).id === deviceId
    );
    if (idx === -1) {
      const candidates = this.data.sessions.filter(
        (s) => s.user_id === userId && s.token.startsWith(deviceId)
      );
      // Refuse ambiguous prefix matches to avoid revoking the wrong device.
      if (candidates.length !== 1) return false;
      idx = this.data.sessions.indexOf(candidates[0]);
    }
    if (idx === -1) return false;
    this.data.sessions.splice(idx, 1);
    this.save();
    return true;
  }

  public deleteSession(token: string) {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.save();
  }

  // --- Connection Methods ---
  public searchUsers(query: string, currentUserId: string): Array<{ id: string; username: string; connectionStatus: string | null }> {
    const trimmed = (query || '').trim().slice(0, 32);
    // Require a minimum query length to prevent full user enumeration via
    // single-character searches (e.g. "a", "e").
    if (trimmed.length < 2) return [];
    const q = this.normalizeUsername(trimmed);
    if (!q) return [];

    return this.data.users
      .filter((u) => u.id !== currentUserId && u.username_normalized.includes(q))
      .slice(0, 20)
      .map((u) => {
        const conn = this.getConnectionBetween(currentUserId, u.id);
        let connectionStatus: string | null = null;
        if (conn) {
          if (conn.status === 'accepted') connectionStatus = 'accepted';
          else if (conn.requester_id === currentUserId) connectionStatus = 'pending_sent';
          else connectionStatus = 'pending_received';
        }
        return {
          id: u.id,
          username: u.username,
          connectionStatus,
        };
      });
  }

  public getConnectionBetween(userAId: string, userBId: string): Connection | undefined {
    return this.data.connections.find(
      (c) =>
        (c.requester_id === userAId && c.recipient_id === userBId) ||
        (c.requester_id === userBId && c.recipient_id === userAId)
    );
  }

  public createConnectionRequest(requesterId: string, recipientId: string): Connection {
    if (requesterId === recipientId) {
      throw new Error('Cannot connect with yourself');
    }
    const recipient = this.findUserById(recipientId);
    if (!recipient) {
      throw new Error('User not found');
    }
    const existing = this.getConnectionBetween(requesterId, recipientId);
    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('Already connected');
      }
      if (existing.status === 'pending') {
        throw new Error('Connection request already exists');
      }
      // If rejected, allow re-requesting
      existing.status = 'pending';
      existing.requester_id = requesterId;
      existing.recipient_id = recipientId;
      existing.updated_at = Date.now();
      this.save();
      return existing;
    }

    const conn: Connection = {
      id: crypto.randomUUID(),
      requester_id: requesterId,
      recipient_id: recipientId,
      status: 'pending',
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.data.connections.push(conn);
    this.save();
    return conn;
  }

  public respondToConnection(connectionId: string, userId: string, action: 'accept' | 'reject'): Connection {
    const conn = this.data.connections.find((c) => c.id === connectionId);
    if (!conn) {
      throw new Error('Connection request not found');
    }
    if (conn.recipient_id !== userId) {
      throw new Error('Unauthorized to respond to this request');
    }
    if (conn.status !== 'pending') {
      throw new Error('Request already processed');
    }

    conn.status = action === 'accept' ? 'accepted' : 'rejected';
    conn.updated_at = Date.now();

    // If accepted, ensure conversation exists
    if (action === 'accept') {
      this.getOrCreateConversation(conn.requester_id, conn.recipient_id);
    }

    this.save();
    return conn;
  }

  public getPendingRequests(userId: string): {
    received: Array<{ id: string; requesterId: string; requesterUsername: string; createdAt: number }>;
    sent: Array<{ id: string; recipientId: string; recipientUsername: string; createdAt: number }>;
  } {
    const received = this.data.connections
      .filter((c) => c.recipient_id === userId && c.status === 'pending')
      .map((c) => {
        const u = this.findUserById(c.requester_id);
        return {
          id: c.id,
          requesterId: c.requester_id,
          requesterUsername: u ? u.username : 'Unknown',
          createdAt: c.created_at,
        };
      });

    const sent = this.data.connections
      .filter((c) => c.requester_id === userId && c.status === 'pending')
      .map((c) => {
        const u = this.findUserById(c.recipient_id);
        return {
          id: c.id,
          recipientId: c.recipient_id,
          recipientUsername: u ? u.username : 'Unknown',
          createdAt: c.created_at,
        };
      });

    return { received, sent };
  }

  public getAcceptedConnections(userId: string): Array<{
    connectionId: string;
    contactId: string;
    contactUsername: string;
    conversationId: string;
    connectedAt: number;
    lastMessage?: { createdAt: number; expiresAt: number };
  }> {
    const conns = this.data.connections.filter(
      (c) => (c.requester_id === userId || c.recipient_id === userId) && c.status === 'accepted'
    );

    const now = Date.now();
    return conns.map((c) => {
      const contactId = c.requester_id === userId ? c.recipient_id : c.requester_id;
      const contact = this.findUserById(contactId);
      const conv = this.getOrCreateConversation(userId, contactId);

      // Latest active message (if unexpired)
      const convMessages = this.data.messages
        .filter((m) => m.conversation_id === conv.id && m.expires_at > now)
        .sort((a, b) => b.created_at - a.created_at);

      const latest = convMessages[0];

      return {
        connectionId: c.id,
        contactId,
        contactUsername: contact ? contact.username : 'Unknown',
        conversationId: conv.id,
        connectedAt: c.updated_at,
        lastMessage: latest
          ? {
              createdAt: latest.created_at,
              expiresAt: latest.expires_at,
            }
          : undefined,
      };
    });
  }

  // --- Conversation & Chat Methods ---
  public getOrCreateConversation(userAId: string, userBId: string): Conversation {
    let conv = this.data.conversations.find(
      (c) =>
        (c.user_one_id === userAId && c.user_two_id === userBId) ||
        (c.user_one_id === userBId && c.user_two_id === userAId)
    );
    if (!conv) {
      conv = {
        id: crypto.randomUUID(),
        user_one_id: userAId,
        user_two_id: userBId,
        created_at: Date.now(),
      };
      this.data.conversations.push(conv);
      this.save();
    }
    return conv;
  }

  public getConversationById(id: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.id === id);
  }

  public areUsersConnected(userAId: string, userBId: string): boolean {
    const conn = this.getConnectionBetween(userAId, userBId);
    return !!conn && conn.status === 'accepted';
  }

  public sendMessage(conversationId: string, senderId: string, encryptedContent: string): Message {
    const conv = this.getConversationById(conversationId);
    if (!conv) {
      throw new Error('Conversation not found');
    }
    if (conv.user_one_id !== senderId && conv.user_two_id !== senderId) {
      throw new Error('Unauthorized for this conversation');
    }

    const recipientId = conv.user_one_id === senderId ? conv.user_two_id : conv.user_one_id;
    if (!this.areUsersConnected(senderId, recipientId)) {
      throw new Error('Cannot send messages: users are not connected');
    }

    const serverNow = Date.now();
    const expiresAt = serverNow + 24 * 60 * 60 * 1000; // Exact 24 hours retention

    const msg: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId,
      sender_id: senderId,
      encrypted_content: encryptedContent,
      created_at: serverNow,
      expires_at: expiresAt,
    };

    this.data.messages.push(msg);
    this.save();
    return msg;
  }

  public getMessages(conversationId: string, userId: string): Message[] {
    const conv = this.getConversationById(conversationId);
    if (!conv) {
      throw new Error('Conversation not found');
    }
    if (conv.user_one_id !== userId && conv.user_two_id !== userId) {
      throw new Error('Unauthorized');
    }

    const now = Date.now();
    // Strictly filter out any messages that have expired (never returned by API)
    return this.data.messages
      .filter((m) => m.conversation_id === conversationId && m.expires_at > now)
      .sort((a, b) => a.created_at - b.created_at);
  }

  // Mandatory 24-hour server-side hard purge
  public purgeExpiredMessages(): number {
    const now = Date.now();
    const initialCount = this.data.messages.length;
    this.data.messages = this.data.messages.filter((m) => m.expires_at > now);
    const purgedCount = initialCount - this.data.messages.length;
    if (purgedCount > 0) {
      this.save();
      console.log(`[PURGE] Permanently deleted ${purgedCount} expired messages.`);
    }
    return purgedCount;
  }

  // --- Vault Methods ---
  public addVaultMedia(
    userId: string,
    fileName: string,
    mediaType: 'photo' | 'video',
    mimeType: string,
    fileSize: number,
    iv: string,
    salt: string,
    encryptedBuffer: Buffer
  ): VaultMedia {
    const fileId = crypto.randomUUID();
    const relativePath = `${userId}_${fileId}.enc`;
    const fullPath = path.resolve(this.config.vaultDir, relativePath);

    fs.writeFileSync(fullPath, encryptedBuffer);

    const vaultItem: VaultMedia = {
      id: fileId,
      user_id: userId,
      file_name: fileName,
      storage_path: relativePath,
      media_type: mediaType,
      mime_type: mimeType,
      file_size: fileSize,
      iv,
      salt,
      created_at: Date.now(),
    };

    this.data.vault_media.push(vaultItem);
    this.save();
    return vaultItem;
  }

  public getVaultItems(userId: string): VaultMedia[] {
    return this.data.vault_media
      .filter((vm) => vm.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  public getVaultMediaById(mediaId: string, userId: string): { item: VaultMedia; filePath: string } | undefined {
    const item = this.data.vault_media.find((vm) => vm.id === mediaId && vm.user_id === userId);
    if (!item) return undefined;
    const filePath = path.resolve(this.config.vaultDir, item.storage_path);
    if (!fs.existsSync(filePath)) return undefined;
    return { item, filePath };
  }

  public deleteVaultMedia(mediaId: string, userId: string): boolean {
    const idx = this.data.vault_media.findIndex((vm) => vm.id === mediaId && vm.user_id === userId);
    if (idx === -1) return false;

    const [item] = this.data.vault_media.splice(idx, 1);
    const fullPath = path.resolve(this.config.vaultDir, item.storage_path);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        console.error('[DB] Error deleting vault media file:', e);
      }
    }
    this.save();
    return true;
  }
}

export const db = new Database();
