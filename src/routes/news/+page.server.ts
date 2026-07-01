import { sqlite } from '$lib/server/db';
import type { Bulletin } from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { EMPLOYEES } from '../../_shared/employees';
import { stringifyEmployeesJson } from './utils';

export const load: PageServerLoad = async () => {
	const bulletins = sqlite
		.prepare('SELECT * FROM bulletin ORDER BY isPinned DESC, created_at DESC')
		.all() as Bulletin[];

	return {
		bulletins,
		employees: EMPLOYEES
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const formData = await request.formData();

		const title = (formData.get('title') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const image_url = (formData.get('image_url') as string)?.trim() || null;
		const isPinned = formData.get('isPinned') === 'on' ? 'true' : 'false';
		const employeesList = formData.getAll('employees') as string[];

		// Validation
		if (!title || title.length < 3) {
			return fail(400, { error: 'El título es requerido y debe tener al menos 3 caracteres' });
		}
		if (title.length > 200) {
			return fail(400, { error: 'El título no puede exceder 200 caracteres' });
		}
		if (description && description.length > 500) {
			return fail(400, { error: 'La descripción no puede exceder 500 caracteres' });
		}

		// Validate employees
		for (const emp of employeesList) {
			if (!EMPLOYEES.includes(emp)) {
				return fail(400, { error: `Usuario inválido: ${emp}` });
			}
		}

		// Validate image URL if provided
		if (image_url) {
			try {
				new URL(image_url);
			} catch {
				return fail(400, { error: 'URL de imagen inválida' });
			}
		}

		try {
			const now = new Date().toISOString();
			const employees = stringifyEmployeesJson(employeesList);

			sqlite
				.prepare(
					`INSERT INTO bulletin (title, description, image_url, employees, isPinned, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.run(title, description, image_url, employees, isPinned, now, now);

			return { success: true, message: 'Boletín creado correctamente' };
		} catch (e) {
			console.error('Error creating bulletin:', e);
			return fail(500, { error: 'Error al crear el boletín' });
		}
	},

	edit: async ({ request }) => {
		const formData = await request.formData();

		const id = parseInt(formData.get('id') as string);
		const title = (formData.get('title') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const image_url = (formData.get('image_url') as string)?.trim() || null;
		const isPinned = formData.get('isPinned') === 'on' ? 'true' : 'false';
		const employeesList = formData.getAll('employees') as string[];

		// Validation
		if (!id || isNaN(id)) {
			return fail(400, { error: 'ID inválido' });
		}
		if (!title || title.length < 3) {
			return fail(400, { error: 'El título es requerido y debe tener al menos 3 caracteres' });
		}
		if (title.length > 200) {
			return fail(400, { error: 'El título no puede exceder 200 caracteres' });
		}
		if (description && description.length > 500) {
			return fail(400, { error: 'La descripción no puede exceder 500 caracteres' });
		}

		for (const emp of employeesList) {
			if (!EMPLOYEES.includes(emp)) {
				return fail(400, { error: `Usuario inválido: ${emp}` });
			}
		}

		if (image_url) {
			try {
				new URL(image_url);
			} catch {
				return fail(400, { error: 'URL de imagen inválida' });
			}
		}

		try {
			const now = new Date().toISOString();
			const employees = stringifyEmployeesJson(employeesList);

			sqlite
				.prepare(
					`UPDATE bulletin SET title = ?, description = ?, image_url = ?, employees = ?, isPinned = ?, updated_at = ?
					WHERE id = ?`
				)
				.run(title, description, image_url, employees, isPinned, now, id);

			return { success: true, message: 'Boletín actualizado correctamente' };
		} catch (e) {
			console.error('Error updating bulletin:', e);
			return fail(500, { error: 'Error al actualizar el boletín' });
		}
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (!id || isNaN(id)) {
			return fail(400, { error: 'ID inválido' });
		}

		try {
			sqlite.prepare('DELETE FROM bulletin WHERE id = ?').run(id);
			return { success: true, message: 'Boletín eliminado correctamente' };
		} catch (e) {
			console.error('Error deleting bulletin:', e);
			return fail(500, { error: 'Error al eliminar el boletín' });
		}
	},

	togglePin: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (!id || isNaN(id)) {
			return fail(400, { error: 'ID inválido' });
		}

		try {
			// Get current isPinned value
			const bulletin = sqlite.prepare('SELECT isPinned FROM bulletin WHERE id = ?').get(id) as
				| { isPinned: string }
				| undefined;

			if (!bulletin) {
				return fail(404, { error: 'Boletín no encontrado' });
			}

			const newPinned = bulletin.isPinned === 'true' ? 'false' : 'true';
			const now = new Date().toISOString();

			sqlite
				.prepare('UPDATE bulletin SET isPinned = ?, updated_at = ? WHERE id = ?')
				.run(newPinned, now, id);

			return {
				success: true,
				message: newPinned === 'true' ? 'Boletín fijado' : 'Boletín desfijado'
			};
		} catch (e) {
			console.error('Error toggling pin:', e);
			return fail(500, { error: 'Error al cambiar el estado del boletín' });
		}
	}
};
