# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, https://dustinedwards.info: React Router 8 on Workers, Drizzle on D1, R2, Access for the admin. Content goes via Carrel.

The portfolio rules are in Capsid: `capsid/conventions.md`. Read it with this file. Conventions wins on disagreement. Procedure is `.claude/skills/`. The design system is Capsomer (Paper and Plate is being redone on it, capsid/decisions.md 2026-10-01), home page hero kept (ruling 152, `dustinedwards/decisions.md`). History is `dustinedwards/build-history.md`.

## Principles

- Every fact (names, numbers, dates, sequences, sizes, temperatures, citations, DOIs, people, places, IDs, links) is stored once as structured data; every page showing it renders from that. Computable values are computed, not typed. Prose stays prose.
- A check that has never caught a real mistake is removed, not defended.

## Hard rules

Numbers stay because code cites them.

### Machines and people.

AI-first: everything machines use (content, data, structure, citations, dates, feeds, .md twins, llms.txt, JSON-LD, microformats) is served without script, with the same facts people get. For people, the site uses whatever makes it best, script included.

### 15. `.claude/settings.json` changes only on Dustin's explicit instruction.

Portfolio rule 6.3.

### 16. Only the ship script deploys, run by Dustin or by the deploy workflow after green CI.

Every change lands by pull request (portfolio rule 4.3). A merge to main deploys via `.github/workflows/deploy.yml` once CI passes on main, unless the `AUTO_DEPLOY` repository variable is `off`. Sessions never merge: Capsid's signed auto-merge does once CI is green on the exact head, or the seat. A change a visitor would see is labelled `visual` and waits for Dustin's yes. `scripts/ship.mjs` requires green CI for the exact sha, checks the operator token before the build, converges Ask last, fails closed at every step, and has no override flag. A ship window owns the tree throughout. See the `ship` skill.

### 18. UNGATED. Indexes converge toward the repo, never the reverse.

D1, both FTS indexes, the Ask index, the media table and the social cards are DERIVED; the repository and the bucket are the sources. Repair a derived store THROUGH ITS DERIVATION, never by a hand-written INSERT; a failed index write NEVER reverts the source. Gates see DRIFT only.

## How a session works

**Every session works on a branch and lands by pull request** (capsid/decisions.md, 2026-10-04). The PR gets a Worker Preview and full CI before main. This folder is the site session's checkout (ruling 60); others use a worktree under `C:\Users\email\dev\worktrees\`. Small changes (copy, colour, spacing, quick fixes) may go to the site session without a Capsid job (ruling 148), still by PR, merged automatically. Renovate self-merges per `renovate.json`; a red one is a report.

**Two files here are Capsid's:** `scripts/improve-report.mjs` and the block below the BYTE-IDENTICAL marker in `.github/workflows/improve-score.yml`. Capsid's `sync-scorer` copier (`npm run sync:scorer` in capsid) keeps them identical across the roster repos; change them in capsid and they arrive by the copier.

**Reading is by citation (ruling 129).** Read `core.md`, this file, the job body and the rulings it cites by number; `FAILURES.md` is worth a minute. **Checks scale with the change (ruling 129):** run `npm run check:changed`, push, let CI run the full suite. Screenshots only for visible changes.

## Commands

**`package.json` owns the script list.** `check:changed` maps the diff to the gates that cover it, else the offline tier. `check` is the offline tier and `ship`'s; `check:all` adds gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `verify-live` is no gate: it needs a deploy and bills its Ask probes. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; `SCHEMA_LIVE=1` makes the schema test compare the live database. `check-all.mjs` refuses an untiered gate. The admin MCP (`mcp/`) has its own gates and CI job and deploys only by `npm run ship:mcp`; read `mcp/CLAUDE.md` first.

## Bindings

Read via `getEnv(context)` from `app/lib/context.ts`; never import bindings globally.

    DB  APP_KV  MEDIA  MEDIA_BACKUP  OG  ASSETS  IMAGES  AI_SEARCH  ASK_BUDGET

`ASK_BUDGET` is the whole site's rate limiter. `wrangler.jsonc.example` says what each is (`wrangler.jsonc` is gitignored; a new binding goes in both in one commit). `workers/watchdog.ts` is a second Worker, deployed by a `ship` step. `OPERATOR_TOKEN` has four holders (site Worker, watchdog, admin MCP Worker in `mcp/`, the `gh` repository secret): rotate all four or none.

## Where everything else lives

Here (a gate can reach it): `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`, `README.md`, `.claude/skills/<n>/SKILL.md`. In Capsid, namespace `dustinedwards`: `core.md` (current state), `decisions.md` (every ruling in force), `build-history.md`. A session records a reversal or a binding in Capsid, and nothing else.
