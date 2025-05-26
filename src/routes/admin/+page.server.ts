import { db } from '$lib/server/db';
import { category, study, discount } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export async function load() {
	const categories = await db.select().from(category);
	const studies = await db
		.select({
			id: study.id,
			name: study.name,
			category_id: study.category_id,
			category_name: category.name
		})
		.from(study)
		.leftJoin(category, eq(study.category_id, category.id));
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
	return { categories, studies, discounts };
}

export const actions = {
	// Categorías
	category_create: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name');
		const unit_price = form.get('unit_price');
		if (!name || !unit_price) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db.insert(category).values({ name: String(name), unit_price: Number(unit_price) });
			return { type: 'success', status: 200, data: { message: 'Categoría creada.' } };
		} catch {
			return fail(500, { error: 'Error al crear la categoría.' });
		}
	},
	category_edit: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const name = form.get('name');
		const unit_price = form.get('unit_price');
		if (!id || !name || !unit_price) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db
				.update(category)
				.set({ name: String(name), unit_price: Number(unit_price) })
				.where(eq(category.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al editar la categoría.' });
		}
	},
	category_delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}
		try {
			await db.delete(category).where(eq(category.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al eliminar la categoría.' });
		}
	},
	// Estudios
	study_create: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name');
		const category_id = form.get('category_id');
		if (!name || !category_id) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db.insert(study).values({ name: String(name), category_id: Number(category_id) });
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al crear el estudio.' });
		}
	},
	study_edit: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const name = form.get('name');
		const category_id = form.get('category_id');
		if (!id || !name || !category_id) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db
				.update(study)
				.set({ name: String(name), category_id: Number(category_id) })
				.where(eq(study.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al editar el estudio.' });
		}
	},
	study_delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}
		try {
			await db.delete(study).where(eq(study.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al eliminar el estudio.' });
		}
	},
	// Descuentos
	discount_create: async ({ request }) => {
		const form = await request.formData();
		const category_id = form.get('category_id');
		const min_quantity = form.get('min_quantity');
		const percentage = form.get('percentage');
		if (!category_id || !min_quantity || !percentage) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db.insert(discount).values({
				category_id: Number(category_id),
				min_quantity: Number(min_quantity),
				percentage: Number(percentage)
			});
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al crear el descuento.' });
		}
	},
	discount_edit: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const category_id = form.get('category_id');
		const min_quantity = form.get('min_quantity');
		const percentage = form.get('percentage');
		if (!id || !category_id || !min_quantity || !percentage) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db
				.update(discount)
				.set({
					category_id: Number(category_id),
					min_quantity: Number(min_quantity),
					percentage: Number(percentage)
				})
				.where(eq(discount.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al editar el descuento.' });
		}
	},
	discount_delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}
		try {
			await db.delete(discount).where(eq(discount.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al eliminar el descuento.' });
		}
	}
};
