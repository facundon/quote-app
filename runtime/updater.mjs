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
		windowsHide: true
	});

	const output = (result.stdout || '') + (result.stderr || '');
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

	if (!pm2Stop(appName)) {
		// App might not be running, which is fine
		console.log('[updater] PM2 stop returned non-zero (app may not be running)');
	}

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
			await stopServerPM2(pm2AppName);
		} else {
			await stopServerDirect(/** @type {number} */ (serverPid));
		}
	} catch (e) {
		console.error('[updater] Failed to stop server:', e);
		process.exit(3);
	}

	// -------------------------------------------------------------------------
	// Step 2: Swap folders (atomic on same volume)
	// -------------------------------------------------------------------------

	const prevDir = uniquePrevDir(base, version);

	try {
		if (!fs.existsSync(nextDir)) {
			throw new Error(`Next release folder missing: ${nextDir}`);
		}
		if (!fs.existsSync(currentDir)) {
			throw new Error(`Current folder missing: ${currentDir}`);
		}

		console.log(`[updater] Backing up current to: ${path.basename(prevDir)}`);
		fs.renameSync(currentDir, prevDir);

		console.log('[updater] Activating new version...');
		fs.renameSync(nextDir, currentDir);

		console.log('[updater] Folder swap complete');
	} catch (e) {
		console.error('[updater] Swap failed:', e);

		// Try rollback if we renamed current away but didn't complete
		if (!fs.existsSync(currentDir) && fs.existsSync(prevDir)) {
			console.log('[updater] Attempting rollback...');
			try {
				fs.renameSync(prevDir, currentDir);
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
			startServerPM2(pm2AppName);
		} else {
			startServerDirect(currentDir);
		}
	} catch (e) {
		console.error('[updater] Failed to start new server:', e);
		process.exit(4);
	} finally {
		// Release the install lock
		if (lockPath) {
			safeUnlink(lockPath);
		}
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
	process.exit(0);
}

// =============================================================================
// Entry Point
// =============================================================================

main().catch((e) => {
	console.error('[updater] Fatal error:', e);
	process.exit(1);
});
