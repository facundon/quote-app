/**
 * Catalog utilities - Data access and text matching for the study catalog.
 * Provides reusable functions for querying and matching against catalog entries.
 */

import { db } from '../../db';
import { study, category } from '../../db/schema';
import { eq } from 'drizzle-orm';

const LLM_FALLBACK_COVERAGE_RATIO = 0.5;

/** A catalog study enriched with its category and pricing info. */
export interface CatalogStudy {
	id: number;
	name: string;
	categoryId: number;
	categoryName: string;
	unitPrice: number;
}

// ── Data Access ──────────────────────────────────────────────────────

/** Fetch all studies with their category information from the database. */
export function getAllStudies(): CatalogStudy[] {
	return db
		.select({
			id: study.id,
			name: study.name,
			categoryId: study.category_id,
			categoryName: category.name,
			unitPrice: category.unit_price
		})
		.from(study)
		.innerJoin(category, eq(study.category_id, category.id))
		.all();
}

// ── Text Normalization ───────────────────────────────────────────────

/** Normalize a string for matching (lowercase, remove accents, trim). */
export function normalize(str: string): string {
	return str
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();
}

// ── Matching Strategies ──────────────────────────────────────────────

/** Try to find an exact match for a study name. */
export function findExactMatch(name: string, catalog: CatalogStudy[]): CatalogStudy | undefined {
	const normalized = normalize(name);
	return catalog.find((s) => normalize(s.name) === normalized);
}

/** Try substring match (catalog name contains query, or query contains catalog name). */
export function findSubstringMatch(
	name: string,
	catalog: CatalogStudy[]
): CatalogStudy | undefined {
	const normalized = normalize(name);

	// A catalog name containing the whole query is the more specific match
	// (e.g. "clearence de creatinina" -> "CDC (Clearence de Creatinina)..."
	// rather than the shorter, unrelated "Creatinina"), so check it first.
	const containingQuery = catalog.filter((s) => normalize(s.name).includes(normalized));
	if (containingQuery.length > 0) {
		return containingQuery.reduce((best, s) =>
			normalize(s.name).length < normalize(best.name).length ? s : best
		);
	}

	// Only trust "query contains catalog name" when the catalog name covers a
	// good share of the query — a short catalog name like "Creatinina" is a
	// substring of many unrelated longer phrases ("Clearance de creatinina",
	// a distinct study), so a low-coverage hit is more likely a false
	// positive than a real match. Below this ratio, leave it unmatched so it
	// falls through to the LLM mapping stage instead of a wrong direct match.
	const containedByQuery = catalog.filter(
		(s) =>
			normalized.includes(normalize(s.name)) &&
			normalize(s.name).length / normalized.length >= LLM_FALLBACK_COVERAGE_RATIO
	);
	if (containedByQuery.length > 0) {
		return containedByQuery.reduce((best, s) =>
			normalize(s.name).length > normalize(best.name).length ? s : best
		);
	}

	return undefined;
}

/** Try exact match first, then fall back to substring match. */
export function findBestMatch(name: string, catalog: CatalogStudy[]): CatalogStudy | undefined {
	return findExactMatch(name, catalog) ?? findSubstringMatch(name, catalog);
}

// ── Bundle Multiplier ────────────────────────────────────────────────

const BUNDLE_MULTIPLIER_REGEX = /\(x(\d+)\)/i;

/** Bundle multiplier encoded in a catalog name, e.g. "Hepatograma (x4)" -> 4. */
export function getBundleMultiplier(catalogName: string): number {
	const match = catalogName.match(BUNDLE_MULTIPLIER_REGEX);
	return match ? Number(match[1]) : 1;
}

// ── Fixed Pricing ────────────────────────────────────────────────────

/** Fixed price encoded in a catalog name, e.g. "Estudio X *40.000*" or "Estudio Y *$20.000*". */
const FIXED_PRICE_REGEX = /\*\$?([\d.]+)\*/;

/**
 * Fixed price encoded directly in a catalog name (surrounded by `*`), which overrides
 * the owning category's unit price, e.g. "Estudio especial *40.000*" -> 40000.
 * Returns undefined when no fixed price is encoded.
 */
export function getFixedPrice(catalogName: string): number | undefined {
	const match = catalogName.match(FIXED_PRICE_REGEX);
	if (!match) return undefined;
	return Number(match[1].replace(/\./g, ''));
}

// ── Formatting ───────────────────────────────────────────────────────

/** Format the catalog grouped by category (for use in LLM prompts). */
export function formatCatalogByCategory(catalog: CatalogStudy[]): string {
	const byCategory = new Map<string, string[]>();

	for (const s of catalog) {
		const studies = byCategory.get(s.categoryName) ?? [];
		studies.push(s.name);
		byCategory.set(s.categoryName, studies);
	}

	const lines: string[] = [];
	for (const [categoryName, studies] of byCategory) {
		lines.push(`### ${categoryName}`);
		for (const studyName of studies) {
			lines.push(`- ${studyName}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}
