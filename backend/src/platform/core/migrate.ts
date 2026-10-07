// Forward-only SQL migrations, applied in order inside a transaction and recorded in schema_migrations.
// A migration that was already applied must never change: its checksum is verified at startup.
import type Database from 'better-sqlite3'
import { sha256 } from './util.js'
import { log } from './logger.js'

export type Migration = { id: string, sql: string }

export function runMigrations(db: Database.Database, migrations: Migration[]): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`)
  const done = new Map((db.prepare('SELECT id, checksum FROM schema_migrations').all() as { id: string, checksum: string }[]).map(r => [r.id, r.checksum]))
  const applied: string[] = []
  for (const m of migrations) {
    const sum = sha256(m.sql)
    const prev = done.get(m.id)
    if (prev) {
      if (prev !== sum) throw new Error(`migration ${m.id} was modified after being applied`)
      continue
    }
    db.transaction(() => {
      db.exec(m.sql)
      db.prepare('INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)').run(m.id, sum, new Date().toISOString())
    })()
    applied.push(m.id)
    log.info('migration applied', { id: m.id })
  }
  return applied
}
