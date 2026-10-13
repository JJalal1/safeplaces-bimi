CREATE TABLE `customer_wishlists` (
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `product_id`)
);
