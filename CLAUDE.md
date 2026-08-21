# CLAUDE.md - dustinedwards.info

Personal platform and Cloudflare showcase for Dustin Edwards. React Router 8 (SSR) on Cloudflare Workers, Drizzle on D1, Better Auth, R2 for media. Also the flagship site and a Capsid CMS consumer.

**This file holds only what a session needs BEFORE it can read anything else.**

**PRECEDENCE, corrected 2026-08-21, because the old sentence now contradicts this file's own hard-rules section.** It read: "Everything durable lives in Capsid. If a fact is in both places, Capsid wins and this file is the defect." That was true while Capsid held everything durable. It stopped being true when the fifteen hard rules and `VERIFICATION.md` moved into this repo, and they moved for a reason that decides the precedence question:

**CAPSID CANNOT BE GATED, BECAUSE EVERY GATE VERIFIES DISK.** So:

- **The REPO wins for anything a gate can verify**, and for anything the code cites: the hard rules, gate counts, the current shape of the code. A count copied into Capsid rots silently; the same count in `check-all.mjs` is the only copy that can be wrong and be caught.
- **CAPSID wins for rulings, reversals and the measurements that forced them.** None of that survives in code comments, and the reversal log is the half of the store worth its storage.

Where they disagree ON A GATED FACT, the repo is right and Capsid is stale. Where they disagree ON A RULING, Capsid is right and this file is the defect. That is the same rule as before, scoped rather than reversed.

## Session ritual

Start: `brief("dustinedwards")`, or read `capsid/conventions.md` then `dustinedwards/core.md` by hand.

Do this before touching code. It is not a formality: the recurring failure in this repo is a session acting on a stale claim it could have checked in one call.

**There is no end-of-session write. Sessions READ Capsid and never write it**, per `dustinedwards/core.md`. This file asked for a `session-YYYY-MM-DD.md` episodic at the end and had done since the ritual was written, which contradicted that rule outright. Capsid wins and this file was the defect, exactly as the paragraph above the ritual says. Removed 2026-08-18, after a session stopped on the conflict rather than resolving it in its own favour. Do not re-add it here: if the standing rule changes, it changes in Capsid first and this file follows.

## Hard rules

**THIS FILE IS THE ONE HOME, since 2026-08-21.** They lived in Capsid and were pointed at from here. Capsid cannot be gated, because every gate verifies disk, so the rules that the code cites by number sat in the one place no assertion could reach. Fourteen source files cite them; `check:invariants` section 15 now binds every cited number to a rule that exists here.

**Recovered rather than rewritten.** The 2026-08-21 `core.md` rewrite dropped the list while telling readers it lived here, so for a period it existed in no current document. The text below was transcribed from the last core.md that carried it. **Diff it against Capsid core.md version 1684 before treating any single clause as exact.**

Each rule is ONE-LINER (a gate enforces it, and the gate is the detail) or PROSE (no gate can see it, so read it). What could be gated and is not: `dustinedwards/gate-backlog.md`.

**Numbering is APPEND-ONLY but no longer frozen.** Nothing pins a number to a line any more; see the note after rule 15.

### 1. ONE-LINER. Every public read goes through `publiclyVisible()`.

`check:invariants` sections 2, 6 (alias-resolving, two named exemptions) and 8 (every `search_docs` reader composes `visibilityClause()`).

### 2. ONE-LINER. `wrangler d1 export` is BROKEN here.

Per-table backups via `check:backup`. FTS `DELETE FROM` is gated by section 7; the repair is `('rebuild')`.

### 3. ONE-LINER. Secrets are read only inside the server boundary.

`check:secrets`, both directions, per-root floors.

### 4. PROSE. Keep the Worker lean; inline SVG over an icon library.

CodeMirror is lazy-split. Client auth is imported by `/login` alone.

### 5. PROSE. Popover elevation and pinned bars take `--border-strong`, never `--border`.

Not gateable: it would need a hand-maintained selector list, which is the mirror anti-pattern.

### 6. ONE-LINER. URL protocols are allowlisted, SCHEMA AND RENDER.

`check:urls`. Operator READ paths validate against the exported `SLUG_PATTERN`, and `content/posts/<slug>.md` is stated ONCE, by the exported `postPath()`.

### 7. PROSE. A gate that feeds a module its own stored output cannot see the TRANSPORT.

Live claims verify on the live path. **A boundary note is a CLAIM that ages**: two have gone false since being written, one of them falsified in the same commit that wrote it.

**Boundary-note presence is NO LONGER GATED, since 2026-08-21.** `check:assertions` asserted it and was deleted in audit tier 4.1. Presence was all it could ever assert, and this rule's own second sentence is why that was never the valuable half: nothing can check that a note is still TRUE. The 34 notes stay and are worth writing. Writing one is now a convention, not a build failure.

### 8. ONE-LINER. WORKERS CACHE IS ON. A response with no `Cache-Control` is CACHED, not skipped.

The `private, no-store` default is asserted three ways.

### 9. PROSE for the law, ONE-LINER for the inventory. PROGRESSIVE ENHANCEMENT, not "zero JS".

`content/enhancements.json` is reconciled in both directions by `check:features`. The admin plane is exempt. Law: `progressive-enhancement.md`.

### 10. PROSE. A PASS COUNT IS NOT COVERAGE. Count assertions that CAN FAIL.

Ten named classes: unfailable conditions, unreachable thresholds, zero-scope searches, unanchored needles, over-wide exclusions, empty alternations, source-counted floors, comment-satisfied anchors, alias-blind scans, helper-signature drift.

**THE DISCIPLINES. Restored 2026-08-21 from Capsid `core.md` version 1684, where the rewrite of the same day dropped them entirely.** These are the operative half of the rule: the classes name what goes wrong, and these say what to do.

- **Prove scope non-empty.** A search whose scope is empty reports what a clean sweep reports.
- **Anchor every needle**, because `check:head`/`check:headers` and `check:content`/`check:contrast` are prefix pairs. **An EMPTY needle matches every line and returns a plausible number** (measured 2026-08-20).
- **Enumerate inside exclusions.** An exclusion that names a file excludes everything in it.
- **Guard derived-list patterns.** An empty alternation matches the empty string.
- **Measure floors THROUGH the gate's own pipeline**, never by summing.
- **Count matches, not containers.**
- **Strip comments before matching.** A comment has both satisfied an assertion and failed one.
- **Resolve bindings, not spellings.**
- **After a plant's restore, diff against the pre-plant commit.**
- **One helper name, one argument order.** Gated, uniquely: `check:invariants` section 17.
- **Re-measure carried claims.** That discipline has corrected an AUDITOR, a PROMPT, and the RULING LOG ITSELF.
- **A declared token must participate in a measured pair**, which is `check:contrast`'s participation assertion.
- **A GATE'S EXPECTED VALUES ARE NEVER PRODUCED BY THE PROCESS IT CHECKS.** Fixture independence, and it is what justifies `check:logo` and `check:contrast` existing in the shape they do: `scripts/fixtures/icon-suite.json` is deliberately NOT generator output.

Only the tenth class is gated. The rest are METHOD, which is what they always were. See `VERIFICATION.md`, in this repo.

### 11. ONE-LINER. `app/db/schema.ts` IS the source of truth.

`check:invariants` section 4 binds schema to migrations to the live database. Prefer the query builder over raw SQL. **Section 5 was DELETED on 2026-08-16**: its regex could desync on a regex literal and examine nothing while printing a clean result. Do not rebuild it as regex.

### 12. PROSE. A new gate is tested by REPLAYING THE DEFECT it was written for.

EXIT 1 IS NOT EVIDENCE, and it runs BOTH WAYS: **a plant is proven applied before any result is read.** A green run after a failed plant proves nothing; a mangled path once made a plant a silent no-op and the gate went green. `check:migrations` is the recorded plants-only exception.

**A DICHOTOMY INHERITS ITS AUTHOR'S FRAME.** Before resolving an either-or by measurement, check the question's own scope assumption against the artifact: a plant proves something about what it plants against, and the framing chose the target before any evidence was taken. Restored here 2026-08-21 as a NAMED discipline; the case that produced it is in `VERIFICATION.md`, which is the right split, because the rules are the index and the method file carries the evidence.

**A SURFACE RECOLOR RULING MUST ENUMERATE THE POSITION: `position: absolute` overlays that only render against that surface.** Restored 2026-08-21, and it existed in NO current document. This is how the skip-link-on-purple-chrome defect was classified: a recolor ruling that lists the components it repaints will miss anything whose only appearance is over the recolored surface, because such an element is invisible in the ordinary render and in every screenshot of it.

**When a file carries uncommitted work, revert a plant by TARGETED EDIT, never `git checkout`.** Skipping this once duplicated a lint rule whose stale copy then mis-guarded a plant.

### 13. PROSE, class only; all instances resolved.

A fallback that SUBSTITUTES A DIFFERENT VALUE is not failing closed. Known-justified: `?? "system"` on the theme, `REMOTE_ARGS ?? []`, each marked `JUSTIFIED SUBSTITUTION` at its call site.

**The lint form is GONE since 2026-08-21**: `check:assertions` rule (e) enforced it and the gate was deleted in audit tier 4.1. In `app/` this class is stronger than a lint anyway, because a map keyed by its own union is a typecheck failure. In `scripts/` it is now unenforced, and that is the accepted cost.

### 14. ONE-LINER. Migrations are hand-written, drizzle-kit is deliberately absent, and an applied migration is never edited.

`check:migrations` hashes every file against the manifest, both directions.

### 15. PROSE. Do not modify `.claude/settings.json` without explicit instruction.

**UNGATED since 2026-08-21**, and that is the rule's natural state. `check:hooks` read the file and never wrote it, and was deleted in tier 4.1: it could not see whether a hook RAN, only what the file declared, so a green run was compatible with enforcement being entirely off. A rule whose whole content is "do not edit this without being told" is enforced by being read, not by a gate that reads the same file back.

**OPEN, restored 2026-08-21 from Capsid version 1684 where it was dropped: seven repos still carry the fail-open `scoped-git-add.sh`.** This repo's copy was fixed; propagation to the rest of the portfolio has never been done. It is a live defect in seven repositories, not a status line, which is why it belongs in the rule rather than in a changelog.

**REMOVED 2026-08-02: the orphaned-assets rule.** Its number is retained and never reused.

**On numbering.** Append-only: a new rule takes 16, and a retired rule keeps its number and is marked REMOVED, so a citation never silently retargets. It is no longer FROZEN. It was frozen because one comment cited a rule by FILE AND LINE, so renumbering broke a line reference; that comment now cites the rule by number alone and section 15 binds the number to this file. Renumbering is still a bad idea and nothing needs it.

## Workflow: mainline only, until launch

Ratified 2026-07-29, scope THIS REPO ONLY, until the DNS cutover. Grounds: `dustinedwards/workflow-mainline.md`.

No feature branches, no PRs. Everything lands on `main`, committed and pushed immediately. Never leave work uncommitted and never leave a commit unpushed. **The gates are the review**, so they run before every push: `npx tsc -b`, then whichever checks the change touches.

Three things this repo has actually been bitten by, all in `core.md` with the measurements:

- **`npm run deploy` builds from the WORKING TREE, not from HEAD.** A dirty tree at deploy time is a deploy nobody can reproduce.
- **Every gate verifies DISK, not HEAD.** A gate can be green while its subject is uncommitted.
- **`git diff <path>` before `git add <path>`.** A named path is not a scoped change if the file carries edits you did not write.

Unchanged: destructive operations stay with Dustin, and anything touching money paths or auth secrets is flagged before it lands.

## Commands

Every script in `package.json`. Counts, timings and what each gate asserts live in `core.md` and `publish-pipeline.md`, deliberately not here.

    npm run dev
    npm run build
    npm run preview                      build, then vite preview
    npm run typecheck                    wrangler types + typegen + tsc -b
    npm run deploy                       build, then wrangler deploy
    npm run verify-live                  post-deploy sweep. NOT a gate: needs a deploy, Ask probes are billed
    npm run cf-typegen                   wrangler types alone
    npm run bootstrap:config             copy wrangler.jsonc.example into place, never overwrites
    npm run postinstall                  bootstrap:config + wrangler types

    npm run build:content                regenerate content/generated/posts.json
    npm run build:og -- --remote         render and upload social cards
    npm run build:diagrams [-- --force]  render :::diagram sources to public/diagrams/
    npm run build:stack                  regenerate content/generated/stack.json for the colophon
    npm run build:assets                 static asset derivation
    npm run sync:content -- --local|--remote   push the artifact into D1, rebuild the FTS index

    npm run check                        every gate, offline tier
    npm run check:all                    adds the gates needing a deployed database or bucket
    npm run check:content
    npm run check:config
    npm run check:search
    npm run check:policy
    npm run check:contrast
    npm run check:logo
    npm run check:charts
    npm run check:diagrams
    npm run check:admin-ui               -- --update rewrites the baseline, deliberately loud
    npm run check:urls
    npm run check:stack
    npm run check:features
    npm run check:headers
    npm run check:secrets                the secret-handling boundary, by path, both directions
    npm run check:migrations             sha256 of drizzle/*.sql against the manifest, both ways
    npm run check:tests                  node --test over test/. The one gate asserting BEHAVIOUR
    npm run check:head                   extracts a ref to a worktree and runs the offline tier THERE
    npm run check:invariants             -- --remote adds the live database
    npm run check:llms                   -- --remote for the live row
    npm run check:backup -- --local|--remote
    npm run check:media -- --remote      NETWORK ONLY. --local reads an empty bucket and reports false drift

    wrangler d1 migrations apply dustinedwards [--local|--remote]

`check-all.mjs` DERIVES the gate list from `package.json` and refuses to run below `MINIMUM_GATES` or on a gate nobody has tiered, so adding a gate means editing that file in the same commit.

## Bindings

Read off the request context via `getEnv(context)` from `app/lib/context.ts`. Never import bindings globally.

    DB          D1 database "dustinedwards"
    APP_KV      KV namespace (Better Auth sessions, Ask answer cache)
    MEDIA       R2 bucket "dustinedwards-media"
    OG          R2 bucket "dustinedwards-og" (social cards)
    ASSETS      static assets
    IMAGES      Images binding (media thumbnails, transforms on request)
    AI_SEARCH   AI Search instance "dustinedwards" (Ask, search Layer 2)
    ASK_BUDGET  Durable Object, class AskBudget (Ask per-IP limit, daily ceiling)

Plus a queue consumer for `dustinedwards-media-events` with its DLQ, and top-level `"cache": { "enabled": true }`.

**`wrangler.jsonc` is gitignored and `wrangler.jsonc.example` is tracked.** That is a PORTFOLIO rule (`capsid/conventions.md`, Public-repo hygiene), not this repo's choice; three other repos commit the real file and are tracked there as violations. Do not "fix" this one by committing it.

**Adding a binding means editing BOTH files in the same commit.** `npm run check:config` compares them and fails in both directions. It is the only thing binding the example to what actually runs, the real file exists on one machine, and **CI CANNOT RUN IT**: a checkout has no real config, `postinstall` bootstraps one by COPYING the example, so real equals example by construction and the gate cannot pass. It is in `CI_EXCLUDED` for that reason. So it stays load-bearing on exactly one machine and easy to skip, which is what it always was; the reason is now measured rather than "there is no CI".

## Where everything else lives

**In THIS REPO, because a gate can reach it and Capsid cannot:**

    CLAUDE.md                  the fifteen hard rules, above
    VERIFICATION.md            how to prove a deploy, a claim, or a gate. The method
                               behind rules 7, 10 and 12. Moved out of Capsid 2026-08-20
    RECOVERY.md                rebuilding every Cloudflare resource from nothing
    CUTOVER.md                 taking the apex off legacy WordPress. Harvested back
                               2026-08-21 from a Capsid cut that had deleted most of it
    README.md                  what the site is, for a reader who is not a session

All other paths are Capsid documents in the `dustinedwards` namespace.

    core.md                    current state only, under 8KB. NOT the hard rules: they are
                               above in this file, and NOT gate counts: those live in the repo
    decisions.md               active ruling log. decisions-vol-1.md is frozen
    gate-backlog.md            what could be gated and is not, ranked

    search-architecture.md     all three search layers, FTS5 and D1 constraints, Ask guards
    publish-pipeline.md        content model, the two writers, the gate family, social cards,
                               first-publish policy, version history, frontmatter URL fields
    operator-mcp-wrapper.md    the MCP layer above the operator API. BUILT, live, public
    media-module-architecture.md   the shipped media architecture
    colophon-page.md           the /colophon ruling and spec
    design-tokens.md           the palette and the six binding usage rules. LAW
    logo-spec.md               the mark. LAW
    chart-stack.md             :::chart and :::diagram rulings, both shipped
    progressive-enhancement.md the enhancement law and the fallback inventory
    workers-cache-vary.md      Vary, and the absent-header constraint the docs omit
    workflow-mainline.md       the git workflow ruling above
    blog-content.md            editorial plan and voice. seo-targets.md per-article targets
    admin-cockpit.md           auth, shell, data contract. admin-ux-backlog.md remaining intent
    concept-repo-operations.md git surgery gotchas for this machine

    capsid/conventions.md      portfolio rules
    capsid/repo-structure.md   the layer model, and the .claude/ directory contract

**Security headers are live and the CSP is ENFORCED, not Report-Only** (since `20c27d6`, 2026-08-17). Full subsystem in `security-headers.md`: both phases, the nonce chain, the report sink, and the nonce-versus-shared-cache tradeoff accepted to get here. Source of truth is `workers/app.ts`, with `scripts/check-headers.mjs` bound to the ratification.

The chart and diagram authoring contract for authors is `.claude/skills/charts/SKILL.md`, in this repo. Skills resolve as `<name>/SKILL.md`; a flat `.md` at that path is never loaded.
