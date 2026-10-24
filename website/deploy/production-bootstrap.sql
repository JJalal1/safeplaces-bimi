-- SAFE PLACES PRODUCTION D1 BOOTSTRAP
-- Target: fresh safeplaces-production database only.
-- Generated from the five reviewed canonical migrations in website/drizzle.
-- A provisioning workflow verifies the remote database is empty before executing this file.
-- Do not run this file against staging or an existing production database.

-- 1/5: 0000_wide_mikhail_rasputin.sql
CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`slug` text NOT NULL,
	`title_ar` text NOT NULL,
	`title_en` text NOT NULL,
	`description_ar` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`image` text,
	`file` text,
	`extra` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_type_slug_idx` ON `content` (`type`,`slug`);--> statement-breakpoint
CREATE TABLE `coupon_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`order_id` text NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	`minimum` integer DEFAULT 0 NOT NULL,
	`maximum` integer,
	`usage_limit` integer,
	`used` integer DEFAULT 0 NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`categories` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`company` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `files_parent_idx` ON `files` (`parent_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`company` text,
	`billing` text,
	`items` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`vat` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`payment_method` text DEFAULT 'confirmation' NOT NULL,
	`coupon` text,
	`notes` text,
	`invoice_file` text,
	`created_at` text NOT NULL,
	`idempotency_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_key_unique` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`description_ar` text NOT NULL,
	`description_en` text NOT NULL,
	`category` text NOT NULL,
	`kind` text DEFAULT 'quote' NOT NULL,
	`price` integer,
	`old_price` integer,
	`sku` text,
	`brand` text,
	`image` text,
	`specs` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`gallery` text DEFAULT '[]' NOT NULL,
	`datasheet` text,
	`related` text DEFAULT '[]' NOT NULL,
	`keywords` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`,`active`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`company` text,
	`city` text,
	`service` text,
	`description` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text,
	`proposal_file` text,
	`created_at` text NOT NULL,
	`idempotency_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_number_unique` ON `quotes` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_idempotency_key_unique` ON `quotes` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `quotes_user_idx` ON `quotes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

-- 2/5: 0001_melted_vector.sql
CREATE TABLE `customer_wishlists` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`)
);

-- 3/5: 0002_standalone_auth.sql
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

-- 4/5: 0003_admin_members.sql
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

-- 5/5: 0004_operations.sql
-- Additive operational records. Existing customers, requests and auth remain intact.
CREATE TABLE `request_events` (
 `id` text PRIMARY KEY NOT NULL,
 `request_type` text NOT NULL CHECK (`request_type` IN ('orders','quotes','contacts')),
 `request_id` text NOT NULL,
 `actor_id` text,
 `actor_label` text NOT NULL,
 `kind` text NOT NULL,
 `visibility` text NOT NULL DEFAULT 'internal' CHECK (`visibility` IN ('internal','customer')),
 `body` text,
 `from_status` text,
 `to_status` text,
 `idempotency_key` text NOT NULL UNIQUE,
 `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_events_parent_idx` ON `request_events` (`request_type`,`request_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `request_drafts` (
 `id` text PRIMARY KEY NOT NULL,
 `request_type` text NOT NULL CHECK (`request_type` IN ('orders','quotes','contacts')),
 `request_id` text NOT NULL,
 `body` text NOT NULL,
 `updated_by` text NOT NULL,
 `updated_at` text NOT NULL,
 UNIQUE (`request_type`,`request_id`)
);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
 `id` text PRIMARY KEY NOT NULL,
 `request_type` text NOT NULL CHECK (`request_type` IN ('orders','quotes','contacts')),
 `request_id` text NOT NULL,
 `kind` text NOT NULL,
 `recipient` text NOT NULL,
 `sender` text,
 `subject` text NOT NULL,
 `body` text NOT NULL,
 `status` text NOT NULL CHECK (`status` IN ('blocked','queued','processing','sent','failed','cancelled')),
 `attempts` integer NOT NULL DEFAULT 0,
 `next_attempt_at` text NOT NULL,
 `lock_until` text,
 `provider_id` text,
 `last_error` text,
 `idempotency_key` text NOT NULL UNIQUE,
 `created_at` text NOT NULL,
 `updated_at` text NOT NULL,
 `sent_at` text
);
--> statement-breakpoint
CREATE INDEX `notification_outbox_due_idx` ON `notification_outbox` (`status`,`next_attempt_at`);
--> statement-breakpoint
CREATE INDEX `notification_outbox_parent_idx` ON `notification_outbox` (`request_type`,`request_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_outbox_active_reply_unique` ON `notification_outbox` (`request_type`,`request_id`) WHERE `kind`='customer_reply' AND `status` IN ('queued','processing');
--> statement-breakpoint
ALTER TABLE `contacts` ADD `idempotency_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_idempotency_unique` ON `contacts` (`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `quotes_status_created_idx` ON `quotes` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `contacts_status_created_idx` ON `contacts` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `files_unattached_created_idx` ON `files` (`parent_id`,`created_at`);
