import nodemailer from 'nodemailer';
import type { Provider } from '$lib/server/db/schema';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface EmailConfig {
	host: string;
	port: number;
	secure: boolean;
	auth: {
		user: string;
		pass: string;
	};
}

interface SendInvoiceEmailParams {
	filePath: string;
	provider: Provider;
}

export class EmailService {
	private transporter: nodemailer.Transporter;
	private config: EmailConfig;

	constructor(config: EmailConfig) {
		this.transporter = nodemailer.createTransport(config);
		this.config = config;
	}

	async sendInvoiceEmail({
		filePath,
		provider
	}: SendInvoiceEmailParams): Promise<{ success: boolean; error?: string }> {
		try {
			// Use provider email if no specific recipient is provided
			const toEmail = provider.email;

			if (!toEmail) {
				return {
					success: false,
					error: 'El proveedor no tiene un email configurado'
				};
			}

			// Check if file exists
			const fullFilePath = path.join(process.cwd(), filePath);
			if (!fs.existsSync(fullFilePath)) {
				return {
					success: false,
					error: 'Archivo no encontrado'
				};
			}

			// Get file extension and determine filename
			const fileExtension = path.extname(filePath).toLowerCase();
			const fileName = path.basename(filePath);
			
			// Determine attachment filename based on file type
			let attachmentFilename: string;
			if (fileExtension === '.pdf') {
				attachmentFilename = 'Comprobante.pdf';
			} else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(fileExtension)) {
				attachmentFilename = `Comprobante${fileExtension}`;
			} else {
				attachmentFilename = fileName;
			}

			await this.transporter.sendMail({
				from: `"Laboratorio Yunes" <${this.config.auth.user}>`,
				to: toEmail,
				subject: `Comprobante de pago - Laboratorio Yunes`,
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<p style="color: #374151; line-height: 1.6;">
							Hola ${provider.contact_name || 'Estimado proveedor'},
						</p>

						<p style="color: #374151; line-height: 1.6;">
							Se adjunta comprobante de pago.
						</p>

						<p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
							Atentamente,<br>
							Laboratorio Yunes
						</p>
					</div>
				`,
				attachments: [
					{
						filename: attachmentFilename,
						path: fullFilePath
					}
				]
			});

			return { success: true };
		} catch (error) {
			console.error('Error sending email:', error);

			let errorMessage = 'Error desconocido al enviar email';

			if (error instanceof Error) {
				// Provide user-friendly error messages
				if (
					error.message.includes('Invalid login') ||
					error.message.includes('Authentication failed') ||
					error.message.includes('Missing credentials')
				) {
					errorMessage = 'Error de autenticación del servidor de email';
				} else if (
					error.message.includes('Connection timeout') ||
					error.message.includes('ECONNREFUSED')
				) {
					errorMessage = 'Error de conexión con el servidor de email';
				} else if (error.message.includes('Invalid recipient')) {
					errorMessage = 'Dirección de email inválida';
				} else if (error.message.includes('Message size exceeds')) {
					errorMessage = 'El archivo es demasiado grande';
				} else if (error.message.includes('SMTP')) {
					errorMessage = 'Error del servidor de email';
				} else {
					errorMessage = error.message;
				}
			}

			return {
				success: false,
				error: errorMessage
			};
		}
	}

	async verifyConnection(): Promise<boolean> {
		try {
			await this.transporter.verify();
			return true;
		} catch (error) {
			console.error('Email service connection failed:', error);
			return false;
		}
	}
}

// Create email service instance with environment variables
export const emailService = new EmailService({
	host: process.env.SMTP_HOST || 'smtp.gmail.com',
	port: parseInt(process.env.SMTP_PORT || '587'),
	secure: process.env.SMTP_SECURE === 'true',
	auth: {
		user: process.env.SMTP_USER || '',
		pass: process.env.SMTP_PASS || ''
	}
});
