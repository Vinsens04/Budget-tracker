# Saldo

A mobile-first personal finance app, built with Next.js App Router, strict TypeScript, Tailwind CSS, Supabase/PostgreSQL, Recharts, Lucide and Motion. Its finance-journal interface pairs expressive headings, receipt details, clear charts and smooth, accessible interactions.

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
- Email/password registration, login, reset-password flow and logout. Google OAuth is prepared behind a configuration flag.
- First-use wallet/balance setup, custom expense/income categories with linked renaming, and bookmarkable screens with browser Back support.
- Connection status, automatic refresh on reconnect/focus, and revision-conflict recovery that keeps the open form intact.
- Four coordinated themes: neutral Light and Dark, Green with deep forest and jade, and Blue with navy and ice blue. Switch through the header palette or Profile → Appearance; account preferences sync with Supabase, while demo preferences persist on the device. Legacy system preferences remain supported until a theme is selected.
- Notification preferences, keyboard focus and reduced motion/transparency/contrast handling.

Signed-in accounts start empty and save to Supabase. Signed-out demo data is session-only and cannot mix with account data. Financial notifications are in-app; browser push and email delivery are not configured. Receipt extraction is intentionally manual for now; OCR/AI can be added later with a review step before saving.

## Supabase

The database migrations and private `receipts` bucket have already been applied to the supplied project. For another project:

1. Copy `.env.example` to `.env.local` and set the Supabase URL and public publishable/anon key.
2. Run `supabase/migrations/001_finance.sql`, `002_recurring.sql`, then `003_revision_conflicts.sql` in the SQL editor.
3. Enable `pg_cron` and run the schedule statement at the end of migration 002.
4. Set **Authentication → URL Configuration** to your deployment URL, and allow `http://127.0.0.1:3000/**` and your deployment URL with `/**` for redirects.
5. When ready for Google login, enable the **Google** provider with your Google OAuth client ID and secret. The Supabase callback URL goes in the Google console. Then set `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true` and rebuild.

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
node scripts/finish-ui-qa.mjs
```

The browser checks expect the local preview to be running. Screenshots are written to ignored `artifacts/`. Database verification checks revision conflicts, user isolation and recurring idempotency inside a transaction which is rolled back. `scripts/auth-qa.mjs --stdin-secret` accepts a JSON object with a temporary `secret` through standard input, creates a confirmed test user without sending email, verifies onboarding/category persistence/conflict recovery/offline recovery/receipt storage/logout, then deletes that user. These setup/test scripts require temporary local credentials and should only be run against a development project.

## Project structure

- `src/app`: server-rendered page/layout, metadata and responsive design system.
- `src/components`: working screens, chart components, accessible UI primitives and transaction form.
- `src/lib/finance.ts`: types, ledger calculations, sample data, parsing and scheduling.
- `src/lib/use-finance.ts`: account-isolated loading and atomic Supabase persistence.
- `supabase/migrations`: database validation, RLS, read views, storage and scheduled processing.
- `tests`: financial invariant and scheduling tests.

Google provider configuration, production email delivery and automatic OCR are the remaining external integrations. No Supabase secret or database password is required to run or deploy the app.
