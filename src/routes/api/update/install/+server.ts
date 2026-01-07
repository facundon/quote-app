import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import type { UpdateInstallResponse } from '$lib/update/types';
import { findAppRoot } from '$lib/server/update/appRoot';
import { parseUpdateManifest } from '$lib/server/update/manifest';
import { getUpdatePaths } from '$lib/server/update/paths';
import { acquireFileLock } from '$lib/server/update/locks';
import { downloadToFile, sha256File } from '$lib/server/update/download';
import { extractZip, npmCiProd } from '$lib/server/update/extract';
import { prepareUpdaterScript } from '$lib/server/update/updaterScript';

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

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export const POST: RequestHandler = async () => {
	const manifestUrl = process.env.UPDATE_MANIFEST_URL;
	if (!manifestUrl) {
		const body: UpdateInstallResponse = {
			started: false,
			targetVersion: null,
			message: 'UPDATE_MANIFEST_URL no está configurada',
			error: 'UPDATE_MANIFEST_URL no está configurada'
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
				'El actualizador no está configurado para este entorno. Se espera que el servidor se ejecute desde una carpeta `current/`.',
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

		const updaterPath = prepareUpdaterScript(appRoot, paths.updatesDir);
		const nodeBin = process.execPath; // path to node running this server

		// Build updater arguments based on whether PM2 is configured
		const pm2AppName = process.env.PM2_APP_NAME;
		const updaterArgs: string[] = [
			updaterPath,
			'--base',
			paths.installBase,
			'--version',
			version,
			'--lockPath',
			lockPath
		];

		if (pm2AppName) {
			// PM2 mode: use pm2 stop/start commands
			updaterArgs.push('--pm2', pm2AppName);
		} else {
			// Direct mode: kill process by PID
			updaterArgs.push('--serverPid', String(process.pid));
		}

		if (!isNonEmptyString(nodeBin) || !fs.existsSync(nodeBin)) {
			throw new Error(`Invalid Node binary (process.execPath): ${JSON.stringify(nodeBin)}`);
		}
		if (!isNonEmptyString(paths.installBase) || !fs.existsSync(paths.installBase)) {
			throw new Error(`Invalid install base (cwd): ${JSON.stringify(paths.installBase)}`);
		}

		// On POSIX, `detached` is typically unnecessary for letting a child survive a parent exit,
		// and can trigger platform-specific spawn failures in some environments.
		const child = spawn(nodeBin, updaterArgs, {
			cwd: paths.installBase,
			detached: process.platform === 'win32',
			stdio: 'ignore',
			windowsHide: true
		});

		// Ensure we fail fast with a useful message if the process cannot be spawned.
		await new Promise<void>((resolve, reject) => {
			child.once('spawn', () => resolve());
			child.once('error', (err) => {
				const e = err as NodeJS.ErrnoException;
				const details = {
					code: e.code,
					errno: e.errno,
					syscall: e.syscall,
					path: e.path,
					nodeBin,
					cwd: paths.installBase,
					args: updaterArgs
				};
				reject(new Error(`Updater spawn failed: ${JSON.stringify(details)}`));
			});
		});

		child.unref();

		const body: UpdateInstallResponse = {
			started: true,
			targetVersion: version,
			message: 'Actualización descargada. Instalando… la app puede reiniciarse en breve.'
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
