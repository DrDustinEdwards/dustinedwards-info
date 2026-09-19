// Chunk 1: app/routes/admin.posts._index.tsx, blocks 0-81. The admin post list.
//
// The densest file in the wave and the one that set this wave's target. It is .tsx, so the
// weight is not the arcs wave 3 cut: it is ACCESSIBILITY AND NO-SCRIPT CONTRACTS, twenty-four
// blocks and 12,494 of this file's 35,935 comment bytes, against the 7,932 an under-20% file
// would allow. That is why the target is no longer a percentage.
//
// THE RULE, ruled 2026-09-19: every contract stays, each at 180 bytes or less, one why per
// block. Function and const headers take the calibration's ~370. Everything else goes to the
// history document: dates, run ids, measured milliseconds, defect stories, and any sentence
// describing what the JSX below plainly renders.
//
// Where a block carried several prohibitions, the LOAD-BEARING one stays and the rest go. Named
// so the loss is visible: #28 keeps republish-is-not-offered and loses the read-modify-write
// and no-confirmation clauses; #30 keeps the omitted sha and loses partial-failure; #49 keeps
// the scriptless tag facet and loses the no-Filter-button reasoning.
//
// LINES ARE WRAPPED AT 78 because `render` prefixes each with the block's own indentation and
// the checker refuses a rendered line over 110 columns. The deepest block here sits at 24.
export default {
  "app/routes/admin.posts._index.tsx#0": [
    "CONTRACT",
    "header: the derived state and why it is computed in the loader",
    `The pill's three states out of the two the database stores.

\`scheduled\` is DERIVED, not a column: a published row whose \`publish_at\` is
still ahead of now is live to the admin and invisible to the public, and the
test is the one \`publiclyVisible()\` runs. Derived in the LOADER because it
reads the clock.`,
  ],
  "app/routes/admin.posts._index.tsx#1": [
    "CONTRACT",
    "header: stated once, and what a mismatch costs",
    `The id tying a row's button to the form it submits, STATED ONCE. A browser
pairs them by string equality alone, so a mismatch submits the wrong form or
nothing, silently.`,
  ],
  "app/routes/admin.posts._index.tsx#2": ["CONTRACT", "already one line"],
  "app/routes/admin.posts._index.tsx#3": [
    "CONTRACT",
    "header: why the state is in the URL; the example names the failure",
    `The filter state, read from the URL and normalized. URL-driven is what makes
it work with scripting off and makes a filtered list a LINK. \`status\` is
validated, so \`?status=banana\` degrades to no filter rather than matching
nothing and looking like an empty corpus.`,
  ],
  "app/routes/admin.posts._index.tsx#4": [
    "WHY",
    "header: the rounding direction and the prohibition it protects",
    `Rounded UP: a post going live in 30 hours is "in 2 days" and never "in 1
day", because the author must not read a number that has already passed.`,
  ],
  "app/routes/admin.posts._index.tsx#5": [
    "WHY",
    "tagged by what STAYS; the date, the median and the misdirected fixes go to the history document",
    `Every await below is named. Unattributed time sent three earlier fixes to the
layout, which was the only thing marked.`,
  ],
  "app/routes/admin.posts._index.tsx#6": [
    "CONTRACT",
    "the independence and what it buys; the twelve samples go to the history document",
    `THREE INDEPENDENT READS, STARTED TOGETHER. None reads what the others write,
so the loader's floor is the SLOWEST of them and not their sum.`,
  ],
  "app/routes/admin.posts._index.tsx#7": [
    "WHY",
    "the prohibition: a rejection before the await is unhandled",
    `The catch is attached AT CREATION: a promise that rejects before anything
awaits it is an unhandled rejection, and starting work early creates that gap.`,
  ],
  "app/routes/admin.posts._index.tsx#8": [
    "CONTRACT",
    "why it joins the group and why it needs no catch",
    `A FOURTH INDEPENDENT READ, same group. \`fetchPostReadership\` never rejects,
it returns the error arm of \`SourceResult\`, so it needs no catch.`,
  ],
  "app/routes/admin.posts._index.tsx#9": [
    "CONTRACT",
    "the hydration boundary, which is why the number is computed here",
    `A NUMBER by the time the component sees it. Rendering from a date would read
the clock during render, and server and hydration would disagree near a day
boundary.`,
  ],
  "app/routes/admin.posts._index.tsx#10": ["WHY", "already at size"],
  "app/routes/admin.posts._index.tsx#11": [
    "WHY",
    "the prohibition on public routes awaiting the AI layer, and the one-listing rule",
    `This is an ADMIN page, so it may await the AI layer; NO PUBLIC ROUTE EVER
DOES. The status comes from the layout middleware's reader, so the nav badge and
this alert read one listing.`,
  ],
  "app/routes/admin.posts._index.tsx#12": [
    "WHY",
    "tagged by what STAYS; the measured variance range goes to the history document",
    `The UNCACHED Ask reader. The nav badge has a short-TTL KV cache precisely
because this call's per-call variance is wide.`,
  ],
  "app/routes/admin.posts._index.tsx#13": [
    "WHY",
    "why a DO read is a candidate; the diagnosis story goes to the history document",
    `Reads the ASK_BUDGET Durable Object: a network hop, and a cold object has to
be woken.`,
  ],
  "app/routes/admin.posts._index.tsx#14": ["CONTRACT", "already one line"],
  "app/routes/admin.posts._index.tsx#15": ["CONTRACT", "already one line"],
  "app/routes/admin.posts._index.tsx#16": [
    "CONTRACT",
    "the prohibition: the count must not follow the filter",
    `Counted over the WHOLE corpus, not the filtered view: what is scheduled is a
fact about the site and must not vanish because the author was searching.`,
  ],
  "app/routes/admin.posts._index.tsx#17": [
    "CONTRACT",
    "one array for count and list; the media library's defect goes to the history document",
    `THE TAB COUNTS, off the SAME array the list is drawn from, never a second
query: a count and a list drawn from two predicates disagree.`,
  ],
  "app/routes/admin.posts._index.tsx#18": ["CONTRACT", "already one line"],
  "app/routes/admin.posts._index.tsx#19": [
    "CONTRACT",
    "why the whole report travels; the ruling citation stays on one line",
    `The WHOLE report rather than a per-row number: only \`complete\` and the error
arm can tell a measured zero from an unasked question. Ruling 2.`,
  ],
  "app/routes/admin.posts._index.tsx#20": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#21": [
    "CONTRACT",
    "why the actor is required rather than defaulted",
    `WHO IS ASKING, read once for every branch. \`savePost\` and \`deletePost\`
require it rather than defaulting to the most privileged principal.`,
  ],
  "app/routes/admin.posts._index.tsx#22": ["WHY", "already at size; carries the independence prohibition"],
  "app/routes/admin.posts._index.tsx#23": [
    "WHY",
    "the destructive semantics and why the typed count is 1",
    `**CHECKED HERE.** "Sync" reads as additive and is not: \`pruneAskCorpus\`
DELETES every record this run did not upload. The typed count is 1 because how
many it removes cannot be known first.`,
  ],
  "app/routes/admin.posts._index.tsx#24": ["CONTRACT", "already one line"],
  "app/routes/admin.posts._index.tsx#25": [
    "CONTRACT",
    "header: the by-construction guarantee; section F and the title reasoning go to the history document",
    `DUPLICATE AS TEMPLATE. Reads the committed file, gives it a free slug, and
re-enters \`savePost\` as a NEW post: no second write path.

IT CANNOT BE A BACK DOOR TO A FIRST PUBLICATION: the copy is written with
\`draft: true\`, so \`decide()\` cannot classify it as \`published-first\`, and
\`forceFirstPublished\` removes the key rather than carrying it across.`,
  ],
  "app/routes/admin.posts._index.tsx#26": [
    "WHY",
    "the derived-store rule; the citation keeps the original spelling",
    `Probed against the repository, not the loader's D1 rows: D1 is a DERIVED store
(rule 18) and the file is what \`savePost\` will refuse on.`,
  ],
  "app/routes/admin.posts._index.tsx#27": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#28": [
    "CONTRACT",
    "keeps the load-bearing prohibition; read-modify-write and no-confirmation go to the history document",
    `UNPUBLISH FROM THE LIST. REPUBLISH IS NOT OFFERED: \`first_published\` is
frontmatter, not a D1 column, so a control here could not tell a
never-published draft from a withdrawn one.`,
  ],
  "app/routes/admin.posts._index.tsx#29": [
    "CONTRACT",
    "the committed file is the authority",
    `The COMMITTED file decides, not the row the page was rendered from: another
tab can describe a post already withdrawn.`,
  ],
  "app/routes/admin.posts._index.tsx#30": [
    "CONTRACT",
    "keeps the omitted sha; partial failure and the file-and-line citations go to the history document",
    `Each ITERATES the per-post writer, one commit each, so every gate guarding one
post guards all. \`expectedHeadSha\` is OMITTED because each commit advances
head.`,
  ],
  "app/routes/admin.posts._index.tsx#31": ["CONTRACT", "already one line"],
  "app/routes/admin.posts._index.tsx#32": [
    "WHY",
    "the no-script prohibition and the rule that follows it; the sibling-defect story goes to the history document",
    `**THE LADDER IS ENFORCED HERE, NOT ONLY IN THE UI**: with scripting off an
\`onClick\` ceremony never runs. An unconfirmed delete is the CONFIRMATION STEP,
not an error.`,
  ],
  "app/routes/admin.posts._index.tsx#33": [
    "CONTRACT",
    "the blast-radius statement",
    `Retag ADDS or REMOVES one tag, never replaces the set, so a mistake costs one
tag rather than all.`,
  ],
  "app/routes/admin.posts._index.tsx#34": [
    "WHY",
    "why a no-op is skipped rather than committed",
    `A no-op post is SKIPPED: writing it would cost a commit that changes nothing
and rewrite frontmatter whose key order is not yet canonical.`,
  ],
  "app/routes/admin.posts._index.tsx#35": [
    "CONTRACT",
    "header: why tabs and what All is",
    `The status facet, FIXED and therefore tabs rather than a select. "All" is the
ABSENCE of the parameter, so the unfiltered list and the All tab are one URL by
construction.`,
  ],
  "app/routes/admin.posts._index.tsx#36": [
    "CONTRACT",
    "header: what the prop is for and the gate that needs it",
    `The selection this page starts with. Empty in production, always: React Router
passes only loaderData, actionData, params and matches.

It exists for \`check:admin-ui\`, which renders one static pass and dispatches no
event: without it the bulk bar never mounts under the harness and the three bulk
intents contribute no payload.`,
  ],
  "app/routes/admin.posts._index.tsx#37": [
    "CONTRACT",
    "the fixture contract",
    `Defaulted like \`readership\`: \`check:admin-ui\` renders against fabricated
loader data, and a fixture written before this field existed must render zeros.`,
  ],
  "app/routes/admin.posts._index.tsx#38": [
    "CONTRACT",
    "header: the three-outcome prohibition",
    `Origin requests for one post's public route, or the reason there is none.

THREE OUTCOMES, NOT INTERCHANGEABLE: a number, a measured zero, or an absence
with a sentence. Where the source cannot answer the number is ABSENT and the
panel says why, never a zero and never a dash a reader could read as one.`,
  ],
  "app/routes/admin.posts._index.tsx#39": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#40": [
    "CONTRACT",
    "the pending contract; the contrast with /admin/media goes to the history document",
    `PENDING STATE. Every control here changes which rows come back, so every
navigation gets the mark: one dimmed attribute plus \`aria-busy\`. No spinner.`,
  ],
  "app/routes/admin.posts._index.tsx#41": [
    "CONTRACT",
    "the hard rule 9 exemption and the keying prohibition",
    `Selection lives in the client, which hard rule 9 exempts for the admin plane.
Keyed by slug, not row index, so a re-render or filter change cannot re-point it
at a different post.`,
  ],
  "app/routes/admin.posts._index.tsx#42": [
    "WHY",
    "the defect the parameter carry closed, stated as the rule",
    `Cancel carries the filter the operator was looking at: a bare \`/admin/posts\`
drops it and loses the view they were working in.`,
  ],
  "app/routes/admin.posts._index.tsx#43": [
    "CONTRACT",
    "the hydration boundary, which is the whole point of the flag",
    `Initialised false so the hydration render matches the server's. The bulk bar's
count is meaningless without script.`,
  ],
  "app/routes/admin.posts._index.tsx#44": ["CONTRACT", "already one line"],
  "app/routes/admin.posts._index.tsx#45": [
    "CONTRACT",
    "the agreement rule; the drifted wording goes to the history document",
    `THE ONE STATUS SENTENCE, and it AGREES WITH THE NOTICE below it: that is
about the page, this is about the site right now.`,
  ],
  "app/routes/admin.posts._index.tsx#46": [
    "CONTRACT",
    "why the create action is separated",
    `New post is the only thing here that CREATES; the other three repair, so they
sit behind the overflow rather than wearing the primary action's weight.`,
  ],
  "app/routes/admin.posts._index.tsx#47": [
    "WHY",
    "why the duplicate exists: the alert does not render when clean",
    `Kept here as well as in the drift alert: the alert does not render when the
index is clean, and an intent that exists only while needed cannot be run
pre-emptively.`,
  ],
  "app/routes/admin.posts._index.tsx#48": [
    "CONTRACT",
    "the no-script contract; the fixture-regeneration note goes to the history document",
    `A GET form: the filter state lives in the URL, so it survives a reload, is
linkable, is what the back button restores, and works with scripting off.`,
  ],
  "app/routes/admin.posts._index.tsx#49": [
    "CONTRACT",
    "keeps the scriptless tag facet; the no-Filter-button reasoning goes to the history document",
    `TABS because status is a FIXED vocabulary of four; tag stays a select, its
vocabulary being whatever the corpus holds. The hidden submit keeps the tag
facet usable with scripting off.`,
  ],
  "app/routes/admin.posts._index.tsx#50": [
    "CONTRACT",
    "the link and aria contract",
    `Links, so the filtered view is a URL that survives a reload and needs no
script. \`aria-current\` announces which one is on.`,
  ],
  "app/routes/admin.posts._index.tsx#51": [
    "CONTRACT",
    "why zero renders and why it is announced as words",
    `A count of ZERO renders: hiding it would make an empty facet look like a
missing one. Announced as words, because a bare numeral reads as a position.`,
  ],
  "app/routes/admin.posts._index.tsx#52": ["CONTRACT", "already at size; carries the no-script statement"],
  "app/routes/admin.posts._index.tsx#53": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#54": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#55": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#56": [
    "CONTRACT",
    "the no-script path is the reason this step exists",
    `THE SERVER-RENDERED CONFIRMATION STEP, which is the no-script path. It
re-carries each slug as a hidden field, and no script participates at any point.`,
  ],
  "app/routes/admin.posts._index.tsx#57": [
    "CONTRACT",
    "same shape, one line",
    `THE SYNC-ASK CONFIRMATION, same shape: the action refuses an unconfirmed run
and returns what is at stake, so the no-script path reaches it too.`,
  ],
  "app/routes/admin.posts._index.tsx#58": [
    "WHY",
    "the disabled-submitter prohibition",
    `THE INTENT IS A FIELD, not the submitter's value: a disabled submitter sends
neither its name nor its value.`,
  ],
  "app/routes/admin.posts._index.tsx#59": [
    "WHY",
    "why there is nowhere else to report it",
    `Surfaced here because a save may succeed when the Ask sync behind it fails and
then redirects, so there is nowhere else to report it.`,
  ],
  "app/routes/admin.posts._index.tsx#60": [
    "CONTRACT",
    "the live-region prohibition",
    `A STANDING CONDITION, so a named region and never a live one: announcing it as
news on every visit would interrupt a reader who came to do something else.`,
  ],
  "app/routes/admin.posts._index.tsx#61": [
    "CONTRACT",
    "the two-nothings prohibition",
    `Two different nothings, and they must not read the same. An empty corpus is a
state of the site; an empty RESULT is a state of the question just asked.`,
  ],
  "app/routes/admin.posts._index.tsx#62": [
    "CONTRACT",
    "the nesting prohibition, which is why the form sits here",
    `One Form around the bar AND the table, so the checkboxes are its own controls:
a form cannot nest inside another.`,
  ],
  "app/routes/admin.posts._index.tsx#63": [
    "WHY",
    "the no-script defect and its repair; the measurement date goes to the history document",
    `ALWAYS IN THE DOCUMENT, revealed by CSS: on CLIENT state a scriptless operator
could tick every box with no control to act on. \`:has()\` asks the browser about
its own checkboxes.`,
  ],
  "app/routes/admin.posts._index.tsx#64": [
    "CONTRACT",
    "why the count is absent rather than wrong",
    `THE COUNT IS SCRIPT-ONLY and says so by not appearing: a bar reading
"0 selected" above two ticked boxes is worse than one claiming no number.`,
  ],
  "app/routes/admin.posts._index.tsx#65": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#66": [
    "CONTRACT",
    "the keyboard contract; the 582px coincidence goes to the history document",
    `\`tabindex\` and the region role are what make a scrollable box usable rather
than merely contained: without them a keyboard reader sees the clipped columns
and cannot reach them.`,
  ],
  "app/routes/admin.posts._index.tsx#67": [
    "CONTRACT",
    "the one-owner rule and the SSR prohibition; the caption reasoning goes to the history document",
    `\`CACHE_SENTENCE\` itself, not a paraphrase: that would be a second copy of a
measured claim. Rule 17. ONE STRING, because React SSR splices comment nodes
between adjacent text.`,
  ],
  "app/routes/admin.posts._index.tsx#68": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#69": [
    "CONTRACT",
    "the gated copy law, which forbids four words",
    `THE LABEL IS "Reads counted". check-admin-ui.mjs forbids "views", "visits",
"visitors" and "traffic" here: a cached read never reaches the Worker.`,
  ],
  "app/routes/admin.posts._index.tsx#70": [
    "CONTRACT",
    "the forced-colors contract; the placement ruling goes to the history document",
    `The state is a WORD first. Colour and border-style separate the three again,
so the pill still says three things once forced-colors takes the fill away.`,
  ],
  "app/routes/admin.posts._index.tsx#71": [
    "CONTRACT",
    "the forced-colors and screen-reader prohibition",
    `THE HERO, MARKED WITH A WORD: a mark carried only by colour or an icon says
nothing under forced-colors and nothing to a screen reader.`,
  ],
  "app/routes/admin.posts._index.tsx#72": [
    "CONTRACT",
    "the no-clock-in-render contract",
    `The number arrived from the loader already computed, so nothing here reads the
clock.`,
  ],
  "app/routes/admin.posts._index.tsx#73": [
    "CONTRACT",
    "the three outcomes, short form",
    `A number, a measured zero, or an absence carrying its own sentence: never a
bare dash, which reads as zero.`,
  ],
  "app/routes/admin.posts._index.tsx#74": [
    "CONTRACT",
    "the tooltip prohibition, which is an accessibility statement",
    `The reason is the content, not a tooltip: a \`title\` is invisible to touch and
to a screen reader that does not announce it.`,
  ],
  "app/routes/admin.posts._index.tsx#75": [
    "CONTRACT",
    "the form-attribute contract; the fifty-odd-controls story goes to the history document",
    `Associated by the \`form\` ATTRIBUTE because this cell sits inside the bulk
selection form and forms cannot nest; the row forms sit below the table.`,
  ],
  "app/routes/admin.posts._index.tsx#76": [
    "WHY",
    "the first-publication prohibition",
    `Only where it is a real transition: a never-published draft must not be
offered anything that changes public state here. First publication lives in the
editor.`,
  ],
  "app/routes/admin.posts._index.tsx#77": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#78": [
    "CONTRACT",
    "the nesting and submitter prohibitions; the no-confirmation clause goes to the history document",
    `OUTSIDE the bulk form: forms cannot nest. THE SLUG IS A FIELD, not the
button's value: \`check:admin-ui\` reads a submitter as the intent, so the tuple
set would grow per post.`,
  ],
  "app/routes/admin.posts._index.tsx#79": [
    "CONTRACT",
    "the screen-reader reason the caption became a disclosure",
    `A DISCLOSURE rather than a \`<caption>\`, which a screen reader announces before
every row.`,
  ],
  "app/routes/admin.posts._index.tsx#80": ["CONTRACT", "already at size"],
  "app/routes/admin.posts._index.tsx#81": ["CONTRACT", "already one line"],
};
