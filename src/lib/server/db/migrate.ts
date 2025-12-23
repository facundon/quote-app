import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, sqlite } from '$lib/server/db';
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

interface JournalEntry {
	tag: string;
	when: number;
	breakpoints: boolean;
}

interface Journal {
	entries: JournalEntry[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null;
}

function isJournalEntry(v: unknown): v is JournalEntry {
	if (!isRecord(v)) return false;
	return (
		typeof v.tag === 'string' &&
		typeof v.when === 'number' &&
		Number.isFinite(v.when) &&
		typeof v.breakpoints === 'boolean'
	);
}

function readJournal(migrationsFolder: string): Journal {
	const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
	const raw = fs.readFileSync(journalPath, 'utf8');
	const parsed: unknown = JSON.parse(raw);
	if (!isRecord(parsed) || !Array.isArray(parsed.entries)) {
		throw new Error(`Invalid drizzle journal format at ${journalPath}`);
	}
	const entries: JournalEntry[] = [];
	for (const e of parsed.entries) {
		if (!isJournalEntry(e)) throw new Error(`Invalid drizzle journal entry in ${journalPath}`);
		entries.push(e);
	}
	return { entries };
}

function hasTable(tableName: string): boolean {
	const row = sqlite
		.prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1`)
		.get(tableName) as { ok: 1 } | undefined;
	return row?.ok === 1;
}

function hasColumn(tableName: string, columnName: string): boolean {
	if (!hasTable(tableName)) return false;
	const cols = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
	return cols.some((c) => c.name === columnName);
}

function inferLastAppliedMigrationTag(journal: Journal): string | null {
	// Highest known schema state wins.
	if (hasColumn('invoice', 'receipt_email_sent_at')) {
		return journal.entries.findLast((e) => e.tag.startsWith('0005_'))?.tag ?? null;
	}
	if (hasColumn('instruction', 'order')) {
		return journal.entries.findLast((e) => e.tag.startsWith('0004_'))?.tag ?? null;
	}
	if (hasTable('instruction')) {
		return journal.entries.findLast((e) => e.tag.startsWith('0003_'))?.tag ?? null;
	}
	if (hasTable('ticket') && !hasColumn('ticket', 'created_by')) {
		return journal.entries.findLast((e) => e.tag.startsWith('0002_'))?.tag ?? null;
	}
	if (hasTable('ticket')) {
		return journal.entries.findLast((e) => e.tag.startsWith('0001_'))?.tag ?? null;
	}
	if (hasTable('category') && hasTable('study') && hasTable('provider') && hasTable('invoice')) {
		return journal.entries.findLast((e) => e.tag.startsWith('0000_'))?.tag ?? null;
	}
	return null;
}

function isLegacyMigrationsTable(): boolean {
	if (!hasTable('__drizzle_migrations')) return false;
	// Drizzle compares `Number(created_at)` to the journal "when" millis.
	// If created_at is a timestamp string (or otherwise non-numeric), Drizzle will skip all migrations.
	const row = sqlite
		.prepare(`SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`)
		.get() as { created_at?: unknown } | undefined;
	const v = row?.created_at;
	const asNum =
		typeof v === 'number'
			? v
			: typeof v === 'bigint'
				? Number(v)
				: typeof v === 'string'
					? Number(v)
					: Number.NaN;
	return !Number.isFinite(asNum);
}

function ensureMigrationsTableCompatible(migrationsFolder: string): void {
	if (!isLegacyMigrationsTable()) return;

	const journal = readJournal(migrationsFolder);
	const inferredTag = inferLastAppliedMigrationTag(journal);
	const inferredWhen = inferredTag
		? journal.entries.find((e) => e.tag === inferredTag)?.when
		: undefined;

	// Preserve the legacy table for debugging/forensics.
	const legacyName = `__drizzle_migrations_legacy_${Date.now()}`;
	sqlite.prepare(`ALTER TABLE __drizzle_migrations RENAME TO ${legacyName}`).run();

	// Create the table schema expected by Drizzle ORM migrator (see SQLiteSyncDialect.migrate).
	sqlite
		.prepare(
			`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				hash TEXT NOT NULL,
				created_at NUMERIC
			)`
		)
		.run();

	// Seed "last applied" migration timestamp so Drizzle can apply only newer migrations.
	// If we can’t infer, default to 0 (forces all migrations). This is only safe on an empty DB.
	sqlite
		.prepare(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`)
		.run('legacy-seed', inferredWhen ?? 0);
}

function getMigrationLockPath(): string {
	const isProd = process.env.NODE_ENV === 'production';
	const appData = process.env.APPDATA;
	if (isProd && appData) {
		const dir = path.join(appData, 'Presupuestador');
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
		console.log('Running migrations...');
		ensureMigrationsTableCompatible(migrationsFolder);
		migrate(db, { migrationsFolder });
		console.log('Migrations ran successfully');
	} catch (e) {
		console.error('Error running migrations:', e);
	} finally {
		releaseLock(lockPath);
	}
}
