import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { env } from '$env/dynamic/private';
import type { UpdateInstallResponse } from '$lib/update/types';
import { findAppRoot } from '$lib/server/update/appRoot';
import { parseUpdateManifest } from '$lib/server/update/manifest';
import { getUpdatePaths } from '$lib/server/update/paths';
import { acquireFileLock } from '$lib/server/update/locks';
import { downloadToFile, sha256File } from '$lib/server/update/download';
import { extractZip, npmCiProd } from '$lib/server/update/extract';
import { ensureUpdaterScript } from '$lib/server/update/updaterScript';

async function fetchManifest(manifestUrl: string) {
	const res = await fetch(manifestUrl, { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status} ${res.statusText}`);
	const raw: unknown = await res.json();
	const parsed = parseUpdateManifest(raw);
	if (!parsed) throw new Error('Invalid update-manifest.json schema');
	return parsed;
}

function ensureDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

export const POST: RequestHandler = async () => {
	const manifestUrl = env.UPDATE_MANIFEST_URL;
	if (!manifestUrl) {
		const body: UpdateInstallResponse = {
			started: false,
			targetVersion: null,
			message: 'UPDATE_MANIFEST_URL is not configured',
			error: 'UPDATE_MANIFEST_URL is not configured'
		};
		return json(body, { status: 400 });
	}

	const startDir = path.dirname(fileURLToPath(import.meta.url));
	const appRoot = findAppRoot(startDir);
	const paths = getUpdatePaths(appRoot);

	// This updater is designed for the `.../current/` atomic layout.
	// In dev environments it can be disabled or ignored, but on Windows deployments it should be used.
	if (path.basename(appRoot).toLowerCase() !== 'current') {
		const body: UpdateInstallResponse = {
			started: false,
			targetVersion: null,
			message:
				'Updater is not configured for this installation layout. Expected the server to run from an `app/current/` folder.',
			error: 'invalid-install-layout'
		};
		return json(body, { status: 409 });
	}

	ensureDir(paths.updatesDir);
	ensureDir(paths.releasesDir);

	let lock: ReturnType<typeof acquireFileLock> | null = null;
	const lockPath = path.join(paths.updatesDir, 'install.lock');
	try {
		lock = acquireFileLock(lockPath);
	} catch {
		const body: UpdateInstallResponse = {
			started: false,
			targetVersion: null,
			message: 'An update is already in progress.',
			error: 'install.lock exists'
		};
		return json(body, { status: 409 });
	}

	try {
		const manifest = await fetchManifest(manifestUrl);
		const version = manifest.version;

		const zipPath = path.join(paths.updatesDir, `${version}.zip`);
		const extractTo = path.join(paths.releasesDir, version);

		await downloadToFile(manifest.assetUrl, zipPath);
		const actualSha = await sha256File(zipPath);
		if (actualSha.toLowerCase() !== manifest.assetSha256.toLowerCase()) {
			throw new Error(`SHA256 mismatch. expected=${manifest.assetSha256} actual=${actualSha}`);
		}

		await extractZip(zipPath, extractTo);

		// Ensure deps are installed in the new release folder (build-only release).
		await npmCiProd(extractTo);

		const updaterPath = ensureUpdaterScript(paths.updatesDir);
		const nodeBin = process.execPath; // path to node running this server

		const child = spawn(
			nodeBin,
			[
				updaterPath,
				'--base',
				paths.installBase,
				'--version',
				version,
				'--serverPid',
				String(process.pid),
				'--lockPath',
				lockPath
			],
			{
				cwd: paths.installBase,
				detached: true,
				stdio: 'ignore',
				windowsHide: true
			}
		);
		child.unref();

		const body: UpdateInstallResponse = {
			started: true,
			targetVersion: version,
			message: 'Update downloaded. Installing now; the app may restart shortly.'
		};

		// Do not release the lock here; updater will remove it once swap completes.
		return json(body);
	} catch (e) {
		lock.release();
		const body: UpdateInstallResponse = {
			started: false,
			targetVersion: null,
			message: e instanceof Error ? e.message : 'Unknown error',
			error: e instanceof Error ? e.message : 'Unknown error'
		};
		return json(body, { status: 500 });
	}
};
