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
 * Attempts to find the app "root" folder (the one containing package.json and build/).
 *
 * In your Windows deployment, this should resolve to `app/current/`.
 */
export function findAppRoot(startDir: string): string {
	const found = findUpwards(startDir, (dir) => {
		const pkg = path.join(dir, 'package.json');
		const buildDir = path.join(dir, 'build');
		return existsFile(pkg) && existsDir(buildDir);
	});
	return found ?? path.resolve(startDir);
}
