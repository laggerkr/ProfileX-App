PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  profile_group TEXT NOT NULL DEFAULT 'Default',
  notes TEXT,
  proxy_id TEXT,
  proxy_protocol TEXT,
  tab_behavior TEXT,
  operating_system TEXT,
  browser_engine TEXT,
  storage_mode TEXT,
  fingerprint TEXT NOT NULL,
  startup_urls TEXT NOT NULL DEFAULT '[]',
  extensions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_launched_at TEXT
);

CREATE TABLE IF NOT EXISTS proxies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  http_port INTEGER,
  socks5_port INTEGER,
  username TEXT,
  password_encrypted TEXT,
  proxy_group TEXT,
  country TEXT,
  country_code TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at TEXT,
  latency_ms INTEGER
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS team_groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_group_members (
  group_id TEXT NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, member_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TEXT NOT NULL
);
