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

	fs.writeFileSync(
		lockPath,
		JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2),
		{ encoding: 'utf8', flag: 'wx' }
	);

	const release = () => {
		try {
			fs.unlinkSync(lockPath);
		} catch {
			console.error('Error removing lock file:', lockPath);
		}
	};

	return { path: lockPath, release };
}
