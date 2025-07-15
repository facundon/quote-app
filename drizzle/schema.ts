import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const category = sqliteTable('category', {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
	unitPrice: real('unit_price').notNull()
});

export const discount = sqliteTable('discount', {
	id: integer().primaryKey().notNull(),
	categoryId: integer('category_id')
		.notNull()
		.references(() => category.id),
	minQuantity: integer('min_quantity').notNull(),
	percentage: real().notNull()
});

export const study = sqliteTable('study', {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
	categoryId: integer('category_id')
		.notNull()
		.references(() => category.id)
});

export const invoice = sqliteTable('invoice', {
	id: integer().primaryKey().notNull(),
	pdfPath: text('pdf_path').notNull(),
	value: real().notNull(),
	paymentStatus: text('payment_status').notNull(),
	shippingStatus: text('shipping_status').notNull(),
	paymentDate: text('payment_date'),
	receptionDate: text('reception_date'),
	providerId: integer('provider_id')
		.notNull()
		.references(() => provider.id),
	uploadedBy: text('uploaded_by').notNull(),
	createdAt: text('created_at')
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`)
});

export const provider = sqliteTable('provider', {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
	address: text().notNull(),
	phone: text().notNull(),
	email: text().notNull(),
	cbuAlias: text('cbu_alias').notNull(),
	contactName: text('contact_name').notNull()
});
