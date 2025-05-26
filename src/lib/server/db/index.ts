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
} else {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	dbPath = env.DATABASE_URL;
}

const client = new Database(dbPath);

export const db = drizzle(client, { schema });
