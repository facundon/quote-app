import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { findAppRoot } from '$lib/server/update/appRoot';

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

function tryAcquireLock(lockPath: string): number | null {
	try {
		ensureDir(path.dirname(lockPath));
		const fd = fs.openSync(lockPath, 'wx');
		fs.writeFileSync(
			fd,
			JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2),
			'utf8'
		);
		// Close immediately; we rely on the existence of the lock file.
		fs.closeSync(fd);
		return fd;
	} catch {
		console.error('Error acquiring lock:', lockPath);
		return null;
	}
}

function releaseLock(lockPath: string): void {
	try {
		fs.unlinkSync(lockPath);
	} catch {
		console.error('Error releasing lock:', lockPath);
	}
}

function getMigrationsFolder(): string {
	const startDir = path.dirname(fileURLToPath(import.meta.url));
	const appRoot = findAppRoot(startDir);
	return path.join(appRoot, 'drizzle');
}

function getMigrationLockPath(): string {
	const isProd = env.NODE_ENV === 'production';
	if (isProd && env.APPDATA) {
		const dir = path.join(env.APPDATA, 'Presupuestador');
		return path.join(dir, 'migrate.lock');
	}
	// Dev fallback: lock in repo root next to DB file.
	return path.join(process.cwd(), '.migrate.lock');
}

let runPromise: Promise<void> | null = null;

export function runMigrationsOnce(): Promise<void> {
	if (!runPromise) runPromise = runMigrations();
	return runPromise;
}

async function runMigrations(): Promise<void> {
	const migrationsFolder = getMigrationsFolder();
	const lockPath = getMigrationLockPath();

	// If migrations folder is missing, do nothing (e.g. mispackaged install).
	if (!fs.existsSync(migrationsFolder)) {
		console.error('Migrations folder missing:', migrationsFolder);
		return;
	}

	// Acquire lock with retries (up to 60s).
	const start = Date.now();
	while (true) {
		const fd = tryAcquireLock(lockPath);
		if (fd !== null) break;
		if (Date.now() - start > 60_000) {
			console.error('Timeout acquiring lock');
			return;
		}
		await sleep(250);
	}

	try {
		migrate(db, { migrationsFolder });
	} catch (e) {
		console.error('Error running migrations:', e);
	} finally {
		releaseLock(lockPath);
	}
}
