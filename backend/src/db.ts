import Database from 'better-sqlite3'
import { resolve } from 'node:path'
import { env } from './env.js'

export const db = new Database(resolve(env.dataDir, 'swift.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  mc_uuid TEXT,
  mc_username TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shares (
  code TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  mc TEXT NOT NULL,
  loader TEXT NOT NULL,
  mods INTEGER NOT NULL DEFAULT 0,
  instance_id TEXT,
  size INTEGER,
  path TEXT,
  upload_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  kind TEXT NOT NULL,
  uuid TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL,
  UNIQUE(user_a, user_b)
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path TEXT,
  mime TEXT NOT NULL,
  size INTEGER,
  upload_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_media_expires ON media(expires_at);
CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
`)

// --- Game client (Swift Client mod) ---------------------------------------------------------
// Columns added after the first release: created here when missing, so existing databases upgrade
// in place on the next start.
function addColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

addColumn('users', 'last_seen', 'TEXT')
addColumn('users', 'current_server', 'TEXT')
addColumn('users', 'grade', 'TEXT')
addColumn('users', 'coins', 'INTEGER NOT NULL DEFAULT 0')
addColumn('users', 'swift_plus_until', 'TEXT')
addColumn('users', 'equipped_cape', 'TEXT')
addColumn('users', 'equipped_pet', 'TEXT')
addColumn('users', 'cape_animated', 'INTEGER NOT NULL DEFAULT 1')
addColumn('users', 'mojang_cape_url', 'TEXT')
// 1 once Mojang confirmed the account owns mc_uuid (game sign-in, or a launcher link with proof).
addColumn('users', 'mc_verified', 'INTEGER NOT NULL DEFAULT 0')

db.exec(`
CREATE TABLE IF NOT EXISTS cosmetics (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  frames INTEGER NOT NULL DEFAULT 1,
  fps INTEGER NOT NULL DEFAULT 10,
  frame_w INTEGER NOT NULL DEFAULT 64,
  frame_h INTEGER NOT NULL DEFAULT 32,
  texture_path TEXT,
  model_path TEXT,
  animation_path TEXT,
  loop_anim TEXT NOT NULL DEFAULT 'idle',
  player_skin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, cosmetic_id)
);

CREATE INDEX IF NOT EXISTS idx_users_mc_uuid ON users(mc_uuid);
`)

export type UserRow = {
  id: string
  username: string
  password_hash: string
  mc_uuid: string | null
  mc_username: string | null
  created_at: string
  last_seen?: string | null
  current_server?: string | null
  grade?: string | null
  coins?: number
  swift_plus_until?: string | null
  equipped_cape?: string | null
  equipped_pet?: string | null
  cape_animated?: number
  mojang_cape_url?: string | null
  mc_verified?: number
}
