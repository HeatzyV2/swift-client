// Migrations run on their own throw-away database, so this file does not use the app harness.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { runMigrations } from '../src/platform/core/migrate.js'
import { migrations } from '../src/platform/migrations.js'

// The legacy schema as shipped before the platform existed (users table only is enough for migration 001).
const legacyUsers = `CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL, mc_uuid TEXT, mc_username TEXT, created_at TEXT NOT NULL);`

test('migrations upgrade a legacy database in place and keep its rows', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(legacyUsers)
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES ('u1', 'alice', 'x', 'now')").run()
  const applied = runMigrations(db, migrations)
  assert.deepEqual(applied, migrations.map(m => m.id))
  assert.equal((db.prepare('SELECT username FROM users').get() as { username: string }).username, 'alice')
  assert.equal((db.prepare('SELECT disabled_at FROM users').get() as { disabled_at: null }).disabled_at, null)
  for (const t of ['user_roles', 'refresh_tokens', 'audit_logs', 'home_sections', 'home_snapshots', 'news', 'servers', 'campaigns', 'releases', 'assets', 'analytics_events', 'crash_reports', 'webhooks']) {
    assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t), `table ${t}`)
  }
  // roles disappear with the account
  db.prepare("INSERT INTO user_roles (user_id, role, created_at) VALUES ('u1', 'OWNER', 'now')").run()
  db.prepare("DELETE FROM users WHERE id = 'u1'").run()
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM user_roles').get() as { n: number }).n, 0)
})

test('migrations are idempotent and refuse to run when an applied one was edited', () => {
  const db = new Database(':memory:')
  db.exec(legacyUsers)
  runMigrations(db, migrations)
  assert.deepEqual(runMigrations(db, migrations), [], 'second run applies nothing')
  const tampered = migrations.map((m, i) => (i === 0 ? { ...m, sql: `${m.sql}\n-- edited` } : m))
  assert.throws(() => runMigrations(db, tampered), /modified after being applied/)
})

test('a failing migration rolls back completely', () => {
  const db = new Database(':memory:')
  assert.throws(() => runMigrations(db, [{ id: '001_bad', sql: 'CREATE TABLE a (x INT); CREATE TABLE a (y INT);' }]))
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'a'").get(), undefined)
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as { n: number }).n, 0)
})
