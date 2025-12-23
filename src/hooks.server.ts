import type { Handle } from '@sveltejs/kit';
import dotenv from 'dotenv';
import { runMigrationsOnce } from '$lib/server/db/migrate';

export const handle: Handle = async ({ event, resolve }) => {
	// Ensure `.env` is loaded for production builds run via `node build/index.js`.
	// This runs before `resolve(...)`, so endpoints can read from `process.env`.
	dotenv.config({ quiet: true });
	await runMigrationsOnce();
	return resolve(event);
};
