// Chunk 6: ask-guard.server.ts, db/schema.ts, editor/frontmatter.ts and routes/media.$.ts.
//
// The best chunk of the wave for the rate, and media.$.ts is why: two of its blocks are almost
// entirely dated measurement (the format negotiation table, the per-colo cache readings, the
// corrections to earlier corrections), and what those blocks have to SAY is two sentences and
// a rule number. schema.ts is the opposite shape and barely moves: it is already one line a
// column, and the four long blocks on it are contract.
export default {
  "app/lib/search/ask-guard.server.ts#0": [
    "CONTRACT",
    "the three gates, their order, and why they are Durable Objects; the four binding measurements go to the history document",
    `Cost guards for Ask mode.

\`/search/ask\` is public, unauthenticated, and every answer that reaches the model bills Workers
AI. Retrieval is free in the AI Search beta; GENERATION IS NOT. There is no zone WAF to lean on,
because the site is still on workers.dev.

Three gates, cheapest first, and NOTHING reaches the model until all three have passed:

1. Per-IP burst limit, an exact count in a Durable Object instance per IP.
2. Answer cache, KV. Makes a repeated question a read instead of a bill.
3. Daily ceiling, an exact count in one Durable Object. The spend cap.

Gates 1 and 3 are Durable Objects rather than the \`ratelimit\` binding or a KV counter, and
\`workers/ask-budget.ts\` carries the measurements that ruled both of those out.

THE ORDERING MATTERS AS MUCH AS THE MECHANISMS: a cache hit must not consume budget, so gate 3
sits AFTER the cache, not with gate 1.`,
  ],
  "app/lib/search/ask-guard.server.ts#1": [
    "NUMBER",
    "why this rate, and where the mechanism choice is argued",
    `Requests per IP per minute. More than a reading human asks and far less than a loop wants,
counted exactly in a Durable Object instance per IP. \`workers/ask-budget.ts\` carries the
measurements that ruled out the \`ratelimit\` binding for this job.`,
  ],
  "app/lib/search/ask-guard.server.ts#2": [
    "NUMBER",
    "what the ceiling is for; already short",
    `Site-wide answers per day before Ask stops answering anyone. A ceiling on the bill, not a
fairness mechanism: deliberately a number a real reader will never reach and a scraper will.`,
  ],
  "app/lib/search/ask-guard.server.ts#3": [
    "NUMBER",
    "why a burst exists at all and what it costs; the observed demand goes to history",
    `Answers available immediately, on top of the day's paced share, chosen so PACING IS INVISIBLE
TO REAL READERS. Without a burst the first question after UTC midnight would be refused, because
an evenly paced share is zero at 00:00:01.

It is also the size of the outage a burst can buy: an attacker can take these at any moment and
then moves at the paced rate. That is the trade.`,
  ],
  "app/lib/search/ask-guard.server.ts#4": ["CONTRACT", "what it bounds; one line already"],
  "app/lib/search/ask-guard.server.ts#5": [
    "NUMBER",
    "that it is a cache over a slow path, and the freshness constraint that set the value; the samples and the cost arithmetic go to the history document",
    `THE DRIFT BADGE'S CACHE. One integer, one key, no prefix scan.

THIS IS A CACHE ADDED TO HIDE A SLOW PATH, AND SAYING SO IS THE CONDITION FOR ADDING IT. What it
hides is \`listAllAskItems\`, which pages the AI Search index and whose cost is per-call variance
rather than round-trip count, so the fix is removing the call from the read path.

THE FRESHNESS SIDE SET THE VALUE, not the cost. \`askExpectedUrls\` composes \`visibilityClause\`, so
the expected set is a function of THE CLOCK: a scheduled post whose \`publish_at\` passes becomes
expected and \`missing\` grows with no write anywhere. TTL expiry is what recomputes on the clock's
schedule, and the TTL bounds how long the badge can under-report that.

WHY THIS VALUE AND NOT 60 OR 3600: KV refuses a TTL under 60 seconds, so 60 is the shortest
expressible, and the ceiling is harm. Five minutes of an under-reported badge on a page that is
not the repair page harms nobody; an hour would start to.

That clock dependency is also why this is a TTL cache and not compute-on-write: a number
recomputed only on save would under-report a scheduled post until the next unrelated save.`,
  ],
  "app/lib/search/ask-guard.server.ts#6": ["CONTRACT", "where else the value is stated; one line already"],
  "app/lib/search/ask-guard.server.ts#7": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/ask-guard.server.ts#8": ["CONTRACT", "what it holds; one line already"],
  "app/lib/search/ask-guard.server.ts#9": [
    "WHY",
    "what it collapses and the prohibition on collapsing more",
    `Collapses questions that differ only in shape, so one question is not two cache entries and two
bills. Deliberately does NOT stem, reorder or drop stopwords: two questions that differ in wording
are different questions, and answering one with the other's answer would be a quiet correctness
bug rather than a saving.`,
  ],
  "app/lib/search/ask-guard.server.ts#10": ["CONTRACT", "what the key is; one line already"],
  "app/lib/search/ask-guard.server.ts#11": ["CONTRACT", "what it carries; one line already"],
  "app/lib/search/ask-guard.server.ts#12": ["CONTRACT", "what it carries; one line already"],
  "app/lib/search/ask-guard.server.ts#13": [
    "CONTRACT",
    "why it runs first and what an absent binding does",
    `The per-IP burst limit. Runs before anything else, including the cache: a cache hit is cheap but
not free, and letting one caller hammer the endpoint for cached answers still burns the site's
resources.

FAILS CLOSED when the limiter binding is absent. An unprotected metered endpoint must not serve,
so removing \`ratelimits\` from wrangler.jsonc DISABLES Ask rather than un-protecting it.`,
  ],
  "app/lib/search/ask-guard.server.ts#14": [
    "CONTRACT",
    "what the instance is keyed by; trimmed to two lines",
    `One Durable Object instance per IP, so counting is exact per caller and the instances shard.
Keyed by IP alone, not by IP plus question: the point is to cap how often one caller can spend.`,
  ],
  "app/lib/search/ask-guard.server.ts#15": [
    "CONTRACT",
    "when it is called, why reserve-then-generate, and why a failure is not refunded",
    `Reserves one answer against the daily ceiling.

Called ONLY on a cache miss, immediately before the model is reached, because a cache hit costs
nothing and must not consume budget. Reserve-then-generate rather than generate-then-count: two
requests that both read the same spend and both proceed is the race a ceiling must not have, so
the reservation and the decision are one operation inside the object that owns the number.

A reservation is not refunded if generation fails. Over-counting a failure makes the ceiling
slightly strict; under-counting would make it a suggestion.`,
  ],
  "app/lib/search/ask-guard.server.ts#16": [
    "CONTRACT",
    "what the split buys and what pacing fixes",
    `THE CEILING IS PACED, and the Durable Object is unchanged. \`consume\` takes the ceiling as an
argument, so the policy lives in a pure function \`check:tests\` can reach while the object stays a
counter with no clock policy of its own.

What it fixes is the SHAPE of the failure rather than the size of the bill: a flat cap is a cliff
a distributed caller spends in minutes, and Ask is then dead for real readers until UTC midnight.
Paced, the denial ends when the abuse does. Full reasoning is on \`pacedAllowance\`.`,
  ],
  "app/lib/search/ask-guard.server.ts#17": [
    "WHY",
    "which value the retry is and why the other one is wrong now",
    `\`secondsPerPacedUnit\`, NOT \`secondsUntilUtcMidnight\`. Under pacing that value would be wrong by
up to a day and would send a reader away from a feature that recovers in minutes.`,
  ],
  "app/lib/search/ask-guard.server.ts#18": ["CONTRACT", "what it does not do; one line already"],
  "app/lib/search/ask-guard.server.ts#19": [
    "WHY",
    "why a reset exists at all",
    `Clears today's spend. Admin only, and recovery rather than routine: a ceiling with no way to
lift it turns a bad day into a bad week, and a guard has to be testable from a known state.`,
  ],
  "app/lib/search/ask-guard.server.ts#20": [
    "CONTRACT",
    "what it is for and why a delete is safe here",
    `Removes one cached answer: the targeted counterpart to \`invalidateAnswerCache\`, for an entry
whose citations are no longer public. A KV \`delete\` by name is strongly consistent, unlike the
\`list\` the bulk invalidation walks.`,
  ],
  "app/lib/search/ask-guard.server.ts#21": ["WHY", "why an empty answer is not cached; two lines already"],
  "app/lib/search/ask-guard.server.ts#22": [
    "CONTRACT",
    "null is not zero, and why unparseable is a miss",
    `The cached drift count, or null when there is none to serve. NULL, NOT ZERO: zero is a real
answer meaning the index agrees with the corpus, and a miss that returned zero would render a
clean badge on no evidence. Anything unparseable is also a miss, so a hand-edited key cannot
become a number by coercion.`,
  ],
  "app/lib/search/ask-guard.server.ts#23": [
    "CONTRACT",
    "why the stored value is an object",
    `Stores the drift count. An OBJECT rather than a bare number, so a later field can be added
without the stored shape being ambiguous between versions.`,
  ],
  "app/lib/search/ask-guard.server.ts#24": [
    "CONTRACT",
    "who calls it and why a delete rather than a write",
    `Drops the cached drift count. Called by the paths that KNOW the number just changed, so the
badge does not spend the TTL disagreeing with an action the operator just took. A delete rather
than a write, because those paths know it is stale and not necessarily what it became.`,
  ],
  "app/lib/search/ask-guard.server.ts#25": [
    "CONTRACT",
    "why invalidation rather than a generation key, and the bounded staleness",
    `Drops every cached answer, when the corpus changes.

THIS IS WHY THE CACHE IS INVALIDATED RATHER THAN KEYED THROUGH A GENERATION NUMBER: a generation
in the key would cost a second KV read on every request forever, to handle an event that happens
when a post is published.

KV list is eventually consistent, so an answer written moments before a sync can survive it. The
TTL is the backstop and the window is bounded by it, recorded rather than engineered away.`,
  ],

  "app/db/schema.ts#0": ["CONTRACT", "what the table holds; already short"],
  "app/db/schema.ts#1": ["CONTRACT", "what the column holds; one line already"],
  "app/db/schema.ts#2": ["CONTRACT", "what the column holds; one line already"],
  "app/db/schema.ts#3": ["CONTRACT", "the stored shape; one line already"],
  "app/db/schema.ts#4": ["CONTRACT", "the stored shape; one line already"],
  "app/db/schema.ts#5": ["CONTRACT", "the stored shape; one line already"],
  "app/db/schema.ts#6": ["CONTRACT", "who writes it; one line already"],
  "app/db/schema.ts#7": ["CONTRACT", "what it is and who compares it; already short"],
  "app/db/schema.ts#8": ["CONTRACT", "what it is; one line already"],
  "app/db/schema.ts#9": [
    "CONTRACT",
    "why the indexes are modelled here and what the gate compares; the hard rule citation stays",
    `THE INDEXES, declared here because otherwise they are declared nowhere a reader of this file can
see. Hard rule 11 calls this file the source of truth, and a query planner decision is part of
what the table IS: somebody reading only this file would have taken the visibility predicate every
public read composes for a table scan. Section 4 compares index NAMES AND COLUMNS against the
migrations in both directions.`,
  ],
  "app/db/schema.ts#10": ["CONTRACT", "what it covers; one line already"],
  "app/db/schema.ts#11": ["CONTRACT", "what it covers; one line already"],
  "app/db/schema.ts#12": ["CONTRACT", "what it covers; one line already"],
  "app/db/schema.ts#13": ["CONTRACT", "what it covers; one line already"],
  "app/db/schema.ts#14": ["CONTRACT", "what the table holds; one line already"],
  "app/db/schema.ts#15": ["CONTRACT", "what the table holds; one line already"],
  "app/db/schema.ts#16": ["CONTRACT", "what the table holds; already short"],
  "app/db/schema.ts#17": [
    "CONTRACT",
    "derived, the conflict rule, and what it does not describe",
    `The media INDEX. Grounds are in \`drizzle/0009_media_index.sql\`.

DERIVED, never authoritative. R2 and \`public/\` are the truth for what exists and this is the
queryable surface over them, reconciled by \`check:media\` in both directions. The conflict rule is
not negotiable: R2 WINS. A row with no object is deleted, an object with no row is backfilled,
never the reverse.

It describes the ASSET and never the citations. Those live in \`mediaRefs\`, so no row here can
authorise a delete a fresh count would refuse.`,
  ],
  "app/db/schema.ts#18": ["CONTRACT", "what the column holds; one line already"],
  "app/db/schema.ts#19": ["CONTRACT", "the values and their deriver; one line already"],
  "app/db/schema.ts#20": ["CONTRACT", "the values and their deriver; one line already"],
  "app/db/schema.ts#21": ["CONTRACT", "the values and what the picker takes; already short"],
  "app/db/schema.ts#22": ["CONTRACT", "what NULL means; one line already"],
  "app/db/schema.ts#23": ["CONTRACT", "what it is for; one line already"],
  "app/db/schema.ts#24": ["CONTRACT", "which columns are authored and why that matters; already short"],
  "app/db/schema.ts#25": [
    "CONTRACT",
    "the stored form, why it is wrapped, and the one owner of it",
    `Admin organisational labels, DELIMITER-WRAPPED: \`,alpha,beta,\` or "". The wrapping is what lets
an exact tag match use LIKE without \`art\` also matching \`chart\`. NEVER WRITTEN RAW:
\`serialiseTags()\` owns the form and strips the delimiter and both LIKE wildcards out of every
part. The four-point basis is in \`drizzle/0011_media_trash_tags.sql\`.`,
  ],
  "app/db/schema.ts#26": [
    "CONTRACT",
    "library state not object state, one column not two, and what reconciliation does with it",
    `When the LIBRARY stopped showing this asset. NULL means not trashed.

A LIBRARY STATE, NOT AN OBJECT STATE. R2 and the public URL are untouched, so a trashed asset a
post cites keeps rendering for every reader while the library stops offering it.

One nullable timestamp rather than a boolean plus a date, because two columns can disagree.
Reconciliation is blind to it on purpose: the object still exists, so only library views filter.`,
  ],
  "app/db/schema.ts#27": ["CONTRACT", "what it holds and why it renders scriptless; one line already"],
  "app/db/schema.ts#28": [
    "CONTRACT",
    "the partial predicate and the boundary: the gate cannot see it",
    `Partial in the migration (\`WHERE trashed_at IS NOT NULL\`), because the only question asked of it
is which rows ARE trashed. Drizzle models the index and the predicate lives in the SQL that runs.
Section 4 of \`check:invariants\` compares columns, not index predicates, so this asymmetry is
invisible to it and is stated here instead.`,
  ],
  "app/db/schema.ts#29": [
    "CONTRACT",
    "who writes it, that usage stays derived, and what writing at render time closes",
    `Who cites what. Written by the PIPELINE at render time.

Usage stays DERIVED: this is a record of what the renderer emitted, not a cache anyone may consult
to decide existence. Writing refs at render time is what closes the fail-open, because anything
through the pipeline is indexed by construction and anything else is an enumerable gap.`,
  ],
  "app/db/schema.ts#30": ["CONTRACT", "the values and the seam; one line already"],
  "app/db/schema.ts#31": ["CONTRACT", "the values; one line already"],
  "app/db/schema.ts#32": ["CONTRACT", "what it holds; one line already"],
  "app/db/schema.ts#33": [
    "CONTRACT",
    "why it is modelled, why every read stays raw, and what section 4a asserts; the printed gate line goes to history. Both hard rule citations stay",
    `The site-wide search index. DERIVED, and the only table drizzle did not model.

WHY IT IS DECLARED HERE: hard rule 11 makes this file the source of truth for the column schema,
and a table absent from it is absent from section 4's comparison against the migrations and the
live database. This table's column names live inside hand-written SQL strings.

AND WHY EVERY READ STAYS IN RAW SQL: hard rule 1 is enforced here by section 8, which scans the
raw SQL for the composed predicate, and section 6's drizzle-shaped scan knows only \`posts\`, so a
query-builder read would be seen by NEITHER. Section 4a asserts there is no such read; if one is
ever wanted, teach section 6 about this table FIRST and delete that assertion in the same commit.

The two FTS5 mirrors stay out of drizzle: they are \`CREATE VIRTUAL TABLE\`.`,
  ],
  "app/db/schema.ts#34": ["CONTRACT", "what it is; one line already"],
  "app/db/schema.ts#35": ["CONTRACT", "which index it feeds; one line already"],
  "app/db/schema.ts#36": ["CONTRACT", "what it feeds and its form; one line already"],
  "app/db/schema.ts#37": ["CONTRACT", "what it groups; one line already"],
  "app/db/schema.ts#38": [
    "CONTRACT",
    "why visibility is carried rather than joined",
    `Visibility, carried on the record rather than joined from \`posts\`. A future \`publish_at\` has to
be re-evaluated per request, so an index storing only what was visible at sync time would leak a
scheduled post the moment its date passed, or hide it forever.`,
  ],
  "app/db/schema.ts#39": ["CONTRACT", "what it covers; one line already"],
  "app/db/schema.ts#40": ["CONTRACT", "what it covers; one line already"],
  "app/db/schema.ts#41": ["CONTRACT", "what it covers; one line already"],
  "app/db/schema.ts#42": [
    "CONTRACT",
    "neither authored nor derived, no IP column ever, and every string plain text; the hard rule citation stays",
    `WEBMENTIONS RECEIVED FROM OTHER SITES. Grounds in \`drizzle/0014_webmentions.sql\`.

NEITHER AUTHORED NOR DERIVED. A row was written by a stranger's POST and there is no source to
converge it back to, so hard rule 18 does not reach this table.
A rebuild cannot repair it, and the only bound on its size is the one the endpoint enforces.

NO IP COLUMN, AND THERE NEVER IS ONE. Nothing about the sender is recorded beyond what their own
page says, which is what \`/privacy\` claims and what this absence makes true.

EVERY STRING IS PLAIN TEXT. \`author_name\`, \`author_url\` and \`excerpt\` are read out of a document
this site does not control, so they are stored as text and never as markup.`,
  ],
  "app/db/schema.ts#43": ["CONTRACT", "what it holds; one line already"],
  "app/db/schema.ts#44": [
    "CONTRACT",
    "why a slug and not a URL",
    `THE POST SLUG, NOT A URL, and the difference is the point. A stored target URL would carry the
origin it was received on, so rows written before the cutover would name a host the render no
longer uses and deduplication would treat two spellings of one post as two targets.`,
  ],
  "app/db/schema.ts#45": [
    "CONTRACT",
    "the state machine and what is inert",
    `\`unverified -> pending | failed\`, then \`pending -> approved | rejected\`. \`unverified\` is what the
endpoint writes before it has fetched anything, so a row exists for the global cap to count from
the first moment. Only \`approved\` ever renders, which is why an unfetched or refused mention is
inert rather than merely unshown.`,
  ],
  "app/db/schema.ts#46": ["CONTRACT", "the stored form; one line already"],
  "app/db/schema.ts#47": ["CONTRACT", "where the values come from; one line already"],
  "app/db/schema.ts#48": [
    "CONTRACT",
    "what the unique index bounds",
    `ONE ROW PER (SOURCE, TARGET). A sender re-announcing the same mention updates the row it already
has, so a loop against this endpoint cannot grow the table at all: the ceiling is a function of
how many pages link here, not of how fast somebody can POST.`,
  ],
  "app/db/schema.ts#49": ["CONTRACT", "what it covers; one line already"],

  "app/lib/editor/frontmatter.ts#0": [
    "CONTRACT",
    "what it produces and why scalars are JSON strings",
    `Turns editor form fields into a markdown file, and back. The file is the artifact of record, so
this has to produce something a person would be content to see in a diff. Scalars that can carry
punctuation are emitted as JSON strings, which are valid YAML double-quoted scalars and escape
quotes and colons correctly without a YAML serializer.`,
  ],
  "app/lib/editor/frontmatter.ts#1": [
    "CONTRACT",
    "why a server-owned field is carried through the form",
    `Server-owned, carried through the editor untouched. The editor never offers it and never sets
it: \`serializePost\` writes exactly the keys it knows about, so a value it did not carry would be
silently dropped on the next save and a published post would read as never published.`,
  ],
  "app/lib/editor/frontmatter.ts#2": [
    "CONTRACT",
    "why these keys are carried and not edited; the finding's audit goes to the history document",
    `CARRIED, NOT EDITED. Every key here is a real \`frontmatterSchema\` key the pair did not know
about, and \`serializePost\` writes exactly what it is handed, so a post committed by hand or by
the operator API had those keys ERASED by the next browser save. Nothing warned: the file simply
came back smaller.

They are preserved rather than exposed as form controls, which is the smallest change that makes
the round trip lossless. \`furtherReading\` is the one that cannot be a scalar: it travels as JSON
in a hidden input, so the editor never has to understand its shape to avoid destroying it.`,
  ],
  "app/lib/editor/frontmatter.ts#3": ["CONTRACT", "what it does; one line already"],
  "app/lib/editor/frontmatter.ts#4": [
    "CONTRACT",
    "the one transform and the prohibition on a second; the CRLF defect goes to history",
    `The body, exactly as it will be stored: CRLF to LF, then trimmed.

Extracted because a SECOND caller needs the identical transform, and the two silently disagreeing
is not hypothetical. The admin preview posts its body as multipart, which normalizes every newline
to CRLF, so the save path and the preview once produced different bytes from one source.

Both callers use this. THERE IS NO THIRD WAY TO PREPARE A BODY.`,
  ],
  "app/lib/editor/frontmatter.ts#5": [
    "CONTRACT",
    "why parsing is loose here and strict in the schema",
    `The \`further_reading\` list a hidden input is carrying, as objects. Tolerant on purpose: this
value crosses a form round trip, and the schema is what judges the CONTENT, so parsing loosely
here and validating strictly there keeps one authority over the rule rather than two.

Entries missing a title or url are dropped rather than emitted half-formed, because a \`- title:\`
with no \`url\` is a schema failure that would block the save on data the author never typed.`,
  ],
  "app/lib/editor/frontmatter.ts#6": [
    "WHY",
    "why each key is conditional",
    `The carried keys. Each is emitted only when it has a value, so a post that never set one is
byte-identical to what it was before this existed.`,
  ],
  "app/lib/editor/frontmatter.ts#7": ["CONTRACT", "why it is unquoted; one line already"],
  "app/lib/editor/frontmatter.ts#8": ["CONTRACT", "the stored shape; two lines already"],
  "app/lib/editor/frontmatter.ts#9": ["CONTRACT", "what it does; one line already"],
  "app/lib/editor/frontmatter.ts#10": ["CONTRACT", "why it is re-serialized; two lines already"],
  "app/lib/editor/frontmatter.ts#11": [
    "CONTRACT",
    "one owner of the names and which one is load bearing",
    `THE FIELD NAMES THE FURTHER-READING CONTROLS SUBMIT, stated once. The component renders them and
the parser reads them, so a second spelling would be a control that submits into nothing.
\`FR_CONTROL\` is the MARKER and the load-bearing one; see \`furtherReadingFromForm\`.`,
  ],
  "app/lib/editor/frontmatter.ts#12": ["CONTRACT", "what it is; one line already"],
  "app/lib/editor/frontmatter.ts#13": ["CONTRACT", "what it is; one line already"],
  "app/lib/editor/frontmatter.ts#14": ["CONTRACT", "what it returns; one line already"],
  "app/lib/editor/frontmatter.ts#15": ["CONTRACT", "what it does; one line already"],
  "app/lib/editor/frontmatter.ts#16": [
    "CONTRACT",
    "the marker, why absence cannot mean cleared, and the ordering effect",
    `REBUILDS \`further_reading\` FROM THE CONTROLS, or leaves it exactly as it came.

A list control has a genuinely ambiguous empty state: "the author removed every row" and "this
form never rendered the control" both arrive as no fields at all. So the control renders a hidden
MARKER. Present means an empty result is the author's emptiness and is honoured; absent means
nothing was offered, so the carried JSON is passed through untouched.

The marker is a hidden input rather than an inference from the row fields, because inferring it is
the same ambiguity one level down.

ORDERING: external rows in document order, then internal picks. A mixed list NORMALISES to
externals-first on its first save and is stable after that. A row with neither title nor url is
dropped; a row with one of the two is KEPT, so the schema refuses it by name.`,
  ],
  "app/lib/editor/frontmatter.ts#17": [
    "CONTRACT",
    "why one compound value, and that the title is a snapshot",
    `The picker submits ONE checked box per chosen post, and the box's VALUE carries the slug and the
title as JSON. A parallel hidden title field per post would put one field NAME per corpus post
into the submission tuple \`check:admin-ui\` pins, so the fixture would grow with the blog.

The title is a SNAPSHOT taken when the box was ticked. Retitling the target does not rewrite links
that already point at it; \`check:content\` guards the link resolving, which is the half that can
break silently.`,
  ],
  "app/lib/editor/frontmatter.ts#18": ["WHY", "why an unreadable value is dropped; two lines already"],
  "app/lib/editor/frontmatter.ts#19": ["CONTRACT", "what it does; one line already"],
  "app/lib/editor/frontmatter.ts#20": [
    "CONTRACT",
    "why the intent comes from the submitter, and the fail-closed default",
    `FROM THE BUTTON THAT WAS PRESSED, not from a field. Reading a hidden input each button flipped in
its own handler made every publication transition script-dependent: with scripting off the request
described the post's CURRENT state rather than the one the author asked for.

Fails closed on an intent this table does not know: unknown means draft.`,
  ],
  "app/lib/editor/frontmatter.ts#21": ["CONTRACT", "why it round-trips; one line already"],
  "app/lib/editor/frontmatter.ts#22": [
    "CONTRACT",
    "why the carried keys use explicit values rather than presence",
    `The carried keys, all through hidden inputs. A checkbox is absent from a FormData when unchecked,
so \`featured\` is carried as an explicit "true"/"false" rather than by presence: presence semantics
would turn "the form did not carry it" into "the author cleared it".`,
  ],
  "app/lib/editor/frontmatter.ts#23": [
    "CONTRACT",
    "the last-wins rule and why it changes nothing for older payloads",
    `THE LAST \`featured\` WINS, and that is what makes a checkbox safe here. The field is submitted
TWICE when the box is ticked: a hidden "false" the form always carries, then the checkbox's own
"true". An unticked box submits nothing, so the hidden value stands alone.

Reading the LAST value is the whole of it, and it changes nothing for a payload with one value
present. \`form.get()\` returns the FIRST, so keeping it would make the hidden "false" permanently
win and the control silently do nothing. Absent entirely still reads false, exactly as before.`,
  ],
  "app/lib/editor/frontmatter.ts#24": ["CONTRACT", "what the marker decides; two lines already"],

  "app/routes/media.$.ts#0": [
    "CONTRACT",
    "what it serves, that nothing is written back, why the binding, and why the transform is cached; the 1042 measurement goes to the history document",
    `Serves editor-uploaded media from R2, and derives thumbnails from it. Keys are immutable by
construction, so responses carry a one year immutable cache and an ETag.

\`?w=\` returns a transform of the ORIGINAL, computed on request. NOTHING IS EVER WRITTEN BACK TO
THE BUCKET: one object, every size derived from it, which is what keeps R2 free of variant sprawl.

It uses the Images BINDING rather than the \`/cdn-cgi/image/\` URL syntax, and that is forced rather
than preferred: the URL interface requires a customer zone and this site is served from
workers.dev.

The transform is CACHED explicitly through the Cache API, because the binding's own responses are
not cached and every uncached call is a full decode and re-encode and a billed transformation.`,
  ],
  "app/routes/media.$.ts#1": [
    "CONTRACT",
    "the prohibition, why it does not lean on the CSP, and why by stored type; the Report-Only history goes to the history document",
    `SVG IS SERVED AS AN ATTACHMENT, NEVER INLINE.

An SVG is a document, not a picture: it can carry \`<script>\`, \`<foreignObject>\` and external
references. Anything in this bucket arrived through the upload form, \`image/svg+xml\` is allowed
there, and this route serves it from the SITE'S OWN ORIGIN, so inline a stored SVG is script
running as the site.

The CSP blocks that today and THIS RULE IS KEPT ANYWAY. Defence in depth, deliberately: it does
not depend on the CSP, does not move if a directive is loosened, and holds for any client that
ignores the policy.

\`attachment\` rather than a sandbox or a nonce, because nothing legitimately renders an R2 SVG
inline. Applied by the STORED content type, so a file renamed to \`.png\` on the way in is caught.

@param {Headers} headers Headers already carrying the object's metadata.`,
  ],
  "app/routes/media.$.ts#2": ["CONTRACT", "why nosniff as well; two lines already"],
  "app/routes/media.$.ts#3": [
    "CONTRACT",
    "why both width sets are closed",
    `TWO closed sets, unioned. An open set lets any caller mint unlimited distinct transforms of one
object, each a separately billed transformation and a separate cache entry.`,
  ],
  "app/routes/media.$.ts#4": [
    "CONTRACT",
    "where the helper went and what stops it coming back",
    `\`bucketFor\` MOVED to \`classify.mjs\`. It was one of three copies of one expression with nothing
holding them together, and \`check:invariants\` now fails if a second reappears.`,
  ],
  "app/routes/media.$.ts#5": [
    "CONTRACT",
    "the key carries everything the body depends on, and there is no purge door; the per-colo readings and the byte table go to the history document. The hard rule citation stays",
    `Keyed by the full request URL, so each width is its own entry and the original is untouched.

THIS KEY CARRIES NO HEADERS, SO \`Vary\` CANNOT HELP IT. The lookup presents a synthetic Request
built from the URL alone, so any response served from here must depend on nothing but the KEY.

THE ENCODER SETTINGS ARE THEREFORE IN THE KEY. \`WEBP_QUALITY\` is an input to the body, and
changing it without moving the key left every entry stored under the old encoder live, reachable
and \`immutable\` for a year. There is no purge door for this cache and workers.dev has no zone to
purge through, so the key is the only lever. Hard rule 20.

A SYNTHETIC PARAMETER, never served and never linked, the same shape \`workers/app.ts\` uses to get
the resolved theme into its own key.

\`caches.default\` is the Workers runtime's own cache; the DOM lib does not declare it, so the cast
narrows to the runtime that actually serves this.`,
  ],
  "app/routes/media.$.ts#6": [
    "CONTRACT",
    "why a missing binding is named rather than inferred",
    `The binding is configured in \`wrangler.jsonc\`, which this repo does not track, so a clone or a
rebuilt config can be missing it. Named explicitly, or the failure looks like a slow grid rather
than a missing binding.`,
  ],
  "app/routes/media.$.ts#7": ["CONTRACT", "why the fallback needs the same treatment; two lines already"],
  "app/routes/media.$.ts#8": [
    "CONTRACT",
    "which shapes crop and the roster exemption",
    `ADMIN TILES CROP, CONTENT DOES NOT. A tile is a fixed strip that already crops in CSS, so
cropping server-side is strictly better: saliency detection keeps the subject where \`object-fit\`
keeps the centre. A content image in the prose column has no fixed height and must never be
cropped at all, because the author chose the framing.

ROSTER PHOTOS ARE EXEMPT EVEN AT TILE SIZES: they are group photographs, and \`fit: "cover"\` cuts
faces off the edge of the frame.`,
  ],
  "app/routes/media.$.ts#9": [
    "CONTRACT",
    "one format and why negotiation may not come back; the poisoning incident, the docs audit and the byte comparison go to the history document",
    `ONE FORMAT, UNCONDITIONALLY. WebP, for everyone, regardless of \`Accept\`.

NEGOTIATION MAY NOT COME BACK HERE. The \`caches.default\` key above is built from the URL with no
headers, so a body that depended on \`Accept\` would be stored once and served to every client under
\`immutable\`, which is what happened for a year.

It was dropped on the measurement as well as the mechanism: AVIF beat WebP by about a percent on
the same source, which is not worth a second cache layer's worth of subtlety.

There is no \`<picture>\` element anywhere in this codebase. Its usual job is exactly this fallback,
and there is now nothing to fall back between.`,
  ],
  "app/routes/media.$.ts#10": [
    "CONTRACT",
    "why the fallback is safe here and the prohibition on generalising it",
    `A file the transformer cannot read is not an error worth a 500: the grid should still show
something. Falling back to the original is safe HERE, where it is one tile, and is exactly what
must not happen silently as a general strategy.`,
  ],
  "app/routes/media.$.ts#11": [
    "CONTRACT",
    "why no Vary, and what the header is for",
    `NO \`Vary\` HEADER, deliberately. The body depends on no request header, and advertising a \`Vary\`
the \`caches.default\` key cannot honour reads as a guarantee this layer cannot make. The
\`x-media-thumb\` header makes the transform observable from outside.`,
  ],
  "app/routes/media.$.ts#12": ["CONTRACT", "why the clone is required; two lines already"],
};
