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

BOUNDARY: IT CANNOT SEE THE WIRE. It reads workers/app.ts and asserts what the source
DECLARES, so a deploy that never happened or a platform feature stripping a header is green
here; that is hard rule 7 for this file, and the wire is verify-live's.

TWO INDEPENDENT SOURCES ARGUE: the expected set is transcribed from the ratification, the
actual parsed out of the Worker, so changing a header means editing this file too. Two of
these values are deliberately NOT the restrictive choice. FAILS CLOSED on a missing constant.`,
  ],
  "scripts/check-headers.mjs#1": ["CONTRACT", "type annotation plus the not-read-from-source rule; two lines already"],
  "scripts/check-headers.mjs#3": [
    "WHY",
    "the prose trap in one line",
    `Comments are stripped before anything is located: this file's own prose spells out header
names while explaining them, so a parser reading it would find same-origin in the sentence
saying same-origin is wrong.`,
  ],
  "scripts/check-headers.mjs#4": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#5": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-headers.mjs#7": ["CONTRACT", "section marker, rule padding cut", `both directions, name by name`],
  "scripts/check-headers.mjs#8": ["WHY", "one line already; kept"],
  "scripts/check-headers.mjs#9": ["CONTRACT", "section marker, rule padding cut", `the two values that look tightenable`],
  "scripts/check-headers.mjs#10": [
    "WHY",
    "why these two get named assertions",
    `Named individually rather than left to the value comparison, because these are the two a
future session is most likely to "fix".`,
  ],
  "scripts/check-headers.mjs#11": ["CONTRACT", "section marker, rule padding cut", `applied on BOTH branches`],
  "scripts/check-headers.mjs#12": [
    "WHY",
    "declaring and applying are different; the live example kept",
    `Declaring the set and applying it are different, and the second is where it breaks:
workers/app.ts has a mutable exit and an immutable rebuild, and a helper called on only one
means redirects ship bare.`,
  ],
  "scripts/check-headers.mjs#13": ["CONTRACT", "section marker, rule padding cut", `the cache-control DEFAULT`],
  "scripts/check-headers.mjs#14": [
    "WHY",
    "the auth bypass and hard rule 8's cached silence; the dated audit goes to Capsid",
    `THIS ASSERTION GUARDS AN AUTH BYPASS. A response carrying no Cache-Control is CACHED under
heuristic freshness and the cache key does not include cookies, so the private, no-store
default is the only thing between an authenticated /admin render and a shared entry served to
anyone. BOTH EXITS, for the same reason applySecurityHeaders is.`,
  ],
  "scripts/check-headers.mjs#15": ["CONTRACT", "what the needle matches; two lines already"],
  "scripts/check-headers.mjs#16": ["WHY", "a guard that reads as protection; two lines already"],
  "scripts/check-headers.mjs#17": ["CONTRACT", "section marker, rule padding cut", `the CSP (Phase B, ENFORCED)`],
  "scripts/check-headers.mjs#18": [
    "WHY",
    "the cheapest wrong fix and the strict-dynamic trap; the phase story cut",
    `THE ASSERTION THAT MATTERS MOST IS THE ONE ABOUT unsafe-inline: adding it to script-src
silences the report, keeps every page working, is invisible in review, and is exactly what an
injected script needs. strict-dynamic makes browsers IGNORE unsafe-inline when both are
present, so adding it looks harmless and is what the policy falls back to the moment
strict-dynamic is dropped.`,
  ],
  "scripts/check-headers.mjs#19": [
    "WHY",
    "call the builder rather than regex it, and the fixture-independence rule",
    `THE POLICY IS CALLED, NOT PARSED: a regex sees that both branches exist and not which one a
request gets. The builder is IMPORTED, so no second copy can drift, and the nonce is a fixed
string written here rather than generator output, which is fixture independence.`,
  ],
  "scripts/check-headers.mjs#22": [
    "WHY",
    "why names and not values, and why both branches; the expired Report-Only argument cut",
    `The ratified directive NAMES, not their values: pinning every value would make this a mirror
of workers/csp.mjs, failing on a deliberate widening. BOTH BRANCHES, because a directive
dropped from one arm only is what a single-arm sweep reports as clean.`,
  ],
  "scripts/check-headers.mjs#23": ["CONTRACT", "section marker, rule padding cut", `the feeds get NO policy at all`],
  "scripts/check-headers.mjs#24": [
    "WHY",
    "the two-owners drift and why the types are read from the routes; the dated measurement to Capsid",
    `EVERY FEED ROUTE'S DECLARED CONTENT-TYPE IS ONE isFeed() EXEMPTS. The list and the routes are
two owners of one fact and had already drifted, serving a per-request nonce on a body stored
for ten minutes. THE TYPES ARE READ OUT OF THE ROUTE FILES, which makes this an argument
rather than a mirror, and isFeed is CALLED, because a regex reads its spelling not its answer.`,
  ],
  "scripts/check-headers.mjs#25": [
    "WHY",
    "why named and not globbed",
    `Named rather than globbed, because the assertion is about THESE THREE documents being exempt
and a glob would quietly shrink to whatever still matches.`,
  ],
  "scripts/check-headers.mjs#26": ["WHY", "the needle trap; two lines already"],
  "scripts/check-headers.mjs#27": [
    "WHY",
    "the unfailable-condition negative",
    `THE NEGATIVE, so the three above cannot pass by isFeed() having become a constant true. A
document type must still be policed, which is why the list names types rather than negating
text/html.`,
  ],
  "scripts/check-headers.mjs#28": ["CONTRACT", "section marker, rule padding cut", `the style nonce is ADMIN ONLY`],
  "scripts/check-headers.mjs#29": [
    "WHY",
    "the silent widening and why both directions are asserted",
    `THE PUBLIC BRANCH IS THE ASSERTION THAT MATTERS: passing true everywhere would fix a violation
report, read as a simplification, and break nothing a reader could see. Header and body are
cached together publicly, so one nonce stays valid for the cache lifetime, an exposure
accepted for script-src and not by side effect for styles. BOTH DIRECTIONS, because refusing
the nonce publicly is equally satisfied by a build where the editor is broken.`,
  ],
  "scripts/check-headers.mjs#30": [
    "WHY",
    "assert on real paths, not on the caller's if",
    `WHAT DECIDES THE BRANCH, asserted on real paths rather than on the caller's if, which would be
a mirror of it. The list includes the cases that catch a bare startsWith("/admin").`,
  ],
  "scripts/check-headers.mjs#31": ["CONTRACT", "which arm the path matches; two lines already"],
  "scripts/check-headers.mjs#32": [
    "WHY",
    "the guard survives the ruling flipping; the date and the eleven days cut",
    `ENFORCED, NOT REPORT-ONLY, and the guard points the other way: a revert is invisible in every
other way, since the page still works, the header is still present and the reports still
arrive, and the only difference is that nothing is blocked.`,
  ],
  "scripts/check-headers.mjs#33": [
    "WHY",
    "reporting and enforcing are independent",
    `REPORTING SURVIVES ENFORCEMENT: a policy can block silently, so losing the reports removes the
only signal that it is refusing something a reader needed.`,
  ],
  "scripts/check-headers.mjs#34": ["CONTRACT", "section marker, rule padding cut", `the nonce reaches every script`],
  "scripts/check-headers.mjs#35": [
    "WHY",
    "what a source-level check here is for",
    `TWO SCRIPT CLASSES THAT DO NOT GET THE NONCE FOR FREE, both found by the browser rather than
by reading. Source level only: what this stops is a later edit dropping either one, which
renders perfectly and fails closed under an enforced policy.`,
  ],
  "scripts/check-headers.mjs#36": [
    "WHY",
    "which scripts ship bare without the prop; the dated report count to Capsid",
    `ServerRouter passes its nonce prop BOTH into FrameworkContext and directly to StreamTransfer.
Without the prop React Router's two streaming scripts ship bare on every page, and the enqueue
one carries the hydration payload.`,
  ],
  "scripts/check-headers.mjs#37": [
    "WHY",
    "the counter-intuitive gating, the silent failure, and the stated exclusion; the deleted sibling cut",
    `THE SPECULATION BLOCK, and there is exactly ONE. speculationrules IS gated by script-src while
application/ld+json is not, which the browser settled rather than argument, so it is asserted
before somebody "consistently" removes the nonce: an un-nonced element is refused SILENTLY and
the page renders identically without the enhancement.`,
  ],
  "scripts/check-headers.mjs#38": [
    "HISTORY",
    "which build renamed the component and that the gate followed; what is asserted never moved",
    null,
  ],
  "scripts/check-headers.mjs#39": ["CONTRACT", "section marker, rule padding cut", `the draft preview route (feature G)`],
  "scripts/check-headers.mjs#40": [
    "WHY",
    "the copy-paste this is written for, and why an identifier is accepted as a value",
    `THE ONE ROUTE WHOSE HEADERS ARE THE ACCESS CONTROL: /preview/:token serves an UNPUBLISHED post
to a caller with no session, and the cookieless downgrade never fires for that request shape.
The failure it is written for is a copy-paste from blog.$slug.tsx next door, which renders
perfectly, passes every other gate, and publishes drafts. An IDENTIFIER is accepted as a value
so swapping in the shared constant fails as the wrong value rather than as "not declared".`,
  ],
  "scripts/check-headers.mjs#41": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#42": ["CONTRACT", "why both value shapes are captured; already short"],
  "scripts/check-headers.mjs#43": ["WHY", "one line already; kept"],
  "scripts/check-headers.mjs#44": [
    "WHY",
    "the subtler shape the value check misses",
    `NO PUBLIC BRANCH, named rather than left to the value comparison, which would catch the
constant swapped in but not a conditional elsewhere handing back the public value. The rule is
that the identifier does not appear in this file AT ALL.`,
  ],
  "scripts/check-headers.mjs#45": ["CONTRACT", "section marker, rule padding cut", `the analytics capture (feature F.1 + G)`],
  "scripts/check-headers.mjs#46": [
    "WHY",
    "a one-off live measurement is not a gate, and why the section lives in this file",
    `A LIVE MEASUREMENT IS NOT A GATE: the capture's exclusions were proven once against the live
dataset, and deleting the /admin skip would have left every gate green while the operator's
own page views flowed into the panel that exists to exclude them. SOURCE LEVEL ONLY; whether a
row reaches the dataset is ae-probe's question.`,
  ],
  "scripts/check-headers.mjs#47": [
    "WHY",
    "why each exclusion is named separately",
    `Each exclusion named individually rather than left to one "does it look right" check, because
a failure saying WHICH exclusion went is worth more than one saying the function changed.`,
  ],
  "scripts/check-headers.mjs#48": [
    "WHY",
    "the capability in the path, both slots, and why absence is asserted too",
    `THE REDACTION IS AN ACCESS CONTROL, NOT A DATA CHOICE: /preview/<token> carries a capability
in its PATH, so writing url.pathname verbatim stores it in the dataset and renders it in full
in the admin. BOTH SLOTS separately, since redacting one leaves the token behind; and the
ABSENCE of the raw expression too, because presence alone passes on a capture that computes
the safe path and writes the raw one anyway.`,
  ],
  "scripts/check-headers.mjs#49": [
    "NUMBER",
    "the floor is asserted below; the dated step-by-step re-measurements go to Capsid",
    `EXECUTED-COUNT FLOOR. A pass count is not coverage: a green run with nothing in it looks
exactly like a green run that checked everything. MEASURED BY RUNNING THIS GATE, never summed,
which a sibling floor proved the value of when its arithmetic came out one low.`,
  ],
  "scripts/check-headers.mjs#50": [
    "WHY",
    "an SVG is a document, why the assertion outlives the CSP, and the boundary",
    `UPLOADED SVG IS SERVED AS AN ATTACHMENT. An SVG is a document rather than a picture: it can
carry script, it is on the upload allowlist, and /media/* serves from the SITE'S OWN ORIGIN,
so inline it is script running as the site. Kept even though the CSP blocks it, because it
does not depend on the policy. Source only.`,
  ],
  "scripts/check-headers.mjs#51": ["WHY", "scoped to the helper body; two lines already"],
  "scripts/check-headers.mjs#52": [
    "WHY",
    "the pairing is the invariant, and what restating the type would allow",
    `DERIVED FROM THE UPLOAD ALLOWLIST, never restated: the pairing is the invariant, so a
script-capable type is uploadable only while this route refuses to serve it inline. Restating
the type would let a NEW capable type join the allowlist with no attachment rule.`,
  ],
  "scripts/check-headers.mjs#53": [
    "WHY",
    "the half that rots",
    `AND APPLIED ON EVERY PATH THAT SERVES THE STORED BYTES, the half that rots: a new branch
returning the object body is invisible to a check that only asserts the helper exists.`,
  ],
  "scripts/check-headers.mjs#54": [
    "WHY",
    "the glob-widening hazard, why it is per block, and the stated exclusion; the dated measurements to Capsid",
    `ASSET CACHE RULES in public/_headers. The immutable year is scoped to /assets/*, whose
filenames carry a content hash. THE DANGER IS THE GLOB WIDENING: a rule over everything pins
the favicon and the icon suite for a year at stable paths.

Asserted as the PROPERTY rather than "/assets/* is the only path", a proxy that refused the
markdown twins their noindex, and read PER BLOCK, because a file-wide reading cannot tell
which path a directive belongs to. stale-while-revalidate is NOT bounded: it is revalidated.`,
  ],
  "scripts/check-headers.mjs#55": [
    "CONTRACT",
    "the constant's meaning and the no-purge-door reason, cites hard rule 20; trimmed",
    `The longest freshness an UNHASHED path may declare, in seconds. Once a browser has stored
such a path as fresh nothing on the server can recall it, and there is no purge door here,
which hard rule 20 records. /assets/* is exempt: its URL changes whenever its bytes do.`,
  ],
  "scripts/check-headers.mjs#56": ["CONTRACT", "the file's shape; one line already"],
  "scripts/check-headers.mjs#57": [
    "WHY",
    "what the flat split could not answer",
    `PARSED INTO BLOCKS, so every directive is attributed to the path it sits under: a flat list
cannot answer "is anything unhashed pinned for a year" once the file has two paths in it.`,
  ],
  "scripts/check-headers.mjs#59": ["WHY", "malformed input is counted, not dropped; two lines already"],
  "scripts/check-headers.mjs#60": [
    "WHY",
    "why both directives are read",
    `THE PROPERTY, per block. Both max-age and s-maxage are read, because s-maxage overrides
max-age for the shared cache and a year there is the same un-revokable state at the edge.`,
  ],
  "scripts/check-headers.mjs#61": ["CONTRACT", "section marker, rule padding cut", `the health endpoint's own headers`],
  "scripts/check-headers.mjs#62": [
    "WHY",
    "hard rule 8's cached silence and why the scope is structural; the commit reference cut",
    `A HEALTH CHECK SERVED FROM CACHE IS NOT A HEALTH CHECK: a 200 carrying no Cache-Control is
stored under heuristic freshness (hard rule 8), so it could report health measured two hours
ago whether the Worker was fine or on fire. SCOPED STRUCTURALLY, not by a window, since "the
file mentions no-store" passes on a comment: the route constructs a Response in EXACTLY ONE
place, so a second exit added later moves the count and fails.`,
  ],
  "scripts/check-headers.mjs#63": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#65": ["WHY", "why identifiers are captured as values; three lines already"],
  "scripts/check-headers.mjs#66": [
    "WHY",
    "why one construction site is the invariant",
    `THE APPLICATION SITE, counted rather than searched for. One construction is the invariant: it
is what makes "the header is on every response" provable without inspecting each response.`,
  ],
  "scripts/check-headers.mjs#67": ["WHY", "bounded to the body, not a window; two lines already"],
  "scripts/check-headers.mjs#68": [
    "WHY",
    "why seeding is asserted rather than a bare mention; the date and the needle story cut",
    `new Headers(HEALTH_HEADERS) rather than a bare mention of the identifier, which is satisfied
by a line that merely READS the constant without seeding from it: the one construction site is
built FROM the constant.`,
  ],
  "scripts/check-headers.mjs#69": [
    "WHY",
    "the shared cache entry across schemes, and why position; the dated measurement to Capsid",
    `MEASURED ON THE WIRE: plain http returned 200 with the full page, and the first plaintext
request to a path already warmed over HTTPS came back a cache HIT carrying the SAME CSP nonce.
Asserted on POSITION, not presence: a redirect running after the router has produced a
response is not a redirect.`,
  ],
  "scripts/check-headers.mjs#70": [
    "WHY",
    "an assertion about position must know which body it reads; the re-scoping story to Capsid",
    `SCOPED TO THE GATEWAY, because an assertion about POSITION has to know which body it reads:
the first fetch handler silently changed subject when the entrypoint split. The redirect must
come before the LOOPBACK, so before anything could be answered from cache.`,
  ],
  "scripts/check-headers.mjs#71": [
    "WHY",
    "the other direction and what it stops",
    `AND THE RENDERER DOES NOT REDIRECT, the other direction: without it the assertion above is
satisfied by a copy having moved into the entrypoint that runs on a miss only, where it is
skipped on every hit.`,
  ],
  "scripts/check-headers.mjs#72": [
    "WHY",
    "why this one is a safety property",
    `The redirect's own caching is a safety property: the scheme is NOT part of the cache key, so a
cacheable redirect under a shared key would be served to HTTPS readers and send them to the
URL they already requested.`,
  ],
  "scripts/check-headers.mjs#73": ["CONTRACT", "section marker, rule padding cut", `every public HTML route sets the shared policy`],
  "scripts/check-headers.mjs#74": [
    "WHY",
    "the symptomless gap, why the routes are asserted and not the helper, and the stated exclusions",
    `A public page exporting no headers() falls through to hard rule 8's uncached default and is
the one page never edge-cached, with no symptom a human meets. Asserted on the ROUTE FILES
rather than the helper, because a correct helper proves nothing about who calls it, and
comment-stripped, because several of these files discuss headers() in prose.`,
  ],
  "scripts/check-headers.mjs#75": ["WHY", "why the About page belongs in this list; three lines already"],
  "scripts/check-headers.mjs#76": [
    "WHY",
    "why a query string is a cache key rather than a refusal",
    `The publication index. Its QUERY STRING is part of the cache key rather than a reason to
refuse caching: the chips and the sort are GET parameters, so one reader's filtered URL is a
different entry from another's bare one. Nothing on it is reader-specific.`,
  ],
  "scripts/check-headers.mjs#77": [
    "WHY",
    "one reader's copy is every reader's copy",
    `One paper's page, same policy and same reason: every byte is a function of the committed
corpus, so one reader's copy is every reader's copy.`,
  ],
  "scripts/check-headers.mjs#78": ["WHY", "why the tag archive is not Accept-negotiating; three lines already"],
  "scripts/check-headers.mjs#79": ["WHY", "the series archive on the same terms; two lines already"],
  "scripts/check-headers.mjs#80": [
    "WHY",
    "why /blog is in this list rather than the negotiating one; the dated move cut",
    `/blog is here rather than with the Accept-negotiating routes: the Vary it once set was Cookie,
it has no twin representation, and with the theme in the cache key it has no reason for a Vary
at all.`,
  ],
  "scripts/check-headers.mjs#81": [
    "WHY",
    "why these two cannot call the helper; the dated shrink from three cut",
    `THE ACCEPT-NEGOTIATING PAIR, asserted on the string rather than the helper: each pairs the
shared Cache-Control with its own Vary, having a twin representation Accept selects between.
The only Vary left on this site is one naming a real second representation.`,
  ],
  "scripts/check-headers.mjs#82": [
    "WHY",
    "the silent-both-ends failure, why the pairing, and why the needle is not the value",
    `EVERY SHARED-CACHEABLE ROUTE ALSO SETS A CACHE TAG. A response that can be stored and cannot
be purged stays wrong after the write meant to fix it, silently at both ends: the write
reports success and so does a purge of a tag matching nothing. THE PAIRING is what is
asserted, from the same derived list; the needle is the CALL or the header name, never the
tag's VALUE, which hard rule 17 gives one owner.`,
  ],
  "scripts/check-headers.mjs#83": [
    "WHY",
    "the zero-scope arm kept; the dated off-by-one measurement goes to Capsid",
    `SCOPE, ASSERTED: an empty walk reports no untagged routes, exactly what a compliant tree
reports. MEASURED THROUGH THIS LOOP by running the gate, having come out wrong by one when
counted off the list literals, which is hard rule 10's own example.`,
  ],
  "scripts/check-headers.mjs#84": [
    "WHY",
    "closure is what makes the lists an owner, and the no-count-in-prose rule",
    `CLOSURE, WHICH MAKES THESE LISTS AN OWNER RATHER THAN A SECOND COPY: every route referencing
the shared string must appear in one, so a new shared-cached page cannot ship unlisted. It is
also what lets workers/app.ts state the nonce exposure WITHOUT A COUNT, which once stood in
three copies and was wrong in all three; hard rule 8 carries the same lesson. Comments
stripped first, because one route NAMES the constant while explaining why it refuses it.`,
  ],
  "scripts/check-headers.mjs#85": [
    "NUMBER",
    "the floor is asserted below; five dated re-measurements and the CI story go to Capsid",
    `FLOOR RE-MEASURED BY RUNNING THIS GATE, never summed. A floor left behind while the count
climbs is not a floor: this one was once far enough under for two whole sections to stop
running while it still cleared, which is hard rule 10's class. The tolerance belongs to
scripts/check-floors.mjs, not to a percentage quoted here.`,
  ],
};
