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

