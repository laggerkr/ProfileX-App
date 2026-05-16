CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profile_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  profile_group_id TEXT REFERENCES profile_groups(id),
  notes TEXT,
  proxy_id TEXT,
  proxy_protocol TEXT,
  tab_behavior TEXT,
  operating_system TEXT,
  browser_engine TEXT,
  storage_mode TEXT,
  startup_urls JSONB NOT NULL DEFAULT '[]',
  extensions JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_launched_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS profile_assignments (
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, user_id)
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
  last_checked_at TIMESTAMPTZ,
  latency_ms INTEGER
);
CREATE TABLE IF NOT EXISTS cookies (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fingerprints (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
