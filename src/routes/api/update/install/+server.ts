import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { UpdateInstallResponse } from '$lib/update/types';
import { findAppRoot } from '$lib/server/update/appRoot';
import { parseUpdateManifest } from '$lib/server/update/manifest';
import { getUpdatePaths } from '$lib/server/update/paths';
import { acquireFileLock } from '$lib/server/update/locks';
import { downloadToFile, sha256File } from '$lib/server/update/download';
import { extractZip, npmCiProd } from '$lib/server/update/extract';
import { prepareUpdaterScript } from '$lib/server/update/updaterScript';
import { pm2StartUpdater } from '$lib/server/update/pm2';

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

function describeError(err: unknown): { message: string; details: string } {
	if (err instanceof Error) {
		const e = err as Error & Partial<NodeJS.ErrnoException>;
		const detailsObj = {
			name: e.name,
			message: e.message,
			stack: e.stack,
			code: e.code,
			errno: e.errno,
			syscall: e.syscall,
			path: e.path
		};
		return { message: e.message, details: JSON.stringify(detailsObj) };
	}

	try {
		return { message: String(err), details: JSON.stringify(err) };
	} catch {
		return { message: 'Unknown error', details: 'Unserializable error' };
	}
}

export const POST: RequestHandler = async () => {
	const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const manifestUrl = process.env.UPDATE_MANIFEST_URL;
	if (!manifestUrl) {
		const body: UpdateInstallResponse = {
			started: false,
			targetVersion: null,
			message: 'UPDATE_MANIFEST_URL no está configurada',
			error: 'UPDATE_MANIFEST_URL no está configurada'
		};
		console.error('[update/install]', requestId, 'missing UPDATE_MANIFEST_URL');
		return json(body, { status: 400 });
	}

	const startDir = path.dirname(fileURLToPath(import.meta.url));
	const appRoot = findAppRoot(startDir);
	const paths = getUpdatePaths(appRoot);

	console.log('[update/install]', requestId, 'starting', {
		appRoot,
		installBase: paths.installBase,
		updatesDir: paths.updatesDir,
		releasesDir: paths.releasesDir
	});

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
		console.error('[update/install]', requestId, 'invalid install layout', { appRoot });
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
		console.error('[update/install]', requestId, 'lock exists', { lockPath });
		return json(body, { status: 409 });
	}

	try {
		const manifest = await fetchManifest(manifestUrl);
		const version = manifest.version;

		console.log('[update/install]', requestId, 'manifest fetched', {
			version,
			assetName: manifest.assetName
		});

		const zipPath = path.join(paths.updatesDir, `${version}.zip`);
		const extractTo = path.join(paths.releasesDir, version);

		console.log('[update/install]', requestId, 'downloading', { zipPath });
		await downloadToFile(manifest.assetUrl, zipPath);
		const actualSha = await sha256File(zipPath);
		if (actualSha.toLowerCase() !== manifest.assetSha256.toLowerCase()) {
			throw new Error(`SHA256 mismatch. expected=${manifest.assetSha256} actual=${actualSha}`);
		}

		console.log('[update/install]', requestId, 'extracting', { extractTo });
		await extractZip(zipPath, extractTo);

		console.log('[update/install]', requestId, 'installing deps (npm ci)', { cwd: extractTo });
		await npmCiProd(extractTo);

		const updaterPath = prepareUpdaterScript(appRoot, paths.updatesDir);

		const pm2AppName = process.env.PM2_APP_NAME;
		const updaterArgs: string[] = [
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
			// Direct mode: kill process by PID (fallback for non-PM2 setups)
			updaterArgs.push('--serverPid', String(process.pid));
		}

		const updaterLogPath = path.join(
			paths.updatesDir,
			`updater-${version}-${requestId.replaceAll(':', '-')}.log`
		);

		updaterArgs.push('--logPath', updaterLogPath);

		console.log('[update/install]', requestId, 'starting updater via PM2', {
			updaterPath,
			cwd: paths.installBase,
			args: updaterArgs,
			logPath: updaterLogPath
		});

		// Start the updater as a separate PM2 process.
		// This ensures complete process isolation - when `pm2 stop quote-app` runs,
		// the updater continues to run because it's a separate PM2-managed process.
		await pm2StartUpdater({
			scriptPath: updaterPath,
			cwd: paths.installBase,
			args: updaterArgs,
			logPath: updaterLogPath
		});

		const body: UpdateInstallResponse = {
			started: true,
			targetVersion: version,
			message: 'Actualización descargada. Instalando… la app puede reiniciarse en breve.'
		};

		return json(body);
	} catch (e) {
		lock.release();
		const described = describeError(e);
		console.error('[update/install]', requestId, 'failed', described.details);
		const body: UpdateInstallResponse = {
			started: false,
			targetVersion: null,
			message: described.message,
			error: described.message,
			errorDetails: described.details
		};
		return json(body, { status: 500 });
	}
};
