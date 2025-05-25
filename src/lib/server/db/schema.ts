import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

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

export const quote = sqliteTable('quote', {
	id: integer('id').primaryKey(),
	date: text('date').notNull(), // ISO string
	client: text('client') // optional, client name
});

export const quote_study = sqliteTable('quote_study', {
	id: integer('id').primaryKey(),
	quote_id: integer('quote_id')
		.references(() => quote.id)
		.notNull(),
	study_id: integer('study_id')
		.references(() => study.id)
		.notNull(),
	quantity: integer('quantity').notNull()
});

export const discount = sqliteTable('discount', {
	id: integer('id').primaryKey(),
	category_id: integer('category_id')
		.references(() => category.id)
		.notNull(),
	min_quantity: integer('min_quantity').notNull(), // minimum number of studies in this category to apply discount
	percentage: real('percentage').notNull() // discount percentage (e.g. 10 for 10%)
});
