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
mermaid and does not open a browser, so a diagram that renders as tangled spaghetti passes as
long as its key, its alt and its colours are right.

\`check:content\` already catches a REFERENCE that drifted, because the key is a pure function of
the source and rides in the gated artifact. What it cannot catch is the thing that reference
points at: a key that changed while the asset did not is a broken image in the middle of an
article, invisible to every other gate, because the artifact is internally consistent, the
typecheck passes and the page renders.

  1. The contract: mandatory alt, source required, deterministic keys, the figure structure, and
     a token map naming only tokens that exist in both theme blocks. Every rule paired with its
     negative.
  2. Coverage: every referenced key has both assets on disk, and no asset on disk is
     unreferenced.
  3. Colour: every committed asset audited against the palette its theme resolves to, through
     the same module the build audits with.`,
  ],
  "scripts/check-diagrams.mjs#3": ["CONTRACT", "what it asserts; one line already"],
  "scripts/check-diagrams.mjs#7": ["CONTRACT", "section marker, rule padding cut", `1. The contract`],
  "scripts/check-diagrams.mjs#8": [
    "WHY",
    "what the fail-closed rule would do otherwise; the ruling date goes to the history document",
    `The directive has to be KNOWN, or the fail-closed unknown-directive rule rejects the syntax
this module implements. Adding a directive means adding it to that list in the same commit.`,
  ],
  "scripts/check-diagrams.mjs#9": ["CONTRACT", "section marker, rule padding cut", `alt, and its negative`],
  "scripts/check-diagrams.mjs#10": ["CONTRACT", "section marker, rule padding cut", `source, and its negative`],
  "scripts/check-diagrams.mjs#11": ["CONTRACT", "section marker, rule padding cut", `keys`],
  "scripts/check-diagrams.mjs#12": [
    "WHY",
    "what a line-ending-dependent key would do",
    `The repo checks content out as LF and everything else as CRLF, so a key that depended on line
endings would differ between a Windows and a Linux clone and each would believe the other's
asset was missing.`,
  ],
  "scripts/check-diagrams.mjs#13": ["CONTRACT", "section marker, rule padding cut", `the emitted structure`],
  "scripts/check-diagrams.mjs#16": [
    "CONTRACT",
    "which element carries the name and why no override",
    `The contract names the element that IS the graphic, never the figure. For an \`<img>\` that name
is \`alt\`, and a role plus a label would be a redundant override of a native mechanism.`,
  ],
  "scripts/check-diagrams.mjs#20": [
    "WHY",
    "why no dimensions are emitted",
    `No width or height: the pipeline may not touch the filesystem and the asset legitimately may
not exist yet, so there is nothing honest to measure.`,
  ],
  "scripts/check-diagrams.mjs#22": ["WHY", "what a heading here would do; one line already"],
  "scripts/check-diagrams.mjs#26": ["CONTRACT", "section marker, rule padding cut", `2. The token map`],
  "scripts/check-diagrams.mjs#27": [
    "WHY",
    "what a token missing from one block resolves to",
    `Both theme blocks land on the same element, so they do not cascade into one another: a token
declared in light and forgotten in dark keeps its LIGHT value, and a diagram would then be drawn
in light colours on a dark page.`,
  ],
  "scripts/check-diagrams.mjs#28": [
    "CONTRACT",
    "why the same call and why the throw is caught",
    `Resolution is the same call the build makes, so a map this gate accepts is a map that renders.
It THROWS on a bad token rather than returning, which would exit with a stack trace instead of a
named failure, so it is caught here and reported like every other assertion.

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
    `SCOPE FLOORS. Both counts were PRINTED and neither was asserted, which is the shape this repo
keeps paying for: a number on the console that no run can fail on.

Every loop above iterates one of these two collections, so an artifact that parsed to nothing
empties them and each loop reports a clean sweep over zero items. The executed-count floor at
the end cannot see it, because the per-diagram assertions are a small share of the total and the
corpus can collapse while the count stays over its floor.

**These are the one place in the sweep where the floor is not set just under the measurement,
and the reason is stated rather than left to look like slack: these counts are CONTENT, not
scope.** A post may legitimately drop a diagram, and a floor that fails on that is a gate telling
an author what to write. What they must catch is the walk collapsing.`,
  ],
  "scripts/check-diagrams.mjs#37": [
    "NUMBER",
    "why almost every assertion is inside a discovered loop; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR. This gate walks committed assets and audits the colours reachable through
the cascade, and almost every assertion sits inside a loop over a discovered set, so an empty
discovery, a changed extension or a renamed directory all report a clean audit of nothing.

MEASURED BY RUNNING IT, never summed. The count scales with the committed diagrams and the rules
inside each, so it steps sharply when one is added and should not drift otherwise.`,
  ],
  "scripts/check-design-sheets.mjs#0": [
    "CONTRACT",
    "the defect a written prediction did not prevent, both directions, what is not here, the two import forms and the one exclusion; the quoted notes and the sheet names go to the history document",
    `Gate: the design sync's sheet list matches the stylesheets the public plane actually loads.

THE DEFECT, AND THE NOTES PREDICTED IT IN WRITING. They said the list is hand-maintained, will
go stale, and should be diffed against the imports before trusting a re-sync. Nobody ran that
diff: a sheet imported by the root module was absent from the list, so it never reached the
bundle and never reached the canvas, and that sheet DEFINES the grid class the design agent was
redesigning against. A prediction written in prose is a prediction nothing re-checks.

OFFLINE TIER: it reads the list, the root module, the routes and the stylesheets they name, all
off disk, so a clean checkout can run it.

BOTH DIRECTIONS, because one of them is the silent one. A sheet LOADED but not SYNCED is the
defect above. A sheet SYNCED but no longer LOADED is quieter: the bundle carries rules the site
has stopped applying, so the canvas is told about a surface that no longer exists.

WHAT IS DELIBERATELY NOT HERE: a copy of the sheet list, which is parsed out of its one owner
(hard rule 17), a mirror being the very failure being gated. CASCADE ORDER is checked for the
root-imported sheets only, because that is where the repo defines one; across routes there is no
defined order. COMMENTS ARE STRIPPED BEFORE MATCHING, and this is not hygiene: a stylesheet
carries prose about an \`@import\` it removed, and the converter's own validator failed that
sentence twice as a missing import, which is hard rule 10, "strip comments before matching".

TWO WAYS A SHEET REACHES A READER, and the first draft knew only one. A bare import joins the
bundled cascade; a \`?url\` side-load ships the sheet as its own file linked at the point of use.
Both reach readers and only the first has a cascade POSITION, so scanning only the cascade form
reported a side-loaded sheet as orphaned, which was this gate failing rather than the repo.

THE ONE EXCLUSION IS THE NOTES', NOT THIS FILE'S, and it is named as ONE path rather than a
prefix, because an exclusion written as a pattern excludes everything that ever matches it,
which is hard rule 10's "enumerate inside exclusions".`,
  ],
  "scripts/check-design-sheets.mjs#1": [
    "CONTRACT",
    "exact paths, and who owns the decision",
    `Sheets the public plane loads that the sync deliberately does not carry. Exact paths, never
prefixes. Grounds live in the notes, which own the decision; this list only has to stay short
enough to read.`,
  ],
  "scripts/check-design-sheets.mjs#2": [
    "NUMBER",
    "the zero-scope rule with its citation, in two lines",
    `Below these the scan has stopped reading rather than found a clean tree. A search over an
empty scope reports what a clean sweep reports (hard rule 10), so each is asserted before any
conclusion is drawn from a count.`,
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
    `A path this gate is responsible for. Narrows away null so every caller downstream has a
string, which is why it is a type predicate rather than a plain boolean.

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

**This exists because a Worker cannot list its own static assets.** The assets binding has
exactly one method, so it can serve any path it is given and discover none of them. The media
rebuild runs in the Worker, where every binding it needs is real, so the one thing it cannot do
for itself is find out which static files exist.

Bytes, mime and dimensions are derived by the rebuild from the actual file, so putting them here
would create a second copy to go stale for no gain.

IT CARRIES ONE DERIVED VALUE, THE BODY PLACEHOLDER, AND WHY. The rendered HTML is a GATED
ARTIFACT, so whatever the Worker bakes into it the Node build has to bake in too, from a clone,
with no bindings and no network. A placeholder is neither derivable from the src nor readable
from the same store by both writers, and a committed artifact both resolvers read is the only
shape that satisfies both.

**The placeholder D1 holds for the same file is NOT this one, and that is not a duplicate
fact.** The rebuild derives its own for the admin library, under rule 18: the index is a
projection of what exists. This one is an input to a gated build artifact. Two consumers, two
derivation paths, and neither can serve the other.

UPLOADED KEYS ARE EXCLUDED, here and in the plugin: an uploaded object is not in the repository,
so no build could derive one.`,
  ],
  "scripts/build-assets.mjs#1": [
    "CONTRACT",
    "which spelling is derived from which, and why",
    `The same file the manifest module names, spelled for this platform's filesystem. DERIVED, in
this direction only: the repo path is POSIX because the Worker hands it to an API verbatim, and
a Windows-joined result would 404 there in a way that reads like a missing artifact.`,
  ],
  "scripts/build-assets.mjs#2": [
    "CONTRACT",
    "why sorted and why the exclusion is inside the walk",
    `Every file under \`public/\`, as site-absolute paths, sorted, so the artifact is stable: an
unordered read would rewrite the file on a machine that enumerates differently, and a generated
artifact that churns cannot be byte-compared by anything.

Minus the named non-assets. The exclusion is applied HERE, inside the walk, rather than at the
call site: the gate imports this function and diffs what it returns against D1, so an exclusion
applied only to the manifest would make the gate demand a row for a file the manifest omits. One
set, both readers.

@param {string} [dir]
@returns {Promise<string[]>}`,
  ],
  "scripts/build-assets.mjs#4": ["CONTRACT", "why forward slashes; two lines already"],
  "scripts/build-assets.mjs#5": [
    "WHY",
    "why skipping is never a fallthrough",
    `Named non-assets only. Anything else unrecognised stays in the list and meets the classifier,
which throws. Skipping is a decision someone made by name, never a fallthrough.`,
  ],
  "scripts/build-assets.mjs#6": [
    "CONTRACT",
    "what the narrowing is, why derived and what the gate asserts",
    `The paths that get a body placeholder: raster images a post can put in prose. The role is the
narrowing, and it is the classifier's answer rather than a second rule written here, because the
other roles never reach the markdown plugin and deriving placeholders for them would be
kilobytes of manifest nothing reads.

DERIVED, never hand-listed, so a content image added gets one by existing, and the gate asserts
this set against the manifest in both directions.

@param {string[]} paths`,
  ],
  "scripts/build-assets.mjs#7": ["CONTRACT", "what it is matched to; one line already"],
  "scripts/build-assets.mjs#8": [
    "CONTRACT",
    "what the digest makes checkable and why it does not re-encode",
    `One placeholder, plus the digest of the bytes it was derived FROM. The digest is what makes the
entry checkable: membership catches a file added or deleted and cannot see one EDITED IN PLACE,
which is the one way a static asset changes, these paths not being content addressed.

IT DOES NOT RE-ENCODE TO COMPARE, deliberately: two machines running the same pinned encoder can
differ by a byte, and a gate that fails on one platform and passes on another gets turned off.
That the stored value IS lossy is asserted separately, through the same function the sibling
gate uses on the D1 column.

@param {string} sitePath
@returns {Promise<{ sha: string, lqip: string }>}`,
  ],
  "scripts/build-assets.mjs#9": [
    "WHY",
    "why classification happens here",
    `Classify every path here rather than at rebuild time, so an unclassified extension stops THIS
build with a clear message instead of failing inside a Worker where the only symptom would be a
missing row.`,
  ],
  "scripts/build-assets.mjs#11": ["CONTRACT", "why the order is stable; two lines already"],
  "scripts/build-assets.mjs#12": ["CONTRACT", "why a no-op build leaves the mtime; one line already"],
  "scripts/build-assets.mjs#13": ["CONTRACT", "the first-run branch; one word already"],
  "scripts/check-hook-syntax.mjs#0": [
    "CONTRACT",
    "the outage, why no other gate sees it, what is asserted, why the interpreters are resolved and both boundary halves; the dated incidents and the line reference go to the history document",
    `Gate: every hook PARSES, in both languages it is written in.

  npm run check:hook-syntax

WHY IT EXISTS: a hook was broken twice by an APOSTROPHE. The checkers are embedded in the shell
script as SINGLE-QUOTED strings, so one apostrophe inside the embedded program ends the string,
hands the remainder to the shell as commands, and the hook then refuses every call in the
session.

A broken hook fails in the WORST direction available. These are PreToolUse guards: the session
stops being able to work, or, when the breakage is in an arm rather than the parser, the guard
silently stops guarding. Neither is visible to any other gate, because nothing else reads the
hook directory as CODE.

WHAT IS ASSERTED: a parse-only shell check on every hook, and that every embedded checker
COMPILES. Both interpreters are RESOLVED rather than named, because neither is on PATH in the
shell that runs ship and both are in the shell a session runs: a gate naming either would be
green here and absent there.

BOUNDARY: **PARSING IS NOT BEHAVING.** A hook that parses can still block the wrong command,
allow the right one, or read the wrong field off the payload. One hook has its behaviour
replayed elsewhere; the others have their syntax checked here and their behaviour checked
nowhere, which is a real gap and is stated rather than papered over. It also cannot see whether
a hook is REGISTERED, which hard rule 15 puts off limits to an agent.

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
so a scan for the spelling finds ZERO embedded checkers and, without the floor below, reports a
clean sweep of a file set it never opened.

@param {string} source
@returns {string[]} the token spellings that invoke Python in this file`,
  ],
  "scripts/check-hook-syntax.mjs#8": ["CONTRACT", "the shape matched; one line already"],
  "scripts/check-hook-syntax.mjs#9": ["CONTRACT", "the shape matched; one line already"],
  "scripts/check-hook-syntax.mjs#11": [
    "CONTRACT",
    "why the body pattern is exact and what `after` proves",
    `Every embedded checker in one file. The body pattern is EXACT rather than lazy: a POSIX
single-quoted string cannot contain an apostrophe, which is the entire reason the outage
happened, so this captures precisely what the shell would hand the interpreter, including the
truncation an apostrophe causes.

\`after\` is everything following the closing quote, which is what proves the string ended where
the shell thinks it did.

@param {string} source
@returns {{ code: string, after: string }[]}`,
  ],
  "scripts/check-hook-syntax.mjs#13": [
    "WHY",
    "the plant that PASSED both assertions, and what catches it; the planted line and the date go to the history document",
    `What may legitimately follow the closing quote.

WHY COMPILING THE BODY IS NOT ENOUGH, AND THIS WAS MEASURED BY A PLANT THAT PASSED. An
apostrophe planted inside a comment in the embedded checker ends the quoted string early, so the
interpreter receives only the prefix. That prefix was a COMPLETE PROGRAM whose last line was a
comment, so the compile accepted it, and the shell check also exited 0, because the remaining
apostrophes happened to re-balance into valid, meaningless shell.

So the hook was BROKEN in exactly the way that caused two outages, and both assertions passed.
The truncation is invisible from either end alone: the body parses, the file parses, and only
the JOIN between them is wrong.

What catches it is asking where the string ENDED. One of these is always followed by a closing
paren, a redirection, a pipe, a separator, or end of line. It is never followed by a bare word,
because a bare word there is the remainder of a program the shell has started reading as
arguments.`,
  ],
  "scripts/check-hook-syntax.mjs#15": [
    "WHY",
    "what the compile alone proves",
    `AND THE STRING ENDED WHERE IT SHOULD: the body compiling proves only that the PREFIX is valid,
and a truncation landing in a comment produces a valid prefix.`,
  ],
  "scripts/check-hook-syntax.mjs#16": ["CONTRACT", "section marker, rule padding cut", `the floors`],
  "scripts/check-hook-syntax.mjs#17": [
    "NUMBER",
    "why two floors and which failure each catches; the measurement and its date go to the history document",
    `TWO FLOORS, because the two scopes fail independently. The hook count catches a directory that
stopped being read. The token count catches an extractor that stopped matching, which is the
likelier failure: the tokens are harvested by regex from shell source, and a hook rewritten to
call its interpreter a fourth way would silently contribute nothing.`,
  ],
  "scripts/build-publications.mjs#0": [
    "CONTRACT",
    "the inputs, that it is deterministic and that the artifact is generated; the moved flag goes to the history document",
    `Generates the publications module from the two source files.

  npm run build:publications

Inputs: the canonical bibliographic record, and the site-only fields keyed by DOI as deposited.
Deterministic and offline; the network refresh that produces those two files lives outside this
repo.

The generated module is a build artifact. Do not hand-edit it: the gate imports \`generate()\`
from here and fails if the committed module has drifted from a fresh generation.`,
  ],
  "scripts/build-publications.mjs#1": [
    "CONTRACT",
    "why casefolded and what a raw join does",
    `DOI names are case-insensitive per the spec, which folds ASCII case for comparison. Store as
deposited, compare casefolded: a raw-string join here silently drops records rather than
throwing.`,
  ],
  "scripts/build-publications.mjs#3": [
    "CONTRACT",
    "why two classes rather than one pattern",
    `Punctuation that never takes a space BEFORE it, and brackets that never take one after. Listed
as two explicit classes rather than one clever pattern, because they are different facts about
typography and a combined regex would be unreadable at exactly the point somebody needs to check
it.`,
  ],
  "scripts/build-publications.mjs#4": [
    "WHY",
    "why the space is load-bearing, what it costs and why the order matters; the two titles and the corpus counts go to the history document",
    `Registry markup reduced to plain text.

THE SPACE IS NOT OPTIONAL AND NEITHER IS CLEANING UP AFTER IT. Tags are replaced with a SPACE
rather than with nothing, and that rule is load-bearing: an earlier import replaced them with
nothing and welded two words together.

The cost is that a tag sitting against punctuation leaves a space that was never in the rendered
text, which several titles in this corpus carry, because italicised organism names sit inside
parentheses. A title that differs from the published one by a space is a title Google Scholar
may not match, and a correction takes months.

So the space is inserted, whitespace is collapsed, and then the space is removed from the two
places typography never puts one. The order matters: collapsing first means the cleanup sees a
single space rather than a run.

@param {string | null | undefined} value`,
  ],
  "scripts/build-publications.mjs#5": ["CONTRACT", "why JSON syntax works; one line already"],
  "scripts/build-publications.mjs#9": ["CONTRACT", "the order of authority; one line already"],
  "scripts/build-publications.mjs#11": [
    "CONTRACT",
    "why precision on deposit and why it is separate from the year; the corpus tally goes to the history document",
    `The publication date at WHATEVER PRECISION the registry deposited. Separate from the year,
which stays a number and stays the thing the page groups and sorts by; this exists for the
citation tag, which is one of the three fields whose absence stops a paper being indexed.

Padding everything to a full date would invent a day for the records that carry only a month,
and taking the year for all of them would throw one away for most. Emitting the precision on
deposit is the only option that asserts nothing the registry did not.

@param {any} record @returns {string | null}`,
  ],
  "scripts/build-publications.mjs#13": [
    "CONTRACT",
    "why the wide dash is an escape",
    `A page range, written as an escape rather than as the characters. The registry deposits both a
plain hyphen and a wide one, and the wide one is escaped because this repo's hook refuses the
literal character and because an invisible-width character in a class is unreviewable: a reader
cannot tell a correct one from whatever a copy and paste turned it into.`,
  ],
  "scripts/build-publications.mjs#14": [
    "WHY",
    "the trap and why a positive match; the four shapes and their counts go to the history document",
    `A page value split into first and last, ONLY when it really is a page range.

THE TRAP, AND IT IS IN THIS CORPUS: the obvious implementation splits on a hyphen, and some
records carry an ARTICLE NUMBER rather than pagination, because that publisher numbers articles
instead. A split is safe on today's only because they happen to contain no separator.

The rule is written as a positive match on the shape rather than as a split, so a future article
number carrying one cannot be read as a range, and so the first-page tag is emitted only where a
first page exists.

@param {string | null | undefined} page
@returns {{ first: string | null, last: string | null }}`,
  ],
  "scripts/build-publications.mjs#19": ["CONTRACT", "which side the DOI comes from; two lines already"],
  "scripts/build-publications.mjs#22": [
    "CONTRACT",
    "why JSON rather than field by field",
    `EMITTED AS JSON, not field by field, because it is a small closed record and a per-field
emitter here would be a second statement of the shape another module owns.`,
  ],
  "scripts/build-publications.mjs#23": [
    "WHY",
    "why the guard exists and what the import would have done; the date and the argv aside go to the history document",
    `WRITES ONLY WHEN RUN DIRECTLY. The gate imports \`generate()\` and compares, and that import is
the reason for this guard: the bottom of this file used to write at module scope, so importing
it for the comparison would have rewritten the very file the comparison was about, and the gate
would have passed by repairing its own subject before looking at it. A gate that cannot fail is
the tenth vacuity class, reached through an import rather than through an assertion.`,
  ],
  "scripts/lib/r2.mjs#0": [
    "CONTRACT",
    "why one implementation, why a proxy and why the flag stays off the tracked config; the measured object counts go to the history document",
    `Listing an R2 bucket from a Node build script.

ONE implementation, several callers: a second copy of this would be a second place for the
paging to be got wrong.

**Why a platform proxy and not the CLI.** The CLI has exactly three object verbs and no \`list\`,
so the one thing a reconciler cannot do without is the one thing it does not offer. The proxy
hands a Node script the same binding the Worker gets, over wrangler's existing OAuth, which is
why nothing here needs a new token or an access key.

**The remote flag goes on the BINDING and nowhere else.** It is what selects the real bucket
rather than local state, and the config carrying it is built here and thrown away rather than
tracked, so the flag cannot leak into the real config and quietly point local development at
production R2.`,
  ],
  "scripts/lib/r2.mjs#1": [
    "CONTRACT",
    "why it was lifted out",
    `Build the throwaway config that binds ONE bucket, and hand back a proxy. Lifted out when a
second caller arrived: the remote flag and the discard-the-config discipline are the two things
this file's header argues for, and a second hand-rolled copy is exactly how one of them would
quietly stop being true.

@param {string} bucket @param {boolean} remote`,
  ],
  "scripts/lib/r2.mjs#2": ["CONTRACT", "what it is matched to and why no flags; two lines already"],
  "scripts/lib/r2.mjs#3": [
    "CONTRACT",
    "what the mirror does not cover, why size is verified and why the structure is recreated; the ruling reference goes to the history document",
    `Pull every object in a bucket to disk. THE ONLY COPY OUTSIDE THE ACCOUNT: the same-account
mirror covers the realistic loss, which is this site's own code deleting an object, and does
nothing at all for account loss or compromise.

**THE SIZE IS VERIFIED PER OBJECT, not just the count.** A short read writes a file that exists,
has a plausible name, and restores to a corrupt image. A backup whose failure mode looks exactly
like success is the thing this whole script family is about.

Keys may carry a separator, so the directory structure is recreated rather than flattened, which
would let two distinct keys collide on one filename.

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
    `Every object under a prefix, PAGED TO THE END. The paging is not a nicety: this repo has
already shipped a listing that ignored it, and a prune reported removing nothing for items that
were real and sat on a later page. A lister that cannot see an object reports success either
way.

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
    `The runtime can throw on teardown after a remote session. The listing is already in hand by
then, so a dispose that fails must not fail the caller.

Note what this does NOT swallow: an error thrown by the listing itself propagates and this
function never returns. That distinction is the whole safety property, because a caller that
deletes things must be able to tell "the bucket holds nothing" from "the listing did not
finish".`,
  ],
  "scripts/lib/r2.mjs#14": ["CONTRACT", "what the catch covers; one phrase already"],
  "scripts/lib/r2.mjs#15": [
    "CONTRACT",
    "why it is separate and the two refusal rules; the dated run and its output go to the history document",
    `A listing a destructive caller may act on, or a refusal.

**Why this is separate.** A prune run once printed a transport error in the middle of its output
and carried on to report one orphan. It was correct that time, and it would have looked EXACTLY
THE SAME if the listing had been cut short, and the difference between those two cases is
deleting one dead file or deleting every live one.

So a caller about to delete does not get a bare array. It states how many objects it expects to
still be there, and this refuses if the listing cannot support that:

  - an EMPTY listing is always a refusal, because a bucket that genuinely holds nothing needs no
    prune, so there is no case where acting on zero is both correct and necessary.
  - a listing missing any key the caller expects to keep is demonstrably missing objects that
    certainly exist, so everything else it appears to be missing is unproven too.

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

NOT A GATE, AND DELIBERATELY NOT IN \`scripts/\`, because the runner derives the gate list from
the check scripts and this has none and no floor. It exists so the next dependency session
re-measures rather than re-reads a stale table.

WHAT EACH COLUMN IS MEASURED WITH, because the methods differ in strength:

  pin          package.json, verbatim.
  kind         which block it sits in, NOT where it is used; the two disagreeing is one of the
               findings this exists to surface.
  transitive   distinct packages reachable from it in the REAL install, so it is the tree that
               exists rather than what the lockfile would resolve.
  disk         the package's OWN directory, NOT its unique subtree: the installer hoists, so a
               shared dependency sits once at the top level and belongs to no row.
  used         the first import site found, with file and line, or NOTHING IMPORTS IT.
  reach        derived from \`used\`: does any importer ship in the Worker.

WHY THERE IS NO PER-PACKAGE BYTE COLUMN: there is no honest way to fill one from a single build
here, and a number in that column would be believed. The output carries no source maps and no
per-module banners, so bytes cannot be attributed by reading it, and the incidental package
strings it does contain are string literals rather than module boundaries.

The only precise method is a size-by-import diff, stubbing one package and rebuilding, which is
over an hour for this dependency count. So this reports REACHABILITY, which is the question that
actually decides a lean-out, and the distinction is the point: a measured zero, not an unknown.`,
  ],
  "scripts/measure/deps.mjs#1": [
    "WHY",
    "why the root is scanned; the two packages go to the history document",
    `Directories scanned for imports, and whether code there ships in the Worker.

THE ROOT IS IN THE LIST, and leaving it out was the first version's bug: the build configs sit
at the repository root, so a scan of the source directories reported the build plugins as
NOTHING IMPORTS IT while both are imported by the configs that make the build work. A lean-out
table that says "unused" about the build tool is worse than no table, because the reader acts on
it.`,
  ],
  "scripts/measure/deps.mjs#2": ["CONTRACT", "section marker, rule padding cut", `the installed tree`],
  "scripts/measure/deps.mjs#3": [
    "WHY",
    "why the exit code is not the gate; the first run goes to the history document",
    `\`npm ls\` EXITS NONZERO ON TREE PROBLEMS and still prints a complete tree, so the exit code is
deliberately not the gate here. It exited nonzero on the first run because the install was one
bump behind the manifest, which is exactly the condition that would make every number below
describe a tree nobody has. The mismatch is REPORTED rather than swallowed.`,
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
ANYWHERE IN THE FILE: a bare name scan finds the package in prose, in a comment arguing against
it, and in an unrelated string, which is the anchor-every-needle discipline.`,
  ],
  "scripts/measure/deps.mjs#22": [
    "WHY",
    "what a type-only import ships; the misreported package goes to the history document",
    `A TYPE-ONLY IMPORT SHIPS NOTHING: it is erased by the compiler, so counting it as reaching the
Worker put a dev dependency in the shipping column on the strength of a line that contributes
zero bytes. Measured: that is exactly what the first version reported.`,
  ],
  "scripts/measure/deps.mjs#23": ["CONTRACT", "section marker, rule padding cut", `the rows`],
  "scripts/build-content.mjs#0": [
    "CONTRACT",
    "what it writes, why gitignored and who proves it; the artifact-arc reference goes to the history document",
    `Renders the corpus into the LOCAL build product.

Gitignored: git holds markdown, D1 holds the only rendered copy, and everything that reads this
file runs after a build. \`check:content\` proves the render is valid and deterministic, and
ship's drift report compares D1's hashes against what this wrote.`,
  ],
  "scripts/build-content.mjs#1": ["CONTRACT", "why markdown; one line already"],
  "scripts/build-content.mjs#2": [
    "CONTRACT",
    "why sorted",
    `Renders every post and returns the artifact exactly as it should sit on disk. Sorted by slug
so the output depends on content alone, never on the order the filesystem happened to hand back.

@returns {Promise<string>}`,
  ],
  "scripts/build-content.mjs#4": [
    "CONTRACT",
    "why read rather than imported, and the build order; the ruling reference goes to the history document",
    `The page half of the corpus. Read rather than imported, because a JSON import needs an
attribute this repo's compiler settings reject, so the two would disagree about whether the file
even compiles. The Worker's copy imports them instead, which is the same environment split the
image resolver has.

BUILD ORDER: this depends on the stack artifact, so that build runs FIRST. A stale one here
produces page records the next build will not reproduce, which the gate reports as a byte
difference.`,
  ],
  "scripts/build-content.mjs#5": [
    "CONTRACT",
    "why the generated module rather than the JSON",
    `THE PAPERS COME FROM A COMMITTED MODULE, not from the JSON read above: that module is
generated from the two data files and byte-gated against them, so it is the corpus by the time
anything here can see it. Reading the JSON again would be a second assembly of the same records,
which is what the generated module exists to prevent.`,
  ],
  "scripts/build-content.mjs#6": [
    "CONTRACT",
    "why it is not in the build product",
    `The date of the last commit that touched a file. Deliberately NOT written into the build
product: a render must be a pure function of the sources, and the Worker writer has no git to
consult, so git dates are applied at sync time instead, where the two writers already
legitimately differ.

@param {string} file
@returns {string | null}`,
  ],
  "scripts/build-content.mjs#7": ["CONTRACT", "why absence is the honest answer; one line already"],
  "scripts/build-content.mjs#8": [
    "CONTRACT",
    "why one owner, why a Date, why explicit midnight and why null is real, with its citation",
    `The revision date a post's row carries, or null. ONE OWNER for the rule, which was written
once inline and decides whether a reader sees an "Updated" line: the gate that renders that
markup offline has to feed the component the value production would write, and computing it
there would be a second statement, where hard rule 17 gives a measured value to one place or to
nowhere.

A \`Date\` rather than a string, because the two consumers want different shapes and returning
the string would leave both parsing, which is where a timezone gets in. MIDNIGHT UTC,
explicitly, rather than relying on a default nobody should have to look up.

NULL IS A REAL ANSWER AND NOT A FAILURE: a shallow clone has no history for most files, so CI
legitimately gets null where a full clone gets a date. Both are correct, and the gate asserts
the PAIRING rather than the presence, so it holds in both environments.

@param {{ updated?: string | null, sourcePath: string }} post
@returns {Date | null}`,
  ],
  "scripts/build-content.mjs#9": [
    "CONTRACT",
    "why markdown, why rendered here and why the resolver refuses; the section citation goes to the history document",
    `The About page, rendered from markdown into the shape its route imports.

WHY MARKDOWN AND NOT JSX: the other prose pages are tied to files a reader can go and check.
This one is a person's description of themselves, revised on taste rather than on a code change,
and the person revising it should not have to edit a component to move a comma.

WHY RENDERED HERE AND NOT IN THE WORKER: the public plane must not grow a second markdown
renderer, and must not pay for the first one on a static page, which pulls the highlighter, the
maths engine and the directive plugins for four paragraphs that contain none of them.

THE SAME RENDERER THE CORPUS USES, never a lighter second pass: a page rendered by a different
pipeline would drift from the posts beside it in exactly the ways nobody checks.

The image resolver REFUSES. This page has no images and must not acquire one by accident: one
here would need a build-time measurement this function does not do, and would render unsized.

@returns {Promise<string>} the artifact exactly as it should sit on disk`,
  ],
};
