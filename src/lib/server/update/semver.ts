interface ParsedSemver {
	major: number;
	minor: number;
	patch: number;
}

function parseIntStrict(value: string): number | null {
	if (!/^\d+$/.test(value)) return null;
	const n = Number(value);
	return Number.isSafeInteger(n) ? n : null;
}

/**
 * Parses a semver-ish string like "v1.2.3" or "1.2.3".
 * Ignores pre-release/build metadata for comparison purposes.
 */
export function parseSemver(value: string): ParsedSemver | null {
	const cleaned = value.trim().replace(/^v/i, '').split(/[+-]/)[0] ?? '';
	const parts = cleaned.split('.');
	if (parts.length !== 3) return null;
	const [maj, min, pat] = parts;
	const major = parseIntStrict(maj);
	const minor = parseIntStrict(min);
	const patch = parseIntStrict(pat);
	if (major === null || minor === null || patch === null) return null;
	return { major, minor, patch };
}

export function compareVersions(a: string, b: string): number {
	const pa = parseSemver(a);
	const pb = parseSemver(b);
	if (pa && pb) {
		if (pa.major !== pb.major) return pa.major - pb.major;
		if (pa.minor !== pb.minor) return pa.minor - pb.minor;
		return pa.patch - pb.patch;
	}

	// Fallback: lexicographic compare on normalized strings.
	const na = a.trim();
	const nb = b.trim();
	if (na === nb) return 0;
	return na < nb ? -1 : 1;
}
