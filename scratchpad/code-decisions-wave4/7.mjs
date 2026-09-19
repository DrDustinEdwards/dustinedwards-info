// Chunk 7: app/routes/home.tsx (0-13), app/routes/blog._index.tsx (0-20),
// app/routes/admin.posts.$slug.edit.tsx (0-29) and app/routes/publications.tsx (0-27).
// 93 blocks.
//
// Same rule: contracts at 180 bytes or less, headers at ~370.
//
// ONE HEADER IS OVER, home #2, and it is named so the exception is visible. It carries four
// separate prohibitions about a CACHED page: the three numbers are read at render and never
// typed, the tile carries the time it was read because a cached page must not lie, this loader
// can no longer start a health run, and the subrequest is still refused. Each forbids a
// different thing, and the page is the site's front door.
//
// The public routes' protected class here is cache correctness and canonicalisation: what a
// canonical may never name (publications #14), what a page may never claim while cached
// (home #2, home #7), and the redirect that keeps a soft 404 out of the index (blog #4).
export default {
  "app/routes/home.tsx#0": [
    "CONTRACT",
    "the opt-in and the default that still covers everything else; the citation stays on one line",
    `Publicly cacheable. The hard rule 8 default STAYS and still covers everything
unlisted; this route opts in. The theme is a dimension of the cache key rather
than a Vary. Tagged \`posts\`, because the proof tiles and the featured list read
the corpus.`,
  ],
  "app/routes/home.tsx#1": ["CONTRACT", "already at size"],
  "app/routes/home.tsx#2": [
    "CONTRACT",
    "header, over 370 on purpose: four prohibitions about a cached page; the measurements and both corrections go to the history document",
    `THE FRONT DOOR: who, what, and why believe it.

This site's proof is that it measures itself continuously and publishes the
measurements, so THE THREE NUMBERS ARE READ AT RENDER from the instruments that
own them, never typed into this file. A digit here would be a second copy of a
number a gate already owns. Rule 17.

THE CACHED PAGE MUST NOT LIE. This page is shared-cached, so a verdict rendered
into it can be minutes old by the time it is read. The tile therefore carries
the time it was read and the page stays cached: "All N checks passed at 14:32
UTC" is TRUE when read at 14:41, and "All N checks passed" is not.

NOTHING HERE CAN START A HEALTH RUN. \`/api/health\` writes its verdict to KV and
this loader reads it: one KV read. The subrequest is refused because a Worker
fetching its own public URL is a hop out to the edge and back, naming an origin
that changes at cutover.

THE TILE HAS A THIRD STATE. The snapshot can be absent or old, so the tile must
be able to say so instead of showing a verdict; every uncertain input resolves
to \`missing\`.`,
  ],
  "app/routes/home.tsx#3": [
    "CONTRACT",
    "why concurrent, and why the mark keeps its name",
    `CONCURRENT: neither reads the other's result. \`home_health\` KEEPS ITS NAME
deliberately, because the same name against a different number is a legible
before and after where a renamed mark would look like the instrument was
removed.`,
  ],
  "app/routes/home.tsx#4": [
    "WHY",
    "keeps ruling 57 and why /blog differs; the dark-section story goes to the history document",
    `\`splitFeatured\` IS GONE FROM THIS ROUTE, ruling 57: it searched inside the rows
already fetched, so the lead was only found when it happened to be among them.
\`/blog\` keeps it, because there the question really is "is the hero on the page
I just fetched".`,
  ],
  "app/routes/home.tsx#5": [
    "CONTRACT",
    "this route decides nothing about health",
    `HANDED STRAIGHT THROUGH. The classification, the age and the refusal to present
an uncertain snapshot as a verdict all happened in \`healthTile\`. This route
computes no timestamp of its own.`,
  ],
  "app/routes/home.tsx#6": [
    "CONTRACT",
    "header: why the gate reads an attribute and not the prose",
    `A proof tile. The number is always passed in; this component owns none.

\`age\` is emitted as \`data-health-age\` in SECONDS for \`check:browser\`. The gate
reads the attribute rather than the sentence beside it, because the sentence is
prose that will be edited and the attribute is a number that cannot be satisfied
by a rewording.`,
  ],
  "app/routes/home.tsx#7": [
    "CONTRACT",
    "why an uncertain state shows a dash; the UTC reasoning goes to the history document",
    `\`missing\` and \`stale\` both refuse to show a ratio: a number beside "health
checks passing" is read as the CURRENT answer no matter what sentence sits under
it, and a dash is not mistakable for a verdict.`,
  ],
  "app/routes/home.tsx#8": [
    "CONTRACT",
    "keeps the one hidden element and the no-photo rule; the ruling citation stays on one line",
    `Ruling 50 as amended: microformats only, no \`rel="me"\`. Only \`u-url\` had
nowhere to go, so the anchor is hidden and it is the ONE hidden element here.

NO \`u-photo\`: a card claiming a photo the site does not publish would be the
h-card version of a substituted value.`,
  ],
  "app/routes/home.tsx#9": [
    "CONTRACT",
    "the one-owner rule for the sentence",
    `ONE SENTENCE OF WHO AND WHAT, and it is \`SITE.tagline\`, the string the Person
record and the meta description already derive from.`,
  ],
  "app/routes/home.tsx#10": [
    "CONTRACT",
    "keeps the one-constant rule and the not-repeated title; the audit finding goes to the history document",
    `THE UNIVERSITY, IN TEXT A PERSON CAN READ. \`SITE.affiliation\`, the SAME
constant the Person record's \`worksFor\` comes from, so the page and the graph
cannot name different employers. The JOB TITLE is deliberately not repeated
here.`,
  ],
  "app/routes/home.tsx#11": [
    "CONTRACT",
    "keeps the stated cost and the gate that covers it; the element history goes to the history document",
    `THE SAME FOUR PROPERTIES AS \`PostCard\`, on markup that is not \`PostCard\`. It
IS a second place the property set is written down, which is the cost, and
\`check:microformats\` reads both surfaces so the two cannot quietly diverge.

NO h-feed: this is a hand-picked three, not the blog's feed.`,
  ],
  "app/routes/home.tsx#12": [
    "CONTRACT",
    "why it is stated on the page",
    `FOR READERS WHO ARE NOT PEOPLE, stated plainly rather than left to be
discovered in a Link header: an agent that knows this can read the writing
without parsing markup at all.`,
  ],
  "app/routes/home.tsx#13": ["CONTRACT", "already at size"],
  "app/routes/blog._index.tsx#0": ["CONTRACT", "already at size; carries the URL-state rule"],
  "app/routes/blog._index.tsx#1": [
    "CONTRACT",
    "the opt-in and its one owner",
    `INSTRUMENTATION, OFF BY DEFAULT. \`?timing=1\` opts in, and root's middleware is
what reads it and creates the collector for every route. This loader used to make
its own.`,
  ],
  "app/routes/blog._index.tsx#2": [
    "WHY",
    "what to read off the numbers rather than assume",
    `ONE round trip now, not three. These two run in parallel with it and were
hidden underneath the old serial chain, so whether they are now the critical path
is the thing to read off the numbers rather than assume.`,
  ],
  "app/routes/blog._index.tsx#3": [
    "CONTRACT",
    "keeps the removal, the pagination property and the known limit; the self-contradicting comment goes to the history document",
    `The featured post is surfaced only on the unfiltered first page, AND IT IS
REMOVED FROM THE LIST BELOW IT. Filtered here rather than in the component, so
the count the page reports and the items it renders come from one decision.

PAGINATION IS UNAFFECTED: \`pageCount\` is computed over the whole corpus.

KNOWN LIMIT: the hero only appears when the featured post falls on page 1.`,
  ],
  "app/routes/blog._index.tsx#4": [
    "CONTRACT",
    "keeps the three-way argument compressed; the soft-404 explanation goes to the history document",
    `OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE. NOT 404, because the resource
EXISTS and 404 would be wrong the moment enough posts make the page valid. NOT
CLAMPED IN PLACE, because the URL would then disagree with the page and a copied
link would be a lie. 302 rather than 301: the bound moves as posts are
published.`,
  ],
  "app/routes/blog._index.tsx#5": [
    "CONTRACT",
    "the ordering is the whole fix",
    `AFTER the spread, so the filtered array wins over \`listing.posts\`. Spread first
and this line is the whole fix; spread second and it is a no-op that reads like
one.`,
  ],
  "app/routes/blog._index.tsx#6": [
    "WHY",
    "why the route no longer stamps; the local-array history goes to the history document",
    `The transport writes the header from the same array AFTER the handler returns,
which is the one point where it is complete. Stamping here would emit a header
built from a list still being written to.`,
  ],
  "app/routes/blog._index.tsx#7": [
    "CONTRACT",
    "the cache dimension and the tag",
    `The theme is a dimension of the cache key rather than a Vary, so this page no
longer declares one. Tagged \`posts\`, because its content is a function of the
corpus and a publish must be able to move it.`,
  ],
  "app/routes/blog._index.tsx#8": ["CONTRACT", "already at size"],
  "app/routes/blog._index.tsx#9": ["CONTRACT", "already at size"],
  "app/routes/blog._index.tsx#10": [
    "CONTRACT",
    "what the canonical must carry; the consequence goes to the history document",
    `THE CANONICAL CARRIES EVERY AXIS THAT CHANGES THE LIST. Built from the same
axes \`filterHref\` uses, in the same order, so the canonical of a page is
byte-identical to the link that reaches it.`,
  ],
  "app/routes/blog._index.tsx#11": [
    "CONTRACT",
    "the condition is the whole care in the block",
    `A TAG-ONLY FILTER CANONICALISES TO THE ARCHIVE, and ONLY when the tag is the
only filter: \`?tag=x&year=2026\` is a DIFFERENT list, so naming the archive would
point a crawler at a page whose content it does not share.`,
  ],
  "app/routes/blog._index.tsx#12": [
    "CONTRACT",
    "the one-builder rule; the drift and the feed move go to the history document",
    `\`pageMeta\` owns the social set. The two feed alternates moved to root's
\`links\`, which are merged onto every route, so nothing about this page is local
any more.`,
  ],
  "app/routes/blog._index.tsx#13": [
    "CONTRACT",
    "header: the AND property and the page-drop rule; the destroyed-axis defect goes to the history document",
    `EVERY link on this page, from one builder. The loader ANDs tag and year, so a
reader can be in both at once and a chip that knew only its own axis silently
destroyed the other. An override of \`null\` clears one axis.

Page is dropped on any filter change: page 3 of one filter is not page 3 of
another, and carrying it would land a reader on an empty list their own click
created.`,
  ],
  "app/routes/blog._index.tsx#14": [
    "CONTRACT",
    "keeps the no-wrapper refusal and the scope; the harmlessness argument goes to the history document",
    `THE h-feed IS THE \`<main>\` ITSELF, a deliberate refusal to add a wrapper: the
feed has to contain both the featured section and the list, and those are
siblings.

NOT ON THE TAG ARCHIVE OR THE SERIES PAGE: a filtered view is not this blog's
feed.`,
  ],
  "app/routes/blog._index.tsx#15": [
    "CONTRACT",
    "the measured correction is the point",
    `MEASURED, because the first version of this comment guessed and was wrong.
Implied properties are skipped for a root containing nested microformats, so the
class is not preventing a bad name, it is supplying the only one.`,
  ],
  "app/routes/blog._index.tsx#16": [
    "CONTRACT",
    "one engine, and the no-script property",
    `Blog-scoped search is site search with type pinned, not a second engine: the
same index, parser and ranking serve both. A \`<Form method="get">\` emits the
same markup and URL as a plain form, so it works with scripting off.`,
  ],
  "app/routes/blog._index.tsx#17": ["CONTRACT", "already at size"],
  "app/routes/blog._index.tsx#18": ["CONTRACT", "already at size"],
  "app/routes/blog._index.tsx#19": [
    "CONTRACT",
    "keeps why the feed is the main and the hidden date; the one-shape argument goes to the history document",
    `THE FEATURED POST IS AN ENTRY IN THE FEED, which is why the feed is the
\`<main>\`: \`splitFeatured\` removes it from the list, so a feed scoped to the
\`<ul>\` would silently omit the post the page pushes hardest.

\`dt-published\` IS HIDDEN HERE because this section renders no date and never
has; showing one would change the page.`,
  ],
  "app/routes/blog._index.tsx#20": [
    "CONTRACT",
    "why the bundle is absent and what asserts it; the byte count goes to the history document",
    `NO BlogEnhancements HERE. Every one of that bundle's enhancements targets
markup the post pipeline renders inside \`.prose\`, and this page has none of it.
\`check:browser\` asserts on the resource timeline that it is not fetched here,
which is the half a source reading cannot give you.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#0": [
    "CONTRACT",
    "why a handle and not a loader field",
    `THE MATH STYLESHEET, ALWAYS. A handle rather than a loader field, because the
flag every other reader uses is a property of what has been SAVED and an author
is typing something that has not been.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#1": [
    "WHY",
    "why the marks were added without reordering; the date goes to the history document",
    `FIVE of this loader's awaits sit inside the RETURNED OBJECT LITERAL, which
evaluates its properties in order, so they run SERIALLY. The marks are added
WITHOUT reordering anything, so the measurement describes what shipped rather
than what a fix would produce.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#2": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.edit.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.edit.tsx#4": [
    "CONTRACT",
    "the hydration boundary",
    `Derived HERE because \`stateOf\` reads the clock, and a component that
recomputed it would render one word on the server and hydrate a different one for
a post scheduled seconds away.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#5": [
    "CONTRACT",
    "the empty array is the mechanism; the non-fatal stance stays",
    `THE EMPTY ARRAY IS A DECISION on a post that is not a draft: it stops the
section rendering at all, which is how "a published post offers NEITHER intent"
is held. Non-fatal: a KV outage costs the drawer a list, not the editor.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#6": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.edit.tsx#7": [
    "CONTRACT",
    "the one fact the table needs",
    `The one fact the transition table needs that current state cannot give: a draft
is either brand new or previously withdrawn, and only \`first_published\` in the
committed file tells them apart.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#8": [
    "WHY",
    "why the vocabulary is offered",
    `Whatever is already in use on the site, so tagging tends toward the existing
vocabulary instead of inventing a near-duplicate.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#9": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.edit.tsx#10": [
    "CONTRACT",
    "keeps ruling 1 holding by route shape and the non-fatal stance",
    `LOADER work, deliberately: reading history is a read, so it adds no form and no
submission. Ruling 1's "restore loads, it does not write" holds by the SHAPE of
the routes rather than by anything this page promises. Non-fatal: a GitHub outage
must not blank the editor.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#11": [
    "CONTRACT",
    "why these two are not in the shared path",
    `Handled here rather than in \`handleEditorAction\`, the SHARED save path: both
are edit-only, so putting them there would put two intents on the new-post route
that it can never legally use. Neither writes to GitHub, D1 or the artifact.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#12": [
    "CONTRACT",
    "why every arm has one shape",
    `Stated rather than omitted so every problem this route can return has one
shape: an optional property on one arm is how the component's read stops
compiling.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#13": [
    "WHY",
    "the server-side prohibition and the authority",
    `THE DRAFT CHECK IS SERVER SIDE, and it is not redundant with the UI: this is
reachable by anyone holding the admin session and a curl command, and minting a
capability must not trust the absence of a button. The COMMITTED FILE is the
authority, because the form is the author's unsaved draft.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#14": [
    "WHY",
    "why the asymmetry is deliberate",
    `REVOKE IS NOT DRAFT-GATED. Creating mints something; taking one away is a
delete, idempotent, and refusing it would strand a row a concurrent publish had
already emptied. The one operation that must never be blocked by a stale page is
the one that removes access.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#15": [
    "WHY",
    "keeps the no-script prohibition and the consent distinction; the three-spellings note goes to the history document",
    `**THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.** With
scripting off the handler never ran and the file went with no confirmation at
all. \`expectedHeadSha\` is CONCURRENCY, NOT CONSENT: it stops a stale page
overwriting a newer one and says nothing about whether a human meant to delete.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#16": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.edit.tsx#17": [
    "WHY",
    "why the save lands here",
    `Back to this page rather than the post list: a save that landed on the list had
nothing to say, which is how a first publication completed in silence.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#18": [
    "CONTRACT",
    "why the narrowing is by kind",
    `Narrowed by KIND rather than by \`"fields" in actionData\`: the \`in\` form
stopped narrowing once the action grew arms that carry no fields at all.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#19": [
    "CONTRACT",
    "why the third arm carries fields",
    `An unconfirmed first publication is not a failure, but it re-renders the editor
around the author's submitted body: the confirming submit is this same form
posting again, so what it posts has to be what they typed.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#20": [
    "CONTRACT",
    "what persistent means here",
    `Persistent until the NEXT action: a failure replaces the message and a preview
clears it, because by then the URL is describing a save two steps ago.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#21": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.edit.tsx#22": [
    "CONTRACT",
    "the transition describes what is committed",
    `A failed save hands back the fields the author submitted, and those can
disagree with the loader's. The transition must describe what is COMMITTED, so it
stays the loader's.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#23": [
    "CONTRACT",
    "the structural holding, and why the state is the loader's",
    `THE SECTION EXISTS ONLY FOR A DRAFT, and \`undefined\` is how that is said: the
ruling held structurally rather than by a disabled button, which sends nothing
but still looks like an offer. The state is the LOADER'S, so an unsaved edit
cannot conjure the section.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#24": [
    "CONTRACT",
    "the nesting prohibition",
    `Associated by the \`form\` attribute rather than by containment: nested forms
are not valid HTML and the browser drops the inner one.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#25": [
    "CONTRACT",
    "the no-script path",
    `THE SERVER-RENDERED CONFIRMATION STEP, reached when the action refused an
unconfirmed delete. That is the no-script path, and it is an ordinary form so no
script participates in satisfying it either.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#26": [
    "CONTRACT",
    "earlier feedback, not the gate",
    `EARLIER FEEDBACK, NOT THE GATE. The action checks the same thing server-side,
because this handler does not run for a reader without JavaScript and the delete
did.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#27": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.edit.tsx#28": [
    "CONTRACT",
    "keeps the nesting reason and the fixture argument",
    `Outside the editing form because the drawer is a \`<dialog>\` nested inside it
and a form inside a form is dropped.

ONE REVOKE FORM PER LINK, each carrying its own token as a hidden field: a
\`name="token"\` on every button would put the token into the submission tuple, so
the fixture would describe the data rather than the request surface.`,
  ],
  "app/routes/admin.posts.$slug.edit.tsx#29": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#0": [
    "CONTRACT",
    "header: why abstracts stay in the file and out of the page",
    `The data file is also the source for the CV, which does list conference
abstracts, so those records stay in the file and are excluded here rather than
deleted. An abstract is the meeting version of a paper already listed.`,
  ],
  "app/routes/publications.tsx#1": [
    "CONTRACT",
    "header: why the descriptions are written",
    `Descriptions are written, not templated. A generated line like "Publications in
{topic}" is the same thin metadata with a variable in it, so each sentence
describes the actual work and the four pages differ in content rather than in a
number.`,
  ],
  "app/routes/publications.tsx#2": [
    "CONTRACT",
    "header: the comparison-time rule",
    `Applied to both sides of every comparison. Nobody types an em dash into a
search box but Crossref titles carry them. The stored strings are never
rewritten; this is comparison-time only.`,
  ],
  "app/routes/publications.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#4": [
    "CONTRACT",
    "header: why the haystack is decoded",
    `DECODED FIRST, so the haystack is the text on the page rather than the text in
the file: the one place a reader would copy a journal name from is the page,
where it renders with the ampersand. Abstract is deliberately not included.`,
  ],
  "app/routes/publications.tsx#5": [
    "CONTRACT",
    "header: what noindex means now, and the one-builder rule; the archived period goes to the history document",
    `\`noindex\` means an EMPTY RESULT SET. A query matching nothing is a real URL
with no content on it, and that is worth keeping out of an index.

\`pageMeta\` RATHER THAN A HAND-BUILT ARRAY: it is the one place the card, the
canonical and the twitter tags are decided together, and a second list here would
be another copy of a set that has already drifted once.`,
  ],
  "app/routes/publications.tsx#6": [
    "CONTRACT",
    "header: what omitting the export would cost; the citation stays on one line",
    `A public HTML route that returns no headers is stamped \`private, no-store\` by
the gateway under hard rule 8, so omitting this would quietly make the most
static page on the site the only uncacheable one.`,
  ],
  "app/routes/publications.tsx#7": [
    "CONTRACT",
    "what an unrecognised value does",
    `Accepts "1" or "true", any casing. Any other value is absent rather than
truthy, so a stray \`?selected=banana\` shows the full list instead of an empty
page.`,
  ],
  "app/routes/publications.tsx#8": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#9": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#10": [
    "CONTRACT",
    "the canonical policy, compressed",
    `Exactly the four bare single-topic URLs self-canonical. Everything else
canonicals to the bare page: those views are re-orderings or subsets of the
index, not distinct content, and the URL space is unbounded because q is free
text.`,
  ],
  "app/routes/publications.tsx#11": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#12": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#13": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#14": [
    "WHY",
    "the one thing a canonical must never do",
    `A PATH rather than an absolute URL, because \`pageMeta\` builds the absolute
form from \`SITE_ORIGIN\`. Deriving it from \`url.origin\` is how a page ends up
declaring a preview host canonical, which is the one thing a canonical must never
do.`,
  ],
  "app/routes/publications.tsx#15": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#16": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#17": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#18": [
    "CONTRACT",
    "header: why the collapse always includes the owner",
    `Author order varies across the corpus, so a plain "first three" collapse would
hide his name on most of the page: when he falls outside the first three the
summary shows the first two, an ellipsis, then his entry. \`details\`, not a
button, so it expands without scripting.`,
  ],
  "app/routes/publications.tsx#19": [
    "CONTRACT",
    "why the flag is derived from the value",
    `The pulled name is READ ONCE, and \`pulled\` is derived from whether that read
produced anything: deriving the flag from the value collapses two statements of
one condition, so there is one read and no assertion.`,
  ],
  "app/routes/publications.tsx#20": ["CONTRACT", "already at size"],
  "app/routes/publications.tsx#21": [
    "WHY",
    "tagged by what STAYS; the before-state goes to the history document",
    `THE TITLE IS THE LINK TO THE PAPER'S OWN PAGE, so every row leads somewhere.`,
  ],
  "app/routes/publications.tsx#22": [
    "CONTRACT",
    "the zero rule and the provenance reason",
    `Only at 1 or more, so a zero is never rendered as though it were a real count.
A link rather than plain text because the work page carries the provenance a
title attribute cannot show on a touch device. The URL comes from the response,
never constructed.`,
  ],
  "app/routes/publications.tsx#23": [
    "CONTRACT",
    "keeps why a list page can carry this and the per-paper split; the ruling citation stays",
    `COinS, INDEX ONLY: Highwire \`citation_*\` tags describe the document they sit
in, and a page is one document, so 33 records cannot each have a
\`citation_title\`. This is what fills that gap. The per-paper pages carry the
citation tags instead, so it is deliberately not repeated there. Ruling 63.`,
  ],
  "app/routes/publications.tsx#24": [
    "CONTRACT",
    "what the id is for; the gate reference goes to the history document",
    `\`id="main"\` is root's unconditional skip-link target. Without it the skip link
moves focus nowhere.`,
  ],
  "app/routes/publications.tsx#25": ["CONTRACT", "already at size; carries the no-script rule"],
  "app/routes/publications.tsx#26": [
    "CONTRACT",
    "why the files are always the full list",
    `Always the FULL list regardless of the current filter: a citation file that
silently carried only what a chip happened to be showing would be a subset nobody
asked for.`,
  ],
  "app/routes/publications.tsx#27": [
    "WHY",
    "the injection prohibition and why this route is the highest risk",
    `\`jsonLd\`, NOT a bare \`JSON.stringify\`: a \`<script>\` element's contents are
raw text and the only thing that ends one is the literal \`</script\`. This route
is the highest-risk emitter on the site, because it is the only one whose strings
come from THIRD PARTY registries. \`check:policy\` refuses the bypass.`,
  ],
};
