import fs from 'node:fs';
import path from 'node:path';

export interface FileLock {
	path: string;
	release: () => void;
}

function ensureDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

export function acquireFileLock(lockPath: string): FileLock {
	ensureDir(path.dirname(lockPath));

	const fd = fs.openSync(lockPath, 'wx');
	fs.writeFileSync(
		fd,
		JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2),
		'utf8'
	);

	const release = () => {
		try {
			fs.closeSync(fd);
		} catch {
			console.error('Error closing lock file:', lockPath);
		}
		try {
			fs.unlinkSync(lockPath);
		} catch {
			console.error('Error removing lock file:', lockPath);
		}
	};

	return { path: lockPath, release };
}
