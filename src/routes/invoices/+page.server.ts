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
			payment_receipt_path: invoice.payment_receipt_path,
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
		const paymentReceiptFile = form.get('payment_receipt') as File;
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

			// Handle payment receipt file if provided
			let paymentReceiptPath: string | null = null;
			if (paymentReceiptFile) {
				// Generate receipt filename with _comprobante suffix
				const receiptOriginalName = paymentReceiptFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
				const receiptFileName = `${timestamp}_${receiptOriginalName.replace('.pdf', '_comprobante.pdf')}`;
				const receiptFilePath = path.join(providerDir, receiptFileName);

				// Convert File to Buffer and save
				const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
				const receiptBuffer = Buffer.from(receiptArrayBuffer);
				await writeFile(receiptFilePath, receiptBuffer);

				// Store relative path in database
				paymentReceiptPath = path.join('facturas', sanitizedProviderName, receiptFileName);
			}

			await db.insert(invoice).values({
				pdf_path: relativePath,
				payment_receipt_path: paymentReceiptPath,
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
		const paymentReceiptFile = form.get('payment_receipt') as File;

		if (!id || !value || !uploaded_by || !payment_status || !shipping_status) {
			return { type: 'failure', status: 400, data: { error: 'Faltan campos requeridos.' } };
		}

		try {
			// Get current invoice data to find the PDF path for receipt naming
			const currentInvoice = await db
				.select({
					pdf_path: invoice.pdf_path,
					payment_status: invoice.payment_status,
					payment_receipt_path: invoice.payment_receipt_path
				})
				.from(invoice)
				.where(eq(invoice.id, Number(id)))
				.limit(1);

			if (currentInvoice.length === 0) {
				return { type: 'failure', status: 404, data: { error: 'Factura no encontrada.' } };
			}

			const currentPdfPath = currentInvoice[0].pdf_path;
			const currentPaymentStatus = currentInvoice[0].payment_status;
			const currentReceiptPath = currentInvoice[0].payment_receipt_path;
			let paymentReceiptPath: string | null = null;

			// If changing from paid to pending, delete the receipt file
			if (currentPaymentStatus === 'paid' && payment_status === 'pending' && currentReceiptPath) {
				const fullReceiptPath = path.join(process.cwd(), currentReceiptPath);
				if (fs.existsSync(fullReceiptPath)) {
					fs.unlinkSync(fullReceiptPath);
					console.log(`Payment receipt file deleted: ${fullReceiptPath}`);
				}
				paymentReceiptPath = null;
			}

			// Handle payment receipt file if provided
			if (paymentReceiptFile && paymentReceiptFile.size > 0) {
				// Extract the base path from the current PDF path
				const pdfDir = path.dirname(path.join(process.cwd(), currentPdfPath));
				const pdfFileName = path.basename(currentPdfPath, path.extname(currentPdfPath));

				// Generate receipt filename with _comprobante suffix
				const receiptFileName = `${pdfFileName}_comprobante.pdf`;
				const receiptFilePath = path.join(pdfDir, receiptFileName);

				// Convert File to Buffer and save
				const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
				const receiptBuffer = Buffer.from(receiptArrayBuffer);
				await writeFile(receiptFilePath, receiptBuffer);

				// Store relative path in database
				paymentReceiptPath = path.join(path.dirname(currentPdfPath), receiptFileName);
			}

			await db
				.update(invoice)
				.set({
					value: Number(value),
					uploaded_by: String(uploaded_by),
					payment_status: String(payment_status),
					shipping_status: String(shipping_status),
					payment_date: payment_date ? String(payment_date) : null,
					reception_date: reception_date ? String(reception_date) : null,
					...(paymentReceiptPath !== undefined && { payment_receipt_path: paymentReceiptPath })
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
			// First, get the invoice to find the PDF path
			const invoiceData = await db
				.select({ pdf_path: invoice.pdf_path })
				.from(invoice)
				.where(eq(invoice.id, Number(id)))
				.limit(1);

			if (invoiceData.length === 0) {
				return { type: 'failure', status: 404, data: { error: 'Factura no encontrada.' } };
			}

			const pdfPath = invoiceData[0].pdf_path;

			// Delete the database record
			await db.delete(invoice).where(eq(invoice.id, Number(id)));

			// Delete the PDF file if it exists
			if (pdfPath) {
				const fullPath = path.join(process.cwd(), pdfPath);
				if (fs.existsSync(fullPath)) {
					fs.unlinkSync(fullPath);
					console.log(`PDF file deleted: ${fullPath}`);
				}
			}

			return { type: 'success', status: 200, data: { message: 'Factura eliminada.' } };
		} catch (error) {
			console.error('Error deleting invoice:', error);
			return { type: 'failure', status: 500, data: { error: 'Error al eliminar la factura.' } };
		}
	},

	invoice_quick_received: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return { type: 'failure', status: 400, data: { error: 'Falta el id.' } };
		}

		try {
			await db
				.update(invoice)
				.set({
					shipping_status: 'delivered',
					reception_date: new Date().toISOString()
				})
				.where(eq(invoice.id, Number(id)));

			return { type: 'success', status: 200, data: { message: 'Factura marcada como recibida.' } };
		} catch (error) {
			console.error('Error marking invoice as received:', error);
			return {
				type: 'failure',
				status: 500,
				data: { error: 'Error al marcar la factura como recibida.' }
			};
		}
	},

	invoice_upload_receipt: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const paymentReceiptFile = form.get('payment_receipt') as File;

		if (!id || !paymentReceiptFile || paymentReceiptFile.size === 0) {
			return { type: 'failure', status: 400, data: { error: 'Faltan campos requeridos.' } };
		}

		try {
			// Get current invoice data to find the PDF path for receipt naming
			const currentInvoice = await db
				.select({ pdf_path: invoice.pdf_path, payment_status: invoice.payment_status })
				.from(invoice)
				.where(eq(invoice.id, Number(id)))
				.limit(1);

			if (currentInvoice.length === 0) {
				return { type: 'failure', status: 404, data: { error: 'Factura no encontrada.' } };
			}

			if (currentInvoice[0].payment_status !== 'paid') {
				return {
					type: 'failure',
					status: 400,
					data: { error: 'Solo se puede subir comprobante a facturas pagadas.' }
				};
			}

			const currentPdfPath = currentInvoice[0].pdf_path;

			// Extract the base path from the current PDF path
			const pdfDir = path.dirname(path.join(process.cwd(), currentPdfPath));
			const pdfFileName = path.basename(currentPdfPath, path.extname(currentPdfPath));

			// Generate receipt filename with _comprobante suffix
			const receiptFileName = `${pdfFileName}_comprobante.pdf`;
			const receiptFilePath = path.join(pdfDir, receiptFileName);

			// Convert File to Buffer and save
			const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
			const receiptBuffer = Buffer.from(receiptArrayBuffer);
			await writeFile(receiptFilePath, receiptBuffer);

			// Store relative path in database
			const paymentReceiptPath = path.join(path.dirname(currentPdfPath), receiptFileName);

			await db
				.update(invoice)
				.set({
					payment_receipt_path: paymentReceiptPath
				})
				.where(eq(invoice.id, Number(id)));

			return { type: 'success', status: 200, data: { message: 'Comprobante de pago subido.' } };
		} catch (error) {
			console.error('Error uploading payment receipt:', error);
			return {
				type: 'failure',
				status: 500,
				data: { error: 'Error al subir el comprobante de pago.' }
			};
		}
	},

	invoice_mark_paid_with_receipt: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const paymentReceiptFile = form.get('payment_receipt') as File;

		if (!id) {
			return { type: 'failure', status: 400, data: { error: 'Falta el id.' } };
		}

		try {
			// Get current invoice data to find the PDF path for receipt naming
			const currentInvoice = await db
				.select({
					pdf_path: invoice.pdf_path,
					payment_status: invoice.payment_status
				})
				.from(invoice)
				.where(eq(invoice.id, Number(id)))
				.limit(1);

			if (currentInvoice.length === 0) {
				return { type: 'failure', status: 404, data: { error: 'Factura no encontrada.' } };
			}

			const currentPdfPath = currentInvoice[0].pdf_path;
			let paymentReceiptPath: string | null = null;

			// Handle payment receipt file if provided
			if (paymentReceiptFile && paymentReceiptFile.size > 0) {
				// Extract the base path from the current PDF path
				const pdfDir = path.dirname(path.join(process.cwd(), currentPdfPath));
				const pdfFileName = path.basename(currentPdfPath, path.extname(currentPdfPath));

				// Generate receipt filename with _comprobante suffix
				const receiptFileName = `${pdfFileName}_comprobante.pdf`;
				const receiptFilePath = path.join(pdfDir, receiptFileName);

				// Convert File to Buffer and save
				const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
				const receiptBuffer = Buffer.from(receiptArrayBuffer);
				await writeFile(receiptFilePath, receiptBuffer);

				// Store relative path in database
				paymentReceiptPath = path.join(path.dirname(currentPdfPath), receiptFileName);
			}

			await db
				.update(invoice)
				.set({
					payment_status: 'paid',
					payment_date: new Date().toISOString(),
					...(paymentReceiptPath && { payment_receipt_path: paymentReceiptPath })
				})
				.where(eq(invoice.id, Number(id)));

			return { type: 'success', status: 200, data: { message: 'Factura marcada como pagada.' } };
		} catch (error) {
			console.error('Error marking invoice as paid:', error);
			return {
				type: 'failure',
				status: 500,
				data: { error: 'Error al marcar la factura como pagada.' }
			};
		}
	}
};
