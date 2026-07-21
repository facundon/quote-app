# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Invoice/quote management system for a medical laboratory (Laboratorio Yunes), deployed on-prem on Windows. **The UI is in Spanish** — user-facing strings, toasts, and error messages should be written in Spanish to match. SvelteKit 5 (runes) + Drizzle ORM + better-sqlite3, styled with Tailwind 4.

## Commands

```bash
npm run dev          # dev server (Vite)
npm run build        # production build (adapter-node → build/)
npm run check        # svelte-check type checking (run before considering work done)
npm run lint         # prettier --check + eslint
npm run format       # prettier --write

npm run db:push      # push schema to DB (dev)
npm run db:generate  # generate a migration from schema changes
npm run db:migrate   # apply migrations (prod)
npm run db:studio    # Drizzle Studio
```

There is **no test suite**. Verify changes via `npm run check` and by exercising the flow in `npm run dev`.

## Architecture

**Svelte 5 + SvelteKit 2 only.** Use runes (`$state`, `$derived`, `$props`, `$effect`) and callback props, not Svelte 4 idioms (`export let`, `on:click`, `$:`, `createEventDispatcher`). See `.cursor/rules/svelte5.mdc` for the full migration reference.

**Routes** follow a consistent pattern: each feature route (`invoices`, `tickets`, `news`, `presupuesto`, `instructions`, `admin`) has a `+page.server.ts` (load + form actions against Drizzle) and a `+page.svelte` that composes local `components/`. Server-only code lives under `$lib/server/`.

**Database** (`src/lib/server/db/`): Drizzle schema in `schema.ts` (single source of truth, exports `Infer*Model` types used across the app). Connection in `index.ts` resolves the SQLite path by environment:
- Windows prod: `%APPDATA%\Presupuestador\presupuestos.db` (kept outside the app folder so updates don't lose data)
- If cwd is `current/` (atomic-deploy layout): DB in the parent dir
- Otherwise: `DATABASE_URL` or `./local.db`

Migrations run lazily on the first request via `runMigrationsOnce()` in `hooks.server.ts` — not at build time. When changing the schema, generate a migration (`db:generate`); the running server applies it automatically.

**AI quote pipeline** (`src/lib/server/chat/`): `POST /api/chat` → `processConversation` → 3-stage agent pipeline in `agents/pipeline.ts`:
1. **Extraction** — pull study names/quantities from free text or an image (Gemini `gemini-2.5-flash`, structured JSON output)
2. **Mapping** — match extracted names to catalog entries (`category`/`study` tables)
3. **Quote** — compute totals, applying quantity-based `discount` rules per category

Requires `GEMINI_API_KEY`. Each agent is a lazily-instantiated singleton (`get*Agent()`); prompts live in `chat/prompts/`.

**File uploads**: invoice PDFs and payment receipts are stored under `facturas/` (see `invoices/storage.ts`), bulletin images under `boletines/` (`boletines/storage.ts`). These are served through catch-all routes `routes/facturas/[...path]` and `routes/boletines/[...path]`, and persist across updates.

**Self-update system** (`src/lib/server/update/`): the running app checks GitHub Releases (`UPDATE_MANIFEST_URL`), downloads/extracts a new version into an atomic `current/` + `releases/` + `previous-*` folder layout, and restarts via PM2 (`PM2_APP_NAME` must match the ecosystem config). `UpdateBanner.svelte` drives the client side. Startup cleanup of old versions/zips runs from `hooks.server.ts`.

**Auth**: currently a client-side-only store (`src/lib/stores/auth.ts`) with a hardcoded password. There is no server-side session/authorization — treat any endpoint as unauthenticated. Flag this if adding anything sensitive.

## Releasing / deploying

`npm run deploy [major|minor|patch|X.Y.Z] [--no-push] [--dry-run]` (`scripts/deploy.mjs`): requires a clean working tree and a filled-in `RELEASE_NOTES.md` (fails if empty or still contains the placeholder). It bumps `package.json` + lockfile, commits `chore(release): vX.Y.Z`, tags, and pushes. The app version is injected at build time as `__APP_VERSION__` (exposed via `src/lib/version.ts`). CI/GitHub Actions builds the release artifacts consumed by the self-updater.

Production runs under PM2 via `ecosystem.config.cjs`. `instances: 1` is required (SQLite).
