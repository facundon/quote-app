# Quote App - Laboratorio Yunes

A comprehensive invoice management system for medical laboratories, built with SvelteKit 5 and Drizzle ORM.

## Features

- **Invoice Management**: Upload, track, and manage invoices with PDF support
- **Provider Management**: Manage provider information and contact details
- **Payment Tracking**: Track payment status and upload payment receipts
- **Email Notifications**: Automatically send invoice PDFs to providers via email
- **Quote Generation**: Generate quotes for medical studies with discount calculations
- **Self-Updates**: In-app updates from GitHub Releases (Windows)

---

## Installation (Administrators)

### Prerequisites

- **Node.js** 18 or higher

### Folder Structure (Windows Production)

The app uses an atomic folder layout that enables seamless in-app updates. Here's the complete structure after deployment:

```
C:\Apps\QuoteApp\
│
├── ecosystem.config.cjs              ← PM2 configuration
│
├── current/                          ← Active server (run from here)
│   ├── build/                        ← Compiled SvelteKit app
│   │   ├── client/                   ← Static assets (JS, CSS)
│   │   ├── server/                   ← Server-side code
│   │   └── index.js                  ← Entry point
│   ├── runtime/                      ← Runtime scripts (shipped with release)
│   │   ├── install.mjs               ← First-time installation wizard
│   │   └── updater.mjs               ← Self-update script
│   ├── drizzle/                      ← Database migrations
│   ├── node_modules/                 ← Production dependencies
│   ├── logs/                         ← Server logs (created at runtime)
│   │   └── server.log
│   ├── facturas/                     ← Uploaded invoice files (created at runtime)
│   ├── package.json
│   ├── package-lock.json
│   └── .env                          ← Environment variables (optional with PM2)
│
├── releases/                         ← Staging area for new versions (auto-created)
│   └── 1.2.0/                        ← Downloaded update ready to install
│
├── .updates/                         ← Update system files (auto-created)
│   ├── updater.mjs                   ← Copy of update script (runs from here)
│   └── 1.2.0.zip                     ← Downloaded release package
│
└── previous-1.1.0-2025-01-07/        ← Backup of previous version (auto-created)
```

> **Note**: The `releases/`, `.updates/`, and `previous-*` folders are created automatically by the update system. You only need to set up `current/` for the initial deployment.

### Quick Install (Recommended)

Use the installation wizard for a guided setup:

1. **Build the application** (on your development machine):

   ```bash
   npm install
   npm run build
   ```

2. **Copy the entire project folder to the server** (temporary location)

3. **Run the installer**:

   ```bash
   node runtime/install.mjs
   ```

   The installer will:
   - Create the folder structure
   - Copy application files to `current/`
   - Generate PM2 configuration
   - Install production dependencies
   - Run database migrations
   - Start the app with PM2

   **Command-line options:**

   ```bash
   # Non-interactive installation
   node runtime/install.mjs --target "C:\Apps\QuoteApp" --name "quote-app" --port 3000 -y

   # Show help
   node runtime/install.mjs --help
   ```

### Manual Deployment

If you prefer manual setup:

1. **Build the application** (on your development machine):

   ```bash
   npm install
   npm run build
   ```

2. **Copy files to the server**:

   Copy the following to `C:\Apps\QuoteApp\current\`:
   - `build/` folder
   - `runtime/` folder (contains updater.mjs, install.mjs)
   - `drizzle/` folder (migrations)
   - `package.json`
   - `package-lock.json`

   Copy to `C:\Apps\QuoteApp\` (parent directory):
   - `ecosystem.config.cjs` (PM2 configuration - edit settings first)

3. **Install production dependencies** on the server:

   ```bash
   cd C:\Apps\QuoteApp\current
   npm ci --omit=dev
   ```

4. **Configure environment variables**:

   Create a `.env` file in `current/` or set system environment variables:

   ```bash
   # Required for self-updates
   UPDATE_MANIFEST_URL=https://github.com/<owner>/<repo>/releases/latest/download/update-manifest.json

   # PM2 app name (required if running with PM2)
   PM2_APP_NAME=quote-app

   # Email Configuration (optional, for sending invoices)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password

   # Production mode
   NODE_ENV=production
   ```

5. **Run database migrations**:

   ```bash
   npm run db:migrate
   ```

6. **Start the server**:

   ```bash
   node build/index.js
   ```

   The server runs on port 3000 by default. Access it at `http://localhost:3000`.

### Database Location

- **Development**: `./local.db` (project root)
- **Windows Production**: `%APPDATA%\Presupuestador\presupuestos.db`

The production database is stored outside the app folder to preserve data across updates.

### Running with PM2 (Recommended)

[PM2](https://pm2.keymetrics.io/) is a production process manager that keeps your app running and handles restarts.

#### 1. Install PM2 globally

```bash
npm install -g pm2
```

#### 2. Create PM2 ecosystem file

Create `ecosystem.config.js` in `C:\Apps\QuoteApp\`:

```javascript
module.exports = {
	apps: [
		{
			name: 'quote-app',
			cwd: './current',
			script: 'build/index.js',
			env: {
				NODE_ENV: 'production',
				PM2_APP_NAME: 'quote-app',
				UPDATE_MANIFEST_URL:
					'https://github.com/<owner>/<repo>/releases/latest/download/update-manifest.json'
			}
		}
	]
};
```

#### 3. Start the app

```bash
cd C:\Apps\QuoteApp
pm2 start ecosystem.config.js
```

#### 4. Configure PM2 to start on boot

```bash
pm2 save
pm2 startup
```

Follow the instructions output by `pm2 startup` to enable auto-start.

#### PM2 Commands Reference

```bash
pm2 status              # View running apps
pm2 logs quote-app      # View logs
pm2 restart quote-app   # Restart the app
pm2 stop quote-app      # Stop the app
pm2 delete quote-app    # Remove from PM2
```

> **Important**: The `PM2_APP_NAME` environment variable must match the `name` in your ecosystem config. This enables the in-app updater to use PM2 for restarts.

### Alternative: Running without PM2

If you prefer not to use PM2, you can run the server directly:

```bash
cd C:\Apps\QuoteApp\current
node build/index.js
```

For auto-start without PM2, consider:

- [NSSM](https://nssm.cc/) - Non-Sucking Service Manager
- Windows Task Scheduler with "Run at startup"

---

## User Guide

### Checking for Updates

The app automatically checks for updates:

- On page load
- Every 30 minutes while the app is open
- When the browser tab becomes visible again

### Installing Updates

When an update is available, a blue banner appears at the top of the page showing:

- The new version number
- Your current version
- Release notes (what's new)

**To install an update:**

1. **Finish your current work** - save any pending changes
2. Click **"Actualizar ahora"** (Update now)
3. Wait for the download to complete
4. The app will restart automatically with the new version

> **Note**: Your data is preserved during updates. The database is stored separately from the application files.

### If an Update Fails

If an update fails to install:

- The app will continue running the current version
- An error message will appear
- Contact your system administrator

---

## Maintenance

### Log Files

Server logs are written to:

```
current/logs/server.log
```

Check this file for errors or debugging information.

### Backups

**Database backups are recommended.** The SQLite database is a single file:

- **Windows Production**: `%APPDATA%\Presupuestador\presupuestos.db`
- **Development**: `./local.db`

Copy this file periodically to a safe location.

### Manual Rollback

If an update causes issues, previous versions are preserved:

```
C:\Apps\QuoteApp\
├── current/                              ← Current (problematic) version
├── previous-1.0.5-2025-01-07T10-30-00/   ← Previous version
└── ...
```

To rollback manually:

1. Stop the server
2. Rename `current/` to something else (e.g., `broken/`)
3. Rename the `previous-*` folder to `current/`
4. Start the server

### Automatic Cleanup

The app automatically cleans up old files to prevent disk usage from growing indefinitely:

**After each successful update:**

- Downloaded zip files are deleted
- The releases staging folder is cleared
- Only the **2 most recent previous versions** are kept

**On server startup:**

- Zip files older than 7 days are removed
- Orphaned release folders are cleaned up
- Excess previous versions beyond 2 are deleted

### Manual Cleanup

If needed, you can safely delete these folders manually:

- `previous-*` folders (old versions) - keep at least 1-2 as backup
- `releases/` contents (staging downloads)
- `.updates/*.zip` files (downloaded packages)

---

## Email Configuration

To enable email functionality for sending invoice PDFs to providers, configure these environment variables:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Gmail Setup

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use the generated password as `SMTP_PASS`

---

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check
```

## Database Commands

```bash
# Push schema changes (development)
npm run db:push

# Run migrations (production)
npm run db:migrate

# Generate new migration
npm run db:generate

# Open database studio
npm run db:studio
```

## Deployment Script

To create a new release:

```bash
# Bump patch version (1.0.0 → 1.0.1)
npm run deploy

# Bump minor version (1.0.0 → 1.1.0)
npm run deploy minor

# Bump major version (1.0.0 → 2.0.0)
npm run deploy major

# Dry run (no changes)
npm run deploy --dry-run
```

The deploy script:

1. Validates `RELEASE_NOTES.md` is written
2. Bumps version in `package.json`
3. Creates a git commit and tag
4. Pushes to the repository

GitHub Actions (or your CI) should then build and publish the release.
