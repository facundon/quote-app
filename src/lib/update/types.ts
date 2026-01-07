export type IsoDateTimeString = string;

export interface UpdateManifest {
	/** Semver recommended (e.g. 1.2.3). */
	version: string;
	releasedAt: IsoDateTimeString;
	notes: string;
	assetName: string;
	assetUrl: string;
	assetSha256: string;
}

export interface UpdateCheckResponse {
	updateAvailable: boolean;
	currentVersion: string | null;
	latestVersion: string | null;
	releasedAt: IsoDateTimeString | null;
	notes: string | null;
	error?: string;
}

export interface UpdateInstallResponse {
	started: boolean;
	targetVersion: string | null;
	message: string;
	error?: string;
	errorDetails?: string;
}

export type UpdateInstallStep =
	| 'idle'
	| 'starting'
	| 'stopping'
	| 'stopped'
	| 'swapping'
	| 'swapped'
	| 'starting-server'
	| 'done'
	| 'error';

export interface UpdateStatus {
	version: string | null;
	step: UpdateInstallStep;
	updatedAt: IsoDateTimeString;
	message?: string;
	error?: string;
}

export interface UpdateStatusResponse {
	lockExists: boolean;
	lockPath: string | null;
	lockContents: string | null;
	status: UpdateStatus | null;
	statusPath: string | null;
	currentVersion: string | null;
}
