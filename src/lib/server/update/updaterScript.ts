import fs from 'node:fs';
import path from 'node:path';

/**
 * Locates the shipped updater.mjs in the current release and copies it to the
 * updates directory. The updater must run from outside `current/` to be able
 * to swap folders atomically.
 *
 * @param appRoot - The application root directory (typically `current/`)
 * @param updatesDir - The `.updates/` directory where the updater will be copied
 * @returns Path to the copied updater script
 */
export function prepareUpdaterScript(appRoot: string, updatesDir: string): string {
	// The updater.mjs is shipped alongside the build in the runtime/ folder
	// or at the root of the release (depending on how the release is packaged)
	const possiblePaths = [
		path.join(appRoot, 'runtime', 'updater.mjs'),
		path.join(appRoot, 'updater.mjs')
	];

	let sourcePath: string | null = null;
	for (const p of possiblePaths) {
		if (fs.existsSync(p)) {
			sourcePath = p;
			break;
		}
	}

	if (!sourcePath) {
		throw new Error(
			`updater.mjs not found. Looked in: ${possiblePaths.join(', ')}. ` +
				'Make sure updater.mjs is included in the release.'
		);
	}

	// Ensure the updates directory exists
	fs.mkdirSync(updatesDir, { recursive: true });

	// Copy to .updates/ so it can run independently of current/
	const targetPath = path.join(updatesDir, 'updater.mjs');
	fs.copyFileSync(sourcePath, targetPath);

	return targetPath;
}
