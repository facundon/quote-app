import { defineConfig } from 'drizzle-kit';

const isProd = process.env.NODE_ENV === 'production';
let dbPath: string;

if (isProd && process.env.APPDATA) {
	dbPath = `${process.env.APPDATA}/Presupuestador/presupuestos.db`;
} else if (process.env.DATABASE_URL) {
	dbPath = process.env.DATABASE_URL;
} else {
	// Default dev/CI db path to avoid failing in environments without APPDATA.
	dbPath = './local.db';
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: { url: dbPath },
	verbose: true,
	strict: true
});
