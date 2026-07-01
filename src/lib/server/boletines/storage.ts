import path from 'node:path';

export const BOLETINES_FOLDER_NAME = 'boletines' as const;

function toPosixPath(input: string): string {
	return input.replaceAll('\\', '/');
}

function stripLeadingSlashes(input: string): string {
	return input.replace(/^\/+/, '');
}

function isAtomicCurrentDir(cwd: string): boolean {
	return path.basename(cwd) === 'current';
}

/**
 * Returns the filesystem directory where bulletin image files are stored.
 *
 * - In production (atomic layout): `<installBase>/boletines` (sibling of `current/`)
 * - In development: `<repoRoot>/boletines`
 */
export function getBoletinesDir(cwd: string = process.cwd()): string {
	return isAtomicCurrentDir(cwd)
		? path.resolve(cwd, '..', BOLETINES_FOLDER_NAME)
		: path.join(cwd, BOLETINES_FOLDER_NAME);
}

/**
 * Ensure a resolved path stays within a base directory (prevents path traversal).
 */
export function isInsideDir(baseDir: string, candidatePath: string): boolean {
	const relative = path.relative(baseDir, candidatePath);
	return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Convert a stored DB path like `boletines/123456/file.jpg` into a relative path
 * inside the boletines directory (i.e. `123456/file.jpg`).
 */
export function normalizeStoredBoletinesPath(storedPath: string): string {
	const normalized = stripLeadingSlashes(toPosixPath(storedPath).trim());
	if (normalized === BOLETINES_FOLDER_NAME) return '';
	const prefix = `${BOLETINES_FOLDER_NAME}/`;
	return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

/**
 * Resolve a stored DB path (typically `boletines/...`) to an absolute filesystem path.
 */
export function resolveBoletinesFileFromStoredPath(
	storedPath: string,
	cwd: string = process.cwd()
): string {
	const baseDir = getBoletinesDir(cwd);
	const rel = normalizeStoredBoletinesPath(storedPath);
	if (!rel) return baseDir;
	return path.resolve(baseDir, ...rel.split('/'));
}

/**
 * Resolve a URL-relative path (already under `/boletines/...`) to an absolute filesystem path.
 *
 * Example input: `123456/filename.jpg`
 */
export function resolveBoletinesFileFromUrlRelativePath(
	urlRelativePath: string,
	cwd: string = process.cwd()
): { baseDir: string; fullPath: string } {
	const baseDir = getBoletinesDir(cwd);
	const rel = stripLeadingSlashes(toPosixPath(urlRelativePath).trim());
	const fullPath = path.resolve(baseDir, ...rel.split('/'));
	return { baseDir, fullPath };
}

/**
 * Sanitize a filename to prevent directory traversal and other issues.
 */
export function sanitizeFileName(filename: string): string {
	// Remove path separators and dangerous characters
	return filename
		.replace(/[/\\]/g, '_')
		.replace(/[<>:"|?*]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^\.+/, '')
		.slice(0, 255);
}

/**
 * Get file extension from MIME type.
 */
export function getExtensionFromMimeType(mimeType: string): string {
	const map: Record<string, string> = {
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/webp': '.webp'
	};
	return map[mimeType] || '';
}
