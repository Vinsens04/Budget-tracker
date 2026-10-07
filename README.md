# Saldo

A mobile-first personal finance app, built with Next.js App Router, strict TypeScript, Tailwind CSS, Supabase/PostgreSQL, Recharts, Lucide and Motion. The Apple Design reference supplied with the brief guided the system typography, blue accent, rounded surfaces, touch feedback, sheets and reduced-motion behavior.

## Run locally

Requires Node.js 22 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. The project is already connected to your Supabase project through the ignored `.env.local`; its public key is safe to use in the browser. Never put a database password or Supabase secret key in a `NEXT_PUBLIC_` variable.

## Features

- Dashboard with balances derived from the actual wallet ledger, category distribution, budget progress and financial insights.
- Fast expense/income entry, `Starbucks 55k` parsing, category/wallet/date sheets, notes and private receipt uploads.
- Transaction details, editing, duplication, deletion, grouped history and search/date/category/wallet/amount filters.
- Monthly category budgets and threshold alerts; wallets with opening balances, archiving and internal transfers.
- Weekly/monthly/yearly charts, calendar, monthly report CSV and full JSON data export.
- Saving goals and contribution tracking. Contributions represent earmarked savings and do not move wallet funds.
- Weekly/monthly/yearly recurring schedules with idempotent catch-up. Supabase pg_cron processes due payments hourly at minute 5, using Jakarta dates.
- Email/password registration, login, reset-password flow, Google OAuth integration and logout.
- Light/dark/system themes, notification preferences, keyboard focus and reduced motion/transparency/contrast handling.

Signed-in accounts start empty and save to Supabase. Signed-out demo data is session-only and cannot mix with account data. Financial notifications are in-app; browser push and email delivery are not configured. Receipt extraction is intentionally manual for now; OCR/AI can be added later with a review step before saving.

## Supabase

The database migrations and private `receipts` bucket have already been applied to the supplied project. For another project:

1. Copy `.env.example` to `.env.local` and set the Supabase URL and public publishable/anon key.
2. Run `supabase/migrations/001_finance.sql`, then `002_recurring.sql` in the SQL editor.
3. Enable `pg_cron` and run the schedule statement at the end of migration 002.
4. Set **Authentication → URL Configuration** to your deployment URL, and allow `http://127.0.0.1:3000/**` and your deployment URL with `/**` for redirects.
5. Enable the **Google** provider with your Google OAuth client ID and secret. The Supabase callback URL goes in the Google console.

Email confirmation remains governed by your Supabase settings. Password reset and verification emails require a working Supabase email sender; configure SMTP for production delivery.

Rotate the database password and secret key supplied in chat. The app uses only the public key, so rotating either secret does not require changing browser configuration. Temporary setup credentials are removed after validation.

### Data architecture

`finance_workspaces` stores each user's typed ledger as a single PostgreSQL JSONB document. `save_finance_workspace` validates amounts and references, commits all linked changes atomically and compares a revision to prevent lost updates from another tab or the scheduler. Direct client writes are disabled. RLS allows users to read only their workspace.

Security-invoker relational views expose transactions, wallets, budgets, profiles, settings, goals, contributions, transfers and recurring schedules for querying and reporting without duplicating their source of truth. This intentionally differs from a table-per-entity implementation while preserving atomic wallet transfers and user isolation. The current workspace limit is 2 MB; split large ledgers into normalized write tables before scaling to very large transaction histories.

Receipts use a private bucket with a 5 MB JPEG/PNG/PDF limit and user-folder access policies. Signed URLs expire after 60 seconds. The browser never uses a secret key. The browser verifies user sessions with Supabase; all financial access is independently enforced by the database.

## Deployment

```sh
npm run build
```

The app exports to `out/`. It works on Vercel with the Next.js preset and both public Supabase environment variables set before building; rebuild after changing these values. The private Sites preview uses the same export. Update the Supabase Auth URL settings for each deployment origin.

## Validation

```sh
npm run typecheck
npm test
node scripts/browser-qa.mjs
```

The browser check expects the local preview to be running. Screenshots are written to ignored `artifacts/`. Database verification checks revision conflicts, user isolation and recurring idempotency inside a transaction which is rolled back. Real authentication testing creates a temporary confirmed test user without sending email, verifies persistence/receipt storage/logout, then deletes that user. These setup/test scripts require temporary local credentials and should only be run against a development project.

## Project structure

- `src/app`: server-rendered page/layout, metadata and responsive design system.
- `src/components`: working screens, chart components, accessible UI primitives and transaction form.
- `src/lib/finance.ts`: types, ledger calculations, sample data, parsing and scheduling.
- `src/lib/use-finance.ts`: account-isolated loading and atomic Supabase persistence.
- `supabase/migrations`: database validation, RLS, read views, storage and scheduled processing.
- `tests`: financial invariant and scheduling tests.

Google provider configuration, production email delivery and automatic OCR are the remaining external integrations. No Supabase secret or database password is required to run or deploy the app.
