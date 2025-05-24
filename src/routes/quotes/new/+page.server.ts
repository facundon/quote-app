import { db } from '$lib/server/db';
import { quote, quote_study, study, category, discount } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

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

export const actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const client = data.get('client')?.toString() ?? '';
		const date = data.get('date')?.toString() ?? '';
		const studiesRaw = data.getAll('studies[]');
		const quantitiesRaw = data.getAll('quantities[]');

		if (!client || !date || studiesRaw.length === 0) {
			return fail(400, { error: 'Faltan datos requeridos' });
		}

		const studiesArr = studiesRaw.map(Number);
		const quantitiesArr = quantitiesRaw.map(Number);

		const insertedQuote = await db.insert(quote).values({ client, date }).returning();
		const quoteId = insertedQuote[0].id;

		await Promise.all(
			studiesArr.map((studyId, i) =>
				db.insert(quote_study).values({
					quote_id: quoteId,
					study_id: studyId,
					quantity: quantitiesArr[i]
				})
			)
		);

		// Redirigir a la lista de presupuestos
		redirect(303, '/quotes');
	}
};
