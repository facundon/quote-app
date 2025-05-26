import { db } from '$lib/server/db';
import { category } from '$lib/server/db/schema';

export async function GET() {
	const categories = await db.select().from(category);
	return new Response(JSON.stringify(categories), {
		headers: { 'Content-Type': 'application/json' }
	});
}
