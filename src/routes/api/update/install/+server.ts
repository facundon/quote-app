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

		// Ensure deps are installed in the new release folder (build-only release).
		console.log('[update/install]', requestId, 'installing deps (npm ci)', { cwd: extractTo });
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

		const updaterLogPath = path.join(
			paths.updatesDir,
			`updater-${version}-${requestId.replaceAll(':', '-')}.log`
		);

		// Pass logPath to updater so it handles its own logging.
		// This is required on Windows where stdio redirection doesn't work with `start /b`.
		updaterArgs.push('--logPath', updaterLogPath);

		console.log('[update/install]', requestId, 'spawning updater', {
			nodeBin,
			updaterPath,
			cwd: paths.installBase,
			args: updaterArgs
		});

		console.log('[update/install]', requestId, 'updater log file', { updaterLogPath });

		// On Windows, we use `cmd.exe /c start /b` to spawn a truly independent process
		// that survives when PM2 kills the server's process tree.
		// On POSIX, a simple spawn with unref() is sufficient.
		const isWindows = process.platform === 'win32';

		let spawnCommand: string;
		let spawnArgs: string[];
		let spawnStdio: 'ignore' | ['ignore', number, number];
		let updaterLogFd: number | null = null;

		if (isWindows) {
			// The empty string after /b is the window title (required by start command).
			// This creates a process in a new console session, fully detached from the parent tree.
			// Stdio must be 'ignore' since the started process won't inherit file descriptors.
			// The updater handles its own logging via --logPath.
			spawnCommand = 'cmd.exe';
			spawnArgs = ['/c', 'start', '/b', '', nodeBin, ...updaterArgs];
			spawnStdio = 'ignore';
		} else {
			// On POSIX, we can redirect stdio to a file descriptor
			updaterLogFd = fs.openSync(updaterLogPath, 'a');
			spawnCommand = nodeBin;
			spawnArgs = updaterArgs;
			spawnStdio = ['ignore', updaterLogFd, updaterLogFd];
		}

		const child = spawn(spawnCommand, spawnArgs, {
			cwd: paths.installBase,
			stdio: spawnStdio,
			windowsHide: true,
			// On Windows with cmd.exe, shell mode helps with path resolution
			shell: isWindows
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
					spawnCommand,
					spawnArgs,
					cwd: paths.installBase,
					updaterLogPath
				};
				console.error('[update/install]', requestId, 'updater spawn error', details);
				reject(new Error(`Updater spawn failed: ${JSON.stringify(details)}`));
			});
		});

		child.unref();

		// Close the file descriptor on POSIX (not used on Windows)
		if (updaterLogFd !== null) {
			try {
				fs.closeSync(updaterLogFd);
			} catch {
				// ignore
			}
		}

		const body: UpdateInstallResponse = {
			started: true,
			targetVersion: version,
			message: 'Actualización descargada. Instalando… la app puede reiniciarse en breve.'
		};

		// Do not release the lock here; updater will remove it once swap completes.
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
