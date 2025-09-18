import { db } from '$lib/server/db';
import { ticket } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, ServerLoad, RequestEvent } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
	try {
		const tickets = await db.select().from(ticket).orderBy(desc(ticket.created_at));
		const employees = [
			'Milton',
			'Lore',
			'Gemy',
			'Anyi',
			'Nani',
			'Eri',
			'Nati',
			'Mari',
			'Vik',
			'Doc'
		];
		return { tickets, employees };
	} catch (error) {
		console.error('Error loading tickets:', error);
		return { tickets: [], employees: [] };
	}
};

export const actions: Actions = {
	// Crear ticket
	create: async ({ request }: RequestEvent) => {
		const form = await request.formData();
		const title = form.get('title');
		const description = form.get('description');
		const assignee = form.get('assignee');
		const priority = form.get('priority');

		if (!title || !assignee) {
			return fail(400, { error: 'Faltan campos requeridos: título y asignado.' });
		}

		try {
			await db.insert(ticket).values({
				title: String(title),
				description: description ? String(description) : '',
				assignee: String(assignee),
				priority: priority ? String(priority) : 'medium'
			});
			return { success: true, message: 'Ticket creado exitosamente.' };
		} catch (error) {
			console.error('Error creating ticket:', error);
			return fail(500, { error: 'Error al crear el ticket.' });
		}
	},

	// Editar ticket
	edit: async ({ request }: RequestEvent) => {
		const form = await request.formData();
		const id = form.get('id');
		const title = form.get('title');
		const description = form.get('description');
		const assignee = form.get('assignee');
		const priority = form.get('priority');
		const status = form.get('status');

		if (!id || !title || !assignee) {
			return fail(400, { error: 'Faltan campos requeridos: ID, título y asignado.' });
		}

		try {
			const updateData: any = {
				title: String(title),
				description: description ? String(description) : '',
				assignee: String(assignee),
				priority: priority ? String(priority) : 'medium',
				status: status ? String(status) : 'open'
			};

			// Si el status cambia a 'resolved' o 'closed', actualizar completed_at
			if (status === 'resolved' || status === 'closed') {
				updateData.completed_at = new Date().toISOString();
			} else if (status === 'open' || status === 'in_progress') {
				updateData.completed_at = null;
			}

			await db
				.update(ticket)
				.set(updateData)
				.where(eq(ticket.id, Number(id)));

			return { success: true, message: 'Ticket actualizado exitosamente.' };
		} catch (error) {
			console.error('Error updating ticket:', error);
			return fail(500, { error: 'Error al actualizar el ticket.' });
		}
	},

	// Eliminar ticket
	delete: async ({ request }: RequestEvent) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return fail(400, { error: 'Falta el ID del ticket.' });
		}

		try {
			await db.delete(ticket).where(eq(ticket.id, Number(id)));
			return { success: true, message: 'Ticket eliminado exitosamente.' };
		} catch (error) {
			console.error('Error deleting ticket:', error);
			return fail(500, { error: 'Error al eliminar el ticket.' });
		}
	},

	// Cambiar status del ticket (acción rápida)
	updateStatus: async ({ request }: RequestEvent) => {
		const form = await request.formData();
		const id = form.get('id');
		const status = form.get('status');

		if (!id || !status) {
			return fail(400, { error: 'Faltan el ID y el status.' });
		}

		try {
			const updateData: any = {
				status: String(status)
			};

			// Si el status cambia a 'resolved' o 'closed', actualizar completed_at
			if (status === 'resolved' || status === 'closed') {
				updateData.completed_at = new Date().toISOString();
			} else if (status === 'open' || status === 'in_progress') {
				updateData.completed_at = null;
			}

			await db
				.update(ticket)
				.set(updateData)
				.where(eq(ticket.id, Number(id)));

			return { success: true, message: 'Status del ticket actualizado.' };
		} catch (error) {
			console.error('Error updating ticket status:', error);
			return fail(500, { error: 'Error al actualizar el status del ticket.' });
		}
	}
};
