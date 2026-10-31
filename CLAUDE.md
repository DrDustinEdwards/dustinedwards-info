# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, https://dustinedwards.info: React Router 8 on Workers, Drizzle on D1, R2, Access for the admin. Content is written through Carrel. Before writing anything another site might have, read what the sites share: https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md (CI's shared-code check fails on a copy).

Current state is `dustinedwards/core.md`. Procedure is `.claude/skills/`. History is `dustinedwards/build-history.md`.

## Rules

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- The site stores no visitor data (no IP address, cookie, identifier or third-party tracker, and a logged search keeps only its query and date; Cloudflare Web Analytics, which the privacy page names, is the one outside script), traces stay off so preview addresses never reach a third party, and anything new it records is named on the privacy page.

## Commands

**`package.json` owns the script list.** `check:changed` maps the diff to the gates that cover it, else the offline tier. `check` is the offline tier and `ship`'s; `check:all` adds gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `verify-live` is no gate: it needs a deploy and bills its Ask probes. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; `SCHEMA_LIVE=1` makes the schema test compare the live database. `check-all.mjs` refuses an untiered gate.

## Bindings

`wrangler.jsonc.example` declares every binding and says what each is (`wrangler.jsonc` is gitignored). `ASK_BUDGET` is the whole site's rate limiter. `workers/watchdog.ts` is a second Worker, deployed by a `ship` step.

## Where everything else lives

Here (a gate can reach it): `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`, `README.md`, `.claude/skills/<n>/SKILL.md`. In Capsid, namespace `dustinedwards`: `core.md` (current state) and `build-history.md`.
