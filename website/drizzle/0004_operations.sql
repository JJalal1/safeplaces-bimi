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
