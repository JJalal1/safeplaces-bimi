-- Apply after standalone Better Auth tables (0002).
-- Staff roles are separate from customer identities and the owner secrets.
-- A NULL auth_user_id is a pending invitation; bind once on verified login.
CREATE TABLE IF NOT EXISTS admin_members (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL UNIQUE,
 auth_user_id TEXT,
 permissions TEXT NOT NULL DEFAULT '[]',
 active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
 invited_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_members_email_unique ON admin_members(email);
CREATE UNIQUE INDEX IF NOT EXISTS admin_members_auth_user_unique ON admin_members(auth_user_id);
