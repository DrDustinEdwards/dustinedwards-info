// Chunk 15: check-diagrams 0-37, check-design-sheets 0-24, build-assets 0-13,
// check-hook-syntax 0-17, build-publications 0-23, lib/r2 0-15, measure/deps 0-24,
// build-content 0-10.
//
// Wave 1's rule, over the wave's widest chunk: eight files, 171 blocks.
//
// check-hook-syntax carries the sharpest single argument in the wave and it stays whole: a
// plant that PASSED both assertions while the hook was broken, because the truncation is
// invisible from either end and only the JOIN between them is wrong. That is what the
// ALLOWED_AFTER rule is for, and without the paragraph the rule reads like fussiness.
export default {
  "scripts/check-diagrams.mjs#0": [
    "CONTRACT",
    "the boundary, what no other gate can catch and the three sections; the sibling-gate comparison and the plant instructions go to the history document",
    `Gate over the \`:::diagram\` directive and the assets it references.

  npm run check:diagrams

BOUNDARY: the contract, asset coverage and a colour audit over committed bytes. It does NOT run
mermaid and does not open a browser, so a diagram that renders as tangled spaghetti passes.
\`check:content\` catches a REFERENCE that drifted; what it cannot catch is a key that changed
while the asset did not, which is a broken image in the middle of an article and invisible to
every other gate, the artifact being internally consistent.

  1. The contract, every rule paired with its negative.
  2. Coverage, both directions between referenced keys and assets on disk.
  3. Colour, through the same module the build audits with.`,
  ],
  "scripts/check-diagrams.mjs#3": ["CONTRACT", "what it asserts; one line already"],
  "scripts/check-diagrams.mjs#7": ["CONTRACT", "section marker, rule padding cut", `1. The contract`],
  "scripts/check-diagrams.mjs#8": [
    "WHY",
    "what the fail-closed rule would do otherwise; the ruling date goes to the history document",
    `The directive has to be KNOWN, or the fail-closed unknown-directive rule rejects the syntax this
module implements.`,
  ],
  "scripts/check-diagrams.mjs#9": ["CONTRACT", "section marker, rule padding cut", `alt, and its negative`],
  "scripts/check-diagrams.mjs#10": ["CONTRACT", "section marker, rule padding cut", `source, and its negative`],
  "scripts/check-diagrams.mjs#11": ["CONTRACT", "section marker, rule padding cut", `keys`],
  "scripts/check-diagrams.mjs#12": [
    "WHY",
    "what a line-ending-dependent key would do",
    `The repo checks content out as LF and everything else as CRLF, so a line-ending-dependent key
would differ between clones and each would believe the other's asset missing.`,
  ],
  "scripts/check-diagrams.mjs#13": ["CONTRACT", "section marker, rule padding cut", `the emitted structure`],
  "scripts/check-diagrams.mjs#16": [
    "CONTRACT",
    "which element carries the name and why no override",
    `The contract names the element that IS the graphic, never the figure: for an \`<img>\` that is
\`alt\`, and a role plus a label would be a redundant override of a native mechanism.`,
  ],
  "scripts/check-diagrams.mjs#20": [
    "WHY",
    "why no dimensions are emitted",
    `No width or height: the pipeline may not touch the filesystem and the asset may not exist yet.`,
  ],
  "scripts/check-diagrams.mjs#22": ["WHY", "what a heading here would do; one line already"],
  "scripts/check-diagrams.mjs#26": ["CONTRACT", "section marker, rule padding cut", `2. The token map`],
  "scripts/check-diagrams.mjs#27": [
    "WHY",
    "what a token missing from one block resolves to",
    `Both theme blocks land on the same element and do not cascade into one another, so a token
forgotten in dark keeps its LIGHT value and the diagram is drawn light on a dark page.`,
  ],
  "scripts/check-diagrams.mjs#28": [
    "CONTRACT",
    "why the same call and why the throw is caught",
    `Resolution is the same call the build makes, so a map this gate accepts is a map that renders.
It THROWS on a bad token, so it is caught here and reported like every other assertion.

@param {"light" | "dark"} theme`,
  ],
  "scripts/check-diagrams.mjs#30": ["CONTRACT", "section marker, rule padding cut", `3. Coverage and colour over what is actually committed`],
  "scripts/check-diagrams.mjs#32": ["WHY", "why a generated file is still hand-editable; two lines already"],
  "scripts/check-diagrams.mjs#33": ["CONTRACT", "what a missing intrinsic size does; one line already"],
  "scripts/check-diagrams.mjs#34": ["WHY", "what a foreignObject does inside an img; three lines already"],
  "scripts/check-diagrams.mjs#35": ["WHY", "the zero-scope rule; one line already"],
  "scripts/check-diagrams.mjs#36": [
    "NUMBER",
    "what the executed floor cannot see and why these are set differently; the sweep, the measurement and its date go to the history document",
    `SCOPE FLOORS. Both counts were PRINTED and neither asserted, which is a number on the console
that no run can fail on. Every loop above iterates one of these, and the executed-count floor
cannot see them empty, the per-diagram assertions being a small share of the total. **These are
the one place where the floor is not set just under the measurement, because these counts are
CONTENT, not scope**: a post may legitimately drop a diagram, and what they must catch is the
walk collapsing.`,
  ],
  "scripts/check-diagrams.mjs#37": [
    "NUMBER",
    "why almost every assertion is inside a discovered loop; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR. Almost every assertion sits inside a loop over a discovered set, so an
empty discovery, a changed extension or a renamed directory all report a clean audit of nothing.
MEASURED BY RUNNING IT, never summed.`,
  ],
  "scripts/check-design-sheets.mjs#0": [
    "CONTRACT",
    "the defect a written prediction did not prevent, both directions, what is not here, the two import forms and the one exclusion; the quoted notes and the sheet names go to the history document",
    `Gate: the design sync's sheet list matches the stylesheets the public plane actually loads.

THE DEFECT, AND THE NOTES PREDICTED IT IN WRITING: they said the list is hand-maintained and
should be diffed against the imports, and nobody ran that diff, so a sheet imported by the root
module never reached the canvas and it DEFINES the grid class the design agent was redesigning
against. A prediction written in prose is a prediction nothing re-checks.

BOTH DIRECTIONS, because one is silent: a sheet SYNCED but no longer LOADED tells the canvas
about a surface that no longer exists. WHAT IS DELIBERATELY NOT HERE: a copy of the sheet list,
parsed out of its one owner (hard rule 17), a mirror being the failure being gated. CASCADE
ORDER is checked for the root-imported sheets only. COMMENTS ARE STRIPPED BEFORE MATCHING, and
not for hygiene: a stylesheet carries prose about an \`@import\` it removed and the converter's
own validator failed that sentence twice, which is hard rule 10, strip comments before matching.

TWO WAYS A SHEET REACHES A READER, and the first draft knew only one: a bare import joins the
bundled cascade, a side-load ships the sheet as its own file, and only the first has a POSITION.
THE ONE EXCLUSION IS THE NOTES', NOT THIS FILE'S, named as ONE path rather than a prefix,
because a pattern excludes everything that ever matches it, which is hard rule 10's enumerate
inside exclusions.`,
  ],
  "scripts/check-design-sheets.mjs#1": [
    "CONTRACT",
    "exact paths, and who owns the decision",
    `Sheets the public plane loads that the sync deliberately does not carry. Exact paths, never
prefixes; the grounds live in the notes, which own the decision.`,
  ],
  "scripts/check-design-sheets.mjs#2": [
    "NUMBER",
    "the zero-scope rule with its citation, in two lines",
    `Below these the scan has stopped reading rather than found a clean tree: a search over an empty
scope reports what a clean sweep reports (hard rule 10).`,
  ],
  "scripts/check-design-sheets.mjs#5": ["CONTRACT", "one spelling for every comparison; already short"],
  "scripts/check-design-sheets.mjs#8": ["CONTRACT", "what the cascade form is and what the quote excludes; already short"],
  "scripts/check-design-sheets.mjs#9": ["CONTRACT", "what a side-load is and what it lacks; already short"],
  "scripts/check-design-sheets.mjs#10": ["CONTRACT", "the CSS-level form; already short"],
  "scripts/check-design-sheets.mjs#11": ["CONTRACT", "how a specifier resolves; already short"],
  "scripts/check-design-sheets.mjs#12": ["CONTRACT", "what is not a repo sheet; one line already"],
  "scripts/check-design-sheets.mjs#13": ["CONTRACT", "who the importers are; one line already"],
  "scripts/check-design-sheets.mjs#14": ["CONTRACT", "what is out of scope; one line already"],
  "scripts/check-design-sheets.mjs#15": ["CONTRACT", "what the map holds; type annotation only"],
  "scripts/check-design-sheets.mjs#16": ["CONTRACT", "what the order is; type annotation only"],
  "scripts/check-design-sheets.mjs#18": [
    "CONTRACT",
    "why it is a type predicate",
    `A path this gate is responsible for. Narrows away null, which is why it is a type predicate.

@param {string | null} sheet @returns {sheet is string}`,
  ],
  "scripts/check-design-sheets.mjs#19": ["CONTRACT", "why side-loads are not ordered; two lines already"],
  "scripts/check-design-sheets.mjs#20": ["CONTRACT", "why the follow is transitive; two lines already"],
  "scripts/check-design-sheets.mjs#21": ["CONTRACT", "direction 1; one line already"],
  "scripts/check-design-sheets.mjs#22": ["CONTRACT", "direction 2; one line already"],
  "scripts/check-design-sheets.mjs#23": ["CONTRACT", "why every entry must exist; one line already"],
  "scripts/check-design-sheets.mjs#24": [
    "CONTRACT",
    "which sheets are ordered and which are not",
    `Cascade order, for the sheets the root module names. The list must carry them in the same
relative order; entries it does not import, arriving by \`@import\` or by their routes, are not
constrained here.`,
  ],
  "scripts/build-assets.mjs#0": [
    "CONTRACT",
    "why a Worker cannot list its assets, why the placeholder is here and why D1's is not a duplicate; the finding reference and the dimensions precedent go to the history document",
    `Enumerates \`public/\` into a committed manifest.

  npm run build:assets

**This exists because a Worker cannot list its own static assets.** The binding has one method,
so it can serve any path and discover none. Bytes, mime and dimensions are derived by the
rebuild from the actual file, so putting them here would be a second copy to go stale.

IT CARRIES ONE DERIVED VALUE, THE BODY PLACEHOLDER: the rendered HTML is a GATED ARTIFACT, so
what the Worker bakes in the Node build must bake in too, from a clone with no bindings, and a
committed artifact both resolvers read is the only shape that satisfies both. **The placeholder
D1 holds for the same file is NOT this one, and that is not a duplicate fact**: the rebuild
derives its own for the admin library, under rule 18. UPLOADED KEYS ARE EXCLUDED, here and in
the plugin: an uploaded object is not in the repository.`,
  ],
  "scripts/build-assets.mjs#1": [
    "CONTRACT",
    "which spelling is derived from which, and why",
    `The same file the manifest module names, spelled for this platform's filesystem. DERIVED in
this direction only: the repo path is POSIX because the Worker hands it to an API verbatim.`,
  ],
  "scripts/build-assets.mjs#2": [
    "CONTRACT",
    "why sorted and why the exclusion is inside the walk",
    `Every file under \`public/\`, site-absolute and sorted, so the artifact is stable: a generated
artifact that churns cannot be byte-compared. The exclusion is applied HERE, inside the walk,
because the gate imports this function and diffs what it returns against D1. One set, both
readers.

@param {string} [dir]
@returns {Promise<string[]>}`,
  ],
  "scripts/build-assets.mjs#4": ["CONTRACT", "why forward slashes; two lines already"],
  "scripts/build-assets.mjs#5": [
    "WHY",
    "why skipping is never a fallthrough",
    `Named non-assets only: anything else unrecognised meets the classifier, which throws. Skipping
is a decision someone made by name, never a fallthrough.`,
  ],
  "scripts/build-assets.mjs#6": [
    "CONTRACT",
    "what the narrowing is, why derived and what the gate asserts",
    `The paths that get a body placeholder: raster images a post can put in prose. The role is the
classifier's answer rather than a second rule here. DERIVED, never hand-listed, so a content
image gets one by existing, and the gate asserts this set both directions.

@param {string[]} paths`,
  ],
  "scripts/build-assets.mjs#7": ["CONTRACT", "what it is matched to; one line already"],
  "scripts/build-assets.mjs#8": [
    "CONTRACT",
    "what the digest makes checkable and why it does not re-encode",
    `One placeholder, plus the digest of the bytes it was derived FROM. The digest is what makes the
entry checkable: membership cannot see a file EDITED IN PLACE, which is the one way a static
asset changes. IT DOES NOT RE-ENCODE TO COMPARE: two machines running the same pinned encoder
can differ by a byte, and a gate that fails on one platform gets turned off.

@param {string} sitePath
@returns {Promise<{ sha: string, lqip: string }>}`,
  ],
  "scripts/build-assets.mjs#9": [
    "WHY",
    "why classification happens here",
    `Classify every path here rather than at rebuild time, so an unclassified extension stops THIS
build instead of failing inside a Worker where the symptom is a missing row.`,
  ],
  "scripts/build-assets.mjs#11": ["CONTRACT", "why the order is stable; two lines already"],
  "scripts/build-assets.mjs#12": ["CONTRACT", "why a no-op build leaves the mtime; one line already"],
  "scripts/build-assets.mjs#13": ["CONTRACT", "the first-run branch; one word already"],
  "scripts/check-hook-syntax.mjs#0": [
    "CONTRACT",
    "the outage, why no other gate sees it, what is asserted, why the interpreters are resolved and both boundary halves; the dated incidents and the line reference go to the history document",
    `Gate: every hook PARSES, in both languages it is written in.

  npm run check:hook-syntax

WHY IT EXISTS: a hook was broken twice by an APOSTROPHE. The checkers are embedded as
SINGLE-QUOTED strings, so one apostrophe ends the string, hands the remainder to the shell, and
the hook refuses every call in the session. A broken hook fails in the WORST direction: the
session stops working, or the guard silently stops guarding, and nothing else reads the hook
directory as CODE.

WHAT IS ASSERTED: a parse-only shell check on every hook, and that every embedded checker
COMPILES. Both interpreters are RESOLVED rather than named, neither being on PATH in the shell
that runs ship. BOUNDARY: **PARSING IS NOT BEHAVING.** One hook has its behaviour replayed
elsewhere; the others have their behaviour checked nowhere, which is a real gap. It also cannot
see whether a hook is REGISTERED, which hard rule 15 puts off limits to an agent.

FAILS CLOSED: no hooks found, no interpreter, or an unreadable file.`,
  ],
  "scripts/check-hook-syntax.mjs#2": ["CONTRACT", "section marker, rule padding cut", `the scope, asserted`],
  "scripts/check-hook-syntax.mjs#4": ["CONTRACT", "section marker, rule padding cut", `interpreters, first`],
  "scripts/check-hook-syntax.mjs#5": ["CONTRACT", "section marker, rule padding cut", `1. bash -n each`],
  "scripts/check-hook-syntax.mjs#6": ["CONTRACT", "section marker, rule padding cut", `2. the embedded Python, resolved not named`],
  "scripts/check-hook-syntax.mjs#7": [
    "WHY",
    "why a spelling scan finds nothing, with its citation",
    `THE EXTRACTOR RESOLVES BINDINGS RATHER THAN SPELLINGS, hard rule 10. NOT ONE of these hooks
contains the obvious literal: every one probes candidates into a variable and calls through it,
so a scan for the spelling finds ZERO embedded checkers and reports a clean sweep.

@param {string} source
@returns {string[]} the token spellings that invoke Python in this file`,
  ],
  "scripts/check-hook-syntax.mjs#8": ["CONTRACT", "the shape matched; one line already"],
  "scripts/check-hook-syntax.mjs#9": ["CONTRACT", "the shape matched; one line already"],
  "scripts/check-hook-syntax.mjs#11": [
    "CONTRACT",
    "why the body pattern is exact and what `after` proves",
    `Every embedded checker in one file. The body pattern is EXACT rather than lazy: a POSIX
single-quoted string cannot contain an apostrophe, so this captures precisely what the shell
would hand the interpreter, truncation included. \`after\` is what follows the closing quote,
which is what proves the string ended where the shell thinks it did.

@param {string} source
@returns {{ code: string, after: string }[]}`,
  ],
  "scripts/check-hook-syntax.mjs#13": [
    "WHY",
    "the plant that PASSED both assertions, and what catches it; the planted line and the date go to the history document",
    `What may legitimately follow the closing quote.

WHY COMPILING THE BODY IS NOT ENOUGH, AND THIS WAS MEASURED BY A PLANT THAT PASSED. An
apostrophe planted inside a comment ends the quoted string early, so the interpreter receives
only the prefix; that prefix was a COMPLETE PROGRAM whose last line was a comment, so the
compile accepted it, and the shell check also exited 0 because the remaining apostrophes
re-balanced into valid, meaningless shell. So the hook was BROKEN in exactly the way that caused
two outages and both assertions passed: the truncation is invisible from either end alone, and
only the JOIN between them is wrong.

What catches it is asking where the string ENDED: one of these is never followed by a bare word,
because a bare word there is the remainder of a program the shell reads as arguments.`,
  ],
  "scripts/check-hook-syntax.mjs#15": [
    "WHY",
    "what the compile alone proves",
    `AND THE STRING ENDED WHERE IT SHOULD: the body compiling proves only the PREFIX is valid.`,
  ],
  "scripts/check-hook-syntax.mjs#16": ["CONTRACT", "section marker, rule padding cut", `the floors`],
  "scripts/check-hook-syntax.mjs#17": [
    "NUMBER",
    "why two floors and which failure each catches; the measurement and its date go to the history document",
    `TWO FLOORS, the scopes failing independently. The hook count catches a directory that stopped
being read; the token count catches an extractor that stopped matching, which is likelier, a
hook rewritten to call its interpreter a fourth way contributing nothing.`,
  ],
  "scripts/build-publications.mjs#0": [
    "CONTRACT",
    "the inputs, that it is deterministic and that the artifact is generated; the moved flag goes to the history document",
    `Generates the publications module from the two source files.

  npm run build:publications

Inputs: the canonical bibliographic record, and the site-only fields keyed by DOI as deposited.
Deterministic and offline. The generated module is a build artifact: do not hand-edit it, the
gate importing \`generate()\` from here and failing on drift.`,
  ],
  "scripts/build-publications.mjs#1": [
    "CONTRACT",
    "why casefolded and what a raw join does",
    `DOI names are case-insensitive per the spec. Store as deposited, compare casefolded: a raw
join silently drops records rather than throwing.`,
  ],
  "scripts/build-publications.mjs#3": [
    "CONTRACT",
    "why two classes rather than one pattern",
    `Punctuation that never takes a space BEFORE it, and brackets that never take one after. Two
explicit classes rather than one clever pattern: they are different facts about typography.`,
  ],
  "scripts/build-publications.mjs#4": [
    "WHY",
    "why the space is load-bearing, what it costs and why the order matters; the two titles and the corpus counts go to the history document",
    `Registry markup reduced to plain text.

THE SPACE IS NOT OPTIONAL AND NEITHER IS CLEANING UP AFTER IT. Tags become a SPACE rather than
nothing, an earlier import having welded two words together. The cost is a space that was never
in the rendered text, which several titles carry, italicised organism names sitting inside
parentheses, and a title differing by a space may not match in Google Scholar. So the space is
inserted, whitespace collapsed, then the space removed from the two places typography never
puts one. The order matters: collapsing first means the cleanup sees a single space.

@param {string | null | undefined} value`,
  ],
  "scripts/build-publications.mjs#5": ["CONTRACT", "why JSON syntax works; one line already"],
  "scripts/build-publications.mjs#9": ["CONTRACT", "the order of authority; one line already"],
  "scripts/build-publications.mjs#11": [
    "CONTRACT",
    "why precision on deposit and why it is separate from the year; the corpus tally goes to the history document",
    `The publication date at WHATEVER PRECISION the registry deposited, separate from the year, which
stays the thing the page groups by. Padding would invent a day for month-only records and taking
the year would throw one away for most; emitting the deposited precision asserts nothing extra.

@param {any} record @returns {string | null}`,
  ],
  "scripts/build-publications.mjs#13": [
    "CONTRACT",
    "why the wide dash is an escape",
    `A page range, written as an escape rather than as the characters: this repo's hook refuses the
literal wide one, and an invisible-width character in a class is unreviewable.`,
  ],
  "scripts/build-publications.mjs#14": [
    "WHY",
    "the trap and why a positive match; the four shapes and their counts go to the history document",
    `A page value split into first and last, ONLY when it really is a page range. THE TRAP, AND IT IS
IN THIS CORPUS: some records carry an ARTICLE NUMBER rather than pagination, and a split is safe
on today's only because they contain no separator. Written as a positive match on the shape, so
a future article number carrying one cannot be read as a range.

@param {string | null | undefined} page
@returns {{ first: string | null, last: string | null }}`,
  ],
  "scripts/build-publications.mjs#19": ["CONTRACT", "which side the DOI comes from; two lines already"],
  "scripts/build-publications.mjs#22": [
    "CONTRACT",
    "why JSON rather than field by field",
    `EMITTED AS JSON, not field by field: a per-field emitter would be a second statement of the
shape another module owns.`,
  ],
  "scripts/build-publications.mjs#23": [
    "WHY",
    "why the guard exists and what the import would have done; the date and the argv aside go to the history document",
    `WRITES ONLY WHEN RUN DIRECTLY, and the gate's import is the reason: the bottom of this file used
to write at module scope, so importing it would have rewritten the very file the comparison was
about, and the gate would pass by repairing its own subject.`,
  ],
  "scripts/lib/r2.mjs#0": [
    "CONTRACT",
    "why one implementation, why a proxy and why the flag stays off the tracked config; the measured object counts go to the history document",
    `Listing an R2 bucket from a Node build script. ONE implementation, several callers.

**Why a platform proxy and not the CLI.** The CLI has three object verbs and no \`list\`, so the
one thing a reconciler cannot do without is the one thing it does not offer. The proxy hands a
Node script the same binding the Worker gets, over wrangler's existing OAuth.

**The remote flag goes on the BINDING and nowhere else**, and the config carrying it is built
here and thrown away, so the flag cannot leak into the real config and point local development
at production R2.`,
  ],
  "scripts/lib/r2.mjs#1": [
    "CONTRACT",
    "why it was lifted out",
    `Build the throwaway config that binds ONE bucket, and hand back a proxy. Lifted out when a
second caller arrived: a hand-rolled copy is how the remote flag or the discard discipline would
quietly stop being true.

@param {string} bucket @param {boolean} remote`,
  ],
  "scripts/lib/r2.mjs#2": ["CONTRACT", "what it is matched to and why no flags; two lines already"],
  "scripts/lib/r2.mjs#3": [
    "CONTRACT",
    "what the mirror does not cover, why size is verified and why the structure is recreated; the ruling reference goes to the history document",
    `Pull every object in a bucket to disk. THE ONLY COPY OUTSIDE THE ACCOUNT, the same-account
mirror doing nothing for account loss. **THE SIZE IS VERIFIED PER OBJECT, not just the count**:
a short read writes a file that exists, has a plausible name, and restores to a corrupt image.
Keys may carry a separator, so the structure is recreated rather than flattened.

@param {object} options
@param {string} options.bucket
@param {string} options.destDir
@param {boolean} [options.remote]
@returns {Promise<{ downloaded: number, bytes: number, mismatched: string[] }>}`,
  ],
  "scripts/lib/r2.mjs#7": ["WHY", "why it is reported rather than skipped; two lines already"],
  "scripts/lib/r2.mjs#8": [
    "CONTRACT",
    "why the paging is not a nicety; the shipped defect goes to the history document",
    `Every object under a prefix, PAGED TO THE END. Not a nicety: this repo has already shipped a
listing that ignored it, and a prune reported removing nothing for items on a later page.

@param {object} options
@param {string} options.bucket bucket name
@param {string} [options.prefix] "" lists the whole bucket
@param {boolean} [options.remote] false reads local state
@returns {Promise<Array<{ key: string, size: number, uploaded: string, etag: string }>>}`,
  ],
  "scripts/lib/r2.mjs#12": ["CONTRACT", "why a cursorless truncation is refused; two lines already"],
  "scripts/lib/r2.mjs#13": [
    "WHY",
    "what is swallowed and what is deliberately not; the measured failure goes to the history document",
    `The runtime can throw on teardown after a remote session, and the listing is already in hand.
Note what this does NOT swallow: an error from the listing itself propagates, which is the whole
safety property, a caller that deletes having to tell "the bucket holds nothing" from "the
listing did not finish".`,
  ],
  "scripts/lib/r2.mjs#14": ["CONTRACT", "what the catch covers; one phrase already"],
  "scripts/lib/r2.mjs#15": [
    "CONTRACT",
    "why it is separate and the two refusal rules; the dated run and its output go to the history document",
    `A listing a destructive caller may act on, or a refusal.

**Why this is separate.** A prune once printed a transport error mid-output and carried on to
report one orphan. It was correct that time and would have looked EXACTLY THE SAME if the
listing had been cut short, and the difference is deleting one dead file or every live one. So
a caller states how many objects it expects to still be there:

  - an EMPTY listing is always a refusal: a bucket that holds nothing needs no prune.
  - a listing missing a key the caller expects is demonstrably missing objects that certainly
    exist, so everything else it appears to be missing is unproven too.

@param {object} options
@param {string} options.bucket
@param {string} [options.prefix]
@param {boolean} [options.remote]
@param {Set<string>} options.expected keys the caller knows must be present
@param {string} options.label for the message`,
  ],
  "scripts/measure/deps.mjs#0": [
    "CONTRACT",
    "that it is not a gate, what each column is measured with and why there is no byte column; the stale counts and the build timings go to the history document",
    `Dependency lean-out measurement. REPORTS, never changes anything.

  node scripts/measure/deps.mjs [--json]

NOT A GATE, AND DELIBERATELY NOT IN \`scripts/\`, the runner deriving the gate list from the check
scripts. It exists so the next dependency session re-measures rather than re-reads a stale table.

WHAT EACH COLUMN IS MEASURED WITH, the methods differing in strength:

  pin          package.json, verbatim.
  kind         which block it sits in, NOT where it is used; the two disagreeing is a finding.
  transitive   distinct packages reachable in the REAL install, not what the lockfile resolves.
  disk         the package's OWN directory, NOT its unique subtree: the installer hoists.
  used         the first import site found, with file and line, or NOTHING IMPORTS IT.
  reach        derived from \`used\`: does any importer ship in the Worker.

WHY THERE IS NO PER-PACKAGE BYTE COLUMN: there is no honest way to fill one from a single build
here, and a number in that column would be believed. The only precise method is a size-by-import
diff, which is over an hour at this dependency count, so this reports REACHABILITY, which is the
question that decides a lean-out: a measured zero, not an unknown.`,
  ],
  "scripts/measure/deps.mjs#1": [
    "WHY",
    "why the root is scanned; the two packages go to the history document",
    `Directories scanned for imports, and whether code there ships in the Worker. THE ROOT IS IN THE
LIST, and leaving it out was the first version's bug: the build configs sit at the repository
root, so the build plugins read as NOTHING IMPORTS IT while both are imported by the configs
that make the build work.`,
  ],
  "scripts/measure/deps.mjs#2": ["CONTRACT", "section marker, rule padding cut", `the installed tree`],
  "scripts/measure/deps.mjs#3": [
    "WHY",
    "why the exit code is not the gate; the first run goes to the history document",
    `\`npm ls\` EXITS NONZERO ON TREE PROBLEMS and still prints a complete tree, so the exit code is
not the gate here. It exited nonzero on the first run because the install was one bump behind,
which is exactly the condition that makes every number below describe a tree nobody has.`,
  ],
  "scripts/measure/deps.mjs#6": ["CONTRACT", "what is counted; one line already"],
  "scripts/measure/deps.mjs#9": ["CONTRACT", "section marker, rule padding cut", `on disk`],
  "scripts/measure/deps.mjs#10": ["CONTRACT", "what it returns when absent; one line already"],
  "scripts/measure/deps.mjs#13": ["CONTRACT", "why a vanished file contributes nothing; one line already"],
  "scripts/measure/deps.mjs#14": ["CONTRACT", "section marker, rule padding cut", `importers`],
  "scripts/measure/deps.mjs#15": ["CONTRACT", "what it walks; one line already"],
  "scripts/measure/deps.mjs#18": ["CONTRACT", "what the root pass must not do; two lines already"],
  "scripts/measure/deps.mjs#19": [
    "WHY",
    "why the needle is the specifier, with its discipline",
    `The first real import of a package, as file and line. MATCHES THE SPECIFIER, NOT THE NAME
ANYWHERE IN THE FILE: a bare name scan finds the package in prose and in a comment arguing
against it.`,
  ],
  "scripts/measure/deps.mjs#22": [
    "WHY",
    "what a type-only import ships; the misreported package goes to the history document",
    `A TYPE-ONLY IMPORT SHIPS NOTHING: counting it as reaching the Worker put a dev dependency in
the shipping column on the strength of a line contributing zero bytes, which is what the first
version reported.`,
  ],
  "scripts/measure/deps.mjs#23": ["CONTRACT", "section marker, rule padding cut", `the rows`],
  "scripts/build-content.mjs#0": [
    "CONTRACT",
    "what it writes, why gitignored and who proves it; the artifact-arc reference goes to the history document",
    `Renders the corpus into the LOCAL build product. Gitignored: git holds markdown, D1 holds the
only rendered copy, and everything that reads this file runs after a build.`,
  ],
  "scripts/build-content.mjs#1": ["CONTRACT", "why markdown; one line already"],
  "scripts/build-content.mjs#2": [
    "CONTRACT",
    "why sorted",
    `Renders every post and returns the artifact exactly as it should sit on disk. Sorted by slug, so
the output depends on content alone rather than on filesystem order.

@returns {Promise<string>}`,
  ],
  "scripts/build-content.mjs#4": [
    "CONTRACT",
    "why read rather than imported, and the build order; the ruling reference goes to the history document",
    `The page half of the corpus. Read rather than imported, a JSON import needing an attribute this
repo's compiler settings reject; the Worker's copy imports them instead. BUILD ORDER: this
depends on the stack artifact, so that build runs FIRST, a stale one producing page records the
next build will not reproduce.`,
  ],
  "scripts/build-content.mjs#5": [
    "CONTRACT",
    "why the generated module rather than the JSON",
    `THE PAPERS COME FROM A COMMITTED MODULE, not the JSON read above: that module is generated from
the two data files and byte-gated against them. Reading the JSON again would be a second
assembly of the same records.`,
  ],
  "scripts/build-content.mjs#6": [
    "CONTRACT",
    "why it is not in the build product",
    `The date of the last commit that touched a file. Deliberately NOT written into the build product:
a render must be a pure function of the sources, and the Worker writer has no git.

@param {string} file
@returns {string | null}`,
  ],
  "scripts/build-content.mjs#7": ["CONTRACT", "why absence is the honest answer; one line already"],
  "scripts/build-content.mjs#8": [
    "CONTRACT",
    "why one owner, why a Date, why explicit midnight and why null is real, with its citation",
    `The revision date a post's row carries, or null. ONE OWNER for the rule, which decides whether a
reader sees an "Updated" line: the gate that renders that markup offline feeds the component the
value production would write, and computing it there would be a second statement, where a
measured value goes to one place or to nowhere, which is hard rule 17. A \`Date\` rather than a
string, because returning the string leaves both consumers parsing, which is where a timezone
gets in. NULL IS A REAL ANSWER: a shallow clone has no history for most files, so the gate
asserts the PAIRING rather than the presence.

@param {{ updated?: string | null, sourcePath: string }} post
@returns {Date | null}`,
  ],
  "scripts/build-content.mjs#9": [
    "CONTRACT",
    "why markdown, why rendered here and why the resolver refuses; the section citation goes to the history document",
    `The About page, rendered from markdown into the shape its route imports.

WHY MARKDOWN AND NOT JSX: this one is a person's description of themselves, revised on taste,
and they should not have to edit a component to move a comma. WHY RENDERED HERE AND NOT IN THE
WORKER: the public plane must not grow a second markdown renderer, nor pay for the first on a
static page. THE SAME RENDERER THE CORPUS USES, or the page drifts from the posts beside it in
exactly the ways nobody checks. The image resolver REFUSES: one here would need a build-time
measurement this function does not do, and would render unsized.

@returns {Promise<string>} the artifact exactly as it should sit on disk`,
  ],
};
