import type { Handle } from '@sveltejs/kit';
import { runMigrationsOnce } from '$lib/server/db/migrate';

export const handle: Handle = async ({ event, resolve }) => {
	await runMigrationsOnce();
	return resolve(event);
};
