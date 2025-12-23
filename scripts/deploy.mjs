import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * @typedef {{ major: number, minor: number, patch: number }} Semver
 */

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isRecord(v) {
	return typeof v === 'object' && v !== null;
}

/**
 * @param {string} raw
 * @returns {'\t' | '  '}
 */
function detectIndent(raw) {
	return raw.includes('\n\t"') ? '\t' : '  ';
}

/**
 * @param {string} value
 * @returns {Semver | null}
 */
function parseSemver(value) {
	const m = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
	if (!m) return null;
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * @param {Semver} v
 * @returns {string}
 */
function formatSemver(v) {
	return `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * @param {Semver} v
 * @param {'major'|'minor'|'patch'} bump
 * @returns {Semver}
 */
function bumpSemver(v, bump) {
	if (bump === 'major') return { major: v.major + 1, minor: 0, patch: 0 };
	if (bump === 'minor') return { major: v.major, minor: v.minor + 1, patch: 0 };
	return { major: v.major, minor: v.minor, patch: v.patch + 1 };
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, stdio?: 'inherit'|'pipe' }} [opts]
 * @returns {string}
 */
function run(cmd, args, opts) {
	const res = spawnSync(cmd, args, {
		cwd: opts?.cwd,
		stdio: opts?.stdio ?? 'inherit',
		encoding: 'utf8'
	});
	if (res.error) throw res.error;
	if (res.status !== 0) throw new Error(`${cmd} failed (${res.status ?? 'null'})`);
	return typeof res.stdout === 'string' ? res.stdout : '';
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function readFileStrict(filePath) {
	if (!fs.existsSync(filePath)) throw new Error(`Missing required file: ${filePath}`);
	return fs.readFileSync(filePath, 'utf8');
}

/**
 * @param {string} notesRaw
 */
function assertReleaseNotes(notesRaw) {
	const trimmed = notesRaw.trim();
	if (!trimmed) throw new Error('RELEASE_NOTES.md is empty. Write release notes before deploying.');
	if (trimmed.includes('[[WRITE_RELEASE_NOTES_HERE]]')) {
		throw new Error(
			'RELEASE_NOTES.md still contains [[WRITE_RELEASE_NOTES_HERE]]. Replace it with real release notes.'
		);
	}
}

/**
 * @returns {{ bump: 'major'|'minor'|'patch'|null, explicit: string|null, noPush: boolean, dryRun: boolean }}
 */
function parseArgs() {
	const args = process.argv.slice(2);
	const noPush = args.includes('--no-push');
	const dryRun = args.includes('--dry-run');

	const filtered = args.filter((a) => a !== '--no-push' && a !== '--dry-run');
	const mode = filtered[0] ?? 'patch';

	if (mode === 'major' || mode === 'minor' || mode === 'patch') {
		return { bump: mode, explicit: null, noPush, dryRun };
	}

	const parsed = parseSemver(mode);
	if (parsed) return { bump: null, explicit: formatSemver(parsed), noPush, dryRun };

	throw new Error(`Unknown version argument "${mode}". Use major|minor|patch or X.Y.Z`);
}

function main() {
	const root = process.cwd();
	const pkgPath = path.join(root, 'package.json');
	const lockPath = path.join(root, 'package-lock.json');
	const notesPath = path.join(root, 'RELEASE_NOTES.md');

	// Require release notes before touching anything.
	const notesRaw = readFileStrict(notesPath);
	assertReleaseNotes(notesRaw);

	const { bump, explicit, noPush, dryRun } = parseArgs();

	// Ensure git is available and working tree is clean before we start.
	run('git', ['--version'], { stdio: 'pipe' });
	const porcelain = run('git', ['status', '--porcelain'], { stdio: 'pipe' }).trim();
	if (porcelain)
		throw new Error('Working tree is not clean. Commit or stash changes before deploying.');

	const pkgRaw = readFileStrict(pkgPath);
	const pkgIndent = detectIndent(pkgRaw);
	const pkgJson = /** @type {unknown} */ (JSON.parse(pkgRaw));
	if (!isRecord(pkgJson) || typeof pkgJson.version !== 'string') {
		throw new Error('package.json missing a valid "version"');
	}

	const current = parseSemver(pkgJson.version);
	if (!current) throw new Error(`package.json version is not semver: ${pkgJson.version}`);

	const next = explicit ?? formatSemver(bumpSemver(current, bump ?? 'patch'));
	pkgJson.version = next;

	const tag = `v${next}`;
	const commitMsg = `chore(release): ${tag}`;

	if (!dryRun) {
		fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, pkgIndent) + '\n', 'utf8');

		if (fs.existsSync(lockPath)) {
			const lockRaw = readFileStrict(lockPath);
			const lockIndent = detectIndent(lockRaw);
			const lockJson = /** @type {unknown} */ (JSON.parse(lockRaw));
			if (isRecord(lockJson)) {
				lockJson.version = next;
				const packages = lockJson.packages;
				if (isRecord(packages) && isRecord(packages[''])) {
					packages[''].version = next;
				}
				fs.writeFileSync(lockPath, JSON.stringify(lockJson, null, lockIndent) + '\n', 'utf8');
			}
		}

		// Stage + commit + tag. Include RELEASE_NOTES.md in the commit.
		run('git', ['add', 'package.json', 'package-lock.json', 'RELEASE_NOTES.md'], {
			stdio: 'inherit'
		});
		run('git', ['commit', '-m', commitMsg], { stdio: 'inherit' });
		run('git', ['tag', '-a', tag, '-m', tag], { stdio: 'inherit' });

		if (!noPush) {
			run('git', ['push'], { stdio: 'inherit' });
			run('git', ['push', '--follow-tags'], { stdio: 'inherit' });
		}
	}

	console.log(
		[
			`Next version: ${next}`,
			`Tag: ${tag}`,
			noPush ? 'Push: skipped (--no-push)' : 'Push: enabled',
			dryRun ? 'Dry run: enabled (--dry-run)' : 'Dry run: disabled'
		].join('\n')
	);
}

main();
