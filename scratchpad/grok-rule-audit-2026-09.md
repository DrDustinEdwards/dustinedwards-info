# Rule audit, 2026-09-19

Read-only. Independent Grok reading of Capsid decisions vol 14-19 (append-only numbered rulings 1-115), CLAUDE.md hard rules 1-20, every `check:*` gate in package.json (43), and standing instructions in `.design-sync/NOTES.md` and `.design-sync/conventions.md`.

Dustin's standard, which overrides every other rule: a rule that does not make the website better is changed or deleted. Two weeks of sessions produced one inventory page (`/playground/ui`, PR #43, 5689c72) while the rules kept growing.

Numbering collision, named so a citation is not silently retargeted: Capsid vols 1-13 are an unnumbered log; session-local "Ruling 1" in `colophon-page.md`, `admin-brand-parity.md`, and vol 4 is not this sequence; CLAUDE.md hard rules 1-20 are a third numbering. This table uses `R1`-`R115` for Capsid, `HR1`-`HR20` for CLAUDE.md, `G:*` for gates, `N:*` for NOTES.md, `C:*` for conventions.md.

## Method

- Rulings: read Capsid `decisions-vol-14.md` through `decisions-vol-19.md` (vol 17 froze after 59, vol 18 ran 60-104, vol 19 continues from 105). Later volume wins. A ruling that cites a commit or job where it caught something is a KEEP candidate. A ruling that only says "sessions must" is PROCESS.
- Gates: GitHub Actions workflow `ci.yml` from 2026-08-20 (the day CI was created) through 2026-09-19. 537 runs: 404 success, 8 cancelled, 125 failure. Unique failed samples 47 (renovate repeats collapsed). A real red is the gate correctly refusing a defect in the site or a dependency that would have shipped. A gate's own bug, a shallow-clone miss, an unremeasured floor after legitimate work, a hung test, and an Install/Lint failure that is not a `check:*` script are not real reds.
- Evidence for "caught something real" also includes FAILURES.md, VERIFICATION.md, gate headers, and git (explore pass). "none found" means no later catch after the rule existed, not that the original incident was imaginary.
- Cost is what a cold session pays: bytes to read, seconds to run (CI Gates step on ubuntu-latest unless noted), words to write.

## Measurements

| Item | Bytes | Notes |
|---|---|---|
| CLAUDE.md | 24,453 | main clone disk, 2026-09-19 |
| `.design-sync/NOTES.md` | 10,616 | |
| `.design-sync/conventions.md` | 3,998 | |
| Capsid `decisions-vol-19.md` | 25,148 | active volume, MCP read |
| **Preamble sum** | **64,215** | ~63 KB before Capsid conventions, core.md, FAILURES.md, skills |
| Capsid `brief("dustinedwards")` | ~141 KB truncated | conventions split 2026-09-16; core.md stale since 2026-09-05 |

`npm run check:ci` wall time:

- Clean CI job (install, migrations, lint, slop, gates) on ubuntu-latest: 177-217 s (run 35444577013 177 s; run 35415195555 217 s).
- Gates step serial sum on a typical green runner (2026-09-10 log): about 120 s, dominated by `check:worker` 59 s, `check:tests` 20 s, `check:types` 19 s, `check:charts` 6 s. Everything else is under 3 s each.
- This host, main clone `fda6ef1`: `Measure-Command { npm run check:ci }` wall **837 s (13.95 min)**. Measure-Command swallowed npm stdout, so the local verdict is not in the log; the number that matters is the wall. Vol 17-18 already record that a clean local `check:all` has not completed here for days. **The session cost of the offline tier on the machine sessions use is about seven times the CI job and about seven times the Gates step.** That is itself a finding.

### CI reds, 30 days, by class

125 failed runs. Unique samples 47. Of those: 41 failed the Gates step, 3 Lint (not a `check:*`), 2 Slop, 1 Install.

Real reds that were not the gate's own bug, counted from unique samples plus known repeats:

| Gate | Real reds (30d) | Not counted | What the real ones were |
|---|---|---|---|
| check:types | 2+ (better-auth 1.7.5; likely react-router 8.3.1) | | Ruling 42 working: a minor of better-auth is a security change. |
| check:stack | several (Renovate pin PRs #19-#21 before 39a) | | Committed `stack.json` lagged package.json. Fixed by making it a build product. |
| check:invariants | 1 (PR #30 merge 34536097937) | floor-only | The merge CLAUDE.md names: red on main, made green by the next unrelated commit. |
| check:policy | 1 (same PR #30) | floor remeasure 34332086808 | |
| check:floors | many (c9f50877, 87c16de7, 84513948, 3bcf858, 308ff08, post updates 2026-08-23) | | Almost all are unremeasured floors after legitimate work, not visitor defects. |
| check:features | some (title restatement c9f50877 class; post updates) | | Digit/title drift. |
| check:content | some (post updates 2026-08-23) | | Corpus vs markdown. |
| check:admin-ui | some (mockup corpus 308ff08) | | Baseline drift after a draft was removed. |
| check:slop | 0 real | 2 (35164286488, 35164030929) | Gate-own: security engine on a pre-existing Dependabot alert; shallow `origin/main`. Ruling 114. |
| check:tests | 0 real in 30d | 1 hung 139.8 s (89ce4fd) | Gate-own/flake. |
| check:worker | 0 real in 30d | historical flake family closed 1748513 | |
| Lint (oxlint) | n/a | 3 scorer-sync pushes | Not a `check:*` gate. |
| Install | n/a | 1 renovate/react-router-dev | Lock/peer, not a gate. |

Gates with **zero real 30-day reds** (and not in the table above): publications, config (CI-excluded), llms, backup (CI-excluded), browser (CI-excluded), media, image-weight, diagrams, search, contrast, fonts, design-sheets, guidelines, logo, charts, urls, volumes, media-axes, page-payload (CI-excluded), destructive, hook-matchers, hook-scope, hook-syntax, headers, secrets, uptime, mail, restore, head (CI-excluded), migrations, microformats, d1-address.

Zero reds is not proof of uselessness. The job's RETIRE test is zero real catches **and** no plant-proven refusal. Several of those still have plants. They are marked below.

## The ten, if only ten

**HR1, HR3, HR8, HR16, HR19, HR4, HR9, HR18, G:invariants, R34.** Visibility so a draft cannot be named by a public URL. Secrets stay inside the server boundary. A response that declares no Cache-Control is cached, so the Worker stamps `private, no-store` unless a route opts in. Ship is the only deploy, and it refuses a sha CI has not passed, a missing token, and an Ask index that has not converged. Money paths refuse a present foreign Origin and spend origin, rate, cache, budget, model in that order. The public plane ships no framework script. `/login` works with scripting off. Derived stores are repaired through derivation, never by a hand INSERT. `check:invariants` is the instrument that binds HR1, schema, and the helper-signature class of HR10. Ruling 34 is the one media finding that was a live origin defect (declared-PNG SVG served inline) rather than a session-conduct rule.

Everything else is either an instrument for one of those ten, a design decision that belongs in the canvas brief, or a session-conduct rule that made sessions work for the rules. The last two weeks of comment recuts, volume freezes, carried-token maps, and design-sync wiring produced `/playground/ui` and did not change a public page a visitor reads.

## Recommendation counts

| Rec | Rulings | Hard rules | Gates | NOTES/conventions |
|---|---|---|---|---|
| KEEP | 38 | 16 | 22 | 8 |
| MERGE | 41 | 3 | 6 | 6 |
| RETIRE | 36 | 1 | 15 | 8 |

Counts are this reading's. MERGE means keep the surviving id, delete the duplicate from the session preamble. RETIRE means stop binding sessions to it; Capsid may still hold the history.

---

## Numbered Capsid rulings (R1-R115)

| id | statement | class | evidence | cost | rec |
|---|---|---|---|---|---|
| R1 | Split webmentions: H1 schema/queue with no public render; H2 render; send later. | PROCESS | 45f526d, d33958d (shipped) | write 0 now | RETIRE |
| R2 | Unauthenticated mention writer is bounded: IP rate, visible target, one row per pair, global cap then 503. | BREAKAGE | none found later | read 0 (code) | KEEP |
| R3 | Verify in `waitUntil`, not a new queue. | BREAKAGE | none found | 0 | KEEP |
| R4 | Store no IP on the mention row. | BREAKAGE | none found | 0 | KEEP |
| R5 | Render mentions as escaped text; validated http(s) href; no source markup. | BREAKAGE | none found | 0 | KEEP |
| R6 | Admin mention actions are scriptless forms; smoke actor refused. | BREAKAGE | none found | 0 | MERGE INTO HR9 |
| R7 | No cache invalidation on approve (10 min lifetime). | DRIFT | none found | 0 | MERGE INTO R10 |
| R8 | Mentions render on the public post route only, never preview/twin/feeds. | BREAKAGE | none found | 0 | KEEP |
| R9 | Advertise `rel=webmention` link element and Link header. | DRIFT | d33958d | 0 | KEEP |
| R10 | Workers Cache Instant Purge; approve/publish purge `post:<slug>` and `posts`. | DRIFT | 5ff317f proven on production | 0 | KEEP |
| R11 | Gateway cache-off plus Renderer cache-on; themed `caches.default` and public `Vary: Cookie` go. | DRIFT | f457a03 | 0 | KEEP |
| R12 | Readership = gateway requests, labelled "includes crawlers"; no beacon. | TASTE | item G closed by construction | 0 | KEEP |
| R13 | Newsletter spending objection is gone; product call stays Dustin's. | TASTE | none found | 0 | RETIRE |
| R14 | Native ActivityPub unscheduled; Bridgy Fed after cutover. | TASTE | none found | 0 | MERGE INTO R50 |
| R15 | `workers/app.ts` exports gateway `default` and `Renderer`; cacheKey is path+search+theme. | DRIFT | f457a03 | 0 | MERGE INTO R11 |
| R16 | What goes and what stays after the cache arc. | DRIFT | f457a03 | 0 | MERGE INTO R11 |
| R17 | Every shared-cacheable HTML response carries Cache-Tag; purge at the write. | DRIFT | 5ff317f | 0 | MERGE INTO R10 |
| R18 | Acceptance is production measurement (a-f). | DRIFT | (d) proven 5ff317f | 0 | MERGE INTO R10 |
| R19 | Operator may approve and reject mentions, not delete them. | BREAKAGE | 5ff317f | 0 | KEEP |
| R20 | `no-direct-deploy.sh` blocks `npm run deploy` only inside the site repo. | PROCESS | 0cfab43; `wrangler.exe` suffix miss a67df0b | run G:hook-scope 0.8s | KEEP |
| R21 | Admin mentions page: one queue, excerpt leads, feedback matches outcome. | TASTE | 31d9633, dc0ce97; Dustin: better, still wonky | 0 | RETIRE |
| R22 | Open-on-Dustin items decided by the seat where they are best-practice. | PROCESS | none found | 0 | MERGE INTO R12 |
| R23 | Counting gates print floor lines; `check:floors` fails when floor sits too far below count. | DRIFT | 3bcf858, 47445bd; CI reds are mostly this | run G:floors 0.1s | KEEP |
| R24 | Repo reads the seat cannot do move into Capsid; Cloudflare tokens stay out. | PROCESS | Anthropic connector 404s | read Capsid | RETIRE |
| R25 | Cutover waits until everything is built. | PROCESS | delayed by R65 | 0 | RETIRE |
| R26 | `check:browser` admin-absent branch deleted; missing smoke credential is a named failure. | DRIFT | 81f33d4 | 0 | KEEP |
| R27 | Editor routes link KaTeX CSS unconditionally. | TASTE | 457d049 | 2.8 KB on two admin pages | KEEP |
| R28 | Sessions may not ship, and may not run a second check:all. | PROCESS | reversed by R29 | 0 | RETIRE |
| R29 | Automate anything that ends in Dustin's hands and is not a decision. | PROCESS | Dustin 2026-09-06 | 0 | KEEP |
| R30 | Render-drift after a renderer+content commit is an ordering artifact; assert a second sync. | DRIFT | 457d049; 74b7d0c | ship step | KEEP |
| R31 | Cockpit waits for the admin design spec. | PROCESS | none found | 0 | RETIRE |
| R32 | Media: lossy LQIP first; consumer never nulls a placeholder; body LQIP from a committed manifest. | DRIFT | 74b7d0c | 0 | KEEP |
| R33 | Renovate, not Dependabot; automerge off for a month. | PROCESS | fa1458d; automerge-off reversed by R36 | 0 | MERGE INTO R42 |
| R34 | SVG bytes declared as a raster type are refused; store the sniffed type. | BREAKAGE | 74b7d0c live origin defect | 0 | KEEP |
| R35 | State-of-the-art gap list adopted as worklist. | PROCESS | none found | read that doc | RETIRE |
| R36 | Renovate automerge ON for patch/minor/security; load-bearing six stay human. | PROCESS | Dustin; six-clause replaced by R42 | 0 | MERGE INTO R42 |
| R37 | Admin MCP gets a static bearer path for agents that cannot complete OAuth. | BREAKAGE | 995a6cb; closed 2026-09-11 | 0 | KEEP |
| R38 | Content is the largest gap and is Dustin's, not a session's. | PROCESS | Grok eval | 0 | KEEP |
| R39 | 39a: stack.json is a build product. 39b: Node is manual. | DRIFT | #19-#21 red on check:stack / engines.node 26 | CI | KEEP |
| R40 | Sentry receives logs only; traces off (would put `/preview/<token>` in Sentry). | BREAKAGE | da9cd89, 5e470d2 | G:config remote | KEEP |
| R41 | One writer per mainline at a time. | PROCESS | PR #29 interleave | 0 | MERGE INTO R60 |
| R42 | Load-bearing six researched: RR/CF plugins automerge patch/minor; better-auth and wrangler minor manual; katex manual. | PROCESS | better-auth 1.7.5 CI red check:types 34970651192 | 0 | KEEP |
| R43 | Restore drill is a fresh-export round trip into a scratch D1, weekly. | DRIFT | ab9c981; first run found three path bugs | weekly workflow | KEEP |
| R44 | Drill result does not enter the health snapshot yet. | PROCESS | none found | 0 | RETIRE |
| R45 | One clone per actor. | PROCESS | ~150 uncommitted lines lost | 0 | MERGE INTO R60 |
| R46 | Voice over wrapper: titles match the slug's voice; headings are sentences. | TASTE | Grok read of 11 posts | 0 | KEEP |
| R47 | Ten posts retitled and reslugged; old slugs 301. | TASTE | 6c578bd; nine 404s for 11 h before ship | G:urls | KEEP |
| R48 | Ship readiness skips content-drift, asserts it after sync. | PROCESS | e361093 ship refusal | 0 | MERGE INTO R56 |
| R49 | A 422 from sync_posts is unrepairable; Health stops retrying. | PROCESS | 585b32f `:swatch` vs old Worker | 0 | KEEP |
| R50 | No Mastodon, no Bluesky, ever; no `rel=me`; social lives with germomics. | TASTE | Dustin; G:microformats binds it | 0 | KEEP |
| R51 | `check:worker` is excluded from `check:head`'s nested tier. | PROCESS | 994c83d family; ~880 MB | 0 | KEEP |
| R52 | Ship trusts CI: green exact-HEAD sha and a clean tree skip the local offline tier. | PROCESS | 6c578bd; folded into HR16 | 0 | MERGE INTO HR16 |
| R53 | A slug rename cannot be staged by withholding the sync. | DRIFT | nine old URLs 404'd ~11 h | 0 | KEEP |
| R54 | `docs/ADMIN-DESIGN.md` is the admin standard; Grok's twelve corrections adopted. | TASTE | 4308f02, c3c55cd | read 1395 words | RETIRE |
| R55 | Webmention `readAuthor` is left as is; it never parses this site. | PROCESS | 5272fa8 | 0 | RETIRE |
| R56 | Readiness gates only on checks whose repair is not a later ship step. | PROCESS | 8b4f0ae4, ad7cb0fb dead-end deploys | ship | KEEP |
| R57 | Home "Start here" leads with the featured post, then three newest non-featured. | BREAKAGE | featured was dark in production | G:microformats | KEEP |
| R58 | fts-equality is deferred; repair is the sync's FTS rebuild. | PROCESS | d6e1730 | 0 | MERGE INTO R56 |
| R59 | Operator API records the agent principal on the audit line. | BREAKAGE | still open | 0 | KEEP |
| R60 | Worktrees, one per actor; this folder is the site session's main checkout. | PROCESS | e7e5f0b; tree stolen mid-gate 2026-09-10 | 0 | KEEP |
| R61 | Nothing is removed from the dependency set, measured rather than argued. | PROCESS | a7c0fa2 | measure script | RETIRE |
| R62 | Triage the Grok pre-cutover audit into Session A and B. | PROCESS | 8ac9568; A landed a2c942d | 0 | RETIRE |
| R63 | Publications rebuild: one page per paper, Highwire, JSON-LD, twins; host all 31 PDFs (Dustin). | TASTE | 81c0902, e394146 | 0 | KEEP |
| R64 | Paper twins are gitignored static build products, not D1 rows. | DRIFT | d27881c | G:publications | KEEP |
| R65 | Full-site redesign to a showcase standard; cutover after. | TASTE | Dustin; produced one inventory page in two weeks | the redesign | KEEP |
| R66 | Public plane is agent-complete, not script-free. | TASTE | Dustin; reverses seat wording of 65 | 0 | MERGE INTO HR9 |
| R67 | Motion is CSS-native with a reduced-motion path; nothing delays first paint. | TASTE | none found | 0 | MERGE INTO brief |
| R68 | Editorial public plane; light theme leads; no second accent. | TASTE | none found | 0 | MERGE INTO brief |
| R69 | Glass is for small floating controls, never a reading surface. | TASTE | none found | 0 | MERGE INTO R71 |
| R70 | Paper, Glass, Light; light is atmosphere, never meaning (amended by 74). | TASTE | none found | 0 | KEEP |
| R71 | Glass restricted to theme toggle, search, overflow menus, Ask frame. | TASTE | none found | 0 | KEEP |
| R72 | Solid non-Chromium version first; blur max 12px, never animated. | TASTE | none found | 0 | MERGE INTO brief |
| R73 | Two component kits on one foundation; home carries one live demonstration. | TASTE | none found | 0 | MERGE INTO brief |
| R74 | Lamp tokens; semantic states are fills with icon and text. | TASTE | none found | 0 | MERGE INTO R70 |
| R75 | Purple is the only accent a user can click. | TASTE | Grok hex table | 0 | KEEP |
| R76 | Design order: post, then header+home, then phage-discovery; 768 on every page. | PROCESS | none found | 0 | RETIRE |
| R77 | Header stays the solid purple bar, fixed, Inter only. | TASTE | **suspended** 2026-09-14; restore fb6a988 | 0 | RETIRE |
| R78 | Standard sentence: no flaw a senior product designer would find. | TASTE | Dustin | 0 | RETIRE |
| R79 | Visited links are a second shade of purple, AA on paper. | TASTE | none found; build 2 lost this and every returning reader saw it | 0 | KEEP |
| R80 | Source Serif 4 for public headings 32px and up. | TASTE | Dustin | font bytes | KEEP |
| R81 | Home demonstration is the Ask form, GET to /search. | TASTE | seat | 0 | KEEP |
| R82 | Public buttons are text with a rule; one filled primary per page. | TASTE | none found | 0 | MERGE INTO brief |
| R83 | Footer is tonal; no social row. | TASTE | 5b8007e print-hide bug | 0 | MERGE INTO R50 |
| R84 | Serif loads with Inter's swap-CLS strategy; family namespaced. | DRIFT | none found | 0 | KEEP |
| R85 | UI inventory carries photo, OG card, code block. | TASTE | 5689c72 shipped | 0 | RETIRE |
| R86 | Gate 1 (composited contrast) folds gate 2 (3:1 control boundaries). | DRIFT | waits on /playground/ui | G:browser | RETIRE |
| R87 | Gate 3 a-c (undefined / unreferenced / no raw hex); skip 3d until a weight scale exists. | DRIFT | none found | 0 | RETIRE |
| R88 | Skip off-scale-literal gate until Part A scales land (1,769 raw literals). | DRIFT | none found | 0 | RETIRE |
| R89 | Public-plane script-dependency gate; login is in scope. | BREAKAGE | HR9 | G:page-payload / G:features | MERGE INTO HR9 |
| R90 | Header-fit as check:browser at five widths. | DRIFT | ba832ff repaired the gate | G:browser nightly still noisy | RETIRE |
| R91 | CARRIED map is a temporary exemption; build 4 must empty it. | DRIFT | superseded | 0 | MERGE INTO R103 |
| R92 | page-payload ceiling raise is temporary on the same terms. | DRIFT | terms moved to a date | 0 | MERGE INTO R103 |
| R93 | Where approved handoffs contradict, the later step wins; z-index: the repo wins. | PROCESS | none found | 0 | RETIRE |
| R94 | 3.0 disabled-state contrast floor is deleted, not exempted around. | DRIFT | none found | 0 | KEEP |
| R95 | Figure axis stroke moves to `--fig-dust-400` (missed 1.4.11). | TASTE | measured | 0 | KEEP |
| R96 | `--z-dropdown` is 200, below the bar at 600; overlay uses `--z-overlay` 800. | TASTE | none found | 0 | KEEP |
| R97 | Bar control gap `--s-2` below 64rem; load-bearing at 375. | TASTE | **header-suspended** | 0 | RETIRE |
| R98 | Below 64rem, search is a labelled control with input `display:none`. | TASTE | withdrawn the same evening | 0 | RETIRE |
| R99 | Redesign grid is `.tracks`, not `.page`. | DRIFT | shell.css missed SHEETS (R111) | G:design-sheets | KEEP |
| R100 | Header restored to pre-build-2, keeping Menu overflow. | BREAKAGE | 94ded20; efc0dab deleted chrome; then suspended for byte-identical restore | 0 | MERGE INTO R77 |
| R101 | `check:logo`'s second fill binding stays restored. | DRIFT | session cut it to hide a missing mark | G:logo | KEEP |
| R102 | The seat reads the code before ruling on it. | PROCESS | six routes ruled unopened | write the quote | KEEP |
| R103 | Carried-token map is keyed to an owner and a date, not a build. Deadline 2026-11-30. | DRIFT | replaced 91 | G:invariants s31, G:page-payload | KEEP |
| R104 | `NON_PARTICIPATING` never counts as a reference; a check script is not a consumer. | DRIFT | none found | 0 | KEEP |
| R105 | An owner that shipped and declined a token is closed evidence; the token goes. | DRIFT | 2026-09-15 deletions | 0 | KEEP |
| R106 | Claude Design MCP is a read surface; writes go through DesignSync. | PROCESS | none found | 0 | KEEP |
| R107 | MCP member and sharing tools are off limits. | PROCESS | none found | 0 | KEEP |
| R108 | The canvas is a derived store; the repo wins. | DRIFT | job_7a43e8b0d45d E | 0 | MERGE INTO HR18 |
| R109 | `guidelinesGlob` is an explicit list, never `[]` (empty is off). | DRIFT | suppressed ADMIN-DESIGN for the whole redesign | G:guidelines | KEEP |
| R110 | No import direction; canvas work lives outside the sync writes list. | DRIFT | job_60421f2b7097; github.md moved by mistake | N:upload | KEEP |
| R111 | `SHEETS` is gated against root.tsx and non-admin imports. | DRIFT | job_47a1361a2bd6; `shell.css` absent from SHEETS | G:design-sheets | KEEP |
| R112 | Repo link is live against main, lag of minutes; ask twice. | DRIFT | TRACKGRID-SENTINEL-7Q42, fec78c9 | 0 | RETIRE |
| R113 | Slop audit: two readers; cut only on agreement. | PROCESS | 81b6162; 96% of comment weight survived | 0 | RETIRE |
| R114 | `aislop fix --safe` never runs on this repo. | PROCESS | deleted a DELETE-path guard | 0 | KEEP |
| R115 | Short why beside the rule; numbers live in gates; history lives in Capsid; comment volume is not a floor. | PROCESS | e899deb; waves 9b769c8, 9f929da, fda6ef1; two weeks, one inventory page | read+write thousands of words | MERGE INTO HR17 |

R115's operative sentence is Dustin's standard and belongs in HR17. The recut program it licensed (stylesheet comments, then four waves of code comments) is the exhibit for "sessions working for the rules."

---

## Hard rules (HR1-HR20)

| id | statement | class | evidence | cost | rec |
|---|---|---|---|---|---|
| HR1 | Every public read, and every public object derived from a post, goes through `publiclyVisible()`. | BREAKAGE | fba561f Ask cited a draft; mentions reader had no predicate | G:invariants s2/6/8 | KEEP |
| HR2 | `wrangler d1 export` is broken here; per-table backups; FTS repair is `('rebuild')`. | BREAKAGE | site-search post; restore drill found three path bugs | G:backup, G:invariants s7 | KEEP |
| HR3 | Secrets are read only inside the server boundary. | BREAKAGE | G:secrets first run on its own allowlist; no later client leak found | G:secrets 0.5s | KEEP |
| HR4 | Public plane ships no framework script; hydration is opt-in; payload is the enhance bundles. | BREAKAGE | early payload walk false-failed eight routes on `?url` | G:page-payload (CI-excluded), G:invariants s24 | KEEP |
| HR5 | Popover elevation and pinned bars take `--border-strong`, never `--border`. | TASTE | none found; scraper collision in NOTES | 0 | MERGE INTO C:border |
| HR6 | URL protocols allowlisted, schema and render; `postPath()` states the posts path once. | BREAKAGE | `javascript:` cover was a regex accident; a5008c0 three construction sites | G:urls 1.0s | KEEP |
| HR7 | A gate that feeds a module its own stored output cannot see the transport; live claims verify live. | PROCESS | verify-live caught HTML for `Accept: text/markdown` (2f0b4d5) | billed Ask probes | KEEP |
| HR8 | Workers cache is on; silence is cached; stamp `private, no-store` unless a route opts in; cookie presence bypasses shared cache. | BREAKAGE | 20c27d6 CSP; fb51152 themed cache omitted build id | G:headers 0.2s | KEEP |
| HR9 | Progressive enhancement, not "zero JS"; `/login` is on the public plane and works with scripting off. | BREAKAGE | absent Origin must be allowed or the door breaks | G:features, G:policy | KEEP |
| HR10 | A pass count is not coverage; ten named vacuity classes; only helper-signature is gated. | PROCESS | FAILURES.md, VERIFICATION.md, fba561f, `\b` as 0x08 | read VERIFICATION.md | KEEP |
| HR11 | `app/db/schema.ts` is the source of truth; `search_docs` is the asserted raw-SQL exception. | DRIFT | 7f51f7b search_docs unmodelled | G:invariants s4 | KEEP |
| HR12 | A new gate is tested by replaying the defect; a plant is proven applied before any result is read. | PROCESS | VERIFICATION.md 2026-08-07/10/20; 30 KB plant folded to `3e4` | write a plant | KEEP |
| HR13 | A fallback that substitutes a different value is not failing closed; two justified instances marked. | BREAKAGE | STATUS_LABEL `?? s` rendered raw enums | G:invariants s15b | KEEP |
| HR14 | Migrations are hand-written; an applied migration is never edited. | DRIFT | plants only; no real post-apply edit observed | G:migrations 0.2s | KEEP |
| HR15 | Do not modify `.claude/settings.json` without explicit instruction. | PROCESS | 3fb98fb stale facts; an agent can disable the hooks | 0 | KEEP |
| HR16 | Ship contract: CI success for this sha, token before build, Ask last; ship window owns the tree. | BREAKAGE | ship.mjs; R52; no override flag | ship minutes | KEEP |
| HR17 | One owner per fact; a comment carries a short why; a rule that does not make the site better is changed or deleted. | PROCESS | G:features refuses digits; e6e869e title drift | G:features 1.4s | KEEP |
| HR18 | Indexes converge toward the repo, never the reverse; no hand INSERT. | BREAKAGE | fcc1f0f posts.json lag; no-direct-deploy d1 arms | hook + health poll | KEEP |
| HR19 | Money paths refuse foreign origins and spend origin, rate, cache, budget, model. Absent Origin is allowed. | BREAKAGE | fba561f; G:policy by position | G:policy 0.3s | KEEP |
| HR20 | A manual cache key carries everything the body depends on; invalidation is per-colo and partial. | BREAKAGE | fb51152 omitted build id; 2f0b4d5 omitted Accept | 0 | KEEP |

HR5 is the one hard rule that is pure taste and is already in conventions.md. Keep it there, not in the session preamble.

---

## Gates (`check:*`)

Times are a typical ubuntu CI Gates step. Local on this host is not a usable measurement (see above). `CI-X` means CI_EXCLUDED.

| id | statement | class | evidence | cost | rec |
|---|---|---|---|---|---|
| G:types | Typecheck (wrangler types, react-router typegen, tsc -b). | BREAKAGE | 4fe03d7 Stop hook hid red tsc; better-auth 1.7.5; 2b5877d implicit any | 19 s | KEEP |
| G:content | Markdown, generated corpus, gitignore tripwire. | DRIFT | fcc1f0f, fd4447f, e6e869e | 2.3 s | KEEP |
| G:publications | Corpus, twins, unlicensed-PDF list, redirects. | DRIFT | none found later | ~1 s | KEEP |
| G:config | wrangler.jsonc vs example, both directions; `--remote` adds schedules. | DRIFT | e6e869e email in mockups; **CI-X** (bootstrap makes them equal) | offline + remote | KEEP |
| G:search | Parser/fusion floors. | DRIFT | floor caught a run that executed nothing | 0.1 s | KEEP |
| G:policy | Money-path order by position, comments stripped. | BREAKAGE | fba561f; d6e1730; floor sat 60 vs 96 | 0.3 s | KEEP |
| G:contrast | Token contrast matrix. | DRIFT | plants; 30d reds are floor arithmetic | 0.8 s | KEEP |
| G:fonts | Font binaries vs `@font-face`. | DRIFT | none found later | ~1 s | KEEP |
| G:design-sheets | SHEETS vs root.tsx and non-admin imports, both directions, cascade order. | DRIFT | shell.css missed; first green fec78c9 | ~1 s | KEEP |
| G:slop | aislop on the diff vs origin/main, not the tree. | PROCESS | 0 real; 2 own-bugs; 3eb9001 type assertion | ~1 s + fetch | RETIRE from CI blocking |
| G:guidelines | Capsid export stamps vs `updated_at`. | DRIFT | plant; 0 later live catch | network | KEEP |
| G:logo | Header mark fill bindings. | BREAKAGE | a build replaced the mark with a wordmark; R101 | 1.7 s | KEEP |
| G:charts | Plot accessibility contract. | DRIFT | plant (`role=img` on figure); 0 later | 6.2 s | KEEP |
| G:diagrams | Mermaid/asset pairing. | DRIFT | none found | 0.8 s | RETIRE |
| G:admin-ui | Admin render harness vs baseline. | DRIFT | ee7d8b7 "Top NaN"; 308ff08 mockup corpus | 2.7 s | KEEP |
| G:urls | Protocol allowlist, slug pattern, redirects both ways. | BREAKAGE | 2026-08-07 javascript: cover | 1.0 s | KEEP |
| G:volumes | Active Capsid decisions volume vs its own freeze point. | DRIFT | none found; vol 18 ran to 36.7 KB ungated for 4 days | network | RETIRE |
| G:media-axes | Media query axes present. | DRIFT | plant; 0 later | 0.2 s | RETIRE |
| G:page-payload | Public script/CSS ceilings; opt-in hydrate set. | BREAKAGE | plant never applied (3e4); **CI-X** (no client build) | local only | KEEP |
| G:destructive | Destructive intents call the confirmation predicate in-branch. | BREAKAGE | 0ad6c86 N-1 of N; ternary hid reject | 0.3 s | KEEP |
| G:hook-matchers | PreToolUse matchers cover permission-allow tool names. | BREAKAGE | f454673; PowerShell unmatched 59 days | ~0.5 s | KEEP |
| G:hook-scope | Deploy door and d1 arms; effective directory. | BREAKAGE | 0cfab43; a67df0b `.exe` suffix | 0.8 s | KEEP |
| G:hook-syntax | `bash -n` plus Python compile of embedded checkers. | DRIFT | plant: apostrophe ended a quoted string; 0 later | 0.4 s | KEEP |
| G:floors | Floor lines vs executed counts. | DRIFT | 34e62f1; 6c578bd; most 30d reds | 0.1 s | KEEP |
| G:stack | Colophon stack.json freshness, example config, drizzle. | DRIFT | fd4447f missing migration; Renovate #19-#21 | 0.2 s | KEEP |
| G:features | enhancements.json both ways; no digit in a feature sentence. | DRIFT | 6202508; e6e869e | 1.4 s | KEEP |
| G:headers | Source Cache-Control / CSP declarations. | BREAKAGE | csp.mjs admin `.data` arm | 0.2 s | KEEP |
| G:secrets | No secret in client chunks; per-root floors. | BREAKAGE | first run on own allowlist; 0 later leak | 0.5 s | KEEP |
| G:migrations | Manifest hashes both ways; never edit applied files. | DRIFT | plants only | 0.2 s | KEEP |
| G:tests | `node --test` over test/. | BREAKAGE | 0 real 30d; 1 hung 139 s | 20 s | KEEP |
| G:worker | workerd module tests, outbound fetch throws. | BREAKAGE | CI first-run stdout miss; flake family 1748513 | 59 s | KEEP |
| G:invariants | Visibility, schema, FTS, helper signatures, bindings list, ... | BREAKAGE | 7f51f7b, a5008c0, PR #30 | 1.8 s | KEEP |
| G:llms | llms.txt vs corpus; `--remote` adds D1. | DRIFT | Cloudflare 10000 transients; 0 content mismatch | 0.1 s | KEEP |
| G:backup | Per-table export vs schema; **CI-X**. | DRIFT | first run omitted a table; SQLITE_CANTOPEN later | local/remote | KEEP |
| G:browser | Layout, theme, cache pairing; **CI-X** from ship; daily schedule. | BREAKAGE | 2026-08-20 eight layout defects; fb51152 stale HTML; 26 unread prod failures | network, minutes | KEEP, after the 26 are read |
| G:media | R2 index vs table; network only. | DRIFT | plant deleted a live key; later R2 list timeout | network | KEEP |
| G:image-weight | Images quality on rebuild placeholders. | DRIFT | replay of pre-fix bytes; 0 later | network | RETIRE |
| G:uptime | UptimeRobot monitors vs manifest. | DRIFT | f2c30b9 floor 4 under 22 | network | KEEP |
| G:mail | SPF/DKIM/DMARC; red by design until cutover. | DRIFT | none found | network | RETIRE until cutover |
| G:restore | Weekly fresh-export round trip. | DRIFT | first run found three restore-path bugs | weekly, slow | KEEP |
| G:head | Disk vs HEAD; **CI-X** (vacuous on a checkout). | DRIFT | b1668fb NUL in own docblock | local, nested, minutes | KEEP |
| G:microformats | h-card/h-entry/h-feed; no rel=me. | DRIFT | 4d6b17e gate bug (asserted absent `updated`) | 3.0 s | KEEP |
| G:d1-address | No `wrangler d1 <cmd> dustinedwards` by name except `--local`. | BREAKAGE | 2ad4727 name desync; 9 sites | 0.3 s | KEEP |

`G:slop` is the exhibit for a gate that costs CI and sessions and has never caught a real defect here (ruling 114: all 83 in-scope findings were false positives). Score it as a report, or delete it from CI.

`G:volumes` was proposed because vol 18 overran its own 20 KB sentence. A freeze-point check on Capsid does not make a page better. Put the limit in the volume and stop.

`G:diagrams`, `G:media-axes`, `G:image-weight`, `G:mail` (until DNS) have no later catch and no visitor currently depending on them firing.

---

## NOTES.md standing instructions

| id | statement | class | evidence | cost | rec |
|---|---|---|---|---|---|
| N:scope | This repo is an application, not a design system; four standalone components. | PROCESS | Dustin 2026-09-12 | read 10.6 KB | KEEP |
| N:build | `build-inputs.mjs` must run before the converter; `--entry` is required. | DRIFT | converter looks for `node_modules/dustinedwards-info` | 0 | KEEP |
| N:tsconfig | Converter tsconfig reader cannot parse `tsconfig.cloudflare.json` (glob `/*`). | DRIFT | parse died at line 36 | 0 | KEEP |
| N:fontface | `@font-face` url()s resolve against the CSS entry, not the sheet. | BREAKAGE | Inter silently became a system font | 0 | KEEP |
| N:import | Validator greps `@import` without stripping comments. | DRIFT | failed the gate twice as a missing import | 0 | KEEP |
| N:contrast | Bundle ships without `prefers-contrast: more`; scraper flattening made `--border` == `--border-strong`. | DRIFT | measured 2026-09-12 `_ds_manifest.json` | 0 | KEEP |
| N:chrome | `--surface-chrome` collision: redesign invented `--bar-fill` and invalidated the header. | BREAKAGE | header restored byte-identical rather than repaired | 0 | KEEP |
| N:warns | Known render warns (Shiki tokens, dead @font-face drop). | PROCESS | none | 0 | KEEP |
| N:preview | Themed wrapper must set `color: var(--text)` as well as background. | BREAKAGE | PostCard.DarkTheme description invisible | 0 | MERGE INTO C:surf |
| N:pw | playwright 1.61.1 pins chromium 1228; skip browser download. | PROCESS | none | 0 | KEEP |
| N:sheets | SHEETS was hand-maintained and went stale. | DRIFT | R111 | 0 | MERGE INTO R111 |
| N:cascade | Cascade order is load-bearing and not alphabetical. | DRIFT | none found later | 0 | MERGE INTO R111 |
| N:upload | `part-a/`, `part-b/`, `references/`, `uploads/` are never in a plan's `deletes`. | DRIFT | R110; skill instruction would delete 96 shots | 0 | MERGE INTO R110 |
| N:global | `globalName` is `DustinEdwards`; a rename edits conventions.md too. | DRIFT | none found | 0 | MERGE INTO C:vocab |

NOTES.md is 10.6 KB of converter defects and sync hazards. That is the right home for them (next sync agent, never uploaded). Do not also paste them into CLAUDE.md.

---

## conventions.md standing instructions

| id | statement | class | evidence | cost | rec |
|---|---|---|---|---|---|
| C:theme | No theme provider; `data-theme` on any element retokenises that subtree. | TASTE | none | read 4.0 KB | KEEP |
| C:surf | A themed container must set `background: var(--surface)` and `color: var(--text)`. | BREAKAGE | preview cycle; N:preview | 0 | KEEP |
| C:router | PostCard and Pagination throw outside a router; wrap in MemoryRouter. | BREAKAGE | none found later | 0 | KEEP |
| C:idiom | No utility classes, no `style` prop, no theme-object props. | TASTE | SiteLogo silently drops `style` | 0 | KEEP |
| C:tokens | Token families enumerated from the real sheet. | DRIFT | five dead tokens cut in PR #37 | 0 | KEEP |
| C:border | Popover elevation and pinned bars take `--border-strong`. | TASTE | HR5 | 0 | KEEP |
| C:page | Page vocabulary: `page`, `page-inner`, `prose`, `post-list`, `site-header`, `site-shell-footer`. | TASTE | `.site-footer` rename un-hid print footer (5b8007e) | 0 | KEEP |
| C:li | PostCard renders an `<li>` and needs a `post-list` parent. | BREAKAGE | none found later | 0 | KEEP |
| C:links | Links are `var(--brand)` underlined; `var(--visited)` when visited; do not restate on every anchor. | TASTE | R79; build 2 lost visited-on-chrome | 0 | MERGE INTO R79 |
| C:truth | `styles.css` beats this summary. | PROCESS | none | 0 | KEEP |

conventions.md is 4 KB and rides in the README's 32,000-char ceiling. That is the right size for taste that a design agent must see. Do not grow it with history.

---

## What to delete first, if the seat wants a cut

These are the rows that currently cost session time and do not protect a visitor:

1. **The R115 recut program** (waves 3-4, comment-share reviews). Keep the one-line why rule in HR17. Stop rewriting comments.
2. **R66-R90 design-law restatements in vol 19.** Keep R70, R71, R75, R79, R99. The rest live in `TASK-redesign-brief-2026-09.md`, which a design session reads when it is doing design.
3. **G:slop as a CI blocker.** Ruling 114 already forbids `aislop fix`. Scoring the diff can be a report.
4. **G:volumes.** A Capsid freeze-point check does not change a page.
5. **Session preamble beyond CLAUDE.md.** 64 KB plus a 25 KB decisions volume plus a 141 KB brief is the cold-start tax. core.md is stale since 2026-09-05 and is the first thing every session reads. Rewrite core.md to one screen, and stop asking sessions to read vol 19's standing restatements of 60-104 that vol 18 already holds.
6. **Local `check:ci` as a session ritual on this host.** CI already runs it in 3 minutes. This machine has not finished a clean local aggregate run for days (vol 18). R52 / HR16 already say ship trusts CI.

## Sources

- Capsid: `dustinedwards/decisions-vol-14.md` .. `vol-19.md`, `core.md`, `jobs/job_deb3d9f683bb.md`
- Repo: CLAUDE.md, package.json, scripts/check-all.mjs, .github/workflows/ci.yml, FAILURES.md, VERIFICATION.md, .design-sync/NOTES.md, .design-sync/conventions.md
- CI: `https://github.com/DrDustinEdwards/dustinedwards-info/actions/workflows/ci.yml` (537 runs, 2026-08-20 to 2026-09-19)
- Git evidence pass: FAILURES.md, gate headers, commits cited in the tables
- This host check:ci: 837 s (13.95 min) on `fda6ef1`; stdout swallowed by Measure-Command. CI job wall 177-217 s is the number a session should believe
