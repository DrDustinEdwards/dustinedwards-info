# CLAUDE.md - dustinedwards.info

Personal platform and Cloudflare showcase for Dustin Edwards. React Router 8 (SSR) on Cloudflare Workers, Drizzle on D1, Better Auth, R2 for media. Also the flagship site and a Capsid CMS consumer.

**This file holds only what a session needs BEFORE it can read anything else.**

**PRECEDENCE, corrected 2026-08-21.** It read: "Everything durable lives in Capsid. If a fact is in both places, Capsid wins and this file is the defect." That was true while Capsid held everything durable, and stopped being true when the hard rules and `VERIFICATION.md` moved into this repo. They moved for the reason that decides the question:

**CAPSID CANNOT BE GATED, BECAUSE EVERY GATE VERIFIES DISK.** So:

- **The REPO wins for anything a gate can verify**, and for anything the code cites: the hard rules, gate counts, the current shape of the code. A count copied into Capsid rots silently; the same count in `check-all.mjs` is the only copy that can be wrong and be caught.
- **CAPSID wins for rulings, reversals and the measurements that forced them.** None of that survives in code comments, and the reversal log is the half of the store worth its storage.

Where they disagree ON A GATED FACT, the repo is right and Capsid is stale. Where they disagree ON A RULING, Capsid is right and this file is the defect. The same rule as before, scoped rather than reversed.

## Session ritual

Start: `brief("dustinedwards")`, or read `capsid/conventions.md` then `dustinedwards/core.md` by hand.

Do this before touching code. Not a formality: the recurring failure here is a session acting on a stale claim it could have checked in one call.

**Then read `FAILURES.md`. It is one screen and the shortest useful thing in this repo.** The recurring failure SHAPES, one line each, every one already written down at length before it happened again. It is HERE rather than in the document list at the bottom for the reason the page itself makes: a lesson nobody meets is not recorded. These shapes govern how to read everything below them, including the rules.

**There is no end-of-session write. Sessions READ Capsid and never write it**, per `dustinedwards/core.md`. This file asked for a dated episodic at the end, contradicting that rule outright; Capsid won and this file was the defect, exactly as the precedence paragraph above says. Removed 2026-08-18. Do not re-add it here: if the standing rule changes, it changes in Capsid first and this file follows.

## Hard rules

**THIS FILE IS THE ONE HOME, since 2026-08-21.** They lived in Capsid and were pointed at from here. Capsid cannot be gated, because every gate verifies disk, so the rules the code cites by number sat in the one place no assertion could reach. Source files across `app/`, `scripts/`, `workers/` and `test/` cite them, as do the root documents; `check:invariants` section 15 binds every cited number to a rule that exists here. **The count that used to sit in this sentence had gone badly stale, and the gate is the only place it belongs, so this is a pointer now rather than a digit. Rule 17.**

**EVERY RULE CARRIES A TAG: `GATED by <instrument>` or `UNGATED`.** It replaces the older ONE-LINER and PROSE labels, which encoded the same axis without naming the instrument; keeping both would have been two owners for one fact.

The tag answers one question only: **can `npm run check` fail on this rule.** Read it before trusting a rule to be enforced. A tag is derived by READING THE GATE, never from the rule's own claim about itself, because a rule that says it is checked is exactly the shape that goes stale first. Where a rule has two halves with different answers it carries two tags, and the halves are named.

UNGATED does not mean optional. It means the only thing between the rule and a violation is somebody reading it, which is why the ungated ones carry the longest prose. What could be gated and is not: `dustinedwards/gate-backlog.md`.

**Numbering is APPEND-ONLY but no longer frozen.** Nothing pins a number to a line any more; see the note that closes this section.

### 1. GATED by check:invariants. Every public read goes through `publiclyVisible()`.

`check:invariants` sections 2, 6 (alias-resolving, two named exemptions) and 8 (every `search_docs` reader composes `visibilityClause()`).

**AND EVERY PUBLIC OBJECT DERIVED FROM A POST, not only the row reads.** A public URL that can name a draft is a visibility bug whether it is HTML, a feed, a search record, an Ask answer or an OG card. The draft-card leak bypassed this rule precisely because an R2 key is not a row read: the object was live, immutable and reachable while its post was unpublished. The sites are named because a rule that says "everywhere" is checked nowhere: `blog.$slug.tsx`, `blog.rss[.xml].ts`, `blog.feed[.json].ts`, `sitemap.ts`, `search.server.ts`, `ask.server.ts` and `build-og.mjs`, which uploads and prunes against the keys the live rows imply.

**CONTENT-ADDRESSED `/media/*` IS OUT, deliberately and by measurement.** A key from `contentKey()` in `app/lib/media/classify.mjs` is a digest of the bytes, so it cannot name a draft, cannot be guessed from a slug and reveals nothing by existing. Composing visibility in `app/routes/media.$.ts` would add a D1 read to the hot image path to protect a fact the key does not carry.

### 2. GATED by check:backup and check:invariants, UNGATED for the export fact itself. `wrangler d1 export` is BROKEN here.

Per-table backups via `check:backup`. FTS `DELETE FROM` is gated by `check:invariants` section 7; the repair is `('rebuild')`. That the export command is broken is an ops fact about a vendor binary, which no gate can assert; what IS gated is that the repo does not depend on it.

### 3. GATED by check:secrets. Secrets are read only inside the server boundary.

`check:secrets`, both directions, per-root floors.

### 4. GATED by check:page-payload for the public script payload, UNGATED for the rest. Keep the PUBLIC PAYLOAD lean, which is more than the Worker.

The subject is everything a reader downloads to see a page: the Worker bundle, the CSS, the route JavaScript and whatever the page speculatively fetches. Inline SVG over an icon library. CodeMirror is lazy-split. Client auth is imported by `/login` alone.

**THE PUBLIC PLANE SHIPS NO FRAMEWORK SCRIPT, since 2026-08-26.** Public routes do not hydrate React; hydration is opt-in by route (`handle = { hydrate: true }`, today the admin layout and `/login`) and root's Layout renders `<Scripts>` only behind that flag. A public page's whole script payload is the enhancement bundles from `app/enhance/`, prebuilt by `build:enhance` and loaded by nonced module script tags. `check:page-payload` owns the per-bundle ceilings, pins the opt-in set, and syntax-checks every served asset; `check:invariants` section 24 refuses a client hook in an unhydrated tree, the defect class this design creates: code that compiles, renders, and does nothing in the browser. The wire half is `check:browser`'s enhancement cases and verify-live section 16.

**WIDENED 2026-08-24, because as written it succeeded at the small thing and ignored the large one.** "Keep the Worker lean" was satisfied while `app.css` imported the admin stylesheets and every visitor to the home page downloaded the media library and the post editor. The Worker was lean and the page was not. A rule scoped to one artifact grades that artifact.

**Prefetch is a JS-only extra, never a progressive-enhancement requirement.** Hover speculation and `prefetch="intent"` may make a click feel instant; nothing may depend on them, and a scriptless reader must lose only the speed. Weigh what a speculation costs the reader against what it saves them, and say which when you add one.

### 5. UNGATED. Popover elevation and pinned bars take `--border-strong`, never `--border`.

Not gateable: it would need a hand-maintained selector list, which is the mirror anti-pattern.

### 6. GATED by check:urls. URL protocols are allowlisted, SCHEMA AND RENDER.

`check:urls`. Operator READ paths validate against the exported `SLUG_PATTERN`, and `content/posts/<slug>.md` is stated ONCE, by the exported `postPath()`.

### 7. UNGATED. A gate that feeds a module its own stored output cannot see the TRANSPORT.

Live claims verify on the live path. **A boundary note is a CLAIM that ages**: two have gone false since being written, one of them falsified in the same commit that wrote it.

**Boundary-note presence is NO LONGER GATED, since 2026-08-21.** `check:assertions` asserted it and was deleted in audit tier 4.1. Presence was all it could ever assert, and this rule's own second sentence is why that was never the valuable half: nothing can check that a note is still TRUE. The notes stay and are worth writing; writing one is a convention now, not a build failure.

### 8. GATED by check:headers. WORKERS CACHE IS ON, and the Worker's stamp IS the statement.

Two halves, and a route that knows only the first will still get it wrong.

**The platform caches silence.** A response with no `Cache-Control` is CACHED under RFC 9111 heuristic freshness, not skipped.

**So `workers/app.ts` stamps `private, no-store` on any response that declares none.** A route therefore opts IN to sharing and never opts out of refusal. That inversion is the point: a route relying on "the default" is relying on something it never stated, which is how `/api/health` came to be correct for a reason no reader of the route could see.

**The cookie pairing, stated because it is the half people reconstruct wrongly:** a route that sets `Vary: Cookie` and receives a request carrying ANY cookie is downgraded to `private, no-store` and BYPASSES the shared cache. Presence of a cookie, not a particular cookie. The full matrix, including why an absent `Cookie` header is not its own variant, is `dustinedwards/workers-cache-vary.md`.

**THOSE READERS ARE NO LONGER SERVED FROM A FULL RENDER, since 2026-08-26, and the pairing above is UNCHANGED.** The bypass cost every reader who had touched the theme toggle, which sets a cookie for all three choices, and every signed-in reader: measured on the wire, `theme=system` and a stray `_ga=1` both read BYPASS on every HTML page. `workers/app.ts` now keeps its own `caches.default` entry keyed by the request URL plus the resolved theme, looks it up before rendering, and stores the public copy once the headers are final. The wire is still `private, no-store` for anyone carrying a cookie, so the platform stores nothing for them and the sentence above stays true as written.

**Why the theme is in the KEY and not in a `Vary`:** the platform's key is the entrypoint, the path and query, and the Worker version, and nothing this Worker sets puts a header into it; `caches.default` is keyed by the Request handed to it and carries no headers at all. `media.$.ts` records the measured cost of getting that wrong. So the dimension is a synthetic `__theme` parameter on a key URL that is never served and never linked.

**THE SAME BLINDNESS COST A REPRESENTATION, and the fix is a bypass rather than a fourth dimension.** A key that cannot carry a header cannot carry `Accept` either, so the HTML copy of a negotiating route answered the markdown request, measured in production. A request preferring anything over HTML now skips the lookup AND the store, one expression governing both: `negotiatesAwayFromHtml` in `app/lib/negotiate.mjs`, which carries the grounds. Gated on the wire by `check:browser`, which warms the HTML entry first and asserts that it did, because the case is vacuous otherwise.

**What licenses reading the cookie for the theme alone is a MEASUREMENT, not an argument.** `check:browser` asserts on every route declaring the shared headers that a credentialed reader receives byte-identical HTML and that the theme changes only the enumerated set the gate itself carries. The themed cache is sound only while that holds, so the gate is the precondition rather than a regression test, and it landed first.

**THE ENUMERATION IS THE GATE'S, NOT THIS FILE'S, since 2026-08-28.** `maskTheme` in `scripts/check-browser.mjs` is the one owner. This sentence used to name the members and went stale the day the set grew, and it once carried a COUNT that disagreed with the gate beside it. Rule 17, and this file is where that habit has cost the most.

### 9. GATED by check:features for the inventory, UNGATED for the law and the door. PROGRESSIVE ENHANCEMENT, not "zero JS".

`content/enhancements.json` is reconciled in both directions by `check:features`. The admin plane is exempt. Law: `progressive-enhancement.md`.

**HOW AN ENHANCEMENT LOADS, since 2026-08-26: a nonced module script tag, never a React effect.** The public plane does not hydrate (rule 4), so the modules in `app/enhance/` are prebuilt into self-contained bundles by `build:enhance` and rendered as `<script type="module" nonce src>` beside the markup they upgrade. The standing ruling is unchanged and both halves are instrumented: works without script (the fallback inventory here), fast with it (`check:browser`'s enhancement cases run the bundles in a real browser).

**THE DOOR IS ON THE PUBLIC PLANE AND OBEYS THE LAW.** `/login` is unauthenticated, so it is a public reading route and its form works with scripting off, even though everything behind it is exempt. This sentence exists because the rule kept being compressed to its slogan and the exemption kept being read as covering the sign-in page: the seat's translation flattened it, README asserted the flattened version, and login shipped script-only until 2026-08-23.

**A slogan is not the rule.** "Zero JS" is the forbidden phrasing precisely because it is the one that survives paraphrase, and it is false in both directions: enhancements are allowed, and the fallback is mandatory.

### 10. GATED by check:invariants for the tenth class, UNGATED for the other nine and for every discipline below. A PASS COUNT IS NOT COVERAGE. Count assertions that CAN FAIL.

Ten named classes: unfailable conditions, unreachable thresholds, zero-scope searches, unanchored needles, over-wide exclusions, empty alternations, source-counted floors, comment-satisfied anchors, alias-blind scans, helper-signature drift.

**THE DISCIPLINES. Restored 2026-08-21 from Capsid `core.md` version 1684, whose rewrite that day dropped them.** They are the operative half: the classes name what goes wrong, these say what to do.

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
- **A GATE'S EXPECTED VALUES ARE NEVER PRODUCED BY THE PROCESS IT CHECKS.** Fixture independence, and what justifies `check:logo` and `check:contrast` in the shape they take: `scripts/fixtures/icon-suite.json` is deliberately NOT generator output.
- **VERIFY A NEEDLE AT THE BYTE LEVEL.** A `\b` written into a script arrived as an actual backspace, 0x08; `grep` and `sed` DISPLAYED it correctly while the regex matched nothing. Read the failing line's bytes and replicate the needle standalone.
- **AFTER ANY SCRIPTED EDIT, GREP FOR LEFTOVERS AND DIFF AGAINST THE PRE-EDIT COPY.** A deletion script whose end anchor matched the newline inside its own start anchor joined lines rather than removing them, and EXITED ZERO. A zero exit and a changed byte count are not evidence the edit did what it claimed.
- **NEVER READ A RESULT THROUGH `head` OR `tail`.** A truncated importer search reported a clean answer about the part it printed and nothing about the part it dropped, which is indistinguishable from the clean answer it was mistaken for.

Only the tenth class is gated. The rest are METHOD, which is what they always were. See `VERIFICATION.md`, in this repo.

### 11. GATED by check:invariants. `app/db/schema.ts` IS the source of truth.

`check:invariants` section 4 binds schema.ts to the migrations to the live database. **Corrected 2026-08-28 to what the gate does:** it compares COLUMNS with their types and INDEX NAMES with their column order. It does NOT compare a partial predicate, a collation or a direction: SQLite reports those as DDL text and drizzle models none, so `media_trashed_idx` is partial in the SQL and unqualified here, stated at the index rather than gated.

Prefer the query builder over raw SQL. **`search_docs` is the asserted exception:** modelled for the schema comparison, read ONLY in raw SQL, because section 8 owns its visibility rule and section 6 knows only `posts`, so a query-builder read would be covered by neither. Section 4a bans it and names the exit.

**Section 5 was DELETED on 2026-08-16**: its regex could desync on a regex literal and examine nothing while printing a clean result. Do not rebuild it as regex.

### 12. UNGATED. A new gate is tested by REPLAYING THE DEFECT it was written for.

EXIT 1 IS NOT EVIDENCE, and it runs BOTH WAYS: **a plant is proven applied before any result is read.** A green run after a failed plant proves nothing; a mangled path once made a plant a silent no-op and the gate went green. `check:migrations` is the recorded plants-only exception.

**A DICHOTOMY INHERITS ITS AUTHOR'S FRAME.** Before resolving an either-or by measurement, check the question's own scope assumption against the artifact: a plant proves something about what it plants against, and the framing chose the target before any evidence was taken. A NAMED discipline; the case is in `VERIFICATION.md`, on the split that the rules are the index and the method file carries the evidence.

**A SURFACE RECOLOR RULING MUST ENUMERATE THE POSITION: `position: absolute` overlays that only render against that surface.** How the skip-link-on-purple-chrome defect was classified: a recolor ruling that lists the components it repaints misses anything whose only appearance is over the recolored surface, because such an element is invisible in the ordinary render and in every screenshot of it.

**When a file carries uncommitted work, revert a plant by TARGETED EDIT, never `git checkout`.** Skipping this once duplicated a lint rule whose stale copy then mis-guarded a plant.

**A REFACTOR PROVES EQUIVALENCE BY DIFFERENTIAL, not by reading.** Keep the OLD implementation verbatim, run it and the new one over REAL inputs, not invented ones, and compare their output. Then prove the comparison can DISCRIMINATE, by running a knowingly different implementation through it and watching it report a difference; a differential that cannot tell two things apart agrees with everything. That control is the half that makes any number of identical comparisons mean anything.

### 13. UNGATED, class only; all instances resolved.

A fallback that SUBSTITUTES A DIFFERENT VALUE is not failing closed. Known-justified: `REMOTE_ARGS ?? []`, and `?? "unknown"` on the rate-limit client IP, stated once in `app/lib/client-ip.ts` since 2026-08-25, where it had been unmarked spellings across five routes; that substitution pools every off-edge caller into one shared bucket, which is the closed direction. Each is marked `JUSTIFIED SUBSTITUTION` at its call site. **The theme's `?? "system"` was the third and is GONE since 2026-08-29**, with the header that needed it: the one-button control reads the theme off `<html data-theme>` through the cascade, so nothing passes a resolved theme down and there is no absent value to stand in for.

**The lint form is GONE since 2026-08-21**: `check:assertions` rule (e) enforced it and the gate was deleted in audit tier 4.1. In `app/` this class is stronger than a lint anyway, because a map keyed by its own union is a typecheck failure. In `scripts/` it is unenforced now, the accepted cost.

### 14. GATED by check:migrations. Migrations are hand-written, drizzle-kit is deliberately absent, and an applied migration is never edited.

`check:migrations` hashes every file against the manifest, both directions.

### 15. UNGATED. Do not modify `.claude/settings.json` without explicit instruction.

**UNGATED since 2026-08-21**, and that is the rule's natural state. `check:hooks` read the file and never wrote it, and was deleted in tier 4.1: it could not see whether a hook RAN, only what the file declared, so a green run was compatible with enforcement being off entirely. A rule whose whole content is "do not edit this without being told" is enforced by being read.

**RESTORED, THEN FALSIFIED BY MEASUREMENT, both on 2026-08-21.** A clause recovered verbatim from Capsid said several repos still carried a fail-open `scoped-git-add.sh`; it was true when written, and measuring at origin by blob sha found one. **The lesson is the clause, not the count:** *a claim inherited from a document gets the same treatment as one from memory.* See `FAILURES.md`.

### 16. GATED by ship. The ship contract: CI for this sha, token before build, Ask converged last.

In `scripts/ship.mjs`, each failing closed and none of them optional.

**CI concluded success for the EXACT HEAD sha.** No run, still running, any other conclusion, or an unreachable API all refuse. There is no override flag, because a flag would be used on exactly the day the check was right. The repo is private, so `gh auth` is required.

**`OPERATOR_TOKEN_FILE` is checked BEFORE the build**, not at the step that needs it. A missing token is a configuration problem fixable in a second and must not cost a deploy that has already run its gates.

**The Ask index is brought into step LAST, after the deploy and the D1 sync, and a failure there is LOUD while the deploy STANDS.** Index freshness is worth less than write reliability, and health catches a failed sync within its poll interval. Ship reads the operation's converged verdict rather than its status code.

**The D1 sync carries the DRIFT REPORT, since the artifact arc.** Before writing, `sync-content` compares every row's `source_blob_sha` and `render_hash` against the fresh build and prints the classes by slug; the write runs regardless, because converging D1 to the build is the repair. RENDER DRIFT, the same source rendered differently by the Worker and the Node build, exits nonzero AFTER the deploy stands, the same shape as an index miss, and names a pipeline defect rather than staleness.

**THE WATCHDOG WORKER DEPLOYS HERE TOO, since 2026-08-29, and it is the fourth step of this shape.** After the site deploy and after readiness, because it binds to the site and must not be pointed at a build this run has not proven; a failure is a MISS rather than a refusal, so the deploy stands, the sync still runs, and ship exits nonzero at the end naming it. The previous watchdog keeps firing meanwhile, so the failure degrades the WATCHER and never the site.

**Separate sentence, UNGATED, process class: a ship window owns the tree from its first step to its last.** Nobody edits the working tree or lands on `main` while one is open. A prior ship deployed and then refused mid-run because the session deleted a file underneath it, and the deploy was coherent only because the build had already finished. No gate can see this, and it is deliberately not folded into the steps above, so a session never learns to fail a deploy over it.

### 17. UNGATED for the class, GATED by check:features for the colophon's feature prose. ONE OWNER PER FACT. A measured value lives in the gate that measures it, or nowhere.

Prose may POINT AT the gate. It may not restate the value. A pointer carrying no digits is legal and is the preferred form.

The rule is a class, so it has no single instrument even though many of its instances do; hence the tag. Every second copy of a number found in August had already drifted, in both directions and often within the same day: gate counts in three places disagreeing with `check-all.mjs`, floors declared under what their own gate ran, a cached-route count wrong in two directions across two sentences, and the count of citing files in this file's own preamble, which had more than quadrupled underneath it.

The test before writing a number down: can something re-run and re-derive it. If yes, it belongs there and nowhere else. If no, it is a dated observation and says so, with its date, like a commit message.

**EXTENDED 2026-08-28, because the number was never the whole class.** An audit of this repo's prose found ten of eighteen checkable claims FALSE, and most carried no digits. They were TENSE-BOUND STATE CLAIMS: present-tense sentences about how the system is built, written true and left standing after the machinery moved. "The artifact is byte-compared against a fresh generation on every build" owns no number and was as false as any count, because that artifact left git on 2026-08-26.

So: **prose may carry REASONING; it may not carry a NUMBER or a TENSE-BOUND STATE CLAIM that a gate does not own.** A comment may say the ceiling lives in `check:page-payload`. It may not say what the bundle weighs, and it may not say the artifact is byte-compared. A why survives its mechanism changing; a state claim is a measurement in the present tense and rots on a count's schedule.

**PUBLISHED POSTS ARE THE EXCEPTION, and a real one rather than a loophole.** An article is a DATED RECORD, so it may carry numbers with the date and the measurement conditions beside them. It may not state a figure as a standing property. When a figure moves, the old one is KEPT as the earlier dated measurement, not deleted.

**GATED on the one surface where the class is machine-checkable, `content/features.json`:** `check:features` refuses a digit in a feature sentence and refuses the vocabulary of the removed machinery. It cannot read tense, so it enforces the half a regex can see. The rest is read by people, which is what UNGATED means everywhere else here.

### 18. UNGATED. Indexes converge toward the repo, never the reverse.

D1, both FTS indexes, the Ask index, the media table and the social cards are all DERIVED. The repository and the bucket are the sources; every one of those stores is a projection that can be rebuilt.

**A derived store is repaired THROUGH ITS DERIVATION, never by a hand-written INSERT.** A hand insert makes the index a second truth, the exact property the drift gates exist to hold; the row must arrive the way every other row arrived. That is why `OFL.txt`'s missing row waits for the media rebuild rather than an `INSERT`.

**A failed index write NEVER reverts the source.** The write that succeeded stands and the failure is reported; the alternative silently trades a durable fact for a rebuildable one.

**D1 HOLDS THE ONLY RENDERED COPY, since the artifact arc, and is still derived.** Git holds markdown; the committed corpus artifact is gone, and `content/generated/posts.json` is a gitignored local build product. The derivation has one door, `renderAndWrite`, and one bulk form, `regenerateAllFromRepo`; the `content-drift` health check watches `posts.source_blob_sha` converge to the repository's blob shas, and `sync_posts` on the operator API is its repair, the third repairable class. So a markdown commit from any machine is live within one health poll with no deploy, by design.

No gate can see how a row got where it is, which is what makes this UNGATED. The gates see DRIFT, which is the symptom.

### 19. GATED by check:policy. Money paths refuse foreign origins and spend in cheapest-first order.

**The order is: ORIGIN, then RATE, then CACHE, then BUDGET, then MODEL.** Named rather than sloganised, because "cheapest first" is satisfied by any number of wrong arrangements. Each stage refuses before the next spends anything: an origin verdict costs nothing, a rate check is one Durable Object call, a cache hit is one KV read, a budget reservation is a second DO call, and only then does a request reach a billed model.

**AN ABSENT `Origin` HEADER IS ALLOWED, and that is in the rule rather than left to the predicate**, because it looks like a hole and is not: a scriptless form post carries no `Origin`, and refusing it would break the no-script door that rule 9 requires. What is refused is a `Origin` that is present and foreign.

`check:policy` asserts the chain by POSITION in the route's own body, comments stripped, scoped to the action that owns it. Asserting that a stage merely EXISTS would pass on an arrangement that runs it after the money is already spent.

**REMOVED 2026-08-02: the orphaned-assets rule.** Its number is retained and never reused.

### 20. UNGATED. A MANUAL CACHE KEY CARRIES EVERYTHING THE BODY DEPENDS ON.

`caches.default` carries no headers, so a stored body must be a pure function of the key. **A new input to the body goes in the key, or every stored entry stays live, stale and unreachable**: there is no purge door and `workers.dev` has no zone. Use a synthetic key parameter, never served. `workers/app.ts` did this for the theme; `media.$.ts` did not for `WEBP_QUALITY` and served pre-fix bodies for hours after the fix, measured at that cache key. **Invalidation is PER-COLO and PARTIAL**: check the whole closed set, or a cold key, and say which.

**On numbering.** Append-only: a new rule takes the next unused number, and a retired rule keeps its number and is marked REMOVED, so a citation never silently retargets. It is no longer FROZEN. It was frozen because one comment cited a rule by FILE AND LINE, so renumbering broke a line reference; that comment cites the rule by number alone now, and section 15 binds the number to this file. Renumbering is still a bad idea and nothing needs it.

## Workflow: mainline only, until launch

Ratified 2026-07-29, scope THIS REPO ONLY, until the DNS cutover. Grounds: `dustinedwards/workflow-mainline.md`.

No feature branches, no PRs. Everything lands on `main`, committed and pushed immediately. Never leave work uncommitted or a commit unpushed. **The gates are the review**, so they run before every push. What runs, in what order, and everything else between a clean tier and a deployed sha is the `ship` skill; rule 16 stays the contract it works against.

Three things this repo has been bitten by, all in `core.md` with the measurements:

- **`npm run deploy` builds from the WORKING TREE, not from HEAD.** A dirty tree at deploy time is a deploy nobody can reproduce.
- **Every gate verifies DISK, not HEAD.** A gate can be green while its subject is uncommitted.
- **`git diff <path>` before `git add <path>`.** A named path is not a scoped change if the file carries edits you did not write.

**`npm run lint` RUNS BEFORE EVERY PUSH AND `check:content` BEFORE ONE THAT TOUCHED `app/` OR `content/`, since 2026-08-26 and 2026-09-04.** `.claude/hooks/pre-push-content.sh`, registered on Bash beside `scoped-git-add.sh`, blocks the push if either fails. Both replay a CI-red push whose cause was invisible locally: lint is a separate CI step no tier runs, and a new file under `app/` moves the template-refs count. Grounds and the fix are in the hook.

**It narrows the window and does not close it.** It fires on a push made through the agent's Bash tool and cannot fire on one typed into a terminal. CI is still what cannot be bypassed. Grounds, including why there is no `.githooks`, are in the hook file.

**TWO HOOKS GUARD THE DEPLOY DOOR, since 2026-09-04.** `pre-ship-upstream.sh` refuses `npm run ship` when HEAD is behind upstream, because ship deploys local HEAD and a stale tip satisfies rule 16 with a sha that is green and not the tip. `no-direct-deploy.sh` blocks `wrangler deploy`, `versions upload`, `npm run deploy` and non-SELECT `d1 execute`; read-only wrangler passes.

Unchanged: destructive operations stay with Dustin, and anything touching money paths or auth secrets is flagged before it lands.

## Commands

**`package.json` OWNS THE SCRIPT LIST, and this section is a POINTER to it.** It used to restate the list, and a second copy went stale in the one direction a restated list can: by omission. Measured 2026-08-28, the block silently omitted a quarter of the scripts, among them `ship`, `test`, `check:types` and `check:browser`, which is most of what a session runs. That is rule 17 in the file that states rule 17.

Counts, timings and what each gate asserts live in `core.md` and `publish-pipeline.md`, deliberately not here. Run `npm run` for the list. What the list itself does not carry:

- `npm run check` is the OFFLINE tier, which is what `ship` runs. `npm run check:all` adds the gates needing a deployed database or bucket. `npm run check:ci` is the tier a clean checkout can run.
- `npm run verify-live` is NOT a gate. It needs a deploy, and its Ask probes are billed.
- Mode flags change what a gate looks at: `check:backup`, `check:invariants`, `check:llms` and `sync:content` take `--local` or `--remote`. `check:media` is NETWORK ONLY, because `--local` reads an empty bucket and reports false drift.
- `check:admin-ui -- --update` rewrites the baseline, deliberately loud.
- `check-all.mjs` DERIVES the gate list from `package.json` and refuses to run below `MINIMUM_GATES` or on a gate nobody has tiered, so adding a gate means editing that file in the same commit.

Migrations are applied through wrangler directly, not through a script: `wrangler d1 migrations apply dustinedwards [--local|--remote]`.

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

**Adding a binding means editing BOTH files in the same commit.** `npm run check:config` compares them and fails in both directions. It is the only thing binding the example to what actually runs, the real file exists on one machine, and **CI CANNOT RUN IT**: a checkout has no real config, `postinstall` bootstraps one by COPYING the example, so real equals example by construction and the gate cannot pass. Hence its `CI_EXCLUDED` entry. So it stays load-bearing on exactly one machine and easy to skip, which is what it always was; the reason is now measured rather than "there is no CI".

**A SECOND WORKER SINCE 2026-08-29.** `workers/watchdog.ts`, with `wrangler.watchdog.jsonc` on the identical split and reconciled by the same `check:config`; its redacted var is `ALERT_EMAIL`, an inbox rather than an id, so its placeholder is the reserved `example.com`. It binds `SITE` (a service binding), `EMAIL` and `ALERT_EMAIL`, carries the health cron, and is deployed by a `ship` step, never by `npm run deploy`. **A Worker cannot `fetch()` this site** (measured, with a control: Cloudflare error 1042), which is why `SITE` is a binding and why the watchdog proves the health suite RUNS while only the hourly `health.yml` proves the site is REACHABLE. Grounds in that Worker's docblock.

**`OPERATOR_TOKEN` NOW HAS THREE HOLDERS**: the site Worker, the watchdog (`wrangler secret put OPERATOR_TOKEN -c wrangler.watchdog.jsonc`), and the `gh` repository secret. **No gate can see a secret's VALUE**, so a stale copy fails in the worst available direction: a watcher that still polls and still alerts but can no longer repair, which looks exactly like one that never needed to. Rotate all three or none.

## Where everything else lives

**In THIS REPO, because a gate can reach it and Capsid cannot:**

    CLAUDE.md                  the hard rules, above
    FAILURES.md                the recurring failure SHAPES, one line each. Read in the
                               ritual above, not here. Gated for length: it fails if it grows
    VERIFICATION.md            how to prove a deploy, a claim, or a gate. The method behind
                               rules 7, 10 and 12. Moved out of Capsid 2026-08-20
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

The chart and diagram authoring contract is `.claude/skills/charts/SKILL.md`, in this repo. Skills resolve as `<name>/SKILL.md`; a flat `.md` at that path is never loaded.
