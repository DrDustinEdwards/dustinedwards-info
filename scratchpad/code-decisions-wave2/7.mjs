// Chunk 7: scripts/check-microformats.mjs blocks 0-59, scripts/check-logo.mjs blocks 0-47.
//
// Wave 1's rule. These two are the wave's densest in CITATIONS, nine and one, and every one is
// load-bearing, so each stays on a single line: a citation that wraps resolves to nothing and
// is invisible to check:invariants section 15.
//
// Both files also argue at length about WHERE a section lives and WHY a parser rather than a
// regex. The placement arguments go. What survives is what each instrument can and cannot see,
// because that is the half a reader needs before trusting a green run.
export default {
  "scripts/check-microformats.mjs#0": [
    "CONTRACT",
    "the boundary, why a parser, fixture independence and the fail-closed rule; the placement argument, the rejected reader and the practical-effect paragraph go to the history document",
    `Gate: the microformats2 annotations on the public plane, parsed rather than grepped.

  npm run check:microformats

BOUNDARY: it RENDERS THE THREE PUBLIC ROUTE COMPONENTS in Node and parses the result, so it
sees markup and nothing else: no loader, no D1, no network, no CSS, no Worker. A page that
500s in production still parses here. Hard rule 7 is why this is not folded into
\`check:content\`: widening that gate would mean deleting a boundary note in order to make its
own description of itself false.

A REAL PARSER, NOT A REGEX, because a grep asserts that a STRING is present while the property
is what a CONSUMER READS: \`u-url\` on an element with no href, an h-card nested one level too
deep, both pass a search and give a reader nothing.

FIXTURE INDEPENDENCE. Hard rule 10: a gate's expected values are never produced by the process
it checks, so \`dt-published\` is compared against a deliberately separate read of the markdown.

FAILS CLOSED: an empty corpus, a route that renders nothing, a parse that finds no items are
each a failure with a name.`,
  ],
  "scripts/check-microformats.mjs#2": [
    "CONTRACT",
    "why this argument order and the citation, in two lines",
    `\`assert(label, ok, detail)\`, deliberately not the other two shapes in this repo: a call copied
out of a gate using \`ok(label, condition)\` is a ReferenceError here rather than a silent pass.
Hard rule 10, ninth class.

@param {string} label
@param {boolean} passed
@param {string} [detail]`,
  ],
  "scripts/check-microformats.mjs#3": [
    "WHY",
    "why a second read, why the scope is bounded and where the path comes from; the section 15b catch goes to the history document",
    `A SECOND, NARROW READ ON PURPOSE: asking the pipeline for the expected value would compare it
against itself and the assertion would be \`x === x\`. Bounded to the frontmatter block, so a
\`date:\` in prose cannot be mistaken for the field. THE PATH COMES FROM \`postPath()\`, because
Hard rule 6 says that shape is stated once by that export.

@param {string} slug
@returns {Promise<string>} an ISO instant`,
  ],
  "scripts/check-microformats.mjs#4": ["WHY", "one line already; kept"],
  "scripts/check-microformats.mjs#5": ["CONTRACT", "one owner for the lookup; already short"],
  "scripts/check-microformats.mjs#6": ["CONTRACT", "why flattened; already short"],
  "scripts/check-microformats.mjs#10": ["CONTRACT", "section marker, rule padding cut", `The corpus, and the scope proof`],
  "scripts/check-microformats.mjs#11": [
    "WHY",
    "why it is built and why the failure is named",
    `BUILT HERE, not read off disk: the generated artifact is a gitignored local product and a
stale one would have this gate certify a corpus nobody is serving. The missing-file failure is
NAMED rather than thrown as ENOENT, because "no such file" about a generated path sends the
reader looking for a missing source.`,
  ],
  "scripts/check-microformats.mjs#13": [
    "WHY",
    "the first discipline with its citation, in two lines",
    `SCOPE PROVEN NON-EMPTY BEFORE ANYTHING IS ASSERTED: a sweep over zero posts reports what a
clean sweep reports, and this section is a per-post loop. Hard rule 10, first discipline.`,
  ],
  "scripts/check-microformats.mjs#14": [
    "WHY",
    "why one source for expectation and subject, and why its own bundle call; the rejected alternatives go to the history document",
    `\`app/lib/seo.ts\` RIDES THROUGH THE SAME BUNDLER, so the expectation and the subject share ONE
source: the assertion is "the h-card names the site's author", not "it says a particular
string". IN ITS OWN BUNDLE CALL, because esbuild derives \`outbase\` from the common parent of
its entry points, and mixing it in with the routes moves every output under a subdirectory
while the helper's basename lookup fails on a path that looks correct.`,
  ],
  "scripts/check-microformats.mjs#17": ["CONTRACT", "why the built record; already short"],
  "scripts/check-microformats.mjs#18": [
    "WHY",
    "why the mentions block is empty here",
    `NO MENTIONS. That block carries no microformats class and its text is a stranger's, so
feeding it would put third-party-shaped fixtures into a gate about first-party markup.`,
  ],
  "scripts/check-microformats.mjs#19": [
    "WHY",
    "what the wrong field arranged never to see, and the one honest difference; the live parse date goes to the history document",
    `THE SAME SOURCE THE SYNC USES, through the same function. This was the FRONTMATTER field,
which no post carries, so \`dt-updated\` was absent on every render here while the deployed page
carried it on every post: the gate was asserting a property it had arranged never to see.

ONE HONEST DIFFERENCE, a bug in neither place: with no revision date the SYNC writes
\`unixepoch()\` rather than null, and the assertion below is the PAIRING, so it holds either way.`,
  ],
  "scripts/check-microformats.mjs#20": ["CONTRACT", "section marker, rule padding cut", `1. Every published post page is one complete h-entry`],
  "scripts/check-microformats.mjs#22": [
    "WHY",
    "why exactly one, in two lines",
    `EXACTLY ONE, not at least one: a page that grew a second h-entry publishes two competing
answers to "what is this page", and a consumer takes the first.`,
  ],
  "scripts/check-microformats.mjs#23": [
    "WHY",
    "why it is asserted as the body and why by length",
    `e-content IS ASSERTED AS THE BODY, not merely as present, because the html half is what a
consumer republishes and a class on an empty wrapper still satisfies "has content". Compared by
length rather than byte for byte: the parser normalises whitespace and resolves relative URLs,
so equality would be an assertion about the parser.`,
  ],
  "scripts/check-microformats.mjs#25": ["WHY", "where each side comes from; two lines already"],
  "scripts/check-microformats.mjs#27": [
    "WHY",
    "why the gate is conditional in both directions",
    `dt-updated IS CONDITIONAL AND THE GATE IS CONDITIONAL WITH IT, both ways. Requiring the
property everywhere would demand markup for a fact most posts do not have. What IS asserted is
the pairing: a page showing "Updated" with no \`dt-updated\` is a defect, and so is the reverse.`,
  ],
  "scripts/check-microformats.mjs#28": [
    "WHY",
    "why the count must not move with the checkout, and where the threshold stays owned; the CI arithmetic goes to the history document",
    `THE VALUE ASSERTION RUNS ON EVERY POST, present or absent, because conditioning it made this
gate's count depend on the ENVIRONMENT: a full clone resolves a commit date for every post and
a shallow one resolves none, and a floor cannot sit under a count that moves with the checkout.
The expectation is derived from what the PAGE rendered, which keeps the threshold owned by the
route (hard rule 17).`,
  ],
  "scripts/check-microformats.mjs#29": [
    "WHY",
    "why the whole-page count is pinned",
    `NOTHING ELSE ON THE PAGE IS A MICROFORMAT. The mentions list is full of names, links and
timestamps that LOOK like h-entry material, and annotating them would republish a stranger's
text as this site's structured data.`,
  ],
  "scripts/check-microformats.mjs#30": [
    "WHY",
    "why the fixture went and why the split is not asserted; the synthetic control's account goes to the history document",
    `BOTH dt-updated BRANCHES, COUNTED AND PRINTED, and neither is fabricated. A synthetic control
used to sit here because the gate fed a field no post carries, so the property was unreachable
on real data; feeding the sync's own rule removed the need. NOT ASSERTED against a fixed split,
because which branch runs is a property of the clone rather than of the code.`,
  ],
  "scripts/check-microformats.mjs#31": ["CONTRACT", "section marker, rule padding cut", `2. The blog index is one h-feed, holding the page it rendered`],
  "scripts/check-microformats.mjs#34": [
    "WHY",
    "why the count is derived through the route's own helpers",
    `Built THROUGH the route's own paging helpers rather than by slicing to a literal, which is
Hard rule 10: measure floors through the gate's own pipeline. A change to the page size then
moves the expectation and the page together.

@param {number} page`,
  ],
  "scripts/check-microformats.mjs#35": ["CONTRACT", "one line already; kept"],
  "scripts/check-microformats.mjs#36": [
    "WHY",
    "why both ends and why a Set",
    `BOTH ENDS OF THE PAGINATION: page 1 is the only one that can carry a featured post, and the
last is the only one whose length is not the page size, so reading page 1 alone would pass a
route that rendered ten entries whatever it was asked for. A SET, because a corpus that fits on
one page makes those the same page, and the final assertion compares against its size.`,
  ],
  "scripts/check-microformats.mjs#39": [
    "WHY",
    "what the page actually promises; the refuted prompt goes to the history document",
    `THE COUNT IS THE LOADER'S, NOT A LITERAL AND NOT THE CORPUS SIZE. /blog paginates and the
corpus is larger, so "the index carries every published post" could only pass while the corpus
stayed under the page size. What the page promises is that every post it SHOWS is in its feed.`,
  ],
  "scripts/check-microformats.mjs#43": [
    "WHY",
    "why paired in both directions",
    `p-summary IS PAIRED WITH THE DESCRIPTION both ways: requiring it unconditionally would demand
markup for absent data, and accepting its absence would let the class fall off every card
without a single red.`,
  ],
  "scripts/check-microformats.mjs#44": [
    "WHY",
    "what a consumer would be handed",
    `A LISTING ENTRY CARRIES NO e-content: a consumer that finds content on a card has been handed
a description labelled as the article.`,
  ],
  "scripts/check-microformats.mjs#45": ["CONTRACT", "section marker, rule padding cut", `3. The home page carries the site author's h-card`],
  "scripts/check-microformats.mjs#46": [
    "WHY",
    "why the fixture is derived; the dark-block incident goes to the history document",
    `THE HOME FIXTURE IS DERIVED, NOT SUPPLIED. It used to be a third statement of which post
leads the front page, written by the gate supposed to be checking it, and it asserted a section
production did not render at all. Now both arrays are built the way the loader's own helpers
build them, so the gate cannot hand itself a lead.`,
  ],
  "scripts/check-microformats.mjs#49": ["CONTRACT", "why the missing state; two lines already"],
  "scripts/check-microformats.mjs#51": [
    "WHY",
    "why no photo, with its citation, and why the assertion inverts",
    `NO u-photo, ASSERTED: the site publishes no photograph, so a card claiming one would point a
consumer at something that does not exist, which is hard rule 13's substituted value wearing an
h-card. It INVERTS the day a photo lands, which is correct: that should be a deliberate edit.`,
  ],
  "scripts/check-microformats.mjs#54": [
    "WHY",
    "what a moved class would do to the entries",
    `THE h-card MUST NOT SWALLOW THE ENTRIES: if the class moved up to \`<main>\` the entries would
become the card's children and every consumer would read three posts as properties of a person.`,
  ],
  "scripts/check-microformats.mjs#55": ["CONTRACT", "section marker, rule padding cut", `4. No rel="me", no social links. Ruling 50.`],
  "scripts/check-microformats.mjs#56": [
    "WHY",
    "why on the rendered pages and why a named list",
    `ASSERTED ON THE RENDERED PAGES, not by grepping source, because the subject is what a
consumer reads: the parser's own view of every rel catches one however it was written. The
social arm is a NAMED LIST rather than "no outbound links", because the site links out
constantly and what the ruling forbids is these networks.`,
  ],
  "scripts/check-microformats.mjs#58": ["CONTRACT", "section marker, rule padding cut", `Report`],
  "scripts/check-microformats.mjs#59": [
    "NUMBER",
    "what the count is a function of, why the floor is tight and what it costs; three dated re-measurements and the CI proof go to the history document",
    `WHOLE-GATE EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE and never summed. The count is
a function of the corpus size, so it moves when a post is published and steps DOWN when one is
unpublished; \`check:floors\` chose the margin rather than taste.

THE COUNT DOES NOT MOVE WITH THE CHECKOUT, which is load bearing for CI: the \`dt-updated\`
branch flips on a shallow clone and the total is the same either way. WHAT THE TIGHTNESS COSTS:
unpublishing a post breaches this floor, and the repair is a re-measured floor in the same
commit.`,
  ],
  "scripts/check-logo.mjs#0": [
    "CONTRACT",
    "the boundary, the two named gaps and why the fixtures stay; the collapse narrative and the v4 amendment prose go to the history document",
    `Gate over the site mark.

  npm run check:logo

BOUNDARY: it compares the component's path data against the four SVG fixtures, the mark's fill
BINDINGS against a closed set, the icon suite's CONTAINER SHAPE and one tile pixel against a
ruled manifest, and the mark AS RENDERED into a social card against a rasterisation of the
fixture, every pixel. Pure: no network, no database, no build.

IT DOES NOT CHECK CONTRAST, and it resolves exactly one token on both sides of the render
comparison, so a mark bound to the right token where that token has been given the page colour
passes here. THE ICON SUITE IS STILL ONE PIXEL PER RASTER, so an icon whose mark is upside down
passes; that gap is bounded rather than total, the icons being cut from the paths compared
below.

THE FOUR public/*.svg FILES ARE THE FIXTURES, not dead assets and not what the site renders.
Two independent sources argue, and nothing here restates a path, so it fails BOTH directions.`,
  ],
  "scripts/check-logo.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#2": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#3": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#6": [
    "WHY",
    "why comments go first; the check:contrast incident goes to the history document",
    `Strips block comments before anything is located: this file's header names the viewBox and
both hexes, so a parser reading it would find the COMMENT first.

@param {string} source
@returns {string}`,
  ],
  "scripts/check-logo.mjs#7": [
    "WHY",
    "the prohibition and its because; the audit's wrong diagnosis goes to the history document",
    `WEAK ON PURPOSE, and only for SVG. The shared strong stripper must NOT be pointed at SVG: its
line-comment rule eats a PROTOCOL-RELATIVE url, whose slashes follow a quote rather than a
colon, and takes the rest of the line with it. The TSX and CSS call sites below DO use the
shared helper, because a .tsx file has real \`//\` comments this weak form would leave standing.`,
  ],
  "scripts/check-logo.mjs#9": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#11": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#12": ["WHY", "why the strong stripper here; two lines already"],
  "scripts/check-logo.mjs#14": [
    "CONTRACT",
    "section marker plus the scope rule, in one line",
    `The component is shaped the way the collapse assumes. An assertion that can pass by reading
nothing is not an assertion, so the parse counts are asserted before anything is compared.`,
  ],
  "scripts/check-logo.mjs#15": [
    "CONTRACT",
    "section marker plus which viewBox is which",
    `Every fixture is reproduced. viewBoxes[0] is the master, viewBoxes[1] the tight header crop,
in the order the components are declared.`,
  ],
  "scripts/check-logo.mjs#17": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#18": [
    "WHY",
    "what the geometry comparisons could not see, and the closed set; the v4 narrative goes to the history document",
    `Where the five purple paths actually get their colour. Everything above compares GEOMETRY, so
nothing had looked at the CSS BINDING and this file's header could go on describing one that
had stopped being the whole truth.

The mark on the public chrome is bound to \`--mark-on-chrome\` in BOTH themes, and this is what
makes that deliberate: it names both bindings by VALUE and the set is CLOSED, so a third rule
setting fill on this class fails rather than quietly winning the cascade. It does NOT resolve
the tokens to hexes.`,
  ],
  "scripts/check-logo.mjs#19": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#20": [
    "WHY",
    "why a gate narrowed to fit a defect is worse than the defect, and the citation; the build-2 account goes to the history document",
    `TWO BINDINGS. The second asserts that the phage mark RENDERS ON THE BAR. A build once replaced
the header with a text-only wordmark, this gate caught it, and the gate was cut to one binding
with a justification written to fit the defect. THAT IS WORSE THAN THE DEFECT: a gate narrowed
to accommodate an omission lets the next one through in silence. Restored FIRST and watched to
fail, which is hard rule 12.`,
  ],
  "scripts/check-logo.mjs#21": [
    "WHY",
    "the dichotomy lesson and what actually moved; the tokens, the dates and the ratio go to the history document",
    `THE TOKEN WENT AND CAME BACK, and the round trip is the lesson. The measurement behind moving
it was correct: on the bar as it then was, the mark was a silhouette of its own background. The
CONCLUSION was wrong, because the question asked was "which token survives this bar" when it
was "why did the bar change", and a dichotomy inherits its author's frame. The COUNT is what
caught the missing mark, and it has been two throughout.`,
  ],
  "scripts/check-logo.mjs#22": [
    "WHY",
    "why the whole set and not one file; the split's date goes to the history document",
    `THE WHOLE STYLESHEET SET, not app.css alone: the mark's two fill bindings live in DIFFERENT
files since the stylesheet split, so reading one path found one of two and failed.`,
  ],
  "scripts/check-logo.mjs#23": [
    "WHY",
    "why the shared helper is safe here and where the hazard would land",
    `CSS through the SHARED helper. In CSS \`//\` is never a comment, so its line rule can only
remove something real. The latent hazard is a protocol-relative \`url(//host/x)\`: if one ever
appears, THIS call site goes block-only, not the helper.`,
  ],
  "scripts/check-logo.mjs#25": ["WHY", "the zero-scope arm; two lines already"],
  "scripts/check-logo.mjs#26": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#27": [
    "WHY",
    "why it lives here, the two failure shapes and why the probe point is derived; the ruling's placement argument goes to the history document",
    `The rendered icon suite, in this OFFLINE gate rather than with the assets manifest, because
that gate is NETWORK tier and folding these in would leave the suite unchecked on \`npm run
check\`, inside check:head, and on a plane.

TWO FAILURE SHAPES, and structure catches one: a regenerator that drops a size changes the
container, one pointed at the wrong tile changes nothing structural at all. So each raster also
gets one colour probe.

THE PROBE POINT IS DERIVED, not chosen: every tile is a full-bleed rect with the mark centred
inside a padded box, so pixel (0, 0) is outside the mark for any padding and outside the
inscribed maskable circle. It survives any revision that moves or redraws the mark.`,
  ],
  "scripts/check-logo.mjs#28": [
    "CONTRACT",
    "section marker plus why two implementations",
    `The hand-rolled readers test themselves against a third-party encoder: a parser and a fixture
built on the same assumptions can agree about a format both got wrong. resvg ENCODES the PNG
and \`raster.mjs\` decodes it, neither derived from the other.`,
  ],
  "scripts/check-logo.mjs#29": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#30": ["CONTRACT", "why a known payload; two lines already"],
  "scripts/check-logo.mjs#31": ["CONTRACT", "section marker, rule padding cut", `The ICO container, parsed from the file rather than trusted`],
  "scripts/check-logo.mjs#32": [
    "WHY",
    "what the directory alone cannot see",
    `The embedded PNG's own IHDR must agree with the directory entry: a container claiming 32px
around a 16px image is a real corruption the directory alone cannot see.`,
  ],
  "scripts/check-logo.mjs#33": ["CONTRACT", "section marker, rule padding cut", `Every raster: dimensions and one tile probe`],
  "scripts/check-logo.mjs#34": ["WHY", "the zero-scope loop; two lines already"],
  "scripts/check-logo.mjs#35": [
    "WHY",
    "why the query must be absent; the superseded design's measurement goes to the history document",
    `favicon.svg is a tile, like everything else. The superseded assertion required both
\`prefers-color-scheme\` values, policing a mechanism that cannot work: that query reads the
OPERATING SYSTEM's scheme, while what the icon has to survive is the TAB STRIP's colour, which
comes from the browser theme and is invisible to any media query. So the assertion is now the
opposite in one direction, the query must be ABSENT. Comments are stripped first.`,
  ],
  "scripts/check-logo.mjs#36": [
    "NUMBER",
    "why not scope-floored and why the SVG block sits inside the margin; the measurement and the wrong first estimate go to the history document",
    `Executed-count floor for the icon section, MEASURED THROUGH THIS GATE'S OWN PIPELINE by
RUNNING it rather than by adding up the blocks.

Not scope-floored: losing the self-test block, the raster loop or the ICO block each drops the
count below this and is named as a SKIPPED block rather than passing quietly. The SVG block
sits inside the margin deliberately, because its assertions are explicit and would fail on
their own before a count could notice they had gone.`,
  ],
  "scripts/check-logo.mjs#37": [
    "CONTRACT",
    "what the text comparisons cannot see, the two sides and what they share; the hand proof's date and the token aside go to the history document",
    `The mark as it is RENDERED, not as it is written, which CLOSES THE HOLE THIS FILE'S BOUNDARY
NAMES. Everything above compares TEXT, so a change that leaves every string intact and ruins the
picture passes: the card embeds the mark through satori, and a release that re-fitted or
letterboxed that embed would move no character here.

  ACTUAL    the node build:og puts in the card, through satori and resvg
  EXPECTED  the committed fixture's own paths, drawn into the same box by resvg directly

The two share a rasteriser and nothing else. EXPECTED never reads a stored PNG and never reads
the module under test for geometry, and its framing is a plain nested \`<svg>\`, which makes the
aspect-padding in \`mark.mjs\` falsifiable rather than assumed. ONE TOKEN IS RESOLVED, on both
sides, so this stays a geometry assertion, and it is still an assertion about WHICH token.`,
  ],
  "scripts/check-logo.mjs#38": [
    "CONTRACT",
    "why the font and why the cast, in two lines",
    `ACTUAL. The font is required by satori and never used, the mark being paths. The cast is the
same one build-og.mjs makes: satori's types want a ReactNode and these are the plain element
objects it accepts, built without JSX so no caller needs a build step.`,
  ],
  "scripts/check-logo.mjs#40": ["WHY", "why it fails here rather than three sections later; two lines already"],
  "scripts/check-logo.mjs#41": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#42": ["CONTRACT", "what EXPECTED is made of; two lines already"],
  "scripts/check-logo.mjs#43": [
    "NUMBER",
    "why a floor and not a measurement; the inked figure goes to the history document",
    `Two blank rasters compare equal and prove nothing, so the expected one has to be a picture
before the comparison means anything. A quarter of the box is a floor, not a measurement.`,
  ],
  "scripts/check-logo.mjs#44": [
    "WHY",
    "why zero is the honest number and what can drift it; both plant measurements go to the history document",
    `TOLERANCE IS ZERO, and zero is the honest number rather than a strict one: both sides are the
same vector geometry at the same size through the same resvg in one process, so there is no
photograph, compression artefact or font for a tolerance to absorb. A resvg upgrade moves both
sides identically; only satori changing how it hands the mark over can drift them, which is
precisely what this exists to catch.`,
  ],
  "scripts/check-logo.mjs#45": [
    "NUMBER",
    "why the floor allows one and what every other silence looks like; the measurement goes to the history document",
    `Executed-count floor for the render section, MEASURED BY RUNNING IT and never summed.

The \`<image>\` parse is a real branch: if satori stops emitting one the block runs a single
assertion and stops, and both that and this fail, which is correct because the first line to
read is the one naming what changed. Every other way for this section to go quiet drops it to
zero or one.`,
  ],
  "scripts/check-logo.mjs#46": ["CONTRACT", "section marker, rule padding cut", `Report`],
  "scripts/check-logo.mjs#47": [
    "NUMBER",
    "what this floors that the section floor cannot, and why never summed; the measurements and the dated readings go to the history document",
    `WHOLE-GATE EXECUTED-COUNT FLOOR. The icon section has its own, and a section floor cannot see
a different section stopping, so this floors everything else: the geometry, the fixtures and
the two CSS fill bindings, none of which had one.

MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed, and summing is what went
wrong here once already. The count is a fixed function of the fixture list and the raster
manifest, so it steps when an asset is added.`,
  ],
};
