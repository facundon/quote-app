import type { Handle } from '@sveltejs/kit';
import dotenv from 'dotenv';
import { runMigrationsOnce } from '$lib/server/db/migrate';

dotenv.config();

export const handle: Handle = async ({ event, resolve }) => {
	await runMigrationsOnce();
	return resolve(event);
};
