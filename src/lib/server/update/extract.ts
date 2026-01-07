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

		const useInherit =
			process.env.NODE_ENV === 'development' && !!process.stdout.isTTY && !!process.stderr.isTTY;
		const stdio: 'inherit' | 'pipe' = useInherit ? 'inherit' : 'pipe';

		let child: ReturnType<typeof spawn>;
		try {
			child = spawn(command, args, {
				cwd,
				// `inherit` can throw EINVAL on Windows/PM2 environments without a console.
				stdio,
				// On Windows, `npm`/`npm.cmd` is frequently better behaved when executed via the shell.
				shell: process.platform === 'win32',
				windowsHide: true
			});
		} catch (err) {
			const e = err as NodeJS.ErrnoException;
			const details = {
				command,
				args,
				cwd,
				platform: process.platform,
				stdio,
				shell: process.platform === 'win32',
				code: e.code,
				errno: e.errno,
				syscall: e.syscall,
				path: e.path
			};
			console.error('[update/spawn]', 'spawn threw', details);
			reject(new Error(`Spawn threw: ${JSON.stringify(details)}`));
			return;
		}

		let outBuf = '';
		let errBuf = '';
		if (stdio === 'pipe') {
			child.stdout?.on('data', (d) => (outBuf += String(d)));
			child.stderr?.on('data', (d) => (errBuf += String(d)));
		}

		child.on('error', (err) => {
			const e = err as NodeJS.ErrnoException;
			const details = {
				command,
				args,
				cwd,
				platform: process.platform,
				stdio,
				shell: process.platform === 'win32',
				code: e.code,
				errno: e.errno,
				syscall: e.syscall,
				path: e.path,
				stdoutTail: outBuf.slice(-2000),
				stderrTail: errBuf.slice(-2000)
			};
			console.error('[update/spawn]', 'error', details);
			reject(new Error(`Failed to start command: ${JSON.stringify(details)}`));
		});
		child.on('exit', (code) => {
			if (code === 0) resolve();
			else {
				if (stdio === 'pipe') {
					console.error('[update/spawn]', 'non-zero exit', {
						command,
						args,
						cwd,
						code,
						stdoutTail: outBuf.slice(-2000),
						stderrTail: errBuf.slice(-2000)
					});
				}
				reject(new Error(`${command} exited with code ${code ?? 'null'}`));
			}
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
