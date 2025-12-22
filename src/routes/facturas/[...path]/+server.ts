import { error, isHttpError } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

// MIME type mapping for common file types
const mimeTypes: Record<string, string> = {
	'.pdf': 'application/pdf',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.bmp': 'image/bmp',
	'.tiff': 'image/tiff',
	'.ico': 'image/x-icon'
};

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	return mimeTypes[ext] || 'application/octet-stream';
}

export async function GET({ params }) {
	// Handle path parameter - it might be an array or string
	const pathSegments = Array.isArray(params.path) ? params.path : [params.path];
	const relativePath = pathSegments.join('/').replaceAll('\\', '/');
	const filePath = path.join(process.cwd(), 'facturas', ...relativePath.split('/'));

	try {
		// Check if file exists and is within the facturas directory
		const normalizedPath = path.normalize(filePath);
		const facturasDir = path.join(process.cwd(), 'facturas');

		if (!normalizedPath.startsWith(facturasDir)) {
			console.error('Access denied - path outside facturas directory');
			error(403, 'Access denied');
		}

		if (!fs.existsSync(normalizedPath)) {
			console.error('File not found:', normalizedPath);
			error(404, 'File not found');
		}

		const fileBuffer = fs.readFileSync(normalizedPath);
		const fileName = path.basename(normalizedPath);
		const mimeType = getMimeType(normalizedPath);

		return new Response(fileBuffer, {
			headers: {
				'Content-Type': mimeType,
				'Content-Disposition': `inline; filename="${fileName}"`,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err) {
		// Don't mask expected 4xx errors as 500s
		if (isHttpError(err)) throw err;

		console.error('Error serving file:', err);
		console.error('Requested path:', relativePath);
		console.error('Full file path:', filePath);
		error(500, 'Error serving file');
	}
}
