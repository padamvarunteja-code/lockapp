// Validates the Postgres persistence mirror against an in-memory
// Postgres (pg-mem). Exercises: seed -> mutate -> flush -> fresh boot
// -> verify users, sessions, messages, vault bytes, and admin data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newDb } from 'pg-mem';
import { Database } from '../server/db';
import { AdminDatabase } from '../server/admin_db';
import { pgMirror } from '../server/pg_mirror';

async function runTests() {
  console.log('--- STARTING PG MIRROR TESTS (pg-mem) ---');
  let passed = 0;
  let total = 0;
  function assert(condition: unknown, msg: string): asserts condition {
    total++;
    if (!condition) {
      console.error(`FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    console.log(`PASS: ${msg}`);
    passed++;
  }

  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();

  const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'onlyus-pg1-'));
  const db1 = new Database({
    environment: 'test',
    dataDir: dir1,
    dbFilePath: path.join(dir1, 'db.test.json'),
    vaultDir: path.join(dir1, 'vault'),
  });
  const adm1 = new AdminDatabase();

  await pgMirror.attach(db1, adm1, pool as never);
  assert(pgMirror.isReady(), 'mirror attached and ready');

  // Mutate user store
  const u = db1.createUser('pg_alice', db1.hashPassword('Secret123!'));
  const s = db1.createSession(u.id, 'test-agent', 'test-device');
  const u2 = db1.createUser('pg_bob', db1.hashPassword('Secret123!'));
  const conn = db1.createConnectionRequest(u.id, u2.id);
  db1.respondToConnection(conn.id, u2.id, 'accept');
  const conv = db1.getOrCreateConversation(u.id, u2.id);
  const msg = db1.sendMessage(conv.id, u.id, '{"ct":"hello"}');
  const blob = Buffer.from('VAULT_BYTES_12345');
  const vault = db1.addVaultMedia(u.id, 'pic.jpg', 'photo', 'image/jpeg', blob.length, 'iv1', 'salt1', blob);

  // Mutate admin store
  const before = adm1.getAuditLogs(1000).length;
  adm1.recordAuditLog('INTEGRITY_CHECK_RUN', 'INFO', 'TEST', '127.0.0.1', 'pg mirror test');

  await pgMirror.flush();
  await new Promise((r) => setTimeout(r, 100));

  // Fresh boot from the same Postgres.
  // NOTE: AdminDatabase resolves its file path at import time, so all
  // instances here share data/admin.test.json (a gitignored test artifact).
  // The mirror replaces in-memory state right after construction, which is
  // what these assertions exercise.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'onlyus-pg2-'));
  const db2 = new Database({
    environment: 'test',
    dataDir: dir2,
    dbFilePath: path.join(dir2, 'db.test.json'),
    vaultDir: path.join(dir2, 'vault'),
  });
  const adm2 = new AdminDatabase();

  await pgMirror.attach(db2, adm2, pool as never);

  assert(db2.findUserByUsername('pg_alice')?.id === u.id, 'user survived reboot');
  assert(db2.getSession(s.token)?.user_id === u.id, 'session survived reboot');
  assert(db2.areUsersConnected(u.id, u2.id), 'connection survived reboot');
  const msgs = db2.getMessages(conv.id, u.id);
  assert(msgs.some((m) => m.id === msg.id), 'message survived reboot');
  const got = db2.getVaultMediaById(vault.id, u.id);
  assert(!!got, 'vault metadata survived reboot');
  assert(
    got && fs.readFileSync(got.filePath).equals(blob),
    'vault bytes restored to disk and match'
  );
  const after = adm2.getAuditLogs(1000).length;
  assert(after === before + 1, 'audit log survived reboot');
  assert(adm2.verifyAuditChainIntegrity().valid, 'audit chain still valid after reboot');

  // Deletion propagates: delete vault item, flush, reboot, confirm gone
  db1.deleteVaultMedia(vault.id, u.id);
  await pgMirror.flush();
  await new Promise((r) => setTimeout(r, 100));
  const dir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'onlyus-pg3-'));
  const db3 = new Database({
    environment: 'test',
    dataDir: dir3,
    dbFilePath: path.join(dir3, 'db.test.json'),
    vaultDir: path.join(dir3, 'vault'),
  });
  const adm3 = new AdminDatabase();
  await pgMirror.attach(db3, adm3, pool as never);
  assert(db3.getVaultMediaById(vault.id, u.id) === undefined, 'deleted vault item stays deleted');

  await pool.end();
  console.log(`\nALL ${passed}/${total} PG MIRROR TESTS PASSED!`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('PG mirror test suite failed:', err);
  process.exit(1);
});
