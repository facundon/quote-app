/**
 * QuoteAgent - Calculates quotes and formats responses.
 * This is a deterministic agent with NO LLM calls.
 */

import { db } from '../../db';
import { category, discount, type Category, type Discount } from '../../db/schema';
import { eq } from 'drizzle-orm';
import type {
	MappedStudy,
	MappingResult,
	QuoteResult,
	QuoteLineItem,
	QuoteStudyDetail,
	MappingConfidence
} from './types';

/**
 * Get all discounts from the database.
 */
function getAllDiscounts(): Discount[] {
	return db.select().from(discount).all();
}

/**
 * Get category by ID.
 */
function getCategoryById(id: number): Category | undefined {
	return db.select().from(category).where(eq(category.id, id)).get();
}

/**
 * QuoteAgent class that handles quote calculation and response formatting.
 */
export class QuoteAgent {
	/**
	 * Calculate a quote from mapped studies.
	 */
	calculate(mappingResult: MappingResult): QuoteResult {
		const { matched, unmatched } = mappingResult;
		const allDiscounts = getAllDiscounts();

		// Group studies by category
		const categoryGroups = new Map<
			number,
			{
				category: Category;
				studies: QuoteStudyDetail[];
				quantity: number;
			}
		>();

		for (const study of matched) {
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

		// Calculate total quantity for discount calculation
		let totalQuantity = 0;
		for (const group of categoryGroups.values()) {
			totalQuantity += group.quantity;
		}

		// Calculate line items
		const lineItems: QuoteLineItem[] = [];
		let totalSubtotal = 0;
		let totalDiscountAmount = 0;

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
				totalStudies: totalQuantity,
				subtotal: totalSubtotal,
				totalDiscount: totalDiscountAmount,
				finalTotal
			},
			unmatchedStudies: unmatched.map((u) => u.name)
		};
	}

	/**
	 * Format a quote result as a markdown response.
	 */
	formatResponse(quote: QuoteResult): string {
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
					lines.push(`- **${study.name}** ${this.confidenceBadge(study)}`);
					if (study.original !== study.name) {
						lines.push(`  _"${study.original}"_ → ${study.name}`);
					}
					if (study.reasoning) {
						lines.push(`  _${study.reasoning}_`);
					}
				} else {
					lines.push(`- **${item.category}** (${item.quantity} estudios)`);
					for (const study of item.studies) {
						const badge = this.confidenceBadge(study);
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

				// Price info
				const priceInfo = [`$${item.unitPrice.toLocaleString('es-AR')} c/u`];
				if (item.quantity > 1) {
					priceInfo.push(`× ${item.quantity}`);
				}
				if (item.discountPercentage > 0) {
					priceInfo.push(`(-${item.discountPercentage}%)`);
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
			lines.push(
				'> ✅ Exacto · 🟢 Alta confianza · 🟡 Media confianza · 🔍 Validado por búsqueda\n'
			);
		}

		// Summary
		lines.push('---\n');

		if (quote.summary.totalDiscount > 0) {
			lines.push(`Subtotal: $${quote.summary.subtotal.toLocaleString('es-AR')}`);
			lines.push(`Descuento: -$${quote.summary.totalDiscount.toLocaleString('es-AR')}`);
		}

		lines.push(`**Total: $${quote.summary.finalTotal.toLocaleString('es-AR')}**`);

		if (quote.summary.totalStudies > 0) {
			lines.push(
				`\n_${quote.summary.totalStudies} estudio${quote.summary.totalStudies > 1 ? 's' : ''} cotizado${quote.summary.totalStudies > 1 ? 's' : ''}_`
			);
		}

		return lines.join('\n');
	}

	/**
	 * Return an emoji badge representing the confidence level of a study match.
	 */
	private confidenceBadge(study: QuoteStudyDetail): string {
		const badges: Record<MappingConfidence, string> = {
			exact: '✅',
			high: '🟢',
			medium: '🟡',
			low: '🔴',
			grounded: '🔍'
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
	 * Generate an error response when no studies could be processed.
	 */
	formatErrorResponse(error: string): string {
		return `## Error\n\nNo se pudo procesar la solicitud: ${error}\n\nPor favor, intentá de nuevo o escribí los estudios de otra forma.`;
	}

	/**
	 * Generate a response when no studies were found in the input.
	 */
	formatEmptyResponse(): string {
		return `No encontré estudios médicos en tu mensaje.\n\nPodés:\n- Escribir los nombres de los estudios (ej: "hemograma, glucemia, uremia")\n- Pegar o arrastrar una imagen de una receta u orden médica\n- Indicar cantidades (ej: "5 hemogramas y 3 glucemias")`;
	}
}

/**
 * Singleton instance for convenience.
 */
let instance: QuoteAgent | null = null;

export function getQuoteAgent(): QuoteAgent {
	if (!instance) {
		instance = new QuoteAgent();
	}
	return instance;
}
