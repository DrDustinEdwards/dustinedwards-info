// Chunk 11: twenty-two files, 78 blocks. The tail of the wave.
//
// Same rule: contracts at 180 bytes or less, headers at ~370. Blocks already at size are
// explicit two-element keeps.
//
// Nothing here needs an over-length exception. The heaviest survivors are the structural
// guarantees that repeat across this tail and are worth keeping in each place they hold:
// a route exporting NO action cannot be made to write (revisions, history), a bundle must be
// PREBUILT because `?url` does not compile (blog-enhancements), and a control ships hidden
// until something is listening (ask-panel).
export default {
  "app/routes/blog.series.$series.tsx#0": [
    "CONTRACT",
    "why both sheets",
    `Both sheets the shared card needs: \`PostCard\` renders \`.post-card-series\`,
which lives only in the extras sheet.`,
  ],
  "app/routes/blog.series.$series.tsx#1": [
    "CONTRACT",
    "header: the one ascending list and the 404 rule; section E goes to the history document",
    `The archive for one series.

ORDERED BY PART, WHICH IS THE ONE LISTING THAT IS NOT NEWEST FIRST. A series is
the exception by construction: the author numbered the parts, and part one is
where you start. The feeds take the same order, so the page and the subscription
agree.

404 RATHER THAN AN EMPTY PAGE, the tag archive's rule inherited rather than
re-argued: an empty archive would be a soft 404 and would leak the existence of a
series only a draft carries.`,
  ],
  "app/routes/blog.series.$series.tsx#2": [
    "CONTRACT",
    "inherited rather than restated",
    `Out of range redirects to the last real page, which is \`/blog\`'s ruling and
the tag archive's. 302, because the bound moves as parts are published.`,
  ],
  "app/routes/blog.series.$series.tsx#3": [
    "CONTRACT",
    "why the helper",
    `The tag archive's headers, through the same helper that owns them. This page
negotiates nothing, so it takes the helper rather than writing the pair out.`,
  ],
  "app/routes/blog.series.$series.tsx#4": [
    "CONTRACT",
    "the complete-set rule and the page axis",
    `\`pageMeta\` owns the complete social and canonical set, so this page cannot
ship a partial one. The canonical carries \`?page=\` when there is one, since page
two is different posts.`,
  ],
  "app/routes/blog.series.$series.tsx#5": [
    "CONTRACT",
    "why the per-series feeds exist",
    `The same offer the tag archive makes and for the same reason: a reader who
wants one series wants one series in their reader.`,
  ],
  "app/components/admin/social-previews.tsx#0": [
    "CONTRACT",
    "header: the same-function rule and what the preview claims",
    `Both read from \`postSocial\`, the SAME function the post route's \`meta()\`
calls. A preview that derived its own version would eventually disagree with the
page, and it would disagree SILENTLY, because no view renders both at once for a
human to compare.

These are previews of the head tags, not of a search engine's rendering. What
they promise is "these are the strings the site emits, cut where they will be
cut".`,
  ],
  "app/components/admin/social-previews.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/social-previews.tsx#2": [
    "CONTRACT",
    "header: why ogImage is deliberately absent",
    `\`ogImage\` is deliberately NOT supplied and that is not an omission: the
build:og card is a fact about R2 discovered at sync time, and the editor cannot
know whether one exists for a title the author is still typing. Claiming one
would be the preview inventing an image.`,
  ],
  "app/components/admin/social-previews.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/social-previews.tsx#4": ["CONTRACT", "already at size"],
  "app/components/admin/social-previews.tsx#5": ["CONTRACT", "already at size"],
  "app/components/admin/social-previews.tsx#6": ["CONTRACT", "already at size"],
  "app/components/admin/social-previews.tsx#7": [
    "CONTRACT",
    "why there is no placeholder",
    `The real image, at the real URL, and NOT a placeholder when there is no cover:
a post with no cover gets the site mark, so that is what is shown. Inventing a
grey rectangle would hide the one case worth seeing.`,
  ],
  "app/routes/phage-discovery.tsx#0": ["CONTRACT", "already at size"],
  "app/routes/phage-discovery.tsx#1": [
    "CONTRACT",
    "header: the deliberate bareness, the legacy URL and the prose decision; the asset-move note goes to the history document",
    `Roster. Photos and names, by year, and nothing else.

No intro copy, no JSON-LD, no description constant. The bare state is deliberate
and temporary rather than something to helpfully fill in.

THE URL IS /phage-discovery: the legacy WordPress address, indexed and carrying
whatever inbound links this content has, so the Worker takes it over at cutover
instead of redirecting it. That also makes this page the correction to a real
error in the legacy one.

EVERYTHING IS STYLED BY \`.prose\`, deliberately: it already carries the ratified
treatment and \`check:contrast\` already covers it.`,
  ],
  "app/routes/phage-discovery.tsx#2": ["CONTRACT", "already at size"],
  "app/routes/phage-discovery.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/revision-list.tsx#0": [
    "CONTRACT",
    "header: ruling 1 and the structural guarantee; the standalone page goes to the history document",
    `Version history, in the drawer, under ruling 1.

RESTORE LOADS. IT DOES NOT WRITE, AND IT CANNOT. The only network calls are GETs
to a route that exports no action, and the only commit the editor can produce is
the ordinary save on the one existing write path.

Diffs load on demand rather than with the drawer, because a post with fifty
commits would otherwise pull fifty patches to show none of them.`,
  ],
  "app/components/admin/revision-list.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/revision-list.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/revision-list.tsx#3": [
    "CONTRACT",
    "the hydration boundary",
    `UTC, and formatted from the ISO string the API returned. Fixed zone so the
server render and the hydration cannot disagree about which day a commit landed
on.`,
  ],
  "app/components/admin/revision-list.tsx#4": [
    "CONTRACT",
    "why the newest is never offered",
    `Never offered for the newest commit: that revision IS the editor's current
content, so loading it would mark the post dirty while changing nothing.`,
  ],
  "app/components/admin/revision-list.tsx#5": [
    "CONTRACT",
    "one convention, not two",
    `The EXISTING diff presentation, the same attributes the standalone page uses.
One diff convention on this site, not two.`,
  ],
  "app/components/admin/revision-list.tsx#6": ["CONTRACT", "already at size"],
  "app/routes/admin.tools.tsx#0": [
    "CONTRACT",
    "header: why there is no control; the deleted stub goes to the history document",
    `The audit is not a button: reading the bindings costs nothing, so a control
would add a click and a state to a question the page can simply answer.`,
  ],
  "app/routes/admin.tools.tsx#1": [
    "CONTRACT",
    "presence only, and where that is asserted",
    `PRESENCE ONLY. \`auditSecrets\` returns a name and a boolean per ratified secret
and nothing else, asserted behaviourally in \`test/secrets-audit.test.mjs\`: a
value, a masked prefix or a length reaching this payload fails two independent
assertions. Not timed: it reads bindings already in memory.`,
  ],
  "app/routes/admin.tools.tsx#2": [
    "CONTRACT",
    "the no-restated-count rule; the stale word goes to the history document",
    `THE COUNT IS NOT RESTATED HERE: \`REQUIRED_SECRETS\` is the owner and the chip
derives from it. NAMES AND A WORD, never a value.`,
  ],
  "app/routes/admin.tools.tsx#3": [
    "CONTRACT",
    "the second-channel rule",
    `\`chip-error\`, whose token pair \`check:contrast\` already measures. The WORD
carries the state, so the hue is the second channel.`,
  ],
  "app/components/admin/media-drop-anywhere.tsx#0": ["CONTRACT", "already at size"],
  "app/components/admin/media-drop-anywhere.tsx#1": [
    "CONTRACT",
    "header: layered over the form, the no-auto-submit rule and the keyboard disclaimer",
    `LAYERED OVER THE FORM, never instead of it. It sets the EXISTING input's
\`files\` and does not submit, so with script off the form is untouched.

It deliberately DOES NOT AUTO-SUBMIT: a drop is easy to do by accident, an
upload writes to R2, and the ladder puts a deliberate press in front of every
write on this page.

KEYBOARD REACHABILITY is not this control's job and it claims none: the file
input beside it is the keyboard path and always was.`,
  ],
  "app/components/admin/media-drop-anywhere.tsx#2": [
    "CONTRACT",
    "why a counter",
    `A COUNTER, not a boolean, because dragenter and dragleave fire for every
nested element the pointer crosses and a naive boolean flickers off the moment
the cursor moves between two tiles.`,
  ],
  "app/components/admin/media-drop-anywhere.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/media-drop-anywhere.tsx#4": ["CONTRACT", "already at size"],
  "app/components/admin/media-empty-state.tsx#0": [
    "CONTRACT",
    "header: why the decision is here; the move date goes to the history document",
    `THE EMPTY LIBRARY, and there are three of them. Which one renders is decided
here rather than by the caller, because the three differ only in what the reader
should do next.`,
  ],
  "app/components/admin/media-empty-state.tsx#1": [
    "CONTRACT",
    "why the member is selected",
    `The loader returns a UNION of three shapes and only the listing carries these
fields, so the member is selected rather than the property read off the union.
One owner: the loader.`,
  ],
  "app/components/admin/media-empty-state.tsx#2": [
    "CONTRACT",
    "the three meanings, compressed to what each must say",
    `THREE EMPTY STATES, NOT ONE, because they mean three different things and the
reader needs a different next step from each.

LIBRARY EMPTY is the only one that gets a heading and a button, because it is
the only one where the reader has nothing to undo. SEARCH MISS names the query
back so a typo can be told from a wrong assumption. LENS EMPTY is GOOD NEWS and
reads as an error unless it says so.`,
  ],
  "app/components/admin/panel.tsx#0": [
    "CONTRACT",
    "header: what the frame is for",
    `Panel is the frame every cockpit section renders inside: a title row with an
optional source chip, then whatever body the section needs. Sections stay
uniform without knowing about each other.`,
  ],
  "app/components/admin/panel.tsx#1": [
    "CONTRACT",
    "header: why an action belongs on the heading; the measurement goes to the history document",
    `Controls that belong BESIDE the title rather than above the content. A page
whose primary action is a full-width row of its own spends a whole band of
vertical space saying "upload". An action is a thing you do TO the section, so it
belongs on the section heading.`,
  ],
  "app/components/admin/panel.tsx#2": [
    "CONTRACT",
    "header: why the third branch is gone and what enforces it",
    `THE THIRD BRANCH IS GONE with the \`stub\` arm it rendered, and its removal is
the point: a panel can no longer say "this data is not real", because no source
produces data that is not real. A \`never\` in the union is the typecheck refusing
to let one back in without a decision.`,
  ],
  "app/components/admin/panel.tsx#3": [
    "CONTRACT",
    "header: the never-hue-alone rule",
    `Rule 1: colour is never the only channel. The dot carries a shape per status
and the word rides alongside it, visually hidden. Before this the state reached
sighted readers as a hue and reached assistive tech not at all.`,
  ],
  "app/components/admin/panel.tsx#4": ["CONTRACT", "already at size"],
  "app/components/site-logo.tsx#0": [
    "CONTRACT",
    "header: why inline, what the tokens do, and the generated-file prohibition; the diff verification goes to the history document",
    `The site mark, inline and in one place.

INLINE rather than an \`<img>\` because the theme is driven by a data attribute,
so a \`<picture>\` with \`prefers-color-scheme\` would ignore the manual toggle. The
purple paths take a token that already resolves in light, dark and SYSTEM mode.
Nothing can flash and nothing can shift.

The warm three keep literal fills because they are IDENTICAL in both variants;
binding them to tokens would make the mark render differently from the ratified
assets.

GENERATED from public/logo.svg. Path data is verbatim and must never be
hand-edited: a variant is a rebuild from the construction spec.`,
  ],
  "app/components/site-logo.tsx#1": ["CONTRACT", "already at size"],
  "app/components/site-logo.tsx#2": ["CONTRACT", "already at size"],
  "app/components/site-logo.tsx#3": ["CONTRACT", "already at size"],
  "app/components/shell-footer.tsx#0": [
    "CONTRACT",
    "header: the tonal rule and why the machine links are there; the build history goes to the history document",
    `The Paper, Glass, Light footer.

TONAL, not a second bar: no purple fill, no logo repeat, no social row. A footer
that repeats the header's brand is a second header, and this one exists to hold
the links that are not destinations.

THE MACHINE LINKS ARE NOT DECORATION. \`/llms.txt\` and the per-post markdown
twins are how an agent reads this site, and agents are the audience the brief
names as mattering most, so they are in every page's footer rather than on the
colophon alone.`,
  ],
  "app/components/shell-footer.tsx#1": [
    "CONTRACT",
    "why the year is a literal",
    `A DATED STRING, not a computed year. \`new Date()\` in a component body differs
between the server render and any later render, and on an unhydrated public page
it would be the only thing that could disagree with the cached copy.`,
  ],
  "app/routes/admin.posts.new.tsx#0": [
    "CONTRACT",
    "why the handle is unconditional",
    `THE MATH STYLESHEET, ALWAYS, for the same reason as the edit route: the
exact-preview pane copies this document's stylesheets into its iframe, so an
author typing an expression needs the sheet on the page they are typing on.`,
  ],
  "app/routes/admin.posts.new.tsx#1": [
    "WHY",
    "why the marks were added without reordering",
    `FOUR SERIAL AWAITS, three inside the returned object literal. Marked without
reordering, so the numbers describe what ships.`,
  ],
  "app/routes/admin.posts.new.tsx#2": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.new.tsx#3": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.new.tsx#4": [
    "CONTRACT",
    "the save gate remains the authority",
    `So the slug field can say "taken" while the author is still typing rather than
after a round trip that gets refused. The save gate remains the authority; this
only saves a wasted submit.`,
  ],
  "app/routes/admin.posts.new.tsx#5": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.new.tsx#6": [
    "CONTRACT",
    "why the primary is Publish",
    `A post that does not exist yet is a draft that has never been public, so the
primary action is Publish behind the ceremony, exactly as it would be on the
first edit after creating it.`,
  ],
  "app/routes/admin.posts.new.tsx#7": [
    "CONTRACT",
    "why the same second step applies",
    `A post that has never existed has never been public, so its first save with a
publish intent is a first publication and gets the same second step the edit
route renders.`,
  ],
  "app/routes/admin.posts.$slug.history.tsx#0": [
    "CONTRACT",
    "header: ruling 1 and the structural guarantee; the removed action goes to the history document",
    `Version history for one post. READ ONLY.

Git already holds the history, so this is a window onto it. Ruling 1 says a
restore LOADS a revision into the editor as unsaved content and that every
mutation stays on the one existing write path, so restoring happens in the
editor's drawer where the author sees the change before deciding to keep it.

This page exports NO action at all. A POST here answers 405.`,
  ],
  "app/routes/admin.posts.$slug.history.tsx#1": ["CONTRACT", "already at size"],
  "app/routes/admin.posts.$slug.history.tsx#2": [
    "CONTRACT",
    "why there is no control here",
    `No restore control here. Ruling 1 moved restoring into the editor's drawer,
where it loads rather than writes, and leaving a second one here would have been
a second way to commit wearing the same word.`,
  ],
  "app/components/admin/row-menu.tsx#0": [
    "CONTRACT",
    "header: the one-control rule, the no-script mechanism and the naming rule; the count goes to the history document",
    `ONE ACTIONS MENU PER ROW, and it is borderless: a bordered box on every row is
fifteen more rectangles to look past, so the trigger draws only its dots until it
is hovered or focused.

It opens with no script because it is a \`<details>\`, and every item inside is a
real link or a real submit button.

THE ACCESSIBLE NAME NAMES THE ROW, never just "Actions": fifteen controls all
announcing "Actions" tell a screen reader user nothing about which post they act
on.`,
  ],
  "app/components/admin/row-menu.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/row-menu.tsx#2": [
    "CONTRACT",
    "why the dots are drawn",
    `Three dots, drawn rather than typed: U+22EE renders at the mercy of whatever
font has it, and this is a 24px target that has to line up with the 32px controls
beside it.`,
  ],
  "app/components/admin/alert.tsx#0": [
    "CONTRACT",
    "header: the live-region prohibition and what replaces it",
    `A standing condition the operator has to act on, with the action that fixes it
attached.

THE ROLE IS THE POINT. \`role="alert"\` and \`role="status"\` are LIVE regions:
they exist to interrupt with something that just happened. Drift is not an event,
it is a state the site is in, rendered into the first byte of HTML on every
visit, so announcing it as news would be wrong twice over.

So it is a named region instead, which puts it in the landmark list where a
screen reader user can find it on purpose and leaves it silent until they do.`,
  ],
  "app/components/enhancement-script.tsx#0": [
    "CONTRACT",
    "header: how every public enhancement loads, the optional nonce, and the CSP that makes an unnonced tag inert",
    `A nonced module script tag for one prebuilt enhancement bundle. \`type="module"\`
gives deferred execution, so the markup a bundle upgrades exists before the
bundle runs, and the browser de-duplicates by URL.

The nonce is OPTIONAL because on the error-boundary path the root loader never
ran and there is nothing honest to stamp. \`script-src\` is the nonce plus
\`strict-dynamic\` and carries no \`'self'\`, so the browser then refuses the
fetch. An error page costs its enhancements and nothing else, and the markup
they would have upgraded still works, which is rule 9's fallback doing its job.`,
  ],
  "app/lib/scientific-names.tsx#0": [
    "CONTRACT",
    "header: stored strings are never touched",
    `Render-time italicization of organism names. Stored strings are never touched:
titles and abstracts stay byte-identical to what the registries returned, which
is what keeps the search haystack, the JSON-LD headline and the meta description
working off plain text.`,
  ],
  "app/lib/scientific-names.tsx#1": [
    "CONTRACT",
    "why the order and the boundaries matter",
    `ORGANISMS is ordered longest first, and regex alternation takes the first
branch that matches at a position, so the trinomial wins over the binomial. Word
boundaries stop a bare genus matching inside a longer word.`,
  ],
  "app/lib/scientific-names.tsx#2": [
    "CONTRACT",
    "header: why nodes and not markup",
    `Returns React nodes, never markup, so nothing here needs
\`dangerouslySetInnerHTML\` and the input is never parsed as HTML.`,
  ],
  "app/lib/scientific-names.tsx#3": ["CONTRACT", "already at size"],
  "app/components/admin/media-picker.tsx#0": [
    "CONTRACT",
    "header: one component, one query",
    `THE PICKER. One component, consumed by the editor drawer today and usable by
any later consumer: the drawer contains no picker logic of its own, which is the
difference between one media surface and two that drift.

It reads the media page's loader rather than a listing endpoint of its own, so
what a picker shows and what the library shows come from the same query.`,
  ],
  "app/components/admin/media-picker.tsx#1": ["CONTRACT", "already at size"],
  "app/components/admin/media-picker.tsx#2": ["CONTRACT", "already at size"],
  "app/components/admin/media-picker.tsx#3": [
    "CONTRACT",
    "the thumbnail prohibition",
    `The THUMBNAIL, never the original. \`thumb\` carries the transform URL the
server built, so the grid cannot accidentally pull full-resolution bytes.`,
  ],
  "app/components/ask-panel.tsx#0": [
    "CONTRACT",
    "header: the hidden-until-listening rule and where the real guard lives",
    `The Ask affordance on /search. Server-rendered markup and a script tag, no
React island: the button ships HIDDEN and the prebuilt bundle unhides and binds
it, so a reader without script never sees an inert control that looks live and
does nothing. Classic results are already rendered by the loader, and nothing
here can delay them.

\`search.tsx\` renders this only when the binding exists and the query is a real
question, so the bundle's own empty-question guard is a backstop, not the rule's
home.`,
  ],
  "app/components/blog-enhancements.tsx#0": [
    "CONTRACT",
    "header: why the bundle must be prebuilt; the React-effect history goes to the history document",
    `A nonced module script tag pointing at the prebuilt bundle of
\`app/enhance/blog.ts\`. THE BUNDLE MUST BE PREBUILT: \`?url\` serves the file
verbatim and does not compile, so pointed at the \`.ts\` source it serves raw
TypeScript.

A reader with JavaScript disabled never runs the bundle and loses nothing but
decoration.`,
  ],
  "app/components/admin/media-display-group.tsx#0": ["CONTRACT", "already at size"],
  "app/components/admin/media-display-group.tsx#1": [
    "CONTRACT",
    "header: why links and not a select",
    `LINKS, not buttons, and not a \`<select>\`. Every one is a different URL, so
making them links is what lets the whole display state be shared, bookmarked and
restored by the back button with no script at all. A select would need an
\`onChange\` to navigate.`,
  ],
  "app/components/admin/overflow-menu.tsx#0": [
    "CONTRACT",
    "header: where the behaviour lives now; the extraction date goes to the history document",
    `The cockpit's overflow menu: a labelled button that reveals a panel of
secondary actions. Its keyboard and dismissal behaviour live in
\`useDisclosure\`, shared with \`RowMenu\`; the grounds for the disclosure pattern
and the ARIA choice are beside the hook.`,
  ],
  "app/routes/admin.logout.tsx#0": [
    "CONTRACT",
    "what the route does and why the header is forwarded",
    `POST /admin/logout: signs out via Better Auth, clearing the KV session and the
cookie, and redirects to the login screen. \`asResponse\` hands back the
Set-Cookie header to forward.`,
  ],
};
