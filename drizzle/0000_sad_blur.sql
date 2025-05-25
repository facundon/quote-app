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
CREATE TABLE `study` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
