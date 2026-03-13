CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);