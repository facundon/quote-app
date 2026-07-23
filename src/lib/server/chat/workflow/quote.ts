/**
 * QuoteAgent - Calculates quotes and formats responses.
 * This is a deterministic agent with NO LLM calls.
 */

import { db } from '../../db';
import { category, discount, type Category, type Discount } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type {
	MappingResult,
	QuoteResult,
	QuoteLineItem,
	QuoteStudyDetail,
	MappingConfidence
} from './types';

function getAllDiscounts(): Discount[] {
	return db.select().from(discount).all();
}

function getCategoryById(id: number): Category | undefined {
	return db.select().from(category).where(eq(category.id, id)).get();
}

/**
 * Return an emoji badge representing the confidence level of a study match.
 */
function confidenceBadge(study: QuoteStudyDetail): string {
	const badges: Record<MappingConfidence, string> = {
		exact: '✅',
		high: '🟢',
		medium: '🟡',
		low: '🔴'
	};

	const badge = badges[study.confidence] ?? '❓';

	// Add extraction warning if the name was hard to read
	if (study.extractionConfidence && study.extractionConfidence !== 'high') {
		const extractionBadge = study.extractionConfidence === 'medium' ? '👁️?' : '👁️⚠️';
		return `${badge} ${extractionBadge}`;
	}

	return badge;
}

/**
 * Format a quote result as a markdown response.
 */
export function formatQuoteResponse(quote: QuoteResult): string {
	const lines: string[] = [];

	// Header
	lines.push('## Cotización\n');

	// Line items
	if (quote.lineItems.length > 0) {
		lines.push('### Estudios cotizados\n');

		for (const item of quote.lineItems) {
			// Category header with studies
			if (item.studies.length === 1) {
				const study = item.studies[0];
				lines.push(`- **${study.name}** ${confidenceBadge(study)}`);
				if (study.original !== study.name) {
					lines.push(`  _"${study.original}"_ → ${study.name}`);
				}
				if (study.reasoning) {
					lines.push(`  _${study.reasoning}_`);
				}
			} else {
				lines.push(`- **${item.category}** (${item.quantity} estudios)`);
				for (const study of item.studies) {
					const badge = confidenceBadge(study);
					if (study.original !== study.name) {
						lines.push(`  - ${study.name} ${badge} — _"${study.original}"_`);
					} else {
						lines.push(`  - ${study.name} ${badge}`);
					}
					if (study.reasoning) {
						lines.push(`    _${study.reasoning}_`);
					}
				}
			}
			lines.push('\n');

			// Price info
			const priceInfo = [`**Subtotal:** $${item.unitPrice.toLocaleString('es-AR')} c/u`];
			if (item.quantity > 1) {
				priceInfo.push(`× ${item.quantity}`);
			}
			if (item.discountPercentage > 0) {
				priceInfo.push(`(-${item.discountPercentage}%)`);
				const discountedPrice = item.unitPrice * (1 - item.discountPercentage / 100);
				priceInfo.push(`→ $${discountedPrice.toLocaleString('es-AR')} c/u`);
			}
			priceInfo.push(`= $${item.lineTotal.toLocaleString('es-AR')}`);
			lines.push(`  ${priceInfo.join(' ')}\n`);
		}
	}

	// Unmatched studies
	if (quote.unmatchedStudies.length > 0) {
		lines.push('### Estudios no encontrados\n');
		lines.push(
			'Los siguientes estudios no se encontraron en el catálogo y no fueron incluidos en la cotización:\n'
		);
		for (const study of quote.unmatchedStudies) {
			lines.push(`- ${study}`);
		}
		lines.push('');
	}

	// Confidence legend (only if there are non-exact matches)
	const hasNonExact = quote.lineItems.some((item) =>
		item.studies.some((s) => s.confidence !== 'exact')
	);
	if (hasNonExact) {
		lines.push('> ✅ Exacto · 🟢 Alta confianza · 🟡 Media confianza · 🔴 Baja confianza\n');
	}

	if (quote.summary.totalStudies > 0) {
		lines.push(
			`\n_${quote.summary.totalStudies} estudio${quote.summary.totalStudies > 1 ? 's' : ''} cotizado${quote.summary.totalStudies > 1 ? 's' : ''}_`
		);
	}

	// Summary
	lines.push('---\n');

	if (quote.summary.totalDiscount > 0) {
		lines.push(`Subtotal: $${quote.summary.subtotal.toLocaleString('es-AR')}`);
		lines.push(`Descuento: -$${quote.summary.totalDiscount.toLocaleString('es-AR')}`);
	}

	lines.push(`### **Total: $${quote.summary.finalTotal.toLocaleString('es-AR')}**`);

	return lines.join('\n');
}

/**
 * Generate an error response when no studies could be processed.
 */
export function formatQuoteErrorResponse(error: string): string {
	return `## Error\n\nNo se pudo procesar la solicitud: ${error}\n\nPor favor, intentá de nuevo o escribí los estudios de otra forma.`;
}

/**
 * Generate a response when no studies were found in the input.
 */
export function formatQuoteEmptyResponse(): string {
	return `No encontré estudios médicos en tu mensaje.\n\nPodés:\n- Escribir los nombres de los estudios (ej: "hemograma, glucemia, uremia")\n- Pegar o arrastrar una imagen de una receta u orden médica\n- Indicar cantidades (ej: "5 hemogramas y 3 glucemias")`;
}

/**
 * Calculate a quote from mapped studies.
 */
export function calculateQuote(mappingResult: MappingResult): QuoteResult {
	const { matched, unmatched } = mappingResult;
	const allDiscounts = getAllDiscounts();

	// Fixed-price studies are priced (and quoted) individually, bypassing their
	// category's unit price and discount tiers entirely.
	const fixedPriceStudies = matched.filter((s) => s.isFixedPrice);
	const categoryPricedStudies = matched.filter((s) => !s.isFixedPrice);

	// Group category-priced studies by category
	const categoryGroups = new Map<
		number,
		{
			category: Category;
			studies: QuoteStudyDetail[];
			quantity: number;
		}
	>();

	for (const study of categoryPricedStudies) {
		const detail: QuoteStudyDetail = {
			name: study.catalogName,
			original: study.original,
			confidence: study.confidence,
			matchMethod: study.matchMethod,
			reasoning: study.reasoning,
			extractionConfidence: study.extractionConfidence
		};

		const existing = categoryGroups.get(study.categoryId);
		if (existing) {
			existing.quantity += study.quantity;
			existing.studies.push(detail);
		} else {
			const cat = getCategoryById(study.categoryId);
			if (cat) {
				categoryGroups.set(study.categoryId, {
					category: cat,
					studies: [detail],
					quantity: study.quantity
				});
			}
		}
	}

	// Calculate total quantity for discount calculation (fixed-price studies are
	// priced independently and don't count toward category volume discounts)
	let totalQuantity = 0;
	for (const group of categoryGroups.values()) {
		totalQuantity += group.quantity;
	}
	let fixedPriceQuantity = 0;

	// Calculate line items
	const lineItems: QuoteLineItem[] = [];
	let totalSubtotal = 0;
	let totalDiscountAmount = 0;

	for (const study of fixedPriceStudies) {
		const subtotal = study.quantity * study.unitPrice;
		totalSubtotal += subtotal;
		fixedPriceQuantity += study.quantity;

		lineItems.push({
			category: study.categoryName,
			studies: [
				{
					name: study.catalogName,
					original: study.original,
					confidence: study.confidence,
					matchMethod: study.matchMethod,
					reasoning: study.reasoning,
					extractionConfidence: study.extractionConfidence
				}
			],
			quantity: study.quantity,
			unitPrice: study.unitPrice,
			subtotal,
			discountPercentage: 0,
			discountAmount: 0,
			lineTotal: subtotal
		});
	}

	for (const { category: cat, studies, quantity } of categoryGroups.values()) {
		const subtotal = quantity * cat.unit_price;
		totalSubtotal += subtotal;

		// Find applicable discount
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
			studies,
			quantity,
			unitPrice: cat.unit_price,
			subtotal,
			discountPercentage,
			discountAmount,
			lineTotal: subtotal - discountAmount
		});
	}

	// Calculate final total (rounded down to nearest 1000)
	const rawTotal = totalSubtotal - totalDiscountAmount;
	const finalTotal = Math.floor(rawTotal / 1000) * 1000;

	return {
		lineItems,
		summary: {
			totalStudies: totalQuantity + fixedPriceQuantity,
			subtotal: totalSubtotal,
			totalDiscount: totalDiscountAmount,
			finalTotal
		},
		unmatchedStudies: unmatched.map((u) => u.name)
	};
}
