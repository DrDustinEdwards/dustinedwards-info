# Standing rulings (not design)

Draft for the seat to file as `dustinedwards/standing-rulings.md`. Every non-design ruling still in force on 2026-09-23, one line each, with what enforces it. "Nothing" means no gate, hook or test enforces it; the line itself is the whole of the rule. The hard rules in CLAUDE.md are not repeated here. Design law is `design-law.md`.

## Webmentions
- **2** The public endpoint is bounded by a per-IP rate limit, a publicly visible target, one row per source and target, and a 500 open-row cap answered with 503. *Enforced by:* `app/routes/webmention.ts`, `test/worker/webmention.test.ts` (check:worker).
- **3** Verification runs in `waitUntil` with a restricted, timed, size-capped fetch, never through a queue. *Enforced by:* `verify.server.ts`, check:worker.
- **4** A mention row never stores the sender's IP, and /privacy says what is recorded. *Enforced by:* schema only. Nothing stops someone adding an IP column.
- **5** Mentions render as escaped text plus a validated http(s) anchor with `rel="nofollow ugc noopener"`: no avatars, images or source markup. *Enforced by:* `test/webmention-href.test.mjs`, check:browser mention cases.
- **8** Approved mentions appear only on the public post, under the post's own visibility. *Enforced by:* HR1 via check:invariants section 6.
- **9** Every post advertises `/webmention` in a link element and a Link header. *Enforced by:* `advertise.ts`, check:worker. (Its "derived from the request origin" clause is contradicted by the code's deliberate `SITE_ORIGIN`; see Contradictions.)
- **19** The operator token may approve or reject a mention; only an admin deletes one. *Enforced by:* `decide.server.ts`, `test/worker/operator-mentions.test.ts`, check:destructive.

## Caching, traffic, readiness
- **10** Writes (publish, unpublish, draft save, drift repair, mention decisions) purge their Cache-Tags, log on failure and never throw. *Enforced by:* `cache-purge.server.ts`, check:headers.
- **11** Public HTML is cached by Workers Cache behind a cache-off gateway keyed on path, query and theme, with no hand-built `caches.default` layer for HTML. *Enforced by:* `workers/app.ts`, `test/worker/cache-key.test.ts`, check:headers, HR8.
- **12** Readership is requests as the gateway sees them: no beacon, no client identifier. *Enforced by:* `recordTraffic` in `workers/app.ts`. (Its label and the admin CACHE_SENTENCE disagree; see Contradictions.)
- **56** Ship's readiness step gates only on checks no later ship step repairs. *Enforced by:* `scripts/lib/readiness.mjs` DEFERRED_CHECKS, `test/readiness.test.mjs`, HR16. (Merged 58 is not built; see Contradictions.)
- **49** A 422 from sync_posts is not repairable: repair stops, keeps the body and reports that a deploy is needed. *Enforced by:* `app/lib/health/repair.mjs`, `test/health-repair-refusal.test.mjs`.

## Build, media, dependencies
- **27** Every editor route links the KaTeX stylesheet unconditionally. *Enforced by:* check:page-payload.
- **34** Markup bytes declared as a raster type are refused with 415. *Enforced by:* `upload-contract.mjs`, `test/upload-contract.test.mjs`.
- **39a** `stack.json` is a build product, never committed. *Enforced by:* check:stack, `.gitignore`.
- **39b** Node moves only by hand, with `engines.node` and `.nvmrc` in one commit. *Enforced by:* renovate-config, check:invariants.
- **40** Both Workers keep traces off; only logs go to Sentry. *Enforced by:* check:config.
- **42** The six load-bearing packages are never grouped: react-router and Cloudflare tooling automerge patch and minor, better-auth and wrangler patch only, katex never. *Enforced by:* renovate-config `default.json`.
- **64** Paper twins are gitignored build products, with the text committed in `data/publications.text.json` and bound to each PDF's sha256. *Enforced by:* check:publications.
- **127.1** Every file a reader, crawler or agent can download is named `dustin-edwards-...`, with redirects from old names. *Enforced by:* check:asset-names, check:media.
- **130.1** Feeds, `sitemap.xml`, `robots.txt`, `llms.txt`, `.md` twins, `favicon.ico`, `site.webmanifest` and `_headers` keep their fixed names. *Enforced by:* `scripts/lib/asset-names.mjs` exemptions.
- **53** A slug rename and its redirect land in one push, or the redirect ships first. *Enforced by:* check:urls catches a dropped redirect but not a late rename. (core.md's "renames need no redirects" contradicts this; see core-md-changes.md.)
- **50** No `rel="me"`, social links or fediverse or Bluesky surface; social lives on germomics.com. *Enforced by:* check:microformats FORBIDDEN_HOSTS.

## Gates and tokens
- **23** Every counting gate prints its floor, check:floors fails a floor more than the tolerance below its count, and every hook passes a syntax check. *Enforced by:* check:floors, check:hook-syntax.
- **51** check:head's nested tier skips check:worker, which CI runs on the same sha. *Enforced by:* `scripts/check-head.mjs`.
- **94** Disabled states carry no contrast floor; failing ratios are recorded in NON_PARTICIPATING. *Enforced by:* check:contrast.
- **101** A check:logo assertion is never removed to let a defect through. *Enforced by:* check:logo.
- **103** Every carried token names its owner, and the map is empty by 2026-11-30; moving the date takes a ruling. *Enforced by:* check:invariants section 31.
- **104** A token named only inside `scripts/check-*.mjs` is not in use. *Enforced by:* check:invariants section 31.
- **105** A carried token whose owner shipped without it is deleted. *Enforced by:* check:invariants section 31 (partly).
- **119.3** Every route has a payload ceiling. A raise lands with its reason and an expiry, is never the default answer, and no fixture imports a public sheet. *Enforced by:* check:page-payload.
- **120.6** The redesign payload uplift ends 2026-11-30 with no blanket renewal. *Enforced by:* check:page-payload `UPLIFT_EXPIRES`.

## The machine contract
- **119.1** Every public page renders all content, data, citations, dates and structure in server HTML, complete without script, and keeps its `.md` twin, llms.txt entry, JSON-LD and microformats. *Enforced by:* HR4, HR9, check:page-payload, check:features.
- **119.2** A public page may run hand-written modules; never hydration or React. CSS geometry is not script. *Enforced by:* check:page-payload hydrate set.
- **119.5** A client-side filter writes its state to the query string. *Enforced by:* nothing.
- **119.6** No public instrument hydrates. A future instrument page is paper plus a named module and a server-rendered fallback. *Enforced by:* check:page-payload.

## How work runs
- **29** Anything that ends in Dustin's hands and is not a decision is a defect. Ship pulls fast-forward, refuses while a gate run is alive, and states HEAD and its CI verdict. *Enforced by:* `ship.mjs` step 0; the directive itself is not gated.
- **60** The main checkout is the site session's alone. Every other actor works in `dev/worktrees/<actor>` on its own branch and lands by PR. *Enforced by:* nothing (CLAUDE.md prose).
- **20** Deploy commands are blocked only inside the site repo; the d1 arms stay global. *Enforced by:* `no-direct-deploy.sh`, check:hook-scope.
- **102** A job that changes an existing route names the file and quotes what is there now. *Enforced by:* nothing.
- **106** Sessions only read the Claude Design MCP; canvas writes go through DesignSync. *Enforced by:* nothing.
- **107** No agent calls the MCP sharing or member tools. *Enforced by:* nothing.
- **109** `guidelinesGlob` is an explicit non-empty list, and generated guidelines stay gitignored. *Enforced by:* check:guidelines.
- **110** Canvas work lives only in `part-a/`, `part-b/`, `part-c/`, `references/`, `uploads/` and `github.md`, and no re-sync deletes them. *Enforced by:* `.design-sync/NOTES.md` line.
- **111** `SHEETS` matches the stylesheets root.tsx and the public routes load. *Enforced by:* check:design-sheets.
- **114** `aislop fix --safe` never runs here. *Enforced by:* nothing.
- **119.7** A suspension is a dated commit naming the ruling, the live selector it restores and the gates retargeted in the same commit. *Enforced by:* nothing.
- **120.2** A job cites its handoff and adds only rulings and proofs. *Enforced by:* nothing.
- **120.3** Copy and token tweaks ride the site session on main; first-screen chrome, hydration and payload take the full process. *Enforced by:* nothing.
- **120.4** Two independent readers only for law cuts and first-screen chrome. *Enforced by:* nothing.
- **129** A session reads core.md, CLAUDE.md, the job and the rulings it cites, and runs only the checks covering what it touched. *Enforced by:* check:changed, CLAUDE.md.

## Pending (decided, not done)
- **38** An editorial queue and the home sentence. Done when `editorial-queue.md` exists and Dustin supplies the sentence.
- **59** The agent principal in the site's audit log. Done when the MCP repo ships it.
- **65** The redesign, then cutover. Done at cutover.
- **86** A composited-contrast sampler in check:browser. retired-2026-09.md says it exists; it does not.
- **88** Revisit gates 4 and 3d. Done when the vol 19 revisit is held.
- **122.4** Delete the chrome role tokens (`--surface-chrome`) and retarget build-og.mjs.
- **122.5** A closed color gate, and the carried map empty by 2026-11-30.
- **125.5** Video in the plate style. Done when Dustin opens that project.
- **131** Drivers may run live D1 and R2 writes after a backup check, in force now through the deploy hook. Revisit at the domain move; CUTOVER.md has no such step yet.
- **133.1 and 133.3** Numeral-free home headings and the typecheck stop hook skip. Done when PR #83 merges.

## Unsure
- **120.8** The llms.txt look paragraph is done. "Ask prefers the `.md` twin in citations" is not in the code, and nothing makes a session run verify-live after a cache-key change.
- **130.2** The one-time D1 update of 57 media rows needs a remote D1 read to confirm.
- **133.4** Unattended-run guidance for headless /improve lives in the claude-skills repo and was not checked from here.
