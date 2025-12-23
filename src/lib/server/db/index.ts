import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import fs from 'fs';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';
let dbPath: string;

const appData = process.env.APPDATA;
const databaseUrl = process.env.DATABASE_URL;

if (isProd && appData) {
	const dir = path.join(appData, 'Presupuestador');
	fs.mkdirSync(dir, { recursive: true });
	dbPath = path.join(dir, 'presupuestos.db');
} else if (databaseUrl) {
	// Dev (or non-Windows prod) can point at any SQLite path via DATABASE_URL.
	dbPath = databaseUrl;
} else {
	// If we're running from the atomic layout (`.../current`), keep DB outside version folders
	// so updates don't "create a new DB" by changing process.cwd().
	const cwd = process.cwd();
	if (path.basename(cwd).toLowerCase() === 'current') {
		dbPath = path.join(path.dirname(cwd), 'local.db');
	} else {
		// Default fallback: DB lives next to the running process.
		dbPath = path.join(cwd, 'local.db');
	}
}

export const dbFilePath = dbPath;
export const sqlite = new Database(dbPath);

export const db = drizzle(sqlite, { schema });
