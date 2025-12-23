import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findAppRoot } from '$lib/server/update/appRoot';

function safeAppend(filePath: string, line: string): void {
	try {
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		fs.appendFileSync(filePath, line, 'utf8');
	} catch {
		// Never crash the app due to logging.
	}
}

function getLogPath(): string | null {
	try {
		const startDir = path.dirname(fileURLToPath(import.meta.url));
		const appRoot = findAppRoot(startDir);
		// Prefer logs inside the active version folder (e.g. `.../current/logs/server.log`)
		// so each version keeps its own runtime logs.
		return path.join(appRoot, 'logs', 'server.log');
	} catch {
		return null;
	}
}

function formatLine(kind: string, payload: Record<string, unknown>): string {
	return JSON.stringify({ ts: new Date().toISOString(), kind, ...payload }) + '\n';
}

let initialized = false;

export function initRuntimeLogging(): void {
	if (initialized) return;
	initialized = true;

	const logPath = getLogPath();
	if (!logPath) return;

	process.on('uncaughtException', (err) => {
		safeAppend(
			logPath,
			formatLine('uncaughtException', {
				message: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined
			})
		);
	});

	process.on('unhandledRejection', (reason) => {
		safeAppend(
			logPath,
			formatLine('unhandledRejection', {
				reason: reason instanceof Error ? reason.message : String(reason),
				stack: reason instanceof Error ? reason.stack : undefined
			})
		);
	});
}

export function logHandledError(payload: Record<string, unknown>): void {
	const logPath = getLogPath();
	if (!logPath) return;
	safeAppend(logPath, formatLine('handleError', payload));
}
