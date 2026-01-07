import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UpdateStatusResponse, UpdateStatus } from '$lib/update/types';
import { findAppRoot } from '$lib/server/update/appRoot';
import { getUpdatePaths } from '$lib/server/update/paths';
import { readCurrentVersion } from '$lib/server/update/manifest';

function readFileSafe(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch {
		return null;
	}
}

function readJsonSafe<T>(filePath: string): T | null {
	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async () => {
	const startDir = path.dirname(fileURLToPath(import.meta.url));
	const appRoot = findAppRoot(startDir);
	const paths = getUpdatePaths(appRoot);

	const lockPath = path.join(paths.updatesDir, 'install.lock');
	const statusPath = path.join(paths.updatesDir, 'status.json');

	const lockExists = fs.existsSync(lockPath);
	const status = readJsonSafe<UpdateStatus>(statusPath);

	const body: UpdateStatusResponse = {
		lockExists,
		lockPath: lockExists ? lockPath : null,
		lockContents: lockExists ? readFileSafe(lockPath) : null,
		status: status ?? null,
		statusPath: fs.existsSync(statusPath) ? statusPath : null,
		currentVersion: await readCurrentVersion(appRoot)
	};

	return json(body);
};
