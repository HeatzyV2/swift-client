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

export type UserRow = {
  id: string
  username: string
  password_hash: string
  mc_uuid: string | null
  mc_username: string | null
  created_at: string
}
