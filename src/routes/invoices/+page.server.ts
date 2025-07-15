import { db } from '$lib/server/db';
import { invoice, provider } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function load() {
	const invoices = await db
		.select({
			id: invoice.id,
			pdf_path: invoice.pdf_path,
			value: invoice.value,
			payment_status: invoice.payment_status,
			shipping_status: invoice.shipping_status,
			payment_date: invoice.payment_date,
			reception_date: invoice.reception_date,
			provider_id: invoice.provider_id,
			uploaded_by: invoice.uploaded_by,
			created_at: invoice.created_at,
			provider_name: provider.name
		})
		.from(invoice)
		.leftJoin(provider, eq(invoice.provider_id, provider.id));

	const providers = await db.select().from(provider);

	return { invoices, providers };
}

export const actions = {
	invoice_create: async ({ request }) => {
		const form = await request.formData();
		const pdfFile = form.get('pdf') as File;
		const value = form.get('value');
		const provider_id = form.get('provider_id');
		const uploaded_by = form.get('uploaded_by');

		if (!pdfFile || !value || !provider_id || !uploaded_by) {
			return { type: 'failure', status: 400, data: { error: 'Faltan campos requeridos.' } };
		}

		try {
			// Get provider name for folder creation
			const providerData = await db
				.select({ name: provider.name })
				.from(provider)
				.where(eq(provider.id, Number(provider_id)))
				.limit(1);

			if (providerData.length === 0) {
				return { type: 'failure', status: 400, data: { error: 'Proveedor no encontrado.' } };
			}

			const providerName = providerData[0].name;

			// Create base facturas directory
			const baseDir = path.join(process.cwd(), 'facturas');
			if (!fs.existsSync(baseDir)) {
				fs.mkdirSync(baseDir, { recursive: true });
			}

			// Create provider subdirectory (sanitize name for folder use)
			const sanitizedProviderName = providerName
				.replace(/[^a-zA-Z0-9\s-]/g, '')
				.replace(/\s+/g, '_');
			const providerDir = path.join(baseDir, sanitizedProviderName);
			if (!fs.existsSync(providerDir)) {
				fs.mkdirSync(providerDir, { recursive: true });
			}

			// Generate unique filename with timestamp
			const timestamp = new Date().getTime();
			const originalName = pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
			const fileName = `${timestamp}_${originalName}`;
			const filePath = path.join(providerDir, fileName);

			// Convert File to Buffer and save
			const arrayBuffer = await pdfFile.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			await writeFile(filePath, buffer);

			// Store relative path in database
			const relativePath = path.join('facturas', sanitizedProviderName, fileName);

			await db.insert(invoice).values({
				pdf_path: relativePath,
				value: Number(value),
				payment_status: 'pending',
				shipping_status: 'pending',
				provider_id: Number(provider_id),
				uploaded_by: String(uploaded_by),
				created_at: new Date().toISOString()
			});

			return { type: 'success', status: 200, data: { message: 'Factura creada.' } };
		} catch (error) {
			console.error('Error creating invoice:', error);
			return { type: 'failure', status: 500, data: { error: 'Error al crear la factura.' } };
		}
	},

	invoice_edit: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const value = form.get('value');
		const uploaded_by = form.get('uploaded_by');
		const payment_status = form.get('payment_status');
		const shipping_status = form.get('shipping_status');
		const payment_date = form.get('payment_date');
		const reception_date = form.get('reception_date');

		if (!id || !value || !uploaded_by || !payment_status || !shipping_status) {
			return { type: 'failure', status: 400, data: { error: 'Faltan campos requeridos.' } };
		}

		try {
			await db
				.update(invoice)
				.set({
					value: Number(value),
					uploaded_by: String(uploaded_by),
					payment_status: String(payment_status),
					shipping_status: String(shipping_status),
					payment_date: payment_date ? String(payment_date) : null,
					reception_date: reception_date ? String(reception_date) : null
				})
				.where(eq(invoice.id, Number(id)));

			return { type: 'success', status: 200, data: { message: 'Factura actualizada.' } };
		} catch (error) {
			console.error('Error updating invoice:', error);
			return { type: 'failure', status: 500, data: { error: 'Error al actualizar la factura.' } };
		}
	},

	invoice_delete: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return { type: 'failure', status: 400, data: { error: 'Falta el id.' } };
		}

		try {
			await db.delete(invoice).where(eq(invoice.id, Number(id)));
			return { type: 'success', status: 200, data: { message: 'Factura eliminada.' } };
		} catch (error) {
			console.error('Error deleting invoice:', error);
			return { type: 'failure', status: 500, data: { error: 'Error al eliminar la factura.' } };
		}
	}
};
