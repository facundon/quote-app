import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import fs from 'fs';
import path from 'path';

const isProd = env.NODE_ENV === 'production';
let dbPath: string;

if (isProd && env.APPDATA) {
	const dir = path.join(env.APPDATA, 'Presupuestador');
	fs.mkdirSync(dir, { recursive: true });
	dbPath = path.join(dir, 'presupuestos.db');
} else if (env.DATABASE_URL) {
	// Dev (or non-Windows prod) can point at any SQLite path via DATABASE_URL.
	dbPath = env.DATABASE_URL;
} else {
	// Important: SvelteKit's build/analyse step imports server modules on CI.
	// On GitHub Actions (Linux), APPDATA is undefined, so we must not throw here.
	// Fall back to a local file in the project root (or wherever the process cwd is).
	dbPath = path.join(process.cwd(), 'local.db');
}

const client = new Database(dbPath);

export const db = drizzle(client, { schema });
