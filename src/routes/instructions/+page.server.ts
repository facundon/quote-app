import { db } from '$lib/server/db';
import { instruction } from '$lib/server/db/schema';
import { desc, eq, like, or, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export async function load({ url }: { url: URL }) {
	const searchQuery = url.searchParams.get('search') || '';
	const categoryFilter = url.searchParams.get('category') || '';

	let whereConditions = [];

	// Apply search filter across title and description
	if (searchQuery) {
		whereConditions.push(
			or(
				like(instruction.title, `%${searchQuery}%`),
				like(instruction.description, `%${searchQuery}%`)
			)
		);
	}

	// Apply category filter
	if (categoryFilter) {
		whereConditions.push(eq(instruction.category, categoryFilter));
	}

	// Combine conditions
	const whereCondition =
		whereConditions.length > 0
			? whereConditions.length === 1
				? whereConditions[0]
				: and(...whereConditions)
			: undefined;

	const instructions = await db
		.select()
		.from(instruction)
		.where(whereCondition)
		.orderBy(desc(instruction.created_at));

	// Get unique categories for filter dropdown
	const categories = await db
		.selectDistinct({ category: instruction.category })
		.from(instruction)
		.orderBy(instruction.category);

	return {
		instructions,
		categories: categories.map((c) => c.category),
		searchQuery,
		categoryFilter
	};
}

export const actions = {
	instruction_create: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const title = form.get('title');
		const description = form.get('description');
		const category = form.get('category');

		if (!title || !description || !category) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}

		try {
			await db.insert(instruction).values({
				title: String(title),
				description: String(description),
				category: String(category),
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			});

			return { success: true, message: 'Instrucción creada exitosamente.' };
		} catch (error) {
			console.error('Error creating instruction:', error);
			return fail(500, { error: 'Error al crear la instrucción.' });
		}
	},

	instruction_edit: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const title = form.get('title');
		const description = form.get('description');
		const category = form.get('category');

		if (!id || !title || !description || !category) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}

		try {
			await db
				.update(instruction)
				.set({
					title: String(title),
					description: String(description),
					category: String(category),
					updated_at: new Date().toISOString()
				})
				.where(eq(instruction.id, Number(id)));

			return { success: true, message: 'Instrucción actualizada exitosamente.' };
		} catch (error) {
			console.error('Error updating instruction:', error);
			return fail(500, { error: 'Error al actualizar la instrucción.' });
		}
	},

	instruction_delete: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}

		try {
			await db.delete(instruction).where(eq(instruction.id, Number(id)));

			return { success: true, message: 'Instrucción eliminada exitosamente.' };
		} catch (error) {
			console.error('Error deleting instruction:', error);
			return fail(500, { error: 'Error al eliminar la instrucción.' });
		}
	},

	instruction_copy: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}

		try {
			// Get the instruction to copy
			const originalInstruction = await db
				.select()
				.from(instruction)
				.where(eq(instruction.id, Number(id)))
				.limit(1);

			if (originalInstruction.length === 0) {
				return fail(404, { error: 'Instrucción no encontrada.' });
			}

			const original = originalInstruction[0];

			// Create copy with "Copia de" prefix
			await db.insert(instruction).values({
				title: `Copia de ${original.title}`,
				description: original.description,
				category: original.category,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			});

			return { success: true, message: 'Instrucción copiada exitosamente.' };
		} catch (error) {
			console.error('Error copying instruction:', error);
			return fail(500, { error: 'Error al copiar la instrucción.' });
		}
	}
};
