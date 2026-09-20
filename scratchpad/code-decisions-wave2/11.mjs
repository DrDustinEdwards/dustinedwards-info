// Chunk 11: check-urls 0-31, check-destructive 0-34, check-floors 0-24, sync-content 0-32.
//
// Wave 1's rule. Four files and eight citations, each kept on one line.
//
// check-destructive and check-urls share a shape worth keeping in both: a behavioural assertion
// and a SOURCE assertion, because the rule is not "this refuses bad input" but "this calls the
// one predicate rather than reimplementing it", and those come apart with every fixture green.
export default {
  "scripts/check-urls.mjs#0": [
    "CONTRACT",
    "the boundary, the two levels and the permanent negatives; the finding, the ruling reference and the import argument go to the history document",
    `Gate over the URL protocol allowlist, at the predicate and through the renderer.

  npm run check:urls

BOUNDARY: the allowlist predicate over crafted inputs, plus one end-to-end render. It never
fetches a URL and never scans the live corpus, so it proves the rule and not that every
published href obeys it.`,
  ],
  "scripts/check-urls.mjs#1": ["WHY", "one line already; kept"],
  "scripts/check-urls.mjs#2": ["CONTRACT", "the fixture's shape; type annotation only"],
  "scripts/check-urls.mjs#4": ["CONTRACT", "section marker, rule padding cut", `The predicate`],
  "scripts/check-urls.mjs#5": [
    "WHY",
    "why code points and not escapes; the three corruptions go to the history document",
    `Obfuscations are built from CODE POINTS rather than escapes, so this file holds no control
characters: writing them literally corrupted the module into a binary file more than once.`,
  ],
  "scripts/check-urls.mjs#6": ["CONTRACT", "section marker, rule padding cut", `The renderer, end to end`],
  "scripts/check-urls.mjs#7": ["CONTRACT", "one line already; kept"],
  "scripts/check-urls.mjs#9": ["WHY", "why any attribute and not just the href; two lines already"],
  "scripts/check-urls.mjs#10": ["WHY", "visible, not silent; two lines already"],
  "scripts/check-urls.mjs#11": ["CONTRACT", "what the scope is; one line already"],
  "scripts/check-urls.mjs#12": [
    "CONTRACT",
    "why the schema is the only thing in that path; the findings and the accepted protocols go to the history document",
    `FRONTMATTER, which the render layer never sees: the plugin walks the tree \`renderBody\`
produces, so the allowlist did not bind the two frontmatter fields that reach a URL context,
one of which renders as a live public href. These bind the SCHEMA, the only thing in that path,
asserted against the object both writers import so they cannot pass against a copy.`,
  ],
  "scripts/check-urls.mjs#14": [
    "WHY",
    "why behaviour is not enough, what came apart and why comments are stripped; the dated instance and the list of victims go to the history document",
    `THE SHARED PREDICATE, ASSERTED ON THE SOURCE. Everything above tests BEHAVIOUR, and the rule is
not "these fields refuse bad protocols" but "these fields call the same predicate the renderer
uses". Those come apart: one field was a regex that blocked the protocol only as a side effect
of demanding a leading slash, and every behavioural case was green. The mechanism is what
survives the next edit. COMMENTS ARE STRIPPED FIRST, both docblocks discussing the predicate in
prose; only BLOCK comments, the line form truncating a \`//host\` inside a message string.`,
  ],
  "scripts/check-urls.mjs#15": ["WHY", "fail closed on the stripper itself; already short"],
  "scripts/check-urls.mjs#17": ["WHY", "fail closed on a block that stopped parsing; two lines already"],
  "scripts/check-urls.mjs#18": ["WHY", "one definition, so it is a fact rather than agreement; two lines already"],
  "scripts/check-urls.mjs#19": [
    "CONTRACT",
    "the two failures, why it is this gate's to own and why it reads the corpus; the ruling reference and the post count go to the history document",
    `THE REDIRECT MAP: every old slug goes somewhere that exists, and no post claims a slug the map
redirects away from. A REDIRECT TO A 404 is invisible because the gateway resolves the map
without touching the database; A SLUG THAT IS ALSO A SOURCE is sharper, the redirect running
before the router, so the post can never be served while looking fine on disk. READ FROM THE
MARKDOWN, NOT THE BUILD PRODUCT, which is the fixture independence hard rule 10 names.`,
  ],
  "scripts/check-urls.mjs#21": [
    "WHY",
    "why a second file, and why it is not two owners, with its citation",
    `THE RETIRED SET, AND WHY IT IS A SECOND FILE: everything below checks that what is IN the map
is coherent, which cannot catch DELETING an entry. So the expected set comes from a file the
map cannot edit, reconciled BOTH DIRECTIONS. Not two owners of one fact, which hard rule 17
forbids, but two facts: that a URL was ONCE PUBLIC, and WHERE IT GOES NOW.`,
  ],
  "scripts/check-urls.mjs#23": [
    "WHY",
    "why a malformed post is reported rather than skipped",
    `A post whose frontmatter does not parse is counted and reported, never skipped: skipping turns
a live redirect target into a missing one this gate calls fine.`,
  ],
  "scripts/check-urls.mjs#25": [
    "WHY",
    "the three conditions and why it cannot be softened, with its citation",
    `PUBLISHED, on the same three conditions the public read applies. A redirect whose target is a
draft is a 404 for every reader, and hard rule 1 is why this cannot soften to "the file exists".`,
  ],
  "scripts/check-urls.mjs#26": ["WHY", "the data half against the code half; already short"],
  "scripts/check-urls.mjs#27": [
    "WHY",
    "what each negative is for",
    `PERMANENT NEGATIVES: a sibling route under the same prefix, and a lookup shape that would
answer from the prototype. Removing one is removing the check.`,
  ],
  "scripts/check-urls.mjs#28": [
    "WHY",
    "why by position and why comments are stripped",
    `THE GATEWAY ACTUALLY CALLS IT, AND IN THE RIGHT PLACE, asserted by POSITION in its own body:
asserting a stage EXISTS passes on an arrangement that runs it too late. Comments stripped.`,
  ],
  "scripts/check-urls.mjs#29": ["CONTRACT", "section marker, rule padding cut", `Counts, so a green run cannot mean an empty one`],
  "scripts/check-urls.mjs#30": ["WHY", "both fields; one line already"],
  "scripts/check-urls.mjs#31": [
    "NUMBER",
    "why a fixture-driven gate needs this floor and why the slack is small, with its citation; both measurements and the rotted sentence go to the history document",
    `EXECUTED-COUNT FLOOR. Every case comes from a committed fixture, which fails quietly: one that
parsed to an empty list runs zero cases and reports a clean sweep. MEASURED BY RUNNING IT, with
slack deliberately smaller than one redirect entry's worth, so deleting a redirect cannot hide
inside the tolerance. The prose here once claimed a floor the constant disagreed with, which is
hard rule 17's rot in its ordinary form.`,
  ],
  "scripts/check-destructive.mjs#0": [
    "CONTRACT",
    "the boundary, why a class rather than three assertions, and the completeness half; the audit's three paths go to the history document",
    `Gate: every DESTRUCTIVE intent is confirmed in the ACTION, not in a handler.

  npm run check:destructive

BOUNDARY: a SOURCE gate. It proves the confirmation predicate is called inside the branch that
handles the intent; it does not run an action, so it cannot see a guard that is present and
wrong.`,
  ],
  "scripts/check-destructive.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-destructive.mjs#2": ["CONTRACT", "what destructive means here; two lines already"],
  "scripts/check-destructive.mjs#3": [
    "WHY",
    "why these two are destructive; the reclassification date goes to the history document",
    `RECLASSIFIED from reversible: both destroy records and neither can know its own removal count
without running, so both confirm on a count of one and state the scale at stake.`,
  ],
  "scripts/check-destructive.mjs#4": [
    "WHY",
    "why these are the first with no recovery path, with its citation; the date goes to the history document",
    `BOTH WEBMENTION REMOVALS, the first destructive intents here with NO RECOVERY PATH. A row came
from a stranger's POST and converges toward nothing, so there is no derivation for hard rule 18
to repair it through. Deleted is gone.`,
  ],
  "scripts/check-destructive.mjs#5": ["WHY", "why an entry carries its reason; two lines already"],
  "scripts/check-destructive.mjs#6": [
    "WHY",
    "the boundary the detector cannot cross",
    `NOT IN THE VOCABULARY, AND THAT IS THE BOUNDARY WORTH STATING: one upload path is selected by
a shared predicate rather than an intent string, so this detector cannot see it, nor any future
intent routed the same way.`,
  ],
  "scripts/check-destructive.mjs#7": [
    "CONTRACT",
    "why condition first, and what a label-first call does",
    `CONDITION FIRST, matching every other gate here. It was label-first for one run and
\`check:assertions\` caught it twice, as helper-signature drift and because a string literal in
argument one is always truthy.

@param {boolean} ok
@param {string} label
@param {string} [detail]`,
  ],
  "scripts/check-destructive.mjs#8": ["CONTRACT", "what it blanks and what it preserves; one line already"],
  "scripts/check-destructive.mjs#9": ["CONTRACT", "why the delimiters are kept; already short"],
  "scripts/check-destructive.mjs#11": ["CONTRACT", "one line already; kept"],
  "scripts/check-destructive.mjs#12": ["CONTRACT", "what the vocabulary is; two lines already"],
  "scripts/check-destructive.mjs#13": [
    "WHY",
    "why the smallest branch; the intent's name and the sibling gate's mistake go to the history document",
    `THE SMALLEST BRANCH THAT TESTS THIS INTENT, and the smallness is the point: one intent is
tested twice in its file, and the outer compound condition would be satisfied by a guard in a
sibling path while the FILE would be satisfied by any mention anywhere.`,
  ],
  "scripts/check-destructive.mjs#15": [
    "WHY",
    "why offsets come from one text and matching from the other; the vacuous run goes to the history document",
    `Offsets come from RAW and are used against BARE: \`strip\` blanks string BODIES and preserves
LENGTH, so the two index the same bytes. Brace matching happens on the stripped text or a brace
inside a string throws it.`,
  ],
  "scripts/check-destructive.mjs#16": ["WHY", "both directions of completeness; already short"],
  "scripts/check-destructive.mjs#17": ["CONTRACT", "section marker, rule padding cut", `the operator API's own verbs`],
  "scripts/check-destructive.mjs#18": [
    "WHY",
    "why the detector was blind, the recurring class, and why a policy rather than a typed confirmation; the tool name and the date go to the history document",
    `THE SECOND WRITE SURFACE, WHICH THIS GATE COULD NOT SEE: the operator API spells a verb as a
bearer-token POST dispatched on a tool name, so a vocabulary of one string comparison saw NONE
of it and a delete authority went unclassified. WHY IT IS NOT A TYPED CONFIRMATION: the admin
ceremony is a human typing a count, which is wrong for a machine caller, since an agent typing
"1" into its own request proves nothing and the credential IS the ceremony. So the operator's
equivalent is a declared POLICY the API serves, learned before the caller tries.`,
  ],
  "scripts/check-destructive.mjs#19": ["CONTRACT", "where the names come from; one line already"],
  "scripts/check-destructive.mjs#20": [
    "WHY",
    "the zero-scope arm; the measurement goes to the history document",
    `SCOPE, ASSERTED: an empty parse classifies nothing and reports what a compliant surface reports.`,
  ],
  "scripts/check-destructive.mjs#21": ["CONTRACT", "why these two; two lines already"],
  "scripts/check-destructive.mjs#22": ["WHY", "why an entry carries its reason; one line already"],
  "scripts/check-destructive.mjs#23": [
    "WHY",
    "why comments are left in place here",
    `THE POLICY IS THE OPERATOR'S CEREMONY, read out of the descriptor block by name with comments
left in place: \`policy\` is a property whose value is a string literal, so prose cannot satisfy
it.`,
  ],
  "scripts/check-destructive.mjs#24": [
    "WHY",
    "what the guarantee is worth, why whole-source and why comments are stripped; the ruling reference goes to the history document",
    `THE BACKUP BUCKET IS WRITE-AND-READ ONLY: it exists so this site's own code deleting an object
cannot lose the bytes, which is worth exactly as much as the guarantee that nothing here ever
deletes from it. WHOLE-SOURCE, not routes: the danger is any line anywhere that reaches the
binding with a delete. COMMENTS ARE STRIPPED FIRST, and that is load bearing, because every
file touching this binding carries a sentence containing both the name and the word.`,
  ],
  "scripts/check-destructive.mjs#27": [
    "CONTRACT",
    "why a window rather than co-occurrence",
    `Does this stripped source delete from the backup binding? The window is what makes it an
anchored needle: a file may name the binding and, far away, delete from something else.

@param {string} stripped
@returns {string[]} offending excerpts`,
  ],
  "scripts/check-destructive.mjs#29": [
    "WHY",
    "why the control runs first",
    `THE DISCRIMINATION CONTROL, run BEFORE the sweep: a matcher that cannot detect the violation
agrees with every file it reads. The needle is shown to FIRE on a known-bad string and to stay
silent on the two shapes that must not trip it.`,
  ],
  "scripts/check-destructive.mjs#30": [
    "WHY",
    "why this file is excluded and why the exclusion is named; the measured run goes to the history document",
    `THIS FILE IS EXCLUDED FROM ITS OWN SWEEP, NAMED rather than globbed so it can never widen: the
control above is a string literal containing exactly the violation being hunted. Obfuscating it
instead would mean it no longer tests the needle that actually runs.`,
  ],
  "scripts/check-destructive.mjs#31": ["WHY", "the zero-scope arm; two lines already"],
  "scripts/check-destructive.mjs#33": [
    "WHY",
    "what a zero here would mean",
    `AND A FLOOR ON THE SWEEP'S SUBJECT: zero files naming the binding means it was renamed, and
every assertion above would be true of nothing.`,
  ],
  "scripts/check-destructive.mjs#34": [
    "NUMBER",
    "why the floor is not raised on every addition, and what finally raised it; three dated re-measurements and their counts go to the history document",
    `EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE, unlike the first value here, counted by
eye, which failed on its own first green run. THE FLOOR IS DELIBERATELY NOT RAISED ON EVERY
ADDITION: its job is to catch a whole BLOCK being skipped, and the slack lets an intent be
retired without a second edit. It is raised when \`check:floors\` says the slack has stopped
being slack.`,
  ],
  "scripts/check-floors.mjs#0": [
    "CONTRACT",
    "why it exists, how it measures, why a pipe is not a log, the per-branch naming and both boundary halves; the drift figures and the timings go to the history document",
    `Gate: no floor has drifted far under the count it is supposed to floor.

  npm run check:floors

BOUNDARY: it compares two numbers a gate PRINTS, so it cannot tell whether the count is honest,
which is hard rule 10's half, and it cannot see a gate with NO floor, which is why the absences
are named here. It READS under \`check:all\` and RUNS standalone, and reading from a pipe rather
than a stored log is what keeps hard rule 10's fixture independence.`,
  ],
  "scripts/check-floors.mjs#1": [
    "NUMBER",
    "why a percentage, why a flat minimum and why they combine as a maximum; the named example and its rotted count go to the history document",
    `How far under its count a floor may sit. WHY A PERCENTAGE: it must absorb ordinary growth or it
becomes a number people bump reflexively. WHY A FLAT MINIMUM UNDER IT: a percentage of a small
count rounds to nothing. They combine as a MAXIMUM. The example that stood here is gone:
restating another gate's count made this comment go stale three times over.`,
  ],
  "scripts/check-floors.mjs#3": [
    "CONTRACT",
    "what the map buys, in two lines",
    `Gates that carry NO floor, each with the reason, so an absence is argued rather than
accumulated: a reader can tell "no floor line because there is no floor" from "because the
floor stopped executing".

@type {Record<string, string>}`,
  ],
  "scripts/check-floors.mjs#4": ["CONTRACT", "why it is unfloored and which tier; already short"],
  "scripts/check-floors.mjs#5": [
    "CONTRACT",
    "which tier it is actually on, and what its floors are",
    `OFFLINE TIER, contrary to the obvious guess: it defaults to local, so it IS run from here. Its
floors are on TABLE COUNTS, which are scope proofs rather than executed counts.`,
  ],
  "scripts/check-floors.mjs#6": [
    "CONTRACT",
    "why a delegating gate emits nothing to read",
    `DELEGATES WHOLLY to a third-party binary that emits no floor line. Its threshold is a SCORE on
the diff, so there is nothing to read back.`,
  ],
  "scripts/check-floors.mjs#7": [
    "CONTRACT",
    "why a volatile scope floor reads as drift and is not; the measurement goes to the history document",
    `Its two floors are on BUILT CHUNKS and FILES WALKED, which are scope proofs. The chunk one
sits far under its count, which reads as drift and is not: the count is a property of the
bundler's splitting on the day.`,
  ],
  "scripts/check-floors.mjs#8": ["CONTRACT", "what the map is; already short"],
  "scripts/check-floors.mjs#9": [
    "CONTRACT",
    "the recursion and why nothing is lost",
    `RECURSION, and the expensive kind: that gate runs the whole offline tier inside an extraction
and this gate is IN it. Nothing is lost, its floor lines belonging to CHILD gates run here.`,
  ],
  "scripts/check-floors.mjs#11": ["CONTRACT", "why the list is derived; already short"],
  "scripts/check-floors.mjs#12": [
    "WHY",
    "why the tier restriction is correctness rather than speed",
    `THE OFFLINE TIER ONLY, a correctness constraint rather than a speed one: this gate is tiered
OFFLINE, so running every discovered gate would reach a NETWORK ONLY one and the tier would
acquire a network dependency through the gate whose job is reading other gates.`,
  ],
  "scripts/check-floors.mjs#13": [
    "WHY",
    "why CI is narrower and why it is detected rather than flagged; the five gate names go to the history document",
    `AND IN CI, THE OFFLINE TIER MINUS WHAT CI CANNOT RUN, or this gate fails for reasons that have
nothing to do with any floor. Detected the way CI announces itself rather than by a flag.`,
  ],
  "scripts/check-floors.mjs#14": [
    "CONTRACT",
    "why the name comes off the line",
    `Every floor line in one gate's output. The gate NAME comes off the line rather than from
whoever produced the text, which is what makes reading a concatenated run safe.

@param {string} output
@returns {{ gate: string, name: string, executed: number, minimum: number }[]}`,
  ],
  "scripts/check-floors.mjs#15": [
    "WHY",
    "why the pipe is the default, why the gate list must travel with it and why it is not the rejected shape; the timing goes to the history document",
    `TWO WAYS IN, AND THE CHEAP ONE IS THE DEFAULT UNDER \`check:all\`, which has already captured
every gate's stdout: re-running them cost the whole offline tier a second time per ship. THE
GATE LIST TRAVELS WITH THE OUTPUT and is not derivable from it, a gate that printed nothing
being invisible in a concatenation of what was printed. NOT THE STORED-LOG SHAPE THIS HEADER
REJECTS: that reads an artifact a PREVIOUS run left on disk.`,
  ],
  "scripts/check-floors.mjs#19": [
    "WHY",
    "why a failed gate contributes nothing, and why the pipe path needs no equivalent",
    `A GATE THAT FAILED IS NOT A FLOOR READING: its lines came from a run that had already refused.
The pipe path needs no equivalent, the tier reporting a failing gate in its own table.`,
  ],
  "scripts/check-floors.mjs#20": [
    "CONTRACT",
    "what the dedupe key is and why it is safe",
    `DEDUPED ON gate:name: a floor line names the gate that produced it rather than the process that
printed it, so the same floor read twice is one floor.`,
  ],
  "scripts/check-floors.mjs#22": ["CONTRACT", "section marker, rule padding cut", `the floor`],
  "scripts/check-floors.mjs#23": [
    "NUMBER",
    "why this floor is on lines read rather than assertions; the measurement and its date go to the history document",
    `THIS GATE'S OWN FLOOR, on FLOOR LINES READ rather than on its assertions, which are DERIVED
from the lines: a run that read zero floors reports a healthy-looking "0 failures".`,
  ],
  "scripts/check-floors.mjs#24": [
    "NUMBER",
    "why the CI branch reads fewer and how it was measured",
    `The CI branch reads fewer, gates being excluded there. Measured by running with the CI flag
locally, which selects the identical gate SET.`,
  ],
  "scripts/sync-content.mjs#0": [
    "CONTRACT",
    "what it writes, that it runs no gate, why that is not wired in and the bulk-path shape; the false claim's two halves and the batch note go to the history document",
    `Pushes the local content build product into D1, drift report first.

  npm run sync:content -- --local
  npm run sync:content -- --remote

The database is the read path; these files are the source of truth.

**THIS SCRIPT DOES NOT RUN ANY GATE. RUN \`npm run check:content\` YOURSELF FIRST.** It is the
one script that writes to production D1, and the bulk path DELETES the search index and
replaces the media citations wholesale.`,
  ],
  "scripts/sync-content.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#2": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#4": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#6": ["WHY", "why the delete is scoped; two lines already"],
  "scripts/sync-content.mjs#7": [
    "WHY",
    "why the rule is applied here rather than in the build product",
    `Revision date: explicit frontmatter wins, otherwise the last commit that touched the file.
Applied here because a render must depend on the sources alone, and the Worker has no git.`,
  ],
  "scripts/sync-content.mjs#8": [
    "WHY",
    "the two rules in one predicate, and why the null matters beyond tidiness; the date goes to the history document",
    `og_image IS SET ONLY WHEN A CARD ACTUALLY EXISTS, the same condition the generator renders
under: two rules, one predicate. NEITHER A COVERED POST NOR ONE THE PUBLIC CANNOT SEE gets one,
after a draft's card was live while the post answered 404. That half matters beyond tidiness:
the prune guard asks D1 which cards the live site points at and refuses to delete them.`,
  ],
  "scripts/sync-content.mjs#9": [
    "WHY",
    "who owns the rule and what stays here",
    `\`revisedDate\` OWNS THE RULE, which is what lets \`check:microformats\` feed a component the same
value without restating it. The epoch conversion stays here, being this file's column format.`,
  ],
  "scripts/sync-content.mjs#10": ["WHY", "why tags are additive; two lines already"],
  "scripts/sync-content.mjs#11": [
    "WHY",
    "why wholesale here and scoped in the editor",
    `Media citations, replaced wholesale for posts, because this writer holds the WHOLE corpus: a
per-post delete leaves refs for a post since removed, and that row refuses the delete of an
image nothing cites. The editor's save path scopes to one slug, one post being all it rendered.`,
  ],
  "scripts/sync-content.mjs#12": ["CONTRACT", "why it is deduped here; already short"],
  "scripts/sync-content.mjs#13": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#14": [
    "CONTRACT",
    "why replaced outright and why both indexes are rebuilt",
    `Rewrites the search index from the artifact's records. Fully derived, so replaced outright
rather than reconciled, and both FTS tables are rebuilt, the documented bulk pattern for
external-content fts5, which does not depend on trigger ordering inside a batch.

@param {any[]} records`,
  ],
  "scripts/sync-content.mjs#16": ["CONTRACT", "why one command string; already short"],
  "scripts/sync-content.mjs#17": [
    "WHY",
    "the named exemption and why all three; the ruling date and the per-file statement list go to the history document",
    `A \`d1 execute --file\` import, RETRIED ONCE.

THE NAMED EXEMPTION TO WRITES-ARE-NEVER-WRAPPED. The rule now reads: writes are never wrapped,
EXCEPT writes idempotent BY CONSTRUCTION, with the argument stated where the wrapper is
applied. Every file this runs deletes-and-replaces or upserts and none appends, and ship
re-runs this sync over the existing corpus on EVERY deploy, so the doubled case is the normal
case. WHY ALL THREE: same endpoint, same exposure, same argument, and wrapping only the one
that failed is the fix that lands in all but one affected site.

@param {string} args @param {string} label @returns {Promise<{stdout: string, status: number}>}`,
  ],
  "scripts/sync-content.mjs#19": ["CONTRACT", "why the throw; one line already"],
  "scripts/sync-content.mjs#20": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#21": [
    "CONTRACT",
    "the five classes, why the write still runs and why a failed read throws; the ruling reference goes to the history document",
    `THE SHIP-TIME DRIFT REPORT, taken the instant before this write overwrites the evidence. Five
classes per slug:

  unchanged       same source, same render.
  source-changed  the repository moved and D1 had not caught up; the write is the catch-up.
  RENDER DRIFT    the SAME source with a DIFFERENT render hash, the Worker-versus-Node class.
                  NOT a defect on its own, the commonest cause being the deployed Worker
                  rendering new markdown with the old renderer. The verdict is a SECOND run's.
  missing-in-d1   a file with no row: a new post, or a lost row.
  extra-in-d1     a row with no file: a deleted post; the write cleans it.

THE WRITE STILL RUNS, whatever this finds, because converging D1 to the build IS the repair,
and the exit goes nonzero at the very END so ship can let the deploy stand. A failed read
THROWS rather than skipping the report, since nothing is what a clean run reports.`,
  ],
  "scripts/sync-content.mjs#25": ["CONTRACT", "who reads this line; one line already"],
  "scripts/sync-content.mjs#26": ["CONTRACT", "why the path is computed; two lines already"],
  "scripts/sync-content.mjs#27": [
    "WHY",
    "why the file is the source and why the decode is explicit; the seeded row's history goes to the history document",
    `The llms.txt settings row, from its tracked source file: the FILE is the source of truth. The
only thing that ever wrote this row was the initial migration, seeding copy later retired. Read
as a Buffer and decoded explicitly, this file being compared byte for byte and the platform
text layer not UTF-8 here.`,
  ],
  "scripts/sync-content.mjs#28": ["WHY", "why it is its own file; already short"],
  "scripts/sync-content.mjs#29": [
    "WHY",
    "why the shadow table is the only count that can fail; the measured reading goes to the history document",
    `The index is only useful if it mirrors the table, so assert it. Counts the FTS SHADOW table: on
an external-content fts5 table a count of the index reads through to the content table. The
docsize shadow holds one row per indexed document and goes to zero.`,
  ],
  "scripts/sync-content.mjs#30": [
    "WHY",
    "the same trap on the other index",
    `Same trap as the post index: a count on either search index reads through to its content table.
These count the docsize shadows, which go to zero on a failed rebuild.`,
  ],
  "scripts/sync-content.mjs#31": [
    "WHY",
    "why nonzero comes last",
    `NONZERO LAST, after every write stood: render drift means the shared pipeline is not shared in
practice, and a run that exits green on it is the green light meaning nothing.`,
  ],
};
