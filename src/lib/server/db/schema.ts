import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const category = sqliteTable('category', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	unit_price: real('unit_price').notNull()
});

export const study = sqliteTable('study', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	category_id: integer('category_id')
		.references(() => category.id)
		.notNull()
});

export const discount = sqliteTable('discount', {
	id: integer('id').primaryKey(),
	category_id: integer('category_id')
		.references(() => category.id)
		.notNull(),
	min_quantity: integer('min_quantity').notNull(), // minimum number of studies in this category to apply discount
	percentage: real('percentage').notNull() // discount percentage (e.g. 10 for 10%)
});

export const provider = sqliteTable('provider', {
	id: integer('id').primaryKey(),
	name: text('name').notNull(),
	address: text('address').notNull(),
	phone: text('phone').notNull(),
	email: text('email').notNull(),
	cbu_alias: text('cbu_alias').notNull(),
	contact_name: text('contact_name').notNull()
});

export const invoice = sqliteTable('invoice', {
	id: integer('id').primaryKey(),
	pdf_path: text('pdf_path').notNull(),
	payment_receipt_path: text('payment_receipt_path'),
	value: real('value').notNull(),
	payment_status: text('payment_status').notNull(), // 'pending', 'paid', 'overdue'
	shipping_status: text('shipping_status').notNull(), // 'pending', 'sent', 'received'
	payment_date: text('payment_date'), // SQLite doesn't have native timestamp, using text
	reception_date: text('reception_date'), // SQLite doesn't have native timestamp, using text
	provider_id: integer('provider_id')
		.references(() => provider.id)
		.notNull(),
	uploaded_by: text('uploaded_by').notNull(), // name of the person who uploaded the invoice
	notes: text('notes'), // optional notes field for additional information
	created_at: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const ticket = sqliteTable('ticket', {
	id: integer('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull(),
	assignee: text('assignee'), // optional, can be null if not assigned
	priority: text('priority').notNull().default('medium'), // 'low', 'medium', 'high', 'urgent'
	status: text('status').notNull().default('open'), // 'open', 'in_progress', 'resolved', 'closed'
	created_at: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	completed_at: text('completed_at') // completion date, null if not finished
});

export const instruction = sqliteTable('instruction', {
	id: integer('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull(),
	category: text('category').notNull(), // category to group related instructions
	order: integer('order').notNull().default(0), // order within category for drag & drop sorting
	created_at: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
	updated_at: text('updated_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

// TypeScript types for type safety
export type Category = InferSelectModel<typeof category>;
export type CategoryInsert = InferInsertModel<typeof category>;

export type Study = InferSelectModel<typeof study>;
export type StudyInsert = InferInsertModel<typeof study>;

export type Discount = InferSelectModel<typeof discount>;
export type DiscountInsert = InferInsertModel<typeof discount>;

export type Provider = InferSelectModel<typeof provider>;
export type ProviderInsert = InferInsertModel<typeof provider>;

export type Invoice = InferSelectModel<typeof invoice>;
export type InvoiceInsert = InferInsertModel<typeof invoice>;

export type Ticket = InferSelectModel<typeof ticket>;
export type TicketInsert = InferInsertModel<typeof ticket>;

export type Instruction = InferSelectModel<typeof instruction>;
export type InstructionInsert = InferInsertModel<typeof instruction>;
