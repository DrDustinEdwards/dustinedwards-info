// Chunk 5: search.server.ts, enhance/blog.ts and api.health.ts. Classic search, the blog
// enhancement bundle and the health endpoint.
//
// Three files that are almost all boundary: the visibility twin and the NO_ALIAS rule in the
// first, the "nothing here is required for the page to work" inventory in the second, and the
// cache and limiter prohibitions in the third. What went is the usual: the measured latencies,
// the invocation counts, the reproduction notes and the stories about what a comment used to say.
export default {
  "app/lib/search/search.server.ts#0": [
    "CONTRACT",
    "what it is, why raw SQL, and the one-dependency rule",
    `Site search over the two fts5 indexes. Runs the identity index and the prose index as two
ranked lists and fuses them by reciprocal rank. Raw D1 rather than drizzle, because bm25(),
snippet() and MATCH have no drizzle surface.

NOTHING HERE AWAITS A THIRD PARTY. Classic search is D1 and only D1, so it cannot be slowed or
broken by the AI layer sitting above it.`,
  ],
  "app/lib/search/search.server.ts#1": ["CONTRACT", "a pointer; one line already"],
  "app/lib/search/search.server.ts#2": [
    "NUMBER",
    "what the bound governs and what a truncated set must say",
    `How many rows each index contributes before fusion. Fusion needs enough of each list for rank to
mean something, and facet counts are computed over the fused set, so this bounds facet accuracy
too. A truncated result set says so rather than presenting a partial count as a total.`,
  ],
  "app/lib/search/search.server.ts#3": ["CONTRACT", "what the weights mean; one line already"],
  "app/lib/search/search.server.ts#4": [
    "WHY",
    "the escaping prohibition and why the corpus is not trusted to be markup-free",
    `Snippet markers. snippet() splices these into text it does not escape, so writing \`<mark>\`
directly would mean rendering unescaped content as HTML: a post may legitimately show \`<script>\`
in a code block, and that text reaches the index as prose. The snippet is escaped first and the
markers are swapped for real tags afterwards.`,
  ],
  "app/lib/search/search.server.ts#5": ["WHY", "why the bytes are built rather than written; two lines already"],
  "app/lib/search/search.server.ts#6": ["CONTRACT", "what they are; one line already"],
  "app/lib/search/search.server.ts#7": ["CONTRACT", "what the fourth value means; already short"],
  "app/lib/search/search.server.ts#8": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/search.server.ts#9": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/search.server.ts#10": [
    "CONTRACT",
    "why there is no score field",
    `One fused result, decomposed into what each index contributed. There is deliberately NO score
field: bm25 values from two differently-tokenized indexes are not comparable, which is why fusion
is over ranks, so the value never leaves SQL and \`bm25()\` appears only in ORDER BY.`,
  ],
  "app/lib/search/search.server.ts#11": [
    "WHY",
    "why the parent title is carried; one line",
    `The parent document's title. Records are SECTION-GRAINED, so a row's own title is frequently a
bare heading that means nothing on its own.`,
  ],
  "app/lib/search/search.server.ts#12": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/search.server.ts#13": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/search.server.ts#14": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/search.server.ts#15": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/search.server.ts#16": ["CONTRACT", "what the flag means; one line already"],
  "app/lib/search/search.server.ts#17": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/search.server.ts#18": ["CONTRACT", "when it is present; already short"],
  "app/lib/search/search.server.ts#19": ["CONTRACT", "the order of the two steps; one line already"],
  "app/lib/search/search.server.ts#20": ["CONTRACT", "what it does; one line already"],
  "app/lib/search/search.server.ts#21": [
    "CONTRACT",
    "the twin rule, why it cannot be collapsed, and the alias parameter; the four-statements measurement goes to the history document",
    `The visibility predicate, and the SQL twin of \`publiclyVisible()\` in \`app/db/index.ts\`. BOTH
MUST STAY IN STEP: a scheduled post hidden on the blog index and findable in search would be a
leak.

They cannot be collapsed: that one is a drizzle condition over \`posts\` and this is a string
spliced into a hand-written query over \`search_docs\`. So the agreement is asserted instead, which
is why this is exported: \`check:invariants\` runs both against a fixture of post states and fails
if they ever admit different rows.

THE ALIAS IS A PARAMETER so the aliasless queries below compose it rather than restate it. Pass
NO_ALIAS for an unaliased query.`,
  ],
  "app/lib/search/search.server.ts#22": [
    "CONTRACT",
    "what the extractor assumes and the prohibition on inlining; the two failed attempts go to history",
    `The unaliased argument, as a NAMED CONSTANT rather than a bare \`""\`.

This is not style. \`check:invariants\` section 5 extracts raw SQL string literals and binds their
column names to the schema, and an empty string literal sitting between two SQL literals makes the
extractor read across the boundary and report columns the query does not have.

A named constant keeps every string literal at these call sites SQL. DO NOT INLINE IT BACK.`,
  ],
  "app/lib/search/search.server.ts#23": ["CONTRACT", "what the AND means; one line already"],
  "app/lib/search/search.server.ts#24": [
    "CONTRACT",
    "what the path is for, the document-records rule and the ordering; the retired count goes to history",
    `The browse path: filters with nothing to match on. A tag, a bare year and a facet chip all parse
into filters and leave no text behind, so there is no MATCH expression to give fts5, and the
filters are already SQL.

DOCUMENT RECORDS ONLY. Section records exist so a text query can land on the heading that answers
it; a filter has no such heading in mind, and returning every record of one post separately would
present the corpus as a multiple of its real size.

Ordered by date, because with no relevance signal recency is the only defensible ordering.`,
  ],
  "app/lib/search/search.server.ts#25": [
    "WHY",
    "why it is computed here rather than asked of fts5",
    `Works out why a record matched, for the label shown on the result. Computed in app code from the
parsed terms rather than asked of fts5, which reports that a row matched but not which column
carried it.`,
  ],
  "app/lib/search/search.server.ts#26": ["WHY", "why a fallback label is given; already short"],
  "app/lib/search/search.server.ts#27": ["CONTRACT", "what the flag does; one line already"],
  "app/lib/search/search.server.ts#28": [
    "CONTRACT",
    "what the flag changes and the guarantee that it changes nothing else",
    `Attach the per-layer rank decomposition to the result. Set by the playground's search anatomy
demo and by nothing else. It changes no query, no ordering and no hit: the values are read off
what \`fuse()\` already recorded, so the flag cannot make the demo and the real search disagree.`,
  ],
  "app/lib/search/search.server.ts#29": ["CONTRACT", "why one parse; already short"],
  "app/lib/search/search.server.ts#30": ["CONTRACT", "what empty means; one line already"],
  "app/lib/search/search.server.ts#31": [
    "WHY",
    "why nothing is marked here; trimmed to two lines",
    `No MATCH ran, so there is nothing to highlight. Marking anything here would claim a match that
was never made.`,
  ],
  "app/lib/search/search.server.ts#32": ["CONTRACT", "what the value is; one line already"],
  "app/lib/search/search.server.ts#33": [
    "WHY",
    "why the two reads are concurrent; trimmed to two lines",
    `Both indexes are queried concurrently. They are independent reads, and waiting for one before
starting the other would double the latency of the only part of search that touches the database.`,
  ],
  "app/lib/search/search.server.ts#34": ["WHY", "which snippet wins; two lines already"],
  "app/lib/search/search.server.ts#35": [
    "CONTRACT",
    "nothing is recomputed; trimmed to one line",
    `Read off what \`fuse()\` recorded. Nothing is recomputed and no scoring rule is restated.`,
  ],
  "app/lib/search/search.server.ts#36": [
    "WHY",
    "what the ?? null folds together; trimmed",
    `\`ranks\` and \`contributions\` are built alongside \`sources\`, so an index
found in one is present in the others. The \`?? null\` folds that unreachable
case into the same "this layer did not contribute" the -1 branch means.`,
  ],
  "app/lib/search/search.server.ts#37": [
    "CONTRACT",
    "what the counts promise and what truncation obliges the caller to say",
    `Facet counts over the whole match set, not the current page: a count that only ever promises
what a click would actually return. Computed in app code over the fused set, which is already in
memory. If \`truncated\` is true the caller must present these as a floor.`,
  ],
  "app/lib/search/search.server.ts#38": [
    "WHY",
    "why a zero state offers something; one line",
    `What to offer when a query returns nothing. A zero state that only says "no results" is a dead
end, and these are the two cheapest useful things the database can offer.`,
  ],
  "app/lib/search/search.server.ts#39": [
    "CONTRACT",
    "not a second indexer, what the D1 baseline costs, and the composed predicate; the 600KB fetch, the verification counts and the latencies go to the history document. The hard rule citation stays",
    `Every URL the Ask index is expected to hold, from D1 rather than from git.

THIS IS NOT A SECOND INDEXER. \`records.mjs\` remains the only thing that decides what a record is
and \`keyForUrl\` the only thing that turns a URL into an Ask key; these rows were written by
\`sync:content\` from \`recordsForPosts\`, so this reads that derivation where it was materialised.

WHAT IT COSTS: a D1 stale against the artifact would measure drift against a stale baseline. The
artifact is byte-gated, \`ship\` syncs and asserts docsize equality in the same window, and the
editor's save path writes both, so the window is a deploy-time one.

\`type = 'post'\` because the Ask corpus is posts only. Page records exist in \`search_docs\` and are
deliberately not uploaded, so including them would report every one as permanently stale.

The predicate is \`visibilityClause(NO_ALIAS)\`, composed and never hand copied.
That is hard rule 1, and \`check:invariants\` section 8 binds every \`search_docs\` reader to it. It
carries the unit as well: \`publish_at\` is SECONDS.`,
  ],
  "app/lib/search/search.server.ts#40": [
    "CONTRACT",
    "what it returns, why it takes no posts argument, and the composed predicate",
    `The Ask corpus itself: every record the index should hold, with the text to upload. The reading
twin of \`askExpectedUrls\`, and the reason \`syncAskCorpus\` takes no posts argument: the records
were materialised into \`search_docs\` by the same \`records.mjs\` both writers run.

Visibility is COMPOSED, not restated: \`check:invariants\` section 8 holds every \`search_docs\`
reader to it.`,
  ],
  "app/lib/search/search.server.ts#41": ["CONTRACT", "a pointer to the rule; one line already"],
  "app/lib/search/search.server.ts#42": ["CONTRACT", "the same pointer with its reason; two lines already"],
  "app/lib/search/search.server.ts#43": [
    "CONTRACT",
    "the composition rule and the concatenation rule; the first attempt's misreport goes to history",
    `The predicate comes from \`visibilityClause(NO_ALIAS)\`, not from a hand-copy. CONCATENATED, not
interpolated: a \`\${...}\` truncates the literal \`check:invariants\` section 5 can see, and a \`+\`
keeps it whole and parseable.`,
  ],
  "app/lib/search/search.server.ts#44": [
    "WHY",
    "why not a fuzzy distance; trimmed",
    `"Nearest" is a shared-prefix or substring test, deliberately not a fuzzy distance. On a corpus
with a handful of tags, edit distance would surface confident nonsense.`,
  ],

  "app/enhance/blog.ts#0": [
    "CONTRACT",
    "the law and the inventory of what degrades to what; the corrected image claim goes to the history document",
    `Progressive enhancement for blog reading. One file, loaded only on blog routes, and nothing here
is required for the page to work.

Every public blog route is fully readable, navigable and linkable with JavaScript disabled. This
file only upgrades markup that already functions:

  progress bar        decorative, absent without script
  scroll-spy TOC      the TOC is anchor links either way
  code copy + label   the code is already highlighted and selectable
  heading copy-link   the anchors are already navigable
  footnote previews   the footnote jump links already work
  image lightbox      the image is an anchor to the original file
  copy as markdown    the button is an anchor to the .md twin

Every animation checks prefers-reduced-motion. Nothing here writes to the network or to storage.
The machine-readable inventory is \`content/enhancements.json\`, gated by \`check:features\`.`,
  ],
  "app/enhance/blog.ts#1": ["CONTRACT", "what it is and why it is script-only; one line already"],
  "app/enhance/blog.ts#2": ["CONTRACT", "what it does; one line already"],
  "app/enhance/blog.ts#3": [
    "CONTRACT",
    "what the guard tests and why, and what the attribute is for",
    `Language label and a copy button on one code block.

IDEMPOTENT, and the guard tests for the BUTTON rather than for the \`data-enhanced\` attribute it
also sets. The attribute is a proxy that can be lost while the thing it stands for survives, so
stripping it alone would append a second button to a block that already had one.

\`data-enhanced\` is then purely the CSS hook: the reserved padding and the thing occupying it
arrive together, so a reader without script is not left with a gap.`,
  ],
  "app/enhance/blog.ts#4": [
    "CONTRACT",
    "why one shared region, why polite, and what stays; the three broken controls go to history",
    `The ONE live region the three copy controls announce through. WCAG 2.2 4.1.3.

WHY A SHARED REGION AND NOT ONE PER CONTROL: a live region announces CHANGES to its own contents,
so three of them compete, each tied to an element whose visible label changes for another reason.

\`role="status"\`, never assertive: a copy confirmation must not interrupt what is being read.

The \`::after\` text and the button relabel STAY. They are the sighted feedback and they work; this
adds the half that was missing. Created lazily and once, hidden with the site's own \`.sr-only\`.`,
  ],
  "app/enhance/blog.ts#5": [
    "WHY",
    "why the region is emptied first",
    `CLEARED FIRST, and this is not superstition. A live region announces a CHANGE, so writing the
same string twice in a row would be silent; emptying it and setting it on the next frame makes
every copy an announcement, including an identical one.`,
  ],
  "app/enhance/blog.ts#6": ["CONTRACT", "why it is last; one line already"],
  "app/enhance/blog.ts#7": [
    "CONTRACT",
    "why the observer is kept and why it terminates; the measured hydration race goes to the history document",
    `Language label and a copy button on every code block, AND AGAIN AFTERWARDS.

The rewrite this observer was built against is GONE, and the observer is kept anyway: it costs
nothing at rest, \`decorateCodeBlock\` is idempotent, and it makes the decoration independent of
WHEN this bundle runs relative to any future subtree rewrite, which is exactly the assumption that
broke last time.

It terminates. Every write happens inside \`decorateCodeBlock\`, which does nothing to a \`pre\`
already carrying \`data-enhanced\`, so the mutations it causes produce a pass that writes nothing.`,
  ],
  "app/enhance/blog.ts#8": ["CONTRACT", "what it does; one line already"],
  "app/enhance/blog.ts#9": [
    "WHY",
    "both behaviours happen, and why focus rather than scroll; the false boundary note goes to history",
    `BOTH THINGS HAPPEN: the URL is copied AND the reader lands on the heading, which is what an
in-page anchor is for and what 2.4.3 expects of a link that changes the URL. The note here once
claimed the anchor still navigated, three lines above a \`preventDefault()\`, which is hard rule 7's
own example of a boundary note that ages.

\`focus()\` on the heading rather than \`scrollIntoView\`, because moving focus is what a screen
reader announces and what the next Tab continues from; scrolling alone moves the eye and leaves
the keyboard behind. Headings are not focusable by default, so \`tabindex="-1"\` is set for the
duration and removed afterwards.`,
  ],
  "app/enhance/blog.ts#10": ["WHY", "why it is removed on blur; two lines already"],
  "app/enhance/blog.ts#11": ["WHY", "what a refused clipboard must not cost; two lines already"],
  "app/enhance/blog.ts#12": ["CONTRACT", "what it does; one line already"],
  "app/enhance/blog.ts#13": [
    "WHY",
    "the hoverable half of 1.4.13 and why the grace period exists",
    `WCAG 2.2 1.4.13, HOVERABLE. Leaving the reference schedules a hide rather than performing one,
and entering the bubble cancels it. Without that the bubble vanishes the moment the pointer moves
toward it, so nobody can read a footnote longer than a glance or select text from one. The delay
is long enough to cross the gap the bubble is positioned with.`,
  ],
  "app/enhance/blog.ts#14": ["CONTRACT", "why the bubble is part of the target; already short"],
  "app/enhance/blog.ts#15": [
    "WHY",
    "the dismissible half of 1.4.13",
    `DISMISSIBLE. Escape removes the bubble WITHOUT moving focus, which is what 1.4.13 asks for: a
reader who cannot move the pointer away, or whose bubble covers the text, needs a way out that
does not cost them their place.`,
  ],
  "app/enhance/blog.ts#16": [
    "WHY",
    "the persistent half of 1.4.13 and why nothing replaces the scroll listener",
    `PERSISTENT. Nothing hides the bubble on scroll, and nothing needs to: it is positioned in
DOCUMENT coordinates, so it travels with the reference rather than staying stuck to the viewport.`,
  ],
  "app/enhance/blog.ts#17": [
    "CONTRACT",
    "what it does and why src is passed in",
    `Opens one image over the page. Returns focus where it came from on close.

\`src\` is passed in rather than read off the image on screen: \`currentSrc\` returns whichever rung
of the \`srcset\` ladder the browser already downloaded, so the overlay would show a resized copy
at a larger CSS size and call it full size.`,
  ],
  "app/enhance/blog.ts#18": [
    "CONTRACT",
    "what the platform gives and why restoreFocus is still kept; the old div goes to history",
    `A NATIVE <dialog>, OPENED WITH showModal(). It gives modality, Escape, focus containment and the
top layer from the platform, which is four hand-rolled behaviours removed rather than four written
correctly. Focus return is the platform's too, and \`restoreFocus\` is kept because the OPENER here
is not always the element focus should land on.`,
  ],
  "app/enhance/blog.ts#19": [
    "WHY",
    "why the label is generic when the alt is empty",
    `A NAME, because a dialog announces itself and then has nothing to say. The image's alt is the
only description there is; when the author left it empty the image is decorative, so the dialog is
labelled generically rather than with an empty string that announces as "dialog" and nothing.`,
  ],
  "app/enhance/blog.ts#20": [
    "WHY",
    "why a visible close button is required",
    `A VISIBLE CLOSE BUTTON. Escape and a backdrop click are both real ways out and neither is
discoverable, so a touch reader with no keyboard had no announced way to close this at all.`,
  ],
  "app/enhance/blog.ts#21": [
    "CONTRACT",
    "what the target check gives",
    `The backdrop click. On a \`<dialog>\` the element itself is the click target for its backdrop, so
this checks the target rather than wrapping the content. Clicking the image must NOT close it,
which is what the target check gives.`,
  ],
  "app/enhance/blog.ts#22": [
    "CONTRACT",
    "one teardown and why the element is not reused",
    `One teardown, on the platform's own \`close\` event, so every route out lands here: the button, the
backdrop, Escape, and anything added later. The element is removed rather than reused, because the
next open builds a fresh one with its own src and label.`,
  ],
  "app/enhance/blog.ts#23": [
    "CONTRACT",
    "the anchor is the subject, the keyboard path, and the diagram exception",
    `Lightbox for post images.

THE ANCHOR IS THE SUBJECT, not the image. The shared pipeline wraps every body image in an
\`a.image-link\` to the unsized file, so the click already did something useful before this file
loaded, and this intercepts that navigation rather than being the only way to reach the original.

Binding the anchor is what makes the keyboard path free: Enter fires a click on it, and close
returns focus to the anchor the reader was already on.

DIAGRAMS TAKE THE OTHER PATH. Their image pair is deliberately not wrapped, so they are bound
directly, and a diagram asset carries no \`srcset\`, so its \`src\` IS the original.`,
  ],
  "app/enhance/blog.ts#24": ["CONTRACT", "what it upgrades; one line already"],
  "app/enhance/blog.ts#25": ["CONTRACT", "what the fallback is; one line already"],
  "app/enhance/blog.ts#26": ["CONTRACT", "why the export exists; one line already"],

  "app/routes/api.health.ts#0": [
    "CONTRACT",
    "why the header is load bearing and why no-store rather than private; the heuristic-freshness measurement goes to the history document. The hard rule citation stays",
    `\`/api/health\`: confirms the \`/api/*\` plane is wired and the Worker is live.

THE CACHE-CONTROL IS LOAD BEARING. Under hard rule 8 a 200 carrying neither \`Cache-Control\` nor
\`Expires\` is CACHED under RFC 9111 heuristic freshness, and A HEALTH CHECK THAT CAN BE SERVED
FROM CACHE IS NOT A HEALTH CHECK: it manufactures the reassuring silence a monitor exists to break.

The transport's default in \`workers/app.ts\` applies here today and relying on it is still wrong:
it exists to make a FORGOTTEN header safe, so the next person to add a \`headers\` export would
remove the protection without knowing it was load bearing.

\`no-store\` rather than \`private, no-store\`: \`private\` bounds WHO may store, \`no-store\` says nobody
may, and only the second is what this route needs.`,
  ],
  "app/routes/api.health.ts#1": [
    "NUMBER",
    "what the two values are and why they are not exported",
    `The per-IP allowance, and the window it is measured over. The only copies, and deliberately NOT
exported: nothing outside this route needs the numbers, and the refusal is asserted over the wire
by \`verify-live\` rather than by a gate reading them back.`,
  ],
  "app/routes/api.health.ts#2": [
    "CONTRACT",
    "why the failure path takes the same headers",
    `The headers on EVERY health response, success and failure alike. A 503 that was cacheable would
be worse than a cacheable 200: it would keep reporting a failure after the site recovered, and the
workflow watching it would keep alerting.`,
  ],
  "app/routes/api.health.ts#3": [
    "CONTRACT",
    "the structural property the gate asserts",
    `THE ONLY PLACE THIS ROUTE CONSTRUCTS A RESPONSE. That is the property \`check:headers\` asserts,
and it is asserted structurally rather than by looking for the header near each \`new Response\`,
because a window around an anchor reads its neighbour's compliance.`,
  ],
  "app/routes/api.health.ts#4": [
    "CONTRACT",
    "why it seeds and overlays, and why Headers rather than a spread",
    `SEEDED FROM THE CONSTANT, then overlaid. The rate-limit refusal needs a \`Retry-After\` no other
response wants, and both alternatives break the property above: a second \`new Response\` is a
second exit, and spreading the constant at each call site is the copy this helper prevents.

\`Headers\` rather than a spread, so a caller cannot accidentally shadow \`Cache-Control\` with a
different case.`,
  ],
  "app/routes/api.health.ts#5": [
    "CONTRACT",
    "the status line is the contract, fail closed, and what the body may not carry",
    `Runs every health check and answers 200 only if all of them passed.

THE STATUS CODE IS THE ALERT: a 200 carrying \`{"ok": false}\` is read by \`curl --fail\` as health
and the mail is never sent. 503 rather than 500, because the site is serving and a stated
invariant is not holding.

FAIL CLOSED. \`runHealthChecks\` already turns a throwing CHECK into a failing check, so reaching
the outer catch means the run could not be assembled, and an endpoint that cannot run its checks
reports unhealthy rather than nothing.

The body carries names and booleans only: \`publicHealthBody\` drops every \`detail\`, because they
carry row counts and an R2 object key and this route is unauthenticated.`,
  ],
  "app/routes/api.health.ts#6": [
    "CONTRACT",
    "why the gate is first, which instrument, and the without-the-limiter rule; the measured seconds go to history",
    `GATE 0, AND IT IS FIRST BECAUSE EVERYTHING BELOW IT COSTS. Five checks against D1, R2 and AI
Search, unauthenticated, which made this the most expensive thing an anonymous caller could ask of
the site. Same instrument as \`/api/csp-report\` and the operator path: one \`AskBudget\` instance
named \`health:<ip>\`.

WHY THE ALLOWANCE IS LOW: the deliverable here is a verdict still true thirty seconds later, where
\`/api/csp-report\` sits higher because its deliverable is the report and eating one loses data.

WITHOUT THE LIMITER THIS DOES NOT SERVE. A missing \`ASK_BUDGET\` is itself a broken deployment, and
answering 503 is how this endpoint reports one rather than quietly losing its guard.`,
  ],
  "app/routes/api.health.ts#7": [
    "CONTRACT",
    "why the call is guarded, why 503, why a separate name, and why neither is repairable; the 283 invocations and the reproduction go to the history document",
    `THE LIMITER CALL IS INSIDE A TRY: a Durable Object call is a network call and can fail.

WHY 503 AND A NAMED CHECK rather than letting it through: a limiter that THREW is not a limiter
that said yes, and treating a failed guard as a pass is the fail-open shape.

A SEPARATE NAME FROM \`rate-limiter-unavailable\`, because absent and BROKEN are different answers
and collapsing them costs the reader the triage.

NEITHER NAME IS IN \`REPAIRABLE\`: \`repairPlan\` returns alert-only for an unknown class, so a broken
limiter wakes somebody instead of firing a rebuild.`,
  ],
  "app/routes/api.health.ts#8": [
    "CONTRACT",
    "why the log line is the whole record; trimmed",
    `LOGGED BY NAME. The wire body carries names and booleans only, so this console line is the
entire record of WHY the limiter failed.`,
  ],
  "app/routes/api.health.ts#9": [
    "CONTRACT",
    "why the refusal keeps the shape and why a 429 is still an alert",
    `THE SAME BODY SHAPE AS EVERY OTHER ANSWER, so the workflow's parse reports a named cause rather
than falling into its "body did not parse" branch. The status line is still the alert: a rate
limited monitor IS a condition worth a human seeing.`,
  ],
  "app/routes/api.health.ts#10": [
    "CONTRACT",
    "where the detail the wire omits is recoverable; trimmed",
    `Logged as well as returned. \`invocation_logs: false\` drops the automatic per-request record and
does not touch custom logs, so the DETAIL the wire deliberately omits is still recoverable by the
operator.`,
  ],
  "app/routes/api.health.ts#11": [
    "CONTRACT",
    "byproduct not a reason, both verdicts, and why the failure path writes nothing",
    `THE SNAPSHOT, WRITTEN ON THE WAY OUT. It is a byproduct of a run that happened anyway, never a
reason to run.

Written for BOTH verdicts. One that recorded only healthy runs would let the home tile keep
showing the last good answer while the site was failing, which is the lie its timestamp exists to
prevent. The failure path below deliberately writes NOTHING: reaching it means there is no verdict
to record, so the tile ages into \`stale\` rather than being handed a fabricated one.`,
  ],
  "app/routes/api.health.ts#12": ["CONTRACT", "why the shape is kept; already short"],
  "app/routes/api.health.ts#13": [
    "CONTRACT",
    "what the framework default gets wrong, the shared shape, no rate limit, and the Allow value; the live measurement goes to history",
    `Every method that is not GET, answered as a METHOD error rather than a framework crash. React
Router's default here is a 405 whose body says the server broke, with no \`Allow\` header RFC 9110
requires and a shape that sends the health workflow into its "body did not parse" branch.

THE SHAPE IS THE SAME ONE EVERY OTHER ANSWER HERE USES, through \`healthJson\` and therefore the
same \`no-store\`.

NO RATE LIMIT, deliberately: this allocates one object and returns, so metering it would cost a
round trip to refuse a request cheaper than the refusal, and a broken limiter would turn a 405
into a 503.

\`Allow: GET\` and not \`GET, HEAD\`: the platform answers HEAD by running the loader, so HEAD never
reaches here and advertising it would be a claim about someone else's behaviour.`,
  ],
};
