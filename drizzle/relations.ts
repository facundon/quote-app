import { relations } from "drizzle-orm/relations";
import { category, discount, study, provider, invoice } from "./schema";

export const discountRelations = relations(discount, ({one}) => ({
	category: one(category, {
		fields: [discount.categoryId],
		references: [category.id]
	}),
}));

export const categoryRelations = relations(category, ({many}) => ({
	discounts: many(discount),
	studies: many(study),
}));

export const studyRelations = relations(study, ({one}) => ({
	category: one(category, {
		fields: [study.categoryId],
		references: [category.id]
	}),
}));

export const invoiceRelations = relations(invoice, ({one}) => ({
	provider: one(provider, {
		fields: [invoice.providerId],
		references: [provider.id]
	}),
}));

export const providerRelations = relations(provider, ({many}) => ({
	invoices: many(invoice),
}));