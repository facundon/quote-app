#!/usr/bin/env node

/**
 * Standalone Updater Script for Atomic Version Swaps
 *
 * This script runs as an INDEPENDENT PM2 process (named `quote-app-updater`)
 * so it can safely stop the main app, swap folders, and restart it.
 *
 * Usage:
 *   node updater.mjs --base <path> --version <version> --pm2 <appName> [--lockPath <path>] [--logPath <path>]
 *   node updater.mjs --base <path> --version <version> --serverPid <pid> [--lockPath <path>] [--logPath <path>]
 *
 * PM2 Mode (recommended):
 *   Uses `pm2 stop` and `pm2 start` to manage the server process.
 *   The updater itself runs as a separate PM2 process for complete isolation.
 *
 * Direct Mode (legacy):
 *   Kills the server process directly and spawns a new one.
 *   Used when PM2 is not available.
 *
 * This file must remain dependency-free (only Node.js built-ins).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

// =============================================================================
// Constants
// =============================================================================

const KEEP_PREVIOUS_VERSIONS = 2;
const PM2_BIN = process.platform === 'win32' ? 'pm2.cmd' : 'pm2';
const UPDATER_PROCESS_NAME = 'quote-app-updater';
const PM2_COMMAND_TIMEOUT_MS = 30_000;

// =============================================================================
// Logging Setup
// =============================================================================

/**
 * Initialize file-based logging.
 * @param {string} logPath
 */
function initFileLogging(logPath) {
	/**
	 * @param {string} prefix
	 * @param {any[]} args
	 */
	const writeToLog = (prefix, args) => {
		const timestamp = new Date().toISOString();
		const message = args
			.map((a) => {
				if (typeof a === 'string') return a;
				if (a instanceof Error) return `${a.message}\n${a.stack}`;
				try {
					return JSON.stringify(a);
				} catch {
					return String(a);
				}
			})
			.join(' ');

		const line = `[${timestamp}] ${prefix}${message}\n`;

		try {
			fs.appendFileSync(logPath, line, 'utf8');
		} catch {
			// Cannot log failure - no console available
		}
	};

	console.log = (...args) => writeToLog('', args);
	console.error = (...args) => writeToLog('[ERROR] ', args);
}

/**
 * Extract --logPath from argv for early initialization.
 * @returns {string | null}
 */
function getLogPathFromArgv() {
	const args = process.argv;
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--logPath' && i + 1 < args.length) {
			return args[i + 1].replace(/^["']|["']$/g, '');
		}
	}
	return null;
}

// Initialize logging immediately if --logPath is provided
const earlyLogPath = getLogPathFromArgv();
if (earlyLogPath) {
	initFileLogging(earlyLogPath);
	console.log('[updater] File logging initialized');
	console.log('[updater] argv:', process.argv);
}

// =============================================================================
// Error Handlers
// =============================================================================

process.on('uncaughtException', (err) => {
	console.error('[updater] Uncaught exception:', err);
	cleanupAndExit(1);
});

process.on('unhandledRejection', (reason) => {
	console.error('[updater] Unhandled rejection:', reason);
	cleanupAndExit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, () => {
		console.error(`[updater] Received ${sig}, exiting...`);
		cleanupAndExit(1);
	});
}

// =============================================================================
// State
// =============================================================================

/** @type {string | null} */
let globalLockPath = null;

/** @type {string | null} */
let globalStatusPath = null;

// =============================================================================
// Cleanup & Exit
// =============================================================================

/**
 * Cleanup resources and exit.
 * @param {number} code
 */
function cleanupAndExit(code) {
	// Release the install lock
	if (globalLockPath) {
		safeUnlink(globalLockPath);
	}

	// Delete this updater process from PM2
	selfCleanup();

	process.exit(code);
}

/**
 * Delete the updater PM2 process (self-cleanup).
 */
function selfCleanup() {
	try {
		console.log('[updater] Cleaning up updater PM2 process...');
		spawnSync(PM2_BIN, ['delete', UPDATER_PROCESS_NAME], {
			stdio: 'ignore',
			shell: process.platform === 'win32',
			windowsHide: true,
			timeout: 10_000
		});
	} catch {
		// Ignore errors - process may not exist or PM2 unavailable
	}
}

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
 * Check if a process is alive.
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
 * Safely remove a file.
 * @param {string} filePath
 */
function safeUnlink(filePath) {
	try {
		fs.unlinkSync(filePath);
	} catch {
		// Ignore
	}
}

/**
 * Safely remove a directory.
 * @param {string} dirPath
 */
function safeRmdir(dirPath) {
	try {
		fs.rmSync(dirPath, { recursive: true, force: true });
	} catch {
		// Ignore
	}
}

/**
 * Ensure a directory exists.
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true });
}

// =============================================================================
// Status File
// =============================================================================

/**
 * Write status for external observers.
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

// =============================================================================
// PM2 Operations
// =============================================================================

/**
 * @typedef {Object} PM2Result
 * @property {boolean} success
 * @property {string} output
 * @property {boolean} timedOut
 */

/**
 * Execute a PM2 command with timeout.
 * @param {string[]} args
 * @returns {Promise<PM2Result>}
 */
function pm2Command(args) {
	return new Promise((resolve) => {
		let resolved = false;

		/** @param {PM2Result} result */
		const finish = (result) => {
			if (resolved) return;
			resolved = true;
			clearTimeout(timer);
			resolve(result);
		};

		const child = spawn(PM2_BIN, args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			shell: process.platform === 'win32',
			windowsHide: true
		});

		let stdout = '';
		let stderr = '';
		child.stdout?.on('data', (d) => (stdout += String(d)));
		child.stderr?.on('data', (d) => (stderr += String(d)));

		const timer = setTimeout(() => {
			console.log(`[pm2] Command timed out: pm2 ${args.join(' ')}`);
			try {
				if (process.platform === 'win32' && child.pid) {
					spawnSync('cmd.exe', ['/c', 'taskkill', '/PID', String(child.pid), '/T', '/F'], {
						stdio: 'ignore',
						windowsHide: true
					});
				} else {
					child.kill('SIGKILL');
				}
			} catch {
				// Ignore
			}
			finish({ success: false, output: `${stdout}${stderr}`.trim(), timedOut: true });
		}, PM2_COMMAND_TIMEOUT_MS);

		child.on('error', (e) => {
			const msg = e?.message ?? String(e);
			finish({ success: false, output: `${msg}\n${stdout}${stderr}`.trim(), timedOut: false });
		});

		child.on('close', (code) => {
			finish({ success: code === 0, output: `${stdout}${stderr}`.trim(), timedOut: false });
		});
	});
}

/**
 * Get PM2 PIDs for an app.
 * @param {string} appName
 * @returns {Promise<number[]>}
 */
async function pm2Pids(appName) {
	const result = await pm2Command(['pid', appName]);
	if (!result.success) return [];

	return result.output
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean)
		.map(Number)
		.filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Stop a PM2 app.
 * @param {string} appName
 * @returns {Promise<boolean>}
 */
async function pm2Stop(appName) {
	console.log(`[pm2] Stopping app: ${appName}`);
	const result = await pm2Command(['stop', appName]);

	if (!result.success) {
		console.log(`[pm2] Stop output: ${result.output}`);
		if (result.timedOut) console.log('[pm2] Stop timed out');
	}

	return result.success;
}

/**
 * Start a PM2 app.
 * @param {string} appName
 * @returns {Promise<boolean>}
 */
async function pm2Start(appName) {
	console.log(`[pm2] Starting app: ${appName}`);
	const result = await pm2Command(['start', appName]);

	if (!result.success) {
		console.log(`[pm2] Start output: ${result.output}`);
		if (result.timedOut) console.log('[pm2] Start timed out');
	}

	return result.success;
}

/**
 * Stop PM2 app and wait for process to fully exit.
 * @param {string} appName
 */
async function stopPm2AndWait(appName) {
	const beforePids = await pm2Pids(appName);
	console.log(
		'[updater] PM2 PIDs before stop:',
		beforePids.length ? beforePids.join(', ') : '(none)'
	);

	const stopped = await pm2Stop(appName);

	if (!stopped) {
		const afterPids = await pm2Pids(appName);
		if (!afterPids.length) {
			console.log('[updater] PM2 stop returned non-zero but no PIDs found; treating as stopped');
			return;
		}
		console.log('[updater] PM2 stop returned non-zero; waiting for PIDs to exit...');
	}

	// Wait for all PIDs to exit (up to 30s)
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		const pids = await pm2Pids(appName);
		if (!pids.length) return;

		const anyAlive = pids.some((pid) => isAlive(pid));
		if (!anyAlive) return;

		await sleep(500);
	}

	// Force kill remaining PIDs
	const remaining = await pm2Pids(appName);
	if (remaining.length) {
		console.log('[updater] Forcing kill of remaining PIDs:', remaining.join(', '));
		for (const pid of remaining) {
			killProcess(pid);
		}
		await sleep(1500);
	}

	const finalPids = await pm2Pids(appName);
	if (finalPids.length) {
		throw new Error(`PM2 app did not stop in time (pids=${finalPids.join(',')})`);
	}
}

// =============================================================================
// Process Management (Direct Mode)
// =============================================================================

/**
 * Kill a process tree.
 * @param {number} pid
 */
function killProcess(pid) {
	if (process.platform === 'win32') {
		spawn('cmd.exe', ['/c', 'taskkill', '/PID', String(pid), '/T', '/F'], {
			stdio: 'ignore',
			windowsHide: true
		});
	} else {
		try {
			process.kill(pid, 'SIGTERM');
		} catch {
			// Process may be gone
		}
	}
}

/**
 * Start server directly (non-PM2 mode).
 * @param {string} currentDir
 */
function startServerDirect(currentDir) {
	const logsDir = path.join(currentDir, 'logs');
	ensureDir(logsDir);

	const logPath = path.join(logsDir, 'server.log');
	const out = fs.openSync(logPath, 'a');
	const err = fs.openSync(logPath, 'a');

	console.log('[updater] Starting new server (direct mode)...');

	const child = spawn(process.execPath, ['build/index.js'], {
		cwd: currentDir,
		detached: process.platform === 'win32',
		stdio: ['ignore', out, err],
		windowsHide: true
	});

	child.unref();
	console.log(`[updater] Server started (PID: ${child.pid})`);
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Rename with retry for transient Windows locks.
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
			const code = err?.code;

			if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
				console.log(
					`[updater] Rename busy (${label}) attempt ${attempt}/${maxAttempts} code=${code}`
				);
				await sleep(500);
				continue;
			}
			throw e;
		}
	}

	throw new Error(`Rename failed after retries (${label}): ${from} -> ${to}`);
}

/**
 * Read version from package.json in a directory.
 * @param {string} dir
 * @returns {string | null}
 */
function readVersionFromDir(dir) {
	try {
		const pkgPath = path.join(dir, 'package.json');
		if (!fs.existsSync(pkgPath)) return null;

		const raw = fs.readFileSync(pkgPath, 'utf8');
		const parsed = JSON.parse(raw);
		return typeof parsed?.version === 'string' ? parsed.version : null;
	} catch {
		return null;
	}
}

/**
 * Generate unique backup directory name.
 * @param {string} base
 * @param {string} version
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
 * Remove old previous-* directories.
 * @param {string} base
 * @param {number} keepCount
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
 * Remove staged releases.
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
 * Remove downloaded zip files.
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
 * @property {string | null} base
 * @property {string | null} version
 * @property {string | null} pm2AppName
 * @property {number | null} serverPid
 * @property {string | null} lockPath
 * @property {string | null} logPath
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
		lockPath: getArg('--lockPath'),
		logPath: getArg('--logPath')
	};
}

// =============================================================================
// Main Update Logic
// =============================================================================

async function main() {
	const { base, version, pm2AppName, serverPid, lockPath } = parseArgs();

	globalLockPath = lockPath;
	globalStatusPath = base ? path.join(base, '.updates', 'status.json') : null;

	writeStatus('starting', { version, message: 'Updater started' });

	// Validate arguments
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
		cleanupAndExit(2);
	}

	const usePM2 = !!pm2AppName;

	if (!usePM2 && !serverPid) {
		console.error('Either --pm2 <appName> or --serverPid <pid> is required');
		cleanupAndExit(2);
	}

	if (!usePM2 && Number.isNaN(serverPid)) {
		console.error('Invalid --serverPid: must be a number');
		cleanupAndExit(2);
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

	// Small delay to let HTTP response flush
	await sleep(750);

	try {
		if (usePM2) {
			writeStatus('stopping', { version, message: 'Stopping server via PM2' });
			await stopPm2AndWait(pm2AppName);
		} else {
			writeStatus('stopping', { version, message: 'Stopping server (direct mode)' });
			console.log('[updater] Stopping server (direct mode)...');
			killProcess(/** @type {number} */ (serverPid));

			// Wait for exit (up to 30s)
			for (let i = 0; i < 120; i++) {
				if (!isAlive(/** @type {number} */ (serverPid))) break;
				await sleep(250);
			}

			if (isAlive(/** @type {number} */ (serverPid))) {
				throw new Error('Server did not stop in time');
			}
		}

		// Extra delay for file handles to close
		await sleep(2000);
		writeStatus('stopped', { version, message: 'Server stopped' });
		console.log('[updater] Server stopped');
	} catch (e) {
		console.error('[updater] Failed to stop server:', e);
		writeStatus('error', { version, error: String(e?.message || e) });
		cleanupAndExit(3);
	}

	// -------------------------------------------------------------------------
	// Step 2: Swap folders
	// -------------------------------------------------------------------------

	const currentVersion = readVersionFromDir(currentDir) ?? version;
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

		// Attempt rollback
		if (!fs.existsSync(currentDir) && fs.existsSync(prevDir)) {
			console.log('[updater] Attempting rollback...');
			try {
				await renameWithRetry(prevDir, currentDir, 'rollback previous->current');
				console.log('[updater] Rollback successful');
			} catch {
				console.error('[updater] Rollback failed');
			}
		}

		// Try to restart server even if swap failed
		if (usePM2) {
			console.log('[updater] Attempting to restart server after failed swap...');
			await pm2Start(pm2AppName);
		}

		cleanupAndExit(3);
	}

	// -------------------------------------------------------------------------
	// Step 3: Start the new server
	// -------------------------------------------------------------------------

	try {
		if (usePM2) {
			writeStatus('starting-server', { version, message: 'Starting server via PM2' });
			const ok = await pm2Start(pm2AppName);
			if (!ok) throw new Error('PM2 failed to start the app');
			console.log('[updater] Server started via PM2');
		} else {
			writeStatus('starting-server', { version, message: 'Starting server (direct mode)' });
			startServerDirect(currentDir);
		}
	} catch (e) {
		console.error('[updater] Failed to start new server:', e);
		writeStatus('error', { version, error: String(e?.message || e) });
		cleanupAndExit(4);
	}

	// -------------------------------------------------------------------------
	// Step 4: Cleanup
	// -------------------------------------------------------------------------

	try {
		console.log('[cleanup] Cleaning up old files...');
		cleanupZips(updatesDir);
		cleanupReleases(releasesDir);
		cleanupOldVersions(base, KEEP_PREVIOUS_VERSIONS);
		console.log('[cleanup] Cleanup complete');
	} catch (e) {
		// Non-fatal
		console.error('[cleanup] Warning:', e);
	}

	console.log(`[updater] Update to ${version} complete!`);
	writeStatus('done', { version, message: 'Update complete' });

	// Success - cleanup and exit
	cleanupAndExit(0);
}

// =============================================================================
// Entry Point
// =============================================================================

main().catch((e) => {
	console.error('[updater] Fatal error:', e);
	writeStatus('error', { version: null, error: String(e?.message || e) });
	cleanupAndExit(1);
});
