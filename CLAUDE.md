# CLAUDE.md - dustinedwards.info

Dustin Edwards's personal site and Cloudflare showcase. React Router 8 on Workers, Drizzle on D1, Better Auth, R2. Also a Capsid CMS consumer.

**This file holds RULES and gate-verified FACTS. Nothing else.** Procedure is in `.claude/skills/`. History, with the measurements that forced each ruling, is in the Capsid ruling log. When a rule and Capsid disagree about a GATED fact the repo wins; about a RULING, Capsid wins.

## Hard rules

Each rule is tagged `GATED by <instrument>` or `UNGATED`, and the tag answers one question: can `npm run check` fail on this. Derive a tag by READING THE GATE, never from the rule's claim about itself. UNGATED means the only thing between the rule and a violation is somebody reading it.

Numbering is APPEND-ONLY. A new rule takes the next unused number; a retired rule keeps its number and is marked REMOVED, so a citation never silently retargets. `check:invariants` section 15 binds every `hard rule N` cited in the repo to a heading here.

Grounds for any rule below, with dates and measurements: `dustinedwards/decisions-vol-*.md`.

### 1. GATED by check:invariants. Every public read goes through `publiclyVisible()`.

Sections 2, 6 (alias-resolving, two named exemptions) and 8 (every `search_docs` reader composes `visibilityClause()`).

**AND EVERY PUBLIC OBJECT DERIVED FROM A POST, not only row reads.** A public URL that can name a draft is a visibility bug whether it is HTML, a feed, a search record, an Ask answer or an OG card. The sites: `blog.$slug.tsx`, `blog.rss[.xml].ts`, `blog.feed[.json].ts`, `sitemap.ts`, `search.server.ts`, `ask.server.ts`, `build-og.mjs`.

**Content-addressed `/media/*` is OUT.** A `contentKey()` digest cannot name a draft, cannot be guessed from a slug, and reveals nothing by existing.

### 2. GATED by check:backup and check:invariants, UNGATED for the export fact. `wrangler d1 export` is BROKEN here.

Per-table backups via `check:backup`. FTS `DELETE FROM` is gated by `check:invariants` section 7; the repair is `('rebuild')`. No gate can assert a vendor binary is broken; what IS gated is that the repo does not depend on it.

### 3. GATED by check:secrets. Secrets are read only inside the server boundary.

Both directions, per-root floors.

### 4. GATED by check:page-payload for the public script payload, UNGATED for the rest. Keep the PUBLIC PAYLOAD lean, which is more than the Worker.

The subject is everything a reader downloads to see a page: Worker bundle, CSS, route JavaScript, and whatever the page speculatively fetches. Inline SVG over an icon library. CodeMirror is lazy-split. Client auth is imported by `/login` alone.

**THE PUBLIC PLANE SHIPS NO FRAMEWORK SCRIPT.** Public routes do not hydrate; hydration is opt-in by route (`handle = { hydrate: true }`). A public page's whole script payload is the prebuilt bundles in `app/enhance/`, loaded by nonced module script tags. `check:page-payload` owns the per-bundle ceilings and pins the opt-in set; `check:invariants` section 24 refuses a client hook in an unhydrated tree.

**Prefetch is a JS-only extra, never a progressive-enhancement requirement.** Nothing may depend on it; a scriptless reader loses only the speed.

### 5. UNGATED. Popover elevation and pinned bars take `--border-strong`, never `--border`.

Not gateable: it would need a hand-maintained selector list, which is the mirror anti-pattern.

### 6. GATED by check:urls. URL protocols are allowlisted, SCHEMA AND RENDER.

Operator READ paths validate against the exported `SLUG_PATTERN`. `content/posts/<slug>.md` is stated ONCE, by the exported `postPath()`.

### 7. UNGATED. A gate that feeds a module its own stored output cannot see the TRANSPORT.

Live claims verify on the live path. **A boundary note is a CLAIM that ages**: nothing can check that a note is still true, so writing one is a convention, not a build failure.

### 8. GATED by check:headers. WORKERS CACHE IS ON, and the Worker's stamp IS the statement.

**The platform caches silence.** A response with no `Cache-Control` is CACHED under RFC 9111 heuristic freshness, not skipped. So `workers/app.ts` stamps `private, no-store` on any response that declares none: a route opts IN to sharing and never opts out of refusal.

**The cookie pairing:** a route that sets `Vary: Cookie` and receives a request carrying ANY cookie is downgraded to `private, no-store` and bypasses the shared cache. Presence of a cookie, not a particular cookie. Matrix: `dustinedwards/workers-cache-vary.md`.

**Those readers are served from a themed `caches.default` entry** keyed by request URL plus resolved theme, looked up before rendering. The wire is still `private, no-store` for anyone carrying a cookie. The theme is in the KEY and not a `Vary` because `caches.default` carries no headers (rule 20). A request preferring anything over HTML skips both lookup and store, via `negotiatesAwayFromHtml` in `app/lib/negotiate.mjs`.

**The enumeration of what the theme may change is the GATE'S**, `maskTheme` in `scripts/check-browser.mjs`, never this file's. Rule 17.

### 9. GATED by check:features for the inventory, UNGATED for the law and the door. PROGRESSIVE ENHANCEMENT, not "zero JS".

`content/enhancements.json` is reconciled in both directions by `check:features`. The admin plane is exempt. Law: `progressive-enhancement.md`.

**An enhancement loads as a nonced module script tag, never a React effect**, because the public plane does not hydrate (rule 4). Works without script, fast with it, and both halves are instrumented.

**THE DOOR IS ON THE PUBLIC PLANE AND OBEYS THE LAW.** `/login` is unauthenticated, so it is a public reading route and its form works with scripting off, even though everything behind it is exempt.

**A slogan is not the rule.** "Zero JS" is forbidden phrasing: it is false in both directions, because enhancements are allowed and the fallback is mandatory.

### 10. GATED by check:invariants for the tenth class, UNGATED for the rest. A PASS COUNT IS NOT COVERAGE. Count assertions that CAN FAIL.

Ten named classes: unfailable conditions, unreachable thresholds, zero-scope searches, unanchored needles, over-wide exclusions, empty alternations, source-counted floors, comment-satisfied anchors, alias-blind scans, helper-signature drift. Only the tenth is gated.

The disciplines, which are the operative half:

- **Prove scope non-empty.** A search over an empty scope reports what a clean sweep reports.
- **Anchor every needle.** An EMPTY needle matches every line and returns a plausible number.
- **Enumerate inside exclusions.** An exclusion naming a file excludes everything in it.
- **Guard derived-list patterns.** An empty alternation matches the empty string.
- **Measure floors THROUGH the gate's own pipeline**, never by summing.
- **Count matches, not containers.**
- **Strip comments before matching.** A comment has both satisfied and failed an assertion.
- **Resolve bindings, not spellings.**
- **One helper name, one argument order.** Gated: `check:invariants` section 17.
- **Re-measure carried claims.** This one has corrected an auditor, a prompt, and the ruling log.
- **A declared token must participate in a measured pair.**
- **A GATE'S EXPECTED VALUES ARE NEVER PRODUCED BY THE PROCESS IT CHECKS.** Fixture independence.
- **Verify a needle at the BYTE level.** A `\b` can reach disk as 0x08 and display correctly while matching nothing.
- **After any scripted edit, grep for leftovers and diff against the pre-edit copy.** A zero exit and a changed byte count are not evidence the edit did what it claimed.
- **Never read a result through `head` or `tail`.** A truncated answer is indistinguishable from a clean one.

Method and worked cases: `VERIFICATION.md`.

### 11. GATED by check:invariants. `app/db/schema.ts` IS the source of truth.

Section 4 binds schema.ts to the migrations to the live database. It compares COLUMNS with their types and INDEX NAMES with their column order; it does NOT compare a partial predicate, a collation or a direction, so `media_trashed_idx` is partial in SQL and unqualified here.

Prefer the query builder over raw SQL. **`search_docs` is the asserted exception:** modelled for the schema comparison, read ONLY in raw SQL, because section 8 owns its visibility rule and section 6 knows only `posts`. Section 4a bans it and names the exit.

### 12. UNGATED. A new gate is tested by REPLAYING THE DEFECT it was written for.

EXIT 1 IS NOT EVIDENCE, both ways: **a plant is proven applied before any result is read.** `check:migrations` is the recorded plants-only exception.

- **A dichotomy inherits its author's frame.** Before resolving an either-or by measurement, check the question's own scope assumption against the artifact.
- **A surface recolor ruling must enumerate the POSITION**: `position: absolute` overlays that only render against that surface are invisible in the ordinary render and in every screenshot of it.
- **When a file carries uncommitted work, revert a plant by TARGETED EDIT, never `git checkout`.**
- **A refactor proves equivalence by DIFFERENTIAL, not by reading.** Run old and new over REAL inputs and compare. Then prove the comparison can DISCRIMINATE by running a knowingly different implementation through it; a differential that cannot tell two things apart agrees with everything.

### 13. UNGATED, class only; all instances resolved.

A fallback that SUBSTITUTES A DIFFERENT VALUE is not failing closed. The two justified instances, `REMOTE_ARGS ?? []` and the rate-limit client IP, are each marked `JUSTIFIED SUBSTITUTION` at their call site, which is what `check:invariants` section 15b counts. In `app/` the class is stronger than a lint anyway, because a map keyed by its own union is a typecheck failure; in `scripts/` it is unenforced, the accepted cost.

### 14. GATED by check:migrations. Migrations are hand-written, drizzle-kit is deliberately absent, and an applied migration is never edited.

`check:migrations` hashes every file against the manifest, both directions.

### 15. UNGATED. Do not modify `.claude/settings.json` without explicit instruction.

It decides whether the other rules are enforced at all, so an agent changing it can silently disable its own constraints and the change looks like configuration rather than policy. A rule whose whole content is "do not edit this without being told" is enforced by being read.

### 16. GATED by ship. The ship contract: CI for this sha, token before build, Ask converged last.

In `scripts/ship.mjs`, each step failing closed and none optional. Procedure around it: the `ship` skill.

- **CI concluded success for the EXACT HEAD sha.** No run, still running, any other conclusion, or an unreachable API all refuse. There is no override flag, because a flag would be used on exactly the day the check was right.
- **`OPERATOR_TOKEN_FILE` is checked BEFORE the build.** A missing token is fixable in a second and must not cost a deploy that has already run its gates.
- **The Ask index is brought into step LAST**, after the deploy and the D1 sync, and a failure there is LOUD while the deploy STANDS.
- **The D1 sync carries the DRIFT REPORT.** The write runs regardless, because converging D1 to the build is the repair. RENDER DRIFT exits nonzero after the deploy stands and names a pipeline defect rather than staleness.
- **The watchdog Worker deploys here too**, after readiness, because it binds to the site and must not be pointed at a build this run has not proven. A failure is a MISS, not a refusal.
- **UNGATED, process class: a ship window owns the tree from its first step to its last.** Nobody edits the working tree or lands on `main` while one is open. No gate can see this.

### 17. UNGATED for the class, GATED by check:features for the colophon's feature prose. ONE OWNER PER FACT.

A measured value lives in the gate that measures it, or nowhere. Prose may POINT AT the gate; it may not restate the value. A pointer carrying no digits is the preferred form.

The test before writing a number down: can something re-run and re-derive it. If yes it belongs there and nowhere else. If no, it is a dated observation and says so, with its date.

**Prose may carry REASONING; it may not carry a NUMBER or a TENSE-BOUND STATE CLAIM that a gate does not own.** A why survives its mechanism changing; a state claim is a measurement in the present tense and rots on a count's schedule.

**Published posts are the exception.** An article is a DATED RECORD, so it may carry numbers with the date and conditions beside them, but not as a standing property. When a figure moves, the old one is KEPT as the earlier dated measurement.

`check:features` refuses a digit in a feature sentence. It cannot read tense, so it enforces the half a regex can see.

### 18. UNGATED. Indexes converge toward the repo, never the reverse.

D1, both FTS indexes, the Ask index, the media table and the social cards are DERIVED. The repository and the bucket are the sources.

- **A derived store is repaired THROUGH ITS DERIVATION, never by a hand-written INSERT.** A hand insert makes the index a second truth. Enforced for D1 by `.claude/hooks/no-direct-deploy.sh`.
- **A failed index write NEVER reverts the source.** The write that succeeded stands and the failure is reported.
- **D1 holds the only rendered copy and is still derived.** One door, `renderAndWrite`; one bulk form, `regenerateAllFromRepo`. The `content-drift` health check converges `posts.source_blob_sha` to the repository, so a markdown commit from any machine is live within one poll with no deploy.

No gate can see how a row got where it is, which is what makes this UNGATED. The gates see DRIFT, which is the symptom.

### 19. GATED by check:policy. Money paths refuse foreign origins and spend in cheapest-first order.

**The order is ORIGIN, then RATE, then CACHE, then BUDGET, then MODEL.** Named rather than sloganised, because "cheapest first" is satisfied by many wrong arrangements. Each stage refuses before the next spends anything.

**AN ABSENT `Origin` HEADER IS ALLOWED**, because a scriptless form post carries none and refusing it would break the no-script door rule 9 requires. What is refused is an `Origin` that is present and foreign.

`check:policy` asserts the chain by POSITION in the route's own body, comments stripped. Asserting that a stage merely EXISTS would pass on an arrangement that runs it after the money is spent.

**REMOVED 2026-08-02: the orphaned-assets rule.** Its number is retained and never reused.

### 20. UNGATED. A MANUAL CACHE KEY CARRIES EVERYTHING THE BODY DEPENDS ON.

`caches.default` carries no headers, so a stored body must be a pure function of the key. **A new input to the body goes in the key**, or every stored entry stays live, stale and unreachable: there is no purge door and `workers.dev` has no zone. Use a synthetic key parameter, never served. **Invalidation is PER-COLO and PARTIAL**: check the whole closed set, or a cold key, and say which.

## Workflow

Mainline only until the DNS cutover, ratified 2026-07-29. No feature branches, no PRs. Everything lands on `main`, committed and pushed immediately. Never leave work uncommitted or a commit unpushed. **The gates are the review.** The order they run in, and everything between a clean tier and a deployed sha, is the `ship` skill.

**RENOVATE PRs ARE THE ONE EXCEPTION TO MAINLINE-ONLY, AND SESSIONS DO NOT MERGE THEM.** Ruling 33. The dependency policy is one file, `github>DrDustinEdwards/renovate-config`, extended by this repo's `renovate.json` and by the two MCP repos; the policy lives there and not here, so a change reaches three repos at once. Renovate opens branches and PRs, which the paragraph above otherwise forbids, and that is the point: a dependency bump is the one change whose diff is worth reading before it lands rather than after. The seat triages each PR and Dustin merges; automerge is off everywhere until somebody has watched CI catch something, because CI green is a claim until then. **A red Renovate PR is a REPORT, not a fix-in-place.** Editing the code on the bot's branch converts a signal about a dependency into a change that was never reviewed against `main`, and Renovate will recreate the branch anyway; the repair is a scoped commit on `main` and letting the bot rebase onto it.

**THIS FOLDER IS THE MAIN CHECKOUT AND IT IS THE SITE SESSION'S ALONE. Ruling 60.** Every other actor works in a worktree under `C:\Users\email\dev\worktrees\`, on its own branch, and lands by PULL REQUEST on green CI. The site session holds `main` here and keeps landing directly on it, which is what the paragraph above describes; nobody else does either thing.

Ruling 45 said one clone per actor and was not enough, because it said nothing about WHERE. Twice the shared tree was taken out from under a running session: once with ~150 uncommitted lines, which were lost, and once on 2026-09-10 mid gate-run, which cost that session its local tier twice and made five gate failures unreadable, since the run was reading another branch's files. A session cannot tell "this gate is red" from "somebody checked out a different branch under me" without stopping to re-establish the baseline. A named directory makes the answer visible in `git worktree list` before anybody writes anything.

**THE PR CLAUSE IS THE HALF THAT PROTECTS `main`.** An actor in a worktree is not the mainline's writer, so its work arrives as a diff somebody reads, on CI that has already run. That is the same exception Renovate has and for the same reason. The one merge that landed here without it, PR #30 on 2026-09-08, was RED on `main` and was made green incidentally by the next session's unrelated commit.

**The tell, and it is worth knowing by heart:** if a session rebases onto commits it did not expect, or reads a commit title describing work it was about to do, or finds its own edits absent from disk, that is not a merge conflict. Stop and re-establish the baseline before writing anything.

- **`npm run deploy` builds from the WORKING TREE, not from HEAD.** A dirty tree at deploy time is a deploy nobody can reproduce. Blocked by a hook; `npm run ship` is the only door.
- **Every gate verifies DISK, not HEAD.** A gate can be green while its subject is uncommitted.
- **`git diff <path>` before `git add <path>`.** A named path is not a scoped change if the file carries edits you did not write.
- Destructive operations stay with Dustin. Anything touching money paths or auth secrets is flagged before it lands.

The four PreToolUse hooks in `.claude/settings.json` are what enforce this rather than the prose above: em dashes, unscoped adds, lint and content before a push, and the deploy door. Each hook file carries its own grounds. They cannot fire on a command typed into a terminal, so CI remains the backstop.

**WHICH TOOLS THEY FIRE ON IS THE MATCHER'S STATEMENT, and `check:hook-matchers` owns it.** A matcher enumerates tool names, so it goes stale whenever the harness gains one, and it fails OPEN: a tool the matcher does not name is a tool every hook here is blind to, because not one of them reads `tool_name`. That is not hypothetical twice over. The em dash hook matched only `Write|Edit` until 2026-08-14, and every hook matched only `Bash` until 2026-09-15, while pre-approved `PowerShell(...)` rules sat in the same directory: for 59 days the deploy door, the scoped-add check and the pre-push lint were all one tool name away from being skipped with no prompt. The gate reads the matchers against the permission allow lists and refuses a tool name it has not been told how to classify. What it cannot know is named in its own header: the harness tool list is not in this repo.

## Commands

**`package.json` OWNS THE SCRIPT LIST.** Run `npm run` for it. Counts, timings and what each gate asserts live in `core.md` and `publish-pipeline.md`. What the list itself does not carry:

- `npm run check` is the OFFLINE tier, which is what `ship` runs. `check:all` adds the gates needing a deployed database or bucket. `check:ci` is the tier a clean checkout can run.
- `npm run verify-live` is NOT a gate. It needs a deploy and its Ask probes are billed.
- `check:backup`, `check:invariants`, `check:llms` and `sync:content` take `--local` or `--remote`. `check:media` is NETWORK ONLY, because `--local` reads an empty bucket and reports false drift.
- `check:admin-ui -- --update` rewrites the baseline, deliberately loud.
- `check-all.mjs` DERIVES the gate list from `package.json` and refuses below `MINIMUM_GATES` or on an untiered gate, so adding a gate means editing that file in the same commit.
- Migrations apply through wrangler directly: `wrangler d1 migrations apply dustinedwards [--local|--remote]`.
- **Debugging a local run: `wrangler dev` exposes `/cdn-cgi/explorer/api`**, an OpenAPI surface carrying read-only traces and logs. Query it before adding a `console.log`.

## Bindings

Read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

    DB  APP_KV  MEDIA  MEDIA_BACKUP  OG  ASSETS  IMAGES  AI_SEARCH  ASK_BUDGET  ANALYTICS

**`ASK_BUDGET` IS THE WHOLE SITE'S RATE LIMITER, not an Ask-only budget.** The
name is where it started and is now wrong: `auth:`, `op:`, `wm:`, `health:`
and `csp:` instances all meter through the same Durable Object class, so
removing it disables sign-in rather than Ask. **It is deliberately NOT being
renamed before the cutover**, ruled 2026-09-11 after the pre-cutover audit
raised it: a DO class rename is a three-deploy rollout with a non-atomic
window, every deploy here is a ship run gated on green CI for its exact sha,
and during that window sign-in fails, `/api/health` answers 503, and the
watchdog that wakes on the 503 cannot repair because its own call is metered
by the same object. The grounds, and the three-deploy sequence if it is ever
done, are in `wrangler.jsonc.example` beside the binding.

What each one is, and the queue consumer and cache flag beside them, is `wrangler.jsonc.example`, which `check:invariants` section 26 binds to this list in both directions.

**`wrangler.jsonc` is gitignored and `wrangler.jsonc.example` is tracked.** A PORTFOLIO rule, not this repo's choice: do not "fix" it by committing the real file. **Adding a binding means editing BOTH files in the same commit**; `check:config` compares them in both directions and CI cannot run it, because a checkout bootstraps the example into place and the two are then equal by construction.

**A second Worker, `workers/watchdog.ts`**, on the identical split, reconciled by the same `check:config`, deployed by a `ship` step and never by `npm run deploy`. A Worker cannot `fetch()` this site, which is why `SITE` is a binding.

**`OPERATOR_TOKEN` has three holders**: the site Worker, the watchdog, and the `gh` repository secret. No gate can see a secret's VALUE, so a stale copy fails in the worst direction: a watcher that still polls and alerts and can no longer repair. Rotate all three or none.

## Where everything else lives

In this repo, because a gate can reach it: `FAILURES.md` (recurring failure shapes, read it at session start, gated for length), `VERIFICATION.md` (how to prove a deploy, a claim or a gate; the method behind rules 7, 10 and 12), `RECOVERY.md` (rebuild the account from nothing), `docs/RUNBOOK.md` (fix a broken site at 2am; bound to `REQUIRED_SECRETS` by `check:invariants` section 27), `CUTOVER.md`, `README.md`. Skills live in `.claude/skills/<name>/SKILL.md`; a flat `.md` at that path is never loaded.

Everything else is a Capsid document in the `dustinedwards` namespace. Start a session with `brief("dustinedwards")`, or read `capsid/conventions.md` then `dustinedwards/core.md` by hand, before touching code. `core.md` is current state; `decisions-vol-*.md` is the ruling log and holds the grounds for everything above. Sessions READ Capsid and never write it.
