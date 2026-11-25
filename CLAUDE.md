# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, https://dustinedwards.info: React Router 8 on Workers, Drizzle on D1, R2, Access for the admin. Content is written through Carrel.

## Rules every repo shares

- **Tests.** Keep the minimal set: a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives. Remove a test that pins design, repeats coverage or never caught a mistake, unless it guards a harm that cannot be undone.
- **UI copy.** Let the layout explain: no eyebrows, restating subtitles, "this page lets you" intros, hints a label already gives or empty-state essays. Labels, accessible names, errors, one-way warnings and legal text stay (Dustin, 2026-11-18; capsid/conventions.md).
- **Shared code.** Before writing anything another site might have, check https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md. Change shared code in place and delete what the change replaces in the same PR.
- **Browser support.** devkit's docs/browser-support.md: Baseline Widely available freely, Newly available with a small fallback, Limited only feature-detected, no polyfills.
- **Secrets.** Never commit or print a key, token, `.dev.vars` or `.env`.
- **Reproduce first.** Reproduce a reported failure before fixing it; report red before and green after.
- **Deploys.** A merge to the default branch deploys; never deploy from a session.
- **D1.** Never hand-run production DDL; CI applies additive migrations and refuses the rest. Back up and restore with d1-dump, never `wrangler d1 export` (it fails on FTS5 tables).
- **Site copy and AI.** Copy describes only what the current build does. An AI provider key stays on the server, never in a client.

## Rules for this repo

- The site stores no visitor data (no IP address, cookie, identifier or third-party tracker, and a logged search keeps only its query and date; Cloudflare Web Analytics, which the privacy page names, is the one outside script), traces stay off so preview addresses never reach a third party, and anything new it records is named on the privacy page.

## Commands

**`package.json` owns the script list.** `check:changed` maps the diff to the gates that cover it, else the offline tier. `check` is the offline tier and `ship`'s; `check:all` adds gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `verify-live` is no gate: it needs a deploy and bills its Ask probes. `check:backup`, `check:content` and `sync:content` take `--local` or `--remote`; `SCHEMA_LIVE=1` makes the schema test compare the live database. `check-all.mjs` refuses an untiered gate.

## Bindings

`wrangler.jsonc.example` declares every binding (`wrangler.jsonc` is gitignored). `ASK_BUDGET` is the whole site's rate limiter. The site's cron (`app/lib/cron-jobs.mjs`) runs its scheduled jobs.

Runbooks: `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`.
