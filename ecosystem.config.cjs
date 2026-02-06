/**
 * PM2 Ecosystem Configuration
 *
 * This file configures PM2 to run the Quote App in production.
 * Copy this file to your install directory (e.g., C:\Apps\QuoteApp\)
 * and update the environment variables as needed.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 *
 * @see https://pm2.keymetrics.io/docs/usage/application-declaration/
 */
module.exports = {
	apps: [
		{
			// App name - must match PM2_APP_NAME env var for updates to work
			name: 'quote-app',

			// Working directory (the current/ folder)
			cwd: './current',

			// Entry point
			script: 'build/index.js',

			// Restart on file changes (disable in production)
			watch: false,

			// Number of instances (1 for SQLite compatibility)
			instances: 1,

			// Auto-restart on crash
			autorestart: true,

			// Max memory before restart (optional)
			max_memory_restart: '500M',

			// Environment variables
			env: {
				NODE_ENV: 'production',
				PORT: 3000,

				// Required: Must match the 'name' above for in-app updates
				PM2_APP_NAME: 'quote-app',

				// Required for self-updates
				UPDATE_MANIFEST_URL:
					'https://github.com/facundon/quote-app/releases/latest/download/update-manifest.json',

				// Email configuration (optional)
				SMTP_PORT: '587',
				SMTP_SECURE: 'false',
				SMTP_USER: 'your-email@gmail.com',
				SMTP_PASS: 'your-app-password',

				GEMINI_API_KEY: 'the key here'
			}
		}
	]
};
