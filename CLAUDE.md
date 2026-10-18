# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, https://dustinedwards.info: React Router 8 on Workers, Drizzle on D1, R2, Access for the admin. Content is written through Carrel (capsid/rulings/mcp-2026-10-10.md, rule 11).

The portfolio rules are `capsid/conventions.md`; read it with this file, and it wins on disagreement. The rulings in force for this site are Capsid `dustinedwards/decisions.md`; current state is `dustinedwards/core.md`; design is ruling 152. Procedure is `.claude/skills/`. History is `dustinedwards/build-history.md`.

## Principles

- Every fact (names, numbers, dates, sequences, sizes, temperatures, citations, DOIs, people, places, IDs, links) is stored once as structured data; every page showing it renders from that. Computable values are computed, not typed. Prose stays prose. Content that changes over time is a file in the repo with a derived D1 row, editable without a build or deploy; design lives in code.
- A check that has never caught a real mistake, and guards no harm that cannot be undone, is removed, not defended.

## Hard rules

Numbers stay because code cites them.

### Machines and people.

Everything machines use (content, data, structure, citations, dates, feeds, .md twins, llms.txt, JSON-LD, microformats) is served without script, with the same facts people get; an interactive figure's facts and numbers are in the server HTML, the .md twin, or both. A filter's state lives in the URL. For people, the site uses whatever makes it best, script included: each scripted piece loads only where it is used, slows no other page, and follows the W3C ARIA Authoring Practices, with built-in elements such as dialog and popover where they exist. Speed is judged by Core Web Vitals, never by byte counts. Nothing in the human interface exists only for machines.

### 15. `.claude/settings.json` changes only on Dustin's explicit instruction.

Portfolio rule 6.3.

### 16. Only the ship script deploys.

Who merges is portfolio rule 4.3; a `visual` PR waits for Dustin's yes. A merge to main deploys, whoever merged it: `.github/workflows/deploy.yml` runs `npm run ship` on that sha once CI passes on main, unless the `AUTO_DEPLOY` repository variable is `off`. `scripts/ship.mjs` requires green CI for the exact sha, checks the operator token before the build, converges Ask last, fails closed at every step, and has no override flag. Never run `npm run deploy` or a bare `wrangler deploy` yourself; ship runs the first as its own step. A ship window owns the tree throughout. Procedure: the `ship` skill.

### 18. UNGATED. Indexes converge toward the repo, never the reverse.

D1, both FTS indexes, the Ask index, the media table and the social cards are DERIVED; the repository and the bucket are the sources. Repair a derived store THROUGH ITS DERIVATION, never by a hand-written INSERT; a failed index write NEVER reverts the source. Gates see DRIFT only.

## How a session works

On a branch, landing by pull request (rule 16). This folder is the site session's checkout; any other session uses its own worktree (local ones under `C:\Users\email\dev\worktrees\`). Read this file, `core.md`, Dustin's own words (quoted in the job or the thread) and the job body, and any ruling the job cites by number; `FAILURES.md` is worth a minute. Run `npm run check:changed`, push, and let CI run the full suite. A visible change is opened at phone and desktop size and checked against Dustin's words before it goes to him. Renovate merges its own updates per `renovate.json`; a red one is a report.

**Two files here are Capsid's:** `scripts/improve-report.mjs` and the block below the BYTE-IDENTICAL marker in `.github/workflows/improve-score.yml`. Capsid's `sync-scorer` copier (`npm run sync:scorer` in capsid) keeps them identical across the roster repos; change them in capsid and they arrive by the copier.

## Commands

**`package.json` owns the script list.** `check:changed` maps the diff to the gates that cover it, else the offline tier. `check` is the offline tier and `ship`'s; `check:all` adds gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `verify-live` is no gate: it needs a deploy and bills its Ask probes. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; `SCHEMA_LIVE=1` makes the schema test compare the live database. `check-all.mjs` refuses an untiered gate. The admin MCP (`mcp/`) has its own gates and CI job and deploys only by `npm run ship:mcp`; read `mcp/CLAUDE.md` first.

## Bindings

Read via `getEnv(context)` from `app/lib/context.ts`; never import bindings globally. `wrangler.jsonc.example` declares every binding and says what each is (`wrangler.jsonc` is gitignored; a new binding goes in both in one commit). `ASK_BUDGET` is the whole site's rate limiter. `workers/watchdog.ts` is a second Worker, deployed by a `ship` step. `OPERATOR_TOKEN` has four holders (site Worker, watchdog, admin MCP Worker in `mcp/`, the `gh` repository secret): rotate all four or none.

## Where everything else lives

Here (a gate can reach it): `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`, `README.md`, `.claude/skills/<n>/SKILL.md`. In Capsid, namespace `dustinedwards`: `core.md` (current state), `decisions.md` (every ruling in force), `build-history.md`.
