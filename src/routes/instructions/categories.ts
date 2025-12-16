export const ALL_INSTRUCTION_CATEGORIES = ['estudios', 'obras_sociales', 'ayudas'] as const;

export type InstructionCategory = (typeof ALL_INSTRUCTION_CATEGORIES)[number];

export const DEFAULT_COLUMN_CATEGORIES = ['estudios', 'ayudas'] as const;

export function formatInstructionCategoryName(category: string): string {
	const names: Record<InstructionCategory, string> = {
		estudios: 'Estudios',
		obras_sociales: 'Obras Sociales',
		ayudas: 'Ayudas'
	};

	if (category in names) return names[category as InstructionCategory];
	if (!category) return '';
	return category.charAt(0).toUpperCase() + category.slice(1);
}

export function buildAvailableCategories(dbCategories: readonly string[]): string[] {
	// We intentionally only allow known categories in the UI. The DB may contain
	// legacy/test categories (e.g. "development") that should not appear.
	void dbCategories;
	return [...ALL_INSTRUCTION_CATEGORIES];
}
