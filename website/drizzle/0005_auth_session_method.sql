-- Only the successful server-side authentication endpoint writes this field.
-- Existing sessions remain valid for customers and need a fresh Google login
-- before administration access can be granted.
CREATE TABLE IF NOT EXISTS safeplaces_migrations (
  name TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  backup_bookmark TEXT NOT NULL
);

ALTER TABLE auth_session ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'unknown'
  CHECK (auth_method IN ('google', 'password', 'unknown'));
