# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase. React Router 8 on Workers, Drizzle on D1, Better Auth, R2. Also a Capsid CMS consumer.

**This file is the STANDING LAW and nothing else.** Ruling 116 cut it to the rules that stop breakage or drift, each with the instrument that enforces it. Procedure is `.claude/skills/`; design law is Capsid's `TASK-redesign-brief-2026-09.md`; everything retired is in `dustinedwards/retired-2026-09.md` with its reason and the id it merged into, so nothing is lost, only stopped being read.

## Hard rules

Each rule is tagged `GATED by <instrument>` or `UNGATED`: can `npm run check` fail on this. Derive a tag by READING THE GATE, never from the rule's claim about itself.

Numbering is APPEND-ONLY. `check:invariants` section 15 binds every `hard rule N` cited anywhere in the repo to a heading here, and all twenty are cited, so a rule whose text shrank to a pointer still owns its number.

### 1. GATED by check:invariants. Every public read goes through `publiclyVisible()`.

**AND EVERY PUBLIC OBJECT DERIVED FROM A POST, not only row reads.** A public URL that can name a draft is a visibility bug whether it is HTML, a feed, a search record, an Ask answer or an OG card. Content-addressed `/media/*` is OUT: a digest cannot name a draft.

### 2. GATED by check:backup and check:invariants. `wrangler d1 export` is BROKEN here.

Per-table backups. The FTS repair is `('rebuild')`, never `DELETE FROM`.

### 3. GATED by check:secrets. Secrets are read only inside the server boundary.

Both directions, per-root floors.

### 4. GATED by check:page-payload and check:invariants. THE PUBLIC PLANE SHIPS NO FRAMEWORK SCRIPT.

Public routes do not hydrate; hydration is opt-in by route. A public page's whole script payload is the prebuilt bundles in `app/enhance/`, loaded by nonced module script tags. Client auth is imported by `/login` alone. Prefetch is a JS-only extra and nothing may depend on it.

### 5. UNGATED. Popover elevation and pinned bars take `--border-strong`, never `--border`.

Merged into `C:border` in `.design-sync/conventions.md`, where a design session reads it.

### 6. GATED by check:urls. URL protocols are allowlisted, SCHEMA AND RENDER.

Operator READ paths validate against the exported `SLUG_PATTERN`. `content/posts/<slug>.md` is stated ONCE, by the exported `postPath()`.

### 7. UNGATED. A gate that feeds a module its own stored output cannot see the TRANSPORT.

Live claims verify on the live path. Method: `VERIFICATION.md`.

### 8. GATED by check:headers. WORKERS CACHE IS ON, and the Worker's stamp IS the statement.

**The platform caches silence:** a response declaring no `Cache-Control` is cached under heuristic freshness, so `workers/app.ts` stamps `private, no-store` on any response that declares none. A route opts IN to sharing and never opts out of refusal. A route setting `Vary: Cookie` that receives any cookie is downgraded and bypasses the shared cache. What the theme may change is the gate's own `maskTheme`, never this file's.

### 9. GATED by check:features. PROGRESSIVE ENHANCEMENT, not "zero JS".

Works without script, fast with it, both halves instrumented. An enhancement loads as a nonced module script tag, never a React effect. The admin plane is exempt; `/login` is not, being unauthenticated and therefore a public reading route.

### 10. GATED by check:invariants for the tenth class. A PASS COUNT IS NOT COVERAGE.

Count assertions that CAN FAIL. Ten named vacuity classes, of which only helper-signature drift is gated; the list, the disciplines and the worked cases are `VERIFICATION.md`. The one that has corrected an auditor, a prompt and the ruling log: re-measure carried claims.

### 11. GATED by check:invariants. `app/db/schema.ts` IS the source of truth.

Section 4 binds schema.ts to the migrations to the live database. Prefer the query builder; `search_docs` is the asserted exception, modelled for the comparison and read only in raw SQL.

### 12. UNGATED. A new gate is tested by REPLAYING THE DEFECT it was written for.

Exit 1 is not evidence, both ways: a plant is proven applied before any result is read. Worked cases: `VERIFICATION.md`.

### 13. UNGATED, class only; all instances resolved.

A fallback that SUBSTITUTES A DIFFERENT VALUE is not failing closed. The two justified instances, `REMOTE_ARGS ?? []` and the rate-limit client IP, are each marked `JUSTIFIED SUBSTITUTION` at their call site, which is what `check:invariants` section 15b counts.

### 14. GATED by check:migrations. Migrations are hand-written and an applied one is never edited.

drizzle-kit is deliberately absent. `check:migrations` hashes every file against the manifest, both directions.

### 15. UNGATED. Do not modify `.claude/settings.json` without explicit instruction.

It decides whether the other rules are enforced at all, so an agent changing it can silently disable its own constraints.

### 16. GATED by ship. The ship contract: CI for this sha, token before build, Ask converged last.

In `scripts/ship.mjs`, each step failing closed and none optional. There is no override flag, because a flag would be used on exactly the day the check was right. A ship window owns the tree from its first step to its last, which no gate can see. Procedure: the `ship` skill.

### 17. UNGATED for the class, GATED by check:features for the colophon's feature prose. ONE OWNER PER FACT.

A measured value lives in the gate that measures it, or nowhere; prose may POINT AT the gate and may not restate the value. A comment carries a SHORT WHY beside the rule it protects and no history. Anything another consumer must not break is extracted or gated, never left to a comment that consumer may not read. Comment volume is not a floor, and a rule that does not make the site better is changed or deleted. Published posts are the exception: an article is a DATED RECORD and keeps its numbers with their date.

### 18. UNGATED. Indexes converge toward the repo, never the reverse.

D1, both FTS indexes, the Ask index, the media table and the social cards are DERIVED; the repository and the bucket are the sources. A derived store is repaired THROUGH ITS DERIVATION, never by a hand-written INSERT, and a failed index write NEVER reverts the source. No gate can see how a row got where it is, which is what makes this UNGATED; the gates see DRIFT, the symptom.

### 19. GATED by check:policy. Money paths refuse foreign origins and spend cheapest-first.

**ORIGIN, then RATE, then CACHE, then BUDGET, then MODEL**, each stage refusing before the next spends anything, asserted by POSITION in the route's own body. **An absent `Origin` header is ALLOWED**, because a scriptless form post carries none; what is refused is an `Origin` present and foreign.

### 20. UNGATED. A MANUAL CACHE KEY CARRIES EVERYTHING THE BODY DEPENDS ON.

`caches.default` carries no headers, so a stored body must be a pure function of the key. A new input to the body goes in the key, or every stored entry stays live, stale and unreachable: there is no purge door and `workers.dev` has no zone. Invalidation is PER-COLO and PARTIAL.

## How a session works

Mainline only until the DNS cutover. Everything lands on `main`, committed and pushed immediately. **The gates are the review.**

**THIS FOLDER IS THE MAIN CHECKOUT AND THE SITE SESSION'S ALONE (ruling 60).** Every other actor works in a worktree under `C:\Users\email\dev\worktrees\`, on its own branch, landing by PULL REQUEST on green CI. Renovate is the other exception and sessions do not merge its PRs; a red one is a REPORT, repaired by a scoped commit on `main`.

**TWO FILES HERE ARE CAPSID'S AND NOT THIS REPO'S TO RESTYLE:** `scripts/improve-report.mjs` and the block below the BYTE-IDENTICAL marker in `.github/workflows/improve-score.yml`. They are byte-identical across five roster repos, written here by capsid's `sync-scorer` copier, and a comment pass that touches either one makes this repo the odd one out. Leave them out of any repo-wide recut; a change goes to capsid and arrives by the copier.

Read `FAILURES.md` first. Every gate verifies DISK, not HEAD. `git diff <path>` before `git add <path>`; never `git add -A`. Destructive operations, money paths and auth secrets stay with Dustin. If a session rebases onto commits it did not expect, or finds its own edits absent from disk, that is not a merge conflict: stop and re-establish the baseline before writing anything.

## Commands

**`package.json` OWNS THE SCRIPT LIST.** Run `npm run` for it. `npm run check` is the OFFLINE tier and is what `ship` runs; `check:all` adds the gates needing a deployed database or bucket; `check:ci` is the tier a clean checkout can run, and `ship` trusts CI rather than a local run of it. `npm run verify-live` is NOT a gate: it needs a deploy and its Ask probes are billed. `check:media` is NETWORK ONLY; `check:backup`, `check:invariants`, `check:llms` and `sync:content` take `--local` or `--remote`. `check-all.mjs` derives the gate list from `package.json` and refuses an untiered gate, so a new gate is tiered in the same commit.

## Bindings

Read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

    DB  APP_KV  MEDIA  MEDIA_BACKUP  OG  ASSETS  IMAGES  AI_SEARCH  ASK_BUDGET  ANALYTICS

`ASK_BUDGET` IS THE WHOLE SITE'S RATE LIMITER, not an Ask-only budget, and is deliberately not renamed before the cutover. What each one is, with that ruling and the queue consumer, is `wrangler.jsonc.example`, which `check:invariants` section 26 binds to this list in both directions. That file is tracked and `wrangler.jsonc` is gitignored, a PORTFOLIO rule; a new binding is added to both in one commit. `workers/watchdog.ts` is a second Worker on the identical split, deployed by a `ship` step and never by `npm run deploy`. `OPERATOR_TOKEN` has three holders, the site Worker, the watchdog and the `gh` repository secret: rotate all three or none.

## Where everything else lives

In this repo, because a gate can reach it: `FAILURES.md` (failure shapes, read at session start), `VERIFICATION.md` (the method behind rules 7, 10 and 12), `RECOVERY.md`, `docs/RUNBOOK.md`, `CUTOVER.md`, `README.md`, and the skills at `.claude/skills/<name>/SKILL.md`. Everything else is Capsid, namespace `dustinedwards`: start with `brief("dustinedwards")`, read `core.md` for current state and `decisions-vol-*.md` for the grounds behind every rule above. Sessions READ Capsid and never write it.
