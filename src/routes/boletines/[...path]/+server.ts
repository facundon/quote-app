import { error } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import type { RequestHandler } from '@sveltejs/kit';
import {
	getBoletinesDir,
	isInsideDir,
	resolveBoletinesFileFromUrlRelativePath
} from '$lib/server/boletines/storage';

const MIME_TYPES: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp'
};

export const GET: RequestHandler = async ({ params }) => {
	const filePath = params.path;

	if (!filePath) {
		throw error(404, 'Not Found');
	}

	try {
		const baseDir = getBoletinesDir();
		const { fullPath } = resolveBoletinesFileFromUrlRelativePath(filePath);

		// Security check: prevent path traversal
		if (!isInsideDir(baseDir, fullPath)) {
			throw error(403, 'Forbidden');
		}

		// Check if file exists
		if (!fs.existsSync(fullPath)) {
			throw error(404, 'Not Found');
		}

		// Get file extension and MIME type
		const ext = path.extname(fullPath).toLowerCase();
		const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

		// Read file
		const fileBuffer = fs.readFileSync(fullPath);

		return new Response(fileBuffer, {
			status: 200,
			headers: {
				'Content-Type': mimeType,
				'Content-Disposition': 'inline',
				'Cache-Control': 'public, max-age=3600',
				'Content-Length': fileBuffer.length.toString()
			}
		});
	} catch (err) {
		if (err instanceof Error) {
			console.error('Error serving bulletin image:', err);
		}
		throw error(500, 'Internal Server Error');
	}
};
