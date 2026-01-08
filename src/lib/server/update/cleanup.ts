import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { updaterConfig } from '$lib/update/config';
import { findAppRoot } from './appRoot';
import { getUpdatePaths } from './paths';

const { keepPreviousVersions, maxZipAgeMs, startupDelayMs } = updaterConfig.cleanup;
const { current, previousPrefix } = updaterConfig.directories;

interface CleanupStats {
	zipsRemoved: number;
	releasesRemoved: number;
	previousVersionsRemoved: number;
}

function safeRmdir(dir: string): boolean {
	try {
		fs.rmSync(dir, { recursive: true, force: true });
		return true;
	} catch {
		return false;
	}
}

function safeUnlink(file: string): boolean {
	try {
		fs.unlinkSync(file);
		return true;
	} catch {
		return false;
	}
}

function cleanupOldZips(updatesDir: string): number {
	if (!fs.existsSync(updatesDir)) return 0;

	const now = Date.now();
	let removed = 0;

	const entries = fs.readdirSync(updatesDir);
	for (const name of entries) {
		if (!name.endsWith('.zip')) continue;

		const filePath = path.join(updatesDir, name);
		try {
			const stat = fs.statSync(filePath);
			// Remove zips older than maxZipAgeMs
			if (now - stat.mtimeMs > maxZipAgeMs) {
				if (safeUnlink(filePath)) {
					removed++;
				}
			}
		} catch {
			// File may have been removed already
		}
	}

	return removed;
}

function cleanupOrphanedReleases(releasesDir: string, currentDir: string): number {
	if (!fs.existsSync(releasesDir)) return 0;

	// Get current version to avoid deleting the active release
	let currentVersion: string | null = null;
	try {
		const pkgPath = path.join(currentDir, 'package.json');
		if (fs.existsSync(pkgPath)) {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
			currentVersion = pkg.version ?? null;
		}
	} catch {
		// Ignore errors reading current version
	}

	let removed = 0;
	const entries = fs.readdirSync(releasesDir, { withFileTypes: true });

	for (const e of entries) {
		if (!e.isDirectory() || e.name === currentVersion) continue;
		if (safeRmdir(path.join(releasesDir, e.name))) removed++;
	}

	return removed;
}

function cleanupOldPreviousVersions(installBase: string): number {
	if (!fs.existsSync(installBase)) return 0;

	const entries = fs.readdirSync(installBase, { withFileTypes: true });
	const prevDirs = entries
		.filter((e) => e.isDirectory() && e.name.startsWith(previousPrefix))
		.map((e) => {
			const dirPath = path.join(installBase, e.name);
			let mtime = 0;
			try {
				mtime = fs.statSync(dirPath).mtimeMs;
			} catch {
				// Use 0 if we can't stat
			}
			return { name: e.name, path: dirPath, mtime };
		})
		.sort((a, b) => b.mtime - a.mtime); // newest first

	// Keep only keepPreviousVersions, delete the rest
	const toDelete = prevDirs.slice(keepPreviousVersions);
	let removed = 0;

	for (const dir of toDelete) {
		if (safeRmdir(dir.path)) removed++;
	}

	return removed;
}

export function runStartupCleanup(): CleanupStats {
	const startDir = path.dirname(fileURLToPath(import.meta.url));
	const appRoot = findAppRoot(startDir);
	const paths = getUpdatePaths(appRoot);

	// Only run cleanup if we're in the expected atomic layout
	if (path.basename(appRoot).toLowerCase() !== current) {
		return { zipsRemoved: 0, releasesRemoved: 0, previousVersionsRemoved: 0 };
	}

	const stats: CleanupStats = {
		zipsRemoved: cleanupOldZips(paths.updatesDir),
		releasesRemoved: cleanupOrphanedReleases(paths.releasesDir, paths.currentDir),
		previousVersionsRemoved: cleanupOldPreviousVersions(paths.installBase)
	};

	return stats;
}

let cleanupRan = false;

export function runStartupCleanupOnce(): void {
	if (cleanupRan) return;
	cleanupRan = true;

	// Run cleanup async to avoid blocking startup
	setTimeout(() => {
		try {
			const stats = runStartupCleanup();
			const total = stats.zipsRemoved + stats.releasesRemoved + stats.previousVersionsRemoved;
			if (total > 0) {
				console.log(
					`[cleanup] Removed ${stats.zipsRemoved} zips, ${stats.releasesRemoved} releases, ${stats.previousVersionsRemoved} old versions`
				);
			}
		} catch (e) {
			console.error('[cleanup] Startup cleanup failed:', e);
		}
	}, startupDelayMs);
}
