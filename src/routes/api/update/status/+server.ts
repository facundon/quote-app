import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { updaterConfig } from '$lib/update/config';
import { findAppRoot } from '$lib/server/update/appRoot';
import { getUpdatePaths } from '$lib/server/update/paths';
import type { UpdateStatus } from '$lib/update/types';

export const GET: RequestHandler = async () => {
	try {
		const startDir = path.dirname(fileURLToPath(import.meta.url));
		const appRoot = findAppRoot(startDir);
		const paths = getUpdatePaths(appRoot);
		const statusPath = path.join(paths.updatesDir, updaterConfig.files.statusJson);

		if (!fs.existsSync(statusPath)) {
			return json({ step: 'idle', version: null, updatedAt: null } satisfies Partial<UpdateStatus>);
		}

		const raw = fs.readFileSync(statusPath, 'utf8');
		const status = JSON.parse(raw) as UpdateStatus;

		return json(status);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error';
		return json({ step: 'error', version: null, error: message } satisfies Partial<UpdateStatus>);
	}
};
