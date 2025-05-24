CREATE TABLE `category` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit_price` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `discount` (
	`id` integer PRIMARY KEY NOT NULL,
	`min_quantity` integer NOT NULL,
	`percentage` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quote` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`client` text
);
--> statement-breakpoint
CREATE TABLE `quote_study` (
	`id` integer PRIMARY KEY NOT NULL,
	`quote_id` integer NOT NULL,
	`study_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`study_id`) REFERENCES `study`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `study` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
