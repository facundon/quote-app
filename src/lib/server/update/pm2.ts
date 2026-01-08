/**
 * PM2 Programmatic Utilities
 *
 * Provides utilities for managing PM2 processes programmatically.
 * Uses CLI commands via child_process to avoid bundling the pm2 npm package.
 */

import { spawn, spawnSync } from 'node:child_process';
import { updaterConfig } from '$lib/update/config';

const PM2_BIN = process.platform === 'win32' ? 'pm2.cmd' : 'pm2';
const { updaterProcessName: UPDATER_PROCESS_NAME, commandTimeoutMs: COMMAND_TIMEOUT_MS } =
	updaterConfig.pm2;

interface PM2CommandResult {
	success: boolean;
	output: string;
	timedOut: boolean;
}

/**
 * Execute a PM2 command with timeout protection.
 */
export function pm2Command(args: string[]): Promise<PM2CommandResult> {
	return new Promise((resolve) => {
		let resolved = false;

		const finish = (result: PM2CommandResult): void => {
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
				// ignore
			}
			finish({ success: false, output: `${stdout}${stderr}`.trim(), timedOut: true });
		}, COMMAND_TIMEOUT_MS);

		child.on('error', (err) => {
			const msg = err?.message ?? String(err);
			finish({ success: false, output: `${msg}\n${stdout}${stderr}`.trim(), timedOut: false });
		});

		child.on('close', (code) => {
			finish({ success: code === 0, output: `${stdout}${stderr}`.trim(), timedOut: false });
		});
	});
}

/**
 * Execute a PM2 command synchronously.
 */
export function pm2CommandSync(args: string[]): PM2CommandResult {
	try {
		const result = spawnSync(PM2_BIN, args, {
			encoding: 'utf8',
			timeout: COMMAND_TIMEOUT_MS,
			shell: process.platform === 'win32',
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'pipe']
		});

		const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();

		if (result.error) {
			return { success: false, output, timedOut: false };
		}

		return {
			success: result.status === 0,
			output,
			timedOut: result.signal === 'SIGTERM'
		};
	} catch (err) {
		return {
			success: false,
			output: err instanceof Error ? err.message : String(err),
			timedOut: false
		};
	}
}

export interface StartUpdaterOptions {
	scriptPath: string;
	cwd: string;
	args: string[];
	logPath: string;
}

/**
 * Start the updater as a separate PM2 process.
 *
 * This creates a completely independent process that will survive
 * when the main app is stopped by PM2.
 */
export async function pm2StartUpdater(options: StartUpdaterOptions): Promise<void> {
	const { scriptPath, cwd, args, logPath } = options;

	// First, try to delete any existing updater process (from a previous failed update)
	await pm2DeleteUpdater();

	// Build the PM2 start command
	// We use the CLI approach with -- to pass arguments to the script
	const pm2Args = [
		'start',
		scriptPath,
		'--name',
		UPDATER_PROCESS_NAME,
		'--no-autorestart',
		'--cwd',
		cwd,
		'--output',
		logPath,
		'--error',
		logPath,
		'--', // Separator for script arguments
		...args
	];

	console.log('[pm2] Starting updater process:', pm2Args.join(' '));

	const result = await pm2Command(pm2Args);

	if (!result.success) {
		throw new Error(`Failed to start updater via PM2: ${result.output}`);
	}

	console.log('[pm2] Updater process started successfully');
}

/**
 * Delete the updater PM2 process.
 *
 * This is called after the update completes (success or failure)
 * to clean up the temporary updater process.
 */
export async function pm2DeleteUpdater(): Promise<boolean> {
	const result = await pm2Command(['delete', UPDATER_PROCESS_NAME]);

	// It's okay if the process doesn't exist
	if (!result.success && !result.output.includes('not found')) {
		console.log('[pm2] Delete updater output:', result.output);
	}

	return result.success;
}

/**
 * Delete the updater PM2 process synchronously.
 * Used in the updater script itself for self-cleanup.
 */
export function pm2DeleteUpdaterSync(): boolean {
	const result = pm2CommandSync(['delete', UPDATER_PROCESS_NAME]);
	return result.success;
}

/**
 * Check if the updater process is still running.
 */
export async function pm2IsUpdaterRunning(): Promise<boolean> {
	const result = await pm2Command(['pid', UPDATER_PROCESS_NAME]);
	if (!result.success) return false;

	const pids = result.output
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean)
		.map(Number)
		.filter((n) => Number.isFinite(n) && n > 0);

	return pids.length > 0;
}

export { UPDATER_PROCESS_NAME };
