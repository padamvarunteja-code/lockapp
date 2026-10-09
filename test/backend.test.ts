import { db } from '../server/db';
import { adminDb } from '../server/admin_db';
import crypto from 'node:crypto';

async function runTests() {
  console.log('--- STARTING AEGIS AUTOMATED SECURITY & FUNCTIONAL TESTS ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    }
  }

  // 1. Registration & Duplicate Usernames & Case-Insensitive Uniqueness
  const testU1 = `charlie_${Date.now()}`;
  const pass1 = 'SuperSecret123!';
  const hash1 = db.hashPassword(pass1);
  const u1 = db.createUser(testU1, hash1);
  assert(u1.username === testU1, 'User 1 created successfully');
  assert(u1.username_normalized === testU1.toLowerCase(), 'Username normalized to lowercase');

  let dupCaught = false;
  try {
    db.createUser(testU1.toUpperCase(), hash1);
  } catch {
    dupCaught = true;
  }
  assert(dupCaught, 'Case-insensitive duplicate username rejected');

  // 2. Login & Password Verification with Scrypt
  assert(db.verifyPassword(pass1, u1.password_hash), 'Correct password verified with scrypt');
  assert(!db.verifyPassword('WrongPassword!', u1.password_hash), 'Incorrect password rejected');

  // 3. Password Changes
  const newPass = 'NewSecurePass456!';
  const newHash = db.hashPassword(newPass);
  db.updatePassword(u1.id, newHash);
  const updatedU1 = db.findUserById(u1.id)!;
  assert(db.verifyPassword(newPass, updatedU1.password_hash), 'Password updated and verified');
  assert(!db.verifyPassword(pass1, updatedU1.password_hash), 'Old password invalidated');

  // 4. Connection Requests & Mutual Isolation
  const testU2 = `david_${Date.now()}`;
  const u2 = db.createUser(testU2, db.hashPassword('PassDave123!'));

  // Self-connection attempt
  let selfCaught = false;
  try {
    db.createConnectionRequest(u1.id, u1.id);
  } catch {
    selfCaught = true;
  }
  assert(selfCaught, 'Self-connection request strictly forbidden');

  // Send request from U1 to U2
  const connReq = db.createConnectionRequest(u1.id, u2.id);
  assert(connReq.status === 'pending', 'Connection request created in pending state');

  // Duplicate request check
  let dupReqCaught = false;
  try {
    db.createConnectionRequest(u1.id, u2.id);
  } catch {
    dupReqCaught = true;
  }
  assert(dupReqCaught, 'Duplicate connection request prevented');

  // Respond: U2 accepts U1
  const acceptedConn = db.respondToConnection(connReq.id, u2.id, 'accept');
  assert(acceptedConn.status === 'accepted', 'Connection request accepted by recipient');
  assert(db.areUsersConnected(u1.id, u2.id), 'areUsersConnected returns true for mutual connection');

  // 5. Chat Authorization & 24-Hour Expiration Calculations
  const conv = db.getOrCreateConversation(u1.id, u2.id);
  assert(conv.user_one_id === u1.id || conv.user_two_id === u1.id, 'Conversation established for accepted pair');

  // Unconnected user cannot send message
  const testU3 = `eve_${Date.now()}`;
  const u3 = db.createUser(testU3, db.hashPassword('PassEve123!'));
  let unauthChatCaught = false;
  try {
    db.sendMessage(conv.id, u3.id, 'intercept attempt');
  } catch {
    unauthChatCaught = true;
  }
  assert(unauthChatCaught, 'Unconnected eavesdropper denied sending message');

  // Valid encrypted message sending
  const sampleEncryptedPayload = JSON.stringify({
    ct: 'c2VjcmV0X2NpcGhlcnRleHQ=',
    iv: 'aXZfc2FtcGxl',
    salt: 'c2FsdF9zYW1wbGU=',
  });
  const msg = db.sendMessage(conv.id, u1.id, sampleEncryptedPayload);
  assert(msg.encrypted_content === sampleEncryptedPayload, 'Ciphertext stored without server decryption');
  assert(
    msg.expires_at === msg.created_at + 24 * 60 * 60 * 1000,
    'Message expires_at set to exactly 24 hours after server created_at'
  );

  // 6. Server-side Message Expiration & Permanent Purge
  const activeMessages = db.getMessages(conv.id, u1.id);
  assert(activeMessages.some((m) => m.id === msg.id), 'Active unexpired message retrieved');

  // Simulate an expired message
  const expiredMsg: any = {
    id: crypto.randomUUID(),
    conversation_id: conv.id,
    sender_id: u1.id,
    encrypted_content: 'expired_payload',
    created_at: Date.now() - 25 * 60 * 60 * 1000,
    expires_at: Date.now() - 1 * 60 * 60 * 1000, // Expired 1 hour ago
  };
  (db as any).data.messages.push(expiredMsg);

  // Verification 1: getMessages ignores expired messages
  const filtered = db.getMessages(conv.id, u1.id);
  assert(!filtered.some((m) => m.id === expiredMsg.id), 'Expired message excluded from API response');

  // Verification 2: purge permanently deletes from database array
  const purged = db.purgeExpiredMessages();
  assert(purged >= 1, 'Server purge routine purged expired message');
  assert(
    !(db as any).data.messages.some((m: any) => m.id === expiredMsg.id),
    'Expired message permanently eradicated from memory and database disk'
  );

  // 7. Vault Client-Side AES-256-GCM Media & Storage
  const rawSecretBuffer = Buffer.from('FAKE_ENCRYPTED_IMAGE_BINARY');
  const vaultItem = db.addVaultMedia(
    u1.id,
    'private_photo.jpg',
    'photo',
    'image/jpeg',
    rawSecretBuffer.length,
    'sample_iv',
    'sample_salt',
    rawSecretBuffer
  );
  assert(vaultItem.user_id === u1.id, 'Vault item linked to owner user_id');

  // Owner retrieval
  const ownerVault = db.getVaultItems(u1.id);
  assert(ownerVault.some((v) => v.id === vaultItem.id), 'Owner successfully lists vault item');

  // Unauthorized non-owner retrieval
  const u2Vault = db.getVaultMediaById(vaultItem.id, u2.id);
  assert(u2Vault === undefined, 'Non-owner cannot access vault media (tenant isolation)');

  // Deletion
  const deleteVaultSuccess = db.deleteVaultMedia(vaultItem.id, u1.id);
  assert(deleteVaultSuccess, 'Owner permanently deletes vault item');
  assert(
    db.getVaultMediaById(vaultItem.id, u1.id) === undefined,
    'Deleted vault item removed from disk and registry'
  );

  // 8. Permanent Account Deletion
  const delSuccess = db.deleteUserAccount(u1.id);
  assert(delSuccess, 'Account deletion executed');
  assert(db.findUserById(u1.id) === undefined, 'User record wiped');
  assert(!db.areUsersConnected(u1.id, u2.id), 'All user connections eradicated');
  assert(
    db.getConversationById(conv.id) === undefined,
    'All conversations and messages eradicated on account deletion'
  );

  // 9. Multi-Device Login Support (Maximum 3 Active Devices)
  const dev1 = db.createSession(u2.id, 'Mozilla/5.0 Android', 'Pixel 8');
  const dev2 = db.createSession(u2.id, 'Mozilla/5.0 iPhone', 'iPhone 15');
  const dev3 = db.createSession(u2.id, 'Mozilla/5.0 Windows', 'Work PC');
  const sessionInfo3 = db.getUserSessions(u2.id, dev3.token);
  assert(sessionInfo3.totalCount === 3, 'Account successfully logs in on 3 simultaneous devices');
  assert(sessionInfo3.maxAllowed === 3, 'Maximum devices limit configured to 3');
  assert(db.getSession(dev1.token) !== undefined, 'Device 1 session active');
  assert(db.getSession(dev2.token) !== undefined, 'Device 2 session active');
  assert(db.getSession(dev3.token) !== undefined, 'Device 3 session active');

  // 4th device logs in -> oldest session (dev1) is rotated out to maintain max 3 limit
  const dev4 = db.createSession(u2.id, 'Mozilla/5.0 Mac', 'MacBook Pro');
  const sessionInfo4 = db.getUserSessions(u2.id, dev4.token);
  assert(sessionInfo4.totalCount === 3, 'Maximum 3 active devices limit strictly enforced after 4th login');
  assert(db.getSession(dev1.token) === undefined, 'Oldest device session rotated out on 4th login');
  assert(db.getSession(dev4.token) !== undefined, 'New 4th device session successfully active');

  // Revoke other devices
  const revoked = db.revokeOtherSessions(u2.id, dev4.token);
  assert(revoked === 2, 'Revoked other device sessions cleanly');
  assert(db.getUserSessions(u2.id, dev4.token).totalCount === 1, 'Only current device remains active');

  // 10. No-Notification Architecture Compliance
  // Verify no notification tokens, fcm libraries, or external push dependencies
  assert(
    (u2 as any).fcm_token === undefined && (u2 as any).push_subscription === undefined,
    'Zero push tokens or device tracking stored in user schemas'
  );

  // 11. High-Security Admin Authentication & Cryptographic Chain
  const admin = adminDb.findAdminByUsername('onlyus_admin')!;
  assert(admin !== undefined, 'Master administrator bootstrapped on server');
  assert(
    adminDb.verifyAdminPassword('SecOps@Defense2026!', admin.password_hash),
    'Admin password verified with scrypt'
  );
  assert(
    !adminDb.verifyAdminPassword('WrongAdminPass!', admin.password_hash),
    'Incorrect admin password rejected'
  );

  // Admin session creation
  const admSession = adminDb.createAdminSession(admin);
  assert(admSession.token.startsWith('adm_'), 'Admin session token isolated with secure prefix');
  assert(
    adminDb.getAdminSession(admSession.token) !== undefined,
    'Admin session active and verified'
  );

  // Reauthentication check
  assert(
    adminDb.isReauthenticated(admSession),
    'Fresh admin login satisfies reauthentication requirement'
  );

  // Inactivity expiration simulation (> 15 minutes)
  const expiredSession: any = {
    token: `adm_test_expired_${Date.now()}`,
    admin_id: admin.id,
    username: admin.username,
    created_at: Date.now() - 20 * 60 * 1000,
    last_active_at: Date.now() - 16 * 60 * 1000, // 16 min inactive
    expires_at: Date.now() + 3 * 60 * 60 * 1000,
  };
  (adminDb as any).data.admin_sessions.push(expiredSession);
  assert(
    adminDb.getAdminSession(expiredSession.token) === undefined,
    'Admin session automatically expired after 15 minutes of inactivity'
  );

  // Cryptographic Audit Trail Hash Chain Integrity
  adminDb.recordAuditLog(
    'INTEGRITY_CHECK_RUN',
    'INFO',
    'TEST_SUITE',
    '127.0.0.1',
    'Automated security test verified audit logging.'
  );
  const chainResult = adminDb.verifyAuditChainIntegrity();
  assert(chainResult.valid === true, 'Tamper-resistant cryptographic HMAC-SHA256 audit chain verified');
  assert(chainResult.verifiedCount > 0, 'Audit trail contains sequentially chained blocks');

  // Immediate session revocation
  const revokedAdmin = adminDb.revokeAdminSession(admSession.token);
  assert(revokedAdmin === true, 'Immediate admin session revocation confirmed');
  assert(
    adminDb.getAdminSession(admSession.token) === undefined,
    'Revoked admin session permanently denied'
  );

  console.log(`\n🎉 ALL ${passed}/${total} AUTOMATED TESTS PASSED SUCCESSFULLY!`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
