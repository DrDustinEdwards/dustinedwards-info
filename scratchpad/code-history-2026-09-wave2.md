# Code comment history, 2026-09, wave 2

Extracted under ruling 115, from cdb4300. Every comment block this wave
deleted or shortened is here VERBATIM, with the file and line it had at
cdb4300, its tag, and why it moved. Wave 1 took app/ and the ten heaviest
code files; wave 2 takes the remaining 93 files under scripts/.
The files keep only the short why and the contract; this is where the
measurements, dates and the story went.

## scripts/check-policy.mjs

### scripts/check-policy.mjs:1 (CONTRACT, shortened)

the boundary and the paired-negative rule kept; the restatement of both, cut.

```js
/**
 * Gate over the operator publish policy.
 *
 * OBSERVATION BOUNDARY: the decision function in isolation. It never calls
 * GitHub, D1 or the operator endpoint, so it proves what the policy DECIDES and
 * nothing about whether a caller actually consults it before writing.
 *
 *   npm run check:policy
 *
 * Imports app/lib/editor/publish-policy.mjs directly, the same module the Worker
 * imports, so it exercises the
 * decision the Worker actually makes rather than a restatement of the rule.
 * Pure functions only: no GitHub, no database, no network.
 *
 * EVERY RULE HAS A PAIRED NEGATIVE, on the same principle as check:search. A
 * policy that only refuses has not been shown to permit anything, and a policy
 * that only permits is not a policy. The case that matters most is the FORGERY
 * pair: an operator submitting its own first_published must not be able to
 * assert the fact the gate is checking, and the admin must still be able to
 * publish the same post.
 */
```

### scripts/check-policy.mjs:105 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- readState ------------------------------------------------------------
```

### scripts/check-policy.mjs:116 (WHY, shortened)

the state the policy exists to tell apart, in one line.

```js
// The negative: a post withdrawn after publication is draft:true but HAS a date.
// This is the exact state the whole policy exists to tell apart from a new draft.
```

### scripts/check-policy.mjs:124 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- forceFirstPublished --------------------------------------------------
```

### scripts/check-policy.mjs:152 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- The policy: operator ------------------------------------------------
```

### scripts/check-policy.mjs:166 (WHY, shortened)

the forgery case in one line: the prior file is the only thing consulted.

```js
// THE FORGERY CASE. An operator submits first_published in its own payload,
// claiming the post was published before. The prior FILE says otherwise, and
// the prior file is the only thing consulted.
```

### scripts/check-policy.mjs:220 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- The policy: admin ----------------------------------------------------
```

### scripts/check-policy.mjs:229 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- The policy: smoke, the read-only machine actor -----------------------
```

### scripts/check-policy.mjs:231 (CONTRACT, shortened)

the claim, its two instruments and the N-1-of-N reason; the tabulated restatement cut.

```js
/*
 * THE CLAIM UNDER TEST: the smoke actor appears in NO WRITE BRANCH.
 *
 * That claim has two halves and they are proven by different instruments,
 * because they are enforced in different places and one of them is not a policy
 * decision at all:
 *
 *   THE PUBLISH PATH   `decide()` and `decideDelete()` refuse it, from the
 *                      capability table. Proven by RUNNING them, below.
 *   EVERY OTHER ACTION the eleven media intents, the tag writes, the trash and
 *                      the rebuild consult no policy module. They are refused
 *                      by the `/admin` middleware's method gate. Proven by
 *                      reading that guard out of the route source, below.
 *
 * Asserting only the first would leave the larger half unexamined while reading
 * like a complete answer, which is this repo's recorded N-1-of-N shape.
 */
```

### scripts/check-policy.mjs:249 (WHY, shortened)

the drift prohibition alone.

```js
/*
 * EVERY TRANSITION AN OPERATOR OR THE ADMIN IS PERMITTED, refused for smoke.
 *
 * Driven off a TABLE rather than written out, so the cases here are the same
 * cases the permitting blocks above use. A smoke refusal list that drifted out
 * of step with the permit list would leave a transition permitted for the
 * machine actor and unasserted, which is exactly the gap the table closes.
 */
```

### scripts/check-policy.mjs:285 (WHY, shortened)

the refusal must be the one that is true of the actor.

```js
/*
 * THE FORGERY CASE, for this actor too. An operator cannot assert the fact the
 * gate checks; a smoke credential must not be able to either, and it must be
 * refused as READ ONLY rather than as a first-publish, because the read-only
 * refusal is the one that is true of it.
 */
```

### scripts/check-policy.mjs:302 (WHY, shortened)

iterate rather than name, so a fourth capability cannot pass unexamined.

```js
/*
 * THE CAPABILITY TABLE ITSELF, in both directions.
 *
 * Iterated over `Object.entries` rather than naming the three capabilities, so
 * a FOURTH capability added to the table and granted to smoke fails here rather
 * than passing unexamined. Naming them would freeze this assertion at the shape
 * the table has today, which is the same defect as a hand-maintained mirror.
 */
```

### scripts/check-policy.mjs:317 (WHY, shortened)

the unfailable-condition trap in one line.

```js
/*
   * THE PAIRED POSITIVE, and it is not a formality. Every assertion above is
   * satisfied by a table in which NOBODY may write, and such a table would take
   * the whole publish path down while this gate reported a perfect score.
   */
```

### scripts/check-policy.mjs:335 (WHY, shortened)

the proximity-needle prohibition; the date it was recorded goes to Capsid.

```js
/*
 * THE METHOD GATE IN THE MIDDLEWARE, read out of the route source.
 *
 * **THE GUARD EXPRESSION IS EXTRACTED BY WALKING BACK FROM THE EXIT**, not
 * matched near it. That is the needle class recorded 2026-08-24: a proximity
 * needle stays satisfied by a PRINT of the name after control flow has stopped
 * consulting it, so `SMOKE_READ_ONLY_POLICY` appearing within N characters of a
 * `403` proves only that the string is nearby. What has to be true is that the
 * refusal is CONDITIONED on the method, so the condition itself is what gets
 * read.
 */
```

### scripts/check-policy.mjs:350 (WHY, shortened)

an import is a mention not a use; the story of catching it, cut.

```js
/*
   * THE EXIT: the 403 that names the policy. Located in COMMENT-STRIPPED
   * source, because a comment quoting the refusal has both satisfied an
   * assertion about code and failed one in this repo, within one week.
   *
   * **NOT THE FIRST MENTION OF THE CONSTANT, and this gate caught itself on
   * exactly that.** The first occurrence in the stripped file is the IMPORT
   * line, which sits above every `if` in the module, so the backward walk found
   * no guard and three assertions failed reporting a missing gate that was
   * present. An import is a mention, not a use. Import lines are skipped by
   * looking at the line the occurrence sits on, rather than by assuming the
   * last occurrence is the interesting one, which would break the moment a
   * second refusal is added below this one.
   */
```

### scripts/check-policy.mjs:389 (WHY, shortened)

both zero-scope arms in two lines.

```js
// SCOPE, ASSERTED, twice. An extractor returning "" would make every
  // assertion below report a missing guard that is present; one that ran away
  // to the top of the file would let a neighbour's condition satisfy them.
```

### scripts/check-policy.mjs:405 (WHY, shortened)

what a denylist lets through.

```js
/*
   * AND IT IS NOT A DENYLIST. `method === "POST"` would pass every assertion
   * above and let PUT, PATCH and DELETE through, which is the whole reason the
   * allowlist form was chosen. Asserted as the absence of an equality test on
   * the method, inside the guard alone.
   */
```

### scripts/check-policy.mjs:417 (WHY, shortened)

a 403 that lies.

```js
/*
   * REFUSED BEFORE ANYTHING RUNS. A method gate that fired after `next()` would
   * refuse the response and leave the write already done, which is a 403 that
   * lies. Position in the middleware body is the assertion.
   */
```

### scripts/check-policy.mjs:426 (WHY, shortened)

why both files are named rather than one excluded.

```js
/*
   * THE OTHER DIRECTION: the smoke actor is CONSTRUCTED in exactly one place.
   *
   * This is the assertion that keeps "appears in no write branch" true as the
   * code moves. A future edit that hands `{ kind: "smoke" }` to `savePost`, to
   * `deletePost`, or to the operator API would be refused by the capability
   * table at runtime, but it would also be a caller that believed it could
   * write, and this fails on the day it is written rather than at the throw.
   *
   * Scoped to app/, comment-stripped, and the permitted sites are NAMED.
   *
   * **TWO FILES, NOT ONE, and the second is listed rather than excluded.** The
   * needle matches the `AdminActor` type union in `auth.server.ts`, which
   * DECLARES the shape, as well as the object literal in the middleware, which
   * CONSTRUCTS it. Telling a type annotation from a value with a regex is the
   * parser that section 5 of check:invariants was deleted for, and an exclusion
   * that names a file excludes everything else in it too. So both are named,
   * with their roles, and a THIRD file appearing still fails, which is the
   * property this assertion is for.
   */
```

### scripts/check-policy.mjs:476 (WHY, shortened)

the unbounded-window trap and fail-closed; the plant and its date to Capsid.

```js
/*
 * THE ONE WAY A SMOKE GET COULD STILL 500, closed here.
 *
 * `adminSessionContext` holds a Better Auth session and the middleware sets it
 * for the HUMAN ADMIN ONLY, because the smoke actor has no session and a
 * synthesised one would be the stub this repo refuses. `context.get` on an
 * unset context THROWS. So a LOADER that reads it would be fine for Dustin and
 * a 500 for every smoke request, on a page that renders perfectly in every
 * other gate: `check:admin-ui` stubs the server modules, and `check:browser`
 * would report it as a surface that failed to render rather than as an
 * authentication defect.
 *
 * Today there is exactly one reader and it is inside an ACTION, which the
 * method gate makes unreachable for the smoke actor. That is a property of
 * where one line happens to sit, so it is asserted rather than assumed.
 *
 * INSIDE THE ACTION'S BRACE-MATCHED BODY, in comment-stripped source. The
 * first form of this scan asserted only that every read sat AFTER the action
 * export BEGAN, an unbounded window to end-of-file, and that window had the
 * exact hole this section exists about: a helper declared below the action,
 * reading the session and called from the loader, sat "after the action" in
 * text while running on the read path at runtime. Planted 2026-08-25 and the
 * old form passed 138/0 over it. The window is now bounded to the action's
 * own body, the technique `bodyOf` below already uses (a top-level function
 * ends at the first line that is exactly a closing brace in this codebase's
 * formatting), so a read anywhere outside that span fails, helper or loader
 * alike. Fail closed: this cannot see the call graph, so a read the action
 * itself delegates to a sibling helper is refused too, and the repair is to
 * move the read inside the action, where its reachability is the method
 * gate's guarantee.
 */
```

### scripts/check-policy.mjs:550 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- What decide() stamps -------------------------------------------------
```

### scripts/check-policy.mjs:590 (CONTRACT, shortened)

the two cases state cannot tell apart, in two lines.

```js
/* -------------------------------------------------------------------------
 * What a save DID, which is what the editor reports back
 * ----------------------------------------------------------------------
 *
 * The editor's feedback slot names the transition, and a first publication is
 * rendered differently from every other save because it is the one act reserved
 * to the human. The classification therefore has to be right about the two
 * cases current state cannot tell apart on its own, and both are asserted here
 * with their negatives: a withdrawn post republished is NOT a first
 * publication, and a live post edited again is NOT a republication.
 */
```

### scripts/check-policy.mjs:630 (WHY, shortened)

the ceremony performed twice, in two lines.

```js
// The negative that matters: a post published, withdrawn, and published again
  // must NOT read as a first publication, or the editor would perform the
  // ceremony a second time for an act that is not the one being marked.
```

### scripts/check-policy.mjs:673 (CONTRACT, shortened)

boxed heading, rule padding cut.

```js
/* -------------------------------------------------------------------------
 * The Ask index is a public surface
 * ---------------------------------------------------------------------- */
```

### scripts/check-policy.mjs:677 (WHY, shortened)

least privilege and the real-module rule; the date and the narrative cut.

```js
/* ----------------------------------------------------------------------
 * OPERATORS CANNOT DELETE.
 * ---------------------------------------------------------------------- *
 *
 * Ruled 2026-08-17. `savePost` refused an operator's FIRST publish through
 * decide(); `deletePost` took the same actor and used it only to build a commit
 * message, so a token forbidden from making a post public was permitted to
 * DESTROY it, over the network through /api/operator. Least privilege: the
 * destructive verb needs more authority than the publishing one, not less.
 *
 * Driven through the REAL decide/decideDelete, not a copy of the rule.
 */
```

### scripts/check-policy.mjs:699 (WHY, shortened)

the property is the pair.

```js
/*
   * THE ASYMMETRY IS GONE, asserted as a PAIR rather than as two separate
   * facts. The defect was not that delete was permissive in isolation, it was
   * that it was permissive while publish was not, so the property worth holding
   * is that an actor refused a first publish is also refused a delete.
   */
```

### scripts/check-policy.mjs:721 (WHY, shortened)

the predicate passing is not the call site asking.

```js
/*
   * AND THE CALL SITE ACTUALLY REACHES IT. The predicate passing proves the
   * rule; it does not prove `deletePost` asks. SCOPED to deletePost's own body,
   * because the file imports decide() for savePost and a file-wide match would
   * be satisfied by that.
   */
```

### scripts/check-policy.mjs:741 (WHY, shortened)

the slug-probing leak a late guard leaves open.

```js
/*
   * BEFORE THE FILE READ. A guard placed after it still refuses, but it lets an
   * unauthorised caller probe which slugs exist by the difference between two
   * error messages. Position is part of the guard.
   */
```

### scripts/check-policy.mjs:750 (WHY, shortened)

why the method is the only defensible line.

```js
/* ----------------------------------------------------------------------
 * ASK IS BILLED, SO IT MUST NOT BE REACHABLE BY A GET.
 * ---------------------------------------------------------------------- *
 *
 * Every answer spends a per-IP allowance and one of a capped number of daily
 * generations. A GET that bills is a side-effecting GET: a crawler, a link
 * prefetch, a preview unfurler or an `<img src>` on somebody else's page all
 * issue one without a person deciding to. The METHOD is the only part of that a
 * third party cannot choose for us, and robots.txt is advisory on top.
 *
 * Asserted from SOURCE. The route file must export an action and must not
 * export a loader that does work, and the robots body must name the path.
 */
```

### scripts/check-policy.mjs:772 (WHY, shortened)

why absence and a file-wide mention both pass on a defect.

```js
/*
   * The loader must exist and must REFUSE. Asserting merely that no loader
   * exists would pass for a route that quietly serves GET through some other
   * export, and asserting the file mentions 405 anywhere would pass on a
   * comment. Scoped to the loader's own body.
   */
```

### scripts/check-policy.mjs:784 (WHY, shortened)

what a restored loader would bill on.

```js
/*
   * And the question is read from the BODY, not the query string. A route that
   * kept reading `searchParams` would still bill on a hand-made GET the moment
   * somebody restored a loader.
   */
```

### scripts/check-policy.mjs:801 (WHY, shortened)

the attack and why order is the assertion.

```js
/*
   * THE ORIGIN GATE, AND ITS POSITION IS THE ASSERTION THAT MATTERS.
   *
   * Ask is anonymous, so this is not CSRF in the usual sense: there is no
   * session to borrow and SameSite does nothing. What a hostile page can do is
   * make its own readers' browsers spend the shared Ask budget, and the per-IP
   * limiter is blind to it because a thousand readers are a thousand IPs.
   *
   * Asserting the check merely EXISTS would pass on a version that ran it after
   * the Durable Object had already been consulted, which is most of the cost of
   * the attack. So the assertion is ORDER: the origin verdict is taken before
   * checkAskRate, measured by position in the action's own body.
   *
   * Comments are stripped first, on this file's established rule: the action's
   * docblock explains the limiter and the attack in prose, and an unstripped
   * scan would find both names in the explanation and compare the wrong offsets.
   */
```

### scripts/check-policy.mjs:837 (WHY, shortened)

hard rule 19's chain, why position beats presence, and the stated exclusion.

```js
/*
   * THE REST OF THE CHAIN: RATE, then CACHE, then BUDGET, then MODEL.
   *
   * Hard rule 19 names the whole order, and until 2026-08-24 only its first
   * pair was asserted. The origin-before-rate assertion above is untouched and
   * deliberately not rebuilt here; this is the TAIL it stops at.
   *
   * ## WHY POSITION AND NOT PRESENCE
   *
   * Every one of these four calls exists in any arrangement of them, so a
   * presence assertion passes on an action that reserves budget before checking
   * the cache, which spends a Durable Object write on a question already
   * answered, and on one that reaches the model before either. The ORDER is the
   * property; the names are only how it is located.
   *
   * ## WHY EACH STAGE SITS WHERE IT DOES, cheapest refusal first
   *
   *   rate    one Durable Object call, and it is in front of the cache on
   *           purpose: a cached answer is cheap but not free, and hammering for
   *           cached answers is still hammering.
   *   cache   one KV read. It reaches no model and consumes no budget.
   *   budget  the second Durable Object call, the exact daily ceiling, reserved
   *           here and nowhere else.
   *   model   the only billed step, and the last thing the action does.
   *
   * SCOPED to the action body already extracted above, with comments stripped
   * by the same call, because the action's docblock names all four in prose and
   * an unstripped scan would compare the offsets of the explanation.
   *
   * ABSENT `Origin` IS ALLOWED and is NOT asserted here: it is the predicate's
   * behaviour, not the route's ordering, and `test/origin.test.mjs` owns it.
   */
```

### scripts/check-policy.mjs:904 (WHY, shortened)

the measured framework boundary and the four routes it leaves; the rename story cut.

```js
/*
   * EVERY MUTATING SURFACE TAKES THE SAME PREDICATE, since 2026-08-28.
   *
   * `originVerdict` was `askOriginVerdict` and lived under `lib/search`,
   * applied by the one endpoint that spends money. Two other mutating surfaces
   * had no check of their own.
   *
   * WHAT REACT ROUTER ALREADY DOES, measured rather than assumed, because it
   * decides what these assertions are for: `throwIfPotentialCSRFAttack` refuses
   * a foreign `origin` on every mutating DOCUMENT request with 400, before
   * middleware. It does NOT run for resource routes, which is what
   * `admin.logout.tsx`, `admin.media.upload.ts`, `admin.preview.ts` and
   * `/theme` are. Those four are the gap, and they are what these cover.
   *
   * Asserted on the SOURCE calling the predicate rather than on a status code,
   * because a status code is `check:browser`'s and verify-live's to observe and
   * this gate is offline. What it can see is that neither route restates the
   * rule.
   */
```

### scripts/check-policy.mjs:941 (WHY, shortened)

the exemption hard rule 9 requires, and that it is the easiest thing to tighten by accident.

```js
/*
   * AND THE ABSENT-ORIGIN EXEMPTION SURVIVES, asserted on the predicate itself.
   * A scriptless form post carries no `Origin`; refusing it would break the
   * no-script door hard rule 9 requires, and it is the single easiest thing to
   * "tighten" by accident while fixing a cross-origin hole.
   */
```

### scripts/check-policy.mjs:958 (WHY, shortened)

the work an unauthenticated caller can ask for, and the boundary.

```js
/*
   * THE OPERATOR TOKEN IS REFUSED ON LENGTH BEFORE IT IS HASHED.
   *
   * `constantTimeEqual` hashes BOTH operands so comparison time does not depend
   * on where they diverge, which is right and has one cost: the input side is
   * whatever the caller sent, so hashing it is work an unauthenticated caller
   * can ask for in any quantity. A megabyte of bearer token is a megabyte of
   * SHA-256 before anything has checked who is asking.
   *
   * ASSERTED BY POSITION IN THE FUNCTION'S OWN BODY, which is the same
   * instrument hard rule 19's ordering uses and for the same reason: asserting
   * that the length check merely EXISTS would pass on an arrangement that ran
   * it after the hash, which is the arrangement that buys nothing.
   *
   * OBSERVATION BOUNDARY: this reads SOURCE POSITION, not a runtime measurement.
   * It cannot see that the hash did not run; it can see that the refusal is
   * written before the call. Measuring the hash itself would need the digest
   * instrumented, which no gate here can do.
   */
```

### scripts/check-policy.mjs:992 (WHY, shortened)

either half alone passes on metering both or neither.

```js
/*
     * AND DESCRIBE DOES NOT SPEND A RATE-LIMIT UNIT. Metering used to sit
     * inside authentication, so `GET /api/operator`, which takes no arguments
     * and changes nothing, cost the same unit as a publish. Asserted as
     * absence in the loader and presence in the action, because either half
     * alone passes on a build that meters both or neither.
     */
```

### scripts/check-policy.mjs:1010 (WHY, shortened)

the raw-text escape, the no-hand-list rule and the stated exclusion.

```js
/*
   * EVERY JSON-LD BLOCK GOES THROUGH THE ESCAPING SERIALISER.
   *
   * The contents of a `<script>` element are RAW TEXT: no entities are decoded
   * inside it and the only thing that ends it is the literal `</script`. A
   * title carrying that sequence closes the element early and the rest is
   * parsed as markup. Every block was a bare `JSON.stringify` handed to
   * `dangerouslySetInnerHTML` until 2026-08-28.
   *
   * FOUND BY SCANNING, not from a list. A hand-kept list of emitters is the
   * mirror this repo keeps paying for: the fifth one would be added without it.
   * Every `dangerouslySetInnerHTML` in a route whose element is a `script` with
   * `ld+json` is required to use the helper, and the failure names the file.
   *
   * The speculation-rules blocks are deliberately out of scope: they are the
   * other `<script>` type on the site and their payload is built from
   * `HEADER_PATHS` and a pathname rather than from post content. They have
   * their own gate in `test/header-speculation.test.mjs`.
   */
```

### scripts/check-policy.mjs:1056 (WHY, shortened)

why an offline half exists beside a stronger wire case that skips.

```js
/*
   * THE LIGHTBOX IS A REAL MODAL DIALOG, asserted on source.
   *
   * ## WHY HERE AND NOT ONLY IN check:browser
   *
   * `check:browser` has the better instrument: it opens the thing and asks the
   * platform whether `dialog:modal` matches, which a div carrying
   * `role="dialog"` cannot fake. That case is SKIPPED on the current corpus,
   * and has been for as long as the skip has existed, because no published post
   * carries a body image, so there is no `.image-link` on any page to click.
   * verify-live reports the same absence.
   *
   * A wire assertion that never runs is not a gate. These are the offline half:
   * weaker, because source text is a claim about behaviour rather than the
   * behaviour, and they run on every commit. When a post gains an image the
   * browser case starts running and becomes the stronger of the two; neither
   * replaces the other.
   *
   * The `div` spelling is refused by name, because that is what this replaced.
   */
```

### scripts/check-policy.mjs:1096 (WHY, shortened)

the same offline-half argument, and each property asserted by its mechanism.

```js
/*
   * WCAG 2.2 1.4.13 ON SOURCE, because the wire half has nothing to observe.
   *
   * `check:browser` has the better instrument and it SKIPS: no post in this
   * corpus uses footnote syntax, so `.prose a[data-footnote-ref]` matches
   * nothing on any page and there is nothing to hover. Measured by fetching
   * the three posts whose prose mentions footnotes: zero `data-footnote-ref`
   * attributes on any of them.
   *
   * That is the same shape as the lightbox above, and the same answer: a wire
   * assertion that never runs is not a gate, so the offline half asserts the
   * three properties are IMPLEMENTED. It is weaker on purpose and says so.
   *
   * Each is asserted by the mechanism that provides it, not by a comment
   * claiming it: a scheduled hide rather than an immediate one (hoverable), an
   * Escape listener (dismissible), and the ABSENCE of a scroll listener
   * (persistent), which is the only one of the three whose defect is a line
   * that exists rather than a line that is missing.
   */
```

### scripts/check-policy.mjs:1141 (WHY, shortened)

why the two rejected spellings are rejected.

```js
/*
     * 4.1.3, the same way. The three copy controls announce through ONE
     * `role="status"` region rather than by relabelling themselves, which is a
     * change of NAME, or by `::after`, which is not in the accessibility tree.
     */
```

### scripts/check-policy.mjs:1157 (WHY, shortened)

assert the behaviour, not the comment claiming it.

```js
/*
     * And the heading permalink LANDS on the heading. Its comment claimed the
     * anchor still navigated while the code called preventDefault three lines
     * below, so the assertion is on the focus move rather than on the comment.
     */
```

### scripts/check-policy.mjs:1178 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------- the Ask index is kept in step by ship -- */
```

### scripts/check-policy.mjs:1180 (WHY, shortened)

why the index fell behind, and what position plus failure-path buys; the measurement to Capsid.

```js
/*
 * `sync:content` REBUILDS D1 AND BOTH FTS INDEXES AND DOES NOT TOUCH AI SEARCH.
 *
 * For a long time the only writers of the answer index were `savePost`, for a
 * post published through the editor, and a human clicking sync-ask in the
 * admin. This site's writing mostly lands by COMMIT, so the index fell behind
 * on every content ship and stayed behind until somebody read an alert.
 *
 * MEASURED 2026-08-23: the scheduled health check went red four polls running
 * at expected 91, present 90, and shipping nine post updates widened it to
 * expected 99, present 90, tracking search_docs growth exactly.
 *
 * Asserted on POSITION and on the FAILURE PATH, not merely on presence. A call
 * that ran before the deploy would upload to a Worker that is about to be
 * replaced, and a call whose result nobody checked would be a step that cannot
 * fail. Both of those pass a presence assertion.
 */
```

### scripts/check-policy.mjs:1219 (WHY, shortened)

why the upload runs last.

```js
/*
   * ORDER. The upload writes what the DEPLOYED Worker serves, through that
   * Worker's own bindings, so it has to run after the deploy and after the D1
   * sync that produced the records it uploads.
   */
```

### scripts/check-policy.mjs:1235 (WHY, shortened)

a discarded result cannot fail.

```js
/*
   * THE FAILURE PATH, which is the half that makes the step worth having. A
   * step whose result is discarded is a step that cannot fail, and this one
   * exists precisely because a green ship over a stale index is the defect.
   */
```

### scripts/check-policy.mjs:1245 (WHY, shortened)

the window-around-an-anchor class; the plant and its date cut.

```js
/*
   * THE EXIT CONDITION ITSELF, not a mention of the variable near the exit.
   *
   * REWRITTEN 2026-08-24 BECAUSE A PLANT CAUGHT IT. This read
   * `/mediaMiss[\s\S]{0,900}process\.exit\(1\)/`, and the plant that removed
   * `mediaMiss` from the final guard PASSED: the block still PRINTS the miss on
   * the way out, so the name was inside the window while the control flow no
   * longer consulted it. A 900-character window around an anchor reading its
   * neighbour's compliance is this repo's own recorded class, and the same
   * window shape was already here for the Ask half.
   *
   * The condition is extracted by walking back from the LAST `process.exit(1)`
   * to the `if (` that guards it, so what is asserted is the expression the
   * process actually branches on.
   */
```

### scripts/check-policy.mjs:1271 (WHY, shortened)

why the version has to print first.

```js
/*
   * And the deploy STANDS. The record must print before the exit, or a missed
   * sync would hide the version that is actually live, which is the one thing
   * an operator needs at that moment.
   */
```

### scripts/check-policy.mjs:1284 (WHY, shortened)

what five 200s are blind to, and why position is the assertion.

```js
/*
   * READINESS: SHIP CONSULTS THE HEALTH ENDPOINT, AND IT DOES SO BETWEEN THE
   * DEPLOY AND THE FIRST WRITE.
   *
   * Five 200s from `/colophon` prove the Worker answers. They are blind to a
   * drifted Ask index, a media index that lost its rows, D1 out of step with
   * the repository, and an empty FTS index beside a full content table: all
   * four serve `/colophon` with a 200, and all four are exactly what
   * `/api/health` reports. The scheduled workflow has read that endpoint every
   * fifteen minutes for weeks while the deploy path never asked it once.
   *
   * ASSERTED ON POSITION, on the same principle as the Ask upload above. A
   * readiness check that ran BEFORE the deploy would report on the build being
   * replaced. One that ran AFTER the sync would refuse with production already
   * half converged, which is the state this ordering exists to prevent. Both
   * of those satisfy a presence assertion completely.
   */
```

### scripts/check-policy.mjs:1321 (WHY, shortened)

read the verdict from the body and act on it; why the decision is its own module.

```js
/*
   * THE VERDICT IS READ OUT OF THE BODY, not inferred from the status line,
   * and it is ACTED ON. A step that fetched the endpoint and discarded the
   * answer is a step that cannot fail, which is the shape the Ask assertions
   * above were written to catch and the same one applies here.
   *
   * The decision lives in scripts/lib/readiness.mjs so `node:test` can drive
   * every branch of it, on the precedent of ci-status.mjs and ask-converge.mjs.
   * So the assertion is split: ship must CONSULT the verdict and refuse on it,
   * and the module must decide from the parsed body.
   */
```

### scripts/check-policy.mjs:1341 (WHY, shortened)

what stops the step passing against the wrong URL.

```js
/*
   * AND A BODY WITH NO CHECKS REFUSES. This is what stops the step passing on
   * the wrong URL: any JSON on the origin can carry `ok: true`, and only a
   * health report carries a checks array.
   */
```

### scripts/check-policy.mjs:1357 (WHY, shortened)

both halves and what each alone costs; the dated deadlock to Capsid.

```js
/*
   * RULING 48: CONTENT-DRIFT IS DEFERRED AT READINESS AND ASSERTED AFTER THE
   * SYNC. Both halves, because either alone is the defect: deferring without
   * the late assertion drops the check entirely, and asserting late without
   * deferring leaves the deadlock that forced the ruling (a drifted corpus
   * refusing at the step that runs before its own repair, 2026-09-09).
   */
```

### scripts/check-policy.mjs:1364 (HISTORY, deleted)

which ruling pinned which shape and that the meaning is unchanged; the code below states the shape.

```js
/*
   * WHAT CHANGED AND WHY THESE MOVED WITH IT. Ruling 48 had ONE deferred check
   * and this block pinned it as a literal array in ship.mjs. Ruling 56 added
   * `ask-index-drift` and `media-index-drift`, after the Ask one cost two
   * deploys on 2026-09-10, and moved the table into `readiness.mjs` so
   * `test/readiness.test.mjs` imports the real list rather than mirroring it.
   * The shape read here is now a MAP keyed by check name and valued by the step
   * that repairs it. What the assertions MEAN is unchanged.
   */
```

### scripts/check-policy.mjs:1375 (WHY, shortened)

enumerate, because one name passes on a table that lost the others.

```js
/*
   * ALL THREE, ENUMERATED. A regex for content-drift alone would pass on a
   * table that had lost the other two, which is how the Ask deadlock would
   * return without a single assertion moving.
   */
```

### scripts/check-policy.mjs:1383 (WHY, shortened)

the needle's correctness, not the code's.

```js
// `[A-Za-z0-9 ]`, not `[a-z0-9 ]`: the values are "the D1 sync" and "the
      // Ask converge". A lower-case-only class matched only "the media
      // converge" and reported the other two as undeferred, which is a needle
      // failing on correct code rather than a defect in the code.
```

### scripts/check-policy.mjs:1391 (WHY, shortened)

the value is the test for whether a fourth check belongs.

```js
/*
   * EACH NAMES THE STEP THAT REPAIRS IT, and that value is the test for whether
   * a fourth check belongs: one with nothing to name has no later repair, so
   * deferring it would DROP it rather than move it.
   */
```

### scripts/check-policy.mjs:1411 (WHY, shortened)

existence would sit before the sync and be the deadlock again.

```js
/*
   * AND IT IS ASSERTED AFTER THE SYNC. Positional, on the same argument the
   * readiness ordering assertion above makes: a check that merely EXISTS could
   * sit before the sync and would then be the deadlock again.
   */
```

### scripts/check-policy.mjs:1429 (WHY, shortened)

the N-1-of-N prohibition; the date it was added goes to Capsid.

```js
/*
   * THE MEDIA INDEX, THE SAME CONTRACT, ASSERTED SEPARATELY.
   *
   * Added 2026-08-24 with the media sync at ship. Deliberately not folded into
   * the assertions above by widening a regex to match either name: the two
   * steps fail independently, and an assertion satisfied by whichever one
   * happens to be present would pass on the commit that deleted the other. That
   * is the N-1-of-N shape, and this gate has been the one to catch it before.
   */
```

### scripts/check-policy.mjs:1448 (WHY, shortened)

rule 18's repair path, and what a hand-written row makes the index.

```js
/*
   * RULE 18, ASSERTED RATHER THAN TRUSTED. The repair goes through the
   * derivation. A tool that wrote rows itself, or took keys from the caller,
   * would make the index a second truth, which is the property check:media
   * exists to hold.
   */
```

### scripts/check-policy.mjs:1459 (WHY, shortened)

a rebuild's own counters are not a verdict.

```js
/*
   * AND THE VERDICT IS READ BACK, not taken from the rebuild's own counters.
   * `rebuildMediaIndex` returns what its loops think they wrote; only
   * `mediaIndexStatus` re-enumerates the sources and reads D1 afterwards.
   */
```

### scripts/check-policy.mjs:1490 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------ the cache split, in config */
```

### scripts/check-policy.mjs:1492 (WHY, shortened)

the failure mode on each side, and why the value is a policy question check:config cannot answer.

```js
/*
 * WHICH ENTRYPOINT THE PLATFORM MAY CACHE. Ruling 15, 2026-09-05.
 *
 * ## WHY THIS IS A POLICY ASSERTION AND NOT A CONFIG ONE
 *
 * `check:config` already reconciles the example against the real file in both
 * directions, so the two cannot drift. What it does not know is which VALUE is
 * correct, and the correct value here is a policy decision with a failure mode
 * on each side:
 *
 *   gateway cache ENABLED    the platform could answer a request without
 *                            running the gateway, and `recordTraffic` would go
 *                            unwritten on every hit. The readership count would
 *                            silently become a count of cache misses and would
 *                            still look like readership. That is the blindness
 *                            item G existed to end, reintroduced by a config
 *                            flag rather than by code.
 *   Renderer cache DISABLED  every request renders, which is the state this
 *                            whole arc replaced, and nothing would say so
 *                            except a latency graph nobody reads.
 *
 * ## AND `cross_version_cache` STAYS OFF
 *
 * With it off the Worker version is part of the cache key, so a deploy
 * invalidates every entry. That is what replaced the hand-built `__build` key
 * parameter the deleted themed layer carried, and the measurement behind it is
 * on that layer's grave in `workers/app.ts`: a `check:browser` run was once
 * served HTML from a build several generations old, asking for a stylesheet URL
 * the current manifest no longer had.
 *
 * Asserted against the EXAMPLE, which is the tracked file. The real config is
 * gitignored and `check:config` is what binds it to this one.
 */
```

### scripts/check-policy.mjs:1535 (WHY, shortened)

absent rather than false, and why writing it would be a second owner.

```js
/*
   * ABSENT rather than `false`, and asserted as absent. Writing it explicitly
   * would be a second place to state a default, and the default is the safe
   * direction here.
   */
```

### scripts/check-policy.mjs:1547 (CONTRACT, shortened)

why Ask cannot filter at query time; the dated leak goes to Capsid.

```js
/**
 * Drafts must never reach the AI index.
 *
 * `/search/ask` is unauthenticated and cites the post it answered from, so an
 * uploaded draft is publicly readable by anyone who asks the right question.
 * The classic index filters at QUERY time; Ask cannot, because AI Search has no
 * per-item status to filter on, so the exclusion has to happen at UPLOAD time.
 *
 * This is a regression test for a real leak. On 2026-07-29 five unpublished
 * drafts were staged through the operator path, uploaded unconditionally, and
 * the live Ask endpoint answered from one and cited it by slug.
 *
 * The predicate is re-derived here from the same rule the uploader applies:
 * not a draft, and not scheduled for the future.
 */
```

### scripts/check-policy.mjs:1583 (WHY, shortened)

the silent-leak case in two lines.

```js
// The withdrawn case, which is the one that leaks silently: a post that was
  // published and indexed, then set back to draft, must be REMOVED rather than
  // merely skipped on the next sync.
```

### scripts/check-policy.mjs:1603 (WHY, shortened)

the comment-satisfied anchor; the stale limit corrected to the shared tokenizer.

```js
/*
   * COMMENTS STRIPPED BEFORE MATCHING, and this is not tidiness.
   *
   * The assertion below used to be "publishableForAsk(posts) appears at least
   * twice". On 2026-08-19 askIndexStatus stopped calling it, the change wrote a
   * comment EXPLAINING that it used to call it, and the count stayed at two. The
   * gate went green on prose. That is hard rule 10's comment-satisfied anchor,
   * caught here only because the change's author went looking.
   *
   * LIMIT, stated: this removes block comments and whole-line `//` comments. It
   * does not attempt trailing `//`, because a naive pass corrupts a URL inside
   * a string literal, and it does not parse. A pattern hidden in a trailing
   * comment would still satisfy these matches.
   */
```

### scripts/check-policy.mjs:1617 (HISTORY, deleted)

the plant proving trailing comments were unstripped, and a stripper inventory the shared tokenizer ended.

```js
/*
   * **TRAILING `//` COMMENTS ARE STRIPPED TOO, and they were not until
   * 2026-08-22.** The second replace matched only a line comment that BEGINS a
   * line, so a comment written after code survived stripping and could satisfy
   * every needle below.
   *
   * PROVEN BY PLANT rather than by reading. Replacing the real
   * `recordsForPosts(publishableForAsk(posts))` with an unfiltered
   * `recordsForPosts(posts)` and moving the original text into a trailing
   * comment left this gate GREEN. The assertion that no unpublished draft
   * enters the PUBLIC Ask index was satisfiable by a comment, and the absence
   * of that filter is what put five unpublished drafts on `/search/ask` in
   * July.
   *
   * Same form as `check:invariants` now, including the `[^:]` guard so a
   * `https://` inside a string literal is not read as the start of a comment.
   * Four gates still carry their own stripper of differing strength; that is
   * the class, and it is named in the report rather than half-fixed here.
   */
```

### scripts/check-policy.mjs:1639 (WHY, shortened)

the guard's job; the dated ratio measurement goes to Capsid.

```js
// SCOPE, ASSERTED. Stripping is only safe if it left something to match. An
  // over-eager stripper would empty the file and every assertion below would
  // report a missing filter that is present.
  // A QUARTER, not a third, since 2026-08-25: the module is deliberately
  // comment-heavy and the artifact-arc change took it to a measured 0.329
  // code ratio, brushing the old guard. The guard exists to tell an emptied
  // file (near zero) from a healthy one, and a quarter still does that.
```

### scripts/check-policy.mjs:1652 (WHY, shortened)

the binding this gate owns, and the shape that leaks if either half goes.

```js
/*
   * SINCE THE ARTIFACT ARC the full-corpus uploader takes no posts argument:
   * it reads `askCorpusRecords`, whose SQL composes `visibilityClause` (rule
   * 1; check:invariants section 8 holds every search_docs reader to it). What
   * this gate still owns is the BINDING: the uploader must source from that
   * one reader and from nothing unfiltered, and the reader's SQL must scope
   * to type='post' with the shared predicate concatenated in. An uploader
   * that re-grew its own SELECT, or a reader that lost the clause, is the
   * five-drafts-in-Ask shape again.
   */
```

### scripts/check-policy.mjs:1685 (WHY, shortened)

compose rather than restate, and why the scope is the function body.

```js
/*
   * THE ASK FILTER COMPOSES THE SHARED PREDICATE RATHER THAN RESTATING IT.
   *
   * The two assertions above prove the filter is CALLED. They cannot see what it
   * DOES, and what it did until 2026-08-23 was restate the visibility rule in a
   * third shape: `draft === true` out, `publishAt > now` out. That agreed with
   * `publiclyVisible()` by inspection and by these greps and by nothing else,
   * and a third hand-rolled copy is exactly what leaked five drafts into Ask on
   * 2026-07-29.
   *
   * So the rule now has ONE JavaScript owner and this binds Ask to it. Scoped to
   * `publishableForAsk`'s own body by brace matching, not to the file: the
   * module's prose names both symbols while explaining them, and a whole-file
   * match would read the comment as the code.
   */
```

### scripts/check-policy.mjs:1736 (WHY, shortened)

the property that moved with the mechanism; the round-trip measurement to Capsid.

```js
/*
   * THE DRIFT CHECK'S EXPECTED SET, re-scoped 2026-08-19 to the mechanism that
   * replaced the one this used to watch.
   *
   * It no longer recomputes records from the corpus, because doing so cost a
   * 600KB GitHub round trip on every admin page load. It reads the same records
   * out of `search_docs`. So the property worth pinning moved with it: the
   * expected set must come from that query, and that query must compose the
   * shared visibility predicate rather than hand-copying it, and must stay
   * posts-only or the twenty page records read as permanently stale.
   */
```

### scripts/check-policy.mjs:1756 (WHY, shortened)

assert the binding, never one spelling of one line; the re-scoping story to Capsid.

```js
/*
   * RE-SCOPED 2026-08-22, from a LINE ARRANGEMENT to the PROPERTY the comment
   * above already says this is for.
   *
   * The needle was `/const expected = new Set\(\(await askExpectedUrls\(env\)\)/`,
   * which pinned one spelling of one line. Running the D1 read and the AI
   * Search listing CONCURRENTLY, which is legitimate and measured, broke it
   * while leaving the binding it exists to protect completely intact: the
   * expected set still comes from `askExpectedUrls` and from nothing else.
   *
   * This is the repo's own rule that a gate broken by a refactor is a finding
   * rather than a fixture to update, applied honestly in the direction it
   * actually points. The finding is that the ASSERTION was wrong, not the
   * refactor: it could not distinguish "reads the expected set from D1" from
   * "reads it from D1 on one physical line", and only the first is the policy.
   *
   * It is scoped to the function BODY rather than the file, on exactly the
   * grounds the block below states: an unanchored needle finds a neighbour's
   * compliance.
   */
```

### scripts/check-policy.mjs:1788 (WHY, shortened)

the half that keeps a widening honest; the dated widening to Capsid.

```js
/*
   * WIDENED 2026-09-12, when the papers entered the index, and widened in the
   * direction the note above already argues for.
   *
   * The needle required the `keyForUrl` map to be the WHOLE argument to
   * `new Set(...)`, by pinning the closing parenthesis right after it. The
   * expected set is now the posts from D1 plus the papers from the committed
   * corpus, so the map is one element of a spread and the old needle failed on
   * an arrangement whose binding is intact. Same finding as last time: the
   * assertion could not tell "the post half comes from askExpectedUrls" from
   * "askExpectedUrls is the only thing on the line", and only the first is the
   * policy.
   *
   * The property is now asserted in two halves, and the second is the one that
   * keeps the widening honest: the paper half comes from the module and NOT
   * from a query this function grew.
   */
```

### scripts/check-policy.mjs:1818 (WHY, shortened)

the half a whole-line needle got for free.

```js
/*
   * AND FROM NOTHING ELSE, which is the half the old needle got for free by
   * pinning the whole line and which would otherwise be lost. `recordsForPosts`
   * is the corpus-recomputing producer this moved away from; the file-wide
   * check below catches it adjacent to the listing, this catches it anywhere in
   * the body at all.
   */
```

### scripts/check-policy.mjs:1835 (WHY, shortened)

a neighbour composing the same predicate satisfies a character window; the plant story cut.

```js
/*
   * SCOPED TO THE FUNCTION BODY, not to a character window after its name.
   *
   * The first draft of these three matched `askExpectedUrls` followed by the
   * needle within 900 characters. A plant that replaced the composed predicate
   * with a hand-copied one PASSED, because `zeroState` sits directly below and
   * composes `visibilityClause(NO_ALIAS)` itself: the window reached into the
   * next function and found a neighbour's compliance. That is hard rule 10's
   * unanchored needle, and it was caught by planting rather than by reading.
   */
```

### scripts/check-policy.mjs:1847 (WHY, shortened)

both zero-scope arms in two lines.

```js
// SCOPE, ASSERTED, for the same reason as the stripper above: an extractor
  // that returned "" would make all three assertions below report a missing
  // predicate that is present, and an extractor that returned the whole file
  // would make them pass on a neighbour's code, which is the defect that
  // produced this block.
```

### scripts/check-policy.mjs:1877 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- Report ---------------------------------------------------------------
```

### scripts/check-policy.mjs:1879 (NUMBER, shortened)

the floor is asserted on the line below; the seven dated re-measurements go to Capsid.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is what stands between an operator and the one operation reserved
 * for the human, so a version of it that quietly stopped asserting would be
 * expensive: the policy module would keep its shape while nothing tested the
 * transitions through it.
 *
 * RE-MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-24 by RUNNING it: 138,
 * after the smoke actor's section and the admin-session position guard landed.
 * Never summed. Floored at 128, about seven percent under.
 *
 * The previous pair was 104 measured against a floor of 96, and the floor is
 * moved with the measurement rather than left where it was, because thirty
 * assertions of slack is most of a section able to stop running unnoticed. That
 * is the same arithmetic the entry below this one is about.
 *
 * **THE FLOOR WAS 60 AGAINST 96, which is a third of this gate able to stop
 * running unnoticed.** It was set against a measurement of 59 and never moved
 * while the Ask origin check, the ordered cost chain for hard rule 19 and the
 * operator-token assertions all landed on top of it. That is the largest single
 * gap the 2026-08-24 floor sweep found in a gate whose subject is money paths
 * and delete authority, which is why the slack is not being preserved here:
 * most cases are inline state fixtures driven through the real decide(), so the
 * count moves only when a transition is added to the table or a source
 * assertion is added beside it.
 *
 * RE-MEASURED 2026-08-26 by RUNNING it, after ship gained its readiness step
 * and the four assertions that bind it: 145. The count had already moved to
 * 141 under the 128 floor before this session touched it, so the slack was
 * back to thirteen and is now reset. Floor 128 to 135, about seven percent
 * under, which is the same proportion the 2026-08-24 entry chose.
 *
 * RE-MEASURED 2026-09-05 by RUNNING it, after the cache-split assertions: 181.
 * THE FLOOR HAD DRIFTED FORTY-SIX BELOW THE COUNT, which is the exact condition
 * the 2026-08-24 entry above says it exists to prevent, and it happened again
 * in the way that entry predicted: the count moved with every session and the
 * floor moved with none of them. Four of those 181 are new here; the other
 * forty-two accumulated unremarked. Floor 135 to 168, about seven percent
 * under, the same proportion both earlier entries chose.
 *
 * RE-MEASURED 2026-09-09 by RUNNING it, after ruling 48's seven assertions:
 * 188. All seven are new here and nothing accumulated unremarked this time,
 * which is the first entry in this docblock able to say that.
 *
 * Floor 171 to 180, which is four percent under rather than the seven the
 * three entries above chose, and the change of proportion is deliberate: the
 * tolerance check refused 171 against 188 at `gap=17, tolerance=10`, so seven
 * percent no longer fits inside the instrument that guards this number. The
 * tolerance is the tighter rule and it wins.
 *
 * RE-MEASURED 2026-09-10 by RUNNING it, after ruling 56 turned ruling 48's four
 * assertions into seven (the deferred table is now a map of three checks, each
 * enumerated, each required to name the step that repairs it): 191. Tolerance
 * is 10 at that count, so anything from 181 up is legal; 184 leaves the slack
 * the entries above chose.
 */
```

## scripts/check-headers.mjs

### scripts/check-headers.mjs:1 (CONTRACT, shortened)

the boundary, the two-sources design and the fail-closed rule; the CI aside and the restatement cut.

```js
/**
 * Gate over the security headers the Worker stamps on every response.
 *
 *   npm run check:headers
 *
 * ## OBSERVATION BOUNDARY, and it is the whole point of reading this first
 *
 * **THIS GATE CANNOT SEE THE WIRE.** It reads `workers/app.ts` and asserts what
 * the source DECLARES and that both code paths apply it. It cannot tell you a
 * single header actually arrived at a browser. A deploy that never happened, a
 * Cloudflare feature that strips a header, a route that returns before the
 * entry handler: all invisible here and all green.
 *
 * That is hard rule 7 restated for this file. The wire is `verify-live`'s job,
 * and it asserts every header by EXACT VALUE on both a 200 and the `/admin`
 * 302, because the immutable-headers rebuild is a different branch. Neither
 * file replaces the other and neither is sufficient alone.
 *
 * What this gate IS for: stopping a later edit from silently dropping a header
 * or loosening a value. That failure has no symptom a human would notice, which
 * is precisely the class the gate family exists for.
 *
 * ("On a site with no CI", until 2026-08-20. CI landed and runs this gate on
 * every push, which changes who notices a red result, not whether a dropped
 * header has a symptom. The argument never depended on the missing half.)
 *
 * ## Two independent sources argue
 *
 * The EXPECTED set below is transcribed from the ratification (2026-08-06,
 * Phase A). The ACTUAL set is parsed out of `workers/app.ts`. Nothing here
 * reads its expectation from the file it is checking, so a changed value moves
 * one side of the comparison and fails. Same construction as `check:contrast`,
 * which takes thresholds from the design doc and hexes from the stylesheet.
 *
 * **Changing a header therefore means editing this file too, in the same
 * commit. That is the design, not friction.** These seven values were each
 * ruled on, and two of them (CORP, COOP) are deliberately NOT the restrictive
 * choice; a one-sided edit is exactly what must not pass quietly.
 *
 * Pure: no network, no database, no bindings. Offline tier.
 *
 * FAILS CLOSED. An empty constant, a missing constant, or a file that stops
 * parsing are each a failure, so "0 problems" can never mean "0 examined".
 */
```

### scripts/check-headers.mjs:94 (WHY, shortened)

the prose trap in one line.

```js
/*
 * Comments are stripped before anything is located. This file's own header and
 * the constant's docblock both spell out header names and values while
 * explaining WHY they are what they are, and a parser that read the prose would
 * find `same-origin` in the sentence saying same-origin is wrong. That trap has
 * already been hit by check:logo, check:contrast and check:features.
 */
```

### scripts/check-headers.mjs:106 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- fail closed first */
```

### scripts/check-headers.mjs:134 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------- both directions, name by name */
```

### scripts/check-headers.mjs:165 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------- the two values that look tightenable */
```

### scripts/check-headers.mjs:167 (WHY, shortened)

why these two get named assertions.

```js
/*
 * Called out individually rather than left to the value comparison above,
 * because these are the two a future session is most likely to "fix", and a
 * failure that NAMES the reason is worth more than one that just prints a diff.
 */
```

### scripts/check-headers.mjs:185 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------ applied on BOTH branches */
```

### scripts/check-headers.mjs:187 (WHY, shortened)

declaring and applying are different; the live example kept.

```js
/*
 * Declaring the set and applying it are different things, and the second is
 * where it would actually break. `workers/app.ts` has two exits: the normal
 * mutable one and the rebuild for immutable headers (`Response.redirect()`).
 * A helper called on only one of them means redirects ship bare, and `/admin`
 * returning 302 is a live example.
 */
```

### scripts/check-headers.mjs:213 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------- the cache-control DEFAULT ---- */
```

### scripts/check-headers.mjs:215 (WHY, shortened)

the auth bypass and hard rule 8's cached silence; the dated audit goes to Capsid.

```js
/*
 * **THIS IS THE ASSERTION THAT WAS MISSING, AND IT GUARDS AN AUTH BYPASS.**
 *
 * Workers Cache is on, and a response carrying no `Cache-Control` is CACHED
 * under RFC 9111 heuristic freshness, not skipped. The cache key does not
 * include cookies. `workers/app.ts` therefore stamps `private, no-store` on any
 * response that did not set the header itself, and that default is the only
 * thing standing between an authenticated `/admin` render and a shared cache
 * entry served to anyone who asks for that path for the next two hours.
 *
 * Audited 2026-08-07: those lines could be deleted and EVERY gate stayed green.
 * `check:config` compared the two config files to each other, which passes with
 * the cache turned off in both. `verify-live` observed only the cookie-downgrade
 * branch, never the no-header default, because all six routes it sweeps now
 * export `headers` of their own. Nothing looked at this.
 *
 * The value is transcribed from the ruling, like RATIFIED above, so a changed
 * default moves one side of the comparison. The BOTH-EXITS assertion is the
 * same shape as the one for applySecurityHeaders and for the same reason: the
 * immutable rebuild is a separate branch, and `/admin`'s 302 is the live case
 * that goes through it.
 */
```

### scripts/check-headers.mjs:279 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------ the CSP (Phase B, ENFORCED) --- */
```

### scripts/check-headers.mjs:281 (WHY, shortened)

the cheapest wrong fix and the strict-dynamic trap; the phase story cut.

```js
/*
 * The assertion that matters most here is the one about `'unsafe-inline'`, and
 * ENFORCEMENT made it matter more, not less.
 *
 * When something breaks, the cheapest way to make it stop is to add
 * `'unsafe-inline'` to `script-src`. That silences it, keeps every page working,
 * and reduces the policy to decoration, because `'unsafe-inline'` is exactly
 * what an injected `<script>` needs. It is invisible in review and nothing else
 * in the repo would notice. Hence a named assertion rather than trusting the
 * value comparison to catch it.
 *
 * This paragraph used to say "the single most likely wrong fix DURING THE
 * OBSERVATION WINDOW", which dated the risk to a phase that ended on
 * 2026-08-17. The risk did not end with the phase. It got sharper: under
 * Report-Only a wrong fix silenced a report, and under enforcement it unbreaks
 * a page a reader is looking at, which is a far stronger reason to reach for
 * it.
 *
 * Note `'strict-dynamic'` makes browsers IGNORE `'unsafe-inline'` when both are
 * present, so a future session could add it, see no behaviour change, and
 * conclude it was harmless. It is not harmless: it is what the policy falls
 * back to the moment `'strict-dynamic'` is dropped or a browser does not
 * support it.
 */
```

### scripts/check-headers.mjs:308 (WHY, shortened)

call the builder rather than regex it, and the fixture-independence rule.

```js
/*
 * THE POLICY IS CALLED, NOT PARSED, since the admin-only style nonce landed.
 *
 * This section used to match `function contentSecurityPolicy` out of the Worker
 * source and regex the directives out of the text. That worked while the
 * builder returned one string, and stopped being adequate the moment it
 * returned two: a regex can see that both branches EXIST, and cannot see which
 * one a request gets, so the strongest assertion it supports is "a nonce
 * appears somewhere in the function" rather than "the public policy has none".
 * Those two differ by exactly the defect worth catching.
 *
 * So the builder moved to `workers/csp.mjs` and is IMPORTED here. Same module
 * the Worker runs, so there is no second copy to drift. The nonce below is a
 * fixed string written in this file and never generator output, per hard rule
 * 10's fixture-independence discipline.
 */
```

### scripts/check-headers.mjs:351 (WHY, shortened)

why names and not values, and why both branches; the expired Report-Only argument cut.

```js
// The ratified directive names. Values are deliberately NOT all asserted here,
// and the reason CHANGED on 2026-08-17 without the code moving.
//
// It used to be "the point of Report-Only is that some of them may have to
// change", which expired with the phase. What holds now is narrower and is the
// real argument: this gate transcribes the ratification, and pinning every
// VALUE would make it a mirror of workers/csp.mjs, so a deliberate widening
// would fail here for no reason beyond having been made. The NAMES are asserted
// so a directive cannot be quietly dropped, and the values that carry the whole
// policy have named assertions of their own.
//
// BOTH BRANCHES, because a directive dropped from one arm only is exactly what
// a single-arm sweep reports as clean.
```

### scripts/check-headers.mjs:392 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------ the feeds get NO policy at all ------ */
```

### scripts/check-headers.mjs:394 (WHY, shortened)

the two-owners drift and why the types are read from the routes; the dated measurement to Capsid.

```js
/*
 * **EVERY FEED ROUTE'S DECLARED CONTENT-TYPE IS ONE `isFeed()` EXEMPTS.**
 *
 * The exemption list and the routes are two owners of one fact, and they had
 * already drifted. Measured on the live host 2026-09-11: `/blog/atom.xml`
 * served a full CSP carrying a per-request nonce on a body stored with
 * `s-maxage=600`, because `isFeed()` listed `application/rss+xml` and
 * `application/json` while a comment beside it called that "the two feeds".
 * Atom arrived later and nothing compared the two sides. `/sitemap.xml` had
 * the same shape for the same reason.
 *
 * THE TYPES ARE READ OUT OF THE ROUTE FILES, not restated here. That is what
 * makes this an argument between two independent sources rather than a mirror:
 * a route that starts declaring a different type moves the ACTUAL side, and a
 * shortened exemption list moves the EXPECTED side. Either one fails.
 *
 * `isFeed` is IMPORTED and CALLED, on the same reasoning `contentSecurityPolicy`
 * is: a regex over the list in the Worker reads its spelling, not its answer.
 */
```

### scripts/check-headers.mjs:414 (WHY, shortened)

why named and not globbed.

```js
/**
   * The three feeds, by route file. Named rather than globbed, because the
   * assertion is about THESE THREE documents being exempt and a glob would
   * quietly shrink to whatever still matches.
   */
```

### scripts/check-headers.mjs:451 (WHY, shortened)

the unfailable-condition negative.

```js
/*
   * THE NEGATIVE, so the three assertions above cannot pass by `isFeed()`
   * having become `() => true`. A document type must still be policed; that is
   * the entire reason the list is named types rather than a negation of
   * `text/html`.
   */
```

### scripts/check-headers.mjs:467 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------ the style nonce is ADMIN ONLY ------- */
```

### scripts/check-headers.mjs:469 (WHY, shortened)

the silent widening and why both directions are asserted.

```js
/*
 * **THE PUBLIC BRANCH IS THE ASSERTION THAT MATTERS.**
 *
 * The admin plane gets a style nonce so CodeMirror's injected StyleModule is
 * accepted. The entire value of scoping it that way is that the public side
 * stays ABSOLUTE, and nothing in the code stops a later edit from passing
 * `true` everywhere: doing so would fix a violation report, read as a
 * simplification, leave every comment in place describing a policy that no
 * longer exists, and break nothing a reader could see.
 *
 * The seven edge-cached public routes are why it would matter. Header and body
 * are cached together for cookieless readers, so one nonce is valid there for
 * up to ten minutes. That exposure is accepted in writing for `script-src`;
 * extending it to styles as a side effect is not.
 *
 * Asserted in BOTH DIRECTIONS. The public arm must carry no nonce source, and
 * the admin arm must carry one, because an assertion that only refuses the
 * nonce publicly is equally satisfied by a build where the editor is broken
 * again.
 */
```

### scripts/check-headers.mjs:540 (WHY, shortened)

assert on real paths, not on the caller's if.

```js
/*
 * WHAT DECIDES THE BRANCH, asserted on real paths rather than on the caller's
 * `if`, which would be a mirror of the caller.
 *
 * The public list is taken from `routes.ts` and includes the cases that would
 * catch a bare `startsWith("/admin")`: a hypothetical `/administrator`, and the
 * `.data` serialisations React Router actually emits.
 */
```

### scripts/check-headers.mjs:620 (WHY, shortened)

the guard survives the ruling flipping; the date and the eleven days cut.

```js
/*
 * PHASE B IS ENFORCED, ruled 2026-08-17 (option A). This assertion REVERSED on
 * that date: it used to require Report-Only and to refuse the enforcing header,
 * so that enforcement could not happen as a side effect of some other edit. The
 * ruling is made, so the direction flips and the guard stays: enforcement must
 * not be silently REVERTED either, which is the more likely accident now.
 *
 * A revert would be invisible in every other way. The page still works, the
 * header is still present, the reports still arrive, and the only difference is
 * that nothing is blocked, which is exactly the state this spent eleven days in.
 */
```

### scripts/check-headers.mjs:644 (WHY, shortened)

reporting and enforcing are independent.

```js
/*
 * REPORTING SURVIVES ENFORCEMENT. Enforcing and reporting are independent: a
 * policy can block silently. Losing the reports would remove the only signal
 * that the policy is refusing something a reader needed.
 */
```

### scripts/check-headers.mjs:671 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------- the nonce reaches every script ---- */
```

### scripts/check-headers.mjs:673 (WHY, shortened)

what a source-level check here is for.

```js
/*
 * TWO SCRIPT CLASSES THAT DO NOT GET THE NONCE FOR FREE, both found by the
 * browser rather than by reading, and both invisible to every other gate.
 *
 * A source-level check only. Whether the attribute reaches the wire is
 * verify-live's job, and whether the browser accepts it is the browser's. What
 * this stops is a later edit silently dropping either one, which produces a
 * page that renders perfectly and would fail closed the moment the policy is
 * enforced.
 */
```

### scripts/check-headers.mjs:690 (WHY, shortened)

which scripts ship bare without the prop; the dated report count to Capsid.

```js
/*
 * `ServerRouter` passes its `nonce` prop BOTH into FrameworkContext and
 * directly to `StreamTransfer`, which stamps React Router's two streaming
 * scripts. Without the prop those ship bare on every page, and the `enqueue`
 * one carries the hydration payload. Measured 2026-08-06: 10 violation
 * reports, all script-src-elem/inline, all on the document's last line.
 */
```

### scripts/check-headers.mjs:714 (WHY, shortened)

the counter-intuitive gating, the silent failure, and the stated exclusion; the deleted sibling cut.

```js
/*
 * THE SPECULATION BLOCK, and since 2026-08-28 there is exactly ONE.
 *
 * `speculationrules` IS gated by script-src while `application/ld+json` is NOT.
 * Both are non-executable data blocks, so this is counter-intuitive and was
 * settled by the browser, not by argument. Asserted so nobody "consistently"
 * removes it.
 *
 * `SiteSpeculation` rides in `SiteHeader`, so it renders on every public page.
 * Under an ENFORCED policy an un-nonced `type="speculationrules"` element is
 * refused by `script-src` on every one of them, SILENTLY: the page renders
 * identically, nothing is logged where anyone looks, and the enhancement is
 * simply absent.
 *
 * `BlogSpeculation` was the second block, on the two blog routes, and its
 * assertions lived here beside these. It was deleted when the rules became
 * document rules; its subject is inside the document rule now. Its file no
 * longer exists, so a `readFileSync` of it would throw rather than pass, which
 * is the loud direction.
 *
 * WHAT THIS DOES NOT ASSERT: that the rules name the right paths or exclude the
 * right ones. That is `test/header-speculation.test.mjs` for the derivation and
 * `check:browser` for the payload a browser actually parses, which is why this
 * gate carries no second copy of either list.
 */
```

### scripts/check-headers.mjs:753 (HISTORY, deleted)

which build renamed the component and that the gate followed; what is asserted never moved.

```js
/*
 * `site-header.tsx` AGAIN SINCE 2026-09-14. Build 2 renamed this component to
 * `shell-header.tsx` and Dustin's restore renamed it back; the gate followed
 * the file both times. What is asserted has not moved: the public header is
 * what renders SiteSpeculation, and an imported-but-unrendered component still
 * fails. A missing file throws here rather than failing, which is why the
 * rename had to be tracked rather than left to a soft miss.
 */
```

### scripts/check-headers.mjs:770 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------- the draft preview route (feature G) ------ */
```

### scripts/check-headers.mjs:772 (WHY, shortened)

the copy-paste this is written for, and why an identifier is accepted as a value.

```js
/*
 * **THE ONE ROUTE WHOSE HEADERS ARE THE ACCESS CONTROL.**
 *
 * `/preview/:token` serves an UNPUBLISHED post to a caller with no session.
 * Workers Cache is in front of this Worker and its key does not include
 * cookies; the cookieless downgrade in `workers/app.ts` is what keeps the
 * public post route safe, and a preview reviewer is exactly the request shape
 * that downgrade never fires for. So the route's own `Cache-Control` is not a
 * performance choice, it is the thing standing between a draft and a shared
 * cache entry.
 *
 * The failure this is written for is SPECIFIC and it is a copy-paste:
 * `blog.$slug.tsx` sits next to it in the same directory, exports a `headers()`
 * of the same shape, and sets `SHARED_CACHE_CONTROL`. Someone reaching for the
 * neighbouring file's version of this function would produce a route that
 * renders perfectly, passes every other gate, and publishes drafts to anyone
 * who asks for the path.
 *
 * Two independent sources argue, as above: RATIFIED_PREVIEW is transcribed from
 * the ruling and the actual set is parsed out of the route. The parse accepts an
 * IDENTIFIER as a value as well as a string literal, deliberately: had it only
 * matched quoted values, swapping in `SHARED_CACHE_CONTROL` would have read as
 * "Cache-Control is not declared" rather than as the wrong value, and the
 * failure would name the wrong problem on the one edit most likely to happen.
 */
```

### scripts/check-headers.mjs:877 (WHY, shortened)

the subtler shape the value check misses.

```js
/*
   * NO PUBLIC BRANCH, named rather than left to the value comparison.
   *
   * The value check above catches `"Cache-Control": SHARED_CACHE_CONTROL`. This
   * catches the subtler shape: the constant staying correct while a conditional
   * somewhere else in the file hands back the public value on some path. The
   * rule is that the identifier does not appear in this file AT ALL.
   */
```

### scripts/check-headers.mjs:908 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------- the analytics capture (feature F.1 + G) --- */
```

### scripts/check-headers.mjs:910 (WHY, shortened)

a one-off live measurement is not a gate, and why the section lives in this file.

```js
/*
 * **NOTHING GATED THIS UNTIL 2026-08-15, and the belief that something did is
 * itself worth recording.**
 *
 * F.1 proved the capture's exclusions by querying the LIVE DATASET after a
 * deploy: admin 0, assets 0, query strings 0, referer paths 0. That is a strong
 * measurement and it is not a gate. It ran once, against one deploy, and
 * nothing has re-asserted it since; deleting the `/admin` skip would have left
 * every gate in this repo green while the operator's own page views started
 * flowing into the panel that exists to exclude them.
 *
 * This section lives in `check:headers` because this is the only gate that
 * parses `workers/app.ts`, and the capture is in `workers/app.ts`. The name is
 * a poor fit and the alternative was worse: a new gate would have to be tiered
 * in `check-all.mjs` and would duplicate this file's whole parsing setup to
 * read the same source. The OBSERVATION BOUNDARY at the top of this file
 * already says what it can and cannot see, and it covers this identically.
 *
 * SOURCE-LEVEL ONLY. It sees what the capture DECLARES. Whether a row reaches
 * the dataset is `ae-probe`'s question and needs a deploy plus a read token.
 */
```

### scripts/check-headers.mjs:949 (WHY, shortened)

why each exclusion is named separately.

```js
/*
 * THE THREE EXCLUSIONS F.1 RULED, each named individually rather than left to
 * one "does it look right" check, because a failure that says WHICH exclusion
 * went is worth more than one that says the function changed.
 */
```

### scripts/check-headers.mjs:978 (WHY, shortened)

the capability in the path, both slots, and why absence is asserted too.

```js
/*
 * **THE REDACTION, AND IT IS AN ACCESS CONTROL RATHER THAN A DATA CHOICE.**
 *
 * `/preview/<token>` carries a 43-character capability in its PATH. Writing
 * `url.pathname` verbatim stored it in Analytics Engine and rendered it in full
 * on /admin/origin-requests, defeating the drawer's six-character truncation.
 * Measured on production 2026-08-15 on the first real use of the feature.
 *
 * BOTH SLOTS, asserted separately. The path is written twice: into `blobs` and
 * into `indexes`, which is the sampling key. Redacting one and not the other
 * leaves the token in the dataset, and the `indexes` slot is the easier of the
 * two to forget because it is three lines further down behind a comment.
 *
 * Asserted as the ABSENCE of the raw expression as well as the presence of the
 * redacted one. Presence alone passes on a capture that computes `path` and
 * then writes `url.pathname` anyway.
 */
```

### scripts/check-headers.mjs:1043 (NUMBER, shortened)

the floor is asserted below; the dated step-by-step re-measurements go to Capsid.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * A pass count is not coverage. An assertion block that stops running reports
 * green, and a green run with nothing in it looks exactly like a green run that
 * checked everything.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-15 by RUNNING it: 94.
 * Never summed. It was 66 against a floor of 62 until the draft preview route's
 * section landed, then 82 against 77, and the analytics capture section took it
 * to 94. Every one of those steps was counted by RUNNING the gate rather than
 * by adding up what the new block looked like it would contribute, which is the
 * discipline verify-live's floor proved the value of on this same feature: the
 * arithmetic there was one low against the measurement.
 *
 * Floored at 88, roughly 6 percent: the count tracks the header sets declared
 * in workers/app.ts and in the preview route, their application sites, and now
 * the capture's exclusions, so it moves when one is added, which should be a
 * deliberate diff rather than drift.
 */
```

### scripts/check-headers.mjs:1063 (WHY, shortened)

an SVG is a document, why the assertion outlives the CSP, and the boundary.

```js
/* ------------------------------------------------------------------ *
 * UPLOADED SVG IS SERVED AS AN ATTACHMENT.
 * ------------------------------------------------------------------ *
 *
 * An SVG is a document, not a picture: it can carry script. `image/svg+xml` is
 * on the upload allowlist, and `/media/*` serves from the SITE'S OWN ORIGIN, so
 * inline it is script running as the site.
 *
 * The CSP has BLOCKED that since 2026-08-17 rather than merely reporting it, and
 * this assertion is kept regardless: it does not depend on the policy, so it
 * survives a loosened directive and covers any client that ignores CSP. Same
 * reasoning as the comment on `attachIfActive` itself.
 *
 * OBSERVATION BOUNDARY: source only. This proves the route SETS the header on
 * the paths that serve the stored bytes; it does not fetch an object, so it
 * cannot see R2 or a cache layer dropping it on the way out.
 */
```

### scripts/check-headers.mjs:1090 (WHY, shortened)

the pairing is the invariant, and what restating the type would allow.

```js
/*
   * DERIVED FROM THE UPLOAD ALLOWLIST, never restated. The pairing is the
   * invariant: a script-capable type is uploadable only while this route
   * refuses to serve it inline. Restating "svg" here would let a NEW capable
   * type be added to the allowlist with no corresponding attachment rule,
   * which is the exact shape of the N-1-of-N misses this repo keeps paying for.
   * The allowlist end of the pairing is asserted in test/upload-contract.test.mjs.
   */
```

### scripts/check-headers.mjs:1119 (WHY, shortened)

the half that rots.

```js
/*
   * AND IT IS APPLIED ON EVERY PATH THAT SERVES THE STORED BYTES, which is the
   * half that rots: a new branch returning `object.body` would be invisible to
   * a check that only asserted the helper exists. Counted, both directions.
   */
```

### scripts/check-headers.mjs:1134 (WHY, shortened)

the glob-widening hazard, why it is per block, and the stated exclusion; the dated measurements to Capsid.

```js
/* ------------------------------------------------------------------ *
 * ASSET CACHE RULES: `public/_headers`.
 * ------------------------------------------------------------------ *
 *
 * Workers Assets defaults every asset to `max-age=0, must-revalidate`.
 * MEASURED on production 2026-08-16, one full document load of /admin/media:
 * 14 asset requests, all 14 on the network, every one headers-only
 * (transferSize 300 against encoded bodies up to 60 kB, so a 304 with the body
 * already on disk), median 689ms and 1204ms for the slowest.
 *
 * The immutable year is scoped to `/assets/*`, whose filenames carry their
 * content hash, so a year is safe by construction. THE DANGER IS THE GLOB
 * WIDENING. A rule over `/*` would pin `favicon.ico`, `logo.svg` and the icon
 * suite for a year at stable paths, and this repo has already recorded a
 * browser holding a stale favicon hard enough to look like a failed deploy.
 * That is what this asserts.
 *
 * ## IT USED TO ASSERT "`/assets/*` IS THE ONLY PATH", WHICH IS NOT THE RULE
 *
 * That was a proxy for the property, and it was a fair proxy while `/assets/*`
 * was the only path anybody wanted. It stopped being one on 2026-09-12, when
 * the markdown twins arrived: `public/publications/*.md` are assets rather than
 * route output, so the two headers a route would have set (a ten-minute shared
 * cache and `X-Robots-Tag: noindex`) can only be set here. Under the old
 * assertion, adding a NOINDEX rule to an unhashed path failed a check about
 * long-lived caching, which is a gate refusing something its own reasoning
 * permits.
 *
 * So the assertion is now the property: no path outside `/assets/*` is
 * immutable or fresh for longer than `MAX_UNHASHED_FRESHNESS`. Read PER BLOCK
 * rather than over the whole file, because the file-wide reading could not tell
 * which path a directive belonged to, and would have passed a year on
 * `/logo.svg` beside a short rule somewhere else.
 *
 * `stale-while-revalidate` is deliberately NOT bounded. It is not a freshness
 * lifetime: the body is revalidated in the background and replaced, which is
 * the opposite of the un-revokable state this guards against, and every HTML
 * route on this site already sends `stale-while-revalidate=86400` through
 * `SHARED_CACHE_CONTROL`.
 *
 * OBSERVATION BOUNDARY: this reads the tracked FILE. It does not fetch an
 * asset, so it cannot see Workers Assets failing to apply a rule it parsed.
 * The served header was proven separately with `wrangler dev` and is owed a
 * re-measure on the next deploy.
 */
```

### scripts/check-headers.mjs:1185 (CONTRACT, shortened)

the constant's meaning and the no-purge-door reason, cites hard rule 20; trimmed.

```js
/**
 * The longest freshness an UNHASHED path may declare, in seconds.
 *
 * One hour. The hazard is a path whose bytes can change under a stable URL: once
 * a browser has stored it as fresh, nothing on the server can recall it, and
 * there is no purge door here (hard rule 20 records why: `workers.dev` has no
 * zone). An hour is short enough that a bad deploy is corrected within one, and
 * long enough to be worth declaring at all.
 *
 * `/assets/*` is exempt because its filenames carry a content hash, so its URL
 * changes whenever its bytes do and the question cannot arise.
 */
```

### scripts/check-headers.mjs:1206 (WHY, shortened)

what the flat split could not answer.

```js
/*
   * PARSED INTO BLOCKS, so every directive is attributed to the path it sits
   * under. The flat split this replaced read all the directives in the file as
   * one list, which cannot answer "is anything unhashed pinned for a year" the
   * moment the file has two paths in it.
   */
```

### scripts/check-headers.mjs:1246 (WHY, shortened)

why both directives are read.

```js
/*
   * THE PROPERTY, per block. `max-age` and `s-maxage` are both read, because
   * `s-maxage` overrides `max-age` for the shared cache and a year there is the
   * same un-revokable state at the edge instead of in a browser.
   */
```

### scripts/check-headers.mjs:1273 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------- the health endpoint's own headers ------ */
```

### scripts/check-headers.mjs:1275 (WHY, shortened)

hard rule 8's cached silence and why the scope is structural; the commit reference cut.

```js
/*
 * **A HEALTH CHECK THAT CAN BE SERVED FROM CACHE IS NOT A HEALTH CHECK.**
 *
 * `/api/health` returned `Response.json({ ok: true })` with no `Cache-Control`.
 * Hard rule 8: that is CACHED, not skipped. Workers Cache is in front of this
 * Worker and Cloudflare applies heuristic freshness to a 200 carrying neither
 * `Cache-Control` nor `Expires`, storing it for two hours. The endpoint could
 * therefore report health measured two hours ago, identically whether the
 * Worker was fine or on fire, which is the reassuring silence a monitor exists
 * to break.
 *
 * ## SCOPED STRUCTURALLY, NOT BY A WINDOW
 *
 * The tempting assertion is "the file mentions no-store", and it is worthless:
 * it passes on a comment, and this repo has had a comment both satisfy an
 * assertion and fail one in the same week. The next temptation is a window
 * around each `new Response`, and that is the shape that read the NEXT
 * function's compliance in `df99bf1`.
 *
 * So the property asserted is structural: the route constructs a Response in
 * EXACTLY ONE place, that place is inside `healthJson`, and `healthJson`
 * applies the constant. A second exit added later without the headers moves the
 * count and fails here, which is the case that matters once the endpoint grows
 * a 503 path. Comments are stripped before any of it.
 */
```

### scripts/check-headers.mjs:1357 (WHY, shortened)

why one construction site is the invariant.

```js
/*
   * THE APPLICATION SITE, counted rather than searched for. One construction is
   * the invariant: it is what makes "the header is on every response" provable
   * without inspecting each response.
   */
```

### scripts/check-headers.mjs:1386 (WHY, shortened)

why seeding is asserted rather than a bare mention; the date and the needle story cut.

```js
/*
     * THE NEEDLE FOLLOWED THE HELPER, 2026-08-26. It read
     * `headers: HEALTH_HEADERS`, which was exact while the helper passed the
     * object straight through. The rate limit gave the route one response that
     * needs a `Retry-After` no other response wants, so the helper now seeds a
     * `Headers` from the constant and overlays the caller's extras.
     *
     * `new Headers(HEALTH_HEADERS)` is asserted rather than a bare mention of
     * the identifier, and the difference matters: a bare `HEALTH_HEADERS`
     * anywhere in the body would be satisfied by a line that merely READS the
     * constant without seeding from it, which is exactly the shape a refactor
     * that stopped applying it would leave behind. The invariant is unchanged:
     * the one construction site is built FROM the constant.
     */
```

### scripts/check-headers.mjs:1421 (WHY, shortened)

the shared cache entry across schemes, and why position; the dated measurement to Capsid.

```js
/*
   * MEASURED ON THE WIRE, 2026-08-23, and it is why this section exists: plain
   * http:// returned 200 with the full page, and the first plaintext request to
   * a path already warmed over HTTPS came back CF-Cache-Status: HIT carrying the
   * SAME CSP nonce. The two schemes shared one cache entry, so the nonce that
   * the enforced policy relies on was being handed out in the clear.
   *
   * Asserted on POSITION, not presence. A redirect that runs after the router
   * has already produced a response is not a redirect, and presence alone would
   * pass on exactly that.
   */
```

### scripts/check-headers.mjs:1432 (WHY, shortened)

an assertion about position must know which body it reads; the re-scoping story to Capsid.

```js
/*
   * RE-SCOPED TO THE GATEWAY, 2026-09-05, and the re-scope is a finding.
   *
   * This block used to take the FIRST `async fetch(` in the file and assert
   * that `httpsRedirectTarget` appeared before `RouterContextProvider` inside
   * it. After the entrypoint split the first `async fetch(` is the RENDERER's,
   * which constructs the router and never redirects, so the needle was pointing
   * at the wrong handler and this gate went red. It was right to: an assertion
   * about POSITION has to know which body it is reading, and this one silently
   * changed subject when the file's shape changed.
   *
   * The property is now stated against the shape that exists, and it is
   * STRONGER than the old claim. The redirect must be in the GATEWAY and must
   * come before the loopback: before the loopback means before anything could
   * be answered from cache, where the old one only meant before a render.
   */
```

### scripts/check-headers.mjs:1467 (WHY, shortened)

the other direction and what it stops.

```js
/*
   * AND THE RENDERER DOES NOT REDIRECT, which is the other direction. Without
   * it the assertion above could be satisfied by a copy of the redirect having
   * moved into the entrypoint that runs on a miss only, where it would be
   * skipped on every hit.
   */
```

### scripts/check-headers.mjs:1487 (WHY, shortened)

why this one is a safety property.

```js
/*
   * The redirect's own caching, and this one is a safety property rather than
   * hygiene. The scheme is NOT part of the cache key, which is the whole defect
   * this closes; a cacheable redirect stored under a shared key would be served
   * to HTTPS readers too and send them to the URL they already requested.
   */
```

### scripts/check-headers.mjs:1511 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------- every public HTML route sets the shared policy - */
```

### scripts/check-headers.mjs:1513 (WHY, shortened)

the symptomless gap, why the routes are asserted and not the helper, and the stated exclusions.

```js
/*
 * **THE GAP THIS CLOSES EXISTED BECAUSE NOTHING ASSERTED IT.**
 *
 * /projects exported no headers() at all and so fell through to hard rule 8's
 * uncached default: the one public page never edge-cached, every reader paying
 * an origin hit for a body identical to everyone's. It sat in core.md as a
 * known gap for weeks, because a missing export has no symptom a human meets
 * and no gate was looking.
 *
 * Asserted on the ROUTE FILES rather than on the helper, because the helper
 * being correct proves nothing about who calls it. Comments are stripped
 * first: three of these files discuss headers() in prose while explaining the
 * Vary pairing, and a raw match would read the explanation as the code.
 *
 * The routes that negotiate on Accept are deliberately absent: blog.$slug,
 * blog._index and search take loaderHeaders or HTML_VARY_ACCEPT and are their
 * own shape. preview.$token is absent for the opposite reason and has its own
 * section above.
 */
```

### scripts/check-headers.mjs:1547 (WHY, shortened)

why a query string is a cache key rather than a refusal.

```js
/*
     * The publication index, back on the site 2026-09-12 under ruling 63.
     *
     * Shared-cached, and the interesting part is that its QUERY STRING is part
     * of the cache key rather than a reason to refuse caching: the topic chips,
     * the search box and the sort are all GET parameters, so one reader's
     * `?topic=bacteriophages` is a different entry from another's bare URL and
     * neither can be served to the other. Nothing on it is reader-specific; the
     * citation counts come from KV and are the same for everybody.
     */
```

### scripts/check-headers.mjs:1558 (WHY, shortened)

one reader's copy is every reader's copy.

```js
/*
     * One paper's page. Same policy as the index and for the same reason:
     * every byte of it is a function of the committed corpus, so one reader's
     * copy is every reader's copy. The citation counts come from KV and are
     * identical for everybody.
     */
```

### scripts/check-headers.mjs:1573 (WHY, shortened)

why /blog is in this list rather than the negotiating one; the dated move cut.

```js
// MOVED HERE FROM THE ACCEPT-NEGOTIATING LIST, 2026-09-05. `/blog` was in
    // that list because it set its own `Vary`, and the Vary it set was
    // `Cookie` rather than `Accept`: it has no twin representation and never
    // did. With the theme in the cache key instead, it has no reason for a Vary
    // at all and calls the helper like every other listing page.
```

### scripts/check-headers.mjs:1587 (WHY, shortened)

why these two cannot call the helper; the dated shrink from three cut.

```js
/*
   * THE ACCEPT-NEGOTIATING PAIR, asserted on the string rather than on the
   * helper. They cannot call publicHtmlHeaders(): each pairs the shared
   * Cache-Control with its own Vary, because each has a twin representation
   * (markdown, or JSON) that Accept selects between.
   *
   * IT WAS THREE UNTIL 2026-09-05. `/blog` was here for a `Vary: Cookie` it no
   * longer sets, and it never negotiated on Accept; the theme is a cache key
   * dimension now, so the only Vary left on this site is the one that names a
   * real second representation.
   */
```

### scripts/check-headers.mjs:1610 (WHY, shortened)

the silent-both-ends failure, why the pairing, and why the needle is not the value.

```js
/*
   * EVERY SHARED-CACHEABLE ROUTE ALSO SETS A CACHE TAG. Ruling 17, 2026-09-05.
   *
   * ## WHY THIS IS A GATE AND NOT A CONVENTION
   *
   * A response that can be stored and cannot be purged is a page that stays
   * wrong for ten minutes after a write that was supposed to fix it, and the
   * failure is SILENT in both directions: the write reports success, and
   * `cache.purge` reports `success: true` for a tag that matches nothing,
   * because there is nothing for it to report. Neither end says anything. The
   * only place the omission is visible is here, in the source, before it ships.
   *
   * ## IT IS THE PAIRING THAT IS ASSERTED
   *
   * `publicHtmlHeaders` returns both halves together, so a route that calls it
   * passes by construction. The two Accept-negotiating routes build their
   * headers by hand and are exactly where a half can go missing, which is why
   * this is checked FROM the same derived list the section above closes over
   * rather than from a hand-kept set of route names.
   *
   * The needle is the CALL or the header name, never the tag's VALUE. What the
   * tag should say is `cacheTags`' business and hard rule 17 gives that one
   * owner; a gate that restated the vocabulary would be the second owner.
   */
```

### scripts/check-headers.mjs:1648 (WHY, shortened)

the zero-scope arm kept; the dated off-by-one measurement goes to Capsid.

```js
/*
   * SCOPE, ASSERTED. An empty walk reports no untagged routes, which is exactly
   * what a compliant tree reports.
   *
   * MEASURED THROUGH THIS LOOP on 2026-09-05 by RUNNING the gate: 11. The first
   * figure written here was 10, counted off the two list literals above rather
   * than run, and it was wrong by one. Hard rule 10's own example, in the commit
   * that added the assertion: a floor arrived at by reading is not a floor.
   */
```

### scripts/check-headers.mjs:1672 (WHY, shortened)

closure is what makes the lists an owner, and the no-count-in-prose rule.

```js
/*
   * CLOSURE, AND IT IS THE HALF THAT MAKES THESE LISTS AN OWNER RATHER THAN A
   * SECOND COPY.
   *
   * The lists are checked FROM the tree, not against it: every .tsx route that
   * references the shared string must appear in one of them. A new shared-cached
   * page therefore cannot ship unlisted, which is how /projects went the other
   * way and sat uncached for weeks with nothing looking.
   *
   * THIS IS WHAT LETS workers/app.ts STATE THE NONCE EXPOSURE WITHOUT A COUNT.
   * That count read seven, was written when the true value was six, and became
   * eight the morning /projects gained headers(). Three copies of it existed, in
   * two files, and all three were wrong at once. A number in prose beside a gate
   * is a second copy of the gate; hard rule 8 carries the same lesson, and this
   * is where the habit has cost the most.
   *
   * Comments stripped first: preview.$token.tsx NAMES the shared constant in
   * prose to explain why it refuses it, and an unstripped scan would read that
   * sentence as a reference and demand the route join the list.
   */
```

### scripts/check-headers.mjs:1743 (NUMBER, shortened)

the floor is asserted below; five dated re-measurements and the CI story go to Capsid.

```js
/*
 * FLOOR RE-MEASURED 2026-08-23 BY RUNNING THIS GATE, never summed.
 *
 * **THE OLD VALUE HAD GONE STALE BY 44 AND NOBODY WOULD HAVE NOTICED.** It read
 * 99, its comment said "Measured: 99", and the gate was in fact running 143
 * before this section landed. A floor 44 under the truth is not a floor: two
 * whole sections could have stopped running and the count would still have
 * cleared it, which is precisely the failure this assertion exists to catch.
 * It was a floor that could not fail, hard rule 10's own class, sitting inside
 * the gate family that names it.
 *
 * That is the argument for measuring THROUGH the pipeline every time rather
 * than adding up what a new block looks like it will contribute: the arithmetic
 * drifts silently, and only running it says so. I first wrote 108 here by
 * reasoning from the stale 99, and running the gate is what corrected it.
 *
 * Measured now: 184, by RUNNING it. Floored at 173, roughly
 * six percent under, matching the convention the preview-route floor set.
 *
 * **AND THE 174 THIS PARAGRAPH USED TO CARRY HAD ALREADY DRIFTED BY SEVEN.**
 * Measured 2026-08-23 by extracting HEAD's copy of this gate and running it
 * against the current tree: 181, before the three SiteSpeculation assertions
 * above landed. So the value was stale within the same day it was written, by
 * ordinary commits doing ordinary work, which is the whole argument for the
 * floor being a floor rather than an equality. The delta is stated as a
 * measurement of two runs, never as arithmetic on the new block.
 *
 * **RE-MEASURED 2026-09-11, BY RUNNING BOTH SIDES.** HEAD's copy of this file,
 * extracted and executed against the current tree: 197. This tree, with the
 * feed-exemption block: 208, and 211 once `about.tsx` joined PUBLIC_HTML and
 * brought its three per-route assertions with it. So 187 had drifted ten under
 * its own count before that commit, by the same ordinary work the paragraph
 * above describes. The value is six percent under the 211 actually observed,
 * which is the convention the preview-route floor set, and it is arithmetic on
 * a MEASUREMENT rather than on the old number plus the new block.
 *
 * **SET THROUGH check:floors' OWN TOLERANCE, 2026-09-11, after CI caught the
 * first attempt.** That attempt read "six percent under" out of a comment in
 * check-headers.mjs and applied it to four gates. The rule is
 * `max(3, ceil(executed * 0.05))` and it belongs to `scripts/check-floors.mjs`,
 * the gate that enforces it. Prose about a gate ages; the gate does not.
 *
 * It went undetected locally because check:floors runs the whole offline tier
 * and therefore runs LAST, and the tier hangs before it on this host
 * (node --test wedges on test/check-all-cleanup.test.mjs, which predates this
 * work and is proven so by differential). CI reached it on the first push.
 *
 * Executed 211, tolerance 11, so the lowest legal floor is 200. This sat at
 * 206, about half the tolerance under the count: far enough to absorb an added
 * block, close enough that a gate which has quietly halved cannot pass.
 *
 * RE-MEASURED at 219 on 2026-09-12, when the `_headers` block was rewritten to
 * read per path rather than per file. Same reasoning, same fraction: tolerance
 * 11, lowest legal floor 208, this sits at 213.
 */
```

## scripts/check-page-payload.mjs

### scripts/check-page-payload.mjs:1 (CONTRACT, shortened)

the boundary, the byte-equality rule and the syntax pass; both rename narratives, the dated plant and the whole-page navigation go to the history document.

```js
/**
 * Gate: what a reader downloads to see a public page, per route, with ceilings.
 *
 *   npm run check:page-payload
 *
 * ## RENAMED FROM check:script-payload, 2026-08-27, because the old name was
 * ## the old scope
 *
 * It graded the four enhancement bundles, which is the JavaScript, while rule 4
 * names "everything a reader downloads to see a page". The stylesheet was in
 * that sentence and in no gate: 45,778 bytes on every route with no ceiling
 * anywhere, and the largest single resource on the site, the font, had none
 * either. The whole-page section is at the bottom of this file; everything
 * above it is the script gate, unchanged and still doing its job.
 *
 * OBSERVATION BOUNDARY: this reads the BUILD ON DISK under build/client and
 * the bundles under app/enhance/dist. It does not build, so run against a
 * stale build it certifies the stale build, exactly as `npm run deploy` would
 * ship it. It also cannot see a RENDERED page: the public plane is
 * server-rendered at request time, so "the page carries only enhancement
 * script tags" is a claim about a response, asserted by check:browser against
 * the preview and by verify-live section 16 against the wire. What this gate
 * CAN see offline is the build's shape (every bundle emitted verbatim, every
 * served asset syntactically runnable) and the source's shape (hydration is
 * opt-in and only the admin plane and its door opt in).
 *
 * ## What changed here, 2026-08-26
 *
 * Until the public plane stopped hydrating, this gate's subject was the
 * hydration set: 12 files, 95,456 bytes brotli that every public reader
 * downloaded, plus one dynamically imported enhancement chunk. The framework
 * no longer rides on public pages, so the public payload IS the enhancement
 * bundles, measured per module below. The manifest walk survives as a
 * structural floor (a manifest that stops listing routes is a broken build,
 * whoever downloads it), and verify-live imports it for stem comparison; its
 * brotli ceiling is gone because its subject is now the admin plane's payload,
 * which rule 4 does not grade.
 *
 * ## Identifying the enhancement assets
 *
 * By BYTE EQUALITY against app/enhance/dist/, not by name (a Vite hash may
 * contain a dash) and not by content anchors (the old two-factor match, which
 * existed because the chunk used to be compiled out of the source; a ?url
 * asset is the dist file verbatim, so equality is available and exact). Each
 * bundle must match exactly one asset: zero means the ?url import stopped
 * serving it or the build is stale relative to dist, two means the walk can no
 * longer tell them apart.
 *
 * ## The syntax pass
 *
 * `?url` copies bytes verbatim, so a ?url import pointed at the .ts SOURCE
 * ships raw TypeScript that parses nowhere (measured 2026-07-28). Every .js
 * asset in the build is therefore syntax-checked with `node --check` on a
 * .mjs copy, an instrument independent of the bundler that produced them, and
 * the failure names the file.
 */
```

### scripts/check-page-payload.mjs:73 (WHY, shortened)

why the resolution is a pure module, in one line.

```js
// The per-route resolution, pure and therefore testable, on the footing
// ci-status.mjs and ask-converge.mjs stand on. Grounds in that file.
```

### scripts/check-page-payload.mjs:85 (NUMBER, shortened)

the margin discipline and the missing-module rule; the four dated bundle measurements go to the history document.

```js
/**
 * CEILINGS AND FLOORS. The only copies of these numbers, rule 17.
 *
 * MEASURED 2026-08-27 through this gate's own pipeline on a fresh build of the
 * working tree, after the palette stopped riding on every document: ask 3,010
 * raw / 1,342 brotli; blog 4,514 / 1,477; palette 11,050 / 3,878; theme 1,795 /
 * 671. Theme carries the palette loader now and roughly doubled; palette lost
 * the gesture bindings that moved into it. Margins are the old enhancement-chunk
 * discipline: roughly fifty percent over measured, wide in relative terms
 * because the bundles are tiny and a legitimate feature moves one by whole
 * percents, tight in absolute terms because the job is catching a dependency
 * wandering in. The palette carries ask inlined (a bundle may not import), so
 * a growth in ask moves palette too; that coupling is deliberate and the
 * ceilings absorb it.
 *
 * A module missing from this map fails: a new enhancement arrives with its own
 * measured ceiling in the same commit, or not at all.
 *
 * @type {Record<string, number>}
 */
```

### scripts/check-page-payload.mjs:112 (NUMBER, shortened)

what a low count means; the dated re-measurement goes to the history document.

```js
/**
 * Floor on the manifest walk, the old discipline kept: a walk that reads
 * fewer files than this has lost a route or gone vacuous, not gotten lean.
 * Re-measured 2026-08-26 after the loaders left the hydration set: 12 files.
 */
```

### scripts/check-page-payload.mjs:136 (CONTRACT, shortened)

why stems and why the pattern anchors on the extension; the example spelling and the verify-live rationale go out.

```js
/**
 * A chunk name with its content hash stripped: `entry.client-DvLiibbQ.js`
 * becomes `entry.client`.
 *
 * Exported for verify-live, which compares the DEPLOYED page's script set to
 * the enhancement set. Stems rather than full names, because a standalone
 * verify-live run may face a deploy whose hashes predate the build on this
 * disk, and "same chunks, different hashes" is a stale-hash observation rather
 * than a payload defect. Vite hashes are eight base64url characters, which may
 * themselves contain a dash; the pattern anchors on the extension for that
 * reason.
 *
 * @param {string} name
 */
```

### scripts/check-page-payload.mjs:161 (CONTRACT, shortened)

the fail-closed enumeration, in one line.

```js
/**
 * The React Router browser manifest, parsed, plus its own filename.
 *
 * Fails closed in every direction: no build, no manifest, two manifests, or a
 * manifest that does not parse are all throws, never an empty walk.
 */
```

### scripts/check-page-payload.mjs:193 (CONTRACT, shortened)

the three minified spellings, which is why the regexes look as they do.

```js
/**
 * Static import specifiers of one built chunk, as sibling filenames.
 *
 * Minified output writes `from"./x.js"`, bare `import"./x.js"` and dynamic
 * `import("./x.js")`, any of the three quote characters.
 *
 * @param {string} source
 * @returns {{ static: string[], dynamic: string[] }}
 */
```

### scripts/check-page-payload.mjs:221 (CONTRACT, shortened)

what the set is and why it survives; the tense-bound 'no public page references it any more' made plain.

```js
/**
 * Every JS chunk statically reachable from the client entry, the root module
 * and the blog.$slug route module.
 *
 * This is the set the framework WOULD hand a hydrating page, kept as a
 * structural floor on the manifest and for verify-live's stem comparison. No
 * public page references it any more; the admin plane and /login still do.
 *
 * @returns {{ files: string[], dynamicTargets: Set<string>, manifestFile: string }}
 */
```

### scripts/check-page-payload.mjs:317 (WHY, shortened)

the one-walker discipline in one line; the hoist date goes to the history document.

```js
/**
 * Every source file under one directory, recursively.
 *
 * ONE WALKER, ONE ARGUMENT ORDER, hoisted 2026-09-06 when a second section
 * needed it. Two inline copies of a recursive walk is the shape hard rule 10's
 * helper-signature line names: they agree until one of them gains an extension
 * and the other silently stops reading it.
 *
 * @param {string} dir
 * @returns {string[]} absolute paths
 */
```

### scripts/check-page-payload.mjs:360 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- every bundle is served verbatim, and its ceiling holds ------------ */
```

### scripts/check-page-payload.mjs:398 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- the syntax pass: every served .js asset actually parses ----------- */
```

### scripts/check-page-payload.mjs:403 (WHY, shortened)

why the sweep is not .js-only, in one line; the measurement date goes to the history document.

```js
/*
   * .ts AND .tsx TOO, not only .js, because the plant that motivated this
   * pass produces one: a ?url import pointed at `app/enhance/blog.ts` emits
   * the raw source as `blog-<hash>.ts` (measured 2026-08-26), so a .js-only
   * sweep would grade every healthy asset and skip the defective one. A
   * TypeScript extension under assets/ is also refused outright below, since
   * no browser parses it whatever its content.
   */
```

### scripts/check-page-payload.mjs:439 (WHY, shortened)

why this floor is outside the floors mechanism; the dated 78-against-15 reading goes to the history document.

```js
/*
   * DELIBERATELY NOT an `assertFloor`, and the reason is what the number is.
   *
   * This counts BUILT CHUNKS, not assertions this gate executed. It is a SCOPE
   * floor in hard rule 10's sense: it proves the syntax pass below has something
   * to examine, and it guards a partial build. Measured 2026-09-05 it stands at
   * 78 against a floor of 15, which looks like drift and is not: the chunk count
   * is a property of the bundler's splitting on the day, and pinning it near 78
   * would fail every build that happens to emit fewer.
   *
   * `check:floors` compares executed counts against their floors and would read
   * that gap as drift, so this floor stays out of the mechanism rather than
   * being given a tolerance wide enough to be meaningless. The scope floors are
   * their own sweep.
   */
```

### scripts/check-page-payload.mjs:467 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- hydration is opt-in, and only the admin plane and its door opt in - */
```

### scripts/check-page-payload.mjs:469 (CONTRACT, shortened)

what the set is pinned to and where a public route fails first, in one line.

```js
/*
   * The routes that hydrate are found by reading every route file for a
   * `hydrate: true` handle, comments stripped, and the resulting set is pinned
   * to exactly admin.tsx (which covers its children) and login.tsx. A public
   * route gaining the flag fails HERE, by name, before check:browser ever has
   * to notice the framework riding back onto a reading page.
   */
```

### scripts/check-page-payload.mjs:489 (CONTRACT, shortened)

the window and the strip rule, in one line.

```js
/*
   * And root.tsx only renders the framework's scripts behind that flag. The
   * window is the Layout return, bounded by the two literals; a gate reading
   * source can be satisfied by a comment, so comments are stripped first.
   */
```

### scripts/check-page-payload.mjs:507 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------- no ineffective dynamic import */
```

### scripts/check-page-payload.mjs:509 (WHY, shortened)

the boundary and the enumerated blind spot; the revisions-route account and the scenery argument go to the history document.

```js
/*
   * A DYNAMIC IMPORT THAT SPLITS NOTHING, which is the shape Rolldown prints
   * INEFFECTIVE_DYNAMIC_IMPORT for on every build.
   *
   * `admin.posts.$slug.revisions.tsx` carried one for months. It wrote
   * `await import("~/lib/editor/github.server")` three lines below its own
   * STATIC import of the same module, and five other modules imported it
   * statically too, so the chunk was in the graph however that line was
   * written. The warning was printed on every build and had become scenery,
   * which is the failure this assertion exists to end: the next one is a red
   * gate rather than a line in a wall of build output.
   *
   * OBSERVATION BOUNDARY, and it is the important paragraph here. **This does
   * NOT read the build log.** No gate in this repo runs the build, and a log
   * written by the last build is a claim that ages exactly like the stale build
   * this gate's own header warns about. So it derives the bundler's criterion
   * from SOURCE instead: a dynamic import is ineffective when some module in
   * the same graph also imports that module statically. What it therefore
   * cannot see is anything the resolver below cannot resolve, which is
   * deliberate and enumerated: bare package specifiers (`shiki/wasm`) and
   * virtual modules (`virtual:react-router/server-build`) are skipped, because
   * this scan has no view of node_modules or of the plugin graph.
   *
   * The one dynamic import it does judge is the CodeMirror lazy split, which is
   * hard rule 4's only lazy boundary on the admin plane, so this doubles as the
   * assertion that the split is still a split.
   */
```

### scripts/check-page-payload.mjs:546 (CONTRACT, shortened)

why the finder is pure, in one line.

```js
/**
   * Every ineffective dynamic import in a set of {path, source} records.
   *
   * A pure function over its input, not a reader of the disk, because the
   * self-test below has to be able to run it against synthetic sources. That is
   * the documented cure for a per-item assertion whose real collection can
   * legitimately shrink to nothing (VERIFICATION.md, check:secrets): the checks
   * stay falsifiable no matter what the tree happens to contain.
   */
```

### scripts/check-page-payload.mjs:556 (WHY, shortened)

what the normalisation does not match, in one line; the alias-table argument goes out.

```js
// Resolution is by NORMALISED SPECIFIER rather than by resolved file path.
    // `~/lib/editor/github.server` and a relative spelling of the same module
    // would not match here, and that is stated rather than hidden: this catches
    // the shape that actually occurs, which is one project alias used
    // consistently. A path resolver would need to replicate the vite alias
    // table, which is a second statement of a fact tsconfig already owns.
```

### scripts/check-page-payload.mjs:605 (WHY, shortened)

why the self-test runs every time, in one line.

```js
// SELF-TEST, on every execution. Two synthetic files, one of which MUST be
  // reported and one of which must not, so the finder is proven able to fire
  // even on the day the real tree contains no dynamic import at all.
```

### scripts/check-page-payload.mjs:622 (WHY, shortened)

why the path is repo-relative; the fixed-depth attempt and its plant go to the history document.

```js
// Relative to the repo root, so the failure names a path someone can
      // open. A fixed-depth tail was tried and printed the checkout directory
      // for anything three levels down, which the first plant showed.
```

### scripts/check-page-payload.mjs:653 (WHY, shortened)

why workerd refuses it and why the weak two stay; the arrival date and the ownership argument go to the history document.

```js
/**
 * A NATIVE BUILD-TIME DEPENDENCY MAY NOT REACH THE WORKER, in either bundle.
 *
 * ## The subject, and why it is this gate's
 *
 * `sharp` arrived 2026-09-06 so `build:assets` could derive a body placeholder
 * for every static content image. It is a native libvips binding: Node only,
 * platform specific, tens of megabytes of prebuilt binary. `workerd` has no
 * filesystem and no native modules, so an import that reached the Worker would
 * not be a size problem, it would be a Worker that fails to start.
 *
 * This gate owns it because it is the only one that READS THE BUILD ON DISK and
 * fails closed when there is none. Every other candidate would have had to
 * either skip when the build is absent, which is the vacuous branch
 * `check:contrast` already paid for, or assert on source alone.
 *
 * ## THREE ASSERTIONS, AND THE FIRST TWO ARE NOT THE POINT
 *
 * A source scan says nobody wrote the import today. The manifest says nobody
 * declared it as a runtime dependency. Neither is evidence about what SHIPPED:
 * FAILURES.md's line is that a plant is proven in the artifact the gate reads,
 * and the artifact here is `build/server/index.js`. So the third assertion
 * greps the emitted Worker, which is what a deploy uploads.
 *
 * The scan and the manifest stay because they name the defect at the right
 * altitude when it happens: "you imported sharp in app/lib/x.ts" is a fix, and
 * "the Worker bundle mentions sharp" is a hunt.
 */
```

### scripts/check-page-payload.mjs:698 (WHY, shortened)

the comment-satisfied-anchor trap, in one line.

```js
/*
   * THE SOURCE SCAN. Comments stripped, because a comment that names the module
   * has both satisfied and failed an assertion in this repo before, and the
   * paragraph above this function is itself full of the word.
   */
```

### scripts/check-page-payload.mjs:730 (CONTRACT, shortened)

what the artifact is and why a bare substring, in one line.

```js
/*
   * THE ARTIFACT. `build/server/index.js` is what wrangler uploads.
   *
   * A bare substring, not an import pattern: the bundler rewrites the syntax
   * and a require of a native module can survive as a string, a banner or an
   * external. Anything mentioning it at all is worth failing on, because
   * nothing legitimate in the Worker has cause to.
   */
```

### scripts/check-page-payload.mjs:759 (CONTRACT, shortened)

the subject, where the sets come from and the one thing it does not own; the resolve and refuse tables restate the code below.

```js
/**
 * THE WHOLE PAGE, PER ROUTE. Rule 4's actual subject.
 *
 * The gate above grades the four enhancement bundles, which is the JavaScript.
 * Rule 4 names "everything a reader downloads to see a page", and until
 * 2026-08-27 the stylesheet was not in that number at all: a 45,778-byte sheet
 * rode on every route with no ceiling anywhere, and the font that is the
 * largest single resource on the site had none either.
 *
 * ## WHAT IT RESOLVES, AND FROM WHERE
 *
 * Offline, from the build on disk plus the source, per `lib/page-payload.mjs`:
 *
 *   stylesheets   React Router's browser manifest, root's plus the route's,
 *                 which is the list it emits link tags from
 *   bundles       reachability over the route's import graph for
 *                 `~/enhance/dist/*.js?url` specifiers
 *   fonts         `@font-face` src urls inside the stylesheets above
 *
 * ## WHAT IT REFUSES
 *
 *   a reachable font that is not preloaded, unless exempt with a written reason
 *   a stylesheet set over its per-route ceiling
 *   a route's whole cold load over its ceiling
 *   an enhancement bundle reachable from a route that has no markup for it
 *
 * ## WHAT IT DELIBERATELY DOES NOT OWN
 *
 * The speculation self-reference. `test/header-speculation.test.mjs` asserts
 * that a page is excluded from its own speculation rule, and asserting it here as
 * well would be two owners for one fact, which is rule 17 in the direction that
 * costs most: two copies that can disagree. Named here so a reader looking for
 * it does not conclude it is ungated.
 *
 * It also cannot see a RENDERED page. Reachability over-approximates, which is
 * the safe direction for a ceiling, and the wire half is `check:browser`.
 */
```

### scripts/check-page-payload.mjs:797 (NUMBER, shortened)

why both palettes ship, how a ceiling was set and the expiry contract; the uplift bytes, the six token counts, ruling 103's account and the three self-policing rules the code asserts go to the history document.

```js
/*
 * THE REDESIGN UPLIFT, and it is TEMPORARY BY CONSTRUCTION.
 *
 * MEASURED 2026-09-13 through this gate on a fresh build: the Paper, Glass,
 * Light token layer adds a UNIFORM 1257 brotli bytes to every public route,
 * because it is all in the shared root sheet. Home went css 4655 to 5912 and
 * total 5473 to 6730.
 *
 * ## WHY BOTH PALETTES SHIP AT ONCE, WHICH IS THE WHOLE COST
 *
 * The new roles land under their own names beside the Hill Country ones rather
 * than replacing them, because build 1 is scoped to tokens and the old palette
 * still has its consumers: MEASURED at the same commit, 169 uses of
 * --text-muted, 120 of --border, 57 of --border-strong, 56 of --surface, 37 of
 * --bg and 18 of --surface-popover. Deleting the old block in this build would
 * take every one of those with it, and section 31's "every referenced token is
 * defined" would fail on all of them. So the duplication is real, it is the
 * 1257 bytes, and it ends when builds 2 to 4 migrate the consumers.
 *
 * ## EACH CEILING KEPT THE HEADROOM IT ALREADY HAD
 *
 * New ceiling = new measurement + the route's own previous headroom, rounded up
 * to the nearest 100. The margin is therefore not a new number: it is each
 * route's existing one carried forward, between 329 bytes on /publications and
 * 1163 on /search. Nothing here widens a margin, it only moves the floor the
 * margin sits on.
 *
 * ## IT POLICES ITSELF, on the same terms as section 31's carried-token map
 *
 *   - an entry naming a route this file no longer ceilings FAILS.
 *   - an entry whose current ceiling is no longer above its pre-redesign one
 *     FAILS: the uplift is spent, so the entry is dead and must be removed.
 *   - after UPLIFT_EXPIRES the map must be EMPTY, and THE DATE IS THE WHOLE
 *     CONTRACT. RULING 103, 2026-09-14: this used to read "build 4 is the
 *     point the old palette is gone", and a build number is the wrong
 *     contract. Build 2 was reverted the day Dustin ruled the old header back,
 *     Part B is suspended, and section 31's carried map was left with rows
 *     naming a build whose consumer no longer existed. A deadline that assumes
 *     a schedule which is not running is not a deadline.
 *
 *     So: whatever the header becomes and whichever builds land or do not,
 *     these ceilings come down by UPLIFT_EXPIRES or this gate fails. If that
 *     has not happened by then, the redesign has quietly cost every reader
 *     1.2 KB a page and this is what says so. Moving the date is a ruling, not
 *     a repair.
 *
 * headCss and headTotal are the PRE-REDESIGN measurements, recorded per route
 * so there is something to come back to rather than a number to re-derive. The
 * same date governs section 31's carried-token map, deliberately: the two maps
 * are the same debt seen from two sides, one counting bytes on the wire and
 * one counting tokens nothing paints.
 */
```

### scripts/check-page-payload.mjs:850 (NUMBER, shortened)

what the two figures mean, why fonts are separate and the both-directions rule; the dated measurement and the margin discipline go out.

```js
/**
 * PER-ROUTE CEILINGS, in BROTLI bytes. The only copies, rule 17.
 *
 * MEASURED 2026-08-27 through this gate's own pipeline on a fresh build, after
 * the per-route CSS split. `css` is every stylesheet the route links; `total`
 * adds the enhancement bundles it serves. Fonts are excluded from `total` and
 * asserted separately, because the normal face is shared by every route and
 * counting it into eight totals would say the site is eight fonts heavy.
 *
 * Margins are roughly twenty percent over measured, which is tighter than the
 * per-bundle margins above and deliberately so: a stylesheet grows by a rule at
 * a time rather than by a dependency at a time, so a twenty percent jump is a
 * decision somebody should have to make in this file.
 *
 * A route missing from this map FAILS, in both directions, against the derived
 * public route set below.
 *
 * @type {Record<string, { id: string, css: number, total: number }>}
 */
```

### scripts/check-page-payload.mjs:893 (NUMBER, shortened)

the one-bar argument, stated here because the entries below point at it; the measurement goes out.

```js
/*
   * MEASURED 2026-09-03 through this gate on a fresh build: css 4797 over three
   * sheets, 5615 total. The ceilings are `/blog`'s, which are the same numbers
   * twenty percent over would give and are the right ones on their own terms:
   * this is the same kind of listing, rendering the same cards from the same
   * stylesheets, so the two pages should be graded against one bar rather than
   * drifting apart by whichever happened to be measured later.
   */
```

### scripts/check-page-payload.mjs:902 (NUMBER, shortened)

one line pointing at the argument above.

```js
/*
   * MEASURED 2026-09-04 through this gate on a fresh build: css 4797 over three
   * sheets, 5615 total, which is the tag archive's figure to the byte because
   * it is the same page shape linking the same two stylesheets. The ceilings
   * are the tag archive's for the same reason: one bar for one kind of page,
   * rather than two that drift apart by whichever was measured later.
   */
```

### scripts/check-page-payload.mjs:916 (NUMBER, shortened)

which pages share this bar, in one line.

```js
/*
   * MEASURED 2026-09-11 through this gate on a fresh build: css 4976 over two
   * sheets, 5794 total. That is /privacy and /colophon to the BYTE, which is
   * the whole argument for these ceilings being theirs rather than a fresh
   * margin drawn around this one page: it is the same page shape, app.css
   * plus prose.css, serving the same single enhancement bundle. One bar for
   * one kind of page, rather than three that drift apart by whichever
   * happened to be measured last, which is the reasoning the tag and series
   * archives above are already on.
   */
```

### scripts/check-page-payload.mjs:927 (WHY, shortened)

why the largest corpus is the leanest page; the shared-bar restatement and the record counts go out.

```js
/*
   * MEASURED 2026-09-12 through this gate on a fresh build: css 4666 over two
   * sheets (root plus publications.css), 5484 total, serving the one bundle
   * every page on the site serves.
   *
   * THE CEILINGS ARE `/projects`', WHICH MEASURES 4667 AND 5485. One byte apart
   * on each figure, and not by coincidence: both are app.css plus a single route
   * stylesheet plus theme.js, which is the same page shape and should be graded
   * against the same bar rather than two that drift apart by whichever was
   * measured later. That is the reasoning the tag archive, the series archive
   * and /about are already on.
   *
   * WHAT THIS ROUTE DOES NOT PAY FOR, and the reason it is the leanest page on
   * the site rather than the heaviest: 36 publication records, 33 abstracts and
   * a 75 KB data module reach the client as exactly nothing. Only the loader
   * touches `PUBLICATIONS`, and the public plane does not hydrate, so the
   * corpus is rendered to HTML and never serialised into a payload. The filter
   * chips are links and the search is a GET form, so the interactive half costs
   * no script either. A hydrating version of this page would ship the corpus.
   */
```

### scripts/check-page-payload.mjs:948 (WHY, shortened)

why one sheet serves both pages and what the ceiling does not measure; the measurement and the 144-author figure go out.

```js
/*
   * ONE PAPER'S PAGE. MEASURED 2026-09-12 through this gate on a fresh build:
   * css 4768 over two sheets, 5586 total.
   *
   * IDENTICAL TO THE INDEX, TO THE BYTE, because it is the same two
   * stylesheets: `publications.css` carries both pages and the paper rules were
   * appended to it rather than split into a third sheet. Two sheets for two
   * pages that share a visual language would be two places for one decision,
   * and the split would cost a second request to save nothing.
   *
   * So it takes the index's ceiling, which is `/projects`', which is the bar
   * every "app.css plus one route sheet plus theme.js" page on this site is
   * graded against.
   *
   * WHAT THIS PAGE DOES NOT PAY FOR, and it is the interesting number: the
   * abstract is rendered VISIBLE rather than inside a disclosure, every author
   * is listed rather than collapsed, and the JSON-LD carries the full author
   * array. The 144-author record therefore renders 144 names and 144
   * `citation_author` tags. None of it reaches the ceiling below, because the
   * ceiling measures the SHARED cold load, the stylesheets and bundles a
   * browser caches once, and this page's own HTML is the variable part. That is
   * the right split: a long author list is content, and content is not a
   * payload regression.
   */
```

### scripts/check-page-payload.mjs:975 (NUMBER, shortened)

why the margin is the base route's; the dated measurement goes out.

```js
/**
 * THE MATH VARIANT'S CEILINGS, in BROTLI bytes. The only copies, rule 17.
 *
 * MEASURED 2026-09-06 through this gate on a fresh build: `/blog/:slug` is css
 * 6,493 over four sheets and 9,099 total; the math stylesheet adds 2,819, so a
 * post with an expression in it is css 9,312 and 11,918 total.
 *
 * The margins are `/blog/:slug`'s own, proportionally: 12 percent on css and 10
 * on the total, which is what that route carries and is the right bar because
 * this IS that route, with one more sheet. A wider margin would be room for the
 * stylesheet to grow, and the stylesheet is generated from a pinned package and
 * cannot grow without a version bump somebody chose.
 */
```

### scripts/check-page-payload.mjs:990 (NUMBER, shortened)

why a floor and not an equality, in one line.

```js
/**
 * Floor on the faces the math stylesheet names.
 *
 * MEASURED 2026-09-06 through this gate: 20, which is katex 0.16.47's whole
 * woff2 set. A floor rather than an equality so an upstream face ADDED in a
 * later version does not fail the gate, while the trim in `build-katex.mjs`
 * quietly dropping one does.
 */
```

### scripts/check-page-payload.mjs:1000 (WHY, shortened)

why an unused preload is worse than none; the face's byte size and the ownership pointer go out.

```js
/**
 * Fonts that are reachable and deliberately NOT preloaded, with the reason.
 *
 * The italic face is 79,716 bytes and is needed only by a page that renders
 * italic latin text. Its `unicode-range` already makes the browser fetch it on
 * demand, and a preload that goes unused within a few seconds is worse than
 * none: the browser warns, and the bytes compete with the ones that were
 * needed. That reasoning is root.tsx's; this names the file that owns it rather
 * than repeating the argument where it could drift.
 *
 * @type {Record<string, string>}
 */
```

### scripts/check-page-payload.mjs:1014 (WHY, shortened)

why the one preload goes to Inter; the step citation and the CLS figure go to the history document.

```js
// THE SERIF IS THE LATE FACE AND IS NOT PRELOADED ON PURPOSE. Part A step 3
  // ruled it: Inter sets every line of body, UI and --t-h3, so it owns the
  // page's dominant metrics and gets the one preload; the serif sets a handful
  // of heading lines. A second preload would put 122 KB on the critical path of
  // every route to serve a few lines of heading, competing with the bytes that
  // are needed. Late discovery is the accepted cost and it is paid for by
  // `font-display: swap` plus the metric-override fallback, which app.css
  // records as MEASURED CLS 0.0000 across the swap at 32px and 48px.
```

### scripts/check-page-payload.mjs:1025 (WHY, shortened)

why the palette is false everywhere, in one line.

```js
/**
 * Which routes may serve which enhancement bundle, by the markup it upgrades.
 *
 * The palette is `false` everywhere on purpose: it is fetched by `theme.ts` on
 * the first search gesture from a URL on a data attribute, so no import graph
 * should reach it, and a route that starts reaching it has put a search dialog
 * back on a document.
 */
```

### scripts/check-page-payload.mjs:1061 (CONTRACT, shortened)

the derived rule and why it matches check:browser's, in one line.

```js
/*
   * THE ROUTE SET IS DERIVED, then reconciled against the ceilings in BOTH
   * directions. A route that exports the shared cache headers is a public HTML
   * route, which is the same rule `check:browser` uses to build its
   * byte-identity list, so the two gates cannot disagree about what public
   * means. The feeds and the markdown twin are shared-cached and are not HTML,
   * so they are excluded by the same pattern that file uses.
   */
```

### scripts/check-page-payload.mjs:1098 (WHY, shortened)

why the math key is not a route; the account of the gate catching its own author goes to the history document.

```js
// The math variant is a second grading of /blog/:slug rather than a route
    // of its own, so its ceiling is MATH_CEILING and not a ROUTE_CEILINGS key.
    // This gate found that itself: the entry was written as a plain route and
    // the first assertion below rejected it.
```

### scripts/check-page-payload.mjs:1188 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- a reachable font is preloaded, or exempt with a reason ---------- */
```

### scripts/check-page-payload.mjs:1193 (WHY, shortened)

the prohibition and how the name is read; the two spellings of the failed guess go to the history document.

```js
/*
       * THE BINDING NAME IS DERIVED, NOT GUESSED, and the first version of
       * this guessed. It turned `inter-latin-normal` into `interLatinNormalUrl`
       * and root.tsx calls it `interNormalUrl`, so the assertion failed against
       * a font that IS preloaded. A gate that invents the name it is looking
       * for is testing its own spelling.
       *
       * Read instead: find root's `?url` import whose specifier ends in this
       * font file, take the local name it bound, and require that name inside a
       * preload entry. Both halves come from the file being graded.
       */
```

### scripts/check-page-payload.mjs:1222 (WHY, shortened)

the intended arrangement, in one line.

```js
/*
   * THE PALETTE IS NOT PART OF ANY PAGE'S COLD LOAD, asserted rather than
   * assumed. It is fetched by `theme.ts` on the first search gesture from a URL
   * on a data attribute, so no import graph reaches it. If it ever comes back
   * as a script tag the per-route loop above fails on whichever route regains
   * it; this states the intended arrangement so the failure reads as a
   * regression rather than as a puzzle.
   */
```

### scripts/check-page-payload.mjs:1240 (CONTRACT, shortened)

why the route model cannot see this page and which two assertions are a pair; the other two restate the code below.

```js
/**
 * THE ONE PAGE THIS GATE'S ROUTE MODEL CANNOT SEE.
 *
 * Everything above resolves a route's stylesheets from React Router's manifest,
 * which is PER ROUTE. The math stylesheet is linked PER POST: `/blog/:slug` is
 * one route serving thirteen posts, one of which has math, and root decides at
 * render time from the loader's `hasMath`. So the sheet is in no manifest, the
 * loop above cannot find it, and without this section a 2.8 kB stylesheet and
 * twenty font faces would ride on a page with no ceiling anywhere. That is the
 * exact hole this file's own header describes for the pre-2026-08-27 stylesheet.
 *
 * Four things are asserted, and the first two are a pair:
 *
 *   1. THE SHEET IS NOT IN `/blog/:slug`'s MANIFEST CSS. This is the whole
 *      "posts without math ship no extra bytes" claim, and it is what would
 *      break first: a `import "./styles/katex.generated.css"` anywhere, dropping
 *      the `?url`, puts it back on all thirteen and this fails.
 *   2. THE SHEET IS REACHABLE FROM ROOT. Without this, assertion 1 passes
 *      perfectly on a build where the stylesheet was deleted, and the math page
 *      would render unstyled with a clean gate. The pair is the measurement.
 *   3. THE MATH VARIANT'S BYTES, against a measured ceiling of its own.
 *   4. NO FACE IS INLINED AS A `data:` URI, which is a CSP refusal and not a
 *      preference; grounds at the assertion.
 *
 * @param {any} manifest @param {Set<string>} rootAssets @param {string} rootSource
 * @param {string} clientDir @param {(p: string) => string} assetFile
 */
```

### scripts/check-page-payload.mjs:1270 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 2. the sheet is reachable from root, so 1 is not vacuous ---------- */
```

### scripts/check-page-payload.mjs:1281 (WHY, shortened)

why a set and not a count, in one line.

```js
/*
   * A SET, because the two walks OVERLAP. `blog.$slug.tsx` and `root.tsx` share
   * most of their import graph, so a specifier reachable from both is found
   * twice and the raw count says two where there is one file. The claim is
   * about distinct specifiers.
   */
```

### scripts/check-page-payload.mjs:1299 (WHY, shortened)

why neither the name nor byte equality works, in one line.

```js
/*
   * THE BUILT ASSET IS FOUND BY CONTENT, NOT BY NAME.
   *
   * The name-based version is `katex.generated-*.css`, and this file already
   * records why that is the weak form for the enhancement bundles: a Vite hash
   * may contain a dash. Byte equality against the source is not available
   * either, because Vite compiles the stylesheet on the way through, which is
   * the entire reason it is a `?url` import.
   *
   * So the anchor is a rule only this stylesheet can contain, and the count is
   * asserted: exactly one CSS asset in the build carries `.katex-display`.
   */
```

### scripts/check-page-payload.mjs:1327 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 1. and it is on no route's manifest, which is the mathless cost --- */
```

### scripts/check-page-payload.mjs:1343 (WHY, shortened)

the three source facts, one clause each; the dated check:browser failure goes to the history document.

```js
/*
   * THE LINK IS CONDITIONAL, AND ROOT'S ID LIST IS RECONCILED AGAINST THE ROUTES.
   *
   * Three source facts, none of which any other instrument can see:
   *
   *   The `<link>` is guarded by `linksMath`. Drop the guard and every page on
   *   the site links the sheet, which is assertion 1 above failing from the
   *   other direction and which that assertion CANNOT see: it reads the route
   *   manifest, and a component-rendered link is in no manifest.
   *
   *   The link carries NO `precedence`. That attribute makes React 19 treat the
   *   element as a resource and hoist it to the top of `<head>`, above
   *   `<meta name="color-scheme">`. MEASURED 2026-09-06 on the rendered page,
   *   after check:browser failed by name on "the colour scheme is declared
   *   before the first stylesheet": the meta is load-bearing precisely because
   *   it arrives before the first stylesheet request, and hoisting inverted
   *   that on every math page.
   *
   *   Root names TWO ROUTE IDS, and that is a mirror. It is reconciled here
   *   against the routes that actually return `blogPostView(...)`, in both
   *   directions, so a third route rendering a post cannot render it unstyled
   *   with nothing complaining.
   */
```

### scripts/check-page-payload.mjs:1377 (WHY, shortened)

what the handle buys and why the set is derived, in one line.

```js
/*
   * THE EDITOR ROUTES OPT IN, and the set is derived rather than declared.
   *
   * A route rendering `<PostEditor` shows the exact-preview pane, which copies
   * this document's stylesheets into its iframe. Without the handle an author
   * typing an expression sees it unstyled, on the one surface where this
   * feature is authored. Two routes render the editor today; a third would
   * inherit the defect silently, so the two sets are compared rather than one
   * being trusted.
   */
```

### scripts/check-page-payload.mjs:1407 (WHY, shortened)

why the discriminator is the projection call, in one line.

```js
/*
   * THE ROUTES THAT CAN CARRY MATH ARE DERIVED, then compared with the ids root
   * reads. A route renders a post exactly when its loader returns the shared
   * projection, so `blogPostView(` is the discriminator rather than a name
   * pattern: `/preview/:token` is not called `blog.anything`.
   */
```

### scripts/check-page-payload.mjs:1434 (WHY, shortened)

the string-on-both-sides blind spot; the mentions incident goes to the history document.

```js
/*
   * AND THE FIELD ROOT READS IS THE ONE THE PROJECTION WRITES, asserted because
   * it is a STRING on both sides.
   *
   * `blog-view.ts` puts `hasMath` on the payload and root reads that name off
   * whichever route's data it got. Nothing types the two together: root casts
   * the loader data, so a rename in the projection leaves root reading
   * `undefined`, linking nothing, and rendering every equation unstyled with a
   * green typecheck. That is the same blind spot that let `mentions` go missing
   * from the preview payload for two days (fixed 2026-09-06).
   */
```

### scripts/check-page-payload.mjs:1455 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 3. what a math post actually costs -------------------------------- */
```

### scripts/check-page-payload.mjs:1487 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 4. the faces, and the one that was inlined ------------------------ */
```

### scripts/check-page-payload.mjs:1499 (WHY, shortened)

the CSP refusal and the split failure; the face's size and the inline limit go to the history document.

```js
/*
   * NOT A PREFERENCE. A `data:` font is REFUSED by this site's CSP.
   *
   * MEASURED 2026-09-06 on the first build after the stylesheet landed:
   * `KaTeX_Size3-Regular.woff2` is 3,624 bytes, under Vite's default
   * 4096-byte inline limit, and Vite emitted it as base64 inside the sheet.
   * `font-src` is `'self'` and carries no `data:` source (only `img-src`
   * does), so the browser would have refused that one face while fetching the
   * other nineteen: big delimiters in a fallback serif on some equations and
   * not others, with nothing failing. It also put 4.8 kB of base64 into a file
   * every math page downloads, for a face most posts never use.
   *
   * `vite.config.ts` refuses to inline any `.woff2`. This is the assertion that
   * says so, because a config edit is invisible until something reads the build.
   */
```

### scripts/check-page-payload.mjs:1523 (WHY, shortened)

why this is the deliberate opposite of the loop's rule; the kilobyte figures go to the history document.

```js
/*
   * AND THEY ARE DELIBERATELY NOT PRELOADED, which is the opposite of the rule
   * the per-route loop applies and needs its reason stated here rather than
   * being an omission.
   *
   * The loop above demands a preload for a reachable font because the site's
   * own face is used by every page, so a late discovery costs every reader. A
   * KaTeX face is used by an EXPRESSION: `KaTeX_Fraktur` is fetched only by a
   * post containing `\mathfrak`, and a page with one inline fraction touches
   * three of the twenty. Preloading the set would be 260 kB of speculative
   * fetches on a page that needs 30 kB of it, and the browser warns about every
   * preload it does not use within a few seconds.
   */
```

## scripts/check-publications.mjs

### scripts/check-publications.mjs:1 (CONTRACT, shortened)

the boundary, the placement rule and the pairing rule, one clause each; the July build, the pipeline-only list and the topic-id incident go to the history document.

```js
/**
 * Gate: the publication corpus is internally consistent and its artifact is fresh.
 *
 *   npm run check:publications
 *
 * ## WHERE THESE ASSERTIONS COME FROM
 *
 * The July build carried 22 of them, and they ran in `pubs-pipeline/verify.py`
 * OUTSIDE this repository. That placement was the defect: a gate that lives
 * beside the network pipeline runs when somebody refreshes the data and never
 * runs on a clone, so the repo shipped a corpus nothing in the repo checked.
 * Hard rule 18's shape, applied to a check rather than to an index. They are
 * here now, reading the committed files, so `npm run check` sees them.
 *
 * The ones that stayed in the pipeline are the ones that need the NETWORK or
 * the PDFs' internals: abstract fidelity against the registry response, DOI
 * extraction provenance, the CSL-against-Crossref comparison. Those cannot be
 * asserted from a clone and are not pretended at here.
 *
 * ## OBSERVATION BOUNDARY
 *
 * Pure. Two committed JSON files, one generated TypeScript module, and `stat`
 * on the PDFs. No network, no database, no build. It CANNOT see whether the
 * registry data is still true, which is `pubs-pipeline/refresh.py`'s job and is
 * a human-initiated refresh rather than a gate, because a gate that fetches
 * Crossref goes red on Crossref's bad day rather than on ours.
 *
 * ## THE PAIRED COUNT, and why it is not decoration
 *
 * Two assertions here are of the form "no record has property X". Both are
 * paired with a count of what was READ, because "0 violations" from a scan that
 * examined nothing looks exactly like a clean sweep. That is the specific trap
 * archive/publications.md records the July build falling into: an early
 * topic-id assertion matched at the wrong indent, swept in all 36 ids, and
 * would have passed with an undeclared topic in the file.
 */
```

### scripts/check-publications.mjs:79 (CONTRACT, shortened)

the argument order and the one reason for the name; section 17's mechanism and this file's own failed spelling go to the history document.

```js
/**
 * `assertThat(ok, label, detail)`, the condition FIRST.
 *
 * ## THE PARAMETER IS NAMED `ok` BECAUSE FIVE OTHER GATES NAME IT `ok`
 *
 * Three reporter shapes coexist across the gates on purpose, so a call copied
 * from one gate into another is a ReferenceError rather than a silent pass with
 * the label sitting in the condition slot, truthy, incrementing the count:
 * `assert(label, ok)` in check-urls, `ok(label, condition)` in check-search,
 * and `assertThat(ok, label)` here and in five others.
 *
 * This was written as `assertThat(condition, ...)`, which is the SAME ORDER and
 * still failed `check:invariants` section 17, correctly. That gate compares the
 * first parameter's NAME across every definition of a given helper name,
 * because a name is all a static scan can compare: it cannot know that
 * `condition` and `ok` mean the same thing, and the day they do not mean the
 * same thing is the day the gate has to be able to say so. Two spellings of one
 * helper is the drift it refuses, whether or not this instance was harmless.
 *
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
```

### scripts/check-publications.mjs:117 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------- the sources exist at all */
```

### scripts/check-publications.mjs:123 (WHY, shortened)

the fail-closed scope rule with its citation, in one line.

```js
/*
 * SCOPE FIRST, and it fails CLOSED. Everything below iterates these two files,
 * and every "no record does X" assertion over an empty array passes. Proving
 * the scope is non-empty before reading anything out of it is hard rule 10's
 * first discipline and is the difference between a clean sweep and a sweep that
 * examined nothing.
 */
```

### scripts/check-publications.mjs:155 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- the artifact is fresh */
```

### scripts/check-publications.mjs:157 (WHY, shortened)

why it is first, in one line.

```js
/*
 * The whole of the old `--check` mode, kept as one assertion because that is
 * what it is: a byte comparison between the committed module and a fresh
 * generation. It is listed FIRST among the content assertions because every
 * other one below reads the SOURCES, and this is the only one that can catch a
 * hand-edit of the generated file.
 */
```

### scripts/check-publications.mjs:190 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ identity */
```

### scripts/check-publications.mjs:231 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------------------- the PDF set */
```

### scripts/check-publications.mjs:233 (WHY, shortened)

the symptom, in one line.

```js
/*
 * Every hosted path resolves to a real file. This is the assertion that would
 * have caught a rename or a `git rm` of a PDF the data file still advertises,
 * which is a 404 on a link the page renders as though it worked.
 */
```

### scripts/check-publications.mjs:265 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------- the extracted text, and its bytes */
```

### scripts/check-publications.mjs:267 (WHY, shortened)

the one way it goes stale, in one line; what it makes gateable and the extraction cost go to the history document.

```js
/*
 * THE TEXT ARTIFACT IS BOUND TO THE PDF IT CAME FROM BY HASH.
 *
 * `data/publications.text.json` is committed rather than built, because
 * extracting it parses 27 MB of PDF (the grounds are on
 * scripts/extract-publication-text.mjs). A committed derivative of a committed
 * binary can go stale in exactly one way: the binary is replaced and nothing
 * re-runs the extractor. So the assertion is not "the file exists" but "the
 * bytes it claims to describe are the bytes on disk", which is the only form
 * that can see that happen.
 *
 * This is also what makes the markdown twins gateable at all. The twin carries
 * this text, `check:publications` regenerates the twins and compares them byte
 * for byte, and that comparison is only worth anything if the text underneath
 * it is known to belong to the PDF the page links to.
 */
```

### scripts/check-publications.mjs:302 (WHY, shortened)

both directions, one clause each.

```js
/* One entry per hosted record, and no entry for anything else. Both directions:
 * a hosted PDF with no text is a twin that silently loses its full text, and an
 * entry for a record that is no longer hosted is text this site no longer
 * serves the source of. */
```

### scripts/check-publications.mjs:321 (WHY, shortened)

why bytes and not size, in one line.

```js
/*
 * THE HASH COMPARISON, which is the one that can actually go red.
 *
 * Read as BYTES and hashed, never compared by size or mtime: a re-exported PDF
 * of the same length is the case that would slip through, and it is the likely
 * one, because these files are replaced by re-running the pipeline rather than
 * by hand.
 */
```

### scripts/check-publications.mjs:346 (WHY, shortened)

what it catches, in one line.

```js
/*
 * The entry is INTERNALLY consistent: the page count matches the array it
 * carries and the char count matches the text. Cheap, and it is what catches a
 * hand-edit of this file, which is the other way a derived artifact goes wrong.
 */
```

### scripts/check-publications.mjs:364 (NUMBER, shortened)

why the threshold is low; the measured smallest extraction goes to the history document.

```js
/*
 * NO SILENTLY EMPTY EXTRACTION. A scanned PDF with no text layer extracts to
 * nothing, the twin would carry a heading with no body under it, and every
 * assertion above would still pass. The threshold is deliberately low: it is
 * looking for a failed extraction, not judging length. Measured across this
 * corpus the smallest real one is 7,976 characters.
 */
```

### scripts/check-publications.mjs:383 (WHY, shortened)

what the field is for, in one line.

```js
/*
 * A self-hosted record must carry a path and an external one must not. The
 * `access` field exists so a record can be switched between the two without a
 * schema change, and this is what stops it being switched halfway.
 */
```

### scripts/check-publications.mjs:401 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------- external ids */
```

### scripts/check-publications.mjs:403 (NUMBER, shortened)

which form and that it is a ruling; the oa.fcgi tally goes to the history document.

```js
/*
 * `pmcUrl` in LANDING-PAGE form. Measured in July against `oa.fcgi`, which of
 * 26 PMCIDs returned 20 ftp tarballs, 2 direct PDFs and 4 not-open-access
 * errors, while the landing page answers 200 for all 26 including the four it
 * refused. The form is the ruling; this is what holds it.
 */
```

### scripts/check-publications.mjs:432 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ abstracts */
```

### scripts/check-publications.mjs:434 (WHY, shortened)

where the character lands and why the count is beside it; the decode history goes out.

```js
/*
 * NO STORED ABSTRACT CONTAINS `<`, PAIRED WITH THE COUNT THAT READ THEM.
 *
 * The pairing is the assertion. Abstracts arrive as HTML from Europe PMC and as
 * JATS from Crossref, are entity-decoded twice because some are double-encoded,
 * and land in a `<script type="application/ld+json">` block and in a JSON
 * export. An unescaped `<` is the character that ends a script element early.
 *
 * A sweep that found no `<` because it read no abstracts reports exactly what a
 * clean corpus reports, so the count is asserted beside it rather than trusted.
 */
```

### scripts/check-publications.mjs:458 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------------------------- topics */
```

### scripts/check-publications.mjs:460 (WHY, shortened)

why the TOPICS block, in one line; the incident's tally goes to the history document.

```js
/*
 * Every topic a record claims is declared. Parsed out of the GENERATED module's
 * TOPICS block rather than out of the record list, because the July version of
 * this assertion matched at four-space indent, swept in all 36 publication ids
 * as though they were topic ids, and would have passed with an undeclared topic
 * in the file.
 */
```

### scripts/check-publications.mjs:497 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ----------------------------------------------------- slugs, pages and PDFs */
```

### scripts/check-publications.mjs:499 (WHY, shortened)

what a collision costs, in one line; the worked example goes out.

```js
/*
 * THE SLUG IS LOSSY AND THIS IS WHERE THAT IS MADE SAFE.
 *
 * `doiSlug` collapses every run of non-alphanumerics to one hyphen, so
 * `10.1234/ab-cd` and `10.1234/ab.cd` produce the same slug. No such pair is in
 * this corpus. A collision would mean two papers sharing a URL, one of them
 * unreachable, and the unreachable one would still be in the sitemap.
 */
```

### scripts/check-publications.mjs:525 (WHY, shortened)

why the path is a literal and the quiet symptom; the media-library reasoning goes to the history document.

```js
/*
 * THE PDF SITS WHERE THE PAGE CLAIMS IT DOES, AND `paperPdfPath` IS THE OWNER.
 *
 * `pdfPath` stays a LITERAL in the data file rather than being derived at
 * render time, for one measured reason: `build:template-refs` matches asset
 * references as literal strings in source, and a path built from a template
 * would make all 31 PDFs read as unreferenced next to a delete button in the
 * media library. So the literal is kept for the scanner and this assertion
 * binds it to the one function that owns the rule.
 *
 * Without this, the two could drift and the symptom would be the quiet one:
 * `citation_pdf_url` pointing into a directory that is not the page's, which
 * Scholar declines silently and which takes six to nine months to correct.
 */
```

### scripts/check-publications.mjs:548 (WHY, shortened)

the property against the mechanism, in one line.

```js
/*
 * EVERY PDF IS INSIDE ITS OWN PAPER'S DIRECTORY. Stated separately from the
 * equality above because it is the PROPERTY Scholar cares about, and the
 * equality is only the mechanism that currently delivers it. If
 * `paperPdfPath` were ever changed to put files somewhere else, the assertion
 * above would still pass and this one would not.
 */
```

### scripts/check-publications.mjs:567 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- the redirect map */
```

### scripts/check-publications.mjs:569 (WHY, shortened)

what a one-way check passes on, in one line.

```js
/*
 * BOTH DIRECTIONS. Every moved PDF has a redirect from its old URL, and every
 * redirect names a PDF that exists. A one-way check would pass on a map that
 * had grown an entry pointing at nothing, which is a 301 into a 404.
 */
```

### scripts/check-publications.mjs:611 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ rights */
```

### scripts/check-publications.mjs:613 (WHY, shortened)

what the list means and the three states, which nothing else records; the ruling's date, the review it overrode and the per-record tally go to the history document.

```js
/*
 * WHICH PDFs MAY BE HOSTED, AND WHY THIS IS AN ALLOWLIST RATHER THAN A RULE.
 *
 * Ruling 63 and Grok's review said: host and tag only papers whose licence
 * permits redistribution, and link the rest. Dustin ruled otherwise on
 * 2026-09-12, after being shown which four were closed and which registries
 * said so: ALL 31 STAY UP. That is his call on his own work and this gate does
 * not relitigate it.
 *
 * What a gate can still do is make sure the decision stays DELIBERATE. So the
 * records hosted WITHOUT a redistribution licence are named here, individually,
 * with the licence state measured at the time of the ruling. A new hosted PDF
 * that has no licence and is not on this list is a NEW instance of a decision
 * somebody made once, and it reds naming the DOI.
 *
 * The list is therefore not "these are fine". It is "these were looked at".
 *
 * ## THE THREE STATES, WHICH IS WHY `licenseSource` EXISTS
 *
 *   a licence          the record carries redistribution terms
 *   crossref:tdm-only  terms WERE deposited and they are text-mining terms,
 *                      which licence redistribution to nobody
 *   null               neither registry recorded any terms
 *
 * Collapsing the middle into the last would hide that those five were checked
 * and found wanting, which is exactly the distinction a future reader needs.
 */
```

### scripts/check-publications.mjs:641 (WHY, shortened)

what bronze means, in one line; the per-paper tally goes out.

```js
// Open access per Unpaywall, no licence recorded. Four ASM papers: one green,
  // three bronze. Bronze means free to read on the publisher's site with no
  // licence at all, which is a decision the publisher can reverse.
```

### scripts/check-publications.mjs:648 (WHY, shortened)

what this group is; the ruling number goes to the history document.

```js
// Not open access at all. These are the four ruling 63 asked to stop hosting.
```

### scripts/check-publications.mjs:697 (WHY, shortened)

what a stale exemption costs, in one line.

```js
/*
   * THE OTHER DIRECTION. A DOI on the list that is no longer hosted without a
   * licence means either the file went away or the registry now records terms,
   * and both make the entry a stale note about a decision nobody is taking any
   * more. Stale exemptions are how an allowlist stops meaning anything.
   */
```

### scripts/check-publications.mjs:715 (WHY, shortened)

what a null source would mean, in one line.

```js
/*
   * `licenseSource` IS RECORDED FOR EVERY HOSTED RECORD, including the ones with
   * no licence. A null source on an unlicensed record would mean nobody has
   * looked, and that is the state this whole block exists to make impossible.
   */
```

### scripts/check-publications.mjs:732 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------- the Highwire tag set */
```

### scripts/check-publications.mjs:734 (CONTRACT, shortened)

why not the render, that both halves are needed, and why the builder throws; check:browser's boundary and Scholar's quoted minimum go to the history document.

```js
/*
 * THE CITATION TAGS, PER RECORD, THROUGH THE BUILDER THE ROUTE CALLS.
 *
 * ## WHY NOT AGAINST RENDERED MARKUP
 *
 * The obvious check is to render the page and read its `<head>`. It cannot be
 * done offline here: `scripts/lib/route-render.mjs` renders a route's COMPONENT
 * through `createRoutesStub`, and React Router's `meta()` output is assembled by
 * `<Meta />` in the root layout, which that stub does not mount. So a render
 * would return a page with no meta tags at all and an assertion over it would
 * pass by finding nothing, which is the vacuity this repo gates against
 * everywhere else.
 *
 * So this is a two-part check and both parts are needed. The BUILDER is
 * exercised over every record, and the ROUTE is asserted to call it, comments
 * stripped. Either half alone is a gate that can be satisfied while the page is
 * wrong: a correct builder nobody calls, or a call to a builder that emits
 * nothing.
 *
 * The wire itself belongs to `check:browser`, which drives a real preview and
 * is on the network tier. That is the one place the actual head can be read,
 * and it is named here so the boundary is recorded rather than implied.
 *
 * ## THE THREE THAT ARE HARD FAILURES
 *
 * Google Scholar's guidelines name the minimum: the title, the full name of at
 * least the first author, and the year. A page missing any of them is not
 * indexed badly, it is not indexed. `buildCitationTags` THROWS rather than
 * emitting a partial set, so this block catches the throw and reports it as the
 * record's failure rather than taking the gate down.
 */
```

### scripts/check-publications.mjs:793 (WHY, shortened)

what the mistake produces, in one line.

```js
/*
     * ONE TAG PER AUTHOR, not one joined string. The commonest way to get this
     * wrong produces a single author whose name is the whole list, and this
     * corpus makes that vivid: one record has 100 names and another 144.
     */
```

### scripts/check-publications.mjs:808 (CONTRACT, shortened)

Scholar's rule and why it is on the tag, in one line.

```js
/*
       * SAME SUBDIRECTORY AS THE ABSTRACT PAGE. Scholar: "For security reasons,
       * it must refer to a file in the same subdirectory as the HTML abstract."
       * Asserted on the tag rather than on the path helper, because this is the
       * string that ships.
       */
```

### scripts/check-publications.mjs:837 (WHY, shortened)

why comments are stripped, in one line.

```js
/*
   * AND THE ROUTE ACTUALLY CALLS IT. Comments stripped first, because this file
   * and the route both discuss the builder in prose and a raw match would read
   * the explanation as the code.
   */
```

### scripts/check-publications.mjs:862 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------ the plain-language line */
```

### scripts/check-publications.mjs:864 (WHY, shortened)

what a gate can say here and why the count carries it; the tense-bound 'today every record is null' goes out.

```js
/*
 * `summary` is hand-written and is null on every record until somebody writes
 * one. These assertions are about SHAPE, and they are deliberately the only
 * thing gated here: a gate can check that a sentence is one sentence and short
 * enough, and it cannot check that it is any good or that it is true of the
 * paper. Saying so is the point, because a green gate on this field must not
 * read as "the summaries are fine".
 *
 * THE PAIRED COUNT MATTERS MORE THAN USUAL HERE. Today every record is null, so
 * every "no summary does X" assertion below passes over an empty set. That is
 * the vacuity case in its purest form, so the count of non-null summaries is
 * reported rather than assumed, and it will read 0 until the field is filled.
 */
```

### scripts/check-publications.mjs:894 (WHY, shortened)

the rule and that it is deliberately loose, in one line.

```js
/*
   * ONE SENTENCE. Counted as terminal punctuation followed by a space and a
   * capital, which is what a second sentence looks like; a trailing full stop
   * is not a second sentence and "p < 0.05. The" is. Deliberately loose: this
   * is a nudge toward the format, not a grammar checker.
   */
```

### scripts/check-publications.mjs:907 (WHY, shortened)

why the hook cannot reach these, in one line.

```js
/*
   * THE HOUSE DASH RULE, which the PreToolUse hook cannot reach here: these
   * strings live in a JSON data file that a person edits, and the hook guards
   * writes made through the agent's tools. Written as escapes so this file
   * stays clean and greppable, per the portfolio rule.
   */
```

### scripts/check-publications.mjs:929 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---------------------------------------------------------------- cited by */
```

### scripts/check-publications.mjs:931 (WHY, shortened)

what a dated artifact can be checked for, in one line.

```js
/*
 * THE CITED-BY ARTIFACT IS DATED EVIDENCE, and these assertions are about the
 * ways a dated artifact goes wrong rather than about the numbers in it. The
 * numbers are OpenAlex's and this gate has no way to check them; what it can
 * check is that the file describes THIS corpus, that it is not silently
 * truncated, and that it says when it was read.
 */
```

### scripts/check-publications.mjs:978 (WHY, shortened)

what each half catches; the 52-against-50 record goes to the history document.

```js
/*
     * THE CAP IS RESPECTED AND THE TRUE TOTAL SURVIVES IT. One record has 52
     * citing works against a cap of 50, and the page says "50 of 52" only
     * because both numbers are in the file. A list longer than the cap would
     * mean the fetcher stopped honouring it; a `total` below the list length
     * would mean the two came from different reads.
     */
```

### scripts/check-publications.mjs:1010 (WHY, shortened)

what would render, in one line.

```js
/*
     * A DOI HERE IS A BARE NAME, NOT A URL. OpenAlex returns
     * `https://doi.org/10.x/y` and the fetcher strips the prefix, because the
     * page builds its own link. A URL that slipped through would render as
     * `https://doi.org/https://doi.org/...`.
     */
```

### scripts/check-publications.mjs:1027 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ exports */
```

### scripts/check-publications.mjs:1029 (CONTRACT, shortened)

the two properties, one clause each.

```js
/*
 * THE EXPORTS ARE BYTE-GATED, which means two things and both are asserted.
 *
 * DETERMINISTIC: generated twice in one process, compared. An export that
 * differed between two downloads of an unchanged corpus would be a citation
 * file that looks modified when nothing about the work changed, and it would
 * defeat every byte comparison downstream. The commonest cause is a generation
 * timestamp, which is why the header deliberately carries none.
 *
 * COMPLETE: every record the export claims to carry is in it. A format writer
 * that silently dropped a record would produce a file that parses, imports, and
 * is missing a paper, which nobody notices until a bibliography is short.
 */
```

### scripts/check-publications.mjs:1042 (WHY, shortened)

the prohibition and its because, in one line.

```js
/*
 * Read as DATA, by importing the generated module, not by parsing its source
 * text for `type: "..."` lines. That was the first draft and it is the
 * four-space-indent trap archive/publications.md records twice: a line matcher
 * anchored on indentation matches whatever else happens to sit at that indent,
 * and it goes wrong silently by counting too much.
 */
```

### scripts/check-publications.mjs:1057 (WHY, shortened)

why it is stated twice and what keeps them equal, in one line.

```js
/*
 * THE SHOWCASE SET IS STATED TWICE AND THIS IS WHAT KEEPS THEM EQUAL.
 *
 * `publications.tsx` declares it for the page and `export-response.mjs`
 * declares it for the exports, because importing a route module into an export
 * route would drag React and a loader along with it. Two statements of one
 * decision is exactly the drift this repo gates elsewhere, so it is gated here:
 * the route's literal is parsed out of its source and compared against the
 * imported set.
 */
```

### scripts/check-publications.mjs:1127 (WHY, shortened)

what a reader would see, in one line.

```js
/*
   * NO CHARACTER REFERENCE SURVIVES. The stored corpus keeps them escaped on
   * purpose; an export is read by a reference manager, which would show a
   * reader `p &lt; 0.05`. Paired with the count above so the sweep cannot pass
   * by reading an empty file.
   */
```

### scripts/check-publications.mjs:1140 (WHY, shortened)

why it matters here, in one line.

```js
/*
   * BRACE PROTECTION, asserted where it MATTERS rather than in general. Many
   * BibTeX styles lowercase a title, and a lowercased genus is wrong under the
   * nomenclature codes rather than merely ugly.
   */
```

### scripts/check-publications.mjs:1151 (WHY, shortened)

the prohibition and its because, in one line; the five-record tally goes out.

```js
/*
   * ASKED THROUGH `organismsIn`, which is the matcher the code uses, NOT
   * through `ORGANISMS.some((o) => title.includes(o))`.
   *
   * The substring form was the first draft and it failed five records whose
   * output was correct: a title carrying "Mycobacterium smegmatis" also
   * contains "Mycobacterium", so it demanded a brace the longest-first matcher
   * rightly never emits. A gate that asks a different question from the one the
   * code answers reports a defect that is its own.
   */
```

### scripts/check-publications.mjs:1171 (NUMBER, shortened)

what a lowercasing export breaks; the count of mixed-case DOIs goes to the history document.

```js
/* DOIs AS DEPOSITED. Six of the 36 are mixed case; a lowercasing export would
     disagree with the registry it came from. */
```

### scripts/check-publications.mjs:1183 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------------------------- preprint */
```

### scripts/check-publications.mjs:1185 (WHY, shortened)

why a count and why it is not merged; the July record goes to the history document.

```js
/*
 * Exactly one record carries a preprint, and it is the one recorded in July.
 * A COUNT rather than a name, so a second preprint arriving is a decision
 * somebody makes in this file: the bioRxiv record is deliberately NOT merged
 * into the published record, so that every displayed citation figure matches
 * the OpenAlex page a reader would land on, and a second one arriving silently
 * would be a second place that ruling has to hold.
 */
```

### scripts/check-publications.mjs:1200 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- the markdown twins */
```

### scripts/check-publications.mjs:1202 (WHY, shortened)

why build product needs this most and why nothing is written first.

```js
/*
 * THE TWINS ON DISK ARE THE TWINS THIS CORPUS PRODUCES, BYTE FOR BYTE.
 *
 * They are gitignored build product served as static assets, which is the
 * combination that needs this comparison most: nothing imports them, so a build
 * that never ran breaks no build and fails no type check, and the deploy would
 * simply upload a site whose llms.txt advertises 36 URLs that answer 404. The
 * comparison is what turns that into a red gate.
 *
 * GENERATED IN THIS PROCESS AND COMPARED, never regenerated onto disk first.
 * `generateTwins()` returns the bytes and writes nothing; the writing lives
 * behind `build-publication-twins.mjs`'s direct-run guard, for the reason
 * `build-publications.mjs` carries in full: a gate that repairs its subject
 * before reading it cannot fail.
 */
```

### scripts/check-publications.mjs:1249 (WHY, shortened)

what the prune failing leaves, in one line.

```js
/*
 * NO TWIN THIS CORPUS DOES NOT PRODUCE. The build prunes, so this asserts the
 * prune ran: a DOI corrected leaves a file behind that nothing overwrites,
 * nothing compares, and the next deploy uploads. Directly under the directory
 * only, never recursive; the per-paper subdirectories hold the PDFs.
 */
```

### scripts/check-publications.mjs:1265 (WHY, shortened)

why both directions and why not a count; the URL count goes to the history document.

```js
/*
 * EVERY TWIN IS ADVERTISED, AND EVERYTHING ADVERTISED EXISTS.
 *
 * `content/llms.txt` lists the twins by URL, which is the only reason an agent
 * that reads that file knows they are there. A hand-maintained list of 36 URLs
 * beside a generated set of 36 files is exactly the mirror this repo refuses
 * everywhere else, so it is reconciled in BOTH directions, the way
 * `check:features` reconciles content/enhancements.json: a twin absent from
 * llms.txt is a file nothing points at, and a line in llms.txt with no file
 * behind it is this site telling an agent to fetch a 404.
 *
 * Matched on the URL, not on a count. A count would pass on a list of the right
 * length naming the wrong papers, which is what a corrected DOI produces.
 */
```

### scripts/check-publications.mjs:1304 (WHY, shortened)

what a lost twin still does, in one line.

```js
/*
 * THE FULL TEXT REACHES THE TWIN, which is the assertion the whole extracted
 * artifact exists for. Every hosted paper's twin carries the section and a
 * substantial body under it; a twin that quietly lost its text would still
 * generate, still match on disk, and still be advertised.
 *
 * Compared against the artifact's own character count rather than a fixed
 * threshold: the claim is that this paper's text is in this paper's twin, not
 * that the twin is long.
 */
```

### scripts/check-publications.mjs:1333 (WHY, shortened)

which boundary and why the needle is anchored, in one line.

```js
/*
 * NO TWIN CARRIES A CHARACTER REFERENCE. The stored corpus keeps `&lt;` on
 * purpose (the abstract invariant above), and every boundary where text becomes
 * something a reader reads decodes it. The twin is one of those boundaries and
 * this is what says so: a twin handing an agent `p &lt; 0.05` is handing it the
 * markup instead of the sentence.
 *
 * The needle is the ampersand form, anchored to the named references this
 * corpus actually carries, rather than a bare `&`: URLs in the frontmatter
 * carry query strings and a bare ampersand would match those.
 */
```

### scripts/check-publications.mjs:1353 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------- search, the MCP and Ask, all three */
```

### scripts/check-publications.mjs:1355 (WHY, shortened)

what each half alone would assert, in one line.

```js
/*
 * ONE SEARCH RECORD PER PAPER, IN THE ARTIFACT THAT BECOMES `search_docs`.
 *
 * The records are built here from the same two modules the build uses, and then
 * compared against `content/generated/posts.json`, which is what `sync:content`
 * materialises into D1. Building them without reading the artifact would assert
 * that the builders work; reading the artifact without building them would
 * assert that a file has 36 lines in it. The pair is what says the papers this
 * corpus carries are the papers the site's own search will serve.
 */
```

### scripts/check-publications.mjs:1419 (WHY, shortened)

why full text is out of the index and why no threshold; the index size goes to the history document.

```js
/*
 * NO PAPER RECORD CARRIES THE EXTRACTED TEXT, which is the other half of ruling
 * 63's split and the half that would rot quietly.
 *
 * Classic search shows the line it matched. 1.13 MB of machine-read two-column
 * text in the FTS index would match on running heads and reference lists and
 * would snippet the mangled line the term fell on. The full text belongs to the
 * twins, which Ask and the MCP read. Asserted by SIZE against the artifact's own
 * measurement rather than by looking for a marker: a body carrying a paper's
 * extracted text is necessarily longer than its abstract, and no threshold has
 * to be invented for that comparison.
 */
```

### scripts/check-publications.mjs:1446 (WHY, shortened)

why over the real corpus, in one line.

```js
/*
 * THE ASK KEY ROUND-TRIPS, for every paper, through the module both the upload
 * path and the citation renderer use.
 *
 * `keyForUrl` turns the page URL into the twin's own path, and `urlForKey`
 * turns it back into the page. The asymmetry is deliberate and is exactly why
 * it is asserted here over the real corpus: a key that did not round-trip would
 * upload fine and cite a URL that 404s, which is a failure only a reader who
 * clicked a citation would ever see.
 */
```

### scripts/check-publications.mjs:1472 (WHY, shortened)

which spelling the uploader uses, in one line.

```js
/*
   * AND THE KEY IS THE TWIN'S ACTUAL PATH. The assertion above compares against
   * a literal spelling of the key; this one compares against `paperMarkdownPath`,
   * which is what the build writes and what llms.txt advertises. Two spellings
   * of one path is the drift, and the uploader fetches through the second one.
   */
```

### scripts/check-publications.mjs:1488 (WHY, shortened)

what the two halves own, in one line.

```js
/*
 * THE ASK LINK: the URL builder is exercised over the whole corpus, and the
 * route is asserted to call it.
 *
 * Same two-part shape as the Highwire tag set above, and for a related reason:
 * this is a value the route interpolates, so the only ways to check it are to
 * render the route or to read its source. What is checked here is that the one
 * owner produces a usable URL for every record, and that the page has not grown
 * a second hand-built copy of it.
 */
```

### scripts/check-publications.mjs:1509 (WHY, shortened)

the property and why it is decoded; the failed first URL goes to the history document.

```js
/*
   * THE QUERY IS THE QUOTED TITLE AND NOTHING ELSE, which is the property that
   * makes the scriptless half of the link work at all.
   *
   * MEASURED against the local index before this assertion existed: the classic
   * index ANDs its terms, so the first version of this URL, `What does "<title>"
   * find?`, returned ZERO results, because "what", "does" and "find" appear in
   * no record. A reader with scripting off followed the link to an empty page.
   *
   * Asserted by DECODING the query back and comparing it to the title, rather
   * than by matching a shape: a shape test would pass on any quoted string, and
   * the failure to catch is a word creeping back in beside the phrase.
   */
```

### scripts/check-publications.mjs:1536 (WHY, shortened)

what a quote would do; the measured 'none of the 36' goes to the history document.

```js
/*
   * NO TITLE CARRIES A QUOTATION MARK, which is what lets the question quote
   * the title at all. `query.mjs` reads a quoted run as an exact phrase, so a
   * title containing its own quote would split the phrase in two and the
   * classic half of that link would search for something else. Measured today:
   * none of the 36. This is the assertion that says so tomorrow.
   */
```

### scripts/check-publications.mjs:1552 (WHY, shortened)

why stripped and the stripper's limit, in one line.

```js
/*
   * COMMENTS STRIPPED BEFORE MATCHING. The route's own comment beside the link
   * names `paperAskUrl`, and check:policy records the day a gate went green on
   * prose that explained what the code used to do. Whole-line and block
   * comments only, which is the limit `check:policy` states for the same
   * stripper: a trailing comment could still satisfy this.
   */
```

### scripts/check-publications.mjs:1575 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------ retractions, corrections, versions */
```

### scripts/check-publications.mjs:1577 (WHY, shortened)

why the count is in the label and what the other half is; the sweep's tally goes to the history document.

```js
/*
 * THE DARK PATH IS ASSERTED DARK, WITH THE COUNT BESIDE IT.
 *
 * No record carries a retraction or correction, and that is a measurement
 * rather than an assumption: the same sweep found no `updated-by` and no
 * `relation` on any of the 34 Crossref DOIs. A bare "none of them" from a scan
 * that read nothing looks exactly like this, which is why the count of records
 * READ is printed in the label. The other half of the proof is
 * `test/publication-update-notice.test.mjs`, which drives the render path with
 * a real retracted DOI, because a path with no data behind it is a path nothing
 * exercises.
 */
```

### scripts/check-publications.mjs:1599 (WHY, shortened)

what it refuses when the set fills, in one line.

```js
/*
   * AND EVERY ONE THAT DOES IS USABLE. Vacuous today by construction, which is
   * the point of pairing it with the count above: the day a notice arrives,
   * this is what refuses a malformed one before it renders
   * `https://doi.org/undefined` on the most serious sentence this site prints.
   */
```

### scripts/check-publications.mjs:1626 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------- accessions, from the PDFs */
```

### scripts/check-publications.mjs:1628 (WHY, shortened)

why the anchor and why both directions; the per-paper accessions go to the history document.

```js
/*
 * THE CURATED ACCESSIONS ARE THE ONES THE DATA-AVAILABILITY STATEMENT NAMES.
 *
 * Ruling 63 asked for GenBank accessions and the first attempt was refuted: the
 * accessions are in the PDFs rather than the abstracts, and a plain regex over
 * a PDF pulls in the COMPARISON phages' accessions. Godfather's paper yields
 * seven that way, one of which is its own; the 2022 REV announcement names the
 * previous isolate's DQ387450 in its introduction, which is another paper's
 * deposit for another outbreak.
 *
 * The context anchor is the data-availability statement, which is where a
 * journal requires the authors to name what THIS work deposited.
 * `accessions.mjs` owns that reading, and both directions are reconciled here:
 * an accession in the text and not in the corpus is a deposit the site does not
 * link, and one in the corpus that the statement does not name is a claim the
 * PDF does not support.
 */
```

### scripts/check-publications.mjs:1690 (WHY, shortened)

what a wrong registry URL looks like, in one line.

```js
/*
   * THE LINK RESOLVES TO THE RIGHT REGISTRY. An SRA run number under a nuccore
   * URL is a 404 that looks like a working link, and the two id grammars are
   * close enough that a single URL builder would be the obvious mistake.
   */
```

### scripts/check-publications.mjs:1706 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ----------------------------------------------------------------------- done */
```

### scripts/check-publications.mjs:1708 (NUMBER, shortened)

the measurement rule and the slack convention; eleven dated re-measurements and both first-run findings go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE, never summed from the
 * assertion list above. Slack of two, the convention `check:secrets` records:
 * this gate's count moves only when an assertion is written, so it does not
 * need room to breathe.
 *
 * 21 on 2026-09-12 at the restore. RE-MEASURED the same day at 29, when the
 * slug, PDF-location and redirect-map assertions landed with the per-paper
 * pages, and again at 40 when the citation exports did. Each number comes from
 * a run. The export block earned its keep on that run: its brace-protection
 * assertion failed five records whose output was correct, because it asked
 * `title.includes(organism)` where the code asks a longest-first matcher, and
 * a title carrying "Mycobacterium smegmatis" contains "Mycobacterium" too.
 * 50 when the cited-by artifact's assertions landed, and 64 with the rights
 * allowlist, the Highwire tag set and the plain-language line. Every number
 * from a run.
 *
 * The rights block also earned its place on its first run, by finding that
 * `licenseSource: null` was carrying two meanings at once, checked-and-empty
 * and never-checked, on exactly the four closed records where the difference
 * decides whether a hosting decision was made or merely inherited. The pipeline
 * now writes `none-deposited` and null means one thing.
 *
 * 69 with the extracted-text artifact's assertions, 78 with the markdown twins,
 * 89 with the search, MCP and Ask wiring and 96 with the retraction path and
 * the accessions, 97 when the Ask query was measured rather than reasoned
 * about. Every number from a run. The twin block's llms.txt
 * reconciliation is the one that has to be read in both directions to mean
 * anything: a twin nothing advertises and a URL with no twin behind it are
 * different failures and neither is visible from the other side.
 *
 * The accession block earned its place the way the rights block did. Its plant,
 * which removes the data-availability anchor and sweeps the whole paper, reds
 * 18 papers instead of 12 and reproduces every refuted case by name: Godfather
 * gains its six comparison phages, the 2022 REV announcement gains the previous
 * outbreak's DQ387450, and Tripl3t gains Wheeler's NC_022070. Each would have
 * been published here as the data behind a paper it has nothing to do with.
 */
```

## scripts/build-og.mjs

### scripts/build-og.mjs:1 (CONTRACT, shortened)

the mode, the gap it leaves and the coupling law; the two measured reasons for Node, the bundle sizes and the gitignore aside go to the history document.

```js
/**
 * Generates the social card for every post and uploads it to R2.
 *
 *   npm run build:og -- --local|--remote
 *
 * BUILD TIME ONLY, in Node. This is a deliberate deviation from "generation or
 * save" and it is the fallback the spec allows, taken for two measured reasons:
 *
 *   1. Running satori in the Worker means `workers-og` (1.87 MB unpacked) on top
 *      of a Worker already carrying 3.46 MB plus a 0.44 MB WASM binary, for code
 *      that would only ever run on the admin save path.
 *   2. Rasterising needs resvg. The Node build uses the native addon; a Worker
 *      would need the WASM one, and Workers refuse to compile WASM from bytes
 *      (measured 2026-07-28), so it would need the static-import treatment as
 *      well.
 *
 * The gap this leaves is real and recorded: a post created or retitled in the
 * editor has no generated card until someone runs this script and re-syncs. The
 * editor never writes a card URL it cannot back with an object, so the failure
 * mode is a missing image rather than a broken one.
 *
 * Nothing here touches the gated artifact. The KEY is deterministic content;
 * the PNG bytes are not, and are never compared.
 *
 * ## THE COUPLING LAW, NOW ENFORCED
 *
 * **This script uploads AND prunes in one pass**, against the keys the current
 * artifact references. The live site serves what is in D1's `og_image`, which
 * changes only when `sync:content` runs. Run this outside a ship window, after
 * any retitle or template bump, and it deletes every card production points at.
 * Since 2026-08-21 a guard before the prune reads the live keys out of D1 and
 * REFUSES if any of them is about to be deleted.
 *
 * `/og-samples/` in `.gitignore` is LOAD-BEARING, not cosmetic: `ship` refuses
 * untracked files, so without the ignore every `--out` review run would have to
 * be cleaned by hand before the next ship.
 */
```

### scripts/build-og.mjs:64 (WHY, shortened)

why the bucket is derived, in one line; the literal it replaced goes to the history document.

```js
/**
 * The derived-card bucket, DERIVED from the wrangler config rather than named
 * here.
 *
 * It used to be the literal `"dustinedwards-media"`. That was survivable while
 * this script only ever PUT objects; it stopped being survivable when the prune
 * landed, because a stale literal aims a DELETE at whatever bucket still answers
 * to that name. Reading the binding means a rename in the config is a rename
 * here, and a binding that no longer exists is a named error rather than a
 * silent no-op against the wrong bucket.
 */
```

### scripts/build-og.mjs:81 (WHY, shortened)

why the tokens are resolved and why the dark block; the v4 argument, the rule-7 reading and the mark's ruling go to the history document.

```js
/**
 * Hill Country tokens, RESOLVED FROM app.css rather than restated.
 *
 * These were four hex literals, defended by a comment saying the card is an
 * image and so cannot read a stylesheet. That conflates two different moments.
 * The RENDERED CARD is an image and cannot read CSS when someone looks at it;
 * this SCRIPT runs in Node at build time and can read app.css perfectly well,
 * which is exactly what `scripts/lib/tokens.mjs` exists for and exactly what
 * the diagram renderer already does. The diagram renderer also produces images.
 *
 * So the restatement bought nothing and cost the stated-once law: the palette
 * moved to purple chrome at v4 and these four sat unchanged, which is the
 * silent disagreement the shared reader was written to end.
 *
 * ## THE DARK BLOCK, since the v4 card, and it is a choice rather than a mode
 *
 * A card is rendered once and served into a feed that has no idea which theme
 * the reader prefers, so there is no variant to PICK and there never was: what
 * this line chooses is which ratified surface the card is PAINTED ON. The
 * previous card was the page canvas with a purple band across the top, so it
 * took light values. This one is the deep plum surface edge to edge, and that
 * surface is the DARK block's `--surface-chrome`.
 *
 * Taking the whole set from one block is the property that matters, not which
 * block it is. `--on-chrome`, `--on-chrome-muted` and `--focus-ring-on-chrome`
 * are ratified AGAINST `--surface-chrome` within a theme, and `check:contrast`
 * carries all of them as matrix rows evaluated in every block. Mixing a light
 * foreground onto a dark ground would leave the card outside every pair the
 * palette has measured, which is the one thing this file must not do.
 *
 * THE MARK IS THE ONE THING NOT RESOLVED HERE, and it is safe for a reason
 * worth naming rather than relying on silently. `scripts/lib/mark.mjs` paints
 * the brand paths from `--mark-on-chrome` in the LIGHT block, while this card's
 * ground comes from the dark one. That is only sound because
 * `--mark-on-chrome` is the same hex in both blocks BY RULING, so the mark
 * cannot disagree with the surface it is standing on. If that ruling is ever
 * reversed, this file and `check:logo` would be resolving two different marks,
 * and the repair is to give `mark.mjs` the block rather than to change the hex.
 *
 * Changing WHICH TOKENS the card uses, or the layout, MUST still bump
 * OG_TEMPLATE_VERSION in pipeline.mjs. Resolving a value no longer requires an
 * edit here, but it does still change the rendered card, so a RETUNED TOKEN in
 * app.css now moves the card without touching this file. That is the intended
 * behaviour and the reason the version bump is a judgement rather than a
 * mechanical consequence of editing this line.
 */
```

### scripts/build-og.mjs:144 (CONTRACT, shortened)

why the wordmark is read from seo.ts and why as text; the tsc error codes and the rejected alternatives go to the history document.

```js
/**
 * THE WORDMARK, READ OUT OF `app/lib/seo.ts`. The string is not spelled here.
 *
 * `SITE.name` is what the site header renders beside this same mark, and a card
 * that disagrees with the page it opens is two identities. So the card takes
 * the value from the module that owns it, the way the colours take theirs from
 * `app.css` and the mark takes its geometry from the ratified fixtures.
 *
 * READ AS TEXT, NOT IMPORTED, and the reason is measured rather than assumed.
 * Node loads `seo.ts` directly: it imports nothing, and type stripping has been
 * on by default since 22.18 against this package's declared `node >=22.22.0`
 * floor. TypeScript is the one that refuses. `npx tsc -b` on
 * `import { SITE } from "../app/lib/seo.ts"` fails twice, TS5097 for the `.ts`
 * specifier without `allowImportingTsExtensions`, and TS6307 because `seo.ts`
 * belongs to the app project and not to `tsconfig.node.json`. Fixing that means
 * turning on a compiler flag for every script and pulling app sources into the
 * node project's file list, which is a much larger change than one wordmark
 * justifies. Bundling it through esbuild, as `check:invariants` does to
 * `schema.ts`, would put a bundler on the card path to read one string.
 *
 * So it is parsed, and it fails closed three ways: the declaration renamed, the
 * block shaped differently, or `name` given anything but a plain string.
 *
 * @returns {string}
 */
```

### scripts/build-og.mjs:170 (WHY, shortened)

the prohibition and what block-only stripping read; the plant and its date go to the history document.

```js
/*
   * THE SHARED STRIPPER, and this site was NOT in the audit's inventory of
   * nine. It stripped BLOCK comments only, which is weaker than every other
   * reader of a .ts file in this repo, and the anchor below is an indexOf on a
   * declaration that seo.ts is exactly the kind of file to quote in prose.
   *
   * MEASURED 2026-08-23 by planting `// export const SITE = { name: "WRONG" };`
   * above the real declaration: block-only stripping found the COMMENT first
   * and read WRONG as the site name, so every social card would have been
   * rendered with it. Nothing would have failed; the cards would just be wrong.
   */
```

### scripts/build-og.mjs:197 (CONTRACT, shortened)

what the card derives and the two anchors; the v4 argument, the crop reasoning and the rule-7 reading go to the history document.

```js
/**
 * The card layout, as satori's element objects rather than JSX so this file
 * needs no build step of its own.
 *
 * ## THE v4 CARD, and what it is derived from
 *
 * Every value here comes from something already ratified: the ground and the
 * three foreground colours are the chrome family from `app.css`, the mark is
 * `scripts/lib/mark.mjs` at the geometry `check:logo` pins, the wordmark is
 * `SITE.name`, the date is `longDateUTC`, the meta line's tracking and case are
 * `.eyebrow`'s, and the fitted type is `app/lib/content/og-card-text.mjs`.
 * Nothing on this card is invented here except WHERE things sit.
 *
 * ## THE GROUND IS THE WHOLE CARD, which is the change
 *
 * The previous card was the page canvas with a purple band across the top and a
 * purple rule across the foot. That was the right picture of a site whose
 * chrome is a band; it is the wrong picture of one whose identity IS the plum
 * surface. Full bleed also survives the crop: platforms trim a 1.91:1 card
 * differently, and a design whose meaning lives in two 12px-to-132px strips at
 * the edges is a design that loses its meaning to a crop it cannot see.
 *
 * ## BINDING RULE 7, NAMED RATHER THAN QUIETLY LEFT BEHIND
 *
 * design-tokens.md rule 7 says body prose sits on the page canvas, never on
 * cards. The previous template cited it to justify putting the title on the
 * canvas. It does not reach this: rule 7 governs READING SURFACES, the places a
 * person reads paragraphs, and its "cards" are the site's index cards. A social
 * card carries a headline, one sentence and a byline at a size chosen to be
 * seen rather than read, and it is one immutable image with no reading mode to
 * degrade. What rule 7 protects, prose legibility over a long read, is not the
 * property under test here; the contrast pairs are, and every pair the card
 * paints is a `check:contrast` matrix row.
 *
 * ## THE MARK IS IN A CORNER AND THE TEXT HANGS OFF THE FOOT
 *
 * Two anchors, one at each end, and nothing floating in the middle. The title
 * block grows UPWARD into the empty space as the title gets longer, so a long
 * title eats air rather than walking into the meta line. That is what makes the
 * fitted ladder a safety net rather than the only thing holding the layout
 * together.
 *
 * @param {{
 *   title: string,
 *   description?: string | null,
 *   publishAt?: string | null,
 * }} post
 */
```

### scripts/build-og.mjs:257 (WHY, shortened)

why both cuts are in JavaScript; the measurement and the two-template history go to the history document.

```js
/*
   * THE TEXT AS DRAWN, from the module `ogImageKey` hashes through.
   *
   * Both cuts happen HERE rather than in the layout, and both happen in
   * JavaScript rather than in CSS, because satori's line clamp does not work
   * and has never worked: rendering the same overlong string with and without
   * `WebkitLineClamp` produced one glyph path of difference, measured on satori
   * 0.29.0 while the previous template was built. The property is inert. A
   * clamp that reads like a guarantee and is not one is worse than no clamp,
   * and it survived two templates.
   */
```

### scripts/build-og.mjs:271 (WHY, shortened)

what the owner returns and why the line is a filtered list.

```js
/*
   * The date, through the ONE owner of "a timestamp as a date a person reads".
   *
   * `longDateUTC` returns null rather than the string "Invalid Date", which is
   * the defect it was extracted to end, and null is why the meta line below is
   * assembled from a filtered list instead of a template string. A card reading
   * "Dustin Edwards . Invalid Date" would be a permanent, immutable object.
   */
```

### scripts/build-og.mjs:281 (NUMBER, shortened)

what changing the padding invalidates; the two figures are the constants below.

```js
/*
   * THE MEASURE, and why the paddings are what they are.
   *
   * 72px of side padding leaves a 1056px measure, which is what the ladder in
   * og-card-text.mjs was measured against; changing it invalidates those
   * breakpoints and is not a cosmetic edit. 64px top and bottom is the smallest
   * margin at which the mark still reads as placed rather than as cropped.
   */
```

### scripts/build-og.mjs:305 (WHY, shortened)

that the module is a seam; the wordmark's move goes to the history document.

```js
/*
     * The mark, top left, from `scripts/lib/mark.mjs`, which reads the ratified
     * fixtures and owns how the mark is drawn. This file owns only where it
     * sits.
     *
     * That module is a SEAM, not a convenience: `check:logo` renders this same
     * node and compares the result against a rasterisation of the committed
     * fixture, so the shape this card embeds is asserted rather than assumed.
     *
     * ALONE IN ITS CORNER, and the wordmark is NOT beside it any more. It moved
     * to the meta line at the foot, where it sits next to the date as a byline,
     * which is what it is. A wordmark beside the mark at the top was the header
     * quoted onto a card; a wordmark under the headline is attribution, and the
     * card now has a top and a bottom rather than a band and a body.
     */
```

### scripts/build-og.mjs:334 (WHY, shortened)

which property satori honours and which it ignores; both measurements and the false claim go to the history document.

```js
/*
           * SATORI DOES HONOUR A WORD BREAK, contrary to the comment that stood
           * on this template through two versions.
           *
           * "satori has no word-break" was written beside the character cap and
           * inherited from there, and it is FALSE on satori 0.29.0. MEASURED
           * 2026-08-30 with a control, because a "no overflow" reading is
           * worthless without one: a 41-character unbroken word at 72px reaches
           * x=1199 of 1200 with no property set, and x=1111 with this one, so
           * the reading discriminates and the property took. `overflowWrap`, in
           * both its spellings, is the one satori ignores; that is probably
           * where the claim came from.
           *
           * It costs nothing on real titles, and that is measured too rather
           * than assumed: the whole corpus renders BYTE-IDENTICALLY with and
           * without it, so this only ever fires on the pathological case.
           *
           * It does not replace the character cap in `og-card-text.mjs`. The
           * cap governs how much text there is; this governs what happens to
           * one word that cannot fit the measure at any count.
           */
```

### scripts/build-og.mjs:360 (WHY, shortened)

why two lines and why it is cut hard; the v3 removal argument goes to the history document.

```js
/*
     * The description, two lines of muted type.
     *
     * IT WAS REMOVED AT v3 AND IS BACK, so the argument that removed it is
     * answered rather than ignored. That argument was: at the 300 to 600px a
     * card is delivered at, 28px type scales to 7 to 14px, below the size at
     * which prose is read rather than seen; and the platform already prints
     * `og:description` beside the card as selectable text, so the card was
     * printing the same sentence once readable and once cut off.
     *
     * Both halves still hold for a card that is trying to be READ. This one is
     * not. Two lines of muted type under a headline is a TEXTURE that says
     * "this is an article, and here is roughly what about", and it is what
     * keeps a full-bleed card from being a poster with one line on it. It is
     * cut hard at two lines for exactly the reason the v3 note gives: a third
     * line would be prose asking to be read at a size it cannot be.
     *
     * Rendered only when there is one. An empty block would still occupy its
     * margin, and the layout closes up instead.
     */
```

### scripts/build-og.mjs:398 (WHY, shortened)

that the pair is measured and why this token; Dustin's ruling and the alternatives go to the history document.

```js
/*
     * THE ONE ACCENT: a short rule in prairie gold, picking up the warm accents
     * inside the mark above it.
     *
     * DUSTIN'S RULING, 2026-08-30, taken against rendered cards rather than
     * against a description: four candidates were rendered on the same post,
     * deep plum and bluebonnet grounds crossed with a lavender and a gold rule,
     * and this is the one he chose. He holds the aesthetics veto, so this
     * paragraph records the decision rather than arguing with it.
     *
     * IT IS A MEASURED PAIR. `--focus-ring-on-chrome` against
     * `--surface-chrome` is a `check:contrast` matrix row at the 1.4.11
     * graphical-object floor, evaluated in every theme block. The rule is not
     * text and carries no text obligation; it is measured anyway, because the
     * palette measures every pair it paints and an unmeasured one on a
     * permanent, immutable image is not worth the saving.
     *
     * ## THE TOKEN'S NAME IS THE ONE WART, AND IT IS DELIBERATE
     *
     * This card draws no focus ring. `--focus-ring-on-chrome` is used here
     * because it is the ONLY pale gold in the chrome family with a ratified
     * pair against this surface, and the alternatives are worse in ways that
     * matter more than a name: `--mark-bg` and `--focus-ring-on-brand` are both
     * this hex in the LIGHT block and a dark bronze in the dark one, so either
     * would resolve to the wrong colour here, and a literal hex would be the
     * stated-once violation this whole file was rewritten to end.
     *
     * The right repair, if a decorative gold is ever wanted as its own thing,
     * is a NEW named token in `app.css` with its own matrix row, ruled in
     * design-tokens.md. That is a palette change and belongs in a palette
     * session, not smuggled in beside a card restyle.
     */
```

### scripts/build-og.mjs:431 (WHY, shortened)

why a filtered list and why one span.

```js
/*
     * The byline: the site name, then the date, in `.eyebrow`'s case and
     * tracking so the card's smallest type is the site's smallest type.
     *
     * ASSEMBLED FROM A FILTERED LIST rather than interpolated, so an absent
     * date takes its separator with it. The separator is a middot with hair
     * space either side; satori has no `gap` on inline text, and three spans
     * with margins would be three layout boxes for one line of type.
     */
```

### scripts/build-og.mjs:458 (CONTRACT, shortened)

why the prefix is stripped and the fail-closed direction.

```js
/**
 * The card keys the DEPLOYED site is actually serving, read from D1.
 *
 * `sync-content.mjs` writes `og_image` as `/media/${ogImageKey(post)}`, so the
 * stored value is this bucket's key with one prefix on the front. That prefix is
 * STRIPPED here rather than the key rebuilt, because rebuilding it would be a
 * second copy of a rule sync already owns.
 *
 * FAILS CLOSED BY CONSTRUCTION. An unreadable database, a wrangler error, or a
 * response that is not the expected shape all throw out of here, and the prune
 * below never runs. That is the correct direction: not knowing what is live is a
 * reason to delete nothing, never a reason to proceed.
 */
```

### scripts/build-og.mjs:501 (WHY, shortened)

what the mode is for and why it returns early; the argument for a review stop goes to the history document.

```js
/*
   * LOCAL RENDER MODE: `--out <dir>` renders every card to disk and touches R2
   * with nothing. No put, no list, no delete.
   *
   * It exists because a restyle needs a review stop, and neither existing mode
   * provides one: the normal run uploads AND prunes in the same pass, and
   * `--dry-run` skips the render entirely, so there was no way to look at a
   * proposed card before it became the live one. An aesthetic decision that
   * cannot be seen before it ships is not a decision.
   *
   * It returns BEFORE the prune for the same reason it skips the upload. See
   * the prune's own comment: with a bumped template version every existing
   * object becomes an orphan by definition, and the objects the live site is
   * currently serving are exactly the ones that would be deleted.
   */
```

### scripts/build-og.mjs:540 (WHY, shortened)

one derivation, and what two would do.

```js
// ONE derivation of "which posts get a card", used by the writer below and by
  // the prune after it. Two loops each applying the cover rule for themselves is
  // how a prune ends up deleting the card the writer just uploaded.
```

### scripts/build-og.mjs:547 (WHY, shortened)

the leak and the imported rule; the measured object and its bytes go to the history document.

```js
/*
     * A DRAFT NEVER GETS A CARD, and this line is a fix rather than a tidy.
     *
     * MEASURED on the live bucket 2026-08-23: the draft
     * `charts-on-workers-fixture` had a card at
     * /media/og/charts-on-workers-fixture-8af354a5.png answering 200 with
     * 41,149 bytes of PNG, while /blog/charts-on-workers-fixture answered
     * 404. The card RENDERS THE TITLE, so an unpublished post's headline was
     * public. This loop skipped only posts with a cover and had no notion of
     * visibility at all.
     *
     * The rule is IMPORTED, not restated. `isPubliclyVisible` is the one
     * JavaScript owner, and the July draft leak into Ask is what a
     * hand-rolled second copy of it costs.
     *
     * The prune below uses this same `cards` list, so a post that stops being
     * visible has its card DELETED on the next run rather than merely not
     * rewritten. That is the half that closes the class: unpublishing is as
     * common as publishing.
     */
```

### scripts/build-og.mjs:617 (WHY, shortened)

why one quoted string, in one line.

```js
// One quoted command string, not an args array. With shell:true an array
      // is concatenated unquoted, and the cache-control value contains a comma
      // and spaces, so wrangler saw three arguments instead of one.
```

### scripts/build-og.mjs:635 (WHY, shortened)

why the ordering is the safety property.

```js
/*
   * LOCAL RENDER MODE RETURNS HERE, before the prune, and the ordering is the
   * safety property rather than a tidiness one.
   *
   * The prune below computes orphans as "present in R2 and not referenced by
   * the CURRENT corpus". After an OG_TEMPLATE_VERSION bump every existing
   * object is an orphan by that definition, and those objects are precisely the
   * ones the DEPLOYED site is still serving, because the live card URLs live in
   * D1 and only change when `sync:content` runs at ship. So a plain run of this
   * script during a restyle would upload the new cards and delete every card
   * the live site currently points at, in one pass.
   */
```

### scripts/build-og.mjs:655 (WHY, shortened)

why a listing is refused; the dated network error and the diagrams comparison go to the history document.

```js
// Prune. `build:diagrams` has had one since it shipped; cards never did, so
  // every OG_TEMPLATE_VERSION bump and every retitle has left an orphan behind:
  // the key is a hash of the template version, slug, title and description, so
  // changing any of them writes a NEW object and abandons the old one under a
  // name nothing will ever ask for again.
  //
  // **It will not act on a listing it cannot trust.** On 2026-08-02 a run
  // printed `WSARecv(): #64 The specified network name is no longer available`
  // in the middle of its output and carried on to report one orphan. It was
  // right that time, and a run that had been cut short would have looked
  // identical. `listForPrune` refuses an empty listing outright and refuses one
  // that is missing any key the corpus still references, because a listing
  // demonstrably missing objects that exist proves nothing about the objects it
  // appears not to have.
```

### scripts/build-og.mjs:684 (WHY, shortened)

the law, why this shape and the boundary; the enforcement date, the ship aside and the Capsid deletion go to the history document.

```js
/*
   * ==========================================================================
   * THE OG COUPLING LAW, ENFORCED RATHER THAN WRITTEN DOWN. Added 2026-08-21.
   * ==========================================================================
   *
   * **This script UPLOADS AND PRUNES IN ONE PASS, and the two halves disagree
   * about what "live" means.** `live` above is the set of keys the CURRENT
   * ARTIFACT references. The DEPLOYED site serves the keys in D1's `og_image`
   * column, and those change only when `sync:content` runs.
   *
   * So after any retitle, retag, or `OG_TEMPLATE_VERSION` bump, and BEFORE the
   * next sync, every key the live site is serving is an orphan by this script's
   * definition. **Run it then and it 404s every social card on the site, with no
   * deploy having occurred and nothing to roll back.**
   *
   * That was a law with no enforcement: "run it only inside a ship window,
   * adjacent to sync:content." Two things made that weak. **ship does not invoke
   * this script at all**, so there is no ship context to detect. And the law
   * lived in a Capsid paragraph, where the 2026-08-21 consolidation deleted it.
   *
   * ## WHY THIS SHAPE, RATHER THAN REFUSING OUTSIDE A SHIP WINDOW
   *
   * "Am I inside a ship window" is not a question this process can answer
   * honestly, and any flag it checked would be one a hurried operator passes.
   * The PROPERTY the law protects is checkable directly: **no object the live
   * site is currently pointing at may be deleted.** So that is what is asserted,
   * and it is strictly stronger, because it also catches a divergence arising
   * for a reason nobody anticipated.
   *
   * `listForPrune` already refuses a listing it cannot trust. This is the other
   * side of the same worry: a listing that is perfectly correct, against a
   * corpus that has moved.
   *
   * ## OBSERVATION BOUNDARY
   *
   * It compares against what D1 SAYS, not against what R2 holds or what a
   * browser would fetch. A card row pointing at an object that is already gone
   * looks live here. It also runs only for `--remote` and only when there is
   * something to delete, because those are the only conditions under which the
   * law can be broken.
   */
```

### scripts/build-og.mjs:728 (WHY, shortened)

both arms of the scope assertion, in two lines.

```js
/*
     * SCOPE, ASSERTED. An empty read makes the comparison below pass by
     * examining nothing, which is this repo's most repeated defect class. And
     * if the artifact references cards while D1 names none, that IS the
     * unsynced state this guard exists for, so it refuses rather than shrugs.
     */
```

## scripts/check-content.mjs

### scripts/check-content.mjs:1 (CONTRACT, shortened)

the boundary and the five subjects, each to its claim; the artifact-arc narrative and the per-subject argument go to the history document.

```js
/**
 * Gate for the content build and the committed artifacts under
 * `content/generated/`.
 *
 * OBSERVATION BOUNDARY: it renders and compares locally. It never renders a
 * page in a Worker, never queries D1, and cannot tell whether the rows the
 * sync writes match what it rendered; that comparison is ship's drift report
 * and the content-drift health check.
 *
 * FIVE subjects. The first three are the artifact arc's; the last two arrived
 * with math on 2026-09-06 and are 4 and 5 below.
 *
 *   1. THE CORPUS RENDER IS VALID AND DETERMINISTIC. posts.json stopped being
 *      committed (git holds markdown; D1 holds the only rendered copy), so
 *      there is no committed copy to byte-compare. What replaced the byte
 *      gate: the corpus is rendered TWICE in one process and the two outputs
 *      must be byte-identical, because a nondeterministic render is exactly
 *      what would surface later as false render-drift between the Worker and
 *      the Node build. A slug whose two renders differ is named. Rendering at
 *      all is also the validation half: a post the pipeline refuses fails
 *      here, offline, before any writer meets it.
 *   1b. THE ABOUT PAGE, on the corpus's footing: rendered twice and
 *      byte-compared, and the render is the validation. It is a build
 *      product, gitignored like `posts.json` and `stack.json`, but unlike
 *      those two its bytes go into the WORKER BUNDLE, because
 *      `app/routes/about.tsx` imports it statically. A nondeterministic
 *      render of it is therefore a deploy that differs from the one before
 *      it for no reason anybody wrote down.
 *   2. `template-refs.json`, byte-compared against a fresh scan. STILL
 *      COMMITTED, deliberately: it is a repo fact with no database owner.
 *   3. `assets.json`, byte-compared against a walk of `public/`, with the
 *      gitignore tripwire. Also still committed.
 *   4. MATH OUTPUTS. One output carries the rendered form and every other one
 *      carries the TeX an author typed, and that distinction lives in five
 *      modules with nothing else comparing them. Includes the scope control
 *      that keeps the whole section from passing over a corpus with no math in
 *      it, and the two independent derivations of `hasMath` made to argue.
 *   5. `katex.generated.css` AND ITS FACES, byte-compared against a fresh
 *      derivation from the installed katex package, faces reconciled both ways.
 *
 * This check fails closed: a generator that throws is a failure, never a pass.
 */
```

### scripts/check-content.mjs:52 (WHY, shortened)

one owner, in one line.

```js
/* The one statement of what a stored placeholder IS, imported rather than
   restated. That gate owns the assertion for the D1 column; this artifact has
   to satisfy the same one, and a second copy here is how the two would come to
   disagree about a defect they were both written for. */
```

### scripts/check-content.mjs:67 (WHY, shortened)

why names and why capped.

```js
/**
 * Names, not a count. A failure that says "3 file(s) missing" sends the reader
 * to run a command and compare two lists by eye; a failure that says which
 * files is already the answer. Capped, because a first run against a fresh
 * checkout could otherwise print sixty lines.
 *
 * @param {string[]} names
 */
```

### scripts/check-content.mjs:105 (WHY, shortened)

what the second render proves and why one process.

```js
/*
   * TWICE, IN ONE PROCESS. Rendering once proves validity; rendering twice
   * and comparing proves the render depends on the sources alone. Any clock,
   * counter or iteration-order dependence shows up as a byte difference
   * between two back-to-back runs, and that same dependence is what would
   * later read as Worker-versus-Node render drift in ship's report with
   * nothing at fault but this pipeline. One process on purpose: a module
   * memo (the highlighter, the WASM engine) is shared, so a difference here
   * is the render's own, not an environment's.
   */
```

### scripts/check-content.mjs:167 (CONTRACT, shortened)

the three claims and the one it adds; the bundle argument and the taste aside go to the history document.

```js
/**
 * The About page renders, renders the same way twice, and says something.
 *
 * ## THE SAME CLAIMS THE CORPUS GETS, AND ONE MORE
 *
 * RENDERING AT ALL IS THE VALIDATION. `buildAbout` throws on missing
 * frontmatter, on an image (there is no resolver on this page), and on a link
 * the URL allowlist demoted. A page that cannot be built fails here, offline,
 * rather than shipping with a dead anchor or an empty title tag.
 *
 * TWICE, BYTE-COMPARED, for the corpus's reason and one of its own. The
 * general reason is that a clock, a counter or an iteration order in the
 * pipeline shows up as a difference between two back-to-back runs. The
 * specific one is that `content/generated/about.json` is imported STATICALLY
 * by `app/routes/about.tsx`, so its bytes sit inside the Worker bundle: a
 * nondeterministic render here makes two deploys of one commit differ, which
 * is the property blocking `npm run deploy` from a dirty tree exists to
 * protect.
 *
 * NOT EMPTY, and this is the extra claim. `renderBody` over an empty body
 * returns an empty string and throws nothing, so a truncated or mis-parsed
 * `content/about.md` produces a perfectly valid artifact describing a blank
 * page. That is the failure here that looks most like success.
 *
 * THE FLOOR IS DELIBERATELY LOW. It is a scope check against nothing at all,
 * not a word count: a page whose length a gate polices is a page nobody can
 * edit, and this one exists to be edited on taste.
 *
 * WHAT IT DOES NOT CHECK: whether a single sentence is true. Nothing can.
 */
```

### scripts/check-content.mjs:231 (CONTRACT, shortened)

the subject, the scope control and the two derivations; the determinism aside goes to the history document.

```js
/**
 * THE FOURTH SUBJECT: math, and what each output carries of it.
 *
 * The determinism pass above already covers KaTeX for free, because a
 * nondeterministic renderer would move the bytes between two runs. What it
 * cannot see is the thing the math arc actually decided, which is that ONE
 * output carries the rendered form and every other one carries the TeX an
 * author typed. That distinction lives in five different modules and nothing
 * else compares them.
 *
 * ## THE SCOPE CONTROL COMES FIRST, and it is the assertion that matters most
 *
 * Every claim below is of the form "no post's markdown carries KaTeX markup",
 * and a corpus with no math in it satisfies every one of them perfectly. That
 * is the clean-sweep-over-an-empty-scope shape this file already guards against
 * for `further_reading`. So the first thing asserted is that the corpus
 * contains at least one post WITH math and at least one WITHOUT: the fixture
 * `math-typesetting-fixture` provides the first and the other twelve the
 * second. Delete the fixture and this gate fails rather than going quietly
 * vacuous.
 *
 * ## TWO DERIVATIONS OF `hasMath`, MADE TO ARGUE
 *
 * `remarkMathValidate` sets the flag from the mdast, before anything is
 * rendered. `htmlHasMath` reads it back off the rendered html, and is what the
 * ROUTE uses to decide whether to link the stylesheet. They are computed at
 * different times from different artifacts by different code, and if they ever
 * disagree the page is either downloading 3 kB it does not need or rendering
 * math with no stylesheet. Comparing them is the only thing that can notice.
 *
 * @param {Array<{ slug: string, markdown: string, html: string, hasMath?: boolean,
 *   title: string, toc: any[], tags: string[], publishAt: any, draft: boolean }>} posts
 */
```

### scripts/check-content.mjs:293 (WHY, shortened)

what it proves about the validator, in one line.

```js
/*
     * NO ERROR BOX, EVER, on any post. This is the assertion that proves
     * `remarkMathValidate` is doing its job rather than merely existing:
     * rehype-katex's own failure path emits `class="katex-error"`, and the
     * validator exists precisely so that path is unreachable. If this ever
     * fires, an expression got past the validator and shipped a red box.
     */
```

### scripts/check-content.mjs:308 (WHY, shortened)

why it is asserted on the record, in one line.

```js
/*
     * THE MARKDOWN SIDE, which is FOUR outputs at once and is why it is
     * asserted on the record rather than per route: `posts.body` is what
     * `/blog/:slug.md`, `llms-full.txt`, the JSON feed's `content_text` and the
     * `Accept: text/markdown` representation all serve, unmodified. If the
     * source held markup, all four would.
     */
```

### scripts/check-content.mjs:328 (WHY, shortened)

what a silent drop would cost.

```js
/* THE HTML SIDE. The one output that carries the rendered form, and it
       carries BOTH trees, because htmlAndMathml is the ruled output mode and a
       silent drop to html-only would take the MathML away from a screen reader
       with nothing else noticing. */
```

### scripts/check-content.mjs:348 (WHY, shortened)

what this owns that a fixture cannot.

```js
/* THE FEED SIDE, asserted through the transform the feeds actually call.
       `test/math-outputs.test.mjs` owns the item markup; this owns the claim
       over the REAL corpus, which no fixture can make. */
```

### scripts/check-content.mjs:363 (WHY, shortened)

what a record carrying markup would do.

```js
/*
   * THE SEARCH AND ASK SIDE. Both indexes are built by `recordsForPosts` from
   * the MARKDOWN, so what they carry is the TeX source; this proves it over the
   * corpus rather than by reading that module. A record carrying markup would
   * put span soup into a search snippet and into the Ask context window.
   */
```

### scripts/check-content.mjs:415 (WHY, shortened)

why the strip is required; the fixture aside goes to the history document.

```js
/**
 * The prose of a post, with every code fence and code span removed.
 *
 * REQUIRED, not tidiness. A post that DOCUMENTS the directive writes
 * `:swatch[#6B4FBB]` inside a fence, where it is literal text and renders no
 * chip. Matching the raw markdown would read that as a swatch that failed to
 * render and fail the build on a post that is correct, which is the
 * comment-satisfied-anchor class in hard rule 10 wearing a different syntax:
 * strip the region that cannot mean what you are looking for, then match.
 *
 * The swatch fixture carries exactly that case on purpose, so this stripping is
 * exercised by the corpus rather than only asserted here.
 *
 * @param {string} markdown
 */
```

### scripts/check-content.mjs:434 (CONTRACT, shortened)

the claim and the two derivations; the six-output enumeration goes to the history document.

```js
/**
 * THE FIFTH SUBJECT: swatches, and what each output carries of one.
 *
 * The claim, in one line: **the rendered chip exists in the HTML and NOWHERE
 * ELSE.** `posts.body` is served verbatim by `/blog/:slug.md`, `llms-full.txt`,
 * the JSON feed's `content_text` and the `Accept: text/markdown`
 * representation, and it is what `recordsForPosts` indexes for search and Ask.
 * All six of those carry the directive as the author typed it. If a chip's
 * markup ever reached `posts.body`, every one of them would ship a `<span>` in
 * place of a colour.
 *
 * TWO DERIVATIONS, MADE TO ARGUE, which is the shape `checkMath` uses: the
 * source side reads the markdown for the directive, the html side reads the
 * rendered output for the chip, and a disagreement in either direction is a
 * failure. One derivation checked against itself would pass on a pipeline that
 * had stopped running entirely.
 *
 * @param {Array<{ slug: string, markdown: string, html: string }>} posts
 */
```

### scripts/check-content.mjs:487 (WHY, shortened)

why it is asserted on the record, in one line.

```js
/*
     * THE MARKDOWN SIDE, which is SIX outputs at once and is why it is asserted
     * on the record rather than per route. If `posts.body` held chip markup,
     * all six would.
     */
```

### scripts/check-content.mjs:507 (WHY, shortened)

why on the output and not the validator.

```js
/*
     * THE CASE FOLD, asserted on the OUTPUT rather than on the validator. The
     * renderer uppercases every hex so two spellings of one colour produce one
     * page; this is what makes that a property of the artifact instead of a
     * claim in a docstring.
     */
```

### scripts/check-content.mjs:524 (WHY, shortened)

the same reason as the math side, in one line.

```js
/*
   * THE SEARCH AND ASK SIDE, through the same builder `checkMath` uses and for
   * the same reason: both indexes are built from the MARKDOWN, so what they
   * carry is the directive source. A record carrying chip markup would put span
   * soup into a search snippet and into the Ask context window.
   */
```

### scripts/check-content.mjs:574 (CONTRACT, shortened)

the failure it exists for and the both-directions rule.

```js
/**
 * THE FIFTH GENERATED ARTIFACT: the math stylesheet and its font faces.
 *
 * Same contract as `template-refs.json` above, and it exists for a failure that
 * is invisible in every other direction. `app/styles/katex.generated.css` is
 * derived from the INSTALLED katex package, and the markup it styles is
 * produced by that same package at build time. Bump katex without running
 * `npm run build:katex` and the two go out of step: the renderer starts
 * emitting a class the committed stylesheet has no rule for, and the symptom is
 * an equation that is slightly wrong on a page nobody is looking at.
 *
 * Byte-compared against a fresh derivation, and the FACES are reconciled in
 * BOTH directions: a face the stylesheet names and the repo does not hold is a
 * 404 that falls back to a system font silently, and a face on disk the
 * stylesheet no longer names is a stale binary nobody will ever delete.
 */
```

### scripts/check-content.mjs:633 (WHY, shortened)

what a zero-face derivation would agree with.

```js
/*
   * SCOPE, ASSERTED, before either direction is compared. A derivation that
   * named zero faces would agree with an empty directory, and both would look
   * like a clean reconciliation.
   */
```

### scripts/check-content.mjs:691 (CONTRACT, shortened)

what the schema cannot decide and why the count is printed; the widening's timing goes to the history document.

```js
/**
 * EVERY `/blog/` LINK IN `further_reading` NAMES A POST THAT EXISTS.
 *
 * The schema decides the SHAPE of a url and cannot decide its TARGET: nothing
 * in `frontmatterSchema` knows which slugs the corpus holds, so a link to a
 * post that was later deleted or renamed is valid frontmatter and a dead link
 * on a live page. Internal links only became expressible when the schema was
 * widened to accept a `/blog/` path, so this gate lands with the widening
 * rather than after the first dead link.
 *
 * A BUILD FAILURE rather than a warning, which is the point of the request: a
 * deleted post should stop the build, not ship. `check:content` runs in the
 * offline tier, so it fails before a deploy and before CI goes green.
 *
 * **THE EXAMINED COUNT IS PRINTED, and today it is zero.** No corpus post sets
 * `further_reading`, so a silent "ok" here would be the clean-sweep-over-an-
 * empty-scope shape in FAILURES.md: indistinguishable from a gate that checked
 * nothing because it was broken. The line says how many links it resolved, so
 * a reader can tell "none to check" from "all fine". The gate's real proof is
 * a planted dead link, not a green run over an empty corpus.
 *
 * @param {Array<{ slug: string, furtherReading?: Array<{ title: string, url: string }> }>} posts
 */
```

### scripts/check-content.mjs:723 (WHY, shortened)

why external links are out of scope, in one line.

```js
// External links are out of scope: nothing offline can say whether a
      // third-party URL still resolves, and pretending otherwise would be a
      // check that fails on somebody else's outage.
```

### scripts/check-content.mjs:748 (CONTRACT, shortened)

why a stale copy is worse than none, and the separate scope numbers.

```js
/**
 * THE SECOND GENERATED ARTIFACT, reconciled the same way and for a stronger
 * reason than the first.
 *
 * `template-refs.json` decides which files the media library calls "in
 * template", so a stale copy does not merely go out of date: it prints a
 * SENTENCE ABOUT EVIDENCE that no longer matches the evidence. A file whose
 * last reference was deleted would keep claiming the site places it, next to a
 * delete button that the claim discourages pressing. That is worse than no
 * claim at all.
 *
 * Byte-compared against a fresh scan, both directions, exactly as the posts
 * artifact is. **The scope numbers are asserted too, and separately**: a scan
 * that read zero files and one that found zero references print the same empty
 * `refs`, so the count of files read is what tells a broken walk from a
 * repository that genuinely cites nothing. That is this repo's most-repeated
 * defect class and the artifact carries the control for it.
 */
```

### scripts/check-content.mjs:797 (NUMBER, shortened)

why floors and why they are set by hand; the re-measurement, the drift figures and the tolerance formula go to the history document.

```js
// SCOPE, ASSERTED. An empty `refs` from a broken walk and an empty `refs` from
  // a repository that cites nothing are the same bytes; these are the numbers
  // that discriminate. Floors rather than equalities, so adding a source file
  // does not fail the gate, but losing the whole tree does.
  //
  // RE-MEASURED 2026-09-06 through this gate by running it: 233 files read, 59
  // assets considered. Set to count minus check:floors' own tolerance,
  // max(3, ceil(count * 0.05)), which is the sweep's rule applied by hand.
  //
  // BY HAND BECAUSE THIS GATE IS NOT IN THE SWEEP. These are bespoke scope
  // floors rather than executed-count floors, so this file prints no
  // `floor check:content:...` line and check:floors names it in the gates it
  // deliberately does not read. Nothing re-measures them automatically; the
  // trigger is touching this file, which is what happened here.
  //
  // The drift they had accumulated is exactly what the sweep exists to catch:
  // the file floor was 168 against 183 when it was last set on 2026-08-24, and
  // the tree had grown to 233 by today with the floor unmoved, so 65 source
  // files could have stopped being walked and the assertion that exists to
  // notice that would have reported clean.
```

### scripts/check-content.mjs:833 (WHY, shortened)

why it is named rather than left to the bytes.

```js
/*
   * AND THE ONE CASE THE WHOLE FEATURE EXISTS FOR. The nine cohort photographs
   * are referenced by `app/data/phage-hunters.ts` and by no post. If this
   * assertion ever fails, the media page has silently gone back to calling them
   * unattached, which is the exact falsehood the third state was built to end.
   * Named explicitly rather than left to the byte comparison, because a byte
   * comparison against a fresh scan passes happily when BOTH are wrong.
   */
```

### scripts/check-content.mjs:859 (CONTRACT, shortened)

why a Worker cannot list its assets, the tier argument and the boundary; the shipped-commit example and the ordering note go to the history document.

```js
/**
 * THE THIRD GENERATED ARTIFACT, and the one that was reconciled by nothing
 * offline until 2026-08-18.
 *
 * `assets.json` is the list of static files, written by `build:assets` from a
 * walk of `public/`. **A Worker cannot list its own static assets**: the ASSETS
 * binding has `fetch()` and nothing else, so the media rebuild running inside
 * the Worker discovers what exists by reading this file. A manifest missing a
 * file therefore means a file that is never indexed, never appears in
 * /admin/media, and is not missing from anything a reader can see. It is the
 * quietest possible failure.
 *
 * IT MOVED HERE FROM check:media, AND THE TIER IS THE ENTIRE POINT. The
 * comparison is a `readdir` and a JSON read with no network in it at all, and
 * it was the only offline-capable half of a gate tiered `network` because its
 * other four directions list R2 and query D1. So the check existed, was
 * correct, and ran only on `check:all --remote`. `public/_headers` was
 * committed in `f3256e8` and shipped in window 8 with 25 green gates.
 *
 * WHAT THIS SECTION CANNOT SEE, stated plainly because the tier makes it
 * tempting to assume otherwise: it compares the manifest to THE FILESYSTEM. It
 * does not know what rows exist in D1, so a manifest that matches `public/`
 * perfectly while the media index is months stale passes here without comment.
 * Manifest-to-D1 is `check:media`'s, it needs the network, and moving this half
 * out did not shrink that half by one assertion.
 *
 * Ordering note: this runs LAST, after both byte comparisons, because it is the
 * cheapest to fix and the least likely to be what someone is mid-way through
 * debugging.
 */
```

### scripts/check-content.mjs:892 (WHY, shortened)

what a broken walk and an empty directory share.

```js
// FAILS CLOSED ON AN EMPTY WALK, the same discipline check:media applies to
  // an empty R2 listing. A broken walk and an empty directory produce the same
  // array, and every comparison below would pass vacuously against it.
```

### scripts/check-content.mjs:910 (WHY, shortened)

why the default is absent, in one line.

```js
// `?? []` is deliberately absent. A manifest whose `paths` key is missing is
    // a broken artifact, and defaulting it to an empty array would turn that
    // into "every file is missing from the manifest", which is a true statement
    // that names the wrong defect.
```

### scripts/check-content.mjs:930 (WHY, shortened)

why order is compared as well as membership.

```js
// Order matters as well as membership: `walkPublic()` sorts, so an unsorted
  // manifest is a hand edit or a generator that stopped sorting, and either is
  // worth failing on. Compared as JSON for that reason rather than as sets.
```

### scripts/check-content.mjs:965 (CONTRACT, shortened)

the three reconciliations and why it does not re-encode; the finding reference goes to the history document.

```js
/**
 * THE PLACEHOLDER HALF OF THE MANIFEST, reconciled three ways.
 *
 * A placeholder is baked into the rendered HTML that this same gate byte
 * compares, so a stale one is not a cosmetic problem: it is a value both
 * writers agree on and neither can check, which is the shape finding B002 had.
 *
 *   1. MEMBERSHIP, both directions. The set is derived from the walk by
 *      `placeholderPaths`, the same function `build:assets` uses, so an image
 *      added to `public/` without a rebuild is named, and an entry whose file
 *      is gone is named. A one-directional check would pass on either.
 *   2. THE SOURCE DIGEST. Membership cannot see a file EDITED IN PLACE, and a
 *      `public/` path is not content addressed, so that is the one way a static
 *      asset changes. The file is re-hashed here and compared against the
 *      digest the manifest recorded.
 *   3. THE STORED VALUE IS A LOSSY WEBP DATA URI, through the SAME function
 *      `check:image-weight` uses on the D1 column. One statement of what a
 *      placeholder is, two artifacts that must satisfy it.
 *
 * IT DOES NOT RE-ENCODE. That would compare this machine's sharp against the
 * one that wrote the manifest, and two platforms differing by a byte in a WebP
 * encoder would make the gate fail on Linux and pass on Windows. The digest
 * answers staleness without asserting anything about the encoder.
 *
 * @param {string[]} files every path under public/, from the walk
 * @param {Record<string, { sha?: string, lqip?: string }>} placeholders
 */
```

### scripts/check-content.mjs:995 (WHY, shortened)

what an empty expectation would agree with.

```js
// FAILS CLOSED ON AN EMPTY EXPECTATION, the discipline this file applies to
  // every other derived set: if the classifier stopped calling anything a
  // content raster, every comparison below would agree with an empty manifest.
```

### scripts/check-content.mjs:1046 (WHY, shortened)

why the executed count is paired, in one line.

```js
// The executed count, paired with the content check, so "0 problems" cannot
  // mean "0 examined". `wanted.length` is floored above; this is what was
  // actually hashed and decoded.
```

### scripts/check-content.mjs:1057 (CONTRACT, shortened)

why it is a defect, the two live paths and why git is asked; the gitignore entry and the tripwire framing go to the history document.

```js
/**
 * A path may not be BOTH gitignored and in the manifest.
 *
 * WHY THIS IS A DEFECT AND NOT A CURIOSITY. The manifest is committed, so it
 * describes what the repository contains. A gitignored file under `public/`
 * classifies fine, enters the manifest on whoever's machine holds it, and then
 * exists in no clone: the artifact has quietly started describing A DISK. Two
 * things make that live rather than theoretical here. `npm run deploy` builds
 * from the WORKING TREE, so the file ships from that one machine; and
 * `check:head` extracts a ref into a throwaway worktree, where the file is
 * absent and this same comparison would fail for a reason nobody could
 * reproduce.
 *
 * `.gitignore` carries `/public/phage-hunters/*.jpg`, the roster photo sources
 * whose committed form is the generated WebP. The trap is already written down;
 * nothing has walked into it yet. **This is a tripwire being armed, not a break
 * being fixed**, which is exactly why the scope assertion below matters more
 * than usual: an assertion that has never fired and cannot fire is
 * indistinguishable from one that is merely quiet.
 *
 * `git check-ignore` rather than parsing `.gitignore`: negations, directory
 * rules, precedence and nested ignore files are git's semantics, and a second
 * implementation of them would be wrong in ways this gate could not see.
 *
 * @param {string[]} manifestPaths site-absolute, as the manifest stores them
 */
```

### scripts/check-content.mjs:1084 (WHY, shortened)

the three states and which one is a pass.

```js
// SCOPE, ASSERTED FIRST. This whole check reports "nothing ignored" when the
  // path list is empty, when git cannot answer, and when every path is clean.
  // Only the third is a pass, so the other two are eliminated before the answer
  // is read at all.
```

### scripts/check-content.mjs:1103 (WHY, shortened)

what each exit code means and which branch fails closed.

```js
// Exit 0 means at least one path IS ignored, 1 means none are, and anything
  // else is git failing to answer. FAIL CLOSED on the third: an unreadable
  // answer is not a clean one, and this is the branch that would otherwise turn
  // a missing git into a silent pass forever.
```

## scripts/restore-drill.mjs

### scripts/restore-drill.mjs:1 (CONTRACT, shortened)

the boundary against check:backup, what it restores from, the Time Travel limit and the production guard; the backup-store argument and the deletion note go to the history document.

```js
/**
 * Gate: proves the documented backup path RECONSTRUCTS the database.
 *
 *   npm run check:restore
 *
 * OBSERVATION BOUNDARY, and it is the whole reason this file exists beside
 * `check:backup` rather than inside it. That gate proves an export was WRITTEN:
 * its own header says so, "it never restores, so it cannot tell you the dump
 * would reconstruct the database". This one takes the dump the other one
 * produces, builds an empty database from the migrations, loads it, and asks
 * the restored copy the same integrity questions `/api/health` asks production.
 * A dump that exports cleanly and restores to a database that disagrees with
 * production is the failure neither gate could see before this one.
 *
 * ## WHAT IT RESTORES FROM, AND WHY NOT "THE NEWEST BACKUP"
 *
 * There is no backup store. `check:backup` exports to a temp directory per
 * invocation and leaves nothing behind, so there is no newest artifact to
 * restore and no retention to measure. Measured 2026-09-08, and it is the
 * reason this drill takes its OWN export rather than reading one: what can be
 * proven today is that the export-and-restore path round-trips. That is a
 * strictly weaker claim than "the artifact we are keeping is restorable", and
 * it is stated here rather than implied, because a drill that reads a store
 * nobody built would be asserting about nothing.
 *
 * A durable backup job, its R2 key pattern and its retention are a separate
 * decision. When one exists, the export step below is the only part that
 * changes and every assertion after it still holds.
 *
 * ## D1 TIME TRAVEL IS THE OTHER PATH AND CANNOT BE DRILLED HERE
 *
 * Time Travel is on for this database (a bookmark reads back today) and is the
 * first thing to reach for at 2am, which is why `docs/RUNBOOK.md` puts it
 * ahead of this. It restores a database IN PLACE to a bookmark; there is no
 * form of it that targets a different database. So a non-destructive drill
 * cannot exercise it, and no gate here can. The runbook says that in the same
 * words rather than leaving a reader to discover it under load.
 *
 * ## IT NEVER TOUCHES PRODUCTION, AND THAT IS ENFORCED RATHER THAN INTENDED
 *
 * Production is READ from, twice: the per-table export, and the integrity
 * queries, both of which are reads. Every WRITE in this file goes through
 * `scratch()`, which refuses any database name that is not the scratch name
 * this run generated. The guard is a function rather than a convention because
 * the failure it prevents is unrecoverable and would look like a successful
 * drill: a `d1 execute --file` aimed at the wrong name restores production
 * onto itself.
 *
 * The Claude Code hook that blocks a non-SELECT `d1 execute` cannot see inside
 * a node script, so it is NOT what protects production here. `scratch()` is.
 *
 * ## THE SCRATCH DATABASE IS ALWAYS DELETED
 *
 * In a `finally`, so a failed assertion does not leave a database behind, and
 * the deletion is REPORTED rather than assumed: a drill that leaks a database
 * per run is a slow resource leak that no assertion in it would ever notice.
 */
```

### scripts/restore-drill.mjs:72 (WHY, shortened)

why the UUID and which database the config poisons; the error text, the CI runs and the class note go to the history document.

```js
/**
 * Production's UUID, resolved at runtime, because THE NAME IS NOT ADDRESSABLE
 * FROM CI and this is measured rather than defensive.
 *
 * `wrangler d1 export <name>` resolves the name through the `d1_databases`
 * entry in `wrangler.jsonc` and uses that entry's `database_id`. That file is
 * gitignored, so CI's `postinstall` bootstraps it from `wrangler.jsonc.example`,
 * whose `database_id` is the placeholder `00000000-0000-0000-0000-000000000000`.
 * The first two CI runs of this drill therefore died on the first export with
 * "The database 00000000-0000-0000-0000-000000000000 could not be found
 * [code: 7404]", deterministically, while the identical command exited 0 on a
 * developer machine holding the real `wrangler.jsonc`.
 *
 * The asymmetry is the trap: the config poisons EXACTLY the database this
 * drill reads. `d1 list` is account-scoped and reads no binding, so the sweep
 * works. The scratch database is in no config at all, so its create, execute
 * and delete fall back to an account lookup by name and work. Only production
 * has an entry, and only production gets hijacked.
 *
 * This is the same class as the `d1 migrations apply` note further down: a
 * wrangler subcommand silently resolving a value out of a file this gate does
 * not control. A UUID is resolved from `d1 list --json`, which needs only the
 * API token, and addresses the database the account actually has.
 *
 * @type {string | null}
 */
```

### scripts/restore-drill.mjs:103 (WHY, shortened)

why dated and why prefixed, in two lines.

```js
/**
 * The scratch database name for this run.
 *
 * Dated rather than random so a leaked database is identifiable by eye in
 * `wrangler d1 list`, and prefixed so the guard below has something to anchor
 * on that production's name can never satisfy.
 */
```

### scripts/restore-drill.mjs:116 (CONTRACT, shortened)

the argument order and what a string in the condition slot does.

```js
/**
 * `ok(label, condition, detail)`, the argument order every gate in this repo
 * uses. A string in the condition slot is always truthy, which is the shape
 * `check:invariants` section 17 refuses and FAILURES.md carries.
 *
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
```

### scripts/restore-drill.mjs:133 (CONTRACT, shortened)

why one quoted string; the FAILURES reference goes to the history document.

```js
/**
 * Runs wrangler as one already-quoted command string.
 *
 * Passing an args array alongside `shell: true` concatenates without quoting,
 * which has split an argument containing a space twice in this repo
 * (FAILURES.md, `spawnSync` with `shell: true`).
 *
 * @param {string} args
 * @returns {{ stdout: string, status: number }}
 */
```

### scripts/restore-drill.mjs:152 (WHY, shortened)

what a head slice reported; the banner enumeration goes to the history document.

```js
/**
 * The END of wrangler's output, which is where its error is.
 *
 * `stdout.slice(0, 300)` was the first version and it reported the BANNER on
 * every failure: the version line, the resource location and the "to execute
 * locally" hint, three hundred characters of it, with the actual SQLite error
 * below the cut. A failure detail that cannot carry the failure is the same
 * class as an assertion that cannot fail.
 *
 * @param {string} text
 * @param {number} [max]
 */
```

### scripts/restore-drill.mjs:172 (CONTRACT, shortened)

the guard and why it checks both directions.

```js
/**
 * THE GUARD. Returns the scratch name, or throws rather than returning a name
 * that could reach production.
 *
 * Every write path in this file calls this instead of naming a database, so
 * there is exactly one place where a write can learn what to aim at. It checks
 * both directions: the name must carry the scratch prefix AND must not be
 * production's. The second half is redundant today and is kept because the
 * first half's correctness depends on a constant somebody could edit.
 *
 * @param {string} name
 * @returns {string}
 */
```

### scripts/restore-drill.mjs:192 (WHY, shortened)

resolving bindings rather than spellings, on the guard.

```js
/*
   * PRODUCTION NOW HAS TWO SPELLINGS, so the guard needs both. Before the UUID
   * lookup above existed, refusing the name was refusing the database; now a
   * write handed `PRODUCTION_ID` would carry no name at all and the check above
   * would wave it through. Resolving bindings rather than spellings, on the
   * guard whose whole job is that nothing reaches production.
   */
```

### scripts/restore-drill.mjs:214 (CONTRACT, shortened)

why --json rather than the printed table.

```js
/**
 * Runs one SELECT and returns its rows.
 *
 * `--json` rather than parsing the table wrangler prints, because that table
 * is a display format and has changed shape between wrangler versions.
 *
 * @param {string} db
 * @param {string} sql must be a SELECT; nothing here writes
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
```

### scripts/restore-drill.mjs:233 (WHY, shortened)

why the payload is located rather than parsed whole.

```js
/*
   * The JSON is preceded by wrangler's banner, so the payload is located by its
   * first `[` rather than by parsing the whole stream. A banner that changes
   * shape then costs nothing, where `JSON.parse(stdout)` would fail on it.
   */
```

### scripts/restore-drill.mjs:245 (WHY, shortened)

why the runner cannot be used and what replaces the bookkeeping table; the measurement and the refusal text go to the history document.

```js
/**
 * The migration files, in apply order.
 *
 * `wrangler d1 migrations apply` CANNOT be used against the scratch database
 * and this is not a preference. Measured 2026-09-08 in the installed wrangler:
 * that subcommand resolves `migrations_dir` out of the d1_databases entry whose
 * name or binding matches, and refuses with "Couldn't find a D1 DB with the
 * name or binding" for anything absent from the config file. A database created
 * at runtime is absent by construction, and adding it would mean writing to
 * `wrangler.jsonc`, which is gitignored and is not this gate's to edit.
 *
 * So the files are applied directly, in sorted order, which is the same order
 * and the same bytes the migrations runner would have used. The one thing that
 * is lost is the `d1_migrations` bookkeeping table, which is why the integrity
 * query does not compare it: it would be 0 against production's row per file,
 * and "fixing" that with a hand INSERT would write a second truth into a
 * derived store (hard rule 18). What replaces it is the SCHEMA comparison
 * below, which is the assertion the row count was standing in for anyway.
 *
 * @returns {Promise<string[]>}
 */
```

### scripts/restore-drill.mjs:272 (WHY, shortened)

why derived, in one line.

```js
/**
 * The tables the migrations create, minus the fts5 virtual tables.
 *
 * DERIVED from `drizzle/`, never hardcoded, for the reason `check:backup`
 * states: a hardcoded list that silently stops covering a new table is the
 * exact failure a backup gate exists to catch, and it has happened in this
 * portfolio.
 *
 * @returns {Promise<string[]>}
 */
```

### scripts/restore-drill.mjs:282 (WHY, shortened)

why order matters despite the PRAGMA, and why the edges are derived; both measured runs go to the history document.

```js
/**
 * The tables in DEPENDENCY ORDER, parents before children.
 *
 * ## WHY ORDER, WHEN THE EXPORT ALREADY DEFERS FOREIGN KEYS
 *
 * Every file `wrangler d1 export` writes opens with its own
 * `PRAGMA defer_foreign_keys=TRUE`, so the obvious reading is that order does
 * not matter. It does, and this cost two full drill runs to see.
 *
 * MEASURED 2026-09-08. Alphabetical order failed on `account` and `post_tags`,
 * which are exactly the two tables whose parents (`user`, `posts` and `tags`)
 * sort after them. Concatenating everything into one file with the PRAGMA at
 * the top then failed differently: D1 reported "the application left the
 * database in a state where constraints were violated" and rolled the whole
 * thing back, with production carrying ZERO orphans in all three relations,
 * confirmed by a LEFT JOIN count per relation.
 *
 * `defer_foreign_keys` is reset at every COMMIT, and `d1 execute --file`
 * batches a file across more than one transaction. So the deferral only ever
 * covers one batch, and a child that lands in an earlier batch than its parent
 * fails whatever the PRAGMA says. Order is the thing that actually works, and
 * it is the instruction `docs/RUNBOOK.md` gives a human for the same reason.
 *
 * ## DERIVED, NOT LISTED
 *
 * The edges are parsed out of the `REFERENCES` clauses in `drizzle/`. A
 * hardcoded order would be correct today and silently wrong the first time a
 * migration adds a relation, which is the same failure mode `check:backup`
 * refuses for its table list.
 *
 * @returns {Promise<string[]>}
 */
```

### scripts/restore-drill.mjs:336 (WHY, shortened)

why the caller asserts it and what the silent zero is.

```js
/*
   * A NON-EMPTY EDGE SET IS ASSERTED BY THE CALLER, not here, because this
   * function's failure mode is a silent zero: a regex that stops matching the
   * CREATE TABLE shape returns every table with no parents, which sorts
   * alphabetically and reproduces the exact defect this exists to fix.
   */
```

### scripts/restore-drill.mjs:389 (WHY, shortened)

why the shadow tables, in two lines.

```js
/**
 * The integrity questions, IN THE SPELLING `/api/health` USES.
 *
 * The three index counts are taken on the `_docsize` shadow tables, because
 * `COUNT(*)` on an external-content fts5 table reads through to its content
 * table and can never disagree with it. That is `check:invariants` section 7's
 * rule and the reason `app/lib/health/checks.server.ts` is written this way; a
 * drill that counted the virtual tables directly would compare two numbers that
 * are the same number by construction and pass on a broken index.
 */
```

### scripts/restore-drill.mjs:406 (CONTRACT, shortened)

why sqlite_master and why the DDL comes with it.

```js
/**
 * Every table SQLite itself knows about, for the schema comparison.
 *
 * `sqlite_master` rather than a name list, and the DDL comes with it so
 * `classifySqliteTables` can separate virtual tables from their shadows by the
 * rule rather than by a suffix list that differs across fts5 versions.
 */
```

### scripts/restore-drill.mjs:415 (CONTRACT, shortened)

whose tables these are, in two lines.

```js
/**
 * Tables D1 and wrangler create for their own bookkeeping. Not ours, no
 * migration declares them, and they are not part of a content restore. The
 * same set `check:backup` excludes, and `d1_migrations` is in it here for the
 * additional reason given on `migrationFiles`.
 */
```

### scripts/restore-drill.mjs:429 (WHY, shortened)

why a sweep exists and why it is bounded; the two leaked names go to the history document.

```js
/*
   * SWEEP FIRST. The `finally` below deletes this run's database, and a
   * `finally` does not run on a hard kill.
   *
   * MEASURED, twice, while building this gate: killing the drill mid-run left
   * `restore-drill-2026-09-08-16944` and `restore-drill-2026-09-08-788` behind,
   * and nothing in the drill would ever have noticed. That is the same shape as
   * the queued `check:browser` child-cleanup item: cleanup that only exists on
   * the happy path is cleanup that accumulates.
   *
   * Only databases carrying the prefix, and only ones older than the window, so
   * a concurrent run cannot delete the database another run is using. The count
   * is REPORTED rather than silent: a sweep that is quietly removing something
   * every week is a leak nobody is fixing.
   */
```

### scripts/restore-drill.mjs:446 (WHY, shortened)

why it is parsed outside the branch, in two lines.

```js
/*
   * PARSED ONCE, OUTSIDE THE SWEEP'S `if`, because two things need it and they
   * need it with opposite tolerances. The sweep is best-effort: a failed list
   * means nothing gets swept this run and the next run catches up. The UUID
   * resolution below is load-bearing and fails closed, so it cannot sit inside
   * a branch that a failed list silently skips.
   */
```

### scripts/restore-drill.mjs:457 (WHY, shortened)

why there is no fallback, in one line.

```js
/*
   * FAILS CLOSED, and loudly. Falling back to the name here would substitute a
   * different value for the one that was asked for and reintroduce exactly the
   * 7404 this lookup exists to remove, except now wearing a passing lookup.
   */
```

### scripts/restore-drill.mjs:500 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 1. the export, from production, READ ONLY ---------------------- */
```

### scripts/restore-drill.mjs:510 (WHY, shortened)

the silent fallback the scope check catches.

```js
/*
     * THE EDGE PARSE IS PROVEN NON-EMPTY, because its failure is a silent
     * alphabetical fallback. A `REFERENCES` regex that stops matching returns
     * every table with no parents, `orderedTables` then emits them in the
     * order `migrationTables` found them, and the load fails exactly the way
     * it failed before the ordering existed. This repo has shipped that shape:
     * a zero from a search proves nothing until the scope is proven non-empty.
     */
```

### scripts/restore-drill.mjs:533 (WHY, shortened)

why there is no status check and which throw is load-bearing.

```js
/*
       * NO STATUS CHECK AFTER THIS, and the absence is deliberate.
       *
       * There was one: `if (exported.status !== 0) throw`. It could not fire.
       * `retryRead` returns whatever the inner function RETURNED, and that
       * function throws on a non-zero status, so the only value that can reach
       * a caller here already has `status === 0`; every other path rejects out
       * of `retryRead` and never reaches the next line. Hard rule 10's first
       * class, an unfailable condition, and the second reader of this file
       * would have taken it for the failure handling.
       *
       * The throw INSIDE the callback is the load-bearing one: wrangler returns
       * on a failed command rather than rejecting, so without it `retryRead`
       * would have nothing to catch and would retry nothing.
       */
```

### scripts/restore-drill.mjs:562 (WHY, shortened)

why progress is printed, in one line.

```js
/*
     * PROGRESS, because this gate is minutes of network round trips and the
     * first version printed nothing between its banner and its first failure.
     * A long silence is indistinguishable from a hang, and the reader's only
     * recourse was to go and look in `wrangler d1 list`.
     */
```

### scripts/restore-drill.mjs:580 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 2. production's own answers, READ ONLY -------------------------- */
```

### scripts/restore-drill.mjs:592 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 3. build the scratch database ---------------------------------- */
```

### scripts/restore-drill.mjs:625 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 3a. a migrated database is NOT an empty one --------------------- */
```

### scripts/restore-drill.mjs:627 (WHY, shortened)

the collision, the reverse order and why no index can reach the list; the measurement goes to the history document.

```js
/*
     * MIGRATIONS SEED, AND A SEED COLLIDES WITH A RESTORE.
     *
     * MEASURED 2026-09-08, on the run after the load order was fixed:
     * "UNIQUE constraint failed: settings.key". `drizzle/0001_init.sql` inserts
     * a `settings` row, so applying the migrations leaves a database that is
     * schema-correct and already carries data. The dump then tries to insert
     * the same primary key and the whole transaction rolls back.
     *
     * This is not an artefact of the drill. It is what happens to a human
     * following the restore steps, and it presents as "the backup is corrupt"
     * rather than as "the schema step seeded a row". `docs/RUNBOOK.md` carries
     * the same clearing step for the same reason.
     *
     * REVERSE dependency order, so a child is emptied before its parent and no
     * delete trips a foreign key.
     *
     * ONLY REAL TABLES. `orderedTables` is built from `CREATE TABLE`, which
     * does not match `CREATE VIRTUAL TABLE`, so no fts5 index can reach this
     * list. That matters: hard rule 2 forbids `DELETE FROM` against an index,
     * and the repair there is `('rebuild')`, which step 4 does.
     */
```

### scripts/restore-drill.mjs:661 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 4. load the dump ------------------------------------------------ */
```

### scripts/restore-drill.mjs:663 (WHY, shortened)

why one file and what the PRAGMA buys; the two failing tables and the per-table history go to the history document.

```js
/*
     * ONE FILE, WITH FOREIGN KEYS DEFERRED, and both halves were measured
     * rather than chosen.
     *
     * The first version of this drill loaded one file per table in the sorted
     * order the export produced. `account` and `post_tags` both failed, and
     * they are exactly the two tables with a parent: `account` references
     * `user` and `post_tags` references `posts`, and both parents sort AFTER
     * their child. A per-table restore is therefore order-dependent in a way
     * that alphabetical order gets wrong, which is a defect in the RUNBOOK's
     * instructions as much as in this gate.
     *
     * `PRAGMA defer_foreign_keys = true` holds enforcement until the end of
     * the transaction, so the whole set lands and the constraints are checked
     * once everything is present. That is what makes the order irrelevant, and
     * it is a real restore rather than a restore with the checks turned off:
     * a genuinely broken reference still fails at commit.
     *
     * `docs/RUNBOOK.md` documents THIS path, not the per-table one, because
     * this is the path that has been rehearsed.
     */
```

### scripts/restore-drill.mjs:705 (WHY, shortened)

the citation and what makes the equalities meaningful.

```js
/*
     * THE INDEXES ARE REBUILT, NOT RESTORED. Hard rule 2: an fts5 virtual table
     * cannot be exported, and the repair is `('rebuild')` rather than a
     * `DELETE FROM`. So the restore's index half is a derivation from the
     * content tables, which is also what makes the equality assertions below
     * meaningful: they compare a rebuilt index against restored content.
     */
```

### scripts/restore-drill.mjs:734 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 5. the restored database answers the same questions ------------- */
```

### scripts/restore-drill.mjs:745 (WHY, shortened)

why per column rather than one deep-equal.

```js
/*
       * ONE NAMED ASSERTION PER COLUMN, rather than one deep-equal over the
       * row. A single "the rows match" assertion fails with both objects
       * printed and leaves the reader to diff them at 2am; these fail by the
       * name of the thing that disagreed, which is what the prompt for this
       * gate asked for and what makes a red run actionable.
       */
```

### scripts/restore-drill.mjs:766 (WHY, shortened)

what this drill can say that nothing else can.

```js
/*
       * THE INDEX EQUALITIES ARE ASSERTED WITHIN THE RESTORED DATABASE, not
       * against production. Production's own equality is `/api/health`'s job
       * and is checked every fifteen minutes; what this drill can say that
       * nothing else can is whether a REBUILD over RESTORED content produces
       * an index that agrees with it.
       */
```

### scripts/restore-drill.mjs:791 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 5a. the SCHEMA, both sides ------------------------------------- */
```

### scripts/restore-drill.mjs:793 (WHY, shortened)

what the comparison replaces and why both sides use one classifier; RECOVERY.md's dated observation goes to the history document.

```js
/*
     * THE ASSERTION `d1_migrations` WAS STANDING IN FOR, made directly.
     *
     * RECOVERY.md records this comparison as a DATED observation: "measured
     * 2026-08-04 by applying every migration then present to an empty database
     * and diffing object by object against the live schema. 57 of 57 matched."
     * Its own next sentence says two migrations have landed since, so it is a
     * record and not a current claim. This makes it re-runnable, which is what
     * hard rule 17 asks of any number somebody wants to keep believing.
     *
     * Both sides are classified by the same function, so a virtual table and
     * its shadows are separated by the DDL rather than by a suffix list, and
     * the platform's own bookkeeping is excluded from both sides identically.
     */
```

### scripts/restore-drill.mjs:845 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 6. the media mirror, EVERY key -------------------------------- */
```

### scripts/restore-drill.mjs:847 (WHY, shortened)

why not a sample and what this adds over the health poll; the bucket's object count goes to the history document.

```js
/*
     * EVERY KEY, NOT A SAMPLE.
     *
     * The prompt for this gate asked for a random sample of 20 keys with
     * matching etags. Measured 2026-09-08: `dustinedwards-media` holds ONE
     * object. A sample of 20 drawn from a population of 1 is the zero-scope
     * vacuity hard rule 10 forbids, and it would report a plausible number
     * having verified one object. It is also strictly weaker than what already
     * runs: `media-backup-drift` compares both key sets and every etag in full
     * on every health poll, and `app/lib/media/backup.server.ts` owns that
     * comparison rule. This reads the same two buckets from outside the Worker,
     * so the mirror is asserted by something that is not the thing maintaining
     * it, and it counts what it examined so a zero cannot read as a sweep.
     */
```

### scripts/restore-drill.mjs:878 (WHY, shortened)

why size corroborates and why the rule is restated here.

```js
/*
       * ETAG, corroborated by SIZE, and degrading to size for a multipart
       * etag. The same rule `backup.server.ts` states, restated here only
       * because this runs outside the Worker and cannot import it; the reason
       * lives there and is not duplicated.
       */
```

### scripts/restore-drill.mjs:908 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---- 7. the scratch database always goes away ---------------------- */
```

### scripts/restore-drill.mjs:925 (NUMBER, shortened)

what the count moves with; the measurement, the date and the two earlier readings go to the history document.

```js
/*
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed: 35
   * on the first fully green run, 2026-09-08. Floor 32, which is the count
   * minus the `check:floors` tolerance at that count.
   *
   * The count moves with the number of MIGRATION FILES, since each one is its
   * own assertion, and that only ever goes up. It does NOT move with the table
   * list any more: the load is one assertion over one combined file rather
   * than one per table, which is why the first two runs read 42 and 33.
   */
```

### scripts/restore-drill.mjs:945 (WHY, shortened)

why exitCode; the measurement goes to the history document.

```js
/*
   * `exitCode` rather than `process.exit()`, on check:uptime's measurement:
   * `process.exit()` tears the process down while libuv still holds queued
   * stdout writes on Windows and the gate exits 127 with its output lost.
   */
```

## scripts/check-config.mjs

### scripts/check-config.mjs:1 (CONTRACT, shortened)

the subject, the two pairs, the boundary and what is and is not compared; the images-binding incident, the conventions quotation and the aged boundary note go to the history document.

```js
/**
 * Gate over the wrangler configs: every committed `.example` must declare the
 * same BINDING SURFACE as the real file beside it.
 *
 * TWO PAIRS SINCE 2026-08-29. The site (`wrangler.jsonc`) and the watchdog
 * Worker (`wrangler.watchdog.jsonc`). Both real files are gitignored and both
 * examples are tracked, for the same portfolio reason; the watchdog's redacted
 * value is an inbox address rather than an account-scoped id, which is why the
 * placeholder rule is per-entry rather than "a run of zeros" everywhere.
 *
 * OBSERVATION BOUNDARY: compares each pair to itself. It does not ask
 * Cloudflare whether any of these resources EXIST, so a binding naming a
 * deleted bucket passes, a service binding naming a Worker nobody deployed
 * passes, and it only knows the binding kinds `surfaceOf()` enumerates: a new
 * kind is invisible until added there.
 *
 * **THE CRON HALF MOVED INSIDE THAT BOUNDARY ON 2026-09-07.** This note used to
 * say the gate "cannot tell whether a cron TRIGGER is actually registered on
 * the deployed Worker, only what the config asks for; that half is proven live
 * by the freshness assertion in check:browser". That was a boundary note, which
 * FAILURES.md classes as a claim that ages, and it aged: `check:browser`'s
 * freshness assertion proves the WATCHDOG's cron fires and says nothing about a
 * cron registered on the SITE Worker that should not exist. One was, for fifteen
 * days. `--remote` now reads the registered schedules and compares them to the
 * declared set in both directions. WITHOUT `--remote` the old limitation still
 * holds exactly as written.
 *
 * Why this exists. The real config is gitignored portfolio-wide
 * (capsid/conventions.md, "Public-repo hygiene": secrets live in
 * `wrangler secret`, real wrangler.jsonc is gitignored, commit an example with
 * placeholder ids). The example is therefore the ONLY description of a Worker's
 * bindings that a fresh clone can see, and `scripts/bootstrap-config.mjs`
 * copies each into place on install.
 *
 * That mechanism has one failure mode and it happened: on 2026-08-02 an
 * `images` binding was added to the real config and not mirrored into the
 * example, so a clone would have built a site whose media thumbnails silently
 * degraded to full-resolution originals. Nothing compared the two files, so the
 * drift was invisible until someone went looking.
 *
 * This is the house rule for exactly that shape, from conventions.md: "Where
 * code hardcodes a list that mirrors schema or filesystem state, add a test that
 * derives the expected list from the source of truth and fails in both
 * directions: missing entries and orphaned ones."
 *
 * WHAT IS COMPARED: binding names, their kinds, and the non-identifying
 * settings (resource names, class names, compat date and flags, migrations,
 * cron triggers). WHAT IS NOT: the account-scoped resource identifiers,
 * `database_id` and the KV namespace `id`, which are exactly what the example is
 * meant to hold placeholders for. Comparing those would demand the example carry
 * real ids and defeat the convention this gate protects.
 *
 * FAILS CLOSED. A missing or unparseable file is a failure, never a skip: a
 * gate that passes when it cannot read its inputs is the class of silent pass
 * conventions.md was written about.
 */
```

### scripts/check-config.mjs:73 (WHY, shortened)

why it is declared here; the ReferenceError run goes to the history document.

```js
/**
 * Whether the caller asked for the live half.
 *
 * DECLARED HERE rather than beside the floor that reads it, because the
 * `--remote` block runs long before that point and a `const` further down the
 * module is in the temporal dead zone when it does. Caught by running both
 * modes: each exited 1 with a ReferenceError and printed no floor line at all,
 * which is the shape worth noticing, since a gate that dies before its floor
 * prints has no floor.
 */
```

### scripts/check-config.mjs:103 (WHY, shortened)

what the map holds and why the shape is per entry.

```js
/**
 * Vars whose VALUE is deliberately not committed: name to reason and to what a
 * legal placeholder looks like.
 *
 * Self-policing in both directions: an entry naming a var no config declares
 * fails below, and a var in here must match its placeholder shape in the
 * example rather than merely differing from the real value.
 *
 * THE PLACEHOLDER SHAPE IS PER ENTRY, since the watchdog landed. It used to be
 * "a run of zeros", which is right for an id and impossible for an email
 * address. `example.com` is RFC 2606 reserved, so the watchdog's placeholder
 * cannot be a real inbox by construction, which is the same property a row of
 * zeros has for an id: not merely different from the real value, but incapable
 * of being anyone's.
 *
 * @type {Map<string, { why: string, placeholder: RegExp, shape: string }>}
 */
```

### scripts/check-config.mjs:145 (CONTRACT, shortened)

why one routine rather than two.

```js
/**
 * Compares one real config against its tracked example.
 *
 * SHARED BY BOTH PAIRS rather than written twice. Two comparison routines
 * walking two configs is the mirror this gate's own docblock warns about: a
 * check tightened on one pair and forgotten on the other fails in the direction
 * that never reports, by comparing less and saying nothing.
 *
 * @param {{
 *   label: string,
 *   realPath: string,
 *   examplePath: string,
 *   floor: number,
 *   measured: number,
 *   settingKeys: string[],
 * }} pair
 * @returns {{ real: any, example: any, surface: Map<string, string> }}
 */
```

### scripts/check-config.mjs:190 (WHY, shortened)

how two blind surfaces agree; the plant goes to the history document.

```js
// A binding KIND no reader understands is absent from BOTH surfaces, so the
  // two agree by being equally blind and this gate passes. Found by planting
  // `vectorize` in the example and watching check:stack pass; the same hole was
  // here. Reported against both files, since either may carry it.
```

### scripts/check-config.mjs:214 (NUMBER, shortened)

what `> 0` cannot see; the sweep's date and the measurement go to the history document.

```js
/*
   * AND A FLOOR, not just a non-empty check, added by the 2026-08-24 floor sweep.
   *
   * `> 0` is the weakest form of this assertion and it was the only form here.
   * The failure it cannot see is the one that actually happens: `surfaceOf()`
   * stops recognising a binding TYPE, so nine of ten bindings parse and the tenth
   * silently drops out of both sides of the comparison. Two configs that both
   * omit the same binding compare equal, which is exactly the drift this gate
   * exists to catch, and `> 0` reports it as a clean run.
   *
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by running it, per pair. Floored
   * just under, because each binding set is small and hand-maintained: it moves
   * when a binding is added, in the same commit that adds it to both files.
   */
```

### scripts/check-config.mjs:272 (WHY, shortened)

why vars are compared at all, and the two-questions distinction; the discovery date and both examples go to the history document.

```js
/*
   * PLAIN VARS, BOTH DIRECTIONS, keys and values.
   *
   * `surfaceOf()` carries BINDINGS, and a var is not a binding, so before this
   * block the `vars` object was compared by nothing at all: a var added to
   * wrangler.jsonc and forgotten in the example would reach the running Worker
   * and be absent from every clone, which is the exact drift this gate exists to
   * catch for everything else. Found 2026-08-14 while adding the first var.
   *
   * VALUES are compared, not just names, and that is deliberate. A var is by
   * definition not a credential (a credential goes in `wrangler secret`), so the
   * example can usually carry the real value and there is nothing to redact.
   *
   * NOT-A-CREDENTIAL AND NOT-COMMITTABLE ARE TWO DIFFERENT QUESTIONS, and an
   * earlier version of this paragraph collapsed them. `CLOUDFLARE_ACCOUNT_ID` is
   * an identifier: it grants nothing on its own, which is why it is a var and not
   * a secret. It is also ACCOUNT-SCOPED, and the portfolio rule keeps
   * account-scoped identifiers out of git. `ALERT_EMAIL` is the second instance
   * of the same distinction wearing different clothes: an inbox address grants
   * nothing either, and belongs out of git for a different reason, that this repo
   * gets copied.
   *
   * So a var may be REDACTED, by name, with its reason, and the redaction is
   * checked in both directions: the example must carry a placeholder of the
   * declared SHAPE and must not carry the real value.
   */
```

### scripts/check-config.mjs:338 (WHY, shortened)

what an invocation log carries and why parity is not the property; the date goes to the history document.

```js
// Observability. Not a binding, so surfaceOf() cannot carry it, and nothing
  // compared it until 2026-08-14. It stopped being a debugging preference then:
  // an invocation log is enriched with the request context, which measurably
  // included `request.headers.cookie` and `cf-connecting-ip`, so leaving those
  // records on persists full reader IPs and session cookies for 7 days. There is
  // no field-level redaction, so `invocation_logs: false` IS the mechanism.
  //
  // Parity is not the property. Both files could be flipped back together and
  // stay consistent, so the VALUE is asserted in each, and `enabled` is asserted
  // true alongside it: turning observability off wholesale would also satisfy an
  // invocation_logs check while silently ending error visibility.
```

### scripts/check-config.mjs:377 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ======================================================== the site Worker */
```

### scripts/check-config.mjs:393 (WHY, shortened)

what a clone without it would do, in two lines.

```js
// Workers Cache is not a binding, so surfaceOf() cannot carry it, but it is
// exactly the kind of setting this gate exists for: a clone that built without
// it would re-decode and re-encode every thumbnail and never say so.
```

### scripts/check-config.mjs:401 (WHY, shortened)

why the value is asserted and not just parity.

```js
// PARITY IS NOT THE PROPERTY. The comparison above passes with the cache turned
// OFF in both files, which is the state `workers/app.ts` is written against:
// its `private, no-store` default exists precisely because a response with no
// Cache-Control is cached rather than skipped. Turning the block off in both
// places would be a silent, symmetric change to what the Worker's fail-closed
// default is defending. Asserted by VALUE, in both files, for that reason.
```

### scripts/check-config.mjs:424 (WHY, shortened)

what the length check makes explicit; the simplification account goes to the history document.

```js
// SIMPLIFIED 2026-08-29, behaviour preserving. The original was a disjunction
// whose first arm stripped the dashes, prepended an "x" when the string was
// empty, and then tested a pattern the second arm already covered; both arms
// rejected the empty string and every real id, so this is the same predicate
// written once. The length check makes the empty case explicit rather than
// incidental.
```

### scripts/check-config.mjs:440 (WHY, shortened)

why a word and not a NUL; the arrival-as-a-byte account goes to the history document.

```js
/*
 * THE SENTINEL IS A WORD, NOT A NUL, and that is not a style preference.
 *
 * These two comparisons need a fallback that can never equal a real id, so a
 * real config missing the field cannot make the assertion pass by accident.
 * The value here used to be a literal NUL, and `check:head`'s preflight refuses
 * one anywhere under `scripts/`, `app/` or `workers/` for a good reason: a NUL
 * makes git render the file as BINARY and makes ripgrep skip it in a directory
 * search, so every later change to this gate would ride in unreviewed and
 * invisible to a repo-wide grep.
 *
 * It arrived here as a byte rather than as an escape, which is the same class
 * VERIFICATION.md records for a backspace that reached a script as 0x08 and
 * displayed correctly while matching nothing. Caught by `check:head` on the run
 * before this one. A readable word is a better sentinel anyway: it survives
 * being printed into a failure message.
 */
```

### scripts/check-config.mjs:466 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ==================================================== the watchdog Worker */
```

### scripts/check-config.mjs:468 (WHY, shortened)

what described the watchdog before, and why workers_dev is asserted false; the date goes to the history document.

```js
/*
 * ADDED 2026-08-29. The watchdog is a second Worker with its own config, its
 * own cron and its own redacted var, and before this it was described by
 * nothing: a binding added to it and forgotten in the example would have been
 * invisible in exactly the way the `images` binding was in August.
 *
 * `main` is compared like the site's. `workers_dev` is compared AND asserted
 * false in both, on the cache block's reasoning: parity is not the property,
 * because both files could be flipped together. This Worker exports `scheduled`
 * and nothing else, so a public route would answer errors to anyone who found
 * it and would be a second way in to a Worker holding the operator token.
 */
```

### scripts/check-config.mjs:507 (WHY, shortened)

who owns the cron and why exactly one; the section-25 history goes to the history document.

```js
/*
 * THE CRON, AND THIS CONFIG IS NOW ITS ONE OWNER.
 *
 * `HEALTH_POLL_INTERVAL_SECONDS` in app/lib/health/snapshot.mjs decides when
 * the home page calls its health verdict stale. Until 2026-08-29 that number
 * was bound to `.github/workflows/health.yml`'s cron by `check:invariants`
 * section 25. The watchdog now sets the pace and health.yml is the hourly
 * second opinion, so section 25 parses THIS file instead. The binding lives
 * there; what lives here is that the trigger exists, that there is exactly
 * ONE of it, and that it means fifteen minutes.
 *
 * EXACTLY ONE, because section 25 compares one schedule against one constant
 * and cannot arbitrate between two. Asserted in both files: a cron in the real
 * config and none in the example describes a Worker a clone would deploy
 * without a schedule, which is a watchdog that never fires and says nothing.
 */
```

### scripts/check-config.mjs:551 (WHY, shortened)

why absent is not empty and why present-and-array; the stray cron's dates go to the history document.

```js
/*
 * THE SITE'S CRON SET IS DECLARED, AND DECLARING IT EMPTY IS THE POINT.
 *
 * Added 2026-09-07. `triggers` was ABSENT from both site configs, and absent
 * is not empty: wrangler syncs the cron set from that key, so with no key it
 * leaves whatever is registered on the account untouched. An hourly
 * `0 * * * *` created 2026-08-23 sat on this Worker, which exports no
 * `scheduled()`, and threw on every firing for fifteen days. Grounds and the
 * measurement are in `wrangler.jsonc.example`.
 *
 * ASSERTED AS PRESENT-AND-ARRAY rather than merely equal to each other. Two
 * files that both omit the key agree perfectly, which is exactly the state
 * that hid the defect, so "they match" is not a strong enough assertion here.
 */
```

### scripts/check-config.mjs:584 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ================================================ both, against the tree */
```

### scripts/check-config.mjs:596 (WHY, shortened)

what the per-field assertions miss and why the needles are read; the ae-probe incident goes to the history document.

```js
/*
 * THE REAL REDACTED VALUES APPEAR IN NO TRACKED FILE.
 *
 * The placeholder assertions above each police ONE field in ONE file. They say
 * nothing about the same digits being written into a script, which is where the
 * account id actually was: `scripts/ae-probe.mjs` carried it as a const, and the
 * example carried it as a var, and both were committed while the database id
 * beside them was a row of zeros.
 *
 * The needles are READ OUT OF THE REAL CONFIGS, never typed here. A gate that
 * restated the digits it is hunting would be the next committed copy. The
 * watchdog's alert address joined the hunt in the same commit that introduced
 * it, so it can never become the thing this paragraph describes.
 *
 * Scoped to `git ls-files`, which is the definition of "committed" that
 * matters: the real configs are gitignored and are expected to contain them.
 */
```

### scripts/check-config.mjs:622 (WHY, shortened)

both arms, and why the floor is on the count.

```js
/*
   * SCOPE, ASSERTED, on both halves. An empty needle list finds nothing because
   * it looked for nothing, and a short one would match noise; the length filter
   * above is why the floor is on the COUNT rather than on the values.
   */
```

### scripts/check-config.mjs:667 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* =================================================== the traces ruling */
```

### scripts/check-config.mjs:669 (WHY, shortened)

what a span carries and why explicitly-false; the ruling's date and the redact aside go to the history document.

```js
/*
 * TRACES STAY OFF ON BOTH WORKERS, and this asserts the RULING rather than the
 * default.
 *
 * Ruled 2026-09-08: export logs to Sentry, never traces. A fetch span carries
 * `url.full`, `url.path` and `url.query`, and this site puts a 43-character
 * capability in a path at `/preview/<token>`, so traces would ship preview
 * tokens to a third party. That is the exposure `recordTraffic` was fixed for
 * on 2026-08-15. `redact_query_string` does not reach it, because the token is
 * in the path. Full grounds are in `wrangler.jsonc.example`.
 *
 * ASSERTED AS EXPLICITLY-FALSE, not merely falsy. `traces` absent is also
 * "off", and it is off by somebody not having decided; `{ enabled: false }` is
 * off because somebody decided. The distinction is the whole of the
 * cold-audit rule this implements, so a config that DROPPED the key would pass
 * a truthiness check and fail this one.
 *
 * Adding `destinations` to `logs` later does not touch this. That is the point
 * of splitting the two: the log export can be turned on without anyone having
 * to reason again about what a span carries.
 */
```

### scripts/check-config.mjs:712 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ============================================ --remote: the live schedules */
```

### scripts/check-config.mjs:714 (WHY, shortened)

what the live half adds, why it is behind a flag and why it fails closed; the aged boundary note and the stray cron's dates go to the history document.

```js
/*
 * THE ONE ASSERTION THIS GATE COULD NOT MAKE, until 2026-09-07.
 *
 * The docblock at the top of this file used to say, correctly, that it "cannot
 * tell whether a cron TRIGGER is actually registered on the deployed Worker,
 * only what the config asks for; that half is proven live by the freshness
 * assertion in check:browser". That boundary note was a CLAIM, and it aged
 * exactly the way FAILURES.md says a boundary note ages. The freshness
 * assertion proves the WATCHDOG's cron fires. It says nothing about a cron
 * registered on the SITE Worker that should not exist at all, and one was:
 * `0 * * * *`, created 2026-08-23, throwing on every firing for fifteen days
 * because `workers/app.ts` exports no `scheduled()`.
 *
 * So this reads the schedules the platform actually holds and compares them to
 * what the configs declare, IN BOTH DIRECTIONS. A trigger in the config and not
 * on the platform is a Worker that will not fire; a trigger on the platform and
 * not in the config is the defect above.
 *
 * ## WHY IT IS BEHIND `--remote` AND NOT A NEW GATE
 *
 * `check:config` is tiered OFFLINE and ship runs the offline tier, which is
 * what makes it load bearing on the one machine that deploys. Moving it to the
 * network tier to gain this would have taken it out of ship. So it keeps its
 * offline body and gains a network half behind a flag, which is the shape
 * `check:backup`, `check:llms` and `check:invariants` already use and which
 * `check-all.mjs` already knows how to pass through in `check:all`.
 *
 * ## FAILS CLOSED ON A MISSING CREDENTIAL
 *
 * `--remote` was ASKED FOR, so being unable to answer is a failure and not a
 * skip. The house stance, stated in `repair.mjs`: degrading to alert-only is
 * correct, degrading to silence is not. A gate that quietly passed when it
 * could not reach the API would report the same green for "no stray cron" and
 * "I did not look".
 */
```

### scripts/check-config.mjs:802 (WHY, shortened)

why the two directions are named separately.

```js
/*
       * BOTH DIRECTIONS, NAMED SEPARATELY. One assertion comparing two sorted
       * arrays would report "they differ" and leave the reader to work out
       * which way, and the two directions mean genuinely different things.
       */
```

### scripts/check-config.mjs:834 (NUMBER, shortened)

what an empty surface would do; the three dated readings and the guessed figure go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is the only thing binding the tracked examples to the configs that
 * actually run, and both real files are gitignored. If a parse returned an
 * empty surface, every comparison for that pair would iterate nothing and
 * report the two files in perfect agreement.
 *
 * RE-MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-29 by RUNNING it, and
 * NEVER SUMMED: the number below was read off the run, not computed from 61
 * plus an estimate of the watchdog's contribution: the first guess written here
 * was 92 and the run said 95. It was 61 on 2026-08-28 with one pair, and 55 on
 * 2026-08-14. Floored roughly 8 percent under: the count
 * steps by two or three per binding and per var, so a single added binding
 * moves it visibly and a deleted one should be a deliberate diff.
 */
```

### scripts/check-config.mjs:850 (NUMBER, shortened)

why the floor tracks the offline count; the two dated runs and the tolerance arithmetic go to the history document.

```js
/*
 * RE-MEASURED 2026-09-07 BY RUNNING IT, TWICE, and the second time is the
 * lesson. After the site's `triggers` assertions landed the offline run
 * reported 104 and this was set to 100; the watchdog's CLOUDFLARE_ACCOUNT_ID
 * var then took it to 108, and `check:floors` failed the 100 at a gap of 8
 * against a tolerance of 6. That is the mechanism doing its job, and it is why
 * the number here comes from a run rather than from arithmetic on the old one.
 * The floor tracks the OFFLINE count deliberately, because `--remote` adds
 * assertions and a floor set to the remote count would breach on every offline
 * run, which is the tier ship uses.
 */
```

### scripts/check-config.mjs:861 (NUMBER, shortened)

why one name per branch; the measurement and the failing run go to the history document.

```js
/*
 * NAMED PER BRANCH, on check:invariants' vol 15 binding, and this gate needed
 * it the moment `--remote` landed. MEASURED 2026-09-08 by RUNNING each mode:
 * 118 offline, 124 remote. One name for both judges whichever branch ran last
 * against a floor set from the other, which is exactly what happened here: the
 * offline floor of 113 passed a standalone run and then failed inside
 * `check:all`, where the gate runs `--remote` and the extra six schedule
 * assertions push the gap past the tolerance.
 *
 * Tolerance is 6 at both counts, so each floor sits five under its own.
 */
```

### scripts/check-config.mjs:882 (WHY, shortened)

why exitCode, and why a race is worse than a consistent failure; the assertion text goes to the history document.

```js
/*
 * `exitCode` RATHER THAN `process.exit()`, since `--remote` made this gate do
 * network I/O.
 *
 * MEASURED 2026-09-08: the remote branch printed a clean floor line and 0
 * failures and then exited 127 with libuv's
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, because
 * `process.exit()` tears the process down while undici's keep-alive sockets
 * from the schedules API are still closing. It is a RACE, so it did not fire on
 * every run, which is worse than a consistent failure: `check-all.mjs` reads
 * exit codes and cannot see the clean table above one. Same fix, and same
 * reason, as `check:uptime`.
 */
```

## scripts/check-microformats.mjs

### scripts/check-microformats.mjs:1 (CONTRACT, shortened)

the boundary, why a parser, fixture independence and the fail-closed rule; the placement argument, the rejected reader and the practical-effect paragraph go to the history document.

```js
/**
 * Gate: the microformats2 annotations on the public plane, parsed rather than
 * grepped.
 *
 *   npm run check:microformats
 *
 * Item I, ruling 50 as amended: microformats2 only. No `rel="me"`, no social
 * links; social presence lives with germomics. Section 5 holds that half.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It RENDERS THE THREE PUBLIC ROUTE COMPONENTS in Node, through
 * `scripts/lib/route-render.mjs`, the same door `check:admin-ui` uses, and
 * parses the result with `microformats-parser`. So it sees markup and nothing
 * else: no loader, no action, no D1, no network, no CSS, no Worker.
 *
 * What that means in practice, stated so nobody reads a pass here as more than
 * it is. A post whose ROW carries a wrong date renders a wrong date and passes
 * section 1's format assertions; what section 1 actually catches is the route
 * disagreeing with the MARKDOWN, because the expected value is read from the
 * markdown file and the component is fed the pipeline's rendering of the same
 * file. A page that 500s in production still parses here. Enhancement asset
 * URLs are stubbed (see `URL_ASSET`), so nothing about a script `src` is
 * assertable through this harness.
 *
 * ## WHY NOT `check:content`, WHICH IS WHERE THE PROMPT PUT IT
 *
 * That gate's own header states it "never renders a page in a Worker", and its
 * five subjects are the corpus render and four committed artifacts. The
 * microformats classes are in `blog.$slug.tsx`, `blog._index.tsx`,
 * `home.tsx` and `post-card.tsx`, which check:content does not read. Widening
 * it would have meant deleting a boundary note in order to make the file's own
 * description of itself false, which is the failure hard rule 7 names.
 *
 * ## WHY A REAL PARSER AND NOT A REGEX
 *
 * A regex over `class="h-entry"` asserts that a STRING is present. The property
 * that matters is what a CONSUMER READS, and those are not the same claim:
 * `p-name` on a `<div>` wrapping the whole page, `u-url` on an element with no
 * `href`, a `dt-published` on a `<time>` with no `datetime`, an h-card nested
 * one level too deep so it becomes a child rather than an `author` property.
 * Every one of those passes a string search and gives a reader nothing.
 *
 * `microformats-parser` is an exact-pinned devDependency. It does not ship: the
 * Worker never parses its own pages, and `build:stack` reads `dependencies`
 * only, so it does not reach the colophon either.
 *
 * The webmention receiver's own reader was the other candidate and could not
 * do the job. `readAuthor` in `app/lib/webmention/verify.server.ts` is linkedom
 * plus three `querySelector` calls for `.h-card`, `.p-name` and `.u-url`; it
 * has no notion of h-entry, e-content, dt-published, h-feed or p-summary, and
 * it imports `~/db`, so a Node gate cannot load it at all. Measured 2026-09-10.
 *
 * ## FIXTURE INDEPENDENCE
 *
 * Hard rule 10: a gate's expected values are never produced by the process it
 * checks. `dt-published` is compared against the `date:` line read straight out
 * of `content/posts/<slug>.md` by `frontmatterDate` below, which is a
 * deliberately separate read from the pipeline's. The component is fed the
 * PIPELINE's `publishAt`. So the chain under test is markdown to pipeline to
 * component to attribute, and a defect anywhere along it reds by slug.
 *
 * ## FAILS CLOSED
 *
 * A corpus with no published posts, a route that renders nothing, a parse that
 * finds no items: each is a failure with a name, never an empty pass. Every
 * section pairs its assertions with a count, and the whole gate carries an
 * executed-count floor measured by running.
 */
```

### scripts/check-microformats.mjs:91 (CONTRACT, shortened)

why this argument order and the citation, in two lines.

```js
/**
 * The reporter. `assert(label, ok, detail)` argument order, which is one of the
 * three shapes in this repo and is deliberately not the other two: a call
 * copied out of a gate using `ok(label, condition, detail)` is a ReferenceError
 * here rather than a silent pass. Hard rule 10, ninth class.
 *
 * @param {string} label
 * @param {boolean} passed
 * @param {string} [detail]
 */
```

### scripts/check-microformats.mjs:106 (WHY, shortened)

why a second read, why the scope is bounded and where the path comes from; the section 15b catch goes to the history document.

```js
/**
 * The `date:` line from a post's frontmatter, as an ISO instant.
 *
 * A SECOND, NARROW READ ON PURPOSE. The pipeline parses frontmatter with
 * gray-matter and produces `publishAt`; if this gate asked the pipeline for the
 * expected value it would be comparing the pipeline against itself and the
 * whole assertion would be `x === x`. So this reads the file's own bytes and
 * takes the first `date:` inside the opening `---` block.
 *
 * The scope is bounded to the frontmatter block rather than the whole file so a
 * `date:` written in prose cannot be mistaken for the field, and the needle is
 * anchored to the start of a line for the same reason.
 *
 * THE PATH COMES FROM `postPath()`, not from a join here. Hard rule 6 says the
 * `content/posts/<slug>.md` shape is stated once by that export, and the first
 * version of this file stated it four more times. `check:invariants` section
 * 15b caught all four on the first tier run, which is the gate doing exactly
 * what it exists for to a gate that had just been written.
 *
 * @param {string} slug
 * @returns {Promise<string>} an ISO instant
 */
```

### scripts/check-microformats.mjs:173 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- The corpus, and the scope proof --------------------------------------
```

### scripts/check-microformats.mjs:175 (WHY, shortened)

why it is built and why the failure is named.

```js
/*
 * BUILT HERE, not read off disk. `content/generated/posts.json` is a gitignored
 * local product and a stale one would have this gate certify a corpus nobody is
 * serving. `buildArtifact()` returns the SERIALISED artifact, which is the
 * shape the file has, so it is parsed back rather than used as an object.
 *
 * It reads `content/generated/stack.json`, which `build:stack` writes, so a
 * fresh checkout that has not built reaches this line with the file absent.
 * The failure is named rather than thrown as ENOENT, because "no such file"
 * about a generated path sends the reader looking for a missing source.
 */
```

### scripts/check-microformats.mjs:200 (WHY, shortened)

the first discipline with its citation, in two lines.

```js
/*
 * SCOPE PROVEN NON-EMPTY BEFORE ANYTHING IS ASSERTED. A sweep over zero posts
 * reports exactly what a clean sweep reports, and this gate's whole first
 * section is a per-post loop. Hard rule 10, first discipline.
 */
```

### scripts/check-microformats.mjs:217 (WHY, shortened)

why one source for expectation and subject, and why its own bundle call; the rejected alternatives go to the history document.

```js
/*
 * `app/lib/seo.ts` RIDES THROUGH THE SAME BUNDLER as the routes, and that is
 * not a convenience. It is TypeScript, so Node cannot import it directly, and
 * the alternatives were both worse: restating `SITE.name` and `SITE_ORIGIN`
 * here would make this gate a second owner of the site's identity (hard rule
 * 17), and reading them out of a rendered page would mean comparing the page
 * against itself.
 *
 * So the expectation and the subject share ONE source, deliberately. The
 * assertion below is "the h-card names the site's author", not "the h-card
 * says a particular string": if `SITE.name` changes, the card must follow it,
 * and that is the property worth holding.
 *
 * IN ITS OWN BUNDLE CALL, and that is not tidiness. esbuild derives `outbase`
 * from the common parent of its entry points, so mixing `app/lib/seo.ts` in
 * with the three `app/routes/*` entries moves the outbase up to `app/` and
 * every output lands under `routes/` and `lib/` instead of flat. The helper
 * maps outputs by basename, so the first import then fails with
 * ERR_MODULE_NOT_FOUND on a path that looks correct. `check:admin-ui` carries
 * the same note at its own single-entry bundle; this is the second victim.
 */
```

### scripts/check-microformats.mjs:284 (WHY, shortened)

why the mentions block is empty here.

```js
/*
     * NO MENTIONS. The mentions block carries no microformats class and is the
     * one region of the page whose text is a stranger's, so feeding it here
     * would put third-party-shaped fixtures into a gate about first-party
     * markup. `check:invariants` and the worker tests own that section.
     */
```

### scripts/check-microformats.mjs:297 (WHY, shortened)

what the wrong field arranged never to see, and the one honest difference; the live parse date goes to the history document.

```js
/*
       * THE SAME SOURCE THE SYNC USES, through the same function.
       *
       * This was `record.updated ?? null`, which is the FRONTMATTER field, and
       * no post in this corpus carries one. So `dt-updated` was absent on every
       * render here while the deployed page carried it on every post, and the
       * gate was asserting a property it had arranged never to see. The live
       * parse on 2026-09-10 is what exposed it.
       *
       * `revisedDate` is `sync-content.mjs`'s own rule, extracted: frontmatter
       * `updated` if present, else the file's last commit date. Feeding it here
       * means this gate renders what production renders rather than a value
       * invented for the fixture.
       *
       * ONE HONEST DIFFERENCE, stated because it is not a bug in either place:
       * when there is no revision date the SYNC writes `unixepoch()` rather
       * than null, so a production row always carries something. Null here
       * renders no revision, which is the same markup a page with no revision
       * shows, and the assertion below is the PAIRING rather than the presence,
       * so it holds either way.
       */
```

### scripts/check-microformats.mjs:336 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- 1. Every published post page is one complete h-entry -----------------
```

### scripts/check-microformats.mjs:355 (WHY, shortened)

why exactly one, in two lines.

```js
/*
   * EXACTLY ONE, not at least one. A page that grew a second h-entry (a related
   * card annotated by mistake, a mention marked up as an entry) publishes two
   * competing answers to "what is this page", and a consumer takes the first.
   */
```

### scripts/check-microformats.mjs:384 (WHY, shortened)

why it is asserted as the body and why by length.

```js
/*
   * e-content IS ASSERTED AS THE BODY, not merely as present. `content` parses
   * to `{ value, html }`, and the html half is what a consumer republishes, so
   * a class landed on an empty wrapper would still satisfy "has content".
   * Compared against the rendered body's own length rather than byte-for-byte:
   * the parser normalises whitespace and resolves relative URLs inside the
   * fragment, so equality would be an assertion about the parser.
   */
```

### scripts/check-microformats.mjs:435 (WHY, shortened)

why the gate is conditional in both directions.

```js
/*
   * dt-updated IS CONDITIONAL AND THE GATE IS CONDITIONAL WITH IT, in both
   * directions. The route shows an updated date only when the revision is
   * further from publication than its own threshold, so requiring the property
   * everywhere would be an unfailable-in-reverse assertion: it would demand
   * markup for a fact most posts do not have. What IS asserted is the pairing.
   * A post whose page shows "Updated" and carries no `dt-updated` is a defect,
   * and so is a `dt-updated` on a page that shows no revision.
   */
```

### scripts/check-microformats.mjs:453 (WHY, shortened)

why the count must not move with the checkout, and where the threshold stays owned; the CI arithmetic goes to the history document.

```js
/*
   * THE VALUE ASSERTION RUNS ON EVERY POST, present or absent, and that is
   * deliberate rather than tidy.
   *
   * Conditioning it on `updated !== undefined` made this gate's assertion count
   * depend on the ENVIRONMENT: a full clone resolves a commit date for every
   * post and ran it eleven times, CI's shallow clone resolves none and would
   * have run it zero. A floor cannot sit under a count that moves with the
   * checkout, and the gate would have gone red on CI for being CI.
   *
   * So the expectation is derived from what the PAGE rendered: if it shows a
   * revision the property must equal the date the sync would write, and if it
   * does not the property must be absent. That defers to the route's own
   * threshold instead of restating it here, which keeps `REVISED_THRESHOLD_MS`
   * owned by the route (hard rule 17) and keeps this count constant.
   *
   * Paired with the presence assertion above, the two cannot both be satisfied
   * by a page that renders a revision it did not have.
   */
```

### scripts/check-microformats.mjs:483 (WHY, shortened)

why the whole-page count is pinned.

```js
/*
   * NOTHING ELSE ON THE PAGE IS A MICROFORMAT. The mentions list is full of
   * author names, source links and timestamps that LOOK like h-entry material,
   * and annotating them would republish a stranger's text as this site's
   * structured data. So the whole-page item count is pinned: one h-entry, one
   * nested h-card, nothing more.
   */
```

### scripts/check-microformats.mjs:506 (WHY, shortened)

why the fixture went and why the split is not asserted; the synthetic control's account goes to the history document.

```js
/*
 * BOTH dt-updated BRANCHES, COUNTED AND PRINTED, and neither is fabricated.
 *
 * A synthetic control used to sit here. It rendered a real post twice with an
 * `updatedAt` this gate invented, thirty days and one hour past publication,
 * and asserted the route's threshold from both sides. It existed because the
 * gate fed `record.updated`, the FRONTMATTER field, which no post in this
 * corpus carries: the property was unreachable on real data and a fixture was
 * the only way to touch it. Meanwhile the deployed page carried `dt-updated` on
 * every post, so the gate was asserting the absence of something production
 * always published.
 *
 * Feeding `revisedDate` removed the need for the fixture. On a full clone every
 * post has a commit date well past its publication, so the PRESENT branch runs
 * against the value the sync would write. On CI's shallow clone
 * `lastCommitDate` legitimately answers null and the ABSENT branch runs. The
 * two environments cover the pair between them, on real inputs.
 *
 * NOT ASSERTED against a fixed split, because which branch runs is a property
 * of the clone rather than of the code, and a gate demanding eleven present
 * would go red on CI for being CI. Printed, so a reader can see which ran.
 */
```

### scripts/check-microformats.mjs:534 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- 2. The blog index is one h-feed, holding the page it rendered --------
```

### scripts/check-microformats.mjs:542 (WHY, shortened)

why the count is derived through the route's own helpers.

```js
/**
 * The index's loader payload for one page, built THROUGH the route's own paging
 * helpers rather than by slicing to a literal.
 *
 * Hard rule 10: measure floors through the gate's own pipeline. The count this
 * section asserts is derived from `POSTS_PER_PAGE` and `splitFeatured`, the two
 * functions the loader itself calls, so a change to the page size moves the
 * expectation and the page together and this gate keeps meaning what it said.
 *
 * @param {number} page
 */
```

### scripts/check-microformats.mjs:572 (WHY, shortened)

why both ends and why a Set.

```js
/*
 * BOTH ENDS OF THE PAGINATION, and the first page is not enough on its own.
 * Page 1 is the only page that can carry a featured post, and the last page is
 * the only one whose length is not the page size. A gate that read page 1 alone
 * would pass a route that rendered ten entries no matter what it was asked for.
 *
 * A SET, because a corpus that fits on one page makes those two the same page
 * and rendering it twice would double this section's count without doubling
 * what it knows. The final assertion compares against `INDEX_PAGES.size` for
 * the same reason: the floor has to be what was actually asked for.
 */
```

### scripts/check-microformats.mjs:617 (WHY, shortened)

what the page actually promises; the refuted prompt goes to the history document.

```js
/*
   * THE COUNT IS THE LOADER'S, NOT A LITERAL AND NOT THE CORPUS SIZE.
   *
   * The prompt asked for "the published count", and that is refuted by this
   * page: /blog paginates at POSTS_PER_PAGE and the corpus is larger, so the
   * index has never carried every published post and an assertion that it does
   * could only pass while the corpus stayed under the page size. What the page
   * genuinely promises is that every post it SHOWS is in its feed, featured
   * post included, and that is what this compares.
   */
```

### scripts/check-microformats.mjs:664 (WHY, shortened)

why paired in both directions.

```js
/*
     * p-summary IS PAIRED WITH THE DESCRIPTION, in both directions. A card
     * renders the description only when the post has one, so requiring the
     * property unconditionally would demand markup for absent data, and
     * accepting its absence unconditionally would let the class fall off every
     * card without a single red.
     */
```

### scripts/check-microformats.mjs:685 (WHY, shortened)

what a consumer would be handed.

```js
/*
     * A LISTING ENTRY CARRIES NO e-content, and this is the assertion that
     * keeps a summary honest. A consumer that finds content on a card has been
     * handed a description labelled as the article.
     */
```

### scripts/check-microformats.mjs:705 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- 3. The home page carries the site author's h-card --------------------
```

### scripts/check-microformats.mjs:707 (WHY, shortened)

why the fixture is derived; the dark-block incident goes to the history document.

```js
/*
 * THE HOME FIXTURE IS DERIVED, NOT SUPPLIED. Ruling 57.
 *
 * This used to be `ordered.find(p => p.featured) ?? ordered[0]` plus two more,
 * which is a THIRD statement of which post leads the front page, written by the
 * gate that is supposed to be checking it. It also asserted a section that
 * production did not render at all: the loader looked for the featured post
 * inside the four newest, the flagship sorts fifth, and the whole block was
 * dark on the live site while this gate reported four happy h-entries.
 *
 * Now the two arrays are built the way `listHomeStartHere`'s two statements
 * build them, `featured = 1` and `featured = 0`, each newest first, and
 * `startHere` makes the decision for both. The gate can no longer hand itself a
 * lead, and if the rule changes in one place this fixture changes with it.
 */
```

### scripts/check-microformats.mjs:770 (WHY, shortened)

why no photo, with its citation, and why the assertion inverts.

```js
/*
   * NO u-photo, ASSERTED. The site publishes no photograph of Dustin: the
   * Person JSON-LD beside this card carries no image and the page renders none.
   * A card claiming one would be pointing a consumer at something that does not
   * exist, which is hard rule 13's substituted value wearing an h-card.
   *
   * This assertion INVERTS the day a photo lands, which is correct: adding one
   * should be a deliberate edit here, not a silent inheritance.
   */
```

### scripts/check-microformats.mjs:819 (WHY, shortened)

what a moved class would do to the entries.

```js
/*
 * THE h-card MUST NOT SWALLOW THE ENTRIES. The card is on `.home-intro` and the
 * Start here list is a sibling, so the entries parse at the top level. If the
 * class ever moved up to `<main>` the entries would become the card's children
 * and every consumer would read three posts as properties of a person.
 */
```

### scripts/check-microformats.mjs:832 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- 4. No rel="me", no social links. Ruling 50. --------------------------
```

### scripts/check-microformats.mjs:834 (WHY, shortened)

why on the rendered pages and why a named list.

```js
/*
 * ASSERTED ON THE RENDERED PAGES, not by grepping the source, because the
 * subject is what a consumer reads. `rel-urls` and `rels` are the parser's own
 * view of every rel on the document, so a `rel="me"` reaches this check however
 * it was written: a literal in JSX, a value composed at render time, or one
 * arriving through a component this gate does not know the name of.
 *
 * The social-network arm is the ruling's other half. It is a NAMED LIST rather
 * than a general "no outbound links" rule, because the site links out
 * constantly and always has; what ruling 50 forbids is these networks.
 */
```

### scripts/check-microformats.mjs:877 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- Report ---------------------------------------------------------------
```

### scripts/check-microformats.mjs:879 (NUMBER, shortened)

what the count is a function of, why the floor is tight and what it costs; three dated re-measurements and the CI proof go to the history document.

```js
/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR.
 *
 * MEASURED BY RUNNING THIS GATE, never summed: 226 on 2026-09-10, over 11
 * published posts, two index pages and the home page. The count is a function
 * of the corpus size (roughly ten per post in section 1, four per card in
 * section 2, and a fixed tail), so it moves when a post is published and steps
 * DOWN when one is unpublished.
 *
 * FLOORED AT 216, AND `check:floors` CHOSE THAT NUMBER RATHER THAN TASTE. Its
 * tolerance is `max(3, ceil(count * 0.05))`, so 226 allows a gap of 12; 216
 * leaves 10. Two earlier values were refused by that gate by name: 190 was a
 * gap of 24, and 205 became a gap of 13 the moment ruling 57 landed.
 *
 * THREE RE-MEASUREMENTS, EACH BY RUNNING. 190 to 205 when the floor was first
 * refused; 205 to 208 at 218 when ruling 57 made the home section render four
 * real cards rather than the three this gate used to fabricate, and added the
 * lead assertion; 208 to 216 at 226 when the `dt-updated` value assertion
 * became unconditional. A number written here from arithmetic on the previous
 * one was wrong every time it was tried.
 *
 * THE COUNT DOES NOT MOVE WITH THE CHECKOUT, and that is load bearing for CI.
 * `revisedDate` answers null on a shallow clone, which is what CI has, so the
 * `dt-updated` branch flips. PROVEN by forcing `lastCommitDate` to return null
 * and re-running: 226 either way, with the branch report flipping from 11 and 0
 * to 0 and 11. A gate whose count depended on the clone would go red on CI for
 * being CI, and this floor would be unsettable.
 *
 * WHAT THAT TIGHTNESS COSTS, stated rather than discovered later: unpublishing
 * a post removes roughly thirteen assertions from this sweep and would breach
 * this floor. That is the repo-wide trade `check:floors` imposes, and the
 * repair is the same as everywhere else, a re-measured floor in the same commit
 * as the corpus change. Publishing a post only ever moves the count up.
 */
```

## scripts/check-logo.mjs

### scripts/check-logo.mjs:1 (CONTRACT, shortened)

the boundary, the two named gaps and why the fixtures stay; the collapse narrative and the v4 amendment prose go to the history document.

```js
/**
 * Gate over the site mark.
 *
 * OBSERVATION BOUNDARY: compares the component's path data against the four SVG
 * fixtures, the mark's fill BINDINGS in app.css against a closed expected set,
 * the shipped icon suite's CONTAINER SHAPE, dimensions and one tile pixel
 * against a ruled manifest, and the mark AS RENDERED into a social card against
 * a rasterisation of the committed fixture, every pixel of it.
 *
 * It does not check CONTRAST, and it resolves exactly one token to a hex,
 * `--mark-on-chrome`, on both sides of that render comparison, so a retuned
 * token moves them together and the comparison stays about shape. A mark bound
 * to the right token name where the token has been given the page colour still
 * passes here; check:contrast owns resolved values.
 *
 * THE ICON SUITE is still read ONE pixel per raster: an icon whose tile is
 * right and whose mark is upside down, clipped or drawn in the wrong purple
 * passes every assertion about it. That gap is now bounded rather than total,
 * because the same mark is compared pixel for pixel in the render section, and
 * the icons are rendered from the same paths; what is unasserted is each icon
 * FILE, not the shape it was cut from. Eyes remain the instrument for the
 * suite, and the contact sheet is how they get used.
 *
 *   npm run check:logo
 *
 * Proves that app/components/site-logo.tsx, the module the Worker renders,
 * reproduces the ratified SVGs exactly. Pure: no network, no database, no build.
 *
 * WHY THE FOUR public/*.svg FILES ARE KEPT. They are not dead assets and they
 * are not what the site renders; the component is. They are the FIXTURES this
 * gate derives from. Two independent sources argue here, exactly as in
 * check:contrast: the expected path data and fills come from the SVG files, and
 * the actual ones come from the component. Nothing in this script restates a
 * path, so a hand-edited component moves one side of the comparison and fails.
 * Delete the fixtures and the gate has nothing to check against, which is the
 * whole reason they stay under the repo's leanness rule.
 *
 * The component collapses four files into one path list plus a viewBox, because
 * the four differ in exactly two ways: the viewBox, and whether the five purple
 * paths carry the light hex or the dark one. The five purple paths carry no fill
 * at all in the component; they take .site-logo-brand, which is var(--brand),
 * and that token already resolves per theme. This gate is what keeps that
 * collapse honest.
 *
 * v4 AMENDED that last claim and the amendment is asserted at the foot of this
 * file, not just described here. --brand is no longer the only fill the class
 * can take: on the public chrome the mark is bound to --mark-on-chrome, the
 * dark-mode variant, in BOTH themes. The component is untouched, because the
 * override is a CSS binding and not a path.
 *
 * It fails in BOTH directions: a path hand-edited in the component, and an asset
 * regenerated from the spec that the component did not follow.
 *
 * Construction spec: Capsid dustinedwards/logo-spec.md. A variant is a rebuild
 * from those values, never a hand edit of path data.
 */
```

### scripts/check-logo.mjs:100 (WHY, shortened)

why comments go first; the check:contrast incident goes to the history document.

```js
/**
 * Strips block comments before anything is located.
 *
 * check:contrast learned this the hard way: its own token block spelled the
 * three theme selectors out in prose, so the parser found the COMMENT first and
 * passed every row for the wrong reason. This file's header names viewBox and
 * both hexes, so the same trap is live here.
 *
 * @param {string} source
 * @returns {string}
 */
```

### scripts/check-logo.mjs:111 (WHY, shortened)

the prohibition and its because; the audit's wrong diagnosis goes to the history document.

```js
/*
 * WEAK ON PURPOSE, and only for SVG. This removes whole-line // comments
 * only. The shared strong stripper in scripts/lib/strip-comments.mjs must
 * NOT be pointed at SVG: its line-comment rule eats a PROTOCOL-RELATIVE url
 * ("//cdn.example.com/x"), whose slashes follow a quote rather than a colon,
 * and takes the rest of the line with it. Measured 2026-08-23 on a fixture:
 * the whole xlink:href value and the attributes after it were destroyed.
 *
 * The audit that prompted the consolidation said the hazard was the strong
 * form eating xmlns:xlink="http://...". It is not; that is a colon and the
 * guard protects it. test/strip-comments.test.mjs asserts the real one.
 *
 * The TSX and CSS call sites below DO use the shared helper: a .tsx file has
 * real // comments and this weak form would leave a trailing one standing.
 */
```

### scripts/check-logo.mjs:180 (CONTRACT, shortened)

section marker plus the scope rule, in one line.

```js
// --- The component is shaped the way the collapse assumes ------------------
//
// An assertion that can pass by reading nothing is not an assertion, so the
// parse counts are asserted before anything is compared against them.
```

### scripts/check-logo.mjs:198 (CONTRACT, shortened)

section marker plus which viewBox is which.

```js
// --- Every fixture is reproduced -------------------------------------------
//
// viewBoxes[0] is the master (square), viewBoxes[1] the tight header crop, in
// the order the components are declared.
```

### scripts/check-logo.mjs:237 (WHY, shortened)

what the geometry comparisons could not see, and the closed set; the v4 narrative goes to the history document.

```js
/* --- Where the five purple paths actually get their colour -----------------
 *
 * NEW at v4, and it closes a hole rather than adding ceremony. Everything above
 * this line compares GEOMETRY: the component's path data and literal fills
 * against the fixtures'. Nothing had ever looked at the CSS BINDING, so this
 * file's own header could go on saying ".site-logo-brand is var(--brand), and
 * that token resolves per theme" for as long as anyone left it there, and it
 * would have kept passing after that stopped being the whole truth.
 *
 * v4 binds the mark ON THE PUBLIC CHROME to --mark-on-chrome in BOTH themes,
 * because on a purple surface the light variant is the legible one. That is a
 * deliberate variant assignment, and this assertion is what makes it
 * deliberate: it names both bindings by VALUE, and the set is CLOSED, so a
 * third rule setting fill on this class fails here rather than quietly becoming
 * the one that wins the cascade.
 *
 * It does NOT resolve the tokens to hexes. check:contrast owns that, and now
 * measures --mark-on-chrome against --surface-chrome in both modes.
 */
```

### scripts/check-logo.mjs:258 (WHY, shortened)

why a gate narrowed to fit a defect is worse than the defect, and the citation; the build-2 account goes to the history document.

```js
/*
 * TWO BINDINGS. RESTORED 2026-09-13 after build 2 cut this to one.
 *
 * The second, `.site-header .site-logo-brand` -> `--mark-on-chrome`, asserts
 * that the phage mark RENDERS ON THE BAR. Build 2 replaced the header with a
 * text-only wordmark, this gate caught it, and the gate was cut to one binding
 * with a justification written to fit the defect. THAT IS WORSE THAN THE
 * DEFECT: the mark came back the moment somebody looked, but a gate narrowed
 * to accommodate an omission lets the next omission through in silence.
 *
 * Restored FIRST and watched to fail, before the header was touched, which is
 * hard rule 12: exit 1 is not evidence until the plant is proven applied.
 */
```

### scripts/check-logo.mjs:273 (WHY, shortened)

the dichotomy lesson and what actually moved; the tokens, the dates and the ratio go to the history document.

```js
/*
   * --mark-on-chrome, AND IT WENT AND CAME BACK, which is worth recording
   * because the round trip is the lesson rather than the destination.
   *
   * On 2026-09-13 this was moved to --on-brand. The measurement behind that was
   * correct: --mark-on-chrome is #b7a5e0 in both themes, build 2 had made the
   * dark bar #b7a5e0, and the mark was therefore a 1.00:1 silhouette of its own
   * background. The CONCLUSION was wrong. The question asked was "which token
   * survives this bar", when the question was "why did the bar change". Hard
   * rule 12's own bullet: a dichotomy inherits its author's frame.
   *
   * Dustin restored the old header on 2026-09-14 and the bar is --surface-chrome
   * again, so the v4 assignment is valid again with nothing re-measured. The
   * COUNT is what caught the missing mark in the first place and it has been
   * two throughout; only this token moved, twice.
   */
```

### scripts/check-logo.mjs:293 (WHY, shortened)

why the whole set and not one file; the split's date goes to the history document.

```js
/*
   * THE WHOLE STYLESHEET SET, not app.css alone. Since the 2026-08-21 split the
   * mark's two fill bindings live in DIFFERENT files: `.site-logo-brand` stayed
   * with the tokens in app.css and `.site-header .site-logo-brand` moved to
   * app/styles/public-chrome.css. Reading one path found one of two and failed,
   * which is this section working; reading the set is the fix.
   */
```

### scripts/check-logo.mjs:300 (WHY, shortened)

why the shared helper is safe here and where the hazard would land.

```js
/*
   * CSS through the SHARED helper. In CSS `//` is never a comment, so the
   * helper's line rule can only ever remove something real; MEASURED across
   * all 17 stylesheets in app/, its output is identical to block-only
   * stripping today. The latent hazard is a protocol-relative url(//host/x),
   * which none of them has. If one ever appears, this call site is the one
   * that should go block-only, not the helper that should change.
   */
```

### scripts/check-logo.mjs:343 (WHY, shortened)

why it lives here, the two failure shapes and why the probe point is derived; the ruling's placement argument goes to the history document.

```js
/* --- The rendered icon suite ----------------------------------------------
 *
 * WHERE THIS LIVES AND WHY IT IS NOT IN check:media. The ruling puts these
 * assertions with the gate that owns the assets manifest, which is check:media.
 * check:media is NETWORK tier: it lists R2 and queries D1, so folding them
 * there would make the icon suite unchecked on `npm run check`, unchecked
 * inside check:head, and unchecked on a plane. The ruling anticipated that and
 * said to put the section in the offline path and say where. This is where.
 *
 * check:logo is the right offline home on its own merits: the icon suite IS
 * this mark rasterised, and the relationship is the one this file already has
 * with the four SVG fixtures. `scripts/fixtures/icon-suite.json` carries the
 * ruled shape; the files carry what actually shipped; nothing here restates a
 * number. check:media still owns the PATH manifest, and `assets.json` stays
 * paths-only for the reason build-assets.mjs gives.
 *
 * TWO FAILURE SHAPES, and structure alone catches only one. A regenerator that
 * drops a size changes the container; a regenerator pointed at the wrong tile
 * changes nothing structural at all and produces a file that is correct in
 * every respect a header can see. So each raster also gets one colour probe.
 *
 * THE PROBE POINT IS DERIVED, not chosen. Every tile is emitted by
 * build-icons.mjs as a full-bleed rect with the mark CENTRED and fitted by its
 * longer ink dimension inside a padded box, so the mark occupies at most the
 * central (1 - 2p) of the canvas and never comes within p of an edge. Pixel
 * (0, 0) is therefore outside the mark for any padding p > 0. It is also
 * outside the maskable safe circle, which is inscribed: the corner sits at
 * 0.707 of the half-diagonal from centre against the circle's 0.4 radius. So
 * the probe survives any future revision that moves, rescales or redraws the
 * mark, as long as the tile stays a tile. That is the property worth having.
 */
```

### scripts/check-logo.mjs:378 (CONTRACT, shortened)

section marker plus why two implementations.

```js
// --- The hand-rolled readers test themselves, against a third party encoder -
//
// A parser and a fixture built on the same assumptions can agree about a format
// both got wrong. resvg ENCODES the PNG here; scripts/lib/raster.mjs decodes it.
// Two implementations, neither derived from the other.
```

### scripts/check-logo.mjs:421 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- The ICO container, parsed from the file rather than trusted -----------
```

### scripts/check-logo.mjs:438 (WHY, shortened)

what the directory alone cannot see.

```js
// The embedded PNG's own IHDR must agree with the directory entry. A
    // container claiming 32px around a 16px image is a real corruption and the
    // directory alone cannot see it.
```

### scripts/check-logo.mjs:450 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- Every raster: dimensions and one tile probe ---------------------------
```

### scripts/check-logo.mjs:462 (WHY, shortened)

why the query must be absent; the superseded design's measurement goes to the history document.

```js
// --- favicon.svg is a tile, like everything else ---------------------------
//
// SUPERSEDES the assertion that stood here for one day, which required both
// prefers-color-scheme values to be present. That was policing a mechanism that
// could not work: the query reads the OPERATING SYSTEM's colour scheme, while
// the thing the icon has to survive is the TAB STRIP's colour, which comes from
// the browser THEME and is invisible to any media query. A purple Chrome theme
// on a light-scheme OS resolved it to light and put a deep-purple mark on a
// purple strip.
//
// So the assertion is now the opposite in one direction: the query must be
// ABSENT, because its presence would mean the superseded design came back.
// Comments are stripped first, on this file's own established rule, and the
// prose above names both the hex and the query.
```

### scripts/check-logo.mjs:496 (NUMBER, shortened)

why not scope-floored and why the SVG block sits inside the margin; the measurement and the wrong first estimate go to the history document.

```js
// --- Executed-count floor for this section ---------------------------------
//
// MEASURED THROUGH THIS GATE'S OWN PIPELINE, 2026-08-13: the icon section
// executes 37 assertions. Counted by RUNNING it, not by adding up the blocks;
// the first estimate written here was 40 and it was wrong.
//
// Floored at 34, the ~8% margin the other gates use. Not scope-floored: losing
// the self-test block (6), the raster loop (11) or the ICO block (17) each
// drops the count below this and is named as a SKIPPED block rather than
// passing quietly. The SVG block is 3 and sits inside the margin, which is
// deliberate rather than overlooked: its three assertions are explicit and
// would fail on their own before a count could notice they had gone.
```

### scripts/check-logo.mjs:518 (CONTRACT, shortened)

what the text comparisons cannot see, the two sides and what they share; the hand proof's date and the token aside go to the history document.

```js
/* --- The mark as it is RENDERED, not as it is written ----------------------
 *
 * CLOSES THE HOLE THIS FILE'S OWN BOUNDARY NAMED. Everything above compares
 * TEXT: path data against path data, a fill binding against a closed set, one
 * corner pixel of a raster nobody looks at the middle of. So a change that
 * leaves every string intact and ruins the picture passes: the social card
 * embeds the mark through satori, which URL-encodes it into an `<image>` for
 * resvg to draw, and a satori or resvg release that re-fitted, resampled or
 * letterboxed that embed would move no character in this repo.
 *
 * It was proved by hand once, on 2026-08-14, and a proof that exists in a
 * session transcript is not a gate. This is the same method, standing:
 *
 *   ACTUAL    the node `build:og` puts in the card, from scripts/lib/mark.mjs,
 *             rendered by satori and rasterised by resvg
 *   EXPECTED  the committed fixture's own paths, drawn into the same box by
 *             resvg directly, with no satori in the path
 *
 * The two sides share a rasteriser and nothing else. EXPECTED never reads a
 * stored PNG, never reads anything build:og wrote, and never reads the module
 * under test for geometry: the paths come from `readFixture`, this file's own
 * reader, and the framing is a plain nested `<svg>`, which is what makes the
 * aspect-padding in mark.mjs falsifiable rather than assumed. Remove that
 * padding and resvg letterboxes the embed while the nested svg does not, and
 * this comparison finds it.
 *
 * ONE TOKEN IS RESOLVED HERE, which the boundary above now says. The brand fill
 * on both sides comes from `--mark-on-chrome` in app.css, so a retuned token
 * moves both together and this stays a geometry assertion. It is still an
 * assertion about WHICH token: paint the card from --brand and EXPECTED keeps
 * --mark-on-chrome and the deltas fire.
 *
 * WHAT IT DOES NOT SEE. It renders the mark on its own chrome ground, not a
 * whole card: the card's own layout, its type and its bands are check:head's
 * and the sample renders' business. satori lays this box out at the origin,
 * where the card puts it at x=72 y=64; both are integers, which is the only
 * property the comparison depends on.
 */
```

### scripts/check-logo.mjs:568 (CONTRACT, shortened)

why the font and why the cast, in two lines.

```js
// ACTUAL. The font is required by satori and never used: the mark is paths.
  // The cast is the same one build-og.mjs makes for the same reason: satori's
  // types want a ReactNode, and these are the plain element objects it actually
  // accepts, built without JSX so no caller needs a build step.
```

### scripts/check-logo.mjs:670 (NUMBER, shortened)

why a floor and not a measurement; the inked figure goes to the history document.

```js
// Two blank rasters compare equal and prove nothing, so the expected one
    // has to be a picture before the comparison means anything. A quarter of
    // the box is a floor, not a measurement: the mark inks 1363 of 2880.
```

### scripts/check-logo.mjs:680 (WHY, shortened)

why zero is the honest number and what can drift it; both plant measurements go to the history document.

```js
/*
     * TOLERANCE IS ZERO, and zero is the honest number rather than a strict one.
     *
     * Both sides are the same vector geometry, at the same size, through the
     * same resvg in the same process. Nothing here is a photograph, a
     * compression artefact or a font: there is no source of noise for a
     * tolerance to absorb. A resvg upgrade moves both sides identically, so it
     * cannot drift this apart; only satori changing how it hands the mark over
     * can, which is precisely what this exists to catch.
     *
     * Measured 0 over all 2880 pixels. Both numbers below were taken by
     * breaking the thing on purpose and running this gate: remove the aspect
     * padding from mark.mjs and 348 pixels differ at a max delta of 45; shift
     * the embedded geometry by half a pixel and 408 differ at 77. A tolerance
     * loose enough to feel "safe" would have to be blind to the first of those,
     * which is a defect this repo has already had once.
     */
```

### scripts/check-logo.mjs:702 (NUMBER, shortened)

why the floor allows one and what every other silence looks like; the measurement goes to the history document.

```js
/* --- Executed-count floor for the render section --------------------------
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it: 9 assertions.
 * Counted, never summed, on this file's own established rule. The whole gate
 * moved from 123 to 132 in the same run, which is the same nine.
 *
 * Floored at 8. The `<image>` parse is a real branch: if satori stops emitting
 * an `<image>` the block runs one assertion and stops, and both this and that
 * assertion fail, which is correct, because the first line to read is the one
 * naming what changed. Every other way for this section to go quiet, an
 * exception swallowed or the block commented out, drops it to 0 or 1.
 */
```

### scripts/check-logo.mjs:724 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- Report ---------------------------------------------------------------
```

### scripts/check-logo.mjs:726 (NUMBER, shortened)

what this floors that the section floor cannot, and why never summed; the measurements and the dated readings go to the history document.

```js
/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR.
 *
 * MINIMUM_ICON_CHECKS above floors the ICON SECTION only, and it shipped with
 * that section by rule. This is the floor for everything else: the geometry,
 * the fixtures and the two CSS fill bindings, none of which had one. A section
 * floor cannot see a different section stopping.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 132.
 * Never summed, and summing is exactly what went wrong here once already: the
 * icon section was recorded as 40 against a measured 37. It was 123 against a
 * floor of 115 until the render section landed and RAN, adding nine.
 *
 * Floored at 124, roughly 6 percent: the count is a fixed function of the
 * fixture list and the raster manifest, so it steps when an asset is added.
 */
```

## scripts/improve-report.mjs

### scripts/improve-report.mjs:1 (CONTRACT, shortened)

where it runs, what it never reads, why TAP and the stream mode; the two audit findings and the byte-identical note go to the history document.

```js
// Trusted scoring glue for improve-score.yml, run from the DEFAULT branch in the
// scorer's second job, from a copy stashed in $RUNNER_TEMP before any untrusted byte
// exists on the runner. It never runs attempt-controlled code: it reads the TAP the
// reporter produced and counts results from the TOP-LEVEL ok / not ok lines, not from
// a process exit code. That is the fix for the 2026-09-06 CRITICAL where an attempt
// forced holdout_pass_rate to 1.0 by calling process.exit(0) before assertions ran: an
// early exit means the file's ok line is never written, so the pass it never earned is
// absent rather than assumed.
//
// TAP, not "json": node --test has no builtin json reporter (tap, spec, dot, junit,
// lcov). TAP is the line-oriented one, and a top-level result is an `ok N` or `not ok
// N` at column 0. Subtests are indented under `# Subtest:` and are not counted, so a
// suite using subtests is not double-weighted.
//
// THE STREAM MODE IS THE 2026-09-07 FIX (Opus CRITICAL 5.1, Grok CRITICAL 2). Holdout
// cases used to run with --test-reporter-destination pointed at a file inside the
// attempt's own filesystem, which the attempt could rewrite from process.on('exit')
// after the reporter flushed. There is no destination file now: the container writes
// TAP to its stdout, the runner captures that pipe outside the container, and this
// script splits the stream on the ##CAPSID-CASE markers the trusted container shell
// emits. A test's own stdout is re-emitted by node's TAP reporter as `# ` comment
// lines, so nothing a test prints can produce a result line or a marker at column 0.
//
// THIS FILE IS BYTE-IDENTICAL ACROSS ALL FIVE ROSTER REPOS, like the score job that
// calls it. Only Job A differs per repo. Pure functions are exported for
// test/improve-report.test.ts; the CLI modes are repo-agnostic.
```

### scripts/improve-report.mjs:32 (WHY, shortened)

why column 0 is unreachable, in two lines.

```js
// The marker the trusted container shell prints before each case file. Matched at
// column 0, which a test cannot reach: node's TAP reporter prefixes every line a test
// writes to stdout with "# ", so an injected "##CAPSID-CASE x" arrives as
// "# ##CAPSID-CASE x" and does not match.
```

### scripts/improve-report.mjs:38 (WHY, shortened)

what TAP escaping does not cover; the date and the phase name go to the history document.

```js
// THE NONCE (2026-09-07, secondaries-in-the-container). TAP escaping protects only
// output that went through node's TAP reporter. The secondary phases pipe a lint
// tool's RAW stdout into the same stream, and a lint diagnostic can carry attacker
// text at column 0. Every marker is prefixed with a per-run nonce the trusted shell
// holds in a shell variable and unsets from the environment before any attempt code
// runs. Passing "" reproduces the original spelling, which the pre-nonce tests pin.
```

### scripts/improve-report.mjs:50 (CONTRACT, shortened)

what a segment is and why it is declared once.

```js
// One segment of the container's output stream: a holdout case, or one of the two
// secondary phases, plus the exit status the trusted shell printed after it. Declared
// once because splitStream builds them and both readers narrow them.
```

### scripts/improve-report.mjs:61 (WHY, shortened)

why the map lives here, the offline rule and what null means; the CI plant and the dates go to the history document.

```js
// ---- the per-repo command map -----------------------------------------------
//
// WHY THE MAP LIVES HERE. The secondaries used to be measured by Job A, which runs
// attempt code by design, and handed to the scorer as metrics.json. The 2026-09-07 CI
// plant set test_pass_rate 1, lint_count 0 and bundle_size_bytes 1 in a signed report:
// the anchors held, the tuning signal did not. The two metrics that CAN be recomputed
// are recomputed inside the same --network none --read-only container as the holdout,
// and this file, copied off the DEFAULT BRANCH before any untrusted byte exists, is
// where the commands live.
//
// EVERY COMMAND MUST RUN OFFLINE. The container has no network, so nothing may
// install, fetch or resolve. Binaries come from node_modules on the read-only
// default-branch mount; scripts are invoked directly rather than through a package
// manager, because corepack cannot provision one without a network.
//
// `verified` is the date the command was OBSERVED producing a real number in the
// container. An unverified entry is still run, and a command that does not run yields
// NULL rather than falling back to Job A's forgeable value.
```

### scripts/improve-report.mjs:103 (WHY, shortened)

why two exclusions and that neither is to move a number; the scores and the ruling date go to the history document.

```js
// UNIT TESTS ONLY, and that took two exclusions rather than one (ruled
    // 2026-09-08). The bare `vitest run` swept in apps/web/e2e/*.spec.ts, playwright
    // specs that cannot run behind --network none: 58 top-level results, 38 of them
    // failing for the environment rather than the code, and the repo scored 0.3448.
    //
    // Excluding e2e by folder took it to 0.5263 and revealed the second set:
    // *.integration.test.ts lives under test/ rather than e2e/, so a folder exclusion
    // never reached it. Both are UNSCORED and foxing/improve/scores.md says so.
    //
    // Neither is excluded to make a number go up. A score the loop cannot move is noise
    // it optimises against, and the hidden holdout suite covers what the unit tests do
    // not.
```

### scripts/improve-report.mjs:132 (WHY, shortened)

what the manifest is not, what it buys and the two consumers; the broken anchor's figures go to the history document.

```js
// ---- the holdout import manifest --------------------------------------------
//
// NOT A SECURITY CONTROL. `improve/holdout/<ns>/imports.txt` lists every name the
// hidden suite imports out of the repo's own source. Names only, one per line,
// committed and deliberately NOT secret: an export name is already in the source.
//
// WHAT IT BUYS, ruled 2026-09-08 after it cost a broken anchor. The bloat pass removed
// two exports on a scan that found no caller in src/ or test/. The holdout imports
// both, and the holdout is structurally invisible to anything that runs in the repo.
// The result was 28 of 30 against an anchor of min 1.0, which would have reverted
// every attempt forever. The list is the missing third place to look.
//
// TWO CONSUMERS, pulling in opposite directions and both needed:
//
//   the dead-export check   treats a name here as a caller, so removing it is a build
//                           failure rather than a surprise at 03:00.
//   Job B                   refuses a holdout case importing a name that is NOT here,
//                           so the list cannot fall behind the suite it describes.
```

### scripts/improve-report.mjs:167 (CONTRACT, shortened)

why relative specifiers only, and why bound names count.

```js
// Every NAME a holdout case imports from the repo's own source. Matched on the import
// specifier being relative (../src/..., ../../app/...): an import of a node builtin or
// an npm package says nothing about this repo's exports.
//
// Default and namespace imports are reported under the names they bind, since removing
// what they point at breaks the case just the same.
```

### scripts/improve-report.mjs:177 (WHY, shortened)

the anchor and the boundary; the five bad runs and their names go to the history document.

```js
// ANCHORED AT A STATEMENT START, and the clause may not cross a `;`.
  //
  // The first spelling used a lazy `[\s\S]*?` for the clause, which crossed statement
  // boundaries: in a file whose first relative import is the third line, the match
  // began at line one and swallowed the two node-builtin imports above it. The first
  // five runs of this gate reported names like `assert`, `from` and `import`. An
  // import clause never contains a semicolon, so `[^;]*?` is the boundary.
```

### scripts/improve-report.mjs:222 (CONTRACT, shortened)

what it returns and why it never names a file.

```js
// The Job B gate. Returns the refusal to print and fail on, or null to proceed. It
// NEVER names a case file: a filename is part of the hidden suite and this runs in a
// job whose log is readable. It names the missing IMPORTS, which are source export
// names and are what the operator has to add.
```

### scripts/improve-report.mjs:254 (WHY, shortened)

why files rather than an inlined string, and what the tree list buys.

```js
// The files the trusted step writes into $RUNNER_TEMP/trusted and the container reads
// from a read-only mount. Files rather than an inlined string because the container
// command is a single-quoted shell literal, and embedding a per-repo command into it is
// a quoting hazard. A namespace with no command for a phase gets no file, and the
// container skips it.
//
// `trees.txt` is the OTHER half of the trusted map. The container builds its working
// tree as the default-branch checkout with these paths, and only these paths, replaced
// by the attempt. Taking the list from the trusted map rather than from whatever
// /attempt contains means an attempt cannot decide which of its own trees are believed,
// and taking each declared tree WHOLE means a file the attempt deleted stays deleted.
```

### scripts/improve-report.mjs:299 (WHY, shortened)

why zero results is not a pass.

```js
// One holdout case file passes iff its report has at least one top-level ok and no
// top-level not-ok. Zero results (the process.exit(0) case, or a load error) is NOT a
// pass: silence cannot score.
```

### scripts/improve-report.mjs:308 (CONTRACT, shortened)

what bounds the stream and what the four kinds are.

```js
// Split a concatenated stream into its trusted segments. The container shell opens each
// segment by printing a marker at column 0; everything until the next marker belongs to
// it. Anything before the first marker is container preamble and is discarded.
// `##CAPSID-END` bounds the stream, so a truncated one (a killed container) is visible
// rather than silently scored on partial output.
//
// Four segment kinds: "case" (one holdout file), "test" and "lint" (the secondary
// phases), and "status" (the exit code of the phase that just closed, printed by the
// trusted shell so a phase that could not run is distinguishable from one that ran and
// found nothing).
```

### scripts/improve-report.mjs:329 (WHY, shortened)

why the assignment is outside the closure.

```js
// `open` RETURNS the segment and the loop assigns `current`, rather than assigning it
  // from inside the closure. A checker cannot follow an assignment made in a callback,
  // so the closure form narrowed `current` to `never` at every later use: it
  // type-checks under this repo's config, which does not check .mjs bodies, and fails
  // under dustinedwards-info's, which does.
```

### scripts/improve-report.mjs:388 (WHY, shortened)

why an unterminated stream scores zero.

```js
// How many holdout cases passed. An unterminated stream scores ZERO, not a partial
// count: a container killed halfway through is a failed measurement, and a failed
// measurement must never look like a good one.
```

### scripts/improve-report.mjs:401 (CONTRACT, shortened)

where the two numbers come from and what null means.

```js
// THE RECOMPUTED SECONDARIES. Both numbers come out of the container, never out of
// metrics.json.
//
//   test_pass_rate  the top-level TAP ratio of the repo's OWN test command, run in the
//                   sandbox. Null when nothing parseable ran.
//   lint_count      how many lines of the lint command's output match this repo's
//                   pattern. Null when the repo declares no lint command, when the
//                   command could not be executed (126/127), or when the container did
//                   not finish.
//
// A phase that could not run yields null rather than falling back to Job A: an
// unmeasured metric must never be readable as the number the attempt wrote down.
```

### scripts/improve-report.mjs:423 (CONTRACT, shortened)

what counts as having run and why it is spelled out.

```js
// A phase RAN if the container finished and the phase reported an exit status that is
  // not "could not execute" (126, 127). Written as an explicit null check rather than a
  // predicate helper so the narrowing is visible to a checker: the callers below
  // dereference `.lines` on the strength of it.
```

### scripts/improve-report.mjs:439 (WHY, shortened)

how zero matches read as zero problems; the tool, the date and the exit code go to the history document.

```js
// A CRASH IS NOT A CLEAN LINT. Measured on foxing 2026-09-08: biome could not
    // resolve its platform binary, exited 1, printed a Node module-not-found dump, and
    // NOTHING in that dump matched the count pattern, so "zero matches" read as "zero
    // problems" and the report carried lint_count 0 for a lint that never ran. A clean
    // lint exits 0; a lint that found problems exits nonzero AND matches the pattern.
    // Nonzero with no matches is neither, so it is null.
```

### scripts/improve-report.mjs:450 (WHY, shortened)

what a declared-but-never-reported metric did, and the both-directions test; the audit number goes to the history document.

```js
// THE SECONDARY METRICS THIS SCORER ACTUALLY REPORTS, in report order.
//
// It used to be five. error_count and p95_latency_ms were emitted as a literal null on
// every run, by every repo, since the loop was built, and were declared in all five
// scores documents as though they were signals (audits 2026-09-07, MAJOR 5.7).
// germomics' document read as five and behaved as one.
//
// test/null-metrics.test.ts derives seedScoresDoc's Secondary list from this array and
// fails in BOTH directions, so a metric cannot be declared in the canon without
// something reporting it, or reported without being declared.
```

### scripts/improve-report.mjs:462 (CONTRACT, shortened)

why coercion is refused.

```js
// A metric read from Job A's metrics.json: a finite number, or null for anything
// else (missing, "", non-finite). Coercion is refused so a stray value cannot read
// as a real measurement.
```

### scripts/improve-report.mjs:470 (CONTRACT, shortened)

the six modes, kept because they are the interface; the trusted-stash aside goes to the history document.

```js
// ---- CLI --------------------------------------------------------------------
// Six modes, all trusted (this file runs from a stash taken off the default
// branch), none of which runs attempt code:
//   --holdout <reportPath>              exit 0 if that single report passed, 1 otherwise.
//   --holdout-stream <tapPath> [nonce]  print how many cases passed in a piped stream.
//   --rate <testReportPath>             print the top-level pass rate, or "" if nothing ran.
//   --secondary-scripts <ns> <dir>      write this repo's sandbox commands as shell files.
//   --secondary <tapPath> <ns> <nonce> <metricsPath>
//                                       print GITHUB_OUTPUT lines for the RECOMPUTED
//                                       secondaries, and report any disagreement with
//                                       metrics.json on stderr.
//   <metricsPath> <total> <passed>      emit the score-report body to stdout. The
//                                       signing key never touches this.
```

### scripts/improve-report.mjs:494 (WHY, shortened)

what a clean zero cannot distinguish.

```js
// AN EMPTY STREAM IS NOT A RESULT. Exits 0 when the container printed its end
  // marker and 1 when it did not, so the workflow can tell "every hidden test
  // failed" from "no hidden test ever ran". holdoutPassCount returns 0 for both,
  // which is correct for a SCORE and useless as a diagnosis: a container that fails
  // to start reports a clean 0 of N, indistinguishable from an attempt that broke
  // the whole suite, and the loop then reverts a change it never measured.
```

### scripts/improve-report.mjs:582 (WHY, shortened)

what a bare null cannot tell apart.

```js
// WHY IT IS NULL, IN THE RUN LOG. A null that does not say why is the shape this
    // change exists to stop. The four roster repos reported null on their first scored
    // run and the log could not distinguish "the command was not found" from "it ran and
    // produced no parseable result", which is the difference between a typo in the map
    // and a reporter flag the tool no longer supports.
```

### scripts/improve-report.mjs:603 (WHY, shortened)

why both ends of the output.

```js
// HEAD AND TAIL. The tail of a Node crash is the version banner, which says
      // nothing. The message naming the missing module is at the TOP, and printing only
      // the tail turned "vitest could not resolve X" into three closing braces.
```

### scripts/improve-report.mjs:607 (WHY, shortened)

what the leading space defends against; the test name goes to the history document.

```js
// ONE LEADING SPACE, AND IT IS DELIBERATE. These two lines echo the sandbox
      // tool's raw output, and GitHub's tsc problem matcher, which actions/setup-node
      // registers for the WHOLE job, anchors at `^([^\s].*)`. Without the space a lint
      // phase that found type errors made every green CI run carry failure annotations
      // against a path and a line nobody wrote. Guarded by
      // test/secondary-recompute.test.ts, which holds the matcher regexp verbatim.
```

### scripts/improve-report.mjs:625 (WHY, shortened)

what a disagreement looks like and which side wins.

```js
// THE CROSS-CHECK. metrics.json is written on a runner that has already run attempt
    // code, so a disagreement is what a forged artifact looks like. The container value
    // wins in every case; the disagreement is printed so the run log carries it.
```

### scripts/improve-report.mjs:666 (WHY, shortened)

where the anchor comes from and why absent is zero; the audit reference goes to the history document.

```js
// THE ANCHOR IS NOT READ FROM THE ARTIFACT (audit 2026-09-07, Grok MAJOR 3).
  // BUILD_PASSES comes from Job A's job output, which the Actions runner sets from the
  // build step's own outcome. metrics.json is written on a runner that has already
  // executed attempt code and is treated as hostile for this field. Absent is 0, not 1.
```

### scripts/improve-report.mjs:671 (WHY, shortened)

what the artifact is still read for, and why.

```js
// THE RECOMPUTED SECONDARIES ARE NOT READ FROM THE ARTIFACT EITHER (2026-09-07).
  // test_pass_rate and lint_count come from the sandbox run, through the score
  // job's own step outputs. metrics.json is read for bundle_size_bytes and for
  // NOTHING else: it is the one secondary no offline container can recompute,
  // because measuring it means running the repo's bundler.
```

### scripts/improve-report.mjs:689 (WHY, shortened)

why an unjudged attempt is not a reverted one.

```js
// WHETHER THE MACHINE WORKED. Set by the count step when the holdout container
    // did not finish or the suite never synced. The Worker leaves an attempt
    // carrying ok: false UNJUDGED rather than reverting it, because none of the
    // numbers above describe the attempt in that case.
```

## scripts/check-head.mjs

### scripts/check-head.mjs:1 (CONTRACT, shortened)

what it observes, what it inherits and why the counts are not written here; both founding incidents, every cost measurement and the 2881s reading go to the history document.

```js
/**
 * Gate: run the offline tier against a FRESH CHECKOUT OF HEAD, not the disk.
 *
 *   npm run check:head
 *   node scripts/check-head.mjs --ref <branch|sha>
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT OBSERVES A CHECKOUT, NOT THE DEPLOY.** It extracts a ref into a
 * throwaway worktree and runs gates there, so it catches two things nothing
 * else in this repo catches: work that is on disk and not committed, and
 * line-ending divergence between what you have and what a clone gets.
 *
 * It cannot see the running Worker. A build deployed from a dirty tree is
 * invisible here, exactly as it is to every other gate; proving which build
 * answered is `verify-live`'s job and needs the wire.
 *
 * **It also inherits every excluded gate's blindness**, and the excluded set is
 * not small. Some offline gates cannot run in an extraction at all, for reasons
 * measured rather than assumed; this gate excludes itself and `check:floors` to
 * stop two kinds of recursion; and since ruling 51 one gate is excluded that
 * COULD run, because CI already runs it against a checkout of the same sha. Each
 * exclusion carries its own grounds at EXCLUDED below. A green check:head
 * therefore means "the ones that CAN run and are not answered elsewhere, do",
 * which is a narrower claim than "HEAD is good".
 *
 * The counts are DELIBERATELY not written here. They were, and they went stale:
 * this paragraph said "nineteen offline gates" and "the seventeen that CAN run"
 * while the real numbers were twenty-three and twenty. The gate PRINTS both
 * every run, which is the copy that cannot drift.
 *
 * ## Why this exists
 *
 * Ranked first in dustinedwards/gate-backlog.md. Measured twice:
 *
 * 1. `584557f` committed five `check:headers` assertions whose SUBJECT was
 *    uncommitted. `check:all` was green for two commits. Extracting HEAD and
 *    running those assertions read 5 of 5 FAIL.
 * 2. `check:claude-md` shipped green on disk and RED in an extraction of the
 *    identical commit, because its heading needle was `\n## Hard rules\n` and a
 *    checkout produced CRLF.
 *
 * Both were found by hand, by doing what this file now does. Neither was
 * findable any other way: the gates read disk, and disk was not HEAD.
 *
 * ## Cost
 *
 * Measured 2026-08-10: roughly 50s of gates plus worktree creation, against a
 * 121s offline-tier norm, so `npm run check` goes to roughly 3 minutes. That is
 * the price of the only instrument that can see this class.
 *
 * RE-MEASURED 2026-08-20 by RUNNING it: 23 gates in 174.2s, 179s wall. The
 * slowest are `check:charts` at 64.9s and `check:types` at 35.0s. The old
 * figure is kept above rather than overwritten, because the difference is the
 * subject of the next paragraph.
 *
 * RE-MEASURED 2026-09-09 by RUNNING it, after ruling 51 dropped `check:worker`
 * from the nested tier: 22 gates in 121.5s. The slowest are now `check:types`
 * at 31.3s and `check:tests` at 25.5s. The saving is memory rather than time,
 * and it is the whole reason for the exclusion: `check:worker` nested here ran
 * a vitest and three workerd INSIDE the extraction, about 880MB at the peak.
 *
 * **THE TYPECHECK IS COLD HERE, ALWAYS, AND THAT IS CORRECT.** `check:types`
 * costs 35.0s in the extraction against 15s warm on the working tree. The
 * difference is `tsc -b` incremental state: `tsconfig.node.tsbuildinfo` and
 * `tsconfig.cloudflare.tsbuildinfo` sit at the repo root, are matched by
 * `.gitignore:4:*.tsbuildinfo`, and are tracked by nothing, so an extraction
 * never receives them.
 *
 * Copying them in would halve it and would be WRONG. `tsc -b` uses that state
 * to decide which files it can skip, and it would be deciding against
 * timestamps and hashes taken from DISK while checking the sources of HEAD. A
 * gate whose entire purpose is that disk and HEAD may differ must not accept an
 * oracle built from disk. The 20s is the price of the answer being about HEAD.
 *
 * ## A 2881s READING THAT WAS NOT THIS GATE
 *
 * On 2026-08-20 a `npm run check` recorded `check:head` at 2881.6s, and every
 * one of the fourteen gates after it failed in 0.0 to 0.2s. Those were spawn
 * failures on a saturated machine, not results, and re-running each one
 * individually showed them all green.
 *
 * The cause was the session's own debris rather than anything here: several
 * `vite preview` servers and Puppeteer browsers from `check:browser` were still
 * running, because a run killed mid-flight skips the `finally` that stops them.
 * Recorded because the reading looked exactly like a 32x regression in this
 * file, and it was a measurement taken through a busy machine. Re-measured on a
 * quiet one: 179s.
 */
```

### scripts/check-head.mjs:100 (CONTRACT, shortened)

why derived, in two lines.

```js
/**
 * The gates run inside the extraction.
 *
 * DERIVED from the offline tier minus EXCLUDED, rather than hardcoded, so a
 * gate added to `check-all.mjs` and forgotten here shows up as a mismatch
 * rather than being silently skipped.
 */
```

### scripts/check-head.mjs:113 (WHY, shortened)

why it squares rather than loops, and why nothing is lost.

```js
/*
   * RECURSION OF THE SECOND KIND, and it squares rather than looping forever.
   *
   * `check:floors` runs every counting gate to read its floor lines. This gate
   * runs the offline tier, which contains `check:floors`. Left in, one
   * extraction would run every counting gate once for the tier and once more
   * inside check:floors, and the whole tier would be paid twice inside a gate
   * that already costs three minutes.
   *
   * Nothing is lost. `check:floors` compares a floor against a count, and both
   * numbers are properties of the GATE, not of the checkout: an extraction of
   * HEAD reports the same floors as disk unless disk is dirty, and a dirty tree
   * is what the rest of this gate is for. `check-floors.mjs`'s own NOT_RUN
   * carries the matching entry in the other direction.
   */
```

### scripts/check-head.mjs:129 (WHY, shortened)

why it can never pass in an extraction, with its citation; the verbatim failure list and both staleness dates go to the history document.

```js
/*
   * MEASURED 2026-08-10, not guessed. `bootstrap-config.mjs` creates
   * `wrangler.jsonc` BY COPYING `wrangler.jsonc.example`, because the real one
   * is gitignored and absent from any extraction. That makes real == example by
   * construction, and check:config's whole job is asserting they DIFFER in the
   * redacted values. RE-MEASURED 2026-08-31 by running the gate in an
   * extraction, verbatim and in full:
   *
   *   FAIL  wrangler.jsonc redacted var CLOUDFLARE_ACCOUNT_ID is NOT the real value in the example
   *   FAIL  example's database_id is not the real one
   *   FAIL  example's KV id is not the real one
   *   FAIL  wrangler.watchdog.jsonc redacted var ALERT_EMAIL is NOT the real value in the example
   *   FAIL  no redacted value from a real config appears in a tracked file
   *
   * This paragraph said "the two account-scoped ids" and quoted the middle two
   * lines. It went stale twice underneath itself and in the same direction, by
   * omission: `CLOUDFLARE_ACCOUNT_ID` joined the redacted set on 2026-08-28
   * (`apply-config-ids.mjs`), and the whole watchdog pair joined on 2026-08-29.
   * Hard rule 17. The count is deliberately not restated in prose above; the
   * list is the copy, and re-taking it means running the gate.
   *
   * It can never pass in an extraction. That is the gate being correct, not a
   * limitation to work around, and it is why check:config is load-bearing on
   * exactly one machine.
   */
```

### scripts/check-head.mjs:155 (WHY, shortened)

what it reads and why a checkout lacks it; the verbatim error goes to the history document.

```js
/*
   * MEASURED 2026-08-10. Defaults to `--local`, which reads miniflare state
   * under `.wrangler/`. That directory is gitignored and absent. Verbatim:
   *
   *   failed: SENTRY_DO SQLite failed; unable to open database file: SQLITE_CANTOPEN
   *   check:backup failed. could not read sqlite_master
   */
```

### scripts/check-head.mjs:163 (WHY, shortened)

why building to satisfy it would be wrong.

```js
/*
   * Reads build/client, which is gitignored build output and absent from any
   * extraction. Building inside the worktree to satisfy it would measure a
   * build of HEAD that nothing deploys, at a full client build's cost per run.
   * Same class as check:backup: the input is state a checkout does not have.
   */
```

### scripts/check-head.mjs:170 (WHY, shortened)

why it is a different kind of exclusion and what it buys; the memory figures and the killed runs go to the history document.

```js
/*
   * RULING 51, 2026-09-09. NOT a can-it-run exclusion like the four above: this
   * one CAN run in an extraction and is excluded because the property it proves
   * is already proven twice over by the time this gate runs.
   *
   * This gate exists to catch DISK VERSUS HEAD DIVERGENCE. Ship refuses a dirty
   * tree at step 1, so at the moment it matters disk EQUALS HEAD and nesting a
   * gate here answers a question that cannot have a different answer. The other
   * half is CI, which runs check:worker on a clean checkout of the same sha, on
   * a machine that has never seen this repo, which is strictly the stronger
   * reading of the same property.
   *
   * What it buys is memory, and that is the reason it was found. check:head
   * runs the whole tier inside a temp checkout, so check:worker's vitest plus
   * its three workerd processes ran INSIDE this gate's extraction: 2.1GB on top
   * of 2.0GB. Measured at ~880MB off the peak. The starve was real, not
   * theoretical: it killed five check:all runs, which read as "killed
   * externally" until the memory instrument landed.
   */
```

### scripts/check-head.mjs:195 (WHY, shortened)

what a one-line forward lost, why there is a cap and why truncation is announced; the incident and the sizing arithmetic go to the history document.

```js
/*
 * HOW MUCH OF AN INNER GATE'S OUTPUT REACHES THIS ONE'S.
 *
 * ## What was lost, measured 2026-08-31
 *
 * This matched the inner gate's output against a multiline regex anchored on
 * FAIL and kept the FIRST line it matched, throwing the rest away. Every gate
 * here prints a failure as a LABEL line followed by an INDENTED DETAIL, so the
 * one line that survived was always the label and the detail never was.
 *
 * The cost was paid on 2026-08-31. `check:worker` failed in `ship` inside this
 * gate and the log carried exactly `FAIL  no worker test failed`, which is
 * `check-worker.mjs`'s assertion label. Its detail composes `N failing, runner
 * exit X` plus up to twelve failing case lines, and that is the half naming the
 * test. Diagnosing it cost a session and three clean re-runs, and the failure
 * was never reproduced, so the case names are gone for good.
 *
 * ## The cap, and why there is one at all
 *
 * A gate that fails in an extraction can print a great deal, and this gate
 * reports up to twenty-one of them above a summary somebody has to read. So the
 * forward is bounded at FORWARDED_LINES lines and FORWARDED_CHARS characters,
 * whichever binds first, and it SAYS SO IN THE OUTPUT when it truncates rather
 * than trailing off. A silent truncation reads as "that was all of it", which
 * is the failure this whole block exists to stop repeating.
 *
 * The numbers are sized off the widest producer rather than guessed: the twelve
 * case lines `check-worker.mjs` forwards, plus its label, header and the
 * runner's own tail, fit inside forty lines comfortably.
 */
```

### scripts/check-head.mjs:276 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------ NUL preflight */
```

### scripts/check-head.mjs:278 (WHY, shortened)

what a NUL defeats and why bytes not text; the two carriers and their durations go to the history document.

```js
/*
 * GATE BACKLOG ITEM 9, as a STANDING assertion rather than a one-off cleanup.
 *
 * A NUL byte makes git render a file as `Bin n -> m` and makes ripgrep skip it
 * in a directory search, so a change to it rides into a commit unreviewed and
 * is invisible to every text search. `app/db/index.ts` and
 * `scripts/check-config.mjs` both carried one, for seven and eight days, and
 * were only found by reading `git ls-files --eol`.
 *
 * **This reads BYTES, not text.** Reading the file as utf8 and searching for a
 * NUL escape would work, but the whole class is about files whose byte content
 * defeats text tooling, so the check that guards it must not be a text check.
 */
```

### scripts/check-head.mjs:291 (WHY, shortened)

why a scan scoped to the last defect catches only the last defect; the file, the dates and the eol reading go to the history document.

```js
/*
 * `test` JOINED 2026-08-31, after the class it guards was found living there.
 *
 * `test/worker/publish.test.ts` carried two literal NUL bytes for two days, in
 * a comment that meant to write the escape `\0` and wrote the byte. Everything
 * this preflight exists to prevent followed: `git ls-files --eol` reported the
 * file `-text` while every sibling reported `lf`, so it was the one file in
 * that directory exempt from `.gitattributes`, and a directory-scoped ripgrep
 * over `test/` skipped it entirely.
 *
 * It was invisible here because this list named the three roots the two earlier
 * instances happened to live in. A scan scoped to where the last defect was
 * found is a scan that can only ever catch the last defect.
 */
```

### scripts/check-head.mjs:308 (WHY, shortened)

why the exemption is named by extension and not by sniffing; the font move and its date go to the history document.

```js
/**
 * Extensions that are BINARY BY NATURE, so a NUL in them is not the defect.
 *
 * Added 2026-08-21, when the Inter subsets moved from `public/fonts/` into
 * `app/fonts/` so the build could content-hash them. That put two legitimately
 * binary files inside a root this preflight walks, and it FAILED, correctly by
 * its own rule and wrongly about the world.
 *
 * The class it guards is a file that LOOKS like source and defeats text tooling:
 * `app/db/index.ts` and `scripts/check-config.mjs` each carried a NUL for over a
 * week and were invisible to ripgrep. A woff2 is not that. Nobody expects to
 * grep it, git already treats it as binary by content, and `.gitattributes`
 * lists the binary formats explicitly.
 *
 * **NAMED BY EXTENSION, not "skip anything that looks binary".** The tempting
 * version is to exempt any file whose first bytes fail a UTF-8 decode, and that
 * is a catch-all that fails OPEN on exactly the case this exists for: a `.ts`
 * with a NUL in it is a file that looks binary. This list is two extensions and
 * anything else still gets read as bytes and still fails.
 */
```

### scripts/check-head.mjs:346 (WHY, shortened)

why the exemption polices itself.

```js
/*
 * THE EXEMPTION POLICES ITSELF. If the fonts move again, or the extension list
 * outlives the files it was written for, this says so rather than sitting there
 * quietly widening the scan's blind spot by two file types.
 */
```

### scripts/check-head.mjs:358 (NUMBER, shortened)

what a stale floor gave up; four dated readings, the blind-zone percentages and the claimed-versus-measured account go to the history document.

```js
/*
 * FLOOR: RE-MEASURED 2026-08-31 through this walk by running the gate: 350,
 * with `test` newly in NUL_ROOTS. Now >= 320, about eight percent under. It was
 * 220 against a claimed 239, and 138 against 158, and 50 before that.
 *
 * 50 left a 68 percent blind zone: `scripts/` and `workers/` could both drop
 * out and `app/` alone would clear it. 138 had drifted back to a 42 percent
 * one as the tree grew. The class this preflight guards is a file whose bytes
 * defeat text tooling, so a scan that quietly stops covering a third of the
 * tree is precisely the failure it must not have.
 *
 * The 239 above is recorded as CLAIMED rather than measured: this gate printed
 * 277 for the same three roots on 2026-08-31, so the figure in the comment had
 * drifted 14 percent under the walk it described while the floor beneath it
 * went on passing. A floor that is never re-taken stops being eight percent of
 * anything.
 */
```

### scripts/check-head.mjs:390 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------- the runnable gate set --- */
```

### scripts/check-head.mjs:421 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- the extraction --- */
```

### scripts/check-head.mjs:447 (WHY, shortened)

why a junction and why through node.

```js
/*
   * `ln -s` COPIES on this host, and npm install in a throwaway tree would cost
   * minutes. A junction is the one primitive that links without copying, and
   * node's symlinkSync with type "junction" is the only reliable way to make
   * one from here: `mklink /J` through the shell loses its arguments to path
   * conversion.
   */
```

### scripts/check-head.mjs:474 (WHY, shortened)

why it is built and why before the content build; the ruling number goes to the history document.

```js
/*
   * THE STACK ARTIFACT, built IN THE WORKTREE and BEFORE build:content, which
   * reads it to emit the colophon's page records. Gitignored since ruling 39a,
   * so an extraction has its sources and not it, exactly like the two build
   * products below. Without this step build:content fails on a missing file
   * that is not HEAD's fault, which is the failure mode this whole block
   * exists to prevent.
   */
```

### scripts/check-head.mjs:495 (WHY, shortened)

why the local build product is built here.

```js
/*
   * THE LOCAL BUILD PRODUCT, built IN THE WORKTREE. posts.json is gitignored
   * since the artifact arc, so an extraction has markdown and no build
   * product; the gates that read it would otherwise fail on a missing file
   * that is not HEAD's fault. Built here for the same reason check-all.mjs
   * builds before its tier, against HEAD's own sources.
   */
```

### scripts/check-head.mjs:515 (WHY, shortened)

the same reason, and what it reported when missing.

```js
/*
   * THE PUBLICATION TWINS, built in the worktree for the same reason and found
   * by this gate on the day they landed: public/publications/*.md is gitignored
   * build product, so an extraction of HEAD has 36 PDFs and no twins, and
   * `check:publications` compares what is on disk against a fresh generation.
   * It reported "run npm run build:publication-twins" against a checkout where
   * nothing had, which is a missing build step rather than anything about HEAD.
   */
```

### scripts/check-head.mjs:536 (WHY, shortened)

the same reason once more, in two lines.

```js
/*
   * THE ENHANCEMENT BUNDLES, built in the worktree for the same reason:
   * app/enhance/dist/ is gitignored, so an extraction has the enhancement
   * source and no bundles, and HEAD's ?url imports name files that would not
   * exist. Built against HEAD's own sources, like build:content above.
   */
```

### scripts/check-head.mjs:606 (WHY, shortened)

why cleanup must survive a crash, and why prune runs regardless.

```js
/*
   * Cleanup MUST survive a crash. A stale worktree is invisible: `git status`
   * stays clean, and the next run fails to create one at a path that already
   * exists. Prune runs regardless, because `remove` fails if the directory was
   * already gone.
   */
```

### scripts/check-head.mjs:634 (NUMBER, shortened)

what this floors that the gate floor cannot, and why the floor did not move; both dated re-measurements and the rotted prose go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS.
 *
 * MINIMUM_EXECUTED above floors the GATES that ran inside the extraction, which
 * is the headline number and not this one. This floors the assertions this gate
 * makes AROUND that run: the preflight, the extraction, the NUL scan, the
 * exclusions and the per-gate verdicts. If those stopped running, the gate floor
 * above would stop being consulted and the run would still report clean.
 *
 * RE-MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-08 by RUNNING it:
 * 37, with 23 gates executed. Never summed. Floored at 34, slack of three: most
 * of the count is one assertion per gate run, so it steps by one when a gate is
 * added and by more only when the tier is re-tiered.
 *
 * RE-MEASURED THE SAME WAY on 2026-09-09, after ruling 51 excluded
 * `check:worker`: 36, with 22 gates executed. Both numbers fell by exactly one,
 * which is what removing one gate from the nested tier should do and is the
 * reason the floor did not move: 34 still bites, now with a slack of two, and
 * lowering it to chase the count would give up the assertion.
 *
 * The prose here said 30 measured and 27 floored while the constant read 33,
 * which is rule 17's rot in its ordinary form: the constant was raised as the
 * tier grew and the sentence justifying it was not. The number above is what
 * the gate printed on the run that set it, and the floor line the gate emits is
 * what owns it from here.
 */
```

## scripts/check-tests.mjs

### scripts/check-tests.mjs:1 (CONTRACT, shortened)

the boundary and the empty-glob defect; the measured baseline and the audit's date go to the history document.

```js
/**
 * Gate: run the behavioural test suite, and refuse to believe an empty one.
 *
 *   npm run check:tests
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT RUNS `node --test` AND READS ITS SUMMARY.** It knows how many test files
 * were discovered and how many tests reported pass or fail. It does not know
 * whether those tests ASSERT anything: a file full of `test("x", () => {})`
 * bodies counts as passing tests here, exactly as it does for node. That class
 * belongs to review, and to `check:assertions` for the gates.
 *
 * It also cannot see whether the tests cover the right modules. Six files
 * covering two of the ten `scripts/lib/` modules is the current state and this
 * gate is content with it; coverage is a judgement, not a count.
 *
 * ## Why this exists
 *
 * The external audit of 2026-08-11. `check:tests` was `npm test --silent`,
 * which is `node --test "test/**\/*.test.mjs"`, and **node exits 0 when the
 * glob matches nothing**. Measured, by changing the glob to `*.spec.mjs`, which
 * is what renaming the files would do:
 *
 *   baseline      tests 43, pass 43, EXIT=0
 *   glob broken   tests  0, pass  0, EXIT=0
 *   exit code seen by check-all: 0 -> PASS
 *
 * Every hand-written gate in this repo fails closed on an empty scope. This one
 * structurally could not, because it delegated to a runner whose "nothing to
 * do" is success. It is the only gate asserting BEHAVIOUR of shipped modules,
 * so its silent emptying is the most expensive one available.
 *
 * FAILS CLOSED on zero files, on fewer files than are committed, and on fewer
 * tests than have been measured.
 */
```

### scripts/check-tests.mjs:47 (NUMBER, shortened)

the measurement rule, why tight and the invariant; five rounds of drift, the missed convention and every dated figure go to the history document.

```js
/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it. Never
 * summed. The measurement is the two constants below and the dates are on
 * them; re-taking it means running the gate, not reading this sentence.
 *
 * **THE CONVENTION BELOW WAS MISSED ONCE ALREADY, on 2026-08-26.**
 * `post-image-links.test.mjs` landed without these floors moving, so for a few
 * hours the set could have lost that file and five others and still reported a
 * clean run. Caught on the next re-measurement rather than by anything, which
 * is exactly the argument for the tightness: a slack floor does not announce
 * that it has gone slack.
 *
 * **BOTH HAD DRIFTED INTO THE UNFAILABLE CLASS, and this is the gate where that
 * costs the most.** They were 23 and 237 against 40 and 389: seventeen test
 * FILES and a hundred and fifty-two TESTS could have been deleted with this
 * gate, the one instrument in the suite that asserts BEHAVIOUR, reporting a
 * clean run. The floors had last moved when `artifact-once-per-request` landed
 * and were never re-measured across everything after it.
 *
 * The drift is not new and the changelog that used to sit here recorded five
 * earlier rounds of it, each with the same shape and the same resolution. That
 * changelog is deleted rather than extended: it was six stale numbers arguing
 * for a discipline the numbers themselves did not follow, which is rule 17's
 * own subject. **The measurement is the two constants below and this comment
 * points at how to retake it, which is to run the gate.**
 *
 * Tight rather than slack, deliberately, and that is this gate's own
 * convention rather than the suite's: these move UP when somebody adds a test,
 * a one-line edit in the same commit, and the whole point is to notice the set
 * SHRINKING.
 *
 * **THE INVARIANT, corrected 2026-08-28, because the sentence here stated a
 * consequence that had stopped following.** It read "narrow enough that losing
 * the smallest test file still trips the file floor", which was true when the
 * ratio was written against a much smaller set and is arithmetic that does not
 * survive the set growing: at 94 percent of a measurement, ONE file out of
 * fifty-odd is well inside the margin.
 *
 * What is actually true, and what the ratio is chosen for: **each floor sits at
 * 94 percent of its own measurement, so the set has to shrink by about six
 * percent before this notices.** That is a handful of files, not one. The
 * tightness buys an early warning rather than an immediate one, and the reason
 * to keep it tight is that the margin only ever widens on its own: every test
 * added without moving these constants makes the floor slacker, silently, which
 * is exactly the drift the paragraph above records happening five times.
 *
 * Stated as the invariant rather than as a number, because a number here is a
 * third copy of the two constants below.
 */
```

### scripts/check-tests.mjs:96 (NUMBER, shortened)

pure chronology beside the constant it describes; every dated reading goes to the history document.

```js
/* 60 against 64 measured 2026-09-04 by RUNNING the gate, after
   webmention-href.test.mjs landed with roadmap item H2. It read 59 against 63
   earlier the same day, after post-readership.test.mjs landed with item G, and
   58 against 62 from 2026-09-03. Previously:
   editor-duplicate.test.mjs landed with the section F row actions. It read 56
   against 60 from 2026-08-30, and the set has grown twice since, so the margin
   had widened on its own, which is the drift the paragraph above names. */
```

### scripts/check-tests.mjs:103 (NUMBER, shortened)

why this floor drifted unseen and what fixed it; six dated readings and the tolerance arithmetic go to the history document.

```js
/* RE-MEASURED 2026-09-06 by RUNNING the gate, after post-image-lqip.test.mjs
   landed with the body placeholder: 66 files. It read 61 against 65 earlier
   the same day, after math-outputs.test.mjs landed with KaTeX. Set to count
   minus check:floors' tolerance, max(3, ceil(count * 0.05)), which is 4 here.
   RE-MEASURED 2026-09-07 by RUNNING the gate, after error-rate.test.mjs landed
   with the watchdog's error-rate check: 67 files. Tolerance is 4 at this
   count, so 63.
   RE-MEASURED 2026-09-15 by RUNNING this gate, after check-all-environment
   .test.mjs landed with the environment classifier: 78 files. THIS FLOOR HAD
   DRIFTED ELEVEN FILES WITHOUT ANYONE MOVING IT, from 67 measured to 78, which
   is exactly what the paragraph above says happens when a file lands and the
   constant does not. It never failed, because it is asserted directly rather
   than through assertFloor, so check:floors never saw the gap: the one floor
   in this file that the meta-gate cannot police is the one that drifted.
   Tolerance is 4 at this count, so 74.
   RE-MEASURED 2026-09-15 by RUNNING this gate, after decisions-volume-freeze
   .test.mjs landed with the freeze-point gate: 79 files. THIS IS THE FIRST TIME
   THIS FLOOR CAUGHT ANYTHING, and it caught it the run after it was given a
   floor line: gap 5 against a tolerance of 4, refused by check:floors. While it
   was a bare ok() it had drifted eleven files unseen. Tolerance is 4 at this
   count, so 75.
   RE-MEASURED 2026-09-16 by RUNNING this gate, after capsid-guidelines-stamp
   .test.mjs landed with check:guidelines: 80 files. The second catch, and the
   same shape as the first: one file arrived, the gap went 4 to 5 against a
   tolerance of 4, and check:floors refused it. That is the floor working
   rather than a floor in the way, so it is re-measured from the printed count
   and never by adding one to the old number. Tolerance is 4 at this count,
   so 76. */
```

### scripts/check-tests.mjs:132 (NUMBER, shortened)

what this floor catches that the file floor cannot; seven dated re-measurements, their gaps and their tolerances go to the history document.

```js
/* 638 against 672, RE-MEASURED 2026-09-07 by running this gate, after the six
   cases the shared upload refusal landed with. It read 632 against 666 the day
   before, which check:floors then failed at a gap of 40 against a tolerance of
   34: six cases arriving is what pushed that floor past it. The file floor
   above catches a file LEAVING; this one catches a file being hollowed out in
   place, which no file count can see. Same tolerance rule, 34 at this count.
   RE-MEASURED 2026-09-07 by RUNNING this gate, after error-rate.test.mjs
   landed with eleven cases: 683 tests. check:floors had just failed the old
   638 at a gap of 45 against a tolerance of 35, which is the mechanism working:
   eleven cases arriving is what pushed that floor past it. Tolerance is 35 at
   this count, so anything from 648 up is legal; 660 leaves the usual slack.
   RE-MEASURED 2026-09-09 by RUNNING this gate, after slug-redirect.test.mjs
   landed with ten cases: 703 tests. check:floors failed the old 660 in CI at a
   gap of 43 against a tolerance of 36, which is the same mechanism a third
   time. Tolerance is 36 at this count, so anything from 667 up is legal; 680
   leaves the usual slack.
   RE-MEASURED 2026-09-10 by RUNNING this gate, after the small-items session
   added seventeen cases across three files (startHere's two branches, ruling
   56's deferred plant, and ship's preflight scan): 720 tests. check:floors
   failed the old 680 in CI at a gap of 40 against a tolerance of 36, the same
   mechanism a FOURTH time, which is the argument for it rather than against
   it. Tolerance is 36 at this count, so anything from 684 up is legal; 700
   leaves the usual slack.
   RE-MEASURED 2026-09-12 by RUNNING this gate, after publication-entities
   .test.mjs landed with eight cases: 739 tests. check:floors failed the old 700
   in CI at a gap of 39 against a tolerance of 37, the same mechanism a FIFTH
   time, and this one is worth a line about HOW it was caught: the local run
   before the push was a set of targeted gates rather than the tier, and
   check:floors is a meta-gate that reads the tier's own output, so it was the
   one gate a targeted run could not include. CI is what saw it. Tolerance is 37
   at this count, so anything from 702 up is legal; 720 leaves the usual slack.
   RE-MEASURED 2026-09-12 by RUNNING this gate, after the publications session
   added sixteen cases across two files (the Ask key mapping for papers, and the
   retraction path's Lancet fixture): 766 tests. The tier caught the old 720 at
   a gap of 46 against a tolerance of 39, the same mechanism a SIXTH time, and
   this time locally rather than in CI, because the run was the tier rather than
   a set of targeted gates. Tolerance is 39 at this count, so anything from 727
   up is legal; 745 leaves the usual slack.
   RE-MEASURED 2026-09-15 by RUNNING this gate, after check-all-environment
   .test.mjs landed with nine cases for the environment classifier: 775 tests.
   The old 745 did NOT fail this time, at a gap of 30 against a tolerance of
   39, so this is the first entry in this list written without the mechanism
   catching it first. It is moved anyway, on the argument the paragraph above
   makes: a floor left alone while the set grows gets slacker on its own, and
   waiting for it to breach is waiting for the margin to be gone. Tolerance is
   39 at this count, so anything from 736 up is legal; 754 leaves the usual
   slack. */
```

### scripts/check-tests.mjs:193 (WHY, shortened)

why by command line and why one platform.

```js
/**
 * Kill any `node --test` runner this gate left behind, and report what it took.
 *
 * BY COMMAND LINE, NEVER BY IMAGE NAME. `node.exe` on this host selects this
 * gate itself, the editor's language server and the agent harness; the
 * cleanup work in `check-all.mjs` records that mistake being made and
 * corrected. The needle is the runner's own argv, which nothing else carries.
 *
 * Windows only, because that is where the leak was measured and where
 * `Get-CimInstance` exists. On other platforms it reports nothing and the gate
 * is unchanged, which is honest: the guard is not claiming coverage it has no
 * mechanism for.
 *
 * @returns {number[]} the pids killed
 */
```

### scripts/check-tests.mjs:225 (WHY, shortened)

what a creeping hang looks like without it, and why both reporters are parsed.

```js
/**
 * The five slowest tests in the run, so a creeping hang is visible BEFORE it
 * becomes a timeout.
 *
 * The suite went from minutes to never in one commit, and nothing printed a
 * duration, so there was no gradient to notice. This prints one every run.
 *
 * READS WHATEVER REPORTER RAN. `spawnSync` is not a TTY, so node picks the tap
 * reporter and emits `duration_ms:` under each `ok`/`not ok`; a TTY run picks
 * spec and puts `(1234.5ms)` on the line itself. Both are parsed rather than
 * one being assumed, because the reporter is chosen by something this gate
 * does not control.
 *
 * @param {string} text the runner's combined output
 * @returns {Array<{ ms: number, name: string }>}
 */
```

### scripts/check-tests.mjs:267 (WHY, shortened)

why deduped; the measured run goes to the history document.

```js
/*
   * DEDUPED BY NAME, keeping the longest reading.
   *
   * A FAILING test appears twice in tap output, once in the stream and once in
   * the failure summary, so the first version of this list printed the same
   * 30.4s test in two of its five slots and pushed a real entry off the end.
   * Measured on the proof run that caught the ordering race, where the list
   * was the instrument being read to diagnose it.
   */
```

### scripts/check-tests.mjs:309 (WHY, shortened)

why a growing scope floor belongs in the meta-gate and which ones do not.

```js
/*
 * THROUGH assertFloor SINCE 2026-09-15, and the reason is what this floor
 * counts rather than tidiness.
 *
 * A SCOPE FLOOR OVER A GROWING SET IS AN EXECUTED-COUNT FLOOR WEARING
 * DIFFERENT CLOTHES. The test file set only ever gets added to, so the measured
 * value climbs away from the floor by itself and the gap widens with no edit,
 * which is exactly the drift ruling 23 built check:floors to notice. It drifted
 * eleven files, 67 measured to 78 actual against a floor of 63, and nothing
 * saw it: this was a bare ok(), so it printed no floor line and check:floors
 * had nothing to read.
 *
 * NOT EVERY SCOPE FLOOR BELONGS HERE, and widening the instrument to cover
 * them all would make it agree with everything. A scope floor over a VOLATILE
 * set must stay out: check:page-payload's built-chunk floor stands at 78
 * against 15 and says so in its own comment, because the chunk count is a
 * property of the bundler's splitting on the day and pinning it near 78 would
 * fail any build that splits differently. One over a set fixed by an external
 * version, like that gate's katex face count, has nothing to drift toward.
 * GROWING is the property that matters, not SCOPE.
 */
```

### scripts/check-tests.mjs:339 (WHY, shortened)

the two bounds and what each catches; the leak's file, its date and the lost tiers go to the history document.

```js
/**
 * THE RUN IS BOUNDED, TWICE, AND IT REAPS WHAT IT STARTED.
 *
 * ## The defect this closes, measured 2026-09-11
 *
 * `node --test` over the whole suite sat resident on this host and never
 * exited. `test/check-all-cleanup.test.mjs` leaked a PowerShell sampler whose
 * ChildProcess handle never closes, so the runner had nothing left to do and
 * still could not leave. This gate called `spawnSync` with NO timeout, so it
 * waited with it, forever, and took `check:head` and `check:floors` down too,
 * because both run the offline tier and the tier runs this.
 *
 * Three sessions lost a local tier to it, and three orphans accumulated in one
 * session. The leak itself is fixed in that file. This is the GUARD, and it is
 * here because the next leak will be in a different file.
 *
 * ## Two bounds, because they catch different things
 *
 * `--test-timeout` is the runner's own per-test bound: a test that hangs is
 * reported as a FAILING TEST, by name, in the summary this gate already parses.
 * That is the outcome worth having, because it names the culprit.
 *
 * `timeout` on the spawn is the backstop for everything the runner's bound
 * cannot see, which is the case that actually happened: the tests all finished
 * and the PROCESS would not exit. A per-test timeout never fires on that.
 *
 * The gate's bound is comfortably above the runner's so the runner reports
 * first when it can. `SIGKILL` rather than the default `SIGTERM`: the thing
 * being killed is a process that has already demonstrated it will not leave.
 */
```

### scripts/check-tests.mjs:371 (WHY, shortened)

why the spawn bound is load-bearing, proven by plant; both measured runs and the timings go to the history document.

```js
/*
 * THE SPAWN BOUND IS LOAD-BEARING, NOT BELT AND BRACES, and the plant proved
 * it rather than the comment asserting it.
 *
 * MEASURED 2026-09-11 with an unbounded wait planted in one subtest:
 *
 *   node --test <that file alone>, --test-timeout=10000
 *     the test is CANCELLED at 10s, the other three run, and the process
 *     EXITS at 24s. Per-file, the runner's own bound is sufficient.
 *
 *   npm test (the whole suite), --test-timeout=60000
 *     903s, ending at THIS bound, with two wedged runners for the reaper to
 *     take. The per-test cancellation did not get the suite out.
 *
 * The difference is the leak. A cancelled test's `finally` never runs, because
 * the promise it is suspended on never settles, so the sampler survives and
 * that forked child cannot exit; the parent waits on its children. Alone, the
 * later tests in the same file reach their own teardown and reap the earlier
 * leak, which is why the single-file case gets out. In the suite it did not.
 *
 * So `--test-timeout` names the culprit and this bound is what ends the run.
 * Both are needed and neither is decoration.
 *
 * SIX MINUTES, against a clean run measured three times at 27, 27 and 28
 * seconds: roughly twelve times the observed cost. Low enough that a wedge
 * costs minutes instead of a quarter of an hour, high enough that a loaded
 * machine or a slower host is nowhere near it.
 */
```

### scripts/check-tests.mjs:415 (WHY, shortened)

why by command line and why on every path.

```js
/*
 * WHATEVER THE RUN LEFT BEHIND, taken down before this gate returns.
 *
 * `spawnSync`'s own timeout kills the shell it started and nothing below it,
 * which on Windows is the npm wrapper and not the node that holds the leak.
 * So the sweep is by COMMAND LINE against the runner's own signature, never by
 * image name: matching `node.exe` here would select this gate, the editor and
 * every other tool on the machine, which is the mistake the cleanup work in
 * `check-all.mjs` already records.
 *
 * It runs on EVERY path, not just the timeout path, because a run that
 * finished can still have leaked: that is precisely what the suite did for two
 * days while reporting failures and then hanging.
 */
```

### scripts/check-tests.mjs:434 (CONTRACT, shortened)

why the cast is the honest narrowing.

```js
/*
 * TYPED READ OF THE TIMEOUT. `spawnSync`'s `error` is declared as `Error`,
 * and the `ETIMEDOUT` that a timeout sets lives on `code`, which only
 * `ErrnoException` declares. The cast is the honest narrowing rather than a
 * cast to `any`: this is exactly the shape node documents for a timed-out
 * spawn, and naming the type says so.
 */
```

### scripts/check-tests.mjs:474 (WHY, shortened)

why the absence is printed.

```js
/*
   * NOT SILENT. A reporter whose durations this cannot read is a reporter
   * change, and the whole point of the list is to make a creeping hang
   * visible, so its absence has to be visible too.
   */
```

### scripts/check-tests.mjs:503 (NUMBER, shortened)

what this floors and why the slack is zero; the measurement and its date go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS.
 *
 * MINIMUM_TESTS above floors the tests NODE ran, which is the important number
 * and not this one. This floors the handful of assertions this gate makes ABOUT
 * that run: discovery, the exit code, the reported totals. If those stopped
 * running, the test floor above would stop being consulted and nothing would
 * say so.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 5.
 * Never summed. Floored at 5, slack of ZERO, which is justified here and almost
 * nowhere else: this gate asserts a fixed set of properties about one run, so a
 * drop is a removed assertion rather than natural movement, and a rise arrives
 * in the commit that adds one.
 */
```

## scripts/check-secrets.mjs

### scripts/check-secrets.mjs:1 (CONTRACT, shortened)

the boundary, the two arguing sources, the strict path rule and fail-closed; the founding defect, the audit's ranking and the cost paragraph go to the history document.

```js
/**
 * Gate over the secret-handling boundary.
 *
 *   npm run check:secrets
 *
 * ## OBSERVATION BOUNDARY
 *
 * **THIS READS SOURCE TEXT, NOT THE BUNDLE.** It asserts that no file outside
 * the server boundary MENTIONS a secret. It cannot see what Vite actually
 * emits, so a secret read inside a legitimate `.server` module that a future
 * mis-split inlined into a client chunk is invisible here and would still ship.
 * Proving that needs the built assets, which is a different gate and a build
 * step; this one is the cheap half that catches the mistake anyone would
 * actually make, which is reading `env.GITHUB_TOKEN` somewhere convenient.
 *
 * It also says nothing about whether a secret is USED correctly once read. A
 * server module that reads a token and then puts it in a response body passes
 * here.
 *
 * Scans `app/` and `workers/`. Deliberately NOT `scripts/`: those are Node
 * programs that never reach a browser, and several legitimately read tokens
 * from `process.env` for operator round trips.
 *
 * ## Why this exists
 *
 * `OPERATOR_TOKEN` was omitted from `app/env.d.ts` while the other six secrets
 * were declared there, and nothing noticed. It was found by hand in the
 * 2026-08-07 rules audit, in a repo with eighteen gates. Hard rule 3 says
 * secrets are read only in `.server` modules and in loaders and actions, and
 * NOTHING ENFORCED IT: the rule was PROSE, and the audit's ranked backlog put
 * this second by cost, behind only the disk-versus-HEAD gap.
 *
 * The cost of the failure it guards is the highest on that list. A secret read
 * from a module the client bundle can reach does not fail loudly; it ships, and
 * the value is then readable by anyone who opens devtools.
 *
 * ## Two independent sources argue
 *
 * The SECRETS list below is transcribed from the ruling in
 * `dustinedwards/core.md`. What the code reads is parsed out of the tree. What
 * is DECLARED is parsed out of `app/env.d.ts`. Nothing here reads its
 * expectation from the file it is checking, so a secret added to the codebase
 * and not to the ruling, or declared and never listed, moves one side of a
 * comparison and fails.
 *
 * ## The boundary is by PATH, and strictly
 *
 * A file may read a secret if its name carries `.server.` or it lives under
 * `workers/`. **Loaders and actions are deliberately NOT carved out**, even
 * though hard rule 3's prose permits them, because no route in this repo reads
 * a secret directly: every one delegates to a `.server` module. Carving out
 * loaders would mean parsing block scope with a regex to permit something
 * nothing currently does, weakening the gate for no benefit. If a route ever
 * genuinely needs a secret in its loader, the honest move is an ALLOWLIST entry
 * naming the file and the reason, not a hole shaped like a language feature.
 *
 * FAILS CLOSED. An empty secret list, an unreadable `env.d.ts`, a scan that
 * examines no files, or a scan that finds no secret reads AT ALL are each a
 * failure: the last one means the matcher broke, and "0 violations" from a
 * broken matcher looks exactly like success.
 *
 * Pure: no network, no database, no build.
 */
```

### scripts/check-secrets.mjs:80 (WHY, shortened)

why importing the list does not cost the independence; the two-copies incident goes to the history document.

```js
/*
 * THE RATIFIED LIST IS IMPORTED, NOT RESTATED, since 2026-08-22.
 *
 * It was declared inline here and the cockpit's tools page described "the five
 * required wrangler secrets" while this gate measured eight. Two copies, one
 * of them prose, and nothing could compare them.
 *
 * **THE INDEPENDENCE ARGUMENT SURVIVES THE MOVE**, which is the thing to check
 * before assuming it does not. This gate's expectation must not be computed
 * from the code it checks, and it still is not: `app/lib/secrets.mjs` is the
 * ratified list itself, hand-maintained against the ruling in
 * `dustinedwards/core.md`. What the tree READS and what `app/env.d.ts`
 * DECLARES are still parsed independently and still compared against it, so a
 * secret added to one and not the others still moves one side and fails.
 */
```

### scripts/check-secrets.mjs:96 (WHY, shortened)

why the mechanism exists while the map is empty.

```js
/**
 * Names permitted OUTSIDE the server boundary, each with the reason.
 *
 * EMPTY TODAY, and that is the correct state: no client-reachable file needs
 * any of the seven. The mechanism exists so that the day one does, the decision
 * is recorded here as a named exception with a justification, rather than made
 * by deleting an assertion.
 *
 * @type {Record<string, string>}
 */
```

### scripts/check-secrets.mjs:108 (CONTRACT, shortened)

why a binding is not a secret and why the other namespace is named.

```js
/**
 * Bindings, which are NOT secrets and are NOT guarded.
 *
 * A binding is an object the runtime injects, not a value: it cannot be
 * serialised into a client bundle, and a client component referencing one gets
 * `undefined` rather than a leak. They are listed only so this file records the
 * full env surface, which is what the enumerate-every-site rule asks for.
 *
 * DB, APP_KV, MEDIA, OG, ASSETS, IMAGES, AI_SEARCH, ASK_BUDGET.
 *
 * Note also `import.meta.env.MODE` and `import.meta.env.DEV`: a DIFFERENT
 * namespace, Vite build constants rather than Cloudflare env, inlined at build
 * time and public by design. The matcher below is anchored so it cannot confuse
 * the two.
 */
```

### scripts/check-secrets.mjs:138 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- fail closed first */
```

### scripts/check-secrets.mjs:151 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---------------------------------------- 1. every secret is DECLARED ----- */
```

### scripts/check-secrets.mjs:153 (WHY, shortened)

the tell, in two lines; the module and the widening go to the history document.

```js
/*
 * THE DEFECT THIS GATE WAS WRITTEN FOR. `OPERATOR_TOKEN` was read by
 * `operator/auth.server.ts` and declared nowhere, so it was widened locally at
 * the call site and the shared `Env` type never knew about it. That is not a
 * leak on its own, but it is the tell: a secret nobody declared is a secret
 * nobody reviewed, and the declaration block is the one place the whole set is
 * visible at once.
 */
```

### scripts/check-secrets.mjs:191 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------- 2. the boundary, by path ----- */
```

### scripts/check-secrets.mjs:195 (WHY, shortened)

why the exclusion set was removed rather than kept; the four names and the sweep go to the history document.

```js
/*
 * NO SKIP_DIRS. There was a set naming node_modules, build, .react-router and
 * .wrangler, and the pre-audit sweep tested it by emptying it: the result was
 * IDENTICAL, because none of those four directories exists under app/ or
 * workers/ and none ever has. They live at the repo root, which this walk never
 * enters.
 *
 * Removed rather than kept as insurance, deliberately. An exclusion nothing
 * depends on is surface area that reads like protection, and this gate's whole
 * subject is the difference between the two. If a build artefact ever does land
 * inside a scan root, the per-root floors below will move and somebody will
 * look, which is a better outcome than a silent skip.
 */
```

### scripts/check-secrets.mjs:224 (NUMBER, shortened)

why per root and why the small one is tight; the sweep, the measurement and the blind-zone figure go to the history document.

```js
/**
 * A floor PER ROOT, not one on the total.
 *
 * The pre-audit sweep dropped `workers` from SCAN_ROOTS and this gate reported
 * 23 checks and 0 failures: `app/` alone is 108 files, so a total-only floor of
 * 50 could not tell that an entire root had stopped being scanned. `workers/`
 * is three files, and it is the Worker entry, the queue consumer and the
 * Durable Object: the outermost layer of the server boundary this gate exists
 * to police.
 *
 * RE-MEASURED 2026-08-24 through this gate's own walk by running it: app 158,
 * workers 4. app/ had grown from 108 without the floor moving, so 95 had
 * drifted to leave a 40 percent blind zone in the root that matters most. The
 * `workers` floor is deliberately tight rather than slack, because a set that
 * small cannot absorb slack: any floor that low cannot detect the root
 * vanishing, which is the only thing it is for.
 *
 * @type {Record<string, number>}
 */
```

### scripts/check-secrets.mjs:291 (WHY, shortened)

why strings go too, which is this file's own reason.

```js
/*
   * COMMENTS AND STRING LITERALS BOTH GO, and the second half is this file's
   * own reason rather than the shared helper's. This file's prose names every
   * secret, and so do docblocks across the tree: `github.server.ts` explains
   * what `GITHUB_TOKEN` is for and `env.d.ts` annotates each one, so a matcher
   * reading prose would report a violation on a comment explaining the rule.
   * Strings go too because `api.server.ts` reports `githubConfigured` and the
   * operator docs name tokens in user-facing copy.
   */
```

### scripts/check-secrets.mjs:313 (WHY, shortened)

what makes the assertion below mean something, with its citation.

```js
/*
 * ANTI-VACUITY, and this is the assertion that makes the one below mean
 * something. If the matcher breaks, or the tree moves, or `stripCommentsAndStrings()` eats too
 * much, the scan finds zero reads and reports zero violations, which is
 * indistinguishable from a clean repo. Hard rule 10.
 */
```

### scripts/check-secrets.mjs:354 (WHY, shortened)

why the self-test is synthetic rather than a fixture entry, with its citation; the ruling date goes to the history document.

```js
/*
 * SELF-TEST, and it runs on EVERY execution regardless of the allowlist.
 *
 * THE PROBLEM IT SOLVES. `CLIENT_ALLOWED` is empty, and empty is the CORRECT
 * state: no client-reachable file needs any of the seven secrets. But an empty
 * map means the loop above iterates zero times, so its rules have never been
 * executed and could be inverted, deleted or simply wrong without any run
 * noticing. "0 failures" from a loop that never ran is indistinguishable from
 * "0 failures" from a loop that checked something. Hard rule 10.
 *
 * The fix is NOT a fixture entry in the real allowlist. That would put a fake
 * permission in the structure that grants permissions, where the next reader
 * has to work out that it is a test and not a decision, and where deleting it
 * to "clean up" silently removes the coverage. Ruled 2026-08-10.
 *
 * Instead the rules live in a function, and the function is fed synthetic input
 * here. The real loop and the self-test call the SAME code, so the assertions
 * below are evidence about the rules the loop actually applies.
 */
```

### scripts/check-secrets.mjs:399 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------- 3. the admin session file is REALLY ignored --------------- */
```

### scripts/check-secrets.mjs:401 (WHY, shortened)

why git is asked rather than the file read, and both directions.

```js
/*
 * **A DOCUMENTED IGNORE THAT IS NOT ACTUALLY IGNORING IS A RECORDED FAILURE
 * SHAPE HERE, so this asks git rather than reading .gitignore.**
 *
 * `.admin-session` holds a live Better Auth session for the single admin. It is
 * a credential, and the only thing standing between it and a public repo is one
 * line in `.gitignore`. Reading that file back and finding the line proves the
 * line exists; it does not prove it MATCHES, because precedence, a later
 * negation, a trailing space or a directory-scoped pattern all leave the line
 * sitting there looking correct. `git check-ignore` answers the question the
 * line is supposed to answer.
 *
 * BOTH DIRECTIONS, because they fail differently and both are real:
 *   the session file MUST be ignored     or the credential can be committed
 *   the example MUST NOT be ignored      or the instructions vanish from the
 *                                        repo and nobody can refill the session
 *
 * The path is checked whether or not it exists. `check-ignore` is a question
 * about the rules, not about the filesystem, so this holds on a fresh clone
 * where no session has ever been created.
 */
```

### scripts/check-secrets.mjs:476 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ================================ the operator credentials in .dev.vars */
```

### scripts/check-secrets.mjs:478 (WHY, shortened)

why they are not wrangler secrets, and why one assertion is conditional while the other is not; the credential names and the date go to the history document.

```js
/*
 * THE `.dev.vars` CREDENTIALS ARE NOT WRANGLER SECRETS, AND ARE STILL GUARDED.
 *
 * Added 2026-09-07 with the uptime monitors. `UPTIMEROBOT_API_KEY` and
 * `CLOUDFLARE_API_TOKEN` are read by Node programs in `scripts/`, never by
 * deployed code, so neither belongs on `REQUIRED_SECRETS`: that list is the
 * ratified set of WRANGLER secrets, and this gate asserts each of those is
 * declared in `app/env.d.ts` and read only inside the server boundary. Adding
 * an operator credential to it would make those assertions demand a
 * declaration for a value the Worker never sees.
 *
 * What they need instead is the one thing that actually matters for a
 * credential that lives in a file on a developer's disk: **it must never reach
 * git.** That is the same question `check:config` asks of the redacted config
 * values, asked here for the two credentials that have no config to live in.
 *
 * ## TWO ASSERTIONS, AND THE FIRST ONE WORKS WITHOUT THE FILE
 *
 * The SHAPE scan runs everywhere, CI included, and needs no credential: it
 * looks for anything in a tracked file that matches an UptimeRobot key. That
 * is the fixture-independent half, and it is the half that still catches a
 * committed key on a machine that has no `.dev.vars` at all.
 *
 * The EXACT-VALUE scan runs only where the file exists. It is strictly
 * stronger there and impossible elsewhere, which is why it is conditional
 * rather than fail-closed: a clean checkout has no `.dev.vars` by design, and
 * failing on its absence would make this gate red in CI forever for a
 * condition that is correct.
 *
 * The pairing is deliberate. A conditional assertion that could pass by
 * reading nothing is exactly what hard rule 10 warns about, so the
 * unconditional shape scan is always there underneath it.
 */
```

### scripts/check-secrets.mjs:528 (WHY, shortened)

one helper, with its citation.

```js
// REUSES `gitIgnores` rather than spelling check-ignore a second time. One
  // helper, one argument order, one idea of what a non-zero status means:
  // hard rule 10's "one helper name, one argument order".
```

### scripts/check-secrets.mjs:538 (CONTRACT, shortened)

the shape and why it is loose.

```js
/*
   * The UptimeRobot key shape: `u`, the account's numeric id, a dash, then an
   * alphanumeric secret. Deliberately loose on the lengths, because guessing a
   * width would make the needle miss a key of a different vintage, and this
   * scan is the one that has to work with no credential in hand to compare
   * against.
   */
```

### scripts/check-secrets.mjs:545 (WHY, shortened)

why no word boundary, proven by plant; the plant string and the file count go to the history document.

```js
/*
   * NO LEADING `\b`, AND THE PLANT IS WHY. Written as
   * `/\bu\d{4,12}-[A-Za-z0-9]{16,64}\b/` and replayed against a key-shaped
   * string planted in a tracked file, it did NOT fire: the plant read
   * `_PLANT_u1234567-...`, and `_` is a word character, so there is no word
   * boundary before the `u`. A word boundary is the wrong anchor for a needle
   * that has to find a credential ANYWHERE in a file, including glued to a
   * prefix. The shape is specific enough to carry itself: a lowercase `u`, four
   * to twelve digits, a dash, then at least sixteen alphanumerics. Verified
   * against all 548 tracked files with zero false positives.
   */
```

### scripts/check-secrets.mjs:556 (WHY, shortened)

what the lookbehind refuses and why; the file, the date and the sequence go to the history document.

```js
/*
   * A `\uXXXX` JSON ESCAPE IS NOT A `u` IN THE TEXT, and the difference cost a
   * false positive on 2026-09-12.
   *
   * `data/publications.text.json` carries the extracted text of 31 PDFs, and 11
   * of them contain C0 control characters where a symbol font was mapped to low
   * code points: the prime mark in `5'-GCAGAGCATATAAAATGAGG` comes out as 0x03.
   * JSON escapes that, the DNA that follows is alphanumeric and long, and the
   * needle matched three of them. That is a scanner reading a file's ENCODING
   * rather than its content, and it would fire on any JSON file carrying a
   * control character before a hyphen.
   *
   * The lookbehind refuses exactly that and nothing else. A real key in a
   * tracked file is preceded by a quote, a space, an equals sign, a newline or
   * a word character, never by a backslash: a JSON string holding a genuine key
   * reads `"u1234567-..."`. The `_PLANT_u1234567-...` case the paragraph above
   * records still fires, and both directions are replayed as plants rather
   * than reasoned about.
   */
```

### scripts/check-secrets.mjs:597 (WHY, shortened)

the empty-needle class with its citation.

```js
// Guarded on length so an empty or one-character value cannot match every
    // file and report a plausible number. Hard rule 10, the empty needle.
```

### scripts/check-secrets.mjs:634 (NUMBER, shortened)

what this floors that a scope check cannot, and how the count steps; the measurements and their dates go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * The per-root scans here already refuse an empty scope, but that is a floor on
 * what was READ. This is the floor on what was ASSERTED, and the two fail on
 * different bugs: a scope check cannot see an assertion block that stopped
 * running over a scope that is still full.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it: 29 on 2026-08-14, and
 * 33 once section 3 landed. Never summed. Floored at 31, slack of two: the count
 * is driven by the secret list and the per-root pairs, so it steps by a known
 * amount when a secret is added, as it did going from seven to eight.
 */
```

### scripts/check-secrets.mjs:647 (NUMBER, shortened)

chronology beside the constant; the dated readings and the tolerance arithmetic go to the history document.

```js
/* RE-MEASURED 2026-09-07 by RUNNING this gate, after the .dev.vars credential
   section landed: 39 checks, up from 33. check:floors had just failed the old
   32 at a gap of 7 against a tolerance of 3. Tolerance is 3 at this count, so
   36 is the slackest legal value and is what the slack-of-two convention above
   gives. */
```

### scripts/check-secrets.mjs:652 (NUMBER, shortened)

why the number comes from the run; the dated reading and the gap arithmetic go to the history document.

```js
/* RE-MEASURED 2026-09-12 by RUNNING this gate, after OPENALEX_API_KEY became
   the tenth ratified secret: 41 checks. The step is the one this comment
   predicted, and the arithmetic answer would have been wrong in the direction
   that matters, so the number below comes from the run. check:floors failed 36
   at a gap of 5 against a tolerance of 3; 41 is the count and 38 is the
   slackest legal value, and the slack-of-two convention gives 39. */
```

## scripts/check-media.mjs

### scripts/check-media.mjs:1 (CONTRACT, shortened)

the boundary and its one exception, the four directions, which way each repair runs and fail-closed; the manifest move, the ruling's principle and both dated incidents go to the history document.

```js
/**
 * Gate: the D1 media index must agree with R2 and with `public/`, both ways.
 *
 * OBSERVATION BOUNDARY, REWRITTEN 2026-08-18 rather than extended, because two
 * of its sentences went false when the manifest half moved out. A boundary note
 * is a claim that ages (hard rule 7), and this file has now aged one twice.
 *
 * It reconciles KEYS. It lists R2, walks public/ and diffs both against D1. For
 * everything except the social cards it still never FETCHES one of those URLs,
 * and an object that exists with a row and 404s through the serving route
 * passes, which is exactly how 58 static rows carried broken /media//path
 * thumbnails while this gate was green.
 *
 * **THE SOCIAL CARDS ARE THE ONE EXCEPTION, and they are the exception because
 * the key-only reading is what let them break.** Added 2026-09-11 after ten of
 * eleven published posts served a 404 `og:image` for an unknown number of days:
 * the bucket held cards under the posts' OLD slugs, D1 held the new ones, and
 * every reconciliation any gate performed was internally consistent. The OG
 * block below therefore asserts BOTH directions, and one of them leaves this
 * file's usual boundary on purpose. See it for what each half can and cannot
 * see.
 *
 * **IT NO LONGER READS content/generated/assets.json AT ALL.** That comparison
 * was pure filesystem, so it was the one offline-capable assertion in a gate
 * that must be remote, and it now lives in `check:content` beside the two other
 * artifacts in that directory. What follows from the move, and it is the part
 * worth reading twice: this gate still detects a stale manifest, but only
 * INDIRECTLY and only AFTER A REBUILD. The Worker writes rows from the manifest,
 * so a manifest missing a file becomes a public/ file with no D1 row, which is
 * direction 3 below. Between a bad `build:assets` and the next rebuild, this
 * gate sees nothing, and when it does speak it names a missing ROW rather than
 * the manifest that caused it. That is precisely the "confusing D1 diff whose
 * real cause is two directories away" the old comment here warned about, and it
 * is now someone else's job to say it first, offline.
 *
 * So: manifest-to-filesystem is NOT here. Manifest-to-D1 is here, transitively,
 * late, and under a different name.
 *
 *   npm run check:media -- --local
 *   npm run check:media -- --remote
 *
 * **This gate is the entire reason the index is allowed to exist.** The ruling
 * (decisions.md, 2026-08-02) turns on one principle: an index is legitimate
 * exactly when it can be reconciled against its source. A USAGE cache cannot be,
 * because a citation may live outside the corpus and no scan can enumerate what
 * it does not know about. An EXISTENCE index can be, because R2 `list` is a
 * total function over the bucket and `public/` is a directory walk. So the
 * reconciler is not a follow-up to the index; it ships with it or the index is
 * not justified.
 *
 * FOUR directions, and it fails on any of them:
 *   1. an R2 object with no D1 row          -> backfill it
 *   2. a D1 row with no R2 object           -> delete the row
 *   3. a public/ file with no row           -> backfill it
 *   4. a storage='static' row with no file  -> delete the row
 *
 * Note which way each repair runs. **R2 WINS**, and `public/` wins for static.
 * A row is deleted because an object is absent; an object is NEVER deleted
 * because a row is. That asymmetry is what keeps D1 derived rather than a second
 * truth, and it is why this script only ever REPORTS: it has no repair mode at
 * all, because the repair for half these cases would be destroying data.
 *
 * DERIVED, never hardcoded, on the same rule `check-backup.mjs` follows: its
 * table list comes from `drizzle/` rather than a literal, so a new table is
 * covered the moment its migration lands. Here the expected sets come from R2
 * itself and from walking `public/`. Nothing in this file names an asset.
 *
 * FAILS CLOSED on an empty enumeration. A gate that passes because it examined
 * nothing is the failure mode that looks most like success, and this repo has
 * already been bitten by it: `COUNT(*)` on an fts5 index reads through to its
 * content table and reported 7 while the index held 0.
 */
```

### scripts/check-media.mjs:92 (WHY, shortened)

why derived and why both buckets.

```js
// DERIVED from the wrangler config, never restated. Two buckets split on
// lifecycle, and both are indexed: an OG card that existed but appeared in no
// listing is exactly the invisible-object problem the index exists to end.
```

### scripts/check-media.mjs:122 (WHY, shortened)

why alt joins the projection; the nine false disagreements go to the history document.

```js
// alt joins the projection so the roster comparison below has an index
      // side to compare against. It was absent on the first run of that
      // assertion, which read every row's alt as "" and reported nine
      // disagreements that were really one missing column.
```

### scripts/check-media.mjs:146 (WHY, shortened)

why a fixture is needed at all, and why it runs first.

```js
/**
 * The reference collector, over a fixture that exercises every form.
 *
 * **This exists because the real corpus exercises NONE of it.** All 12 posts
 * carry zero images, zero figure directives and zero covers, so the collector
 * could be completely broken and every other gate would still pass. A code path
 * with no coverage and no exercise is exactly the thing this repo refuses to
 * ship, and "it returned 0 refs" would look identical whether it worked or not.
 *
 * Pure: no network, no database. Runs FIRST so a contract failure is immediate.
 *
 * @returns {Promise<string[]>} problems
 */
```

### scripts/check-media.mjs:214 (WHY, shortened)

what over-collection costs.

```js
// The negatives matter as much as the positives. Over-collection puts rows in
  // media_refs that can never join to anything, and every one of them would
  // refuse a delete forever for a citation that does not exist.
```

### scripts/check-media.mjs:250 (WHY, shortened)

why it is retried; the hung list and its timings go to the history document.

```js
// RETRIED ONCE. The R2 list HUNG on 2026-08-07 with a 400 carrying no
    // CF-R2-Error header, taking check:all past a ten minute timeout, and was
    // clean on retry at 27s. retryRead wraps a timeout as well as a rejection
    // precisely for that symptom. Read only.
```

### scripts/check-media.mjs:276 (NUMBER, shortened)

what the zero-checks cannot see and why these floors are loose; the sweep, the measurement and its date go to the history document.

```js
/*
   * AND FLOORS, not just the two `=== 0` guards above, added by the 2026-08-24
   * floor sweep. This gate had no floor of any kind, and `=== 0` is the weakest
   * form of an anti-vacuity check: it catches a listing that returned NOTHING
   * and nothing else.
   *
   * The failure it cannot see is the one this gate is for. Every comparison
   * below is a set difference between three enumerations, so they are satisfied
   * by the enumerations shrinking TOGETHER: a listing that paginates once and
   * stops, a walk that stops descending, a `mediaRows` query that grows a
   * WHERE clause. Ten objects against ten rows reconcile perfectly, and the
   * fifty-nine that vanished are reported by no one. `rows` had no guard at all,
   * not even `=== 0`.
   *
   * MEASURED THROUGH THIS GATE 2026-08-24 by running it --remote: 11 R2
   * objects, 59 public files, 69 D1 rows. Floors about eight percent under.
   * These track CONTENT, so they are expected to move up as media is added and
   * they are deliberately not tight.
   */
```

### scripts/check-media.mjs:361 (WHY, shortened)

what it stops and why it is cheap.

```js
// Every row's storage and kind must be what classify.mjs says they are. This
  // is what stops a row being hand-written, or written by a path that guessed,
  // and it costs one function call per row because the classifier is pure.
```

### scripts/check-media.mjs:384 (WHY, shortened)

what a drifted role hides.

```js
// ROLE, verified against the deriver exactly as kind and storage are. This
    // is what stops the picker filter silently rotting: a row whose role drifts
    // from `roleOf()` either hides a real image or offers half a diagram pair,
    // and neither is visible from anywhere else.
```

### scripts/check-media.mjs:398 (WHY, shortened)

the disclosure, why the hash is not a defence and which half this is; the measured object, its bytes and the dates go to the history document.

```js
/*
   * NO SOCIAL CARD MAY EXIST FOR A POST THE PUBLIC CANNOT SEE.
   *
   * MEASURED 2026-08-23, which is why this block exists: the draft
   * `charts-on-workers-fixture` had a card in the OG bucket answering 200 with
   * 41,149 bytes of PNG at /media/og/charts-on-workers-fixture-8af354a5.png,
   * while /blog/charts-on-workers-fixture answered 404. The card renders the
   * post's TITLE, so an unpublished headline was public. `build-og.mjs` had no
   * notion of visibility: its loop skipped posts with a cover and nothing else.
   *
   * The key is a hash of the template version, slug, title and tags, so it is
   * not guessable at a glance. That is not a defence and is not treated as one:
   * the object is public, unauthenticated and served with
   * `max-age=31536000, immutable`, and the URL is written into D1's og_image
   * for every post including this one.
   *
   * THE VISIBILITY RULE IS IMPORTED. `isPubliclyVisible` is the one JavaScript
   * owner of it; a second copy here is the shape that put five drafts into Ask
   * in July.
   *
   * Direction: cards that must NOT exist. This is the SECURITY half.
   *
   * **THE OTHER DIRECTION IS NOW ASSERTED TOO, in the block after this one.**
   * It used to be skipped on the reasoning that "cards are written by a manual
   * `build:og --remote` and a missing one is a cosmetic gap, not a disclosure".
   * The first clause is still true and is exactly why the second one failed:
   * nothing runs `build:og`, ship does not call it, and the key is a hash of
   * the slug, title and description, so a rename or a retitle silently moves
   * every card. Measured 2026-09-11: ten of eleven published posts served a
   * 404 og:image, and every unfurler got a broken card.
   */
```

### scripts/check-media.mjs:473 (WHY, shortened)

the two halves, what each can see that the other cannot, and where the expected set comes from; the plant's date and its readings go to the history document.

```js
/*
     * EVERY PUBLICLY VISIBLE POST HAS A CARD, in the bucket and on the wire.
     *
     * TWO ASSERTIONS OVER ONE EXPECTED SET, and they are separate because they
     * fail for different reasons and neither implies the other.
     *
     *   KEY RECONCILIATION reads the R2 listing this gate already has. It is
     *   the half that names the DEFECT: `build:og` has not been run since the
     *   slug or the title moved, and the card the site advertises was never
     *   generated. It needs no HTTP request of its own.
     *
     *   THE WIRE READ fetches each card through the deployed serving route.
     *   It is the half that can see what the key comparison cannot: a bucket
     *   the route is not bound to, a cache rule swallowing `/media/og/`, a
     *   deploy that never happened. It is the 58-broken-thumbnails lesson at
     *   the top of this file applied to the one class of object where a 404 is
     *   visible to every stranger who shares a link.
     *
     * Neither half is a substitute for the other, and the plant that proved
     * these two assertions MEASURED that rather than arguing it. On
     * 2026-09-11 one card key was deleted from the live bucket and the gate
     * re-run: the key reconciliation named the slug immediately, and the wire
     * read still reported 11 of 11 answering 200. Cards are served
     * `max-age=31536000, immutable`, so the edge kept serving an object that
     * no longer existed.
     *
     * Read that in both directions, because it is the whole argument for
     * running both. The KEY half sees a missing card the wire cannot see for
     * up to a year. The WIRE half sees a bucket the route is not bound to, a
     * cache rule swallowing `/media/og/`, or a deploy that never happened,
     * none of which a key comparison can reach. The repair for either is the
     * same one command.
     *
     * THE EXPECTED SET IS THE SAME `cards` DERIVATION `build-og.mjs` USES,
     * spelled through the same two imported predicates rather than restated:
     * publicly visible, and no cover of its own. A post with a cover uses the
     * cover as its og:image and has no generated card, which is why it is not
     * in this set and why asserting over every post would fail on it forever.
     */
```

### scripts/check-media.mjs:522 (WHY, shortened)

what empties the set and why a floor rather than a zero-check; the measurement goes to the history document.

```js
/*
     * SCOPE, PROVEN NON-EMPTY. An artifact whose posts are all drafts, or a
     * `cover` field that started arriving on everything, empties this set, and
     * both loops below then sweep clean over nothing. The floor is a floor and
     * not a zero-check for the reason every floor in this repo is: 11 was
     * measured on 2026-09-11 and a set that has fallen to one is a scan that
     * has stopped finding posts, not a blog that lost ten.
     */
```

### scripts/check-media.mjs:549 (WHY, shortened)

why the deployed host and why GET.

```js
/*
     * THE WIRE. Fetched from SITE_ORIGIN, which is the deployed host and NOT
     * whatever `--local` points at, because a local miniflare bucket has no
     * bearing on what a scraper gets. GET rather than HEAD: the serving route
     * is allowed to answer a HEAD differently and a 404 body is what the
     * audit actually observed.
     */
```

### scripts/check-media.mjs:583 (WHY, shortened)

why nothing could see the drift, why the page still renders from the file, and why the pairs are extracted; the two strings and the date go to the history document.

```js
/*
   * THE ROSTER'S ALT TEXT AND THE MEDIA INDEX'S MUST BE THE SAME STRING.
   *
   * MEASURED 2026-08-23: they were not. D1 held "Group photo of the 2019 Phage
   * Discovery Program cohort" for /phage-hunters/2019.webp and the page shipped
   * "The 2019 research group." Two owners of one fact, and the weaker string was
   * the one a screen reader actually got, on the only page on this site whose
   * whole content is photographs of people.
   *
   * NOTHING COULD SEE IT. The media library's no-alt lens counts EMPTY alt, so
   * a row with good text and a page with worse text is invisible to it; the page
   * renders from a typed data file, so a missing alt is a typecheck failure and
   * a divergent one is not. Both halves were individually correct.
   *
   * The page keeps rendering from the data file rather than querying D1: it is a
   * static page on a shared-cached route, and a per-request read to fetch a
   * constant is a cost with no reader. So the data file stays the render source
   * and THIS is what stops the two drifting.
   *
   * The pairs are extracted rather than imported because the data file is .ts
   * and this gate is .mjs. The extraction is scoped tightly (a src line, then
   * the next alt line) and its count is asserted, so a parser that stopped
   * matching reports zero pairs and fails rather than sweeping clean.
   */
```

### scripts/check-media.mjs:627 (NUMBER, shortened)

why floored rather than zero-checked; the count goes to the history document.

```js
/*
     * FLOORED rather than zero-checked, since the 2026-08-24 sweep. The nine
     * cohort photographs are a FIXED set in a committed data file, so a scan
     * that returns eight has stopped matching one of them and the missing one
     * is precisely where a drifted alt would hide.
     */
```

## scripts/check-fonts.mjs

### scripts/check-fonts.mjs:1 (CONTRACT, shortened)

the hole, what it asserts, why the baseline and the boundary; the type-scale motivation, the opsz range and the overlap paragraph go to the history document.

```js
/**
 * Gate over the self-hosted fonts: every `@font-face` DECLARATION must be true
 * of the BINARY it names.
 *
 * ## THE HOLE THIS FILLS
 *
 * `font-weight: 100 900` is a claim about a file. Nothing checked it. The two
 * Inter faces under `app/fonts/` were taken from `fonts.gstatic.com` and
 * committed, so unlike every other derived thing here they have no upstream to
 * be compared against: a file swapped for a static build, a re-subset that
 * narrows the weight axis, or a variable axis that quietly disappears would all
 * have rendered wrong and failed nothing.
 *
 * It exists now rather than later because a type scale is about to declare
 * `font-variation-settings: "opsz" <n>` per level. `opsz` on these files runs
 * 14 to 32, and a browser CLAMPS an out-of-range axis value silently: no error,
 * no console line, just a level that did not get the optical size it asked for.
 * That is the class of defect this gate is for.
 *
 * ## WHAT IT ASSERTS, per `@font-face` block that names a file
 *
 * The declared `font-weight` range against the `wght` axis, EXACTLY rather than
 * as a subset, so a narrowed re-subset fails. A single declared weight against
 * `OS/2.usWeightClass`, which is the static-font form. `font-style` against the
 * italic evidence in the file. `font-stretch` against `wdth` where declared.
 * The declared `font-family` against the file's own name table, so a wholesale
 * swap of a different typeface fails. And every `"opsz"`-style axis named in a
 * `font-variation-settings` anywhere in the sheets must EXIST in that family's
 * faces and CONTAIN the requested value.
 *
 * ## THE BASELINE, and why axis assertions alone are not enough
 *
 * Everything above is satisfied by a file that was re-subsetted while keeping
 * its axes: same `wght`, same `opsz`, fewer glyphs. That is a real way to break
 * a page and it is invisible to every assertion in the list. So each binary
 * also carries a pinned SHA-256 in `scripts/fixtures/font-baseline.json`, and a
 * changed byte is a named failure. `--update` rewrites it, deliberately loud,
 * which is the same shape `check:admin-ui` uses for the same reason: a fixture
 * that can be regenerated silently is not a fixture.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It reads DISK, never the wire, so it says nothing about what a browser
 * received. It asserts AGREEMENT and never judgment: whether `font-display`,
 * the metric-adjusted fallback or a `unicode-range` are the RIGHT choices is
 * not a thing it can know. It cannot see whether a font renders correctly, only
 * whether the declaration and the file agree about what the file is.
 *
 * ## OVERLAP, stated rather than discovered
 *
 * The 20 KaTeX faces are included for uniformity and the protection here is the
 * WEAKER half: `check:content` section 5 already byte-compares
 * `katex.generated.css` AND its faces against a fresh derivation from the
 * installed katex package, reconciled both ways, so a swapped or re-subsetted
 * KaTeX font already fails there. A rule with an exception is a rule somebody
 * edits, which is why they are in rather than out.
 */
```

### scripts/check-fonts.mjs:75 (CONTRACT, shortened)

why the parameter is named ok, in two lines.

```js
/**
 * The first argument is named `ok` because six other gates spell it that way
 * and `check:invariants` section 17 refuses two argument orders for one helper
 * name: an assertion copied between files would otherwise put a truthy STRING
 * in the condition slot, never fail, and still increment the count.
 *
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
```

### scripts/check-fonts.mjs:107 (WHY, shortened)

the strip rule with its citation, in one line.

```js
/**
 * Comments are stripped BEFORE matching, hard rule 10: prose about a face is
 * not a face.
 *
 * @param {string} css
 * @returns {string}
 */
```

### scripts/check-fonts.mjs:143 (WHY, shortened)

why the scan is not limited to the face blocks.

```js
// Axis requests anywhere in the sheet, not only inside @font-face: this is
  // what catches a type scale asking for an optical size the file cannot serve.
```

### scripts/check-fonts.mjs:151 (WHY, shortened)

why the levels need their own reader and why the family travels with the request; the two ranges go to the history document.

```js
/*
   * AND THE TYPE LEVELS, which do not spell `font-variation-settings` anywhere.
   *
   * app.css carries the scale as five properties per level, so a level's axes
   * live in `--t-<level>-vars` and its family in `--t-<level>-family`. The
   * regex above sees neither, which would have made this gate blind to exactly
   * the defect its own header says it was written for: a type scale asking for
   * an optical size the file cannot serve.
   *
   * THE FAMILY IS CARRIED WITH THE REQUEST, and that is the half that makes the
   * assertion sharp. Two shipped families now carry `opsz` on different ranges,
   * Inter 14 to 32 and Source Serif 4 8 to 60. Checking a request against every
   * carrier would fail the serif's legitimate `opsz` 48 against Inter; checking
   * it against none would let an Inter level ask for 48 and be clamped in
   * silence. Each level is checked against the family its own -family token
   * names, and nothing else.
   */
```

### scripts/check-fonts.mjs:174 (WHY, shortened)

why a variant has no family of its own, and why it is not spelled out.

```js
// A VARIANT INHERITS ITS LEVEL'S FAMILY. A `--t-<level>-strong-vars` is
    // that level at a heavier weight, not a ninth level, so it has no
    // `-family` of its own and must not: a second family token for one level
    // would be a second owner of the same decision. The base is the level name
    // with its last segment dropped, and only when no exact `-family` exists,
    // so a real level always wins over the fallback.
    //
    // The variant is NOT spelled in full here on purpose. Section 31's token
    // scan reads scripts/ without stripping comments, so naming it would mark
    // it as referenced and then fail it for being referenced.
```

### scripts/check-fonts.mjs:193 (WHY, shortened)

the tenth vacuity class and why the floors are low bars.

```js
/*
 * SCOPE, ASSERTED BEFORE ANY PER-BLOCK ASSERTION. A regex that stopped matching
 * would iterate nothing and every loop below would report a clean sweep, which
 * is the tenth vacuity class. The floors are the inventory as it stands and are
 * deliberately low bars: they exist to prove the parse happened at all.
 */
```

### scripts/check-fonts.mjs:199 (WHY, shortened)

why split rather than filtered, and why the annotation is a double star.

```js
/*
 * Split rather than filtered, so `file` is a string in the half that has one.
 * `blocks.filter((b) => b.file)` leaves the type `string | null` and every use
 * below would need a cast, which is a way of telling the typechecker to stop
 * looking at exactly the field whose absence this gate cares about.
 *
 * The annotation below is a DOUBLE-STAR block on purpose. Written as a plain
 * `/*` comment the `@type` is not JSDoc, TypeScript ignores it, and the array
 * infers `any[]`: every null error disappears and nothing is checked, which is
 * a silent pass wearing the costume of a fix.
 */
```

### scripts/check-fonts.mjs:221 (WHY, shortened)

why the skip is explicit and why the list is exact; the two names go to the history document.

```js
/*
 * The local()-only faces are SKIPPED EXPLICITLY and counted, so a future
 * file-backed block cannot fall into the skip path unnoticed. Two today, both
 * metric-adjusted fallbacks: "Inter Fallback" over `local("Arial")` and
 * "Source Serif 4 Web Fallback" over `local("Georgia")`.
 *
 * The list is exact rather than a count, because a count is satisfied by any
 * two fileless faces and the thing worth asserting is WHICH two.
 */
```

### scripts/check-fonts.mjs:270 (WHY, shortened)

what a namespaced family is for and why the map polices itself.

```js
// NAMESPACED FAMILIES are the one case where the declared family and the
// binary's own name table legitimately differ. app.css declares the serif as
// "Source Serif 4 Web" so that a reader with the retail family installed cannot
// put a different file in the resolution path for the same name. This map is
// what keeps that from being a licence: the declaration is still pinned to ONE
// binary family, so swapping the typeface behind the namespaced name fails
// exactly as it would without one.
//
// It polices itself below, in both directions, for the reason the exemption
// maps in check:contrast do: an entry naming a family app.css no longer
// declares is a hole nobody would notice.
```

### scripts/check-fonts.mjs:375 (WHY, shortened)

what a clamp looks like, in two lines.

```js
/*
 * AXIS REQUESTS FROM THE SHEETS. The value must be IN RANGE, because a browser
 * clamps an out-of-range axis silently: the level renders, at the wrong optical
 * size, with nothing anywhere reporting it.
 */
```

### scripts/check-fonts.mjs:380 (WHY, shortened)

the zero-scope arm and what the floor is for; the level count goes to the history document.

```js
/*
 * A ZERO-SCOPE SEARCH REPORTS A CLEAN SWEEP. The scale carries eight levels and
 * every one of them names two axes, so the floor is the inventory as it stands
 * and exists to prove the parse happened at all rather than to bound it.
 */
```

### scripts/check-fonts.mjs:456 (WHY, shortened)

why the cards are asserted here, which build is canonical and what was refused; both build strings, the ruling date and the outline measurement go to the history document.

```js
/*
 * THE SATORI FACES, which are not in any stylesheet.
 *
 * `build-og.mjs` and `check-logo.mjs` draw the social cards with the static
 * TTFs under `assets/fonts/`. They are Inter too, and nothing reconciled them
 * against the faces the site serves: MEASURED 2026-09-12, the TTFs are Inter
 * 4.001 build git-9221beed3 and the served woff2 are 4.001 build git-66647c0bb,
 * so the cards are already drawn with a different build of the same release.
 * That is tolerable and it is not nothing, which is why it is asserted here
 * rather than left to be discovered: the family must match what the site
 * serves, and the weights build-og asks for must be the weights in the files.
 *
 * ## RULED 2026-09-12: THE SERVED woff2 BUILD IS CANONICAL
 *
 * `git-66647c0bb`, the build under `app/fonts/`, is the site's Inter. It is
 * what every reader sees, and its provenance is already ruled: byte-identical
 * to what fonts.gstatic.com served, so the change was WHO serves them and not
 * WHAT is served. Social cards are a secondary artifact of that identity and
 * take their typeface from it rather than the other way round.
 *
 * THE TWO ARE NOT ALIGNED AND CANNOT CHEAPLY BE. satori reads TTF, OTF and
 * WOFF and NOT woff2, by its own README, so one shared file is impossible.
 * Aligning would mean statics compiled from the canonical build, and those do
 * not exist to download: Google Fonts publishes Inter as variable fonts only
 * (`Inter[opsz,wght].ttf`), and rsms/inter releases carry their own version
 * lineage rather than a `4.001;git-*` build string.
 *
 * So the difference STANDS, deliberately, and what was refused with it was
 * building a woff2-to-TTF instancing pipeline: a new dependency, a build step
 * and a gate to keep the two in step, which is the same trade app.css already
 * refused for italic subsetting. What holds the line instead is this section
 * plus the byte baseline: neither side can move without a named failure.
 *
 * MEASURED, and the reason this is tolerable rather than merely accepted: the
 * two builds agree on unitsPerEm, ascent, descent and lineGap, and on the
 * advance width of every glyph tested, so card text sets identically. Outlines
 * differ in point encoding, which is what a variable default instance against a
 * compiled static looks like, so that comparison cannot separate a build
 * difference from variable-versus-static and is not offered as evidence.
 */
```

### scripts/check-fonts.mjs:500 (WHY, shortened)

why a token and not the first block; the serif's arrival and its date go to the history document.

```js
/*
 * THE FAMILY THE SITE SERVES, read from `--font-sans` rather than from the
 * FIRST `@font-face` block under app/fonts/.
 *
 * It was the first block, which was true for exactly as long as Inter was the
 * only family there. The serif landed under app/fonts/ on 2026-09-13 and made
 * the old selector a statement about source ORDER: moving the serif's face
 * above Inter's would have silently re-pointed this comparison at the serif and
 * the cards would have been checked against the wrong typeface, passing.
 *
 * `--font-sans` is an independent declaration and the right source anyway: the
 * cards draw body-weight text, and the body's family is what that token says.
 * The serif sets headings and never appears on a card.
 */
```

### scripts/check-fonts.mjs:585 (NUMBER, shortened)

why measured by running and why the mode matters; both dated readings and the tolerance arithmetic go to the history document.

```js
/*
 * THE FLOOR. Measured by RUNNING this gate over the tree as it stands, never by
 * summing the assertions above: a hand-counted floor is a second owner of a
 * number the gate already knows.
 *
 * MEASURED ON THE DEFAULT BRANCH, and the distinction cost a wrong floor once
 * already. `--update` SKIPS the per-binary baseline comparisons, so it executes
 * 26 fewer checks than a plain run: 117 against 143. A floor measured from an
 * `--update` run sits 26 under the count it is supposed to guard, which is the
 * exact shape ruling 23 exists to catch.
 *
 * RE-MEASURED 2026-09-13 on a plain run, NOT an `--update` one, after the serif
 * and the type levels landed: 232. The rise is the serif's own per-binary
 * assertions plus 22 axis requests where there were none, since the scale is
 * the first thing on this site to ask for an optical size. Floor is that count
 * minus the check:floors tolerance, max(3, ceil(232 * 0.05)) = 12.
 */
```

## scripts/check-backup.mjs

### scripts/check-backup.mjs:1 (CONTRACT, shortened)

the boundary, why per table, why the list is derived and what the media pull covers; the portfolio incident and the ruling reference go to the history document.

```js
/**
 * Verifies the per-table backup path against the live schema.
 *
 * OBSERVATION BOUNDARY: proves the export PATH works and that the table list
 * matches the migrations. It never restores, so it cannot tell you the dump
 * would reconstruct the database, and --local reads miniflare state rather than
 * production.
 *
 *   npm run check:backup -- --local
 *   npm run check:backup -- --remote
 *
 * `wrangler d1 export` does not work on this database. It refuses outright
 * while any fts5 virtual table exists, which is permanent: search needs them.
 * The documented backup path is therefore per table, `--no-schema --table`,
 * and this script is what keeps that claim honest.
 *
 * The table list is DERIVED, never hardcoded. `drizzle/` is the source of truth
 * for schema, so the expected set is parsed out of the migration files and
 * compared with what the database actually holds. It fails in both directions:
 * a table in the migrations but missing from the database, and a table in the
 * database that no migration created. A backup list that silently stops
 * covering a new table is the exact failure this guards, and it has happened
 * before in this portfolio (capsid `document_links`, missing for nine days
 * while backups ran green).
 *
 * Every export is then checked for real rows rather than mere existence. An
 * empty file is a passing export of nothing, which is the failure mode that
 * looks most like success.
 *
 * **SINCE 2026-09-01 IT ALSO PULLS THE MEDIA OBJECTS** to the same backup root
 * (decisions-vol-13.md). The mirror bucket covers this site's own code deleting
 * an object; both copies are in one account, so neither covers account loss.
 * This pull is the only copy outside it, and it lives here so that one command
 * produces a complete restore set. `--remote` only: `--local` reads miniflare,
 * which holds no objects, and it says so rather than counting zero as a pass.
 */
```

### scripts/check-backup.mjs:48 (WHY, shortened)

why the other bucket is not pulled.

```js
/**
 * The irreplaceable bucket. The OG bucket is deliberately NOT pulled: every
 * card is regenerable by `build:og` from the corpus, and backing up output that
 * has a rebuild door is how a backup set grows without getting safer.
 */
```

### scripts/check-backup.mjs:63 (WHY, shortened)

why both targets are worth running; the discovery goes to the history document.

```js
// Local only. Miniflare creates it; remote D1 does not have it. Found by this
  // script failing on --local after it had already passed on --remote, which is
  // the reason both targets are worth running.
```

### scripts/check-backup.mjs:69 (CONTRACT, shortened)

why one quoted string, in two lines.

```js
/**
 * Runs wrangler as one already-quoted command string. Passing an args array
 * alongside shell:true concatenates without quoting, which has split an
 * argument containing a space twice in this repo.
 *
 * @param {string} args
 * @returns {{ stdout: string, status: number }}
 */
```

### scripts/check-backup.mjs:82 (WHY, shortened)

what a head slice reported; the sibling gate's identical bug and the two CI runs go to the history document.

```js
/**
 * The END of wrangler's output, which is where its error is.
 *
 * Both throws below used `stdout.slice(0, 200)`, the HEAD, which is the banner:
 * the version line, the resource location, and on a runner an "update
 * available" notice. Measured 2026-09-08 in `check:restore`, whose export site
 * carried the identical bug: the 300-character cut it used landed mid-line on
 * wrangler's non-interactive prompt and the actual error, a 7404, never
 * reached the log. Two CI runs failed unreadably before the cut was moved.
 *
 * @param {string} text
 * @param {number} [max]
 */
```

### scripts/check-backup.mjs:103 (WHY, shortened)

why the UUID for remote and why the name for local; the error code and the CI observation go to the history document.

```js
/**
 * How this gate ADDRESSES the database, which is not always its name.
 *
 * `wrangler d1 export <name>` resolves the name through the `d1_databases`
 * entry in `wrangler.jsonc` and uses that entry's `database_id`. That file is
 * gitignored, so a clean checkout bootstraps it from `wrangler.jsonc.example`,
 * whose `database_id` is the placeholder `00000000-0000-0000-0000-000000000000`.
 * A `--remote` run there addresses a database that does not exist and dies as
 * 7404. Measured in CI 2026-09-08 via `check:restore`, which hit it on the
 * identical command shape; this gate has the same defect and has never run in
 * CI, so it was latent rather than absent.
 *
 * `--local` keeps the NAME deliberately. Miniflare state is keyed by the
 * config's `database_id` and there is no UUID to resolve; an account lookup
 * would be answering a question about the wrong database.
 *
 * @param {string} target
 * @returns {string}
 */
```

### scripts/check-backup.mjs:129 (WHY, shortened)

why there is no fallback.

```js
// FAILS CLOSED. Falling back to the name would substitute a different value
  // for the one asked for and reintroduce the 7404 wearing a passing lookup.
```

### scripts/check-backup.mjs:145 (CONTRACT, shortened)

why virtual tables are excluded.

```js
/**
 * Parses table names out of the migration files.
 *
 * Virtual tables are deliberately excluded: they cannot be exported, they are
 * rebuilt from their content table, and including them would make the expected
 * set disagree with the exportable set by construction.
 *
 * @returns {Promise<Set<string>>}
 */
```

### scripts/check-backup.mjs:180 (CONTRACT, shortened)

why shadows are found by prefix.

```js
/**
 * Reads the tables the database actually holds, minus platform bookkeeping and
 * minus every fts5 virtual table and its shadow tables.
 *
 * Shadow tables are found by prefix against the virtual table names rather than
 * by a hardcoded `_data`/`_idx` suffix list, so a future fts5 table brings its
 * own shadows along without this script needing an edit.
 *
 * @param {string} target
 * @returns {Promise<{ real: Set<string>, virtual: Set<string>, shadow: Set<string> }>}
 */
```

### scripts/check-backup.mjs:192 (WHY, shortened)

why this read is retried and what is not; both dates go to the history document.

```js
/*
   * RETRIED ONCE. This exact read died with SQLITE_CANTOPEN on 2026-08-05 and
   * again on 2026-08-11, both times clean on an immediate retry. The per-table
   * export below is wrapped too, since 2026-08-11; nothing that WRITES is.
   */
```

### scripts/check-backup.mjs:220 (WHY, shortened)

why one classifier and why the platform set stays here.

```js
/*
   * Classified by scripts/lib/sqlite-tables.mjs since 2026-08-10, the same
   * module check:invariants sections 4, 5 and 7 read. The rules here and there
   * were already identical, and the comment above this function said so; one
   * module makes that a fact rather than a coincidence that held twice.
   *
   * PLATFORM_TABLES stays HERE. It is a property of where these rows came from,
   * a live D1 carrying Cloudflare bookkeeping, not a property of SQLite, so the
   * shared classifier does not know about it and should not.
   */
```

### scripts/check-backup.mjs:262 (NUMBER, shortened)

the blind spot in a both-directions comparison, and why the floors are structural; the sweep, the measurement and the counts go to the history document.

```js
/*
   * SCOPE FLOORS, added by the 2026-08-24 floor sweep. This gate had NO floor
   * of any kind, and it is the one that decides whether this database can be
   * recovered at all.
   *
   * The two comparison loops below are BOTH DIRECTIONS between two independent
   * sources, which is a strong shape and has one blind spot: it is satisfied by
   * the two sources shrinking TOGETHER. If the migration parser stops matching
   * `CREATE TABLE` and the sqlite_master filter over-excludes in the same edit,
   * both sets go small, every loop agrees, the export writes the handful that
   * survived, and the run reports "ok" with a table count nobody floors.
   *
   * MEASURED THROUGH THIS GATE 2026-08-24 by running it BOTH WAYS, because the
   * offline tier runs --local and check:all runs --remote: local and remote
   * agree on every structural count (11 declared, 11 held, 3 virtual, 12
   * shadow) and differ only in bytes, which is why the floors are on structure
   * and not on size. A byte floor would be a floor on how much has been
   * written, which is content, and it would read differently on the two targets.
   */
```

### scripts/check-backup.mjs:322 (CONTRACT, shortened)

why it was lifted out unchanged.

```js
/**
   * Exports one table and reads back what it wrote.
   *
   * LIFTED OUT OF THE LOOP UNCHANGED so the loop could become a pool. Every
   * assertion this function makes, the non-zero status, the retry, the byte
   * count and the INSERT count, is the assertion the serial loop made, on the
   * same command against the same target writing the same file.
   *
   * @param {string} name
   */
```

### scripts/check-backup.mjs:334 (WHY, shortened)

why an export may be retried and why writes are not; the failing table, the date and the instance count go to the history document.

```js
/*
     * RETRIED ONCE, since 2026-08-11. This file's header used to say the export
     * was deliberately unwrapped, and the pre-audit sweep's `check:all` failed
     * right here: "per-table export failed for post_tags", clean on an
     * immediate re-run. That is the SIXTH instance of the transient Cloudflare
     * read class and the first to land outside retryRead's coverage.
     *
     * An export is a READ. It pulls rows and writes a LOCAL temp file, so a
     * second attempt overwrites its own output and lands nowhere else. Nothing
     * that writes to D1 or R2 is wrapped, and that stays true.
     *
     * The throw is load-bearing: wrangler RETURNS on a failed command rather
     * than rejecting, so without it retryRead has nothing to catch.
     */
```

### scripts/check-backup.mjs:348 (WHY, shortened)

the unfailable condition with its citation, and what the removed branch printed.

```js
/*
     * NO STATUS CHECK AFTER THIS. There was one, and it could not fire:
     * `retryRead` hands back what the callback RETURNED, the callback throws on
     * a non-zero status, so anything reaching the next line already has
     * `status === 0`. Hard rule 10's first class. It also printed
     * `exported.stdout` on the way out, which read as the diagnostic for a
     * failed export and was the one branch that never ran; the callback's own
     * `tail(r.stdout)` is where that output actually reaches a reader.
     */
```

### scripts/check-backup.mjs:375 (WHY, shortened)

the identity argument, why the cost was scheduling and why the bound; every timing goes to the history document.

```js
/**
   * THE EXPORTS RUN CONCURRENTLY, and NOTHING ELSE ABOUT THEM CHANGED.
   *
   * ## The identity argument, which is what licenses this
   *
   * The serial loop and this pool issue the SAME 11 commands, against the same
   * target, each writing its own `<table>.sql` under the same directory. Each
   * is a READ: `d1 export` pulls rows and writes a LOCAL file, which is the
   * property `retryRead`'s wrapper already depends on. So no two of them touch
   * the same byte, none of them writes to D1 or R2, and the order they run in
   * cannot change what any of them produces. The reporting below is re-sorted,
   * so even the OUTPUT is byte-identical to the serial version's.
   *
   * ## Why the cost was scheduling rather than work
   *
   * MEASURED 2026-08-29 on this machine: the whole gate ran 229.7s for twelve
   * `npx wrangler` invocations over 640 KB of SQL. The bytes are not the cost;
   * process startup is, twelve times over. The three earlier readings in
   * `VERIFICATION.md` (272s, 54s, 58s, 66s, 53s) span the same range for the
   * same reason and are why this gate has never had a usable norm.
   *
   * ## FOUR, and the number is argued rather than tuned
   *
   * The bound exists because the cost being removed is process startup, and
   * enough concurrent node processes to saturate the machine puts it straight
   * back as scheduler contention: the 2881-second `check:head` reading in
   * `VERIFICATION.md` was exactly that, a measurement taken through a saturated
   * machine. Four is under the core count of any machine this runs on, leaves
   * room for the runner itself, and takes eleven exports in three waves.
   */
```

### scripts/check-backup.mjs:422 (WHY, shortened)

why the output is re-sorted.

```js
/*
   * RE-SORTED BEFORE REPORTING. A pool completes out of order, and a gate whose
   * output line order depends on which export happened to finish first is a
   * gate whose diffs are noise. The serial loop's output is reproduced exactly.
   */
```

### scripts/check-backup.mjs:434 (WHY, shortened)

what the pool can fail at that the loop could not.

```js
/*
   * SCOPE, ASSERTED, and it is new with the pool. A worker that returned early
   * would leave exports unrun, and every count below would then be computed
   * over a smaller set: `empty.length === real.size` would be false, the
   * with-rows floor would be met by the four that did run, and the gate would
   * report ok. The serial loop could not fail this way; the pool can, so it is
   * checked.
   */
```

### scripts/check-backup.mjs:449 (WHY, shortened)

why empty reports rather than fails.

```js
// Empty tables are legitimate (nothing has been written yet), so this reports
  // rather than fails. What would NOT be legitimate is every table being empty,
  // which means the export path is broken rather than the data being absent.
```

### scripts/check-backup.mjs:458 (NUMBER, shortened)

why the check above is the weakest form; the measured tables and their names go to the history document.

```js
/*
   * AND A FLOOR ON HOW MANY CARRIED ROWS, because the check above is the
   * weakest form of this test: it fails only when EVERY export is empty, so an
   * export path that broke for all but one table reads as a pass.
   *
   * MEASURED BOTH WAYS 2026-08-24: 5 tables carry rows (post_tags, posts,
   * search_docs, settings, tags), local and remote alike. The other six are
   * legitimately empty. Floored one under, and this one moves with CONTENT
   * rather than schema, so it is deliberately the loosest floor in the file.
   */
```

### scripts/check-backup.mjs:479 (WHY, shortened)

why it is here rather than a second script, and why remote only; the ruling reference goes to the history document.

```js
/*
   * THE MEDIA OBJECTS, to the SAME backup root. Ruled 2026-09-01,
   * decisions-vol-13.md.
   *
   * ## WHY THIS IS HERE AND NOT IN A SECOND SCRIPT
   *
   * The mirror bucket answers the realistic threat, which is this site's own
   * code deleting an object. It answers NOTHING about account loss or
   * compromise, because both copies live in the same account. This pull is the
   * only copy outside it, and putting it beside the D1 export means one command
   * produces a complete restore set rather than two commands somebody has to
   * remember to run in pairs.
   *
   * ## REMOTE ONLY, AND SAID RATHER THAN SKIPPED SILENTLY
   *
   * `--local` reads miniflare state, which holds no objects, so the pull would
   * download nothing and report a clean sweep. That is the vacuity this file
   * already floors everywhere else, so the local run announces that it examined
   * nothing instead of counting it as a pass.
   *
   * ## THE FLOOR IS THE LIST, NOT A CONSTANT
   *
   * `downloaded` is compared against what R2 itself listed in the same call, so
   * an empty bucket and a broken download are distinguishable, and no byte
   * count is written down here to go stale. Per-object size verification lives
   * in `downloadAllObjects`, because a short read produces a file that exists
   * and restores to a corrupt image.
   */
```

## scripts/lib/child-processes.mjs

### scripts/lib/child-processes.mjs:1 (CONTRACT, shortened)

the two kill shapes, why a registry and not a sweep, what the port probe adds and the pid-reuse rule; every process count goes to the history document.

```js
/**
 * Killing a gate's long-running children, and clearing the ones a kill left
 * behind last time.
 *
 * ## THE DEFECT THIS IS FOR, measured 2026-08-31 rather than reasoned about
 *
 * `check:browser` starts two long-running children: a `vite preview` server and
 * a Puppeteer browser. Both are cleaned up on every ORDERLY exit. Neither is
 * cleaned up when the gate process is killed, because a hard kill on Windows is
 * not deliverable as a signal and no `finally` runs.
 *
 * Two kill shapes were replayed, and they leave DIFFERENT wreckage. Both
 * numbers below are dated observations, not properties:
 *
 *   Kill the gate node itself. Puppeteer's Chromes all exit within seconds,
 *   because they die with the parent that holds their DevTools pipe. What
 *   survives is the vite side: three processes, holding port 4173 with no
 *   owner, indefinitely. The next run then cannot bind the port.
 *
 *   Kill the npm and cmd wrappers ABOVE the gate node and leave the gate node
 *   orphaned. Eighteen processes stand: nine Chromes, four vite, two workerd,
 *   two esbuild, and the stranded gate. This one self-clears IF the orphan is
 *   allowed to finish, because its own `finally` still runs. It becomes
 *   permanent when the orphan is killed too, which is what a supervisor
 *   retrying a kill does.
 *
 * ## WHY A REGISTRY AND NOT A SWEEP
 *
 * The obvious repair is to hunt for leftovers by scanning every process on the
 * machine and killing what looks like ours. That is the approach pnpm MOVED
 * AWAY FROM in June 2026, because on Windows the scan is too slow to finish,
 * and it is the approach with the worst failure mode available here: Dustin
 * runs his own Chrome, and "looks like ours" is a guess that gets to close his
 * tabs when it is wrong.
 *
 * So the gate records what it STARTED, by pid, at the moment it started it, and
 * the next run reads that list. `taskkill /F /T` walks the tree from a pid we
 * know rather than from a pattern we hope is specific.
 *
 * ## THE PORT PROBE IS NOT A REVERSAL OF THAT, AND IT IS THE HALF THE REGISTRY
 * CANNOT HAVE
 *
 * `portListeners` below asks the OS who is listening on ONE port. That is not
 * the scan this file rejects: it names a single number the gate is about to
 * bind rather than pattern-matching every process on the machine, and it is
 * still not permitted to kill on the strength of the answer. The command line
 * check is the same one the registry uses, applied to the pid the OS named.
 * What it buys is the case the registry is structurally blind to, because the
 * registry is written by the process that dies.
 *
 * ## PID REUSE IS THE WHOLE SAFETY PROBLEM
 *
 * A pid in the file is not a claim that the process is ours. It is a claim that
 * it WAS ours, and Windows reuses pids freely. So no entry is ever killed on
 * the strength of its pid: the live process's command line is read first and
 * must still match what the gate launches. A pid that has been reused by
 * something else fails that match, is dropped, and is not killed. That check is
 * the reason this module reads a process table at all.
 */
```

### scripts/lib/child-processes.mjs:67 (CONTRACT, shortened)

why one normalised form.

```js
/**
 * Command lines are compared in ONE normalised form, because the same process
 * is spelled differently by the two things that report it. Windows hands back
 * backslashes and mixed case; the needles below are written lowercase with
 * forward slashes so a needle cannot fail to match for a reason that has
 * nothing to do with identity.
 *
 * @param {string | null | undefined} command
 * @returns {string}
 */
```

### scripts/lib/child-processes.mjs:81 (CONTRACT, shortened)

why this source and what an empty map means.

```js
/**
 * Every live process, as `pid -> { ppid, command }`.
 *
 * Windows goes through PowerShell rather than `wmic`, which is deprecated and
 * absent on newer builds, and rather than `tasklist`, which does not report a
 * command line at all. A missing command line is fatal to this module's whole
 * safety story, so a source that cannot supply one is not a fallback.
 *
 * Returns an EMPTY MAP if the listing cannot be taken. Callers treat that as
 * "cannot verify", and the only thing they do with an unverifiable entry is
 * leave it alone.
 *
 * @returns {Map<number, { ppid: number, command: string }>}
 */
```

### scripts/lib/child-processes.mjs:121 (WHY, shortened)

why an unreadable command line still gets an entry.

```js
// A process with no readable command line still gets an entry, so it can
        // be seen to EXIST. It just can never satisfy a needle, which is the
        // fail-closed direction.
```

### scripts/lib/child-processes.mjs:143 (CONTRACT, shortened)

when it is used and what recording only the spawned pid would record.

```js
/**
 * Every descendant pid of `rootPid`, from a table already read.
 *
 * Used at ONE moment: once the preview server has answered, to record the
 * wrapper chain npx puts between the gate and the actual vite process. That
 * capture is the difference between a registry that works and one that does
 * not, and the reason is measured: when the gate node is killed, the wrapper
 * the gate itself spawned DIES with it (its stdio pipe breaks) and the
 * grandchildren survive. Recording only the pid `spawn()` handed back records
 * the one process guaranteed to be gone by the time anybody looks.
 *
 * @param {number} rootPid
 * @param {Map<number, { ppid: number, command: string }>} table
 * @returns {number[]}
 */
```

### scripts/lib/child-processes.mjs:162 (WHY, shortened)

why the walk is bounded.

```js
// Bounded by the table size: a cycle in reported parentage (a reused pid can
  // manufacture one) would otherwise spin here forever.
```

### scripts/lib/child-processes.mjs:179 (WHY, shortened)

why a snapshot is not enough and why EPERM is positive; the replay's date goes to the history document.

```js
/**
 * Whether a pid is live RIGHT NOW, as opposed to when a table was read.
 *
 * Signal 0 checks for existence without delivering anything, and `EPERM` is a
 * positive answer: the process is there and simply not ours to signal.
 *
 * This exists because a process table is a SNAPSHOT and the preflight loop
 * invalidates it as it goes. Killing one recorded tree removes the processes
 * further down the same list, and asking the snapshot about them afterwards
 * says they are alive. Measured on the first replay 2026-08-31: two entries
 * that a sibling's tree kill had already removed were reported as FAILED TO
 * KILL, which is an instrument announcing a problem that did not exist.
 *
 * @param {number} pid
 * @returns {boolean}
 */
```

### scripts/lib/child-processes.mjs:205 (WHY, shortened)

why the probe exists beside the registry, the protocol gotcha and the three states; the measured run and its pid go to the history document.

```js
/**
 * The pids LISTENING on a TCP port, asked of the OPERATING SYSTEM.
 *
 * ## WHY THIS EXISTS ALONGSIDE THE REGISTRY ABOVE
 *
 * The registry is written by the process that dies, so it cannot record the one
 * thing that outlives a hard kill. Measured 2026-09-03: a killed run left a
 * `vite preview` holding 4173, the registry file was empty because the kill took
 * the gate before anything was appended, and the next run's preflight reported
 * `0 cleared, 0 stale, 0 reused` while the port was occupied the whole time. A
 * cleanup that reads only its own bookkeeping is blind to exactly the case that
 * bookkeeping was for.
 *
 * The port is the fact that does not depend on this repo having written
 * anything down, which is why the probe goes to the OS and not to a file.
 *
 * ## THE MEASURED GOTCHA, AND IT IS THE WHOLE REASON THIS IS NOT A ONE-LINER
 *
 * `netstat -ano -p tcp` DOES NOT LIST THE HOLDER. On Windows that flag selects
 * IPv4 TCP only, and vite binds `[::1]:4173`, which netstat reports under the
 * separate `TCPv6` protocol. The first version of this probe used `-p tcp`,
 * found nothing, and reported a free port while pid 21108 was listening on it.
 * So the listing is taken UNFILTERED and the protocol is matched here.
 *
 * ## THE RETURN VALUE HAS THREE STATES, NOT TWO
 *
 * An array is an answer. `null` means the listing could not be taken at all,
 * which is NOT the same as "nobody is listening" and must never be collapsed
 * into it: that collapse is how a probe reports a clean sweep of nothing.
 *
 * @param {number} port
 * @returns {number[] | null} listening pids, or null if no listing could be taken
 */
```

### scripts/lib/child-processes.mjs:252 (WHY, shortened)

why the last colon, in two lines.

```js
// Anchored on the LAST colon, so `[::1]:4173` cannot be satisfied by an
      // address that merely contains the digits, and `:41730` cannot match.
```

### scripts/lib/child-processes.mjs:265 (WHY, shortened)

which exit is an answer and which is unverifiable.

```js
// lsof exits 1 when it simply matched nothing, which is an ANSWER. Only a
  // missing or erroring binary is the unverifiable state, and that is what an
  // absent stdout with a nonzero status that is not 1 looks like.
```

### scripts/lib/child-processes.mjs:277 (CONTRACT, shortened)

which flag is load-bearing and why.

```js
/**
 * Kill a process AND everything under it.
 *
 * `taskkill /F /T` is what npm does and what pnpm moved to in June 2026. The
 * `/T` is the load-bearing flag: the interesting processes here are always
 * grandchildren (vite's workerd and esbuild, Chrome's renderers), and killing
 * the root alone reproduces the defect rather than fixing it.
 *
 * @param {number} pid
 * @returns {boolean} whether the kill reported success
 */
```

### scripts/lib/child-processes.mjs:303 (WHY, shortened)

why append-per-line rather than rewrite-at-exit.

```js
/**
 * The on-disk record of what this gate started.
 *
 * One JSON object per line, appended as each child is launched, so a gate that
 * is killed between two spawns still leaves a usable record of the first. A
 * rewritten-at-exit file would be empty in exactly the case it exists for.
 */
```

### scripts/lib/child-processes.mjs:316 (CONTRACT, shortened)

what a needle must be and why.

```js
/**
   * Record a child. `needles` are what the live command line must STILL contain
   * for a later run to be allowed to kill this pid, so they name the process
   * rather than merely describing it: normalised (lowercase, forward slashes),
   * and specific enough that an unrelated process which inherits the pid cannot
   * satisfy them by accident.
   *
   * @param {number | undefined} pid
   * @param {string} kind
   * @param {string[]} needles
   */
```

### scripts/lib/child-processes.mjs:333 (WHY, shortened)

what a failed write may and may not cost.

```js
// A registry that cannot be written costs the NEXT run its cleanup. It
      // must never cost THIS run its gate result, which is the only thing
      // anybody is waiting on.
```

### scripts/lib/child-processes.mjs:403 (WHY, shortened)

why unverifiable entries are kept rather than killed.

```js
// No listing means no way to tell ours from a stranger's. Killing on the
      // pid alone is the one thing this module refuses to do, so the entries
      // are KEPT for a later run that can read a table.
```

### scripts/lib/child-processes.mjs:415 (WHY, shortened)

why the two states share a label.

```js
// Gone when the table was read, or gone since: an earlier entry's tree
      // kill takes its whole subtree, and the rest of this list is full of that
      // subtree. Both are the same fact, so they get the same label.
```

### scripts/lib/child-processes.mjs:443 (CONTRACT, shortened)

what it refuses, why by command line and why an unreadable one is safe; the EBUSY incident and its date go to the history document.

```js
/**
 * Processes matching any of `needles`, by COMMAND LINE.
 *
 * Ship's preflight refuses when a `check:all` run, a `check:browser` run or an
 * orphaned `vite preview` is still alive, because all three write the build
 * directory or the database underneath it. On 2026-09-10 a ship failed with
 * EBUSY on build/client for exactly that reason: preview servers orphaned by
 * killed gate runs, which `check:all`'s own reaper cannot see because a killed
 * run records nothing.
 *
 * ## BY COMMAND LINE, BY PID, NEVER BY NAME
 *
 * Every one of these is `node` or a child of it. A name match would refuse on
 * ship's own process and on every unrelated editor, and this repo already has a
 * standing rule that the reaper works by PID and never by name.
 *
 * `self` is excluded so a caller cannot refuse on itself, which is not a
 * hypothetical: ship is a node script and would match a needle the moment one
 * got looser.
 *
 * ## AN UNREADABLE COMMAND LINE CAN NEVER MATCH, AND THAT IS THE SAFE WAY ROUND
 *
 * `readProcessTable` still gives such a process an entry, so it is visible as
 * EXISTING, but it satisfies no needle. The caller refuses on what it can name
 * and leaves what it cannot alone.
 *
 * @param {Map<number, { ppid: number, command: string }>} table
 * @param {Array<{ needle: string, what: string }>} needles
 * @param {number} [self] a pid to exclude, normally `process.pid`
 * @returns {Array<{ pid: number, what: string }>}
 */
```

### scripts/lib/child-processes.mjs:489 (WHY, shortened)

why the list lives here and why the needle is the shorter one; the measured holder and the file reference go to the history document.

```js
/**
 * What ship's preflight refuses to run alongside, and what each one is.
 *
 * HERE RATHER THAN IN `ship.mjs` so `test/ship-preflight.test.mjs` can import
 * the real list. A copy in the test would keep passing after somebody removed a
 * needle from ship, which is the mirror this repo has already been bitten by
 * more than once: the plant would go on proving a refusal that no longer exists.
 * `ship.mjs` cannot be imported by a test, because importing it RUNS a ship.
 *
 * `preview --port 4173` and not `vite preview --port 4173`: the process that
 * actually binds the port is `node .../vite/bin/vite.js preview --port 4173`,
 * measured against the real holder and recorded at `check-browser.mjs:145`. The
 * longer needle matched nothing, and the test above is what caught it.
 */
```

## scripts/check-urls.mjs

### scripts/check-urls.mjs:1 (CONTRACT, shortened)

the boundary, the two levels and the permanent negatives; the finding, the ruling reference and the import argument go to the history document.

```js
/**
 * Gate over the URL protocol allowlist.
 *
 * OBSERVATION BOUNDARY: the allowlist predicate over crafted inputs. It never
 * fetches a URL and never scans the live corpus, so it proves the rule and not
 * that every published href obeys it.
 *
 *   npm run check:urls
 *
 * Ruling: dustinedwards/url-protocol-allowlist.md, 2026-08-01. The finding it
 * exists for: `[x](javascript:alert(1))` rendered as a LIVE href and reached
 * the stored HTML, the gated artifact, D1 and the published page. The operator
 * API writes posts, so it was agent-reachable on a public surface with no human
 * click in the path.
 *
 * This imports `app/lib/content/pipeline.mjs`, the module the Worker imports,
 * on the same principle as check:search and check:policy. Testing a copy of the
 * rule would prove the copy correct and say nothing about what ships.
 *
 * Two levels, deliberately:
 *
 *   The PREDICATE, `isAllowedUrl`, tested directly. Fast, and it can express
 *   obfuscations that markdown would percent-encode before the renderer ever
 *   saw them, which is the only way to check the figure directive's raw path.
 *
 *   The RENDERER, end to end. The predicate being right is worth nothing if the
 *   plugin is not wired in, or is wired in before the plugin that emits the
 *   href. Every case is rendered and the markup is read back.
 *
 * FAILS CLOSED. A missing fixture is an error, never an empty pass, and every
 * comparison is paired with a count so "0 failures" cannot mean "0 cases read".
 *
 * The javascript entries in the fixture are PERMANENT NEGATIVES. They are not
 * examples; they are the regression this gate exists to prevent, and removing
 * one is removing the gate.
 *
 * Pure: no database, no network, no build.
 */
```

### scripts/check-urls.mjs:83 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------------------------------
 * The predicate
 * ---------------------------------------------------------------------- */
```

### scripts/check-urls.mjs:94 (WHY, shortened)

why code points and not escapes; the three corruptions go to the history document.

```js
/**
 * Obfuscations are built from CODE POINTS rather than written as escapes.
 *
 * The source file then contains no control characters at all, which matters
 * more than it sounds: writing them literally corrupted pipeline.mjs into a
 * binary file three times while this was being built, and an escape sequence in
 * a JSON fixture would have been decoded by whichever tool wrote the file.
 */
```

### scripts/check-urls.mjs:110 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------------------------------
 * The renderer, end to end
 * ---------------------------------------------------------------------- */
```

### scripts/check-urls.mjs:164 (CONTRACT, shortened)

why the schema is the only thing in that path; the findings and the accepted protocols go to the history document.

```js
/* -------------------------------------------------------------------------
 * FRONTMATTER, which the render layer never sees
 *
 * `rehypeUrlProtocols` walks the hast tree `renderBody` produces. Frontmatter is
 * not in that tree, so the allowlist that closed the markdown XSS did not bind
 * the two frontmatter fields that reach a URL context. `further_reading[].url`
 * is rendered as a live public `<a href>` and was validated with `z.url()`,
 * which accepts `javascript:`, `data:`, `vbscript:` and `file:`. Findings B001
 * and B008.
 *
 * These bind the SCHEMA, because the schema is the only thing in that path.
 * Asserted against `frontmatterSchema` itself, the object both writers import,
 * so it cannot pass against a copy of the rule.
 * ---------------------------------------------------------------------- */
```

### scripts/check-urls.mjs:213 (WHY, shortened)

why behaviour is not enough, what came apart and why comments are stripped; the dated instance and the list of victims go to the history document.

```js
/* -------------------------------------------------------------------------
 * THE SHARED PREDICATE, asserted on the SOURCE
 *
 * Everything above tests BEHAVIOUR, and behaviour is not enough here. The rule
 * is not "these fields refuse bad protocols", it is "these fields call
 * `isAllowedUrl`, the same predicate the renderer uses, rather than
 * reimplementing the rule". Those come apart, and on 2026-08-07 they had:
 * `cover.src` was a site-absolute regex that blocked `javascript:` only as a
 * side effect of demanding a leading slash. Every behavioural case above was
 * green, because every fixture outcome the regex produces is the outcome the
 * predicate produces. A green gate, a correct outcome, and the wrong mechanism.
 *
 * That matters because the mechanism is what survives the next edit. Relax the
 * path rule for a legitimate reason and the protocol hole reopens silently,
 * with no fixture case failing. So the property is asserted directly, against
 * the source text, the way check:headers binds `workers/app.ts` to its
 * ratification rather than inferring it from a response.
 *
 * COMMENTS ARE STRIPPED FIRST. Both docblocks in `pipeline.mjs` discuss
 * `isAllowedUrl` in prose, one of them saying in so many words that it is the
 * same predicate called rather than reimplemented. A parser that read the prose
 * would find the claim instead of the code and pass on a field that does not
 * call it. That trap has already been hit by check:logo, check:contrast,
 * check:features and check:headers; it is the default failure here, not an edge
 * case. Only BLOCK comments are stripped: the line-comment form would truncate
 * the `//host` inside a message string, and the prose trap is entirely in the
 * docblocks.
 * ---------------------------------------------------------------------- */
```

### scripts/check-urls.mjs:291 (CONTRACT, shortened)

the two failures, why it is this gate's to own and why it reads the corpus; the ruling reference and the post count go to the history document.

```js
/* -------------------------------------------------------------------------
 * THE REDIRECT MAP: every old slug goes somewhere that exists, and no post
 * claims a slug the map is still redirecting away from.
 *
 * Ruling 47, 2026-09-09. Nine posts were reslugged and every old URL keeps
 * answering with a 301. Two things can go wrong with that, and neither is
 * visible until a reader hits it:
 *
 *   A REDIRECT TO A 404. The gateway resolves the map without touching the
 *   database, deliberately (the grounds are on `slug-redirect.mjs`), so it
 *   CANNOT know whether the target exists. Nothing else looks either: a post
 *   body's internal links are not corpus-checked, and `check:content` reads
 *   `further_reading` only. So the target's existence is this gate's to own,
 *   and it is a build-time property, because the corpus is on disk.
 *
 *   A SLUG THAT IS ALSO A SOURCE. If a post ever took the name
 *   `letting-an-agent-publish` again, that post would be UNREACHABLE: the
 *   redirect runs in the gateway, before the router, so the 301 fires and the
 *   post at that slug can never be served. It is the sharper of the two,
 *   because the post looks completely fine on disk and in D1.
 *
 * READ FROM `content/posts/*.md`, NOT FROM THE BUILD PRODUCT.
 * `content/generated/posts.json` is gitignored, so a CI checkout does not have
 * it, and a gate whose expected values come out of the pipeline it is checking
 * is the fixture-independence failure hard rule 10 names. The frontmatter is
 * parsed with the same `frontmatterSchema` the Worker uses, so "published"
 * means here exactly what it means there.
 *
 * PAIRED WITH COUNTS, like every other section in this file: a map that parsed
 * to nothing and a corpus that read nothing both report a clean sweep.
 * ---------------------------------------------------------------------- */
```

### scripts/check-urls.mjs:335 (WHY, shortened)

why a second file, and why it is not two owners, with its citation.

```js
/*
 * THE RETIRED SET, AND WHY IT IS A SECOND FILE.
 *
 * Everything below this point reads `content/redirects.json` and checks that
 * what is IN it is coherent. That cannot catch the failure that matters most:
 * DELETING an entry. A map with an entry removed is perfectly coherent, it just
 * silently stops redirecting a URL that is already published, and the gate
 * would report a clean sweep over a smaller set. Same shape as the empty-scope
 * failure this file guards everywhere else, one level up.
 *
 * So the expected set comes from a file the map cannot edit, and the two are
 * reconciled in BOTH DIRECTIONS: every retired slug has a redirect, and every
 * redirect source is a retired slug. That is the same arrangement
 * `check:features` uses for `content/enhancements.json`.
 *
 * This is not two owners of one fact (hard rule 17), because they are two
 * different facts. `retired-slugs.json` records that a URL was ONCE PUBLIC,
 * which is history and is append-only. `redirects.json` records WHERE IT GOES
 * NOW, which is a current decision and can change. Retiring a tenth post edits
 * both, in the same commit, which is what the reconciliation forces.
 */
```

### scripts/check-urls.mjs:391 (WHY, shortened)

why a malformed post is reported rather than skipped.

```js
/**
 * The corpus, as slug to frontmatter, straight off disk.
 *
 * A post whose frontmatter does not parse is NOT skipped, it is counted and
 * reported. Skipping would let a malformed post drop out of the known set and
 * turn a live redirect target into a missing one that this gate calls fine.
 */
```

### scripts/check-urls.mjs:411 (WHY, shortened)

the three conditions and why it cannot be softened, with its citation.

```js
/*
   * PUBLISHED, on the same three conditions the public read applies: not a
   * draft, dated today or earlier, and not holding a future `publish_at`. A
   * redirect whose target is a draft is a redirect to a 404 for every reader,
   * and hard rule 1 is why this cannot be softened to "the file exists".
   */
```

### scripts/check-urls.mjs:486 (WHY, shortened)

what each negative is for.

```js
/*
 * PERMANENT NEGATIVES for the predicate. Each is a path it must never claim:
 * a sibling route under the same prefix, or a lookup shape that would answer
 * from `Object.prototype` rather than from the map. Removing one is removing
 * the check.
 */
```

### scripts/check-urls.mjs:527 (WHY, shortened)

why by position and why comments are stripped.

```js
/*
 * THE GATEWAY ACTUALLY CALLS IT, AND CALLS IT IN THE RIGHT PLACE.
 *
 * Everything above is about a predicate that nothing has to invoke. This is the
 * wiring, asserted by POSITION in the gateway's own body, which is the same
 * reasoning `check:policy` uses for the money path: asserting that a stage
 * merely EXISTS passes on an arrangement that runs it too late. Comments are
 * stripped first, because in this repo a comment has both satisfied and failed
 * an assertion about code.
 */
```

### scripts/check-urls.mjs:571 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------------------------------
 * Counts, so a green run cannot mean an empty one
 * ---------------------------------------------------------------------- */
```

### scripts/check-urls.mjs:607 (NUMBER, shortened)

why a fixture-driven gate needs this floor and why the slack is small, with its citation; both measurements and the rotted sentence go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * Every case here comes from a committed fixture, which is exactly the shape
 * that fails quietly: a fixture that parsed to an empty list would run zero
 * cases and report a clean sweep of the protocol allowlist, which is hard rule
 * 6's enforcement.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 97.
 * Never summed. The count is a fixed function of the fixture's case lists, so
 * it moves only when a case is added.
 *
 * The prose here said "floored at 92" while the constant below read 97, which
 * is hard rule 17's rot in its ordinary form: the constant was raised to the
 * measured value and the sentence justifying it was not. Corrected 2026-09-09
 * rather than left for the next reader to trip over.
 *
 * RE-MEASURED THE SAME WAY on 2026-09-09, after the redirect section landed:
 * 197. Floored at 188, a slack of nine. The redirect half contributes six
 * assertions per map entry plus the reconciliation's two, so the slack is
 * deliberately smaller than one entry's worth: deleting a single redirect has
 * to be caught by the both-directions reconciliation going RED, and it must not
 * be able to hide inside the floor's tolerance instead.
 */
```

## scripts/check-destructive.mjs

### scripts/check-destructive.mjs:1 (CONTRACT, shortened)

the boundary, why a class rather than three assertions, and the completeness half; the audit's three paths go to the history document.

```js
/**
 * Gate: every DESTRUCTIVE intent is confirmed in the ACTION, not in a handler.
 *
 * OBSERVATION BOUNDARY: this is a SOURCE gate. It reads each route's `action`
 * and proves the confirmation predicate is called inside the branch that
 * handles the intent, before that branch can be reached by a submission. It
 * does NOT run an action, so it cannot see a guard that is present and wrong
 * (a count compared against the number the form carried rather than the one
 * read this request, say). The predicate's own behaviour is held by
 * `test/media-view.test.mjs`; whether the branch reaches it is this gate's job.
 *
 *   npm run check:destructive
 *
 * ## Why this exists
 *
 * An external audit found three destructive paths whose only confirmation ran
 * in a client event handler: bulk post delete used `prompt()` in an `onClick`,
 * single post delete and single media delete used `confirm()` in an `onSubmit`.
 * With scripting off the handler never runs, the form posts, and the action
 * deletes. The ceremony was script-only while the destruction was not.
 *
 * **THE SAME DEFECT HAD ALREADY BEEN FOUND AND FIXED ONCE, on `empty-trash`,
 * and closed WITHOUT SWEEPING FOR SIBLINGS.** That is the whole reason this
 * file is a gate over a CLASS rather than three assertions over three lines. A
 * guard that runs in a handler is not a guard, it is feedback; the gate is
 * whatever the action checks, because the action is the only thing a crawler, a
 * prefetch, a hand-made POST or a reader without JavaScript cannot skip.
 *
 * ## The completeness half, which is the part that keeps working
 *
 * Every intent an action handles must be CLASSIFIED here, destructive or not.
 * A new intent nobody classified FAILS BY NAME rather than defaulting to safe.
 * That is the difference between a gate that catches the next instance and one
 * that documents the last three: without it, a fourth delete added next year
 * would be as invisible as these three were.
 *
 * FAILS CLOSED. An unreadable file, an action whose body will not parse, or an
 * intent vocabulary that comes back empty is a FAILURE, never a skip.
 */
```

### scripts/check-destructive.mjs:61 (WHY, shortened)

why these two are destructive; the reclassification date goes to the history document.

```js
/*
   * RECLASSIFIED 2026-08-17, from REVERSIBLE. Both read as maintenance and both
   * destroy records: `rebuild` removes rows whose source object is gone, and
   * `sync-ask` prunes every AI Search record the run did not upload and drops
   * cached answers. Neither can know its own removal count without running, so
   * both confirm on a count of 1 and state the scale at stake instead.
   */
```

### scripts/check-destructive.mjs:70 (WHY, shortened)

why these are the first with no recovery path, with its citation; the date goes to the history document.

```js
/*
   * BOTH WEBMENTION REMOVALS, 2026-09-04, and they are the first destructive
   * intents in this repo with NO RECOVERY PATH AT ALL.
   *
   * Every other entry above removes something that a rebuild, a sync or the
   * repository can produce again: media rows are derived from R2, the Ask
   * index from the corpus, a post's file from git. A webmention row came from
   * a stranger's POST, converges toward nothing, and hard rule 18's "repair it
   * through its derivation" has no meaning for it. Deleted is gone.
   */
```

### scripts/check-destructive.mjs:119 (WHY, shortened)

the boundary the detector cannot cross.

```js
/*
 * NOT IN THE VOCABULARY, AND THAT IS THE BOUNDARY WORTH STATING: `upload-form`
 * is never compared with `intent === "..."`. It is selected by the shared
 * predicate in `app/lib/media/upload-contract.mjs`, so this gate's detector
 * cannot see it, and neither can it see any future intent routed the same way.
 * Adding a destructive path behind a predicate rather than a comparison would
 * hide it from here. Named rather than left to be discovered.
 */
```

### scripts/check-destructive.mjs:131 (CONTRACT, shortened)

why condition first, and what a label-first call does.

```js
/**
 * CONDITION FIRST, matching every other gate here. It was label-first for one
 * run, and `check:assertions` caught it twice over: once as helper-signature
 * drift, and once as rule (g), because a label-first call makes argument 1 a
 * string literal and a string literal is always truthy. Every assertion in this
 * file would have passed unconditionally.
 *
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
```

### scripts/check-destructive.mjs:240 (WHY, shortened)

why the smallest branch; the intent's name and the sibling gate's mistake go to the history document.

```js
/*
     * THE SMALLEST BRANCH THAT TESTS THIS INTENT, and the smallness is the
     * point. `bulk-delete` is tested twice in its file: once in a compound
     * condition shared with the two retag intents, and once in its own inner
     * branch. Asserting against the outer one would be satisfied by a guard
     * sitting in the retag path, and asserting against the FILE would be
     * satisfied by any mention anywhere, which is the mistake the media axis
     * gate made this week: an assertion that searches the whole document is
     * satisfied by anything on the page.
     */
```

### scripts/check-destructive.mjs:253 (WHY, shortened)

why offsets come from one text and matching from the other; the vacuous run goes to the history document.

```js
/*
       * Offsets come from RAW and are used against BARE. `strip` blanks string
       * BODIES, so the intent literal is unmatchable in the stripped text (the
       * first version of this searched there and found nothing, and every
       * per-intent assertion below went vacuous while the run still printed a
       * count). It preserves LENGTH exactly, so the two index the same bytes,
       * and brace matching has to happen on the stripped text or a brace inside
       * a string throws it.
       */
```

### scripts/check-destructive.mjs:326 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------- the operator API's own verbs --- */
```

### scripts/check-destructive.mjs:328 (WHY, shortened)

why the detector was blind, the recurring class, and why a policy rather than a typed confirmation; the tool name and the date go to the history document.

```js
/*
 * THE SECOND WRITE SURFACE, WHICH THIS GATE COULD NOT SEE UNTIL 2026-09-05.
 *
 * Everything above reads `intent === "..."` out of a route action, which is how
 * the admin plane spells a verb. The operator API spells it differently: a
 * bearer-token POST carrying `{tool, args}`, dispatched on a `ToolName`. So a
 * gate whose vocabulary is one string comparison saw NONE of it, and
 * `delete_post` has been a delete authority nothing here classified since the
 * operator API shipped.
 *
 * That is FAILURES.md's newest shape in a third form. It was first a `reject`
 * hidden behind a ternary; then the same class with a different spelling; and
 * here it is an entire surface using a different noun. The lesson each time is
 * that a classifier which reads syntax is blind to any verb expressed another
 * way, and the repair each time is to teach it the other way rather than to
 * trust that somebody will remember.
 *
 * ## WHAT IS ASSERTED, AND WHY IT IS NOT A TYPED CONFIRMATION
 *
 * The admin plane's ceremony is `confirmationSatisfied`, a human typing a count
 * into a form. That is the right ceremony for a person who may be mistaken
 * about which button they are on. It is the wrong one for a machine caller: an
 * agent typing "1" into its own request proves nothing, and the credential IS
 * the ceremony there.
 *
 * So the operator's equivalent is a declared POLICY: a destructive tool must
 * carry a `policy` string in `TOOL_DESCRIPTORS`, which `GET /api/operator`
 * serves, so a caller learns the refusal before it tries. A destructive tool
 * with no policy is one an agent will discover by being refused, which is the
 * failure this asserts against.
 */
```

### scripts/check-destructive.mjs:374 (WHY, shortened)

the zero-scope arm; the measurement goes to the history document.

```js
/*
   * SCOPE, ASSERTED. An empty parse classifies nothing and reports no problem,
   * which is what a compliant surface reports. MEASURED 2026-09-05 by RUNNING
   * this: 11.
   */
```

### scripts/check-destructive.mjs:444 (WHY, shortened)

why comments are left in place here.

```js
/*
   * THE POLICY IS THE OPERATOR'S CEREMONY, so a destructive tool must carry
   * one. Read out of the descriptor block by name, comments left in place:
   * `policy` is a property whose value is a string literal, so prose cannot
   * satisfy it the way a bare needle would.
   */
```

### scripts/check-destructive.mjs:470 (WHY, shortened)

what the guarantee is worth, why whole-source and why comments are stripped; the ruling reference goes to the history document.

```js
/*
 * THE BACKUP BUCKET IS WRITE-AND-READ ONLY. Ruled 2026-09-01, vol 13.
 *
 * `MEDIA_BACKUP` exists so that the site's own code deleting a media object
 * cannot lose the bytes. That is worth exactly as much as the guarantee that
 * NOTHING here ever deletes from it, and a guarantee held only by prose is the
 * shape this repo keeps paying for. Pruning the mirror is a human act, by hand.
 *
 * WHOLE-SOURCE, not routes: the danger is not a form intent, it is any line
 * anywhere that reaches the binding with a delete. `app/`, `workers/` and
 * `scripts/` are all swept.
 *
 * COMMENTS ARE STRIPPED FIRST, and that is load bearing rather than tidy. Every
 * file that touches this binding carries a comment SAYING it never deletes from
 * it, and several of those sentences contain both the binding name and the word
 * delete. Matching raw source would fail on the documentation of the rule.
 */
```

### scripts/check-destructive.mjs:505 (CONTRACT, shortened)

why a window rather than co-occurrence.

```js
/**
   * Does this stripped source delete from the backup binding?
   *
   * The window is what makes it an anchored needle rather than a file-wide
   * co-occurrence: a file may legitimately name `MEDIA_BACKUP` and, far away,
   * delete from something else.
   *
   * @param {string} stripped
   * @returns {string[]} offending excerpts
   */
```

### scripts/check-destructive.mjs:526 (WHY, shortened)

why the control runs first.

```js
/*
   * THE DISCRIMINATION CONTROL, run BEFORE the sweep.
   *
   * A matcher that cannot detect the violation agrees with every file it reads,
   * and a clean sweep by a blind needle is indistinguishable from a clean
   * repository. So the needle is first shown to FIRE on a known-bad string and
   * to stay silent on the two shapes that must not trip it.
   */
```

### scripts/check-destructive.mjs:550 (WHY, shortened)

why this file is excluded and why the exclusion is named; the measured run goes to the history document.

```js
/*
   * THIS FILE IS EXCLUDED FROM ITS OWN SWEEP, and the exclusion is named rather
   * than a glob, so it can never widen.
   *
   * The discrimination control above is a STRING LITERAL containing exactly the
   * violation being hunted, which is the point of it. Sweeping this file finds
   * that literal and reports the gate as the offender. Measured on the first
   * run of this block: one violation, in `check-destructive.mjs`, at the
   * control. The alternative was to write the control obfuscated so it would
   * not match itself, which would mean the control no longer tests the needle
   * that actually runs.
   */
```

### scripts/check-destructive.mjs:591 (WHY, shortened)

what a zero here would mean.

```js
/*
   * AND A FLOOR ON THE SWEEP'S SUBJECT. Zero files naming the binding would
   * mean the mirror had been removed or renamed, and every assertion above
   * would then be true of nothing.
   */
```

### scripts/check-destructive.mjs:615 (NUMBER, shortened)

why the floor is not raised on every addition, and what finally raised it; three dated re-measurements and their counts go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 53,
 * over 12 action modules and 19 intents, 6 of them destructive. Never summed, and not the 50 first
 * written here from counting the source by eye, which failed the gate on its
 * own first green run. Floored at 49, slack 4, so retiring one intent does not
 * fail the floor while dropping a whole BLOCK still does.
 *
 * RE-MEASURED 2026-09-01, again by running it: 59, over 13 action modules and
 * the same 19 intents, plus the six assertions the MEDIA_BACKUP block adds. The
 * FLOOR IS DELIBERATELY NOT RAISED to 55: its job is to catch a whole block
 * being skipped, and the slack is what lets an intent be retired without a
 * second edit here. Raising it on every addition would make it a count of the
 * checks rather than a floor under them.
 *
 * RE-MEASURED 2026-09-07, by running it: 105, after `upload_media` joined the
 * operator classification and brought its two per-tool assertions with it. Not
 * raised by hand for the same reason as above; raised now because check:floors
 * FAILED it at a gap of 8 against a tolerance of 6, which is that gate saying
 * the slack has stopped being slack and become a place 8 assertions could stop
 * running unnoticed. 99 is the count minus this count's tolerance.
 */
```

## scripts/check-floors.mjs

### scripts/check-floors.mjs:1 (CONTRACT, shortened)

why it exists, how it measures, why a pipe is not a log, the per-branch naming and both boundary halves; the drift figures and the timings go to the history document.

```js
/**
 * Gate: no floor has drifted far under the count it is supposed to floor.
 *
 *   npm run check:floors
 *
 * ## Why this exists, ruling 23
 *
 * Every counting gate compares its executed count against a `MINIMUM_*` and
 * fails when the count is BELOW it. Nothing ever compared the two when the count
 * was above, so a floor set once and never re-measured sinks further under its
 * count with every assertion added. `check:policy` reached 46 under. At that
 * distance the floor is decorative: forty-six assertions could stop running and
 * it would still pass, which is the skipped-block failure the floor was put
 * there to catch, arriving through the floor itself.
 *
 * A floor that far under its count is not a safety margin. It is a floor nobody
 * has measured since the gate was half its current size.
 *
 * ## HOW IT MEASURES: it READS under check:all, and RUNS standalone
 *
 * Each counting gate prints `floor <gate>:<name> executed=<N> minimum=<M>` on a
 * passing run, from `scripts/lib/floor.mjs`.
 *
 * Under `check:all` those lines are ALREADY in the output that runner captured,
 * so it pipes them here (`--from-stdin`) and nothing is run twice. Re-running
 * the tier to reproduce text the caller was holding cost 223.3s of a 1065s tier,
 * measured 2026-09-06, on every ship. Standalone there is no such output, so the
 * gates are run: a gate that only works as somebody else's passenger is one
 * nobody can re-run while fixing what it found.
 *
 * READING FROM A PIPE IS NOT READING A STORED LOG, and the difference is the
 * whole of hard rule 10's fixture independence. A log on disk is an artifact of
 * some EARLIER run, can be stale, and is produced by the process under test.
 * The pipe carries the output of the run happening now, in the same process
 * tree, and cannot outlive it: the subject and the reading are one event.
 *
 * READING THE FLOORS OUT OF SOURCE was the other option and is still rejected.
 * It would compare a number in a file against another number in the same file
 * and could not see a count at all, which is half the comparison.
 *
 * ## THE COUNT DEPENDS ON HOW THE GATE WAS INVOKED, so floors are named per
 * ## BRANCH
 *
 * `check:invariants` runs 299 assertions offline and 338 with `--remote`;
 * `check:llms` runs 9 and 11. Under check:all both take `--remote`, standalone
 * neither does. A single floor name per gate would mean whichever branch ran
 * last was judged against a floor measured from the other, silently. Both now
 * print `checks-offline` or `checks-remote`, so the two readings never collide
 * in the dedupe. Found by this refactor: reading check:all's run put the remote
 * branch in front of a floor set from the offline one, 338 against 284.
 *
 * ## THE TOLERANCE
 *
 * `max(3, ceil(executed * 0.05))`, one constant, stated once below with its
 * reason.
 *
 * ## FAILS CLOSED ON SILENCE
 *
 * A gate that is known to carry a floor and prints NO floor line is a failure,
 * not a skip. That is the case this gate exists for in its purest form: a floor
 * whose block stopped executing emits nothing, and a reader counting only the
 * floors it CAN see would report a clean sweep of the gates that still work.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It compares two numbers a gate PRINTS. It cannot tell whether the executed
 * count is itself honest: a gate whose assertions have all gone vacuous still
 * increments its counter and still reports a healthy gap. Hard rule 10 owns
 * that half, and no runner can see it.
 *
 * It also cannot see a gate with NO floor at all. Six exist and are named in
 * `UNFLOORED` below, so the absence is recorded rather than invisible.
 */
```

### scripts/check-floors.mjs:86 (NUMBER, shortened)

why a percentage, why a flat minimum and why they combine as a maximum; the named example and its rotted count go to the history document.

```js
/**
 * How far under its count a floor may sit.
 *
 * ## WHY 5 PERCENT
 *
 * A floor must absorb ordinary growth without needing an edit in every commit
 * that adds an assertion, or it becomes a number people bump reflexively, which
 * is how a floor stops being read at all. Five percent of a gate's count is
 * roughly the size of one added block in the gates here, so a normal working
 * session does not trip this and a gate that has doubled since its floor was set
 * does.
 *
 * ## WHY A FLOOR OF 3 UNDER THE PERCENTAGE
 *
 * Five percent of a small count rounds to nothing. For a gate running six
 * cases, 5 percent is 1, so a pure percentage would demand its floor sit within
 * one of its count and would fail the moment a seventh case landed. Three is
 * the smallest allowance that lets a small gate grow by a case or two between
 * deliberate re-measurements.
 *
 * THE EXAMPLE NAMED check:hook-scope AND ITS COUNT, which was 6 when this was
 * written and is not now. A count belongs to the gate that measures it (rule
 * 17), and restating one here made this comment go stale three times over
 * without anything noticing, in the file whose whole subject is floors drifting
 * under their counts. The arithmetic is the point; whose count it was is not.
 *
 * The two combine as a MAXIMUM rather than a minimum: whichever is more
 * generous wins, so big gates get proportional room and small gates get a flat
 * allowance.
 */
```

### scripts/check-floors.mjs:119 (CONTRACT, shortened)

what the map buys, in two lines.

```js
/**
 * Gates that carry NO floor, each with the reason, so an absence is argued
 * rather than accumulated. Same shape as `check-all.mjs`'s CI_EXCLUDED.
 *
 * These are NOT skipped: they are still run, and a floor line appearing in one
 * of them is a welcome surprise rather than an error. What this map buys is that
 * a reader can tell "no floor line because there is no floor" from "no floor
 * line because the floor stopped executing", which is the whole subject.
 *
 * @type {Record<string, string>}
 */
```

### scripts/check-floors.mjs:139 (CONTRACT, shortened)

which tier it is actually on, and what its floors are.

```js
/*
   * OFFLINE TIER, contrary to the obvious guess: it defaults to `--local` and
   * only `check:all` passes it `--remote`, so it IS run from here. Its four
   * floors are on TABLE COUNTS through a local `floor()` helper, which are scope
   * proofs rather than executed counts.
   */
```

### scripts/check-floors.mjs:147 (CONTRACT, shortened)

why a delegating gate emits nothing to read.

```js
/*
   * DELEGATES WHOLLY to `npx aislop ci`, a third-party binary that owns its own
   * reporting and emits no floor line. Same shape as `check:types` delegating
   * to `tsc -b`. Its threshold is `ci.failBelow` in `.aislop/config.yml`, which
   * is a SCORE on the diff rather than a count of assertions executed here, so
   * there is nothing for this gate to read back.
   */
```

### scripts/check-floors.mjs:155 (CONTRACT, shortened)

why a volatile scope floor reads as drift and is not; the measurement goes to the history document.

```js
/*
   * Its two floors are on BUILT CHUNKS and FILES WALKED, which are scope proofs
   * rather than executed counts. Measured 2026-09-05 the syntax floor stands at
   * 78 against 15, which reads as drift and is not: the chunk count is a
   * property of the bundler's splitting on the day, and a floor pinned near 78
   * would fail any build that emits fewer. The gate's own comment carries this.
   */
```

### scripts/check-floors.mjs:171 (CONTRACT, shortened)

the recursion and why nothing is lost.

```js
/*
   * RECURSION, and the expensive kind. `check:head` extracts a worktree and runs
   * the whole offline tier inside it. This gate is IN that tier, so running
   * check:head from here would run every counting gate inside an extraction
   * that is itself running every counting gate.
   *
   * Nothing is lost by skipping it: the floor lines that surface in check:head's
   * stdout belong to its CHILD gates, and every one of those is run directly
   * here. `check-head.mjs`'s EXCLUDED carries the matching entry in the other
   * direction.
   */
```

### scripts/check-floors.mjs:205 (WHY, shortened)

why the tier restriction is correctness rather than speed.

```js
/*
 * THE OFFLINE TIER ONLY, and this is a correctness constraint rather than a
 * speed one.
 *
 * This gate is itself tiered OFFLINE, so `npm run check` runs it. If it ran
 * every discovered gate it would reach `check:media`, which CLAUDE.md records as
 * NETWORK ONLY, and the offline tier would quietly acquire a network dependency
 * through the one gate whose job is reading other gates.
 *
 * The tier map is imported from `check-all.mjs` rather than restated, so a gate
 * retiered there cannot leave a second opinion here.
 */
```

### scripts/check-floors.mjs:217 (WHY, shortened)

why CI is narrower and why it is detected rather than flagged; the five gate names go to the history document.

```js
/*
 * AND IN CI, THE OFFLINE TIER MINUS WHAT CI CANNOT RUN.
 *
 * `check-all.mjs` records five gates a clean checkout cannot pass, each with a
 * measured reason: check:config, check:backup, check:head, check:browser,
 * check:page-payload. Running them from here in CI would fail this gate for
 * reasons that have nothing to do with any floor, and "fix the floors" would be
 * the wrong lesson to hand whoever read the red.
 *
 * Detected the way CI announces itself rather than by a flag, so nobody has to
 * remember to pass one in the workflow file.
 */
```

### scripts/check-floors.mjs:231 (CONTRACT, shortened)

why the name comes off the line.

```js
/**
 * Every floor line in one gate's output.
 *
 * The gate NAME comes off the line rather than from whoever produced the text,
 * which is what makes reading a whole run's concatenated output safe: a floor
 * printed by a child of check:head files under the gate that owns it.
 *
 * @param {string} output
 * @returns {{ gate: string, name: string, executed: number, minimum: number }[]}
 */
```

### scripts/check-floors.mjs:256 (WHY, shortened)

why the pipe is the default, why the gate list must travel with it and why it is not the rejected shape; the timing goes to the history document.

```js
/*
 * TWO WAYS IN, AND THE CHEAP ONE IS THE DEFAULT UNDER check:all.
 *
 * ## --from-stdin: READ, NEVER RERUN
 *
 * `check:all` has already run every gate and already captured every gate's
 * stdout. Re-running all of them to read lines that text already contains cost
 * 223.3s of a 1065s tier, measured 2026-09-06: the whole offline tier, paid
 * twice, once per ship. So check:all pipes what it captured and this gate reads
 * it.
 *
 * The payload is `{ gates: string[], output: string }` on stdin. `gates` is
 * needed and is not derivable from the text: the silent-gate assertion below
 * asks which gates produced NO floor line, and a gate that printed nothing is
 * invisible in a concatenation of what was printed.
 *
 * THIS IS NOT THE STORED-LOG SHAPE THIS GATE'S HEADER REJECTS. The rejected
 * design read an artifact a PREVIOUS run left on disk, which can be stale and
 * is produced by the process under test. This reads the output of the run
 * happening right now, in the same process tree, over a pipe that cannot
 * outlive it. The subject and the reading are the same event.
 *
 * ## standalone: still runs them
 *
 * `npm run check:floors` on its own has no captured output to read, and a gate
 * that only works as somebody else's passenger is a gate nobody can re-run
 * while fixing what it found. So the standalone path is unchanged.
 */
```

### scripts/check-floors.mjs:346 (WHY, shortened)

why a failed gate contributes nothing, and why the pipe path needs no equivalent.

```js
/*
     * A GATE THAT FAILED IS NOT A FLOOR READING. Its floor lines, if any, came
     * from a run that had already refused, and treating them as measurements
     * would let this gate report on numbers the producing gate disowned. The
     * failure is reported here and the gate contributes nothing.
     *
     * The --from-stdin path needs no equivalent: check:all reports a failing
     * gate in its own table, so a second complaint here would be the same fact
     * counted twice.
     */
```

### scripts/check-floors.mjs:372 (CONTRACT, shortened)

what the dedupe key is and why it is safe.

```js
/*
 * DEDUPED ON gate:name. A floor line names the gate that produced it rather
 * than being attributed to the process that printed it, so the same floor read
 * twice is one floor. Nothing here reads check:head today, but the dedupe is
 * what makes that safe if it ever does.
 */
```

### scripts/check-floors.mjs:416 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------------------- the floor --- */
```

### scripts/check-floors.mjs:418 (NUMBER, shortened)

why this floor is on lines read rather than assertions; the measurement and its date go to the history document.

```js
/*
 * THIS GATE'S OWN FLOOR, and it is on FLOOR LINES READ rather than on its
 * assertions, because the assertion count is DERIVED from the lines: a run that
 * read zero floors would make zero comparisons and report a clean sweep with a
 * perfectly healthy-looking "0 failures".
 *
 * MEASURED 2026-09-05 by RUNNING this gate: 34 floor lines across 24 gates.
 */
```

### scripts/check-floors.mjs:428 (NUMBER, shortened)

why the CI branch reads fewer and how it was measured.

```js
/**
 * The CI branch reads fewer, because five gates are excluded there and three of
 * them carry floors. Measured by running this gate with CI=1 locally, which
 * selects the identical gate SET; the counts themselves are properties of each
 * gate rather than of the machine.
 */
```

## scripts/sync-content.mjs

### scripts/sync-content.mjs:1 (CONTRACT, shortened)

what it writes, that it runs no gate, why that is not wired in and the bulk-path shape; the false claim's two halves and the batch note go to the history document.

```js
/**
 * Pushes the local content build product into D1, drift report first.
 *
 *   npm run sync:content -- --local
 *   npm run sync:content -- --remote
 *
 * The database is the read path; these files are the source of truth.
 *
 * **THIS SCRIPT DOES NOT RUN ANY GATE. RUN `npm run check:content` YOURSELF
 * FIRST.** This comment used to claim "runs the gate first, so a stale or
 * hand-edited artifact can never reach the database", and that was false in
 * both halves: `main()` reads the artifact directly, and the npm script is a
 * bare `node` invocation with nothing in front of it. Nothing here has ever
 * checked the artifact against its source.
 *
 * A false safety claim is worse than no claim, because it is read as a reason
 * not to check. This is the one script in the repo that writes to production
 * D1, and the failure it falsely promised to prevent, a stale or hand-edited
 * artifact reaching the database, is exactly the one that matters here: the
 * bulk path DELETES `search_docs` outright and replaces `media_refs` for
 * `source_type='post'` wholesale, so a bad artifact does not merely add wrong
 * rows, it removes right ones.
 *
 * Left as an instruction rather than wired in, deliberately. Shelling out to
 * the gate from here would make the write path depend on the gate's exit code
 * being read correctly through two layers of npm, and this repo has already
 * been burned by an exit code masked by a pipe. The gate is one command; the
 * sequence is `npm run check:content && npm run sync:content -- --remote`.
 *
 * On the bulk path this issues one upsert per post and then rebuilds the FTS
 * index outright, rather than leaning on the three per-row triggers. The
 * triggers are correct for single edits and are left in place for the admin
 * editor that comes later; a rebuild is the honest choice for a full resync.
 *
 * Note on batch(): D1's batch() is a Worker binding API and is not reachable
 * from a build script. The equivalent here is a single generated SQL file
 * applied with `wrangler d1 execute --file`, which D1 runs as one unit.
 */
```

### scripts/sync-content.mjs:92 (WHY, shortened)

why the rule is applied here rather than in the build product.

```js
// Revision date: explicit frontmatter wins, otherwise the last commit that
    // touched the file. Applied here rather than in the build product because
    // a render must depend on the sources alone (the determinism pass renders
    // twice and compares, and both writers' render hashes must agree; the
    // Worker has no git history to consult anyway). Falls back to now when
    // there is no history to read.
```

### scripts/sync-content.mjs:98 (WHY, shortened)

the two rules in one predicate, and why the null matters beyond tidiness; the date goes to the history document.

```js
/*
     * og_image IS SET ONLY WHEN A CARD ACTUALLY EXISTS, which is the same
     * condition `build:og` renders under. Two rules, one predicate.
     *
     * A post with a cover never gets a generated card. NEITHER DOES A POST
     * THE PUBLIC CANNOT SEE, since 2026-08-23: a draft's card was live and
     * public in R2 while the post itself answered 404, and the card renders
     * the title.
     *
     * This half matters beyond tidiness because `build:og`'s prune guard asks
     * D1 which cards the live site points at, and refuses to delete any of
     * them. While a draft's row advertised a card, that card could never be
     * pruned: the guard would protect the very object the fix exists to
     * remove. Writing null here is what lets the two agree.
     */
```

### scripts/sync-content.mjs:117 (WHY, shortened)

who owns the rule and what stays here.

```js
/*
     * `revisedDate` OWNS THE RULE, and this call is what makes
     * `check:microformats` able to feed a component the same value without
     * restating it. The conversion to epoch seconds stays here, because that is
     * this file's column format rather than the rule.
     */
```

### scripts/sync-content.mjs:172 (WHY, shortened)

why wholesale here and scoped in the editor.

```js
// Media citations, replaced wholesale for source_type='post'.
  //
  // Wholesale rather than per post, because this writer already holds the WHOLE
  // corpus: a per-post delete would leave refs behind for a post that has since
  // been removed from the artifact, and that stale row would be enough to refuse
  // the delete of an image nothing actually cites any more. The editor's save
  // path is the incremental writer and scopes its delete to one slug, because
  // one post is all it re-rendered.
```

### scripts/sync-content.mjs:203 (CONTRACT, shortened)

why replaced outright and why both indexes are rebuilt.

```js
/**
 * Rewrites the search index from the artifact's records.
 *
 * search_docs is fully derived, so it is replaced outright rather than
 * reconciled. Both FTS tables are then rebuilt, which is the documented bulk
 * pattern for external-content fts5 and the one that does not depend on trigger
 * ordering inside a batch. There are deliberately no triggers on search_docs.
 *
 * @param {any[]} records
 */
```

### scripts/sync-content.mjs:252 (WHY, shortened)

the named exemption and why all three; the ruling date and the per-file statement list go to the history document.

```js
/**
 * A `d1 execute --file` import, RETRIED ONCE.
 *
 * ## THE NAMED EXEMPTION TO WRITES-ARE-NEVER-WRAPPED (ruled 2026-08-12)
 *
 * `scripts/lib/retry.mjs` wraps READS only, and its header says so, because a
 * retried write is a write that may have landed twice. The rule now reads:
 * writes are never wrapped, EXCEPT writes idempotent BY CONSTRUCTION, with the
 * argument stated where the wrapper is applied. This is that statement.
 *
 * Every file this runs is idempotent, measured rather than asserted:
 *
 *   posts    DELETE ... NOT IN (kept slugs), INSERT ... ON CONFLICT(slug) DO
 *            UPDATE, post_tags and media_refs deleted and rebuilt, then the
 *            fts index rebuilt with ('rebuild')
 *   llms     INSERT ... ON CONFLICT(key) DO UPDATE SET value = excluded.value
 *   search   DELETE FROM search_docs, re-INSERT every record, both fts indexes
 *            rebuilt
 *
 * None appends. A doubled run lands the same corpus, which is not a theory: ship
 * re-runs this whole sync over the existing corpus on EVERY deploy, and asserts
 * three-way docsize equality afterwards, so the doubled case is the normal case
 * and is already gated.
 *
 * ## WHY ALL THREE, not just the one that failed
 *
 * The seventh transient hit the llms import specifically. All three go through
 * the same `/d1/database/{id}/import` endpoint with the same exposure and the
 * same idempotency argument, and wrapping only the one that happened to fail is
 * the fix that lands in all but one affected site. Nothing else in this script
 * is wrapped: the verification read at the end is a read, and no other write in
 * the repo is touched.
 *
 * The FINAL result is returned rather than thrown, so each call site keeps its
 * own error message; those strings are quoted in the canon.
 *
 * @param {string} args @param {string} label @returns {Promise<{stdout: string, status: number}>}
 */
```

### scripts/sync-content.mjs:320 (CONTRACT, shortened)

the five classes, why the write still runs and why a failed read throws; the ruling reference goes to the history document.

```js
/*
   * THE SHIP-TIME DRIFT REPORT. What the committed artifact's byte gate used
   * to prove at commit time, taken at the last moment it is still provable:
   * the instant before this write overwrites the evidence.
   *
   * (slug, source_blob_sha, render_hash) is read for every file-backed row
   * and compared against the fresh build product. Five classes per slug:
   *
   *   unchanged       same source, same render.
   *   source-changed  a different source_blob_sha: the repository moved and
   *                   D1 had not caught up yet. Expected on every content
   *                   ship; the write below is the catch-up.
   *   RENDER DRIFT    the SAME source with a DIFFERENT render_hash: the
   *                   Worker and the Node build rendered identical bytes
   *                   differently. This is the Worker-versus-Node class the
   *                   byte gate existed for. NOT a defect on its own: the
   *                   commonest cause is the previously deployed Worker's
   *                   content-drift poll rendering new markdown with the old
   *                   renderer just before the deploy (ruling 30, vol 15),
   *                   and this run's write is what repairs it. The verdict
   *                   belongs to a SECOND run, which ship performs; one
   *                   reading of this table cannot tell the two apart.
   *   missing-in-d1   a file with no row: a new post, or a lost row.
   *   extra-in-d1     a row with no file: a deleted post; the write cleans it.
   *
   * THE WRITE STILL RUNS, whatever this finds. Converging D1 to the build IS
   * the repair (rule 18), and refusing to write would preserve wrong rows to
   * protect a report. The exit goes nonzero at the very END, after every
   * write and verification, so ship can let the deploy stand, finish both
   * index convergences, and still fail the run: the same shape as an index
   * miss.
   *
   * A failed read THROWS rather than skipping the report. A drift report
   * that could not read one side reports nothing, and nothing is exactly
   * what a clean run reports.
   */
```

### scripts/sync-content.mjs:423 (WHY, shortened)

why the file is the source and why the decode is explicit; the seeded row's history goes to the history document.

```js
// The llms.txt settings row, from its tracked source file.
  //
  // Same shape as everything else here: the FILE is the source of truth and the
  // row is derived, so a rebuild reproduces it. Before 2026-08-02 the only thing
  // that ever wrote this row was 0001_init.sql, which seeds the virology copy
  // retired on 2026-07-27, so a rebuilt site would have served a stale llms.txt
  // with nothing to flag it. check:llms compares the two now.
  //
  // Read as a Buffer and decoded explicitly rather than with an encoding hint,
  // because this file is compared byte for byte and the platform text layer is
  // cp1252 on this host.
```

### scripts/sync-content.mjs:474 (WHY, shortened)

why the shadow table is the only count that can fail; the measured reading goes to the history document.

```js
// The index is only useful if it actually mirrors the table. Assert it rather
  // than assume the rebuild worked.
  // Counts the FTS shadow table, not posts_fts itself. On an external-content
  // FTS5 table `COUNT(*) FROM posts_fts` reads through to the content table, so
  // it equals COUNT(*) FROM posts no matter how broken the index is. Measured:
  // after DELETE FROM posts_fts the count still read 1 of 1 while MATCH returned
  // nothing. posts_fts_docsize holds one row per indexed document and went to 0,
  // so it is the only one of the three that can actually fail.
```

### scripts/sync-content.mjs:514 (WHY, shortened)

the same trap on the other index.

```js
// Same trap as posts_fts: COUNT(*) on either search index reads through to
  // search_docs and can never disagree with it. These count the docsize shadow
  // tables, which hold one row per INDEXED document and go to zero on a failed
  // rebuild, so they are the only counts here that can actually fail.
```

### scripts/sync-content.mjs:531 (WHY, shortened)

why nonzero comes last.

```js
/*
   * NONZERO LAST, after every write stood. Render drift means the shared
   * pipeline is not shared in practice, and a run that exits green on it is
   * the green-light-meaning-nothing this report replaces the byte gate to
   * avoid. The writes above already converged D1 to the build, so the state
   * is repaired; the exit is the alarm, not the refusal.
   */
```

## scripts/check-image-weight.mjs

### scripts/check-image-weight.mjs:2 (CONTRACT, shortened)

the four assertions, why no thresholds, why bytes per pixel, why delivered dimensions and why two floors; the defect's byte table, the ladder table and the dated measurements go to the history document.

```js
/**
 * Every image byte this site derives through the Images binding must be LOSSY,
 * and the transform ladder must be SHAPED like a transform ladder.
 *
 * ## The defect this was written for
 *
 * Measured 2026-09-01 on the first content object ever put in the bucket. A
 * 188,876 byte lossy WebP origin came back from every rung as LOSSLESS WebP,
 * because `.output()` in `app/routes/media.$.ts` carried no `quality` and the
 * Images binding defaults to lossless. The 640px rung was 404,020 bytes, the
 * 1024px 944,030, the 1408px 979,922: every rung heavier than the object it
 * resizes, which inverts the whole purpose of `srcset` and bills a
 * transformation for the privilege. The fix is `WEBP_QUALITY`, which lives in
 * `app/lib/media/encoding.mjs` since the second call site was found.
 *
 * ## THE FOUR ASSERTIONS, AND WHY NONE OF THEM CARRIES A NUMBER
 *
 *   1. **Every rung is lossy.** Chunk type `VP8`, never `VP8L`. This is the
 *      defect verbatim and it needs no threshold.
 *   2. **Bytes per delivered pixel never rises as delivered pixels rise.**
 *      Equality allowed. A bigger rendering that costs MORE per pixel than a
 *      smaller one is broken encoding whatever the absolute numbers are.
 *   3. **The narrowest rung is smaller than the origin.** Catches the gross
 *      case of serving the original unresized under a width parameter.
 *   4. **Every STORED placeholder is lossy**, decoded from the data URI in the
 *      `placeholder` column. Added 2026-09-06 when the same missing `quality`
 *      was found at its second call site, in the rebuild rather than the
 *      route, where nothing was watching it at all.
 *
 * A tuned constant here would be a second owner of a value that belongs to the
 * image, and would need re-tuning every time an asset was re-encoded.
 *
 * ## THE SUBJECT IS WIDER THAN THE ROUTE, AND ASSERTION 4 IS WHY
 *
 * One to three read what the transform route SERVES. Four reads what the
 * rebuild STORED, over every tier rather than over R2 alone, because the
 * function that derives a placeholder runs over static files in the same loop.
 * Both halves are the same defect: the Images binding emits lossless WebP when
 * no `quality` is given, and the constant that says otherwise now lives in
 * `app/lib/media/encoding.mjs` because there turned out to be two callers.
 *
 * ## ASSERTION 2 WAS RULED AS RAW BYTES FIRST, AND THE MEASUREMENT CHANGED IT
 *
 * The original ruling was "every rung smaller than the origin", then "bytes are
 * non-decreasing with width". Both fire on CORRECT output, and this is the
 * table that showed it, taken after the quality fix shipped:
 *
 *     rung      bytes    delivered   pixels    bytes/px
 *     origin   188,876   1080x810    874,800    0.2159
 *     w=160      8,500   160x120      19,200    0.4427
 *     w=320     28,446   320x240      76,800    0.3704
 *     w=640     91,488   640x480     307,200    0.2978
 *     w=1024   205,344   1024x768    786,432    0.2611
 *     w=1408   198,908   1080x810    874,800    0.2274
 *
 * Two things in that table break a raw-byte rule and neither is a defect.
 * `w=1024` and `w=1408` are BIGGER than the origin, because re-encoding at
 * quality 85 costs more than a source that was compressed harder than 85. And
 * `w=1408` is SMALLER than `w=1024` while being a larger image, because 1408
 * exceeds the source width, so the rung is capped and becomes a native-size
 * re-encode with no resampling, which reproduces an already-compressed source
 * very cheaply.
 *
 * Bytes per pixel falls monotonically down that whole column, which is what
 * healthy encoding looks like, and it was 6.1x the origin's rate when the
 * output was lossless. So it is the measure that separates the two cases
 * without a threshold.
 *
 * ## DELIVERED DIMENSIONS, NEVER THE REQUESTED WIDTH
 *
 * Read out of the response body's own header. `w=1408` against a 1080-wide
 * source delivers 1080, so a ladder ordered by REQUESTED width would compare
 * two rungs that are the same size and call the result an inversion.
 *
 * **Rungs with EQUAL delivered pixels are not compared at all.** The origin and
 * `w=1408` above are both 874,800 pixels, and their sort order relative to each
 * other would otherwise decide the verdict, which is a gate whose answer
 * depends on sort stability. The assertion is about what happens AS PIXELS
 * RISE; where they do not rise there is nothing to assert.
 *
 * ## The floors, one per subject
 *
 * A sweep that examined nothing prints what a clean sweep prints, so this FAILS
 * when it examined zero lossy-origin rows and reports what it found and skipped
 * either way.
 *
 * TWO floors rather than one, because the two subjects are selected by
 * different queries over different rows: a bucket full of gradeable ladders
 * satisfies the first while the `placeholder` column is empty, and an index
 * full of placeholders satisfies the second with no R2 image in it. One floor
 * covering both would be satisfied by either.
 *
 * Usage:
 *   node scripts/check-image-weight.mjs
 *   node scripts/check-image-weight.mjs --base http://localhost:8787
 */
```

### scripts/check-image-weight.mjs:116 (CONTRACT, shortened)

why D1 holds the key set and why one command string.

```js
/**
 * One read against the media index.
 *
 * `wrangler r2 object` has no `list` verb, which is why every reconciliation in
 * this repo reads D1 for the key set.
 *
 * ONE COMMAND STRING, not an argv array. With `shell: true` on Windows an array
 * argument carrying spaces is split by the shell before wrangler sees it, and
 * the SQL arrives as twenty unknown positional arguments.
 *
 * @param {string} sql a SELECT, inlined so the repo's own hook can read it
 */
```

### scripts/check-image-weight.mjs:155 (WHY, shortened)

why it is not narrowed to one tier.

```js
/**
 * EVERY STORED PLACEHOLDER, whatever tier produced it.
 *
 * Deliberately NOT narrowed to `storage = 'r2'` the way the ladder query is,
 * and the width is the assertion rather than a convenience: `placeholderFor`
 * runs over R2 objects and over static files from the asset manifest in the
 * same rebuild, so a defect in it reaches both tiers at once. A query that
 * looked at one would report the other clean without examining it, which is
 * FAILURES.md's "a fix in N-1 of N sites is not a fix" reproduced inside the
 * gate written to catch it.
 */
```

### scripts/check-image-weight.mjs:173 (CONTRACT, shortened)

what decides the verdict and why the mime column cannot.

```js
/**
 * What a raster buffer IS, read from the container rather than from a mime
 * column or a file extension.
 *
 * A WebP is a RIFF file whose image data lives in a `VP8 ` chunk when lossy and
 * a `VP8L` chunk when lossless; `VP8X` is an extended header carrying neither,
 * and must be walked past to reach the chunk that decides. Reading the stored
 * mime instead would answer `image/webp` for both, which is precisely the
 * distinction assertion 1 exists to make.
 *
 * Dimensions come from the same parse, because the delivered size is what
 * assertion 2 orders by and it is not the requested width.
 *
 * @param {Buffer} buf
 * @returns {{ codec: string, lossy: boolean | null, width: number | null, height: number | null }}
 */
```

### scripts/check-image-weight.mjs:305 (CONTRACT, shortened)

the two artifacts, why pure and why the chunk type rather than a ceiling; the second call site and the ratio go to the history document.

```js
/**
 * THE FOURTH ASSERTION, over a STORED placeholder rather than a served rung.
 *
 * TWO ARTIFACTS SATISFY THIS ONE FUNCTION: the `placeholder` column in D1,
 * swept below, and the `placeholders` map in `content/generated/assets.json`,
 * which `check:content` checks by importing this. One statement of what a
 * placeholder IS. A second copy over there is how the two would come to
 * disagree about the defect they were both written for.
 *
 * ## The defect this was written for
 *
 * `placeholderFor` in `app/lib/media/rebuild.server.ts` called the Images
 * binding with no `quality`, exactly as the transform route did before
 * 2026-09-01, so every LQIP in the index is a LOSSLESS VP8L data URI. The
 * column exists to hold something small enough to inline in a document, and
 * lossless is roughly three times the bytes of the lossy encoding of the same
 * twenty pixel wide image. The ladder fix landed at one of the two call sites
 * and this is the other.
 *
 * ## Why a pure function
 *
 * Same reason `ladderProblems` is one: the replay feeds it a placeholder read
 * out of the live index BEFORE the fix, with no network and no deploy, and
 * watches it name the defect. A gate whose red case can only be produced by
 * breaking production is a gate nobody proves.
 *
 * ## No threshold, again
 *
 * The assertion is the CHUNK TYPE, `VP8` and never `VP8L`, decoded from the
 * base64 payload of the data URI. A byte ceiling would be a second owner of a
 * number that belongs to the image, and would need re-tuning every time the
 * placeholder width moved. The prefix is asserted too, because a row holding
 * something that is not a WebP data URI at all would otherwise decode to
 * garbage and be reported as an unknown codec rather than as a wrong column.
 *
 * @param {string} key
 * @param {string} placeholder the stored data URI
 * @returns {string[]} problems
 */
```

### scripts/check-image-weight.mjs:409 (WHY, shortened)

why a lossless origin is skipped.

```js
// A LOSSLESS ORIGIN IS SKIPPED, and the restriction is the point. A PNG
      // re-encoded to WebP can legitimately grow or shrink, so every assertion
      // here would be a coin toss and a gate that fails at random gets turned
      // off. A lossy origin has already paid the compression cost.
```

### scripts/check-image-weight.mjs:460 (WHY, shortened)

what an empty sweep prints.

```js
/*
   * THE FLOOR. Zero examined rows and zero problems produce the same output,
   * and the whole point of this gate is that nobody was watching the thing it
   * measures. An empty bucket, a changed storage tier, or a query that stopped
   * matching all report a clean sweep without it.
   */
```

### scripts/check-image-weight.mjs:476 (CONTRACT, shortened)

section marker plus why the bytes are the stored ones.

```js
/*
   * ---- 4. EVERY STORED PLACEHOLDER IS LOSSY. -------------------------------
   *
   * Read out of the index rather than off the wire, because a placeholder is
   * not served: it is a column, inlined into whatever renders it. The bytes
   * under test are therefore the STORED bytes and nothing else.
   */
```

### scripts/check-image-weight.mjs:499 (WHY, shortened)

why the ladder's floor does not cover this.

```js
/*
   * ITS OWN FLOOR, and it needs one for a reason the ladder's floor does not
   * cover: the ladder query and this one select different rows, so a full
   * bucket can satisfy the first while this one examines nothing. A rebuild
   * that stopped deriving placeholders entirely would empty this column, and
   * an empty column and a clean column print the same line.
   */
```

## scripts/check-migrations.mjs

### scripts/check-migrations.mjs:1 (CONTRACT, shortened)

both boundary halves, why normalized content and why rule 12 cannot be satisfied; the CRLF discovery and the backlog reference go to the history document.

```js
/**
 * Gate: an applied migration is never edited.
 *
 *   npm run check:migrations
 *   node scripts/check-migrations.mjs --write [--force]
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT PROVES THE FILES MATCH THE MANIFEST. Nothing more.**
 *
 * It does NOT prove the manifest was honest when it was written. Someone who
 * edits a migration and regenerates in the same commit produces a green run;
 * what stops that is the diff, which shows both the `.sql` change and the hash
 * change, and `--write` refusing to alter an existing hash without `--force`.
 *
 * It does NOT know what the LIVE database actually applied. A migration edited
 * before it was ever applied is legitimate and indistinguishable here from one
 * edited after. The live half is `check:invariants --remote`, which compares
 * the migrations replayed into memory against the real schema.
 *
 * ## IT HASHES NORMALIZED CONTENT, NOT RAW BYTES, and that was learned the hard
 * way
 *
 * The first version hashed raw bytes on the reasoning that a migration whose
 * bytes moved is a migration whose bytes moved. That made the manifest
 * MACHINE-SPECIFIC. `core.autocrlf` is true on this host, so seven of the ten
 * migrations sit CRLF in the working tree while their committed blobs are LF;
 * hashes generated from disk therefore failed against every fresh checkout.
 *
 * Found by `check:head` on the run immediately after this gate was wired: it
 * passed on disk in 0.7s and failed inside an extraction of the same commit.
 * That is precisely the class check:head exists for, catching a defect in a
 * gate written the same session.
 *
 * CRLF is collapsed to LF before hashing, so the hash is a property of the
 * CONTENT. Nothing is lost: `.gitattributes` pins the whole tree to LF, so line
 * endings are not a meaningful axis of change here, and a genuine content edit
 * still moves the hash.
 *
 * ## Why this exists, and the honest note about its testing
 *
 * Hard rule 14: migrations are hand-written and an applied one is never edited.
 * `check:invariants` section 4 replays every migration into an empty database
 * and diffs the result against `schema.ts`, so it catches an edit that MOVES A
 * COLUMN. It cannot see anything else. Editing seed data, an index, a trigger,
 * or FTS DDL inside an applied file changes what a fresh clone builds and is
 * invisible to every gate in this repo. Backlog item 7.
 *
 * **RULE 12 CANNOT BE SATISFIED HERE, and that is stated rather than papered
 * over.** A new gate is supposed to be tested by replaying the defect it was
 * written for. No such defect exists: no migration in this repo has ever been
 * edited after being applied. So this gate is verified by PLANTS ONLY, which
 * the rule warns are written to match the implementation rather than the bug.
 * If an edited migration is ever discovered, replay it against this gate before
 * trusting the plants.
 *
 * Pure: no network, no database.
 */
```

### scripts/check-migrations.mjs:76 (NUMBER, shortened)

what the floor protects; both dated counts go to the history document.

```js
/**
 * Below this the directory is not a migrations directory and something is wrong.
 * Measured through this gate 2026-08-24: 12 on disk. It was 8, which could not
 * notice a third of the directory being deleted, and 0001_init.sql is the only
 * copy of the CREATE TABLE statements that exists anywhere.
 */
```

### scripts/check-migrations.mjs:96 (CONTRACT, shortened)

why normalized, in two lines.

```js
/**
 * sha256 of the migration's CONTENT, with CRLF collapsed to LF.
 *
 * Normalized rather than raw for the reason in the header: with
 * `core.autocrlf` true, a working tree and its own committed blobs disagree on
 * line endings, so a raw-byte manifest is only valid on the machine that wrote
 * it and fails in every checkout.
 *
 * @param {string} file
 */
```

### scripts/check-migrations.mjs:113 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- fail closed first */
```

### scripts/check-migrations.mjs:124 (WHY, shortened)

why this scope floor is in the meta-gate and why it still exits hard, with its citation.

```js
/*
 * THROUGH assertFloor SINCE 2026-09-15. Migrations are APPEND-ONLY by hard rule
 * 14, so this is the purest growing set in the repo: the count can only climb,
 * and a floor left alone goes slack on its own. It was a bare early exit, so it
 * printed no floor line and check:floors could not see the gap. See
 * check-tests.mjs's note beside its file floor for which scope floors stay out.
 *
 * STILL A HARD EXIT rather than a counted assertion. Everything below reads
 * these files; continuing past a truncated directory would measure a corpus
 * that is not there.
 */
```

### scripts/check-migrations.mjs:149 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------------------- generator */
```

### scripts/check-migrations.mjs:162 (WHY, shortened)

why a changed hash needs a flag and a new file does not.

```js
/*
   * REFUSES TO LAUNDER AN EDIT. Regenerating is the obvious way to make this
   * gate green after editing an applied migration, so a hash that CHANGES needs
   * --force, which puts the decision in the command line and therefore in the
   * shell history and the reviewer's question. Adding a NEW file needs nothing.
   */
```

### scripts/check-migrations.mjs:185 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------ the checking */
```

### scripts/check-migrations.mjs:252 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------ ship refuses on a pending migration -------- */
```

### scripts/check-migrations.mjs:254 (WHY, shortened)

why the obligation exists, why it lives in this gate and the boundary; the window number, the migration's name and the lag go to the history document.

```js
/*
 * **AUTHORING A MIGRATION MUST CREATE AN OBLIGATION SOMEWHERE, AND THIS IS IT.**
 *
 * SHIP WINDOW 5 deployed with every offline gate green and the media admin page
 * returned a 500 on its first load, because `0011_media_trash_tags.sql` had
 * been pending on the remote database since the session that authored it, four
 * sessions earlier. The columns did not exist and every media loader query
 * threw.
 *
 * This section belongs HERE rather than in a gate of its own, and that is a
 * judgement worth stating. Nothing owns ship's step ORDERING today; the closest
 * thing is `check:assertions`, which lints every `scripts/**` file including
 * `ship.mjs`, but only for the vacuity classes. What this gate owns is the
 * MIGRATION CONTRACT: hashes both directions, append-only, never edit an
 * applied one. "A migration that exists in the repo must be applied before the
 * code that needs it deploys" is a clause of that same contract, so it is added
 * to the gate that already holds it rather than a new gate being invented for
 * one assertion.
 *
 * SOURCE LEVEL, and the boundary is real: this reads what `ship.mjs` DECLARES.
 * It cannot run ship, and must not: the ship-guard law is that a deploy guard
 * is proven on its PREDICATE IN ISOLATION, never by invoking the deploy. The
 * predicate's own behaviour is unit tested in `test/pending-migrations.test.mjs`
 * against wrangler output recorded from a real database in both states.
 */
```

### scripts/check-migrations.mjs:328 (WHY, shortened)

why position and why the crudeness is right.

```js
/*
   * ORDERING, which is the half a presence check cannot see.
   *
   * A guard that runs AFTER the deploy is not a guard, it is a report. The
   * index comparison is crude and it is the right crudeness: it reads the
   * position of the guard's own announce against the deploy's, so moving
   * either one fails.
   */
```

### scripts/check-migrations.mjs:352 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------- the LOCAL tier's ledger, when there is one to read --------- */
```

### scripts/check-migrations.mjs:354 (WHY, shortened)

why the blind spot was structural, why read directly, the three states and why names; the lag's duration goes to the history document.

```js
/*
 * **NOTHING READ THE LOCAL DATABASE, AND THAT IS WHY IT SAT TWO MIGRATIONS
 * BEHIND FOR A WEEK.**
 *
 * The blind spot was structural rather than an oversight. This gate hashes
 * FILES against the manifest and never opened a database at all.
 * `check:invariants` section 4 does compare against a database, but only behind
 * `--remote`, and its third source is the migrations REPLAYED into an in-memory
 * database, which is built from the same files it is checking and therefore
 * agrees with them by construction. So every instrument either read the files,
 * or read production. A tier lagging the files was invisible to all of them.
 *
 * ## WHY THIS GATE OWNS IT
 *
 * The subject is the migration SET, which is this gate's whole subject. It also
 * has to run OFFLINE, and this is the offline-tier gate for migrations;
 * section 4's database arm is remote-gated, so putting it there would mean a
 * local assertion that never runs in the tier that ships, or a second flag.
 *
 * ## READ DIRECTLY, NOT THROUGH WRANGLER, AND THE REASON IS A SIDE EFFECT
 *
 * `wrangler d1 execute --local` CREATES the local database when it is absent.
 * A gate that brings its own subject into existence cannot report on it, and it
 * would turn every fresh clone into a machine with a database it never asked
 * for. `node:sqlite` opens the file READ ONLY, and `check:invariants` already
 * reads sqlite this way, so this is the established path rather than a new one.
 *
 * ## A MISSING DATABASE IS NOT A LAGGING ONE
 *
 * Conflating them would put a false red on every fresh checkout and on CI,
 * which has no `.wrangler` state at all. Three states, and only the third can
 * fail:
 *
 *   no directory, or no candidate file   SKIP. Nothing has ever run here.
 *   a database with no d1_migrations     SKIP. `wrangler dev` creates the file
 *                                        lazily, so this is indistinguishable
 *                                        from a first run, and failing it would
 *                                        red the first `npm run dev` on a clone.
 *   a database WITH a ledger             COMPARED, and this is the real case:
 *                                        a tier that has been migrated before
 *                                        and has since fallen behind.
 *
 * **THE SKIP EMITS NO ASSERTION ON PURPOSE.** These `ok()` calls run only when
 * there is a ledger, so the executed count is lower on CI than on a developer
 * machine, and `MINIMUM_CHECKS` below is floored for the CI case. A skip that
 * counted would make the floor mean different things in different environments,
 * which is worse than a floor that is slightly loose.
 *
 * ## NAMES, NOT A COUNT
 *
 * The cheapest version compares `d1_migrations` row count against the number of
 * files. This compares the NAMES, both directions, for the same cost: a count
 * passes when a file is renamed, or when the ledger holds twelve rows that are
 * not these twelve, and both of those are the drift this exists to catch.
 */
```

### scripts/check-migrations.mjs:472 (NUMBER, shortened)

what this floors that the scope floor cannot, and why the environment matters, with its citation; both measured counts go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * MINIMUM_MIGRATIONS above floors the SCOPE, which is a different question: it
 * catches a directory that stopped being read. This catches an assertion block
 * that stopped running over a directory that is still full, and neither can see
 * the other's bug.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, both cases, on
 * 2026-08-22. **THE COUNT NOW DEPENDS ON THE ENVIRONMENT and the floor is set
 * for the lower one**, which is the half that would otherwise bite CI:
 *
 *   47  no local D1 (a fresh clone, and every CI run). The ledger section
 *       skips and emits no assertion, deliberately.
 *   50  a machine with a local D1. The same run plus the ledger's three.
 *
 * Floored at 44, slack of three under the CI case. Never summed: 47 and 50 are
 * both read off a run. It was 41 against a measured 44 before the two
 * migrations this arc added and before the ledger section, and the count steps
 * by a fixed amount per migration, which is append-only by hard rule 14.
 */
```

## scripts/lib/uptimerobot.mjs

### scripts/lib/uptimerobot.mjs:1 (CONTRACT, shortened)

why one module, that the contract was measured from the API, and the rate limit; the verbatim validation errors and the endpoint inventory go to the history document.

```js
/**
 * The UptimeRobot v3 contract, in one place, shared by the writer and the gate.
 *
 * `scripts/uptime-ensure.mjs` creates and updates monitors; `check:uptime`
 * reads them back and refuses. Both need the same base URL, the same auth
 * header, the same monitor SHAPES and the same idea of what "paused" is, and a
 * second copy of any of those is the drift rule 17 exists about.
 *
 * ## EVERY VALUE BELOW WAS MEASURED, NOT READ OFF A BLOG POST
 *
 * The v3 documentation page is a client-side application and returns no
 * endpoint specification to a fetch; `/v3/openapi.json`, `/v3/swagger.json`
 * and `/v3/docs/openapi.json` all answer 404. So the contract was taken from
 * the API itself on 2026-09-07, by sending deliberately invalid requests and
 * reading the validation errors back. That is the fixture-independence rule
 * applied to a third party: the expectations here come from the service, not
 * from a description of it.
 *
 * What the API said, verbatim where it matters:
 *
 * - `POST /v3/monitors` requires `friendlyName` (string, <= 250), `url`
 *   (string, <= 10000, "Invalid URL for this monitor type"), `type`, `interval`
 *   ("must not be less than 15") and `timeout` (0 to 60).
 * - `type must be one of the following values: HTTP,KEYWORD,PING,PORT,`
 *   `HEARTBEAT,DNS,API,UDP,VISUAL_COMPARISON`. **A keyword monitor is its own
 *   TYPE**, not an HTTP monitor carrying a keyword.
 * - `keywordType must be one of the following values: ALERT_EXISTS,`
 *   `ALERT_NOT_EXISTS`, and `keywordCaseType must be one of the following`
 *   `values: CaseSensitive,CaseInsensitive`.
 * - Update is `PATCH /v3/monitors/{id}`. `PUT` answers 404.
 * - **`status` is not writable through PATCH**: it answers 400 `property`
 *   `status should not exist`. Pausing is `POST /v3/monitors/{id}/pause` (201)
 *   and resuming is `POST /v3/monitors/{id}/start` (201). `/resume` answers
 *   404, which is worth writing down because it is the obvious guess.
 * - Observed `status` values: `UP`, `PAUSED`, and `STARTED` immediately after
 *   a resume and before the first check lands.
 *
 * ## THE RATE LIMIT IS REAL AND IT IS SMALL
 *
 * The published allowance on the free plan is 10 requests per minute. The
 * writer spends at most four in a run (one list, one contact read, two
 * writes) and the gate spends one. Neither loops, and nothing here retries in
 * a tight loop, because a monitoring integration that gets itself throttled is
 * a monitoring integration that reports nothing.
 */
```

### scripts/lib/uptimerobot.mjs:53 (WHY, shortened)

why the constant is here and why beside its consumers.

```js
/**
 * Where the monitor ids are recorded.
 *
 * IT LIVES HERE RATHER THAN IN `uptime-ensure.mjs` because both the writer and
 * the gate need it, and `uptime-ensure.mjs` is a PROGRAM: importing a constant
 * out of it would run it, so the gate would create monitors as a side effect of
 * checking them.
 *
 * Beside its two consumers rather than in `content/`, which holds things the
 * SITE reads. This is infrastructure state, on the `drizzle/manifest.json`
 * precedent: a manifest sits with the thing it describes.
 */
```

### scripts/lib/uptimerobot.mjs:71 (WHY, shortened)

why not-paused rather than up.

```js
/**
 * The status that means "this monitor is switched off".
 *
 * THE GATE ASSERTS NOT-PAUSED RATHER THAN UP, and the difference is the whole
 * point. `UP`, `DOWN` and `STARTED` are all a WORKING monitor: a `DOWN`
 * monitor is one doing its job and reporting an outage, and a gate that
 * demanded `UP` would go red for the site being down, which is the monitor's
 * job to say and not the gate's. What this gate owns is whether the instrument
 * exists, is switched on, and is pointed at the right host.
 */
```

### scripts/lib/uptimerobot.mjs:83 (CONTRACT, shortened)

what a failure may report.

```js
/**
 * One authenticated call.
 *
 * NEVER INTERPOLATES THE KEY INTO A MESSAGE. On a failure the status and the
 * response body are reported, and the body is the API's own error text, which
 * echoes the offending FIELDS and never the bearer token.
 *
 * @param {string} key
 * @param {string} path path under the v3 base, leading slash
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<{ ok: boolean, status: number, body: any, text: string }>}
 */
```

### scripts/lib/uptimerobot.mjs:115 (WHY, shortened)

what a first-page read would conclude in each direction.

```js
/**
 * Every monitor on the account.
 *
 * PAGINATES RATHER THAN TAKING THE FIRST PAGE. A gate that read one page and
 * concluded a monitor was missing would fail for the wrong reason the day the
 * account grows past the page size, and one that concluded a DUPLICATE was
 * absent would let `uptime-ensure` create a second copy on every run. The loop
 * is bounded so a server that never stops advancing cannot spin.
 *
 * @param {string} key
 * @returns {Promise<Array<Record<string, any>>>}
 */
```

### scripts/lib/uptimerobot.mjs:142 (WHY, shortened)

that the two views are independent, and which direction is dangerous; the polling timeline and the date go to the history document.

```js
/**
 * One monitor, read by id.
 *
 * ## THE LIST ENDPOINT IS NOT A RELIABLE READ OF A MONITOR'S STATUS
 *
 * MEASURED 2026-09-07, and it changed this gate's design. Immediately after
 * resuming a monitor, `GET /monitors/{id}` answered `STARTED` while
 * `GET /monitors` answered `PAUSED` for the same monitor at the same moment.
 * Polled every 15 seconds, the two views converged after about 30 seconds, and
 * they did not converge monotonically: at t+16s the list said `UP` while the
 * addressed read still said `STARTED`. They are two independently updated
 * views, not one view with a delay.
 *
 * **THE DANGEROUS DIRECTION IS THE REASON THIS EXISTS.** A gate reading the
 * list would report a stale status for tens of seconds after a change, which
 * includes reporting NOT PAUSED for a monitor somebody has just switched off.
 * A monitoring gate whose failure mode is a false green is worse than no gate.
 *
 * So `check:uptime` reads every monitor by id. It costs one request per
 * monitor instead of one in total, which is two against a published allowance
 * of ten per minute.
 *
 * Returns `null` for 404, which is a monitor that is GONE rather than an
 * error: the caller reports it by name.
 *
 * @param {string} key
 * @param {number|string} id
 * @returns {Promise<Record<string, any> | null>}
 */
```

### scripts/lib/uptimerobot.mjs:180 (WHY, shortened)

who owns the host, why the keyword is the longer string and that the status code is a second signal; the body shapes go to the history document.

```js
/**
 * The monitor shapes this repo asks for, derived from one origin.
 *
 * **`SITE_ORIGIN` IS THE ONE OWNER OF THE HOST** (rule 17). The cutover
 * changes that constant and these two URLs follow, which is the whole reason
 * ship calls the writer rather than somebody editing a dashboard field twice.
 *
 * ## THE KEYWORD IS `{"ok":true` AND `"ok"` WOULD HAVE FAILED OPEN
 *
 * `/api/health` answers the SAME BODY SHAPE for every verdict:
 * `{"ok":false,"checks":[...]}` on a failure. So the string `ok` appears in
 * every response this endpoint can produce, healthy or not, and a monitor
 * keyed on it is green while the site is failing. `"ok":true` is no better,
 * because a per-check entry reads `{"name":"fts-equality","ok":true}` and
 * appears inside the array even when the top-level verdict is false.
 *
 * The leading `{"ok":true` is the only string that discriminates, because
 * `publicHealthBody` builds the object with `ok` first and `JSON.stringify`
 * preserves insertion order. That is a real coupling to that function and it
 * is stated here rather than left to be discovered.
 *
 * **AND IT IS NOT THE ONLY SIGNAL.** `successHttpResponseCodes` is `["2xx"]`
 * on the health monitor, so the 503 that route answers for a failing check is
 * a failure on the status line alone. Two independent mechanisms have to both
 * miss for a real failure to read as healthy.
 *
 * @param {string} origin SITE_ORIGIN, no trailing slash
 * @returns {Array<{ path: string, key: string, shape: Record<string, unknown> }>}
 */
```

### scripts/lib/uptimerobot.mjs:217 (WHY, shortened)

why the trailing slash matters; the dry-run output and its date go to the history document.

```js
/*
         * NO TRAILING SLASH, and that is an idempotency fix rather than a
         * preference. The `--dry-run` on 2026-09-07 reported `WOULD UPDATE
         * home fields: url` against a monitor that was already correct,
         * because the account stored `https://host` and this asked for
         * `https://host/`. Left alone, every run would have PATCHed a monitor
         * that needed nothing, which is the opposite of what "idempotent"
         * means. `SITE_ORIGIN` carries no trailing slash, so using it as-is
         * makes the two strings equal without normalizing anything.
         */
```

### scripts/lib/uptimerobot.mjs:231 (WHY, shortened)

why the two monitors differ here.

```js
/*
         * 3xx IS ALLOWED HERE AND NOT ON HEALTH. The home page is the URL a
         * reader types, and the cutover puts a redirect in front of it; a
         * monitor that reddened on a legitimate redirect would be retired for
         * crying wolf. `/api/health` has no reason to redirect ever, so a 3xx
         * there is a defect and is treated as one.
         */
```

### scripts/lib/uptimerobot.mjs:259 (WHY, shortened)

why a subset; the example field names go to the history document.

```js
/**
 * The fields the gate and the writer both compare.
 *
 * A SUBSET, DELIBERATELY. The API returns roughly forty fields, most of them
 * defaults this repo has no opinion about (`sslBrand`, `gracePeriod`,
 * `regionalData`). Comparing all of them would make the gate red on the day
 * UptimeRobot adds a field, which teaches everybody to ignore it. These are
 * the ones that decide whether the monitor is watching the right thing in the
 * right way.
 */
```

### scripts/lib/uptimerobot.mjs:278 (WHY, shortened)

the asymmetry, what it costs each consumer and that both values were measured; the field names, the values and the dates go to the history document.

```js
/**
 * Fields the API ACCEPTS in one representation and RETURNS in another.
 *
 * ## THE DEFECT THIS EXISTS FOR, caught by running the thing twice
 *
 * `keywordCaseType` is written as the string `CaseSensitive` (the API refuses
 * anything else: "keywordCaseType must be one of the following values:
 * CaseSensitive,CaseInsensitive") and READ BACK as the number `0`. So a
 * comparison of what-was-asked-for against what-is-stored reports drift on a
 * monitor that is exactly right, forever.
 *
 * That is not cosmetic in either consumer. `uptime-ensure` would PATCH on
 * every single run, which is the precise opposite of idempotent and was caught
 * on the second run rather than reasoned about. `check:uptime` would be
 * PERMANENTLY RED on a correct monitor, and a gate that is always red is a
 * gate everybody learns to ignore.
 *
 * ## BOTH VALUES WERE MEASURED, NOT INFERRED FROM THE FIRST
 *
 * On 2026-09-07, by PATCHing the live monitor to each value and reading it
 * back: `CaseSensitive` stores `0`, `CaseInsensitive` stores `1`, and the
 * monitor was restored to `CaseSensitive` afterwards. Writing `1` here on the
 * strength of having seen `0` would have been a guess in a table whose whole
 * job is to be right.
 *
 * Every other compared field round-trips identically, verified in the same
 * read: `type`, `url`, `interval`, `keywordType` and `keywordValue` all come
 * back exactly as sent.
 */
```

### scripts/lib/uptimerobot.mjs:311 (CONTRACT, shortened)

one function for both consumers, with its citation.

```js
/**
 * What the API will RETURN for a field this repo asked to be `value`.
 *
 * ONE FUNCTION, BOTH CONSUMERS. The writer decides whether to PATCH and the
 * gate decides whether to fail, and if those two disagreed about what "in
 * step" means then one of them would be wrong on every run. Hard rule 17.
 *
 * @param {string} field
 * @param {unknown} value the value this repo writes
 * @returns {unknown} the value the API is expected to return
 */
```

### scripts/lib/uptimerobot.mjs:325 (WHY, shortened)

why unchanged rather than undefined, with its citation.

```js
// A value with no mapping falls through UNCHANGED rather than to undefined:
  // a new enum member should surface as a visible mismatch naming both sides,
  // not as a comparison against nothing. Hard rule 13.
```

## scripts/lib/route-render.mjs

### scripts/lib/route-render.mjs:1 (CONTRACT, shortened)

why it exists, what the stubbing limits it to and what the second consumer brought; the redesign framing goes to the history document.

```js
/**
 * Renders route components to static HTML in Node, so a gate can read the
 * markup they actually produce.
 *
 * Why this exists: /admin sits behind a real Google session, so no gate can
 * reach those pages over HTTP, and the one property that matters most about the
 * admin redesign is invisible to a typecheck. A route may move a control
 * anywhere it likes, but it may not change WHAT PRESSING IT SENDS. That is a
 * fact about rendered markup, so the only honest way to assert it is to render.
 *
 * The route modules import server-only code (`~/db`, `~/lib/*.server`) at the
 * top level for their loaders and actions. None of it runs during a render, so
 * it is stubbed at resolve time rather than executed. That is a deliberate
 * limit worth stating: this harness proves things about COMPONENTS, and proves
 * nothing about loaders, actions, or anything server-side.
 *
 * ## TWO GATES SINCE 2026-09-10, and the header used to say "admin"
 *
 * `check:microformats` renders the three PUBLIC routes through the same door.
 * It is the same problem in a different disguise: a microformats class is a
 * fact about rendered markup, a typecheck cannot see a string in a `className`,
 * and `check:content` renders the corpus rather than a page. The alternative
 * was a second copy of the bundler, which is how the two would have come to
 * disagree about what a stub is.
 *
 * The public routes brought one requirement the admin routes did not, and it is
 * `URL_ASSET` below.
 */
```

### scripts/lib/route-render.mjs:38 (WHY, shortened)

why it is exported and why it is implausible.

```js
/**
 * What a Vite `?url` import resolves to inside this harness.
 *
 * Exported so a gate can ASSERT on it rather than discovering it as a
 * surprising `src` in a diff, and so the string is stated once. It is
 * deliberately not a plausible path: a sentinel that looked like a real asset
 * URL is one somebody would eventually compare against a real asset URL.
 */
```

### scripts/lib/route-render.mjs:62 (CONTRACT, shortened)

why the stub is CJS.

```js
/**
 * Bundles route modules for Node with their server-only imports stubbed.
 *
 * The stub is a CJS Proxy rather than an ES module, because an ES stub has to
 * declare every named export the importer asks for and the importers ask for
 * dozens. Interop gives every name back as a no-op function, which is enough:
 * nothing here is called.
 *
 * @param {string[]} entries repo-relative module paths
 * @returns {Promise<{ outDir: string, files: string[], cleanup: () => Promise<void> }>}
 */
```

### scripts/lib/route-render.mjs:75 (WHY, shortened)

why inside the repo.

```js
// Inside the repo, NOT the OS temp directory. react and react-router stay
  // external so the components share the harness's instances, and a bare
  // specifier only resolves if Node can walk up into this repo's node_modules.
  // From %TEMP% it cannot, and the import fails with ERR_MODULE_NOT_FOUND.
```

### scripts/lib/route-render.mjs:104 (WHY, shortened)

why esbuild refuses it, why not a build product and what the sentinel costs.

```js
/*
       * VITE'S `?url` SUFFIX, which esbuild does not speak.
       *
       * The public plane loads its enhancement bundles and two lazy
       * stylesheets by importing them with `?url` and putting the resulting
       * string in a `src` or an `href`. esbuild reads that as part of the
       * FILENAME and refuses: "Cannot read file: .../blog.js?url". Three of
       * the five do not exist on disk at all until `build:enhance` has run, so
       * even teaching it to strip the suffix would make this harness depend on
       * a build product, and a gate that only runs after a build is a gate
       * that does not run on a fresh checkout.
       *
       * So the suffix resolves to the SENTINEL below. What that costs is
       * stated rather than left to be discovered: the rendered `src` is this
       * string and not the hashed asset path, so NO GATE USING THIS HARNESS
       * MAY ASSERT ANYTHING ABOUT AN ENHANCEMENT URL. `check:page-payload`
       * owns that, against the real build, which is where the question belongs.
       * What survives here is the script TAG's existence and every attribute
       * the component writes itself.
       */
```

### scripts/lib/route-render.mjs:188 (WHY, shortened)

why client state must be seedable and why not through loader data; the session reference goes to the history document.

```js
/*
           * DECLARED INITIAL CLIENT STATE, spread last so a state declaration
           * can seed a route's own `useState`.
           *
           * This exists because the harness renders ONE static pass:
           * `renderToStaticMarkup` never dispatches an event, so any UI behind
           * client state is invisible no matter how the fixture is
           * regenerated. Session D shipped bulk actions whose three intents
           * contributed NO payload for exactly that reason, and an admin
           * mutation surface the gate cannot see is the search_docs lesson in
           * UI form.
           *
           * The route takes an OPTIONAL prop with a production default, so
           * React Router never supplies it and shipped behaviour is unchanged.
           * Seeding from `loaderData` was the alternative and is worse: it
           * would put a field in the server contract that no loader returns,
           * and policing that contract is what this gate is for.
           */
```

### scripts/lib/route-render.mjs:223 (CONTRACT, shortened)

which fields are contractual and why the rest are not.

```js
/**
 * Fields whose VALUE the UI decides, so the value is part of the contract.
 *
 * `draft` is the whole publish state machine reduced to one key: present as
 * "on" or absent, nothing else. `isNew` picks the create path over the edit
 * path. `headSha` and `firstPublished` are server-owned facts the form carries
 * back untouched, and a change to either would be a real defect rather than a
 * layout choice. Everything else in the payload is the author's content, and
 * recording its value would make the fixture a copy of the test data.
 */
```

### scripts/lib/route-render.mjs:235 (CONTRACT, shortened)

what a form's identity is and why disabled controls are excluded.

```js
/**
 * Every request the rendered page can submit, as a stable shape.
 *
 * A form's identity here is (action, method, intent, field names). That is
 * exactly the tuple the server reads: `handleEditorAction` dispatches on
 * `intent` and `fieldsFromForm` reads a fixed set of keys, so two markups with
 * the same tuple set send the same thing no matter how they are laid out.
 *
 * A DISABLED control submits nothing, and that is load bearing rather than a
 * detail: it is how the editor reproduces a checkbox's "absent when unticked"
 * without a checkbox. Disabled fields are excluded here for the same reason a
 * browser excludes them.
 *
 * @param {string} html
 * @returns {Array<{ action: string, method: string, intent: string, fields: string[] }>}
 */
```

### scripts/lib/route-render.mjs:255 (WHY, shortened)

why the attribute comes first and why a flat scan suffices.

```js
// Form ownership is by the `form` ATTRIBUTE first and containment second,
  // which is how a browser resolves it. Modelling only containment would be a
  // lie the moment a control sits outside the form it submits, and the editor
  // has exactly that case: the delete button lives at the foot of the settings
  // drawer, inside the editing form, and belongs to a different one. Forms
  // cannot nest, so a flat scan for their ranges is sufficient.
```

### scripts/lib/route-render.mjs:302 (WHY, shortened)

why an unchecked box is what makes the field honest.

```js
// An UNCHECKED checkbox is not submitted either, and modelling that is
      // what makes `draft` honest: the checkbox era sent `draft=on` on a draft
      // and sent no `draft` key at all on a published post. A baseline that
      // listed the field unconditionally would have recorded a payload the
      // browser never sends, and then demanded the redesign reproduce it.
```

### scripts/lib/route-render.mjs:309 (WHY, shortened)

why the split is by name, and what a valueless checkbox sends.

```js
// For a few fields the VALUE is the contract, so it is recorded; for the
      // rest only the name is, because the value is whatever the author typed.
      //
      // The split is by field NAME, not by widget type. Keying it on
      // `type="hidden"` was the obvious first cut and it was wrong: the
      // redesign moved coverSrc, tags and publishAt from text inputs to hidden
      // inputs driven by pickers, which changes the widget and changes nothing
      // about the request, and the gate reported all three as payload changes.
      // What is actually contractual is the set of fields the UI decides on the
      // author's behalf.
      //
      // A checkbox with no `value` attribute submits the string "on" (HTML
      // spec, the "default/on" state). React renders `checked` and no value, so
      // reading the attribute literally would record an empty string while the
      // browser sends "on". `fieldsFromForm` tests `=== "on"`, so this is the
      // difference between recording what is sent and what is written.
```

### scripts/lib/route-render.mjs:358 (WHY, shortened)

why distinct.

```js
// DISTINCT, deliberately. The contract is which requests a page can issue,
  // not how many controls offer each one: the drift alert and the maintenance
  // menu both submit sync-ask, and the editor now reaches an identical save
  // from the primary button and from inside the publish ceremony. Counting
  // those as differences would make the gate object to layout, which is the one
  // thing this redesign is allowed to change.
```

## scripts/check-hook-scope.mjs

### scripts/check-hook-scope.mjs:1 (CONTRACT, shortened)

why a scope change is the dangerous edit, why the cases are paired, the boundary and why the interpreter is resolved; the ruling number, the ENOENT run and the deleted gate go to the history document.

```js
/**
 * Gate: `no-direct-deploy.sh` blocks a deploy HERE and allows one elsewhere.
 *
 *   npm run check:hook-scope
 *
 * ## Why this exists
 *
 * The hook was scoped to the site repo on 2026-09-05 (ruling 20) after it
 * refused `cd ../dustinedwards-mcp && npm run deploy`, a command hard rule 16
 * has nothing to say about. A scope change to a guard is the most dangerous
 * kind of edit there is: the failure it introduces is SILENT and in the
 * permissive direction, and the only symptom is a deploy that should have been
 * refused going through.
 *
 * So both directions are replayed. `check:hooks` was deleted once as vacuous;
 * this is not that, because every case below drives the REAL hook file with a
 * REAL payload and reads its exit code, rather than asserting that some prose
 * about the hook is present.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It runs the hook the way the harness does: the payload on stdin, exit 2 for
 * a block and 0 for an allow. It does NOT prove the harness invokes the hook at
 * all, which is `.claude/settings.json`'s business and is asserted there by the
 * file existing in the matcher list. A hook unregistered in settings would pass
 * every case here and protect nothing.
 *
 * FOUR CASES ARE PAIRED WITH A CONTROL and are read together: a dry run allowed
 * beside the same deploy still refused; a SELECT ending in a semicolon allowed
 * beside an UPDATE still blocked; a tilde path resolved beside an unresolvable
 * variable still failing closed; and a `.exe` deploy refused inside beside the
 * same `.exe` deploy allowed in the sibling repo. Each loosening alone would
 * pass on a hook that had simply stopped checking, which is the failure a
 * loosening introduces and the one that is silent.
 *
 * FAILS CLOSED. An unreadable hook, a missing interpreter or an unexpected exit
 * code is a failure, never a skip.
 *
 * ## THE INTERPRETER IS RESOLVED, NOT NAMED
 *
 * This spawned `bash` by bare name until 2026-09-05, which made it a gate that
 * depended on the shell it was written in: green in every Claude Code session,
 * because that harness runs git bash, and `spawnSync bash ENOENT` six times over
 * at `npm run ship` step 4, because ship runs from PowerShell where `bash` is
 * not on PATH. `scripts/lib/bash.mjs` finds a bash once and PROVES it runs; a
 * machine with none fails here, in one line, before any case is read.
 */
```

### scripts/check-hook-scope.mjs:80 (WHY, shortened)

why the resolution is a precondition rather than per case.

```js
/*
 * RESOLVED BEFORE THE FIRST CASE, and a failure is ONE line.
 *
 * The order matters as much as the resolution. Resolving inside `runHook` would
 * report a missing interpreter once per case, which is what the ENOENT run
 * looked like: six failures describing the same single fact, none of which named
 * it. This is a precondition of the gate, so it is stated where preconditions
 * are, next to the missing-hook check and in the same voice.
 */
```

### scripts/check-hook-scope.mjs:95 (CONTRACT, shortened)

why the path gets its own const.

```js
/*
 * The path is bound to its own const rather than read off `BASH` at the call
 * site. `runHook` is a hoisted function declaration, so the compiler cannot
 * carry the null check above into a body that could in principle run before it,
 * and a non-null assertion there would be the check written twice with only one
 * of them enforced.
 */
```

### scripts/check-hook-scope.mjs:105 (CONTRACT, shortened)

what cwd is and what moves the command.

```js
/**
 * Run the hook against one command, from one working directory.
 *
 * `cwd` is what the PreToolUse payload carries: the SESSION's directory, not
 * the command's. The command's own `cd` is what moves it, which is the whole
 * subject of this gate.
 *
 * @param {string} command
 * @param {string} cwd
 * @returns {number} the hook's exit code: 2 blocks, 0 allows
 */
```

### scripts/check-hook-scope.mjs:131 (CONTRACT, shortened)

why the parent directory is derived; the case count and the sibling's name go to the history document.

```js
/*
 * THE NINETEEN CASES, and each one names the defect it would catch.
 *
 * The parent directory is derived rather than written, so this reads correctly
 * from any clone path. `../dustinedwards-mcp` is a real sibling on the machine
 * that runs the deploy, and the hook resolves it whether or not it exists,
 * which is correct: a deploy into a directory that is not there fails at the
 * shell rather than at this guard.
 */
```

### scripts/check-hook-scope.mjs:161 (WHY, shortened)

why the return path is derived, and what a fixture about the checkout's name asserts; the catching gate and the run go to the history document.

```js
/*
     * THE RETURN PATH IS DERIVED FROM THE CHECKOUT, not written out as
     * `dustinedwards-info`.
     *
     * CAUGHT BY `check:head` ON THIS CASE'S FIRST RUN. That gate replays the
     * offline tier against a fresh checkout of HEAD in a temp directory, where
     * `cd ../dustinedwards-info` lands somewhere genuinely outside the repo, so
     * the hook correctly ALLOWED the deploy and this case failed. The hook was
     * right and the fixture was wrong.
     *
     * The case had been asserting something about the checkout's NAME rather
     * than about the behaviour under test: a fixture that holds only while the
     * world is arranged the way its author happened to find it. Deriving the
     * name is what makes it a statement about the last `cd` winning.
     */
```

### scripts/check-hook-scope.mjs:226 (WHY, shortened)

the pairing rule, stated once for every pair below.

```js
/*
     * THE PAIR IS THE ASSERTION. The case above alone would pass on a hook
     * that had simply stopped blocking deploys, which is the failure the
     * loosening could introduce and the one that is silent. This is the same
     * command with the flag removed, so the two differ in exactly the thing
     * under test and nothing else.
     */
```

### scripts/check-hook-scope.mjs:242 (WHY, shortened)

what the semicolon did, in two lines; the exit code and the arm's message go to the history document.

```js
/*
     * THE SEMICOLON IS THE WHOLE CASE. The hook cuts each wrangler invocation
     * out of the command with a segment regex, and that regex stopped at the
     * first `;` ANYWHERE, including one inside the quoted SQL. The tail then
     * held an unterminated quote, no `--command` could be read off it, and the
     * arm exited 9: "SQL this check cannot read". A read was refused for
     * ending the way SQL normally ends.
     *
     * The split on `;` inside the SQL was never the problem and is unchanged;
     * it already skips the empty trailing statement.
     */
```

### scripts/check-hook-scope.mjs:262 (WHY, shortened)

the pair, on the first pair's grounds.

```js
/*
     * THE PAIR, on the dry-run pair's grounds. The case above alone would pass
     * on a hook that had simply stopped reading d1 statements at all, which is
     * exactly what a widened segment regex could cause and is the silent
     * direction. Same shape, same semicolon, one verb different.
     */
```

### scripts/check-hook-scope.mjs:278 (WHY, shortened)

why refusing a read is still wrong.

```js
/*
     * USAGE TEXT IS NOT A STATEMENT. It carries no SQL, which is precisely why
     * it hit the unverifiable arm and exited 9. Same class as --dry-run above
     * and ruled on the same grounds: refusing a read is the safe direction and
     * is still wrong, because the workaround is a session running d1 commands
     * outside the guard.
     */
```

### scripts/check-hook-scope.mjs:294 (WHY, shortened)

what an unresolvable path was read as, and why home; the ruling number goes to the history document.

```js
/*
     * `cd ~` USED TO BE UNRESOLVABLE. The hook returned None for it, the caller
     * reads None as INSIDE this repo, and a deploy anywhere reachable only by a
     * tilde was refused for a rule that has nothing to say about it. That is
     * ruling 20 again, one spelling of the path along.
     *
     * HOME, NOT A SIBLING PATH, deliberately: it is somewhere this gate can
     * name from any clone without assuming where the checkout sits relative to
     * it. The sibling case above already covers the relative form.
     */
```

### scripts/check-hook-scope.mjs:313 (WHY, shortened)

the unsafe way to implement the loosening.

```js
/*
     * THE PAIR FOR THE TILDE CASE, and it is the one that matters. Accepting
     * `$` and `%` is a loosening, and the unsafe way to implement it is to let
     * an unresolved `$NOPE` normalise into a path that is not this repo, read
     * as OUTSIDE, and unblock a deploy. Expanding first and testing the RESULT
     * is what prevents that, and this is what proves it.
     */
```

### scripts/check-hook-scope.mjs:328 (WHY, shortened)

why the word boundary failed, and why folding alone was not enough; every measured bypass and the date go to the history document.

```js
/*
   * THE SIX EXECUTABLE-NAME CASES, added 2026-09-15 for a live bypass of all
   * four arms at once.
   *
   * `\bwrangler\b` matches INSIDE `wrangler.exe`, because the dot is a word
   * boundary. The segment capture therefore began at `.exe`, the first token was
   * `.exe` rather than the verb, and every arm below reads a verb slot. Measured
   * before the fix: `wrangler.exe deploy` deployed, `.cmd`, `.bat` and `.ps1`
   * did too, `wrangler.exe versions upload` uploaded, and a `DELETE FROM posts`
   * reached the REMOTE database through the one arm that is global rather than
   * scoped.
   *
   * The case half is the same defect wearing Windows: PATH lookup ignores case,
   * so `WRANGLER deploy` and `NPM RUN DEPLOY` both ran and both were allowed.
   * Folding the checker was not enough on its own and the replay is what caught
   * it: the hook opens with a CHEAP PREFILTER, `grep -qE wrangler|deploy`, which
   * ran first, matched neither spelling, and exited 0 before the folded checker
   * was reached. Both halves are needed and both are replayed here.
   */
```

### scripts/check-hook-scope.mjs:359 (WHY, shortened)

why widening the name must not widen the scope.

```js
/*
     * THE CONTROL FOR THE CASE ABOVE. Widening the name must not widen the
     * SCOPE: ruling 20 still exempts a sibling repo, and a fix that blocked
     * both would pass the case above while breaking the admin MCP deploy.
     */
```

### scripts/check-hook-scope.mjs:392 (WHY, shortened)

two owners of one needle, and what it cost.

```js
/*
     * THE PREFILTER CASE. This is the one that stayed green through the first
     * attempt at the fix, because the prefilter is a separate statement of the
     * same needle and was still case-sensitive. Two owners of one fact, which is
     * what rule 17 is about, and the cost was a fold that could not fire.
     */
```

### scripts/check-hook-scope.mjs:408 (WHY, shortened)

why over-blocking is the cheapest wrong fix, and why the flag is not folded.

```js
/*
     * THE CONTROL FOR THE FOLD. A fold that over-blocks is the cheapest way to
     * pass every blocking case above while breaking the 2026-09-06 loosening,
     * and `--dry-run` is deliberately NOT folded: yargs reads flags
     * case-sensitively, so accepting a `--DRY-RUN` would stand the guard down
     * for a flag wrangler itself would reject.
     */
```

### scripts/check-hook-scope.mjs:428 (WHY, shortened)

why passes are printed too.

```js
/*
   * EACH VERDICT IS PRINTED, not only the failures. A guard whose replay says
   * nothing when it passes is a replay nobody reads, and the whole value of
   * this gate is that somebody changing the hook can see both directions move.
   */
```

### scripts/check-hook-scope.mjs:443 (NUMBER, shortened)

why a one-array gate needs this floor and why slack is zero; three dated counts go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR. Every case above comes from one array, which is exactly
 * the shape that fails quietly: an array that stopped parsing would run zero
 * cases and report a clean sweep of a security guard.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-15 by RUNNING it: 19.
 * It was 13, and 8 before that, and 6 before the dry-run pair landed with the
 * 2026-09-06 loosening. Slack of zero, because the set is a fixed enumeration
 * of the ruling's own cases and a drop is a removed case rather than natural
 * movement.
 */
```

## scripts/lib/tokens.mjs

### scripts/lib/tokens.mjs:1 (CONTRACT, shortened)

what it is for and why check:contrast keeps its own copy.

```js
/**
 * Reads the ratified colour tokens back out of the stylesheet that ships.
 *
 * `app/app.css` is the single source of the palette. Anything that needs a
 * colour at BUILD time (the diagram renderer, and the gate over what it wrote)
 * resolves it from here rather than restating a hex, so a retuned token moves
 * the thing that uses it instead of quietly disagreeing with it. That is the
 * same discipline `check:contrast` is built on.
 *
 * `check:contrast` deliberately keeps its own copy of this parsing. It is the
 * gate whose entire design is that two independent sources argue, and it also
 * reads a third block to assert the two dark blocks agree, which nothing else
 * needs. Sharing a reader with it would give the palette one implementation to
 * be wrong in rather than two to disagree.
 */
```

### scripts/lib/tokens.mjs:23 (CONTRACT, shortened)

why the token block stayed put; the split's date goes to the history document.

```js
/**
 * The stylesheet that declares the TOKENS. Still one file, deliberately.
 *
 * app.css was split on 2026-08-21 and the token block stayed here, because this
 * module and `check:contrast` both parse this path and moving the palette would
 * have been a gate change wearing a refactor's clothes.
 */
```

### scripts/lib/tokens.mjs:32 (WHY, shortened)

why both entries must be followed, and that the floor caught it again; the two counts and the dates go to the history document.

```js
/**
 * THE ADMIN PLANE'S ENTRY, since the CSS split of 2026-08-23.
 *
 * `app.css` stopped being the whole site's stylesheet that day: the seven admin
 * parts moved to `app/admin.css` so a public reader stops downloading them.
 * Every gate that reasons about "the stylesheets" has to follow BOTH entries or
 * it silently narrows to the public plane, which is the identical failure the
 * comment on `stylesheetPaths` below records from the 2026-08-21 split.
 *
 * It happened again, and it FAILED AGAIN RATHER THAN PASSING QUIETLY:
 * `check:contrast`'s resolution scan dropped from 69 var() uses to 38 and
 * tripped its own floor. Two splits, two narrowings, two catches by the same
 * anti-vacuity assertion. That is the floor earning its place twice.
 *
 * NOT the token block. The tokens, the `@theme` block and the three theme
 * selectors all stay in `app.css`, which is why `tokenBlock` still reads
 * `CSS_PATH` alone and this constant is only ever used for the SWEEP.
 */
```

### scripts/lib/tokens.mjs:52 (CONTRACT, shortened)

why this module is the source of the public order; the previous location goes to the history document.

```js
/**
 * The module that declares the PUBLIC stylesheet set, and its order.
 *
 * `app/root.tsx` matches on every route, so its CSS imports are the sheets
 * every page loads and the order they load in. It became the source of that
 * order on 2026-08-27; before then the order lived in `@import` statements at
 * the bottom of app.css, which is a position CSS does not allow. See
 * `stylesheetPaths`.
 */
```

### scripts/lib/tokens.mjs:63 (CONTRACT, shortened)

why it exists, why derived, why imports come first; three narrowings, their counts and the Tailwind history go to the history document.

```js
/**
 * EVERY source stylesheet, in CASCADE ORDER, derived from the entries' own imports.
 *
 * ## WHY THIS EXISTS
 *
 * app.css was ONE 9,269-line file until 2026-08-21 and is now an entry that
 * imports sixteen parts. Any gate that reasoned about "the stylesheet" by
 * reading that one path silently narrowed to the token block the moment the
 * split landed. That is not hypothetical: `check:contrast`'s resolution scan
 * dropped from 69 var() uses to 13, and `check:logo` found one of the mark's
 * two fill bindings. Both FAILED rather than passing quietly, which is the
 * anti-vacuity floors doing their job, and both are fixed by reading this.
 *
 * ## DERIVED, NOT RESTATED
 *
 * The order comes from parsing root.tsx's CSS imports and each CSS file's own
 * `@import` lines, so adding a part means editing the file that loads it and
 * nothing else. A hand-kept list here would be the mirror this repo keeps
 * paying for, and it would go stale in exactly the direction that hides CSS
 * from a gate. The only thing named by hand is the admin ENTRY, because nothing
 * in the CSS says which routes import it.
 *
 * ## THE PUBLIC ORDER MOVED OUT OF CSS, 2026-08-27, AND THIS FOLLOWS IT
 *
 * The nine public component sheets were `@import` statements at the BOTTOM of
 * app.css. CSS requires `@import` before every other rule and drops a late one;
 * they were surviving on Tailwind's processor hoisting them, so they became
 * JavaScript imports in `app/root.tsx` when Tailwind left the build. This
 * function read app.css's `@import` lines, so left alone it would have gone on
 * returning a list with all nine MISSING, which is the exact failure the
 * paragraph above records: `check:contrast`'s resolution scan and
 * `check:logo`'s fill bindings both read this. It derives from root.tsx now,
 * which is the file that decides the public cascade.
 *
 * ## IMPORTS COME BEFORE THE FILE THAT IMPORTS THEM
 *
 * The old code pushed an entry and THEN its imports, which matched a file whose
 * imports sat at the bottom. Nothing may sit at the bottom: `@import` is valid
 * only before other rules, which is what the hoisting had been hiding. So a
 * file's imports are expanded first, recursively, and then the file itself.
 * That is not a convention here, it is what the browser does.
 *
 * @returns {string[]} absolute paths, in cascade order
 */
```

### scripts/lib/tokens.mjs:125 (CONTRACT, shortened)

why both import forms.

```js
/**
   * Every stylesheet a module names, in source order.
   *
   * BOTH IMPORT FORMS, and the second one is not decoration. A bare
   * `import "./x.css"` puts the sheet in that module's bundle; an
   * `import url from "./x.css?url"` hands back a hashed URL for something to
   * fetch later, which is how the search palette's dialog CSS reaches a reader
   * who actually opens it. A sheet reachable only through the second form is
   * still the site's CSS and still has to be graded.
   *
   * @param {string} source @param {string} base
   */
```

### scripts/lib/tokens.mjs:155 (WHY, shortened)

why route sheets are included and what is and is not claimed about order.

```js
/*
   * THEN THE ROUTE-SCOPED SHEETS, since 2026-08-27.
   *
   * Public CSS stopped being one site-wide bundle that day: a route imports the
   * sheets its own markup needs, so a reader of the home page no longer
   * downloads the post typography or the search facets. That is the whole point
   * of the split and it is also the third time this function could have been
   * left reading a strict subset of the site's CSS. It would have missed nine
   * sheets, silently, and `check:contrast` and `check:logo` both read it.
   *
   * ORDER BETWEEN ROUTES IS NOT MEANINGFUL and is not claimed to be: two routes
   * never render at once, so there is no cascade between their sheets. Sorted
   * by route filename purely so the list is stable run to run. Order WITHIN a
   * route is its import order, which is a real cascade and is preserved. A
   * sheet imported by several routes appears once.
   */
```

### scripts/lib/tokens.mjs:171 (WHY, shortened)

why every module and not only routes.

```js
/*
   * EVERY MODULE UNDER app/, not just app/routes. A stylesheet can be named by
   * a component as easily as by a route: `search-trigger.tsx` is the only
   * reference to the palette's dialog CSS, through a `?url` import, because
   * that sheet is fetched when a reader opens the palette rather than shipped
   * with the page. Scanning routes alone would have dropped it, which is this
   * function's recurring failure for the third time in one day.
   */
```

### scripts/lib/tokens.mjs:188 (WHY, shortened)

why the admin entry is placed by hand.

```js
/*
   * The admin entry FIRST among the non-root sheets, so an admin page's own
   * cascade is still root-then-admin, which is what it loads. The route loop
   * below would otherwise reach it through admin.tsx in alphabetical order and
   * interleave it with public route sheets. Named rather than left to that
   * loop, so the set does not silently narrow if admin.tsx stops importing it.
   */
```

### scripts/lib/tokens.mjs:232 (CONTRACT, shortened)

the two traps, both already paid for once.

```js
/**
 * Pulls the custom properties out of one rule block, located by the literal
 * text of its selector.
 *
 * Two traps, both already paid for once in `check:contrast`:
 *
 *   1. Comments are stripped FIRST. The token block's own comment spells out
 *      all three selectors, so searching the raw file finds the prose and then
 *      parses whichever block happens to follow it.
 *   2. CRLF is normalised FIRST. `app.css` is not pinned by `.gitattributes`
 *      and this repo runs `core.autocrlf=true`, so a fresh Windows clone gets
 *      CRLF and every multi-line selector match silently stops matching.
 *
 * @param {string} label
 * @param {string} selector
 * @returns {Record<string, string>}
 */
```

### scripts/lib/tokens.mjs:270 (CONTRACT, shortened)

both fail-closed directions.

```js
/**
 * Resolves a token name map into a colour map for one theme.
 *
 * Fails closed twice over: on a token the stylesheet does not declare, and on a
 * declared token whose value is not a plain hex. A `var()` indirection would
 * resolve in a browser and be meaningless to a build-time renderer, so it has
 * to be an error rather than a string passed along.
 *
 * @param {Record<string, string>} nameMap keys are arbitrary, values are token names
 * @param {Record<string, string>} block output of tokenBlock
 * @param {string} label
 * @returns {Record<string, string>}
 */
```

### scripts/lib/tokens.mjs:299 (CONTRACT, shortened)

why normalisation is needed.

```js
/**
 * Normalises a hex colour for comparison. Lightning CSS rewrites `#ffffff` to
 * `#fff`, and mermaid writes some of its own output in the short form, so a
 * substring or literal comparison reports colours missing from output that
 * carries them. Measured once already in `check:contrast`.
 *
 * @param {string} hex
 */
```

## scripts/check-charts.mjs

### scripts/check-charts.mjs:1 (CONTRACT, shortened)

the boundary, the four assertions and the scope note; the shiki incident and the corpus-gate aside go to the history document.

```js
/**
 * Gate for the chart directive.
 *
 * OBSERVATION BOUNDARY: determinism, Node-vs-Worker parity and the emitted
 * contract. It bundles chart.mjs ALONE, not the markdown pipeline, and it never
 * looks at a chart in a browser, so nothing here sees whether a chart is legible
 * or correctly scaled.
 *
 * `check:content` renders the corpus twice and compares, so a chart renderer
 * that is not deterministic fails THAT gate too, at corpus scope, naming a
 * slug. What this gate adds is the chart-scoped half, in-process, across
 * processes and across the Node/Worker engine split: the shape of failure the
 * shiki JavaScript-engine incident produced and the reason oniguruma is a
 * dependency. This gate proves the property that makes both content
 * comparisons meaningful for charts.
 *
 * Four things are asserted:
 *
 *   1. **Determinism in-process.** Every fixture rendered 200 times must yield
 *      exactly one distinct output.
 *   2. **Determinism across processes.** The same fixtures rendered in three
 *      SEPARATE node processes must yield those same hashes. Module-level state
 *      and hash-order effects only show up across process boundaries.
 *   3. **Node vs Worker parity.** The two writers are a Node build script and a
 *      Cloudflare Worker, and the artifact they produce must be byte-identical
 *      or the editor commits HTML the next build will not reproduce. The Worker
 *      half runs the SAME module under real workerd, via miniflare.
 *   4. **The directive contract.** Palette tokens only, an accessible name on
 *      the SVG, a generated data table, no legend, and a validation failure for
 *      every rule the contract states.
 *
 * Pure apart from the workerd run: no database, no network, no GitHub.
 *
 * SCOPE NOTE, stated rather than implied. The parity run bundles
 * `app/lib/content/chart.mjs`, which is the whole of the new rendering surface
 * and the only part whose behaviour under workerd was ever in question (Plot and
 * linkedom). It deliberately does NOT re-bundle the markdown pipeline, because
 * that would drag in shiki's WASM module and end up testing the Vite plugin's
 * wasm handling rather than the chart renderer. The rest of the pipeline is
 * plain deterministic JavaScript shared by both callers, and the live sweep
 * exercises the full Worker path against a real deploy.
 */
```

### scripts/check-charts.mjs:80 (CONTRACT, shortened)

why every rule has a paired negative.

```js
/**
 * Asserts that rendering throws, and that the message names the reason.
 *
 * A rule with no paired negative is not a verified rule. Every contract rule
 * below has one of these.
 *
 * @param {string} label
 * @param {Record<string, any>} attrs an omitted attribute is `undefined`, which
 *   is exactly what the directive hands over when an author leaves it out
 * @param {string} csv
 * @param {RegExp} expected
 */
```

### scripts/check-charts.mjs:194 (WHY, shortened)

why weak is required and why weak is sufficient; the measurement goes to the history document.

```js
/*
   * WEAK ON PURPOSE. This is JSONC on its way to JSON.parse, so the shared
   * strong stripper in scripts/lib/strip-comments.mjs must NOT be used: its
   * line-comment rule eats a protocol-relative url ("//cdn.example.com/x"),
   * whose slashes follow a quote rather than a colon, and takes the rest of
   * the line with it. MEASURED 2026-08-23: the config stops parsing.
   *
   * Weak is SUFFICIENT here, which is the other half: JSON.parse throws on
   * any comment this fails to remove, so an under-strip cannot pass quietly.
   * test/strip-comments.test.mjs asserts both halves.
   */
```

### scripts/check-charts.mjs:211 (WHY, shortened)

why the converter rather than hand-built options; the version, the error and the date go to the history document.

```js
/*
   * THROUGH `convertV4MiniflareOptions`, and the indirection is not decoration.
   *
   * Miniflare 5 (which arrives with wrangler 4.117 and later) reshaped the
   * constructor: worker options moved under a `workers[].config` object and the
   * top-level `modules`/`script` pair it used to take is refused outright. The
   * library ships this converter for exactly this case, so the options below
   * stay in the shape a reader can compare against `wrangler.jsonc.example`
   * beside them, and the translation is the library's rather than a hand-built
   * copy of it that would drift at the next reshape.
   *
   * Found by RUNNING, not by reading a changelog: the upgrade turned this gate
   * red with a zod validation error naming `workers: undefined`.
   */
```

### scripts/check-charts.mjs:245 (NUMBER, shortened)

what an empty list would make agree, why input and output floors differ, and why exact here.

```js
/*
   * SCOPE FLOOR, added by the 2026-08-24 floor sweep.
   *
   * Every block below iterates FIXTURES: the in-process determinism loop, the
   * cross-process one and the node-versus-workerd parity comparison. An empty
   * or shortened list makes all three agree about nothing, and the two loops
   * that compare hashes are the ones that would say "identical" loudest.
   *
   * The executed-count floor at the end catches a large truncation, because
   * assertions scale with fixtures, but it is a floor on OUTPUT and this is a
   * floor on INPUT: they fail on different bugs, and a fixture list rebuilt to
   * be shorter while some other block grew would slip past the first.
   *
   * EXACT rather than under, uniquely here, and the reason is that this list is
   * not measured, it is CONSTRUCTED: four mark types crossed with the single
   * and multi-series shapes. It moves only when a mark type is added, which is
   * a deliberate edit to the array directly above.
   */
```

### scripts/check-charts.mjs:318 (WHY, shortened)

why the name is on the SVG.

```js
// The name must be on the SVG, never on the figure: role="img" makes its
    // descendants presentational, so naming the figure would hide the caption
    // and the data table from the readers the table exists for.
```

### scripts/check-charts.mjs:341 (WHY, shortened)

why the internal names must not surface.

```js
// The model reshapes data into {x, series, value} internally. Those names
    // are an implementation detail and must never surface as an axis label:
    // Plot's default would print "x" and "value", which names the data
    // structure rather than the thing measured.
```

### scripts/check-charts.mjs:470 (WHY, shortened)

what an unhandled directive renders as; the ruling date goes to the history document.

```js
// 8. Unknown directives fail closed (ruled 2026-07-30).
  //
  // An unhandled directive is not inert: remark-rehype renders it as a bare
  // <div>, so a typo publishes a silent empty element where a figure was meant
  // to be. These are the paired negatives for that rule.
```

### scripts/check-charts.mjs:504 (WHY, shortened)

why two assertions rather than one adjacency; the date and the old pattern go to the history document.

```js
/*
   * And the known ones still render, so the check is not simply refusing
   * everything.
   *
   * TWO ASSERTIONS RATHER THAN ONE ADJACENCY. This was `/<figure><img/`, which
   * went red on 2026-08-26 when the pipeline started wrapping every body image
   * in a link to its original: the figure rendered perfectly and the two tags
   * had simply stopped being neighbours. A control that pins markup BETWEEN the
   * things it cares about fails on changes it has no opinion about, and its
   * label then names the wrong subject.
   *
   * What this control needs is that the directive produced a figure and that
   * the author's src reached an image. Both stay falsifiable, and neither has
   * an opinion about what sits in between. The anchor itself is owned by
   * test/post-image-links.test.mjs and is deliberately not restated here.
   */
```

### scripts/check-charts.mjs:530 (NUMBER, shortened)

why an async gate is the shape most able to skip; both dated counts go to the history document.

```js
/*
   * EXECUTED-COUNT FLOOR.
   *
   * This gate is ASYNC and spawns a bundler and a Miniflare worker. That is the
   * shape most able to skip silently: an await that resolves to an empty
   * fixture list, a parity block that returns early, a determinism loop that
   * runs zero renders. All of them leave `failed` at zero.
   *
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it: 181 on
   * 2026-08-14, 183 on 2026-08-26 when the figure control became two
   * assertions instead of one adjacency.
   * Never summed. Floored at 170, roughly 6 percent: the count is a fixed
   * function of the eight fixtures crossed with the mark types and the planted
   * negatives, so it moves only when a fixture or a rule is added.
   */
```

## scripts/lib/readiness.mjs

### scripts/lib/readiness.mjs:1 (CONTRACT, shortened)

why it is extracted, what five 200s are blind to and why the body rather than the status; the schedule aside goes to the history document.

```js
/**
 * Ship's readiness verdict: does `/api/health` say this deploy is healthy.
 *
 * Extracted for the reason `ci-status.mjs` and `ask-converge.mjs` are: the
 * decision is pure, `node:test` can drive every branch of it, and the
 * alternative is a branch that can only be exercised by running a real deploy.
 * A refusal path that has never been executed is not a refusal path.
 *
 * ## WHAT THIS IS FOR
 *
 * Ship polled `/colophon` for five 200s and never asked `/api/health`. Those
 * are different questions. Five 200s prove the Worker booted, the route table
 * resolves, and the rollout finished. They are blind to every invariant this
 * site actually watches: a drifted Ask index, a media index that lost its
 * rows, D1 out of step with the repository, an FTS index that is empty beside
 * a full content table. All four of those serve `/colophon` with a 200, and
 * all four are what `/api/health` reports.
 *
 * The scheduled workflow has read that endpoint every fifteen minutes and
 * alerted on it, so the deploy path was the only path that shipped without
 * consulting the instrument the site trusts the rest of the time.
 *
 * ## THE VERDICT COMES FROM THE BODY, NOT THE STATUS LINE
 *
 * They agree today: the endpoint answers 200 only when every check passed.
 * Reading the status alone would make this step depend on that agreement,
 * which lives in a different file and is not this module's to assume. The
 * endpoint's own docblock says the STATUS is the contract for the workflow,
 * which reads it with `curl --fail`; this reads a parsed body because it can,
 * and because naming the failing checks is most of the value of refusing.
 */
```

### scripts/lib/readiness.mjs:49 (CONTRACT, shortened)

why it fails closed everywhere, and what deferring is for; the ruling number and the dated ship go to the history document.

```js
/**
 * Reads a readiness verdict out of a response.
 *
 * FAILS CLOSED IN EVERY UNCERTAIN DIRECTION, and the list is long because this
 * value arrives over a network from an endpoint that can be rate limited, can
 * be replaced by a 404 page, and can be behind an interception proxy. Every
 * shape that is not recognisably a health report refuses, because "I could not
 * tell" and "it is healthy" must never take the same branch on the last step
 * before a production write.
 *
 * ## DEFERRED CHECKS, RULING 48
 *
 * `deferred` names checks that this step REPORTS but does not gate on, because
 * asserting them here would block the very step that repairs them. The case
 * that forced it, 2026-09-09: a ship refused at readiness on `content-drift`
 * (expected 16, present 14), and the D1 sync three steps later is exactly what
 * converges that drift. The deploy had already landed, so the refusal left
 * production serving a build whose index nothing had updated, and the only way
 * forward was to run the sync by hand.
 *
 * A deferred check is not ignored: it is printed with everything else, and ship
 * asserts it AFTER the sync, where a failure means the sync ran and did not
 * work, which is a real defect rather than a stale index. The other checks
 * still gate here, so a bad deploy still cannot reach a production write.
 *
 * @param {number} status the HTTP status
 * @param {string} text the raw body
 * @param {string} path the path asked, for the messages
 * @param {string[]} deferred check names this step reports but does not gate on
 * @returns {ReadinessVerdict}
 */
```

### scripts/lib/readiness.mjs:81 (WHY, shortened)

why the rate-limited case is separate.

```js
/*
   * 429 IS CALLED OUT SEPARATELY. Since the per-IP limit landed on the health
   * endpoint, a burst from this address can refuse the check, and "rate
   * limited" and "unhealthy" need completely different repairs. Collapsing
   * them would send somebody to look for a drifted index that is fine.
   */
```

### scripts/lib/readiness.mjs:123 (WHY, shortened)

why an empty checks array is a refusal.

```js
/*
   * NO CHECKS IS A REFUSAL, and this is the case the plant points at. A body
   * carrying no verdicts is not a health report, so reading `ok` off it would
   * be trusting one field of a shape nothing recognises. Any JSON document on
   * the origin can carry `ok: true` by accident; only a health report carries
   * a checks array, and requiring it is what stops this step passing on the
   * wrong URL.
   */
```

### scripts/lib/readiness.mjs:144 (WHY, shortened)

why the top-level field is not the subject.

```js
/*
   * A GATING CHECK DECIDES THIS STEP. `value.ok` is deliberately NOT the
   * subject: the endpoint reports `ok: false` when ANY check fails, deferred
   * ones included, so reading it here would reinstate the refusal ruling 48
   * removed. The deferred names are subtracted from the failures first, and
   * what is left is what this step is entitled to refuse on.
   */
```

### scripts/lib/readiness.mjs:160 (WHY, shortened)

why a self-disagreeing endpoint is refused.

```js
/*
   * `ok` IS FALSE AND NOTHING IS MARKED FAILING: an endpoint disagreeing with
   * itself. Refused, because the two halves of a health report that do not
   * agree cannot both be trusted, and this is the last step before a write.
   */
```

### scripts/lib/readiness.mjs:177 (CONTRACT, shortened)

why the counts print only sometimes.

```js
/**
 * One printable line per check, so a refusal and a pass show the same table.
 *
 * The counts print only when the endpoint sent them, which it does for a
 * FAILING drift check and nothing else; that pair is the whole triage.
 *
 * @param {HealthCheckRow[]} checks
 * @returns {string[]}
 */
```

### scripts/lib/readiness.mjs:196 (CONTRACT, shortened)

why it is a function, that the meaning inverts, why a missing row is a miss and why the detail is absent; the ruling number goes to the history document.

```js
/**
 * The verdict on the DEFERRED checks, read after their repair steps have run.
 *
 * ## WHY THIS IS HERE AND NOT INLINE IN SHIP
 *
 * The same reason `readinessVerdict` is: the decision is pure, `node:test` can
 * drive every branch of it, and the alternative is a branch that can only be
 * exercised by running a real deploy against a broken site. Ruling 56 asks for
 * a plant proving a body with `ask-index-drift` failing passes readiness and
 * then fails HERE by name, and that plant is only writable if this is a
 * function rather than forty lines in the middle of a script.
 *
 * ## THE MEANING INVERTS BETWEEN THE TWO SITES, which is the whole design
 *
 * At readiness a failing deferred check means "the index is behind", the
 * ordinary state of a corpus that has just been committed. Here, after its
 * repair step has run, the same row means THE REPAIR RAN AND DID NOT WORK.
 *
 * ## A MISSING ROW IS A MISS, NOT A PASS
 *
 * An endpoint that stopped reporting a check proves nothing about it, and
 * reading that as success is the "assertion that can pass by reading nothing"
 * this repo has already been bitten by. It is named rather than skipped.
 *
 * ## WHY THE `detail` STRING IS NOT IN THESE MESSAGES
 *
 * It is not on the wire. `publicHealthBody` rebuilds every row as name, ok and
 * the two counts, and drops each `detail` DELIBERATELY: they carry row counts
 * and an R2 object key, and `/api/health` is unauthenticated. That decision is
 * stated in `app/routes/api.health.ts`'s own docblock. The counts are what the
 * wire carries and they are the triage for a drift check; the pointer to
 * Workers Logs is where the rest lives.
 *
 * @param {HealthCheckRow[]} checks every row the endpoint returned
 * @param {Record<string, string>} deferred check name to the step that repairs it
 * @param {string} [path] for the messages
 * @returns {{ misses: string[], converged: string[] }}
 */
```

### scripts/lib/readiness.mjs:263 (CONTRACT, shortened)

the rule, why a value per key and what still gates; both incidents, their versions and dates go to the history document.

```js
/**
 * CHECKS THE READINESS STEP REPORTS BUT DOES NOT GATE ON, each with the step
 * that repairs it. Ruling 48, generalised by ruling 56.
 *
 * THE RULE: readiness gates only on checks whose repair is NOT a later ship
 * step. A step that refuses before its own remedy is a deadlock, and the
 * remedy is the thing the refusal prevents from running.
 *
 * `content-drift` was the first instance and forced ruling 48. On 2026-09-09 a
 * ship deployed, refused at readiness on `expected 16, present 14`, and left
 * production serving a build whose index nothing had updated. The drift was
 * real and pre-existing, which is precisely the case the sync exists for.
 *
 * `ask-index-drift` was the second, and it cost two deploys on 2026-09-10.
 * Versions 8b4f0ae4 and ad7cb0fb both landed, both refused here, and both
 * synced nothing; the drift cleared itself within minutes each time. Its
 * repair is the Ask converge, which runs after readiness, so it was the same
 * deadlock wearing a different check's name. `media-index-drift` is the same
 * shape and is included before it costs a third.
 *
 * A VALUE PER KEY, naming the step, because the whole point of deferring is
 * that something later fixes it. A check with nothing to name does not belong
 * here, which is the test to apply before adding a fourth.
 *
 * STILL GATING, deliberately: `media-backup-drift` and `fts-equality`. Neither
 * has a ship step that repairs it, so under the rule above they gate. See the
 * note at the assertion step about `fts-equality`, which is the closest call.
 */
```

## scripts/build-icons.mjs

### scripts/build-icons.mjs:1 (CONTRACT, shortened)

that it is a generator, what proves its output, what nothing sees and why the builder is written down; the dated gates and the v4 supersession go to the history document.

```js
/**
 * Renders the icon suite from the ratified mark geometry.
 *
 * OBSERVATION BOUNDARY: this is a GENERATOR, not a gate. It renders; it asserts
 * nothing about what is already on disk. What proves its output is committed is
 * `check:content`, which since 2026-08-18 compares the `build:assets` manifest
 * against `public/` OFFLINE (it was `check:media`, and it was remote-only, which
 * is how a file shipped unindexed). What proves the output itself is
 * `check:logo`, which since 2026-08-13 parses the ICO container, checks every
 * raster's dimensions against `scripts/fixtures/icon-suite.json` and probes one
 * tile pixel per raster.
 *
 * What still nothing sees: the SHAPE of a rendered raster. An icon whose tile is
 * right and whose mark is clipped, mirrored or drawn in the wrong purple passes
 * every assertion in this repo. Eyes remain the instrument for that.
 *
 *   node scripts/build-icons.mjs --out <dir>
 *
 * WHY THIS EXISTS. logo-spec.md records that the shipped PNGs came from a
 * parametric builder that was never in this repo: the assets arrived as a zip.
 * That was survivable while they never changed. v4 changed them, so the choice
 * was to hand-edit binaries nobody could reproduce, or to write the builder
 * down. Path data is taken VERBATIM from logo-spec.md, which is the same source
 * the component and the four fixtures come from, so a variation is a rebuild
 * from values and never a hand edit.
 *
 * THE V4 IDENTITY. logo-spec.md says favicons and manifest icons "intentionally
 * stay on the light mark: they render in browser chrome and third-party cards
 * whose backgrounds the theme does not control". v4 agrees with the diagnosis
 * and supersedes the remedy: nothing here depends on a background it does not
 * own, because every one of these assets brings its own brand-purple tile.
 *
 * That now includes favicon.svg. It briefly shipped an embedded
 * prefers-color-scheme query instead, on the theory that the one asset which
 * CAN adapt should. It cannot: see faviconSvg below for the variable it was
 * actually keyed on, and why that was the wrong one.
 */
```

### scripts/build-icons.mjs:48 (CONTRACT, shortened)

why there is no second constant.

```js
/**
 * The ratified dark-mode purple. Transcribed from logo-spec.md, as check:logo
 * does. Its light twin #4F2D7F is not a separate constant here: since favicon
 * .svg became a tile, every use of that hex in this file is the TILE, and two
 * names for one value is how they drift apart.
 */
```

### scripts/build-icons.mjs:58 (NUMBER, shortened)

what the tile cost and which sizes recover it; the three measured ratios and the ruling date go to the history document.

```js
/**
 * The mark hex for the FAVICON tiles only, ruled 2026-08-13 after the review.
 *
 * The tile was adopted partly on the ground that it "gives the silhouette an
 * edge" at 16px. It does, and it also halved the mark's contrast, which is the
 * opposite of what that rationale predicted. Measured against the tile:
 *
 *   #4F2D7F on white (what the old white-tile icons had)  10.43
 *   #B7A5E0 lavender on #4F2D7F                            4.70
 *   #EDE8F5 on #4F2D7F                                     8.67
 *
 * So 16, 32 and 48 take --on-chrome-muted, the value already shipping as the
 * header's nav-at-rest, and recover most of the loss. The LARGE tiles keep
 * lavender: at 180px and up the silhouette is not contrast-limited, and
 * lavender is the ratified mark variant. This is a legibility exception at the
 * sizes that need it, not a second identity.
 */
```

### scripts/build-icons.mjs:77 (CONTRACT, shortened)

where the paths come from and which carry a placeholder.

```js
/**
 * The eight paths in the spec's paint order: ring, bowl, base, arc, tube,
 * amber, pale, cap. VERBATIM from logo-spec.md. The five purple ones carry a
 * placeholder the caller substitutes; the warm three are constant across every
 * variant and are written as their literals, exactly as the component does.
 */
```

### scripts/build-icons.mjs:95 (CONTRACT, shortened)

why it is derived from the construction; the coordinates go to the history document.

```js
/**
 * The mark's INK bounding box in spec coordinates.
 *
 * Derived from the construction, not from the path control points, because the
 * extremes are on ARCS and a control-point box would crop the ring. The ring is
 * the circle about O (192.2, 227.1) at r 112.5, so it reaches x 79.7 and 304.7
 * and y 114.6; the base runs to x 309.3 and stops at the baseline y 341.7; the
 * cap's corner at y 16.91 is the top.
 */
```

### scripts/build-icons.mjs:120 (WHY, shortened)

why the longer dimension.

```js
// Fit by the LONGER ink dimension so the padding is a real guarantee on both
  // axes rather than only on the one that happened to be measured.
```

### scripts/build-icons.mjs:148 (WHY, shortened)

which variable the query was keyed on and why a tile has no such dependency; the live demonstration and the ruling date go to the history document.

```js
/**
 * favicon.svg, a TILE like everything else. Ruled 2026-08-13, superseding the
 * media-query version this file shipped for one day.
 *
 * WHAT WAS WRONG WITH IT, and it was not a detail. The embedded
 * `prefers-color-scheme` query keyed on the OPERATING SYSTEM's colour scheme.
 * The thing it was trying to survive is the TAB STRIP's colour, which is set by
 * the BROWSER THEME, and no media query can see that. The two are independent,
 * so the query answered a question nobody asked. Demonstrated live: a purple
 * Chrome theme on a light-scheme OS resolved the query to LIGHT and painted the
 * deep-purple mark onto a purple tab strip.
 *
 * A tile has no such dependency. It brings its own background, which is the
 * same argument that put every raster on a tile, and it applies here for a
 * reason that turns out to be stronger rather than weaker: an SVG favicon
 * renders at roughly 16px, so it takes the ICO's small-size treatment.
 *
 * Same padding geometry as the raster tiles, from the same helper, so the SVG
 * and the ICO cannot drift apart.
 */
```

### scripts/build-icons.mjs:177 (CONTRACT, shortened)

what the container holds and that it was measured.

```js
/**
 * An ICO is a CONTAINER. This writes the same structure the shipped favicon.ico
 * already uses, measured before anything was regenerated: three PNG-encoded
 * images at 16, 32 and 48, 32bpp. No size is added and none is dropped.
 *
 * @param {Array<{ size: number, data: Buffer }>} images
 */
```

### scripts/build-icons.mjs:208 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------------ */
```

### scripts/build-icons.mjs:234 (WHY, shortened)

why the small tiles get less padding.

```js
// Small tiles get less padding: at 16px the silhouette needs the room,
      // and the tile is what gives it an edge in the first place. ICO_MARK
      // rather than DARK, for the measured reason recorded at its definition.
```

### scripts/build-icons.mjs:246 (NUMBER, shortened)

why the padding is geometric rather than stylistic; the two candidate values and their headroom go to the history document.

```js
// Maskable: the launcher may crop to a circle of 80% of the edge, so the ink
// must fit inside that circle, not merely inside an 80% square. For ink of
// aspect INK_W/INK_H the diagonal is what has to clear it, which is why the
// padding here is much larger than the android one and is NOT a style choice.
// 0.18 fits with only 8.3px of headroom on a 409.6px circle, which is 2% and
// too close to the edge of a spec launchers implement loosely. 0.19 buys 21px.
```

### scripts/build-icons.mjs:256 (WHY, shortened)

why the manifest is regenerated here and only when writing to public; the ruling reference goes to the history document.

```js
/*
 * REGENERATE THE ASSET MANIFEST, the way build-diagrams.mjs does, and for the
 * reason this script was the last one not to.
 *
 * Everything above writes files into `public/`, and `content/generated/assets.json`
 * is derived from exactly that directory. There is no world in which a stale one
 * is wanted, so it is not left to be remembered: this script has NO npm alias
 * (it is run as `node scripts/build-icons.mjs`), it is run by hand and rarely,
 * and it is the only generator that adds NEW files to `public/` rather than
 * rewriting ones already listed. That combination is why the ruling singled it
 * out: a new icon would otherwise sit unindexed until someone happened to run
 * `build:assets` for an unrelated reason.
 *
 * ONLY WHEN WRITING TO public/. With `--out` pointed at a scratch directory this
 * script is rendering for inspection, nothing under `public/` moved, and
 * regenerating the manifest would be a side effect nobody asked for.
 *
 * The media index itself still cannot be rebuilt from here: it needs the ASSETS
 * binding and therefore the Worker. Saying so is all this can do, and saying it
 * loudly is the point.
 */
```

### scripts/build-icons.mjs:278 (WHY, shortened)

why the cwd is pinned.

```js
// cwd pinned to ROOT: build-assets.mjs resolves `public` and `content/generated`
  // relative to the working directory, so inheriting a caller's cwd would walk
  // the wrong tree or write the artifact somewhere nobody looks.
```

## scripts/check-hook-matchers.mjs

### scripts/check-hook-matchers.mjs:1 (CONTRACT, shortened)

the defect, the boundary, the residual, fail-closed and the two branches; the tool names, the 59 days and the earlier fix go to the history document.

```js
/**
 * Gate: no tool that can reach a guarded act is missing from the hook matchers.
 *
 *   npm run check:hook-matchers
 *
 * ## Why this exists, 2026-09-15
 *
 * A PreToolUse matcher is a regex over the TOOL NAME. The matchers here read
 * `Write|Edit|Bash` and `Bash` until today, and the agent's PowerShell tool
 * reports the name `PowerShell`, which matches neither. Every hook in this
 * directory fired on Bash calls and on nothing else, while the session held
 * pre-approved `PowerShell(npm run *)` and `PowerShell(git *)` permission
 * rules. So `npm run deploy` with no deploy door, an unscoped `git add` with no
 * scoped-add check, and a push with no lint were all reachable with no prompt
 * and no guard, for 59 days on the two oldest hooks.
 *
 * ef6be97 on 2026-08-14 had already fixed this once, one tool name earlier,
 * when the em dash hook matched only Write and Edit. A matcher ENUMERATES
 * tools, so it goes stale every time the harness gains one, and until this file
 * nothing in the repo read a matcher at all: check:hook-syntax parses the hooks
 * and says in its own header that it cannot see whether one is REGISTERED, and
 * check:hook-scope replays the deploy hook and says it cannot see whether the
 * harness invokes it. Both gaps end at this gate.
 *
 * ## OBSERVATION BOUNDARY, and it is the important half
 *
 * THE HARNESS TOOL LIST IS NOT IN THIS REPO. There is no manifest of the tools
 * a session can call, so the assertion a reader actually wants, every tool that
 * can execute a command string is in every matcher, is NOT statically decidable
 * here. Nothing in a checkout knows that a tool named PowerShell exists.
 *
 * What IS on disk is the PERMISSION ALLOW LIST, and that is what this gate
 * reads. A tool the session has been granted appears there by name, so the
 * matchers can be compared against a set derived from a DIFFERENT file than the
 * one under test, which is the fixture independence rule 10 asks for. That
 * comparison is exactly the desync that went unnoticed: the PowerShell rules
 * and the Bash-only matcher sat in the same directory for ten weeks.
 *
 * THE RESIDUAL, stated rather than hidden. A tool used under one-off approvals
 * writes no permission rule, so this gate cannot see it. The window it closes
 * is the one that actually happened, from ten weeks down to the next gate run,
 * and the window it leaves open is a tool nobody has ever granted. That is why
 * REQUIRED carries a hard floor as well: the names known to matter today are
 * asserted whether or not a permission rule still mentions them.
 *
 * ## FAILS CLOSED ON AN UNKNOWN TOOL
 *
 * Every tool name found in an allow list must be CLASSIFIED below. A name this
 * file has never been told about is a FAILURE, not a skip, and the message says
 * which bucket to put it in. That is the one direction that matters: the defect
 * this gate exists about was a new tool name arriving and nothing noticing, so
 * an unclassified name has to stop the tier rather than pass through it.
 *
 * ## TWO BRANCHES, because `settings.local.json` is gitignored
 *
 * The local file holds most of the interesting rules and is untracked, exactly
 * like `wrangler.jsonc` and for the same reason check:config cannot run in CI.
 * A checkout has no copy, so this gate runs the tracked half there and says so.
 * The two branches print DIFFERENT floor names, `checks-local` and
 * `checks-tracked`, so a floor measured under one is never read against the
 * other. check:invariants records that collision costing a silent pass.
 */
```

### scripts/check-hook-matchers.mjs:90 (CONTRACT, shortened)

why every matcher and not some.

```js
/**
 * TOOLS THAT EXECUTE A COMMAND STRING. Each one must appear in EVERY PreToolUse
 * matcher registered in this file, because every hook here reads
 * `tool_input.command` and none of them reads `tool_name`: a hook is blind to
 * which tool sent the command, so the matcher is the only thing deciding.
 *
 * @type {Record<string, string>}
 */
```

### scripts/check-hook-matchers.mjs:115 (CONTRACT, shortened)

why the exclusions are enumerated, with its citation.

```js
/**
 * TOOLS THAT NEED NO MATCHER, enumerated rather than defaulted.
 *
 * AN EXCLUSION NAMING A TOOL EXCLUDES EVERYTHING IT CAN DO, which is rule 10's
 * discipline about enumerating inside exclusions, so each one carries the reason
 * it cannot reach a guarded act: it neither runs a command nor writes a file.
 *
 * @type {Record<string, string>}
 */
```

### scripts/check-hook-matchers.mjs:133 (CONTRACT, shortened)

why a hard floor beside the observed set.

```js
/**
 * The names asserted present whether or not a permission rule still mentions
 * them. A hard floor, because the residual above is real: a tool used under
 * one-off approvals leaves no rule behind, and a rule deleted in a tidy-up must
 * not quietly delete the requirement with it.
 */
```

### scripts/check-hook-matchers.mjs:141 (WHY, shortened)

why the observed set can never demand these; the measurement and the printed line go to the history document.

```js
/**
 * The same floor for the dash matcher, and here it is not a belt-and-braces
 * measure but the ONLY thing asserting anything.
 *
 * MEASURED 2026-09-15: Write and Edit appear in no allow list in this repo and
 * never will, because they are permitted by default and a rule is only written
 * for something that prompts. So the observed set can never demand them, and a
 * content half built purely on observation asserts NOTHING while reporting a
 * clean sweep. That is the unfailable-condition class from rule 10, found by
 * running this gate and reading "content tools checked: none observed".
 */
```

### scripts/check-hook-matchers.mjs:182 (CONTRACT, shortened)

the gap the sibling gate names and cannot close.

```js
/*
 * 1. REGISTRATION. Every hook file on disk is registered, and every registered
 *    command points at a file that exists.
 *
 * This is the gap check:hook-syntax names in its own header and cannot close: it
 * compiles what it finds in the directory, so a hook nobody registered compiles
 * cleanly and guards nothing, and a registration whose path has drifted takes a
 * guard out while leaving its file in place to be read and believed.
 */
```

### scripts/check-hook-matchers.mjs:193 (CONTRACT, shortened)

why the shape is declared; the six errors and the catching hook go to the history document.

```js
/**
 * ONE SHAPE FOR A HOOK ENTRY, declared rather than inferred.
 *
 * `JSON.parse` returns `any`, and the first draft read `entry?.hooks` through it
 * with an `Array.isArray` ternary whose other branch was `never[]`. Six implicit
 * `any` errors, caught by the Stop hook running `npm run typecheck` rather than
 * by anything here, which is the check:types half of rule 10: a gate script is
 * source like any other and an untyped read of parsed JSON is where it lands.
 *
 * @typedef {{ matcher?: string, hooks?: Array<{ command?: string }> }} HookEntry
 */
```

### scripts/check-hook-matchers.mjs:252 (CONTRACT, shortened)

where the expected set comes from, with its citation.

```js
/*
 * 2. THE MATCHERS AGAINST THE PERMISSION ALLOW LISTS.
 *
 * The tool names are taken from the allow rules, which are a different file
 * from the matchers in the local case and a different SECTION of the same file
 * in the tracked one. Either way the expected set is not produced by the thing
 * being checked, which is what rule 10 means by fixture independence.
 */
```

### scripts/check-hook-matchers.mjs:270 (CONTRACT, shortened)

how a name is read off a rule and why MCP rules are dropped.

```js
/*
 * THE TOOL NAME IS THE PREFIX BEFORE THE PAREN, and a rule with no paren is the
 * whole name. `mcp__server__tool` rules are dropped: an MCP tool runs on a
 * server and cannot reach this tree or this shell, and they would otherwise be
 * hundreds of names demanding classification.
 */
```

### scripts/check-hook-matchers.mjs:341 (WHY, shortened)

why the content tools are asked of one matcher.

```js
/*
 * THE CONTENT TOOLS, against the matcher that registers the dash hook rather
 * than against all of them. Asking every matcher for Write would demand it on
 * the shell-only group, which reads no file content and would be a false
 * requirement that somebody eventually satisfies by widening the wrong matcher.
 */
```

### scripts/check-hook-matchers.mjs:380 (NUMBER, shortened)

why the names are split even while the counts agree; both measured runs and the date go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR, one name per branch.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-09-15 by RUNNING it both
 * ways: 22 with the local settings present, and 22 with the file moved aside,
 * which is how the second number was taken rather than by subtracting.
 *
 * THE TWO ARE EQUAL TODAY AND THE SPLIT IS STILL RIGHT. They are equal because
 * every tool the local file adds beyond the tracked one is either already in
 * the hard floor (PowerShell) or unguarded (Read, WebFetch), and an unguarded
 * tool asserts nothing. The moment a new COMMAND tool is granted in the local
 * file alone, the local branch gains one assertion per matcher and the tracked
 * branch gains none, so a single floor would then be measured on this machine
 * and read against CI. That is the collision check:invariants records costing a
 * silent pass, and it is cheaper to keep the names apart than to discover it
 * again.
 */
```

## scripts/check-mail.mjs

### scripts/check-mail.mjs:1 (CONTRACT, shortened)

why it exists, the two paths, who owns the domain, the boundary and why an independent resolver; the record inventory and the dated measurement go to the history document.

```js
/**
 * Gate over the DNS records that make the watchdog's alert mail authenticate.
 *
 *   npm run check:mail
 *
 * NETWORK TIER. It resolves live DNS and cannot run offline, which is why it is
 * not in the tier `ship` runs.
 *
 * ## WHY THIS EXISTS
 *
 * The watchdog is the thing that tells Dustin the site is down. Its whole value
 * is one email arriving. SPF, DKIM and DMARC decide whether that email is
 * delivered or silently dropped, and all six records live in a dashboard where
 * a single click can remove one. Nothing else in this repo can see them: they
 * are not in a config file, they are not in the Worker, and a green deploy says
 * nothing about them. Measured 2026-09-08: every record below was already
 * correct and NOBODY HAD CHECKED, which is the state this gate ends.
 *
 * ## TWO PATHS, NAMED SEPARATELY, BECAUSE THEY ARE DIFFERENT CLAIMS
 *
 * Cloudflare Email Service onboards a domain twice, and the two halves use
 * different hosts and different DKIM selectors. Conflating them is the easy
 * mistake here, and it fails in the direction that looks green:
 *
 * - **SENDING** is what the alert mail uses. Email Sending puts the bounce and
 *   return path on a `cf-bounce` subdomain, so the SPF that authorises the
 *   watchdog's mail is on `cf-bounce.<domain>` and NOT on the apex, and its
 *   DKIM selector is `cf-bounce._domainkey`.
 * - **ROUTING** is what the domain receives on. Email Routing puts MX and SPF
 *   on the apex and uses the `cf2024-1._domainkey` selector.
 *
 * A gate that asserted "the apex SPF has Cloudflare's include" would therefore
 * be checking the ROUTING path while claiming to protect the ALERT MAIL, and
 * would stay green through a `cf-bounce` record being deleted. Both paths are
 * asserted here and each failure names which one it is.
 *
 * ## THE MAIL DOMAIN HAS ONE OWNER AND IT IS NOT THIS FILE
 *
 * Rule 17. The domain is read out of `ALERT_FROM` in `workers/watchdog.ts`, the
 * single place that states where the alert mail comes from. It is deliberately
 * NOT `SITE_ORIGIN`: that is a `workers.dev` host until the cutover, and
 * `watchdog.ts` records at length why the mail domain and the serving origin
 * are separate facts. Parsed rather than imported because `watchdog.ts` is a
 * Worker entry module that does not load under node.
 *
 * ## OBSERVATION BOUNDARY, and it is a real one
 *
 * This proves the RECORDS ARE PUBLISHED AND WELL FORMED. It does not prove a
 * message authenticates: only a received message's `Authentication-Results`
 * header proves that, which is a manual step recorded in the session report and
 * cannot be a gate, because it needs a mailbox this repo cannot read.
 *
 * It also cannot see DKIM key VALIDITY. A published `p=` that no longer matches
 * Cloudflare's private key is indistinguishable from a good one at this
 * distance, and would fail closed only at the recipient.
 *
 * Resolution goes through Google Public DNS rather than Cloudflare's, and the
 * independence is the point: every record here is managed by Cloudflare, so
 * asking Cloudflare's own resolver about them would put one party on both sides
 * of the question. A resolver that cannot answer is a FAILURE and never a pass.
 */
```

### scripts/check-mail.mjs:85 (CONTRACT, shortened)

why the argument order and what the first version did; the FAILURES reference goes to the history document.

```js
/**
 * `ok(label, condition, detail)`, the argument order every gate in this repo
 * uses, and it is NOT a style preference.
 *
 * The first version of this file took the path as a leading argument, so the
 * label sat where the condition belongs. `check:invariants` section 17 refused
 * it on sight, correctly: a string in the condition slot is always truthy, so
 * every assertion here would have passed forever while the check count went on
 * rising. FAILURES.md carries the shape ("one helper name with two argument
 * orders can never fail") and this file was very nearly its next instance.
 *
 * The path stays visible by being the first thing in the LABEL instead, which
 * costs nothing and cannot be mistaken for a condition.
 *
 * @param {string} label
 * @param {boolean} condition
 * @param {string} [detail]
 */
```

### scripts/check-mail.mjs:111 (WHY, shortened)

why it is anchored on the declaration, with its citation.

```js
/**
 * THE MAIL DOMAIN, read from its one owner.
 *
 * Anchored on the `const ALERT_FROM` declaration rather than on any address
 * shaped string in the file, so a mention of an address in a comment cannot
 * satisfy it. Hard rule 10: strip comments before matching is not enough on its
 * own, the needle has to name the binding.
 */
```

### scripts/check-mail.mjs:147 (WHY, shortened)

why transport failures only; the failing run goes to the history document.

```js
/*
   * RETRIED, and the reason is measured rather than defensive. The first full
   * run of this gate went red on `TypeError: fetch failed` for ONE of the six
   * queries while the other five answered, so the record was fine and the
   * transport blinked. A monitoring gate that cries wolf on a single dropped
   * packet gets ignored, which is the exact lesson `alert-state.mjs` was written
   * around: an alert that repeats itself costs the next real one its job.
   *
   * TRANSPORT FAILURES ONLY. An answered query is never retried, however
   * unwelcome the answer: NXDOMAIN and a wrong record are FINDINGS, and retrying
   * a finding until it changes is how a gate is talked out of a true failure.
   */
```

### scripts/check-mail.mjs:187 (CONTRACT, shortened)

why the strings must be joined.

```js
// A TXT record longer than 255 bytes reaches the wire as several quoted
    // strings and MUST be concatenated before matching. A DKIM key is always
    // over 255 bytes, so a matcher that skipped this would read a truncated key
    // and could never find the end of it.
```

### scripts/check-mail.mjs:199 (CONTRACT, shortened)

why exactly one.

```js
/**
 * SPF, asserted the same way on both paths.
 *
 * EXACTLY ONE record, because two SPF records on one name is a permanent error
 * under RFC 7208 and resolves to `permerror` rather than to either record.
 *
 * @param {string} path
 * @param {string} name
 */
```

### scripts/check-mail.mjs:229 (CONTRACT, shortened)

why presence is not enough.

```js
/**
 * DKIM, asserted by selector.
 *
 * The public key is checked for PRESENCE and NON-EMPTINESS only. `p=` with an
 * empty value is the documented way to REVOKE a key, and it is valid syntax, so
 * a gate that only checked the record parsed would pass a revoked selector.
 *
 * @param {string} path
 * @param {string} name
 */
```

### scripts/check-mail.mjs:264 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------ SENDING: the alert mail */
```

### scripts/check-mail.mjs:283 (WHY, shortened)

why the specific policy and not merely a policy.

```js
/*
       * p=reject SPECIFICALLY, not merely "a policy". The zone has been at
       * reject since before this gate existed, and the failure worth catching
       * is a WEAKENING: a dashboard edit to p=none looks like a valid DMARC
       * record to any check that only asks whether a policy is present.
       */
```

### scripts/check-mail.mjs:294 (WHY, shortened)

what enforcing without reporting is.

```js
/*
       * A rua, so failures are OBSERVABLE. Without one, DMARC is enforcing at
       * reject and reporting to nobody, which is the state this zone was in
       * when the gate was written.
       */
```

### scripts/check-mail.mjs:308 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------- ROUTING: what the domain receives */
```

### scripts/check-mail.mjs:331 (NUMBER, shortened)

why records rather than assertions, and why no slack; the six names go to the history document.

```js
/*
   * FLOOR ON RECORDS CHECKED, which is the count that matters here.
   *
   * The failure this floors against is a resolver returning early or a path
   * being skipped: every assertion above hangs off a `resolve` call, so a gate
   * that queried nothing would print no failures and report clean. Counting
   * ASSERTIONS alone would not catch it either, because a query that fails
   * closed still increments the assertion count.
   *
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed.
   * Six named records: cf-bounce SPF, cf-bounce DKIM, _dmarc, apex SPF,
   * cf2024-1 DKIM, apex MX. Floored at the full six with no slack, because the
   * set is enumerated in this file rather than discovered, so it cannot drift
   * without someone editing the enumeration.
   */
```

### scripts/check-mail.mjs:356 (WHY, shortened)

why exitCode; the measurement goes to the history document.

```js
/*
   * `exitCode` rather than `process.exit()`, on check:uptime's measurement:
   * `process.exit()` tears the process down while libuv still holds queued
   * stdout writes on Windows and the gate exits 127 with its output lost.
   */
```

## scripts/check-stack.mjs

### scripts/check-stack.mjs:1 (CONTRACT, shortened)

what the subject is, both boundary limits, both directions and the re-derivation; the ruling number, the CI argument's history and the deleted entry go to the history document.

```js
/**
 * Gate over the colophon's generated stack data.
 *
 *   npm run check:stack
 *
 * THE SUBJECT IS A BUILD PRODUCT, NOT A COMMIT (ruling 39a, 2026-09-08).
 * `content/generated/stack.json` is gitignored and written by `build:stack`,
 * which runs before the gates in `check-all.mjs`, in ship's build step and in
 * CI. This gate therefore asserts that a build HAPPENED and that what it
 * produced reconciles with its sources; it no longer asserts that a committed
 * copy equals a fresh derivation, because that compared a commit to a build
 * and made every dependency bump a two-file change no bot could complete.
 *
 * OBSERVATION BOUNDARY, and there are TWO limits, not one.
 *
 * **First, it cannot tell whether the prose is TRUE.** A hand-written
 * `whyLoadBearing` is reconciled against the binding it describes, so the gate
 * knows the binding still exists and nothing more. Verifying the claim itself
 * is the evidence-anchor design in colophon-page.md and is a separate change.
 *
 * **Second, and easier to miss: this gate reads `wrangler.jsonc.example`, which
 * is not what is deployed.** The example is the tracked file, so it is the only
 * one a clone can read, and everything here is derived from it. The single
 * thing binding it to the Worker that actually runs is `check:config`, which
 * compares the example against the real `wrangler.jsonc`. That file is
 * gitignored, so `check:config` can only run where it exists, which is one
 * machine, **and CI CANNOT CLOSE THIS GAP.** That is measured, not assumed: a
 * checkout has no real config and `postinstall` bootstraps one by copying the
 * example, so real equals example by construction and the gate cannot pass.
 * It is in `CI_EXCLUDED`. A green `check:stack` therefore says the artifact
 * matches the example. It says the artifact matches PRODUCTION
 * only as far as someone remembered to run `check:config` on the machine that
 * holds the real config.
 *
 * That gap is real and it is recorded HERE, in the gate it is about, rather
 * than on the page. It used to be described as "the same accepted gap this
 * page lists under `notAdopted`", which stopped being true on 2026-09-11 when
 * the one entry under that status was deleted for being false about CI. A
 * cross-reference to a list is a claim that ages; a gate's own boundary note
 * is the place a boundary belongs.
 *
 * Pure: no network, no database, no bindings.
 *
 * ## Both directions, on every source
 *
 * A generated artifact only stays honest if the gate fails when EITHER side
 * moves. A binding in the config with no row is the obvious direction; a row
 * with no binding is the one that actually happens, because a resource gets
 * removed and the page keeps advertising it. The same holds for gates,
 * migrations and dependencies.
 *
 * The hand-written notes get the same treatment: a binding with no note fails,
 * and a note naming a binding that no longer exists fails. Without the second
 * direction the notes file becomes the place stale claims accumulate, which is
 * the exact rot the ruling was written against.
 *
 * ## It re-derives rather than trusting the artifact
 *
 * Every expectation is computed by calling `build-stack.mjs`'s own exported
 * derivations against the live sources. Nothing here restates a binding name, a
 * version, a migration or a gate, so a list that drifts moves one side of a
 * comparison and fails. `check:all` derives its gate list the same way and for
 * the same reason.
 *
 * FAILS CLOSED. An empty enumeration on any source is a failure, not a pass:
 * "0 differences" must never be reachable by examining nothing.
 */
```

### scripts/check-stack.mjs:144 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- fail closed first */
```

### scripts/check-stack.mjs:159 (WHY, shortened)

how two blind sides agree; the plant goes to the history document.

```js
/*
 * The blind spot, made loud. A binding KIND no reader understands produces no
 * rows on either side of every comparison below, so the artifact and the config
 * agree by both being empty. Found by planting `vectorize` in the example config
 * and watching this gate pass with 0 failures.
 */
```

### scripts/check-stack.mjs:193 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- shape and freshness */
```

### scripts/check-stack.mjs:201 (WHY, shortened)

what the old comparison was asking and why mtime answers the right question; the ruling number and the PR numbers go to the history document.

```js
/*
 * FRESHNESS, WHICH REPLACED A COMPARISON THAT WAS ASKING THE WRONG QUESTION.
 *
 * Until ruling 39a this line read `JSON.stringify(buildStack()) ===
 * JSON.stringify(artifact)` and was described as the strongest assertion in the
 * file. It was comparing A COMMIT TO A BUILD, and that is the defect rather
 * than a strength: the only way to satisfy it was for a human to run
 * `build:stack` and commit the result in the same change as the package.json
 * edit that moved it. Renovate cannot run a build, so all three of its first
 * pin PRs (#19 to #21, 2026-09-07) arrived red here with nothing wrong in them.
 *
 * stack.json is now a gitignored build product, derived before the gates in
 * check-all, in ship's build step and in CI. So the question worth asking is no
 * longer "does the commit match a build" but "did a build actually happen",
 * and mtime against package.json is what answers it. package.json is the input
 * this gate exists to track: it carries the dependencies and the gate names,
 * and it is the file a dependency PR edits.
 *
 * The reconciles below still fail on a stale artifact, and they are not
 * redundant with this: they read the artifact's CONTENT, so they catch a
 * regeneration that ran and produced the wrong thing, where mtime only catches
 * one that did not run at all.
 */
```

### scripts/check-stack.mjs:235 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------------- both directions */
```

### scripts/check-stack.mjs:252 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------ the hand-written half, both directions */
```

### scripts/check-stack.mjs:281 (WHY, shortened)

why the two statuses are different claims, why the vocabulary is closed and who else owns it; the deleted entry and the dates go to the history document.

```js
/*
 * `refused` and `accepted-gap` are DIFFERENT CLAIMS and the page states which.
 *
 * The list was originally called the refusals throughout, and CI was in it. It
 * is not a refusal: neither decisions.md nor decisions-vol-1.md carries a
 * ruling declining CI, and the record files it as a gap that has already cost
 * something. Calling it a refusal would have published a decision nobody made,
 * on the one page whose whole subject is what was decided.
 *
 * The status is closed rather than free text, because values a reader can rely
 * on are worth more than an open vocabulary that drifts into synonyms.
 *
 * ONE VALUE SINCE 2026-09-11, and this list is the SECOND owner of that
 * vocabulary rather than the first: `STATUS_LABEL` in
 * `app/lib/colophon-sections.mjs` is what the page renders through, and
 * `check:features` asserts in both directions that the labels and the statuses
 * in use are the same set. `accepted-gap` left both in the same commit with its
 * last member, the false "Continuous integration" entry. Adding the next
 * accepted gap means editing both, which is the point.
 */
```

### scripts/check-stack.mjs:316 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- runtime facts */
```

### scripts/check-stack.mjs:335 (NUMBER, shortened)

what an empty roster would do; the measurement and its date go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate reconciles a GENERATED artifact against its sources, which is the
 * shape most able to pass by checking nothing: if the artifact parsed to an
 * empty roster, every loop below would iterate zero times and report green.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 24.
 * Never summed. Floored at 22, slack of two: the count tracks the colophon's
 * declared bindings, gates, migrations and dependencies, so it grows with the
 * stack rather than wandering.
 */
```

## scripts/check-worker.mjs

### scripts/check-worker.mjs:1 (CONTRACT, shortened)

the boundary, why it exists and the shared failure mode; the audit's counts and the three defects go to the history document.

```js
/**
 * Gate: run the Worker test layer, and refuse to believe an empty one.
 *
 *   npm run test:worker
 *
 * ## OBSERVATION BOUNDARY
 *
 * **IT RUNS VITEST IN WORKERD AND READS ITS SUMMARY.** It knows how many test
 * files were discovered and how many cases the runner's own report counted. It
 * does not
 * know whether those cases ASSERT anything: an empty `it()` body counts as a
 * passing case here exactly as it does for vitest. That class belongs to
 * review.
 *
 * It cannot see the deployed build, which is `verify-live`'s subject, and it
 * cannot see the platform's cache, which is `check:browser`'s. The layer's own
 * boundary, including why the React Router route table is a stub, is stated at
 * length in `vitest.config.ts`.
 *
 * ## Why this exists
 *
 * The 2026-08-29 audit: 487 pure-function tests and a real-browser gate, with
 * NOTHING BETWEEN THEM. No test ran a loader, an action, D1, KV, R2, the Cache
 * API or the Worker, so every route-level fact had to be established by probing
 * production, and three defects reached the wire that this layer catches
 * offline in seconds.
 *
 * ## THE SAME FAILURE MODE AS `check:tests`, AND THE SAME REPAIR
 *
 * **Vitest exits 0 when its `include` glob matches nothing.** A rename, a moved
 * directory, or a config edit would empty this layer and the runner would call
 * it success, which is the exact defect the 2026-08-11 audit found in
 * `check:tests`. So this gate discovers the files itself, floors the count, and
 * floors the executed cases, all before believing an exit code.
 */
```

### scripts/check-worker.mjs:47 (NUMBER, shortened)

the measurement rule, why tight, and who owns the tolerance; the restated percentage and its failing run go to the history document.

```js
/**
 * Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it, never
 * summed. Re-taking the measurement means running the gate.
 *
 * Tight rather than slack, on `check:tests`' convention and for its reason:
 * these move UP when somebody adds a case, a one-line edit in the same commit,
 * and the whole point is to notice the set SHRINKING.
 *
 * HOW FAR UNDER IS `check:floors`' TO SAY, and it is not restated here. This
 * docblock used to carry "about 94 percent", which is a second owner of a rule
 * that gate enforces, and the two disagreed by one case on the first run after
 * it was written down: 113 satisfied the sentence and failed the gate.
 */
```

### scripts/check-worker.mjs:60 (NUMBER, shortened)

the relationship every pair here has had; the dated readings go to the history document.

```js
/* 8 against 9, re-measured 2026-09-06 by RUNNING the gate after
   media-events.test.ts landed. It was 7 against 8. One below the measurement,
   so a single file leaving the *.test.ts pattern trips it, which is the
   relationship every pair here has had. */
```

### scripts/check-worker.mjs:65 (NUMBER, shortened)

what this catches that a file count cannot; the dated readings and the corrected pair go to the history document.

```js
/* 114 against 120, re-measured 2026-09-06 by RUNNING the gate after the two
   placeholder cases landed, then corrected from 113 by check:floors, which
   allows a gap of at most 6 at this count. The file floor catches a file
   LEAVING; this one catches a file being hollowed out in place, which no file
   count can see.

   THE PREVIOUS PAIR DID NOT FOLLOW THE CONVENTION ABOVE, and it is corrected
   here rather than carried: the comment recorded "105 against 112" and the
   constant read 112, the measurement itself. That fails in the safe direction
   (it trips on a single case leaving) and it also went stale silently, because
   by today the layer had grown to 118 cases against a floor written for a
   112-case run. Re-run, never adjusted by arithmetic. */
```

### scripts/check-worker.mjs:77 (NUMBER, shortened)

where the tolerance rule lives and why the first attempt went undetected locally; every count and date goes to the history document.

```js
/*
 * RE-MEASURED 2026-09-11 BY RUNNING THE GATE: 127 cases, confirmed identically
 * by CI on a clean checkout. The floor of 114 predates this session; the two
 * test files added to test/worker/ raised the count and pushed the existing gap
 * past what check:floors allows.
 *
 * Executed 127, tolerance 7, lowest legal 120, set to 124.
 *
 * **SET THROUGH check:floors' OWN TOLERANCE, 2026-09-11, after CI caught the
 * first attempt.** That attempt read "six percent under" out of a comment in
 * check-headers.mjs and applied it to four gates. The rule is
 * `max(3, ceil(executed * 0.05))` and it belongs to `scripts/check-floors.mjs`,
 * the gate that enforces it. Prose about a gate ages; the gate does not.
 *
 * It went undetected locally because check:floors runs the whole offline tier
 * and therefore runs LAST, and the tier hangs before it on this host
 * (node --test wedges on test/check-all-cleanup.test.mjs, which predates this
 * work and is proven so by differential). CI reached it on the first push.
 */
```

### scripts/check-worker.mjs:134 (WHY, shortened)

why this scope floor is in the meta-gate.

```js
/*
 * THROUGH assertFloor SINCE 2026-09-15. The worker test set only ever gets
 * added to, so this is a scope floor over a GROWING set: the measured value
 * climbs away from the floor by itself and the gap widens with no edit, which
 * is the drift check:floors exists to notice. It printed no floor line while it
 * was a bare ok(), so the meta-gate had nothing to read. See check-tests.mjs's
 * note beside its file floor for which scope floors deliberately stay out.
 */
```

### scripts/check-worker.mjs:151 (WHY, shortened)

what was observed, that the cause was not established, and why a contract rather than a better needle; the version, the banner lines and the refuted candidate go to the history document.

```js
/*
 * ## THE COUNTS COME FROM VITEST'S JSON REPORTER, NOT FROM ITS HUMAN OUTPUT
 *
 * **CAUGHT BY CI ON THIS GATE'S FIRST CLEAN-CHECKOUT RUN, 2026-08-29.** The
 * first version read `Tests  61 passed (61)` off the default reporter with an
 * anchored regex.
 *
 * WHAT WAS OBSERVED, and it is deliberately separated from what caused it. The
 * tests RAN in CI and passed: the run exited 0 and the whole log carries the
 * `console.error` lines `routes.test.ts` produces on STDERR. What the log
 * carries nowhere is any of vitest's STDOUT: no `RUN  v` banner, no
 * `Test Files`, no `Tests`, no `Duration`. So the gate read `cases null` and
 * failed closed.
 *
 * **THE CAUSE WAS NOT ESTABLISHED, and this comment does not invent one.** The
 * obvious candidate was checked and REFUTED: re-running the old needle locally
 * with `GITHUB_ACTIONS=true` and `CI=true` still matched, at 61, so vitest
 * swapping reporters under that variable is not it. Whatever ate that stream
 * lives somewhere between the Linux runner, npm and the pool, and it is not
 * reproducible on this machine.
 *
 * That is exactly why the repair is not a better regex. The mistake underneath
 * is hard rule 10's own: the needle was pointed at a HUMAN-FACING RENDERING,
 * which is free to differ per environment and did, in a way nobody has yet
 * explained. The JSON reporter is a CONTRACT instead. `numTotalTests` and
 * `numFailedTests` come off a file this gate names and reads itself, so the
 * class is gone rather than patched, whatever the stream does.
 *
 * BOTH REPORTERS RUN. The default one still reaches the console, because a
 * person reading a failure wants the case name and the diff, and the JSON file
 * costs nothing beside it.
 *
 * IT STILL DELEGATES, on the anti-mirror rule `check:types` follows:
 * package.json defines what this layer's run IS and the flags below only add an
 * output format to it, so `npm run test:worker` stays the command a person
 * types.
 */
```

### scripts/check-worker.mjs:246 (NUMBER, shortened)

what this floors and why slack is zero; the measurement and its date go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS.
 *
 * MINIMUM_CASES above floors the cases VITEST ran, which is the important
 * number and not this one. This floors the assertions this gate makes ABOUT
 * that run: discovery, the exit code, the parsed totals. If those stopped
 * running, the case floor above would stop being consulted and nothing would
 * say so.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-29 by RUNNING it: 5.
 * Never summed. Slack of ZERO, on `check:tests`' reasoning: this gate asserts a
 * fixed set of properties about one run, so a drop is a removed assertion
 * rather than natural movement, and a rise arrives in the commit that adds one.
 */
```

## scripts/build-diagrams.mjs

### scripts/build-diagrams.mjs:1 (CONTRACT, shortened)

why build time, the gap it leaves, why the bytes are never gated and why two renders; the two engine errors and the ruling reference go to the history document.

```js
/**
 * Renders every `:::diagram` in the corpus to a static SVG asset.
 *
 *   npm run build:diagrams [-- --force]
 *
 * BUILD TIME ONLY, in Node, driving a real Chromium through mermaid-cli. That is
 * not a preference, it is the ruling (Capsid `dustinedwards/chart-stack.md`) and
 * it was decided by measurement: diagram layout needs real font metrics, so
 * mermaid on a DOM shim dies at `CSSStyleSheet is not defined` with
 * `SVGTextElement.getBBox()` behind it, and Pintora at `Cannot set properties of
 * null (setting 'font')`. Charts pass the both-writers rule and render inline;
 * diagrams cannot and take the social-card pattern instead.
 *
 * The gap that leaves is the same one social cards have and it is recorded
 * rather than papered over: a diagram authored or edited in the admin editor has
 * no asset until this runs. The post still renders, with a missing image, which
 * is why `check:diagrams` fails on a referenced asset that is not on disk.
 *
 * Nothing here touches the gated artifact. The KEY is deterministic content and
 * lives in the artifact; the SVG bytes come out of a browser engine and are
 * exactly the kind of input a byte-comparison gate must never be handed.
 *
 * Two renders per diagram, light and dark. Forced, not chosen, and both halves
 * were measured:
 *
 *   1. mermaid will not accept a custom property. `themeVariables:
 *      { primaryColor: "var(--surface)" }` fails the render outright with
 *      `Error: Unsupported color format: "var(--surface-2)"`, because khroma
 *      parses every value to derive the ones it was not given.
 *   2. An SVG referenced by `<img>` is an independent document, so even a
 *      successfully embedded `var()` would resolve against nothing. And this
 *      site resolves its theme from a cookie, not from the OS, so a
 *      `prefers-color-scheme` block inside the asset would hand a reader who
 *      chose light under a dark OS the wrong drawing.
 */
```

### scripts/build-diagrams.mjs:57 (CONTRACT, shortened)

why it is set explicitly.

```js
/**
 * The id mermaid writes onto the SVG root and prefixes every internal id with.
 *
 * Set explicitly rather than left to mermaid-cli's default, so the bytes do not
 * move if that default ever does. Two diagrams on one page cannot collide on it:
 * each asset is its own document behind its own `<img>`.
 */
```

### scripts/build-diagrams.mjs:69 (WHY, shortened)

why a recorded limitation rather than a solved problem.

```js
/**
 * The font stack the diagram is laid out with, and the one it is displayed in.
 *
 * A recorded limitation rather than a solved problem. The site's prose is Inter,
 * loaded as a webfont, and an SVG inside an `<img>` may not load external
 * resources, so a diagram cannot be set in Inter without embedding the font in
 * every asset. It is set in the system sans instead, which also means the
 * viewer's font is not guaranteed to be the one this build measured text with:
 * mermaid bakes box sizes from the metrics it sees. A wider font on the reader's
 * machine eats into node padding rather than being clipped, which is why the
 * padding below is generous rather than default.
 */
```

### scripts/build-diagrams.mjs:97 (WHY, shortened)

what a foreignObject does inside an img.

```js
// Labels as real <text>, never <foreignObject>. Measured: mermaid's default
    // wraps flowchart labels in foreignObject, and foreignObject is not rendered
    // at all when an SVG is loaded through <img>, so every node would come out
    // blank on the page while looking correct in a standalone viewer.
```

### scripts/build-diagrams.mjs:103 (WHY, shortened)

why layout rather than taste; the measured widths go to the history document.

```js
// Tightened from mermaid's defaults, and the reason is layout rather than
    // taste. The prose column is 44rem, so a drawing wider than about 700px is
    // scaled down by `max-width: 100%` and takes its type with it: a default
    // five-participant sequence diagram came out 1210px, which lands 16px text
    // at an effective 9px. Narrowing the gaps shrinks the drawing without
    // shrinking the text, which is the only lever that helps.
```

### scripts/build-diagrams.mjs:124 (WHY, shortened)

what an img does with no intrinsic width, and why a targeted rewrite.

```js
/**
 * Makes the SVG sizeable by an `<img>`.
 *
 * mermaid emits `width="100%"` plus an inline `max-width`. Inside an `<img>`
 * that is an SVG with no intrinsic width, and the browser falls back to the
 * default 300x150 replaced-element size instead of the drawing's own. The
 * viewBox already carries the real size, so it is copied onto the root and the
 * `max-width` that would fight `app.css` is dropped.
 *
 * Done with a targeted rewrite of the ROOT TAG rather than by parsing and
 * re-serialising: an `.svg` file is served as XML and parsed strictly, so a
 * serialiser that emits one unclosed tag produces a file that renders as
 * nothing.
 *
 * @param {string} svg
 * @param {string} label
 */
```

### scripts/build-diagrams.mjs:160 (CONTRACT, shortened)

the three reasons, the first of them measured.

```js
/**
 * Renders one source at one theme.
 *
 * mermaid-cli's own `renderMermaid` against a browser this script owns, rather
 * than the `mmdc` command. Three reasons, the first of them measured here:
 *
 *   1. Node refuses to spawn the `npx.cmd` shim without `shell: true`, exiting
 *      `spawnSync npx.cmd EINVAL`, and `shell: true` concatenates an argument
 *      array WITHOUT quoting, which has already split one value containing
 *      spaces into three arguments in this repo. Temp paths on this host sit
 *      under a user directory whose name can contain anything.
 *   2. One browser serves every render instead of one launch per file.
 *   3. The source and the config never touch a temp file or a command line, so
 *      nothing can be mangled on the way in.
 *
 * @param {import("puppeteer").Browser} browser
 * @param {string} source
 * @param {"light" | "dark"} theme
 * @param {Record<string, string>} colours
 * @param {string} label
 */
```

### scripts/build-diagrams.mjs:274 (WHY, shortened)

why a write path alone is not enough.

```js
// Prune. An upsert keyed by filename leaves a deleted diagram on disk forever,
  // and the same reasoning already applies to the Ask index: the write path
  // alone is not enough, something has to remove what the corpus no longer
  // names.
```

### scripts/build-diagrams.mjs:294 (WHY, shortened)

what follows automatically and what cannot.

```js
// `public/diagrams/` is in the MEDIA INDEX now, so rendering or pruning an
  // asset here changes what `check:media` expects. Two things follow, and
  // neither should have to be remembered.
  //
  // The manifest is regenerated automatically, because it is derived from the
  // filesystem and there is no world in which a stale one is wanted. The index
  // itself cannot be: the rebuild needs the ASSETS binding and therefore runs in
  // the Worker, so this can only say so. Saying so loudly is the point: someone
  // was always going to hit this cold, halfway through a content change, with a
  // red gate and no obvious cause.
```

## scripts/lib/rss.mjs

### scripts/lib/rss.mjs:1 (CONTRACT, shortened)

why a separate process, what is counted, what the metric is and that it fails soft; the five killed runs and the dates go to the history document.

```js
/**
 * PEAK RESIDENT MEMORY OF A PROCESS TREE, sampled from outside it.
 *
 * `check:all` runs its gates with a BLOCKING `spawnSync`, so while a gate runs
 * this process cannot execute a timer, read a pipe, or do anything else. Any
 * sampler living in this event loop would therefore record nothing for exactly
 * the span it exists to measure. So the sampler is a separate process that
 * writes to a FILE, and the runner reads that file afterwards and attributes
 * each sample to whichever gate owned the clock when it was taken.
 *
 * ## WHY THIS EXISTS
 *
 * Five `check:all` runs were killed by the OS for low memory between 2026-09-05
 * and 2026-09-09, one of them taking the machine down with it. Every diagnosis
 * of those runs was an inference from which gate happened to be printing when
 * the run died. A gate that is merely SLOW and a gate that is holding a
 * gigabyte look identical in a log of gate names and durations, and the tier
 * had no instrument that could tell them apart.
 *
 * ## WHAT IS COUNTED, STATED PLAINLY
 *
 * The whole descendant tree of `rootPid`, plus `rootPid` itself, summed. That
 * includes the runner's own resident set (roughly 60 MB), so a gate's figure is
 * the tier's total while that gate ran, not the gate in isolation. Reporting
 * the total is the honest form: the number that matters for an out-of-memory
 * kill is what the machine was holding, and subtracting a baseline would invent
 * a figure nothing measured.
 *
 * WorkingSetSize is what Windows reports as resident, which is the quantity the
 * memory manager acts on. It is not the same as committed or virtual size, and
 * a process paged out shrinks here without having freed anything.
 *
 * ## FAILS SOFT, ALWAYS
 *
 * A sampler that cannot start, or a PowerShell that is not where it should be,
 * reports "not measured" and the tier runs exactly as before. This is an
 * instrument, not a gate: it must never be the reason a check run fails.
 * `command -v` is deliberately not consulted (presence is not capability); the
 * binary is resolved by absolute path and its absence is simply a null reading.
 */
```

### scripts/lib/rss.mjs:49 (WHY, shortened)

the bare-name trap in the other direction.

```js
/**
 * PowerShell BY ABSOLUTE PATH, never by bare name.
 *
 * `FAILURES.md`: a gate that spawns a tool by bare name is green in the shell
 * it was written in and absent in the one that ships. `check:hook-scope`
 * spawned `bash`, passed every session under the agent's git bash, and refused
 * six times at a ship step under PowerShell. The same trap is available here in
 * the other direction, so the interpreter is resolved from `SystemRoot`.
 */
```

### scripts/lib/rss.mjs:64 (CONTRACT, shortened)

why the walk is in the sampler and why it appends.

```js
/**
 * The sampling loop, as a PowerShell program.
 *
 * One `Get-CimInstance` per sample gives every process with its parent, and the
 * descendants of the root are collected by walking that map. Doing the walk in
 * the sampler rather than in node means the file already holds the answer, so a
 * reader that starts late still gets correct history.
 *
 * Appends `epochMilliseconds,bytes` per line and never truncates: a sample lost
 * to a crash is a gap, and a gap is visible, whereas a rewritten file would be
 * empty in exactly the case worth reading.
 */
```

### scripts/lib/rss.mjs:136 (WHY, shortened)

why the values are substituted; the silent no-op goes to the history document.

```js
/*
         * THE VALUES ARE SUBSTITUTED INTO THE SCRIPT, not passed after it.
         * `powershell -Command "<script>" -RootPid 123` does NOT bind those
         * into a `param()` block: they are consumed as arguments to
         * powershell.exe itself and the script sees nothing. Measured here on
         * the first run of this file, which started cleanly and wrote zero
         * samples, which is the shape a silent no-op takes.
         */
```

### scripts/lib/rss.mjs:148 (WHY, shortened)

why not detached.

```js
// DETACHED IS WRONG HERE and the reason is the bug this file is part of:
        // a detached sampler outlives a killed runner and becomes exactly the
        // orphan the memory work exists to remove. It stays a child, so the
        // runner's own tree kill takes it too.
```

### scripts/lib/rss.mjs:173 (CONTRACT, shortened)

why null rather than zero.

```js
/**
 * The peak sample inside a window, in bytes, or null when nothing was sampled.
 *
 * A window with NO samples returns null rather than 0, because zero is a
 * measurement and "nobody looked" is not. A gate faster than the sampling
 * interval legitimately lands here, and reporting 0 MB for it would be a
 * plausible number with nothing behind it.
 *
 * @param {string} outPath
 * @param {number} fromMs inclusive, epoch milliseconds
 * @param {number} toMs inclusive, epoch milliseconds
 * @returns {number | null}
 */
```

### scripts/lib/rss.mjs:216 (CONTRACT, shortened)

why the sampler is the oracle, and why pids not names; the measured browser count goes to the history document.

```js
/**
 * THE PIDS OF THE MOST RECENT SAMPLED TREE, excluding the runner itself.
 *
 * The sampler already walks the descendant tree every tick to sum it, so it
 * writes the membership beside the total and this reads it back. That makes the
 * sampler the tree ORACLE as well as the meter, which matters because
 * `spawnSync` blocks the runner: while a gate runs, this process cannot
 * enumerate anything, and after the gate returns its grandchildren are exactly
 * the processes nobody recorded.
 *
 * PIDS, NEVER NAMES. A sweep matching `node` or `chrome` by name on this
 * machine would reach Dustin's own browser and editor, which is not a cleanup,
 * it is an outage. Measured 2026-09-09: a bare name match over this host
 * selects 18 Chrome processes belonging to the user's own session.
 *
 * A pid is only meaningful while it is alive, and Windows reuses them, so a
 * caller kills only what it can still see and treats an absent pid as done.
 *
 * @param {string} outPath
 * @returns {number[]}
 */
```

### scripts/lib/rss.mjs:259 (CONTRACT, shortened)

what a single sample misses, why a window and what the residual is; the killed run's figures go to the history document.

```js
/**
 * EVERY PID SEEN IN THE LAST `windowMs` OF SAMPLING, as one set.
 *
 * `lastTree` reads a single sample, which is right for "what is the tree right
 * now" and WRONG for cleaning up after a run that died. Measured 2026-09-09,
 * and it is why this function exists: a `check:all` run exhausted the machine,
 * 14 processes holding 1678 MB survived it, and the final sample named two of
 * them. The heavy ones had been spawned by `check:head` minutes earlier and
 * were still resident; they were simply not in the last row.
 *
 * ## WHY A WINDOW RATHER THAN THE WHOLE FILE
 *
 * WINDOWS REUSES PIDS. A pid seen at the start of a twenty minute run may
 * belong to something else entirely by the end, and this list is fed to a
 * KILL. The window is anchored to the LAST sample rather than to the clock,
 * because the interesting case is a file written by a run that died a while
 * ago: what matters is what was alive as that run ended, not how long ago the
 * ending was.
 *
 * The window is a bound on the risk, not a proof against it. A caller kills
 * only pids that are still alive, and the residual case, a pid reused inside
 * the window by an unrelated process, is accepted and stated rather than
 * hidden. The alternative, matching on process NAMES, is worse by a wide
 * margin: on this machine it selects the user's own browser and editor.
 *
 * @param {string} outPath
 * @param {number} windowMs how far back from the last sample to gather
 * @returns {number[]}
 */
```

## scripts/lib/strip-comments.mjs

### scripts/lib/strip-comments.mjs:1 (CONTRACT, shortened)

the trap, the drift-in-strength argument, that the old boundary moved, why the weak forms stay and what is not this job; the six victims, the measurements and the dates go to the history document.

```js
/**
 * THE JS-SCAN COMMENT STRIPPER, in one place.
 *
 * ## What this is for, and the trap every gate here has hit
 *
 * A gate that searches source for a literal will find that literal in the PROSE
 * explaining why it is forbidden. check:logo, check:contrast, check:features,
 * check:headers, check:urls and check:secrets have each hit this, and one of
 * them passed every row for the wrong reason. Stripping comments before
 * matching is hard rule 10's discipline, and it was implemented nine times.
 *
 * Nine copies of one job can drift in STRENGTH, which is the whole risk: a copy
 * that is weaker than its siblings does not fail, it passes for a reason nobody
 * checks.
 *
 * ## IT IS A TOKENIZER, SINCE 2026-08-28, AND THE OLD BOUNDARY MOVED WITH IT
 *
 * This removed comments with a regex and carried a colon guard on line
 * comments, so `https://` inside a string was not read as one. That guard was
 * load-bearing and it was also the shape of the boundary: it could not protect
 * a PROTOCOL-RELATIVE url, `"//cdn.example.com/x"`, whose slashes follow a
 * quote. Feeding this JSONC or SVG destroyed the value and the rest of its
 * line, measured on 2026-08-23 and asserted in the tests.
 *
 * **THAT IS NO LONGER TRUE, AND THE TESTS NOW ASSERT THE OPPOSITE.** A string
 * literal is consumed whole before any slash inside it is considered, so the
 * colon guard is gone because nothing needs it: a `//` reaching the comment
 * branch is in code. MEASURED 2026-08-28: the JSONC fixture parses and keeps
 * its url, and the SVG fixture keeps its href and the rest of the line.
 *
 * A boundary note is a claim that ages, per hard rule 7, and this one aged in
 * the commit that changed the mechanism under it.
 *
 * ## THE WEAK FORMS STAY ANYWAY, on a narrower argument
 *
 * Three JSONC readers and check:logo's SVG path keep their own weak strippers.
 * The measured hazard is gone, so what is left is that THIS IS A JAVASCRIPT
 * TOKENIZER: it reads an apostrophe in SVG text content as opening a string,
 * and a slash after an operator-looking character as opening a regex, neither
 * of which means anything in those formats. On today's fixtures neither costs
 * anything, so moving a weak reader onto this one is a decision that needs a
 * measurement rather than a tidy-up.
 *
 * ## JOBS THAT ARE NOT THIS JOB
 *
 * `app/lib/media/template-refs.mjs` is string-aware; `check-urls.mjs` strips
 * blocks only, on purpose, because it needs `//host` inside strings to survive;
 * `check-contrast.mjs` and `scripts/lib/tokens.mjs` are CSS, where `//` is
 * never a comment. Unifying different jobs is the wrong cut and is not done
 * here.
 *
 * @see test/strip-comments.test.mjs
 */
```

### scripts/lib/strip-comments.mjs:55 (CONTRACT, shortened)

why one pass, what it understands, the regex heuristic and the unterminated rule; both dated rewrites and the measured counts go to the history document.

```js
/**
 * ONE LEFT-TO-RIGHT PASS, and both exported functions are it.
 *
 * ## WHY ONE PASS, TWICE OVER
 *
 * "Is this a comment opener" is a question about everything to its left, and no
 * number of independent regex passes can answer it. This module learned that
 * twice before it learned it properly:
 *
 *   2026-08-26  `stripCommentsAndStrings` blanked strings in three regex passes,
 *               so two apostrophes inside DOUBLE-quoted labels paired up and the
 *               single-quote pass swallowed the lines between them. Fixed with a
 *               one-pass tokenizer, in that function alone.
 *   2026-08-28  `stripComments` still removed comments with a regex, so a `/`
 *               followed by a star INSIDE a string opened a comment running to
 *               the next star-slash anywhere in the file. Measured at HEAD: 347
 *               string literals across 37 files carry one of those sequences.
 *
 * The second fix could not live in `stripComments` alone, and the differential
 * is what said so. `stripCommentsAndStrings` calls it and then ran its OWN
 * string tokenizer, which does not understand REGEX LITERALS: once comments
 * stopped mangling them, quotes inside character classes survived into the
 * second pass and mispaired there. So there is one tokenizer now, and blanking
 * strings is a flag on it.
 *
 * ## WHAT IT UNDERSTANDS
 *
 * String literals in all three quotes, escapes honoured. Block and line
 * comments. Regex literals, including a slash inside a character class, which
 * `/[/]/` legally contains.
 *
 * A `/` opens a regex when the previous significant character cannot END an
 * expression. That is the standard heuristic rather than a parser, and it is
 * wrong only for a division whose left operand ends in an operator, which is
 * not a thing valid code does. **It was adopted on a MEASUREMENT rather than on
 * the argument:** without it, `check-llms.mjs` line 97, `/...["']...["']/`, hid
 * six assertion calls from `check:invariants` section 17, in the gate that
 * exists to catch invisible assertions.
 *
 * An UNTERMINATED literal of any kind is emitted verbatim to the end of the
 * file rather than swallowing it. A source that does not parse is a different
 * problem, and eating the remainder is the failure this module exists to
 * remove.
 *
 * @param {string} source
 * @param {{ preserveLines?: boolean, blankStrings?: boolean }} options
 * @returns {string}
 */
```

### scripts/lib/strip-comments.mjs:149 (WHY, shortened)

why the newlines are kept.

```js
/*
       * BLANKED TO `""` PLUS THE NEWLINES IT SPANNED. Section 17 reports a file
       * and a LINE computed from this text, and a multi-line template
       * collapsing to two characters moved every line after it.
       */
```

### scripts/lib/strip-comments.mjs:199 (WHY, shortened)

why the guard is gone.

```js
/*
     * A line comment. The colon guard is GONE and is not needed: it existed so
     * a `https://` inside a string was not read as a comment, and a string is
     * consumed whole by the branch above. A `//` reaching here is in code.
     */
```

### scripts/lib/strip-comments.mjs:218 (CONTRACT, shortened)

what the option is for; the gate that learned it goes to the history document.

```js
/**
 * Comments out, strings kept.
 *
 * `preserveLines` replaces a block comment with the NEWLINES IT SPANNED rather
 * than a space, so a multi-line anchor still matches across code that had a
 * comment between its lines and reported line numbers do not shift.
 * check:assertions learned that the expensive way when collapsing comments
 * moved every line it reported.
 *
 * @param {string} source
 * @param {{ preserveLines?: boolean }} [options]
 * @returns {string}
 */
```

### scripts/lib/strip-comments.mjs:235 (CONTRACT, shortened)

who needs it and why it is the same tokenizer.

```js
/**
 * Comments out, STRING LITERALS BLANKED TO `""` as well.
 *
 * Two gates need this and both need it for the same reason: they search for
 * names that also appear inside ordinary strings. check:invariants quotes the
 * very patterns it hunts, so it would flag itself; check:secrets reads files
 * that name their own configuration flags in user-facing copy.
 *
 * The same tokenizer, with the strings blanked instead of copied. It used to be
 * a separate implementation that ran AFTER `stripComments`, which is how the
 * two disagreed about regex literals; the header on `scan` records what that
 * cost and how it was measured.
 *
 * @param {string} source
 * @returns {string}
 */
```

## scripts/check-diagrams.mjs

### scripts/check-diagrams.mjs:1 (CONTRACT, shortened)

the boundary, what no other gate can catch and the three sections; the sibling-gate comparison and the plant instructions go to the history document.

```js
/**
 * Gate over the `:::diagram` directive and the assets it references.
 *
 * OBSERVATION BOUNDARY: the contract, asset coverage and a colour audit over
 * committed bytes. It does NOT run mermaid and does not open a browser, so a
 * diagram that renders as tangled spaghetti passes as long as its key, its alt
 * and its colours are right.
 *
 *   npm run check:diagrams
 *
 * It imports `app/lib/content/diagram.mjs`, the module the Worker imports, on
 * the same principle as `check:search` and `query.mjs`. No Chromium, no network,
 * no database: mermaid is not run here, because rendering is not the property
 * this gate exists to protect.
 *
 * `check:content` already catches a diagram REFERENCE that drifted, because the
 * key is a pure function of the source and rides in the gated artifact. What it
 * cannot catch is the thing that reference points at. A key that changed while
 * the asset did not is a broken image in the middle of an article, and it is
 * invisible to every other gate: the artifact is internally consistent, the
 * typecheck passes, and the page renders. Three sections, in that order:
 *
 *   1. The contract. Mandatory alt, source required, deterministic keys, the
 *      figure structure, and the token map naming only tokens that exist in both
 *      theme blocks. Every rule paired with its negative.
 *   2. Coverage. Every key the corpus references has both assets on disk, and no
 *      asset on disk is unreferenced.
 *   3. Colour. Every committed asset audited against the palette its theme
 *      resolves to, through the same module `build:diagrams` audits with.
 *
 * A gate that has never been observed failing has not been verified. Plant the
 * violation and watch it fail: remove the alt check in diagram.mjs, delete an
 * SVG from public/diagrams, or hand-edit a colour in one.
 */
```

### scripts/check-diagrams.mjs:85 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------------------------------
 * 1. The contract
 * ---------------------------------------------------------------------- */
```

### scripts/check-diagrams.mjs:89 (WHY, shortened)

what the fail-closed rule would do otherwise; the ruling date goes to the history document.

```js
// The directive has to be KNOWN, or the fail-closed unknown-directive rule
// rejects the syntax this module implements. Ruled 2026-07-30: adding a
// directive means adding it to that list in the same commit.
```

### scripts/check-diagrams.mjs:94 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- alt, and its negative -----------------------------------------------
```

### scripts/check-diagrams.mjs:110 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- source, and its negative --------------------------------------------
```

### scripts/check-diagrams.mjs:121 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- keys ------------------------------------------------------------------
```

### scripts/check-diagrams.mjs:128 (WHY, shortened)

what a line-ending-dependent key would do.

```js
// The repo checks content out as LF and everything else as CRLF, so a key that
// depended on line endings would differ between a Windows and a Linux clone and
// each would believe the other's asset was missing.
```

### scripts/check-diagrams.mjs:144 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// --- the emitted structure -------------------------------------------------
```

### scripts/check-diagrams.mjs:159 (CONTRACT, shortened)

which element carries the name and why no override.

```js
// The corrected contract in chart-stack.md names the element that IS the
  // graphic, never the figure. For an <img> that name is `alt`, and role="img"
  // plus aria-label would be a redundant override of a native mechanism.
```

### scripts/check-diagrams.mjs:179 (WHY, shortened)

why no dimensions are emitted.

```js
// No width or height: the pipeline may not touch the filesystem and the asset
  // legitimately may not exist yet, so there is nothing honest to measure.
```

### scripts/check-diagrams.mjs:203 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------------------------------
 * 2. The token map
 * ---------------------------------------------------------------------- */
```

### scripts/check-diagrams.mjs:215 (WHY, shortened)

what a token missing from one block resolves to.

```js
// Both theme blocks land on the same element, so they do not cascade into one
  // another: a token declared in light and forgotten in dark keeps its LIGHT
  // value. A diagram would then be drawn in light colours on a dark page.
```

### scripts/check-diagrams.mjs:226 (CONTRACT, shortened)

why the same call and why the throw is caught.

```js
/**
 * Resolution is the same call `build:diagrams` makes, so a map this gate accepts
 * is a map that renders. It THROWS on a bad token rather than returning, which
 * would exit non-zero with a stack trace instead of a named failure, so it is
 * caught here and reported like every other assertion.
 *
 * @param {"light" | "dark"} theme
 */
```

### scripts/check-diagrams.mjs:252 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------------------------------
 * 3. Coverage and colour over what is actually committed
 * ---------------------------------------------------------------------- */
```

### scripts/check-diagrams.mjs:320 (NUMBER, shortened)

what the executed floor cannot see and why these are set differently; the sweep, the measurement and its date go to the history document.

```js
/*
   * SCOPE FLOORS, added by the 2026-08-24 floor sweep. Both counts were
   * PRINTED and neither was asserted, which is the shape this repo keeps
   * paying for: a number on the console that no run can fail on.
   *
   * The key-integrity, token-audit and on-disk loops above all iterate one of
   * these two collections. An `artifact.posts` that parsed to nothing, or a
   * `post.diagrams` that stopped being populated, empties `referenced` and
   * every one of those loops reports a clean sweep over zero items. The
   * executed-count floor at the end of the file cannot see it: the per-diagram
   * assertions are a small share of the total, so the corpus can collapse
   * entirely while the count stays over its floor.
   *
   * MEASURED THROUGH THIS GATE 2026-08-24 by running it: 3 referenced, 6 on
   * disk. **These are the one place in the sweep where the floor is not set
   * just under the measurement, and the reason is stated rather than left to
   * look like slack: these counts are CONTENT, not scope.** A post may
   * legitimately drop a diagram, and a floor that fails on that is a gate
   * telling an author what to write. What these must catch is the walk
   * collapsing, so they sit low enough to permit an editorial change and high
   * enough that zero and near-zero fail.
   */
```

### scripts/check-diagrams.mjs:350 (NUMBER, shortened)

why almost every assertion is inside a discovered loop; the measurement and its date go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate walks committed SVG assets and audits the colours reachable through
 * the cascade. Almost every assertion sits inside a loop over a discovered set,
 * so an empty discovery, a changed extension or a renamed directory all report
 * a clean audit of nothing.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 409.
 * Never summed. Floored at 380, roughly 7 percent: the count scales with the
 * committed diagrams and the rules reachable inside each, so it steps sharply
 * when a diagram is added and should not drift otherwise.
 */
```

## scripts/check-design-sheets.mjs

### scripts/check-design-sheets.mjs:1 (CONTRACT, shortened)

the defect a written prediction did not prevent, both directions, what is not here, the two import forms and the one exclusion; the quoted notes and the sheet names go to the history document.

```js
/**
 * Gate: `SHEETS` in `.design-sync/build-inputs.mjs` matches the stylesheets the
 * public plane actually loads.
 *
 * ## THE DEFECT, AND NOTES.md PREDICTED IT IN WRITING
 *
 * `.design-sync/NOTES.md` says, under Re-sync risks:
 *
 *   "The stylesheet list in build-inputs.mjs is hand-maintained and will go
 *   stale. A sheet added to app/root.tsx or to a public route does not appear
 *   here on its own. Diff SHEETS against root.tsx's imports and the non-admin
 *   app/routes/*.tsx imports before trusting a re-sync."
 *
 * Nobody ran that diff. `app/styles/shell.css` was imported by `app/root.tsx`
 * and absent from `SHEETS`, so it never reached `ds-styles.css`, never reached
 * `_ds_bundle.css`, and never reached the canvas. That sheet DEFINES `.tracks`
 * and carries the "NAMED `.tracks`, NOT `.page`" reasoning (ruling 99), so the
 * design agent was redesigning against a grid class it had never been shown.
 * Ruling 111 turned the sentence into this instrument.
 *
 * A prediction written in prose is a prediction nothing re-checks. That is the
 * same shape as the carried-token map's build-4 deadline and vol 18's freeze
 * point: a rule enforced by whoever happens to read it.
 *
 * ## OFFLINE TIER
 *
 * It reads `.design-sync/build-inputs.mjs`, `app/root.tsx`, `app/routes/*.tsx`
 * and the stylesheets they name, all off disk. No network, no binding, no
 * clock. A clean checkout can run it, so `--ci` does too.
 *
 * ## BOTH DIRECTIONS, because one of them is the silent one
 *
 * A sheet LOADED but not SYNCED is the defect above: the canvas designs blind
 * and nothing says so. A sheet SYNCED but no longer LOADED is the quieter one:
 * the bundle carries rules the site has stopped applying, so the canvas is
 * told about a surface that no longer exists. Neither direction reports
 * itself, so both are asserted here.
 *
 * ## WHAT IS DELIBERATELY NOT HERE
 *
 * No copy of the sheet list. `SHEETS` is parsed out of `build-inputs.mjs`,
 * which stays its one owner (hard rule 17): a mirror here would be a second
 * list to keep in step, which is the very failure being gated.
 *
 * CASCADE ORDER is checked for the root-imported sheets only. NOTES.md:
 * "Cascade order is load-bearing and is not alphabetical. SHEETS reproduces
 * root.tsx's deliberate order; sorting it would move the cascade." Across
 * ROUTES there is no defined order -- route sheets load after the root
 * module's and no two routes race -- so ordering is asserted exactly where the
 * repo defines one and nowhere else.
 *
 * COMMENTS ARE STRIPPED BEFORE MATCHING, and this is not hygiene. `app.css`
 * line 1937 carries prose about having removed `@import "tailwindcss"`, and
 * the converter's own validator failed that sentence twice as a missing
 * import (NOTES.md, converter defect 3). A gate that matched it would inherit
 * the identical bug -- hard rule 10, "strip comments before matching".
 *
 * ## TWO WAYS A SHEET REACHES A READER, and the first draft knew only one
 *
 * A bare `import "./x.css";` joins the bundled cascade. A `?url` side-load
 * (`import href from "~/styles/x.css?url"`) ships the sheet as its own file
 * that a component links at the point of use. Both reach readers; only the
 * first has a cascade POSITION.
 *
 * Scanning only the cascade form reported `palette-dialog.css` as orphaned:
 * `app/components/search-trigger.tsx` side-loads it, and `ask.css` beside it.
 * That was this gate failing, not the repo -- so the scan covers components
 * and counts both forms, and only cascade imports from root.tsx are ordered.
 *
 * ## THE ONE EXCLUSION IS NOTES.md's, NOT THIS FILE'S
 *
 * `katex.generated.css` is side-loaded by root.tsx and is deliberately out of
 * sync scope: NOTES.md excludes `katex*` as "a generated artifact carrying
 * twenty font faces whose binaries would have to ship too". It is named here
 * as ONE path rather than a prefix, because an exclusion written as a pattern
 * excludes everything that ever matches it (hard rule 10, "enumerate inside
 * exclusions"), and the scope assertion below refuses a list that has grown.
 */
```

### scripts/check-design-sheets.mjs:92 (CONTRACT, shortened)

exact paths, and who owns the decision.

```js
/**
 * Sheets the public plane loads that the sync deliberately does not carry.
 * Exact paths, never prefixes. Grounds live in NOTES.md, which owns the
 * decision; this list only has to stay short enough to read.
 */
```

### scripts/check-design-sheets.mjs:100 (NUMBER, shortened)

the zero-scope rule with its citation, in two lines.

```js
/**
 * Below these the scan has stopped reading rather than found a clean tree. A
 * search over an empty scope reports what a clean sweep reports (hard rule 10),
 * so each is asserted before any conclusion is drawn from a count.
 */
```

### scripts/check-design-sheets.mjs:232 (CONTRACT, shortened)

why it is a type predicate.

```js
/**
   * A path this gate is responsible for. Narrows away null so every caller
   * downstream has a string, which is the same reason it is a type predicate
   * rather than a plain boolean.
   * @param {string | null} sheet @returns {sheet is string}
   */
```

### scripts/check-design-sheets.mjs:305 (CONTRACT, shortened)

which sheets are ordered and which are not.

```js
// Cascade order, for the sheets root.tsx names. SHEETS must list them in the
  // same relative order; entries root.tsx does not import (reset.css arrives by
  // @import, route sheets by their routes) are not constrained here.
```

## scripts/build-assets.mjs

### scripts/build-assets.mjs:1 (CONTRACT, shortened)

why a Worker cannot list its assets, why the placeholder is here and why D1's is not a duplicate; the finding reference and the dimensions precedent go to the history document.

```js
/**
 * Enumerates `public/` into a committed manifest.
 *
 *   npm run build:assets
 *
 * **This exists because a Worker cannot list its own static assets.** The assets
 * binding has exactly one method, `fetch()`, so `env.ASSETS` can serve any path
 * it is given and can discover none of them. The media rebuild runs in the
 * Worker (every binding it needs is real there: MEDIA, IMAGES, ASSETS, DB), so
 * the one thing it cannot do for itself is find out which static files exist.
 * This hands it that list.
 *
 * Same shape as `content/generated/posts.json`: a generated artifact, committed,
 * and reconciled by a gate. Bytes, mime and dimensions are derived by the
 * rebuild from the actual file, so putting them here would create a second copy
 * to go stale for no gain.
 *
 * `check:content` compares this against the filesystem, so a stale manifest is
 * named as a stale manifest rather than surfacing later as a confusing D1 diff.
 *
 * ## IT CARRIES ONE DERIVED VALUE, THE BODY PLACEHOLDER, AND WHY
 *
 * It carried paths only until 2026-09-06. The exception is the LQIP the markdown
 * pipeline writes onto a static content image, and it is here because of finding
 * B002: the rendered HTML is a GATED ARTIFACT, so whatever the Worker bakes into
 * it the Node build has to bake in too, from a clone, with no bindings and no
 * network. A placeholder is neither derivable from the src (the way `srcset` is)
 * nor readable from the same store by both writers (the Worker cannot run this
 * encoder and Node cannot call the Images binding). A committed artifact both
 * resolvers read is the only shape that satisfies both, and it is the same
 * answer the dimensions arrived at when they moved into the key.
 *
 * **The placeholder D1 holds for the same file is NOT this one, and that is not
 * a duplicate fact.** The media rebuild derives its own through the Images
 * binding, for the admin library, under rule 18: the index is a projection of
 * what exists. This one is an input to a gated build artifact. Two consumers,
 * two derivation paths, and neither can serve the other: the rebuild runs in a
 * Worker with no sharp, and the build runs in Node with no binding.
 *
 * `/media/` KEYS ARE EXCLUDED, here and in `rehypeImageSources`. An uploaded
 * object is not in the repository, so no build could derive one; the exclusion
 * is written where a reader of the plugin will meet it.
 */
```

### scripts/build-assets.mjs:57 (CONTRACT, shortened)

which spelling is derived from which, and why.

```js
/**
 * The same file `manifest.mjs` names, spelled for this platform's filesystem.
 *
 * DERIVED, in this direction only. The repo path is POSIX because the Worker
 * hands it to the GitHub contents API verbatim; a Windows `path.join` result
 * would 404 there in a way that reads like a missing artifact. Splitting a
 * POSIX path and rejoining it is correct on both platforms, so the one stated
 * constant is the one that cannot be derived from the other.
 */
```

### scripts/build-assets.mjs:68 (CONTRACT, shortened)

why sorted and why the exclusion is inside the walk.

```js
/**
 * Every file under `public/`, as site-absolute paths, sorted.
 *
 * Sorted so the artifact is stable: an unordered directory read would rewrite
 * the file on a machine whose filesystem enumerates differently, and a generated
 * artifact that churns cannot be byte-compared by anything.
 *
 * Minus the named non-assets in `classify.mjs`. The exclusion is applied HERE,
 * inside the walk, rather than in main(): `check:media` imports this function and
 * diffs what it returns against D1, so an exclusion applied only to the manifest
 * would make the gate demand a row for a file the manifest deliberately omits.
 * One set, both readers.
 *
 * @param {string} [dir]
 * @returns {Promise<string[]>}
 */
```

### scripts/build-assets.mjs:98 (WHY, shortened)

why skipping is never a fallthrough.

```js
// Named non-assets only. Anything else unrecognised stays in the list and
    // meets classify(), which throws. Skipping is a decision someone made by
    // name, never a fallthrough.
```

### scripts/build-assets.mjs:107 (CONTRACT, shortened)

what the narrowing is, why derived and what the gate asserts.

```js
/**
 * The paths that get a body placeholder: raster images a post can put in prose.
 *
 * `role === "content"` is the narrowing, and it is `classify.mjs`'s answer
 * rather than a second rule written here. An icon is fetched by the browser
 * from a `<link>`, a brand asset by application code, a diagram by the directive
 * that owns its light and dark pair; none of the three reaches
 * `rehypeImageSources`, and deriving placeholders for them would be twenty
 * kilobytes of manifest nothing reads.
 *
 * DERIVED, never hand-listed, so a content image added to `public/` gets one by
 * existing. `check:content` asserts this set against the manifest in both
 * directions, which is what makes "somebody forgot to re-run the build" a red
 * gate rather than an image that quietly renders without a placeholder.
 *
 * @param {string[]} paths
 */
```

### scripts/build-assets.mjs:131 (CONTRACT, shortened)

what the digest makes checkable and why it does not re-encode.

```js
/**
 * One placeholder, plus the digest of the bytes it was derived FROM.
 *
 * The digest is what makes the entry checkable. Membership alone catches a file
 * added or deleted and cannot see a file EDITED IN PLACE, which is the one way
 * a static asset changes: `public/` paths are not content addressed, so the same
 * path can hold different bytes tomorrow. `check:content` re-hashes the file
 * and compares, which is cheap, deterministic and platform independent.
 *
 * IT DOES NOT RE-ENCODE TO COMPARE, deliberately. Two machines running the same
 * pinned sharp can differ by a byte in an encoder, and a gate that fails on
 * Linux and passes on Windows gets turned off. The source digest answers "is
 * this entry stale" without asserting anything about the encoder that produced
 * it; that the stored value IS a lossy WebP data URI is asserted separately,
 * through the same function `check:image-weight` uses on the D1 column.
 *
 * @param {string} sitePath
 * @returns {Promise<{ sha: string, lqip: string }>}
 */
```

### scripts/build-assets.mjs:168 (WHY, shortened)

why classification happens here.

```js
// Classify every path here rather than at rebuild time, so an unclassified
  // extension stops THIS build with a clear message instead of failing inside a
  // Worker where the only symptom would be a missing row.
```

## scripts/check-hook-syntax.mjs

### scripts/check-hook-syntax.mjs:1 (CONTRACT, shortened)

the outage, why no other gate sees it, what is asserted, why the interpreters are resolved and both boundary halves; the dated incidents and the line reference go to the history document.

```js
/**
 * Gate: every hook PARSES, in both languages it is written in.
 *
 *   npm run check:hook-syntax
 *
 * ## Why this exists
 *
 * TWICE ON 2026-09-05 a hook was broken by an apostrophe. The checkers are
 * embedded in the shell script as SINGLE-QUOTED strings, so one apostrophe
 * inside the Python ends the string, hands the remainder of the program to bash
 * as commands, and the hook then refuses every call in the session with a shell
 * error. `no-direct-deploy.sh` carries the scar in a comment at its own line
 * 159.
 *
 * A broken hook fails in the WORST direction available. These are PreToolUse
 * guards: the session stops being able to work, or, when the breakage is in the
 * arm rather than the parser, the guard silently stops guarding. Neither is
 * visible to any other gate, because every other gate reads `app/`, `scripts/`
 * or `workers/`, and nothing reads `.claude/hooks/` as CODE. `check:hook-scope`
 * comes closest and is deliberately narrower: it replays ONE hook's decisions
 * and would not notice the other five failing to parse.
 *
 * ## WHAT IS ASSERTED
 *
 *   `bash -n` on every hook. Parse only, nothing executed.
 *   Every embedded Python checker string COMPILES, via `ast.parse`.
 *
 * Both interpreters are RESOLVED rather than named, through
 * `scripts/lib/bash.mjs` and `scripts/lib/python.mjs`. Measured 2026-09-05:
 * neither `bash` nor `python3` is on PATH in the PowerShell that runs `ship`,
 * and both are in the git bash a session runs. A gate naming either would be
 * green here and absent there.
 *
 * ## OBSERVATION BOUNDARY
 *
 * **PARSING IS NOT BEHAVING.** A hook that parses can still block the wrong
 * command, allow the right one, or read the wrong field off the payload.
 * `check:hook-scope` is the gate that drives real payloads through a real hook
 * and reads exit codes, and it covers ONE hook. The other five have their
 * syntax checked here and their behaviour checked nowhere, which is a real gap
 * and is stated rather than papered over.
 *
 * It also cannot see whether a hook is REGISTERED. `.claude/settings.json`
 * decides that, and hard rule 15 puts that file off limits to an agent, so an
 * unregistered hook parses cleanly here and protects nothing.
 *
 * FAILS CLOSED. No hooks found, no interpreter, or an unreadable file is a
 * failure, never a skip.
 */
```

### scripts/check-hook-syntax.mjs:77 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ---------------------------------------------------- the scope, asserted --- */
```

### scripts/check-hook-syntax.mjs:98 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------- interpreters, first --- */
```

### scripts/check-hook-syntax.mjs:120 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------ 1. bash -n each ----- */
```

### scripts/check-hook-syntax.mjs:143 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------- 2. the embedded Python, resolved not named -- */
```

### scripts/check-hook-syntax.mjs:145 (WHY, shortened)

why a spelling scan finds nothing, with its citation.

```js
/**
 * THE EXTRACTOR RESOLVES BINDINGS RATHER THAN SPELLINGS, hard rule 10.
 *
 * NOT ONE of these hooks contains the literal text `python3 -c`. Every one of
 * them probes three candidates into a variable and then calls `"$PY" -c`, so a
 * scan for the obvious spelling finds ZERO embedded checkers and, without the
 * floor below, reports a clean sweep of a file set it never opened.
 *
 * So the python-bearing tokens are HARVESTED from each file: the candidate loop
 * variable, anything assigned from it, and the bare interpreter names.
 *
 * @param {string} source
 * @returns {string[]} the token spellings that invoke Python in this file
 */
```

### scripts/check-hook-syntax.mjs:181 (CONTRACT, shortened)

why the body pattern is exact and what `after` proves.

```js
/**
 * Every `<python> -c '<source>'` in one file.
 *
 * The body is `[^']*` and that is EXACT rather than lazy: a POSIX single-quoted
 * string cannot contain an apostrophe, which is the entire reason the outage
 * happened. So this captures precisely what the shell would hand the
 * interpreter, including the truncation an apostrophe causes. A planted
 * apostrophe therefore surfaces here as Python that no longer parses, or at
 * `bash -n` above as an unterminated string, and both name the file.
 *
 * `after` is everything following the closing quote, which is what proves the
 * string ended where the shell thinks it did. See ALLOWED_AFTER.
 *
 * @param {string} source
 * @returns {{ code: string, after: string }[]}
 */
```

### scripts/check-hook-syntax.mjs:209 (WHY, shortened)

the plant that PASSED both assertions, and what catches it; the planted line and the date go to the history document.

```js
/**
 * What may legitimately follow the closing quote of a `-c '...'` string.
 *
 * ## WHY COMPILING THE BODY IS NOT ENOUGH, and this was measured by a PLANT
 * ## THAT PASSED on 2026-09-05
 *
 * An apostrophe planted in a comment inside `no-em-dash.sh`'s checker read:
 *
 *     ti = d.get("tool_input") or {}  # the payload's tool_input, don't trust it
 *
 * The shell ends the single-quoted string at the apostrophe in `payload's`, so
 * the interpreter receives everything up to `# the payload`. That prefix is a
 * COMPLETE PYTHON PROGRAM whose last line is a comment, so `ast.parse` accepted
 * it. `bash -n` also exited 0, because the remaining apostrophes happened to
 * re-balance into syntactically valid, meaningless shell.
 *
 * So the hook was BROKEN in exactly the way that caused two outages, and both
 * assertions passed. The truncation is invisible from either end alone: the
 * body parses, the file parses, and only the JOIN between them is wrong.
 *
 * What catches it is asking where the string ENDED. A `-c '...'` in these hooks
 * is always followed by a command substitution's `)`, a redirection, a pipe, a
 * separator, or end of line. It is never followed by a bare word, because a
 * bare word there is the remainder of a Python program that the shell has
 * started reading as arguments.
 */
```

### scripts/check-hook-syntax.mjs:264 (WHY, shortened)

what the compile alone proves.

```js
/*
     * AND THE STRING ENDED WHERE IT SHOULD. See ALLOWED_AFTER: the body
     * compiling proves only that the PREFIX is valid Python, and a truncation
     * landing in a comment produces a valid prefix.
     */
```

### scripts/check-hook-syntax.mjs:284 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------- the floors --- */
```

### scripts/check-hook-syntax.mjs:286 (NUMBER, shortened)

why two floors and which failure each catches; the measurement and its date go to the history document.

```js
/*
 * TWO FLOORS, because the two scopes fail independently.
 *
 * The hook count catches a directory that stopped being read. The Python count
 * catches an extractor that stopped matching, which is the likelier failure:
 * the tokens are harvested by regex from shell source, and a hook rewritten to
 * call its interpreter a fourth way would silently contribute nothing.
 *
 * MEASURED 2026-09-05 by RUNNING this gate: 6 hooks, 10 Python strings (five
 * hooks carry a probe and a checker; stop-typecheck.sh carries neither).
 */
```

## scripts/build-publications.mjs

### scripts/build-publications.mjs:1 (CONTRACT, shortened)

the inputs, that it is deterministic and that the artifact is generated; the moved flag goes to the history document.

```js
/**
 * Generates app/data/publications.ts from the two source files.
 *
 * Inputs:
 *   data/publications.csl.json   canonical CSL-JSON, the bibliographic record
 *   data/publications.site.json  site-only fields, keyed by DOI as deposited
 *
 * Deterministic and offline. The network refresh that produces those two files
 * lives outside this repo in pubs-pipeline/assemble.py.
 *
 * Run: npm run build:publications
 *
 * app/data/publications.ts is a build artifact. Do not hand-edit it.
 * `npm run check:publications` imports `generate()` from here and fails if the
 * committed module has drifted from a fresh generation, along with the rest of
 * the corpus assertions. That gate used to be this file's `--check` flag; it
 * moved out when it grew past one comparison.
 */
```

### scripts/build-publications.mjs:27 (CONTRACT, shortened)

why casefolded and what a raw join does.

```js
/**
 * DOI names are case-insensitive per the DOI spec, which folds ASCII case for
 * comparison. Store as deposited, compare casefolded. A raw-string join here
 * silently drops records rather than throwing.
 */
```

### scripts/build-publications.mjs:35 (CONTRACT, shortened)

why two classes rather than one pattern.

```js
/*
 * Punctuation that never takes a space BEFORE it, and brackets that never take
 * one after. Listed as two explicit classes rather than one clever pattern,
 * because the two rules are different facts about typography and a combined
 * regex would be unreadable at exactly the point somebody needs to check it.
 */
```

### scripts/build-publications.mjs:44 (WHY, shortened)

why the space is load-bearing, what it costs and why the order matters; the two titles and the corpus counts go to the history document.

```js
/**
 * Registry markup reduced to plain text.
 *
 * ## THE SPACE IS NOT OPTIONAL AND NEITHER IS CLEANING UP AFTER IT
 *
 * Tags are replaced with a SPACE rather than with nothing, and that rule is
 * load-bearing: the July import replaced them with nothing and turned
 * `<scp>RNA</scp>Tumour Viruses` into `RNATumour`. It is recorded as one of the
 * reasons PDF text was never trusted.
 *
 * The cost is that a tag sitting against punctuation leaves a space that was
 * never in the rendered text. MEASURED in this corpus: three TITLES and several
 * abstracts carry it, because italicised organism names are wrapped in `<i>`
 * inside parentheses. The Texas survey's title read
 *
 *     Survey of Reticuloendotheliosis Virus in Wild Turkeys ( Meleagris gallopavo) in Texas, USA
 *
 * and `citation_title` is the single field Google Scholar matches a paper on.
 * A title that differs from the published one by a space is a title that may
 * not match, and a correction takes six to nine months.
 *
 * So the space is inserted, whitespace is collapsed, and then the space is
 * removed from the two places typography never puts one. The order matters:
 * collapsing first means the cleanup sees a single space rather than a run.
 *
 * @param {string | null | undefined} value
 */
```

### scripts/build-publications.mjs:107 (CONTRACT, shortened)

why precision on deposit and why it is separate from the year; the corpus tally goes to the history document.

```js
/**
 * The publication date at WHATEVER PRECISION the registry deposited, as
 * `YYYY-MM-DD`, `YYYY-MM` or `YYYY`.
 *
 * Separate from `year`, which stays a number and stays the thing the page
 * groups and sorts by. This exists for `citation_publication_date`, which
 * Google Scholar treats as one of the three fields whose absence stops a paper
 * being indexed at all, and which is better served by a real date than by a
 * year when a real date exists.
 *
 * MEASURED across this corpus: 28 of 36 carry a full date, 6 carry year and
 * month, 2 carry only a year. So padding everything to `YYYY-01-01` would
 * invent a day for eight records, and taking the year for all of them would
 * throw away a month and a day for 28. Emitting the precision on deposit is the
 * only option that asserts nothing the registry did not.
 *
 * @param {any} record @returns {string | null}
 */
```

### scripts/build-publications.mjs:138 (CONTRACT, shortened)

why the wide dash is an escape.

```js
/*
 * A page range, written as an escape rather than as the characters.
 *
 * Crossref deposits both a plain hyphen and U+2013 as the separator. The wide
 * one is in a `\u` escape because this repo's hook refuses the literal
 * character in source, and because an invisible-width character in a character
 * class is unreviewable: a reader cannot tell a correct en dash from whatever a
 * copy and paste turned it into. Same treatment `fold()` in the route gives the
 * dash family.
 */
```

### scripts/build-publications.mjs:150 (WHY, shortened)

the trap and why a positive match; the four shapes and their counts go to the history document.

```js
/**
 * A CSL `page` split into first and last, ONLY when it really is a page range.
 *
 * ## THE TRAP, AND IT IS IN THIS CORPUS
 *
 * The obvious implementation splits on a hyphen. MEASURED across the 36
 * records, `page` takes four shapes: absent on 24, a range on 7, a bare number
 * on 3, and an ARTICLE NUMBER on 2, which are `e1004454` and `e42123`. PLoS
 * numbers articles rather than paginating them.
 *
 * A split is safe on those two only because they happen to contain no
 * separator. The rule is written as a positive match on the shape rather than
 * as a split, so a future article number carrying one cannot be read as a range,
 * and so `citation_firstpage` is emitted only where a first page exists.
 *
 * @param {string | null | undefined} page
 * @returns {{ first: string | null, last: string | null }}
 */
```

### scripts/build-publications.mjs:426 (CONTRACT, shortened)

why JSON rather than field by field.

```js
/*
     * EMITTED AS JSON, not field by field, because it is a small closed record
     * and a per-field emitter here would be a second statement of the shape
     * that update-notice.mjs owns. JSON string syntax is valid TS.
     */
```

### scripts/build-publications.mjs:446 (WHY, shortened)

why the guard exists and what the import would have done; the date and the argv aside go to the history document.

```js
/*
 * WRITES ONLY WHEN RUN DIRECTLY, since 2026-09-12.
 *
 * `--check` moved out to `scripts/check-publications.mjs`, which imports
 * `generate()` and compares. That import is the reason for this guard: the
 * bottom of this file used to call `generate()` and then WRITE at module scope,
 * so importing it for the comparison would have rewritten the very file the
 * comparison was about, and the gate would have passed by repairing its own
 * subject before looking at it. A gate that cannot fail is the tenth vacuity
 * class, reached here through an import rather than through an assertion.
 *
 * `process.argv[1]` rather than an `import.meta.main` check, which Node does
 * not have at the version this repo pins.
 */
```

## scripts/lib/r2.mjs

### scripts/lib/r2.mjs:1 (CONTRACT, shortened)

why one implementation, why a proxy and why the flag stays off the tracked config; the measured object counts go to the history document.

```js
/**
 * Listing an R2 bucket from a Node build script.
 *
 * ONE implementation, several callers, for the reason `diagram-audit.mjs` is one
 * implementation with two callers: a second copy of this would be a second place
 * for the paging to be got wrong.
 *
 * **Why a platform proxy and not the CLI.** `wrangler r2 object` has exactly
 * three verbs, `get`, `put` and `delete`. There is no `list`, so the one thing
 * a reconciler cannot do without is the one thing the CLI does not offer.
 * `getPlatformProxy` hands a Node script the same `env.MEDIA` the Worker gets,
 * over wrangler's existing OAuth, which is why nothing here needs a new API
 * token or an S3 access key.
 *
 * **`remote: true` goes on the BINDING and nowhere else.** It is what selects
 * the real bucket rather than local miniflare state; measured 2026-08-02, it is
 * the difference between reading 1 object and 13. The config carrying it is
 * built here and thrown away rather than tracked, so the flag cannot leak into
 * `wrangler.jsonc` and quietly point `npm run dev` at production R2.
 */
```

### scripts/lib/r2.mjs:28 (CONTRACT, shortened)

why it was lifted out.

```js
/**
 * Build the throwaway config that binds ONE bucket, and hand back a proxy.
 *
 * Lifted out when `downloadAllObjects` became the second caller. The `remote`
 * flag and the discard-the-config discipline are the two things this file's
 * header argues for, and a second hand-rolled copy is exactly how one of them
 * would quietly stop being true.
 *
 * @param {string} bucket @param {boolean} remote
 */
```

### scripts/lib/r2.mjs:55 (CONTRACT, shortened)

what the mirror does not cover, why size is verified and why the structure is recreated; the ruling reference goes to the history document.

```js
/**
 * Pull every object in a bucket to disk. THE ONLY COPY OUTSIDE THE ACCOUNT.
 *
 * Ruled 2026-09-01 (decisions-vol-13.md). The same-account mirror covers the
 * realistic loss, which is this site's own code deleting an object; it does
 * nothing at all for account loss or compromise. This is the answer to that,
 * and it is a chore that ends in Dustin's hands, so it is scripted rather than
 * remembered.
 *
 * **THE SIZE IS VERIFIED PER OBJECT, not just the count.** A short read writes
 * a file that exists, has a plausible name, and restores to a corrupt image. A
 * backup whose failure mode looks exactly like success is the thing this whole
 * script family is about, so every write is compared against the size R2
 * reported for the object and a mismatch is returned rather than logged.
 *
 * Keys may carry `/` (the OG cards are `og/<slug>-<hash>.png`), so the
 * directory structure is recreated rather than the separator flattened, which
 * would let two distinct keys collide on one filename.
 *
 * @param {object} options
 * @param {string} options.bucket
 * @param {string} options.destDir
 * @param {boolean} [options.remote]
 * @returns {Promise<{ downloaded: number, bytes: number, mismatched: string[] }>}
 */
```

### scripts/lib/r2.mjs:121 (CONTRACT, shortened)

why the paging is not a nicety; the shipped defect goes to the history document.

```js
/**
 * Every object under a prefix, PAGED TO THE END.
 *
 * The paging is not a nicety. This repo has already shipped a listing that
 * ignored it: `items.list()` on the Ask index returned only the first page at
 * all four call sites, and a prune reported "removed 0" for a post whose items
 * were real but sat on a later page. A lister that cannot see an object reports
 * success either way, and that is the shape of this whole class of bug.
 *
 * @param {object} options
 * @param {string} options.bucket bucket name, e.g. "dustinedwards-media"
 * @param {string} [options.prefix] "" lists the whole bucket
 * @param {boolean} [options.remote] false reads local miniflare state
 * @returns {Promise<Array<{ key: string, size: number, uploaded: string, etag: string }>>}
 */
```

### scripts/lib/r2.mjs:169 (WHY, shortened)

what is swallowed and what is deliberately not; the measured failure goes to the history document.

```js
// workerd can throw on teardown after a remote session (measured: a WSARecv
    // failure on Windows). The listing is already in hand by then, so a dispose
    // that fails must not fail the caller.
    //
    // Note what this does NOT swallow: an error thrown by `list()` itself
    // propagates out of the try above and this function never returns. That
    // distinction is the whole safety property. A caller that deletes things
    // must be able to tell "the bucket holds nothing" from "the listing did not
    // finish", and a partial listing returned as if it were total is how a
    // prune deletes live objects.
```

### scripts/lib/r2.mjs:189 (CONTRACT, shortened)

why it is separate and the two refusal rules; the dated run and its output go to the history document.

```js
/**
 * A listing a destructive caller may act on, or a refusal.
 *
 * **Why this is separate from `listAllObjects`.** On 2026-08-02 a prune run
 * printed `workerd/jsg/util.c++: WSARecv(): #64 The specified network name is no
 * longer available` in the middle of its output and carried on to report
 * "1 orphaned". It was correct that time. It would have looked EXACTLY THE SAME
 * if the listing had been cut short, and the difference between those two cases
 * is deleting one dead file or deleting eleven live ones.
 *
 * So a caller that is about to delete does not get a bare array. It states how
 * many objects it expects to still be there, and this refuses if the listing
 * cannot support that:
 *
 *   - an EMPTY listing is always a refusal. A bucket that genuinely holds
 *     nothing needs no prune, so there is no case where acting on zero is both
 *     correct and necessary.
 *   - a listing that does not contain every key the caller expects to keep means
 *     the listing is missing objects that certainly exist, so everything else it
 *     appears to be missing is unproven too.
 *
 * @param {object} options
 * @param {string} options.bucket
 * @param {string} [options.prefix]
 * @param {boolean} [options.remote]
 * @param {Set<string>} options.expected keys the caller knows must be present
 * @param {string} options.label for the message
 */
```

## scripts/measure/deps.mjs

### scripts/measure/deps.mjs:1 (CONTRACT, shortened)

that it is not a gate, what each column is measured with and why there is no byte column; the stale counts and the build timings go to the history document.

```js
/**
 * Dependency lean-out measurement. REPORTS, never changes anything.
 *
 *   node scripts/measure/deps.mjs
 *   node scripts/measure/deps.mjs --json
 *
 * ## NOT A GATE, AND DELIBERATELY NOT IN `scripts/`
 *
 * It lives under `scripts/measure/` because `check-all.mjs` derives the gate
 * list from package.json's `check:*` scripts, and this has no `check:` script
 * and no floor. It asserts nothing and cannot fail a build. It exists so the
 * next dependency session re-measures rather than re-reads a stale table: the
 * queued item that produced it carried counts from 2026-09-06 that were already
 * wrong by the time it ran (50 direct against a real 51).
 *
 * ## WHAT EACH COLUMN IS MEASURED WITH, because the methods differ in strength
 *
 *   pin          package.json, verbatim. The repo pins exact by policy.
 *   kind         which dependency block it sits in. NOT where it is used;
 *                the `used` column is what says that, and the two disagreeing
 *                is one of the findings this script exists to surface.
 *   transitive   distinct packages reachable from it in `npm ls --all --json`,
 *                excluding itself. Counted over the REAL install, so it is the
 *                tree that exists rather than what the lockfile would resolve.
 *   disk         the package's OWN directory, recursively. NOT its unique
 *                subtree: npm hoists, so a transitive dependency shared by
 *                three parents sits once at the top level and belongs to none
 *                of them. A "unique subtree" number would double-count across
 *                rows and sum to more than node_modules. Stated rather than
 *                computed wrong.
 *   used         the first import site found in app/, workers/, scripts/ or
 *                test/, with file and line, or NOTHING IMPORTS IT.
 *   reach        derived from `used`: does any importer ship in the Worker.
 *
 * ## WHY THERE IS NO PER-PACKAGE BYTE COLUMN
 *
 * Because there is no honest way to fill one from a single build here, and a
 * number in that column would be believed. Measured 2026-09-11: the Worker
 * build emits 24 minified chunks with NO source maps and no per-module banners,
 * so bytes cannot be attributed by reading the output. The chunks do contain
 * incidental `node_modules/<pkg>` strings, which look attributable and are not:
 * they are string literals, not module boundaries.
 *
 * The only precise method available is a SIZE-BY-IMPORT DIFF, stubbing one
 * package and rebuilding, and at roughly 90 seconds a build that is over an
 * hour for 51 rows. So this script reports REACHABILITY, which is the question
 * that actually decides a lean-out (does this cost Worker bytes at all), and
 * the session runs exact diffs for the handful of candidates. The distinction
 * is the point: `reach: build` is a measured zero, not an unknown.
 */
```

### scripts/measure/deps.mjs:59 (WHY, shortened)

why the root is scanned; the two packages go to the history document.

```js
/**
 * Directories scanned for imports, and whether code there ships in the Worker.
 *
 * THE ROOT IS IN THE LIST, and leaving it out was the first version's bug.
 * `vite.config.ts`, `vitest.config.ts` and `react-router.config.ts` sit at the
 * repository root, so a scan of app/workers/scripts/test reported
 * `@cloudflare/vite-plugin` and `@cloudflare/vitest-plugin` as NOTHING IMPORTS
 * IT while both are imported by the configs that make the build work. A
 * lean-out table that says "unused" about the build tool is worse than no
 * table, because the reader acts on it.
 */
```

### scripts/measure/deps.mjs:84 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------- the installed tree ---- */
```

### scripts/measure/deps.mjs:86 (WHY, shortened)

why the exit code is not the gate; the first run goes to the history document.

```js
/*
 * `npm ls` EXITS NONZERO ON ELSPROBLEMS and still prints a complete tree, so
 * the exit code is deliberately not the gate here. It exited 1 on the first run
 * of this script because node_modules was one Renovate bump behind
 * package.json, which is exactly the condition that would have made every
 * number below describe a tree nobody has. The mismatch is REPORTED rather than
 * swallowed.
 */
```

### scripts/measure/deps.mjs:135 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------- on disk ---- */
```

### scripts/measure/deps.mjs:169 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------ importers --- */
```

### scripts/measure/deps.mjs:210 (WHY, shortened)

why the needle is the specifier, with its discipline.

```js
/**
 * The first real import of a package, as file and line.
 *
 * MATCHES THE SPECIFIER, NOT THE NAME ANYWHERE IN THE FILE. A bare name scan
 * finds the package in prose, in a comment arguing against it, and in an
 * unrelated string, which is the "anchor every needle" discipline. The needle
 * requires the name to sit inside a quoted module specifier, either exactly or
 * followed by a subpath.
 */
```

### scripts/measure/deps.mjs:230 (WHY, shortened)

what a type-only import ships; the misreported package goes to the history document.

```js
/*
         * A TYPE-ONLY IMPORT SHIPS NOTHING. `import type { RouteConfig } from
         * "@react-router/dev/routes"` is erased by the compiler, so counting it
         * as reaching the Worker would have put `@react-router/dev`, a dev
         * dependency, in the shipping column on the strength of a line that
         * contributes zero bytes. Measured: that is exactly what the first
         * version of this script reported.
         */
```

### scripts/measure/deps.mjs:251 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------- the rows --- */
```

## scripts/build-content.mjs

### scripts/build-content.mjs:1 (CONTRACT, shortened)

what it writes, why gitignored and who proves it; the artifact-arc reference goes to the history document.

```js
/**
 * Renders content/posts/*.md into the LOCAL build product at
 * content/generated/posts.json.
 *
 * Gitignored since the artifact arc: git holds markdown, D1 holds the only
 * rendered copy, and everything that reads this file (sync-content, the
 * gates, build:og and build:diagrams) runs after a build. `check:content`
 * proves the render is valid and deterministic; ship's drift report compares
 * D1's hashes against what this wrote.
 */
```

### scripts/build-content.mjs:35 (CONTRACT, shortened)

why sorted.

```js
/**
 * Renders every post and returns the artifact exactly as it should sit on disk.
 * Sorted by slug so the output depends on content alone, never on the order the
 * filesystem happened to hand back.
 *
 * @returns {Promise<string>}
 */
```

### scripts/build-content.mjs:72 (CONTRACT, shortened)

why read rather than imported, and the build order; the ruling reference goes to the history document.

```js
/*
   * The page half of the corpus. Ruling 3 of colophon-page.md.
   *
   * Read with `readFileSync` rather than imported: a JSON import needs
   * `with { type: "json" }` for Node, and that attribute is rejected by this
   * repo's tsc `module` setting, so the two would disagree about whether the
   * file even compiles. The Worker's copy of this call imports them instead,
   * which is the same environment split `makeResolveImage` has.
   *
   * BUILD ORDER: this now depends on `content/generated/stack.json`, so
   * `build:stack` runs BEFORE `build:content`. A stale stack.json here produces
   * page records that the next build will not reproduce, which `check:content`
   * reports as a byte difference.
   */
```

### scripts/build-content.mjs:101 (CONTRACT, shortened)

why the generated module rather than the JSON.

```js
/*
   * THE PAPERS COME FROM A COMMITTED MODULE, not from a JSON file read above.
   * `app/data/publications.ts` is generated from the two data files and
   * byte-gated against them by `check:publications`, so it is the corpus by the
   * time anything here can see it. Reading the JSON again would be a second
   * assembly of the same records, which is what the generated module exists to
   * prevent.
   */
```

### scripts/build-content.mjs:120 (CONTRACT, shortened)

why it is not in the build product.

```js
/**
 * The date of the last commit that touched a file, as YYYY-MM-DD.
 *
 * Deliberately NOT written into the build product. A render must be a pure
 * function of the sources (the determinism pass renders twice and compares,
 * and the Worker writer has no git to consult), so git dates are applied at
 * sync time instead, where the two writers already legitimately differ.
 *
 * Exported for `sync:content`.
 *
 * @param {string} file
 * @returns {string | null}
 */
```

### scripts/build-content.mjs:147 (CONTRACT, shortened)

why one owner, why a Date, why explicit midnight and why null is real, with its citation.

```js
/**
 * The revision date a post's row carries, or null.
 *
 * ONE OWNER for `post.updated ?? lastCommitDate(post.sourcePath)`. That
 * expression was written once, inline in `sync-content.mjs`, and it is what
 * decides whether a reader sees an "Updated" line and what `dt-updated`
 * publishes. `check:microformats` renders that markup offline and has to feed
 * the component the value production would write; computing it there would have
 * been a second statement of the rule, and hard rule 17 gives a measured value
 * to one place or to nowhere.
 *
 * A `Date` rather than the `YYYY-MM-DD` string, because the two consumers want
 * different shapes of it: the sync converts to epoch seconds for the column,
 * the gate hands it to a component that calls `new Date()` on it. Returning the
 * string would leave both of them parsing, which is where a timezone gets in.
 *
 * MIDNIGHT UTC, explicitly. `new Date("2026-09-09")` is already UTC by spec,
 * but the sync spelled the time out and this keeps that spelling rather than
 * relying on a default nobody should have to look up.
 *
 * NULL IS A REAL ANSWER AND NOT A FAILURE. A shallow clone has no history for
 * most files, so CI legitimately gets null here where a full local clone gets a
 * date. Both are correct: the row then carries no `updated_at`, the page shows
 * no revision, and `dt-updated` is absent. The gate asserts the PAIRING rather
 * than the presence, so it holds in both environments.
 *
 * @param {{ updated?: string | null, sourcePath: string }} post
 * @returns {Date | null}
 */
```

### scripts/build-content.mjs:181 (CONTRACT, shortened)

why markdown, why rendered here and why the resolver refuses; the section citation goes to the history document.

```js
/**
 * The About page, rendered from markdown into the shape its route imports.
 *
 * ## WHY IT IS MARKDOWN AND NOT JSX
 *
 * `/privacy` and `/colophon` are prose in JSX, which is fine for pages whose
 * sentences are each tied to a file the reader can go and check. About is not
 * that: it is one person's description of themselves, it will be revised on
 * taste rather than on a code change, and the person revising it should not
 * have to edit a component to move a comma. So it edits the way a post does.
 *
 * ## WHY IT IS RENDERED HERE AND NOT IN THE WORKER
 *
 * The public plane must not grow a second markdown renderer, and it must not
 * pay for the first one on a static page: `renderBody` pulls shiki, KaTeX and
 * the directive plugins, which is most of the build's weight for four
 * paragraphs that contain none of them. Rendering at build time means the
 * route imports a string.
 *
 * THE SAME `renderBody` THE CORPUS USES, never a lighter second pass. A page
 * rendered by a different pipeline would drift from the posts beside it in
 * exactly the ways nobody checks: heading ids, link handling, the URL
 * allowlist. The mailto in the contact line is live because `isAllowedUrl`
 * permits `mailto:`, which is a property of the shared renderer and not of a
 * special case written here.
 *
 * `resolveImage` REFUSES. This page has no images and must not acquire one by
 * accident: an image here would need a build-time measurement this function
 * does not do, and would render without `width` and `height` (check:invariants
 * section 28). A named throw is a better answer than a silent unsized image.
 *
 * @returns {Promise<string>} the artifact exactly as it should sit on disk
 */
```

## scripts/lib/wrangler-surface.mjs

### scripts/lib/wrangler-surface.mjs:1 (CONTRACT, shortened)

what it enumerates and the two deliberate omissions; the move and its date go to the history document.

```js
/**
 * The Worker's binding surface, derived from a wrangler config.
 *
 * ONE enumerator, imported by everything that needs to know what this Worker
 * binds. It was inline in `check-config.mjs` and moved here when `build:stack`
 * became a second reader: two functions walking the same config would be the
 * exact mirror `check:invariants` exists to prevent, and a binding kind added to
 * one and not the other fails silently in the direction that matters, by
 * reporting a smaller surface rather than an error.
 *
 * `assets.directory` is deliberately not part of the surface: the Cloudflare
 * Vite plugin supplies it from the client build output, so only the binding is
 * ours to declare.
 *
 * Queue CONSUMERS are keyed by queue name rather than by a binding name, because
 * a consumer has no binding: it is a subscription, not a handle.
 */
```

### scripts/lib/wrangler-surface.mjs:21 (CONTRACT, shortened)

what it converts; one line already.

```js
/**
 * JSONC to JSON. Comments only; these configs have no trailing commas.
 * @param {string} path
 * @returns {any}
 */
```

### scripts/lib/wrangler-surface.mjs:26 (WHY, shortened)

why the weak stripper and why weak is enough; the measurement date goes to the history document.

```js
/*
 * WEAK ON PURPOSE. This is JSONC on its way to JSON.parse, so the shared
 * strong stripper in scripts/lib/strip-comments.mjs must NOT be used: its
 * line-comment rule eats a protocol-relative url ("//cdn.example.com/x"),
 * whose slashes follow a quote rather than a colon, and takes the rest of
 * the line with it. MEASURED 2026-08-23: the config stops parsing.
 *
 * Weak is SUFFICIENT here, which is the other half: JSON.parse throws on
 * any comment this fails to remove, so an under-strip cannot pass quietly.
 * test/strip-comments.test.mjs asserts both halves.
 */
```

### scripts/lib/wrangler-surface.mjs:45 (CONTRACT, shortened)

one table so the two readers cannot disagree, and what the settings string omits.

```js
/**
 * How each binding kind is read, keyed by the config key that declares it.
 *
 * ONE table, so `surfaceOf` and `unhandledBindingKinds` cannot disagree about
 * what is handled: the first iterates it, the second treats its keys as the
 * allowed set. A kind added to one and not the other is not expressible.
 *
 * The settings string per kind deliberately omits account-scoped IDENTIFIERS
 * (`database_id`, the KV `id`), because the tracked example carries placeholders
 * for those and comparing them would fail on every clone. Everything else is
 * compared, so a bucket renamed in one file and not the other is caught.
 *
 * @type {Record<string, (config: any, out: Map<string, string>) => void>}
 */
```

### scripts/lib/wrangler-surface.mjs:89 (WHY, shortened)

why the dataset name is compared; one line.

```js
// The dataset NAME is compared, not omitted as account-scoped, because it is
  // not an account-scoped id: it is the table the SQL API reads. Two files
  // disagreeing about it would have the Worker writing where nothing queries.
```

### scripts/lib/wrangler-surface.mjs:100 (WHY, shortened)

why the service name is compared; one line.

```js
// The watchdog Worker's only route to the site. The SERVICE NAME is compared
  // rather than omitted as account-scoped: it names which Worker is called, and
  // two files disagreeing about it would point the watchdog at nothing.
```

### scripts/lib/wrangler-surface.mjs:111 (WHY, shortened)

the key that differs and why restrictions are settings; the dates and the widening go to the history document.

```js
/*
   * Email Sending. KEYED BY `name`, NOT `binding`, which is the whole reason
   * this entry has a comment: every other binding kind wrangler ships uses
   * `binding`, and `send_email` uses `name`. That difference put it straight
   * through `unhandledBindingKinds`' array arm, which only looked for
   * `binding`, so it was a binding readable by NEITHER function: invisible to
   * the comparison AND invisible to the detector meant to catch exactly that.
   * The detector is widened below in the same commit.
   *
   * The RESTRICTIONS are part of the settings, not just the name. A binding
   * pinned to one destination in the real config and unrestricted in the
   * example describes a different blast radius, which is the kind of drift this
   * gate exists to catch.
   */
```

### scripts/lib/wrangler-surface.mjs:151 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Every binding the config declares, as `KIND:NAME`, mapped to the settings
 * that are not account-scoped identifiers.
 *
 * @param {any} config
 * @returns {Map<string, string>}
 */
```

### scripts/lib/wrangler-surface.mjs:165 (CONTRACT, shortened)

why it exists, the three shapes, and the one key that matches none; the plant, the dates and the widening go to the history document.

```js
/**
 * Config keys that DECLARE BINDINGS and that `surfaceOf` cannot read.
 *
 * **This exists because the absence of it was a live hole, found by planting the
 * exact thing it now catches.** `vectorize` was added to the tracked example and
 * both `check:config` and `check:stack` passed, because a kind no reader knows
 * about produces no rows on either side of every comparison. A gate that
 * compares two blind spots agrees with itself.
 *
 * Detection is STRUCTURAL rather than a list of Cloudflare's products, so a
 * binding type that does not exist yet is still caught. A wrangler binding
 * declaration is one of exactly three shapes:
 *
 *   an object with a `binding`                     assets, images, browser
 *   an array of objects carrying `binding` or      d1, kv, r2, vectorize, ai,
 *     `name`                                         services, send_email
 *   an object with a `bindings` array              durable_objects, workflows
 *
 * **THE ARRAY ARM LOOKED FOR `binding` ALONE UNTIL 2026-08-29, AND THAT WAS A
 * LIVE HOLE OF EXACTLY THE SHAPE THIS FUNCTION EXISTS TO CLOSE.** `send_email`
 * keys its entries by `name` rather than `binding`, so it was readable by
 * neither `surfaceOf` nor this: absent from both sides of every comparison, and
 * absent from the report that is supposed to name what the comparison cannot
 * see. Found while adding the watchdog's mail binding, not by a plant. The
 * `bindings`-array arm below already accepted `name`, so the two arms simply
 * disagreed with each other.
 *
 * Widening it is safe against this repo's configs and was checked rather than
 * assumed: no other array-valued top-level key carries a `name`.
 *
 * `queues` matches none of these, which is correct: a consumer is a
 * subscription rather than a handle and has no `binding` at all. It is handled
 * explicitly above and so is never reported here.
 *
 * @param {any} config
 * @returns {string[]}
 */
```

## scripts/lib/floor.mjs

### scripts/lib/floor.mjs:1 (CONTRACT, shortened)

what it owns and why it returns a string; the drift measurement, the ruling and the worked example go to the history document.

```js
/**
 * One owner for the floor comparison, and for the line that proves it ran.
 *
 * ## THE DEFECT THIS IS FOR, ruling 23
 *
 * Every counting gate carries a `MINIMUM_*` compared against its own executed
 * count, and prints "only X ran, expected at least N" on breach. NOTHING
 * compares the two when the count is ABOVE the floor. So a floor set once and
 * never re-measured sinks under its count as the gate grows, and the gap is
 * invisible: `check:policy` drifted 46 checks under its floor before anybody
 * looked, which means 46 assertions could have stopped running and the floor
 * would still have passed.
 *
 * A floor that far under its count is a skipped block waiting to happen. The
 * repair is not a tighter floor, which goes stale the same way. It is to make
 * the gap MACHINE-READABLE on every successful run, so `check:floors` can read
 * it back and refuse a gap that has grown.
 *
 * ## WHY THIS RETURNS A STRING INSTEAD OF ASSERTING
 *
 * The obvious shape is a helper that fails the gate itself. It cannot, and the
 * reason is the tenth vacuity class (hard rule 10, VERIFICATION.md).
 *
 * Three reporter shapes coexist across the gates BY DESIGN and must not be
 * tidied into one: `ok(label, condition, detail)`,
 * `assertThat(condition, label, detail)` and `assert(label, ok, detail)`. The
 * names differ precisely so a call copied between two gates is a ReferenceError
 * rather than a silent pass. A shared helper that called one of them would
 * either have to pick a shape, which breaks the gates using the other two, or
 * take a reporter callback, which puts a function in an argument slot next to a
 * label and a count and re-creates the argument-order hazard the rename cured.
 *
 * So this owns the COMPARISON and both MESSAGES, and the call site keeps its own
 * reporter and its own label:
 *
 *     const breach = assertFloor("check:secrets", "checks", checks, MINIMUM_CHECKS);
 *     if (breach) ok("this gate executed its assertions", false, breach);
 *
 * Behaviour on breach is unchanged from the hand-written form it replaces: the
 * same detail text reaches the same reporter and increments the same counter.
 * What is new is the SUCCESS line, which did not exist anywhere before.
 *
 * ## THE SUCCESS LINE IS THE PRODUCT
 *
 * `floor <gate>:<name> executed=<N> minimum=<M>` on one line, printed only when
 * the floor HOLDS. `check:floors` parses it. Two properties it depends on:
 *
 *   The gate name is IN the line rather than inferred from which gate printed
 *   it, because `check:head` runs the offline tier inside a worktree and every
 *   child gate's floor lines surface in ITS stdout. A reader keying on the
 *   producing process would file thirty floors under `check:head`.
 *
 *   It is printed on SUCCESS ONLY. A breach already fails the gate loudly, and
 *   emitting a floor line there would let `check:floors` read a number from a
 *   run that had already refused.
 */
```

### scripts/lib/floor.mjs:58 (CONTRACT, shortened)

one owner for the spelling, and the anchoring constraint.

```js
/**
 * The machine-readable success line. One owner, so the gate that writes it and
 * the gate that reads it cannot drift apart in their spelling.
 *
 * Anchored at the start of a line by `check:floors`, so this must never be
 * indented or prefixed at a call site.
 */
```

### scripts/lib/floor.mjs:65 (WHY, shortened)

why the gate is two segments and not a greedy run; the sha, the dates and the discovery go to the history document.

```js
/*
 * THE GATE IS THE FIRST TWO SEGMENTS, NOT A GREEDY RUN.
 *
 * This was `/^floor (\S+):(\S+) .../`, and `\S+` is greedy, so a floor NAME
 * containing a colon was split in the wrong place. `check:browser` names its
 * floors `checks:preview` and `checks:deployed` (since 457d049, 2026-09-06),
 * which parsed as gate `check:browser:checks` and name `preview`.
 *
 * The cost was not a wrong number. Section 1 still compared the right count
 * against the right floor, because it only reads what the line says. What broke
 * was section 2, the "every floored gate printed its floor" assertion: the
 * producer set held `check:browser:checks`, so `check:browser` was reported
 * SILENT on every run that reached it, which is the one assertion that exists
 * to notice a floor block that stopped executing.
 *
 * It stayed hidden because `check:browser` is network-tiered: the offline tier
 * `check:floors` runs standalone never reaches it, and neither CI nor ship runs
 * `check:all`. Found 2026-09-08 when `check:all` was run end to end.
 *
 * Anchored to `<word>:<word>` for the gate so a name may carry colons and the
 * split still lands after the gate. Non-greedy alone would not do: it would
 * take `check` as the gate.
 */
```

### scripts/lib/floor.mjs:90 (CONTRACT, shortened)

the parameters, with the why-belongs-to-the-site rule kept.

```js
/**
 * Compare an executed count against its floor.
 *
 * @param {string} gate the npm script name, e.g. "check:secrets"
 * @param {string} name what is being counted, unique within the gate
 * @param {number} executed the count the gate actually reached
 * @param {number} minimum the floor
 * @param {string} [why] this site's own reasoning, appended to the breach
 *   detail. Hard rule 17: the reasoning belongs to the site that has it, and
 *   flattening thirty bespoke explanations into one generic sentence would
 *   destroy the only part of the message that tells a reader what broke.
 * @returns {string | null} the breach detail for the caller's own reporter, or
 *   null when the floor holds
 */
```

### scripts/lib/floor.mjs:105 (WHY, shortened)

why NaN reads as a breach; one line.

```js
/*
   * A NaN or a negative reads as a breach rather than as a pass. `executed`
   * arrives from a counter, and a counter that has become undefined is exactly
   * the failure this whole mechanism exists to catch; `NaN < minimum` is false,
   * so the naive comparison would report a clean sweep of nothing.
   */
```

## scripts/check-media-axes.mjs

### scripts/check-media-axes.mjs:1 (CONTRACT, shortened)

the boundary, the derivation and the fail-closed rule; the defect, its production measurements and the dates go to the history document.

```js
/**
 * Gate: every listing axis `listMediaPage` declares actually REACHES SQL.
 *
 * OBSERVATION BOUNDARY: this is a SOURCE gate. It reads the two modules and
 * proves the axis list is derived rather than restated and that the forwarding
 * is a spread rather than a hand-copied key list. It does NOT run a query, so it
 * cannot see an axis that arrives at `listMediaPage` and is then built into the
 * wrong SQL. It sees DROPPED, not MISBUILT. Proving the SQL itself needs a
 * database and belongs to `check:media --remote` and to verify-live.
 *
 *   npm run check:media-axes
 *
 * Why this exists. Until 2026-08-16 `listMedia`'s options type named six of the
 * twelve axes `listMediaPage` implements. The loader passed all twelve through
 * an object SPREAD, and a spread is exempt from TypeScript's excess-property
 * check, so the six undeclared ones compiled cleanly and were dropped on the
 * floor. `listMediaPage` implemented every one of them correctly; they simply
 * never arrived.
 *
 * MEASURED ON PRODUCTION the day it was found, which is what turned a code
 * reading into a defect: `?sort=size` and `?sort=name&dir=asc` returned rows
 * byte-identical to the default; `?lens=large` returned 24 rows beside a chip
 * reading 8; `?lens=unattached` returned 24 beside a chip reading 53; and
 * `?trash=1` returned 24 NOT-trashed files beside a trash count of 0. The chip
 * counts were right because they are separate queries that bypass the dropping
 * layer, so the page disagreed with itself.
 *
 * THE AXIS LIST IS DERIVED FROM THE SOURCE OF TRUTH, never restated here. A new
 * axis added to `listMediaPage` is covered by this gate the moment it is
 * declared, which is the only version of this check worth having: a hardcoded
 * list would have to be updated by the same person who forgot the forwarding.
 *
 * FAILS CLOSED. An unreadable file, an unparseable signature or a zero-length
 * axis list is a FAILURE, never a skip: an axis list that came back empty would
 * otherwise satisfy every per-axis assertion by having nothing to check.
 */
```

### scripts/check-media-axes.mjs:60 (CONTRACT, shortened)

what it blanks and why length is preserved.

```js
/**
 * Blanks comments and string bodies so brace matching cannot be thrown by a
 * `{` inside a doc comment. Length is PRESERVED, so every offset computed on
 * the stripped text still indexes the original.
 * @param {string} src
 */
```

### scripts/check-media-axes.mjs:102 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Returns the index just past the block opened at `open`.
 * @param {string} s
 * @param {number} open
 * @param {string} o
 * @param {string} c
 */
```

### scripts/check-media-axes.mjs:135 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ *
 * 1. Derive the axis vocabulary from `listMediaPage`'s own signature.
 * ------------------------------------------------------------------ */
```

### scripts/check-media-axes.mjs:158 (NUMBER, shortened)

the scope rule and where the number came from; the measurement date goes to the history document.

```js
/*
 * SCOPE NON-EMPTINESS, hard rule 10. Every per-axis assertion below is vacuous
 * if this list is empty, so the list is floored before it is used. The floor is
 * the count MEASURED at the time this gate was written, so losing an axis from
 * the signature fails here rather than quietly shrinking the gate.
 */
```

### scripts/check-media-axes.mjs:174 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ *
 * 2. Every declared axis is READ in listMediaPage's body.
 *    Catches an axis added to the signature and never wired to SQL.
 * ------------------------------------------------------------------ */
```

### scripts/check-media-axes.mjs:184 (WHY, shortened)

why helpers are followed and why by shape; the first run's false accusations go to the history document.

```js
/*
 * THE OPTIONS OBJECT IS FOLLOWED INTO HELPERS, because an axis is just as
 * consumed when the whole object is handed on. `orderFor(options)` is the live
 * case: `sort` and `dir` are read nowhere in this body and are wired to SQL
 * correctly inside that helper. Matching only `options.<axis>` in the body
 * accused two working axes on this gate's first run.
 *
 * Matched by SHAPE, not by the spelling that exists today: any `name(options)`
 * call in the body pulls that function's body into the searched text.
 */
```

### scripts/check-media-axes.mjs:199 (WHY, shortened)

why the parameter list is stepped over; the named example goes to the history document.

```js
// Step over the PARAMETER LIST before looking for the body. A helper whose
  // options are typed inline carries a `{` in its own signature, and matching
  // that one hands back the type instead of the code: `orderFor`'s parameter is
  // `{ sort?: string; dir?: string; trashed?: boolean }`, which mentions every
  // axis name and reads none of them, so the naive offset accused them anyway.
```

### scripts/check-media-axes.mjs:229 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ *
 * 3. listMedia's options type is DERIVED, not restated.
 * ------------------------------------------------------------------ */
```

### scripts/check-media-axes.mjs:240 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------------ *
 * 4. Every axis actually reaches the call. NAMES the ones that do not.
 * ------------------------------------------------------------------ */
```

### scripts/check-media-axes.mjs:258 (WHY, shortened)

what a spread covers and what the plant exercises.

```js
/*
 * A spread forwards the whole object, so it covers every axis by construction.
 * Without one, only the keys written out arrive, and the gate NAMES the rest.
 * This is the assertion the plant exercises: swap the spread for a hand-copied
 * list and the missing axes are printed by name.
 */
```

### scripts/check-media-axes.mjs:288 (NUMBER, shortened)

how it was measured and why the slack; the date and the arithmetic mistake go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 24
 * with the 12 axes currently declared (12 structural + one read-check per
 * axis). Never summed, and not the 22 first written here from counting the
 * source by eye before the helper-following assertion existed. Floored at 22,
 * a slack of 2, so retiring a genuinely dead axis does not fail the floor while
 * dropping a whole BLOCK still does.
 */
```

## scripts/apply-config-ids.mjs

### scripts/apply-config-ids.mjs:1 (CONTRACT, shortened)

what it patches, why not the whole file, and the five refusals; the dates, the secret's history and the panel symptom go to the history document.

```js
/**
 * Puts the redacted values into the bootstrapped wrangler configs.
 *
 *   node scripts/apply-config-ids.mjs
 *
 * FOR CI ONLY, and it exists because of the split .gitignore already
 * documents: each real `wrangler*.jsonc` is gitignored and its `.example` is
 * tracked, differing in exactly the values that cannot live in the repository.
 * `postinstall` bootstraps a checkout by COPYING the examples, so a fresh
 * checkout holds placeholders, and `wrangler deploy` against a placeholder
 * database_id would bind a database that does not exist.
 *
 * ## TWO CONFIGS SINCE 2026-08-29, AND THE SECOND ONE FAILS QUIETLY
 *
 * The watchdog Worker's `ALERT_EMAIL` is here for a sharper reason than the
 * ids. A placeholder database_id fails LOUDLY: wrangler binds nothing and the
 * deploy falls over. A placeholder ALERT_EMAIL deploys perfectly and mails
 * every alert to `alerts@example.com`, which is a reserved domain nobody reads,
 * so the watchdog would look healthy while being unable to reach anybody. That
 * is the exact failure shape this whole arc exists to end, reintroduced by the
 * fix for it, and it is why this refuses rather than warns.
 *
 * ## WHY TWO SECRETS AND NOT THE WHOLE FILE
 *
 * The obvious alternative is to store the real `wrangler.jsonc` as one secret
 * and write it out. That is refused: the file describes every binding, the
 * compatibility date, the flags and the Durable Object migrations, and a copy
 * of it in GitHub is a SECOND OWNER of all of that, free to drift from the
 * tracked example that `check:config` reconciles. Rule 17. Only the values that
 * cannot live in the repository come from secrets; everything else still comes
 * from the examples, which are the one description of these Workers.
 *
 * ## IT REFUSES RATHER THAN PATCHING PARTIALLY
 *
 * Five ways to fail and each one is named, because every one of them otherwise
 * produces a deploy that looks fine and binds the wrong thing:
 *
 *   a missing variable        nothing is written
 *   a config that is absent   nothing is written
 *   a placeholder not found   the example changed shape and this would have
 *                             silently patched nothing
 *   more than one occurrence  ambiguous, so it refuses rather than guessing
 *   a placeholder surviving   the write did not take
 *
 * ## THE ACCOUNT ID IS PATCHED TOO, SINCE 2026-08-29
 *
 * It was not, and it had to be from the moment it became a placeholder in the
 * example on 2026-08-28. The Worker READS `CLOUDFLARE_ACCOUNT_ID` at runtime:
 * it is the account the Analytics Engine SQL API is queried against, so a
 * deploy carrying the placeholder would leave the cockpit's origin-requests
 * panel reading a URL for an account of thirty-two zeros. deploy.yml already
 * held the secret and already refused without it; nothing spent it.
 *
 * ## THE IDS ARE NOT PRINTED
 *
 * They are account-scoped identifiers rather than credentials, and they are
 * still not echoed: this runs in a public-by-default log, the repository keeps
 * them out of git deliberately, and a script that prints them makes the
 * gitignore rule pointless. What is printed is WHICH field was patched.
 *
 * A TEXT REPLACEMENT, never a parse-and-reserialise. Re-emitting the JSON would
 * strip every comment in a file whose comments are load bearing, and would turn
 * a two-value patch into a whole-file rewrite that `check:config` then has to
 * reconcile against the example line by line.
 */
```

### scripts/apply-config-ids.mjs:79 (CONTRACT, shortened)

what the list is and what a change to the example does.

```js
/**
 * The placeholders the tracked example carries. Stated here as the values this
 * script expects to REPLACE, so a change to the example fails loudly here
 * rather than leaving a deploy bound to a database that does not exist.
 */
```

### scripts/apply-config-ids.mjs:115 (WHY, shortened)

why the needle carries the key; the dates, the stopped deploy and the control go to the history document.

```js
/**
 * The needle for one field: its JSON KEY and its placeholder together.
 *
 * ANCHORED TO THE KEY SINCE 2026-08-29, AND THE BARE FORM WAS ALREADY BROKEN.
 * The needle used to be the placeholder string alone, which was unambiguous
 * only while every placeholder differed. On 2026-08-28 `CLOUDFLARE_ACCOUNT_ID`
 * became a placeholder in the example and it is THIRTY-TWO ZEROS, exactly like
 * the KV namespace id, so the occurrence count for the KV field became 2 and
 * this script refused every run. The deploy button has been unable to complete
 * since that day.
 *
 * That refusal was the RIGHT behaviour and is why the defect is a stopped
 * deploy rather than a Worker bound to the wrong namespace: the ambiguity check
 * was added precisely so a duplicated placeholder could not be guessed at. What
 * was missing was a needle specific enough for two fields to share a value,
 * which they now legitimately do.
 *
 * Found 2026-08-29 by running the UNMODIFIED script from HEAD against the
 * tracked example, which is the control that proves this is not a defect the
 * same session introduced.
 *
 * @param {{ key: string, placeholder: string }} field
 */
```

### scripts/apply-config-ids.mjs:168 (WHY, shortened)

why the count comes first; one line.

```js
// Counted before replacing. `replace` on a string swaps the FIRST match and
    // reports nothing, so a needle that appears twice would leave one behind
    // and this would print success.
```

### scripts/apply-config-ids.mjs:193 (WHY, shortened)

why the read-back; one line already.

```js
/*
   * READ BACK, because a write that did not take is the failure this whole file
   * exists to prevent, and it is invisible from the exit code of writeFileSync.
   */
```

## scripts/check-uptime.mjs

### scripts/check-uptime.mjs:1 (CONTRACT, shortened)

the boundary, the three-way comparison and the fail-closed rule; nothing here is dated.

```js
/**
 * Gate over the external uptime monitors.
 *
 *   npm run check:uptime
 *
 * Asserts that both monitors this repo asks for EXIST, are NOT PAUSED, and
 * point at the CURRENT hostname. Fails by name otherwise.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This reads UptimeRobot's record of its own configuration. It does NOT prove
 * a check has ever run, that an alert would be delivered, or that the mailbox
 * is read. It cannot see whether the account is over its plan limits. What it
 * proves is that the instrument is configured, switched on, and aimed at this
 * site, which is the half that silently rots when a hostname changes.
 *
 * It is also NOT a check that the site is up. See `PAUSED` in
 * `scripts/lib/uptimerobot.mjs`: a `DOWN` monitor is a monitor doing its job,
 * and a gate that demanded `UP` would go red for the site being down and
 * couple every gate run to production weather.
 *
 * ## THREE-WAY, BOTH DIRECTIONS
 *
 * `SITE_ORIGIN` is the one owner of the hostname (rule 17). The manifest is a
 * RECORD of what `uptime-ensure` last wrote, not a second owner. So there are
 * two comparisons and each catches a different failure:
 *
 *   code  vs manifest   the manifest went stale, or was edited by hand
 *   manifest vs live    somebody changed the monitor in the dashboard
 *
 * Checking only the second would pass a manifest and a monitor that agree with
 * each other and disagree with the site. Checking only the first would pass a
 * monitor that had been repointed or switched off.
 *
 * ## FAILS CLOSED
 *
 * A missing credential, an unreadable manifest, an API error and a manifest
 * with the wrong number of entries are each a FAILURE, never a skip. The whole
 * class of defect this gate exists for is a monitoring system that reports
 * nothing while looking configured, and a gate that passed when it could not
 * read its inputs would be another instance of it.
 *
 * NETWORK ONLY, so it is tiered `network` and `--ci` does not run it: a clean
 * checkout has no `.dev.vars` and there is no local UptimeRobot to read.
 */
```

### scripts/check-uptime.mjs:75 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --------------------------------------------------- fail closed first */
```

### scripts/check-uptime.mjs:109 (WHY, shortened)

the scope rule; one line.

```js
/*
 * SCOPE IS PROVEN NON-EMPTY BEFORE ANYTHING IS COMPARED (hard rule 10). An
 * empty desired list or an empty manifest would make every loop below iterate
 * nothing and report a clean sweep of a set it never looked at.
 */
```

### scripts/check-uptime.mjs:128 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------ code vs manifest (hostname) */
```

### scripts/check-uptime.mjs:142 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* -------------------------------------------------- manifest vs live */
```

### scripts/check-uptime.mjs:144 (WHY, shortened)

why by id and which direction matters; the measured window goes to the history document.

```js
/*
 * READ BY ID, NEVER OFF THE LIST. See `getMonitor`: the list endpoint was
 * measured disagreeing with the addressed read for about 30 seconds after a
 * status change, in both directions. The direction that matters is a list
 * still reporting a monitor as running after somebody paused it, which would
 * make this gate answer green about an instrument that had been switched off.
 */
```

### scripts/check-uptime.mjs:210 (WHY, shortened)

why the reads are counted and how it pairs with the floor.

```js
/*
 * THE READS ACTUALLY HAPPENED (hard rule 10, "prove scope non-empty").
 *
 * Every per-monitor assertion above lives inside a loop, and a loop that
 * iterated nothing reports exactly what a clean sweep reports. This counts the
 * monitors this run genuinely fetched from the API, so "0 failures" cannot
 * mean "0 monitors examined". It is paired with the floor below rather than
 * replacing it: the floor counts ASSERTIONS, this counts what they were
 * assertions ABOUT.
 */
```

### scripts/check-uptime.mjs:227 (NUMBER, shortened)

how it was measured and why a little under; the shape of the two monitors goes to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED BY RUNNING THIS GATE, never summed: two monitors contribute a
 * different number of assertions each, because `COMPARED_FIELDS` only applies
 * the keyword fields to the KEYWORD monitor. Floored a little under the
 * measured count so a single added assertion does not have to move it, and so
 * a monitor silently dropping out of the desired set shows up as a smaller
 * number rather than as a clean run.
 */
```

### scripts/check-uptime.mjs:237 (NUMBER, shortened)

why this is the slackest legal value; the dates, the first value and the tier accident go to the history document.

```js
/*
 * RE-MEASURED 2026-09-08 by RUNNING it: 22. Set to 18 at first, which
 * `check:floors` refused at a gap of 4 against a tolerance of 3, and it only
 * refused inside `check:all`: this gate is network-tiered, so the offline tier
 * that `check:floors` runs standalone never reaches it. Tolerance is 3 at this
 * count, so 19 is the slackest legal value.
 */
```

### scripts/check-uptime.mjs:249 (WHY, shortened)

why exitCode and where exit is still safe; the measurement, its date and the libuv assertion go to the history document.

```js
/*
 * `exitCode` RATHER THAN `process.exit()`, and this is a Windows correctness
 * fix rather than a style preference.
 *
 * MEASURED 2026-09-07: with `process.exit()` here this gate printed
 * "22 checks, 0 failures" and then died with
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` in libuv's
 * win/async.c, exiting 127. `process.exit()` tears the process down while
 * undici's keep-alive sockets from the API reads are still closing. A gate
 * that prints a clean pass and exits 127 is a FAILING gate to `check-all.mjs`,
 * which reads exit codes and cannot see the table above it.
 *
 * Letting the loop drain is what `check:media` and `check:image-weight`
 * already do on their success paths. The two fail-closed branches above still
 * call `process.exit(1)` directly and are safe there: both run BEFORE any
 * fetch, so there is no socket to race.
 */
```

## scripts/lib/colophon-facts.mjs

### scripts/lib/colophon-facts.mjs:1 (CONTRACT, shortened)

why a module, and why it is not derived; the shipped defect, the crash and the ship window go to the history document.

```js
/**
 * Every discrete fact each colophon section's RECORD BODY was assembled from,
 * as needles to match against the RENDERED page.
 *
 * ## Why this is a module rather than a closure inside verify-live
 *
 * It is the colophon's SECOND registration site. `colophonPageInput` in
 * `app/lib/colophon-sections.mjs` is the first: add a section to
 * `COLOPHON_SECTIONS` without a body rule there and the build throws, offline,
 * on every clone. Add one without a fact list HERE and nothing said a word
 * until `verify-live` ran against a deploy, which needs a deploy and bills an
 * Ask probe.
 *
 * That is exactly what happened. The `security` section shipped in ship window
 * 8 with its body rule and without its fact list, and `verify-live` crashed on
 * `no fact list for colophon section "security"`. **The throw was correct**: it
 * failed closed on an unknown section rather than sweeping it as its lead alone.
 * The defect was that the throw was the FIRST thing to notice, and it noticed
 * after the deploy.
 *
 * Extracted so `test/colophon-facts.test.mjs` can assert offline that every
 * section in the descriptor has a non-empty fact list. A pure function is the
 * only part of a harness a test can hold, which is why `readCapped` and
 * `confirmationSatisfied` were extracted for the same reason.
 *
 * ## What was deliberately NOT done: deriving this from colophonPageInput
 *
 * The obvious close is to generate these needles from the record body the
 * indexer builds. **That would destroy the only thing this sweep is for.**
 *
 * `colophonPageInput` produces one joined STRING per section for the search
 * index. This produces DISCRETE needles delimited by element boundaries, and
 * the two are checked against different artifacts: the record body against the
 * index, these against the rendered HTML. A gate whose expected values are
 * produced by the process it checks cannot fail (hard rule 10, fixture
 * independence), and two independent sources is the property this sweep exists
 * to have. Deriving would leave the page and the index agreeing with each
 * other and with nothing else.
 *
 * So the two lists stay independently authored, and the test asserts COVERAGE
 * of the section set rather than equality of the values. That is the half that
 * can be mechanised without collapsing the two sources into one.
 *
 * @see app/lib/colophon-sections.mjs, scripts/verify-live.mjs
 */
```

### scripts/lib/colophon-facts.mjs:49 (WHY, shortened)

why element-delimited; the named substring case goes to the history document.

```js
/**
 * Element-delimited, so a token cannot pass on a neighbour's substring.
 *
 * `react` is a substring of `react-dom` and `react-router`, so a bare
 * `includes("react")` survives the react entry being dropped entirely. That is
 * the "token that cannot fail" case, which reads as coverage and is worse than
 * a missing check. `>react<` is the rendered `<code>` and fails.
 *
 * @param {string} v
 */
```

### scripts/lib/colophon-facts.mjs:61 (CONTRACT, shortened)

what it reads and the two matching constraints; the status-label defect and its date go to the history document.

```js
/**
 * The fact needles for one section.
 *
 * Read from the same two JSON files the page renders, never restated here.
 *
 * **`notAdopted[].status` IS swept, and its absence here is why the defect
 * survived.** Until 2026-08-05 the record body carried the raw enum,
 * `(refused)` and `(accepted-gap)`, while the page rendered the label through a
 * STATUS_LABEL that lived in `colophon.tsx`. For `accepted-gap` the hyphen
 * meant the indexed token was on the page in no casing at all. The map moved
 * into the descriptor so both readers share it, and the token is swept through
 * `statusLabel()` rather than as a literal, so this assertion cannot drift from
 * what the page renders.
 *
 * Callers match these against HTML that has already had comments stripped and
 * character references decoded. React escapes `'` to `&#x27;`, so prose taken
 * from a data file matches only after that decode.
 *
 * @param {any} stack    content/generated/stack.json
 * @param {any} features content/features.json
 * @param {string} id    a section id from COLOPHON_SECTIONS
 * @returns {string[]}
 */
```

### scripts/lib/colophon-facts.mjs:109 (CONTRACT, shortened)

why the sentences and why the same constant; the crash goes to the history document.

```js
/*
     * The sentences themselves. The page renders each as its own `<p>`, so the
     * element delimiters are exact, and they come from the SAME constant the
     * record body is built from, which is the whole point of that constant.
     *
     * This is the branch whose absence crashed verify-live after ship window 8.
     */
```

### scripts/lib/colophon-facts.mjs:118 (CONTRACT, shortened)

identical treatment to the section above; the ship-window history goes to the history document.

```js
/*
     * The sentences themselves, from the SAME constant the record body is built
     * from, and the page renders each as its own `<p>` so the element
     * delimiters are exact. Identical treatment to `security` above, and added
     * WITH the section rather than after a deploy crashed on its absence, which
     * is the defect this file's header records.
     */
```

### scripts/lib/colophon-facts.mjs:132 (WHY, shortened)

why it fails closed and why it is kept beside the test.

```js
// Fail closed, for the reason colophonPageInput does: a section added to the
  // descriptor with no rule here would be swept as its lead alone, which passes
  // and proves nothing about the content underneath it.
  //
  // KEPT, even though test/colophon-facts.test.mjs now catches the omission
  // offline. The test is the early warning; this is the guarantee. A section id
  // can reach here from something the test does not enumerate, and sweeping a
  // section as its lead alone must never be the quiet outcome.
```

## scripts/build-katex.mjs

### scripts/build-katex.mjs:1 (CONTRACT, shortened)

the two reasons it is derived, where the output lives and the byte comparison; the measured file counts and the date go to the history document.

```js
/**
 * Derives the math stylesheet and its faces from the installed `katex` package.
 *
 *   npm run build:katex
 *
 * ## WHY THIS IS DERIVED AND COMMITTED RATHER THAN IMPORTED
 *
 * `import "katex/dist/katex.min.css"` would work and is wrong twice over.
 *
 * FIRST, a CSS import from a component lands in that ROUTE's stylesheet, and
 * `/blog/:slug` is one route serving every post. Hard rule 4 asks for the bytes
 * a reader downloads to see a page, and eleven of the twelve posts have no math
 * in them. The stylesheet has to be a separately addressable file so the
 * document can link it conditionally, which is `root.tsx`.
 *
 * SECOND, `katex.min.css` declares each face three times, `woff2` then `woff`
 * then `truetype`. Vite emits every referenced url, so importing it verbatim
 * put 60 font files in the build (measured 2026-09-06: 20 woff2, 20 woff, 20
 * ttf, the ttf set alone over 700 kB). Every browser this site supports reads
 * woff2, and `app.css` already ships the site's own faces as woff2 alone. So
 * the two legacy formats are stripped here and the emitted set is the 20 woff2
 * faces the stylesheet still names.
 *
 * ## WHY UNDER `app/` AND NOT `public/`
 *
 * Because `classify.mjs` already recorded this decision for the site's own
 * fonts, in the comment where the `woff2` entry was deleted the same day it was
 * added: a file under `public/` is walked into `assets.json` and indexed as a
 * row in the media library, and a webfont is not media. Under `app/` Vite
 * content-hashes both the stylesheet and its faces into `assets/`, where
 * `public/_headers` already grants them an immutable year.
 *
 * ## THE OUTPUT IS COMMITTED, AND `check:content` BYTE-COMPARES IT
 *
 * Same contract as `template-refs.json`: a generated artifact that is a repo
 * fact with no database owner. Committing it is what makes a katex version bump
 * that nobody regenerated a NAMED gate failure rather than a silent difference
 * between the CSS on disk and the renderer that produced the markup it styles.
 * The version is read from the installed package and written into the header,
 * so nothing here restates it.
 */
```

### scripts/build-katex.mjs:67 (WHY, shortened)

why anchored on the format keyword and why a sourceless face is left alone.

```js
/**
 * A `src:` list with everything but woff2 removed.
 *
 * ANCHORED on the format keyword rather than on the extension, because the
 * extension appears inside the filename too (`KaTeX_Main-Regular.woff2` matches
 * a naive `.woff` search) and an unanchored needle is what hard rule 10 spends
 * a paragraph on. A face that declares NO woff2 source is left ALONE and
 * reported by the caller: dropping every source it has would be a silent
 * removal of the face.
 *
 * @param {string} src the contents of one `src:` declaration
 * @returns {string | null} the trimmed list, or null when there is no woff2
 */
```

### scripts/build-katex.mjs:89 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * The stylesheet, with the legacy formats stripped and the font urls pointed at
 * the copies this script writes.
 *
 * @param {string} css the contents of katex.min.css
 * @returns {{ css: string, faces: string[], untrimmed: string[] }}
 */
```

### scripts/build-katex.mjs:116 (WHY, shortened)

why the rewrite runs over the whole sheet.

```js
/*
   * The url rewrite runs over the WHOLE stylesheet after trimming, so a woff2
   * url that survived outside an @font-face block would be caught too. Every
   * match is recorded, which is what makes the "no font is referenced that this
   * script did not copy" assertion below a measurement rather than a hope.
   */
```

### scripts/build-katex.mjs:130 (CONTRACT, shortened)

why it is exported; one line already.

```js
/**
 * The stylesheet exactly as it should be on disk, header included.
 *
 * Exported so `check:content` can derive it and byte-compare without shelling
 * out to this script, which is the same footing `scanTemplateRefs` stands on.
 */
```

### scripts/build-katex.mjs:171 (WHY, shortened)

why appended and why read from their own file.

```js
/*
   * The overrides are APPENDED rather than left as a second link, so a math
   * post costs one request instead of two, and they are read from their own
   * file rather than written here, so the hand-written rules have exactly one
   * editable home. The marker is what lets a reader see where upstream stops.
   */
```

### scripts/build-katex.mjs:189 (WHY, shortened)

why replaced rather than merged.

```js
/*
   * The font directory is REPLACED, not merged. A face removed upstream would
   * otherwise stay on disk forever, and the next reader would find a font the
   * stylesheet does not name and have no way to tell whether it mattered.
   */
```

### scripts/build-katex.mjs:206 (WHY, shortened)

both directions; one line.

```js
/*
   * BOTH DIRECTIONS. The loop above proves every named face was copied; this
   * proves nothing else is in the directory. A one-directional copy is how a
   * stale face survives a version bump.
   */
```

### scripts/build-katex.mjs:224 (WHY, shortened)

why pathToFileURL; the host measurement goes to the history document.

```js
/*
 * `pathToFileURL`, not a hand-rolled comparison, and `build-template-refs.mjs`
 * records why at length: on this host `import.meta.url` carries three slashes
 * and a concatenated `file://` + `C:/...` carries two, so the hand-rolled form
 * is false forever and the build step exits 0 having written nothing.
 */
```

## scripts/lib/diagram-audit.mjs

### scripts/lib/diagram-audit.mjs:1 (CONTRACT, shortened)

the two callers, what reachability means and why the cascade clause; nothing here is dated.

```js
/**
 * The tokens-only audit over a rendered diagram SVG.
 *
 * ONE implementation, two callers: `build:diagrams` runs it on every asset it
 * writes, so a colour mermaid invented is a build failure at the moment it is
 * invented, and `check:diagrams` runs it over every asset already committed, so
 * an asset written before a rule existed cannot survive by having been written
 * first.
 *
 * **What it asserts, stated exactly rather than implied.** Every colour on the
 * part of the SVG that a reader can actually SEE comes from `app/app.css`.
 * mermaid ships a stylesheet inside every diagram covering every feature it can
 * draw, so most of what it emits styles elements this pipeline never produces:
 * KaTeX maths, the alternate "neo" look, state and class diagram parts, error
 * output. Asserting over those would mean either mapping mermaid's entire theme
 * surface up front or maintaining an allowlist of literals, and an allowlist of
 * "black is fine" is exactly the kind of exemption a real black hides behind.
 *
 * So reachability is computed instead, structurally:
 *
 *   - A CSS rule counts when its selector matches at least one element in this
 *     document. Unmatched rules are ignored and COUNTED, so "0 problems" can
 *     never quietly mean "0 rules examined".
 *   - A colour attribute counts unless it sits inside a `<defs>` subtree that
 *     nothing references by `url(#id)`, or unless a CSS rule that matches THAT
 *     element sets the same property. An inline `style` always counts.
 *
 * That last clause is not a convenience, it is the cascade. A presentation
 * attribute is the weakest author-level declaration in SVG, below every rule,
 * and mermaid leans on that: it writes a literal `fill="#eaeaea"` onto every
 * sequence actor and then paints it from `.actor { fill: … }` in the stylesheet
 * it embeds. Reading the attribute as the colour that ships would report four
 * violations on a diagram that is entirely correct. Reading it as dead without
 * checking for the rule that kills it would let a real one through.
 *
 * All of it fails in the right direction. A diagram type that starts emitting
 * one of the unreachable elements makes its rule reachable, and the rule then
 * has to be a token or the build stops.
 */
```

### scripts/lib/diagram-audit.mjs:60 (CONTRACT, shortened)

why currentColor is included.

```js
/**
 * Values that name no colour at all and so cannot carry one from outside the
 * palette. `currentColor` is included because it resolves to the `color`
 * property, which is itself audited wherever it is set.
 */
```

### scripts/lib/diagram-audit.mjs:75 (WHY, shortened)

why brace depth and not a split.

```js
/**
 * Splits a stylesheet into top level rules by BRACE DEPTH.
 *
 * Not by splitting on `}`: mermaid's stylesheet opens with two `@keyframes`
 * blocks, and a naive split cuts them into fragments whose "selectors" are
 * chunks of keyframe bodies. Depth counting keeps an at-rule whole so it can be
 * skipped as a unit.
 *
 * @param {string} text
 * @returns {Array<{ selector: string, body: string }>}
 */
```

### scripts/lib/diagram-audit.mjs:111 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Every colour-carrying declaration in a rule body or an inline style.
 *
 * @param {string} body
 * @returns {Array<{ property: string, value: string }>}
 */
```

### scripts/lib/diagram-audit.mjs:127 (WHY, shortened)

what fail-closed by construction catches; the emitted forms go to the history document.

```js
/**
 * Decides whether one colour value is allowed.
 *
 * Fail closed by construction: the value must BE a palette colour, or a keyword
 * that names no colour, or a `url(#…)` paint reference. Anything else is
 * reported, which is what catches the forms that a hex-hunting regex misses:
 * `white`, `rgb(12.6, 10.1, 5.9)`, `hsl(-82.5, 36.4%, 91.4%)`. mermaid emits all
 * three, derived by khroma from theme variables that were never supplied.
 *
 * @param {string} value
 * @param {Set<string>} palette normalised hexes
 */
```

### scripts/lib/diagram-audit.mjs:151 (CONTRACT, shortened)

what it audits against; one line already.

```js
/**
 * Audits one rendered SVG against one theme's resolved palette.
 *
 * @param {string} svg
 * @param {string[]} paletteHexes every colour this theme is allowed to use
 * @returns {{ checked: number, skippedRules: number, overridden: number, problems: string[] }}
 */
```

### scripts/lib/diagram-audit.mjs:172 (CONTRACT, shortened)

section marker plus why the rules are kept.

```js
// --- The stylesheet mermaid embeds ---------------------------------------
  //
  // Kept afterwards as well, so the attribute pass can ask which properties a
  // rule takes over for a given element.
```

### scripts/lib/diagram-audit.mjs:198 (WHY, shortened)

fail-closed direction; one line already.

```js
// A selector this parser cannot evaluate is treated as reachable, so
          // an unreadable rule fails loudly rather than passing by default.
```

### scripts/lib/diagram-audit.mjs:215 (CONTRACT, shortened)

what it answers; one line already.

```js
/**
   * Whether a stylesheet rule takes this property over on this element, which
   * is what makes a presentation attribute dead rather than shipped.
   *
   * @param {any} element
   * @param {string} property
   */
```

### scripts/lib/diagram-audit.mjs:234 (CONTRACT, shortened)

section marker plus the defs rule.

```js
// --- Attributes and inline styles on drawn elements -----------------------
  //
  // Anything inside a <defs> subtree nothing points at is never painted. The
  // markers that draw arrowheads ARE pointed at, by `marker-end`, so they are
  // audited like everything else.
```

## scripts/lib/bash.mjs

### scripts/lib/bash.mjs:1 (CONTRACT, shortened)

the candidate order, why a walk, and the proof-by-running rule; the defect, its date and the measured paths go to the history document.

```js
/**
 * Resolving the bash binary a gate needs, ONCE, from any shell.
 *
 * ## THE DEFECT THIS IS FOR, measured 2026-09-05 rather than reasoned about
 *
 * `check:hook-scope` spawned `bash` BY BARE NAME to drive the real hook file.
 * That is a dependency on the shell the gate happened to be written in. Claude
 * Code runs its Bash tool through git bash, where `bash` is on PATH at
 * `/usr/bin/bash`, so every session read the gate as green. `npm run ship` runs
 * from Dustin's PowerShell, where `bash` is NOT on PATH at all, and step 4
 * refused with `spawnSync bash ENOENT` repeated once per case.
 *
 * Both halves of that are bad. The gate was wrong about its own subject, and it
 * said so six times in a voice that named a spawn failure rather than a missing
 * interpreter.
 *
 * ## THE CANDIDATE ORDER, AND WHY IT IS A WALK AND NOT A DEPTH
 *
 *   1. `bash` on PATH. This is the git bash and WSL-adjacent case, and it stays
 *      first so a machine with a deliberate bash keeps using it.
 *   2. Git for Windows, DERIVED from `git --exec-path`. git is already a hard
 *      dependency of half the gates, so its install root is a fact this repo
 *      can already read rather than a new thing to configure.
 *   3. The default Git for Windows install path, literally.
 *
 * Candidate 2 is a WALK UP THE ANCESTORS, not a fixed number of levels, and the
 * reason is measured on this machine on 2026-09-05:
 *
 *     git --exec-path        C:/Program Files/Git/mingw64/libexec/git-core
 *     two levels up          C:/Program Files/Git/mingw64        bin/bash.exe ABSENT
 *     three levels up        C:/Program Files/Git                bin/bash.exe PRESENT
 *
 * A fixed depth of two lands inside `mingw64`, which ships no bash, so it would
 * have found nothing on the very install it was written for. The depth is a
 * property of the Git for Windows layout, which is not this repo's to promise,
 * so the ancestor that actually holds a bash is SEARCHED FOR instead.
 *
 * ## EVERY CANDIDATE IS PROVEN BY RUNNING IT
 *
 * Existence on disk is not the claim. `bash.exe` in a Git install is a launcher
 * rather than the shell itself; whether it can execute a program is a different
 * question from whether the file is there, and the cost of guessing is a gate
 * that reports a spawn error at its first case rather than a resolution error
 * at step zero. So each candidate runs `-c "echo ok"` and must exit 0 and print
 * exactly `ok`. The needle is an equality after trimming, never a `includes`,
 * because a shim printing an error mentioning "ok" would satisfy a substring.
 *
 * ## FAILS CLOSED, AND THE CALLER SAYS SO ONCE
 *
 * `resolveBash()` returns null when nothing ran. It does not throw, does not
 * fall back to `sh`, and does not let the caller carry on to spawn a bare
 * `bash` anyway. A caller prints ONE line naming that bash could not be found
 * and exits nonzero, which is the difference between an instrument reporting
 * its own precondition and an instrument reporting six copies of a symptom.
 */
```

### scripts/lib/bash.mjs:60 (WHY, shortened)

why forward slashes; one line.

```js
/**
 * The default Git for Windows install location, spelled with forward slashes.
 *
 * Windows resolves either separator, and a forward-slash literal cannot be
 * damaged by a scripted edit or a heredoc the way a backslash literal can.
 */
```

### scripts/lib/bash.mjs:74 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Where `git --exec-path` says git lives, or null if git cannot be asked.
 *
 * @returns {string | null}
 */
```

### scripts/lib/bash.mjs:80 (WHY, shortened)

why no shell; one line already.

```js
// No `shell: true`. `git` is a real executable rather than a `.cmd` shim, so
  // it spawns directly on Windows, which is how every other gate in this repo
  // already calls it.
```

### scripts/lib/bash.mjs:89 (CONTRACT, shortened)

why deduplicated; one line already.

```js
/**
 * Every place a bash might be, in the order they are tried.
 *
 * Deduplicated on the path, so a machine where the walk and the literal default
 * agree does not probe the same binary twice and does not report it twice in
 * the failure line.
 *
 * @returns {{ path: string, source: string }[]}
 */
```

### scripts/lib/bash.mjs:107 (WHY, shortened)

why the walk terminates; one line already.

```js
// dirname of a root returns the root, so the walk stops rather than
      // spinning at the top of the drive.
```

### scripts/lib/bash.mjs:132 (CONTRACT, shortened)

what it answers; one line already.

```js
/**
 * Whether this candidate can actually run a program.
 *
 * @param {string} path
 * @returns {boolean}
 */
```

### scripts/lib/bash.mjs:144 (WHY, shortened)

why memoised including the null.

```js
/**
 * The first candidate that runs, or null if none does.
 *
 * Memoised, including the null: a gate that drives a hook once per case must
 * not pay a process-spawning search per case, and a machine with no bash must
 * not be searched repeatedly to be told the same thing.
 *
 * @returns {{ path: string, source: string } | null}
 */
```

### scripts/lib/bash.mjs:165 (WHY, shortened)

why the candidates are in the message.

```js
/**
 * The ONE line a caller prints when nothing ran, and the candidates under it.
 *
 * The candidate list is part of the message because "bash could not be found"
 * with no places named is unactionable: the reader cannot tell a machine with
 * no git from one whose Git install is somewhere this does not look.
 *
 * @returns {string}
 */
```

## scripts/check-d1-address.mjs

### scripts/check-d1-address.mjs:1 (CONTRACT, shortened)

what is refused and what is allowed, plus the two scan rules; the defect, the run id and the dates go to the history document.

```js
/**
 * Gate: no script addresses the site database BY NAME for a remote operation.
 *
 *   npm run check:d1-address
 *
 * ## THE DEFECT THIS REFUSES, measured in CI on 2026-09-08
 *
 * `wrangler d1 <cmd> dustinedwards` resolves the name through the
 * `d1_databases` entry in `wrangler.jsonc`, and uses THAT ENTRY'S id.
 * `wrangler.jsonc` is gitignored; a clean checkout bootstraps it from
 * `wrangler.jsonc.example`, whose id is the zero placeholder. So the by-name
 * spelling addresses a database that does not exist ON A RUNNER AND ONLY
 * THERE, and dies as 7404.
 *
 * `check:restore` found it the expensive way (run 34301357787). `check:backup`
 * had the same defect and had never run in CI, so nothing had noticed. The
 * queued item that produced this gate asked for it before a third victim was
 * found by a red run, which is the "a fix in N-1 of N sites is not a fix" shape
 * in FAILURES.md answered with an instrument instead of a sweep.
 *
 * ## WHAT IS REFUSED, AND WHAT IS NOT
 *
 * Refused: a `d1` subcommand whose database argument is the NAME, in a segment
 * that is not `--local`. `resolveD1Address` in `scripts/lib/d1-address.mjs` is
 * the only production spelling: it asks the account for the UUID and fails
 * closed.
 *
 * Allowed, deliberately:
 *
 *   `--local`      Miniflare keys state by the config id and there is no
 *                  account-side UUID to resolve. Asking for one would answer a
 *                  question about a different database.
 *   `d1 list`      the lookup itself, which takes no database argument.
 *   `d1 migrations` applied through wrangler by design (CLAUDE.md, Commands).
 *
 * ## SCOPE IS PROVEN NON-EMPTY BEFORE ANYTHING IS ASSERTED
 *
 * A sweep over zero files reports exactly what a clean sweep reports, and this
 * gate is a per-file loop over a glob. Hard rule 10, first discipline.
 *
 * ## COMMENTS ARE STRIPPED FIRST
 *
 * Every one of these files DESCRIBES the defect in prose, this one included. A
 * needle that matched a comment would fire on the documentation of the rule it
 * enforces, which is the "a comment can satisfy an assertion about code, and
 * can fail one" shape.
 */
```

### scripts/check-d1-address.mjs:60 (CONTRACT, shortened)

why enumerated and argued.

```js
/**
 * Files whose `d1 ... dustinedwards` strings are FIXTURES, never invocations.
 *
 * ENUMERATED AND ARGUED, never a glob. An exclusion naming a file excludes
 * everything in it, so each one states what it is and why the rule does not
 * reach it.
 */
```

### scripts/check-d1-address.mjs:113 (WHY, shortened)

why two forms and which subcommands cannot match.

```js
/**
 * A `d1` subcommand followed by the database NAME, in either spelling.
 *
 * Two forms, because both appear: the literal `dustinedwards`, and the
 * `${DB_NAME}` interpolation that several scripts bind to the same string. A
 * needle for the literal alone would miss every one of the second kind, which
 * is the "resolve bindings, not spellings" discipline.
 *
 * `d1 list` cannot match: it takes no database argument, so there is no name
 * after it. `d1 migrations` is excluded by name below rather than by hoping.
 */
```

### scripts/check-d1-address.mjs:124 (WHY, shortened)

where the boundary goes and why; the wrong counts and how it was caught go to the history document.

```js
/*
 * THE WORD BOUNDARY GOES INSIDE THE FIRST ALTERNATIVE, NOT AFTER THE GROUP.
 *
 * It was `(?:dustinedwards|\$\{DB_NAME\})\b`, and that trailing `\b` can never
 * match the second alternative: `}` is a non-word character and the next
 * character is a space, so there is no boundary between them. The needle
 * therefore saw the literal spelling and was BLIND to every `${DB_NAME}` site,
 * which is most of them. It reported 3 sites where there are 11, and one
 * violation where there are nine, and read as a nearly clean repo.
 *
 * Caught by counting the sites and disbelieving the number, which is the whole
 * reason the count is printed rather than just the violations.
 */
```

### scripts/check-d1-address.mjs:153 (WHY, shortened)

why preserveLines; one line.

```js
// `preserveLines`, because a reported line number that does not match the
  // file is worse than none: it sends the reader to the wrong place with
  // confidence. Without it the stripper collapses comment lines and every
  // number below is short by the length of the docblocks above the match.
```

### scripts/check-d1-address.mjs:169 (WHY, shortened)

why the flag is read from the line.

```js
/*
       * `--local` ON THE SAME LINE is what makes the name correct. Read from
       * the line rather than the file, so a `--local` belonging to some other
       * command cannot license this one. That is the same rule the deploy
       * hook applies to `--dry-run`, and for the same reason.
       */
```

### scripts/check-d1-address.mjs:192 (NUMBER, shortened)

why the sites are counted separately from the floor.

```js
/*
 * THE SITES ARE COUNTED AND THE COUNT IS PRINTED, because "0 violations" and
 * "0 lines examined" are the same output otherwise. The floor below counts
 * ASSERTIONS, and every assertion here comes from a site, so a corpus with no
 * by-name sites at all would floor at the scope check alone. That is why the
 * scope assertion is separate and unconditional.
 */
```

## scripts/lib/pending-migrations.mjs

### scripts/lib/pending-migrations.mjs:1 (CONTRACT, shortened)

what it is pure over, why it refuses and the three outcomes; the ship window, the migration and the dates go to the history document.

```js
/**
 * Does the deployed database have every migration this repo carries?
 *
 * PURE. It takes the text `wrangler d1 migrations list` printed and the list of
 * migration files on disk, and returns a verdict. It runs no command and
 * touches no network, which is what lets the RULE be unit tested against
 * recorded output instead of only against a live database.
 *
 * ## The defect this exists for, measured 2026-08-15
 *
 * SHIP WINDOW 5 deployed with every gate green and the media admin page
 * returned a 500 on its first load. `0011_media_trash_tags.sql` had been
 * pending on the remote database since the session that authored it, four
 * sessions earlier, so `trashed_at` and `tags` did not exist and every media
 * loader query threw.
 *
 * Nothing could see it. `npm run ship` applies no migrations and compares no
 * schema. `check:migrations` compares FILES to a hash manifest, never to a
 * database. `check:admin-ui` renders the route with every `.server` import
 * stubbed, so the loader never runs. `check:invariants --remote` would have
 * caught it and is in neither tier ship runs. Authoring a migration created an
 * obligation nowhere.
 *
 * ## Why this REFUSES rather than applying
 *
 * A deploy that silently mutates the production schema is worse than one that
 * stops. `0011` happened to be additive, two `ADD COLUMN` and an index, and
 * ship cannot tell that from a `DROP` or a rewrite: it would have to read and
 * classify SQL, and being wrong once is unrecoverable. The operator decides,
 * and this makes sure they are ASKED rather than finding out from a 500.
 *
 * ## Fail closed, with three outcomes and not two
 *
 * The dangerous shape here is a parser that reads "no pending migrations" from
 * output it did not understand. So "nothing pending" needs a POSITIVE signal,
 * and anything unrecognised is its own verdict:
 *
 *   pending      names are present. Refuse, listing them.
 *   clean        wrangler said so, in words. Proceed.
 *   unreadable   neither. Refuse, saying the output could not be read.
 *
 * An empty match set is never on its own evidence of a clean database.
 */
```

### scripts/lib/pending-migrations.mjs:51 (CONTRACT, shortened)

why anchored on the prefix.

```js
/**
 * A migration filename, as it appears both on disk and in wrangler's table.
 *
 * Anchored to the four-digit prefix this repo uses, so a stray word in a
 * warning banner cannot be mistaken for a migration.
 */
```

### scripts/lib/pending-migrations.mjs:66 (CONTRACT, shortened)

what it reads; one line already.

```js
/**
 * Reads a `wrangler d1 migrations list` run.
 *
 * @param {object} input
 * @param {number} input.code    the process exit code
 * @param {string} input.text    stdout and stderr, combined
 * @returns {MigrationVerdict}
 */
```

### scripts/lib/pending-migrations.mjs:75 (WHY, shortened)

why a non-zero exit is not clean.

```js
// A NON-ZERO EXIT IS NOT "NOTHING PENDING". Network down, auth expired, the
  // database renamed: every one of them exits non-zero and prints no names, and
  // treating that as clean is exactly how a guard becomes decoration.
```

### scripts/lib/pending-migrations.mjs:89 (WHY, shortened)

why the whole output is the scope and why an unscoped match is safe here.

```js
/*
   * SCOPED-BY the whole command output, deliberately, and there is no narrower
   * region to scope to: `body` is a few lines of wrangler stdout rather than a
   * document with elements, and these markers are wrangler's own sentinel
   * sentences. Matching one anywhere in its output IS the signal.
   *
   * The vacuity this rule guards against is handled by the design instead of by
   * the needle: neither marker matching does not mean "clean", it means
   * `unreadable`, and clean requires the positive marker AND no names. An
   * unscoped match here can only ever produce a MORE cautious verdict.
   */
```

### scripts/lib/pending-migrations.mjs:105 (WHY, shortened)

why names win; one line.

```js
/*
   * NAMES WIN OVER THE CLEAN MARKER, and the order matters.
   *
   * If output somehow contained both, the safe reading is that something is
   * pending. A guard that resolved the ambiguity toward "proceed" would be
   * choosing the outcome that ships.
   */
```

### scripts/lib/pending-migrations.mjs:124 (WHY, shortened)

which unreadable case is worth naming.

```js
/*
   * Everything else is UNREADABLE, including the case where names appear with
   * no heading and the case where nothing at all matched. The second is the one
   * worth naming: an empty parse of changed output looks identical to a clean
   * database, and this is the branch that refuses to let it.
   */
```

### scripts/lib/pending-migrations.mjs:141 (WHY, shortened)

why the exact invocation; one line already.

```js
/**
 * The remedy sentence, so nobody has to remember the command under pressure.
 *
 * The exact invocation, with the database name filled in, because a refusal
 * that says "apply your migrations" and makes the operator go looking is a
 * refusal that gets worked around.
 *
 * @param {string} database
 * @returns {string}
 */
```

## scripts/uptime-ensure.mjs

### scripts/uptime-ensure.mjs:1 (CONTRACT, shortened)

why an external monitor, why two, and the idempotency and contact rules; the measurements, the ids and the dates go to the history document.

```js
/**
 * Brings the external uptime monitors into step with this repo, idempotently.
 *
 *   node scripts/uptime-ensure.mjs            create or update, write the manifest
 *   node scripts/uptime-ensure.mjs --dry-run  say what it would do, change nothing
 *
 * ## WHY AN EXTERNAL MONITOR AT ALL
 *
 * Everything that currently watches this site watches it from inside
 * Cloudflare, or does not run. `workers/watchdog.ts` polls `/api/health` every
 * fifteen minutes through a SERVICE BINDING, which proves the Worker runs and
 * its invariants hold and proves nothing about whether a reader can reach the
 * site: that is stated in the watchdog's own docblock as the cost of the 1042
 * measurement. The one instrument that speaks from outside is
 * `.github/workflows/health.yml`, and its own notes record the schedule firing
 * 2 times against 96 expected on 2026-08-28. So the off-platform half of the
 * monitoring was a best-effort cron that measurably does not fire.
 *
 * This is that half, run by somebody else's computer.
 *
 * ## TWO MONITORS, AND THEY ANSWER DIFFERENT QUESTIONS
 *
 * MEASURED on production 2026-09-07. The home page answers in 89 and 99 ms
 * from `CF-Cache-Status: HIT` and carries
 * `public, s-maxage=600, stale-while-revalidate=86400`, so a 200 from it can
 * be served out of the edge cache long after the Worker stops answering. It
 * proves REACHABILITY and is a weak liveness signal by up to a day.
 *
 * `/api/health` carries `Cache-Control: no-store` and was measured
 * `CF-Cache-Status: BYPASS`, so every request reaches the Worker. Five samples:
 * 4.60, 3.73, 1.20, 1.72 and 1.58 seconds, because it runs five checks against
 * D1, both R2 buckets, AI Search and the GitHub Contents API. It proves the
 * Worker is ALIVE and its invariants hold.
 *
 * Neither is redundant and neither substitutes for the other, so both are here.
 *
 * ## IDEMPOTENT, AND MATCHED BY URL RATHER THAN BY NAME
 *
 * A monitor already existed when this was written (id 803937424, the home
 * page, created by hand), so "create two monitors" would have produced a
 * duplicate on its first run. Existing monitors are matched on the URL they
 * point at, because that is the thing that makes two monitors the same
 * monitor; a friendly name is a label a human edits in a dashboard, and
 * matching on it would create a second monitor the first time somebody renamed
 * one.
 *
 * The manifest is then written from what the API RETURNED, never from what
 * this program intended. A manifest recording an id from the request rather
 * than the response is a manifest that records a write that may not have
 * happened.
 *
 * ## THE ALERT CONTACT IS RESOLVED, NEVER INVENTED
 *
 * The account default email contact is looked up and its id assigned. If the
 * account has no active email contact this REFUSES rather than creating a
 * monitor that alerts nobody, which is the failure mode a monitoring setup
 * cannot afford: it looks exactly like a working one.
 *
 * @see scripts/check-uptime.mjs the gate that refuses when this has not run
 * @see scripts/lib/uptimerobot.mjs the measured v3 contract
 */
```

### scripts/uptime-ensure.mjs:91 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------- the alert contact */
```

### scripts/uptime-ensure.mjs:99 (WHY, shortened)

why active only; one line.

```js
/*
 * ACTIVE EMAIL CONTACTS ONLY. An unconfirmed contact exists in the list and
 * receives nothing, so assigning one would produce a monitor that alerts into
 * a void while every panel says it is configured.
 */
```

### scripts/uptime-ensure.mjs:119 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------ reconcile */
```

### scripts/uptime-ensure.mjs:133 (WHY, shortened)

why the contact travels with every write.

```js
/*
   * THE ALERT CONTACT TRAVELS WITH EVERY WRITE, create and update alike. A
   * monitor that lost its contact is the silent-failure shape again, and
   * re-asserting it costs nothing because the API takes the whole assignment
   * list on a PATCH.
   */
```

### scripts/uptime-ensure.mjs:161 (WHY, shortened)

why only the compared fields.

```js
/*
   * WHAT ACTUALLY DIFFERS, so a run that changes nothing says so. Comparing
   * the whole object would report a difference on every run, because the API
   * returns forty fields this program never sets.
   */
```

### scripts/uptime-ensure.mjs:194 (WHY, shortened)

why resume is its own call; the API's refusal goes to the history document.

```js
/*
   * RESUMED SEPARATELY, because `status` is NOT writable through PATCH: the
   * API answers 400 `property status should not exist`. A paused monitor is a
   * monitor somebody switched off, and this program's whole job is that the
   * two monitors are on.
   */
```

### scripts/uptime-ensure.mjs:215 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* ------------------------------------------------------------- manifest */
```

### scripts/uptime-ensure.mjs:232 (WHY, shortened)

why sorted and newline-terminated.

```js
/*
 * SORTED AND NEWLINE-TERMINATED, so a re-run that changed nothing produces a
 * byte-identical file and shows up as no diff at all. A manifest that churned
 * on key order would make every ship a spurious commit.
 */
```

## scripts/lib/mark.mjs

### scripts/lib/mark.mjs:1 (CONTRACT, shortened)

the seam and why no path data is stated here; the deleted harness and the session history go to the history document.

```js
/**
 * The site mark, as anything rendering it at build time embeds it.
 *
 * ONE definition with TWO readers, and the second reader is the point. This
 * lived inside `build-og.mjs` when it was written, where the only way for a
 * gate to see what the card actually embeds was to import the card template.
 * Last session proved the render by hand and then deleted the harness, leaving
 * the gap `check:logo` names in its own boundary: nothing in this repo looks at
 * the SHAPE of a rendered raster, so a satori or resvg upgrade that resampled
 * the embedded svg would pass every gate.
 *
 * So the mark moved here, and it is a real seam rather than an export added for
 * a test: `build:og` builds its card from `markElement()`, `check:logo` renders
 * that same node and compares it against the committed fixture. Neither one
 * reaches into the other, and the thing under test is the thing that ships.
 *
 * NO PATH DATA IS STATED IN THIS FILE. The mark's single source is
 * `app/components/site-logo.tsx`, which the Worker renders, and the four
 * `public/*.svg` are the fixtures `check:logo` compares that module against in
 * both directions. A Node script cannot import the .tsx without a build step,
 * so it reads the fixtures the gate already binds the component to: the same
 * source one hop along a link something else keeps honest. Hand-edit either
 * side and `check:logo` fails before any of this runs.
 */
```

### scripts/lib/mark.mjs:40 (WHY, shortened)

why resolved and why the light block.

```js
/**
 * The brand fill, RESOLVED from app.css rather than restated.
 *
 * `--mark-on-chrome` is the token the real header binds the mark to on brand
 * surface, and the light block is the one a card takes: a card is rendered once
 * and served into a feed with no idea which theme the reader prefers.
 */
```

### scripts/lib/mark.mjs:58 (CONTRACT, shortened)

how the brand paths are derived and the four fail-closed conditions.

```js
/**
 * The mark, on brand surface, sized and framed for an embedded render.
 *
 * WHICH PATHS ARE THE BRAND PATHS IS DERIVED, NOT LISTED. The light and dark
 * fixtures are identical except for the fills on the purple paths, so the paths
 * whose fill DIFFERS between the two files are exactly the ones that take a
 * brand colour, and the warm ones (identical in both) keep the fill the asset
 * gives them. Nothing here restates a hex or a path index.
 *
 * It fails closed on every way the fixtures could stop agreeing: a different
 * viewBox, a different path count, a path whose geometry differs between the
 * variants, or no differing fill at all, which would mean the brand paths were
 * no longer identifiable and would silently paint the mark in asset colours.
 *
 * @returns {Mark}
 */
```

### scripts/lib/mark.mjs:87 (WHY, shortened)

why the header crop; one line.

```js
// The HEADER crop, 78 15 232 328, because the band this sits in is the
  // header. The square master would sit in a 132px band surrounded by its own
  // whitespace.
```

### scripts/lib/mark.mjs:113 (WHY, shortened)

why the viewBox is padded to the box; the measured letterboxing and its date go to the history document.

```js
/*
   * SIZED FROM THE viewBox, AND THE viewBox PADDED TO THE BOX, never guessed.
   *
   * A width that is not the viewBox's aspect times the height is a squashed
   * mark, and satori will not say so. The subtler failure is the one measured
   * here: satori LAYS OUT at integer pixels but writes the embedded svg at the
   * viewBox's exact aspect, so 232x328 at 64px tall gives a 45.27px-wide image
   * inside a 45px-wide box, and resvg letterboxes the difference. The mark then
   * renders 0.4% short and 0.2px off centre, which is invisible and is also
   * enough to stop the render matching the fixture pixel for pixel, which is
   * how this mark is now proved: `check:logo` asserts a max channel delta of
   * ZERO. Measured by removing this padding and running that gate, 2026-08-14:
   * 348 of 2880 pixels differ and the max channel delta is 45.
   *
   * So the CROP is padded, symmetrically, until its aspect is exactly the
   * integer box's. Only the empty margin around the mark moves; no path is
   * touched, and the padding here is 1.96 viewBox units, under a fifth of a
   * rendered pixel.
   */
```

### scripts/lib/mark.mjs:149 (CONTRACT, shortened)

why JSX-free and what satori does with the node; the version measured goes to the history document.

```js
/**
 * The mark as one satori element node, JSX-free so no caller needs a build step.
 *
 * satori takes an inline `svg` node and emits it as an `<image>` whose href is
 * the same markup URL-encoded, so the path data reaches resvg VERBATIM: no
 * re-fitting, no simplification, no reinterpretation of the arcs. Measured on
 * satori 0.29.0, and asserted by `check:logo` against a rasterisation of the
 * fixture rather than believed.
 *
 * @param {Record<string, unknown>} [style] layout only. The caller owns where
 *   the mark sits; it does not own how the mark is drawn.
 * @returns {any}
 */
```

## scripts/build-stack.mjs

### scripts/build-stack.mjs:1 (CONTRACT, shortened)

what is derived, from which config, and what deliberately is not; the ruling, its date and the published-claims count go to the history document.

```js
/**
 * Emits the colophon's STACK half from the repo's own configuration.
 *
 *   npm run build:stack
 *
 * Ruling: colophon-page.md, 2026-08-05. The stack half of that page is
 * DERIVABLE, so it is derived: bindings from `wrangler.jsonc.example`, pinned
 * versions from `package.json`, migrations from `drizzle/`, gates from the
 * `check:*` scripts. The feature half is not derivable and is not in this file.
 *
 * **Why generated rather than written.** The ruling's evidence, not taste: a
 * hand-written reference page has a 100% chance of being wrong within a
 * quarter, because manual regeneration means nobody regenerates. This repo has
 * already published three quantitative claims that went wrong, and a page whose
 * entire subject is what the site is built from is the densest possible surface
 * for that failure.
 *
 * ## Everything is DERIVED. There is no list in this file.
 *
 * Not a single binding name, version, migration or gate name appears here as a
 * literal, and that is the whole design rather than a preference. A generator
 * carrying its own copy of the list is a mirror, and a mirror goes stale in the
 * direction that fails silently: it reports a smaller surface rather than an
 * error. `check-all.mjs` derives its gate list from package.json for exactly
 * this reason and is the model.
 *
 * The binding surface comes from `scripts/lib/wrangler-surface.mjs`, the same
 * enumerator `check:config` uses, so a binding kind neither of them knows about
 * is invisible to both rather than to one.
 *
 * **The EXAMPLE config, not the real one.** `wrangler.jsonc` is gitignored, so
 * a fresh clone cannot read it, and a generated artifact that only regenerates
 * on one machine is worse than no artifact. `check:config` is what keeps the
 * example describing the same binding surface as the real file, so deriving
 * from the example is not a weaker claim.
 *
 * ## What is NOT derived, and why that is honest
 *
 * The prose for each layer, `whyLoadBearing`, is hand-written and lives in
 * `content/stack-notes.json` beside this script. It is a MEASUREMENT, not a
 * fact about the config: "Durable Objects, because the ratelimit binding
 * refused 1, then 2, then 9, then 0 of twelve against a limit of five" is in no
 * config file and never will be. `check:stack` reconciles the two in both
 * directions, so a binding with no note and a note with no binding are both
 * failures, which is what stops the hand-written half rotting quietly.
 */
```

### scripts/build-stack.mjs:60 (WHY, shortened)

why devDependencies are excluded.

```js
/**
 * The runtime dependencies worth naming, derived from `dependencies` rather
 * than listed.
 *
 * `devDependencies` is deliberately excluded: a colophon describes what SERVES
 * the site, and a reader does not care that esbuild is present. The split is
 * package.json's own, so nothing here decides it.
 *
 * @param {any} pkg
 */
```

### scripts/build-stack.mjs:76 (WHY, shortened)

why the directory is read from the config.

```js
/**
 * Migrations, in applied order, from the directory D1 is pointed at.
 *
 * The directory is read out of the config's `migrations_dir` rather than
 * assumed, so a repo that moved them does not silently report zero.
 *
 * @param {string} migrationsDir
 */
```

### scripts/build-stack.mjs:90 (WHY, shortened)

why a set rather than a comparison; the date and the miscount go to the history document.

```js
/**
 * The `check:` scripts that RUN gates rather than being one.
 *
 * A named set rather than a comparison, because there are two of them now and
 * the second one caught this file out. The comment here already said "the
 * runners" in the plural while the filter compared against exactly one name, so
 * adding `check:ci` on 2026-08-20 would have put a runner in the colophon's
 * gate list and made the site claim 28 gates where 27 exist.
 */
```

### scripts/build-stack.mjs:101 (WHY, shortened)

one definition, and why derived at all; the date goes to the history document.

```js
/**
 * Every gate, derived from package.json's `check:*` scripts.
 *
 * ONE DEFINITION, imported by `check-all.mjs` rather than restated there.
 * Until 2026-08-20 both files implemented this filter separately, which is the
 * mirror class this repo keeps being bitten by: two derivations of one rule,
 * agreeing until the day one of them gains a case. That day was `check:ci`.
 *
 * A hardcoded list is how the next gate gets forgotten, which is why it is
 * derived at all.
 *
 * @param {any} pkg
 */
```

### scripts/build-stack.mjs:152 (CONTRACT, shortened)

what the version means; one line already.

```js
/**
     * Bumped when the SHAPE of this file changes, so a consumer written
     * against an older shape fails loudly rather than reading undefined.
     */
```

### scripts/build-stack.mjs:171 (WHY, shortened)

why pathToFileURL; the Windows measurement goes to the history document.

```js
// `pathToFileURL` rather than string surgery on process.argv[1]: on Windows the
// hand-built `file://C:\...` form never equals import.meta.url, so the generator
// silently did nothing when run directly.
```

## scripts/check-search.mjs

### scripts/check-search.mjs:1 (CONTRACT, shortened)

the boundary and the paired-negative rule; the worked example goes to the history document.

```js
/**
 * Gate for the query parser and rank fusion.
 *
 * OBSERVATION BOUNDARY: pure functions only, the parser and the fusion. It runs
 * no SQL, so it cannot see an index that is empty, drifted, or tokenising
 * differently from what the parser assumes.
 *
 *   npm run check:search
 *
 * Imports app/lib/search/query.mjs directly, so it exercises the parser the
 * Worker actually runs rather than a restatement of its rules. Pure functions
 * only: no database, no network, so it is safe to run anywhere and fast enough
 * to run on every build.
 *
 * EVERY RULE HAS A PAIRED NEGATIVE. A parser rule that has only ever been seen
 * matching has not been verified: a rule that fires on everything passes every
 * positive test there is. The negative case is what proves the rule has an
 * edge. The year rule is the clearest example, since a rule that turned any
 * four-digit number into a date filter would pass "2019 is a year" and would
 * silently make a search for port 8080 return nothing at all.
 */
```

### scripts/check-search.mjs:60 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// -- Rule 1: quoted phrases -------------------------------------------------
```

### scripts/check-search.mjs:78 (CONTRACT, shortened)

the negative and the ordering it forces; one line.

```js
// NEGATIVE: an operator inside quotes stays literal text. This is why the
// phrase rule has to run before the operator rule.
```

### scripts/check-search.mjs:86 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// -- Rule 2: field operators -------------------------------------------------
```

### scripts/check-search.mjs:111 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// -- Rule 3: bare year -------------------------------------------------------
```

### scripts/check-search.mjs:119 (WHY, shortened)

why this negative matters most.

```js
// NEGATIVE, and the one that matters most. A four-digit number outside the
// corpus range is a search term. Without this the query `8080` would filter
// every result away and return nothing, which reads as a broken site.
```

### scripts/check-search.mjs:128 (CONTRACT, shortened)

the negative and its ordering; one line.

```js
// NEGATIVE: ordering. tag:2026 is a tag, not a year, and only because the
// operator rule consumed it first.
```

### scripts/check-search.mjs:133 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// -- Empty and filter-only queries ------------------------------------------
```

### scripts/check-search.mjs:139 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// -- MATCH expression building ----------------------------------------------
```

### scripts/check-search.mjs:180 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// -- Rank fusion -------------------------------------------------------------
```

### scripts/check-search.mjs:182 (CONTRACT, shortened)

the property RRF exists for; one line already.

```js
// A document ranked second in BOTH lists beats one ranked first in only one.
// That is the whole point of RRF and the reason the two indexes can disagree
// without one of them dominating.
```

### scripts/check-search.mjs:213 (CONTRACT, shortened)

section marker plus the pair of facts it pins; the live finding and its date go to the history document.

```js
// -- Rule: the browse path, filters with nothing to match on -----------------
//
// Found live 2026-07-28. The parser was right and the query still returned
// nothing: a bare year leaves no text, so toMatchExpression returns null and
// the index path has nothing to run. These assertions pin the pair of facts a
// caller has to act on, that there is no MATCH expression AND that there is
// still a query to answer.
```

### scripts/check-search.mjs:256 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// -- Report ------------------------------------------------------------------
```

### scripts/check-search.mjs:264 (NUMBER, shortened)

what a loose floor cannot catch and how this one was measured; the old value, the dates and the sibling gates go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR, TIGHTENED 2026-08-14 from a bare literal 30.
 *
 * The old value was set to catch a run that did NOTHING, and it did that. What
 * it could not catch is the failure that actually happens, which is partial:
 * against a measured 48, a floor of 30 left 37 percent of this gate free to
 * stop running while the floor reported itself satisfied. Same lesson as
 * check:assertions moving 360 to 520 against 595, and verify-live's 90 against
 * 206.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 48.
 * Never summed. Floored at 45, roughly 6 percent: every assertion here is a
 * pure parser or fusion case over inline fixtures, so the count moves only when
 * a case is written.
 */
```

## scripts/build-guidelines.mjs

### scripts/build-guidelines.mjs:1 (CONTRACT, shortened)

why the strip stays and the discard goes, what is dropped and why the cap is loud; the ruling, the quoted lines and the shipped defect go to the history document.

```js
/**
 * Extract the stylesheets' reasoning into guidance the canvas can read.
 *
 * ## THE DEFECT, ruling 109
 *
 * `build-inputs.mjs` runs `stripCssComments` over every sheet on the way to
 * the bundle, and its own comment claimed "the comments are worth keeping
 * where they were written and worthless in a bundle a design agent consumes,
 * so nothing is lost by dropping them here."
 *
 * That claim is falsified. `public-chrome.css` lines 91 to 92 carry "The
 * `:visited` and `:hover` selectors are (0,2,0) and outrank the base
 * pseudo-class rules deliberately. Do not 'simplify' them away." The redesign
 * simplified them away and shipped a wordmark that turned visited-plum on the
 * purple bar. The canvas never saw the warning, because the strip had already
 * removed it.
 *
 * The strip STAYS. It exists for its own measured reason: the converter's
 * validator greps `_ds_bundle.css` for `@import` without stripping comments,
 * and `app.css`'s prose about having removed `@import "tailwindcss"` failed
 * that gate twice. The repair is not to stop stripping; it is to stop
 * DISCARDING. This script is where the reasoning goes instead.
 *
 * ## IT IS NOT A GATE AND MAKES NO ASSERTION
 *
 * It is a build step. `check:design-sheets` owns whether the sheet list is
 * right; this reads that list and writes files. Output is gitignored, because
 * a committed copy would be a second owner of prose the stylesheets already
 * own (hard rule 17) and would drift the moment a comment was edited.
 *
 * ## WHAT IT DOES NOT SHIP
 *
 * Build-only narration. A block about the converter, a gate, a migration or a
 * lockfile tells a design agent nothing and spends the budget that the rules
 * it CAN break need. A block is dropped when it reads as build talk and
 * carries no design signal, never on the build needle alone.
 *
 * ## THE CAP IS HONEST RATHER THAN SILENT
 *
 * Each file is capped near 16 KB. Blocks are emitted strongest first, by how
 * many independent design needles they hit, and anything that does not fit is
 * NAMED on stdout with its source and line. A truncation nobody can see is the
 * same class of defect as a search over an empty scope.
 */
```

### scripts/build-guidelines.mjs:60 (CONTRACT, shortened)

why the order decides placement.

```js
/**
 * The four destinations, in priority order. A block lands in the FIRST file
 * whose needles it hits, so the order here decides where an overlapping block
 * goes: chrome before layout, because a bar rule that also mentions z-index is
 * a chrome rule first.
 */
```

### scripts/build-guidelines.mjs:146 (WHY, shortened)

why a design needle wins.

```js
/**
 * Build talk. Present on its own, a block is dropped; present alongside a
 * design needle, the design needle wins, because a comment often explains a
 * design rule BY naming the gate that holds it.
 */
```

### scripts/build-guidelines.mjs:171 (WHY, shortened)

why the singletons are described and why the mapping is hand-written; the quoted note and the redesign go to the history document.

```js
/**
 * The page singletons: real parts of the site the sync cannot ship as
 * components, described so the canvas at least knows what they ARE.
 *
 * NOTES.md excludes these from the component sync because "nothing there is
 * composable by a design agent", and that is true about INSTANTIATION and says
 * nothing about visibility. An agent that cannot instantiate the header can
 * still be told what the header is, and the 2026-09 redesign proves the cost of
 * not telling it.
 *
 * The component-to-sheet mapping is HAND-WRITTEN, because nothing in the repo
 * declares it: a sheet does not name the component it styles.
 */
```

### scripts/build-guidelines.mjs:186 (WHY, shortened)

which sheet and what the wrong one would have sent; the rename and the date go to the history document.

```js
// shell.css, NOT public-chrome.css. The footer was renamed `.site-footer` to
  // `.site-shell-footer` and moved sheets; the dead rules public-chrome.css
  // still carried were deleted 2026-09-16, so mapping it there would have sent
  // the canvas the HEADER's tokens as the footer's.
```

### scripts/build-guidelines.mjs:195 (WHY, shortened)

why hand-written; one line.

```js
/**
 * HAND-WRITTEN. The rulings that bind the singletons cannot be derived from the
 * source: a ruling lives in the decisions log, and the code carries its effect
 * rather than its authority.
 */
```

### scripts/build-guidelines.mjs:227 (CONTRACT, shortened)

what it reads and why; one line already.

```js
/**
 * A module's leading doc comment: the reasoning a component carries about
 * itself, which the stylesheet extractor never sees because it reads only CSS.
 * @param {string} source
 */
```

### scripts/build-guidelines.mjs:237 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Literal className values, which are the vocabulary the canvas composes with.
 * @param {string} source
 */
```

### scripts/build-guidelines.mjs:249 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Every custom property a sheet READS, which is what the singleton consumes.
 * @param {string} css
 */
```

## scripts/lib/page-payload.mjs

### scripts/lib/page-payload.mjs:1 (CONTRACT, shortened)

why derived, from which two sources, and what the walk cannot see.

```js
/**
 * What a cold load of one public route actually fetches, resolved offline.
 *
 * Split out of `check-page-payload.mjs` on the footing `ci-status.mjs` and
 * `ask-converge.mjs` stand on: the DECISION is a pure function over a manifest
 * and a set of source files, and a pure function can be driven by tests. The
 * gate supplies the disk.
 *
 * ## WHY THIS IS DERIVED AND NOT DECLARED
 *
 * A hand-kept list of "what /blog loads" is the mirror this repo keeps paying
 * for: it goes stale in the direction that hides bytes from the gate. Two
 * sources are read instead, and neither is written by hand.
 *
 *   STYLESHEETS come from React Router's own browser manifest, which is the
 *   list the framework will emit `<link>` tags from. Root's sheets plus the
 *   route's, which is exactly what the document carries.
 *
 *   ENHANCEMENT BUNDLES come from a reachability walk over the route's import
 *   graph. A bundle reaches a page by being `?url`-imported by some component
 *   the route renders, so "which bundles does this route serve" is "which
 *   `~/enhance/dist/*.js?url` specifiers are reachable from this route module
 *   or from root". The walk follows `~/` and relative imports inside `app/`
 *   and stops there.
 *
 * ## WHAT THE WALK CANNOT SEE, stated because it bounds every count below
 *
 * Reachability is not rendering. A component that imports a bundle inside a
 * branch the route never takes still counts here, so this OVER-approximates,
 * and it over-approximates in the safe direction for a byte ceiling. It also
 * cannot see a bundle fetched at runtime rather than imported: the search
 * palette is fetched by `theme.ts` on a gesture, from a URL carried on a data
 * attribute, so it is correctly NOT part of any page's cold load and is
 * reported separately by the gate.
 */
```

### scripts/lib/page-payload.mjs:39 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Module specifiers a source file imports, normalised to absolute paths inside
 * `app/`, plus the raw `?url` specifiers, which are assets rather than modules.
 *
 * @param {string} source @param {string} file @param {string} appDir
 */
```

### scripts/lib/page-payload.mjs:50 (WHY, shortened)

why an import is not a fetch and which component decides; the named module goes to the history document.

```js
/*
   * A `?url` IMPORT IS NOT A FETCH, and conflating the two was this walk's
   * first bug. `search-trigger.tsx` imports the palette bundle's URL so it can
   * put it on a data attribute; the page does not fetch that bundle, a gesture
   * does. Counting the import made every route look like it served a search
   * dialog, which is the opposite of what the split achieved.
   *
   * What puts an enhancement bundle on a page is `<EnhancementScript>`, which
   * renders the script tag. So an `enhance/dist` asset counts only when the
   * file that names it also renders that component. Every other `?url` asset,
   * a font or a stylesheet handed to something at runtime, is collected
   * unconditionally: the callers filter by what they are asking about.
   */
```

### scripts/lib/page-payload.mjs:79 (CONTRACT, shortened)

cycle safety and why an unresolved specifier is skipped.

```js
/**
 * Every `?url` asset specifier reachable from `entry`, following imports
 * inside `app/`.
 *
 * Cycle-safe by construction: a file is expanded once. Extensions are probed
 * because a specifier omits them, and a specifier that resolves to nothing is
 * SKIPPED rather than thrown on, since the walk deliberately does not know
 * about node_modules, virtual modules or the vite alias table.
 *
 * @param {string} entry absolute path to a route or root module
 * @param {string} appDir
 * @param {(path: string) => string | null} read returns source or null
 */
```

### scripts/lib/page-payload.mjs:112 (CONTRACT, shortened)

what it resolves; one line already.

```js
/**
 * A specifier to a real file, trying the extensions a TypeScript project omits.
 *
 * @param {string} path @param {(path: string) => string | null} read
 */
```

### scripts/lib/page-payload.mjs:132 (CONTRACT, shortened)

why the order is the manifest's.

```js
/**
 * The stylesheets a route's document links, root's first then its own.
 *
 * Order matters and is the manifest's: root is the parent match, so its sheets
 * arrive first, which is the cascade the site depends on since the per-route
 * split.
 *
 * @param {any} manifest React Router's browser manifest
 * @param {string} routeId
 */
```

### scripts/lib/page-payload.mjs:150 (WHY, shortened)

why only @font-face.

```js
/**
 * Font files a set of stylesheets reference from `@font-face`, as asset paths.
 *
 * Only `@font-face`, deliberately. A `url()` elsewhere in a stylesheet is a
 * background image or a mask and is fetched only if something matches; a
 * `@font-face` src is fetched whenever the family is used, which on this site
 * is every page.
 *
 * @param {string[]} cssText
 */
```

## scripts/operator-roundtrip.mjs

### scripts/operator-roundtrip.mjs:1 (CONTRACT, shortened)

why two phases, the token rule, what it checks against and the dash fixture.

```js
/**
 * The operator publish round trip, run against a deployed Worker.
 *
 *   node scripts/operator-roundtrip.mjs a          steps 1 and 2
 *   node scripts/operator-roundtrip.mjs b          steps 3 to 9
 *
 * Split into two phases because step 3 is a HUMAN action: the first publication
 * of a post is reserved to the admin, so the round trip cannot be driven end to
 * end by the thing it is testing. That is the point of the test.
 *
 * The token is read from a file whose path is given by OPERATOR_TOKEN_FILE, and
 * it is never printed, logged, or included in an error. Nothing here echoes a
 * request header.
 *
 * Every assertion that matters is checked against GitHub and the public
 * surfaces, not against the API's own report of what it did. An endpoint saying
 * "created" is not evidence that a commit exists.
 *
 * NOTE ON THE DASH FIXTURE: step 7 has to submit a wide dash on purpose. It is
 * built from its CODE POINT rather than typed, so this file contains no wide
 * dash of its own and stays clean under the house rule. Same treatment the
 * pipeline's WIDE_DASH regex gets, and the same reason.
 */
```

### scripts/operator-roundtrip.mjs:65 (CONTRACT, shortened)

what it calls and the logging rule; one line already.

```js
/**
 * Calls one operator tool. Never logs the Authorization header.
 * @param {string} name
 * @param {Record<string, unknown>} [args]
 * @returns {Promise<{status: number, body: any}>}
 */
```

### scripts/operator-roundtrip.mjs:123 (CONTRACT, shortened)

what it asks; one line already.

```js
/**
 * Is the slug visible anywhere a reader or an agent would find it?
 * @returns {Promise<Record<string, any>>}
 */
```

### scripts/operator-roundtrip.mjs:130 (WHY, shortened)

why whole-document scope and why one loop.

```js
/*
   * SCOPED-BY: the whole document, deliberately, on all six surfaces. A slug
   * present ANYWHERE on an index, a feed or a manifest is exactly the
   * propagation being asserted; narrowing to one element would test the
   * template rather than the propagation.
   *
   * Collapsed from six near-identical lines into one loop, so there is ONE
   * assertion site to annotate. check:assertions reads one line up, and a rule
   * that scanned far enough to cover a six-line block would let an annotation
   * drift away from the site it excuses.
   */
```

### scripts/operator-roundtrip.mjs:153 (WHY, shortened)

why the search assertion is narrowed.

```js
// Scope the search assertion to the results themselves. The zero state
  // renders a recent-writing list carrying the same links, and a page-wide
  // match would pass against a zero-result page.
```

### scripts/operator-roundtrip.mjs:175 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 1. Operator creates a draft -------------------------------------- */
```

### scripts/operator-roundtrip.mjs:185 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- verified against GitHub, not against the API's own report --------- */
```

### scripts/operator-roundtrip.mjs:195 (WHY, shortened)

what a second file in a save commit would mean; the artifact arc goes to the history document.

```js
// INVERTED with the artifact arc: a save used to carry the markdown AND
      // the regenerated corpus artifact; git holds markdown only now, so a
      // second file in a save commit is a regression to the two-writer world.
```

### scripts/operator-roundtrip.mjs:219 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- D1 row and draft exclusion --------------------------------------- */
```

### scripts/operator-roundtrip.mjs:235 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 2. The refusal, which is a required pass ------------------------- */
```

### scripts/operator-roundtrip.mjs:261 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 3. The human published it ---------------------------------------- */
```

### scripts/operator-roundtrip.mjs:281 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 4. Operator edits the live post ---------------------------------- */
```

### scripts/operator-roundtrip.mjs:298 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 5. Unpublish, then republish ------------------------------------- */
```

### scripts/operator-roundtrip.mjs:318 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 6. Forgery ------------------------------------------------------- */
```

### scripts/operator-roundtrip.mjs:345 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 7. Wide dash ----------------------------------------------------- */
```

### scripts/operator-roundtrip.mjs:367 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 8. Rate limit, CONCURRENT ---------------------------------------- */
```

### scripts/operator-roundtrip.mjs:369 (WHY, shortened)

why concurrent; the measured sequential run goes to the history document.

```js
// Sequential is the recorded trap: 36 sequential requests against 30 per 60s
  // produced ZERO refusals, because the loop straddled the window boundary and
  // reads exactly like a dead limiter.
```

### scripts/operator-roundtrip.mjs:384 (CONTRACT, shortened)

section marker, rule padding cut.

```js
/* --- 9. Delete -------------------------------------------------------- */
```

### scripts/operator-roundtrip.mjs:386 (WHY, shortened)

why the wait; one line already.

```js
// The burst may have consumed the window, so wait it out rather than
  // reporting a rate-limit refusal as a delete failure.
```

## scripts/check-llms.mjs

### scripts/check-llms.mjs:1 (CONTRACT, shortened)

the boundary, the three assertions and the fail-closed rule; the stale row, the drifted copy and the byte counts go to the history document.

```js
/**
 * Gate: `content/llms.txt` is the source of truth for the `llms.txt` settings
 * row, and nothing may drift from it.
 *
 * OBSERVATION BOUNDARY: compares the committed llms.txt against the settings row
 * it seeds. It does not fetch /llms.txt, so it cannot see the route failing to
 * serve what the row holds.
 *
 *   npm run check:llms                 pure checks only
 *   npm run check:llms -- --local      also compare against the local D1 row
 *   npm run check:llms -- --remote     also compare against the remote D1 row
 *
 * Why this exists. Before 2026-08-02 the live row was 2371 bytes of current copy
 * and the ONLY thing that ever wrote it was `0001_init.sql`, which seeds 247
 * bytes of the virology copy retired on 2026-07-27. Nothing re-seeded it, so a
 * rebuilt site would have served a stale, wrong llms.txt and nothing could have
 * noticed. Found while writing RECOVERY.md.
 *
 * The route carried a second copy too, a hand-maintained template literal under
 * a comment reading "If you change one, change the other". It had already
 * drifted: byte-identical to the row except for 62 CRs, because that .ts file is
 * CRLF on a Windows checkout and the row is LF. So the site served different
 * bytes depending on whether the row existed.
 *
 * Three things are asserted, and the first two are PURE so they run everywhere
 * and cannot be skipped:
 *
 *   1. the tracked file exists, is non-empty, and is LF-only
 *   2. the route does not carry its own copy: it imports the file
 *   3. with --local or --remote, the D1 row is byte-identical to the file
 *
 * FAILS CLOSED. A missing file, an unparseable query result or a wrangler
 * failure is a failure, never a skip.
 */
```

### scripts/check-llms.mjs:74 (WHY, shortened)

why bytes and an explicit decode; one line already.

```js
// Read as BYTES and decode explicitly. This file is compared byte for byte and
// the platform text layer is cp1252 on this host.
```

### scripts/check-llms.mjs:79 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// ---- 1. the file itself -----------------------------------------------------
```

### scripts/check-llms.mjs:96 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// ---- 2. the route does not keep its own copy --------------------------------
```

### scripts/check-llms.mjs:104 (CONTRACT, shortened)

what shape is refused; one line already.

```js
// The specific shape that rotted: a multi-line template literal holding the
// document. One line is fine (`const FALLBACK = llmsTxt;`); sixty is the bug.
```

### scripts/check-llms.mjs:117 (CONTRACT, shortened)

section marker, rule padding cut.

```js
// ---- 3. the D1 row ----------------------------------------------------------
```

### scripts/check-llms.mjs:126 (WHY, shortened)

why retried once; the error code and the occurrences go to the history document.

```js
// RETRIED ONCE. Remote D1 reads have failed with Cloudflare error 10000
  // twice, both clean immediately after. Read only.
```

### scripts/check-llms.mjs:183 (NUMBER, shortened)

why slack of zero and why one floor covers both tiers; the measurement and its date go to the history document.

```js
/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 6 in
 * the pure offline tier. Never summed. Floored at 6, slack of ZERO, and the
 * zero is the point: this gate is SMALL, so one skipped assertion is a sixth of
 * it and there is no natural movement to absorb. The remote tier only ADDS the
 * D1 row comparison, so a floor set on the offline figure holds for both.
 */
```

### scripts/check-llms.mjs:192 (WHY, shortened)

what the binding is for and what is deliberately not checked; the wrong host goes to the history document.

```js
/*
 * THE CONTACT URL IS BOUND TO SITE_ORIGIN, in both directions.
 *
 * `content/llms.txt` is a tracked literal, so it cannot import anything and its
 * contact line was typed by hand. It said `https://dustinedwards.info` while
 * `SITE_ORIGIN` is the workers.dev host, so the one machine-readable file whose
 * entire audience is crawlers pointed them at the LEGACY WORDPRESS SITE rather
 * than at this one.
 *
 * The gate is the binding a literal file cannot express. At DNS cutover
 * `SITE_ORIGIN` changes and this goes red until llms.txt follows, which is the
 * point: the two move together or the build says so.
 *
 * The heading on line 1 is deliberately NOT checked. `# dustinedwards.info` is
 * the site's NAME, which is that domain either way, and is not a claim about
 * where anything is served from.
 */
```

### scripts/check-llms.mjs:236 (NUMBER, shortened)

why named per branch even with one value; the two readings and their date go to the history document.

```js
/*
   * NAMED PER BRANCH, vol 15 binding, even though one VALUE covers both: 9
   * offline and 11 with --remote, measured 2026-09-06, and 11 minus the
   * tolerance is 8, so the offline floor of 9 is the stricter of the two and
   * is kept for both. The names still differ, because a single name would let
   * whichever branch ran last be judged against the other's reading.
   */
```

## scripts/ae-probe.mjs

### scripts/ae-probe.mjs:1 (CONTRACT, shortened)

the question, the three fetches, the weighting rule and the observation boundary; the file and line references go to the history document.

```js
/**
 * Does a CACHED serve reach the Worker, and therefore Analytics Engine?
 *
 * The cockpit's traffic panel counts what Analytics Engine recorded. With
 * `cache.enabled` on, an edge HIT may never invoke the Worker, in which case
 * the panel is counting ORIGIN REQUESTS rather than reads, and it has to say
 * so. This script measures which it is, before any panel exists.
 *
 *   npm run ae-probe
 *
 * It needs a Cloudflare API token with Account, Account Analytics, Read, in
 * ANALYTICS_READ_TOKEN. It fails closed and prints a plain sentence if the
 * variable is absent. IT NEVER PRINTS THE TOKEN, any request header, or any
 * URL carrying a credential. The final block is numbers only and is safe to
 * paste anywhere.
 *
 * METHOD. Three fetches, each followed by its own poll, so a point is
 * attributable to the fetch that caused it rather than to a batch:
 *
 *   W  plain GET, warms the edge entry              expect MISS
 *   H  plain GET again, should come from the cache  expect HIT
 *   N  GET with `cache-control: no-cache`           expect a bypass
 *
 * W exists because a cache-eligible fetch that MISSES proves nothing about a
 * HIT: it reaches the origin by definition. Only H answers the question.
 *
 * THE BYPASS MECHANISM IS NOT INVENTED HERE. It is read from the live gate:
 * `scripts/verify-live.mjs:108` sends `cache-control: no-cache` on every
 * request, and the cache-eligible plain GET is that file's `warm` helper at
 * `scripts/verify-live.mjs:992` to `997`, which deliberately omits the header
 * because cache behaviour is its subject.
 *
 * EVERY COUNT IS SAMPLING WEIGHTED. Analytics Engine samples, and the
 * documented way to count events is `SUM(_sample_interval)`, not `COUNT()`.
 * A raw `COUNT()` silently undercounts the moment sampling engages, so the
 * weighted figure is the measurement and the row count is carried only as a
 * diagnostic that shows whether sampling is active at all.
 *
 * OBSERVATION BOUNDARY. `writeDataPoint` is fire and forget and
 * `workers/app.ts:286` swallows any throw, so a point that APPEARS is strong
 * evidence the Worker ran, while a point that does NOT appear is weaker
 * evidence that it did not: the write could have been dropped instead. The
 * report states that ambiguity whenever a fetch produces no point.
 */
```

### scripts/ae-probe.mjs:50 (WHY, shortened)

why both are read rather than written here; the date goes to the history document.

```js
/*
 * NEITHER OF THESE IS WRITTEN OUT HERE ANY MORE. 2026-08-28.
 *
 * The origin is imported from `app/lib/seo.ts`, which is the one owner: a
 * second copy is the one that goes stale at the DNS cutover and then probes a
 * host nobody is serving.
 *
 * The account id is read off the environment and refused if absent, on the
 * portfolio rule that account-scoped identifiers stay out of git. It is an
 * identifier rather than a credential, which is why it is a `var` in the
 * Worker's config and not a `wrangler secret`; that makes it fine to hold in an
 * environment variable and still not fine to commit. `check:config` refuses to
 * find the real value anywhere tracked.
 */
```

### scripts/ae-probe.mjs:100 (CONTRACT, shortened)

what it runs; one line already.

```js
/**
 * Runs one read-only statement against the SQL API.
 *
 * @param {string} query
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
```

### scripts/ae-probe.mjs:127 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Sampling-weighted origin requests for PATH, plus the raw row count.
 *
 * @returns {Promise<{ weighted: number, rows: number }>}
 */
```

### scripts/ae-probe.mjs:145 (CONTRACT, shortened)

why the baseline settles first; one line already.

```js
/**
 * Polls until the weighted count settles: STABLE_READS consecutive equal
 * readings. Used for the baseline so the experiment does not start mid flight.
 *
 * @returns {Promise<{ weighted: number, rows: number, waited: number }>}
 */
```

### scripts/ae-probe.mjs:165 (CONTRACT, shortened)

what one fetch does; one line already.

```js
/**
 * One fetch. `bypass` sends the verify-live no-cache header.
 *
 * @param {string} label
 * @param {boolean} bypass
 * @returns {Promise<string>} the cf-cache-status
 */
```

### scripts/ae-probe.mjs:183 (CONTRACT, shortened)

what it waits for; one line already.

```js
/**
 * Polls until the weighted count rises above `from`, or the cap elapses.
 *
 * @param {number} from
 * @returns {Promise<{ weighted: number, rows: number, lag: number | null }>}
 */
```

## scripts/lib/decisions-volumes.mjs

### scripts/lib/decisions-volumes.mjs:1 (CONTRACT, shortened)

why the limit is read, why the highest number is the signal and why history is not checked; the volumes, the byte counts and the dates go to the history document.

```js
/**
 * WHICH DECISIONS VOLUME IS ACTIVE, AND HAS IT PASSED ITS OWN FREEZE POINT.
 *
 * Pure, so the replay proof can drive it without a network. The fetching lives
 * in check-volumes.mjs; everything that can be wrong about the ANSWER is here.
 *
 * ## THE DEFECT THIS IS FOR
 *
 * Every volume's header states its own limit, "Freeze at 20KB." Vol 17
 * respected it and froze at 20.6KB. Vol 18 ran to 36,667 bytes, 79 percent
 * past, and stayed there for four days. Nothing gated it: the limit was a
 * sentence inside the artifact it limited, enforced by whoever happened to read
 * it. Third instance in two days, after the carried-token map's build-4
 * deadline and check:contrast's pairs against surfaces nothing paints.
 *
 * ## THE LIMIT IS READ, NEVER HARD-CODED
 *
 * Hard rule 17, one owner per fact. The number lives in the volume that owns
 * it, this parses it, and nothing here restates it. A volume that wants a
 * different limit says so in its own header and this follows.
 *
 * ## "ACTIVE" IS THE HIGHEST NUMBER, NOT THE TITLE, AND THAT IS MEASURED
 *
 * The obvious test is the title, which says "(active)" or "(FROZEN ...)". It
 * does not work, and the reason is the finding rather than an inconvenience:
 * MEASURED 2026-09-15 across the namespace, volumes frozen for days still carry
 * "(active)" in their titles, while vol 18's own header records vol 17 as
 * frozen on 2026-09-11. Capsid's `status` field is no better: vol 18 is
 * "published" while vols 2 to 5, frozen since August, are "active".
 *
 * THE COUNT IS THE GATE'S TO PRINT, not this comment's to carry. check:volumes
 * names them on every run; a number written here would be a second owner that
 * rots, which is the rule this whole gate exists to enforce elsewhere.
 *
 * A title is a written record read as a current property, which is the shape
 * FAILURES.md carries a line about. So it is not the signal. The HIGHEST
 * NUMBERED volume is the active one, which is true by construction: a new
 * volume is opened by taking the next number, and that is the act of freezing
 * the previous one whether or not anybody retitled it.
 *
 * Everything below the highest number is history and is NOT checked. A frozen
 * volume over its limit is a fact about the day it froze; failing on it would
 * red the gate forever over something nobody can now change, and a gate that
 * cannot go green is one somebody deletes.
 */
```

### scripts/lib/decisions-volumes.mjs:47 (CONTRACT, shortened)

why stated once; one line already.

```js
/** KB as 1024 bytes. Stated once, here, because two readings of "KB" would be
 *  two owners of the threshold. */
```

### scripts/lib/decisions-volumes.mjs:51 (CONTRACT, shortened)

what is matched and what is not; one line already.

```js
/** `decisions-vol-<n>.md`. `decisions.md` is vol 6 by its title alone and is
 *  long frozen; it is not matched, and it cannot be the highest number. */
```

### scripts/lib/decisions-volumes.mjs:55 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * The limit a volume states for itself.
 * @param {string} body
 * @returns {number | null} bytes, or null when the volume states no limit
 */
```

### scripts/lib/decisions-volumes.mjs:61 (WHY, shortened)

why anchored on the words; the two spellings go to the history document.

```js
/*
   * Anchored on the words, not on the emphasis. Vol 18 writes it bare inside a
   * bold run and vol 19 writes it as its own bold phrase; matching the markdown
   * would make the gate care about styling, which is the kind of needle that
   * silently stops matching.
   */
```

### scripts/lib/decisions-volumes.mjs:71 (CONTRACT, shortened)

the returned shape; type annotation only.

```js
/**
 * @param {Array<{path: string, title?: string, body: string}>} docs
 * @returns {{
 *   volumes: Array<{path: string, n: number, bytes: number}>,
 *   active: {path: string, n: number, bytes: number, limit: number | null} | null,
 *   staleTitles: string[],
 * }}
 */
```

### scripts/lib/decisions-volumes.mjs:99 (WHY, shortened)

why reported rather than failed; the count goes to the history document.

```js
/*
   * REPORTED, NOT FAILED. A volume below the top that still says "(active)" is
   * a stale title, and there are eleven of them. Failing on it would red the
   * gate over history nobody is going to retitle; naming them is the useful
   * half, and it is how the next reader learns the titles cannot be trusted.
   */
```

### scripts/lib/decisions-volumes.mjs:106 (WHY, shortened)

why the looser anchor; the counts it moved go to the history document.

```js
// `\(active\b` rather than `\(active\)`: vols 2 to 5 are titled "Decisions
    // (active volume)", and the tighter needle missed all four of them. The
    // count this reports moved from 8 to 12 on that one character, which is
    // hard rule 10's anchor-every-needle discipline arriving as a number.
```

## scripts/health-repair.mjs

### scripts/health-repair.mjs:1 (CONTRACT, shortened)

the two exit codes, why one re-poll and the token rule; the Windows measurement and the dates go to the history document.

```js
/**
 * SELF-REPAIR FOR A FAILING HEALTH RUN. The I/O half.
 *
 *   node scripts/health-repair.mjs --origin <origin> --body body.json
 *
 * Called by `.github/workflows/health.yml` when `/api/health` reports
 * unhealthy. Decides through `app/lib/health/repair.mjs`, performs the
 * repairs that decision allows, re-polls ONCE, and exits.
 *
 * ## EXIT CODES ARE THE ALERT
 *
 * Exit 0 means the run may pass: something drifted, this repaired it, and the
 * re-poll came back healthy. Exit 1 means a person is emailed. There is no
 * third state, because a scheduled workflow has exactly two outcomes a human
 * ever sees.
 *
 * **`process.exitCode`, NEVER `process.exit()`.** Measured 2026-08-24 while
 * driving this against a stub: calling `process.exit(1)` immediately after a
 * fetch terminated node with 0xC0000409 on Windows rather than with 1, because
 * the exit raced the HTTP socket teardown. The annotation had already printed,
 * so the run would still have failed and the cause would have been invisible;
 * an exit code nobody can explain is a bad thing to hand a monitor. Setting the
 * code and returning lets node drain and exit normally.
 *
 * ## ONE RE-POLL, NOT A LOOP
 *
 * Both repairs derive their own converged verdict before answering, so a
 * successful call has ALREADY proved the index agrees; the re-poll exists to
 * confirm the endpoint agrees too, and to catch anything else that broke while
 * this ran. A loop here would be a monitor arguing with itself: if one repair
 * through the front door did not fix it, the next thing to happen should be a
 * person reading the log, not a second write.
 *
 * That is a deliberate difference from `ship`'s Ask step, which DOES poll. Ship
 * polls because it read the counts back within milliseconds of the upload and
 * AI Search is eventually consistent. This runs at least one scheduled interval
 * after any such write, so there is no visibility lag left to wait out.
 *
 * ## THE TOKEN
 *
 * Read from OPERATOR_TOKEN in the environment, which the workflow sets from a
 * repository secret. It is never logged, never an argument, and its ABSENCE is
 * reported as a named configuration state rather than as a failure to repair.
 */
```

### scripts/health-repair.mjs:59 (CONTRACT, shortened)

what the two fields mean; one line already.

```js
/**
 * One repair call.
 *
 * @returns {Promise<{ miss: string, unrepairable: boolean }>} `miss` is empty
 * when the tool converged. `unrepairable` marks a refusal that repeating this
 * call cannot fix, which is a different thing from a repair that did not work.
 */
```

### scripts/health-repair.mjs:87 (WHY, shortened)

why the rule lives in the decision module.

```js
// The server's own sentence and the 422 rule both live in the decision
  // module, because the watchdog makes the identical call and the two copies of
  // this had already drifted. Grounds on `refusalMiss`.
```

### scripts/health-repair.mjs:153 (WHY, shortened)

why a refusal abandons the rest; the date and the two refusals go to the history document.

```js
/*
     * A REFUSAL ABANDONS THE REST OF THE PLAN, and the ordering argument in
     * `REPAIRABLE` is why. `sync_ask` reads `search_docs`, which `sync_posts`
     * rewrites; that comment already says content must land before the Ask
     * upload reads the store it feeds from. When the content repair REFUSED,
     * the store is not merely stale, it is known-stale, and uploading it is a
     * write made on a premise the previous call just denied. On 2026-09-09 the
     * loop ran `sync_ask` anyway and reported two 422s where one had any
     * meaning.
     */
```

### scripts/health-repair.mjs:186 (CONTRACT, shortened)

what the re-poll adds; one line already.

```js
/*
   * THE RE-POLL. The repair proved its own index; this proves the ENDPOINT is
   * healthy, which is a wider claim and the one the workflow reports on.
   */
```

## scripts/lib/d1-address.mjs

### scripts/lib/d1-address.mjs:1 (CONTRACT, shortened)

the rule, why --local keeps the name, and the fail-closed direction; the defect, the run id and the dates go to the history document.

```js
/**
 * How a script ADDRESSES the site database, which is not always its name.
 *
 * ## THE DEFECT, measured in CI on 2026-09-08
 *
 * `wrangler d1 <cmd> <name>` resolves the name through the `d1_databases` entry
 * in `wrangler.jsonc` and uses THAT ENTRY'S `database_id`. `wrangler.jsonc` is
 * gitignored, so a clean checkout bootstraps it from `wrangler.jsonc.example`,
 * whose `database_id` is the placeholder `00000000-0000-0000-0000-000000000000`.
 * A `--remote` run there addresses a database that does not exist and dies as
 * 7404 (`check:restore`, run 34301357787).
 *
 * It fails ON A RUNNER AND ONLY THERE, which is the worst shape a defect can
 * have: every local run resolves correctly because the real config is present,
 * so the surface looks fine until CI touches it. `check:backup` carried the
 * identical defect and had simply never run in CI, so it was latent rather than
 * absent, and the queued item that produced this module asked for a gate before
 * a third victim was found by a red run.
 *
 * ## `--local` KEEPS THE NAME, AND THAT IS NOT AN EXCEPTION TO THE RULE
 *
 * Miniflare keys its state by the config's `database_id`, and there is no
 * account-side UUID to resolve. Asking the account for one would be answering a
 * question about a different database. So the rule is not "never use the name",
 * it is "never let wrangler resolve the name for a REMOTE operation".
 *
 * ## FAILS CLOSED
 *
 * A lookup that cannot produce a UUID throws. Falling back to the name would
 * substitute a different value for the one asked for, which is hard rule 13's
 * shape, and would reintroduce the 7404 wearing a passing lookup.
 *
 * @see scripts/check-d1-address.mjs, which refuses the by-name spelling
 */
```

### scripts/lib/d1-address.mjs:38 (WHY, shortened)

why self-contained and why run is still an argument; the call-site count goes to the history document.

```js
/**
 * The default lookup. Self-contained on purpose.
 *
 * The first draft took the caller's own wrangler runner, on the grounds that
 * every script has one. Nine call sites across five scripts and four different
 * runner shapes said otherwise: threading a runner through each would be nine
 * bespoke wirings of one fact, and two of the call sites are inside a
 * `retryRead` callback where there is no runner in scope at all.
 *
 * `run` remains an accepted argument, because `check:backup` and
 * `check:restore` already have runners that carry their own cwd and buffer
 * settings, and taking theirs is cheaper than proving this one matches.
 *
 * @param {string} command
 */
```

### scripts/lib/d1-address.mjs:62 (WHY, shortened)

why memoised and why it is safe.

```js
/**
 * MEMOISED PER PROCESS, per database.
 *
 * `sync-content.mjs` addresses the database five times in one run and
 * `check:media` twice. An account lookup per call site would be five network
 * round trips to answer one unchanging question, on the script that runs at
 * the end of every ship. The answer cannot change mid-run: a database does not
 * get a new UUID while a script is talking to it.
 *
 * @type {Map<string, string>}
 */
```

### scripts/lib/d1-address.mjs:75 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * The account-side UUID for a database, or the name when the target is local.
 *
 * @param {string} dbName the database name, as `wrangler.jsonc` spells it
 * @param {string} target `--remote` or `--local`
 * @param {(command: string) => { status: number | null, stdout: string }} [run]
 * @returns {string} a UUID for a remote target, the name for a local one
 */
```

### scripts/lib/d1-address.mjs:89 (WHY, shortened)

why the slice; one line.

```js
/*
   * THE JSON STARTS AT THE FIRST `[`, not at byte zero. Wrangler prints an
   * update banner and a colour-coded header before its JSON on a runner, and
   * `JSON.parse` on the whole stream fails there and only there. Slicing from
   * the bracket is what the two existing copies of this already did.
   */
```

## scripts/check-volumes.mjs

### scripts/check-volumes.mjs:1 (CONTRACT, shortened)

the tier limitation, the credential rule and what is not restated; the volumes, the byte counts and the sibling defects go to the history document.

```js
/**
 * Gate: the ACTIVE decisions volume has not passed its own stated freeze point.
 *
 * ## THE DEFECT, AND IT IS THE THIRD OF ITS SHAPE IN TWO DAYS
 *
 * Every volume's header states its own limit, "Freeze at 20KB." Vol 17
 * respected it and froze at 20.6KB. Vol 18 ran to 36,667 bytes and stayed
 * there for four days before anybody noticed, because the limit was a sentence
 * inside the artifact it limited and enforced by whoever happened to read it.
 *
 * The other two that week: the carried-token map's "build 4 must leave this
 * empty", which assumed a schedule that had stopped running; and
 * check:contrast's participation rule, satisfied by pairs asserted against
 * surfaces nothing paints. Same shape each time, and the repair each time is
 * an instrument rather than a better sentence.
 *
 * ## NETWORK TIER, AND WHY IT CANNOT BE OTHERWISE
 *
 * A decisions volume is a Capsid document, not a repo file. There is no disk
 * to read, so this cannot run in `--ci` and a clean checkout cannot run it
 * either. That is a real limitation rather than a formality: this gate runs
 * when somebody runs the network tier, not on every push, so a volume can pass
 * its freeze point between runs. It still beats a sentence.
 *
 * ## THE CREDENTIAL FAILS CLOSED, on check:uptime's precedent
 *
 * `CAPSID_TOKEN` comes from the gitignored `.dev.vars`, like the UptimeRobot
 * key. Absent, this gate FAILS rather than skipping: a gate that silently does
 * not run is the thing the runner exists to prevent, and an unread volume is
 * not a volume under its limit.
 *
 * ## WHAT IS DELIBERATELY NOT HERE
 *
 * Nothing restates a limit. Hard rule 17: the number lives in the volume that
 * owns it and `parseFreezeLimit` reads it back. A volume that wants a different
 * limit says so in its own header and this follows without an edit.
 *
 * The ACTIVE volume is the highest-numbered one, never the title, and the
 * argument for that is measured rather than asserted; it lives beside the
 * classifier in lib/decisions-volumes.mjs. Proven both directions by
 * test/decisions-volume-freeze.test.mjs, including the direction that keeps
 * this usable: frozen volumes PASS, because vols 6 and 7 froze at 224KB and
 * 69KB before the rule existed and a gate that cannot go green is one somebody
 * deletes.
 */
```

### scripts/check-volumes.mjs:72 (CONTRACT, shortened)

what it calls; one line already.

```js
/**
 * One JSON-RPC call against Capsid's MCP endpoint.
 * @param {string} token @param {string} name @param {Record<string, unknown>} args
 */
```

### scripts/check-volumes.mjs:93 (WHY, shortened)

why the last data line.

```js
/*
   * The endpoint may answer as SSE. Taking the LAST data: line rather than the
   * first: a stream can carry progress frames ahead of the result, and reading
   * the first would parse a notification as the answer.
   */
```

### scripts/check-volumes.mjs:110 (WHY, shortened)

the order and the fail-closed rule.

```js
/*
   * ENV FIRST, then .dev.vars. The env path is what lets this run somewhere
   * that keeps the credential in a secret store rather than a file; the
   * .dev.vars path is this machine. Either way it FAILS CLOSED when neither
   * has it, which is the assertion below.
   */
```

### scripts/check-volumes.mjs:139 (WHY, shortened)

the scope rule; one line already.

```js
/*
   * SCOPE FIRST. A listing that returned nothing classifies to no active
   * volume, and every assertion below would pass by examining it.
   */
```

### scripts/check-volumes.mjs:170 (WHY, shortened)

why a missing limit fails; one line already.

```js
/*
   * A VOLUME THAT STATES NO LIMIT FAILS. Comparing against a missing number
   * would be a condition that cannot be false, which is the class this gate
   * was written in response to.
   */
```

## scripts/extract-publication-text.mjs

### scripts/extract-publication-text.mjs:1 (CONTRACT, shortened)

why committed, why verbatim per page and what it is for; the sizes, the ruling and the named import defect go to the history document.

```js
/**
 * Extracts the text of every hosted publication PDF into
 * `data/publications.text.json`.
 *
 * Run: `node scripts/extract-publication-text.mjs`
 *
 * ## WHY THE TEXT IS A COMMITTED ARTIFACT AND NOT A BUILD STEP
 *
 * Same class as `data/publications.cited-by.json`, and for two of the same
 * reasons. It parses 27 MB of PDF to produce bytes that change only when a PDF
 * does, which is not a cost every gate run and every `npm run dev` should pay.
 * And it is EVIDENCE about bytes that are themselves committed, so it can be
 * checked rather than recomputed:
 * `check:publications` hashes each PDF on disk and compares against the
 * `sha256` recorded here, which binds the text to the exact file it came from.
 * A PDF replaced without re-running this reds the gate naming its DOI.
 *
 * The alternative was extracting during the build, which would have put a PDF
 * parser in the path of every gate run and every dev server start, to produce
 * bytes that change only when a PDF does. That is the shape ruling 39a moved
 * AWAY from for the artifacts it applies to, and it does not apply here: those
 * are cheap and derived from tracked text, this is expensive and derived from
 * tracked binaries.
 *
 * ## THE TEXT IS STORED VERBATIM, PER PAGE
 *
 * No de-hyphenation, no column repair, no whitespace collapsing. Two reasons.
 *
 * The extraction is one owner and the PRESENTATION is another: the markdown
 * twin decides how to join pages, and a normalisation baked in here would be
 * invisible to it and unfixable without re-running the extractor over 27 MB of
 * PDFs. Whatever the twin wants to do to this text, it can do to the text as it
 * came out.
 *
 * And the obvious normalisation is wrong more often than it looks.
 * `reticuloendo-\ntheliosis` should be joined and `well-\nknown` should not,
 * and nothing here can tell those apart without a dictionary. The honest thing
 * is to keep the artifact faithful to the PDF and to say in the twin that the
 * text is machine-extracted, rather than to invent a cleaned-up version that
 * reads better and is sometimes wrong. `build-publications.mjs` records what
 * the July import cost when it guessed: `<scp>RNA</scp>Tumour` became
 * `RNATumour` and nothing caught it.
 *
 * ## WHAT IT IS FOR, WHICH BOUNDS HOW GOOD IT HAS TO BE
 *
 * Retrieval, not citation. The twin carries it so that Ask and the search MCP
 * can answer a question from the body of a paper rather than from its abstract
 * alone. The abstract stays the registry's, the bibliographic record stays
 * Crossref's, and nothing on the rendered page is derived from this file.
 */
```

### scripts/extract-publication-text.mjs:76 (WHY, shortened)

why hosted only; one line.

```js
/*
   * HOSTED ONLY. A record whose PDF this site does not serve has no bytes here
   * to extract from, and reaching out to a publisher for one would be a network
   * dependency in a script whose whole point is that its input is committed.
   */
```

### scripts/extract-publication-text.mjs:93 (WHY, shortened)

why sorted; one line already.

```js
// Sorted by the casefolded DOI so the file's key order is a property of the
  // corpus rather than of Object.entries' insertion order.
```

### scripts/extract-publication-text.mjs:115 (CONTRACT, shortened)

what the date is and what the gate actually compares.

```js
/*
     * A DATED OBSERVATION, which is what this file is. The date is the day the
     * PDFs were read, and it is not compared by any gate: what the gate compares
     * is each `sha256` against the file on disk, which is the claim that can go
     * stale. Rule 17's exception for evidence.
     */
```

## scripts/lib/python.mjs

### scripts/lib/python.mjs:1 (CONTRACT, shortened)

why resolved, why the probe runs a program and the fail-closed rule; the per-shell measurements and the dates go to the history document.

```js
/**
 * Resolving the Python a gate needs, the SAME WAY THE HOOKS DO.
 *
 * ## WHY THIS IS NOT A HARDCODED `python3`
 *
 * MEASURED 2026-09-05 on this machine, both shells:
 *
 *     git bash      python3 -> hookprobe   python -> hookprobe   py -> hookprobe
 *     PowerShell    python3 -> ABSENT      python -> hookprobe   py -> hookprobe
 *
 * A gate spawning `python3` by name would therefore be green in every Claude
 * Code session, which runs git bash, and absent at `npm run ship`, which runs
 * from PowerShell. That is the shape `scripts/lib/bash.mjs` was written for a
 * few hours earlier, recurring in a second interpreter before the ink was dry,
 * which is the whole argument for resolving rather than naming.
 *
 * ## AND WHY THE PROBE IS `print("hookprobe")` RATHER THAN `--version`
 *
 * Copied deliberately from the hooks, which carry the reason: on Windows the
 * bare name `python3` is often the Microsoft Store STUB. The stub satisfies
 * `command -v`, prints a version-ish banner, and is not an interpreter. Only
 * running a program discriminates it, so the candidate must EXECUTE something
 * and be judged on what it printed.
 *
 * Matching the hooks' probe exactly is load-bearing for `check:hook-syntax`: a
 * gate that compiles a hook's embedded Python must use the interpreter that
 * hook would have used, or it is checking a different thing than it claims.
 *
 * ## FAILS CLOSED
 *
 * Returns null when nothing ran. The caller prints one line naming that no
 * Python was found and exits nonzero, exactly as the hooks themselves block
 * rather than passing silently when the probe fails.
 */
```

### scripts/lib/python.mjs:38 (CONTRACT, shortened)

why the duplication is stated.

```js
/**
 * The candidates and their order, IDENTICAL to the hooks' own
 * `for cand in python3 python py`. One owner would be better; a shell script
 * and an ES module cannot share a constant, so the duplication is stated here
 * rather than left for a reader to notice.
 */
```

### scripts/lib/python.mjs:52 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * The first candidate that actually runs a program, or null if none does.
 *
 * Memoised, including the null.
 *
 * @returns {{ path: string } | null}
 */
```

### scripts/lib/python.mjs:67 (WHY, shortened)

why equality; one line already.

```js
// Equality after trimming, never a substring: the Store stub's banner
    // mentions Python and would satisfy a loose match.
```

### scripts/lib/python.mjs:86 (CONTRACT, shortened)

why parse rather than exec and why the source crosses as bytes.

```js
/**
 * Compile a Python source string, WITHOUT EXECUTING IT.
 *
 * `ast.parse` rather than `exec` or `compile` into a runnable object: the whole
 * subject is whether the string PARSES, and running a hook's checker here would
 * execute repository logic against a gate's stdin for no benefit.
 *
 * ## THE SOURCE CROSSES AS BYTES, WHICH IS THE POINT
 *
 * `sys.stdin.read()` decodes through the platform text layer, and on Windows
 * that is cp1252, so a checker containing a non-ASCII character (these hooks
 * carry U+2014 and U+2013 literals, which is what one of them is FOR) would
 * either mangle or raise for a reason that has nothing to do with its syntax.
 * `sys.stdin.buffer.read().decode("utf-8")` reads the bytes and names the
 * encoding, and the input is handed over as a Buffer for the same reason.
 *
 * Passing the source as an argv argument was the other option and is worse: the
 * strings are multi-line and quote-bearing, and Windows argv quoting is the
 * hazard this repo has already been bitten by.
 *
 * @param {string} pythonPath
 * @param {string} source
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
```

## scripts/lib/ask-converge.mjs

### scripts/lib/ask-converge.mjs:1 (CONTRACT, shortened)

why there is a window, why the reading must be read-only and why two bounds; the measurement and its date go to the history document.

```js
/**
 * The Ask index convergence window ship waits out before declaring a miss.
 *
 * Split out of `ship.mjs` on exactly the footing `ci-status.mjs` is: the
 * DECISION is a pure loop over readings and can be driven by tests, while the
 * reading itself is a network call ship supplies. A poll loop that only exists
 * inside a deploy script is a poll loop nothing can exercise, and this repo has
 * already recorded the failure that hides there: "a poll loop that is a single
 * fetch wearing a loop", which breaks out on a not-yet-converged response and
 * defeats the wait it exists for.
 *
 * ## WHY THERE IS A WINDOW AT ALL
 *
 * `syncAsk` reads `expected` and `present` back IMMEDIATELY after its two
 * writes, and AI Search is eventually consistent, so the first reading can be
 * early rather than wrong. MEASURED 2026-08-24: ship read drift 1 at 02:20:18Z,
 * NO REMEDY WAS APPLIED, and the scheduled health check read ok 75 seconds
 * later and stayed ok.
 *
 * ## THE READING MUST BE READ-ONLY, AND THAT IS THE WHOLE DESIGN
 *
 * Polling by calling `sync_ask` again would re-upload the corpus, which repairs
 * the thing being measured, and a run that then converged could not be told
 * apart from one that had self-healed. That ambiguity is what the 2026-08-24
 * watch item recorded as unresolvable with the instruments then available.
 *
 * This module cannot enforce that its `reading` is read-only. What it does is
 * refuse to do the reading itself, so the choice is made at one visible call
 * site rather than buried in a loop.
 *
 * ## THE BOUND IS TWO INDEPENDENT LIMITS, DELIBERATELY
 *
 * No more than `attempts` iterations, AND no iteration begins once `windowMs`
 * has elapsed. A clock test alone would spin without limit if the clock never
 * advanced; a count alone would not honour the stated window if a reading hung.
 * Neither can be relieved by the other, so the loop terminates under both.
 *
 * The window can be exceeded only by the duration of the single reading already
 * in flight when the deadline passes, which is bounded by the caller's own
 * timeout on it.
 */
```

### scripts/lib/ask-converge.mjs:50 (CONTRACT, shortened)

the parameters, with the unreadable-poll rule kept.

```js
/**
 * Waits for a drift reading to report ok, or gives up at the bound.
 *
 * @param {object} options
 * @param {() => Promise<{ ok: boolean, expected?: number, present?: number } | null>} options.reading
 *   One read-only observation. Returning null, or throwing, counts as an
 *   unreadable poll and is neither convergence nor a miss: it consumes an
 *   attempt and the loop carries on.
 * @param {(ms: number) => Promise<unknown>} options.sleep
 * @param {() => number} [options.now]
 * @param {number} [options.attempts]
 * @param {number} [options.intervalMs]
 * @param {number} [options.windowMs]
 * @param {(event: { poll: number, reading: any }) => void} [options.onPoll]
 * @returns {Promise<{ converged: boolean, polls: number, latest: any }>}
 */
```

### scripts/lib/ask-converge.mjs:89 (CONTRACT, shortened)

what is not an unreadable poll.

```js
// An unreadable poll, same as a null. Health answering 503 is NOT this:
      // that is a readable answer about a failing check somewhere, and the
      // caller is expected to parse the body regardless of status.
```

### scripts/lib/ask-converge.mjs:99 (WHY, shortened)

the one line the recorded failure lives on.

```js
// The one line the "single fetch wearing a loop" failure lives on: this
    // returns ONLY on ok. A not-yet-converged reading continues the loop.
```

## scripts/build-template-refs.mjs

### scripts/build-template-refs.mjs:1 (CONTRACT, shortened)

the third usage state, the split and the observation boundary; the photograph count goes to the history document.

```js
/**
 * Scans the repository source for asset references into a committed manifest.
 *
 *   npm run build:template-refs
 *
 * The THIRD usage state depends on this file. `media_refs` and
 * `resolveCitations` both answer "does a POST cite this", and nothing answered
 * "does the SITE ITSELF place this", so nine cohort photographs referenced by
 * `app/data/phage-hunters.ts` read as unreferenced next to a delete button.
 *
 * Every decision lives in `app/lib/media/template-refs.mjs`, which is pure and
 * unit tested. This file is the part that touches a filesystem and nothing else,
 * for the same reason `build-assets.mjs` is split that way: a scan that decides
 * things in the same function that walks directories cannot be tested without a
 * repository.
 *
 * OBSERVATION BOUNDARY: this reads SOURCE TEXT and matches asset paths as
 * literal strings. It sees `src: "/phage-hunters/2019.webp"` and it does not see
 * `src: \`/diagrams/${id}.svg\``, because evaluating a template literal means
 * running the code. Constructed paths therefore read as unattached, which is a
 * false negative in the safe direction: this tool under-claims usage and never
 * invents it. The copy on the page says "no reference found" rather than
 * "unused" precisely because of this line.
 */
```

### scripts/build-template-refs.mjs:31 (WHY, shortened)

why readFileSync rather than an import attribute.

```js
/*
 * `readFileSync` rather than an import attribute, per the ruling verify-live.mjs
 * already records: `with { type: "json" }` is only legal under a newer `module`
 * setting than this repo's tsconfig uses, and it fails the TYPECHECK rather than
 * the run, so it looks fine until `tsc -b`.
 */
```

### scripts/build-template-refs.mjs:51 (WHY, shortened)

why forward slashes always.

```js
/**
 * Every source file under the scanned roots, repo-relative with forward slashes.
 *
 * Forward slashes always, because the artifact is committed and compared: a
 * Windows backslash would make it disagree with itself across machines, which
 * is the platform-dependence `walkPublic` already had to fix once.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
```

### scripts/build-template-refs.mjs:93 (WHY, shortened)

why comments go first and why JSON does not.

```js
// COMMENTS GO FIRST. A doc comment naming an asset is prose about it, not a
    // placement of it; this module's own header caught exactly that and would
    // have marked six brand files as placed by page code. JSON has no comments,
    // so it is passed through unchanged rather than run through a tokenizer that
    // would treat a `//` inside a URL string as one.
```

### scripts/build-template-refs.mjs:106 (WHY, shortened)

why the scope number rides in the artifact.

```js
// SCOPE, carried in the artifact rather than printed and forgotten. A scan
    // that read zero files reports the same "no references" as a repository
    // that genuinely has none, and this is the number that tells them apart.
```

### scripts/build-template-refs.mjs:114 (WHY, shortened)

why pathToFileURL; the slash measurement goes to the history document.

```js
/*
 * THROUGH `pathToFileURL`, NEVER BY CONCATENATING `file://`.
 *
 * The hand-rolled form was written first and silently did nothing on this host:
 * `import.meta.url` is `file:///C:/...` with THREE slashes and a concatenated
 * `file://` + `C:/...` has two, so the comparison was false, the script exited
 * 0, and the artifact was never written. A build step that succeeds while
 * producing no output is the worst shape a build step can have, and it is the
 * same Windows path class that has already cost this repo a vacuous plant.
 */
```

## scripts/lib/ci-status.mjs

### scripts/lib/ci-status.mjs:1 (CONTRACT, shortened)

why split out and why apiBase is injectable.

```js
/**
 * Reading GitHub's verdict on a commit, and deciding whether it may deploy.
 *
 * Split out of `ship.mjs` so the DECISION is reachable without running a ship.
 * The alternative was proving this by shipping three times, which costs a build
 * and a deploy per plant and would have meant deploying a commit whose CI had
 * deliberately been made to look failed. A gate that can only be tested by doing
 * the dangerous thing does not get tested.
 *
 * The split is the usual one in this repo: `ciVerdict` is pure and decides,
 * `fetchCiRuns` does the I/O and decides nothing. `apiBase` is injectable for
 * the same reason, so the unreachable-host path can be exercised against a host
 * that really is unreachable rather than by mocking the failure it is meant to
 * detect.
 *
 * @see scripts/ship.mjs
 * @see test/ci-status.test.mjs
 */
```

### scripts/lib/ci-status.mjs:20 (CONTRACT, shortened)

the four refusals and why the run set is derived.

```js
/**
 * May this commit deploy?
 *
 * ## FAIL CLOSED IN EVERY DIRECTION
 *
 * Four refusals, and each one is a state that a naive check reads as success:
 *
 *   - **no push-triggered run**: an unpushed commit has no runs, and an empty
 *     list is the same shape as "nothing failed". This is the one a truthy
 *     `every()` over an empty array gets wrong, silently, forever.
 *   - **still running**: `conclusion` is `null` while a run is in flight, and
 *     `null !== "failure"` reads as fine. Green so far is not green.
 *   - **not success**: named explicitly, because `cancelled`, `timed_out` and
 *     `action_required` are none of them failures and none of them passes.
 *   - **unparseable payload**: a body with no `workflow_runs` is not an empty
 *     result, it is an answer this function did not understand.
 *
 * PUSH-TRIGGERED RUNS ONLY, derived rather than named. Filtering on the workflow
 * file would hardcode `ci.yml` and go stale the day a second push workflow
 * lands; the health workflow is `schedule` plus `workflow_dispatch`, so it never
 * appears for a sha and needs no exclusion of its own.
 *
 * @param {unknown} payload the parsed GitHub `actions/runs` response
 * @param {string} sha for the message, short or full
 * @returns {{ ok: boolean, why: string, remedy: string }}
 */
```

### scripts/lib/ci-status.mjs:102 (CONTRACT, shortened)

why it throws rather than returning a verdict.

```js
/**
 * Fetches the runs for one sha. Throws on anything that is not a 2xx body.
 *
 * Throwing rather than returning a verdict is deliberate: an unreachable API and
 * a failed CI run are different facts and the caller words them differently. The
 * caller refuses on both.
 *
 * @param {{ owner: string, repo: string, sha: string, token?: string, apiBase?: string }} options
 */
```

### scripts/lib/ci-status.mjs:123 (WHY, shortened)

why a 404 is worded as authentication; the date and the void assumption go to the history document.

```js
/*
     * **THE REPOSITORY IS PRIVATE, measured 2026-08-23**, so a 404 here is
     * almost always an authentication problem rather than a missing repo, and
     * saying so is the difference between a one-minute fix and an afternoon.
     *
     * This matters because the obvious reading of a 404 from a REST API is "not
     * found", and GitHub deliberately answers 404 rather than 403 for a private
     * resource you may not see, so an unauthenticated caller is told the repo
     * does not exist. The brief that specified this check assumed public reads
     * and an unauthenticated fallback; that assumption is void. `gh auth token`
     * is the token path and it is REQUIRED, not an optimisation.
     */
```

## scripts/lib/raster.mjs

### scripts/lib/raster.mjs:1 (CONTRACT, shortened)

why hand-rolled, why every function throws and what self-tests them.

```js
/**
 * Minimal readers for the two binary container formats the icon suite ships.
 *
 * Hand-rolled on purpose. The repo carries `image-size`, which answers
 * dimensions and nothing else, and `@resvg/resvg-js`, which ENCODES PNG and
 * cannot decode one. Nothing here needs a decoder in the general sense: the
 * gate asks for a header and for one corner pixel, and both are reachable
 * without decompressing an image.
 *
 * Every function throws rather than returning a sentinel. A gate that receives
 * `null` from a parser and carries on is a gate that passes on a file it could
 * not read, which is the failure mode that looks most like success.
 *
 * These readers are SELF-TESTED by check:logo against files produced by a third
 * party encoder, not against fixtures built with the same assumptions the reader
 * makes. A parser and its test agreeing about a format both got wrong is not
 * evidence.
 */
```

### scripts/lib/raster.mjs:41 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Walks a PNG's chunk list and returns its IHDR fields plus the joined IDAT.
 *
 * @param {Buffer} buf
 * @returns {PngHeader & { idat: Buffer }}
 */
```

### scripts/lib/raster.mjs:83 (CONTRACT, shortened)

why the first pixel is exact and that the limit is deliberate.

```js
/**
 * The colour of pixel (0, 0), as an uppercase #RRGGBB string.
 *
 * WHY ONLY THE FIRST PIXEL, and why that is exact rather than approximate.
 * A PNG scanline is filtered against its left neighbour and the row above it,
 * so reading an arbitrary pixel means reconstructing every row before it. The
 * FIRST pixel of the FIRST row has neither: there is no prior row and no left
 * neighbour, so all five filter types collapse to the identity there.
 *
 *   None     x
 *   Sub      x + left(0)              = x
 *   Up       x + above(0)             = x
 *   Average  x + floor((0 + 0) / 2)   = x
 *   Paeth    x + Paeth(0, 0, 0) = x + 0
 *
 * So one inflate and three bytes answer it, with no unfiltering loop to get
 * wrong. This is a deliberate limit, not an unfinished decoder: callers that
 * need an interior pixel need a real decoder and should say so.
 *
 * @param {Buffer} buf
 */
```

### scripts/lib/raster.mjs:165 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * The payload of one ICO entry, for handing to the PNG readers.
 *
 * @param {Buffer} buf
 * @param {{ offset: number, bytes: number }} entry
 */
```

## scripts/lib/content.mjs

### scripts/lib/content.mjs:1 (CONTRACT, shortened)

the split and what it buys.

```js
/**
 * Node adapter for the shared markdown pipeline.
 *
 * The pipeline itself lives in `app/lib/content/pipeline.mjs` so the Worker can
 * import it too. Everything Node-only stays here: reading files from disk and
 * measuring images with the filesystem. The editor supplies its own resolver
 * over HTTP, and both callers therefore render identical HTML from identical
 * bytes.
 */
```

### scripts/lib/content.mjs:28 (WHY, shortened)

why read rather than imported, and why module scope.

```js
/**
 * The committed manifest, READ rather than imported, once per process.
 *
 * Read for two reasons. It is what the Worker side does, so the two resolvers
 * differ in the path they read and in nothing else. And an `import ... with {
 * type: "json" }` gives TypeScript a type with nine literal keys, so indexing
 * it by a variable is an error that has to be cast away, which is a cast around
 * the only interesting property of the lookup.
 *
 * Module scope, not per resolver: `build:content` makes one resolver per post
 * and the artifact does not change under a build.
 *
 * @type {Promise<Record<string, { sha: string, lqip: string }>> | null}
 */
```

### scripts/lib/content.mjs:50 (CONTRACT, shortened)

the two things that must not be derived here and why; the finding id goes to the history document.

```js
/**
 * Builds a resolver that measures an image on disk. A missing or unreadable
 * file is a build failure, never a silently absent attribute, because the whole
 * point is preventing layout shift.
 *
 * `/media/*` is resolved from the KEY, not from bytes, and that is finding
 * B002. Those blobs live only in R2, so this build cannot read them at all; the
 * Worker could, and did, which meant the first `/media/` citation would commit
 * HTML that `build:content` could not reproduce. The key now carries
 * `-<w>x<h>` and both resolvers parse it with the same `dimensionsFromKey`, so
 * neither reads bytes and there is nothing left to disagree about.
 *
 * THE PLACEHOLDER COMES FROM THE COMMITTED MANIFEST, for the same reason and
 * with the same shape. It cannot be derived here: this side has sharp and the
 * Worker does not, so a value computed at render time would be a value the two
 * writers could never agree on. `build:assets` derives it once, commits it, and
 * both resolvers look it up. `/media/` gets none, which is the exclusion stated
 * in `rehypeImageSources`.
 *
 * Exported so `check:invariants` can compare it against the Worker's resolver
 * directly rather than inferring their agreement from rendered HTML.
 *
 * @param {string} file source markdown path, for the error message
 * @returns {(src: string) => Promise<{ width: number, height: number, placeholder?: string }>}
 */
```

### scripts/lib/content.mjs:106 (CONTRACT, shortened)

absent is a real answer; one line already.

```js
// Absent for anything the manifest does not cover, which is every static
    // asset that is not a content raster. Absent is a real answer: the image
    // renders without a placeholder, exactly as it did before this existed.
```

### scripts/lib/content.mjs:114 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Renders one markdown file into the row shape the database stores.
 *
 * @param {string} file path relative to the repo root
 * @param {string} raw file contents
 */
```

## scripts/build-enhance.mjs

### scripts/build-enhance.mjs:1 (CONTRACT, shortened)

the boundary, why prebuilt and why self-contained is asserted; the dates and the measured serve go to the history document.

```js
/**
 * Bundles every module in app/enhance/ into a self-contained asset.
 *
 *   npm run build:enhance
 *
 * OBSERVATION BOUNDARY: this builds and then reads back its OWN output. It
 * proves each bundle is import-free and parses; it cannot prove the app build
 * actually serves these files (the ?url imports decide that, and
 * check:page-payload asserts it against build/client), and it cannot see the
 * wire.
 *
 * ## Why the enhancements are prebuilt
 *
 * The public plane stopped hydrating React (2026-08-26), so the effect loaders
 * that dynamically imported these modules stopped existing. What loads an
 * enhancement now is a plain nonced `<script type="module">` whose URL is a
 * `?url` import of the file this script writes. A `?url` import copies bytes
 * VERBATIM as an asset, with no compilation (measured 2026-07-28: pointing it
 * at the .ts source serves raw TypeScript), so the thing it points at has to
 * be finished JavaScript before the app build runs. That is this script's
 * whole job, and it is why it runs before the app build everywhere the
 * build-first pattern lives: check-all, check-head, ship, ci.yml, deploy.yml
 * and the dev script.
 *
 * ## Each bundle is SELF-CONTAINED, asserted rather than hoped
 *
 * A bundle with an import statement would make the browser fetch a sibling by
 * relative URL against /assets/, where only hashed names exist, so the
 * enhancement would die at runtime while the build stayed green. Every output
 * is therefore parsed (Rollup's own parser, via vite's parseAst) and refused
 * if any static import, dynamic import() or re-export-from survives.
 * `inlineDynamicImports` is what makes the palette's lazy `import("./ask")`
 * legal: the ask module is inlined into the palette bundle, which costs the
 * palette ask's bytes and buys it working under this rule. Both bundles carry
 * ask's DOM-guarded init, which is why that init is idempotent.
 *
 * The output directory is gitignored (see .gitignore for the reason) and is
 * DELETED and rebuilt on every run, so a renamed module cannot leave a stale
 * bundle behind for a ?url import to keep serving.
 */
```

### scripts/build-enhance.mjs:52 (CONTRACT, shortened)

what counts as a module dependency; one line already.

```js
/**
 * True when the AST contains any statement that would reach the network for
 * another module: static import, dynamic import(), or a re-export with a
 * source. A plain `export {}` has no source and is fine in a module script.
 *
 * @param {any} node
 * @returns {string | null} a description of the offending node, or null
 */
```

### scripts/build-enhance.mjs:112 (CONTRACT, shortened)

what it makes legal; one line already.

```js
// One chunk per entry, dynamic imports inlined. This is what makes
            // the palette's lazy import("./ask") legal under the no-imports
            // rule below. (Rolldown's spelling; inlineDynamicImports is the
            // deprecated alias.)
```

### scripts/build-enhance.mjs:138 (CONTRACT, shortened)

both directions; one line already.

```js
// Both directions: a file in dist/ that no module produced is a stale
  // bundle a ?url import could still be serving.
```

## scripts/require-clean-tree.mjs

### scripts/require-clean-tree.mjs:1 (CONTRACT, shortened)

the boundary, why a refusal rather than an archive build and why no override; the audit item goes to the history document.

```js
/**
 * Refuses a deploy from a working tree that is not clean.
 *
 * Wired as `predeploy`, so npm runs it before `deploy` whoever invokes it.
 *
 * OBSERVATION BOUNDARY: this reads `git status --porcelain` and nothing else.
 * It proves the tree matches HEAD; it does NOT prove HEAD is pushed, that the
 * build about to run reads only tracked files, or that the deployed Worker
 * corresponds to the commit it names. A clean tree at a commit nobody else has
 * still deploys fine and still cannot be reproduced by anyone but this machine,
 * which is why `ship` also checks push state and `check:head` reads the ref.
 *
 * ## Why this exists
 *
 * `npm run deploy` is `npm run build && wrangler deploy`, and `react-router
 * build` reads the WORKING TREE. So an uncommitted edit ships, and the deployed
 * Worker corresponds to no commit anywhere. `ship` refused that from its first
 * version, but `ship` is a wrapper: the primitive it wraps refused nothing, so
 * a bare `npm run deploy` was the same loaded gun with the safety removed.
 * Audit item 2.2, CONFIRMED.
 *
 * ## Why a refusal here rather than deploying from `git archive`
 *
 * Building an extraction of HEAD is the more thorough fix and it was rejected
 * on a MEASURED hazard rather than on effort. `wrangler.jsonc` is gitignored,
 * so an extraction contains only `wrangler.jsonc.example`, whose `database_id`
 * and KV id are placeholder zeros. `check:head` already documents this: it
 * excludes `check:config` because bootstrap copies the example, making real
 * equal example by construction. Deploying from a pure archive would therefore
 * deploy the EXAMPLE bindings, or require copying the real config back in,
 * which reintroduces a working-tree dependency for the one file where it is
 * most dangerous. Trading an unreproducible deploy for a deploy pointed at the
 * wrong database is a worse gun, not a safer one.
 *
 * So the smaller fix wins: the tree must equal HEAD, and then building the tree
 * IS building HEAD. Same guarantee, no config hazard, and it fails closed.
 *
 * ## No override flag, deliberately
 *
 * An `ALLOW_DIRTY=1` escape hatch is a bypass people learn to type, and the
 * whole finding is that a bypass existed. Anyone who genuinely means to deploy
 * an uncommitted tree can still run `npx wrangler deploy` directly, which is an
 * explicit act outside the wrapper rather than a flag on the safe path. The
 * message below says so rather than hiding it.
 */
```

### scripts/require-clean-tree.mjs:65 (WHY, shortened)

why an unreadable answer refuses.

```js
/*
 * FAILS CLOSED on an unreadable answer. A `git` that is missing or a directory
 * that is not a repository both mean the tree cannot be compared to anything,
 * and "I could not check" must not deploy. This is the same rule the migration
 * guard follows for an unreadable schema.
 */
```

## scripts/lib/retry.mjs

### scripts/lib/retry.mjs:1 (CONTRACT, shortened)

the class, why it prints first and the reads-only rule; the five incidents, their errors and the dates go to the history document.

```js
/**
 * One retry, for Cloudflare READ paths only.
 *
 * ## The class, measured five times
 *
 * Transient failures on Cloudflare control-plane and storage reads, in four
 * different gates, wearing TWO OPPOSITE SYMPTOMS:
 *
 *   check:backup      remote sqlite_master read, died in seconds
 *                     (SQLITE_CANTOPEN), clean on retry
 *   check:llms        remote D1 read, error 10000, clean on retry
 *   check:invariants  remote D1 read, error 10000, clean on retry
 *   check:media       R2 list, "R2 error response does not contain the
 *                     CF-R2-Error header", statusCode 400. It HUNG rather than
 *                     failing, and took check:all past a ten minute timeout
 *                     against a 116-160s norm. Clean on retry at 27s.
 *
 * A hang and a five-second death are the same class. That is why this wraps
 * both a rejection AND a timeout: catching only the rejection would leave the
 * worst-behaved instance untouched.
 *
 * ## IT PRINTS BEFORE IT RETRIES, and that is the load-bearing part
 *
 * A fifth incident on 2026-08-09 reported "17 passed, 1 failed" and the failing
 * gate NAME was never captured before the retry, so the instance could not be
 * diagnosed and is recorded in core.md as undiagnosed. A silent retry converts
 * a diagnosable transient into an invisible one, which is worse than the
 * failure. The label and the first error always reach stderr.
 *
 * ## READS ONLY. Never wrap a write.
 *
 * A retried write is a write that may have landed twice. Every call site here
 * is a read: sqlite_master, a D1 SELECT, an R2 list, and the per-table export
 * (it pulls rows and writes a LOCAL temp file, so a retry overwrites its own
 * output and lands nowhere else). `sync:content` and the
 * publish paths are deliberately not wrapped.
 *
 * A SECOND failure propagates unchanged, with its original error, so the gate
 * fails exactly as it would have without this wrapper.
 */
```

### scripts/lib/retry.mjs:61 (WHY, shortened)

why the promise is normalised; one line already.

```js
// `fn` may be synchronous, as the wrangler spawns are. Promise.resolve
      // normalises both without forcing every call site to become async.
```

### scripts/lib/retry.mjs:85 (WHY, shortened)

named before the retry; one line already.

```js
// NAMED AND PRINTED BEFORE THE RETRY. See the header: an undiagnosable
    // transient is worse than a visible one.
```

## scripts/fetch-cited-by.mjs

### scripts/fetch-cited-by.mjs:1 (CONTRACT, shortened)

why committed, why it is not a gate and the cap; the byte sizes, the credit costs and the ruling go to the history document.

```js
/**
 * Who cites each paper, from OpenAlex, into a committed artifact.
 *
 *   node scripts/fetch-cited-by.mjs          report only
 *   node scripts/fetch-cited-by.mjs --write  update data/publications.cited-by.json
 *
 * ## WHY A COMMITTED ARTIFACT AND NOT A RUNTIME FETCH
 *
 * The counts on these pages come from KV and refresh themselves, because a
 * count is one number and a stale one is only slightly wrong. A citing LIST is
 * different in three ways that all point the same direction:
 *
 *   It is 55 KB across 25 papers. Fetching it per request would put a
 *   third-party round trip in front of a page that is otherwise a pure function
 *   of committed data, on a route that is shared-cached precisely because it has
 *   no per-reader anything.
 *
 *   It needs a LIST query. `?filter=cites:W...` costs 10 credits where a
 *   singleton lookup costs 1, and OpenAlex has metered both since 2026-02-13.
 *   Ruling 63 says "singleton lookups only"; there is no singleton form of
 *   cited-by, so this is the one place that rule is departed from, deliberately,
 *   and doing it at build rather than per request is what keeps the departure
 *   small: 286 credits for the whole corpus, once, rather than per reader.
 *
 *   It is EVIDENCE, and evidence carries a date. The artifact records when it
 *   was read and the page says so, which is the same contract the counts have.
 *
 * ## NOT A GATE, AND NEVER RUN BY ONE
 *
 * Network, and a gate that fetches OpenAlex is red on OpenAlex's bad day rather
 * than on ours. Same placement as `pubs-pipeline/refresh.py`: a human runs it,
 * the result is committed, and `check:publications` checks the committed file.
 *
 * ## NEWEST FIRST, CAPPED AT 50
 *
 * Ruling 63's number. One paper in this corpus exceeds it (52 citations), and
 * the artifact records the true total beside the truncated list so the page can
 * say "50 of 52" rather than implying it has them all.
 */
```

### scripts/fetch-cited-by.mjs:107 (WHY, shortened)

why the field selection; one line already.

```js
// `select` keeps the response to the four fields the page renders. The
    // default response is a large record per work and this is 50 of them.
```

### scripts/fetch-cited-by.mjs:120 (CONTRACT, shortened)

why stripped here; one line already.

```js
// The DOI as OpenAlex gives it, which is a full URL; the page needs the
        // bare name. Stripped here so the artifact carries one form.
```

## scripts/build-publication-twins.mjs

### scripts/build-publication-twins.mjs:1 (CONTRACT, shortened)

why gitignored, where it runs and why it prunes; the ruling and the named sources go to the history document.

```js
/**
 * Writes the markdown twin of every paper into `public/publications/`.
 *
 * Run: `npm run build:publication-twins`
 *
 * A BUILD PRODUCT, gitignored, on exactly the terms ruling 39a set for
 * `content/generated/posts.json`: it is derived entirely from tracked sources
 * (`app/data/publications.ts`, `data/publications.text.json`,
 * `data/publications.cited-by.json`), so committing it would make every corpus
 * change a two-file change that only a machine running this script could
 * complete. It runs where `build:content` runs: check-all's preflight, ship's
 * build step, CI's build step, and `npm run dev`.
 *
 * The twins are ASSETS rather than route output. The reasoning, and the
 * measurement behind it, is on `app/lib/publications/twin.mjs`.
 *
 * ## IT PRUNES, AND THAT IS NOT TIDINESS
 *
 * A gitignored file that nothing deletes is a file that outlives its reason. A
 * paper removed from the corpus, or a DOI corrected, leaves a twin on disk that
 * this script would never overwrite, `check:publications` would never compare,
 * and the next deploy would upload: a page that 404s with a twin beside it that
 * still answers. So every `.md` directly under `public/publications/` that this
 * run did not write is removed, and the run says how many.
 *
 * Directly under, never recursive: `public/publications/<slug>/` holds the PDFs
 * and nothing here has any business walking into it.
 */
```

### scripts/build-publication-twins.mjs:45 (CONTRACT, shortened)

why exported; one line already.

```js
/**
 * Every twin, as a map from `<slug>.md` to its bytes.
 *
 * Exported so `check:publications` can generate and compare without writing,
 * for the reason `build-publications.mjs` guards its own write: a gate that
 * repairs its subject before looking at it cannot fail.
 *
 * @returns {Promise<Map<string, string>>}
 */
```

### scripts/build-publication-twins.mjs:62 (WHY, shortened)

why the key is folded; the mixed-case count goes to the history document.

```js
/*
   * Text is keyed by DOI as deposited, and six of the 36 are mixed case. A
   * raw-string lookup would silently produce a twin with no full text, which is
   * the failure `doiKey` exists to prevent everywhere else in this corpus.
   */
```

### scripts/build-publication-twins.mjs:81 (CONTRACT, shortened)

why null and empty differ.

```js
/*
         * Null and empty are different states and the twin renders them
         * differently: null is "this site does not host the PDF" and produces
         * no full-text section at all, while an empty array is "the PDF is
         * here and extraction found nothing", which the twin says out loud.
         */
```

### scripts/build-publication-twins.mjs:120 (CONTRACT, shortened)

why the write is guarded; one line already.

```js
/* Writes only when run directly, so the gate's import cannot rewrite the files
 * it is about to compare. `build-publications.mjs` carries the full grounds. */
```

## scripts/lib/dev-vars.mjs

### scripts/lib/dev-vars.mjs:1 (CONTRACT, shortened)

why it takes a name and why absent is null; the two callers go to the history document.

```js
/**
 * Reads ONE named value out of the gitignored `.dev.vars`.
 *
 * ## WHY THIS EXISTS AND WHY IT TAKES A NAME
 *
 * Two operator credentials are read by Node programs in `scripts/` rather than
 * by the Worker: the UptimeRobot key that `uptime-ensure` and `check:uptime`
 * use, and the Cloudflare token `check:config --remote` reads live cron
 * triggers with. Neither is a `wrangler secret`, because neither is read by
 * deployed code; both are machine-local operator credentials, which is exactly
 * what `.dev.vars` already is.
 *
 * **IT TAKES A NAME AND RETURNS ONE STRING. It never returns the file, never
 * returns a map, and never logs a value.** A loader that returned every key
 * would put credentials this caller has no business holding into its scope,
 * and the first time one of those got interpolated into an error message it
 * would be in a log. Portfolio rule: never read, display or log the contents
 * of an env file. Returning one requested value is the narrowest thing that
 * satisfies the callers.
 *
 * ## ABSENT IS A NAMED ANSWER, NOT AN EMPTY STRING
 *
 * Returns `null` when the file or the key is missing, and the CALLER decides
 * what that means. It matters that the two callers decide differently: a gate
 * fails closed and names the credential, while `uptime-ensure` refuses before
 * it touches the network. Returning `""` would let a caller send an empty
 * bearer token and read the API's 401 as a site problem.
 *
 * `.dev.vars` is dotenv-shaped: `NAME=value`, optionally quoted, `#` comments.
 * This parses the one line it was asked for rather than the whole file, so a
 * malformed line belonging to another key cannot break a caller that does not
 * read it.
 */
```

### scripts/lib/dev-vars.mjs:51 (WHY, shortened)

why anchored to the line and the name; hard rule 10 kept.

```js
/*
   * ANCHORED TO THE LINE AND TO THE NAME. An unanchored needle would match
   * `MY_UPTIMEROBOT_API_KEY` and hand back the wrong credential, which is the
   * hard rule 10 anchoring discipline applied to a value rather than to a
   * count. `m` for multiline; the name is escaped because a caller could pass
   * anything.
   */
```

### scripts/lib/dev-vars.mjs:64 (CONTRACT, shortened)

the parse order; one line already.

```js
// Strip a trailing comment only when the value is unquoted, then one matching
  // pair of quotes, then whitespace. A `#` inside quotes is part of the value.
```

## scripts/lib/sqlite-tables.mjs

### scripts/lib/sqlite-tables.mjs:1 (CONTRACT, shortened)

the three rules and why each is derived; the three call sites and the date go to the history document.

```js
/**
 * Classifying `sqlite_master` rows into virtual, shadow and real tables.
 *
 * ONE ENUMERATOR RULE, TWO SOURCES. Extracted 2026-08-10 because three callers
 * were applying the same classification independently:
 *
 *   check-backup.mjs      rows read from the LIVE database over wrangler
 *   check-invariants.mjs  rows read from the migrations replayed into :memory:
 *   check-invariants.mjs  section 7, the same, for the FTS delete scan
 *
 * The rules were already identical and the comments in both files said so, but
 * "identical because two people wrote them the same way" is exactly the shape
 * this repo keeps converting into one module with several readers. The
 * classifier is source-agnostic: it takes rows, not a database.
 *
 * ## The rules, and why each is derived rather than named
 *
 * VIRTUAL: the DDL says `CREATE VIRTUAL TABLE`. Never a name list, because
 * `posts_fts`, `search_identity` and `search_prose` were one, then two, then
 * three, and a hardcoded list is how the next one gets missed.
 *
 * SHADOW: the name is prefixed with a virtual table's name and an underscore.
 * fts5 creates `_data`, `_idx`, `_content`, `_docsize` and `_config` per index,
 * and the set differs by fts5 version, so the prefix is the durable rule and a
 * suffix list is not.
 *
 * INTERNAL: `sqlite_%`, reserved by SQLite for its own bookkeeping.
 *
 * Platform bookkeeping (`_cf_KV`, `d1_migrations`, `_cf_METADATA`) is NOT
 * handled here. It is a property of where the rows came from, not of SQLite, so
 * it stays with the caller that reads a live D1.
 *
 * @param {{ name: string, sql: string | null }[]} rows
 * @returns {{ virtual: string[], shadow: string[], real: string[] }}
 */
```

### scripts/lib/sqlite-tables.mjs:59 (CONTRACT, shortened)

what the set is and both ways of getting it wrong.

```js
/**
 * Every table name an FTS index owns: the index itself plus its shadow tables.
 *
 * This is the set that must never be written to directly. `DELETE FROM` any of
 * them corrupts the index, and the repair is
 * `INSERT INTO <index>(<index>) VALUES('rebuild')`. Counting rows in one is
 * equally wrong in the other direction: `COUNT(*)` on an external-content index
 * reads THROUGH to the content table and can never detect drift, which is why
 * the health checks count `*_docsize` instead.
 *
 * @param {{ virtual: string[], shadow: string[] }} classified
 * @returns {string[]}
 */
```

## scripts/lib/wrangler-config.mjs

### scripts/lib/wrangler-config.mjs:1 (CONTRACT, shortened)

the rule and why the real file; the prune's arrival goes to the history document.

```js
/**
 * Reads resource names out of the real wrangler config.
 *
 * **Nothing that talks to a bucket may name one in a string literal.** That was
 * already a latent hazard while `build:og` only ever PUT objects; it became a
 * live one when the prune landed, because a stale literal would then aim a
 * DELETE at whatever bucket happened to still answer to that name. Deriving it
 * means renaming a bucket in the config is a rename everywhere, and a bucket
 * that no longer exists is an immediate error rather than a silent no-op.
 *
 * `wrangler.jsonc` is gitignored and `wrangler.jsonc.example` is tracked, per
 * the portfolio's public-repo hygiene rule. This reads the REAL file, because
 * the example carries placeholder ids and a build script needs the truth;
 * `check:config` is what keeps the two describing the same binding surface.
 */
```

### scripts/lib/wrangler-config.mjs:24 (CONTRACT, shortened)

what it converts; one line already.

```js
/**
 * JSONC to JSON. Comments only; this config has no trailing commas. Same
 * stripping `check-config.mjs` does, and for the same reason.
 * @returns {any}
 */
```

### scripts/lib/wrangler-config.mjs:29 (WHY, shortened)

why the weak stripper and why weak is enough; the measurement date goes to the history document.

```js
/*
 * WEAK ON PURPOSE. This is JSONC on its way to JSON.parse, so the shared
 * strong stripper in scripts/lib/strip-comments.mjs must NOT be used: its
 * line-comment rule eats a protocol-relative url ("//cdn.example.com/x"),
 * whose slashes follow a quote rather than a colon, and takes the rest of
 * the line with it. MEASURED 2026-08-23: the config stops parsing.
 *
 * Weak is SUFFICIENT here, which is the other half: JSON.parse throws on
 * any comment this fails to remove, so an under-strip cannot pass quietly.
 * test/strip-comments.test.mjs asserts both halves.
 */
```

### scripts/lib/wrangler-config.mjs:46 (CONTRACT, shortened)

what it returns; one line already.

```js
/**
 * Every R2 bucket name the Worker binds, keyed by binding name.
 * @returns {Record<string, string>}
 */
```

### scripts/lib/wrangler-config.mjs:63 (WHY, shortened)

why derived; the literal it replaced goes to the history document.

```js
/**
 * The D1 database NAME for a binding, or a named failure.
 *
 * DERIVED, not restated. `sync-content.mjs` carries `const DB_NAME =
 * "dustinedwards"` as a literal, which is the mirror shape this repo keeps
 * paying for; `build-og.mjs` needed the same value and this is where it comes
 * from instead of a second copy.
 *
 * @param {string} binding
 */
```

### scripts/lib/wrangler-config.mjs:89 (CONTRACT, shortened)

why it throws; one line already.

```js
/**
 * One bucket by binding name, or a named failure.
 *
 * Throws rather than returning undefined, so a typo cannot become `undefined`
 * interpolated into a wrangler command line.
 *
 * @param {string} binding
 */
```

## scripts/lib/artifact.mjs

### scripts/lib/artifact.mjs:1 (CONTRACT, shortened)

one writer and where it moved; the arc goes to the history document.

```js
/**
 * The on-disk shape of the local content build product.
 *
 * ONE writer since the artifact arc: `scripts/build-content.mjs`, whose output
 * is a gitignored local file that sync-content, the gates and the OG and
 * diagram builders read after building it. The admin editor no longer writes
 * or reads this shape; it renders straight into D1 through `renderAndWrite`.
 * Moved from app/lib/content/ to scripts/lib/ with that change, because the
 * Worker imports nothing from it any more.
 */
```

### scripts/lib/artifact.mjs:25 (WHY, shortened)

why pages is required and the throw is the point; the ruling goes to the history document.

```js
/*
   * `pages` is REQUIRED, and the throw is the point.
   *
   * Ruling 3 of colophon-page.md put hand-authored pages in the search corpus,
   * so the records array is no longer derivable from `posts` alone. A caller
   * that forgot the second argument would produce a SMALLER artifact that is
   * internally consistent and passes every shape check, and `check:content`
   * would then go red on the next ordinary build with a byte difference nobody
   * could place. Failing here names it instead.
   *
   * The two callers, `scripts/build-content.mjs` and the editor's save path,
   * differ only in how they LOAD the JSON that feeds `colophonPages()`. The
   * assembly itself lives in one place, for the reason this whole module exists.
   */
```

### scripts/lib/artifact.mjs:47 (WHY, shortened)

why not defaulted; the record count goes to the history document.

```js
/*
   * `papers` IS REQUIRED FOR THE SAME REASON, and it is required rather than
   * defaulted to an empty array on purpose. A default is the exact failure the
   * paragraph above describes, reintroduced: a caller that forgot it would
   * produce an artifact missing 36 records, internally consistent, passing
   * every shape check, and red on the next unrelated build.
   */
```

### scripts/lib/artifact.mjs:62 (WHY, shortened)

why records are derived and why the order is fixed.

```js
// Records are derived here rather than stored per post so that adding a post
  // cannot leave another post's records stale. They are a pure function of the
  // post list, the page inputs and the paper inputs, so the gate compares them
  // like everything else. Posts, then pages, then papers, each internally
  // sorted, so the order is stable across writers and `check:content` never
  // fails on ordering alone.
```

## scripts/check-guidelines.mjs

### scripts/check-guidelines.mjs:1 (CONTRACT, shortened)

what drift it sees, the tier limitation, the credential rule and why the glob is checked; the ruling goes to the history document.

```js
/**
 * Gate: the Capsid documents handed to the design agent are not stale, and the
 * guidelines the glob ships actually exist.
 *
 * ## THE DEFECT THIS IS FOR, ruling 109
 *
 * `guidelinesGlob` now ships an export of three Capsid documents. An export is
 * a copy, and a copy has no way of knowing its source moved. Without an
 * instrument, the canvas would be handed a ruling that was reversed a week ago
 * and nothing anywhere would say so; the design agent would be confidently
 * working from a superseded rule, which is the exact failure the whole wiring
 * arc exists to close.
 *
 * Every exported file carries the `updated_at` it was taken at. This compares
 * that stamp to Capsid's CURRENT value. Hard rule 18's shape: the export is
 * derived, the repair is re-running the derivation, and the gate sees the
 * DRIFT rather than trying to police how the copy got there.
 *
 * ## NETWORK TIER, AND IT CANNOT BE OTHERWISE
 *
 * The current `updated_at` lives in Capsid. There is no disk to read, so a
 * clean checkout cannot run this and `--ci` does not, the same reason
 * `check:volumes` and `check:uptime` are tiered here.
 *
 * ## THE CREDENTIAL FAILS CLOSED, on check:volumes' precedent
 *
 * `CAPSID_TOKEN` from the environment or the gitignored `.dev.vars`. Absent,
 * this FAILS rather than skipping: a gate that silently does not run is the
 * thing the runner exists to prevent, and an unchecked export is not an export
 * known to be current.
 *
 * ## WHY IT ALSO CHECKS THE GLOB
 *
 * A stamp check over an empty directory passes, because every export it found
 * was in step and it found none. That is the zero-scope vacuity class (hard
 * rule 10), so the glob's own targets are asserted present first, and the
 * expected document list comes from `lib/capsid.mjs` rather than from whatever
 * happens to be on disk.
 */
```

### scripts/check-guidelines.mjs:84 (CONTRACT, shortened)

what each glob entry must resolve to.

```js
// Every literal (wildcard-free) glob entry must resolve to a file that exists,
  // and every wildcard entry to a directory with something in it. A glob that
  // matches nothing ships nothing and says nothing.
```

## scripts/bootstrap-config.mjs

### scripts/bootstrap-config.mjs:1 (CONTRACT, shortened)

what it copies, the never-overwrite rule and what the copies are enough for; the measurement, the exit code and the dates go to the history document.

```js
// Bootstrap the local wrangler configs so a fresh clone can install and typecheck.
//
// The real wrangler.jsonc is gitignored portfolio-wide (capsid/conventions.md:
// real config never in git, commit a wrangler.jsonc.example with placeholder
// ids). That leaves a fresh clone with no config at all, and `wrangler types`
// is the first thing postinstall runs, so `npm install` itself fails before the
// tree is usable. Measured 2026-07-27: exit 127, "No config file detected".
//
// This copies each committed example into place once. It NEVER overwrites: if
// the destination already exists it exits silently for that pair and prints
// nothing, so a real config carrying live values survives any number of
// reinstalls. The existsSync check and COPYFILE_EXCL both guard that, so a file
// appearing between the check and the copy still cannot be clobbered.
//
// The copied files carry placeholder values. That is enough for
// `wrangler types` to generate worker-configuration.d.ts, since typegen reads
// binding names and types and ignores the values. It is NOT enough to deploy or
// to run against real resources. Fill in the real values for that.
//
// TWO PAIRS SINCE 2026-08-29, and this is a LOOP rather than a second copy of
// the same twenty lines. The watchdog Worker has its own config for the same
// portfolio reason the site's has one: it carries a value that must not be in
// git. A missing example is fatal for EITHER pair, because a clone that
// silently ends up without one of them fails later and further from the cause.
```

### scripts/bootstrap-config.mjs:32 (CONTRACT, shortened)

why the advice is per pair.

```js
/**
 * Every gitignored config and the tracked example it is bootstrapped from.
 *
 * The `what` string is what a reader is told to fill in, per pair, because
 * "placeholder resource ids" is wrong advice for the watchdog: its placeholder
 * is an inbox address and there are no ids in it at all.
 *
 * @type {ReadonlyArray<{ dest: string, src: string, what: string }>}
 */
```

### scripts/bootstrap-config.mjs:71 (CONTRACT, shortened)

why narrowed and why this path is expected.

```js
// Narrowed rather than asserted: under checkJs a catch binding is `unknown`,
    // and COPYFILE_EXCL failing with EEXIST is the expected path when the config
    // already exists.
```

## scripts/lib/capsid.mjs

### scripts/lib/capsid.mjs:1 (CONTRACT, shortened)

why the document list has one owner and what is deliberately absent.

```js
/**
 * One client for Capsid's MCP endpoint, and one list of the documents the
 * canvas is given.
 *
 * ## WHY THE DOCUMENT LIST LIVES HERE
 *
 * `build-capsid-guidelines.mjs` exports these documents and `check:guidelines`
 * asserts the exports are current. If each carried its own list, the gate would
 * eventually be checking a set the exporter no longer writes, and it would
 * still pass: every document it knew about would be in step. That is the
 * alias-blind failure hard rule 10 names, so the list has one owner.
 *
 * ## WHAT IS DELIBERATELY NOT HERE
 *
 * No credential handling. The caller reads `CAPSID_TOKEN` and decides what
 * absent means, because the two callers decide differently: the gate fails
 * closed and names the credential, the build step refuses before it writes a
 * half-empty directory.
 */
```

### scripts/lib/capsid.mjs:24 (CONTRACT, shortened)

what earns a place and the two exclusions.

```js
/**
 * The Capsid documents the design agent is given, and why each one earns a
 * place in a budget the canvas actually reads.
 *
 * Deliberately NOT here: `feature-inventory-2026-09.md`, which answers what to
 * build rather than how it should look, and `docs/RUNBOOK.md`, which is 2am
 * operational procedure with no design content.
 */
```

### scripts/lib/capsid.mjs:47 (CONTRACT, shortened)

why the last data line; one line already.

```js
/**
 * One JSON-RPC call against Capsid's MCP endpoint.
 *
 * The endpoint may answer as SSE. This takes the LAST `data:` line rather than
 * the first, because a stream can carry progress frames ahead of the result and
 * reading the first would parse a notification as the answer.
 *
 * @param {string} token
 * @param {string} name
 * @param {Record<string, unknown>} args
 */
```

### scripts/lib/capsid.mjs:84 (CONTRACT, shortened)

what the stamp is for; the mechanism kept in one line.

```js
/**
 * The stamp an exported file carries, and the parser that reads it back.
 *
 * The gate compares the stamp to Capsid's CURRENT `updated_at`. That is the
 * whole mechanism: an export is a copy, a copy has no way of knowing its source
 * moved, and the stamp is what makes the drift visible instead of silent
 * (hard rule 18, a derived store and the gate that sees the drift).
 */
```

## scripts/lib/design-sheets.mjs

### scripts/lib/design-sheets.mjs:1 (CONTRACT, shortened)

why a lib rather than two copies.

```js
/**
 * One reader for the design-sync sheet list, and one parser for a stylesheet's
 * comment blocks.
 *
 * ## WHY THIS IS A LIB RATHER THAN TWO COPIES
 *
 * `check:design-sheets` asserts the list is right; `build-guidelines.mjs`
 * extracts reasoning out of the sheets the list names. Both must read the SAME
 * `SHEETS` array out of `.design-sync/build-inputs.mjs`, which stays its one
 * owner (hard rule 17). Two hand-rolled parsers would be a second and third
 * place for the shape of that array to be known, and the gate exists precisely
 * because a hand-maintained second copy went stale.
 *
 * Hard rule 10, "one helper name, one argument order": both callers use these
 * names and no local variant.
 */
```

### scripts/lib/design-sheets.mjs:21 (CONTRACT, shortened)

why it throws rather than returning empty.

```js
/**
 * The `SHEETS` array, parsed from its owner.
 *
 * Throws rather than returning an empty list: a search over an empty scope
 * reports exactly what a clean sweep reports, so a broken parse must be a
 * refusal and never a quiet zero.
 *
 * @param {string} repo absolute path to the repo root
 * @returns {string[]} repo-relative stylesheet paths, in cascade order
 */
```

### scripts/lib/design-sheets.mjs:49 (CONTRACT, shortened)

what it returns and why the line number; one line already.

```js
/**
 * Every `/* ... *\/` block in a stylesheet, with the 1-indexed line it starts
 * on so an extract can point back at its owner.
 *
 * @param {string} css
 * @returns {{ text: string, line: number }[]}
 */
```

### scripts/lib/design-sheets.mjs:62 (WHY, shortened)

why the simple count; one line already.

```js
// Counting newlines before the match is O(n) per block and the sheets are
    // small; a running index would be faster and easier to get wrong.
```

### scripts/lib/design-sheets.mjs:70 (CONTRACT, shortened)

what furniture is removed; one line already.

```js
/**
 * A comment block's prose, with the comment furniture removed: the opening and
 * closing markers, the leading star on each continuation line, and the rule
 * bars some sections use as dividers.
 *
 * @param {string} block
 * @returns {string}
 */
```

## scripts/lib/sql-literals.mjs

### scripts/lib/sql-literals.mjs:1 (CONTRACT, shortened)

why extracted, what it unblocked and why joining is safe; the date, the named siblings and the quoted fragment go to the history document.

```js
/**
 * Joining adjacent string literals across `+`, so a SQL statement split for
 * line length is one statement again.
 *
 * EXTRACTED from `check-invariants.mjs` 2026-08-09 so it can be tested without
 * importing that gate, which runs its whole suite at module load (esbuild plus
 * an in-memory SQLite) and cannot be imported for one function. Same
 * one-module-two-callers pattern the pipeline already uses for `records.mjs`,
 * `artifact.mjs` and `ask-keys.mjs`: the gate and the test import the same
 * code, so a test cannot pass against a copy of the rule.
 *
 * **This is what `sync-content.mjs` needed, and without it that file was the
 * last hole in section 5 of that gate.** It builds its SQL as literal text, so
 * the column names are all statically present, but it concatenates fragments:
 *
 *     `INSERT INTO posts (slug, kind, title, body, ` +
 *       `html, description, ...) VALUES (` +
 *       ...
 *
 * Every extraction in that section needs a WHOLE statement. The INSERT column
 * list is matched up to its closing paren, and that paren is three fragments
 * away, so the largest write path in the repo was invisible while the file
 * still appeared in the scan, because its single-fragment statements matched.
 * A gate that examines a file and misses its most important statement reports
 * the same "0 problems" as one that examined it properly.
 *
 * Joining is safe for the same reason it is necessary: it can only make a
 * literal LONGER, and a longer literal that is not SQL still fails the
 * `LOOKS_LIKE_SQL` test, while a name that resolves to no table is caught
 * either way.
 *
 * @param {string} source
 * @returns {string}
 */
```

## scripts/build-capsid-guidelines.mjs

### scripts/build-capsid-guidelines.mjs:1 (CONTRACT, shortened)

why a copy is forced, what makes it honest and the credential rule; the rejected alternative goes to the history document.

```js
/**
 * Export the Capsid documents the canvas needs into the guidelines directory.
 *
 * ## WHY A COPY EXISTS AT ALL, when hard rule 17 says one owner per fact
 *
 * `guidelinesGlob` can only point at `.md` files inside the workspace, and the
 * skill drops anything whose realpath escapes it. Capsid documents are database
 * rows. So the design agent cannot be handed a pointer: it can only be handed
 * text, and a copy is forced.
 *
 * The honest version of a forced copy is a DERIVED one. Capsid stays the owner,
 * this writes a gitignored export, every file carries the `updated_at` it was
 * taken at, and `check:guidelines` fails when the source has moved since. Same
 * shape as hard rule 18: the store is derived, the repair is re-running the
 * derivation, and the gate sees the drift rather than the provenance.
 *
 * The alternative considered and rejected: a hand-written repo document that
 * SUMMARISES the rulings and points at Capsid for the rest. That is the rule-17
 * shape and it is worthless here, because the reader this is for cannot follow a
 * pointer into Capsid.
 *
 * ## THE CREDENTIAL
 *
 * `CAPSID_TOKEN`, from the environment or the gitignored `.dev.vars`, the same
 * operator credential `check:volumes` reads. It is machine-local and not a
 * wrangler secret, because it is read by a Node program here rather than by
 * deployed code. Absent, this REFUSES rather than writing a partial directory:
 * a half-exported guidelines set that still globs is worse than none.
 */
```

### scripts/build-capsid-guidelines.mjs:70 (CONTRACT, shortened)

why rebuilt; one line already.

```js
// Rebuild, so a document dropped from the list cannot survive as a stale file
  // the glob still ships.
```

## scripts/mint-smoke-token.mjs

### scripts/mint-smoke-token.mjs:1 (CONTRACT, shortened)

why silent, the no-command-line rule and why the size; the three one-liners kept as the reason.

```js
/**
 * Mints a SMOKE_TOKEN. Prints it once, on stdout, and outputs nothing else.
 *
 *   node scripts/mint-smoke-token.mjs
 *
 * ## WHY IT IS SILENT
 *
 * One line on stdout and nothing else, so the output is a VALUE rather than a
 * transcript. That makes every safe way of handling it a one-liner and every
 * unsafe one harder:
 *
 *   node scripts/mint-smoke-token.mjs > .smoke-token
 *   node scripts/mint-smoke-token.mjs | npx wrangler secret put SMOKE_TOKEN
 *   node scripts/mint-smoke-token.mjs | gh secret set SMOKE_TOKEN
 *
 * A banner, a label, or a "copy this into wrangler" instruction would land in
 * the file or the secret alongside the token and produce a credential that is
 * silently wrong. The instructions live in README.md and RECOVERY.md, where
 * they can be read without being executed.
 *
 * **IT NEVER TOUCHES A COMMAND LINE AND NEVER TOUCHES A LOG.** The token is not
 * an argument to anything, so it cannot appear in a process listing or a shell
 * history; `wrangler secret put` and `gh secret set` both read stdin.
 *
 * ## THE SIZE
 *
 * 48 random bytes, base64url, which is 64 characters. The Worker's floor is 32
 * and this is deliberately well clear of it: the floor exists to catch a
 * misconfiguration, not to describe a sensible secret.
 *
 * `randomBytes` is the CSPRNG. `Math.random` is not one, and the distinction is
 * the whole value of this file.
 */
```
