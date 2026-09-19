// Chunk 10: fifteen small files, 91 blocks.
//
// Same rule: contracts at 180 bytes or less, headers at ~370. Blocks already at size are
// explicit two-element keeps.
//
// ONE HEADER IS OVER, site-speculation #0, and it is named so the exception is visible. It
// carries three things no other comment does: the browser's own asymmetry between
// `speculationrules` and `ld+json` under `script-src` (measured, and the reason a nonce here is
// not an inconsistency to tidy away), what a speculation costs a cookie-carrying reader, and a
// standing instruction to a future gate author that Chrome refuses to prerender while CDP is
// attached, so an activation assertion will pass vacuously or fail forever.
//
// confirm-dialog #0 and media-confirm #0 and #4 are the destructive-ceremony pair: the server
// is the authority, the disabled button is earlier feedback, and the button is rendered ENABLED
// on the server or a scriptless reader could never confirm at all.
export default {
  "app/components/admin/publish-actions.tsx#0": [
    "CONTRACT",
    "header: the transition rides in the submitter; the checkbox era goes to the history document",
    `The publish state machine, as controls. The primary button names the
transition rather than stating a field.

EVERY BUTTON CARRIES ITS OWN TRANSITION. Each control submits
\`intent=<transition id>\` and the server reads the draft flag off that intent, so
nothing is flipped, nothing is armed, and no handler has to run for the request
to say what the author asked for.

That the transitions map correctly is asserted by \`check:admin-ui\` against
\`publish-transition.mjs\`: the intent is in the markup, so the gate reads it off
the rendered page rather than taking a click handler on trust.`,
  ],
  "app/components/admin/publish-actions.tsx#1": [
    "CONTRACT",
    "the real-submit shape and the race it makes harmless",
    `A REAL SUBMIT that a script INTERCEPTS. It was \`type="button"\`, so with
scripting off there was no path to a first publication at all. Unscripted, the
request reaches the server as a plain \`publish\`, which is the ASK rather than
the answer. The ceremony was never the dialog: it is \`savePost\` refusing an
unconfirmed first publication, so a click landing before hydration still cannot
publish.`,
  ],
  "app/components/admin/publish-actions.tsx#2": [
    "CONTRACT",
    "why the dialog is conditional, and what an unconditional one would submit",
    `RENDERED ONLY WHERE IT CAN BE OPENED. An unconditional dialog would leave two
submits nothing can reach, and they would not be harmless: the reschedule arm
sends the in-place save, which on a draft means \`draft:false\`, so the page would
carry a publication nobody can see and the fixture would record it.`,
  ],
  "app/components/admin/publish-actions.tsx#3": [
    "CONTRACT",
    "header: why containment still holds, and why the submitter carries the intent",
    `A \`<dialog>\` for the platform focus trap. It sits INSIDE the editing form and
\`showModal()\` moves an element to the top layer visually without moving it in
the DOM, so form association by containment still holds.

BOTH SEND THE CONFIRMED INTENT. A closed \`<dialog>\` still submits the fields it
contains, so a confirmation in a hidden input would have to be armed on click;
the submitter is the only part of a form that means "this is the control that
was pressed".

The RESCHEDULE arm sends the ordinary in-place save: a post already public is
not publishing for the first time.`,
  ],
  "app/routes/blog.tags.$tag.tsx#0": [
    "CONTRACT",
    "header: why both sheets, and what a payload gate cannot see",
    `BOTH SHEETS THE SHARED CARD NEEDS. \`PostCard\` renders \`.post-card-series\`,
defined ONLY in blog-index-extras.css, so importing blog-index.css alone left
that element unstyled on this page and on no other. Nothing in a payload gate
can see it, because the weight was merely lower.`,
  ],
  "app/routes/blog.tags.$tag.tsx#1": [
    "CONTRACT",
    "header: the 404 rule and the one-list rule; the missing-page history goes to the history document",
    `The archive for one tag.

404 RATHER THAN AN EMPTY PAGE. \`getBlogTag\` composes the same predicate the
chip list does, so a tag carried only by drafts does not exist here. Rendering an
empty archive would be a soft 404, and it would leak the existence of a tag only
a draft carries.

THE LIST IS THE INDEX'S LIST, the same call \`/blog?tag=\` makes, so the archive
and the filtered view cannot disagree.`,
  ],
  "app/routes/blog.tags.$tag.tsx#2": [
    "CONTRACT",
    "why the order matters",
    `THE TAG IS RESOLVED BEFORE THE LIST IS READ: asking the list first would make
the 404 decision from a zero-length array, which cannot tell "no such tag" from
"every post using it was unpublished".`,
  ],
  "app/routes/blog.tags.$tag.tsx#3": [
    "CONTRACT",
    "inherited rather than re-argued",
    `OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE, which is \`/blog\`'s ruling and is
inherited rather than re-argued. 302, because the bound moves as posts are
published.`,
  ],
  "app/routes/blog.tags.$tag.tsx#4": [
    "CONTRACT",
    "why the helper, and why not the Accept vary",
    `Through the helper that OWNS the pair, which is stricter than copying two
constants: the helper is the one owner, so this page cannot drift.

NOT \`HTML_VARY_ACCEPT\`: the post page and the index negotiate a twin
representation on \`Accept\` and this page has none.`,
  ],
  "app/routes/blog.tags.$tag.tsx#5": [
    "CONTRACT",
    "the complete-set rule and the page axis",
    `THE SAME BUILDER THE OTHER PAGES USE, so this page cannot ship the partial set
five pages shipped before it existed: all or none. The canonical carries
\`?page=\` when there is one, because page two is different posts.`,
  ],
  "app/routes/blog.tags.$tag.tsx#6": [
    "CONTRACT",
    "why the per-tag feeds exist",
    `A reader who filters to a subject is exactly the reader who wants only that
subject in their reader, and until these existed the only feed on offer was
everything.`,
  ],
  "app/components/site-speculation.tsx#0": [
    "CONTRACT",
    "header, kept long: the browser's asymmetry, the credentialed cost, and a standing instruction to a future gate author",
    `Speculation Rules for the whole public plane, on every public page. It rides in
\`SiteHeader\`, so its scope is exactly "wherever the header is" and never the
admin plane.

THE PAYLOAD IS BUILT BY \`~/lib/speculation.mjs\`, the one owner of the rule shape
and the exclusions. This file owns only the two things a module cannot: the
nonce and the location.

IT CARRIES A CSP NONCE. \`script-src\` gates \`type="speculationrules"\` and does
NOT gate \`type="application/ld+json"\`. Both are non-executable data blocks, so
the expectation is that either both are gated or neither is; the browser
disagrees. Do not "consistently" add a nonce to the JSON-LD or remove this one.
Under an ENFORCED policy an un-nonced block is refused SILENTLY.

WHAT A SPECULATION COSTS A COOKIE-CARRYING READER: a real, CREDENTIALED request.
It carries the reader's \`Cookie\`, so it resolves the same theme the click will
and warms the same entry, which is what makes it a warm-up rather than a
duplicate render.

WHAT NO AUTOMATED GATE CAN SEE HERE: Chrome refuses to prerender while CDP is
attached, and falls back to prefetch. \`check:browser\` can assert the rules are
present, well-formed, accepted and which ACTION they name; it cannot assert what
the browser did on activation. Do not write that assertion; it will pass
vacuously or fail forever.`,
  ],
  "app/components/admin/media-document-card.tsx#0": ["CONTRACT", "already at size"],
  "app/components/admin/media-document-card.tsx#1": [
    "CONTRACT",
    "header: why the key and not the mime, and why the name differs from its neighbour",
    `Read from the KEY rather than the mime type, because the key is what the reader
sees everywhere else and a mime type disagreeing with a filename is a
distinction nobody wants explained on a tile.

NOT \`classify.mjs\`'s \`extensionOf\`, which takes a string, returns lowercase, and
returns the empty string that \`classify()\` depends on to THROW. Two functions,
one name, different inputs and outputs is a vacuity machine; they are not merged
because the difference is real.`,
  ],
  "app/components/admin/media-document-card.tsx#2": [
    "CONTRACT",
    "keeps the no-invented-fact rule and what the gate holds; the mockup comparison goes to the history document",
    `WHAT A DOCUMENT TILE SHOWS INSTEAD OF A PICTURE: an extension label, the TITLE
in words, a suggestion of text.

THERE IS NO BOTTOM LINE, BECAUSE THE FACT IT WOULD CARRY DOES NOT EXIST. Nothing
stores a page count, and getting one would mean fetching the object out of R2 per
render. The size was tried there and was worse: the body's meta line already
prints it, and a fact repeated reads as a bug. \`check:admin-ui\` holds both
halves: no invented page count, and the size stated exactly ONCE per tile.

THE RULED LINES ARE DECORATION and are marked so.`,
  ],
  "app/components/admin/media-document-card.tsx#3": ["CONTRACT", "already at size; carries the decoration rule"],
  "app/components/admin/confirm-dialog.tsx#0": [
    "CONTRACT",
    "header, kept long: four prohibitions on the one destructive ceremony",
    `THE ONE DESTRUCTIVE CONFIRMATION. A real \`<dialog>\` opened with \`showModal()\`,
with an inline fallback for a reader without script.

IT IS RENDERED BECAUSE THE ACTION REFUSED, not because a handler ran. An
unconfirmed destructive POST is the confirmation step, so the ceremony is
reachable on the no-script path by construction. \`window.confirm\` and
\`window.prompt\` are not confirmations; they are script-only ceremony in front of
destruction that is not.

WHY \`data-inline\` AND NOT \`open\`: a \`<dialog>\` with no \`open\` is
\`display: none\`, and putting \`open\` in the JSX makes React and \`showModal()\`
fight over the attribute. \`data-inline\` is a hook this component owns and the UA
has no opinion about.

THE DISABLED BUTTON IS FEEDBACK. THE ACTION IS THE GATE. It renders ENABLED on
the server, because \`typed\` would never become anything without script.

THE INTENT IS A HIDDEN FIELD, NEVER THE SUBMITTER'S VALUE: a disabled submitter
contributes NO name and NO value.`,
  ],
  "app/components/admin/confirm-dialog.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/confirm-dialog.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/confirm-dialog.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/confirm-dialog.tsx#4": ["CONTRACT", "already at size"],
  "app/components/admin/confirm-dialog.tsx#5": ["CONTRACT", "already at size"],
  "app/components/admin/confirm-dialog.tsx#6": ["CONTRACT", "already at size"],
  "app/components/admin/confirm-dialog.tsx#7": [
    "CONTRACT",
    "why autoFocus is not enough",
    `\`autoFocus\` is not enough: React applies it on mount rather than emitting the
attribute, and the dialog's own focus rules run when \`showModal\` is called,
which is here.`,
  ],
  "app/components/admin/confirm-dialog.tsx#8": [
    "CONTRACT",
    "the one-wire-name rule",
    `NAMED FROM THE CONSTANT, because the action reads the same one: a literal here
and a \`CONFIRM_FIELD\` there is two spellings of one wire name, and a rename
would split them silently.`,
  ],
  "app/components/admin/media-drawer.tsx#0": [
    "CONTRACT",
    "header: the three things HTML cannot express, and why focus return is derived",
    `THE DRAWER'S KEYBOARD CONTRACT: Escape closes it, Tab stays inside it, and
focus goes back to the tile that opened it.

THE PANEL ITSELF NEEDS NO SCRIPT: it is server-rendered whenever \`?key=\` is
present, the scrim is a real link, and every control is a form. This component
adds the three things a modal surface owes that HTML cannot express.

FOCUS RETURN IS DERIVED, not stored. Opening this drawer IS a navigation, so a
remembered \`activeElement\` may be a different node; the drawer knows which key
it shows and every tile carries \`data-tile\`. That also works when the drawer was
opened from the URL, where there is no trigger to remember.`,
  ],
  "app/components/admin/media-drawer.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/media-drawer.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/media-drawer.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/media-drawer.tsx#4": [
    "CONTRACT",
    "why focus lands on the panel",
    `FOCUS MOVES IN ON OPEN, and to the panel rather than its first control:
focusing Close makes a screen reader announce "Close" as the whole of what just
happened, where the panel carries the dialog role and its label.`,
  ],
  "app/components/admin/media-drawer.tsx#5": [
    "CONTRACT",
    "why the return is deferred twice",
    `Deferred twice: once for React to commit, once for layout to settle, because a
tile inside a scroller is not focusable until it has a box.`,
  ],
  "app/components/admin/media-drawer.tsx#6": [
    "CONTRACT",
    "the fallback and why it beats the alternative",
    `The tile may not be on this page: the drawer is reachable by URL and the row it
names can be on any page or none. Falling back to the previously focused element
beats collapsing focus to \`<body>\`.`,
  ],
  "app/components/admin/media-drawer.tsx#7": [
    "CONTRACT",
    "why the event stops here",
    `STOP HERE. Escape inside the drawer means close the drawer, and nothing else
may also act on it, or one press would close the drawer AND clear the selection
behind it.`,
  ],
  "app/components/admin/media-drawer.tsx#8": ["CONTRACT", "already at size"],
  "app/components/admin/media-drawer.tsx#9": ["CONTRACT", "already at size"],
  "app/components/admin/media-drawer.tsx#10": ["CONTRACT", "already at size"],
  "app/components/theme-toggle.tsx#0": [
    "CONTRACT",
    "header: why two buttons ship, the icon/name split and the no-aria-pressed rule; the ruling date goes to the history document",
    `ONE theme button. It switches between the two themes; the default is what a
reader gets until they touch it.

WHY TWO BUTTONS SHIP AND ONE IS EVER SEEN: the control must name the theme it
will switch TO, and with no cookie the server cannot know what the reader is
seeing. So both are rendered and CSS displays exactly one, picked by
\`data-theme\` or by \`prefers-color-scheme\`. None of it needs script, and the
scripted path is then trivial: set or remove the attribute and the control
follows by cascade.

THE ICON IS THE THEME IN EFFECT, THE NAME IS THE ACTION. They pull in opposite
directions on purpose: the icon is state, the accessible name is the outcome.

No \`aria-pressed\`: this is not a control with an on and an off, it performs an
action and the label says which.`,
  ],
  "app/components/theme-toggle.tsx#1": [
    "CONTRACT",
    "why it takes no props",
    `IT TAKES NO PROPS, and that is the design: the resolved theme reaches this
control through \`<html data-theme>\` alone. A \`theme\` prop would be a second
input that could disagree with the attribute, which is how a control ends up
showing one thing and posting another.`,
  ],
  "app/components/theme-toggle.tsx#2": ["CONTRACT", "already at size"],
  "app/components/theme-toggle.tsx#3": ["CONTRACT", "already at size"],
  "app/components/theme-toggle.tsx#4": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.revisions.tsx#0": [
    "CONTRACT",
    "header: ruling 1 held structurally, and the three questions",
    `Reading git, for the editor's revision drawer. JSON, GET, and NOTHING ELSE.

THIS MODULE EXPORTS NO \`action\`, and that is the enforcement of ruling 1 rather
than a stylistic choice: a route with no action cannot be made to write by any
request, because React Router answers a POST with 405 before any code of mine
runs. The guarantee is structural and therefore provable from outside.

Three questions, one route, because they are the same resource at different
depths and a route each would be three places to keep the path construction in
step.`,
  ],
  "app/routes/admin.posts.$slug.revisions.tsx#1": [
    "CONTRACT",
    "why a resource route is instrumented; the superseded sentence goes to the history document",
    `A RESOURCE ROUTE, and instrumented anyway: it makes GitHub calls, and the
finding this instrumentation exists for is that the ONE loader nobody suspected
was the expensive one.`,
  ],
  "app/routes/admin.posts.$slug.revisions.tsx#2": [
    "CONTRACT",
    "why the push stays and the write went",
    `PUSHES THE MARK, DOES NOT WRITE THE HEADER: the transport stamps it from the
same shared array after the handler returns. The push stays because it is the
MEASUREMENT, and the response argument is kept so every return path still runs
it.`,
  ],
  "app/routes/admin.posts.$slug.revisions.tsx#3": [
    "WHY",
    "keeps why the branch exists and why the import is static; the warning history goes to the history document",
    `This branch exists for a refresh after a save rather than for first paint.
STATIC, because this file already imports the same module statically and five
others do too, so the chunk was in the graph however this line was written.`,
  ],
  "app/routes/admin.posts.$slug.revisions.tsx#4": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.revisions.tsx#5": ["CONTRACT", "already at size"],
  "app/components/admin/media-confirm.tsx#0": [
    "CONTRACT",
    "header: why prompt had to go, the preserved ladder and the two triggers",
    `A DESTRUCTIVE CONFIRMATION, as a real modal rather than \`window.prompt\`.

WHY prompt() HAD TO GO: it was called from an \`onSubmit\` handler, so WITH
SCRIPTING OFF THE HANDLER NEVER RAN AND THE FORM SUBMITTED STRAIGHT THROUGH,
deleting every trashed object with no confirmation at all. It is also
unstyleable, blocks the browser, and is silently disabled in some contexts.

THE TYPE-THE-COUNT LADDER IS PRESERVED EXACTLY: the count is the thing a
distracted person gets wrong, and the confirm button stays DISABLED until the
typed value matches, which \`prompt()\` could not express.

TWO TRIGGERS, ONE APPEARANCE: empty-trash opens from a URL and works with no
script; bulk trash opens from client state, because the selection it acts on IS
client state.`,
  ],
  "app/components/admin/media-confirm.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/media-confirm.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/media-confirm.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/media-confirm.tsx#4": [
    "CONTRACT",
    "the server is the authority and the button ships enabled",
    `THE SERVER IS THE AUTHORITY EITHER WAY: the action re-reads the typed count and
refuses on a mismatch, so disabling the button is EARLIER FEEDBACK, not the
check.

That is what makes the no-script path work. Rendering it disabled on the server
would leave a reader without script unable to empty the trash at all, because
\`typed\` stays "" forever. Initialised false so the hydration render matches.`,
  ],
  "app/components/admin/media-confirm.tsx#5": ["CONTRACT", "already at size"],
  "app/components/admin/media-confirm.tsx#6": ["CONTRACT", "already at size"],
  "app/components/admin/media-confirm.tsx#7": [
    "CONTRACT",
    "the one-wire-name rule",
    `NAMED FROM THE CONSTANT, because the server reads the same one: two spellings
of one wire name would split silently on a rename.`,
  ],
  "app/components/admin/media-list-header.tsx#0": ["CONTRACT", "already at size"],
  "app/components/admin/media-list-header.tsx#1": [
    "CONTRACT",
    "header: one list, and what null means",
    `ONE LIST, so the header cannot grow a column the row does not have or lose one
the row still renders. \`null\` is Dims, which is a label rather than a link.`,
  ],
  "app/components/admin/media-list-header.tsx#2": [
    "CONTRACT",
    "header: every cell is a link, one builder, and why Dims is a span",
    `EVERY CELL IS A LINK. The whole display state is a URL on this page, so a sort
control has an address and must be an anchor: shareable, bookmarkable, restored
by the back button, and working with scripting off.

BOTH CONTROLS CALL \`sortHref\`. A header and a popover that build their own URLs
are two implementations of one destination; \`check:admin-ui\` asserts the two
hrefs are byte-equal per column.

DIMS IS NOT SORTABLE AND SAYS SO BY BEING A SPAN: half the library has no
dimensions, so they would collapse into one undifferentiated block at whichever
end nulls land.`,
  ],
  "app/components/admin/media-list-header.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/media-list-header.tsx#4": ["CONTRACT", "already at size"],
  "app/components/admin/media-list-header.tsx#5": [
    "CONTRACT",
    "why alignment is data; the collision goes to the history document",
    `ALIGNMENT AS DATA, never \`nth-of-type\`: that counts among siblings of the SAME
ELEMENT TYPE, and this row mixes anchors with spans, so "the fourth heading" and
"the fourth anchor" are different cells. A column declares its own alignment
beside its own label.`,
  ],
  "app/components/admin/media-list-header.tsx#6": ["CONTRACT", "already at size"],
  "app/components/admin/media-list-header.tsx#7": [
    "CONTRACT",
    "why none is not noise",
    `THE SORT STATE, as the property assistive technology reads. \`none\` on the
others is not noise: it is what says this column can be sorted and currently is
not.`,
  ],
  "app/components/admin/media-list-header.tsx#8": ["CONTRACT", "already at size"],
  "app/routes/admin.origin-requests.tsx#0": [
    "CONTRACT",
    "the shared-module rule; the NaN story goes to the history document",
    `Constants come from the SHARED module, never from the \`.server\` one. This
component renders on the client too, where a \`.server\` import is stubbed out and
every value from it arrives undefined.`,
  ],
  "app/routes/admin.origin-requests.tsx#1": [
    "CONTRACT",
    "header: what it counts, and why the loader returns the error",
    `WHAT THIS PANEL COUNTS: an edge HIT can serve a reader without the Worker
running, so this is a count of ORIGIN REQUESTS, a floor under readership and
never a measure of it. The words this panel must not use are asserted by the
gate rather than left to reviewer memory.

THE ERROR STATE IS THE ORDINARY STATE ON A DEV MACHINE, which is why the loader
RETURNS the error rather than throwing: a throw would take out the admin route
segment and replace the whole cockpit with an error boundary.`,
  ],
  "app/routes/admin.origin-requests.tsx#2": ["CONTRACT", "already at size"],
  "app/routes/admin.origin-requests.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/admin.origin-requests.tsx#4": ["CONTRACT", "already at size"],
  "app/routes/admin.origin-requests.tsx#5": ["CONTRACT", "already at size"],
  "app/routes/admin.origin-requests.tsx#6": [
    "CONTRACT",
    "the sanctioned inline style",
    `The one inline style on this page, and it is the sanctioned kind: a runtime
numeric value no token could name. The colour comes from the stylesheet.`,
  ],
  "app/routes/admin.origin-requests.tsx#7": [
    "CONTRACT",
    "the SSR splicing prohibition",
    `ONE STRING, not interpolated JSX children: React SSR splices comment nodes
between adjacent text nodes, so a sentence assembled from several expressions
renders with comments through it.`,
  ],
  "app/routes/admin.origin-requests.tsx#8": [
    "CONTRACT",
    "why a disclosure and not a caption",
    `THE CAVEAT, AS A DISCLOSURE. It was this table's \`<caption>\`, which a screen
reader announces before EVERY row. The closed summary is enough to act on.
Assembled in JS for the one-text-node reason above.`,
  ],
  "app/components/admin/media-copy-button.tsx#0": ["CONTRACT", "already at size"],
  "app/components/admin/media-copy-button.tsx#1": [
    "CONTRACT",
    "header: why an icon and where the fallback is; the measured widths go to the history document",
    `THE PAGE'S ONE JOB, as one small button beside the name it copies. The
clipboard needs script, which is why the filename beside it links to the detail
view where the same string sits in a readonly input. Feedback is a data attribute
rather than component state, because the page holds no client state by ruling.

AN ICON RATHER THAN THE WORD, and the reason is measured: the word cost a third
of the row and pushed the filename back into the end-truncation this design
exists to avoid.

\`title\` carries the address for a pointer and the visually hidden span carries
the accessible name for everything else.`,
  ],
  "app/components/admin/media-copy-button.tsx#2": [
    "CONTRACT",
    "why the default is what it is",
    `Defaults to the shape that is right for a tile whose label is a filename. The
inspector passes one explicitly, because there the label is already an imperative
and the default produced "Copy the address for Copy address".`,
  ],
  "app/components/admin/media-copy-button.tsx#3": [
    "CONTRACT",
    "why glyph-only is the default and why the inspector needs words; the gate finding goes to the history document",
    `THE DEFAULT IS GLYPH-ONLY AND THAT IS MEASURED. The inspector has the room and
NEEDS the words: three identical glyphs in a row are three controls a reader has
to press to tell apart, and a label only a screen reader can hear cannot warn
which one you are about to copy.`,
  ],
  "app/components/admin/media-copy-button.tsx#4": [
    "CONTRACT",
    "the half a screen reader gets",
    `ANNOUNCED as well as drawn. The data attribute drives a \`::after\`, which is
invisible to assistive technology; the toast is a live region.`,
  ],
  "app/components/admin/media-copy-button.tsx#5": ["CONTRACT", "already at size"],
  "app/components/admin/media-copy-button.tsx#6": ["CONTRACT", "already at size"],
  "app/routes/about.tsx#0": [
    "CONTRACT",
    "the route-scoped sheet rule",
    `This page renders into \`.prose\`, and prose.css is route-scoped since the
per-route CSS split. A page that uses the class and does not import the sheet
renders unstyled, which \`check:page-payload\`'s coverage half catches.`,
  ],
  "app/routes/about.tsx#1": [
    "CONTRACT",
    "header: why markdown here and why one Person graph; the audit finding goes to the history document",
    `Who this is, in the first person.

WHY THE PROSE IS IN MARKDOWN: \`/privacy\` and \`/colophon\` are prose in JSX and
that is right for them, because every sentence there is tied to a file a reader
can check. This page changes on taste, by the person it is about, and asking him
to edit a component to move a comma is how a page like this goes stale.

THE JSON-LD IS THE HOME PAGE'S, THE SAME FUNCTION. Two \`Person\` objects for one
person, differing in a field, is worse for a machine reader than one of them not
existing.`,
  ],
  "app/routes/about.tsx#2": ["CONTRACT", "already at size"],
  "app/routes/about.tsx#3": [
    "CONTRACT",
    "why it is injected, and what ran over it",
    `RENDERED HTML FROM THE BUILD, injected the way a post body is: produced at
build time from markdown in this repository, with no third-party input. The URL
allowlist ran over it at build time and \`buildAbout\` refuses on a blocked link
rather than shipping a demoted one.`,
  ],
  "app/routes/privacy.tsx#0": [
    "CONTRACT",
    "the route-scoped sheet rule",
    `This page renders into \`.prose\`, and prose.css is route-scoped since the
per-route CSS split. A page that uses the class and does not import the sheet
renders unstyled, which \`check:page-payload\`'s coverage half catches.`,
  ],
  "app/routes/privacy.tsx#1": [
    "CONTRACT",
    "header: the derivability rule and the two refusals; the file list goes to the history document",
    `What this site records, in plain English.

EVERY SENTENCE IS DERIVABLE FROM THE CODE. That is the rule this page is written
under and the reason it can be short: there is no "we may collect", and each
claim names something a reader could go and check.

NO RETENTION PERIOD IS STATED THAT THE CODE DOES NOT OWN. The Ask cache has one,
because \`expirationTtl\` is a number in the source; Analytics Engine's is
Cloudflare's, so this page says that rather than inventing a figure.

NO COMPLIANCE CLAIM: none of it would be a true statement about a personal site.

It joins the footer on every page, which is WCAG 2.2 3.2.6 consistent help.`,
  ],
  "app/routes/privacy.tsx#2": [
    "CONTRACT",
    "why the shared builder",
    `The SHARED builder, never a hand-written pair. \`check:headers\` refuses the
latter by name: a hand-written pair is how the Vary line gets dropped, and the
shared string without it serves one reader's theme to another.`,
  ],
  "app/components/post-card.tsx#0": [
    "CONTRACT",
    "header: why it was extracted",
    `One post in a listing. EXTRACTED rather than copied, because two copies of
thirty lines of markup are two places a field gets added and one place it gets
forgotten, which is how the index and the archive would come to show different
things about the same post.`,
  ],
  "app/components/post-card.tsx#1": [
    "CONTRACT",
    "why a summary entry and where u-url sits",
    `A SUMMARY ENTRY, not a truncated full one: it deliberately carries no
\`e-content\`, because a consumer that finds content on a listing entry has been
handed a summary labelled as the article.

\`u-url\` is on the anchor rather than the \`<li>\`, because the anchor is where the
address actually is.`,
  ],
  "app/components/post-card.tsx#2": [
    "CONTRACT",
    "why the card links to the archive",
    `THE TAG NAME IS A LINK TO THE ARCHIVE, not to a filtered index: every card was
linking at the non-canonical address of a page that exists at a better one. The
chips on \`/blog\` keep the filtered view, because their job is composing with the
year beside them.`,
  ],
  "app/components/post-card.tsx#3": [
    "CONTRACT",
    "header: why the href is passed in",
    `\`hrefFor\` is passed in because the two listings paginate at different URLs: the
index composes a query string of three axes, the archive appends \`?page=\` to a
path. The MARKUP is what has to be identical, and it is.`,
  ],
};
