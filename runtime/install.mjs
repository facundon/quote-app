#!/usr/bin/env node

/**
 * Quote App - First-Time Installation Script
 *
 * This script sets up a fresh installation of the Quote App on a Windows server.
 * It creates the folder structure, installs dependencies, and configures PM2.
 *
 * Prerequisites:
 *   - Node.js 18+
 *   - PM2 installed globally (npm install -g pm2)
 *
 * Usage:
 *   1. Extract the release package to a temporary folder
 *   2. Run: node runtime/install.mjs
 *   3. Follow the prompts
 *
 * Or with arguments:
 *   node runtime/install.mjs --target "C:\Apps\QuoteApp" --name "quote-app"
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Configuration
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCE_DIR = path.dirname(__dirname); // Parent of runtime/

const DEFAULT_INSTALL_PATH = process.platform === 'win32' ? 'C:\\Apps\\QuoteApp' : '/opt/quote-app';

const DEFAULT_APP_NAME = 'quote-app';
const DEFAULT_PORT = 3000;

// =============================================================================
// Utilities
// =============================================================================

/**
 * Create readline interface for user input
 */
function createPrompt() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
}

/**
 * Ask user a question and return the answer
 * @param {readline.Interface} rl
 * @param {string} question
 * @param {string} defaultValue
 * @returns {Promise<string>}
 */
function ask(rl, question, defaultValue = '') {
	const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
	return new Promise((resolve) => {
		rl.question(prompt, (answer) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

/**
 * Ask yes/no question
 * @param {readline.Interface} rl
 * @param {string} question
 * @param {boolean} defaultValue
 * @returns {Promise<boolean>}
 */
async function askYesNo(rl, question, defaultValue = true) {
	const hint = defaultValue ? '[Y/n]' : '[y/N]';
	const answer = await ask(rl, `${question} ${hint}`, '');
	if (!answer) return defaultValue;
	return answer.toLowerCase().startsWith('y');
}

/**
 * Print a colored message
 * @param {string} message
 * @param {'info' | 'success' | 'error' | 'warn'} type
 */
function log(message, type = 'info') {
	const colors = {
		info: '\x1b[36m', // cyan
		success: '\x1b[32m', // green
		error: '\x1b[31m', // red
		warn: '\x1b[33m' // yellow
	};
	const reset = '\x1b[0m';
	const prefix = {
		info: 'ℹ',
		success: '✓',
		error: '✗',
		warn: '⚠'
	};
	console.log(`${colors[type]}${prefix[type]}${reset} ${message}`);
}

/**
 * Print a section header
 * @param {string} title
 */
function section(title) {
	console.log('');
	console.log(`\x1b[1m${'='.repeat(60)}\x1b[0m`);
	console.log(`\x1b[1m  ${title}\x1b[0m`);
	console.log(`\x1b[1m${'='.repeat(60)}\x1b[0m`);
	console.log('');
}

/**
 * Run a command and return success/failure
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} options
 * @returns {{ success: boolean, output: string }}
 */
function run(cmd, args, options = {}) {
	const result = spawnSync(cmd, args, {
		encoding: 'utf8',
		stdio: options.silent ? 'pipe' : 'inherit',
		cwd: options.cwd,
		shell: process.platform === 'win32',
		windowsHide: true
	});

	return {
		success: result.status === 0,
		output: (result.stdout || '') + (result.stderr || '')
	};
}

/**
 * Check if a command exists
 * @param {string} cmd
 * @returns {boolean}
 */
function commandExists(cmd) {
	const check = process.platform === 'win32' ? 'where' : 'which';
	const result = spawnSync(check, [cmd], {
		encoding: 'utf8',
		stdio: 'pipe',
		shell: process.platform === 'win32'
	});
	return result.status === 0;
}

/**
 * Copy directory recursively
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			// Skip node_modules - we'll install fresh
			if (entry.name === 'node_modules') continue;
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

// =============================================================================
// Installation Steps
// =============================================================================

/**
 * Check prerequisites
 * @returns {{ nodeOk: boolean, pm2Ok: boolean }}
 */
function checkPrerequisites() {
	section('Checking Prerequisites');

	// Check Node.js version
	const nodeVersion = process.version;
	const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
	const nodeOk = nodeMajor >= 18;

	if (nodeOk) {
		log(`Node.js ${nodeVersion} - OK`, 'success');
	} else {
		log(`Node.js ${nodeVersion} - Requires 18+`, 'error');
	}

	// Check PM2
	const pm2Ok = commandExists('pm2');
	if (pm2Ok) {
		log('PM2 - OK', 'success');
	} else {
		log('PM2 - Not found (install with: npm install -g pm2)', 'warn');
	}

	return { nodeOk, pm2Ok };
}

/**
 * Generate ecosystem.config.cjs content
 * @param {object} config
 * @returns {string}
 */
function generateEcosystemConfig(config) {
	return `/**
 * PM2 Ecosystem Configuration
 * Generated by install.mjs
 */
module.exports = {
  apps: [{
    name: '${config.appName}',
    cwd: './current',
    script: 'build/index.js',
    watch: false,
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: ${config.port},
      PM2_APP_NAME: '${config.appName}',
      UPDATE_MANIFEST_URL: '${config.updateUrl || ''}',
      SMTP_HOST: '${config.smtpHost || ''}',
      SMTP_PORT: '${config.smtpPort || '587'}',
      SMTP_SECURE: '${config.smtpSecure || 'false'}',
      SMTP_USER: '${config.smtpUser || ''}',
      SMTP_PASS: '${config.smtpPass || ''}'
    }
  }]
};
`;
}

/**
 * Parse command line arguments
 * @returns {object}
 */
function parseArgs() {
	const args = process.argv.slice(2);
	const result = {};

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--target' && args[i + 1]) {
			result.target = args[++i];
		} else if (args[i] === '--name' && args[i + 1]) {
			result.name = args[++i];
		} else if (args[i] === '--port' && args[i + 1]) {
			result.port = parseInt(args[++i], 10);
		} else if (args[i] === '--yes' || args[i] === '-y') {
			result.yes = true;
		} else if (args[i] === '--help' || args[i] === '-h') {
			result.help = true;
		}
	}

	return result;
}

/**
 * Print help message
 */
function printHelp() {
	console.log(`
Quote App Installer

Usage:
  node runtime/install.mjs [options]

Options:
  --target <path>   Installation directory (default: ${DEFAULT_INSTALL_PATH})
  --name <name>     PM2 app name (default: ${DEFAULT_APP_NAME})
  --port <port>     Server port (default: ${DEFAULT_PORT})
  -y, --yes         Skip confirmation prompts
  -h, --help        Show this help message

Examples:
  node runtime/install.mjs
  node runtime/install.mjs --target "C:\\Apps\\QuoteApp" --name "quote-app"
  node runtime/install.mjs -y
`);
}

// =============================================================================
// Main Installation Flow
// =============================================================================

async function main() {
	console.log('');
	console.log('\x1b[1m╔════════════════════════════════════════════════════════════╗\x1b[0m');
	console.log('\x1b[1m║           Quote App - Installation Wizard                  ║\x1b[0m');
	console.log('\x1b[1m╚════════════════════════════════════════════════════════════╝\x1b[0m');
	console.log('');

	const cliArgs = parseArgs();

	if (cliArgs.help) {
		printHelp();
		process.exit(0);
	}

	// Check prerequisites
	const { nodeOk, pm2Ok } = checkPrerequisites();

	if (!nodeOk) {
		log('Please install Node.js 18 or higher and try again.', 'error');
		process.exit(1);
	}

	if (!pm2Ok) {
		log('PM2 is recommended for production. Install with: npm install -g pm2', 'warn');
	}

	const rl = createPrompt();

	try {
		// -------------------------------------------------------------------------
		// Gather configuration
		// -------------------------------------------------------------------------

		section('Installation Configuration');

		const installPath =
			cliArgs.target || (await ask(rl, 'Installation directory', DEFAULT_INSTALL_PATH));
		const appName = cliArgs.name || (await ask(rl, 'PM2 app name', DEFAULT_APP_NAME));
		const port = cliArgs.port || parseInt(await ask(rl, 'Server port', String(DEFAULT_PORT)), 10);

		const currentDir = path.join(installPath, 'current');

		// Check if already installed
		if (fs.existsSync(currentDir)) {
			const overwrite =
				cliArgs.yes || (await askYesNo(rl, 'Installation exists. Overwrite?', false));
			if (!overwrite) {
				log('Installation cancelled.', 'warn');
				process.exit(0);
			}
		}

		// -------------------------------------------------------------------------
		// Email configuration (optional)
		// -------------------------------------------------------------------------

		section('Email Configuration (Optional)');

		let emailConfig = {};
		const configureEmail = cliArgs.yes
			? false
			: await askYesNo(rl, 'Configure email settings now?', false);

		if (configureEmail) {
			emailConfig = {
				smtpHost: await ask(rl, 'SMTP Host', 'smtp.gmail.com'),
				smtpPort: await ask(rl, 'SMTP Port', '587'),
				smtpSecure: await ask(rl, 'SMTP Secure (true/false)', 'false'),
				smtpUser: await ask(rl, 'SMTP User (email)', ''),
				smtpPass: await ask(rl, 'SMTP Password (app password)', '')
			};
		} else {
			log('Email can be configured later in ecosystem.config.cjs', 'info');
		}

		// -------------------------------------------------------------------------
		// Update URL configuration
		// -------------------------------------------------------------------------

		section('Self-Update Configuration');

		const updateUrl = await ask(rl, 'Update manifest URL (leave empty to disable)', '');

		// -------------------------------------------------------------------------
		// Confirm installation
		// -------------------------------------------------------------------------

		section('Installation Summary');

		console.log(`  Install path:  ${installPath}`);
		console.log(`  Current dir:   ${currentDir}`);
		console.log(`  App name:      ${appName}`);
		console.log(`  Port:          ${port}`);
		console.log(`  Update URL:    ${updateUrl || '(disabled)'}`);
		console.log(`  Email:         ${emailConfig.smtpUser || '(not configured)'}`);
		console.log('');

		const proceed = cliArgs.yes || (await askYesNo(rl, 'Proceed with installation?', true));

		if (!proceed) {
			log('Installation cancelled.', 'warn');
			process.exit(0);
		}

		// -------------------------------------------------------------------------
		// Create directory structure
		// -------------------------------------------------------------------------

		section('Creating Directory Structure');

		fs.mkdirSync(installPath, { recursive: true });
		fs.mkdirSync(currentDir, { recursive: true });
		log(`Created: ${installPath}`, 'success');

		// -------------------------------------------------------------------------
		// Copy application files
		// -------------------------------------------------------------------------

		section('Copying Application Files');

		// Copy build/
		const buildSrc = path.join(SOURCE_DIR, 'build');
		const buildDest = path.join(currentDir, 'build');
		if (fs.existsSync(buildSrc)) {
			log('Copying build/ ...', 'info');
			copyDir(buildSrc, buildDest);
			log('Copied build/', 'success');
		} else {
			log('build/ not found - run "npm run build" first', 'error');
			process.exit(1);
		}

		// Copy runtime/
		const runtimeSrc = path.join(SOURCE_DIR, 'runtime');
		const runtimeDest = path.join(currentDir, 'runtime');
		if (fs.existsSync(runtimeSrc)) {
			log('Copying runtime/ ...', 'info');
			copyDir(runtimeSrc, runtimeDest);
			log('Copied runtime/', 'success');
		}

		// Copy drizzle/
		const drizzleSrc = path.join(SOURCE_DIR, 'drizzle');
		const drizzleDest = path.join(currentDir, 'drizzle');
		if (fs.existsSync(drizzleSrc)) {
			log('Copying drizzle/ ...', 'info');
			copyDir(drizzleSrc, drizzleDest);
			log('Copied drizzle/', 'success');
		}

		// Copy package files
		for (const file of ['package.json', 'package-lock.json']) {
			const src = path.join(SOURCE_DIR, file);
			const dest = path.join(currentDir, file);
			if (fs.existsSync(src)) {
				fs.copyFileSync(src, dest);
				log(`Copied ${file}`, 'success');
			}
		}

		// -------------------------------------------------------------------------
		// Generate ecosystem config
		// -------------------------------------------------------------------------

		section('Generating PM2 Configuration');

		const ecosystemPath = path.join(installPath, 'ecosystem.config.cjs');
		const ecosystemContent = generateEcosystemConfig({
			appName,
			port,
			updateUrl,
			...emailConfig
		});

		fs.writeFileSync(ecosystemPath, ecosystemContent, 'utf8');
		log(`Created: ecosystem.config.cjs`, 'success');

		// -------------------------------------------------------------------------
		// Install dependencies
		// -------------------------------------------------------------------------

		section('Installing Dependencies');

		log('Running npm ci --omit=dev (this may take a minute)...', 'info');
		const npmResult = run('npm', ['ci', '--omit=dev'], { cwd: currentDir });

		if (!npmResult.success) {
			log('npm install failed. Please run manually: npm ci --omit=dev', 'error');
		} else {
			log('Dependencies installed', 'success');
		}

		// -------------------------------------------------------------------------
		// Run migrations
		// -------------------------------------------------------------------------

		section('Database Setup');

		log('Running database migrations...', 'info');
		const migrateResult = run('npm', ['run', 'db:migrate'], { cwd: currentDir, silent: true });

		if (!migrateResult.success) {
			log('Migration may have failed. Check database manually if needed.', 'warn');
		} else {
			log('Database migrations complete', 'success');
		}

		// -------------------------------------------------------------------------
		// Start with PM2
		// -------------------------------------------------------------------------

		if (pm2Ok) {
			section('Starting Application');

			const startWithPm2 = cliArgs.yes || (await askYesNo(rl, 'Start the app with PM2 now?', true));

			if (startWithPm2) {
				log('Starting with PM2...', 'info');
				const pm2Result = run('pm2', ['start', 'ecosystem.config.cjs'], { cwd: installPath });

				if (pm2Result.success) {
					log(`App started! Access at http://localhost:${port}`, 'success');

					const savePm2 =
						cliArgs.yes || (await askYesNo(rl, 'Save PM2 process list (for auto-restart)?', true));
					if (savePm2) {
						run('pm2', ['save'], { cwd: installPath });
						log('PM2 process list saved', 'success');
						log('Run "pm2 startup" to enable auto-start on boot', 'info');
					}
				} else {
					log('PM2 start failed. Try manually: pm2 start ecosystem.config.cjs', 'error');
				}
			}
		}

		// -------------------------------------------------------------------------
		// Complete
		// -------------------------------------------------------------------------

		section('Installation Complete!');

		console.log('  Next steps:');
		console.log('');
		console.log(`  1. Access the app at: http://localhost:${port}`);
		console.log('');
		console.log('  2. To enable auto-start on boot:');
		console.log('     pm2 startup');
		console.log('     (follow the instructions it outputs)');
		console.log('');
		console.log('  3. View logs:');
		console.log(`     pm2 logs ${appName}`);
		console.log('');
		console.log('  4. Configuration file:');
		console.log(`     ${ecosystemPath}`);
		console.log('');

		log('Installation successful!', 'success');
	} finally {
		rl.close();
	}
}

// =============================================================================
// Entry Point
// =============================================================================

main().catch((e) => {
	console.error('');
	log(`Installation failed: ${e.message}`, 'error');
	console.error(e);
	process.exit(1);
});
