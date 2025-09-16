CREATE TABLE `ticket` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`assignee` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`created_by` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoice` (
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
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_invoice`("id", "pdf_path", "payment_receipt_path", "value", "payment_status", "shipping_status", "payment_date", "reception_date", "provider_id", "uploaded_by", "notes", "created_at") SELECT "id", "pdf_path", "payment_receipt_path", "value", "payment_status", "shipping_status", "payment_date", "reception_date", "provider_id", "uploaded_by", "notes", "created_at" FROM `invoice`;--> statement-breakpoint
DROP TABLE `invoice`;--> statement-breakpoint
ALTER TABLE `__new_invoice` RENAME TO `invoice`;--> statement-breakpoint
PRAGMA foreign_keys=ON;