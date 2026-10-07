// Platform schema. Append new migrations at the end; never edit one that has shipped (checksums are verified).
import type { Migration } from './core/migrate.js'

export const migrations: Migration[] = [
  {
    id: '001_iam_audit',
    sql: `
ALTER TABLE users ADD COLUMN disabled_at TEXT;

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  replaced_by TEXT,
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_family ON refresh_tokens(family_id);

CREATE TABLE auth_throttle (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  first_fail_at TEXT NOT NULL,
  locked_until TEXT
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  request_id TEXT
);
CREATE INDEX idx_audit_at ON audit_logs(at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  permission TEXT
);
CREATE INDEX idx_notifications_at ON notifications(at DESC);

CREATE TABLE notification_reads (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, notification_id)
);
`,
  },
  {
    id: '002_cms',
    sql: `
CREATE TABLE home_sections (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '{}',
  config TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  targeting TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE home_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  note TEXT,
  payload TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE news (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '{}',
  image TEXT,
  url TEXT,
  direct INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  publish_at TEXT,
  published_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_news_status ON news(status, publish_at);

CREATE TABLE changelog (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  date TEXT NOT NULL,
  items TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '{}',
  link_url TEXT,
  dismissible INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  targeting TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`,
  },
  {
    id: '003_servers_partners',
    sql: `
CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT 'java',
  address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 25565,
  bedrock_address TEXT,
  bedrock_port INTEGER,
  min_version TEXT,
  max_version TEXT,
  description TEXT NOT NULL DEFAULT '{}',
  icon TEXT,
  banner TEXT,
  website TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  ingame INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE partners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  website TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  partner_id TEXT REFERENCES partners(id) ON DELETE SET NULL,
  server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  placement TEXT NOT NULL,
  creative TEXT NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  targeting TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE campaign_stats_daily (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  play_attempts INTEGER NOT NULL DEFAULT 0,
  launches INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, day)
);
`,
  },
  {
    id: '004_config_releases',
    sql: `
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  targeting TEXT NOT NULL DEFAULT '{}',
  variants TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE remote_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE releases (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  channel TEXT NOT NULL,
  platform TEXT NOT NULL,
  arch TEXT NOT NULL,
  url TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  signature TEXT,
  size INTEGER,
  notes TEXT NOT NULL DEFAULT '{}',
  mandatory INTEGER NOT NULL DEFAULT 0,
  minimum_version TEXT,
  rollout_percent INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'draft',
  revoke_reason TEXT,
  published_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (version, channel, platform, arch)
);
CREATE INDEX idx_releases_lookup ON releases(channel, platform, arch, status);
`,
  },
  {
    id: '005_assets_analytics',
    sql: `
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  alt TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_assets_sha ON assets(sha256);

CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  name TEXT NOT NULL,
  device TEXT,
  launcher_version TEXT,
  mc_version TEXT,
  os TEXT,
  arch TEXT,
  locale TEXT,
  props TEXT
);
CREATE INDEX idx_events_at ON analytics_events(at);
CREATE INDEX idx_events_name ON analytics_events(name, at);

CREATE TABLE analytics_daily (
  day TEXT NOT NULL,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);

CREATE TABLE crash_reports (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT,
  message TEXT,
  fingerprint TEXT NOT NULL,
  device TEXT,
  launcher_version TEXT,
  mc_version TEXT,
  os TEXT,
  arch TEXT,
  details TEXT
);
CREATE INDEX idx_crash_at ON crash_reports(at);
CREATE INDEX idx_crash_fp ON crash_reports(fingerprint);

CREATE TABLE crash_groups (
  fingerprint TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open'
);
`,
  },
  {
    id: '006_integrations',
    sql: `
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'generic',
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX idx_deliveries_due ON webhook_deliveries(status, next_attempt_at);
CREATE INDEX idx_deliveries_hook ON webhook_deliveries(webhook_id, created_at DESC);
`,
  },
]
