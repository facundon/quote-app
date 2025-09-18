import { db } from '$lib/server/db';
import { category, study, discount, provider, invoice, instruction } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
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
	const providers = await db.select().from(provider);
	const invoices = await db
		.select({
			id: invoice.id,
			provider_id: invoice.provider_id
		})
		.from(invoice);

	const instructions = await db
		.select()
		.from(instruction)
		.orderBy(instruction.category, instruction.order);

	return { categories, studies, discounts, providers, invoices, instructions };
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
	},
	// Proveedores
	provider_create: async ({ request }) => {
		const form = await request.formData();
		const name = form.get('name');
		const address = form.get('address');
		const phone = form.get('phone');
		const email = form.get('email');
		const cbu_alias = form.get('cbu_alias');
		const contact_name = form.get('contact_name');
		if (!name || !address || !phone || !email || !cbu_alias || !contact_name) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db.insert(provider).values({
				name: String(name),
				address: String(address),
				phone: String(phone),
				email: String(email),
				cbu_alias: String(cbu_alias),
				contact_name: String(contact_name)
			});
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al crear el proveedor.' });
		}
	},
	provider_edit: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const name = form.get('name');
		const address = form.get('address');
		const phone = form.get('phone');
		const email = form.get('email');
		const cbu_alias = form.get('cbu_alias');
		const contact_name = form.get('contact_name');
		if (!id || !name || !address || !phone || !email || !cbu_alias || !contact_name) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db
				.update(provider)
				.set({
					name: String(name),
					address: String(address),
					phone: String(phone),
					email: String(email),
					cbu_alias: String(cbu_alias),
					contact_name: String(contact_name)
				})
				.where(eq(provider.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al editar el proveedor.' });
		}
	},
	provider_delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}
		try {
			await db.delete(provider).where(eq(provider.id, Number(id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Error al eliminar el proveedor.' });
		}
	},

	// Instrucciones (admin)
	instruction_create: async ({ request }) => {
		const form = await request.formData();
		const title = form.get('title');
		const description = form.get('description');
		const categoryValue = form.get('category');
		if (!title || !description || !categoryValue) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			const maxOrderResult = await db
				.select({ maxOrder: instruction.order })
				.from(instruction)
				.where(eq(instruction.category, String(categoryValue)))
				.orderBy(desc(instruction.order))
				.limit(1);
			const nextOrder = maxOrderResult.length > 0 ? (maxOrderResult[0].maxOrder || 0) + 1 : 0;
			await db.insert(instruction).values({
				title: String(title),
				description: String(description),
				category: String(categoryValue),
				order: nextOrder,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			});
			return { success: true, message: 'Instrucción creada exitosamente.' };
		} catch (error) {
			return fail(500, { error: 'Error al crear la instrucción.' });
		}
	},
	instruction_edit: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const title = form.get('title');
		const description = form.get('description');
		const categoryValue = form.get('category');
		if (!id || !title || !description || !categoryValue) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}
		try {
			await db
				.update(instruction)
				.set({
					title: String(title),
					description: String(description),
					category: String(categoryValue),
					updated_at: new Date().toISOString()
				})
				.where(eq(instruction.id, Number(id)));
			return { success: true, message: 'Instrucción actualizada exitosamente.' };
		} catch (error) {
			return fail(500, { error: 'Error al actualizar la instrucción.' });
		}
	},
	instruction_delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}
		try {
			await db.delete(instruction).where(eq(instruction.id, Number(id)));
			return { success: true, message: 'Instrucción eliminada exitosamente.' };
		} catch (error) {
			return fail(500, { error: 'Error al eliminar la instrucción.' });
		}
	},
	instruction_reorder: async ({ request }) => {
		const form = await request.formData();
		const instructionIds = form.get('instructionIds');
		const categoryValue = form.get('category');
		if (!instructionIds || !categoryValue) {
			return fail(400, { error: 'Faltan datos requeridos.' });
		}
		try {
			const ids = JSON.parse(String(instructionIds)) as number[];
			await Promise.all(
				ids.map((id, index) =>
					db
						.update(instruction)
						.set({ order: index, updated_at: new Date().toISOString() })
						.where(eq(instruction.id, id))
				)
			);
			return { success: true, message: 'Orden actualizado exitosamente.' };
		} catch (error) {
			return fail(500, { error: 'Error al reordenar las instrucciones.' });
		}
	}
};
