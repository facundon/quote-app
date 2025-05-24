import { db } from '$lib/server/db';
import { category } from '$lib/server/db/schema';

export async function load() {
	const categories = await db.select().from(category);
	return { categories };
}
