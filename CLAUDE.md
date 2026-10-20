# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, https://dustinedwards.info: React Router 8 on Workers, Drizzle on D1, R2, Access for the admin. Content is written through Carrel.

The portfolio rules are Capsid `capsid/conventions.md`; read it with this file, and it wins on disagreement. Current state is `dustinedwards/core.md`. Procedure is `.claude/skills/`. History is `dustinedwards/build-history.md`.

## Rules

- The site stores no visitor data (no IP address, cookie, identifier or third-party tracker, and a logged search keeps only its query and date), traces stay off so preview addresses never reach a third party, and anything new it records is named on the privacy page.

## Commands

**`package.json` owns the script list.** `check:changed` maps the diff to the gates that cover it, else the offline tier. `check` is the offline tier and `ship`'s; `check:all` adds gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `verify-live` is no gate: it needs a deploy and bills its Ask probes. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; `SCHEMA_LIVE=1` makes the schema test compare the live database. `check-all.mjs` refuses an untiered gate.

## Bindings

`wrangler.jsonc.example` declares every binding and says what each is (`wrangler.jsonc` is gitignored). `ASK_BUDGET` is the whole site's rate limiter. `workers/watchdog.ts` is a second Worker, deployed by a `ship` step.

## Where everything else lives

Here (a gate can reach it): `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`, `README.md`, `.claude/skills/<n>/SKILL.md`. In Capsid, namespace `dustinedwards`: `core.md` (current state) and `build-history.md`.
