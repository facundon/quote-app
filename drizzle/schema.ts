import {
	sqliteTable,
	AnySQLiteColumn,
	integer,
	text,
	real,
	foreignKey
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const category = sqliteTable('category', {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
	unitPrice: real('unit_price').notNull()
});

export const discount = sqliteTable('discount', {
	id: integer().primaryKey().notNull(),
	minQuantity: integer('min_quantity').notNull(),
	percentage: real().notNull(),
	categoryId: integer('category_id')
		.notNull()
		.references(() => category.id)
});

export const study = sqliteTable('study', {
	id: integer().primaryKey().notNull(),
	name: text().notNull(),
	categoryId: integer('category_id')
		.notNull()
		.references(() => category.id)
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

export const invoice = sqliteTable('invoice', {
	id: integer().primaryKey().notNull(),
	pdfPath: text('pdf_path').notNull(),
	paymentReceiptPath: text('payment_receipt_path'),
	value: real().notNull(),
	paymentStatus: text('payment_status').notNull(),
	shippingStatus: text('shipping_status').notNull(),
	paymentDate: text('payment_date'),
	receptionDate: text('reception_date'),
	providerId: integer('provider_id')
		.notNull()
		.references(() => provider.id),
	uploadedBy: text('uploaded_by').notNull(),
	createdAt: text('created_at').default('sql`(CURRENT_TIMESTAMP)`').notNull(),
	notes: text()
});
