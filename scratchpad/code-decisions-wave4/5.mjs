// Chunk 5: app/components/admin/media-grid.tsx (0-38) and app/routes/playground.tsx (0-47).
// 87 blocks.
//
// Same rule: contracts at 180 bytes or less, headers at ~370, separators keep their label and
// lose the dashes. playground.tsx carries twelve separators and they are all label-only.
//
// media-grid's protected class is the one-markup-tree rule and what follows from it: the list
// is CSS over the same elements, so the layout cannot change which submissions the page can
// issue (#0, #3, #29, #35). Beside it sit a plain-list-not-role-grid statement (#2), the
// button-inside-anchor prohibition (#20), the conditional LQIP that stops every SVG rendering
// as a black hole (#23), and the forbidden word "unused" (#34).
//
// playground's two laws (#3) are the file's whole contract and stay as a header: every demo
// runs the real code path, and every result state is a URL the server renders. The dated
// document-load figures inside it go to the history document; the laws do not.
export default {
  "app/components/admin/media-grid.tsx#0": [
    "CONTRACT",
    "header: the one-tree rule; the move date goes to the history document",
    `THE LIBRARY ITSELF: one markup tree, two layouts. Grid and list are the same
elements under different data attributes, so the layout cannot change which
submissions the page can issue.`,
  ],
  "app/components/admin/media-grid.tsx#1": [
    "CONTRACT",
    "why the member is selected rather than the property read",
    `The loader returns a UNION of three shapes and only the listing carries these
fields, so the member is selected rather than the property read off the union.
One owner: the loader.`,
  ],
  "app/components/admin/media-grid.tsx#2": [
    "CONTRACT",
    "the accessibility prohibition",
    `NOT \`role="grid"\`: positional information is meaningless to a screen reader
here, because the column count depends on the container width and directional
navigation does not help anyone find a picture.`,
  ],
  "app/components/admin/media-grid.tsx#3": [
    "CONTRACT",
    "the one-tree rule and what a second branch would cost",
    `ONE MARKUP TREE, TWO LAYOUTS, selected by data attributes. A second branch of
JSX is a second place for a control to go missing, and \`check:admin-ui\` would
then have to prove both carry the same submissions.`,
  ],
  "app/components/admin/media-grid.tsx#4": [
    "CONTRACT",
    "the nesting prohibition and the fixture consequence",
    `THE FORM WRAPS THE GRID so the checkboxes are part of the same submission.
Nesting it inside the toolbar would put a form inside a form, which the browser
drops. Rendered only when something is selected, which is why the two bulk
intents appear in the fixture only under the seeded-selection state.`,
  ],
  "app/components/admin/media-grid.tsx#5": [
    "WHY",
    "which question the number answers",
    `THE SIZE OF WHAT IS SELECTED, which is the question somebody selecting a dozen
files is actually asking: a count of twelve says nothing about whether they are
thumbnails or a conference poster.`,
  ],
  "app/components/admin/media-grid.tsx#6": [
    "CONTRACT",
    "why it cannot submit, and the line shape",
    `\`type="button"\` so it never submits the form it sits inside, and the only
client-side control in this bar. One address per line, because that is what
pastes usefully and a comma-separated list is not.`,
  ],
  "app/components/admin/media-grid.tsx#7": ["CONTRACT", "already at size"],
  "app/components/admin/media-grid.tsx#8": [
    "CONTRACT",
    "the ladder position and why the button cannot submit",
    `Reversible, touches no object and no public URL, so it takes a plain
confirmation rather than the type-the-count ceremony reserved for the
irreversible delete. A \`type="button"\` opens the modal, because submitting from
here would skip it.`,
  ],
  "app/components/admin/media-grid.tsx#9": ["CONTRACT", "already at size"],
  "app/components/admin/media-grid.tsx#10": [
    "WHY",
    "keeps the page-local ruling and the braces prohibition; the leak story goes to the history document",
    `GROUPED PAGE-LOCAL: each page buckets the rows IT HAS and a group never spans a
page boundary, so the heading counts THIS PAGE and says so.

BRACED. Without the braces this is JSX CHILDREN TEXT and the whole paragraph
renders on the page.`,
  ],
  "app/components/admin/media-grid.tsx#11": [
    "WHY",
    "why the header is not repeated",
    `THE HEADER ROW, ONCE, above every group: column headings describe the TABLE,
and one per folder would say the same five words four times while making each
group look like a table of its own.`,
  ],
  "app/components/admin/media-grid.tsx#12": [
    "CONTRACT",
    "what the note prevents, and the contrast floor; the rejected hex goes to the history document",
    `The note is the reason this grouping exists: it is what stops somebody deleting
nine photographs because a post-level tracker called them unreferenced. Quiet by
SIZE and WEIGHT, never by an unreadable grey.`,
  ],
  "app/components/admin/media-grid.tsx#13": ["CONTRACT", "already at size"],
  "app/components/admin/media-grid.tsx#14": [
    "CONTRACT",
    "the one-definition rule",
    `Both come from the pure module: \`usage\` arrives from the loader and
\`flagsFor\` is the one definition of what a flag is, so the lens that selects
rows and the badge that labels them cannot drift.`,
  ],
  "app/components/admin/media-grid.tsx#15": [
    "CONTRACT",
    "keeps no-new-client-state and the hover prohibition; the mockup comparison goes to the history document",
    `NO NEW CLIENT STATE: both halves already exist, so the caption is a function of
state the page already holds.

Deliberately NOT on hover. Hover is not a state the server can render, and
reaching it would mean script or a CSS rule revealing a control the keyboard
cannot get to first.`,
  ],
  "app/components/admin/media-grid.tsx#16": [
    "CONTRACT",
    "why the attribute is the key",
    `The keyboard navigator addresses tiles by this attribute and reads their
rendered boxes for the geometry. The key rather than an index, so a reflow
cannot change what it means.`,
  ],
  "app/components/admin/media-grid.tsx#17": [
    "CONTRACT",
    "the one-grammar rule",
    `The checkbox carries \`key\`, which is what the bulk action reads. Same shape as
the posts index's \`slug\`, so the two bulk surfaces are one grammar.`,
  ],
  "app/components/admin/media-grid.tsx#18": [
    "CONTRACT",
    "the keyboard behaviour that falls out of it",
    `\`nativeEvent\` carries the modifier a change event does not expose. Keyboard
activation reports \`shiftKey\` false, so Space still toggles one row, which is
what a keyboard reader expects.`,
  ],
  "app/components/admin/media-grid.tsx#19": [
    "CONTRACT",
    "why the ratio is on the wrapper; the ragged-grid story goes to the history document",
    `A FIXED BOX, declared as \`aspect-ratio\` on the wrapper rather than left to the
image: it reserves the space before the image arrives, so a lazily-loaded tile
cannot reflow the rows below it as it lands.`,
  ],
  "app/components/admin/media-grid.tsx#20": [
    "WHY",
    "the invalid-HTML prohibition",
    `THE FRAME EXISTS SO THE CAPTION CAN BE A SIBLING OF THE LINK RATHER THAN A
CHILD OF IT: a \`<button>\` inside an \`<a>\` is invalid HTML that browsers
resolve differently, so the press either navigates or copies depending on who
you ask.`,
  ],
  "app/components/admin/media-grid.tsx#21": [
    "CONTRACT",
    "what the prop prevents",
    `\`preventScrollReset\` is what stops opening a file throwing the reader back to
the top of the library: \`<ScrollRestoration>\` treats every new location as a new
place, and opening an inspector is looking closer at where you already are.`,
  ],
  "app/components/admin/media-grid.tsx#22": [
    "CONTRACT",
    "keeps the no-script guarantee; the file-manager argument goes to the history document",
    `SHIFT OR META CLICK SELECTS INSTEAD OF OPENING. \`preventDefault\` only inside
the branch, so an UNMODIFIED click is untouched and still a plain link: with no
script it navigates as it always did. The range logic is \`selectRange\`, already
written for the checkbox.`,
  ],
  "app/components/admin/media-grid.tsx#23": [
    "CONTRACT",
    "the conditional is the prohibition; the eleven-of-seventy count goes to the history document",
    `LQIP as a CSS background BEHIND the real image, so the tile is never empty and
the swap needs no script. Set CONDITIONALLY over a token background: the Images
binding does not rasterize vectors, so an SVG has a null placeholder and
\`url(null)\` would render as a black hole.`,
  ],
  "app/components/admin/media-grid.tsx#24": [
    "WHY",
    "keeps the live reason; the superseded premise goes to the history document",
    `\`DocumentCard\` puts a title, a suggestion of text and a size in this space, so
a squashed card would crush the thing that fixed it. 3:2, the ratio every tile
has.`,
  ],
  "app/components/admin/media-grid.tsx#25": [
    "WHY",
    "why a card and not an img; the counts go to the history document",
    `A document has no thumbnail the Images binding can ever produce, so it gets a
CARD rather than an \`<img>\` pointed at something that cannot render one. An
empty box per document read as a loading failure.`,
  ],
  "app/components/admin/media-grid.tsx#26": [
    "CONTRACT",
    "one dot, and where it sits",
    `\`tileFlagFor\` picks the single most urgent flag rather than stacking three on a
small tile. Its \`title\` is the sentence, the dot is the glance. Outside the
caption, so a selected tile shows both.`,
  ],
  "app/components/admin/media-grid.tsx#27": [
    "CONTRACT",
    "the one-control rule and its accessibility reason",
    `It is the tile's ONLY copy control when it renders: two buttons with the same
accessible name on one card is a thing a screen reader reads twice and a pointer
picks between for no reason.`,
  ],
  "app/components/admin/media-grid.tsx#28": [
    "WHY",
    "why the absence is not printed here",
    `Dimensions only WHEN THERE ARE ANY: a document has none, and spending the
caption's second line saying a PDF is not a picture is a phrase in the way. The
list has a column, where a blank cell is a value.`,
  ],
  "app/components/admin/media-grid.tsx#29": [
    "CONTRACT",
    "why the wrapper stops laying out",
    `THE BODY IS \`display: contents\` IN BOTH LAYOUTS, which is what keeps this one
markup tree while the list becomes a real table: a row's cells have to be grid
items of the row, and they cannot be if a wrapper sits between them.`,
  ],
  "app/components/admin/media-grid.tsx#30": ["CONTRACT", "already at size"],
  "app/components/admin/media-grid.tsx#31": [
    "CONTRACT",
    "why the last segment, and where the key stays",
    `The LAST SEGMENT, linking to the detail view, which is also the no-script route
to the address. A content-addressed key is an ADDRESS and reads as noise, so the
name the author gave identifies it to a human.`,
  ],
  "app/components/admin/media-grid.tsx#32": [
    "CONTRACT",
    "why the clamp is per layout; the worked example goes to the history document",
    `THE CLAMP IS THE GRID'S, AND ONLY THE GRID'S. Every truncation cuts the END,
which is the half that distinguishes, and a narrow tile genuinely has no room
where a list row does.`,
  ],
  "app/components/admin/media-grid.tsx#33": [
    "CONTRACT",
    "why the directory comes back in the list",
    `THE DIRECTORY, LIST ONLY. Without it, two files with the same basename in
different directories are one row printed twice; the tile drops it because it
has no width to spend.`,
  ],
  "app/components/admin/media-grid.tsx#34": [
    "WHY",
    "the forbidden word is the prohibition; the drift story goes to the history document",
    `**"unused" IS FORBIDDEN HERE.** It is the exact claim the usage ruling says this
page may never make: the repository scan cannot see a constructed path and
nothing here can see an external site linking a file. This reads the SAME
descriptor every other surface reads.`,
  ],
  "app/components/admin/media-grid.tsx#35": [
    "CONTRACT",
    "hidden not omitted, and why an absence is spelled",
    `Hidden in the grid by CSS rather than omitted from the markup, per the one-tree
rule. A cell reading "not measured" is doing work: printing 0x0 or an empty cell
would both read as a value rather than an absence.`,
  ],
  "app/components/admin/media-grid.tsx#36": [
    "CONTRACT",
    "the second-channel rule",
    `Three states rather than two, because \`used\` and \`unattached\` could not
express the roster photographs. The dot is a SECOND CHANNEL beside a word, never
the signal itself, so a reader who cannot separate the hues loses nothing.`,
  ],
  "app/components/admin/media-grid.tsx#37": ["CONTRACT", "already at size"],
  "app/components/admin/media-grid.tsx#38": [
    "CONTRACT",
    "why it is the card's last child; the old placement goes to the history document",
    `THE COPY CONTROL, ONE PER CARD, as the card's last child. Explicit grid
placement puts it beside the name in the grid view while the row gains its
column. It renders here only when the caption bar is not already carrying it.`,
  ],
  "app/routes/playground.tsx#0": [
    "CONTRACT",
    "why the export is named, and the no-new-bytes fact",
    `Behind a NAMED server export: a side-effect import binds no name and React
Router's server-code removal traces NAMES, so a bare import failed the build. NO
NEW BYTES IN THE WORKER, which is one bundle.`,
  ],
  "app/routes/playground.tsx#1": [
    "CONTRACT",
    "the one-statement rule",
    `IMPORTED, never restated: that module is the only statement of the key grammar
in the repository, and the last time there were more they had already drifted
into two answers for one key.`,
  ],
  "app/routes/playground.tsx#2": [
    "CONTRACT",
    "why the resolver is imported",
    `The theme resolver, IMPORTED: it is the function \`workers/app.ts\` calls to
build its cache key and \`root.tsx\` calls to write \`data-theme\`, so a demo that
reimplemented it would keep agreeing with itself while the site disagreed.`,
  ],
  "app/routes/playground.tsx#3": [
    "CONTRACT",
    "header: the two laws; the corrections and the dated load figures go to the history document",
    `/playground, the interactive index of this site's own machinery.

TWO LAWS GOVERN THIS FILE.

1. EVERY DEMO RUNS THE REAL CODE PATH. Nothing here reimplements a rule,
   because a demo of a reimplementation would keep working while the thing it
   claims to show was broken.

2. EVERY RESULT STATE IS A URL, AND THE SERVER RENDERS IT. Every demo is a GET
   form whose entire input is the query string, so a pasted URL renders
   identically for the recipient. This route does not opt into hydration, so no
   router runtime ships and the forms submit natively for every reader, which is
   what satisfies hard rule 9 here.

NO USER INPUT IS PERSISTED ANYWHERE. The analytics point carries the bare path
and never the query string.

THE FORMS CARRY HIDDEN FIELDS because three demos share one URL, so submitting
one would otherwise wipe the other two.

CACHE-CONTROL IS EXPLICIT, per hard rule 8: with the Workers cache on, a
response carrying none is CACHED rather than skipped.`,
  ],
  "app/routes/playground.tsx#4": [
    "CONTRACT",
    "header: why the manifest owns the data",
    `Presets and fixtures come from the MANIFEST, not from this file.
\`content/playground.json\` is the one source: this route renders from it and
\`check:features\` asserts against it. If the data lived here the gate would have
to restate it, and a gate whose expected values come from a copy of the input is
checking itself.`,
  ],
  "app/routes/playground.tsx#5": [
    "CONTRACT",
    "the enum prohibition and the threat-model reason",
    `AN ENUM, NOT A TEXT BOX, and an unknown value is REPORTED with the default
rendered. There is no way to put a character of your own into this renderer: the
pipeline runs a highlighter over a WebAssembly regex engine, which needs a
threat model of its own before it opens to the public plane.`,
  ],
  "app/routes/playground.tsx#6": [
    "CONTRACT",
    "imported so the demo cannot offer what the renderer rejects",
    `The mark enum, IMPORTED from the module that owns it, so the demo can never
offer a mark the renderer would reject. \`check:features\` argues the manifest's
list against it.`,
  ],
  "app/routes/playground.tsx#7": [
    "CONTRACT",
    "the cap is stated; the generosity argument goes to the history document",
    `The loader cuts at this length and SAYS SO, because a cap enforced in the
loader and unstated in the UI is a silent truncation. There is no other bound:
every function this demo calls is pure string work over one argument.`,
  ],
  "app/routes/playground.tsx#8": [
    "CONTRACT",
    "two bounds, and why the second is a refusal",
    `TWO, and the second is not a length. SHAPE: printable ASCII only, a REFUSAL
rather than a cut, because a control character in a header value makes
\`new Request\` throw and a demo whose input can crash its own loader answers some
readers with a stack trace.`,
  ],
  "app/routes/playground.tsx#9": [
    "WHY",
    "tagged by what STAYS; the before-state goes to the history document",
    `\`pageMeta\` carries the whole set, so a shared link renders as a card rather
than a bare URL.`,
  ],
  "app/routes/playground.tsx#10": [
    "CONTRACT",
    "why the types are named",
    `The hast types, so neither side of this is an escape: \`check:slop\` makes a
type assertion an error, and an assertion here would hide a wrong tree shape.`,
  ],
  "app/routes/playground.tsx#11": ["CONTRACT", "separator: label kept, dashes dropped", `lab`],
  "app/routes/playground.tsx#12": [
    "CONTRACT",
    "the same-parser rule",
    `Validated through the SAME parser that computes, so the page cannot accept a
string the maths would throw on, or refuse one it would have taken.`,
  ],
  "app/routes/playground.tsx#13": ["NUMBER", "already at size; carries the WCAG citation and the two floors"],
  "app/routes/playground.tsx#14": ["CONTRACT", "separator: label kept, dashes dropped", `search`],
  "app/routes/playground.tsx#15": [
    "CONTRACT",
    "the real-path law, restated locally",
    `The real search, with the flag that attaches what \`fuse()\` already recorded.
No query changes, no ordering changes, and no scoring rule restated.`,
  ],
  "app/routes/playground.tsx#16": ["CONTRACT", "separator: label kept, dashes dropped", `key`],
  "app/routes/playground.tsx#17": [
    "CONTRACT",
    "the refusal is a result, and catching does not soften it",
    `THE CLASSIFIER'S REFUSAL IS A RESULT, not an error page. \`classify()\` throws on
an unknown extension deliberately, so a new file type stops a build rather than
acquiring a plausible kind nobody chose. Catching it here does not soften it:
every other caller still gets the throw.`,
  ],
  "app/routes/playground.tsx#18": ["CONTRACT", "separator: label kept, dashes dropped", `theme`],
  "app/routes/playground.tsx#19": [
    "CONTRACT",
    "why presence and not truthiness",
    `PRESENCE, NOT TRUTHINESS. The empty cookie header is a REAL case: the reader
who has chosen nothing, which is the default branch the whole anti-flash design
rests on, and keying on \`params.has\` is what lets it have a URL.`,
  ],
  "app/routes/playground.tsx#20": [
    "CONTRACT",
    "why the request is real, and the absent-header distinction",
    `A REAL REQUEST, because the real function takes one. Constructed with no cookie
header at all when the input is empty, which is a different thing from an empty
one and is the state a first-time reader arrives in.`,
  ],
  "app/routes/playground.tsx#21": ["CONTRACT", "separator: label kept, dashes dropped", `markdown`],
  "app/routes/playground.tsx#22": [
    "CONTRACT",
    "reported rather than corrected",
    `Reported rather than silently corrected, the same rule the chart demo follows:
a hand-edited URL says what happened instead of quietly rendering something
else.`,
  ],
  "app/routes/playground.tsx#23": [
    "CONTRACT",
    "the real-renderer law and what the wrapper adds",
    `THE REAL RENDERER, through the server wrapper: the same \`renderBody\` call the
deploy build makes for every post. The wrapper adds the WASM instantiator and an
image resolver that REFUSES, and nothing else.`,
  ],
  "app/routes/playground.tsx#24": [
    "CONTRACT",
    "why the refusal branch exists",
    `A REFUSAL IS A RESULT. One of the three snippets exists to earn this, and it is
the branch a published article can never show: an article carrying an unknown
directive would never have been published.`,
  ],
  "app/routes/playground.tsx#25": ["CONTRACT", "separator: label kept, dashes dropped", `chart`],
  "app/routes/playground.tsx#26": [
    "CONTRACT",
    "reported rather than corrected",
    `An out-of-enum value is reported rather than silently corrected. This is the
only place the demo can disagree with its input.`,
  ],
  "app/routes/playground.tsx#27": [
    "CONTRACT",
    "what the wrapper owns",
    `\`renderChartHast\` returns the FIGURE'S CHILDREN, not the figure, so the
wrapper and its class are this route's responsibility: without \`.chart-figure\`
the stylesheet's chart rules never apply.`,
  ],
  "app/routes/playground.tsx#28": ["CONTRACT", "already at size; carries the no-toast prohibition"],
  "app/routes/playground.tsx#29": [
    "CONTRACT",
    "header: why it reads the manifest and why it throws; the duplicated literals go to the history document",
    `A demo input's declared default, read out of the manifest rather than restated.
The manifest is the JS-side owner of these token values, because a Worker cannot
read the stylesheet.

Throws rather than defaulting: an input rendered with no value is a form that
silently stops demonstrating anything.

@param {string} demoSlug the demo's slug in the manifest
@param {string} inputName`,
  ],
  "app/routes/playground.tsx#30": [
    "CONTRACT",
    "why the key is the slug; the failure mode goes to the history document",
    `KEYED BY SLUG, not a positional index. An index couples the page's ORDER to the
manifest's silently: insert a demo anywhere but the end and every section below
renders another demo's title over its own form, with nothing failing.`,
  ],
  "app/routes/playground.tsx#31": [
    "WHY",
    "the fail-closed rule",
    `FAIL CLOSED ON A MISSING DEMO rather than rendering an empty header: a heading
with no title reads as a styling bug and sends the next reader to the
stylesheet.`,
  ],
  "app/routes/playground.tsx#32": ["CONTRACT", "already at size; carries the carry rule"],
  "app/routes/playground.tsx#33": [
    "CONTRACT",
    "carried on presence, matching the loader",
    `Carried on PRESENCE, matching the loader: an empty cookie is a real result
here, so dropping it would lose that demo's state on any other demo's submit.`,
  ],
  "app/routes/playground.tsx#34": ["CONTRACT", "separator: label kept, dashes dropped", `contrast`],
  "app/routes/playground.tsx#35": ["CONTRACT", "separator: label kept, dashes dropped", `search`],
  "app/routes/playground.tsx#36": [
    "WHY",
    "the prohibition, and why it follows from the second law",
    `NO TIMING HERE, deliberately. A wall-clock reading is the one value that would
differ between two fetches of the same URL, and this page's contract is that a
result URL renders identically wherever it is opened.`,
  ],
  "app/routes/playground.tsx#37": ["CONTRACT", "already at size"],
  "app/routes/playground.tsx#38": ["CONTRACT", "separator: label kept, dashes dropped", `chart`],
  "app/routes/playground.tsx#39": ["CONTRACT", "already at size; carries the first-party grounds"],
  "app/routes/playground.tsx#40": ["CONTRACT", "separator: label kept, dashes dropped", `media key`],
  "app/routes/playground.tsx#41": ["CONTRACT", "already at size; carries the shareable-result rule"],
  "app/routes/playground.tsx#42": [
    "CONTRACT",
    "the refusal is a result, not a fault",
    `THE REFUSAL, verbatim, and it is a result rather than a fault: shown in the
ordinary error block because that is what a refusal looks like everywhere else
on this page.`,
  ],
  "app/routes/playground.tsx#43": ["CONTRACT", "separator: label kept, dashes dropped", `theme`],
  "app/routes/playground.tsx#44": [
    "CONTRACT",
    "why the absence is spelled out",
    `THE ABSENCE IS THE ANSWER for a reader on system, so it is spelled out rather
than rendered as an empty cell: an empty cell reads as a bug, "omitted" reads as
the mechanism it is.`,
  ],
  "app/routes/playground.tsx#45": ["CONTRACT", "separator: label kept, dashes dropped", `markdown`],
  "app/routes/playground.tsx#46": [
    "WHY",
    "the mirror prohibition",
    `The snippet verbatim, in a plain \`<pre>\`. NOT run through the highlighter:
this is the INPUT, and highlighting it would render the demo's subject with the
demo's subject.`,
  ],
  "app/routes/playground.tsx#47": [
    "CONTRACT",
    "why it is injected, and why it gets the article treatment",
    `Rendered into \`.prose\`, the same treatment an article body gets, because it IS
an article body: it came out of the same call. Injected for the same reason the
chart is, which is that it contains no third-party input.`,
  ],
};
