import fs from 'node:fs/promises';
import path from 'node:path';
import type { UpdateManifest } from '$lib/update/types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | null {
	const v = obj[key];
	return typeof v === 'string' && v.trim() !== '' ? v : null;
}

export function parseUpdateManifest(value: unknown): UpdateManifest | null {
	if (!isRecord(value)) return null;

	const version = getString(value, 'version');
	const releasedAt = getString(value, 'releasedAt');
	const notes = getString(value, 'notes') ?? '';
	const assetName = getString(value, 'assetName');
	const assetUrl = getString(value, 'assetUrl');
	const assetSha256 = getString(value, 'assetSha256');

	if (!version || !releasedAt || !assetName || !assetUrl || !assetSha256) return null;

	return { version, releasedAt, notes, assetName, assetUrl, assetSha256 };
}

export async function readCurrentVersion(appRoot: string): Promise<string | null> {
	try {
		const candidates = [
			path.join(appRoot, 'package.json'),
			path.join(appRoot, 'build', 'package.json')
		];

		for (const pkgPath of candidates) {
			try {
				const raw = await fs.readFile(pkgPath, 'utf8');
				const parsed: unknown = JSON.parse(raw);
				if (!isRecord(parsed)) continue;
				const v = getString(parsed, 'version');
				if (v) return v;
			} catch {
				// try next candidate
			}
		}

		return null;
	} catch {
		return null;
	}
}
