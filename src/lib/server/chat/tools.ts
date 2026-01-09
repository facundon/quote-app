/**
 * Tool executors for the quote assistant.
 * These functions are called by LLM providers when tools are invoked.
 */

import { db } from '../db';
import { category, study, discount, type Category, type Discount } from '../db/schema';
import { eq, like } from 'drizzle-orm';

interface StudyWithCategory {
	id: number;
	name: string;
	category_id: number;
	category_name: string;
	unit_price: number;
}

interface QuoteItem {
	study_name?: string;
	category_name?: string;
	quantity: number;
}

interface QuoteLineItem {
	category: string;
	quantity: number;
	unit_price: number;
	subtotal: number;
	discount_percentage: number;
	discount_amount: number;
	line_total: number;
	studies?: string[];
}

interface QuoteResult {
	line_items: QuoteLineItem[];
	summary: {
		total_studies: number;
		subtotal: number;
		total_discount: number;
		final_total: number;
	};
	errors?: string[];
}

function getAllCategories(): Category[] {
	return db.select().from(category).orderBy(category.name).all();
}

function getAllDiscounts(): Discount[] {
	return db.select().from(discount).all();
}

function searchStudies(query: string): StudyWithCategory[] {
	const results = db
		.select({
			id: study.id,
			name: study.name,
			category_id: study.category_id,
			category_name: category.name,
			unit_price: category.unit_price
		})
		.from(study)
		.innerJoin(category, eq(study.category_id, category.id))
		.where(like(study.name, `%${query}%`))
		.orderBy(study.name)
		.all();

	return results;
}

function getStudyByName(name: string): StudyWithCategory | undefined {
	const results = db
		.select({
			id: study.id,
			name: study.name,
			category_id: study.category_id,
			category_name: category.name,
			unit_price: category.unit_price
		})
		.from(study)
		.innerJoin(category, eq(study.category_id, category.id))
		.all();

	return results.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

function getCategoryByName(name: string): Category | undefined {
	const results = db.select().from(category).all();
	return results.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

function getCategoryById(id: number): Category | undefined {
	return db.select().from(category).where(eq(category.id, id)).get();
}

export function executeSearchStudies(args: { query: string; limit?: number }): string {
	const { query, limit = 20 } = args;

	if (!query || query.trim().length === 0) {
		return JSON.stringify({ studies: [], count: 0 }, null, 2);
	}

	const results = searchStudies(query.trim());
	const limited = limit > 0 ? results.slice(0, limit) : results;

	const response = {
		studies: limited.map((s) => ({
			id: s.id,
			name: s.name,
			category: s.category_name,
			unit_price: s.unit_price
		})),
		count: results.length
	};

	return JSON.stringify(response, null, 2);
}

export function executeListCategories(): string {
	const categories = getAllCategories();

	const response = {
		categories: categories.map((cat) => ({
			id: cat.id,
			name: cat.name,
			unit_price: cat.unit_price
		}))
	};

	return JSON.stringify(response, null, 2);
}

export function executeCalculateQuote(args: { items: QuoteItem[] }): string {
	const { items } = args;
	const errors: string[] = [];

	const allDiscounts = getAllDiscounts();

	const categoryQuantities = new Map<
		number,
		{ category: Category; quantity: number; studies: string[] }
	>();

	for (const item of items) {
		if (item.quantity <= 0) continue;

		let cat: Category | undefined;
		let studyName: string | undefined;

		if (item.study_name) {
			const foundStudy = getStudyByName(item.study_name);
			if (foundStudy) {
				cat = getCategoryById(foundStudy.category_id);
				studyName = foundStudy.name;
			} else {
				errors.push(`Study not found: "${item.study_name}"`);
				continue;
			}
		} else if (item.category_name) {
			cat = getCategoryByName(item.category_name);
			if (!cat) {
				errors.push(`Category not found: "${item.category_name}"`);
				continue;
			}
		} else {
			errors.push('Item must have either study_name or category_name');
			continue;
		}

		if (!cat) {
			continue;
		}

		const existing = categoryQuantities.get(cat.id);
		if (existing) {
			existing.quantity += item.quantity;
			if (studyName) {
				existing.studies.push(studyName);
			}
		} else {
			categoryQuantities.set(cat.id, {
				category: cat,
				quantity: item.quantity,
				studies: studyName ? [studyName] : []
			});
		}
	}

	let totalQuantity = 0;
	for (const { quantity } of categoryQuantities.values()) {
		totalQuantity += quantity;
	}

	const lineItems: QuoteLineItem[] = [];
	let totalSubtotal = 0;
	let totalDiscountAmount = 0;

	for (const { category: cat, quantity, studies } of categoryQuantities.values()) {
		const subtotal = quantity * cat.unit_price;
		totalSubtotal += subtotal;

		const categoryDiscounts = allDiscounts.filter(
			(d) => d.category_id === cat.id && totalQuantity >= d.min_quantity
		);

		let discountPercentage = 0;
		let discountAmount = 0;

		if (categoryDiscounts.length > 0) {
			const bestDiscount = categoryDiscounts.sort((a, b) => b.percentage - a.percentage)[0];
			discountPercentage = bestDiscount.percentage;
			discountAmount = (subtotal * discountPercentage) / 100;
		}

		totalDiscountAmount += discountAmount;

		lineItems.push({
			category: cat.name,
			quantity,
			unit_price: cat.unit_price,
			subtotal,
			discount_percentage: discountPercentage,
			discount_amount: discountAmount,
			line_total: subtotal - discountAmount,
			studies: studies.length > 0 ? studies : undefined
		});
	}

	const rawTotal = totalSubtotal - totalDiscountAmount;
	const finalTotal = Math.floor(rawTotal / 1000) * 1000;

	const result: QuoteResult = {
		line_items: lineItems,
		summary: {
			total_studies: totalQuantity,
			subtotal: totalSubtotal,
			total_discount: totalDiscountAmount,
			final_total: finalTotal
		},
		errors: errors.length > 0 ? errors : undefined
	};

	return JSON.stringify(result, null, 2);
}

export function executeTool(name: string, args: Record<string, unknown>): string {
	switch (name) {
		case 'search_studies':
			return executeSearchStudies(args as { query: string; limit?: number });
		case 'list_categories':
			return executeListCategories();
		case 'calculate_quote':
			return executeCalculateQuote(args as { items: QuoteItem[] });
		default:
			return JSON.stringify({ error: `Unknown tool: ${name}` });
	}
}
