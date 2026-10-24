CREATE TABLE IF NOT EXISTS `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text,
	`created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `content` (
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

CREATE UNIQUE INDEX IF NOT EXISTS `content_type_slug_idx` ON `content` (`type`,`slug`);

CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`coupon_id` text NOT NULL,
	`order_id` text NOT NULL,
	FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `coupons` (
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

CREATE UNIQUE INDEX IF NOT EXISTS `coupons_code_unique` ON `coupons` (`code`);

CREATE TABLE IF NOT EXISTS `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`company` text,
	`updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `files` (
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

CREATE INDEX IF NOT EXISTS `files_parent_idx` ON `files` (`parent_id`);

CREATE TABLE IF NOT EXISTS `orders` (
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

CREATE UNIQUE INDEX IF NOT EXISTS `orders_number_unique` ON `orders` (`number`);

CREATE UNIQUE INDEX IF NOT EXISTS `orders_idempotency_key_unique` ON `orders` (`idempotency_key`);

CREATE INDEX IF NOT EXISTS `orders_user_idx` ON `orders` (`user_id`,`created_at`);

CREATE TABLE IF NOT EXISTS `products` (
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

CREATE UNIQUE INDEX IF NOT EXISTS `products_slug_unique` ON `products` (`slug`);

CREATE INDEX IF NOT EXISTS `products_category_idx` ON `products` (`category`,`active`);

CREATE TABLE IF NOT EXISTS `quotes` (
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

CREATE UNIQUE INDEX IF NOT EXISTS `quotes_number_unique` ON `quotes` (`number`);

CREATE UNIQUE INDEX IF NOT EXISTS `quotes_idempotency_key_unique` ON `quotes` (`idempotency_key`);

CREATE INDEX IF NOT EXISTS `quotes_user_idx` ON `quotes` (`user_id`,`created_at`);

CREATE TABLE IF NOT EXISTS `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `customer_wishlists` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`)
);

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

CREATE UNIQUE INDEX IF NOT EXISTS admin_members_auth_user_unique ON admin_members(auth_user_id)
