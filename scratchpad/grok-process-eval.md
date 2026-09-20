# How a page is made and shipped, against “a rule that does not make the website better is changed or deleted”

Visual law is rulings 117 and 118. This note is the engineering and process that still govern a page from an approved direction to a URL a reader can fetch.

**This is a judgment, not a Capsid stamp.** Capsid was not reachable this session, so vol 19 and the 117/118 texts were not re-read live. Standing text is CLAUDE.md after ruling 116 (`1aa49b6`), the gates in `package.json` and `scripts/check-all.mjs`, `.design-sync/NOTES.md`, `.design-sync/conventions.md`, `scripts/check-page-payload.mjs`, `scripts/ship.mjs`, and git on `origin/main` at `f211fc1`.

A first document already sits at `0d8943b` on this branch. It was read after the sources below were gathered, not used as a source of facts. Where the two disagree, the disagreement is named.

Standard: keep, narrow, or go. Keep what has caught breakage or made a reader’s page true. Narrow what doubles a cycle without changing the page. Delete what only protects a process from itself. Where a rule is narrowed, the replacement wording is in the same row.

---

## A. Hard rules (CLAUDE.md 1–20)

Ruling 116 cut CLAUDE.md from 24,453 bytes (measured 2026-09-19) to 10,535 bytes on disk today. Numbering is append-only. `check:invariants` section 15 binds every `hard rule N` citation to a heading and currently floors the walk at `scanned >= 230 && cited >= 118`. That floor is itself a rule; see A.10 and A.citation.

### HR1. Every public read, and every public object derived from a post, goes through `publiclyVisible()` — **stay**

**Requires.** HTML, feeds, search records, Ask answers, and OG cards cannot name a draft. Content-addressed `/media/*` is out: a digest cannot name a draft.

**Caught.** Ask cited a draft (`fba561f`). The mentions reader carried no predicate and passed both visibility sections by having none (`FAILURES.md`). `9331467` wired home tiles through the same predicate `/blog` uses. Invariants section 22 was added so home tiles cannot hard-code `25`.

**Cost.** Every new derived surface must join the predicate. Cheap against a draft on a public URL.

**Stay.** No replacement.

### HR2. `wrangler d1 export` is broken; per-table backups; FTS repair is `('rebuild')` — **stay**

**Forbids.** Whole-database export as the backup path. `DELETE FROM` on an FTS index.

**Caught.** Restore drill found three path bugs on the first weekly run (`ab9c981`, 2026-09-09). Site-search post records why `DELETE FROM posts_fts` corrupts the index.

**Cost.** Custom per-table scripts. The alternative is an unrestorable D1.

**Stay.**

### HR3. Secrets are read only inside the server boundary — **stay**

**Requires.** Both directions, per-root floors. `check:secrets`.

**Caught.** First run failed on its own allowlist. No later client leak found in the 30-day CI window.

**Cost.** None a page feels.

**Stay.**

### HR4. The public plane ships no framework script — **stay**

**Requires.** Public routes do not hydrate. Hydration is opt-in by route. A public page’s whole script payload is the prebuilt bundles in `app/enhance/`, loaded by nonced module script tags. Client auth is imported by `/login` alone. Prefetch is a JS-only extra.

**Caught.** `b098b49` found every public page hydrating React with no floor (331 KB raw / 95 KB brotli). `cba0263` stopped that. `f9aecb5` nearly shipped a shell with zero bundles (theme gone) and nearly shipped the 3921-byte palette on every route; `check:page-payload` refused both. The gate pins `hydrate: true` to `admin.tsx` and `login.tsx` by name (`scripts/check-page-payload.mjs`). Live: those two files, and only those two, export `handle = { hydrate: true }`. `palette.js` is asserted unreachable from every page’s cold load; it is fetched on the gesture.

**Cost.** No SPA transitions, no client router on public pages, enhancements are vanilla modules. That is the Swiss/editorial engineering: a document, complete in server HTML. 117 makes this more load-bearing, not less.

**Stay.** Do not narrow to let one public route hydrate “just this once.” CSS-only figures, rails, and bars are not forbidden by this rule. `e84b7a8` dropped a reading-progress specimen rather than raise `/blog/:slug` by 89 bytes: that was a fixture importing a public sheet, not HR4 refusing a bar.

The first document at `0d8943b` agrees on stay. Agreed.

### HR5. Popover elevation and pinned bars take `--border-strong` — **narrow to a pointer**

**Requires.** Taste. Already merged into `C:border` in `.design-sync/conventions.md` (ruling 116). The hard-rule number is retained because three stylesheets cite it and section 15 binds every cited number to a heading.

**Caught.** None as a ship defect. The scraper collision in NOTES.md made `--border` and `--border-strong` the same colour in the canvas manifest (measured 2026-09-12), so an agent could not honour a distinction it could not see.

**Cost.** A numbered hard rule that is a pointer, kept alive by the citation floor.

**Narrow.** Replacement: *Popover elevation and pinned bars take `--border-strong`. The owner is `.design-sync/conventions.md`. This heading exists so existing citations resolve. New comments cite `C:border`, not this number.*

### HR6. URL protocols allowlisted, schema and render; `postPath()` once — **stay**

**Caught.** `javascript:` cover was a regex accident (`a5008c0`, three construction sites). 2026-08-07.

**Cost.** `check:urls` about 1 s.

**Stay.** The first document’s “class, not instance” reading still holds against R34: this is the public-page injection class.

### HR7. A gate that feeds a module its own stored output cannot see the transport — **stay as method, not as session law**

**Requires.** Live claims verify on the live path. Method: `VERIFICATION.md`.

**Caught.** `verify-live` caught HTML for `Accept: text/markdown` (`2f0b4d5`). `0454d401` proved verify-live was asserting cold after every deploy and missed a theme-cache bug for four sessions.

**Cost.** Billed Ask probes. `verify-live` is not a gate and is not a ship step.

**Narrow.** Replacement: *Live claims verify on the live path. The method lives in `VERIFICATION.md`. A session changing a page does not re-derive this. Cache-key and Accept changes run the warm pass after ship.*

### HR8. Workers cache is on; the Worker’s stamp is the statement — **stay**

**Requires.** A response that declares no `Cache-Control` is cached under heuristic freshness, so `workers/app.ts` stamps `private, no-store` unless a route opts in to sharing. `Vary: Cookie` plus any cookie bypasses the shared cache.

**Caught.** `20c27d6` CSP. `fb51152` themed cache omitted build id. `0454d401` / `0ceb52a` theme served to the wrong readers from cache.

**Cost.** HTML is uncacheable at the edge. `.md`, `llms.txt`, and RSS stay public with a lifetime. Correct split for a document that also has a theme cookie.

**Stay.**

### HR9. Progressive enhancement, not “zero JS”; `/login` is on the public plane — **narrow**

**Requires.** Works without script, fast with it, both halves instrumented. An enhancement loads as a nonced module script tag, never a React effect. Admin is exempt. `/login` is not.

**Caught.** README records the old “zero JS” name was untrue at the door: a button that did nothing without script. Absent Origin must be allowed or the scriptless form breaks (HR19). `d6eef9d`: the selection link looked right and did nothing, and only a browser could say so.

**Cost.** Every public feature needs a server path. That is the reading-experience the posts already argue.

**Narrow.** The public-plane half is HR4’s subject. Replacement: *An enhancement loads as a nonced module script, never a React effect. `/login` works with scripting off. The admin plane is exempt.*

### HR10. A pass count is not coverage — **narrow to gate authors**

**Requires.** Count assertions that can fail. Ten named vacuity classes. Only helper-signature drift is gated. Re-measure carried claims.

**Caught.** FAILURES.md, VERIFICATION.md, `fba561f`, `\b` as 0x08. Floor moves when the map shrinks (`f9aecb5`: invariants 422/461 re-measured). `0de13b2`: six floors re-measured by RUNNING each gate, not by arithmetic. `4f4fc65`: contrast floors drifted past tolerance (PR #53). Three carried claims in one wave-3 session (Claude’s 19 September reading): “10 errors” was 11; comment-stripped identity was 37,615 of 88,201 bundle bytes.

**Cost.** Most of the 30-day CI reds that were “real” in the floor column were stale floors after legitimate work, not runtime bugs. Sessions remeasuring floors instead of changing pages.

**Narrow.** Replacement: *If you write or change a gate, count assertions that can fail, prove scope non-empty, and re-measure floors by running the gate. The ten classes live in `VERIFICATION.md`. Helper-signature drift stays gated in `check:invariants`. A page session does not re-derive this.*

### HR11. `app/db/schema.ts` is the source of truth — **stay**

**Caught.** `7f51f7b` `search_docs` unmodelled. Section 4 binds schema, migrations, and live DB.

**Stay.**

### HR12. A new gate is tested by replaying the defect — **narrow to gate authors**

**Caught.** VERIFICATION.md 2026-08-07/10/20. A 30 KB plant folded to `3e4` by the minifier (`b098b49` / page-payload). `bdb7632` plants (font preload to prefetch; palette tag back).

**Cost.** Extra hours per new gate. Those hours are why the gates work. They are not why a footer changes.

**Narrow.** Replacement: *A new gate replays the defect it was written for. A plant is proven applied, in the artifact the gate reads, before any result is read. Exit 1 is not evidence. This binds gate authors, not page authors.*

### HR13. A fallback that substitutes a different value is not failing closed — **go as session law**

**Requires.** Two justified instances marked `JUSTIFIED SUBSTITUTION`: `REMOTE_ARGS ?? []` in `check-all.mjs`, and the rate-limit client IP in `app/lib/client-ip.ts`. Section 15b counts the markers.

**Caught.** `STATUS_LABEL ?? s` rendered raw enums.

**Cost.** A numbered hard rule whose own text says “all instances resolved.”

**Go** from the session preamble. Keep the two markers in code. Replacement: none in CLAUDE.md. The markers are the rule.

### HR14. Migrations are hand-written; an applied one is never edited — **stay**

**Caught.** Plants only. No real post-apply edit observed. `check:migrations` hashes both ways. drizzle-kit is absent on purpose.

**Stay.**

### HR15. Do not modify `.claude/settings.json` without explicit instruction — **stay**

**Caught.** `3fb98fb` stale facts written back. An agent changing this file can disable the hooks that enforce the other rules.

**Stay.**

### HR16. Ship contract: CI for this sha, token before build, Ask converged last — **stay. Delete the local-tier ritual.**

**Requires.** `scripts/ship.mjs`. Each step fails closed. No override flag. A ship window owns the tree from first step to last. Watchdog is deployed by a ship step, never by `npm run deploy`. `deploy.yml` is a second door to the same pipeline (`workflow_dispatch` only) so a dirty working tree cannot ship; ruled 2026-08-25 after a deploy from a dirty tree ran in production for two days as code that existed on no commit.

Ship steps, in order: token present; preflight (ff-only pull, nothing holding `build/client`); clean tree; CI verdict on this sha (read, then enforced after build); pending migrations; build (stack, content, twins, enhance, Worker); offline gates; CI must be green; deploy; poll `/colophon`; Ask index; media index; deferred drift checks after their repair.

**Caught.** Dead-end deploys when readiness gated on a check whose repair is a later ship step (`8b4f0ae4`, `ad7cb0fb`, folded into R56). Ruling 48: ship must name content-drift as deferred after D1 sync (PR #30).

**Cost.** Cannot “just wrangler deploy.” Local full `check:ci` on this host was 837 s on `fda6ef1`; CI job wall 177–217 s. HR16 already says ship trusts CI.

**Stay** the contract. **Delete** “run the offline tier on this laptop as the price of a page.” Replacement for the ritual: *Ship trusts CI for this sha. A session runs the named gates that can see the files it touched. The full offline tier is CI’s.*

### HR17. One owner per fact; a comment carries a short why; a rule that does not make the site better is changed or deleted — **stay**

**Requires.** A measured value lives in the gate that measures it. Prose may point at the gate. Comment volume is not a floor. Published posts are dated records.

**Caught.** `check:features` refuses digits in feature sentences. `e6e869e` title drift. `9331467` invariants §22. `28d0009` stripped restated contrast ratios. Ruling 115’s recut program (waves 1–4) is the exhibit for sessions working for the rules: two weeks, one inventory page (`5689c72`); wave 3 restorations `c5308ef` (13); wave 1 restorations `7b2c8ec` (6); wave 4 restorations `e1ecdc8` (10). The program is retired. The sentence is law.

**Stay.** The last clause *is* this standard.

### HR18. Indexes converge toward the repo, never the reverse — **stay**

**Caught.** `fcc1f0f` `posts.json` lag. no-direct-deploy d1 arms. Health: `ask-index-drift` (08-23, 09-03), `content-drift` 16 vs 14 with `sync_posts` 422 (09-09).

**Stay.**

### HR19. Money paths: origin, then rate, then cache, then budget, then model — **stay**

**Requires.** Absent Origin is allowed (scriptless form). Foreign Origin is refused. `check:policy` by position in the route body.

**Caught.** `fba561f`. Seven real CI runs, one unique: ruling 48 deferred content-drift (PR #30).

**Stay.**

### HR20. A manual cache key carries everything the body depends on — **stay**

**Caught.** `fb51152` omitted build id. `2f0b4d5` omitted Accept. No purge door on `workers.dev`. Invalidation is per-colo and partial.

**Stay.**

### Citation floor (invariants section 15) — **narrow**

**Requires.** Every cited `hard rule N` resolves to a heading. All twenty are cited. Walk floors: `scanned >= 230 && cited >= 118`. CLAUDE.md under 40,000 characters.

**Caught.** Truncation would hide the rules. Renumbering would retarget every citation.

**Cost.** HR5 and HR13 cannot leave because the floor employs them. Same shape as KEEP_SHARE.

**Narrow.** Replacement: *Numbering is append-only. A citation must resolve to a heading. A heading that nothing needs may be a one-line stub, and the citations may be updated in the same commit that retires the rule. There is no floor on how many rules must be cited.*

---

## B. Session process in CLAUDE.md, after the twenty

### B1. Mainline only until DNS cutover; commit and push immediately; the gates are the review — **narrow**

**Requires.** Everything lands on `main`. No PR for the site session.

**Caught.** A markdown commit is live after the health poll. That door works.

**Cost.** Ruling 60 exists because this stole the tree (one actor mid-gate, another on `main`, ~150 lines lost; tree stolen 2026-09-10). Immediate push is how comment waves landed before a visitor-facing page did. The site session’s main checkout was 14 commits behind `origin/main` at the start of the session that wrote this.

**Narrow.** Replacement: *The site session owns this folder and ships on `main`. It may hold a page on disk until the page is better, then one ship window. Other actors work in worktrees under `C:\Users\email\dev\worktrees\` and land by pull request on green CI. Renovate PRs are reports, not merge fodder.*

Disagreement with `0d8943b`: that document said stay. Immediate push is the half that fights 60.

### B2. Ruling 60: this folder is the site session’s alone — **stay**

**Caught.** `e7e5f0b`. Tree stolen mid-gate. Lines lost under the one-clone rule that 60 replaced.

**Stay.**

### B3. Two files are Capsid’s and not this repo’s to restyle — **stay**

`scripts/improve-report.mjs` and the block below the BYTE-IDENTICAL marker in `.github/workflows/improve-score.yml`. `0d56d20` named them. A recut that touches either makes this repo the odd one out.

**Stay.**

### B4. Read FAILURES.md first; every gate verifies disk, not HEAD; `git diff <path>` before `git add <path>`; never `git add -A`; destructive / money / auth stay with Dustin; unexpected rebase or missing edits: stop — **narrow the first clause, stay the rest**

FAILURES.md is 5,994 bytes of reasoning shapes. It earns its place when a gate fails. It does not earn “first file of every session.”

**Caught.** `git add -A` would pick up generated artifacts and Capsid copies. `6322456`: `check:head` caught two things the working tree could not.

**Narrow.** Replacement: *Read FAILURES.md when a gate fails. Every gate verifies disk, not HEAD. `git diff <path>` before `git add <path>`; never `git add -A`. Destructive operations, money paths, and auth secrets stay with Dustin. If a session rebases onto commits it did not expect, or finds its own edits absent from disk, stop and re-establish the baseline.*

### B5. `package.json` owns the script list; `check-all.mjs` refuses an untiered gate — **stay**

A new gate is in CI by default and has to be argued out. Report is a third tier (ruling 116): slop, volumes, mail. Report is not a weaker offline.

**Stay.**

### B6. Bindings via `getEnv(context)`; `ASK_BUDGET` is the whole site’s rate limiter and is not renamed before cutover; `wrangler.jsonc` is gitignored; `OPERATOR_TOKEN` has three holders — **stay**

Portfolio and rotate-all-three. A rename of `ASK_BUDGET` before cutover is busywork.

**Stay.**

### B7. Sessions read Capsid and never write it — **stay**

The seat writes rulings. The withdrawn episodic produced roughly 49 episodics in this namespace and buried the rulings filed beside them.

**Stay.**

---

## C. Gates (`package.json` `check:*`)

43 gates (45 `check:*` scripts minus the three runners). Tiers in `check-all.mjs`. CI excludes config, backup, head, browser, page-payload, each with a measured reason.

CI `ci.yml`, 2026-08-20 to 2026-09-19: 537 runs, 404 success, 8 cancelled, 125 failure. Unique product catches were few. Browser workflow in the same window: 31 runs, 20 failure, 12 real visitor-visible reds that `check:ci` never sees.

Times below are a typical ubuntu Gates step from that reading. Local on this host is not a usable measurement of cost to a visitor.

| Gate | Forbids / requires | Caught (commit, PR, CI) | Cost | Rec |
|---|---|---|---|---|
| types | tsc -b, wrangler types, typegen | 14 real CI runs, 4 unique: `improve-report.mjs` implicit any; better-auth 1.7.5 KV session store; two missing-module commits | 19 s | **stay** |
| content | markdown, generated corpus, gitignore tripwire | 13 real CI runs: 12 `template-refs.json` not rebuilt (08-23 to 08-25); 1 missing `artifact.mjs` (`76e52e2`). `5debe80` rescan for three new source files | 2.3 s | **stay** |
| publications | corpus, twins, unlicensed-PDF list, redirects | none found later | ~1 s | **stay** |
| config | wrangler.jsonc vs example, both directions | `e6e869e` email in mockups. **CI-X**: bootstrap makes them equal | offline + remote | **stay** |
| search | parser/fusion floors | a floor caught a run that executed nothing | 0.1 s | **stay** |
| policy | money-path order by position, comments stripped | 7 real CI runs, 1 unique: ruling 48 / PR #30 | 0.3 s | **stay** |
| contrast | token contrast matrix | plants; 30-day reds were floor arithmetic until `4f4fc65` / PR #53 re-measured both floors. Stale-build reds are a second gate-own class | 0.8 s | **stay** |
| fonts | binaries vs `@font-face` | none found later | ~1 s | **stay** |
| design-sheets | SHEETS vs root.tsx and non-admin imports, both directions, cascade order | `shell.css` missed; first green `fec78c9`. `ddbbd73` added two new post sheets | ~1 s | **stay** |
| slop | aislop on the diff vs origin/main | 0 visitor-visible. 2 own-bugs in 30 days. Ruling 114: 83 in-scope findings were false positives. One latent type defect (`readAuthor`) after 8bad914. Report tier since 116; `continue-on-error` in ci.yml | ~1 s + fetch | **stay as report, not as ship veto** |
| guidelines | Capsid export stamps vs `updated_at` | plant; 0 later live catch. Network. R109: empty `guidelinesGlob` is off | network | **stay** |
| logo | header mark fill bindings | a build replaced the mark with a wordmark; R101 restored the second fill binding | 1.7 s | **stay** |
| charts | Plot accessibility contract | plant (`role=img` on figure); 0 later | 6.2 s | **stay** |
| diagrams | Mermaid/asset pairing; alt mandatory | none found later. Build already refuses a missing alt, so a corpus plant reads the stale `posts.json` and passes (116’s record) | 0.8 s | **stay**; the build is the instrument |
| admin-ui | admin render harness vs baseline | `ee7d8b7` “Top NaN” earlier; 0 real in the 30-day window | 2.7 s | **stay** until the admin pass |
| urls | protocol allowlist, slug pattern, redirects both ways | 2026-08-07 `javascript:` cover | 1.0 s | **stay** |
| volumes | active Capsid volume vs freeze point | none found; vol 18 ran to 36.7 KB ungated for 4 days. Report tier since 116 | network | **stay as report** |
| media-axes | media query axes present | plant replayed in 116 (spread replaced with a hand-copied key list; gate went red; reverted) | 0.2 s | **stay**; proven |
| page-payload | per-route CSS and cold-load ceilings; hydrate set; enhance brotli | see section D. **CI-X**: CI job does not build the client | local only | **stay the gate. Narrow the uplift. Put it on a path that builds the client, or stop claiming HR4 is gated by the review that ships.** |
| destructive | destructive intents call the confirmation predicate in-branch | `0ad6c86` N-1 of N; a ternary hid `reject` | 0.3 s | **stay** |
| hook-matchers | PreToolUse matchers cover permission-allow tool names | `f454673`; PowerShell unmatched 59 days | ~0.5 s | **stay** |
| hook-scope | deploy door and d1 arms; effective directory | `0cfab43`; `a67df0b` `.exe` suffix | 0.8 s | **stay** |
| hook-syntax | `bash -n` plus Python compile of embedded checkers | plant: apostrophe ended a quoted string; 0 later | 0.4 s | **stay** |
| floors | floor lines vs executed counts | `34e62f1`; `6c578bd`; most 30-day CI reds. `0de13b2` six floors by running | 0.1 s | **stay in CI. Not a session ritual.** |
| stack | colophon `stack.json` freshness, example config, drizzle | 0 real in 30 days after 39a; 30 Renovate false reds before `f7a089a` derived it in CI | 0.2 s | **stay** |
| features | `features.json` both ways; no digit in a feature sentence | 6 real CI runs, 1 unique: projects card title vs corpus (`ten-years-on-cloudflare`, `e7d4f49`) | 1.4 s | **stay** |
| headers | source Cache-Control / CSP declarations | `csp.mjs` admin `.data` arm | 0.2 s | **stay** |
| secrets | no secret in client chunks; per-root floors | first run on own allowlist; 0 later leak | 0.5 s | **stay** |
| migrations | manifest hashes both ways; never edit applied files | plants only | 0.2 s | **stay** |
| tests | `node --test` over `test/` | 1 real (missing `ask-origin.mjs`, `8d73356`); 1 plant left in (`89ce4fd`) | 20 s | **stay** |
| worker | workerd module tests; outbound fetch throws | 0 real in 30 days; 4 reporter bugs 08-29 | 59 s | **stay** |
| invariants | visibility, schema, FTS, helper signatures, bindings, carried tokens, citations | 8 real CI runs: missing modules; PR #30 hardcoded post-count tile | 1.8 s | **stay the checks. Do not grow it as law.** 170 KB on disk. |
| llms | `llms.txt` vs corpus; `--remote` adds D1 | Cloudflare 10000 transients; 0 content mismatch | 0.1 s | **stay** |
| backup | per-table export vs schema. **CI-X** | first run omitted a table; SQLITE_CANTOPEN later | local/remote | **stay** |
| browser | layout, theme, cache pairing. **CI-X** from ship; daily schedule | 12 real nightly reds 09-09 to 09-19 (privacy-link order `0f0b54e`; theme cases retargeted after header restore `d99e6be`; cache-buster identity `778922d`). 4 env/flake. Ruled 2026-09-14: stays off ship because a slow preview boot on a loaded machine would fail a ship for a reason that is not the site (`CI_EXCLUDED`, `browser.yml`) | network, minutes | **stay off ship. Narrow “the gates are the review” so a ship report that is silent about browser is incomplete.** |
| media | R2 index vs table; network only | plant deleted a live key; later R2 list timeout | network | **stay** |
| image-weight | image quality on rebuild placeholders | replay of pre-fix bytes; 0 later. 116 left this pending: every assertion reads remote D1 plus the deployed origin, so a plant is a production change. No weight floor in the gate | network | **stay pending a ruling.** Do not remove on a misdescription (R101’s failure). |
| uptime | UptimeRobot monitors vs manifest | `f2c30b9` floor 4 under 22 | network | **stay** |
| mail | SPF/DKIM/DMARC; red by design until cutover | none found. Report tier since 116; returns at cutover (`CUTOVER.md`) | network | **stay as report until DNS** |
| restore | weekly fresh-export round trip | 2 red then 1 green 09-09: export against the zero placeholder D1 id | weekly, slow | **stay** |
| head | disk vs HEAD. **CI-X** (vacuous on a checkout) | `b1668fb` NUL in own docblock. `6322456` caught two things the working tree could not | local, nested, minutes | **stay as a named command. Delete as a session ritual.** |
| microformats | h-card / h-entry / h-feed; no `rel=me` | `4d6b17e` gate bug (asserted absent `updated`) | 3.0 s | **stay** |
| d1-address | no `wrangler d1 <cmd> dustinedwards` by name except `--local` | `2ad4727` name desync; 9 sites | 0.3 s | **stay** |

Cheap gates with no 30-day product catch stay. Retiring a 0.2 s gate does not buy a page. Claude’s 19 September reading still holds: the cost that hurts is process, not CI seconds. Disagreement with the 19 September Grok audit, which retired diagrams, media-axes, and image-weight on a zero: 116 kept diagrams and media-axes, and left image-weight pending, which is the right order.

---

## D. Route payload ceilings and the uplift mechanism

**Owner.** `scripts/check-page-payload.mjs`. Rule 17: these numbers live here and nowhere else.

**Requires.** Every public HTML route has a measured ceiling (CSS brotli, and CSS plus enhance bundles). A new public route arrives with its own ceiling in the same commit. Enhancement modules have their own brotli ceilings. Hydration opt-in is exactly `admin.tsx` and `login.tsx`. `root.tsx` renders `<Scripts>` once, behind `hydrates ? (`. The search palette is not in any page’s cold load. Fonts reachable from a route are preloaded, with named exemptions (Inter italic by unicode-range; Source Serif 4 is the late heading face on purpose).

**The uplift.** `REDESIGN_UPLIFT` stores the pre-redesign ceilings. Current `ROUTE_CEILINGS` must still sit *above* those figures, or the entry is dead and must be removed. The map must be empty by `UPLIFT_EXPIRES = "2026-11-30"`. Moving the date is a ruling (R103: a build can be reverted, a date cannot). Comment in the gate: if they have not come down, the redesign has cost every reader about 1.2 KB a page and nothing else was going to say so.

Current `/blog/:slug`: css 9400 / total 12400, raised at `42eadca` (2026-09-20) for the rail, evidence row, dl head-block, and type rules. Measured 8982 / 12051 on the build that raised it. Math variant 12300 / 15200, measured 11801 / 14870. `/search` total raised 10000 to 10300 because `.tracks` gained a rail in `shell.css` and this page had 52 bytes of headroom. `/playground/ui` is the heaviest public sheet on purpose (10600 / 11500) and the only page that is.

**Caught.** Framework hydrate on every public page (`b098b49`). Theme bundle dropped; palette on every route (`f9aecb5`). `/about` arrived without a ceiling (`8dc084f`). Fixture CSS on a public ceiling (`e84b7a8`: 10,689 vs 10,600; the reading-progress specimen was dropped rather than the ceiling raised by 89 bytes). Pull quotes fitted under 11,600 without a raise (`b61ba82`).

**Cost.** Dual palettes still ship. Carried tokens still ship (section E). A page that is actually better (post page D, `435b288` / PR #52) had to raise the ceiling in the same breath as the rail (`42eadca`). The gate is CI-excluded, so HR4 is standing law with no CI teeth.

**Stay the gate.** **Narrow the uplift.** Replacement: *Ceilings are measured in this file. A raise is a dated comment on the row, with the measured figure. The redesign uplift expires 2026-11-30 and is not renewed as a blanket; leftover slack is cut back to about 20 percent over the then-measured figure. A fixture must not import a public sheet to draw one bar. `check:page-payload` runs on a path that builds the client (CI client-build step, or ship’s existing build), or the claim that HR4 is gated by the review that ships is dropped.*

Disagreement with `0d8943b`: that document said stay the gate and narrow the uplift. Agreed on that. It did not say the gate is missing from the review that ships.

---

## E. Carried-token map (R103, invariants section 31)

**Requires.** A declared token that nothing paints must have a row naming an owner (`scale:` or `component:`). A row for a painted token fails. After `CARRIED_EXPIRES = "2026-11-30"` the map must be empty. Moving the date is a ruling.

**What still sits on the map** (read 2026-09-20): easing and motion scales; caption, display, leftover h2/h3 pieces; lamp tokens (`--lamp-origin`, `--lamp-reach`, `--surface-catch`, `--lamp-chroma-on-paper`) owned by “the lamp on the glass controls, ruling 74”; error/warning/success fills; `--fig-*` chart palette; `--glass-fill-paper` owned by “the /search overlay glass, ruling 71”. `0d4e94a` dropped h1 and h2 type levels because their owner landed on the post.

**Caught.** The map shrinks when a page actually paints the token. That is the mechanism working.

**Cost.** Tokens specified since ruling 65 with no painter. Lamp is the one element Dustin ruled to keep and grow, and it still has no paint consumer. `--glass-fill-paper` is declared with no `var(--glass)` consumer. A deadline of 2026-11-30 without a live Light join is how they stay a contrast-matrix row about no reader’s screen (HR10, same shape as the dead `--bar-fill` pairs).

**Narrow.** Replacement: *A carried token names an owner and a date. Tokens whose owner has shipped and declined them are deleted (R105), not carried. Lamp tokens come off the map when one static figure haze ships on a post, or they are deleted as unused. `--glass-fill-paper` is deleted unless `/search` actually paints glass. Moving `CARRIED_EXPIRES` is a ruling that names which owners still owe a painter.*

---

## F. Suspension of rulings

**What it is.** A ruling that made the live site worse is suspended, not silently overwritten. Ruling 77 (header stays the solid purple bar, fixed, Inter only) was suspended by Dustin 2026-09-14. The header was restored byte-identical (`fb6a988`, then `94ded20`). Ruling 100 (restore keeping Menu overflow) was merged into 77 and suspended with it. Ruling 116’s record: a suspended ruling is not law. Part B was suspended with them. R88’s skip of the off-scale-literal gate survives as a REVISIT in vol 19’s open items, not as law.

**Caught.** `d99e6be` had to retarget `check:browser` theme cases from `.bar-theme button` to `form.theme-toggle` because the brief and the ship had diverged (7 FAIL / 1 SKIP). `e84b7a8` records a job posted 2026-09-13 22:12Z whose five amendments described a header that ruling 100 had already restored; three of five were unbuildable. `433c947` deleted the dead `.site-footer` block that still carried chrome fill after the footer had become paper.

**Cost.** Jobs and gates kept describing the previous header. Build 2 shipped a white mark and a lavender bar when `--surface-chrome` was replaced. The restore was byte-identical rather than a repair, so the lock and the live header still disagree in places (pills on search and theme, `fb6a988`).

**Stay** the hatch. **Narrow** the follow-through. Replacement: *A suspension is a dated commit that names the ruling, the live selector it restores, and the gates that must be retargeted in the same commit. A suspended ruling is not a secret second brief. A Capsid job whose handoff predates a suspension is stale and is rewritten or killed before build.*

Agreed with `0d8943b` on stay-with-wording.

---

## G. Two-reader review

**What it was.** Ruling 113: slop audit, two readers, cut only on agreement. Retired by 116 as standing law; the method was recorded in 115 for comment changes. Ruling 116 itself used two readers (Grok `review/grok-rule-audit` `7965040`/`521937d`, Claude `review/rule-audit-draft`) and the seat ruled the fourteen disagreements.

**What it caught.** Wave 1: 6 restorations (`7b2c8ec`). Wave 3: 13 restorations (`c5308ef`), load-bearing meaning (why 60 and 155 px; a false purge `success` is the Free-tier limit; `tabindex` -1 not 0; an in-Worker watcher dies with the thing it watches). Wave 4: 10 restorations (`e1ecdc8`). The two 19 September tables agreed on every hard rule and differed on fourteen rulings.

**What README says.** “There is no second reviewer, so the gates are the review.” CI since 2026-08-20 is “the closest thing here to a second opinion.”

**Cost.** A comment wave whose review step finds thirteen regressions is manufacturing both work and risk. Standing two-agent literary review on every gate repair would double every hop in section H.

**Narrow.** Replacement: *Gates review machinery. Two readers are for a cut that rewrites comments or retires law, and for a first-screen visual change the gates cannot see (layout that `check:browser` does not number). They are not standing law for a token tweak or a floor remeasure. Worktree PRs already supply a second machine. Do not invent a standing two-agent review for every ship.*

Disagreement with `0d8943b`: that document asked for a second human (or a named design pass) on anything that changes what a stranger sees in the first screen. That is right for header, home, and footer. It is too wide if “first screen” includes every post rail.

---

## H. Job-and-handoff workflow

Observed hops from an approved direction to a page a reader can see:

| # | Hop | Who | What it is | Earns its place? |
|---|---|---|---|---|
| 1 | Direction | Seat / Capsid brief | Ruling 65, amended 117/118. `TASK-redesign-brief-2026-09.md` | **Yes.** Without this the page is not intended. |
| 2 | Canvas draw | Claude Design | Reads conventions.md, generated guidelines, three Capsid exports (`scripts/lib/capsid.mjs`: researched rules, 2026-09-13 decisions, the brief) | **Sometimes.** Needed when the page does not yet exist. Not needed when the lock is already in the repo and the change is a token. |
| 3 | Handoff written | Canvas / seat | `part-a/`, `part-b/`, never in a synced path (R110). Anatomy, lock, amendments | **Yes, once.** The handoff is the job. A second document that restates it is a lag. |
| 4 | Capsid job posted | Seat | Task doc: commit order, constraints, success criteria | **Only if it is the handoff.** `e84b7a8`: a job whose five amendments described a header already restored. |
| 5 | R102: seat reads the code | Seat | Six routes were ruled unopened | **Yes**, and it is the hop that was skipped when it hurt. |
| 6 | Worktree + implement | Session | Ruling 60. Branch, build | **Yes.** The page has to exist. |
| 7 | Local check / typecheck | Session | Offline tier, or the named gates | **Partial.** Named gates that can see the files: yes. Full local `check:ci` (14 min here): no. HR16 already trusts CI. |
| 8 | PR | Other actors | Green CI. Site session skips this and lands on `main` | **Yes for other actors.** Site session: the skip is the content door. |
| 9 | `check:ci` | GitHub | Clean checkout, 31 of 35 offline gates, 177–217 s | **Yes.** Compile, schema, visibility, money-path order. Not layout. |
| 10 | Merge to `main` | Human / session | | **Yes.** |
| 11 | `npm run ship` | Dustin / site session | Token, CI sha, build, deploy, Ask, media, deferred drift | **Yes.** Cache, Ask spend, drafts. |
| 12 | Deploy (site Worker + watchdog) | Ship | | **Yes.** |
| 13 | Health poll / content-drift | Platform | Markdown commit live within one poll | **Yes.** |
| 14 | `verify-live` | Optional, billed | Not a gate. Warm pass after cache changes | **Yes when the body depends on a new input.** Not every ship. |
| 15 | Nightly `check:browser` | Schedule | 06:17 UTC. Alert after the fact | **Yes as backstop.** Not as the review that ships. |

**Count.** Fifteen if you count canvas to nightly. About **eight earn their keep** on a first-screen change: direction, one handoff, read-the-code, implement, CI, ship, deploy, verify-live when the cache key moved. About **four** earn their keep on a 2px type tweak: implement, CI, ship, deploy.

**The constraint is the pile, not any one hop.** A direction approved on Sunday is still not a URL until a job, a worktree, green CI, and a ship window. That is correct for cache, Ask spend, and drafts. It is excessive for “change the home type scale by 2px.”

**Narrow.** Replacement: *One written handoff is the job. If the ruling log moves after the job is posted, the job is stale and is rewritten or killed before build. Copy and token tweaks ride the site session on `main`. Anything that changes first-screen chrome, hydration, or payload uses the full hop list. Do not keep a parallel “canvas law” and “ship law.”*

`.design-sync/conventions.md` still documents `PostCard`, `tag-chip`, `gate-card`, `--surface-chrome`, 48rem `page-inner`. That file is what a design session reads. It is behind the lock and will recreate cards if left as the brief. See section J.

---

## I. `.design-sync/NOTES.md`

The first document at `0d8943b` said NOTES.md is not in this repo. It is, at `.design-sync/NOTES.md` (10,616 bytes on 2026-09-19). It is operational notes for the next sync agent, never uploaded.

| Id | Forbids / requires | Caught | Cost | Rec |
|---|---|---|---|---|
| N:scope | This repo is an application, not a design system. Four standalone components. In: 21 public sheets, two Inter faces, PostCard, Pagination, SiteLogo, SiteLogoHeader. Out: page singletons, enhancement injectors, admin sheets, katex | Dustin 2026-09-12 | read 10.6 KB | **stay** |
| N:build | `build-inputs.mjs` must run before the converter; `--entry` is required | converter looks for `node_modules/dustinedwards-info` | 0 | **stay** |
| N:tsconfig | converter cannot parse `tsconfig.cloudflare.json` (glob `/*` opens a comment) | parse died at line 36 | 0 | **stay** (workaround in build-inputs) |
| N:fontface | `@font-face` url()s resolve against the CSS entry, not the sheet | Inter silently became a system font | 0 | **stay** |
| N:import | validator greps `@import` without stripping comments | failed the gate twice as a missing import (`@import "tailwindcss"` in a comment) | 0 | **stay** |
| N:contrast | bundle ships without `prefers-contrast: more`; scraper flattening made `--border` == `--border-strong` | measured 2026-09-12 `_ds_manifest.json` | 0 | **stay** |
| N:chrome | `--surface-chrome` collision: redesign invented `--bar-fill` and invalidated the header | header restored byte-identical rather than repaired | the header | **stay** |
| N:warns | known render warns (Shiki tokens, dead @font-face drop) | none new | 0 | **stay** |
| N:preview | themed wrapper must set `color` as well as `background` | PostCard.DarkTheme description invisible | a preview cycle | **merged into C:surf** (116); one line may stay here because this is what a sync agent reads |
| N:pw | playwright 1.61.1 pins chromium 1228 | none | 0 | **stay** |
| N:sheets | SHEETS was hand-maintained and went stale | R111 | 0 | **merged into R111**; one line stays naming the gate |
| N:cascade | cascade order is load-bearing and not alphabetical | none found later | 0 | **merged into R111** |
| N:upload | `part-a/`, `part-b/`, `references/`, `uploads/`, `github.md` are never in a plan’s `deletes` | R110; skill instruction would delete 96 shots; `job_60421f2b7097` moved `github.md` | 0 | **stay here.** This file is what a sync agent reads and R110 is not. |
| N:global | `globalName` is `DustinEdwards` | none | 0 | **merged into C:vocab** |

Do not paste these into CLAUDE.md. Do not bring a third law file back.

---

## J. `.design-sync/conventions.md`

4 KB. Rides in the README’s 32,000-char inline ceiling. This is what a design agent reads.

| Id | Forbids / requires | Caught | Cost | Rec |
|---|---|---|---|---|
| C:theme | no theme provider; `data-theme` on any element retokenises that subtree | none | 0 | **stay** |
| C:surf | a themed container sets `background: var(--surface)` and `color: var(--text)` | preview cycle; N:preview | 0 | **stay** |
| C:router | PostCard and Pagination throw outside a router; wrap in MemoryRouter | none found later | 0 | **stay** for the four exported components |
| C:idiom | no utility classes, no `style` prop, no theme-object props | SiteLogo silently drops `style`; three identical marks in a sizes cell | 0 | **stay** |
| C:tokens | token families enumerated from the real sheet | five dead tokens cut in PR #37 | 0 | **stay**, and re-run on rename |
| C:border | popover elevation and pinned bars take `--border-strong` | HR5; scraper collision | 0 | **stay** (this is HR5’s owner) |
| C:page | vocabulary: `page`, `page-inner`, `prose`, `post-list`, `site-header`, `site-shell-footer`; login is `gate-card` | `.site-footer` rename un-hid print footer (`5b8007e`) | 0 | **narrow.** `page-inner` at 48rem and `PostCard` / `tag-chip` / `gate-card` are the 2025 public language. 117/118: paper, dust rule, rows. Login is a column form on paper, not a filled card. |
| C:li | PostCard renders an `<li>` and needs a `post-list` parent | none found later | 0 | **stay** for the export; do not teach it as the public listing language |
| C:links | links are `--brand` underlined, `--visited` when visited; do not restate per anchor | R79; build 2 lost visited-on-chrome | 0 | **stay** (one line remains because the canvas cannot read a Capsid id) |
| C:truth | `styles.css` beats this summary | none | 0 | **stay** |

**Narrow C:page.** Replacement: *Public vocabulary is paper, a dust rule, rows, and `.tracks` (text, wide, full, rail). `PostCard`, `tag-chip`, and `gate-card` are the four-component export and the admin kit, not the public page language. Chrome is `site-header` and `site-shell-footer` on `--paper`. Login is a column form on the same public chrome.*

This is the first document’s strongest process finding, and it is right: a design agent reading conventions.md will rebuild the 2025 site.

---

## K. Remaining Capsid standing rulings that still constrain a page

116 retired plans, schedules, and duplicates. What is left and still binds a page, from the 19 September tables minus the retired list. Capsid was not re-read; this is that inversion, not a live vol 19.

**Stay (breakage / drift, page-facing).** R2–R5, R8–R11 (webmention bounds, escaped render, cache purge, gateway/renderer split). R19 operator may not delete mentions. R20 no-direct-deploy hook. R23 counting floors. R26 browser admin-absent branch deleted. R30 render-drift after renderer+content is ordering; assert a second sync. R32 LQIP. R34 sniffed media type (live origin served a declared-PNG SVG inline, `74b7d0c`). R37 operator bearer. R39 stack.json is a build product. R40 Sentry logs only (traces would put `/preview/<token>` in Sentry). R42 load-bearing pins. R43 restore drill. R49 a 422 from `sync_posts` is unrepairable. R51 `check:worker` out of `check:head`. R53 a slug rename cannot be staged by withholding the sync (nine old URLs 404’d ~11 h, `6c578bd`). R56 readiness gates only on checks whose repair is not a later ship step. R57 home “Start here” leads with the featured post. R59 operator audit line. R64 paper twins are gitignored static products. R84 serif swap-CLS. R94 disabled-state contrast floor deleted, not exempted around. R99 redesign grid is `.tracks`, not `.page`. R101 logo second fill binding. R104 `NON_PARTICIPATING` never counts as a reference. R105 an owner that shipped and declined a token is closed evidence. R109 `guidelinesGlob` is an explicit list. R110 no import direction. R111 SHEETS gated. R114 `aislop fix --safe` never runs (deleted a DELETE-path guard).

**Stay until the work lands.** R54 `docs/ADMIN-DESIGN.md` is the admin standard until the admin pass. R65 is the redesign itself; 117/118 amend it. R63 publications rebuild (shipped; the pages are the record). R38 content is Dustin’s, not a session’s. R29 automate anything that ends in Dustin’s hands and is not a decision. R102 the seat reads the code before ruling on it. R106 Claude Design MCP is a read surface; writes go through DesignSync. R107 MCP member and sharing tools are off limits. R12 readership = gateway requests, labelled “includes crawlers”; no beacon. R46 voice over wrapper. R47 old slugs 301. R50 no Mastodon, no Bluesky, no `rel=me`. R75 purple is the only accent a user can click. R79 visited is a second shade of purple. R80 Source Serif 4 for public headings 32px and up (118 narrowed this to titles plus in-article headings at 32px+). R81 home demonstration is Ask, GET `/search`. R95 figure axis stroke to `--fig-dust-400`. R96 `--z-dropdown` 200, overlay 800.

**Narrow or already narrowed by 117/118.** R70 Paper/Glass/Light: glass is retired as layout material; Light is still owed a painter (section E). R71 glass restricted to theme, search, overflow, Ask frame: header glass is gone; search glass is `--glass-fill-paper` with no consumer. R27 editor routes link KaTeX CSS unconditionally: 2.8 KB on two admin pages; keep until measured against the admin pass.

**Go as session-facing restatement.** R103’s *sentence* stays in the payload and carried maps. The restatement in vol 19 of 60–104 that vol 18 already holds is the cold-start tax the 19 September Grok audit named. Do not ask a page session to re-read it.

---

## Three questions

### 1. Which rules, if any, would stop this site from being the best version of what it is trying to be, and how?

The site is trying to be a Swiss/editorial document that also runs instruments, readable with script off, true to its numbers, cheap on the wire, and complete for an agent.

Almost none of the *hard* breakage rules stop that. HR1, HR3, HR4, HR6, HR8, HR16, HR18, HR19, HR20 are why a draft cannot leak, a secret cannot ship, a page is a document, a `javascript:` cover cannot run, silence is not cached, a dirty tree cannot deploy, D1 cannot be hand-edited, and Ask cannot spend on a foreign origin.

What can stop a better page:

1. **`REDESIGN_UPLIFT` treated as permanent slack**, plus the gate that polices it sitting outside CI. Dual palettes and a 2026-11-30 cliff. A real page (post D) already had to raise `/blog/:slug` at `42eadca`. A fixture importing a public sheet was dropped rather than allowed 89 bytes (`e84b7a8`). Swiss type plus a measured rail should not die on a ceiling that exists to catch a dependency wandering in.

2. **`conventions.md` still teaching PostCard / chips / chrome / 48rem `page-inner`.** A design agent will rebuild the 2025 site. NOTES.md was right about `--surface-chrome` and was still ignored; the header was restored rather than repaired.

3. **Stale Capsid jobs after a suspension.** `e84b7a8` implemented the previous header’s amendments. Canvas law and ship law forked.

4. **The citation floor that keeps HR5 and HR13 employed**, and the “all twenty cited” clause. Dead law stays because deleting it fails a gate.

5. **Reading HR4 as “no poster geometry / no enhancement.”** The rule forbids framework script on public pages. It does not forbid a CSS-only bar, a rail, or a figure haze. `e84b7a8` and the dropped specimen are the exhibit.

6. **Mainline-immediate plus “the gates are the review” while layout is nightly.** Sessions push comment waves and floor remeasures as if they were pages. Visitor-visible defects arrive with a deploy and are caught the next morning.

HR4 itself does not stop the best version. Hydrating public React would make a different, worse site. 117 chose a document.

### 2. Where is the process itself the constraint rather than any single rule?

The hop count is **fifteen** from canvas to nightly, **eleven** from handoff to live, **eight** that earn their keep on a first-screen change, **four** that earn their keep on a token tweak.

The hops that earn their place: direction (1), one handoff (3), read-the-code (5), implement (6), CI (9), ship (11), deploy (12), verify-live when the cache key moved (14).

The hops that are the tax: canvas as a required draw when the lock already lives in the repo (2); Capsid job as a second copy of the handoff (4); full local `check:ci` (7); two-reader on every change (G); nightly as the only layout review (15).

A direction can be approved and still not be a URL until a job, a worktree, green CI, and a ship window. That is correct for cache, Ask spend, and drafts. It is the reason two weeks of sessions produced one inventory page (`5689c72`) while the rules kept growing, and the reason post page D then landed as a real page (`435b288`) once the handoff was the job.

Split: *copy and token tweaks ride the site session on `main`; anything that changes first-screen chrome, hydration, or payload uses the full hop list.* That is the process equivalent of 118’s “60–72ch is a prose rule, not a page rule.”

### 3. What is missing? Pages are increasingly read by agents as well as people.

Already present and should stay: `.md` twins and `Accept: text/markdown` (`2f0b4d5` caught HTML on that Accept); `llms.txt` / `llms-full.txt` and `check:llms`; JSON-LD Person owned once (`6900cb8` refused two Person objects, per the first document); microformats, no `rel=me`; GET `/search` with example questions as links; MCP operator surface with first-publish reserved to the human; one owner per fact so an agent cannot quote a stale digit from prose; public HTML complete without script.

Missing or weak:

1. **`llms.txt` does not describe the visual lock.** It describes bindings, twins, and feeds. An agent designing *from* the site will read conventions.md and draw cards. Add one paragraph: public pages are HTML and CSS documents on limestone paper; do not infer a component library from `/admin` or from the four exported components.

2. **No gate that conventions.md matches the public lock.** `check:design-sheets` binds SHEETS to root.tsx. It does not bind the canvas vocabulary to 117/118. Design-sync can ship a brief the public CSS has left. A small `check:brief` (or a section of `check:design-sheets`) that fails if conventions.md still names `PostCard` / `tag-chip` / `gate-card` as public page language.

3. **No “stale job” check against the ruling log / suspension list.** `e84b7a8` is the plant, already applied in production as unbuildable amendments.

4. **Ask answers are visibility-gated (HR1) but not required to cite the `.md` twin.** An agent-facing citation should prefer `/blog/<slug>.md` (or the Accept equivalent) over the HTML URL when the claim is the prose.

5. **HR4 is not in the review that ships.** `check:page-payload` is CI-excluded. A client-build step in CI, or running the gate after ship’s existing `npm run build`, closes that. The first document did not name this.

6. **`check:browser` is an alert after the fact.** That is the right cost decision for ship. The missing piece is a ship-report line that names the last nightly verdict for the pages the sha touched, or a `workflow_dispatch` run after a first-screen deploy (`browser.yml` already allows it).

7. **Lamp / Light has tokens and no painter.** 118 deleted “no atmosphere yet” as a lock rule. The carried map still holds the lamp tokens under ruling 74. One static figure haze on a post, or delete them. Leaving them until 2026-11-30 is a cliff with no page.

8. **Agent-complete is HTML plus twins plus `llms.txt`.** It is not “the canvas can rebuild the site from conventions.md.” Until conventions.md is the lock, the agent-facing design brief is the wrong site.

---

## If this is stamped

- HR4 stays. HR9 shrinks to enhancement loading and `/login`.
- HR5 is a pointer. HR13 leaves the preamble. The citation floor drops the “all twenty cited” clause.
- HR10 and HR12 bind gate authors. FAILURES.md is read when a gate fails.
- Ship stays. Local full `check:ci` and nested `check:head` stop being session law.
- Site session still ships on `main` and may hold a page until it is better. Other actors stay in worktrees.
- Uplift expires 2026-11-30 and is not renewed as a blanket. `check:page-payload` runs where the client is built.
- One handoff is the job. A job that predates a suspension is killed. Conventions.md is rewritten to the public lock.
- Two readers are for law cuts and first-screen chrome, not for floor remeasures.
- Add: one `llms.txt` paragraph on the document lock; a conventions-vs-lock check; Ask citations prefer the twin; ship report names browser; one lamp painter or delete the tokens.

Left as they are: visibility, secrets, cache stamps, derived stores, spend order, backups, worktrees, ship, content ownership, never `git add -A`, sessions do not write Capsid.
