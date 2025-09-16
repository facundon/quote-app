-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `category` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit_price` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discount` (
	`id` integer PRIMARY KEY NOT NULL,
	`min_quantity` integer NOT NULL,
	`percentage` real NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `study` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `provider` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`cbu_alias` text NOT NULL,
	`contact_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice` (
	`id` integer PRIMARY KEY NOT NULL,
	`pdf_path` text NOT NULL,
	`payment_receipt_path` text,
	`value` real NOT NULL,
	`payment_status` text NOT NULL,
	`shipping_status` text NOT NULL,
	`payment_date` text,
	`reception_date` text,
	`provider_id` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`notes` text,
	FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON UPDATE no action ON DELETE no action
);

*/