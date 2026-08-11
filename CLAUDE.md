# CLAUDE.md - dustinedwards.info

Personal platform and Cloudflare showcase for Dustin Edwards. React Router 8 (SSR) on Cloudflare Workers, Drizzle on D1, Better Auth, R2 for media. Also the flagship site and a Capsid CMS consumer.

**This file holds only what a session needs BEFORE it can read anything else.** Everything durable lives in Capsid. If a fact is in both places, Capsid wins and this file is the defect.

## Session ritual

Start: `brief("dustinedwards")`, or read `capsid/conventions.md` then `dustinedwards/core.md` by hand.
End: write a `session-YYYY-MM-DD.md` episodic (type `episodic`, under ~2KB) to the dustinedwards namespace.

Do this before touching code. It is not a formality: the recurring failure in this repo is a session acting on a stale claim it could have checked in one call.

## Hard rules

**The rules are NOT in this file. They are in `dustinedwards/core.md`, one list of fifteen.** Read them there. Restating them here is how they drifted: nineteen rules across two files, four duplicate pairs, three of them false as written. Ruling: `dustinedwards/decisions.md`, 2026-08-07.

**The numbering is FROZEN and append-only.** `scripts/check-invariants.mjs:47` cites "hard rule 11" by number, so renumbering breaks a code comment. New rules take the next number; a retired rule keeps its number and is marked REMOVED.

Each rule is marked ONE-LINER (a gate enforces it, and the gate is the detail) or PROSE (no gate can see it, so read it). What could be gated and is not: `dustinedwards/gate-backlog.md`.

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
    npm run check:claude-md              this file: size, and the hard-rules pointer near the top
    npm run check:secrets                the secret-handling boundary, by path, both directions
    npm run check:assertions             lints the other gates for assertions that cannot fail,
                                         and asserts every gate states its OBSERVATION BOUNDARY
    npm run check:hooks                  .claude/settings.json wiring. Reads, never writes
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

**Adding a binding means editing BOTH files in the same commit.** `npm run check:config` compares them and fails in both directions. It is the only thing binding the example to what actually runs, the real file exists on one machine, and there is no CI, so it is load-bearing and easy to skip.

## Where everything else lives

All paths are Capsid documents in the `dustinedwards` namespace unless marked.

    core.md                    status, the fifteen hard rules, gate counts, what is deployed
    decisions.md               active ruling log. decisions-vol-1.md is frozen
    gate-backlog.md            what could be gated and is not, ranked
    verification-method.md     how to prove a deploy, a claim, or a gate

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

**Security headers and the Report-Only CSP are live.** Full subsystem in `security-headers.md`: both phases, the nonce chain, the report sink, and the one thing blocking enforcement. Source of truth is `workers/app.ts`, with `scripts/check-headers.mjs` bound to the ratification.

The chart and diagram authoring contract for authors is `.claude/skills/charts/SKILL.md`, in this repo. Skills resolve as `<name>/SKILL.md`; a flat `.md` at that path is never loaded.
