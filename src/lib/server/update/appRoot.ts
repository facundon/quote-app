import fs from 'node:fs';
import path from 'node:path';

function existsFile(filePath: string): boolean {
	try {
		return fs.statSync(filePath).isFile();
	} catch {
		return false;
	}
}

function existsDir(dirPath: string): boolean {
	try {
		return fs.statSync(dirPath).isDirectory();
	} catch {
		return false;
	}
}

function findUpwards(startDir: string, predicate: (dir: string) => boolean): string | null {
	let current = path.resolve(startDir);
	for (;;) {
		if (predicate(current)) return current;
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

/**
 * Attempts to find the app "root" folder.
 *
 * Supports:
 * - repo/dev layout: `<root>/package.json` + `<root>/drizzle` (migrations)
 * - adapter-node build layout: `<root>/build/index.js` + `<root>/build/server` + `<root>/build/client`
 * - Windows atomic layout: `app/current/` (where `current/` contains `build/`)
 *
 * In your Windows deployment, this should resolve to `app/current/`.
 */
export function findAppRoot(startDir: string): string {
	const resolvedStart = path.resolve(startDir);

	// 1) Prefer a `current/` folder if it contains an adapter-node build output.
	const current = findUpwards(resolvedStart, (dir) => {
		if (path.basename(dir).toLowerCase() !== 'current') return false;
		const buildDir = path.join(dir, 'build');
		return (
			existsDir(buildDir) &&
			existsFile(path.join(buildDir, 'index.js')) &&
			existsDir(path.join(buildDir, 'server')) &&
			existsDir(path.join(buildDir, 'client'))
		);
	});
	if (current) return current;

	// 2) Otherwise, pick the nearest "project root".
	const found = findUpwards(resolvedStart, (dir) => {
		const pkg = path.join(dir, 'package.json');
		if (!existsFile(pkg)) return false;
		// If drizzle exists, it's definitely the project root.
		if (existsDir(path.join(dir, 'drizzle'))) return true;
		// If build output exists, also treat as root.
		const buildDir = path.join(dir, 'build');
		return (
			existsDir(buildDir) &&
			existsFile(path.join(buildDir, 'index.js')) &&
			existsDir(path.join(buildDir, 'server')) &&
			existsDir(path.join(buildDir, 'client'))
		);
	});

	return found ?? resolvedStart;
}
