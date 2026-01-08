import path from 'node:path';
import { updaterConfig } from '$lib/update/config';

const { updates, releases, current } = updaterConfig.directories;

export interface UpdatePaths {
	appRoot: string;
	installBase: string;
	updatesDir: string;
	releasesDir: string;
	currentDir: string;
}

export function getUpdatePaths(appRoot: string): UpdatePaths {
	const baseName = path.basename(appRoot).toLowerCase();
	const installBase = baseName === current ? path.dirname(appRoot) : appRoot;

	return {
		appRoot,
		installBase,
		updatesDir: path.join(installBase, updates),
		releasesDir: path.join(installBase, releases),
		currentDir: baseName === current ? appRoot : path.join(installBase, current)
	};
}
