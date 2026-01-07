import path from 'node:path';

export const INVOICES_FOLDER_NAME = 'facturas' as const;

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
 * Returns the filesystem directory where invoice files are stored.
 *
 * - In production (atomic layout): `<installBase>/facturas` (sibling of `current/`)
 * - In development: `<repoRoot>/facturas`
 */
export function getInvoicesDir(cwd: string = process.cwd()): string {
	return isAtomicCurrentDir(cwd)
		? path.resolve(cwd, '..', INVOICES_FOLDER_NAME)
		: path.join(cwd, INVOICES_FOLDER_NAME);
}

/**
 * Ensure a resolved path stays within a base directory (prevents path traversal).
 */
export function isInsideDir(baseDir: string, candidatePath: string): boolean {
	const relative = path.relative(baseDir, candidatePath);
	return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Convert a stored DB path like `facturas/<provider>/<file>` into a relative path
 * inside the facturas directory (i.e. `<provider>/<file>`).
 */
export function normalizeStoredInvoicesPath(storedPath: string): string {
	const normalized = stripLeadingSlashes(toPosixPath(storedPath).trim());
	if (normalized === INVOICES_FOLDER_NAME) return '';
	const prefix = `${INVOICES_FOLDER_NAME}/`;
	return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

/**
 * Resolve a stored DB path (typically `facturas/...`) to an absolute filesystem path.
 */
export function resolveInvoicesFileFromStoredPath(
	storedPath: string,
	cwd: string = process.cwd()
): string {
	const baseDir = getInvoicesDir(cwd);
	const rel = normalizeStoredInvoicesPath(storedPath);
	if (!rel) return baseDir;
	return path.resolve(baseDir, ...rel.split('/'));
}

/**
 * Resolve a URL-relative path (already under `/facturas/...`) to an absolute filesystem path.
 *
 * Example input: `Proveedor_X/123.pdf`
 */
export function resolveInvoicesFileFromUrlRelativePath(
	urlRelativePath: string,
	cwd: string = process.cwd()
): { baseDir: string; fullPath: string } {
	const baseDir = getInvoicesDir(cwd);
	const rel = stripLeadingSlashes(toPosixPath(urlRelativePath).trim());
	const fullPath = path.resolve(baseDir, ...rel.split('/'));
	return { baseDir, fullPath };
}
