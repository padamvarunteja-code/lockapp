import path from 'node:path';
import { safeCleanupTestAccounts } from './db_migration';
import { resolveDbConfig, getAppEnvironment } from './db';

function runCleanupCli() {
  const env = getAppEnvironment();
  const config = resolveDbConfig(env);

  console.log('====================================================');
  console.log(' OnlyUs Safe Database Migration & Test Account Cleanup');
  console.log('====================================================');
  console.log(`Target Environment: ${env.toUpperCase()}`);
  console.log(`Database File:      ${config.dbFilePath}`);
  console.log(`Vault Directory:    ${config.vaultDir}`);
  console.log('----------------------------------------------------');

  const report = safeCleanupTestAccounts({
    dbPath: config.dbFilePath,
    vaultDir: config.vaultDir,
    backup: true,
    environment: env,
  });

  console.log(`\nScan & Cleanup Results:`);
  console.log(`• Status:                  ${report.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`• Backup Saved:            ${report.backupPath || 'N/A'}`);
  console.log(`• Total Accounts Before:   ${report.totalUsersBefore}`);
  console.log(`• Test Accounts Removed:   ${report.testAccountsRemoved.length}`);
  if (report.testAccountsRemoved.length > 0) {
    console.log(`  └─ Removed Usernames:    ${report.testAccountsRemoved.join(', ')}`);
  }
  console.log(`• Legitimate Preserved:    ${report.legitimateUsersPreserved.length}`);
  if (report.legitimateUsersPreserved.length > 0) {
    console.log(`  └─ Preserved Usernames:  ${report.legitimateUsersPreserved.join(', ')}`);
  }
  console.log(`• Total Remaining:         ${report.totalUsersRemaining}`);
  console.log(`• Test Accounts Remaining: ${report.testAccountsRemaining}`);
  console.log(`• Verification Check:      ${report.verificationPassed ? 'PASSED (0 Test Accounts)' : 'FAILED'}`);
  console.log('====================================================\n');

  if (!report.verificationPassed) {
    process.exit(1);
  }
}

runCleanupCli();
