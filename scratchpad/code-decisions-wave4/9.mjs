// Chunk 9: admin._index.tsx (0-9), settings-drawer.tsx (0-19), site-header.tsx (0-5),
// entry.server.tsx (0-4), login.tsx (0-10), search-trigger.tsx (0-4), media-palette.tsx (0-13),
// post-metadata.tsx (0-9), media-keyboard.tsx (0-15). 97 blocks.
//
// Same rule: contracts at 180 bytes or less, headers at ~370.
//
// TWO HEADERS ARE OVER, named so the exceptions stay visible.
//
// entry.server #1 is the CSP one: the `nonce` PROP reaches react-router's components and
// cannot reach react-dom, which writes its own inline scripts to complete a Suspense boundary
// and takes their nonce from the render OPTIONS. Both halves are required and a reader who
// keeps only one ships a site that renders and never hydrates. The test that holds the pair is
// named so the option cannot be dropped silently.
//
// login #4 is the door: why this action exists rather than posting straight to Better Auth,
// why `form-action 'self'` is satisfied, and why the rate limit is not belt-and-braces. Each
// is a different prohibition on the site's only unauthenticated write.
export default {
  "app/routes/admin._index.tsx#0": [
    "CONTRACT",
    "header: the read-back rule, the one-reading rule and the nothing-invented rule; the July stub goes to the history document",
    `THE COCKPIT, REWIRED TO REAL INSTRUMENTS.

EVERY NUMBER HERE IS A READ-BACK, NEVER A COPY. Rule 17. \`runHealthChecks\` is
the same function \`/api/health\` runs and \`syncStatus\` is the same function the
operator tool runs, so this page cannot disagree with the alert that wakes
Dustin at 2am: they are reading one instrument.

The SENTENCES come from \`check-copy.mjs\`, which owns nouns and verbs only; the
NUMBERS are substituted from each verdict's own counts.

The media index and the Ask index are not fetched again here. They are two of
the health checks, and reading them separately would be a second reading of the
same fact on one page, free to disagree with the first.

NOTHING WAS INVENTED TO FILL SPACE. A reader cannot tell a measured card from a
decorated one at a glance, so there are no decorated ones.

IT COSTS REAL I/O, stated rather than hidden, which is why the two run
concurrently and each carries its own mark.`,
  ],
  "app/routes/admin._index.tsx#1": [
    "CONTRACT",
    "why concurrent",
    `CONCURRENT, because they share nothing: the health run touches AI Search, R2
and D1, \`syncStatus\` touches GitHub and D1, and neither reads the other's
result.`,
  ],
  "app/routes/admin._index.tsx#2": [
    "CONTRACT",
    "the one-array rule; the drifted wording goes to the history document",
    `ONE READ OF THE CHECKS FEEDS THE SENTENCE, THE NOTICE AND THE TABLE. They were
two computations and they drifted, so the notice is rendered from \`worst\`, the
same element the sentence already described.`,
  ],
  "app/routes/admin._index.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/admin._index.tsx#4": [
    "CONTRACT",
    "the live-region prohibition",
    `ONE NOTICE, AND ONLY WHEN SOMETHING IS WRONG. A standing condition is not
news, so this is a named region rather than a live one: a \`role\` would announce
it on every load to a reader who came to do something else.`,
  ],
  "app/routes/admin._index.tsx#5": [
    "CONTRACT",
    "why there is one primary and where it posts",
    `THE ONE PRIMARY ON THIS PAGE, and only because a repair exists. It posts to
the route that ALREADY owns the intent; \`/admin\` has a loader and no action, and
this pass does not give it one.`,
  ],
  "app/routes/admin._index.tsx#6": ["CONTRACT", "already at size; carries the three-channel rule"],
  "app/routes/admin._index.tsx#7": ["CONTRACT", "already at size"],
  "app/routes/admin._index.tsx#8": [
    "CONTRACT",
    "why these two figures and not four cards",
    `TWO FIGURES: what the repository holds and what the site is serving. Those two
can disagree, and the disagreement is why this panel exists.`,
  ],
  "app/routes/admin._index.tsx#9": [
    "CONTRACT",
    "why an absent block is not evidence of health",
    `An EMPTY list is the normal answer, so this renders only when there is
something to say. \`known: false\` is a third state and is not an empty list: a
store that cannot be read must say so rather than report zero, which is why the
absence of this block is not evidence of health on its own.`,
  ],
  "app/components/site-header.tsx#0": [
    "CONTRACT",
    "header: the standing rules; every measured threshold and the probe story go to the history document",
    `Public site header. It grows when there is a page to add, not in
anticipation, so there is still no disclosure widget and no mobile menu
machinery.

THE THRESHOLDS ARE RE-MEASURED, NEVER REASONED FROM. They are a property of the
current label widths, and a longer word moves them. A simulated element is not
the element, so a threshold is measured after the link lands.

The header wraps on BOTH the header and the nav, and the only media query
touching it is \`print\`, so nothing here is breakpoint-dependent.

Roster's LABEL and its PATH deliberately disagree: the path is the indexed
legacy URL, the label is what the page is called.

The search entry point is an ordinary link, upgraded in place with script.
Nothing in the header depends on the palette existing.

NO \`prefetch="intent"\`: the prop worked through React event handlers, which
exist only on a hydrated page, so on a plane that does not hydrate it was dead
configuration that reads as an optimisation. Hover prepayment comes from
\`SiteSpeculation\`, which is declarative and needs no script.`,
  ],
  "app/components/site-header.tsx#1": [
    "CONTRACT",
    "why it reads no loader data",
    `NO LOADER READ. The single-button control reads the theme off
\`<html data-theme>\` through the cascade, so the header renders from its props
and the route table alone and cannot disagree with the document it sits in.`,
  ],
  "app/components/site-header.tsx#2": ["CONTRACT", "already at size; carries the decorative rule"],
  "app/components/site-header.tsx#3": [
    "CONTRACT",
    "why the nav is named",
    `NAMED, because two unlabelled navigation landmarks on a page are
indistinguishable to a screen reader. The footer carried a label and the header
carried nothing.`,
  ],
  "app/components/site-header.tsx#4": [
    "WHY",
    "why there is nothing left to substitute; the 2026-08-10 ruling goes to the history document",
    `THE HARD RULE 13 SUBSTITUTION THAT SAT HERE IS GONE, and so is the reason for
it: the control takes no theme at all, both buttons are always rendered, and the
cascade chooses between them. There is no value to pass and nothing to
substitute when \`data\` is absent.`,
  ],
  "app/components/site-header.tsx#5": [
    "CONTRACT",
    "why the speculation rides here",
    `It rides HERE rather than in root's Layout so its scope is exactly the
header's: every public page, never the admin plane, which does not render this
component.`,
  ],
  "app/entry.server.tsx#0": [
    "CONTRACT",
    "what the fifth argument is",
    `The FIFTH argument is the request context \`workers/app.ts\` built, the same
object it set \`nonceContext\` into. The default entry shipped by
\`@react-router/dev\` names it \`_loadContext\` for exactly this reason.`,
  ],
  "app/entry.server.tsx#1": [
    "CONTRACT",
    "kept long: both halves of the nonce are required and neither covers the other",
    `THE NONCE PROP, AND WHY ITS ABSENCE WAS A REAL BUG.

\`ServerRouter\` puts the value into \`FrameworkContext\`, which is the fallback
\`<Scripts>\` reads, AND passes it to \`StreamTransfer\`, which stamps it on both of
React Router's streaming scripts. Without it those ship bare on EVERY page, and
under an enforcing CSP the \`enqueue\` script carries the hydration payload, so
the site would render and never hydrate.

THE PROP IS NOT ENOUGH. REACT EMITS INLINE SCRIPTS OF ITS OWN, AND ONLY THE
RENDER OPTION BELOW STAMPS THOSE. The prop reaches react-router's components; it
cannot reach react-dom, which writes its own inline scripts to COMPLETE a
Suspense boundary and takes their nonce from \`renderToReadableStream\`'s OPTIONS.
\`test/ssr-nonce.test.mjs\` holds that pair, including the no-option control, so
the option cannot be dropped without a named failure.`,
  ],
  "app/entry.server.tsx#2": ["CONTRACT", "already at size; carries the pointer to the block above"],
  "app/entry.server.tsx#3": ["CONTRACT", "already at size"],
  "app/entry.server.tsx#4": [
    "WHY",
    "keeps the structural reason and the reversal condition; the measurement and its control go to the history document",
    `NO \`await body.allReady\`, AND NO USER-AGENT SNIFF. The template waits for the
whole tree when the caller looks like a crawler, which is worth doing on a site
that streams a boundary. This one does not: the repository declares exactly ONE
Suspense boundary, on the ADMIN plane behind a session, where no crawler
arrives.

So the branch could never fire for a reader, and \`isbot\` went with it: a
dependency the deployed Worker carries for a branch that cannot be taken is a
dependency lying about what serves the site.

IF A PUBLIC ROUTE EVER STREAMS A BOUNDARY, THIS DECISION IS REVERSED, and the
thing to restore is the wait, not the sniff.`,
  ],
  "app/routes/login.tsx#0": [
    "CONTRACT",
    "header: the two measured dependencies and the refused alternative; the line numbers go to the history document",
    `THE ADMIN STYLESHEET, ON A PUBLIC ROUTE, DELIBERATELY. This page is
unauthenticated and therefore public, but it is the admin plane's door.

TWO dependencies, both measured with postcss rather than assumed:
\`.field-alarm\`, which carries the sign-in error, and \`.btn-brand:disabled\`,
which is the button's disabled state. The alternative was moving two rules into
a public sheet, changing their cascade position for the admin plane to save
bytes on a page essentially one person loads.`,
  ],
  "app/routes/login.tsx#1": [
    "CONTRACT",
    "header: what hydration costs and what it does not",
    `/login hydrates for its busy flag, and that is DECORATION: the door itself is
the plain form above it, a real no-script POST, which is what rule 9 requires of
a public route. Dropping this flag would cost the spinner, never the sign-in.`,
  ],
  "app/routes/login.tsx#2": ["CONTRACT", "already at size"],
  "app/routes/login.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/login.tsx#4": [
    "CONTRACT",
    "header, kept long: three prohibitions on the site's only unauthenticated write",
    `THE DOOR, WITHOUT SCRIPT. The only way in used to be a \`type="button"\` with an
\`onClick\`: with scripting off it rendered, it was enabled, and it did nothing.
Hard rule 9 decides where the boundary sits, and the DOOR is on the public
plane.

WHY THIS ACTION EXISTS instead of posting straight to Better Auth: that endpoint
answers 200 with a JSON body carrying the authorize URL, because it is written
for a fetch client that will navigate itself, so a plain form would render that
JSON as text. This action asks for the same URL and answers with a real 302.

\`form-action 'self'\` is satisfied because the form's target is this origin; the
cross-origin hop afterwards is a REDIRECT, and redirects are not checked against
it. If a browser ever reinstates that check, the fix is to name the provider.

THE RATE LIMIT IS APPLIED HERE TOO, and that is not belt-and-braces: this route
is not under \`/api/auth/*\`, so without it the form would be an unguarded way to
ask Better Auth to mint authorize URLs and set state cookies.`,
  ],
  "app/routes/login.tsx#5": ["CONTRACT", "already at size"],
  "app/routes/login.tsx#6": [
    "CONTRACT",
    "why the headers travel with the URL",
    `THE HEADERS MATTER AS MUCH AS THE URL. Better Auth sets the OAuth state cookie
on this response and the callback refuses without it, so returning the redirect
while dropping the Set-Cookie would produce a door that opens onto a failure
every time.`,
  ],
  "app/routes/login.tsx#7": [
    "CONTRACT",
    "what the id is for",
    `\`id="main"\` because root ALWAYS renders the skip link, on every route
including this one. Without a target here the first thing a keyboard reader hits
on the site's only door moved focus nowhere.`,
  ],
  "app/routes/login.tsx#8": ["CONTRACT", "already at size"],
  "app/routes/login.tsx#9": [
    "CONTRACT",
    "why a plain form",
    `A PLAIN form, deliberately not react-router's \`<Form>\`: the submission has to
end in a cross-origin redirect to the provider, and a native submission is what
follows one.`,
  ],
  "app/routes/login.tsx#10": [
    "CONTRACT",
    "the enhancement is layered, not a replacement",
    `THE ENHANCEMENT, layered on top rather than replacing anything. With script
the browser client goes straight to the provider; without script none of this
runs and the form above posts normally.`,
  ],
  "app/components/search-trigger.tsx#0": [
    "CONTRACT",
    "header: the link, the honesty contract and the attribute; the badge history and the corrections go to the history document",
    `The site-wide search entry point.

WHAT SHIPS IS A LINK. Server-rendered, it is an anchor to /search, so a reader
with scripting off gets working search by clicking it. If the palette chunk
never loads, never finishes, or throws, the link is still a link.

THE HONESTY CONTRACT: the shortcut hint ships \`hidden\` and \`theme.ts\` unhides
it, so the promise is made only once the listener is attached. A reader without
script is never told about a shortcut that does not exist for them.

NO SCRIPT TAG HERE. THE ATTRIBUTE IS THE WHOLE CHANGE: \`data-palette\` carries
the hashed URL, and \`theme.ts\` imports it the first time a binding fires. The
bundle must still be PREBUILT, because \`?url\` copies the file verbatim with no
compilation and pointed at the source it serves raw TypeScript.

The attribute goes on the trigger rather than the document, so a page without
this component has no palette instead of a broken one.`,
  ],
  "app/components/search-trigger.tsx#1": [
    "CONTRACT",
    "header: one statement, two attributes",
    `The id \`aria-describedby\` points at. A literal written twice is a description
that silently stops being announced the day one of them is edited, which is a
failure nothing paints. \`check:browser\` asserts the association resolves.`,
  ],
  "app/components/search-trigger.tsx#2": ["CONTRACT", "already at size"],
  "app/components/search-trigger.tsx#3": [
    "CONTRACT",
    "why hidden and not sr-only, and why it sits outside",
    `\`.sr-only\` would be wrong twice over: it would announce a shortcut to a
scriptless reader who does not have one, and \`hidden\` is what lets \`theme.ts\`
reveal it on exactly the right signal. OUTSIDE the anchor, or it would become
part of the link's own content.`,
  ],
  "app/components/search-trigger.tsx#4": [
    "CONTRACT",
    "why the server text is a placeholder; the stale-string story goes to the history document",
    `A PLACEHOLDER, NOT THE HINT. The chord is platform-dependent and the server
cannot know the platform, so \`theme.ts\` writes the real text here BEFORE it
unhides this, and this text is never announced.`,
  ],
  "app/components/admin/post-metadata.tsx#0": [
    "CONTRACT",
    "header: why not the drawer, and the absent-field rule; the B004 relay goes to the history document",
    `The frontmatter keys the editor carried and never offered.

WHY THIS IS NOT IN THE SETTINGS DRAWER: the drawer is a \`<dialog>\` opened with
\`showModal()\`, so its fields can only be EDITED by someone whose browser ran the
script that opens it. A control inside a modal nobody can open is a control that
does not exist on that path, and the brief is that these work with scripting off.

THE RULE EVERY CONTROL HERE OBEYS: an absent field never means cleared. A text
input always submits, even empty; the two that are not safe are handled
explicitly, and neither adds a way for a missing field to read as an author's
decision.`,
  ],
  "app/components/admin/post-metadata.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/post-metadata.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/post-metadata.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/post-metadata.tsx#4": [
    "CONTRACT",
    "why the narrowing is here and not in the palette",
    `PUBLISHED ONLY, and not the post being edited. Further reading is rendered to
the public, so offering a draft would be offering a link that 404s for every
reader; the palette wants the wider list, so the narrowing is here rather than
there. Nothing enforces the self-citation rule downstream, so it is enforced by
not being offered.`,
  ],
  "app/components/admin/post-metadata.tsx#5": [
    "CONTRACT",
    "why one spare row",
    `One spare row, always: it is what makes adding a link possible without script,
and saving reveals the next spare. Two spares were rejected as clutter, since the
cost of a second link is one more save rather than a lost one.`,
  ],
  "app/components/admin/post-metadata.tsx#6": [
    "CONTRACT",
    "why the hidden false is required and why it comes first",
    `THE HIDDEN "false" IS NOT REDUNDANT: an unticked checkbox is absent from the
submission entirely, so without this the parser would read that absence. It is
rendered BEFORE the checkbox because \`fieldsFromForm\` takes the LAST value.`,
  ],
  "app/components/admin/post-metadata.tsx#7": [
    "CONTRACT",
    "why both the marker and the carried value are required",
    `THE MARKER AND THE CARRIED VALUE, together, and neither is optional. The
marker says this control was on the page, so an empty result is the author
clearing the list rather than a form that never offered one. The hidden value is
what the parser falls back to for every caller that is not this section.`,
  ],
  "app/components/admin/post-metadata.tsx#9": [
    "CONTRACT",
    "why the value carries both",
    `The VALUE carries the slug and the title together, so the picker contributes
exactly one field name to the submission tuple no matter how long the blog
gets.`,
  ],
  "app/components/admin/settings-drawer.tsx#0": [
    "CONTRACT",
    "the one-limit rule; the drifted pair goes to the history document",
    `ONE DESCRIPTION LIMIT, and it is the SERP number. This file carried its own
while the preview beside it truncated at another, so the drawer told an author
they were inside the limit and the preview cut the sentence. The preview is the
surface the author believes.`,
  ],
  "app/components/admin/settings-drawer.tsx#1": [
    "CONTRACT",
    "header: the platform choice and the form-association rule",
    `Built on a real \`<dialog>\` opened with \`showModal()\`, so the focus trap, the
Escape handling and the focus return are the platform's rather than a
hand-rolled keydown handler that will be subtly wrong.

The controls belong to the EDITING form, which is outside the dialog, so each
carries \`form={formId}\`: association in HTML is by attribute, not containment. A
closed dialog is \`display: none\`, which has no bearing on whether a control is
submitted, so the fields ride along whether or not it was opened.`,
  ],
  "app/components/admin/settings-drawer.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#3": [
    "CONTRACT",
    "absent is the whole contract",
    `ABSENT is the whole contract. A published post is handed no slot, so neither
the create control nor any revoke control exists on the page: the ruling is held
by there being nothing to press rather than by a disabled button, which submits
nothing but still reads as an offer.`,
  ],
  "app/components/admin/settings-drawer.tsx#4": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#5": ["CONTRACT", "already at size; carries the alarms-never-blocks rule"],
  "app/components/admin/settings-drawer.tsx#6": [
    "CONTRACT",
    "the placement reason and the one-function rule",
    `Directly under the field they are about, because the description is the one
input whose effect is completely invisible from inside it. Both render from
\`postSocial\`, the same function the post route's \`meta()\` calls, so they cannot
drift from what the site emits.`,
  ],
  "app/components/admin/settings-drawer.tsx#7": [
    "CONTRACT",
    "header: why the slug is read-only",
    `It is the public URL and the filename, so changing it after the first save
would be a rename plus a redirect, which is not what a text input implies. Only
the new-post flow gets an input.`,
  ],
  "app/components/admin/settings-drawer.tsx#8": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#9": [
    "CONTRACT",
    "read-only rather than disabled",
    `Still submitted, because the save path reads it. Read-only rather than
disabled: a disabled field submits nothing, and dropping the slug would make
every save look like a new post.`,
  ],
  "app/components/admin/settings-drawer.tsx#10": [
    "CONTRACT",
    "header: the payload is unchanged",
    `The submitted field is unchanged: one \`tags\` input holding a comma separated
list, exactly what \`parseTags\` has always split. The chips are a view of that
string, so the payload cannot drift from what the checkbox era sent.`,
  ],
  "app/components/admin/settings-drawer.tsx#11": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#12": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#13": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#14": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#15": [
    "CONTRACT",
    "the component boundary and the alt rule",
    `THE PICKER COMPONENT, not picker logic: the drawer renders it and takes a
chosen object back, so the listing and the empty state are the media module's.
Picking pre-fills ALT only when the field is empty, because a description already
written for this cover outranks the stored one.`,
  ],
  "app/components/admin/settings-drawer.tsx#16": [
    "CONTRACT",
    "header: the same field in the same format, and the stated cost",
    `What replaced the raw ISO input writes the SAME field in the SAME format: a
\`datetime-local\` the author touches, and a hidden \`publishAt\` carrying the ISO
string the server has always received. The visible control is deliberately
unnamed so it cannot join the payload.

THE COST, stated rather than hidden: with scripting off a schedule cannot be
CHANGED. The hidden field still renders with the committed value, so an existing
schedule is preserved rather than silently cleared.`,
  ],
  "app/components/admin/settings-drawer.tsx#17": [
    "CONTRACT",
    "why the checkbox is unnamed; the radio-pair catch goes to the history document",
    `A single UNNAMED checkbox, and both halves matter: a control with no \`name\` is
never submitted, which keeps the toggle out of the payload entirely. A radio pair
needs a shared \`name\` to be a group, and that name went straight into the
request.`,
  ],
  "app/components/admin/settings-drawer.tsx#18": ["CONTRACT", "already at size"],
  "app/components/admin/settings-drawer.tsx#19": ["CONTRACT", "already at size"],
  "app/components/admin/media-palette.tsx#0": [
    "CONTRACT",
    "header: the no-server-render rule, the one-query rule and the declared state; the four-step story goes to the history document",
    `THE COMMAND PALETTE, LAYERED OVER THE SEARCH FORM RATHER THAN REPLACING IT.

THIS COMPONENT RENDERS NOTHING ON THE SERVER. It mounts, finds the search input
already in the DOM, and attaches to it. With scripting off the page is
byte-for-byte what it was. That is also why it takes the input by ID rather than
owning it: an enhanced control that REPLACES the unenhanced one has to
reimplement everything the platform gave the original, and the first thing it
loses is the no-script path.

THE RESULTS COME FROM THE SAME QUERY THE FORM RUNS. A client-side filter would
be a SECOND answer to "what matches this", which this page has already paid for
once.

CLIENT STATE, DECLARED: five pieces, all transient, none in a URL.`,
  ],
  "app/components/admin/media-palette.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/media-palette.tsx#2": [
    "CONTRACT",
    "the harness seam and its wire-unreachability",
    `HARNESS SEAM: an optional prop with a production default. \`check:admin-ui\`
renders one static pass and dispatches no events, so without this the panel never
opens. Wire-unreachable: React Router never supplies it.`,
  ],
  "app/components/admin/media-palette.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/media-palette.tsx#4": ["CONTRACT", "already at size"],
  "app/components/admin/media-palette.tsx#5": [
    "CONTRACT",
    "the half that gets forgotten",
    `THE FETCH, DEBOUNCED, AND ORDERED BY SEQUENCE NUMBER. The sequence number is
the half that gets forgotten: two requests in flight can complete in either
order, so a slow response to a shorter query can land after a fast one and
replace the right answer with a stale one.`,
  ],
  "app/components/admin/media-palette.tsx#6": [
    "CONTRACT",
    "why silence is right",
    `A failed lookup leaves the form underneath untouched, so pressing Enter still
navigates and still searches. Silence is the right behaviour: an error banner
over a working control is noise.`,
  ],
  "app/components/admin/media-palette.tsx#7": ["CONTRACT", "already at size"],
  "app/components/admin/media-palette.tsx#8": [
    "CONTRACT",
    "why the handler is global and what the guard protects",
    `On the window, because two bindings are global. Everything else applies only
while the search box has focus, and the guard is what keeps arrow keys working
in the alt textarea: a palette that stole ArrowDown from every field would break
typing to fix finding.`,
  ],
  "app/components/admin/media-palette.tsx#9": ["CONTRACT", "already at size"],
  "app/components/admin/media-palette.tsx#10": [
    "CONTRACT",
    "why preventDefault is the fallback boundary",
    `ENTER COPIES. SHIFT+ENTER OPENS. \`preventDefault\` matters: without it the form
submits and navigates, which is the unenhanced behaviour and would throw away the
copy. With scripting off there is no handler and the same key does exactly that
navigation.`,
  ],
  "app/components/admin/media-palette.tsx#11": [
    "CONTRACT",
    "why a router navigation",
    `A ROUTER navigation, not \`window.location\`: the destination is this same route
with a \`key\` in the query, and assigning to \`location\` tore the document down
and rebuilt it to show a panel.`,
  ],
  "app/components/admin/media-palette.tsx#12": [
    "CONTRACT",
    "why the two paths differ on purpose",
    `A LINK, not a button. The pointer path and the keyboard path differ on
purpose: clicking a row opens it, because that is what clicking a row means
everywhere, while Enter copies, because that is what the reader came for.`,
  ],
  "app/components/admin/media-palette.tsx#13": [
    "CONTRACT",
    "why the hints exist and what the count says",
    `THE HINTS, which are the only documentation these shortcuts get: a keyboard
affordance nobody can discover is one nobody uses. The count says "6+ matches"
when the cap was hit, so six never reads as the whole answer.`,
  ],
  "app/components/admin/media-keyboard.tsx#0": [
    "CONTRACT",
    "header: both need script and neither is the only way",
    `TOASTS AND GRID KEYBOARD NAVIGATION: the two page-level enhancements. Both
need script and both are accepted as needing it. Neither is the only way to do
anything: every action a shortcut reaches has a visible control, and every toast
reports something the page also shows.`,
  ],
  "app/components/admin/media-keyboard.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/media-keyboard.tsx#2": [
    "CONTRACT",
    "header: why an event and not context",
    `A CUSTOM EVENT rather than context, deliberately: the alternative is a provider
wrapping the page and a hook in every component that might speak, which would put
the toast in the server render where it has nothing to say. If no toast is
mounted, nothing happens and nothing breaks.`,
  ],
  "app/components/admin/media-keyboard.tsx#3": [
    "CONTRACT",
    "header: why a live region, and why it is always mounted",
    `THE TOAST, which exists because a copy that succeeds silently looks broken.

\`role="status"\` with \`aria-live="polite"\`, because the copy button's own
acknowledgement is a \`::after\` on a data attribute, which a screen reader never
sees.

IT IS ALWAYS IN THE DOM once mounted, empty until it has something to say: a
live region inserted at the moment it gets content is frequently not announced.`,
  ],
  "app/components/admin/media-keyboard.tsx#4": ["CONTRACT", "already at size"],
  "app/components/admin/media-keyboard.tsx#5": [
    "CONTRACT",
    "header: why geometry and not a layout model, and the degradation",
    `READING THE RENDERED GEOMETRY rather than a layout model. The column count is
decided by the browser from the container width, and computing it here would be a
second layout engine that disagrees with the real one at exactly the widths
nobody tested.

So down means "the tile nearest my horizontal centre, one visual row lower",
measured from \`getBoundingClientRect\`, which keeps working when the grid
reflows and when the last row is short.

DEGRADES TO NOTHING: every tile is a link and a checkbox already.`,
  ],
  "app/components/admin/media-keyboard.tsx#6": [
    "CONTRACT",
    "why the mark is in the DOM",
    `Marked in the DOM rather than by re-rendering the grid, which is what keeps
this island from owning the grid's state.`,
  ],
  "app/components/admin/media-keyboard.tsx#7": ["CONTRACT", "already at size"],
  "app/components/admin/media-keyboard.tsx#8": ["CONTRACT", "already at size; carries the never-in-a-field rule"],
  "app/components/admin/media-keyboard.tsx#9": [
    "CONTRACT",
    "why the first id is guarded",
    `The first id is guarded rather than the length: the same early return on an
empty grid, and it is what makes the two \`setActive\` calls below pass a string
rather than a possibly-absent one.`,
  ],
  "app/components/admin/media-keyboard.tsx#10": [
    "CONTRACT",
    "why unreachable returns are still written",
    `Both are guarded rather than asserted: the indices came from walking \`rows\`,
so these returns are unreachable, and an unreachable return substitutes nothing
while a non-null assertion would hide a real regression.`,
  ],
  "app/components/admin/media-keyboard.tsx#11": ["CONTRACT", "already at size"],
  "app/components/admin/media-keyboard.tsx#12": [
    "CONTRACT",
    "what Escape clears and why the order is not arbitrary",
    `ESCAPE CLEARS EVERYTHING THIS PAGE CAN HAVE OPEN, which is what the key means
everywhere else. ORDER MATTERS: the drawer and the modals stop this event before
it reaches here, so one press closes the thing ON TOP rather than everything at
once.`,
  ],
  "app/components/admin/media-keyboard.tsx#13": ["CONTRACT", "already at size"],
  "app/components/admin/media-keyboard.tsx#14": [
    "CONTRACT",
    "why the real boxes are unchecked",
    `The selection, by unchecking the real boxes rather than keeping a second copy
of it here. The grid owns the selection; this asks.`,
  ],
  "app/components/admin/media-keyboard.tsx#15": [
    "CONTRACT",
    "why the real checkbox is clicked",
    `THE REAL CHECKBOX, clicked. Not a parallel selection model: the bulk form reads
those checkboxes, so anything else would select rows the submission does not
carry.`,
  ],
};
