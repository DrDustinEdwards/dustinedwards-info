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
sees markup and nothing else, and hard rule 7 is why it is not folded into \`check:content\`.
A REAL PARSER, NOT A REGEX: \`u-url\` on an element with no href passes a search and gives a
reader nothing. FIXTURE INDEPENDENCE, hard rule 10: \`dt-published\` is compared against a
separate read of the markdown. FAILS CLOSED on an empty corpus or a parse that finds nothing.`,
  ],
  "scripts/check-microformats.mjs#2": [
    "CONTRACT",
    "why this argument order and the citation, in two lines",
    `\`assert(label, ok, detail)\`, deliberately not the other two shapes here: a call copied out of a
gate using \`ok(label, condition)\` is a ReferenceError rather than a silent pass. Hard rule 10.

@param {string} label
@param {boolean} passed
@param {string} [detail]`,
  ],
  "scripts/check-microformats.mjs#3": [
    "WHY",
    "why a second read, why the scope is bounded and where the path comes from; the section 15b catch goes to the history document",
    `A SECOND, NARROW READ ON PURPOSE: asking the pipeline would make the assertion \`x === x\`.
Bounded to the frontmatter block, and the path comes from \`postPath()\`, hard rule 6.

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
    `BUILT HERE, not read off disk: the artifact is a gitignored local product, and a stale one
would certify a corpus nobody serves. The missing-file failure is NAMED, not an ENOENT.`,
  ],
  "scripts/check-microformats.mjs#13": [
    "WHY",
    "the first discipline with its citation, in two lines",
    `SCOPE PROVEN NON-EMPTY FIRST: a sweep over zero posts reports what a clean sweep reports,
which is hard rule 10's first discipline.`,
  ],
  "scripts/check-microformats.mjs#14": [
    "WHY",
    "why one source for expectation and subject, and why its own bundle call; the rejected alternatives go to the history document",
    `\`app/lib/seo.ts\` RIDES THROUGH THE SAME BUNDLER, so expectation and subject share ONE source.
IN ITS OWN BUNDLE CALL, because esbuild derives \`outbase\` from the entry points' common
parent, and mixing it with the routes moves every output under a subdirectory.`,
  ],
  "scripts/check-microformats.mjs#17": ["CONTRACT", "why the built record; already short"],
  "scripts/check-microformats.mjs#18": [
    "WHY",
    "why the mentions block is empty here",
    `NO MENTIONS: that block carries no microformats class and its text is a stranger's.`,
  ],
  "scripts/check-microformats.mjs#19": [
    "WHY",
    "what the wrong field arranged never to see, and the one honest difference; the live parse date goes to the history document",
    `THE SAME SOURCE THE SYNC USES. This was the FRONTMATTER field, which no post carries, so the
gate was asserting a property it had arranged never to see. ONE HONEST DIFFERENCE, a bug in
neither place: with no revision date the sync writes \`unixepoch()\`, so the assertion is the
PAIRING and holds either way.`,
  ],
  "scripts/check-microformats.mjs#20": ["CONTRACT", "section marker, rule padding cut", `1. Every published post page is one complete h-entry`],
  "scripts/check-microformats.mjs#22": [
    "WHY",
    "why exactly one, in two lines",
    `EXACTLY ONE, not at least one: two h-entries publish competing answers and a consumer takes
the first.`,
  ],
  "scripts/check-microformats.mjs#23": [
    "WHY",
    "why it is asserted as the body and why by length",
    `e-content IS ASSERTED AS THE BODY: a class on an empty wrapper still satisfies "has content".
By length rather than byte for byte, or the equality is an assertion about the parser.`,
  ],
  "scripts/check-microformats.mjs#25": ["WHY", "where each side comes from; two lines already"],
  "scripts/check-microformats.mjs#27": [
    "WHY",
    "why the gate is conditional in both directions",
    `dt-updated IS CONDITIONAL AND THE GATE IS CONDITIONAL WITH IT, both ways: what is asserted is
the pairing, a page showing "Updated" with no \`dt-updated\` and the reverse.`,
  ],
  "scripts/check-microformats.mjs#28": [
    "WHY",
    "why the count must not move with the checkout, and where the threshold stays owned; the CI arithmetic goes to the history document",
    `THE VALUE ASSERTION RUNS ON EVERY POST: conditioning it made the count depend on the CHECKOUT,
a full clone resolving a commit date for every post and a shallow one none. The expectation is
derived from what the PAGE rendered, which leaves hard rule 17's one owner of the threshold
where it belongs, with the route.`,
  ],
  "scripts/check-microformats.mjs#29": [
    "WHY",
    "why the whole-page count is pinned",
    `NOTHING ELSE ON THE PAGE IS A MICROFORMAT: annotating the mentions list would republish a
stranger's text as this site's structured data.`,
  ],
  "scripts/check-microformats.mjs#30": [
    "WHY",
    "why the fixture went and why the split is not asserted; the synthetic control's account goes to the history document",
    `BOTH dt-updated BRANCHES, COUNTED AND PRINTED, and neither fabricated. Not asserted against a
fixed split, because which branch runs is a property of the clone rather than of the code.`,
  ],
  "scripts/check-microformats.mjs#31": [
    "CONTRACT",
    "section marker, rule padding cut",
    `2. The blog index is one h-feed, holding the page it rendered`,
  ],
  "scripts/check-microformats.mjs#34": [
    "WHY",
    "why the count is derived through the route's own helpers",
    `Built THROUGH the route's own paging helpers rather than by slicing to a literal, which is
hard rule 10's measure-floors-through-the-pipeline: a page size change moves both together.

@param {number} page`,
  ],
  "scripts/check-microformats.mjs#35": ["CONTRACT", "one line already; kept"],
  "scripts/check-microformats.mjs#36": [
    "WHY",
    "why both ends and why a Set",
    `BOTH ENDS OF THE PAGINATION: page 1 is the only one that can carry a featured post and the
last the only one not the page size. A SET, because a one-page corpus makes them the same page.`,
  ],
  "scripts/check-microformats.mjs#39": [
    "WHY",
    "what the page actually promises; the refuted prompt goes to the history document",
    `THE COUNT IS THE LOADER'S: /blog paginates, so "the index carries every published post" could
only pass while the corpus stayed under the page size. The promise is about what it SHOWS.`,
  ],
  "scripts/check-microformats.mjs#43": [
    "WHY",
    "why paired in both directions",
    `p-summary IS PAIRED WITH THE DESCRIPTION both ways, or the class falls off every card unseen.`,
  ],
  "scripts/check-microformats.mjs#44": [
    "WHY",
    "what a consumer would be handed",
    `A LISTING ENTRY CARRIES NO e-content: a consumer finding content on a card has a description
labelled as the article.`,
  ],
  "scripts/check-microformats.mjs#45": ["CONTRACT", "section marker, rule padding cut", `3. The home page carries the site author's h-card`],
  "scripts/check-microformats.mjs#46": [
    "WHY",
    "why the fixture is derived; the dark-block incident goes to the history document",
    `THE HOME FIXTURE IS DERIVED, NOT SUPPLIED: it was a third statement of which post leads the
front page, written by the gate checking it, asserting a section production never rendered.`,
  ],
  "scripts/check-microformats.mjs#49": ["CONTRACT", "why the missing state; two lines already"],
  "scripts/check-microformats.mjs#51": [
    "WHY",
    "why no photo, with its citation, and why the assertion inverts",
    `NO u-photo, ASSERTED: the site publishes no photograph, so a card claiming one is the
substituted value hard rule 13 names, wearing an h-card. It INVERTS the day a photo lands.`,
  ],
  "scripts/check-microformats.mjs#54": [
    "WHY",
    "what a moved class would do to the entries",
    `THE h-card MUST NOT SWALLOW THE ENTRIES: on \`<main>\` every consumer reads three posts as
properties of a person.`,
  ],
  "scripts/check-microformats.mjs#55": ["CONTRACT", "section marker, rule padding cut", `4. No rel="me", no social links. Ruling 50.`],
  "scripts/check-microformats.mjs#56": [
    "WHY",
    "why on the rendered pages and why a named list",
    `ASSERTED ON THE RENDERED PAGES: the parser's view of every rel catches one however it was
written. The social arm is a NAMED LIST, the site linking out constantly.`,
  ],
  "scripts/check-microformats.mjs#58": ["CONTRACT", "section marker, rule padding cut", `Report`],
  "scripts/check-microformats.mjs#59": [
    "NUMBER",
    "what the count is a function of, why the floor is tight and what it costs; three dated re-measurements and the CI proof go to the history document",
    `WHOLE-GATE EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE. It moves with the corpus size
and steps DOWN when a post is unpublished, and it does NOT move with the checkout, which is
load bearing for CI. WHAT THE TIGHTNESS COSTS: unpublishing breaches it, and the repair is a
re-measured floor in the same commit.`,
  ],
  "scripts/check-logo.mjs#0": [
    "CONTRACT",
    "the boundary, the two named gaps and why the fixtures stay; the collapse narrative and the v4 amendment prose go to the history document",
    `Gate over the site mark.

  npm run check:logo

BOUNDARY: the component's path data against the four SVG fixtures, the fill BINDINGS against a
closed set, the icon suite's container shape and one tile pixel, and the mark AS RENDERED into
a social card against a rasterisation of the fixture. IT DOES NOT CHECK CONTRAST, and the icon
suite is still ONE PIXEL PER RASTER, so an upside-down mark passes. THE FOUR public/*.svg
FILES ARE THE FIXTURES: two sources argue and nothing restates a path, so it fails both ways.`,
  ],
  "scripts/check-logo.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#2": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#3": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#6": [
    "WHY",
    "why comments go first; the check:contrast incident goes to the history document",
    `Strips block comments first: this file's header names the viewBox and both hexes.

@param {string} source
@returns {string}`,
  ],
  "scripts/check-logo.mjs#7": [
    "WHY",
    "the prohibition and its because; the audit's wrong diagnosis goes to the history document",
    `WEAK ON PURPOSE, and only for SVG: the shared strong stripper's line rule eats a
protocol-relative url and the rest of its line. The TSX and CSS call sites use the shared one,
because a .tsx file has real \`//\` comments this form would leave standing.`,
  ],
  "scripts/check-logo.mjs#9": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#11": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#12": ["WHY", "why the strong stripper here; two lines already"],
  "scripts/check-logo.mjs#14": [
    "CONTRACT",
    "section marker plus the scope rule, in one line",
    `The parse counts are asserted before anything is compared: an assertion that can pass by
reading nothing is not an assertion.`,
  ],
  "scripts/check-logo.mjs#15": [
    "CONTRACT",
    "section marker plus which viewBox is which",
    `Every fixture is reproduced; viewBoxes[0] is the master, [1] the tight header crop.`,
  ],
  "scripts/check-logo.mjs#17": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#18": [
    "WHY",
    "what the geometry comparisons could not see, and the closed set; the v4 narrative goes to the history document",
    `Where the five purple paths actually get their colour: everything above compares GEOMETRY. It
names both bindings by VALUE and the set is CLOSED, so a third rule setting fill on this class
fails rather than quietly winning the cascade. It does NOT resolve the tokens to hexes.`,
  ],
  "scripts/check-logo.mjs#19": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#20": [
    "WHY",
    "why a gate narrowed to fit a defect is worse than the defect, and the citation; the build-2 account goes to the history document",
    `TWO BINDINGS, the second asserting that the mark RENDERS ON THE BAR. A build once replaced the
header with a wordmark, this caught it, and the gate was cut to one binding to fit the defect.
A gate narrowed to accommodate an omission lets the next one through in silence: restored
FIRST and watched to fail, which is hard rule 12.`,
  ],
  "scripts/check-logo.mjs#21": [
    "WHY",
    "the dichotomy lesson and what actually moved; the tokens, the dates and the ratio go to the history document",
    `THE TOKEN WENT AND CAME BACK. The measurement behind moving it was right; the CONCLUSION was
not, the question asked being "which token survives this bar" when it was "why did the bar
change". The COUNT is what caught the missing mark.`,
  ],
  "scripts/check-logo.mjs#22": [
    "WHY",
    "why the whole set and not one file; the split's date goes to the history document",
    `THE WHOLE STYLESHEET SET: the two fill bindings live in different files since the split.`,
  ],
  "scripts/check-logo.mjs#23": [
    "WHY",
    "why the shared helper is safe here and where the hazard would land",
    `CSS through the SHARED helper: in CSS \`//\` is never a comment, so the line rule can only
remove something real. If a protocol-relative url ever appears, THIS call site goes block-only.`,
  ],
  "scripts/check-logo.mjs#25": ["WHY", "the zero-scope arm; two lines already"],
  "scripts/check-logo.mjs#26": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#27": [
    "WHY",
    "why it lives here, the two failure shapes and why the probe point is derived; the ruling's placement argument goes to the history document",
    `The rendered icon suite, in this OFFLINE gate rather than with the assets manifest, which is
NETWORK tier. TWO FAILURE SHAPES: a dropped size changes the container, a wrong tile changes
nothing structural, so each raster gets one colour probe. THE PROBE POINT IS DERIVED: pixel
(0, 0) is outside the mark for any padding and outside the inscribed maskable circle.`,
  ],
  "scripts/check-logo.mjs#28": [
    "CONTRACT",
    "section marker plus why two implementations",
    `The hand-rolled readers test themselves against a third-party encoder: resvg encodes and
\`raster.mjs\` decodes, neither derived from the other.`,
  ],
  "scripts/check-logo.mjs#29": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#30": ["CONTRACT", "why a known payload; two lines already"],
  "scripts/check-logo.mjs#31": ["CONTRACT", "section marker, rule padding cut", `The ICO container, parsed from the file rather than trusted`],
  "scripts/check-logo.mjs#32": [
    "WHY",
    "what the directory alone cannot see",
    `The embedded PNG's IHDR must agree with the directory entry: a container claiming 32px around
a 16px image is a corruption the directory alone cannot see.`,
  ],
  "scripts/check-logo.mjs#33": ["CONTRACT", "section marker, rule padding cut", `Every raster: dimensions and one tile probe`],
  "scripts/check-logo.mjs#34": ["WHY", "the zero-scope loop; two lines already"],
  "scripts/check-logo.mjs#35": [
    "WHY",
    "why the query must be absent; the superseded design's measurement goes to the history document",
    `favicon.svg is a tile like everything else. The superseded assertion policed a mechanism that
cannot work: \`prefers-color-scheme\` reads the OPERATING SYSTEM, while the icon has to survive
the TAB STRIP's colour. So the query must now be ABSENT. Comments are stripped first.`,
  ],
  "scripts/check-logo.mjs#36": [
    "NUMBER",
    "why not scope-floored and why the SVG block sits inside the margin; the measurement and the wrong first estimate go to the history document",
    `Executed-count floor for the icon section, MEASURED THROUGH THIS GATE'S OWN PIPELINE. Losing
the self-test, the raster loop or the ICO block each drops under it and is named as SKIPPED.`,
  ],
  "scripts/check-logo.mjs#37": [
    "CONTRACT",
    "what the text comparisons cannot see, the two sides and what they share; the hand proof's date and the token aside go to the history document",
    `The mark as it is RENDERED, which CLOSES THE HOLE THIS FILE'S BOUNDARY NAMES: everything above
compares TEXT, so a re-fitted or letterboxed embed would move no character here.

  ACTUAL    the node build:og puts in the card, through satori and resvg
  EXPECTED  the committed fixture's own paths, drawn into the same box by resvg directly

The two share a rasteriser and nothing else, and EXPECTED's framing is a plain nested \`<svg>\`,
which makes the aspect-padding in \`mark.mjs\` falsifiable rather than assumed.`,
  ],
  "scripts/check-logo.mjs#38": [
    "CONTRACT",
    "why the font and why the cast, in two lines",
    `ACTUAL. The font is required by satori and never used, the mark being paths; the cast is the
one build-og.mjs makes, so no caller needs a build step.`,
  ],
  "scripts/check-logo.mjs#40": ["WHY", "why it fails here rather than three sections later; two lines already"],
  "scripts/check-logo.mjs#41": ["CONTRACT", "one line already; kept"],
  "scripts/check-logo.mjs#42": ["CONTRACT", "what EXPECTED is made of; two lines already"],
  "scripts/check-logo.mjs#43": [
    "NUMBER",
    "why a floor and not a measurement; the inked figure goes to the history document",
    `Two blank rasters compare equal and prove nothing. A quarter of the box is a floor.`,
  ],
  "scripts/check-logo.mjs#44": [
    "WHY",
    "why zero is the honest number and what can drift it; both plant measurements go to the history document",
    `TOLERANCE IS ZERO, and zero is the honest number: both sides are the same geometry at the same
size through the same resvg in one process. A resvg upgrade moves both identically; only
satori changing how it hands the mark over can drift them, which is what this catches.`,
  ],
  "scripts/check-logo.mjs#45": [
    "NUMBER",
    "why the floor allows one and what every other silence looks like; the measurement goes to the history document",
    `Executed-count floor for the render section, MEASURED BY RUNNING IT. The \`<image>\` parse is a
real branch: if satori stops emitting one, that assertion and this both fail, which is correct.`,
  ],
  "scripts/check-logo.mjs#46": ["CONTRACT", "section marker, rule padding cut", `Report`],
  "scripts/check-logo.mjs#47": [
    "NUMBER",
    "what this floors that the section floor cannot, and why never summed; the measurements and the dated readings go to the history document",
    `WHOLE-GATE EXECUTED-COUNT FLOOR: a section floor cannot see another section stopping, so this
floors the geometry, the fixtures and the two CSS fill bindings. MEASURED BY RUNNING IT, never
summed, summing being what went wrong here once already.`,
  ],
};
