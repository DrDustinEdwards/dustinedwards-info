// Chunk 2: app/lib/search/ask.server.ts, blocks 0-52. Ask mode, search layer 2.
//
// The rate settled in chunk 1. Most of this file is already one or two lines a block; the cut
// falls on six blocks that carry an arc, and on the four identical drift-cache notes, which say
// the same sentence four times because four paths invalidate the same key.
//
// THE LEAK IS KEPT AS A PROHIBITION, not as a story: nothing unpublished may enter the index,
// because the index is a public surface and AI Search has no per-item status a query can filter.
export default {
  "app/lib/search/ask.server.ts#0": [
    "CONTRACT",
    "the off switch and the one-derivation rule; the ruling pointer stays",
    `Ask mode: search Layer 2, over Cloudflare AI Search.

CLASSIC SEARCH IS D1 AND ONLY D1: with \`AI_SEARCH\` unbound no Ask affordance renders and /search
is byte-identical to what it was before Layer 2. That off switch is a requirement, not a nicety.`,
  ],
  "app/lib/search/ask.server.ts#1": [
    "CONTRACT",
    "why re-exported rather than re-implemented; one line",
    `The pure half, in plain JavaScript so \`check:tests\` can reach it, and RE-EXPORTED rather than
re-implemented: a second import path would be a second thing to keep in step.`,
  ],
  "app/lib/search/ask.server.ts#2": ["CONTRACT", "what it names; one line already"],
  "app/lib/search/ask.server.ts#3": [
    "NUMBER",
    "why the bound is the answer and not the corpus; the stale basis, the date and the rot go to the history document",
    `How many chunks the answer may draw on. THE BOUND IS THE ANSWER, NOT THE CORPUS: past it,
retrieval widens the net without widening the answer. No corpus figure here, per rule 17.`,
  ],
  "app/lib/search/ask.server.ts#4": [
    "WHY",
    "why a property check and not a catch; one line",
    `True when the AI Search binding is present, checked as a property rather than in a try/catch:
"the binding was removed" and "the instance errored" are different, and only the first should
silently remove the feature.`,
  ],
  "app/lib/search/ask.server.ts#5": ["CONTRACT", "what the flag means; one line already"],
  "app/lib/search/ask.server.ts#6": [
    "CONTRACT",
    "why the stream is untouched; one line",
    `Streams an answer, handing the raw SSE upstream to the client untouched rather than parsing and
re-emitting: the Worker holds nothing in memory, and the client already parses SSE, so a second
envelope would buy nothing.`,
  ],
  "app/lib/search/ask.server.ts#7": [
    "WHY",
    "why composition lives elsewhere; the measurement stays on that function",
    `COMPOSED IN \`askMessages\`, not here, because the last message is the retrieval query and a test
has to be able to see it. Decorating it costs the whole search.`,
  ],
  "app/lib/search/ask.server.ts#8": [
    "CONTRACT",
    "what the tee buys and what null means",
    `Splits the upstream in two, the second copy parsed inside \`waitUntil\`, so caching costs
time-to-first-token nothing. Null when the generation produced nothing, which must not be cached.`,
  ],
  "app/lib/search/ask.server.ts#9": [
    "WHY",
    "why the frame handling is shared; one line",
    `Same frame handling as the client, deliberately: if the two disagreed about what a frame means,
a cached replay would not match what the reader saw the first time.`,
  ],
  "app/lib/search/ask.server.ts#10": [
    "CONTRACT",
    "why a replay is indistinguishable and why one delta",
    `Rebuilds a cached answer in the shape the model produces, so one parser and one rendering path
serve both. One delta rather than re-simulated typing, which would be theatre.`,
  ],
  "app/lib/search/ask.server.ts#11": ["CONTRACT", "what the field counts; one line already"],
  "app/lib/search/ask.server.ts#12": [
    "WHY",
    "the paging rule and the failure it removes; the date and the measured prune go to the history document",
    `Every item, following pagination to the end. \`items.list()\` IS PAGED and a bare call returns the
first page only: a prune that cannot see an item cannot delete it, and reports success either way.`,
  ],
  "app/lib/search/ask.server.ts#14": ["NUMBER", "the API maximum, measured; the rejection message goes to the history document", `50 is the API maximum.`],
  "app/lib/search/ask.server.ts#15": [
    "WHY",
    "why a mark per page and why entries not a map; the arithmetic-not-a-reading argument goes to the history document",
    `ONE MARK PER PAGE, so round trips are COUNTED rather than inferred from the index size. Entries,
not a map: two pages produce two entries with one name, and collapsing by name reports one.`,
  ],
  "app/lib/search/ask.server.ts#16": ["CONTRACT", "what it guards against; one line already"],
  "app/lib/search/ask.server.ts#17": [
    "WHY",
    "the public-surface rule and why the filter is at upload; the leak, its date and the count go to the history document",
    `The posts that may appear in the Ask index.

THE AI INDEX IS A PUBLIC SURFACE, cited by slug, so this must agree with \`publiclyVisible()\`. THE
FILTER HAS TO HAPPEN AT UPLOAD TIME: AI Search has no per-item status a query can filter on, so
nothing unpublished may enter at all.

@param posts`,
  ],
  "app/lib/search/ask.server.ts#18": [
    "WHY",
    "why composed rather than restated; the dates and the hand-rolled copy go to the history document",
    `COMPOSED, NOT RESTATED: a hand-rolled copy agreed with \`publiclyVisible()\` by inspection and by
nothing else, which is the shape that leaked drafts into Ask.`,
  ],
  "app/lib/search/ask.server.ts#19": ["CONTRACT", "what it answers; one line already"],
  "app/lib/search/ask.server.ts#20": [
    "CONTRACT",
    "why built-in storage and the upsert property; the crawler's schedule details go to the history document",
    `Uploads every search record to built-in storage rather than through the crawler, which would
index the apex, still the legacy site, and would lose the heading granularity a citation
deep-links to. Upload is an UPSERT keyed by filename, so re-running is idempotent.`,
  ],
  "app/lib/search/ask.server.ts#21": [
    "CONTRACT",
    "where the corpus comes from and the one-owner reason; the arc goes to the history document",
    `THE CORPUS COMES FROM D1, materialised by the same \`records.mjs\` both writers run and read back
with \`visibilityClause\` composed in the SQL, so drafts and future posts never enter the index.`,
  ],
  "app/lib/search/ask.server.ts#22": [
    "WHY",
    "the fail-closed rule; one line",
    `Fail closed: a slug or anchor containing the separator would produce a key that resolves back to
the wrong URL, and a citation pointing at the wrong section is worse than no citation.`,
  ],
  "app/lib/search/ask.server.ts#23": [
    "CONTRACT",
    "why the heading is included; one line already",
    `The heading is included in the uploaded text: the body alone loses what the section is about.`,
  ],
  "app/lib/search/ask.server.ts#24": [
    "CONTRACT",
    "the split and why uploading both would be worse; the ruling number and the corpus size go to the history document",
    `THE PAPERS, FROM THEIR TWINS RATHER THAN FROM \`search_docs\`: the record carries the abstract,
which is what keyword search should snippet, and the twin has the text Ask should retrieve over.
Uploading both would let the shorter sometimes win a question the longer answers.`,
  ],
  "app/lib/search/ask.server.ts#25": [
    "WHY",
    "why invalidation happens here; one line",
    `The corpus just changed, so every cached answer was written against content that may no longer
be true. Dropping them at the moment of change is what stops a stale answer outliving the post.`,
  ],
  "app/lib/search/ask.server.ts#26": [
    "WHY",
    "why a delete and not a write; one line already",
    `A delete rather than a write: this path knows the cached value is stale, not what it became.`,
  ],
  "app/lib/search/ask.server.ts#27": [
    "WHY",
    "why the module and not D1; the rule citations stay",
    `Every paper's Ask item key, FROM THE MODULE AND NOT FROM D1, on hard rule 1: composing
\`visibilityClause\` here would ask a visibility question about a corpus that has none, and reading
the module points the index at the repository, which is rule 18's direction.`,
  ],
  "app/lib/search/ask.server.ts#28": [
    "CONTRACT",
    "why the assets binding and why a missing twin is reported; the size trade and hard rule 7's shape stay",
    `Uploads every paper's markdown twin, and returns the keys it wrote.

FETCHED THROUGH \`ASSETS\` because a Worker cannot read a file it does not import, and the twins
are gitignored so the extracted text stays out of the bundle. Hard rule 7's property comes with
it: what is indexed is the document the site actually serves at that URL.

A MISSING TWIN IS REPORTED, NOT INVENTED, and its key is still returned: the caller's prune
deletes every key it is not given, so omitting it would turn a missing build into a DELETION.`,
  ],
  "app/lib/search/ask.server.ts#29": [
    "CONTRACT",
    "why incremental is sound and what the scoped prune is for",
    `Syncs ONE post's records and drops that post's stale items, which is sound rather than a shortcut
because section decomposition is a pure function of one post's markdown. The prune is scoped to
this post's keys, so a concurrent post is never touched.`,
  ],
  "app/lib/search/ask.server.ts#30": [
    "WHY",
    "why a draft actively removes; one line",
    `A draft uploads NOTHING and actively removes what this post already has: skipping the upload
alone would leave a withdrawn post answerable forever. The empty \`live\` set makes the prune below
do it, so there is one removal path rather than two.`,
  ],
  "app/lib/search/ask.server.ts#31": [
    "WHY",
    "the isolation rule and why a failed key still joins live; the measured incident, its date and the count go to the history document",
    `ONE FAILING RECORD USED TO ABANDON THE REST, and the caller catches by design, so a post's
records went missing with the failure nowhere to go. Each is isolated and retried ONCE.

A FAILED KEY STILL JOINS \`live\`, WHICH LOOKS WRONG AND IS NOT: the prune deletes every key not in
it, so isolating the loop without this would DELETE the good copy already indexed. \`live\` means
"this key should exist", not "this key was just written".`,
  ],
  "app/lib/search/ask.server.ts#32": [
    "WHY",
    "why this one is not caught; one line",
    `NOT caught below: a correctness guard rather than a transient. The key would resolve to the wrong
URL and cite the wrong section, and retrying would produce the same wrong key.`,
  ],
  "app/lib/search/ask.server.ts#33": [
    "WHY",
    "what is matched and the trap avoided; one line",
    `Matched on the exact document key or the section prefix, never on a bare \`startsWith(slug)\`,
which would sweep up a longer slug that happens to begin with this one.`,
  ],
  "app/lib/search/ask.server.ts#34": [
    "WHY",
    "why a delete and not a write; one line already",
    `A delete rather than a write: this path knows the cached value is stale, not what it became.`,
  ],
  "app/lib/search/ask.server.ts#35": [
    "WHY",
    "why the subtraction; the nine-record example goes to the history document",
    `\`records.length\` MINUS what did not land. It returned the record count unconditionally, which was
accurate only because a failure threw before reaching here.`,
  ],
  "app/lib/search/ask.server.ts#36": [
    "CONTRACT",
    "why drift is made visible and the both-directions rule",
    `Compares what the index holds against what the corpus says it should hold, because the Ask sync
may fail without failing the save and the save then redirects. Both directions, as the backup
gate has it: an item the corpus does not know about is as much a defect as a missing record.`,
  ],
  "app/lib/search/ask.server.ts#37": [
    "CONTRACT",
    "where the expected set comes from and the binding that keeps the two filters in step; the fetch size goes to the history document",
    `THE EXPECTED SET COMES FROM D1, not the repository artifact, which meant a GitHub fetch per admin
page load for one integer. \`publishableForAsk\` is still the UPLOADERS' filter and must stay in
step with the SQL predicate here; \`check:policy\` binds the two.`,
  ],
  "app/lib/search/ask.server.ts#38": [
    "WHY",
    "why concurrent and where it matters; the median and the mark attribution go to the history document",
    `CONCURRENT, because the two sides share nothing: a D1 read and a paged walk of AI Search, neither
reading what the other writes, and they were strictly serial.`,
  ],
  "app/lib/search/ask.server.ts#39": [
    "WHY",
    "why the papers are expected and what their absence would cause",
    `THE PAPERS ARE PART OF WHAT THE INDEX SHOULD HOLD: without this the badge would report them
permanently stale and the repair button would delete them.`,
  ],
  "app/lib/search/ask.server.ts#40": [
    "CONTRACT",
    "why the value moves rather than the loader, and why a getter; the gate fixture reasoning goes to the history document",
    `The request-scoped, MEMOIZED reader for the drift status above.

Two surfaces want the fact and a parent cannot read a child's loader data. Moving the computation
up was ruled out because \`check:admin-ui\` fabricates this in the posts route's OWN loader data,
so it would have moved the gate's fixture. The VALUE moves instead, on the context. A getter, so
a route that never asks never pays.`,
  ],
  "app/lib/search/ask.server.ts#41": [
    "CONTRACT",
    "why null rather than throwing; one line",
    `Builds that reader. Resolves to null rather than throwing: the AI index is an enhancement and
may not take an admin page down with it when it is unbound or unreachable.`,
  ],
  "app/lib/search/ask.server.ts#42": ["CONTRACT", "what the memo buys; one line already"],
  "app/lib/search/ask.server.ts#43": [
    "CONTRACT",
    "what the cache hides, the structural early return, the two failure choices and why waitUntil; the samples, the dates and the loop's four steps go to the history document",
    `THE DRIFT COUNT FOR THE NAV BADGE, off the read path, because this pages the whole index and the
admin layout runs on every admin page load.

ON A HIT THIS DOES NOT TOUCH AI SEARCH, structurally: one \`return\` sits between the KV read and
the first mention of the index, and \`check:invariants\` section 11 asserts that ON THE SOURCE
rather than on a timing mark, a mark count having already failed to see an unmarked read here.

FAILURE IS NULL, NOT ZERO: zero claims the index agrees with the corpus, on no evidence, beside a
repair the operator would then not perform.

THE LATE WRITE IS THE MECHANISM, NOT AN OPTIMISATION: a floating write lands only if the isolate
outlives the response, so a listing slower than the budget never populated the cache and the next
request missed for the same reason. \`waitUntil\` is the fix rather than a longer budget, any
budget having a listing slower than it, and the ExecutionContext is REQUIRED so a call site that
cannot supply it is a typecheck failure.

THE COUNT ONLY: the page that owns the repair reads the full lists uncached.`,
  ],
  "app/lib/search/ask.server.ts#44": [
    "CONTRACT",
    "what the early return guarantees; one line already",
    `THE EARLY RETURN. Nothing below runs on a hit, and section 11 asserts no AI Search reference precedes it.`,
  ],
  "app/lib/search/ask.server.ts#45": [
    "WHY",
    "why the rejection is folded here; one line",
    `Rejection is folded into the value rather than caught at the race, so a failing listing and an
absent one reach the same null and the caller has one thing to handle.`,
  ],
  "app/lib/search/ask.server.ts#46": [
    "WHY",
    "why it resolves rather than rejects; one line",
    `The budget resolves to undefined rather than rejecting, so the race reads as "whichever arrives
first" rather than as error handling.`,
  ],
  "app/lib/search/ask.server.ts#47": [
    "WHY",
    "why waitUntil and why the catch stays; the before measurement stays on the doc comment",
    `The budget won, so the listing is HANDED TO THE RUNTIME rather than left floating: \`waitUntil\` is
what makes the write land after the response. The \`catch\` stays, because \`waitUntil\` rejecting is
no better than a floating rejection and there is no number to cache either way.`,
  ],
  "app/lib/search/ask.server.ts#48": [
    "NUMBER",
    "where the number came from; the sample spread goes to the history document",
    `How long a cache miss may hold the admin layout before it gives up. From the measurement rather
than taste: it admits all but the one pathological listing this change exists for.`,
  ],
  "app/lib/search/ask.server.ts#49": ["CONTRACT", "what it removes; one line already"],
  "app/lib/search/ask.server.ts#50": [
    "WHY",
    "why a delete and not a write; one line already",
    `A delete rather than a write: this path knows the cached value is stale, not what it became.`,
  ],
  "app/lib/search/ask.server.ts#51": [
    "CONTRACT",
    "what it removes and why; one line",
    `Removes items that no longer correspond to a record: upload is an upsert, so a renamed or deleted
post leaves its old item answering forever. Both directions, as the backup gate has it.`,
  ],
  "app/lib/search/ask.server.ts#52": [
    "WHY",
    "why only on an actual removal; the pre-cache history goes to the history document",
    `Removing items changes what the index holds, so the badge's cached number is stale. Only on an
ACTUAL removal: a prune that removed nothing changed nothing, and dropping the key anyway would
spend the next reader a listing.`,
  ],
};
