import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

function updaterMjsContents(): string {
	// Keep this file dependency-free (runs outside SvelteKit build).
	return `import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isAlive(pid) {
	try { process.kill(pid, 0); return true; } catch { return false; }
}

function killTree(pid) {
	if (process.platform === 'win32') {
		// /T: kill child processes, /F: force
		return spawn('cmd.exe', ['/c', 'taskkill', '/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
	}
	try { process.kill(pid, 'SIGTERM'); } catch {}
	return null;
}

function safeRename(from, to) {
	fs.renameSync(from, to);
}

function uniquePrevDir(base, version) {
	const stamp = new Date().toISOString().replace(/[:.]/g, '-');
	return path.join(base, \`previous-\${version}-\${stamp}\`);
}

async function main() {
	const args = process.argv.slice(2);
	const arg = (name) => {
		const idx = args.indexOf(name);
		return idx >= 0 ? args[idx + 1] : null;
	};
	const base = arg('--base');
	const version = arg('--version');
	const serverPidRaw = arg('--serverPid');
	const lockPath = arg('--lockPath');

	if (!base || !version || !serverPidRaw) {
		console.error('Missing args: --base --version --serverPid');
		process.exit(2);
	}

	const serverPid = Number(serverPidRaw);
	const currentDir = path.join(base, 'current');
	const releasesDir = path.join(base, 'releases');
	const nextDir = path.join(releasesDir, version);

	// Give HTTP response time to flush before we kill the server.
	await sleep(750);
	killTree(serverPid);

	// Wait for server to be gone.
	for (let i = 0; i < 120; i++) {
		if (!isAlive(serverPid)) break;
		await sleep(250);
	}

	const prevDir = uniquePrevDir(base, version);

	// Swap folders (atomic on same volume).
	let swapped = false;
	try {
		if (!fs.existsSync(nextDir)) throw new Error('Next release folder missing: ' + nextDir);
		if (!fs.existsSync(currentDir)) throw new Error('Current folder missing: ' + currentDir);

		safeRename(currentDir, prevDir);
		safeRename(nextDir, currentDir);
		swapped = true;
	} catch (e) {
		console.error('Swap failed:', e);
		// Try rollback if we renamed current away but didn't complete.
		if (!fs.existsSync(currentDir) && fs.existsSync(prevDir)) {
			try { safeRename(prevDir, currentDir); } catch {}
		}
		process.exit(3);
	}

	// Start new server
	try {
		const child = spawn('node', ['build/index.js'], { cwd: currentDir, detached: true, stdio: 'ignore', windowsHide: true });
		child.unref();
	} catch (e) {
		console.error('Failed to start new server:', e);
		process.exit(4);
	} finally {
		if (lockPath) {
			try { fs.unlinkSync(lockPath); } catch {}
		}
	}

	process.exit(0);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
`;
}

export function ensureUpdaterScript(updatesDir: string): string {
	ensureDir(updatesDir);
	const target = path.join(updatesDir, 'updater.mjs');
	fs.writeFileSync(target, updaterMjsContents(), 'utf8');
	return target;
}
