import { db } from '$lib/server/db';
import { bulletin } from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { EMPLOYEES } from '../../_shared/employees';
import { stringifyEmployeesJson } from './utils';
import { desc, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { writeFile, unlink } from 'fs/promises';
import {
	sanitizeFileName,
	getExtensionFromMimeType,
	resolveBoletinesFileFromStoredPath
} from '$lib/server/boletines/storage';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateImageFile(file: File): { valid: boolean; error?: string } {
	if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
		return {
			valid: false,
			error: 'Formato de archivo no soportado. Usa JPEG, PNG, GIF o WebP.'
		};
	}
	if (file.size > MAX_FILE_SIZE) {
		return { valid: false, error: 'El archivo es muy grande. Máximo 5 MB.' };
	}
	return { valid: true };
}

function ensureDirExists(dirPath: string): void {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

export const load: PageServerLoad = async () => {
	const bulletins = await db
		.select()
		.from(bulletin)
		.orderBy(desc(bulletin.isPinned), desc(bulletin.created_at));

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
		const imageFile = formData.get('image') as File | null;
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

		let imagePath: string | null = null;

		// Handle file upload if provided
		if (imageFile && imageFile.size > 0) {
			const validation = validateImageFile(imageFile);
			if (!validation.valid) {
				return fail(400, { error: validation.error });
			}

			try {
				const buffer = await imageFile.arrayBuffer();
				const timestamp = Date.now();
				const ext = getExtensionFromMimeType(imageFile.type);
				const sanitizedName = sanitizeFileName(imageFile.name.replace(/\.[^.]+$/, '') || 'image');
				const fileName = `${timestamp}_${sanitizedName}${ext}`;
				const relativeDir = `${Math.floor(Math.random() * 1000000)}`;
				const relativePath = `${relativeDir}/${fileName}`;
				const fullPath = resolveBoletinesFileFromStoredPath(relativePath);

				ensureDirExists(path.dirname(fullPath));
				await writeFile(fullPath, new Uint8Array(buffer));

				imagePath = relativePath;
			} catch (e) {
				console.error('Error handling image upload:', e);
				return fail(500, { error: 'Error al procesar la imagen' });
			}
		}

		try {
			const now = new Date().toISOString();
			const employees = stringifyEmployeesJson(employeesList);

			await db.insert(bulletin).values({
				title,
				description: description || undefined,
				image_path: imagePath,
				employees: employees || undefined,
				isPinned
			});

			return { success: true, message: 'Noticia creada correctamente' };
		} catch (e) {
			console.error('Error creating bulletin:', e);
			return fail(500, { error: 'Error al crear la noticia' });
		}
	},

	edit: async ({ request }) => {
		const formData = await request.formData();

		const id = parseInt(formData.get('id') as string);
		const title = (formData.get('title') as string)?.trim();
		const description = (formData.get('description') as string)?.trim() || null;
		const imageFile = formData.get('image') as File | null;
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

		try {
			// Get existing bulletin to check for old image
			const existingBulletin = await db
				.select({ image_path: bulletin.image_path })
				.from(bulletin)
				.where(eq(bulletin.id, id));

			if (!existingBulletin.length) {
				return fail(404, { error: 'Noticia no encontrada' });
			}

			let imagePath: string | null = existingBulletin[0].image_path;

			// Handle file upload if new file provided
			if (imageFile && imageFile.size > 0) {
				const validation = validateImageFile(imageFile);
				if (!validation.valid) {
					return fail(400, { error: validation.error });
				}

				try {
					// Delete old image if it exists
					if (existingBulletin[0].image_path) {
						const oldPath = resolveBoletinesFileFromStoredPath(existingBulletin[0].image_path);
						if (fs.existsSync(oldPath)) {
							await unlink(oldPath);
						}
					}

					// Write new image
					const buffer = await imageFile.arrayBuffer();
					const timestamp = Date.now();
					const ext = getExtensionFromMimeType(imageFile.type);
					const sanitizedName = sanitizeFileName(imageFile.name.replace(/\.[^.]+$/, '') || 'image');
					const fileName = `${timestamp}_${sanitizedName}${ext}`;
					const relativeDir = `${Math.floor(Math.random() * 1000000)}`;
					const relativePath = `${relativeDir}/${fileName}`;
					const fullPath = resolveBoletinesFileFromStoredPath(relativePath);

					ensureDirExists(path.dirname(fullPath));
					await writeFile(fullPath, new Uint8Array(buffer));

					imagePath = relativePath;
				} catch (e) {
					console.error('Error handling image upload:', e);
					return fail(500, { error: 'Error al procesar la imagen' });
				}
			}

			const now = new Date().toISOString();
			const employees = stringifyEmployeesJson(employeesList);

			await db
				.update(bulletin)
				.set({
					title,
					description: description || undefined,
					image_path: imagePath,
					employees: employees || undefined,
					isPinned,
					updated_at: now
				})
				.where(eq(bulletin.id, id));

			return { success: true, message: 'Noticia actualizada correctamente' };
		} catch (e) {
			console.error('Error updating bulletin:', e);
			return fail(500, { error: 'Error al actualizar la noticia' });
		}
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);

		if (!id || isNaN(id)) {
			return fail(400, { error: 'ID inválido' });
		}

		try {
			// Get image path before deleting
			const bulletins = await db
				.select({ image_path: bulletin.image_path })
				.from(bulletin)
				.where(eq(bulletin.id, id));

			// Delete image file if it exists
			if (bulletins.length && bulletins[0].image_path) {
				const imagePath = resolveBoletinesFileFromStoredPath(bulletins[0].image_path);
				if (fs.existsSync(imagePath)) {
					await unlink(imagePath);
				}
			}

			await db.delete(bulletin).where(eq(bulletin.id, id));
			return { success: true, message: 'Noticia eliminada correctamente' };
		} catch (e) {
			console.error('Error deleting bulletin:', e);
			return fail(500, { error: 'Error al eliminar la noticia' });
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
			const bulletins = await db
				.select({ isPinned: bulletin.isPinned })
				.from(bulletin)
				.where(eq(bulletin.id, id));

			if (!bulletins.length) {
				return fail(404, { error: 'Noticia no encontrada' });
			}

			const newPinned = bulletins[0].isPinned === 'true' ? 'false' : 'true';
			const now = new Date().toISOString();

			await db
				.update(bulletin)
				.set({ isPinned: newPinned, updated_at: now })
				.where(eq(bulletin.id, id));

			return {
				success: true,
				message: newPinned === 'true' ? 'Noticia fijada' : 'Noticia desfijada'
			};
		} catch (e) {
			console.error('Error toggling pin:', e);
			return fail(500, { error: 'Error al cambiar el estado de la noticia' });
		}
	}
};
