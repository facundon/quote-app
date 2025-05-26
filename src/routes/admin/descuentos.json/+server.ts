import { db } from '$lib/server/db';
import { discount, category } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
	const discounts = await db
		.select({
			id: discount.id,
			category_id: discount.category_id,
			min_quantity: discount.min_quantity,
			percentage: discount.percentage,
			category_name: category.name
		})
		.from(discount)
		.leftJoin(category, eq(discount.category_id, category.id));
	return new Response(JSON.stringify(discounts), {
		headers: { 'Content-Type': 'application/json' }
	});
}
