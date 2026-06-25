// Normalize strings for accent-agnostic searching
export function normalizeForSearch(str: string): string {
	return str
		.normalize('NFD') // Decompose accented characters
		.replace(/[̀-ͯ]/g, '') // Remove diacritical marks
		.toLowerCase();
}

// Check if a search query matches a target string (accent-agnostic)
export function matchesSearch(target: string, query: string): boolean {
	if (!query.trim()) return true;
	return normalizeForSearch(target).includes(normalizeForSearch(query));
}
