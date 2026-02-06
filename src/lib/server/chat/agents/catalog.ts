/**
 * Catalog utilities - Data access and text matching for the study catalog.
 * Provides reusable functions for querying and matching against catalog entries.
 */

import { db } from '../../db';
import { study, category } from '../../db/schema';
import { eq } from 'drizzle-orm';

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

	// Catalog name contains the query
	const match = catalog.find((s) => normalize(s.name).includes(normalized));
	if (match) return match;

	// Query contains catalog name (handles abbreviations expanded in query)
	return catalog.find((s) => normalized.includes(normalize(s.name)));
}

/** Try exact match first, then fall back to substring match. */
export function findBestMatch(name: string, catalog: CatalogStudy[]): CatalogStudy | undefined {
	return findExactMatch(name, catalog) ?? findSubstringMatch(name, catalog);
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

/** Format the catalog as a flat comma-separated list of names. */
export function formatCatalogFlat(catalog: CatalogStudy[]): string {
	return catalog.map((s) => s.name).join(', ');
}
