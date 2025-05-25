import { db } from '$lib/server/db';
import { study, category, discount } from '$lib/server/db/schema';

export async function load() {
	const studies = await db
		.select({
			id: study.id,
			name: study.name,
			category_id: study.category_id
		})
		.from(study);
	const categories = await db.select().from(category);
	const discounts = await db.select().from(discount);
	return { studies, categories, discounts };
}
