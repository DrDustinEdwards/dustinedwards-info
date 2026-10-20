# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, https://dustinedwards.info: React Router 8 on Workers, Drizzle on D1, R2, Access for the admin. Content is written through Carrel.

The portfolio rules are Capsid `capsid/conventions.md`; read it with this file, and it wins on disagreement. Current state is `dustinedwards/core.md`. Procedure is `.claude/skills/`. History is `dustinedwards/build-history.md`.

## Rules

Headings 16 and 18 keep their numbers because code cites them.

### 16. Only the ship script deploys, run by Dustin or by the deploy workflow after green CI on main, and nobody runs `npm run deploy` or a bare `wrangler deploy`.

### 18. The repository and the bucket are the sources, and every derived store (D1, both FTS indexes, the Ask index, the media table, the social cards) is repaired only through its derivation, never by a hand-written INSERT, and a failed index write never reverts the source.

- `OPERATOR_TOKEN` is rotated in all four of its holders (site Worker, watchdog, admin MCP Worker, the `gh` repository secret) or in none.
- The site stores no visitor data (no IP address, cookie, identifier or third-party tracker, and a logged search keeps only its query and date), traces stay off so preview addresses never reach a third party, and anything new it records is named on the privacy page.
- Everything is free to people, search crawlers are never charged or blocked, only the technical essays under /writing may ever be charged to AI crawlers, and site data carries the /terms license.
- `biosafety_level` is Dustin's alone (no agent fills, infers or defaults it), and `biosafety` names the agent only.
- Every fact is stored once as structured data and rendered from there, computable values are computed, no fact is invented, and content that changes lives as a repo file editable without a deploy.
- Old URLs redirect, canonical URLs stay stable, and no link is broken.

## How a session works

Work in your own worktree (local ones under `C:\Users\email\dev\worktrees\`); this folder is the site session's checkout. A visible change is opened at phone and desktop size and checked against Dustin's words before it goes to him.

## Commands

**`package.json` owns the script list.** `check:changed` maps the diff to the gates that cover it, else the offline tier. `check` is the offline tier and `ship`'s; `check:all` adds gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `verify-live` is no gate: it needs a deploy and bills its Ask probes. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; `SCHEMA_LIVE=1` makes the schema test compare the live database. `check-all.mjs` refuses an untiered gate.

## Bindings

Read via `getEnv(context)` from `app/lib/context.ts`; never import bindings globally. `wrangler.jsonc.example` declares every binding and says what each is (`wrangler.jsonc` is gitignored; a new binding goes in both in one commit). `ASK_BUDGET` is the whole site's rate limiter. `workers/watchdog.ts` is a second Worker, deployed by a `ship` step.

## Where everything else lives

Here (a gate can reach it): `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`, `README.md`, `.claude/skills/<n>/SKILL.md`. In Capsid, namespace `dustinedwards`: `core.md` (current state) and `build-history.md`.
