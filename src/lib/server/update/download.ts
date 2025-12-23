import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import fsp from 'node:fs/promises';

function ensureDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

export async function downloadToFile(url: string, targetFile: string): Promise<void> {
	ensureDir(path.dirname(targetFile));

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Download failed: ${res.status} ${res.statusText}`);
	}

	const tmpFile = `${targetFile}.tmp`;
	const buf = Buffer.from(await res.arrayBuffer());
	await fsp.writeFile(tmpFile, buf);

	fs.renameSync(tmpFile, targetFile);
}

export async function sha256File(filePath: string): Promise<string> {
	return await new Promise<string>((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const s = fs.createReadStream(filePath);
		s.on('error', reject);
		s.on('data', (buf) => hash.update(buf));
		s.on('end', () => resolve(hash.digest('hex')));
	});
}
