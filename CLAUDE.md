# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase. React Router 8 on Workers, Drizzle on D1, Better Auth, R2. Also a Capsid CMS consumer.

**This file is the STANDING LAW and nothing else.** Procedure is `.claude/skills/`; the design is the visual system in Claude Design (the dustinedwards.info design system, `templates/visual-system/`); everything retired is in `dustinedwards/retired-2026-09.md` with its reason and the id it merged into, so nothing is lost, only stopped being read.

## Principles

- A rule that does not make the site better is changed or deleted.
- A check earns its place by catching real mistakes; a check that has never caught one is removed, not defended.
- Before writing new code, search the repo for code that already does the job, and extend or reuse it instead of adding a parallel version. Prefer changing existing code to adding new code.
- Never swallow an error. A failure is returned or thrown to where it can be seen; it is never logged and ignored while the code carries on or reports success.

## Hard rules

The numbered ones keep their old numbers, because code cites them by number.

### Machines and people.

AI-first: everything machines use (content, data, structure, citations, dates, feeds, the .md twins, llms.txt, JSON-LD, microformats) is served without script, and machines get the same facts people do, never a thinner version. For people, the site uses whatever makes it its best, script included.

### 15. Sessions do not change `.claude/settings.json` unless Dustin explicitly asks.

That file decides whether the hooks run at all, so a session that changes it can switch off its own limits.

### 16. Only `npm run ship` deploys.

`scripts/ship.mjs` requires green CI for the exact sha, checks the operator token before the build, and converges Ask last. Every step fails closed and none is optional, and there is no override flag, because a flag would be used on exactly the day the check was right. A ship window owns the tree from its first step to its last. Procedure: the `ship` skill.

### 18. UNGATED. Indexes converge toward the repo, never the reverse.

D1, both FTS indexes, the Ask index, the media table and the social cards are DERIVED; the repository and the bucket are the sources. A derived store is repaired THROUGH ITS DERIVATION, never by a hand-written INSERT, and a failed index write NEVER reverts the source. No gate can see how a row got where it is, which is what makes this UNGATED; the gates see DRIFT, the symptom.

## How a session works

Mainline only until the DNS cutover. Everything lands on `main`, committed and pushed immediately. **The gates are the review.**

**THIS FOLDER IS THE MAIN CHECKOUT AND THE SITE SESSION'S ALONE (ruling 60).** Every other actor works in a worktree under `C:\Users\email\dev\worktrees\`, on its own branch, landing by PULL REQUEST on green CI. Renovate is the other exception and sessions do not merge its PRs; a red one is a REPORT, repaired by a scoped commit on `main`.

**TWO FILES HERE ARE CAPSID'S AND NOT THIS REPO'S TO RESTYLE:** `scripts/improve-report.mjs` and the block below the BYTE-IDENTICAL marker in `.github/workflows/improve-score.yml`. They are byte-identical across five roster repos, written here by capsid's `sync-scorer` copier, and a comment pass that touches either one makes this repo the odd one out. Leave them out of any repo-wide recut; a change goes to capsid and arrives by the copier.

**READING IS BY CITATION (ruling 129).** A job names the rulings it depends on, by number and volume. A session reads `core.md`, this file, the job body and those rulings, and nothing else is required reading. Not the whole decisions volume. `FAILURES.md` is worth the minute anyway, because it is the failure shapes that repeat, but it is a pointer rather than a gate on starting.

**CHECKS SCALE WITH THE CHANGE (ruling 129).** Run the checks that cover what you touched, push, and let CI run the full suite, which `ship` already trusts under hard rule 16. `npm run check:changed` picks them from the diff and falls back to the offline tier when it cannot tell. Screenshots only when something a reader can see changed. A full local `check:ci` before a push is never a ritual on this host: it re-derives what CI is about to derive anyway.

Every gate verifies DISK, not HEAD. `git diff <path>` before `git add <path>`; never `git add -A`. Destructive operations, money paths and auth secrets stay with Dustin. If a session rebases onto commits it did not expect, or finds its own edits absent from disk, that is not a merge conflict: stop and re-establish the baseline before writing anything.

## Commands

**`package.json` OWNS THE SCRIPT LIST.** Run `npm run` for it. `npm run check:changed` is what a session runs: it maps the branch's diff to the gates that cover it and runs only those, falling back to the offline tier when a changed path maps to nothing. `npm run check` is the OFFLINE tier and is what `ship` runs; `check:all` adds the gates needing a deployed database or bucket; `check:ci` is the tier a clean checkout can run, and `ship` trusts CI rather than a local run of it. `npm run verify-live` is NOT a gate: it needs a deploy and its Ask probes are billed. `check:backup`, `check:machine-readable` and `sync:content` take `--local` or `--remote`; the schema test compares the live database when `SCHEMA_LIVE=1` is set, which `check:all` does. `check-all.mjs` derives the gate list from `package.json` and refuses an untiered gate, so a new gate is tiered in the same commit.

## Bindings

Read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

    DB  APP_KV  MEDIA  MEDIA_BACKUP  OG  ASSETS  IMAGES  AI_SEARCH  ASK_BUDGET  ANALYTICS

`ASK_BUDGET` IS THE WHOLE SITE'S RATE LIMITER, not an Ask-only budget, and is deliberately not renamed before the cutover. What each one is, with that ruling and the queue consumer, is `wrangler.jsonc.example`. That file is tracked and `wrangler.jsonc` is gitignored, a PORTFOLIO rule; a new binding is added to both in one commit. `workers/watchdog.ts` is a second Worker on the identical split, deployed by a `ship` step and never by `npm run deploy`. `OPERATOR_TOKEN` has three holders, the site Worker, the watchdog and the `gh` repository secret: rotate all three or none.

## Where everything else lives

In this repo, because a gate can reach it: `FAILURES.md` (failure shapes, read at session start), `RECOVERY.md`, `docs/RUNBOOK.md`, `CUTOVER.md`, `README.md`, and the skills at `.claude/skills/<name>/SKILL.md`. Everything else is Capsid, namespace `dustinedwards`. Read `core.md` for current state, and read a RULING BY NUMBER when the job cites one: `decisions-vol-20.md` is the active volume, `decisions-vol-19.md` and below are frozen history. Reading a volume end to end is not the way in (ruling 129). Sessions READ Capsid and never write it.
