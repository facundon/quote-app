import type { Handle, HandleServerError } from '@sveltejs/kit';
import dotenv from 'dotenv';
import { runMigrationsOnce } from '$lib/server/db/migrate';
import { initRuntimeLogging, logHandledError } from '$lib/server/runtimeLogs';

// Initialize once on server startup (module scope)
initRuntimeLogging();

export const handle: Handle = async ({ event, resolve }) => {
	// Ensure `.env` is loaded for production builds run via `node build/index.js`.
	// This runs before `resolve(...)`, so endpoints can read from `process.env`.
	dotenv.config({ quiet: true });
	await runMigrationsOnce();
	return resolve(event);
};

export const handleError: HandleServerError = ({ error, event }) => {
	logHandledError({
		url: event.url.toString(),
		method: event.request.method,
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined
	});
};
