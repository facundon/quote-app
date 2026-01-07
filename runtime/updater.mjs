#!/usr/bin/env node

/**
 * Standalone updater script for atomic version swaps.
 *
 * This script runs OUTSIDE the SvelteKit build (in .updates/) so it can:
 * 1. Stop the running server (via PM2 or direct kill)
 * 2. Swap the current/ folder with the new release
 * 3. Start the new server (via PM2 or direct spawn)
 *
 * Usage:
 *   node updater.mjs --base <path> --version <version> --pm2 <appName> [--lockPath <path>]
 *   node updater.mjs --base <path> --version <version> --serverPid <pid> [--lockPath <path>]
 *
 * PM2 Mode (recommended):
 *   Uses `pm2 stop` and `pm2 start` to manage the server process.
 *   Requires PM2 to be installed globally and the app to be registered with PM2.
 *
 * Direct Mode (legacy):
 *   Kills the server process directly and spawns a new one.
 *   Used when PM2 is not available.
 *
 * This file is shipped with each release and copied to .updates/ before execution.
 * It must remain dependency-free (only Node.js built-ins).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// =============================================================================
// Configuration
// =============================================================================

const KEEP_PREVIOUS_VERSIONS = 2;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a process is still alive.
 * @param {number} pid
 * @returns {boolean}
 */
function isAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Kill a process and its children (direct mode only).
 * @param {number} pid
 */
function killTree(pid) {
	if (process.platform === 'win32') {
		// /T: kill child processes, /F: force
		spawn('cmd.exe', ['/c', 'taskkill', '/PID', String(pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	} else {
		try {
			process.kill(pid, 'SIGTERM');
		} catch {
			// Process may already be dead
		}
	}
}

/**
 * Execute a PM2 command synchronously.
 * @param {string[]} args - PM2 command arguments
 * @returns {{ success: boolean, output: string }}
 */
function pm2Command(args) {
	const pm2Bin = process.platform === 'win32' ? 'pm2.cmd' : 'pm2';
	const result = spawnSync(pm2Bin, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		timeout: 30_000,
		shell: process.platform === 'win32',
		windowsHide: true
	});

	const output =
		(result.error ? `${result.error.message}\n` : '') +
		(result.stdout || '') +
		(result.stderr || '');
	return {
		success: result.status === 0,
		output: output.trim()
	};
}

/**
 * Stop an app managed by PM2.
 * @param {string} appName
 * @returns {boolean}
 */
function pm2Stop(appName) {
	console.log(`[pm2] Stopping app: ${appName}`);
	const result = pm2Command(['stop', appName]);
	if (!result.success) {
		console.log(`[pm2] Stop output: ${result.output}`);
	}
	return result.success;
}

/**
 * Start/restart an app managed by PM2.
 * @param {string} appName
 * @returns {boolean}
 */
function pm2Start(appName) {
	console.log(`[pm2] Starting app: ${appName}`);
	const result = pm2Command(['start', appName]);
	if (!result.success) {
		console.log(`[pm2] Start output: ${result.output}`);
	}
	return result.success;
}

/**
 * Get PM2 PID(s) for a given app. Returns [] if none.
 * @param {string} appName
 * @returns {number[]}
 */
function pm2Pids(appName) {
	const result = pm2Command(['pid', appName]);
	if (!result.success) return [];
	const parts = result.output
		.split(/[\s,]+/g)
		.map((s) => s.trim())
		.filter(Boolean);
	const pids = [];
	for (const p of parts) {
		const n = Number(p);
		if (Number.isFinite(n) && n > 0) pids.push(n);
	}
	return pids;
}

/**
 * Attempt to stop a PM2 app and ensure its process is actually gone.
 * On Windows, this prevents rename() EBUSY by ensuring all handles are released.
 * @param {string} appName
 */
async function stopPm2AndWait(appName) {
	const before = pm2Pids(appName);
	console.log('[updater] PM2 PIDs before stop:', before.length ? before.join(', ') : '(none)');

	const stopped = pm2Stop(appName);
	if (!stopped) {
		// If PM2 reports stop failure but there are no PIDs, it's likely already stopped.
		const after = pm2Pids(appName);
		if (!after.length) {
			console.log('[updater] PM2 stop returned non-zero but no PIDs found; treating as stopped');
			return;
		}
		console.log('[updater] PM2 stop returned non-zero; waiting for PIDs to exit...');
	}

	// Wait up to 30 seconds for all PIDs to disappear.
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		const pids = pm2Pids(appName);
		if (!pids.length) return;
		let anyAlive = false;
		for (const pid of pids) {
			if (isAlive(pid)) anyAlive = true;
		}
		if (!anyAlive) return;
		await sleep(500);
	}

	// Last resort: force kill any remaining PIDs we saw.
	const still = pm2Pids(appName);
	if (still.length) {
		console.log('[updater] Forcing kill of remaining PIDs:', still.join(', '));
		for (const pid of still) killTree(pid);
		await sleep(1500);
	}

	const final = pm2Pids(appName);
	if (final.length) throw new Error(`PM2 app did not stop in time (pids=${final.join(',')})`);
}

/**
 * @param {string} dir
 */
function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

/**
 * @param {string} dir
 */
function safeRmdir(dir) {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
	} catch {
		// Ignore errors
	}
}

/**
 * @param {string} file
 */
function safeUnlink(file) {
	try {
		fs.unlinkSync(file);
	} catch {
		// Ignore errors
	}
}

/** @type {string | null} */
let globalLockPath = null;
/** @type {string | null} */
let globalStatusPath = null;

// Always attempt to release the install lock on exit (success or failure),
// otherwise a failed update can block all future updates.
process.on('exit', () => {
	if (globalLockPath) safeUnlink(globalLockPath);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, () => {
		console.error(`[updater] Received ${sig}, exiting...`);
		process.exit(1);
	});
}

/**
 * Best-effort status writer for external observers (UI/logs).
 * @param {string} step
 * @param {object} extra
 */
function writeStatus(step, extra = {}) {
	if (!globalStatusPath) return;
	try {
		fs.writeFileSync(
			globalStatusPath,
			JSON.stringify(
				{
					version: extra.version ?? null,
					step,
					updatedAt: new Date().toISOString(),
					message: extra.message,
					error: extra.error
				},
				null,
				2
			),
			'utf8'
		);
	} catch (e) {
		console.error('[updater] Failed to write status file:', e);
	}
}

/**
 * Retry fs.renameSync to deal with transient Windows locks (EBUSY/EPERM/EACCES).
 * @param {string} from
 * @param {string} to
 * @param {string} label
 */
async function renameWithRetry(from, to, label) {
	const maxAttempts = 120; // ~60s at 500ms
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			fs.renameSync(from, to);
			return;
		} catch (e) {
			const err = /** @type {any} */ (e);
			const code = err && err.code;
			if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
				console.log(
					`[updater] rename busy (${label}) attempt ${attempt}/${maxAttempts} code=${code}`
				);
				await sleep(500);
				continue;
			}
			throw e;
		}
	}
	throw new Error(`rename failed after retries (${label}): ${from} -> ${to}`);
}

/**
 * @param {string} currentDir
 * @returns {string | null}
 */
function readCurrentVersionFromDir(currentDir) {
	try {
		const pkgPath = path.join(currentDir, 'package.json');
		if (!fs.existsSync(pkgPath)) return null;
		const raw = fs.readFileSync(pkgPath, 'utf8');
		const parsed = JSON.parse(raw);
		return typeof parsed?.version === 'string' ? parsed.version : null;
	} catch {
		return null;
	}
}

/**
 * Generate a unique directory name for the previous version backup.
 * @param {string} base - Install base directory
 * @param {string} version - Current version being replaced
 * @returns {string}
 */
function uniquePrevDir(base, version) {
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	return path.join(base, `previous-${version}-${stamp}`);
}

// =============================================================================
// Cleanup Functions
// =============================================================================

/**
 * Remove old previous-* directories, keeping only the most recent ones.
 * @param {string} base - Install base directory
 * @param {number} keepCount - Number of previous versions to keep
 */
function cleanupOldVersions(base, keepCount) {
	const entries = fs.readdirSync(base, { withFileTypes: true });
	const prevDirs = entries
		.filter((e) => e.isDirectory() && e.name.startsWith('previous-'))
		.map((e) => ({
			name: e.name,
			path: path.join(base, e.name),
			mtime: fs.statSync(path.join(base, e.name)).mtimeMs
		}))
		.sort((a, b) => b.mtime - a.mtime); // newest first

	const toDelete = prevDirs.slice(keepCount);
	for (const dir of toDelete) {
		console.log('[cleanup] Removing old version:', dir.name);
		safeRmdir(dir.path);
	}
}

/**
 * Remove all version folders from the releases staging area.
 * @param {string} releasesDir
 */
function cleanupReleases(releasesDir) {
	if (!fs.existsSync(releasesDir)) return;

	const entries = fs.readdirSync(releasesDir, { withFileTypes: true });
	for (const e of entries) {
		if (e.isDirectory()) {
			console.log('[cleanup] Removing staged release:', e.name);
			safeRmdir(path.join(releasesDir, e.name));
		}
	}
}

/**
 * Remove all downloaded zip files from .updates/
 * @param {string} updatesDir
 */
function cleanupZips(updatesDir) {
	if (!fs.existsSync(updatesDir)) return;

	const entries = fs.readdirSync(updatesDir);
	for (const name of entries) {
		if (name.endsWith('.zip')) {
			console.log('[cleanup] Removing zip:', name);
			safeUnlink(path.join(updatesDir, name));
		}
	}
}

// =============================================================================
// Argument Parsing
// =============================================================================

/**
 * @typedef {Object} UpdaterArgs
 * @property {string | null} base - Install base directory
 * @property {string | null} version - Target version
 * @property {string | null} pm2AppName - PM2 app name (if using PM2)
 * @property {number | null} serverPid - Server PID (if not using PM2)
 * @property {string | null} lockPath - Path to install lock file
 */

/**
 * Parse command line arguments.
 * @returns {UpdaterArgs}
 */
function parseArgs() {
	const args = process.argv.slice(2);

	/**
	 * @param {string} name
	 * @returns {string | null}
	 */
	const getArg = (name) => {
		const idx = args.indexOf(name);
		return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
	};

	const serverPidRaw = getArg('--serverPid');

	return {
		base: getArg('--base'),
		version: getArg('--version'),
		pm2AppName: getArg('--pm2'),
		serverPid: serverPidRaw ? Number(serverPidRaw) : null,
		lockPath: getArg('--lockPath')
	};
}

// =============================================================================
// Server Management
// =============================================================================

/**
 * Stop the server using PM2.
 * @param {string} appName
 */
async function stopServerPM2(appName) {
	console.log('[updater] Stopping server via PM2...');
	await stopPm2AndWait(appName);

	// Give PM2 a moment to fully stop the process
	await sleep(2000);
	console.log('[updater] Server stopped');
}

/**
 * Stop the server by killing the process directly.
 * @param {number} pid
 */
async function stopServerDirect(pid) {
	console.log('[updater] Stopping server (direct mode)...');
	killTree(pid);

	// Wait for server to exit (up to 30 seconds)
	for (let i = 0; i < 120; i++) {
		if (!isAlive(pid)) break;
		await sleep(250);
	}

	if (isAlive(pid)) {
		throw new Error('Server did not stop in time');
	}

	console.log('[updater] Server stopped');
}

/**
 * Start the server using PM2.
 * @param {string} appName
 */
function startServerPM2(appName) {
	console.log('[updater] Starting server via PM2...');

	if (!pm2Start(appName)) {
		throw new Error('PM2 failed to start the app');
	}

	console.log('[updater] Server started via PM2');
}

/**
 * Start the server by spawning a new process directly.
 * @param {string} currentDir
 */
function startServerDirect(currentDir) {
	const logsDir = path.join(currentDir, 'logs');
	ensureDir(logsDir);

	const logPath = path.join(logsDir, 'server.log');
	const out = fs.openSync(logPath, 'a');
	const err = fs.openSync(logPath, 'a');

	console.log('[updater] Starting new server (direct mode)...');
	const nodeBin = process.execPath;
	const child = spawn(nodeBin, ['build/index.js'], {
		cwd: currentDir,
		// On POSIX, `detached` is typically unnecessary; on Windows it's needed for the
		// spawned server to survive once this updater exits.
		detached: process.platform === 'win32',
		stdio: ['ignore', out, err],
		windowsHide: true
	});
	child.unref();

	console.log(`[updater] New server started (PID: ${child.pid})`);
}

// =============================================================================
// Main Update Logic
// =============================================================================

async function main() {
	const { base, version, pm2AppName, serverPid, lockPath } = parseArgs();
	globalLockPath = lockPath;
	globalStatusPath = base ? path.join(base, '.updates', 'status.json') : null;
	writeStatus('starting', { version, message: 'Updater started' });

	// Validate required arguments
	if (!base || !version) {
		console.error('Usage:');
		console.error(
			'  PM2 mode:    node updater.mjs --base <path> --version <version> --pm2 <appName>'
		);
		console.error(
			'  Direct mode: node updater.mjs --base <path> --version <version> --serverPid <pid>'
		);
		console.error('');
		console.error('Missing required arguments: --base --version');
		process.exit(2);
	}

	const usePM2 = !!pm2AppName;

	if (!usePM2 && !serverPid) {
		console.error('Either --pm2 <appName> or --serverPid <pid> is required');
		process.exit(2);
	}

	if (!usePM2 && Number.isNaN(serverPid)) {
		console.error('Invalid --serverPid: must be a number');
		process.exit(2);
	}

	const currentDir = path.join(base, 'current');
	const releasesDir = path.join(base, 'releases');
	const updatesDir = path.join(base, '.updates');
	const nextDir = path.join(releasesDir, version);

	console.log(`[updater] Starting update to version ${version}`);
	console.log(`[updater] Base: ${base}`);
	console.log(`[updater] Mode: ${usePM2 ? `PM2 (${pm2AppName})` : `Direct (PID: ${serverPid})`}`);

	// -------------------------------------------------------------------------
	// Step 1: Stop the running server
	// -------------------------------------------------------------------------

	// Give HTTP response time to flush before stopping the server
	await sleep(750);

	try {
		if (usePM2) {
			writeStatus('stopping', { version, message: 'Stopping server via PM2' });
			await stopServerPM2(pm2AppName);
		} else {
			writeStatus('stopping', { version, message: 'Stopping server (direct mode)' });
			await stopServerDirect(/** @type {number} */ (serverPid));
		}
		writeStatus('stopped', { version, message: 'Server stopped' });
	} catch (e) {
		console.error('[updater] Failed to stop server:', e);
		writeStatus('error', { version, error: String(e?.message || e) });
		process.exit(3);
	}

	// -------------------------------------------------------------------------
	// Step 2: Swap folders (atomic on same volume)
	// -------------------------------------------------------------------------

	const currentVersion = readCurrentVersionFromDir(currentDir) ?? version;
	const prevDir = uniquePrevDir(base, currentVersion);

	try {
		writeStatus('swapping', { version, message: 'Swapping folders' });
		if (!fs.existsSync(nextDir)) {
			throw new Error(`Next release folder missing: ${nextDir}`);
		}
		if (!fs.existsSync(currentDir)) {
			throw new Error(`Current folder missing: ${currentDir}`);
		}

		console.log(`[updater] Backing up current to: ${path.basename(prevDir)}`);
		await renameWithRetry(currentDir, prevDir, 'current->previous');

		console.log('[updater] Activating new version...');
		await renameWithRetry(nextDir, currentDir, 'next->current');

		console.log('[updater] Folder swap complete');
		writeStatus('swapped', { version, message: 'Folder swap complete' });
	} catch (e) {
		console.error('[updater] Swap failed:', e);
		writeStatus('error', { version, error: String(e?.message || e) });

		// Try rollback if we renamed current away but didn't complete
		if (!fs.existsSync(currentDir) && fs.existsSync(prevDir)) {
			console.log('[updater] Attempting rollback...');
			try {
				await renameWithRetry(prevDir, currentDir, 'rollback previous->current');
				console.log('[updater] Rollback successful');
			} catch {
				console.error('[updater] Rollback failed');
			}
		}

		// Try to restart the server even if swap failed
		if (usePM2) {
			console.log('[updater] Attempting to restart server after failed swap...');
			pm2Start(pm2AppName);
		}

		process.exit(3);
	}

	// -------------------------------------------------------------------------
	// Step 3: Start the new server
	// -------------------------------------------------------------------------

	try {
		if (usePM2) {
			writeStatus('starting-server', { version, message: 'Starting server via PM2' });
			startServerPM2(pm2AppName);
		} else {
			writeStatus('starting-server', { version, message: 'Starting server (direct mode)' });
			startServerDirect(currentDir);
		}
	} catch (e) {
		console.error('[updater] Failed to start new server:', e);
		writeStatus('error', { version, error: String(e?.message || e) });
		process.exit(4);
	}

	// -------------------------------------------------------------------------
	// Step 4: Cleanup old files
	// -------------------------------------------------------------------------

	try {
		console.log('[cleanup] Cleaning up old files...');
		cleanupZips(updatesDir);
		cleanupReleases(releasesDir);
		cleanupOldVersions(base, KEEP_PREVIOUS_VERSIONS);
		console.log('[cleanup] Cleanup complete');
	} catch (e) {
		// Non-fatal: log but don't fail the update
		console.error('[cleanup] Warning:', e);
	}

	console.log(`[updater] Update to ${version} complete!`);
	writeStatus('done', { version, message: 'Update complete' });
	process.exit(0);
}

// =============================================================================
// Entry Point
// =============================================================================

main().catch((e) => {
	console.error('[updater] Fatal error:', e);
	writeStatus('error', { version: null, error: String(e?.message || e) });
	process.exit(1);
});
