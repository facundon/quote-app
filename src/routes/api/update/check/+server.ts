import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UpdateCheckResponse } from '$lib/update/types';
import { updaterConfig } from '$lib/update/config';
import { findAppRoot } from '$lib/server/update/appRoot';
import { parseUpdateManifest, readCurrentVersion } from '$lib/server/update/manifest';
import { compareVersions } from '$lib/server/update/semver';

interface CachedManifest {
	manifest: ReturnType<typeof parseUpdateManifest>;
	fetchedAtMs: number;
}

const cache: CachedManifest = { manifest: null, fetchedAtMs: 0 };

async function fetchManifest(
	manifestUrl: string
): Promise<NonNullable<CachedManifest['manifest']>> {
	const now = Date.now();
	if (cache.manifest && now - cache.fetchedAtMs < updaterConfig.manifestCacheTtlMs) {
		return cache.manifest;
	}

	const res = await fetch(manifestUrl, { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new Error(`Manifest fetch failed: ${res.status} ${res.statusText}`);
	const raw: unknown = await res.json();
	const parsed = parseUpdateManifest(raw);
	if (!parsed) throw new Error('Invalid update-manifest.json schema');

	cache.manifest = parsed;
	cache.fetchedAtMs = now;
	return parsed;
}

export const GET: RequestHandler = async () => {
	const manifestUrl = process.env.UPDATE_MANIFEST_URL;
	if (!manifestUrl) {
		const body: UpdateCheckResponse = {
			updateAvailable: false,
			currentVersion: null,
			latestVersion: null,
			releasedAt: null,
			notes: null,
			error: 'UPDATE_MANIFEST_URL no está configurada'
		};
		return json(body);
	}

	const startDir = path.dirname(fileURLToPath(import.meta.url));
	const appRoot = findAppRoot(startDir);

	try {
		const [manifest, currentVersion] = await Promise.all([
			fetchManifest(manifestUrl),
			readCurrentVersion(appRoot)
		]);

		const updateAvailable =
			!!currentVersion && compareVersions(currentVersion, manifest.version) < 0;

		const body: UpdateCheckResponse = {
			updateAvailable,
			currentVersion,
			latestVersion: manifest.version,
			releasedAt: manifest.releasedAt,
			notes: manifest.notes
		};
		return json(body);
	} catch (e) {
		const body: UpdateCheckResponse = {
			updateAvailable: false,
			currentVersion: await readCurrentVersion(appRoot),
			latestVersion: null,
			releasedAt: null,
			notes: null,
			error: e instanceof Error ? e.message : 'Unknown error'
		};
		return json(body, { status: 200 });
	}
};
