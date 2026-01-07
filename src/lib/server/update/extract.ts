import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function rmDirRecursive(dirPath: string): void {
	try {
		fs.rmSync(dirPath, { recursive: true, force: true });
	} catch {
		console.error('Error removing directory:', dirPath);
	}
}

function ensureDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

function spawnAndWait(command: string, args: string[], cwd: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		if (!cwd || !fs.existsSync(cwd)) {
			reject(new Error(`Invalid cwd for spawn: ${JSON.stringify(cwd)}`));
			return;
		}

		const child = spawn(command, args, {
			cwd,
			stdio: 'inherit',
			windowsHide: true
		});

		child.on('error', (err) => {
			const e = err as NodeJS.ErrnoException;
			const details = {
				command,
				args,
				cwd,
				platform: process.platform,
				code: e.code,
				errno: e.errno,
				syscall: e.syscall,
				path: e.path
			};
			reject(new Error(`Failed to start command: ${JSON.stringify(details)}`));
		});
		child.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${command} exited with code ${code ?? 'null'}`));
		});
	});
}

export async function extractZip(zipPath: string, destDir: string): Promise<void> {
	rmDirRecursive(destDir);
	ensureDir(destDir);

	if (process.platform === 'win32') {
		// Use built-in PowerShell Expand-Archive (no extra deps).
		const ps = [
			'-NoProfile',
			'-NonInteractive',
			'-Command',
			`Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`
		];
		await spawnAndWait('powershell', ps, path.dirname(zipPath));
		return;
	}

	// Best-effort fallback on non-Windows environments.
	await spawnAndWait('unzip', ['-o', zipPath, '-d', destDir], path.dirname(zipPath));
}

export async function npmCiProd(cwd: string): Promise<void> {
	// Uses package-lock.json if present. `--omit=dev` keeps install smaller.
	const args = ['ci', '--omit=dev'];
	await spawnAndWait(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, cwd);
}
