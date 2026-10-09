import express from 'express';
import { adminDb } from './admin_db';
import { requireAdminAuth, requireAdminReauth, type AuthenticatedAdminRequest } from './admin_middleware';
import { db } from './db';
import { safeCleanupTestAccounts, classifyAccounts } from './db_migration';
import path from 'node:path';

export const adminRouter = express.Router();

// Admin Login (Requires Username + Password)
adminRouter.post('/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { username, password } = req.body;

  // 1. Check IP brute-force lockout
  if (adminDb.isIpLockedOut(ip)) {
    adminDb.recordAuditLog(
      'RATE_LIMIT_TRIGGERED',
      'CRITICAL',
      username ? `attempted:${username}` : 'UNKNOWN_ADMIN',
      ip,
      'IP address locked out due to exceeding maximum failed administrator login attempts.'
    );
    return res.status(429).json({
      error: 'Security Lockout: Too many failed administrator login attempts. This IP address is locked for 15 minutes.',
    });
  }

  if (!username || !password) {
    adminDb.recordFailedAttempt(ip);
    return res.status(400).json({
      error: 'Admin Username and Master Password are both required.',
    });
  }

  const admin = adminDb.findAdminByUsername(username);
  if (!admin) {
    adminDb.recordFailedAttempt(ip);
    adminDb.recordAuditLog(
      'ADMIN_LOGIN_FAILURE',
      'WARN',
      `attempted:${username}`,
      ip,
      'Failed admin login attempt: invalid administrator username.'
    );
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  // 2. Timing-safe verification of password
  const isPasswordValid = adminDb.verifyAdminPassword(password, admin.password_hash);
  if (!isPasswordValid) {
    adminDb.recordFailedAttempt(ip);
    adminDb.recordAuditLog(
      'ADMIN_LOGIN_FAILURE',
      'WARN',
      admin.username,
      ip,
      'Failed admin login attempt: incorrect password.'
    );
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  // Success: Reset failed attempts counter
  adminDb.resetFailedAttempts(ip);

  // Issue isolated admin session (15-minute inactivity limit)
  const session = adminDb.createAdminSession(admin);

  adminDb.recordAuditLog(
    'ADMIN_LOGIN_SUCCESS',
    'INFO',
    admin.username,
    ip,
    'Administrator authenticated successfully with password.'
  );

  return res.json({
    token: session.token,
    username: session.username,
    createdAt: session.created_at,
    inactivityTimeoutMs: 15 * 60 * 1000,
  });
});

// Admin Reauthentication (For sensitive operations)
adminRouter.post('/auth/reauth', requireAdminAuth, (req: AuthenticatedAdminRequest, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { password } = req.body;
  const session = req.adminSession!;

  const admin = adminDb.findAdminByUsername(session.username);
  if (!admin || !password) {
    return res.status(400).json({ error: 'Password is required for reauthentication.' });
  }

  const isValid = adminDb.verifyAdminPassword(password, admin.password_hash);
  if (!isValid) {
    adminDb.recordAuditLog(
      'ADMIN_LOGIN_FAILURE',
      'WARN',
      session.username,
      ip,
      'Failed administrator reauthentication attempt.'
    );
    return res.status(401).json({ error: 'Incorrect administrator password.' });
  }

  adminDb.markReauthenticated(session.token);

  adminDb.recordAuditLog(
    'ADMIN_REAUTH_SUCCESS',
    'INFO',
    session.username,
    ip,
    'Administrator successfully reauthenticated for sensitive operational controls.'
  );

  return res.json({ success: true, message: 'Reauthentication validated for 5 minutes.' });
});

// Admin Logout (Immediate session revocation)
adminRouter.post('/auth/logout', requireAdminAuth, (req: AuthenticatedAdminRequest, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const session = req.adminSession!;

  adminDb.revokeAdminSession(session.token);

  adminDb.recordAuditLog(
    'ADMIN_LOGOUT',
    'INFO',
    session.username,
    ip,
    'Administrator session terminated and revoked.'
  );

  return res.json({ success: true, message: 'Admin session revoked.' });
});

// Revoke All Admin Sessions
adminRouter.post('/auth/revoke-all-sessions', requireAdminAuth, requireAdminReauth, (req: AuthenticatedAdminRequest, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const session = req.adminSession!;

  const revokedCount = adminDb.revokeAllAdminSessions();

  adminDb.recordAuditLog(
    'ADMIN_SESSION_REVOKED',
    'WARN',
    session.username,
    ip,
    `Revoked all ${revokedCount} active administrator sessions via emergency control.`
  );

  return res.json({ success: true, revokedCount });
});

// System Telemetry & Statistics (Zero-Knowledge: NO user passwords, NO vault PINs, NO message text)
adminRouter.get('/telemetry', requireAdminAuth, (_req, res) => {
  // Aggregate non-sensitive metadata from main database
  const rawDb = (db as any).data;
  const now = Date.now();

  const totalUsers = rawDb.users.length;
  const activeSessions = rawDb.sessions.filter((s: any) => s.expires_at > now).length;
  const totalConnections = rawDb.connections.filter((c: any) => c.status === 'accepted').length;
  const pendingConnections = rawDb.connections.filter((c: any) => c.status === 'pending').length;
  const activeConversations = rawDb.conversations.length;
  const activeMessages = rawDb.messages.filter((m: any) => m.expires_at > now).length;

  const totalVaultFiles = rawDb.vault_media.length;
  const totalVaultBytes = rawDb.vault_media.reduce((acc: number, item: any) => acc + (item.file_size || 0), 0);

  // Return strictly operational statistics
  return res.json({
    users: {
      totalAccounts: totalUsers,
      activeDeviceSessions: activeSessions,
      maxDevicesAllowedPerUser: 3,
    },
    connections: {
      mutualAccepted: totalConnections,
      pendingRequests: pendingConnections,
    },
    messaging: {
      activeConversations,
      unexpiredMessages: activeMessages,
      retentionPolicyHours: 24,
      shredderIntervalSeconds: 30,
    },
    vault: {
      encryptedFilesStored: totalVaultFiles,
      aggregateEncryptedBytes: totalVaultBytes,
      encryptionStandard: 'AES-256-GCM + PBKDF2 (100k rounds)',
    },
    securityPosture: {
      userPasswordStorage: 'Scrypt (16-byte random salt, 64-byte hash)',
      plaintextPasswordsStored: false,
      vaultKeysStoredOnServer: false,
      notificationsDisabled: true,
      inactivityTimeoutMinutes: 15,
    },
    databaseEnvironment: {
      mode: db.getEnvironment(),
      isProduction: db.getEnvironment() === 'production',
      databaseFile: path.basename(db.getDbFilePath()),
    },
  });
});

// Accounts Inspector (SAFE: never exposes password hashes, vault PIN hashes, or keys.
// Uses the sanitized admin user list: id, username, status, session counts, vault counts.)
adminRouter.get('/accounts', requireAdminAuth, (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : undefined;
  const accounts = db.getUsersListForAdmin(query);
  return res.json({ accounts });
});

// Update Master Admin Password
adminRouter.post('/settings/update-credentials', requireAdminAuth, requireAdminReauth, (req: AuthenticatedAdminRequest, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const session = req.adminSession!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current administrator password is required to update credentials.' });
  }

  const admin = adminDb.findAdminByUsername(session.username);
  if (!admin) {
    return res.status(404).json({ error: 'Administrator user not found.' });
  }

  const isCurrentValid = adminDb.verifyAdminPassword(currentPassword, admin.password_hash);
  if (!isCurrentValid) {
    adminDb.recordAuditLog(
      'ADMIN_LOGIN_FAILURE',
      'WARN',
      session.username,
      ip,
      'Failed administrator credential update: incorrect current password.'
    );
    return res.status(401).json({ error: 'Current administrator password is incorrect.' });
  }

  if (newPassword && newPassword.length < 8) {
    return res.status(400).json({ error: 'New administrator password must be at least 8 characters long.' });
  }

  if (!newPassword) {
    return res.status(400).json({ error: 'New administrator password is required.' });
  }

  const success = adminDb.updateAdminCredentials(session.username, newPassword);
  if (!success) {
    return res.status(500).json({ error: 'Failed to update administrator credentials.' });
  }

  adminDb.recordAuditLog(
    'ADMIN_CREDENTIALS_CHANGED',
    'CRITICAL',
    session.username,
    ip,
    'Administrator updated master password.'
  );

  return res.json({
    success: true,
    message: 'Administrator credentials updated successfully. Please use your new credentials on future logins.',
  });
});

// Tamper-Resistant Audit Logs
adminRouter.get('/audit-logs', requireAdminAuth, (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const logs = adminDb.getAuditLogs(limit);
  return res.json({ logs });
});

// Verify Cryptographic Hash-Chain Integrity
adminRouter.post('/audit-logs/verify-integrity', requireAdminAuth, (req: AuthenticatedAdminRequest, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const session = req.adminSession!;

  const result = adminDb.verifyAuditChainIntegrity();

  adminDb.recordAuditLog(
    'INTEGRITY_CHECK_RUN',
    'INFO',
    session.username,
    ip,
    `Audit trail integrity verification completed. Valid: ${result.valid}, Verified: ${result.verifiedCount} blocks.`
  );

  return res.json({
    valid: result.valid,
    verifiedBlocks: result.verifiedCount,
    brokenAtId: result.brokenAtId || null,
    tamperDetected: !result.valid,
  });
});

// Trigger Operational Data Purge (Requires Re-authentication)
adminRouter.post('/ops/trigger-purge', requireAdminAuth, requireAdminReauth, (req: AuthenticatedAdminRequest, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const session = req.adminSession!;

  const purgedCount = db.purgeExpiredMessages();

  adminDb.recordAuditLog(
    'DATA_PURGE_EXECUTED',
    'INFO',
    session.username,
    ip,
    `Manual 24-hour message shredder triggered. Permanently removed ${purgedCount} expired records.`
  );

  return res.json({
    success: true,
    purgedCount,
    message: `Shredded ${purgedCount} expired messages from storage.`,
  });
});

// Database Environment Inspection & Test Account Status
adminRouter.get('/ops/db-status', requireAdminAuth, (_req, res) => {
  const users = (db as any).data.users || [];
  const { testAccounts, legitimateAccounts } = classifyAccounts(users);

  return res.json({
    environment: db.getEnvironment(),
    isProduction: db.getEnvironment() === 'production',
    databaseFile: path.basename(db.getDbFilePath()),
    databasePath: db.getDbFilePath(),
    totalAccounts: users.length,
    testAccountsCount: testAccounts.length,
    testAccountUsernames: testAccounts.map((u) => u.username),
    legitimateAccountsCount: legitimateAccounts.length,
    legitimateAccountUsernames: legitimateAccounts.map((u) => u.username),
    timestamp: Date.now(),
  });
});

// Safe Database Migration & Cleanup Procedure (Requires Re-authentication)
adminRouter.post('/ops/cleanup-test-accounts', requireAdminAuth, requireAdminReauth, (req: AuthenticatedAdminRequest, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const session = req.adminSession!;

  const dbPath = db.getDbFilePath();
  const vaultDir = db.getVaultDirPath();

  const report = safeCleanupTestAccounts({
    dbPath,
    vaultDir,
    backup: true,
    environment: db.getEnvironment(),
  });

  // Reload in-memory database to reflect verified disk state
  db.reload();

  adminDb.recordAuditLog(
    'DATA_PURGE_EXECUTED',
    'WARN',
    session.username,
    ip,
    `Safe database migration & test account cleanup executed. Removed ${report.testAccountsRemoved.length} test accounts (${report.testAccountsRemoved.join(', ')}). Preserved ${report.legitimateUsersPreserved.length} genuine user accounts.`
  );

  return res.json({
    success: true,
    report,
  });
});

// Threat Model Documentation Endpoint (Req #16)
adminRouter.get('/threat-model', requireAdminAuth, (_req, res) => {
  return res.json({
    statement: 'OnlyUs Security Posture & Remaining Threat Model',
    implementedProtections: [
      'Zero-knowledge client-side AES-256-GCM encryption for messages and vault media',
      'PBKDF2 key derivation (100,000 iterations) with local hardware keys',
      'Scrypt password hashing with constant-time verification against timing attacks',
      'Tamper-resistant cryptographic hash-chained audit logging',
      'Scrypt-hashed administrator passwords with IP brute-force lockout and re-authentication gates for privileged actions',
      'Strict 15-minute inactivity timeouts and re-authentication gates for privileged actions',
      'Complete exclusion of push notification SDKs (zero device tracking)',
      'Automated 24-hour hard-purge of expired messages from persistent disk',
    ],
    knownRemainingRisks: [
      {
        vector: 'Client Device Compromise',
        description: 'Physical extraction or malware (e.g., keyloggers, screen recorders) on an unlocked end-user device.',
        mitigation: 'Vault biometric/PIN relock and memory-only decrypted blob lifecycles.',
      },
      {
        vector: 'Browser Sandbox & Extension Risks',
        description: 'Malicious browser extensions installed by the user could inspect the DOM in web mode.',
        mitigation: 'Recommend Android APK/PWA standalone sandbox installation or private browsing profiles.',
      },
      {
        vector: 'Infrastructure Cold Backups',
        description: 'Snapshot backups at cloud infrastructure level may temporarily retain expired encrypted rows until backup rotation cycles conclude.',
        mitigation: 'All persisted content is encrypted ciphertext; without the recipient private keys, retained ciphertext remains mathematically opaque.',
      },
    ],
  });
});
