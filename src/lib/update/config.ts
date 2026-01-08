/**
 * Centralized configuration for the auto-updater module.
 *
 * This is the single source of truth for all updater constants.
 * The standalone updater.mjs receives all config values via CLI arguments
 * passed by the install endpoint.
 */

export const updaterConfig = {
	/**
	 * Directory structure for atomic updates.
	 */
	directories: {
		/** Directory for temporary update files (.updates/) */
		updates: '.updates',
		/** Directory containing versioned releases */
		releases: 'releases',
		/** Symlink/directory pointing to the active release */
		current: 'current',
		/** Prefix for backup directories of previous versions */
		previousPrefix: 'previous-'
	},

	/**
	 * File names used by the updater.
	 */
	files: {
		/** Status file for tracking update progress */
		statusJson: 'status.json',
		/** Lock file to prevent concurrent updates */
		installLock: 'install.lock',
		/** Standalone updater script */
		updaterScript: 'updater.mjs'
	},

	/**
	 * Cleanup settings for old versions and temporary files.
	 */
	cleanup: {
		/** Number of previous versions to keep as backups */
		keepPreviousVersions: 2,
		/** Maximum age for downloaded zip files before cleanup (2 days) */
		maxZipAgeMs: 2 * 24 * 60 * 60 * 1000,
		/** Delay before running cleanup after server startup */
		startupDelayMs: 5000
	},

	/**
	 * PM2 process management settings.
	 */
	pm2: {
		/** Name for the temporary updater PM2 process */
		updaterProcessName: 'quote-app-updater',
		/** Timeout for PM2 commands */
		commandTimeoutMs: 30_000
	},

	/**
	 * Cache TTL for the update manifest.
	 */
	manifestCacheTtlMs: 60_000,

	/**
	 * Client-side polling settings (UpdateBanner).
	 */
	client: {
		/** Interval between automatic update checks */
		checkIntervalMs: 30 * 60 * 1000,
		/** Cooldown after focus before checking again */
		focusCooldownMs: 10_000,
		/** Interval for polling update status during installation */
		statusPollMs: 1_500,
		/** Maximum time to poll for update status */
		maxPollTimeMs: 120_000,
		/** Delay before reloading after successful update */
		reloadDelayMs: 1_500
	}
} as const;
