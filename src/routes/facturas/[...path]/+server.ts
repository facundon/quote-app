import { error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

export async function GET({ params }) {
	// Handle path parameter - it might be an array or string
	const pathSegments = Array.isArray(params.path) ? params.path : [params.path];
	const relativePath = pathSegments.join('/');
	const filePath = path.join(process.cwd(), 'facturas', relativePath);

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

		return new Response(fileBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `inline; filename="${fileName}"`,
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err) {
		console.error('Error serving PDF:', err);
		console.error('Requested path:', relativePath);
		console.error('Full file path:', filePath);
		error(500, 'Error serving file');
	}
}
