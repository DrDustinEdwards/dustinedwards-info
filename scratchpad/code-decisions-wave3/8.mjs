// Chunk 8: palette.ts, health/checks.server.ts, routes.ts, webmention/verify.server.ts, env.d.ts,
// admin/traffic.server.ts and media/rebuild.server.ts.
//
// routes.ts barely moves and should not: almost every line in it is an ORDERING rule or a naming
// ruling, already one or two lines, and both are contract a reader of the table needs. The weight
// is in the five long headers, where the dated measurements come out and the rules stay.
export default {
  "app/enhance/palette.ts#0": [
    "CONTRACT",
    "the law, why a native dialog, the focus rule and where results come from",
    `Command palette. Site-wide, loaded as its own chunk, and pure enhancement.

NOTHING ON THE SITE DEPENDS ON THIS FILE. The header ships an anchor to \`/search\`; this upgrades
it into a button that opens a dialog. If the chunk fails to load, parse or run, the anchor is
still an anchor.

Built on the NATIVE <dialog> rather than a hand-rolled overlay, because \`showModal()\` already
provides the three things a hand-rolled one gets wrong: a real focus trap, Escape, and returning
focus to whatever opened it.

The listbox follows the ARIA combobox pattern: FOCUS NEVER LEAVES THE INPUT. Arrow keys move
\`aria-activedescendant\`, which is a pointer and not focus. A palette that moves DOM focus to each
row breaks typing, which is the one thing the component exists to support.

Results come from the Layer 0 JSON endpoint, so the palette and the server-rendered page cannot
disagree about what matches.`,
  ],
  "app/enhance/palette.ts#1": ["CONTRACT", "what it is and the naming collision; already short"],
  "app/enhance/palette.ts#2": ["CONTRACT", "what it cancels; one line already"],
  "app/enhance/palette.ts#3": ["CONTRACT", "the naming collision; two lines already"],
  "app/enhance/palette.ts#4": [
    "CONTRACT",
    "what the handle is for; the two-answers defect goes to the history document",
    `The palette's own "All results" escape hatch. A static \`<a href="/search">\` threw away whatever
had been typed, while Enter-with-no-hit in the same file already went to \`/search?q=<typed>\`. This
handle exists so the link can be kept in step with the input.`,
  ],
  "app/enhance/palette.ts#5": ["CONTRACT", "why a storage failure is silent; two lines already"],
  "app/enhance/palette.ts#6": ["CONTRACT", "a pointer; one line already"],
  "app/enhance/palette.ts#7": [
    "CONTRACT",
    "why Ask is never automatic",
    `Ask is a deliberate second action, never automatic. Results are already on screen when this is
pressed, and an answer that generated on every keystroke would bill Workers AI for typing.`,
  ],
  "app/enhance/palette.ts#8": ["CONTRACT", "why the target is checked; two lines already"],
  "app/enhance/palette.ts#9": [
    "CONTRACT",
    "why the reset is also synchronous; the observed missing event goes to history",
    `Native Escape fires \`cancel\`; let it close, but reset first so the next open does not flash the
previous results. This listener is a backstop only: the reset also runs synchronously inside
\`close()\`, because the \`close\` event proved unreliable to depend on for a programmatic close.`,
  ],
  "app/enhance/palette.ts#10": ["CONTRACT", "the guard; two lines already"],
  "app/enhance/palette.ts#11": ["CONTRACT", "why the label is presentational; already short"],
  "app/enhance/palette.ts#12": ["CONTRACT", "what it avoids; one line already"],
  "app/enhance/palette.ts#13": [
    "CONTRACT",
    "why expanded is set before the early return",
    `Recent searches are presentational buttons, not listbox options, so the combobox is NOT expanded
while they show. Set BEFORE the early return: a stale \`aria-expanded="true"\` over an empty listbox
tells a screen reader there are options to arrow through when there are none.`,
  ],
  "app/enhance/palette.ts#14": ["CONTRACT", "the sequence guard; one line already"],
  "app/enhance/palette.ts#15": [
    "CONTRACT",
    "why availability comes from the response",
    `Ask's presence is the server's answer, carried on the response the palette already makes.
Remove the binding and this goes false, so the affordance disappears with no second switch.`,
  ],
  "app/enhance/palette.ts#16": [
    "CONTRACT",
    "when it is offered and why even on zero results",
    `Offered only once classic results have rendered, and only when the server says Ask exists.
Offered even on zero results, because a question the keyword index cannot match is exactly where
an answer might help.`,
  ],
  "app/enhance/palette.ts#17": ["CONTRACT", "why a failure is surfaced; two lines already"],
  "app/enhance/palette.ts#18": [
    "CONTRACT",
    "why the streaming client is a separate import",
    `Streams an answer into the palette. The streaming client is a separate dynamic import, so the
palette chunk does not carry Ask's weight for readers who only ever search.`,
  ],
  "app/enhance/palette.ts#19": ["CONTRACT", "when it is called; one line already"],
  "app/enhance/palette.ts#20": ["CONTRACT", "what the link carries; two lines already"],
  "app/enhance/palette.ts#21": ["CONTRACT", "why a retype clears the answer; one line already"],
  "app/enhance/palette.ts#22": ["CONTRACT", "what it does; one line already"],
  "app/enhance/palette.ts#23": [
    "CONTRACT",
    "why Escape is handled here and must come first; the browser measurement goes to history",
    `Escape is handled here rather than left to the dialog, and it must come before every other
branch. \`<input type="search">\` has a NATIVE Escape behaviour: the first press clears the field
and stops there, so the keystroke never reaches the dialog and the palette stays open.`,
  ],
  "app/enhance/palette.ts#24": ["CONTRACT", "why the default is prevented; two lines already"],
  "app/enhance/palette.ts#25": ["CONTRACT", "why showModal and not show; two lines already"],
  "app/enhance/palette.ts#26": [
    "CONTRACT",
    "why the sequence bump is not optional; the observed race goes to the history document",
    `Drops every piece of open state. BUMPING THE SEQUENCE IS THE PART THAT IS NOT OPTIONAL: clearing
the DOM alone loses a race, because a fetch still in flight when the reader closes resolves
afterwards and repaints the listbox of a closed dialog, leaving stale options and
\`aria-expanded="true"\` behind it.`,
  ],
  "app/enhance/palette.ts#27": [
    "CONTRACT",
    "why the answer is aborted too",
    `Aborts an in-flight answer too. Without this a stream still running when the palette closes goes
on writing into a closed dialog, which is the same late-response trap the sequence number exists
for on the search side.`,
  ],
  "app/enhance/palette.ts#28": ["CONTRACT", "the order and why; two lines already"],
  "app/enhance/palette.ts#29": [
    "CONTRACT",
    "one binding, the event rather than an export, and the trigger's own fallback; the helper bytes go to the history document",
    `THE ONE THING THIS FILE BINDS, and it is not a shortcut.

The gestures live in \`theme.ts\`, which is already on every page and a fraction of the size, and
it appends a script tag for this bundle the first time one fires. So the palette costs its bytes
when it is asked for and nothing before.

THE GESTURE IS DELIBERATELY NOT RE-BOUND HERE. Two copies of the shortcut, one per module, would
both fire and the second would find the dialog already open. One binding makes that impossible
rather than guarded against.

THE EVENT, NOT AN EXPORT: a dynamic \`import()\` is rewritten by vite into its preload helper, which
is a large fraction of what moving the palette off the page saved. A script element inserted by an
already-trusted script is allowed by \`strict-dynamic\` without a nonce.

The trigger's own affordances stay where they were: the href is left in place, so with script
absent, broken or still in flight the element is a working link and middle-click still opens a tab.`,
  ],
  "app/enhance/palette.ts#30": ["CONTRACT", "why the export exists; one line already"],

  "app/lib/health/checks.server.ts#0": [
    "CONTRACT",
    "what it watches, the named scope, which are repairable, and the gate boundary; the 2026-07-31 incident goes to the history document",
    `The health checks, and the I/O that feeds them.

WHAT THIS EXISTS FOR: a derived store can drift and nothing has to notice. The drift was being
COMPUTED correctly the whole time and there was no PATH from the number to a person.

THE SCOPE IS DELIBERATELY SMALL:

  1. \`ask-index-drift\`    the answer index against the corpus
  2. \`media-index-drift\`  the media index against R2 and the asset manifest
  3. \`media-backup-drift\` every MEDIA object against its twin, which RECOVERY.md rests on
  4. \`fts-equality\`       the docsize equalities ship asserts after a sync
  5. \`content-drift\`      posts.source_blob_sha against the repository's own blob shas

The DRIFT checks are the ones the workflow can REPAIR by itself, through the operator operations
ship calls; everything else alerts a human. The authoritative list is \`REPAIRABLE\` in
\`app/lib/health/repair.mjs\`, and this sentence describes it rather than restating it.

A GATE SEES DISK; THESE SEE THE LIVE STATE BETWEEN COMMITS, which is a different question rather
than a second copy of one a gate already answers.

EVERY DECISION LIVES IN \`verdicts.mjs\`. This file reads bindings; what counts as a breach and what
reaches the wire are next door in a pure module, because \`check:tests\` cannot reach anything
importing a binding. If it can be wrong, it must be testable.

@see app/lib/health/verdicts.mjs
@see app/routes/api.health.ts
@see .github/workflows/health.yml`,
  ],
  "app/lib/health/checks.server.ts#1": ["CONTRACT", "what it is; one line already"],
  "app/lib/health/checks.server.ts#2": ["CONTRACT", "who reads it; one line already"],
  "app/lib/health/checks.server.ts#3": [
    "CONTRACT",
    "what reaches the wire and why",
    `The two counts a drift check compares, present only when it FAILED. These are the only part of a
failing check that reaches the wire besides its name: a flap that says which check failed and not
how far apart the sides were cannot be triaged.`,
  ],
  "app/lib/health/checks.server.ts#4": [
    "CONTRACT",
    "why a throwing check is a failing check",
    `Runs every check and returns all verdicts, never throwing for a failed check. A check that
THROWS is reported as a failed check rather than allowed to abort the run, because the alternative
is that one broken check silences every other one.`,
  ],
  "app/lib/health/checks.server.ts#5": [
    "CONTRACT",
    "why this one is placed here; the addition date goes to history",
    `Placed before \`media-backup-drift\` because the two are easy to confuse: this is the
reconciliation of the INDEX, and that one is the recovery acceptance and compares BYTES.`,
  ],
  "app/lib/health/checks.server.ts#6": [
    "CONTRACT",
    "what question it answers and why both listings are full; the replaced check goes to the history document",
    `NOT a reconciliation of the INDEX. \`check:media --remote\` owns that and \`media-index-drift\`
above watches it between gate runs. This asks the question neither can: does a second copy of
every byte exist?

BOTH BUCKETS ARE LISTED IN FULL, not with \`limit: 1\`. This compares two key sets and every etag in
them, so a truncated read would report a clean sweep of the part it saw.`,
  ],
  "app/lib/health/checks.server.ts#7": [
    "CONTRACT",
    "what the check makes possible and what its absence surfaces as",
    `The artifact arc's other half: the committed corpus artifact could leave the repository because
THIS watches D1 converge to it. A markdown commit from any machine is live within one health poll
with NO DEPLOY, because the scheduled workflow reads this check and its repair re-renders the
drifted files through the one door to a rendered row.

One Contents directory listing, which carries every file's git blob sha for free, so nothing
fetches a file to know whether it changed. A missing token, a GitHub outage or the timeout all
surface as this check FAILING, which the repair plan then refuses to act on alone: an unreadable
repository is not drift.`,
  ],
  "app/lib/health/checks.server.ts#8": [
    "CONTRACT",
    "why the counts are taken on the shadows",
    `ONE ROUND TRIP, five subqueries. \`search_docs\` is the real content table and is counted
directly; the three index counts are taken on the \`_docsize\` shadows, because COUNT(*) on an
external-content fts5 table reads through to its content table and can never disagree with it.
\`check:invariants\` section 7 enforces that distinction on this source.`,
  ],
  "app/lib/health/checks.server.ts#9": ["CONTRACT", "why a null row is a verdict; two lines already"],
  "app/lib/health/checks.server.ts#10": [
    "CONTRACT",
    "what the wrapper adds and what it does not duplicate",
    `Runs one check under a timeout, turning a throw OR a hang into a failing check rather than a
missing one. \`withTimeout\` already converts a rejection into a failed verdict, so there is no
try/catch here: one place decides what a broken check looks like. What this adds is the name.`,
  ],
  "app/lib/health/checks.server.ts#11": [
    "CONTRACT",
    "what the extra wrapper catches",
    `The extra async wrapper turns a SYNCHRONOUS throw inside \`run\` into a rejection. Without it such
a throw escapes before \`withTimeout\` has a promise to guard, and one broken check would silence
every later one.`,
  ],

  "app/routes.ts#0": ["CONTRACT", "the section marker; one line already"],
  "app/routes.ts#1": ["CONTRACT", "the ordering rule; one line already"],
  "app/routes.ts#2": [
    "CONTRACT",
    "what it is and the ordering rule",
    `Atom, alongside RSS and from the same rows. RSS stays the advertised feed. Like the others it
MUST precede \`blog/:slug\`, or "atom.xml" would be read as a post slug and answer 404.`,
  ],
  "app/routes.ts#3": [
    "CONTRACT",
    "why they are grouped and why the feeds come first",
    `The tag archive and its two feeds. \`blog/tags/:tag\` is two segments where \`blog/:slug\` is one,
so they cannot collide; they are grouped here so everything under \`/blog/\` that is NOT a post
reads as one block, and the feed children precede the page to keep "more specific first" true by
eye as well as by the matcher.`,
  ],
  "app/routes.ts#4": [
    "CONTRACT",
    "the same grouping and ordering rule",
    `The series archive and its two feeds, on the tag archive's shape and in the same block for the
same reason, with the feed children first.`,
  ],
  "app/routes.ts#5": [
    "CONTRACT",
    "the placement is the security design",
    `Draft previews, TOP LEVEL and never a branch of the post route. THE PLACEMENT IS THE SECURITY
DESIGN, not a filing preference: the post route exports public cache headers, Workers Cache does
not key on cookies, and a reviewer holding a preview link is cookieless, so sharing a route would
put an unpublished post into a shared cache entry.`,
  ],
  "app/routes.ts#6": [
    "CONTRACT",
    "why the legacy URL and why the asset prefix differs",
    `Roster, at the LEGACY URL: \`/phage-discovery\` is the address the old WordPress page holds and
the one that is indexed, so the Worker takes it over at cutover rather than redirecting it. The
photo assets stay at \`/phage-hunters/*\`, a static prefix and not a route, on purpose.`,
  ],
  "app/routes.ts#7": [
    "CONTRACT",
    "why the URL was restored; the dates go to the history document",
    `The publication list, restored under ruling 63 at the URL it held before PR #3 retired it,
because a published URL is a promise. The per-paper pages live under it.`,
  ],
  "app/routes.ts#8": [
    "CONTRACT",
    "the trailing slash rule and the ordering",
    `ONE PAGE PER PAPER, at a DOI-derived slug, WITH A TRAILING SLASH. The gateway redirects the
slashless form so only one is canonical, and the slash is what puts the page and its PDF in one
subdirectory, which is Google Scholar's stated condition for honouring \`citation_pdf_url\`.

AFTER the index route, which is one segment where this is two, so they cannot collide.`,
  ],
  "app/routes.ts#9": [
    "CONTRACT",
    "why the exports precede the pages and what that keeps true",
    `THE CITATION EXPORTS, BEFORE THE PAGE ROUTES THEY BELONG TO. Each pair could collide on a slug
that happened to end in \`.bib\`, so they are declared first for the same reason the blog feeds
precede \`blog/:slug\`.

\`doiSlug\` cannot produce a slug containing a dot, so the collision is impossible today. The
ordering keeps that a fact about the matcher rather than about a function somebody could change.`,
  ],
  "app/routes.ts#10": [
    "CONTRACT",
    "why it is first; the audit's finding goes to the history document",
    `Who this is, in the first person, from \`content/about.md\`. FIRST among the hand-written pages
and FIRST in the header nav: the first questions a stranger has off the home page are who is this,
where do they work and how do I reach them.`,
  ],
  "app/routes.ts#11": ["CONTRACT", "the naming ruling; already short"],
  "app/routes.ts#12": ["CONTRACT", "what it is and where it is linked; two lines already"],
  "app/routes.ts#13": ["CONTRACT", "the naming ruling; already short"],
  "app/routes.ts#14": ["CONTRACT", "what it is; already short"],
  "app/routes.ts#15": ["CONTRACT", "the ordering rule; two lines already"],
  "app/routes.ts#16": ["CONTRACT", "what it is; two lines already"],
  "app/routes.ts#17": [
    "CONTRACT",
    "why it is public and why it sits at the root",
    `The webmention receiver. Public and unauthenticated because another site's server sends these
with no credential to offer; the four bounds are in the route file. AT THE ROOT rather than under
\`/api\`, because it is advertised in a \`<link>\` and a Link header and is then a published part of
this site's surface, which \`/api\` is not.`,
  ],
  "app/routes.ts#18": ["CONTRACT", "the section marker; one line already"],
  "app/routes.ts#19": ["CONTRACT", "how the subtree is gated; one line already"],
  "app/routes.ts#20": [
    "CONTRACT",
    "why the path makes the narrower claim",
    `Per-path origin requests. THE PATH SAYS ORIGIN-REQUESTS RATHER THAN TRAFFIC because a URL is
something a reader sees, and the panel spends a caption explaining that these are not reads. A URL
making the looser claim would undo that in the address bar.`,
  ],
  "app/routes.ts#21": ["CONTRACT", "the naming ruling; already short"],
  "app/routes.ts#22": ["CONTRACT", "what keeps one media surface; two lines already"],
  "app/routes.ts#23": ["CONTRACT", "what it carries; two lines already"],
  "app/routes.ts#24": ["CONTRACT", "why POST; two lines already"],
  "app/routes.ts#25": ["CONTRACT", "how the shape enforces the ruling; already short"],
  "app/routes.ts#26": ["CONTRACT", "the section marker; one line already"],
  "app/routes.ts#27": ["CONTRACT", "why it is public; two lines already"],
  "app/routes.ts#28": ["CONTRACT", "why it sits outside the gated subtree; two lines already"],

  "app/lib/webmention/verify.server.ts#0": [
    "CONTRACT",
    "the claim is the sender's, what waitUntil costs, every bound on the fetch, and the no-markup rule",
    `Does the source page really link to the target?

THE CLAIM IS THE SENDER'S UNTIL THIS RUNS. Nothing in the POST is evidence: the body is two
strings they typed. So the row is written \`unverified\`, this fetches the page they named, and the
row moves to \`pending\` only if an anchor on it actually resolves to the target. Without that the
endpoint would be a way to publish arbitrary text under an arbitrary URL on someone else's post.

IT RUNS IN \`ctx.waitUntil\`, NOT A QUEUE, and the cost is stated rather than hidden: a
\`waitUntil\` cut short by the runtime leaves the row in \`unverified\`, where the admin can see it
and the global cap still counts it. That is the safe direction, and a systematic failure shows up
as a growing open queue rather than as silence.

EVERY BOUND ON THE OUTBOUND FETCH:

  protocol     http or https only, not this origin, not loopback, not an IP literal
  timeout      via \`AbortSignal.timeout\`; a slow source must not hold a \`waitUntil\` open
  credentials  none. There is nothing to send and nothing to leak
  body         capped through \`readCapped\`, so the sender's claim about size does not participate

NOTHING FROM THE SOURCE IS STORED AS MARKUP. The name and the excerpt come off \`textContent\` and
the URL is re-parsed and kept only if it is absolute http(s), so there is no path from this
function to injected HTML.`,
  ],
  "app/lib/webmention/verify.server.ts#1": ["NUMBER", "what it bounds; one line already"],
  "app/lib/webmention/verify.server.ts#2": ["NUMBER", "what it bounds; one line already"],
  "app/lib/webmention/verify.server.ts#3": [
    "CONTRACT",
    "why a fixed set rather than a message",
    `THE FIXED SET OF FAILURE REASONS, exported so the admin page and the tests name the same
strings. A FIXED SET RATHER THAN A MESSAGE, because the column is shown to the admin and a
free-text reason built from an error would put a remote server's prose into this site's own admin
plane. Each word names a different repair.`,
  ],
  "app/lib/webmention/verify.server.ts#4": ["CONTRACT", "what the sentinel means; one line already"],
  "app/lib/webmention/verify.server.ts#5": [
    "CONTRACT",
    "the named fallback and where validation happens; both hard rule citations stay",
    `Best-effort author, from an h-card if the page publishes one.

BEST EFFORT MEANS THE FALLBACK IS NAMED, NOT INVENTED. With no h-card the name is the source's
HOSTNAME and the URL is null, which is a fact about where the mention came from rather than a
guess about who wrote it. That is the difference between an honest fallback and hard rule 13's
substituted value.

\`u-url\` is resolved against the source and kept only if it is absolute http(s). A relative or
\`javascript:\` value becomes null rather than being refused later at render time, which is what
hard rule 6 asks: validate where the value enters.`,
  ],
  "app/lib/webmention/verify.server.ts#6": [
    "CONTRACT",
    "why the decision is split from the write",
    `Fetch the source and decide. Pure of the database: the caller records it. Split so a test can
drive the decision over a stubbed fetch without also asserting a row write.`,
  ],
  "app/lib/webmention/verify.server.ts#7": [
    "CONTRACT",
    "why the signal separates the two reasons",
    `ONE SIGNAL, READ TWICE. \`AbortSignal.timeout\` fires during the fetch OR during the body read,
and the two produce different shapes: the first throws, the second makes \`readCapped\` return its
unreadable sentinel. So the signal is what separates \`timeout\` from \`fetch-error\` at both sites.
Reading the sentinel alone would misreport a timed-out read as \`no-link\`, which is the reason a
sender would act on and the wrong one.`,
  ],
  "app/lib/webmention/verify.server.ts#8": [
    "CONTRACT",
    "why the type is checked first and why absent means not-HTML",
    `THE CONTENT TYPE IS CHECKED BEFORE THE BODY IS READ, so a source that announces a video does not
cost a megabyte to refuse. An ABSENT content-type is treated as not-HTML rather than assumed: a
server that will not say what it sent is not one whose bytes this Worker should hand to a parser.`,
  ],
  "app/lib/webmention/verify.server.ts#9": [
    "CONTRACT",
    "how anchors are compared and which match wins",
    `EVERY ANCHOR IS RESOLVED AGAINST THE SOURCE before it is compared, and \`sameDocument\` compares
with and without a trailing slash, because both spell the same post here. The FIRST match wins and
is what the excerpt is taken from: a page that links here twice is one mention.`,
  ],
  "app/lib/webmention/verify.server.ts#10": [
    "CONTRACT",
    "what the excerpt is taken from and why it is text",
    `THE EXCERPT IS THE CONTAINING ELEMENT'S TEXT, not the whole page and not the anchor's label. The
anchor alone is usually the post's title; the page is unbounded; the parent is the sentence
somebody wrote about the post. \`textContent\`, so the value is plain text at the moment it is
produced rather than markup the render is the only thing standing between.`,
  ],
  "app/lib/webmention/verify.server.ts#11": [
    "CONTRACT",
    "never throws, and what an unexpected failure becomes",
    `Verify one received mention and write the verdict. NEVER THROWS: it is handed to
\`ctx.waitUntil\`, and an unhandled rejection there is a log line nobody reads plus a row left in
\`unverified\` with no reason on it. Anything unexpected becomes \`fetch-error\`.`,
  ],
  "app/lib/webmention/verify.server.ts#12": [
    "CONTRACT",
    "a failed write reverts nothing; the hard rule citation stays",
    `A FAILED WRITE NEVER REVERTS ANYTHING, per hard rule 18's second clause. The row stays
\`unverified\`, which is a visible state rather than a fabricated verdict.`,
  ],

  "app/env.d.ts#0": [
    "CONTRACT",
    "why the block exists and what editing it obliges",
    `Secrets set with \`wrangler secret put\` are not part of wrangler.jsonc, so they do not appear in
the generated Env type. Declare them here. Values never reach the client bundle: they are read
only inside \`.server\` modules and loaders.

THIS BLOCK IS GATED. \`check:secrets\` asserts in both directions that every ratified secret is
declared here and that everything here is ratified, so adding one means editing this block, the
gate's list and \`dustinedwards/core.md\` in one commit.`,
  ],
  "app/env.d.ts#1": ["CONTRACT", "what it is and who reads it; one line already"],
  "app/env.d.ts#2": [
    "CONTRACT",
    "the optional contract; the omission that motivated the gate goes to the history document",
    `Bearer token for the operator API. OPTIONAL, and that is the contract rather than an oversight:
\`POST /api/operator\` returns 503 when it is absent or too short, because not configured means not
open.`,
  ],
  "app/env.d.ts#3": [
    "CONTRACT",
    "optional by contract, and that only the read path needs a credential",
    `Cloudflare API token for READING Analytics Engine over the SQL API, scoped to Account Analytics
Read. The cockpit's origin-requests panel is its only reader.

OPTIONAL BY CONTRACT, on the \`OPERATOR_TOKEN\` precedent. A development machine will never have it,
so absence is an ordinary state: the loader returns its error state and the rest of the cockpit
renders untouched. Not configured means not readable, never a thrown loader.

The WRITE path needs nothing here: \`writeDataPoint\` is a binding and carries its own
authorization.`,
  ],
  "app/env.d.ts#4": [
    "CONTRACT",
    "optional by contract and where the full contract lives",
    `Bearer token for the READ-ONLY smoke credential that lets \`check:browser\` drive the real admin
plane without the single admin's session cookie.

OPTIONAL BY CONTRACT, the third on the \`OPERATOR_TOKEN\` precedent. Absent or too short means NOT
CONFIGURED, and the middleware refuses a presented token with 503 rather than serving. Read in
exactly one place, \`app/lib/smoke.server.ts\`, where the least-privilege argument lives.`,
  ],
  "app/env.d.ts#5": [
    "CONTRACT",
    "the two holders, and why the type is required while the contract is optional; the policy change date goes to the history document",
    `API key for OpenAlex, which is where the per-paper citation counts come from.

OPTIONAL BY CONTRACT, and the gentlest of the four degradations: \`citations.server.ts\` serves
whatever APP_KV already holds and does not schedule a refresh, so an unset key means counts stop
ageing forward rather than disappearing. Nothing 503s and nothing renders a zero.

TWO HOLDERS, ONE CREDENTIAL: the Worker secret, and the gitignored \`.dev.vars\` the build reads
through \`scripts/lib/dev-vars.mjs\`. Rotate both or neither.

WHY THIS ONE IS NOT MARKED OPTIONAL, WHEN ITS CONTRACT IS. Because \`.dev.vars\` is also where the
build reads it, \`wrangler types\` SEES IT and generates it as required. Declaring it \`?: string\`
here widens the merged \`Env\` so it stops being assignable to \`Cloudflare.Env\`. THE OPTIONALITY IS
ENFORCED IN CODE INSTEAD: \`citations.server.ts\` checks the value before spending a request,
because an unset secret is \`undefined\` at runtime whatever the type says. The type is not the
contract here; this comment is.`,
  ],
  "app/env.d.ts#6": [
    "CONTRACT",
    "why vars are not declared here",
    `WHY THERE IS NO VARS BLOCK HERE, and why adding one would be a defect. A plain var in
wrangler.jsonc is already generated into the base Env by \`wrangler types\`, carrying its value, so
declaring it again would put that value in a second place.

The rule this file enforces is about SECRETS, which wrangler cannot see because they are set with
\`wrangler secret put\`. Vars are the opposite case: wrangler owns them.`,
  ],
  "app/env.d.ts#7": ["CONTRACT", "why unknown; already short"],
  "app/env.d.ts#8": ["CONTRACT", "what Vite resolves; one line already"],
  "app/env.d.ts#9": [
    "CONTRACT",
    "what it namespaces and why it is inside declare global",
    `A value that differs for every build, injected by \`define\` in vite.config.ts. It namespaces the
Worker's own HTML cache and has no other reader; the grounds are on \`BUILD_ID\` in that file.

Inside \`declare global\` because this file carries \`export {}\` and is therefore a module: a bare
\`declare const\` here would be scoped to the module and invisible to \`workers/app.ts\`.`,
  ],

  "app/lib/admin/traffic.server.ts#0": [
    "CONTRACT",
    "server only, what the number is and is not, the weighting rule, and fails closed",
    `The origin-requests source: Analytics Engine, read over the SQL API.

SERVER ONLY. \`.server.ts\` so a leak into the client bundle is a build break rather than a review
catch. Nothing Analytics-related reaches the browser except the rendered rows.

WHY THE PANEL SAYS ORIGIN REQUESTS. The dataset is written from the Worker's response path, and an
edge HIT serves a reader without the Worker running. Every number here is a count of times the
origin was reached, which is A FLOOR UNDER READERSHIP AND NOT A MEASURE OF IT.

EVERY AGGREGATE IS SAMPLING WEIGHTED. The documented way to count events is
\`SUM(_sample_interval)\`; a raw \`COUNT()\` reads correctly at low volume and silently undercounts
the moment sampling engages, which is a number that stays plausible while becoming wrong.

IT FAILS CLOSED, AND THAT IS THE ORDINARY CASE. \`ANALYTICS_READ_TOKEN\` is optional by contract, so
absence returns the error result rather than throwing: a thrown loader would replace the whole
cockpit with an error boundary.`,
  ],
  "app/lib/admin/traffic.server.ts#1": ["CONTRACT", "where the dataset is written; one line already"],
  "app/lib/admin/traffic.server.ts#2": [
    "CONTRACT",
    "why it is exported and the quoted-interval law",
    `Builds the panel query, exported so the gate can assert its SHAPE without a network call or a
token.

\`INTERVAL '7' DAY\` in the QUOTED form. The unquoted spelling is rejected by this API, and that is
recorded law rather than a preference.

@param windowDays how far back to look
@param limit how many paths to return`,
  ],
  "app/lib/admin/traffic.server.ts#3": [
    "CONTRACT",
    "why a second statement",
    `Total across every path in the window, so the top N can state what it omits. A separate
statement because the SQL API takes one per request, and two cheap aggregates beat presenting a
truncated list as if it were the whole picture.

@param windowDays how far back to look`,
  ],
  "app/lib/admin/traffic.server.ts#4": ["CONTRACT", "what it is; one line already"],
  "app/lib/admin/traffic.server.ts#5": ["CONTRACT", "why the body is not carried; two lines already"],
  "app/lib/admin/traffic.server.ts#6": ["CONTRACT", "what it returns; already short"],
  "app/lib/admin/traffic.server.ts#7": [
    "CONTRACT",
    "one derivation, one read for the list, what completeness means, and why a cache but no budget; the samples go to the history document",
    `THE PER-POST READ, and it adds no query.

It composes \`trafficQuery\` and \`trafficTotalQuery\` rather than adding a third statement: a second
builder would be a second definition of what a window is and what an origin request counts as,
and the two would agree until one was edited.

ONE READ FOR THE WHOLE LIST, never one per row. The two statements are issued in parallel and the
route indexes the result by path, so adding a post costs nothing.

THE LIMIT IS A CUT AND THE CALLER IS TOLD WHEN IT BITES. \`pathsReturned\` is the independent
measure of how many paths had activity, and comparing the two is the only way to know whether an
absent path means zero. \`complete\` carries that answer, so the column never shows a measured zero
for a post whose number was not asked for.

THE TTL IS BELOW A LAG THIS DATA ALREADY HAS, so the cache costs no accuracy that existed to lose.

NO BUDGET RACE, deliberately: \`askDriftCount\` has a measured tail to guard against and this has
none, and a budget picked without one would be an invented threshold in a file whose whole subject
is not inventing numbers.`,
  ],
  "app/lib/admin/traffic.server.ts#8": ["CONTRACT", "a pointer to the reason; one line already"],
  "app/lib/admin/traffic.server.ts#9": [
    "CONTRACT",
    "why a stored shape is checked",
    `Shape-checked rather than trusted. A stored object from an older shape must read as a MISS, not
as a report with undefined fields, because \`byPath\` being undefined would make every post render
as a measured zero.`,
  ],
  "app/lib/admin/traffic.server.ts#10": ["CONTRACT", "what a KV outage costs; one line already"],
  "app/lib/admin/traffic.server.ts#11": ["CONTRACT", "what it returns; already short"],
  "app/lib/admin/traffic.server.ts#12": [
    "CONTRACT",
    "why both halves are needed",
    `Both halves, and the second is the one that catches a silent cut. The row count proves the limit
was not reached; the total proves no path with activity is missing. Either alone can be satisfied
while the result is short.`,
  ],
  "app/lib/admin/traffic.server.ts#13": ["CONTRACT", "why a cache failure is not a read failure; one line already"],

  "app/lib/media/rebuild.server.ts#0": [
    "CONTRACT",
    "which columns are recoverable, the one-direction conflict rule, and why enumeration precedes writing",
    `Re-derives the media index from the things that are actually true.

THE RULE THIS MODULE EXISTS TO OBEY: hash, mime, bytes, dimensions and the placeholder are
RECOMPUTABLE from the object. \`alt\`, \`caption\`, \`focal_x\` and \`focal_y\` are AUTHORED and
recoverable from NOTHING. So a rebuild re-derives the first set and preserves the second, which is
why it walks through \`upsertDerivedMedia\` and never through a delete-then-insert.

THE CONFLICT RULE, ONE DIRECTION ONLY: R2 WINS. A row whose object has disappeared is deleted, an
object with no row is indexed, and an object is never deleted because a row said so. This module
has no code path that could: it imports no delete and takes no bucket-write of any kind.

BOTH SOURCES ARE ENUMERATED EXHAUSTIVELY BEFORE ANYTHING IS WRITTEN, because a partial listing
would make every absent key look like a deletion.`,
  ],
  "app/lib/media/rebuild.server.ts#1": ["CONTRACT", "what it holds; one line already"],
  "app/lib/media/rebuild.server.ts#2": ["CONTRACT", "where the values come from; one line already"],
  "app/lib/media/rebuild.server.ts#3": ["CONTRACT", "why an SVG records nothing; two lines already"],
  "app/lib/media/rebuild.server.ts#4": ["CONTRACT", "what it is; one line already"],
  "app/lib/media/rebuild.server.ts#5": [
    "CONTRACT",
    "one enumeration for both readers, exhaustive, the two buckets, and why static comes from a manifest; the hard rule citation stays",
    `EVERY ASSET THAT ACTUALLY EXISTS: both buckets, plus the static manifest.

Extracted so the rebuild and the reconciliation CANNOT disagree about what the sources are. Two
enumerations of the same thing are two answers to "what exists", and the one used to grade the
other would be the one nobody checked. Rule 18: the bucket and the repository are the SOURCES, the
index is the projection, and this function is that sentence in code.

EXHAUSTIVE, TO THE END OF THE CURSOR. A partial listing makes every absent key look like a
deletion, so a truncated page with no cursor throws rather than being mistaken for the whole
bucket.

Two buckets, split on LIFECYCLE: MEDIA is irreplaceable, OG holds cards a command can regenerate.
Both are indexed, because an asset that existed and appeared nowhere is the invisible-object
problem the index exists to end.

The static half comes from the committed manifest because A WORKER CANNOT LIST ITS OWN STATIC
ASSETS: the assets binding has exactly one method, \`fetch()\`.`,
  ],
  "app/lib/media/rebuild.server.ts#6": [
    "CONTRACT",
    "why the verdict is read back and why drift is a sum",
    `WHAT THE INDEX WOULD HAVE TO HOLD, AGAINST WHAT IT HOLDS. \`expected\` comes from the SOURCES and
\`present\` from the index, both read AFTER any write, so a caller cannot be told a sync succeeded
by an operation that merely ran: a loop over a wrongly enumerated set reports a healthy \`indexed\`
and leaves the index short.

BOTH DIRECTIONS, and the two are not symmetric. A missing key is an asset the site has and the
index cannot describe; an extra key is a row for something that no longer exists. Neither is
allowed to average out against the other, which is why \`drift\` is their SUM.`,
  ],
  "app/lib/media/rebuild.server.ts#8": ["CONTRACT", "where the enumeration comes from; two lines already"],
  "app/lib/media/rebuild.server.ts#9": ["CONTRACT", "the step marker; one line already"],
  "app/lib/media/rebuild.server.ts#10": [
    "CONTRACT",
    "why the read follows the key",
    `An OG card lives in the OG bucket, so the read has to follow the key rather than assume MEDIA.
One shared function, never a fourth inline copy of that expression.`,
  ],
  "app/lib/media/rebuild.server.ts#11": ["CONTRACT", "why two reads; two lines already"],
  "app/lib/media/rebuild.server.ts#12": [
    "CONTRACT",
    "why the name is re-derived",
    `The filename, re-derived from the OBJECT rather than preserved by luck. This is what makes
\`original_name\` honestly a derived column: before the name rode in custom metadata, a row that
never got one could never acquire it.`,
  ],
  "app/lib/media/rebuild.server.ts#13": ["CONTRACT", "the step marker; one line already"],
  "app/lib/media/rebuild.server.ts#14": [
    "CONTRACT",
    "what is matched; the verification date goes to history",
    `The hostname is ignored and only the pathname is matched, which is what makes the static tier
first-class rather than a listing with no transforms.`,
  ],
  "app/lib/media/rebuild.server.ts#15": [
    "CONTRACT",
    "why null is the honest value",
    `A static asset has no upload event. Its mtime is a property of the build machine rather than of
the asset, so recording one would be inventing a fact.`,
  ],
  "app/lib/media/rebuild.server.ts#16": [
    "CONTRACT",
    "why removal is last and computed from the same enumeration",
    `Remove rows whose source is gone. R2 and \`public/\` win. Deliberately LAST, and computed from the
SAME enumerations that were just written from, so a transient read failure cannot cause a
deletion.`,
  ],
};
