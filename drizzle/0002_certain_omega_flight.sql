CREATE TABLE `invoice` (
	`id` integer PRIMARY KEY NOT NULL,
	`pdf_path` text NOT NULL,
	`value` real NOT NULL,
	`payment_status` text NOT NULL,
	`shipping_status` text NOT NULL,
	`payment_date` text,
	`reception_date` text,
	`provider_id` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON UPDATE no action ON DELETE no action
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
