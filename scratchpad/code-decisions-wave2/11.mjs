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
    `Gate over the URL protocol allowlist.

  npm run check:urls

BOUNDARY: the allowlist predicate over crafted inputs. It never fetches a URL and never scans
the live corpus, so it proves the rule and not that every published href obeys it.

The finding it exists for: a \`javascript:\` href rendered LIVE and reached the stored HTML, the
artifact, D1 and the published page. The operator API writes posts, so it was agent-reachable
with no human click in the path.

TWO LEVELS, deliberately. The PREDICATE, tested directly, which can express obfuscations
markdown would percent-encode before the renderer saw them. The RENDERER, end to end, because
the predicate being right is worth nothing if the plugin is wired in after the plugin that emits
the href.

FAILS CLOSED, and the \`javascript\` fixture entries are PERMANENT NEGATIVES rather than
examples: removing one is removing the gate.`,
  ],
  "scripts/check-urls.mjs#1": ["WHY", "one line already; kept"],
  "scripts/check-urls.mjs#2": ["CONTRACT", "the fixture's shape; type annotation only"],
  "scripts/check-urls.mjs#4": ["CONTRACT", "section marker, rule padding cut", `The predicate`],
  "scripts/check-urls.mjs#5": [
    "WHY",
    "why code points and not escapes; the three corruptions go to the history document",
    `Obfuscations are built from CODE POINTS rather than written as escapes, so this file contains
no control characters at all: writing them literally corrupted the module under test into a
binary file more than once, and an escape in a JSON fixture would be decoded by whichever tool
wrote the file.`,
  ],
  "scripts/check-urls.mjs#6": ["CONTRACT", "section marker, rule padding cut", `The renderer, end to end`],
  "scripts/check-urls.mjs#7": ["CONTRACT", "one line already; kept"],
  "scripts/check-urls.mjs#9": ["WHY", "why any attribute and not just the href; two lines already"],
  "scripts/check-urls.mjs#10": ["WHY", "visible, not silent; two lines already"],
  "scripts/check-urls.mjs#11": ["CONTRACT", "what the scope is; one line already"],
  "scripts/check-urls.mjs#12": [
    "CONTRACT",
    "why the schema is the only thing in that path; the findings and the accepted protocols go to the history document",
    `FRONTMATTER, which the render layer never sees. The plugin walks the tree \`renderBody\`
produces and frontmatter is not in it, so the allowlist that closed the markdown hole did not
bind the two frontmatter fields that reach a URL context, one of which renders as a live public
href and was validated by a URL check that accepts \`javascript:\`.

These bind the SCHEMA, because the schema is the only thing in that path, and they are asserted
against the object both writers import so they cannot pass against a copy of the rule.`,
  ],
  "scripts/check-urls.mjs#14": [
    "WHY",
    "why behaviour is not enough, what came apart and why comments are stripped; the dated instance and the list of victims go to the history document",
    `THE SHARED PREDICATE, ASSERTED ON THE SOURCE. Everything above tests BEHAVIOUR, and the rule
is not "these fields refuse bad protocols", it is "these fields call the same predicate the
renderer uses rather than reimplementing it". Those come apart: one field was a regex that
blocked the dangerous protocol only as a side effect of demanding a leading slash, and every
behavioural case was green, because every outcome the regex produces is the outcome the
predicate produces. A green gate, a correct outcome, and the wrong mechanism, which matters
because the mechanism is what survives the next edit.

COMMENTS ARE STRIPPED FIRST: both docblocks in the module discuss the predicate in prose, one
saying in so many words that it is called rather than reimplemented. Only BLOCK comments, since
the line form would truncate a \`//host\` inside a message string.`,
  ],
  "scripts/check-urls.mjs#15": ["WHY", "fail closed on the stripper itself; already short"],
  "scripts/check-urls.mjs#17": ["WHY", "fail closed on a block that stopped parsing; two lines already"],
  "scripts/check-urls.mjs#18": ["WHY", "one definition, so it is a fact rather than agreement; two lines already"],
  "scripts/check-urls.mjs#19": [
    "CONTRACT",
    "the two failures, why it is this gate's to own and why it reads the corpus; the ruling reference and the post count go to the history document",
    `THE REDIRECT MAP: every old slug goes somewhere that exists, and no post claims a slug the map
is still redirecting away from. Two things can go wrong and neither is visible until a reader
hits it.

A REDIRECT TO A 404: the gateway resolves the map without touching the database, deliberately,
so it CANNOT know whether the target exists, and nothing else looks. A SLUG THAT IS ALSO A
SOURCE is the sharper one, because the redirect runs before the router, so a post taking a
retired name can never be served while looking fine on disk and in D1.

READ FROM THE MARKDOWN, NOT THE BUILD PRODUCT, which is gitignored and absent from a CI
checkout; a gate whose expected values come out of the pipeline it checks is the
fixture-independence failure hard rule 10 names.`,
  ],
  "scripts/check-urls.mjs#21": [
    "WHY",
    "why a second file, and why it is not two owners, with its citation",
    `THE RETIRED SET, AND WHY IT IS A SECOND FILE. Everything below reads the map and checks that
what is IN it is coherent, which cannot catch the failure that matters most: DELETING an entry.
A map with an entry removed is perfectly coherent and silently stops redirecting a URL that is
already published.

So the expected set comes from a file the map cannot edit, reconciled BOTH DIRECTIONS. This is
not two owners of one fact (hard rule 17), because they are two different facts: one records
that a URL was ONCE PUBLIC, which is history and append-only, and the other records WHERE IT
GOES NOW, which is a current decision. Retiring a post edits both, in the same commit.`,
  ],
  "scripts/check-urls.mjs#23": [
    "WHY",
    "why a malformed post is reported rather than skipped",
    `A post whose frontmatter does not parse is NOT skipped, it is counted and reported: skipping
would let it drop out of the known set and turn a live redirect target into a missing one this
gate calls fine.`,
  ],
  "scripts/check-urls.mjs#25": [
    "WHY",
    "the three conditions and why it cannot be softened, with its citation",
    `PUBLISHED, on the same three conditions the public read applies: not a draft, dated today or
earlier, and not holding a future date. A redirect whose target is a draft is a redirect to a
404 for every reader, and hard rule 1 is why this cannot be softened to "the file exists".`,
  ],
  "scripts/check-urls.mjs#26": ["WHY", "the data half against the code half; already short"],
  "scripts/check-urls.mjs#27": [
    "WHY",
    "what each negative is for",
    `PERMANENT NEGATIVES for the predicate. Each is a path it must never claim: a sibling route
under the same prefix, or a lookup shape that would answer from the prototype rather than from
the map. Removing one is removing the check.`,
  ],
  "scripts/check-urls.mjs#28": [
    "WHY",
    "why by position and why comments are stripped",
    `THE GATEWAY ACTUALLY CALLS IT, AND CALLS IT IN THE RIGHT PLACE, asserted by POSITION in the
gateway's own body: asserting that a stage merely EXISTS passes on an arrangement that runs it
too late. Comments are stripped first, because in this repo a comment has both satisfied and
failed an assertion about code.`,
  ],
  "scripts/check-urls.mjs#29": ["CONTRACT", "section marker, rule padding cut", `Counts, so a green run cannot mean an empty one`],
  "scripts/check-urls.mjs#30": ["WHY", "both fields; one line already"],
  "scripts/check-urls.mjs#31": [
    "NUMBER",
    "why a fixture-driven gate needs this floor and why the slack is small, with its citation; both measurements and the rotted sentence go to the history document",
    `EXECUTED-COUNT FLOOR. Every case here comes from a committed fixture, which is exactly the
shape that fails quietly: a fixture that parsed to an empty list would run zero cases and report
a clean sweep of the protocol allowlist.

MEASURED BY RUNNING IT, never summed. The slack is deliberately smaller than one redirect
entry's worth of assertions: deleting a single redirect has to be caught by the both-directions
reconciliation going RED, and must not be able to hide inside the tolerance instead. The prose
here once claimed a floor the constant below disagreed with, which is hard rule 17's rot in its
ordinary form.`,
  ],
  "scripts/check-destructive.mjs#0": [
    "CONTRACT",
    "the boundary, why a class rather than three assertions, and the completeness half; the audit's three paths go to the history document",
    `Gate: every DESTRUCTIVE intent is confirmed in the ACTION, not in a handler.

  npm run check:destructive

BOUNDARY: this is a SOURCE gate. It reads each route's \`action\` and proves the confirmation
predicate is called inside the branch that handles the intent. It does NOT run an action, so it
cannot see a guard that is present and wrong.

WHY IT EXISTS: three destructive paths had their only confirmation in a client event handler,
so with scripting off the handler never runs, the form posts, and the action deletes. **THE SAME
DEFECT HAD ALREADY BEEN FOUND AND FIXED ONCE, AND CLOSED WITHOUT SWEEPING FOR SIBLINGS**, which
is why this is a gate over a CLASS. A guard in a handler is feedback, not a guard; the gate is
whatever the action checks, because the action is the only thing a crawler, a prefetch or a
reader without JavaScript cannot skip.

THE COMPLETENESS HALF is the part that keeps working: every intent an action handles must be
CLASSIFIED here, and a new one nobody classified FAILS BY NAME rather than defaulting to safe.

FAILS CLOSED on an unreadable file, an unparseable body, or an empty vocabulary.`,
  ],
  "scripts/check-destructive.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-destructive.mjs#2": ["CONTRACT", "what destructive means here; two lines already"],
  "scripts/check-destructive.mjs#3": [
    "WHY",
    "why these two are destructive; the reclassification date goes to the history document",
    `RECLASSIFIED from reversible: both read as maintenance and both destroy records, and neither
can know its own removal count without running, so both confirm on a count of one and state the
scale at stake instead.`,
  ],
  "scripts/check-destructive.mjs#4": [
    "WHY",
    "why these are the first with no recovery path, with its citation; the date goes to the history document",
    `BOTH WEBMENTION REMOVALS, and they are the first destructive intents here with NO RECOVERY
PATH AT ALL. Every other entry removes something a rebuild, a sync or the repository can produce
again. A webmention row came from a stranger's POST and converges toward nothing, so there is
no derivation for hard rule 18 to repair it through. Deleted is gone.`,
  ],
  "scripts/check-destructive.mjs#5": ["WHY", "why an entry carries its reason; two lines already"],
  "scripts/check-destructive.mjs#6": [
    "WHY",
    "the boundary the detector cannot cross",
    `NOT IN THE VOCABULARY, AND THAT IS THE BOUNDARY WORTH STATING: one upload path is never
compared against an intent string, it is selected by a shared predicate, so this gate's detector
cannot see it and cannot see any future intent routed the same way. Adding a destructive path
behind a predicate rather than a comparison would hide it from here.`,
  ],
  "scripts/check-destructive.mjs#7": [
    "CONTRACT",
    "why condition first, and what a label-first call does",
    `CONDITION FIRST, matching every other gate here. It was label-first for one run and
\`check:assertions\` caught it twice over, as helper-signature drift and because a label-first
call makes argument one a string literal, which is always truthy: every assertion in this file
would have passed unconditionally.

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
tested twice in its file, once in a compound condition shared with two others and once in its
own inner branch. Asserting against the outer one would be satisfied by a guard sitting in a
sibling path, and asserting against the FILE would be satisfied by any mention anywhere.`,
  ],
  "scripts/check-destructive.mjs#15": [
    "WHY",
    "why offsets come from one text and matching from the other; the vacuous run goes to the history document",
    `Offsets come from RAW and are used against BARE. \`strip\` blanks string BODIES, so the intent
literal is unmatchable in the stripped text, and it preserves LENGTH exactly, so the two index
the same bytes. Brace matching has to happen on the stripped text or a brace inside a string
throws it.`,
  ],
  "scripts/check-destructive.mjs#16": ["WHY", "both directions of completeness; already short"],
  "scripts/check-destructive.mjs#17": ["CONTRACT", "section marker, rule padding cut", `the operator API's own verbs`],
  "scripts/check-destructive.mjs#18": [
    "WHY",
    "why the detector was blind, the recurring class, and why a policy rather than a typed confirmation; the tool name and the date go to the history document",
    `THE SECOND WRITE SURFACE, WHICH THIS GATE COULD NOT SEE. Everything above reads an intent
comparison out of a route action, which is how the admin plane spells a verb; the operator API
spells it as a bearer-token POST dispatched on a tool name, so a gate whose vocabulary is one
string comparison saw NONE of it and a delete authority went unclassified. A classifier which
reads syntax is blind to any verb expressed another way, and the repair is to teach it the other
way rather than to trust that somebody will remember.

WHY IT IS NOT A TYPED CONFIRMATION: the admin plane's ceremony is a human typing a count into a
form, which is right for a person who may be mistaken about which button they are on and wrong
for a machine caller, because an agent typing "1" into its own request proves nothing and the
credential IS the ceremony there. So the operator's equivalent is a declared POLICY the API
serves, so a caller learns the refusal before it tries.`,
  ],
  "scripts/check-destructive.mjs#19": ["CONTRACT", "where the names come from; one line already"],
  "scripts/check-destructive.mjs#20": [
    "WHY",
    "the zero-scope arm; the measurement goes to the history document",
    `SCOPE, ASSERTED. An empty parse classifies nothing and reports no problem, which is what a
compliant surface reports.`,
  ],
  "scripts/check-destructive.mjs#21": ["CONTRACT", "why these two; two lines already"],
  "scripts/check-destructive.mjs#22": ["WHY", "why an entry carries its reason; one line already"],
  "scripts/check-destructive.mjs#23": [
    "WHY",
    "why comments are left in place here",
    `THE POLICY IS THE OPERATOR'S CEREMONY, so a destructive tool must carry one. Read out of the
descriptor block by name, comments left in place: \`policy\` is a property whose value is a
string literal, so prose cannot satisfy it the way a bare needle would.`,
  ],
  "scripts/check-destructive.mjs#24": [
    "WHY",
    "what the guarantee is worth, why whole-source and why comments are stripped; the ruling reference goes to the history document",
    `THE BACKUP BUCKET IS WRITE-AND-READ ONLY. It exists so that this site's own code deleting a
media object cannot lose the bytes, which is worth exactly as much as the guarantee that
NOTHING here ever deletes from it, and a guarantee held only by prose is the shape this repo
keeps paying for. Pruning the mirror is a human act, by hand.

WHOLE-SOURCE, not routes: the danger is not a form intent, it is any line anywhere that reaches
the binding with a delete. COMMENTS ARE STRIPPED FIRST, and that is load bearing rather than
tidy, because every file that touches this binding carries a comment SAYING it never deletes
from it and several of those sentences contain both the name and the word.`,
  ],
  "scripts/check-destructive.mjs#27": [
    "CONTRACT",
    "why a window rather than co-occurrence",
    `Does this stripped source delete from the backup binding? The window is what makes it an
anchored needle rather than a file-wide co-occurrence: a file may legitimately name the binding
and, far away, delete from something else.

@param {string} stripped
@returns {string[]} offending excerpts`,
  ],
  "scripts/check-destructive.mjs#29": [
    "WHY",
    "why the control runs first",
    `THE DISCRIMINATION CONTROL, run BEFORE the sweep. A matcher that cannot detect the violation
agrees with every file it reads, and a clean sweep by a blind needle is indistinguishable from a
clean repository. So the needle is first shown to FIRE on a known-bad string and to stay silent
on the two shapes that must not trip it.`,
  ],
  "scripts/check-destructive.mjs#30": [
    "WHY",
    "why this file is excluded and why the exclusion is named; the measured run goes to the history document",
    `THIS FILE IS EXCLUDED FROM ITS OWN SWEEP, and the exclusion is NAMED rather than a glob, so it
can never widen. The control above is a STRING LITERAL containing exactly the violation being
hunted, which is the point of it, so sweeping this file reports the gate as the offender. The
alternative was to obfuscate the control so it would not match itself, which would mean it no
longer tests the needle that actually runs.`,
  ],
  "scripts/check-destructive.mjs#31": ["WHY", "the zero-scope arm; two lines already"],
  "scripts/check-destructive.mjs#33": [
    "WHY",
    "what a zero here would mean",
    `AND A FLOOR ON THE SWEEP'S SUBJECT: zero files naming the binding would mean the mirror had
been removed or renamed, and every assertion above would then be true of nothing.`,
  ],
  "scripts/check-destructive.mjs#34": [
    "NUMBER",
    "why the floor is not raised on every addition, and what finally raised it; three dated re-measurements and their counts go to the history document",
    `EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE and never summed, unlike the first value
written here from counting the source by eye, which failed the gate on its own first green run.

THE FLOOR IS DELIBERATELY NOT RAISED ON EVERY ADDITION: its job is to catch a whole BLOCK being
skipped, and the slack is what lets an intent be retired without a second edit here. Raising it
each time would make it a count of the checks rather than a floor under them. It is raised when
\`check:floors\` says the slack has stopped being slack and become a place assertions could stop
running unnoticed.`,
  ],
  "scripts/check-floors.mjs#0": [
    "CONTRACT",
    "why it exists, how it measures, why a pipe is not a log, the per-branch naming and both boundary halves; the drift figures and the timings go to the history document",
    `Gate: no floor has drifted far under the count it is supposed to floor.

  npm run check:floors

WHY IT EXISTS. Every counting gate fails when its count is BELOW its floor, and nothing ever
compared the two when the count was ABOVE, so a floor set once and never re-measured sinks
further under with every assertion added. One reached far enough under to be decorative: dozens
of assertions could stop running and it would still pass, which is the skipped-block failure the
floor was put there to catch, arriving through the floor itself.

HOW IT MEASURES: it READS under \`check:all\` and RUNS standalone. Under the tier the floor lines
are ALREADY in the output the runner captured, so it pipes them here and nothing runs twice;
standalone there is no such output, and a gate that only works as somebody else's passenger is
one nobody can re-run while fixing what it found.

READING FROM A PIPE IS NOT READING A STORED LOG, and hard rule 10's fixture independence is the
whole difference: a log on disk is an artifact of some EARLIER run and is produced by the
process under test, while the pipe carries the run happening now and cannot outlive it.

FLOORS ARE NAMED PER BRANCH, because a gate's count depends on how it was invoked: one name per
gate would mean whichever branch ran last was judged against a floor measured from the other.

FAILS CLOSED ON SILENCE. A gate known to carry a floor that prints NO floor line is a failure,
not a skip: a floor whose block stopped executing emits nothing, and a reader counting only
visible floors would report a clean sweep.

BOUNDARY: it compares two numbers a gate PRINTS and cannot tell whether the count is honest,
because a gate whose assertions have gone vacuous still increments its counter. Hard rule 10
owns that half. It also cannot see a gate with NO floor, which is why the absences are named.`,
  ],
  "scripts/check-floors.mjs#1": [
    "NUMBER",
    "why a percentage, why a flat minimum and why they combine as a maximum; the named example and its rotted count go to the history document",
    `How far under its count a floor may sit.

WHY A PERCENTAGE: a floor must absorb ordinary growth without an edit in every commit that adds
an assertion, or it becomes a number people bump reflexively, which is how a floor stops being
read at all. WHY A FLAT MINIMUM UNDER IT: a percentage of a small count rounds to nothing, so a
pure percentage would demand a small gate's floor sit within one of its count.

They combine as a MAXIMUM, so big gates get proportional room and small gates a flat allowance.
The example that once stood here is gone: restating another gate's count made this comment go
stale three times over, in the file whose whole subject is floors drifting under their counts.`,
  ],
  "scripts/check-floors.mjs#3": [
    "CONTRACT",
    "what the map buys, in two lines",
    `Gates that carry NO floor, each with the reason, so an absence is argued rather than
accumulated. These are NOT skipped: what this buys is that a reader can tell "no floor line
because there is no floor" from "no floor line because the floor stopped executing".

@type {Record<string, string>}`,
  ],
  "scripts/check-floors.mjs#4": ["CONTRACT", "why it is unfloored and which tier; already short"],
  "scripts/check-floors.mjs#5": [
    "CONTRACT",
    "which tier it is actually on, and what its floors are",
    `OFFLINE TIER, contrary to the obvious guess: it defaults to local and only the full tier
passes it remote, so it IS run from here. Its floors are on TABLE COUNTS, which are scope proofs
rather than executed counts.`,
  ],
  "scripts/check-floors.mjs#6": [
    "CONTRACT",
    "why a delegating gate emits nothing to read",
    `DELEGATES WHOLLY to a third-party binary that owns its own reporting and emits no floor line.
Its threshold is a SCORE on the diff rather than a count of assertions executed here, so there
is nothing for this gate to read back.`,
  ],
  "scripts/check-floors.mjs#7": [
    "CONTRACT",
    "why a volatile scope floor reads as drift and is not; the measurement goes to the history document",
    `Its two floors are on BUILT CHUNKS and FILES WALKED, which are scope proofs rather than
executed counts. The chunk one sits far under its count, which reads as drift and is not: the
chunk count is a property of the bundler's splitting on the day, and a floor pinned near it
would fail any build that emits fewer.`,
  ],
  "scripts/check-floors.mjs#8": ["CONTRACT", "what the map is; already short"],
  "scripts/check-floors.mjs#9": [
    "CONTRACT",
    "the recursion and why nothing is lost",
    `RECURSION, and the expensive kind: that gate runs the whole offline tier inside an extraction,
and this gate is IN that tier. Nothing is lost by skipping it, because the floor lines in its
output belong to its CHILD gates and every one of those is run directly here.`,
  ],
  "scripts/check-floors.mjs#11": ["CONTRACT", "why the list is derived; already short"],
  "scripts/check-floors.mjs#12": [
    "WHY",
    "why the tier restriction is correctness rather than speed",
    `THE OFFLINE TIER ONLY, and this is a correctness constraint rather than a speed one: this gate
is itself tiered OFFLINE, so running every discovered gate would reach a NETWORK ONLY one and
the offline tier would quietly acquire a network dependency through the one gate whose job is
reading other gates. The tier map is imported rather than restated.`,
  ],
  "scripts/check-floors.mjs#13": [
    "WHY",
    "why CI is narrower and why it is detected rather than flagged; the five gate names go to the history document",
    `AND IN CI, THE OFFLINE TIER MINUS WHAT CI CANNOT RUN. Running those from here would fail this
gate for reasons that have nothing to do with any floor, and "fix the floors" would be the wrong
lesson to hand whoever read the red. Detected the way CI announces itself rather than by a flag,
so nobody has to remember to pass one.`,
  ],
  "scripts/check-floors.mjs#14": [
    "CONTRACT",
    "why the name comes off the line",
    `Every floor line in one gate's output. The gate NAME comes off the line rather than from
whoever produced the text, which is what makes reading a whole run's concatenated output safe.

@param {string} output
@returns {{ gate: string, name: string, executed: number, minimum: number }[]}`,
  ],
  "scripts/check-floors.mjs#15": [
    "WHY",
    "why the pipe is the default, why the gate list must travel with it and why it is not the rejected shape; the timing goes to the history document",
    `TWO WAYS IN, AND THE CHEAP ONE IS THE DEFAULT UNDER \`check:all\`, which has already run every
gate and captured every gate's stdout: re-running them to read lines that text already contains
cost the whole offline tier a second time, once per ship.

THE GATE LIST TRAVELS WITH THE OUTPUT and is not derivable from it: the silent-gate assertion
below asks which gates produced NO floor line, and a gate that printed nothing is invisible in a
concatenation of what was printed.

THIS IS NOT THE STORED-LOG SHAPE THIS GATE'S HEADER REJECTS: that design read an artifact a
PREVIOUS run left on disk, and this reads the run happening now, over a pipe that cannot outlive
it. Standalone still runs them.`,
  ],
  "scripts/check-floors.mjs#19": [
    "WHY",
    "why a failed gate contributes nothing, and why the pipe path needs no equivalent",
    `A GATE THAT FAILED IS NOT A FLOOR READING: its floor lines came from a run that had already
refused, and treating them as measurements would let this gate report on numbers the producing
gate disowned. The pipe path needs no equivalent, because the tier reports a failing gate in its
own table and a second complaint here would be the same fact counted twice.`,
  ],
  "scripts/check-floors.mjs#20": [
    "CONTRACT",
    "what the dedupe key is and why it is safe",
    `DEDUPED ON gate:name. A floor line names the gate that produced it rather than being
attributed to the process that printed it, so the same floor read twice is one floor.`,
  ],
  "scripts/check-floors.mjs#22": ["CONTRACT", "section marker, rule padding cut", `the floor`],
  "scripts/check-floors.mjs#23": [
    "NUMBER",
    "why this floor is on lines read rather than assertions; the measurement and its date go to the history document",
    `THIS GATE'S OWN FLOOR, on FLOOR LINES READ rather than on its assertions, because the
assertion count is DERIVED from the lines: a run that read zero floors would make zero
comparisons and report a clean sweep with a perfectly healthy-looking "0 failures".`,
  ],
  "scripts/check-floors.mjs#24": [
    "NUMBER",
    "why the CI branch reads fewer and how it was measured",
    `The CI branch reads fewer, because gates are excluded there and some of them carry floors.
Measured by running with the CI flag locally, which selects the identical gate SET; the counts
themselves are properties of each gate rather than of the machine.`,
  ],
  "scripts/sync-content.mjs#0": [
    "CONTRACT",
    "what it writes, that it runs no gate, why that is not wired in and the bulk-path shape; the false claim's two halves and the batch note go to the history document",
    `Pushes the local content build product into D1, drift report first.

  npm run sync:content -- --local
  npm run sync:content -- --remote

The database is the read path; these files are the source of truth.

**THIS SCRIPT DOES NOT RUN ANY GATE. RUN \`npm run check:content\` YOURSELF FIRST.** This comment
used to claim it ran the gate, and that was false in both halves. A false safety claim is worse
than no claim, because it is read as a reason not to check: this is the one script that writes
to production D1, and the bulk path DELETES the search index outright and replaces the media
citations wholesale, so a bad artifact removes right rows as well as adding wrong ones.

LEFT AS AN INSTRUCTION RATHER THAN WIRED IN, deliberately: shelling out to the gate would make
the write path depend on an exit code read correctly through two layers of npm, and this repo
has already been burned by an exit code masked by a pipe.`,
  ],
  "scripts/sync-content.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#2": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#4": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#6": ["WHY", "why the delete is scoped; two lines already"],
  "scripts/sync-content.mjs#7": [
    "WHY",
    "why the rule is applied here rather than in the build product",
    `Revision date: explicit frontmatter wins, otherwise the last commit that touched the file.
Applied here rather than in the build product because a render must depend on the sources alone,
and the Worker has no git history to consult anyway.`,
  ],
  "scripts/sync-content.mjs#8": [
    "WHY",
    "the two rules in one predicate, and why the null matters beyond tidiness; the date goes to the history document",
    `og_image IS SET ONLY WHEN A CARD ACTUALLY EXISTS, which is the same condition the generator
renders under: two rules, one predicate. A post with a cover never gets a generated card, and
NEITHER DOES A POST THE PUBLIC CANNOT SEE, after a draft's card was live and public while the
post answered 404.

That half matters beyond tidiness, because the generator's prune guard asks D1 which cards the
live site points at and refuses to delete any of them: while a draft's row advertised a card,
the guard would protect the very object the fix exists to remove.`,
  ],
  "scripts/sync-content.mjs#9": [
    "WHY",
    "who owns the rule and what stays here",
    `\`revisedDate\` OWNS THE RULE, and this call is what lets \`check:microformats\` feed a component
the same value without restating it. The conversion to epoch seconds stays here, because that is
this file's column format rather than the rule.`,
  ],
  "scripts/sync-content.mjs#10": ["WHY", "why tags are additive; two lines already"],
  "scripts/sync-content.mjs#11": [
    "WHY",
    "why wholesale here and scoped in the editor",
    `Media citations, replaced wholesale for posts, because this writer holds the WHOLE corpus: a
per-post delete would leave refs behind for a post since removed from the artifact, and that
stale row would be enough to refuse the delete of an image nothing cites any more. The editor's
save path scopes its delete to one slug, because one post is all it re-rendered.`,
  ],
  "scripts/sync-content.mjs#12": ["CONTRACT", "why it is deduped here; already short"],
  "scripts/sync-content.mjs#13": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#14": [
    "CONTRACT",
    "why replaced outright and why both indexes are rebuilt",
    `Rewrites the search index from the artifact's records. It is fully derived, so it is replaced
outright rather than reconciled, and both FTS tables are then rebuilt, which is the documented
bulk pattern for external-content fts5 and does not depend on trigger ordering inside a batch.

@param {any[]} records`,
  ],
  "scripts/sync-content.mjs#16": ["CONTRACT", "why one command string; already short"],
  "scripts/sync-content.mjs#17": [
    "WHY",
    "the named exemption and why all three; the ruling date and the per-file statement list go to the history document",
    `A \`d1 execute --file\` import, RETRIED ONCE.

THE NAMED EXEMPTION TO WRITES-ARE-NEVER-WRAPPED. The shared helper wraps READS only, because a
retried write may land twice. The rule now reads: writes are never wrapped, EXCEPT writes
idempotent BY CONSTRUCTION, with the argument stated where the wrapper is applied.

Every file this runs deletes-and-replaces or upserts and none appends, so a doubled run lands
the same corpus. That is not a theory: ship re-runs this sync over the existing corpus on EVERY
deploy and asserts index equality afterwards, so the doubled case is the normal case.

WHY ALL THREE, not just the one that failed: all go through the same endpoint with the same
exposure and the same idempotency argument, and wrapping only the one that happened to fail is
the fix that lands in all but one affected site.

@param {string} args @param {string} label @returns {Promise<{stdout: string, status: number}>}`,
  ],
  "scripts/sync-content.mjs#19": ["CONTRACT", "why the throw; one line already"],
  "scripts/sync-content.mjs#20": ["CONTRACT", "one line already; kept"],
  "scripts/sync-content.mjs#21": [
    "CONTRACT",
    "the five classes, why the write still runs and why a failed read throws; the ruling reference goes to the history document",
    `THE SHIP-TIME DRIFT REPORT, taken at the last moment it is still provable: the instant before
this write overwrites the evidence. Five classes per slug:

  unchanged       same source, same render.
  source-changed  the repository moved and D1 had not caught up. Expected on every content
                  ship; the write below is the catch-up.
  RENDER DRIFT    the SAME source with a DIFFERENT render hash, the Worker-versus-Node class.
                  NOT a defect on its own: the commonest cause is the deployed Worker rendering
                  new markdown with the old renderer just before the deploy, and this run's
                  write is what repairs it. The verdict belongs to a SECOND run.
  missing-in-d1   a file with no row: a new post, or a lost row.
  extra-in-d1     a row with no file: a deleted post; the write cleans it.

THE WRITE STILL RUNS, whatever this finds, because converging D1 to the build IS the repair.
The exit goes nonzero at the very END, after every write and verification, so ship can let the
deploy stand. A failed read THROWS rather than skipping the report, because a report that could
not read one side reports nothing, and nothing is what a clean run reports.`,
  ],
  "scripts/sync-content.mjs#25": ["CONTRACT", "who reads this line; one line already"],
  "scripts/sync-content.mjs#26": ["CONTRACT", "why the path is computed; two lines already"],
  "scripts/sync-content.mjs#27": [
    "WHY",
    "why the file is the source and why the decode is explicit; the seeded row's history goes to the history document",
    `The llms.txt settings row, from its tracked source file: the FILE is the source of truth and
the row is derived, so a rebuild reproduces it. The only thing that ever wrote this row was the
initial migration, seeding copy that was later retired, so a rebuilt site would have served a
stale file with nothing to flag it.

Read as a Buffer and decoded explicitly rather than with an encoding hint, because this file is
compared byte for byte and the platform text layer is not UTF-8 on this host.`,
  ],
  "scripts/sync-content.mjs#28": ["WHY", "why it is its own file; already short"],
  "scripts/sync-content.mjs#29": [
    "WHY",
    "why the shadow table is the only count that can fail; the measured reading goes to the history document",
    `The index is only useful if it mirrors the table, so assert it rather than assume the rebuild
worked. Counts the FTS SHADOW table, not the index itself: on an external-content fts5 table a
count of the index reads through to the content table, so it equals the content count no matter
how broken the index is. The docsize shadow holds one row per indexed document and goes to zero,
so it is the only one of the three that can actually fail.`,
  ],
  "scripts/sync-content.mjs#30": [
    "WHY",
    "the same trap on the other index",
    `Same trap as the post index: a count on either search index reads through to its content table
and can never disagree with it. These count the docsize shadows, which go to zero on a failed
rebuild.`,
  ],
  "scripts/sync-content.mjs#31": [
    "WHY",
    "why nonzero comes last",
    `NONZERO LAST, after every write stood. Render drift means the shared pipeline is not shared in
practice, and a run that exits green on it is the green-light-meaning-nothing this report
replaces the byte gate to prevent.`,
  ],
};
