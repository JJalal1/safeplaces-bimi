-- Additive authentication tables. Apply once after 0000 and 0001.
-- Do not put provider credentials or password hashes into a snapshot file.
CREATE TABLE IF NOT EXISTS auth_user (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 email_verified INTEGER NOT NULL DEFAULT 0,
 image TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_session (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 token TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 ip_address TEXT,
 user_agent TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_session_user_idx ON auth_session(user_id);
CREATE TABLE IF NOT EXISTS auth_account (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL,
 provider_id TEXT NOT NULL,
 access_token TEXT,
 refresh_token TEXT,
 id_token TEXT,
 access_token_expires_at INTEGER,
 refresh_token_expires_at INTEGER,
 scope TEXT,
 password TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_account_user_idx ON auth_account(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS auth_account_provider_idx ON auth_account(provider_id,account_id);
CREATE TABLE IF NOT EXISTS auth_verification (
 id TEXT PRIMARY KEY NOT NULL,
 identifier TEXT NOT NULL,
 value TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_verification_identifier_idx ON auth_verification(identifier);
