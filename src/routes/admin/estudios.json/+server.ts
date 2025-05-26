import { db } from '$lib/server/db';
import { study, category } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
	const studies = await db
		.select({
			id: study.id,
			name: study.name,
			category_id: study.category_id,
			category_name: category.name
		})
		.from(study)
		.leftJoin(category, eq(study.category_id, category.id));
	return new Response(JSON.stringify(studies), {
		headers: { 'Content-Type': 'application/json' }
	});
}
