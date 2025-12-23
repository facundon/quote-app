# Quote App - Laboratorio Yunes

A comprehensive invoice management system for medical laboratories, built with SvelteKit 5 and Drizzle ORM.

## Features

- **Invoice Management**: Upload, track, and manage invoices with PDF support
- **Provider Management**: Manage provider information and contact details
- **Payment Tracking**: Track payment status and upload payment receipts
- **Email Notifications**: Automatically send invoice PDFs to providers via email
- **Quote Generation**: Generate quotes for medical studies with discount calculations

## Email Configuration

To enable email functionality for sending invoice PDFs to providers, you need to configure the following environment variables:

```bash
# Email Configuration
# For Gmail, you can use:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password

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
```

## Database

```bash
# Push schema changes
npm run db:push

# Run migrations
npm run db:migrate

# Open database studio
npm run db:studio
```

## Self-updates (Windows)

This app supports **in-app updates** from **GitHub Releases**.

### Environment variable

Set `UPDATE_MANIFEST_URL` to your Releases manifest, typically:

- `https://github.com/<owner>/<repo>/releases/latest/download/update-manifest.json`

### Windows install layout (atomic)

Run the server from a `current/` folder so the updater can atomically swap versions:

- `app/current/` (active runtime; run `node build/index.js` from here)
- `app/releases/<version>/` (staging area for new downloads)
- `app/.updates/` (downloaded zips + updater script)
