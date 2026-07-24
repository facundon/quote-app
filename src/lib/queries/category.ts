import { db } from '$lib/server/db';
import { category } from '$lib/server/db/schema';

export async function getCategories() {
	return db.select({ id: category.id, name: category.name }).from(category);
}
