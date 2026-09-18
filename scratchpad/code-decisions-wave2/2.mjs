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

OBSERVATION BOUNDARY: THIS GATE CANNOT SEE THE WIRE. It reads workers/app.ts and asserts what
the source DECLARES and that both code paths apply it. A deploy that never happened, a
platform feature that strips a header, a route that returns before the entry handler: all
invisible here and all green. That is hard rule 7 for this file; the wire is verify-live's,
which asserts every header by EXACT VALUE on a 200 and on the /admin 302. Neither replaces
the other.

TWO INDEPENDENT SOURCES ARGUE. The EXPECTED set is transcribed from the ratification; the
ACTUAL set is parsed out of workers/app.ts. Nothing reads its expectation from the file it is
checking. Changing a header therefore means editing this file in the same commit, which is
the design rather than friction: two of these values are deliberately NOT the restrictive
choice, and a one-sided edit is exactly what must not pass quietly.

Pure: no network, no database, no bindings. FAILS CLOSED: an empty constant, a missing
constant or a file that stops parsing are each a failure.`,
  ],
  "scripts/check-headers.mjs#1": ["CONTRACT", "type annotation plus the not-read-from-source rule; two lines already"],
  "scripts/check-headers.mjs#3": [
    "WHY",
    "the prose trap in one line",
    `Comments are stripped before anything is located: this file's own prose spells out header
names while explaining why they are what they are, so a parser reading it would find
same-origin in the sentence saying same-origin is wrong.`,
  ],
  "scripts/check-headers.mjs#4": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#5": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#7": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#8": ["WHY", "one line already; kept"],
  "scripts/check-headers.mjs#9": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#10": [
    "WHY",
    "why these two get named assertions",
    `Named individually rather than left to the value comparison, because these are the two a
future session is most likely to "fix", and a failure that names the reason is worth more
than a diff.`,
  ],
  "scripts/check-headers.mjs#11": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#12": [
    "WHY",
    "declaring and applying are different; the live example kept",
    `Declaring the set and applying it are different things, and the second is where it breaks:
workers/app.ts has a mutable exit and an immutable rebuild, and a helper called on only one
means redirects ship bare, with /admin's 302 the live example.`,
  ],
  "scripts/check-headers.mjs#13": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#14": [
    "WHY",
    "the auth bypass and hard rule 8's cached silence; the dated audit goes to Capsid",
    `THIS ASSERTION GUARDS AN AUTH BYPASS. A response carrying no Cache-Control is CACHED under
heuristic freshness rather than skipped, and the cache key does not include cookies, so the
private, no-store default is the only thing between an authenticated /admin render and a
shared entry served to anyone asking for that path. Those lines were once deletable with
every gate staying green. The value is transcribed from the ruling, and BOTH EXITS are
asserted for the same reason applySecurityHeaders is.`,
  ],
  "scripts/check-headers.mjs#15": ["CONTRACT", "what the needle matches; two lines already"],
  "scripts/check-headers.mjs#16": ["WHY", "a guard that reads as protection; two lines already"],
  "scripts/check-headers.mjs#17": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#18": [
    "WHY",
    "the cheapest wrong fix and the strict-dynamic trap; the phase story cut",
    `THE ASSERTION THAT MATTERS MOST IS THE ONE ABOUT unsafe-inline. When something breaks, the
cheapest way to make it stop is to add it to script-src: that silences the report, keeps
every page working, is invisible in review, and reduces the policy to decoration, because
unsafe-inline is exactly what an injected script needs. Enforcement makes it likelier, not
less: a wrong fix now unbreaks a page a reader is looking at.

strict-dynamic makes browsers IGNORE unsafe-inline when both are present, so adding it looks
harmless and is not: it is what the policy falls back to the moment strict-dynamic is dropped
or unsupported.`,
  ],
  "scripts/check-headers.mjs#19": [
    "WHY",
    "call the builder rather than regex it, and the fixture-independence rule",
    `THE POLICY IS CALLED, NOT PARSED. A regex can see that both branches EXIST and cannot see
which one a request gets, so the strongest thing it supports is "a nonce appears somewhere in
the function" rather than "the public policy has none", and those differ by the defect worth
catching. The builder is IMPORTED, so there is no second copy to drift, and the nonce is a
fixed string written here and never generator output, which is the fixture-independence
discipline.`,
  ],
  "scripts/check-headers.mjs#22": [
    "WHY",
    "why names and not values, and why both branches; the expired Report-Only argument cut",
    `The ratified directive NAMES, not all their values: pinning every value would make this a
mirror of workers/csp.mjs, so a deliberate widening would fail here for no reason beyond
having been made. Names are asserted so a directive cannot be quietly dropped, and the values
carrying the policy have named assertions of their own. BOTH BRANCHES, because a directive
dropped from one arm only is what a single-arm sweep reports as clean.`,
  ],
  "scripts/check-headers.mjs#23": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#24": [
    "WHY",
    "the two-owners drift and why the types are read from the routes; the dated measurement to Capsid",
    `EVERY FEED ROUTE'S DECLARED CONTENT-TYPE IS ONE isFeed() EXEMPTS. The exemption list and the
routes are two owners of one fact and they had already drifted, serving a full CSP with a
per-request nonce on a body stored for ten minutes. THE TYPES ARE READ OUT OF THE ROUTE
FILES, never restated here, which is what makes this an argument between two sources rather
than a mirror: a route declaring a different type moves the ACTUAL side and a shortened list
moves the EXPECTED side. isFeed is IMPORTED and CALLED, because a regex over the list reads
its spelling, not its answer.`,
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
document type must still be policed, which is why the list is named types rather than a
negation of text/html.`,
  ],
  "scripts/check-headers.mjs#28": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#29": [
    "WHY",
    "the silent widening and why both directions are asserted",
    `THE PUBLIC BRANCH IS THE ASSERTION THAT MATTERS. Passing true everywhere would fix a
violation report, read as a simplification, leave every comment describing a policy that no
longer exists, and break nothing a reader could see. On the edge-cached public routes header
and body are cached together, so one nonce is valid there for up to ten minutes; that
exposure is accepted in writing for script-src and extending it to styles as a side effect is
not. BOTH DIRECTIONS, because refusing the nonce publicly is equally satisfied by a build
where the editor is broken.`,
  ],
  "scripts/check-headers.mjs#30": [
    "WHY",
    "assert on real paths, not on the caller's if",
    `WHAT DECIDES THE BRANCH, asserted on real paths rather than on the caller's if, which would
be a mirror of the caller. The list includes the cases that catch a bare startsWith("/admin"):
a hypothetical /administrator, and the .data serialisations React Router emits.`,
  ],
  "scripts/check-headers.mjs#31": ["CONTRACT", "which arm the path matches; two lines already"],
  "scripts/check-headers.mjs#32": [
    "WHY",
    "the guard survives the ruling flipping; the date and the eleven days cut",
    `ENFORCED, NOT REPORT-ONLY, and the guard now points the other way: enforcement must not be
silently REVERTED. A revert is invisible in every other way, since the page still works, the
header is still present and the reports still arrive; the only difference is that nothing is
blocked.`,
  ],
  "scripts/check-headers.mjs#33": [
    "WHY",
    "reporting and enforcing are independent",
    `REPORTING SURVIVES ENFORCEMENT: the two are independent and a policy can block silently, so
losing the reports removes the only signal that the policy is refusing something a reader
needed.`,
  ],
  "scripts/check-headers.mjs#34": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#35": [
    "WHY",
    "what a source-level check here is for",
    `TWO SCRIPT CLASSES THAT DO NOT GET THE NONCE FOR FREE, both found by the browser rather than
by reading. Source level only: what this stops is a later edit dropping either one, which
produces a page that renders perfectly and fails closed under an enforced policy.`,
  ],
  "scripts/check-headers.mjs#36": [
    "WHY",
    "which scripts ship bare without the prop; the dated report count to Capsid",
    `ServerRouter passes its nonce prop BOTH into FrameworkContext and directly to StreamTransfer,
which stamps React Router's two streaming scripts. Without the prop those ship bare on every
page, and the enqueue one carries the hydration payload.`,
  ],
  "scripts/check-headers.mjs#37": [
    "WHY",
    "the counter-intuitive gating, the silent failure, and the stated exclusion; the deleted sibling cut",
    `THE SPECULATION BLOCK, and there is exactly ONE. speculationrules IS gated by script-src
while application/ld+json is NOT: both are non-executable data blocks, so this was settled by
the browser rather than by argument, and it is asserted so nobody "consistently" removes it.
Under an enforced policy an un-nonced speculationrules element is refused SILENTLY on every
public page: the page renders identically and the enhancement is simply absent.

NOT ASSERTED HERE: that the rules name the right paths. test/header-speculation.test.mjs owns
the derivation and check:browser owns the payload, so this gate carries no second copy.`,
  ],
  "scripts/check-headers.mjs#38": [
    "HISTORY",
    "which build renamed the component and that the gate followed; what is asserted never moved",
    null,
  ],
  "scripts/check-headers.mjs#39": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#40": [
    "WHY",
    "the copy-paste this is written for, and why an identifier is accepted as a value",
    `THE ONE ROUTE WHOSE HEADERS ARE THE ACCESS CONTROL. /preview/:token serves an UNPUBLISHED
post to a caller with no session, and the cookieless downgrade that keeps the public post
route safe never fires for that request shape, so this route's Cache-Control is not a
performance choice.

The failure it is written for is a copy-paste: blog.$slug.tsx sits in the same directory with
a headers() of the same shape setting the shared value, and reaching for the neighbour's
version produces a route that renders perfectly, passes every other gate, and publishes
drafts. The parse accepts an IDENTIFIER as a value as well as a string, deliberately:
otherwise swapping in the shared constant would read as "not declared" rather than as the
wrong value, and the failure would name the wrong problem.`,
  ],
  "scripts/check-headers.mjs#41": ["CONTRACT", "one line already; kept"],
  "scripts/check-headers.mjs#42": ["CONTRACT", "why both value shapes are captured; already short"],
  "scripts/check-headers.mjs#43": ["WHY", "one line already; kept"],
  "scripts/check-headers.mjs#44": [
    "WHY",
    "the subtler shape the value check misses",
    `NO PUBLIC BRANCH, named rather than left to the value comparison, which catches the constant
swapped in but not the constant staying correct while a conditional elsewhere hands back the
public value. The rule is that the identifier does not appear in this file AT ALL.`,
  ],
  "scripts/check-headers.mjs#45": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#46": [
    "WHY",
    "a one-off live measurement is not a gate, and why the section lives in this file",
    `A LIVE MEASUREMENT IS NOT A GATE. The capture's exclusions were proven by querying the live
dataset after one deploy, and nothing re-asserted them since: deleting the /admin skip would
have left every gate green while the operator's own page views flowed into the panel that
exists to exclude them.

This section lives here because this is the only gate that parses workers/app.ts, which is
where the capture is. The name is a poor fit and a new gate was worse: it would duplicate
this file's parsing setup to read the same source. SOURCE LEVEL ONLY; whether a row reaches
the dataset is ae-probe's question.`,
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
    `THE REDACTION IS AN ACCESS CONTROL, NOT A DATA CHOICE. /preview/<token> carries a capability
in its PATH, so writing url.pathname verbatim stores it in the dataset and renders it in full
in the admin, defeating the drawer's truncation.

BOTH SLOTS, separately: the path is written into blobs and into indexes, the sampling key, and
redacting one leaves the token in the dataset. Asserted as the ABSENCE of the raw expression
as well as the presence of the redacted one, because presence alone passes on a capture that
computes the safe path and writes the raw one anyway.`,
  ],
  "scripts/check-headers.mjs#49": [
    "NUMBER",
    "the floor is asserted below; the dated step-by-step re-measurements go to Capsid",
    `EXECUTED-COUNT FLOOR. A pass count is not coverage: an assertion block that stops running
reports green, and a green run with nothing in it looks exactly like a green run that checked
everything. MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed, which is
the discipline a sibling floor proved the value of when its arithmetic came out one low.`,
  ],
  "scripts/check-headers.mjs#50": [
    "WHY",
    "an SVG is a document, why the assertion outlives the CSP, and the boundary",
    `UPLOADED SVG IS SERVED AS AN ATTACHMENT. An SVG is a document rather than a picture: it can
carry script, it is on the upload allowlist, and /media/* serves from the SITE'S OWN ORIGIN,
so inline it is script running as the site. The CSP blocks it too, and this assertion is kept
regardless because it does not depend on the policy: it survives a loosened directive and
covers a client that ignores CSP. BOUNDARY: source only, so it cannot see R2 or a cache layer
dropping the header on the way out.`,
  ],
  "scripts/check-headers.mjs#51": ["WHY", "scoped to the helper body; two lines already"],
  "scripts/check-headers.mjs#52": [
    "WHY",
    "the pairing is the invariant, and what restating the type would allow",
    `DERIVED FROM THE UPLOAD ALLOWLIST, never restated: the pairing is the invariant, so a
script-capable type is uploadable only while this route refuses to serve it inline. Restating
the type here would let a NEW capable type join the allowlist with no attachment rule, which
is the N-1-of-N shape. The allowlist end is asserted in test/upload-contract.test.mjs.`,
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
filenames carry a content hash, so a year is safe by construction. THE DANGER IS THE GLOB
WIDENING: a rule over everything would pin the favicon, the logo and the icon suite for a
year at stable paths, and a browser holding a stale favicon has already looked like a failed
deploy here.

The assertion is the PROPERTY, not "/assets/* is the only path": that proxy stopped being
fair when markdown twins arrived as assets needing a short shared cache and a noindex, and it
refused something its own reasoning permits. Read PER BLOCK, because a file-wide reading
cannot tell which path a directive belongs to and would pass a year on the logo beside a short
rule elsewhere. stale-while-revalidate is deliberately NOT bounded: the body is revalidated
and replaced, which is the opposite of the un-revokable state this guards.

BOUNDARY: this reads the tracked FILE and does not fetch an asset, so it cannot see Workers
Assets failing to apply a rule it parsed.`,
  ],
  "scripts/check-headers.mjs#55": [
    "CONTRACT",
    "the constant's meaning and the no-purge-door reason, cites hard rule 20; trimmed",
    `The longest freshness an UNHASHED path may declare, in seconds.

The hazard is a path whose bytes can change under a stable URL: once a browser has stored it
as fresh, nothing on the server can recall it, and there is no purge door here (hard rule 20
records why). An hour is short enough that a bad deploy is corrected within one. /assets/* is
exempt because its URL changes whenever its bytes do.`,
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
  "scripts/check-headers.mjs#61": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#62": [
    "WHY",
    "hard rule 8's cached silence and why the scope is structural; the commit reference cut",
    `A HEALTH CHECK THAT CAN BE SERVED FROM CACHE IS NOT A HEALTH CHECK. A 200 carrying neither
Cache-Control nor Expires is stored under heuristic freshness (hard rule 8), so the endpoint
could report health measured two hours ago, identically whether the Worker was fine or on
fire, which is the reassuring silence a monitor exists to break.

SCOPED STRUCTURALLY, NOT BY A WINDOW. "The file mentions no-store" passes on a comment, and a
window around each new Response is the shape that reads the next function's compliance. So
the property is structural: the route constructs a Response in EXACTLY ONE place, that place
is inside healthJson, and healthJson applies the constant, so a second exit added later
without the headers moves the count and fails.`,
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
    `new Headers(HEALTH_HEADERS) is asserted rather than a bare mention of the identifier: a bare
mention is satisfied by a line that merely READS the constant without seeding from it, which
is what a refactor that stopped applying it would leave behind. The invariant is unchanged,
the one construction site is built FROM the constant.`,
  ],
  "scripts/check-headers.mjs#69": [
    "WHY",
    "the shared cache entry across schemes, and why position; the dated measurement to Capsid",
    `MEASURED ON THE WIRE, and it is why this section exists: plain http returned 200 with the full
page, and the first plaintext request to a path already warmed over HTTPS came back a cache
HIT carrying the SAME CSP nonce. The two schemes shared one entry, so the nonce the enforced
policy relies on was handed out in the clear. Asserted on POSITION, not presence: a redirect
running after the router has produced a response is not a redirect, and presence passes on
exactly that.`,
  ],
  "scripts/check-headers.mjs#70": [
    "WHY",
    "an assertion about position must know which body it reads; the re-scoping story to Capsid",
    `SCOPED TO THE GATEWAY. An assertion about POSITION has to know which body it is reading: taking
the first fetch handler in the file silently changed subject when the entrypoint split, and
pointed at the renderer, which constructs the router and never redirects. The property as
stated is stronger than the old one: the redirect must come before the LOOPBACK, so before
anything could be answered from cache, where before it only meant before a render.`,
  ],
  "scripts/check-headers.mjs#71": [
    "WHY",
    "the other direction and what it stops",
    `AND THE RENDERER DOES NOT REDIRECT, the other direction: without it the assertion above is
satisfied by a copy of the redirect having moved into the entrypoint that runs on a miss only,
where it is skipped on every hit.`,
  ],
  "scripts/check-headers.mjs#72": [
    "WHY",
    "why this one is a safety property",
    `The redirect's own caching is a safety property rather than hygiene: the scheme is NOT part of
the cache key, which is the defect this closes, so a cacheable redirect under a shared key
would be served to HTTPS readers and send them to the URL they already requested.`,
  ],
  "scripts/check-headers.mjs#73": ["CONTRACT", "section marker; kept byte-identical"],
  "scripts/check-headers.mjs#74": [
    "WHY",
    "the symptomless gap, why the routes are asserted and not the helper, and the stated exclusions",
    `THE GAP THIS CLOSES EXISTED BECAUSE NOTHING ASSERTED IT: a public page exporting no headers()
falls through to hard rule 8's uncached default and is the one page never edge-cached, every
reader paying an origin hit for a body identical to everyone's. A missing export has no
symptom a human meets.

Asserted on the ROUTE FILES rather than on the helper, because the helper being correct proves
nothing about who calls it, and comment-stripped, because several of these files discuss
headers() in prose. The Accept-negotiating routes are deliberately absent and have their own
list; preview.$token is absent for the opposite reason and has its own section above.`,
  ],
  "scripts/check-headers.mjs#75": ["WHY", "why the About page belongs in this list; three lines already"],
  "scripts/check-headers.mjs#76": [
    "WHY",
    "why a query string is a cache key rather than a refusal",
    `The publication index. Its QUERY STRING is part of the cache key rather than a reason to
refuse caching: the chips, the search box and the sort are GET parameters, so one reader's
filtered URL is a different entry from another's bare one and neither can be served to the
other. Nothing on it is reader-specific.`,
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
    `/blog is here rather than with the Accept-negotiating routes: the Vary it once set was Cookie
rather than Accept, it has no twin representation and never did, and with the theme in the
cache key it has no reason for a Vary at all.`,
  ],
  "scripts/check-headers.mjs#81": [
    "WHY",
    "why these two cannot call the helper; the dated shrink from three cut",
    `THE ACCEPT-NEGOTIATING PAIR, asserted on the string rather than on the helper: they cannot
call publicHtmlHeaders(), because each pairs the shared Cache-Control with its own Vary,
having a twin representation that Accept selects between. The only Vary left on this site is
the one naming a real second representation.`,
  ],
  "scripts/check-headers.mjs#82": [
    "WHY",
    "the silent-both-ends failure, why the pairing, and why the needle is not the value",
    `EVERY SHARED-CACHEABLE ROUTE ALSO SETS A CACHE TAG. A response that can be stored and cannot
be purged is a page that stays wrong for ten minutes after the write meant to fix it, and the
failure is SILENT at both ends: the write reports success, and a purge reports success for a
tag matching nothing. The only place the omission is visible is here, before it ships.

IT IS THE PAIRING THAT IS ASSERTED. A route calling the helper passes by construction; the two
routes building headers by hand are where a half goes missing, which is why this is checked
FROM the same derived list rather than from a hand-kept set. The needle is the CALL or the
header name, never the tag's VALUE, which hard rule 17 gives one owner.`,
  ],
  "scripts/check-headers.mjs#83": [
    "WHY",
    "the zero-scope arm kept; the dated off-by-one measurement goes to Capsid",
    `SCOPE, ASSERTED: an empty walk reports no untagged routes, which is exactly what a compliant
tree reports. The number was MEASURED THROUGH THIS LOOP by running the gate, after being
counted off the list literals once and coming out wrong by one: hard rule 10's own example,
that a floor arrived at by reading is not a floor.`,
  ],
  "scripts/check-headers.mjs#84": [
    "WHY",
    "closure is what makes the lists an owner, and the no-count-in-prose rule",
    `CLOSURE, AND IT IS WHAT MAKES THESE LISTS AN OWNER RATHER THAN A SECOND COPY. The lists are
checked FROM the tree: every route referencing the shared string must appear in one of them,
so a new shared-cached page cannot ship unlisted.

THIS IS WHAT LETS workers/app.ts STATE THE NONCE EXPOSURE WITHOUT A COUNT. That count existed
in three copies across two files and all three were wrong at once; a number in prose beside a
gate is a second copy of the gate, and hard rule 8 carries the same lesson. Comments stripped
first, because one route NAMES the shared constant while explaining why it refuses it.`,
  ],
  "scripts/check-headers.mjs#85": [
    "NUMBER",
    "the floor is asserted below; five dated re-measurements and the CI story go to Capsid",
    `FLOOR RE-MEASURED BY RUNNING THIS GATE, never summed. A floor left behind while the count
climbs is not a floor: this one was once 44 under the truth, which is two whole sections able
to stop running while the count still cleared it, and hard rule 10 names that class. The
arithmetic drifts silently and only running it says so.

The tolerance belongs to scripts/check-floors.mjs, the gate that enforces it, not to a
percentage quoted in prose here: prose about a gate ages, the gate does not.`,
  ],
};
