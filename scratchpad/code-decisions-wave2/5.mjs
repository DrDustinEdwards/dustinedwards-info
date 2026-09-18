// Chunk 5: scripts/build-og.mjs blocks 0-33, scripts/check-content.mjs blocks 0-53.
//
// Wave 1's rule: one line a block, the because as a clause, a header six or so with the
// invocation, and the justification for choosing an approach deleted rather than compressed.
//
// build-og is the densest argument-about-a-choice file in the wave so far: why satori runs in
// Node and not the Worker, why the wordmark is parsed and not imported, which of four rendered
// candidates Dustin picked, why a token with the wrong name is the right token. All of that is
// history by rule 17. What survives is the prohibition each argument was defending, and there
// are real ones here: the coupling law, the draft leak, the bucket read from config.
export default {
  "scripts/build-og.mjs#0": [
    "CONTRACT",
    "the mode, the gap it leaves and the coupling law; the two measured reasons for Node, the bundle sizes and the gitignore aside go to the history document",
    `Generates the social card for every post and uploads it to R2.

  npm run build:og -- --local|--remote

BUILD TIME ONLY, in Node, because satori and resvg cannot run in the Worker. The gap: a post
retitled in the editor has no card until this runs and re-syncs, and the editor never writes a
card URL it cannot back, so the failure is a missing image rather than a broken one.

THE COUPLING LAW: this uploads AND prunes in one pass against the keys the CURRENT artifact
references, while the live site serves what is in D1. Run it outside a ship window and it
deletes every card production points at, which is why the guard before the prune refuses.`,
  ],
  "scripts/build-og.mjs#1": [
    "WHY",
    "why the bucket is derived, in one line; the literal it replaced goes to the history document",
    `DERIVED from the wrangler config, never a literal: a stale name aims a DELETE at whatever
bucket still answers to it, and a binding that no longer exists is a named error.`,
  ],
  "scripts/build-og.mjs#2": ["CONTRACT", "one line already; kept"],
  "scripts/build-og.mjs#3": [
    "WHY",
    "why the tokens are resolved and why the dark block; the v4 argument, the rule-7 reading and the mark's ruling go to the history document",
    `Hill Country tokens RESOLVED FROM app.css rather than restated: this runs in Node and can read
the stylesheet, and four hex literals sat unchanged through a palette change once already.

TAKEN ENTIRELY FROM THE DARK BLOCK, which is the property rather than which block it is:
\`--on-chrome\` and its siblings are ratified AGAINST \`--surface-chrome\` within a theme, so
mixing blocks puts the card outside every pair the palette has measured. The mark is the one
value not resolved here, sound only because \`--mark-on-chrome\` is the same hex in both by
ruling. Changing which tokens, or the layout, still bumps OG_TEMPLATE_VERSION.`,
  ],
  "scripts/build-og.mjs#4": [
    "CONTRACT",
    "why the wordmark is read from seo.ts and why as text; the tsc error codes and the rejected alternatives go to the history document",
    `THE WORDMARK, READ OUT OF \`app/lib/seo.ts\` and not spelled here: a card that disagrees with
the page it opens is two identities. Parsed as TEXT rather than imported, because TypeScript
refuses the cross-project \`.ts\` specifier and the fixes are larger than one string justifies.
It fails closed three ways: the declaration renamed, the block reshaped, or \`name\` given
anything but a plain string.

@returns {string}`,
  ],
  "scripts/build-og.mjs#5": [
    "WHY",
    "the prohibition and what block-only stripping read; the plant and its date go to the history document",
    `THE SHARED STRIPPER. Block-only stripping is weaker than every other reader of a .ts file
here, and the anchor below is an indexOf on a declaration this file is exactly the kind to
quote in prose: a planted comment was read as the site name and would have rendered on every
card with nothing failing.`,
  ],
  "scripts/build-og.mjs#6": [
    "CONTRACT",
    "what the card derives and the two anchors; the v4 argument, the crop reasoning and the rule-7 reading go to the history document",
    `The card layout as satori's element objects rather than JSX, so this file needs no build step.

EVERYTHING HERE IS DERIVED and nothing invented except WHERE things sit: the chrome colours
from app.css, the mark from \`mark.mjs\`, the wordmark from \`SITE.name\`, the fitted type from
\`og-card-text.mjs\`. TWO ANCHORS, ONE AT EACH END: the title block grows UPWARD into the gap, so
a long title eats air rather than walking into the meta line.

@param {{
  title: string,
  description?: string | null,
  publishAt?: string | null,
}} post`,
  ],
  "scripts/build-og.mjs#8": [
    "WHY",
    "why both cuts are in JavaScript; the measurement and the two-template history go to the history document",
    `Both cuts happen HERE and in JavaScript, because satori's line clamp is inert: the property
reads like a guarantee and is not one.`,
  ],
  "scripts/build-og.mjs#9": [
    "WHY",
    "what the owner returns and why the line is a filtered list",
    `Through the ONE owner of "a timestamp as a date a person reads". \`longDateUTC\` returns null
rather than "Invalid Date", which is why the meta line below is assembled from a filtered list:
a card reading "Invalid Date" would be a permanent, immutable object.`,
  ],
  "scripts/build-og.mjs#10": [
    "NUMBER",
    "what changing the padding invalidates; the two figures are the constants below",
    `THE MEASURE. The side padding sets the width the ladder in og-card-text.mjs was measured
against, so changing it invalidates those breakpoints and is not a cosmetic edit.`,
  ],
  "scripts/build-og.mjs#11": [
    "WHY",
    "that the module is a seam; the wordmark's move goes to the history document",
    `The mark from \`scripts/lib/mark.mjs\`, which owns how it is drawn; this file owns only where it
sits. That module is a SEAM: \`check:logo\` renders this same node against the committed
fixture, so the shape is asserted rather than assumed.`,
  ],
  "scripts/build-og.mjs#12": ["WHY", "what the gap does; two lines already"],
  "scripts/build-og.mjs#13": [
    "WHY",
    "which property satori honours and which it ignores; both measurements and the false claim go to the history document",
    `SATORI DOES HONOUR \`wordBreak\`; \`overflowWrap\` in both spellings is the one it ignores. It
costs nothing on real titles and does not replace the character cap, which governs how much
text there is rather than what happens to one unbreakable word.`,
  ],
  "scripts/build-og.mjs#14": [
    "WHY",
    "why two lines and why it is cut hard; the v3 removal argument goes to the history document",
    `Two lines of muted type is a TEXTURE rather than something to read, which is what keeps a
full-bleed card from being a poster with one line on it. Cut hard at two, because a third would
be prose asking to be read at a size it cannot be. Rendered only when there is one.`,
  ],
  "scripts/build-og.mjs#15": ["WHY", "the realistic case; two lines already"],
  "scripts/build-og.mjs#16": [
    "WHY",
    "that the pair is measured and why this token; Dustin's ruling and the alternatives go to the history document",
    `THE ONE ACCENT, and it is A MEASURED PAIR: \`--focus-ring-on-chrome\` against \`--surface-chrome\`
is a check:contrast matrix row at the graphical-object floor, measured even though a rule
carries no text obligation, because the palette measures every pair it paints.

THE NAME IS A WART AND IT IS DELIBERATE: this card draws no focus ring, but that token is the
only pale gold with a ratified pair against this surface. A decorative gold wanted as its own
thing is a NEW token with its own matrix row, not a literal hex here.`,
  ],
  "scripts/build-og.mjs#17": [
    "WHY",
    "why a filtered list and why one span",
    `ASSEMBLED FROM A FILTERED LIST rather than interpolated, so an absent date takes its separator
with it. One span: satori has no \`gap\` on inline text.`,
  ],
  "scripts/build-og.mjs#18": [
    "CONTRACT",
    "why the prefix is stripped and the fail-closed direction",
    `The keys the DEPLOYED site is serving, read from D1. The prefix is STRIPPED rather than the
key rebuilt, which would be a second copy of a rule sync owns. FAILS CLOSED BY CONSTRUCTION:
not knowing what is live is a reason to delete nothing.`,
  ],
  "scripts/build-og.mjs#19": [
    "WHY",
    "what the mode is for and why it returns early; the argument for a review stop goes to the history document",
    `LOCAL RENDER MODE: \`--out <dir>\` renders to disk and touches R2 with nothing. It returns
BEFORE the prune for the reason the prune's own comment gives: with a bumped template version
every existing object is an orphan, and those are the ones the live site is serving.`,
  ],
  "scripts/build-og.mjs#21": [
    "WHY",
    "one derivation, and what two would do",
    `ONE derivation of "which posts get a card", used by the writer and the prune: two loops each
applying the cover rule is how a prune deletes the card the writer just uploaded.`,
  ],
  "scripts/build-og.mjs#23": [
    "WHY",
    "the leak and the imported rule; the measured object and its bytes go to the history document",
    `A DRAFT NEVER GETS A CARD. The card RENDERS THE TITLE, so an unpublished post's headline was
public while its page answered 404. The rule is IMPORTED, never restated. The prune uses this
same list, so a post that stops being visible has its card DELETED rather than merely not
rewritten, which is the half that closes the class.`,
  ],
  "scripts/build-og.mjs#24": ["CONTRACT", "one line already; kept"],
  "scripts/build-og.mjs#25": ["CONTRACT", "why plain objects; two lines already"],
  "scripts/build-og.mjs#27": ["CONTRACT", "two lines already; kept"],
  "scripts/build-og.mjs#28": [
    "WHY",
    "why one quoted string, in one line",
    `One quoted command string, not an args array: with shell:true an array is concatenated
unquoted, and the cache-control value contains a comma and spaces.`,
  ],
  "scripts/build-og.mjs#29": ["CONTRACT", "one line already; kept"],
  "scripts/build-og.mjs#30": [
    "WHY",
    "why the ordering is the safety property",
    `LOCAL RENDER MODE RETURNS HERE, before the prune, and the ordering is the safety property:
after a template bump every existing object is an orphan by the prune's definition, and those
are precisely the ones the deployed site is still serving.`,
  ],
  "scripts/build-og.mjs#31": [
    "WHY",
    "why a listing is refused; the dated network error and the diagrams comparison go to the history document",
    `Prune. The key is a hash of the template version, slug, title and description, so any change
writes a NEW object and abandons the old one.

**It will not act on a listing it cannot trust.** \`listForPrune\` refuses an empty listing and
one missing any key the corpus still references, because a listing demonstrably missing objects
that exist proves nothing about the objects it appears not to have.`,
  ],
  "scripts/build-og.mjs#32": [
    "WHY",
    "the law, why this shape and the boundary; the enforcement date, the ship aside and the Capsid deletion go to the history document",
    `THE OG COUPLING LAW, ENFORCED RATHER THAN WRITTEN DOWN.

\`live\` above is the keys the CURRENT ARTIFACT references; the deployed site serves the keys in
D1, which change only when \`sync:content\` runs. So after any retitle or template bump and
before the next sync, every key the live site serves is an orphan by this script's definition,
and running it then 404s every social card with no deploy to roll back.

WHY THIS SHAPE RATHER THAN REFUSING OUTSIDE A SHIP WINDOW: that is not a question this process
can answer honestly, and any flag it checked is one a hurried operator passes. The PROPERTY is
checkable directly and is strictly stronger. BOUNDARY: it compares against what D1 SAYS, so a
row pointing at an object already gone looks live here.`,
  ],
  "scripts/build-og.mjs#33": [
    "WHY",
    "both arms of the scope assertion, in two lines",
    `SCOPE, ASSERTED. An empty read makes the comparison below pass by examining nothing, and an
artifact referencing cards while D1 names none IS the unsynced state this guards against.`,
  ],
  "scripts/check-content.mjs#0": [
    "CONTRACT",
    "the boundary and the five subjects, each to its claim; the artifact-arc narrative and the per-subject argument go to the history document",
    `Gate for the content build and the committed artifacts under \`content/generated/\`.

BOUNDARY: it renders and compares locally. It never renders in a Worker and never queries D1,
so whether the rows the sync writes match what it rendered is ship's drift report's.

  1. THE CORPUS RENDER IS VALID AND DETERMINISTIC. Rendered TWICE in one process and
     byte-compared, because a nondeterministic render is what surfaces later as false render
     drift. Rendering at all is the validation half.
  1b. THE ABOUT PAGE on the same footing, and its bytes go into the WORKER BUNDLE.
  2. \`template-refs.json\`, byte-compared against a fresh scan.
  3. \`assets.json\`, against a walk of \`public/\`, with the gitignore tripwire.
  4. MATH OUTPUTS: one output carries the rendered form and every other the TeX an author
     typed, a distinction living in five modules with nothing else comparing them.
  5. \`katex.generated.css\` and its faces, derived fresh and reconciled both ways.

Fails closed: a generator that throws is a failure, never a pass.`,
  ],
  "scripts/check-content.mjs#1": [
    "WHY",
    "one owner, in one line",
    `The one statement of what a stored placeholder IS, imported rather than restated: a second
copy here is how the two come to disagree about a defect they were both written for.`,
  ],
  "scripts/check-content.mjs#2": [
    "WHY",
    "why names and why capped",
    `Names, not a count: "3 file(s) missing" sends the reader to compare two lists by eye. Capped,
because a fresh checkout could otherwise print sixty lines.

@param {string[]} names`,
  ],
  "scripts/check-content.mjs#3": ["CONTRACT", "two lines already; kept"],
  "scripts/check-content.mjs#4": [
    "WHY",
    "what the second render proves and why one process",
    `TWICE, IN ONE PROCESS. Rendering once proves validity; twice and compared proves the render
depends on the sources alone, and any clock or iteration-order dependence is what would later
read as Worker-versus-Node drift. One process on purpose, so a module memo is shared and a
difference is the render's own.`,
  ],
  "scripts/check-content.mjs#7": [
    "CONTRACT",
    "the three claims and the one it adds; the bundle argument and the taste aside go to the history document",
    `The About page renders, renders the same way twice, and says something.

RENDERING AT ALL IS THE VALIDATION: \`buildAbout\` throws on missing frontmatter, on an image,
and on a link the allowlist demoted. TWICE AND BYTE-COMPARED, because \`about.json\` is imported
STATICALLY so its bytes sit inside the Worker bundle. NOT EMPTY is the extra claim: an empty
body renders a valid artifact describing a blank page, the failure here that looks most like
success.`,
  ],
  "scripts/check-content.mjs#8": [
    "CONTRACT",
    "the subject, the scope control and the two derivations; the determinism aside goes to the history document",
    `THE FOURTH SUBJECT: math. ONE output carries the rendered form and every other carries the TeX
an author typed, a distinction living in five modules.

THE SCOPE CONTROL COMES FIRST and matters most: every claim below is "no post's markdown
carries KaTeX markup", which a corpus with no math satisfies perfectly, so the corpus must hold
at least one post WITH math and one WITHOUT.

TWO DERIVATIONS OF \`hasMath\`, MADE TO ARGUE: one from the mdast, one read back off the rendered
html, which is what the ROUTE uses. Disagreement means a stylesheet downloaded and unused, or
math rendered without one.

@param {Array<{ slug: string, markdown: string, html: string, hasMath?: boolean,
  title: string, toc: any[], tags: string[], publishAt: any, draft: boolean }>} posts`,
  ],
  "scripts/check-content.mjs#10": [
    "WHY",
    "what it proves about the validator, in one line",
    `NO ERROR BOX, EVER. rehype-katex's failure path emits \`katex-error\` and the validator exists
so that path is unreachable, so this firing means an expression got past it and shipped a red
box.`,
  ],
  "scripts/check-content.mjs#11": [
    "WHY",
    "why it is asserted on the record, in one line",
    `THE MARKDOWN SIDE, which is FOUR outputs at once, because \`posts.body\` is what the markdown
twin, llms-full, the JSON feed and the Accept representation all serve unmodified.`,
  ],
  "scripts/check-content.mjs#12": [
    "WHY",
    "what a silent drop would cost",
    `THE HTML SIDE, carrying BOTH trees: htmlAndMathml is the ruled output mode, and a silent drop
to html-only takes the MathML away from a screen reader with nothing else noticing.`,
  ],
  "scripts/check-content.mjs#13": [
    "WHY",
    "what this owns that a fixture cannot",
    `THE FEED SIDE, through the transform the feeds call. The fixture test owns the item markup;
this owns the claim over the REAL corpus.`,
  ],
  "scripts/check-content.mjs#14": [
    "WHY",
    "what a record carrying markup would do",
    `THE SEARCH AND ASK SIDE. Both indexes are built from the MARKDOWN, so they carry the TeX
source; a record carrying markup would put span soup into a snippet and into the Ask context.`,
  ],
  "scripts/check-content.mjs#15": [
    "WHY",
    "why the strip is required; the fixture aside goes to the history document",
    `REQUIRED, not tidiness: a post that DOCUMENTS the directive writes it inside a fence, where
it is literal text and renders no chip, so matching raw markdown would fail a correct post.
That is the comment-satisfied-anchor class of hard rule 10 in a different syntax.

@param {string} markdown`,
  ],
  "scripts/check-content.mjs#16": [
    "CONTRACT",
    "the claim and the two derivations; the six-output enumeration goes to the history document",
    `THE FIFTH SUBJECT: swatches. The claim in one line, **the rendered chip exists in the HTML and
NOWHERE ELSE**, because \`posts.body\` is served verbatim to six consumers and indexed for
search and Ask.

TWO DERIVATIONS, MADE TO ARGUE: the source side reads the markdown for the directive, the html
side reads the output for the chip, and a disagreement either way is a failure. One derivation
checked against itself would pass on a pipeline that had stopped running.

@param {Array<{ slug: string, markdown: string, html: string }>} posts`,
  ],
  "scripts/check-content.mjs#18": [
    "WHY",
    "why it is asserted on the record, in one line",
    `THE MARKDOWN SIDE, which is SIX outputs at once: if \`posts.body\` held chip markup, all six
would.`,
  ],
  "scripts/check-content.mjs#19": [
    "WHY",
    "why on the output and not the validator",
    `THE CASE FOLD, asserted on the OUTPUT rather than the validator: that is what makes it a
property of the artifact instead of a claim in a docstring.`,
  ],
  "scripts/check-content.mjs#20": [
    "WHY",
    "the same reason as the math side, in one line",
    `THE SEARCH AND ASK SIDE, through the same builder and for the same reason: both indexes are
built from the MARKDOWN, so a record carrying chip markup is span soup in a snippet.`,
  ],
  "scripts/check-content.mjs#26": [
    "CONTRACT",
    "the failure it exists for and the both-directions rule",
    `THE FIFTH GENERATED ARTIFACT: the math stylesheet and its faces. It is derived from the
INSTALLED katex package and styles markup that package produces, so bumping katex without
rebuilding makes the renderer emit a class the stylesheet has no rule for.

Byte-compared against a fresh derivation, faces reconciled BOTH ways: one the stylesheet names
and the repo lacks is a silent fallback to a system font, and one on disk it no longer names is
a stale binary nobody will delete.`,
  ],
  "scripts/check-content.mjs#29": [
    "WHY",
    "what a zero-face derivation would agree with",
    `SCOPE, ASSERTED before either direction: a derivation naming zero faces agrees with an empty
directory, and both look like a clean reconciliation.`,
  ],
  "scripts/check-content.mjs#31": [
    "CONTRACT",
    "what the schema cannot decide and why the count is printed; the widening's timing goes to the history document",
    `EVERY \`/blog/\` LINK IN \`further_reading\` NAMES A POST THAT EXISTS. The schema decides the
SHAPE of a url and cannot decide its TARGET, so a link to a post later deleted is valid
frontmatter and a dead link on a live page. A BUILD FAILURE rather than a warning.

**THE EXAMINED COUNT IS PRINTED**, because no corpus post sets the field: a silent "ok" would
be indistinguishable from a gate that checked nothing.

@param {Array<{ slug: string, furtherReading?: Array<{ title: string, url: string }> }>} posts`,
  ],
  "scripts/check-content.mjs#33": [
    "WHY",
    "why external links are out of scope, in one line",
    `External links are out of scope: nothing offline can say whether a third-party URL resolves,
and pretending otherwise is a check that fails on somebody else's outage.`,
  ],
  "scripts/check-content.mjs#34": [
    "CONTRACT",
    "why a stale copy is worse than none, and the separate scope numbers",
    `THE SECOND GENERATED ARTIFACT. A stale \`template-refs.json\` does not merely go out of date:
it prints a SENTENCE ABOUT EVIDENCE that no longer matches the evidence, claiming the site
places a file next to a delete button the claim discourages pressing.

**The scope numbers are asserted separately**, because a scan that read zero files and one that
found zero references print the same empty \`refs\`.`,
  ],
  "scripts/check-content.mjs#36": [
    "NUMBER",
    "why floors and why they are set by hand; the re-measurement, the drift figures and the tolerance formula go to the history document",
    `SCOPE, ASSERTED: an empty \`refs\` from a broken walk and one from a repository that cites
nothing are the same bytes. Floors rather than equalities, so adding a source file does not
fail while losing the tree does.

SET BY HAND, BECAUSE THIS GATE IS NOT IN THE SWEEP: these are bespoke scope floors, so nothing
re-measures them and the trigger is touching this file.`,
  ],
  "scripts/check-content.mjs#37": [
    "WHY",
    "why it is named rather than left to the bytes",
    `AND THE ONE CASE THE WHOLE FEATURE EXISTS FOR: the cohort photographs are referenced by a
data module and by no post, so this failing means the media page has gone back to calling them
unattached. Named explicitly, because a byte comparison passes happily when BOTH sides are
wrong.`,
  ],
  "scripts/check-content.mjs#38": [
    "CONTRACT",
    "why a Worker cannot list its assets, the tier argument and the boundary; the shipped-commit example and the ordering note go to the history document",
    `THE THIRD GENERATED ARTIFACT. **A Worker cannot list its own static assets**: the ASSETS
binding has \`fetch()\` and nothing else, so the media rebuild reads this file to discover what
exists. A manifest missing a file means a file never indexed and missing from nothing a reader
can see, which is the quietest possible failure.

WHAT IT CANNOT SEE: it compares the manifest to THE FILESYSTEM, so a manifest matching
\`public/\` while the media index is months stale passes here. Manifest-to-D1 is check:media's,
and needs the network, which is why this half lives in the offline tier.`,
  ],
  "scripts/check-content.mjs#39": [
    "WHY",
    "what a broken walk and an empty directory share",
    `FAILS CLOSED ON AN EMPTY WALK: a broken walk and an empty directory produce the same array,
and every comparison below would pass vacuously against it.`,
  ],
  "scripts/check-content.mjs#42": [
    "WHY",
    "why the default is absent, in one line",
    `\`?? []\` is deliberately absent: defaulting a missing \`paths\` key to an empty array turns a
broken artifact into "every file is missing", a true statement naming the wrong defect.`,
  ],
  "scripts/check-content.mjs#43": ["CONTRACT", "one line already; kept"],
  "scripts/check-content.mjs#44": [
    "WHY",
    "why order is compared as well as membership",
    `Order as well as membership: \`walkPublic()\` sorts, so an unsorted manifest is a hand edit or
a generator that stopped sorting. Compared as JSON for that reason rather than as sets.`,
  ],
  "scripts/check-content.mjs#45": [
    "CONTRACT",
    "the three reconciliations and why it does not re-encode; the finding reference goes to the history document",
    `THE PLACEHOLDER HALF OF THE MANIFEST, reconciled three ways. A placeholder is baked into the
rendered HTML this gate byte-compares, so a stale one is a value both writers agree on and
neither can check.

  1. MEMBERSHIP, both directions, derived by the same function \`build:assets\` uses.
  2. THE SOURCE DIGEST, because membership cannot see a file EDITED IN PLACE.
  3. THE STORED VALUE, through the SAME function check:image-weight uses on the D1 column.

IT DOES NOT RE-ENCODE: that would compare this machine's sharp against the one that wrote the
manifest, failing on one platform and passing on another.

@param {string[]} files every path under public/, from the walk
@param {Record<string, { sha?: string, lqip?: string }>} placeholders`,
  ],
  "scripts/check-content.mjs#46": [
    "WHY",
    "what an empty expectation would agree with",
    `FAILS CLOSED ON AN EMPTY EXPECTATION: if the classifier stopped calling anything a content
raster, every comparison below would agree with an empty manifest.`,
  ],
  "scripts/check-content.mjs#49": [
    "WHY",
    "why the executed count is paired, in one line",
    `The executed count, paired with the content check, so "0 problems" cannot mean "0 examined".`,
  ],
  "scripts/check-content.mjs#50": [
    "CONTRACT",
    "why it is a defect, the two live paths and why git is asked; the gitignore entry and the tripwire framing go to the history document",
    `A path may not be BOTH gitignored and in the manifest. The manifest is committed, so it
describes what the repository contains; a gitignored file under \`public/\` classifies fine,
enters the manifest on one machine, and exists in no clone, so the artifact has started
describing A DISK. Two things make that live: \`npm run deploy\` builds from the WORKING TREE,
and \`check:head\` extracts a ref into a worktree where the file is absent.

\`git check-ignore\` rather than parsing \`.gitignore\`: negations, precedence and nested ignore
files are git's semantics, and a second implementation would be wrong invisibly.

@param {string[]} manifestPaths site-absolute, as the manifest stores them`,
  ],
  "scripts/check-content.mjs#51": [
    "WHY",
    "the three states and which one is a pass",
    `SCOPE, ASSERTED FIRST. This reports "nothing ignored" when the list is empty, when git cannot
answer, and when every path is clean; only the third is a pass, so the other two are eliminated
before the answer is read.`,
  ],
  "scripts/check-content.mjs#52": [
    "WHY",
    "what each exit code means and which branch fails closed",
    `Exit 0 means at least one path IS ignored, 1 means none are, anything else is git failing to
answer. FAIL CLOSED on the third: this is the branch that would otherwise turn a missing git
into a silent pass forever.`,
  ],
};
