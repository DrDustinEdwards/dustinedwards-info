# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase, live at https://dustinedwards.info. React Router 8 on Workers, Drizzle on D1, R2, Cloudflare Access for the admin. Content is written and published through Carrel.

The portfolio rules are in Capsid: `capsid/conventions.md`. Read it with this file. Where they disagree, conventions wins. Procedure is `.claude/skills/`; the design system is Capsomer (Paper and Plate is being redone on it, capsid/decisions.md 2026-10-01), with the home page hero kept (ruling 152 in Capsid's `dustinedwards/decisions.md`); what was built and retired, and why, is `dustinedwards/build-history.md`.

## Principles

- Every fact is stored once as structured data, and every page that shows it renders from that source: names, numbers, dates, sequences, sizes, temperatures, citations, DOIs, people, places, IDs and links. Values that can be computed are computed, not typed. Prose around the facts stays prose.
- A check earns its place by catching real mistakes; a check that has never caught one is removed, not defended.

## Hard rules

The numbered ones keep their old numbers, because code cites them by number.

### Machines and people.

AI-first: everything machines use (content, data, structure, citations, dates, feeds, the .md twins, llms.txt, JSON-LD, microformats) is served without script, and machines get the same facts people do, never a thinner version. For people, the site uses whatever makes it its best, script included.

### 15. `.claude/settings.json` changes only on Dustin's explicit instruction.

Portfolio rule 9.3; kept here under its number because code cites it.

### 16. Only the ship script deploys, run by Dustin or by the deploy workflow after green CI.

A merge to main deploys through `.github/workflows/deploy.yml` once CI passes on main, unless the `AUTO_DEPLOY` repository variable is `off`. Sessions never merge: Capsid's signed auto-merge policy merges a PR once CI is green on its exact head, or the seat does (capsid/decisions.md, 2026-10-04, one merge path). A change a visitor would see is labelled `visual` and waits for Dustin's yes. `scripts/ship.mjs` requires green CI for the exact sha, checks the operator token before the build, and converges Ask last. Every step fails closed and none is optional, with no override flag. A ship window owns the tree from its first step to its last. Procedure: the `ship` skill.

### 18. UNGATED. Indexes converge toward the repo, never the reverse.

D1, both FTS indexes, the Ask index, the media table and the social cards are DERIVED; the repository and the bucket are the sources. A derived store is repaired THROUGH ITS DERIVATION, never by a hand-written INSERT, and a failed index write NEVER reverts the source. No gate can see how a row got where it is; the gates see DRIFT, the symptom.

## How a session works

**This folder is the main checkout and the site session's alone (ruling 60).** The site session commits to `main` and pushes; the gates are the review. Every other actor works in a worktree under `C:\Users\email\dev\worktrees\`, on its own branch, landing by pull request on green CI. Small changes (copy, a colour or spacing tweak, a quick fix) may be asked of the site session directly, without a Capsid job (ruling 148). Renovate PRs are not merged by sessions; a red one is a report, repaired by a scoped commit.

**Two files here are Capsid's and not this repo's to restyle:** `scripts/improve-report.mjs` and the block below the BYTE-IDENTICAL marker in `.github/workflows/improve-score.yml`. They are kept identical across the roster repos by capsid's `sync-scorer` copier; a change goes to capsid and arrives by the copier.

**Reading is by citation (ruling 129).** A job names the rulings it depends on, by number. A session reads `core.md`, this file, the job body and those rulings. `FAILURES.md` is worth the minute.

**Checks scale with the change (ruling 129).** Run the checks that cover what you touched (`npm run check:changed`), push, and let CI run the full suite. Screenshots only when something a reader can see changed.

## Commands

**`package.json` owns the script list.** `npm run check:changed` maps the diff to the gates that cover it, falling back to the offline tier. `npm run check` is the offline tier and is what `ship` runs; `check:all` adds the gates needing a deployed database or bucket; `check:ci` is what a clean checkout runs. `npm run verify-live` is not a gate: it needs a deploy and its Ask probes are billed. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; the schema test compares the live database when `SCHEMA_LIVE=1`. `check-all.mjs` derives the gate list from `package.json` and refuses an untiered gate.

## Bindings

Read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

    DB  APP_KV  MEDIA  MEDIA_BACKUP  OG  ASSETS  IMAGES  AI_SEARCH  ASK_BUDGET

`ASK_BUDGET` is the whole site's rate limiter, not an Ask-only budget. What each binding is: `wrangler.jsonc.example` (tracked; `wrangler.jsonc` is gitignored, and a new binding goes in both in one commit). `workers/watchdog.ts` is a second Worker on the same split, deployed by a `ship` step. `OPERATOR_TOKEN` has three holders, the site Worker, the watchdog and the `gh` repository secret: rotate all three or none.

## Where everything else lives

In this repo, because a gate can reach it: `FAILURES.md`, `RECOVERY.md`, `docs/RUNBOOK.md`, `CUTOVER.md`, `README.md`, and the skills at `.claude/skills/<n>/SKILL.md`. In Capsid, namespace `dustinedwards`: `core.md` for current state, `decisions.md` for every ruling in force (read one by number when a job cites it), `build-history.md` for history. A session records a reversal or a binding in Capsid, and nothing else.
