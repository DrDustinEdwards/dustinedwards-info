# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, https://dustinedwards.info: React Router 8 on Workers, Drizzle on D1, R2, Access for the admin. Content is written through Carrel.

The portfolio rules are Capsid `capsid/conventions.md`; read it with this file, and it wins on disagreement. Current state is `dustinedwards/core.md`. Procedure is `.claude/skills/`. History is `dustinedwards/build-history.md`.

## Rules

Headings 15, 16 and 18 keep their numbers because code cites them.

### 15. `.claude/settings.json` changes only on Dustin's explicit instruction (portfolio rule 2).

### 16. Only the ship script deploys, run by Dustin or by the deploy workflow after green CI on main, and nobody runs `npm run deploy` or a bare `wrangler deploy`.

### 18. The repository and the bucket are the sources, and every derived store (D1, both FTS indexes, the Ask index, the media table, the social cards) is repaired only through its derivation, never by a hand-written INSERT, and a failed index write never reverts the source.

- `OPERATOR_TOKEN` is rotated in all four of its holders (site Worker, watchdog, admin MCP Worker, the `gh` repository secret) or in none.
- The site stores no visitor data (no IP address, cookie, identifier or third-party tracker, and a logged search keeps only its query and date), traces stay off so preview addresses never reach a third party, and anything new it records is named on the privacy page.
- No student face, name or identifiable coursework, and no private location, appears anywhere.
- Everything is free to people, search crawlers are never charged or blocked, only the technical essays under /writing may ever be charged to AI crawlers, and site data carries the /terms license.
- `biosafety_level` is Dustin's alone (no agent fills, infers or defaults it), and `biosafety` names the agent only.
- A protocol cites the SEA-PHAGES Guide or says how its variant differs, and every amount, time, temperature and sequence is tied to a span in its source, with primers from tested code and any computed Tm labelled an estimate.
- Nothing is called validated or marked as run in the lab without a date and a named deviation, and no MCP tool runs or optimizes a protocol.
- Every fact is stored once as structured data and rendered from there, computable values are computed, no fact is invented, and content that changes lives as a repo file editable without a deploy.
- Old URLs redirect, canonical URLs stay stable, and no link is broken.
- The design is Capsomer with the home page hero kept, Paper elements come back only by Dustin's decision, and a design rule is a default that a better design may override.
- /systems is one interactive page mapping the whole family, where choosing a system shows its wiring in place, and a private repo shows there only as a name and domain, or not at all without a public product.
- The site links only Dustin's X account and the Germomics podcast.
- Every public downloadable file name starts with `dustin-edwards-`, and a renamed file redirects from its old URL.
- Titles carry the slug's voice, descriptions carry the search terms, and a retitle is Dustin's to approve.
- Python is used only in a small separate Worker where a well-tested science library does the work.
- An interactive figure's facts are in the server HTML or the .md twin, a filter's state lives in the URL, and nothing in the human interface exists only for machines.

## How a session works

Work in your own worktree (local ones under `C:\Users\email\dev\worktrees\`); this folder is the site session's checkout. Read this file, `core.md` and Dustin's own words before the job body. Run `npm run check:changed`, push, and let CI run the full suite. A visible change is opened at phone and desktop size and checked against Dustin's words before it goes to him. Renovate merges its own updates per `renovate.json`.

## Commands

**Two files here are Capsid's:** `scripts/improve-report.mjs` and the block below the BYTE-IDENTICAL marker in `.github/workflows/improve-score.yml`. Capsid's `sync-scorer` copier (`npm run sync:scorer` in capsid) keeps them identical across the roster repos; change them in capsid and they arrive by the copier.

**`package.json` owns the script list.** `check:changed` maps the diff to the gates that cover it, else the offline tier. `check` is the offline tier and `ship`'s; `check:all` adds gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `verify-live` is no gate: it needs a deploy and bills its Ask probes. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; `SCHEMA_LIVE=1` makes the schema test compare the live database. `check-all.mjs` refuses an untiered gate. The admin MCP (`mcp/`) has its own gates and CI job and deploys only by `npm run ship:mcp`; read `mcp/CLAUDE.md` first.

## Bindings

Read via `getEnv(context)` from `app/lib/context.ts`; never import bindings globally. `wrangler.jsonc.example` declares every binding and says what each is (`wrangler.jsonc` is gitignored; a new binding goes in both in one commit). `ASK_BUDGET` is the whole site's rate limiter. `workers/watchdog.ts` is a second Worker, deployed by a `ship` step.

## Where everything else lives

Here (a gate can reach it): `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`, `README.md`, `.claude/skills/<n>/SKILL.md`. In Capsid, namespace `dustinedwards`: `core.md` (current state) and `build-history.md`.
