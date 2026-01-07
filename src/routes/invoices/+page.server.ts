import { db } from '$lib/server/db';
import { invoice, provider } from '$lib/server/db/schema';
import { and, asc, desc, eq, or } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';
import { emailService } from '$lib/server/email';
import { fail } from '@sveltejs/kit';
import { EMPLOYEES } from '../../_shared/employees';
import {
	INVOICES_FOLDER_NAME,
	getInvoicesDir,
	resolveInvoicesFileFromStoredPath
} from '$lib/server/invoices/storage';

// Allowed file types for uploads
const allowedMimeTypes = [
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/bmp',
	'image/webp'
];

function getExtensionFromMimeType(mimeType: string): string {
	const map: Record<string, string> = {
		'application/pdf': '.pdf',
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/bmp': '.bmp',
		'image/webp': '.webp'
	};
	return map[mimeType] || '';
}

function toUrlPath(inputPath: string): string {
	return inputPath.replaceAll('\\', '/');
}

function urlPathJoin(...parts: string[]): string {
	return path.posix.join(...parts.map(toUrlPath));
}

function urlPathToFsPath(urlPath: string): string {
	const normalized = toUrlPath(urlPath);
	return resolveInvoicesFileFromStoredPath(normalized);
}

function ensureDirExists(dirPath: string): void {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

export async function load({ url }: { url: URL }) {
	const filterStatus = url.searchParams.get('filter') || 'pending';
	const filterUser = url.searchParams.get('user') || '';
	const filterProvider = url.searchParams.get('provider') || '';
	const sortParam = url.searchParams.get('sort') || 'created';
	const dirParam = (url.searchParams.get('dir') || 'desc').toLowerCase();
	const sort = sortParam === 'payment' || sortParam === 'reception' ? sortParam : 'created';
	const dir = dirParam === 'asc' ? 'asc' : 'desc';

	let statusCondition = undefined;

	// Apply filter based on payment status
	if (filterStatus === 'paid') {
		statusCondition = eq(invoice.payment_status, 'paid');
	} else if (filterStatus === 'pending-payment') {
		statusCondition = eq(invoice.payment_status, 'pending');
	} else if (filterStatus === 'pending') {
		statusCondition = or(
			eq(invoice.payment_status, 'pending'),
			eq(invoice.shipping_status, 'pending')
		);
	}
	// For 'all', no status condition is applied

	// Optional user filter
	const userCondition = filterUser ? eq(invoice.uploaded_by, filterUser) : undefined;
	// Optional provider filter
	const providerCondition = filterProvider
		? eq(invoice.provider_id, Number(filterProvider))
		: undefined;

	// Combine conditions when present
	let whereCondition = undefined as any;
	if (statusCondition) whereCondition = statusCondition;
	if (userCondition)
		whereCondition = whereCondition ? and(whereCondition, userCondition) : userCondition;
	if (providerCondition)
		whereCondition = whereCondition ? and(whereCondition, providerCondition) : providerCondition;

	const invoices = await db
		.select({
			id: invoice.id,
			pdf_path: invoice.pdf_path,
			payment_receipt_path: invoice.payment_receipt_path,
			receipt_email_sent_at: invoice.receipt_email_sent_at,
			value: invoice.value,
			payment_status: invoice.payment_status,
			shipping_status: invoice.shipping_status,
			payment_date: invoice.payment_date,
			reception_date: invoice.reception_date,
			provider_id: invoice.provider_id,
			uploaded_by: invoice.uploaded_by,
			notes: invoice.notes,
			created_at: invoice.created_at,
			provider_name: provider.name,
			provider_email: provider.email,
			provider_address: provider.address,
			provider_phone: provider.phone,
			provider_cbu_alias: provider.cbu_alias,
			provider_contact_name: provider.contact_name
		})
		.from(invoice)
		.leftJoin(provider, eq(invoice.provider_id, provider.id))
		.where(whereCondition)
		.orderBy(
			// Primary sort by selected date field with nulls last behavior emulation
			// For simplicity, we sort by whether field is null (nulls last), then by the field
			// and finally by created_at as a tiebreaker
			...(sort === 'payment'
				? [dir === 'asc' ? asc(invoice.payment_date) : desc(invoice.payment_date)]
				: sort === 'reception'
					? [dir === 'asc' ? asc(invoice.reception_date) : desc(invoice.reception_date)]
					: [dir === 'asc' ? asc(invoice.created_at) : desc(invoice.created_at)]),
			// Secondary tiebreaker to keep stable order
			desc(invoice.created_at)
		);

	const providers = await db.select().from(provider);

	// Employees list from shared module
	const employees = EMPLOYEES;

	return {
		invoices,
		providers,
		filterStatus,
		filterUser,
		filterProvider,
		employees,
		sort,
		dir
	};
}

export const actions = {
	invoice_create: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const pdfFile = form.get('pdf') as File;
		const paymentReceiptFile = form.get('payment_receipt') as File;
		const value = form.get('value');
		const provider_id = form.get('provider_id');
		const uploaded_by = form.get('uploaded_by');
		const notes = form.get('notes');

		if (!pdfFile || !value || !provider_id || !uploaded_by) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}

		try {
			// Get provider name for folder creation
			const providerData = await db
				.select({ name: provider.name })
				.from(provider)
				.where(eq(provider.id, Number(provider_id)))
				.limit(1);

			if (providerData.length === 0) {
				return fail(404, { error: 'Proveedor no encontrado.' });
			}

			const providerName = providerData[0].name;

			// Create base facturas directory
			const baseDir = getInvoicesDir();
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

			// Validate file type for invoice file
			if (!allowedMimeTypes.includes(pdfFile.type)) {
				return fail(400, {
					error: 'Tipo de archivo de factura no soportado. Solo PDF o imágenes.'
				});
			}

			// Generate unique filename with timestamp and correct extension
			const timestamp = new Date().getTime();
			const extension = getExtensionFromMimeType(pdfFile.type);
			const originalName = pdfFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
			const fileName = `${timestamp}_${originalName}`;
			const filePath = path.join(providerDir, fileName);

			// Convert File to Buffer and save
			const arrayBuffer = await pdfFile.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			await writeFile(filePath, buffer);

			// Store relative path in database
			const relativePath = urlPathJoin(INVOICES_FOLDER_NAME, sanitizedProviderName, fileName);

			// Handle payment receipt file if provided
			let paymentReceiptPath: string | null = null;
			if (paymentReceiptFile && paymentReceiptFile.size > 0) {
				if (!allowedMimeTypes.includes(paymentReceiptFile.type)) {
					return fail(400, {
						error: 'Tipo de archivo de comprobante no soportado. Solo PDF o imágenes.'
					});
				}
				const receiptExtension = getExtensionFromMimeType(paymentReceiptFile.type);
				const receiptOriginalName = paymentReceiptFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
				const receiptFileName = `${timestamp}_${receiptOriginalName.replace(/(\.[^.]+)$/, `_comprobante${receiptExtension}`)}`;
				const receiptFilePath = path.join(providerDir, receiptFileName);

				// Convert File to Buffer and save
				const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
				const receiptBuffer = Buffer.from(receiptArrayBuffer);
				await writeFile(receiptFilePath, receiptBuffer);

				// Store relative path in database
				paymentReceiptPath = urlPathJoin(
					INVOICES_FOLDER_NAME,
					sanitizedProviderName,
					receiptFileName
				);
			}

			await db.insert(invoice).values({
				pdf_path: relativePath,
				payment_receipt_path: paymentReceiptPath,
				value: Number(value),
				payment_status: 'pending',
				shipping_status: 'pending',
				provider_id: Number(provider_id),
				uploaded_by: String(uploaded_by),
				notes: notes ? String(notes) : null,
				created_at: new Date().toISOString()
			});

			return { success: true, message: 'Factura creada.' };
		} catch (error) {
			console.error('Error creating invoice:', error);
			return fail(500, { error: 'Error al crear la factura.' });
		}
	},

	invoice_edit: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const value = form.get('value');
		const uploaded_by = form.get('uploaded_by');
		const payment_status = form.get('payment_status');
		const shipping_status = form.get('shipping_status');
		const payment_date = form.get('payment_date');
		const reception_date = form.get('reception_date');
		const notes = form.get('notes');
		const paymentReceiptFile = form.get('payment_receipt') as File;

		if (!id || !value || !uploaded_by || !payment_status || !shipping_status) {
			return fail(400, { error: 'Faltan campos requeridos.' });
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
				return fail(404, { error: 'Factura no encontrada.' });
			}

			const currentPdfPath = currentInvoice[0].pdf_path;
			const currentPdfPathUrl = toUrlPath(currentPdfPath);
			const currentPaymentStatus = currentInvoice[0].payment_status;
			const currentReceiptPath = currentInvoice[0].payment_receipt_path;
			let paymentReceiptPath: string | null | undefined = undefined;

			// If changing from paid to pending, delete the receipt file
			if (currentPaymentStatus === 'paid' && payment_status === 'pending' && currentReceiptPath) {
				const fullReceiptPath = urlPathToFsPath(currentReceiptPath);
				if (fs.existsSync(fullReceiptPath)) {
					fs.unlinkSync(fullReceiptPath);
					console.log(`Payment receipt file deleted: ${fullReceiptPath}`);
				}
				paymentReceiptPath = null;
			}

			// Handle payment receipt file if provided
			if (paymentReceiptFile && paymentReceiptFile.size > 0) {
				// Validate file type for payment receipt if provided
				if (!allowedMimeTypes.includes(paymentReceiptFile.type)) {
					return fail(400, {
						error: 'Tipo de archivo de comprobante no soportado. Solo PDF o imágenes.'
					});
				}
				const receiptExtension = getExtensionFromMimeType(paymentReceiptFile.type);
				const pdfDir = path.dirname(urlPathToFsPath(currentPdfPathUrl));
				ensureDirExists(pdfDir);
				const pdfFileName = path.posix.basename(
					currentPdfPathUrl,
					path.posix.extname(currentPdfPathUrl)
				);
				const receiptFileName = `${pdfFileName}_comprobante${receiptExtension}`;
				const receiptFilePath = path.join(pdfDir, receiptFileName);

				// Convert File to Buffer and save
				const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
				const receiptBuffer = Buffer.from(receiptArrayBuffer);
				await writeFile(receiptFilePath, receiptBuffer);

				// Store relative path in database
				paymentReceiptPath = urlPathJoin(path.posix.dirname(currentPdfPathUrl), receiptFileName);
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
					notes: notes ? String(notes) : null,
					...(paymentReceiptPath !== undefined && {
						payment_receipt_path: paymentReceiptPath,
						receipt_email_sent_at: null
					})
				})
				.where(eq(invoice.id, Number(id)));

			return { success: true, message: 'Factura actualizada.' };
		} catch (error) {
			console.error('Error updating invoice:', error);
			return fail(500, { error: 'Error al actualizar la factura.' });
		}
	},

	invoice_delete: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}

		try {
			// First, get the invoice to find the PDF and payment receipt paths
			const invoiceData = await db
				.select({
					pdf_path: invoice.pdf_path,
					payment_receipt_path: invoice.payment_receipt_path
				})
				.from(invoice)
				.where(eq(invoice.id, Number(id)))
				.limit(1);

			if (invoiceData.length === 0) {
				return fail(404, { error: 'Factura no encontrada.' });
			}

			const pdfPath = invoiceData[0].pdf_path;
			const paymentReceiptPath = invoiceData[0].payment_receipt_path;

			// Delete the database record
			await db.delete(invoice).where(eq(invoice.id, Number(id)));

			// Delete the PDF file if it exists
			if (pdfPath) {
				const fullPdfPath = urlPathToFsPath(pdfPath);
				if (fs.existsSync(fullPdfPath)) {
					fs.unlinkSync(fullPdfPath);
					console.log(`PDF file deleted: ${fullPdfPath}`);
				}
			}

			// Delete the payment receipt file if it exists
			if (paymentReceiptPath && paymentReceiptPath.length > 0) {
				const fullReceiptPath = urlPathToFsPath(paymentReceiptPath);
				if (fs.existsSync(fullReceiptPath)) {
					fs.unlinkSync(fullReceiptPath);
					console.log(`Payment receipt file deleted: ${fullReceiptPath}`);
				}
			}

			return { success: true, message: 'Factura eliminada.' };
		} catch (error) {
			console.error('Error deleting invoice:', error);
			return fail(500, { error: 'Error al eliminar la factura.' });
		}
	},

	invoice_quick_received: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}

		try {
			await db
				.update(invoice)
				.set({
					shipping_status: 'delivered',
					reception_date: new Date().toISOString()
				})
				.where(eq(invoice.id, Number(id)));

			return { success: true, message: 'Factura marcada como recibida.' };
		} catch (error) {
			console.error('Error marking invoice as received:', error);
			return fail(500, {
				error: 'Error al marcar la factura como recibida.'
			});
		}
	},

	invoice_upload_receipt: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const paymentReceiptFile = form.get('payment_receipt') as File;

		if (!id || !paymentReceiptFile || paymentReceiptFile.size === 0) {
			return fail(400, { error: 'Faltan campos requeridos.' });
		}

		try {
			// Get current invoice data to find the PDF path for receipt naming
			const currentInvoice = await db
				.select({ pdf_path: invoice.pdf_path, payment_status: invoice.payment_status })
				.from(invoice)
				.where(eq(invoice.id, Number(id)))
				.limit(1);

			if (currentInvoice.length === 0) {
				return fail(404, { error: 'Factura no encontrada.' });
			}

			if (currentInvoice[0].payment_status !== 'paid') {
				return fail(400, {
					error: 'Solo se puede subir comprobante a facturas pagadas.'
				});
			}

			const currentPdfPath = currentInvoice[0].pdf_path;
			const currentPdfPathUrl = toUrlPath(currentPdfPath);

			// Validate file type for payment receipt if provided
			if (!paymentReceiptFile || paymentReceiptFile.size === 0) {
				return fail(400, { error: 'Faltan campos requeridos.' });
			}
			if (!allowedMimeTypes.includes(paymentReceiptFile.type)) {
				return fail(400, {
					error: 'Tipo de archivo de comprobante no soportado. Solo PDF o imágenes.'
				});
			}
			const receiptExtension = getExtensionFromMimeType(paymentReceiptFile.type);
			const pdfDir = path.dirname(urlPathToFsPath(currentPdfPathUrl));
			ensureDirExists(pdfDir);
			const pdfFileName = path.posix.basename(
				currentPdfPathUrl,
				path.posix.extname(currentPdfPathUrl)
			);
			const receiptFileName = `${pdfFileName}_comprobante${receiptExtension}`;
			const receiptFilePath = path.join(pdfDir, receiptFileName);

			// Convert File to Buffer and save
			const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
			const receiptBuffer = Buffer.from(receiptArrayBuffer);
			await writeFile(receiptFilePath, receiptBuffer);

			// Store relative path in database
			const paymentReceiptPath = urlPathJoin(
				path.posix.dirname(currentPdfPathUrl),
				receiptFileName
			);

			await db
				.update(invoice)
				.set({
					payment_receipt_path: paymentReceiptPath,
					receipt_email_sent_at: null
				})
				.where(eq(invoice.id, Number(id)));

			return { success: true, message: 'Comprobante de pago subido.' };
		} catch (error) {
			console.error('Error uploading payment receipt:', error);
			return fail(500, {
				error: 'Error al subir el comprobante de pago.'
			});
		}
	},

	invoice_mark_paid_with_receipt: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');
		const paymentReceiptFile = form.get('payment_receipt') as File;

		if (!id) {
			return fail(400, { error: 'Falta el id.' });
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
				return fail(404, { error: 'Factura no encontrada.' });
			}

			const currentPdfPath = currentInvoice[0].pdf_path;
			const currentPdfPathUrl = toUrlPath(currentPdfPath);
			let paymentReceiptPath: string | null = null;

			// Handle payment receipt file if provided
			if (paymentReceiptFile && paymentReceiptFile.size > 0) {
				// Validate file type for payment receipt if provided
				if (!allowedMimeTypes.includes(paymentReceiptFile.type)) {
					return fail(400, {
						error: 'Tipo de archivo de comprobante no soportado. Solo PDF o imágenes.'
					});
				}
				const receiptExtension = getExtensionFromMimeType(paymentReceiptFile.type);
				const pdfDir = path.dirname(urlPathToFsPath(currentPdfPathUrl));
				ensureDirExists(pdfDir);
				const pdfFileName = path.posix.basename(
					currentPdfPathUrl,
					path.posix.extname(currentPdfPathUrl)
				);
				const receiptFileName = `${pdfFileName}_comprobante${receiptExtension}`;
				const receiptFilePath = path.join(pdfDir, receiptFileName);

				// Convert File to Buffer and save
				const receiptArrayBuffer = await paymentReceiptFile.arrayBuffer();
				const receiptBuffer = Buffer.from(receiptArrayBuffer);
				await writeFile(receiptFilePath, receiptBuffer);

				// Store relative path in database
				paymentReceiptPath = urlPathJoin(path.posix.dirname(currentPdfPathUrl), receiptFileName);
			}

			await db
				.update(invoice)
				.set({
					payment_status: 'paid',
					payment_date: new Date().toISOString(),
					...(paymentReceiptPath && {
						payment_receipt_path: paymentReceiptPath,
						receipt_email_sent_at: null
					})
				})
				.where(eq(invoice.id, Number(id)));

			return { success: true, message: 'Factura marcada como pagada.' };
		} catch (error) {
			console.error('Error marking invoice as paid:', error);
			return fail(500, {
				error: 'Error al marcar la factura como pagada.'
			});
		}
	},

	invoice_send_email: async ({ request }: { request: Request }) => {
		const form = await request.formData();
		const id = form.get('id');

		if (!id) {
			return fail(400, { error: 'Falta el id.' });
		}

		try {
			// Get invoice data with provider information
			const invoiceData = await db
				.select({
					id: invoice.id,
					payment_receipt_path: invoice.payment_receipt_path,
					value: invoice.value,
					provider_id: invoice.provider_id,
					provider_name: provider.name,
					provider_email: provider.email,
					provider_contact_name: provider.contact_name
				})
				.from(invoice)
				.leftJoin(provider, eq(invoice.provider_id, provider.id))
				.where(eq(invoice.id, Number(id)))
				.limit(1);

			if (invoiceData.length === 0) {
				return fail(404, { error: 'Factura no encontrada.' });
			}

			const invoiceInfo = invoiceData[0];

			// Check if provider has email
			if (!invoiceInfo.provider_email) {
				return fail(400, {
					error: 'El proveedor no tiene un email configurado.'
				});
			}

			if (!invoiceInfo.payment_receipt_path) {
				return fail(400, {
					error: 'No se ha subido un comprobante de pago.'
				});
			}

			// Send email
			const emailResult = await emailService.sendInvoiceEmail({
				filePath: invoiceInfo.payment_receipt_path,
				provider: {
					id: invoiceInfo.provider_id,
					name: invoiceInfo.provider_name || 'Proveedor',
					email: invoiceInfo.provider_email,
					contact_name: invoiceInfo.provider_contact_name || '',
					address: '',
					phone: '',
					cbu_alias: ''
				}
			});

			if (emailResult.success) {
				await db
					.update(invoice)
					.set({ receipt_email_sent_at: new Date().toISOString() })
					.where(eq(invoice.id, Number(id)));

				return {
					success: true,
					message: 'Email enviado correctamente.'
				};
			} else {
				// Return the actual error message from the email service
				return fail(500, {
					error: emailResult.error || 'Error al enviar email'
				});
			}
		} catch (error) {
			console.error('Error sending invoice email:', error);
			return fail(500, {
				error: 'Error al enviar el email.'
			});
		}
	}
};
