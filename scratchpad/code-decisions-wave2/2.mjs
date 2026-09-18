// Chunk 2: scripts/check-headers.mjs, blocks 0-85.
//
// Two owners argue in this gate: RATIFIED is transcribed from the rulings and the actual set
// is parsed out of the Worker, so the prose that says WHY a value is the unrestrictive one
// stays. What goes is every dated re-measurement of the floor and every account of which
// session re-scoped which needle.
export default {
  "scripts/check-headers.mjs#0": [
    "CONTRACT",
    "the boundary, the two-sources design and the fail-closed rule; the CI aside and the restatement cut",
    `Gate over the security headers the Worker stamps on every response: npm run check:headers.

BOUNDARY: IT CANNOT SEE THE WIRE. It asserts what workers/app.ts DECLARES, which is hard rule 7
for this file; the wire is verify-live's. Two independent sources argue, the expected set
transcribed and the actual parsed, and two values are deliberately not the restrictive choice.
FAILS CLOSED on a missing constant.`,
  ],
  "scripts/check-headers.mjs#1": ["CONTRACT", "type annotation plus the not-read-from-source rule; two lines already"],
  "scripts/check-headers.mjs#3": [
    "WHY",
    "the prose trap in one line",
    `Comments stripped first: this file's prose names headers while explaining why they are wrong.`,
  ],
  "scripts/check-headers.mjs#4": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#5": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-headers.mjs#7": ["CONTRACT", "section marker, rule padding cut", `both directions, name by name`],
  "scripts/check-headers.mjs#8": ["WHY", "one line already; kept"],
  "scripts/check-headers.mjs#9": ["CONTRACT", "section marker, rule padding cut", `the two values that look tightenable`],
  "scripts/check-headers.mjs#10": [
    "WHY",
    "why these two get named assertions",
    `Named individually, because these two are what a future session is most likely to "fix".`,
  ],
  "scripts/check-headers.mjs#11": ["CONTRACT", "section marker, rule padding cut", `applied on BOTH branches`],
  "scripts/check-headers.mjs#12": [
    "WHY",
    "declaring and applying are different; the live example kept",
    `Declaring the set and applying it differ: app.ts has two exits, and one helper call means
redirects ship bare.`,
  ],
  "scripts/check-headers.mjs#13": ["CONTRACT", "section marker, rule padding cut", `the cache-control DEFAULT`],
  "scripts/check-headers.mjs#14": [
    "WHY",
    "the auth bypass and hard rule 8's cached silence; the dated audit goes to Capsid",
    `THIS GUARDS AN AUTH BYPASS: with no Cache-Control an /admin render is stored under heuristic
freshness under a cookieless key. BOTH EXITS.`,
  ],
  "scripts/check-headers.mjs#15": ["CONTRACT", "what the needle matches; two lines already"],
  "scripts/check-headers.mjs#16": ["WHY", "a guard that reads as protection; two lines already"],
  "scripts/check-headers.mjs#17": ["CONTRACT", "section marker, rule padding cut", `the CSP (Phase B, ENFORCED)`],
  "scripts/check-headers.mjs#18": [
    "WHY",
    "the cheapest wrong fix and the strict-dynamic trap; the phase story cut",
    `unsafe-inline IS THE ASSERTION THAT MATTERS: it silences the report, breaks nothing, and is
what an injected script needs. strict-dynamic makes browsers ignore it until it is dropped.`,
  ],
  "scripts/check-headers.mjs#19": [
    "WHY",
    "call the builder rather than regex it, and the fixture-independence rule",
    `THE POLICY IS CALLED, NOT PARSED: a regex sees both branches exist, not which one a request
gets. The builder is imported and the nonce is fixed here, which is fixture independence.`,
  ],
  "scripts/check-headers.mjs#22": [
    "WHY",
    "why names and not values, and why both branches; the expired Report-Only argument cut",
    `The ratified directive NAMES, not their values, or this becomes a mirror of workers/csp.mjs.
BOTH BRANCHES: a directive dropped from one arm is what a single-arm sweep calls clean.`,
  ],
  "scripts/check-headers.mjs#23": ["CONTRACT", "section marker, rule padding cut", `the feeds get NO policy at all`],
  "scripts/check-headers.mjs#24": [
    "WHY",
    "the two-owners drift and why the types are read from the routes; the dated measurement to Capsid",
    `EVERY FEED ROUTE'S DECLARED CONTENT-TYPE IS ONE isFeed() EXEMPTS. The two owners had already
drifted. The types are READ OUT OF THE ROUTE FILES and isFeed is CALLED, not spelled.`,
  ],
  "scripts/check-headers.mjs#25": [
    "WHY",
    "why named and not globbed",
    `Named rather than globbed: the assertion is about THESE THREE, and a glob quietly shrinks.`,
  ],
  "scripts/check-headers.mjs#26": ["WHY", "the needle trap; two lines already"],
  "scripts/check-headers.mjs#27": [
    "WHY",
    "the unfailable-condition negative",
    `THE NEGATIVE, so the three above cannot pass by isFeed() having become a constant true.`,
  ],
  "scripts/check-headers.mjs#28": ["CONTRACT", "section marker, rule padding cut", `the style nonce is ADMIN ONLY`],
  "scripts/check-headers.mjs#29": [
    "WHY",
    "the silent widening and why both directions are asserted",
    `THE PUBLIC BRANCH IS THE ASSERTION THAT MATTERS: true everywhere fixes a violation report and
breaks nothing visible, while header and body share one public entry for the cache lifetime.
BOTH DIRECTIONS, since refusing it publicly is equally satisfied by a broken editor.`,
  ],
  "scripts/check-headers.mjs#30": [
    "WHY",
    "assert on real paths, not on the caller's if",
    `WHAT DECIDES THE BRANCH, on real paths rather than on the caller's if, which would mirror it.`,
  ],
  "scripts/check-headers.mjs#31": ["CONTRACT", "which arm the path matches; two lines already"],
  "scripts/check-headers.mjs#32": [
    "WHY",
    "the guard survives the ruling flipping; the date and the eleven days cut",
    `ENFORCED, NOT REPORT-ONLY: a revert leaves the page working, the header present and the
reports arriving, with nothing blocked.`,
  ],
  "scripts/check-headers.mjs#33": [
    "WHY",
    "reporting and enforcing are independent",
    `REPORTING SURVIVES ENFORCEMENT: a policy blocks silently, so the reports are the only signal.`,
  ],
  "scripts/check-headers.mjs#34": ["CONTRACT", "section marker, rule padding cut", `the nonce reaches every script`],
  "scripts/check-headers.mjs#35": [
    "WHY",
    "what a source-level check here is for",
    `TWO SCRIPT CLASSES THAT DO NOT GET THE NONCE FOR FREE, both found by the browser rather than
by reading. What this stops is a later edit dropping either one.`,
  ],
  "scripts/check-headers.mjs#36": [
    "WHY",
    "which scripts ship bare without the prop; the dated report count to Capsid",
    `ServerRouter passes its nonce prop both into FrameworkContext and to StreamTransfer; without
it React Router's two streaming scripts ship bare, one of them carrying the payload.`,
  ],
  "scripts/check-headers.mjs#37": [
    "WHY",
    "the counter-intuitive gating, the silent failure, and the stated exclusion; the deleted sibling cut",
    `THE SPECULATION BLOCK, and there is exactly ONE: speculationrules is gated by script-src, so
an un-nonced element is refused SILENTLY and the page renders identically without it.`,
  ],
  "scripts/check-headers.mjs#38": ["HISTORY", "which build renamed the component and that the gate followed; what is asserted never moved", null],
  "scripts/check-headers.mjs#39": ["CONTRACT", "section marker, rule padding cut", `the draft preview route (feature G)`],
  "scripts/check-headers.mjs#40": [
    "WHY",
    "the copy-paste this is written for, and why an identifier is accepted as a value",
    `THE ONE ROUTE WHOSE HEADERS ARE THE ACCESS CONTROL: /preview/:token serves an unpublished
post to a caller with no session, and the cookieless downgrade never fires for it. An
IDENTIFIER counts as a value, so the shared constant fails as wrong rather than as absent.`,
  ],
  "scripts/check-headers.mjs#41": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#42": ["CONTRACT", "why both value shapes are captured; already short"],
  "scripts/check-headers.mjs#43": ["WHY", "one line already; kept"],
  "scripts/check-headers.mjs#44": [
    "WHY",
    "the subtler shape the value check misses",
    `NO PUBLIC BRANCH, named: the rule is that the identifier does not appear in this file AT ALL.`,
  ],
  "scripts/check-headers.mjs#45": ["CONTRACT", "section marker, rule padding cut", `the analytics capture (feature F.1 + G)`],
  "scripts/check-headers.mjs#46": [
    "WHY",
    "a one-off live measurement is not a gate, and why the section lives in this file",
    `A LIVE MEASUREMENT IS NOT A GATE: dropping the /admin skip would leave every gate green while
the operator's own views flowed into the panel that exists to exclude them.`,
  ],
  "scripts/check-headers.mjs#47": [
    "WHY",
    "why each exclusion is named separately",
    `Each exclusion named individually, because a failure saying WHICH one went is worth more.`,
  ],
  "scripts/check-headers.mjs#48": [
    "WHY",
    "the capability in the path, both slots, and why absence is asserted too",
    `THE REDACTION IS AN ACCESS CONTROL: /preview/<token> carries a capability in its PATH. BOTH
SLOTS separately, and the ABSENCE of the raw expression, or a capture computes the safe path
and writes the raw one anyway.`,
  ],
  "scripts/check-headers.mjs#49": [
    "NUMBER",
    "the floor is asserted below; the dated step-by-step re-measurements go to Capsid",
    `EXECUTED-COUNT FLOOR. A green run with nothing in it looks like a green run that checked
everything. MEASURED BY RUNNING THIS GATE, never summed.`,
  ],
  "scripts/check-headers.mjs#50": [
    "WHY",
    "an SVG is a document, why the assertion outlives the CSP, and the boundary",
    `UPLOADED SVG IS SERVED AS AN ATTACHMENT: it can carry script and /media/* is the site's own
origin. Kept even though the CSP blocks it, because it does not depend on the policy.`,
  ],
  "scripts/check-headers.mjs#51": ["WHY", "scoped to the helper body; two lines already"],
  "scripts/check-headers.mjs#52": [
    "WHY",
    "the pairing is the invariant, and what restating the type would allow",
    `DERIVED FROM THE UPLOAD ALLOWLIST, never restated, or a NEW capable type joins with no rule.`,
  ],
  "scripts/check-headers.mjs#53": [
    "WHY",
    "the half that rots",
    `AND APPLIED ON EVERY PATH THAT SERVES THE STORED BYTES, the half a helper check cannot see.`,
  ],
  "scripts/check-headers.mjs#54": [
    "WHY",
    "the glob-widening hazard, why it is per block, and the stated exclusion; the dated measurements to Capsid",
    `ASSET CACHE RULES in public/_headers. The immutable year is scoped to /assets/*, whose names
carry a content hash; the danger is the glob widening over stable paths. Asserted as the
PROPERTY and read PER BLOCK, since a file-wide reading cannot attribute a directive.`,
  ],
  "scripts/check-headers.mjs#55": [
    "CONTRACT",
    "the constant's meaning and the no-purge-door reason, cites hard rule 20; trimmed",
    `The longest freshness an UNHASHED path may declare, in seconds. Nothing recalls a stored
entry and there is no purge door here, which hard rule 20 records. /assets/* is exempt.`,
  ],
  "scripts/check-headers.mjs#56": ["CONTRACT", "the file's shape; one line already"],
  "scripts/check-headers.mjs#57": [
    "WHY",
    "what the flat split could not answer",
    `PARSED INTO BLOCKS, so every directive is attributed to the path it sits under.`,
  ],
  "scripts/check-headers.mjs#59": ["WHY", "malformed input is counted, not dropped; two lines already"],
  "scripts/check-headers.mjs#60": [
    "WHY",
    "why both directives are read",
    `THE PROPERTY, per block, and both max-age and s-maxage: a year at the edge is as un-revokable.`,
  ],
  "scripts/check-headers.mjs#61": ["CONTRACT", "section marker, rule padding cut", `the health endpoint's own headers`],
  "scripts/check-headers.mjs#62": [
    "WHY",
    "hard rule 8's cached silence and why the scope is structural; the commit reference cut",
    `A HEALTH CHECK SERVED FROM CACHE IS NOT A HEALTH CHECK: no Cache-Control means heuristic
freshness (hard rule 8). SCOPED STRUCTURALLY by counting the ONE Response construction,
because "the file mentions no-store" passes on a comment.`,
  ],
  "scripts/check-headers.mjs#63": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#65": ["WHY", "why identifiers are captured as values; three lines already"],
  "scripts/check-headers.mjs#66": [
    "WHY",
    "why one construction site is the invariant",
    `THE APPLICATION SITE, counted: one construction is what makes the header provably universal.`,
  ],
  "scripts/check-headers.mjs#67": ["WHY", "bounded to the body, not a window; two lines already"],
  "scripts/check-headers.mjs#68": [
    "WHY",
    "why seeding is asserted rather than a bare mention; the date and the needle story cut",
    `new Headers(HEALTH_HEADERS), not a bare mention, so the one site is built FROM the constant.`,
  ],
  "scripts/check-headers.mjs#69": [
    "WHY",
    "the shared cache entry across schemes, and why position; the dated measurement to Capsid",
    `MEASURED ON THE WIRE: plain http returned the full page, and a warmed path came back a HIT
carrying the same nonce. Asserted on POSITION: a redirect after the router is not a redirect.`,
  ],
  "scripts/check-headers.mjs#70": [
    "WHY",
    "an assertion about position must know which body it reads; the re-scoping story to Capsid",
    `SCOPED TO THE GATEWAY, because a position assertion must know which body it reads, and before
the LOOPBACK, so before anything could be answered from cache.`,
  ],
  "scripts/check-headers.mjs#71": [
    "WHY",
    "the other direction and what it stops",
    `AND THE RENDERER DOES NOT REDIRECT, or the assertion above is satisfied by a copy that runs
on a miss only.`,
  ],
  "scripts/check-headers.mjs#72": [
    "WHY",
    "why this one is a safety property",
    `The redirect's own caching is a safety property: the scheme is NOT in the cache key.`,
  ],
  "scripts/check-headers.mjs#73": ["CONTRACT", "section marker, rule padding cut", `every public HTML route sets the shared policy`],
  "scripts/check-headers.mjs#74": [
    "WHY",
    "the symptomless gap, why the routes are asserted and not the helper, and the stated exclusions",
    `A public page exporting no headers() falls through to hard rule 8's uncached default with no
symptom a human meets. Asserted on the ROUTE FILES, comment-stripped, not on the helper.`,
  ],
  "scripts/check-headers.mjs#75": ["WHY", "why the About page belongs in this list; three lines already"],
  "scripts/check-headers.mjs#76": [
    "WHY",
    "why a query string is a cache key rather than a refusal",
    `The publication index: its QUERY STRING is part of the key rather than a reason to refuse,
since the chips and the sort are GET parameters and nothing on it is reader-specific.`,
  ],
  "scripts/check-headers.mjs#77": [
    "WHY",
    "one reader's copy is every reader's copy",
    `One paper's page, same policy: every byte is a function of the committed corpus.`,
  ],
  "scripts/check-headers.mjs#78": ["WHY", "why the tag archive is not Accept-negotiating; three lines already"],
  "scripts/check-headers.mjs#79": ["WHY", "the series archive on the same terms; two lines already"],
  "scripts/check-headers.mjs#80": [
    "WHY",
    "why /blog is in this list rather than the negotiating one; the dated move cut",
    `/blog is here rather than with the negotiating routes: no twin representation, and with the
theme in the cache key it has no reason for a Vary at all.`,
  ],
  "scripts/check-headers.mjs#81": [
    "WHY",
    "why these two cannot call the helper; the dated shrink from three cut",
    `THE ACCEPT-NEGOTIATING PAIR, on the string rather than the helper: the only Vary left on this
site is one naming a real second representation.`,
  ],
  "scripts/check-headers.mjs#82": [
    "WHY",
    "the silent-both-ends failure, why the pairing, and why the needle is not the value",
    `EVERY SHARED-CACHEABLE ROUTE ALSO SETS A CACHE TAG, or a stored response stays wrong silently
at both ends. THE PAIRING is asserted, from the same derived list, and the needle is the CALL
or the header name, never the tag's VALUE, which hard rule 17 gives one owner.`,
  ],
  "scripts/check-headers.mjs#83": [
    "WHY",
    "the zero-scope arm kept; the dated off-by-one measurement goes to Capsid",
    `SCOPE, ASSERTED: an empty walk reports what a compliant tree reports. MEASURED THROUGH THIS
LOOP, having come out wrong by one when counted off the literals, hard rule 10's own example.`,
  ],
  "scripts/check-headers.mjs#84": [
    "WHY",
    "closure is what makes the lists an owner, and the no-count-in-prose rule",
    `CLOSURE, WHICH MAKES THESE LISTS AN OWNER RATHER THAN A SECOND COPY: a new shared-cached page
cannot ship unlisted, and workers/app.ts can state the nonce exposure without a count, which
once stood in three copies and was wrong in all three; hard rule 8 carries the same lesson.
Comments stripped, because one route NAMES the constant while explaining why it refuses it.`,
  ],
  "scripts/check-headers.mjs#85": [
    "NUMBER",
    "the floor is asserted below; five dated re-measurements and the CI story go to Capsid",
    `FLOOR RE-MEASURED BY RUNNING THIS GATE, never summed: this one was once far enough under for
two sections to stop running while it still cleared, which is hard rule 10's class.`,
  ],
};
