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
	value: real('value').notNull(),
	payment_status: text('payment_status').notNull(), // 'pending', 'paid', 'overdue'
	shipping_status: text('shipping_status').notNull(), // 'pending', 'sent', 'received'
	payment_date: text('payment_date'), // SQLite doesn't have native timestamp, using text
	reception_date: text('reception_date'), // SQLite doesn't have native timestamp, using text
	provider_id: integer('provider_id')
		.references(() => provider.id)
		.notNull(),
	uploaded_by: text('uploaded_by').notNull(), // name of the person who uploaded the invoice
	created_at: text('created_at')
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
