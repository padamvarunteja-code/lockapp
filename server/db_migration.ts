import fs from 'node:fs';
import path from 'node:path';
import type { User, DatabaseSchema, VaultMedia } from './db';

export interface CleanupReport {
  success: boolean;
  timestamp: number;
  environment: string;
  databasePath: string;
  backupPath?: string;
  totalUsersBefore: number;
  testAccountsRemoved: string[];
  legitimateUsersPreserved: string[];
  totalUsersRemaining: number;
  testAccountsRemaining: number;
  verificationPassed: boolean;
}

/**
 * Robust classifier to identify development test accounts, sample users,
 * and automated test harness accounts.
 */
export function isTestAccount(user: { id: string; username: string; username_normalized?: string }): boolean {
  const norm = (user.username_normalized || user.username || '').toLowerCase().trim();

  // 1. Explicit sample/test usernames from test modal or dev helpers
  const exactTestUsernames = new Set([
    'alice',
    'bob',
    'charlie',
    'eve',
    'david',
    'testuser',
    'testuser2',
    'test',
    'admin_test',
    'sample',
    'demo',
  ]);
  if (exactTestUsernames.has(norm)) {
    return true;
  }

  // 2. Automated test suite generated patterns (e.g. david_1791524012502, eve_1791524012549, charlie_1791538...)
  if (/^(david|eve|charlie)_[0-9]+/i.test(norm)) {
    return true;
  }

  // 3. Test prefixes and identifiers
  if (/^test[_\-0-9a-z]*/i.test(norm)) {
    return true;
  }

  // 4. Sample and demo prefixes
  if (/^(sample|demo|fake|dummy)[_\-0-9a-z]*/i.test(norm)) {
    return true;
  }

  // 5. Usernames ending with _test or -test
  if (/[_\-]test$/i.test(norm)) {
    return true;
  }

  return false;
}

export function isLegitimateAccount(user: { id: string; username: string; username_normalized?: string }): boolean {
  return !isTestAccount(user);
}

export function classifyAccounts(users: User[]): {
  testAccounts: User[];
  legitimateAccounts: User[];
} {
  const testAccounts: User[] = [];
  const legitimateAccounts: User[] = [];

  for (const user of users) {
    if (isTestAccount(user)) {
      testAccounts.push(user);
    } else {
      legitimateAccounts.push(user);
    }
  }

  return { testAccounts, legitimateAccounts };
}

/**
 * Safely cleans test accounts from a target JSON database file.
 * Creates an automatic pre-cleanup backup, purges test accounts and their cascading
 * relationships (sessions, connections, conversations, messages, vault items),
 * preserves ALL legitimate user accounts and genuine data, and verifies the result.
 */
export function safeCleanupTestAccounts(options: {
  dbPath: string;
  vaultDir?: string;
  backup?: boolean;
  environment?: string;
}): CleanupReport {
  const { dbPath, vaultDir, backup = true, environment = 'production' } = options;

  if (!fs.existsSync(dbPath)) {
    return {
      success: true,
      timestamp: Date.now(),
      environment,
      databasePath: dbPath,
      totalUsersBefore: 0,
      testAccountsRemoved: [],
      legitimateUsersPreserved: [],
      totalUsersRemaining: 0,
      testAccountsRemaining: 0,
      verificationPassed: true,
    };
  }

  // Read current database
  const rawContent = fs.readFileSync(dbPath, 'utf-8');
  let data: DatabaseSchema;
  try {
    data = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`Failed to parse database file at ${dbPath}: ${err}`);
  }

  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.connections)) data.connections = [];
  if (!Array.isArray(data.conversations)) data.conversations = [];
  if (!Array.isArray(data.messages)) data.messages = [];
  if (!Array.isArray(data.vault_media)) data.vault_media = [];

  const totalUsersBefore = data.users.length;
  const { testAccounts, legitimateAccounts } = classifyAccounts(data.users);

  // If backup requested, write full pre-cleanup snapshot
  let backupPath: string | undefined;
  if (backup) {
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${dbPath}.backup_${timestampStr}.json`;
    fs.writeFileSync(backupPath, rawContent, 'utf-8');
  }

  // If no test accounts found, return immediately without touching the file
  if (testAccounts.length === 0) {
    return {
      success: true,
      timestamp: Date.now(),
      environment,
      databasePath: dbPath,
      backupPath,
      totalUsersBefore,
      testAccountsRemoved: [],
      legitimateUsersPreserved: legitimateAccounts.map((u) => u.username),
      totalUsersRemaining: legitimateAccounts.length,
      testAccountsRemaining: 0,
      verificationPassed: true,
    };
  }

  const testUserIds = new Set(testAccounts.map((u) => u.id));
  const testUsernames = testAccounts.map((u) => u.username);
  const legitimateUsernames = legitimateAccounts.map((u) => u.username);

  // 1. Preserve only legitimate users
  data.users = legitimateAccounts;

  // 2. Cascade: Remove sessions belonging to test users
  data.sessions = data.sessions.filter((s) => !testUserIds.has(s.user_id));

  // 3. Cascade: Remove connections where requester or recipient is a test user
  data.connections = data.connections.filter(
    (c) => !testUserIds.has(c.requester_id) && !testUserIds.has(c.recipient_id)
  );

  // 4. Cascade: Identify conversations involving test users
  const testConvs = data.conversations.filter(
    (c) => testUserIds.has(c.user_one_id) || testUserIds.has(c.user_two_id)
  );
  const testConvIds = new Set(testConvs.map((c) => c.id));

  // Keep conversations only between legitimate users
  data.conversations = data.conversations.filter((c) => !testConvIds.has(c.id));

  // 5. Cascade: Remove messages belonging to test conversations
  data.messages = data.messages.filter((m) => !testConvIds.has(m.conversation_id));

  // 6. Cascade: Remove vault media belonging to test users and unlink files
  const testVaultItems = data.vault_media.filter((vm) => testUserIds.has(vm.user_id));
  if (vaultDir && fs.existsSync(vaultDir)) {
    for (const item of testVaultItems) {
      const fullPath = path.resolve(vaultDir, item.storage_path);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore unlink error
        }
      }
    }
  }
  data.vault_media = data.vault_media.filter((vm) => !testUserIds.has(vm.user_id));

  // Atomic write to disk
  const tempPath = `${dbPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, dbPath);

  // Re-read file to verify disk state
  const verifyRaw = fs.readFileSync(dbPath, 'utf-8');
  const verifyData: DatabaseSchema = JSON.parse(verifyRaw);

  const remainingTestAccounts = verifyData.users.filter(isTestAccount);
  const remainingLegitimate = verifyData.users.filter(isLegitimateAccount);

  const verificationPassed =
    remainingTestAccounts.length === 0 &&
    remainingLegitimate.length === legitimateAccounts.length;

  return {
    success: true,
    timestamp: Date.now(),
    environment,
    databasePath: dbPath,
    backupPath,
    totalUsersBefore,
    testAccountsRemoved: testUsernames,
    legitimateUsersPreserved: legitimateUsernames,
    totalUsersRemaining: remainingLegitimate.length,
    testAccountsRemaining: remainingTestAccounts.length,
    verificationPassed,
  };
}
