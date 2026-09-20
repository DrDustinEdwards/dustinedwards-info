// Chunk 9: scripts/check-tests.mjs 0-22, scripts/check-secrets.mjs 0-40, scripts/check-media.mjs 0-42.
//
// Wave 1's rule. check-tests is the wave's largest single concentration of pure chronology:
// four blocks carrying nothing but dated re-measurements of two floors, roughly 8 KB of them,
// and every value they argue about is the constant on the line below. All of it goes and the
// discipline stays, which is the one thing a reader needs: re-taking the number means running
// the gate.
//
// check-secrets carries seven citations and check-media one. Each stays on a single line.
export default {
  "scripts/check-tests.mjs#0": [
    "CONTRACT",
    "the boundary and the empty-glob defect; the measured baseline and the audit's date go to the history document",
    `Gate: run the behavioural test suite, and refuse to believe an empty one.

  npm run check:tests

BOUNDARY: it runs \`node --test\` and reads its SUMMARY, so it knows how many files were
discovered and how many tests reported, not whether those tests ASSERT anything and not whether
they cover the right modules.`,
  ],
  "scripts/check-tests.mjs#1": [
    "NUMBER",
    "the measurement rule, why tight and the invariant; five rounds of drift, the missed convention and every dated figure go to the history document",
    `Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it, never summed. TIGHT RATHER
THAN SLACK, this gate's own convention: they move UP with a test, a one-line edit in the same
commit, and the point is to notice the set SHRINKING. The margin only ever widens on its own.`,
  ],
  "scripts/check-tests.mjs#2": ["NUMBER", "pure chronology beside the constant it describes; every dated reading goes to the history document", `Re-taken by running the gate whenever a test file lands.`],
  "scripts/check-tests.mjs#3": [
    "NUMBER",
    "why this floor drifted unseen and what fixed it; six dated readings and the tolerance arithmetic go to the history document",
    `RE-MEASURED BY RUNNING THIS GATE, never by adding one. This floor once drifted eleven files
without failing, being asserted directly rather than through \`assertFloor\`, so the one floor
here the meta-gate could not police is the one that drifted.`,
  ],
  "scripts/check-tests.mjs#4": [
    "NUMBER",
    "what this floor catches that the file floor cannot; seven dated re-measurements, their gaps and their tolerances go to the history document",
    `RE-MEASURED BY RUNNING THIS GATE. The file floor catches a file LEAVING; this catches one
hollowed out in place. Moved when the set grows even if nothing has breached, because waiting
for a breach is waiting for the margin to be gone.`,
  ],
  "scripts/check-tests.mjs#6": [
    "WHY",
    "why by command line and why one platform",
    `BY COMMAND LINE, NEVER BY IMAGE NAME: \`node.exe\` here selects this gate, the language server
and the agent harness. Windows only, that being where the leak was measured.

@returns {number[]} the pids killed`,
  ],
  "scripts/check-tests.mjs#7": [
    "WHY",
    "what a creeping hang looks like without it, and why both reporters are parsed",
    `The five slowest tests, so a creeping hang is visible BEFORE it is a timeout: the suite went
from minutes to never in one commit with no duration printed. READS WHATEVER REPORTER RAN,
both parsed rather than one assumed, the choice not being this gate's.

@param {string} text the runner's combined output
@returns {Array<{ ms: number, name: string }>}`,
  ],
  "scripts/check-tests.mjs#9": ["CONTRACT", "the tap shape; one line already"],
  "scripts/check-tests.mjs#10": ["CONTRACT", "the spec shape; one line already"],
  "scripts/check-tests.mjs#11": [
    "WHY",
    "why deduped; the measured run goes to the history document",
    `DEDUPED BY NAME, longest reading kept: a FAILING test appears twice in tap output and took two
of the five slots.`,
  ],
  "scripts/check-tests.mjs#13": [
    "WHY",
    "why a growing scope floor belongs in the meta-gate and which ones do not",
    `THROUGH assertFloor, because A SCOPE FLOOR OVER A GROWING SET IS AN EXECUTED-COUNT FLOOR
WEARING DIFFERENT CLOTHES: the measured value climbs away by itself. NOT EVERY SCOPE FLOOR
BELONGS HERE, or the instrument agrees with everything: GROWING is the property, not SCOPE.`,
  ],
  "scripts/check-tests.mjs#14": [
    "WHY",
    "the two bounds and what each catches; the leak's file, its date and the lost tiers go to the history document",
    `THE RUN IS BOUNDED, TWICE, AND IT REAPS WHAT IT STARTED: a leaked child once left the runner
unable to exit and this gate waited with it forever. \`--test-timeout\` reports a hang as a
FAILING TEST, by name; the spawn timeout is the backstop for what that cannot see, and is what
actually happened. \`SIGKILL\` rather than \`SIGTERM\`: it has demonstrated it will not leave.`,
  ],
  "scripts/check-tests.mjs#15": [
    "WHY",
    "why the spawn bound is load-bearing, proven by plant; both measured runs and the timings go to the history document",
    `THE SPAWN BOUND IS LOAD-BEARING, and a plant proved it. Against one file the runner's own bound
gets the process out; against the whole suite it did not, because a cancelled test's \`finally\`
never runs and the child survives. So one names the culprit and the other ends the run.`,
  ],
  "scripts/check-tests.mjs#16": [
    "WHY",
    "why by command line and why on every path",
    `WHATEVER THE RUN LEFT BEHIND: \`spawnSync\`'s timeout kills the shell and nothing below it. By
COMMAND LINE, and on EVERY path, because a run that finished can still have leaked.`,
  ],
  "scripts/check-tests.mjs#17": [
    "CONTRACT",
    "why the cast is the honest narrowing",
    `TYPED READ OF THE TIMEOUT: \`error\` is declared as \`Error\` and \`ETIMEDOUT\` lives on \`code\`,
which only \`ErrnoException\` declares. The honest narrowing rather than a cast to \`any\`.`,
  ],
  "scripts/check-tests.mjs#19": ["CONTRACT", "both reporter spellings; one line already"],
  "scripts/check-tests.mjs#21": [
    "WHY",
    "why the absence is printed",
    `NOT SILENT: a reporter whose durations this cannot read is a reporter change.`,
  ],
  "scripts/check-tests.mjs#22": [
    "NUMBER",
    "what this floors and why the slack is zero; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS: if those stopped, the test floor would
stop being consulted. MEASURED BY RUNNING IT, with slack of ZERO, justified here and almost
nowhere else, this gate asserting a fixed set of properties about one run.`,
  ],
  "scripts/check-secrets.mjs#0": [
    "CONTRACT",
    "the boundary, the two arguing sources, the strict path rule and fail-closed; the founding defect, the audit's ranking and the cost paragraph go to the history document",
    `Gate over the secret-handling boundary hard rule 3 states.

  npm run check:secrets

BOUNDARY: IT READS SOURCE TEXT, NOT THE BUNDLE, so a secret read inside a legitimate \`.server\`
module that a mis-split inlined into a client chunk is invisible here, and it says nothing
about whether a secret is USED correctly once read. The boundary is BY PATH, and strictly:
loaders and actions are not carved out even though hard rule 3's prose permits it.`,
  ],
  "scripts/check-secrets.mjs#1": [
    "WHY",
    "why importing the list does not cost the independence; the two-copies incident goes to the history document",
    `THE RATIFIED LIST IS IMPORTED, NOT RESTATED: it was inline here while a page described a
different count. **THE INDEPENDENCE ARGUMENT SURVIVES THE MOVE**: what the tree READS and what
the declaration file DECLARES are still parsed independently.`,
  ],
  "scripts/check-secrets.mjs#2": [
    "WHY",
    "why the mechanism exists while the map is empty",
    `Names permitted OUTSIDE the server boundary, each with its reason. EMPTY TODAY, and correct:
the mechanism exists so the decision is recorded rather than made by deleting an assertion.

@type {Record<string, string>}`,
  ],
  "scripts/check-secrets.mjs#3": [
    "CONTRACT",
    "why a binding is not a secret and why the other namespace is named",
    `Bindings, which are NOT secrets and NOT guarded: a binding is an object the runtime injects,
so a client component referencing one gets \`undefined\`. Listed only to record the env surface.
\`import.meta.env\` is a DIFFERENT namespace, and the matcher is anchored so it cannot confuse
the two.`,
  ],
  "scripts/check-secrets.mjs#5": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-secrets.mjs#6": ["CONTRACT", "section marker, rule padding cut", `1. every secret is DECLARED`],
  "scripts/check-secrets.mjs#7": [
    "WHY",
    "the tell, in two lines; the module and the widening go to the history document",
    `THE DEFECT THIS GATE WAS WRITTEN FOR: a secret read at a call site and declared nowhere. Not a
leak on its own, it is the tell, because a secret nobody declared is a secret nobody reviewed.`,
  ],
  "scripts/check-secrets.mjs#8": ["CONTRACT", "the other direction; one line already"],
  "scripts/check-secrets.mjs#9": ["CONTRACT", "section marker, rule padding cut", `2. the boundary, by path`],
  "scripts/check-secrets.mjs#10": [
    "WHY",
    "why the exclusion set was removed rather than kept; the four names and the sweep go to the history document",
    `NO SKIP_DIRS: emptying the set produced an IDENTICAL result, none of its directories existing
under the scan roots. An exclusion nothing depends on is surface area that reads like
protection, which is this gate's own subject.`,
  ],
  "scripts/check-secrets.mjs#12": ["CONTRACT", "one line already; kept"],
  "scripts/check-secrets.mjs#14": [
    "NUMBER",
    "why per root and why the small one is tight; the sweep, the measurement and the blind-zone figure go to the history document",
    `A floor PER ROOT, not one on the total: one root is a hundred and fifty files and the other a
handful, so a total-only floor cannot tell that an entire root stopped being scanned. The small
one is the outermost layer of the boundary, and its floor is tight because it cannot absorb
slack.

@type {Record<string, number>}`,
  ],
  "scripts/check-secrets.mjs#16": ["CONTRACT", "the other direction; one line already"],
  "scripts/check-secrets.mjs#17": ["WHY", "what the anchor refuses; two lines already"],
  "scripts/check-secrets.mjs#19": [
    "WHY",
    "why strings go too, which is this file's own reason",
    `COMMENTS AND STRING LITERALS BOTH GO: this file's prose names every secret, and strings go
because status fields and operator copy name tokens too.`,
  ],
  "scripts/check-secrets.mjs#20": [
    "WHY",
    "what makes the assertion below mean something, with its citation",
    `ANTI-VACUITY, and it is what makes the one below mean something: a broken matcher finds zero
reads and reports zero violations, indistinguishable from a clean repo. Hard rule 10.`,
  ],
  "scripts/check-secrets.mjs#21": ["CONTRACT", "why the rules are a function; already short"],
  "scripts/check-secrets.mjs#22": ["WHY", "what a stale entry becomes; one line already"],
  "scripts/check-secrets.mjs#23": [
    "WHY",
    "why the self-test is synthetic rather than a fixture entry, with its citation; the ruling date goes to the history document",
    `SELF-TEST on EVERY execution regardless of the allowlist: the map is empty, which is CORRECT,
so the loop above iterates zero times and its rules could be inverted unnoticed. Hard rule 10.
NOT a fixture entry in the real allowlist, which would put a fake permission in the structure
that grants them; the rules live in a function the real loop and the self-test both call.`,
  ],
  "scripts/check-secrets.mjs#24": ["CONTRACT", "section marker, rule padding cut", `3. the admin session file is REALLY ignored`],
  "scripts/check-secrets.mjs#25": [
    "WHY",
    "why git is asked rather than the file read, and both directions",
    `**A DOCUMENTED IGNORE THAT IS NOT ACTUALLY IGNORING IS A RECORDED FAILURE SHAPE HERE**, so
this asks git: reading the file back proves the line exists, not that it MATCHES. BOTH
DIRECTIONS, because they fail differently, and the path is checked whether or not it exists.`,
  ],
  "scripts/check-secrets.mjs#27": ["CONTRACT", "what each status means; one line already"],
  "scripts/check-secrets.mjs#28": ["WHY", "why the placeholder is the tell; already short"],
  "scripts/check-secrets.mjs#29": ["CONTRACT", "section marker, rule padding cut", `the operator credentials in .dev.vars`],
  "scripts/check-secrets.mjs#30": [
    "WHY",
    "why they are not wrangler secrets, and why one assertion is conditional while the other is not; the credential names and the date go to the history document",
    `THE \`.dev.vars\` CREDENTIALS ARE NOT WRANGLER SECRETS, AND ARE STILL GUARDED: read by Node
programs and never by deployed code, so listing one would demand a declaration for a value the
Worker never sees. **It must never reach git.** TWO ASSERTIONS, AND THE FIRST WORKS WITHOUT THE
FILE: the SHAPE scan runs everywhere, the EXACT-VALUE scan only where the file exists. The
pairing is deliberate, a conditional assertion that could pass by reading nothing being exactly
what hard rule 10 warns about.`,
  ],
  "scripts/check-secrets.mjs#31": [
    "WHY",
    "one helper, with its citation",
    `REUSES \`gitIgnores\` rather than spelling check-ignore twice: one helper, one argument order,
which is hard rule 10's ninth discipline.`,
  ],
  "scripts/check-secrets.mjs#32": [
    "CONTRACT",
    "the shape and why it is loose",
    `The key shape, deliberately loose on the lengths: a guessed width misses a key of another
vintage, and this scan has to work with no credential in hand.`,
  ],
  "scripts/check-secrets.mjs#33": [
    "WHY",
    "why no word boundary, proven by plant; the plant string and the file count go to the history document",
    `NO LEADING \`\\b\`, AND THE PLANT IS WHY: a key glued to a prefix ending in \`_\` did NOT fire,
\`_\` being a word character. A word boundary is the wrong anchor for a needle that has to find a
credential ANYWHERE in a file.`,
  ],
  "scripts/check-secrets.mjs#34": [
    "WHY",
    "what the lookbehind refuses and why; the file, the date and the sequence go to the history document",
    `A \`\\uXXXX\` JSON ESCAPE IS NOT A \`u\` IN THE TEXT: a committed JSON file of extracted PDF text
holds escaped control characters followed by something long and alphanumeric, so the needle was
reading a file's ENCODING. The lookbehind refuses exactly that, and both directions are plants.`,
  ],
  "scripts/check-secrets.mjs#35": ["CONTRACT", "what is banned; one line already"],
  "scripts/check-secrets.mjs#36": ["CONTRACT", "one line already; kept"],
  "scripts/check-secrets.mjs#37": [
    "WHY",
    "the empty-needle class with its citation",
    `Guarded on length, or an empty value matches every file and reports a plausible number, which
is hard rule 10's empty needle.`,
  ],
  "scripts/check-secrets.mjs#38": [
    "NUMBER",
    "what this floors that a scope check cannot, and how the count steps; the measurements and their dates go to the history document",
    `EXECUTED-COUNT FLOOR. The per-root scans floor what was READ; this floors what was ASSERTED,
and a scope check cannot see an assertion block that stopped running over a full scope.
MEASURED BY RUNNING IT, never summed.`,
  ],
  "scripts/check-secrets.mjs#39": [
    "NUMBER",
    "chronology beside the constant; the dated readings and the tolerance arithmetic go to the history document",
    `Re-taken by running the gate whenever a section or a secret lands.`,
  ],
  "scripts/check-secrets.mjs#40": [
    "NUMBER",
    "why the number comes from the run; the dated reading and the gap arithmetic go to the history document",
    `The step is the one the comment above predicts, and the arithmetic answer would have been
wrong in the direction that matters.`,
  ],
  "scripts/check-media.mjs#0": [
    "CONTRACT",
    "the boundary and its one exception, the four directions, which way each repair runs and fail-closed; the manifest move, the ruling's principle and both dated incidents go to the history document",
    `Gate: the D1 media index must agree with R2 and with \`public/\`, both ways.

  npm run check:media -- --local
  npm run check:media -- --remote

BOUNDARY: it reconciles KEYS, and except for the social cards it never FETCHES one, so an
object that exists with a row and 404s through the serving route passes. A boundary note is a
claim that ages, hard rule 7, and this file has aged one twice.`,
  ],
  "scripts/check-media.mjs#1": [
    "WHY",
    "why derived and why both buckets",
    `DERIVED from the wrangler config. Two buckets split on lifecycle, and both are indexed: an
object in no listing is the invisible-object problem the index exists to end.`,
  ],
  "scripts/check-media.mjs#2": ["CONTRACT", "why one quoted string; already short"],
  "scripts/check-media.mjs#3": ["CONTRACT", "what the projection is; already short"],
  "scripts/check-media.mjs#4": [
    "WHY",
    "why alt joins the projection; the nine false disagreements go to the history document",
    `\`alt\` joins the projection so the roster comparison has an index side: absent, every row's alt
read as "" and the run reported one missing column as disagreements.`,
  ],
  "scripts/check-media.mjs#6": [
    "WHY",
    "why a fixture is needed at all, and why it runs first",
    `The reference collector, over a fixture that exercises every form. **This exists because the
real corpus exercises NONE of it**, so the collector could be broken and "0 refs" would look
identical. Runs FIRST, so a contract failure is immediate.

@returns {Promise<string[]>} problems`,
  ],
  "scripts/check-media.mjs#7": ["WHY", "why lazy; two lines already"],
  "scripts/check-media.mjs#8": ["CONTRACT", "why zeroes; two lines already"],
  "scripts/check-media.mjs#11": [
    "WHY",
    "what over-collection costs",
    `The negatives matter as much: over-collection puts rows in \`media_refs\` that join to nothing
and refuse a delete forever for a citation that does not exist.`,
  ],
  "scripts/check-media.mjs#12": ["WHY", "one line already; kept"],
  "scripts/check-media.mjs#14": [
    "WHY",
    "why it is retried; the hung list and its timings go to the history document",
    `RETRIED ONCE: the R2 list has hung with no diagnostic header and was clean on retry, which is
the symptom \`retryRead\` wraps a timeout for. Read only.`,
  ],
  "scripts/check-media.mjs#15": ["WHY", "both sides must have found something; two lines already"],
  "scripts/check-media.mjs#16": [
    "NUMBER",
    "what the zero-checks cannot see and why these floors are loose; the sweep, the measurement and its date go to the history document",
    `AND FLOORS, not just the two \`=== 0\` guards, which catch a listing that returned NOTHING. The
failure they cannot see is the enumerations shrinking TOGETHER: a listing that paginates once
and stops, a walk that stops descending, a query that grows a WHERE clause. These track
CONTENT, so they move up as media is added and are deliberately not tight.`,
  ],
  "scripts/check-media.mjs#20": ["CONTRACT", "why the two sides speak the same strings; two lines already"],
  "scripts/check-media.mjs#22": ["CONTRACT", "direction 1; one line already"],
  "scripts/check-media.mjs#23": ["CONTRACT", "direction 2; one line already"],
  "scripts/check-media.mjs#24": ["CONTRACT", "direction 3; one line already"],
  "scripts/check-media.mjs#25": ["CONTRACT", "direction 4; one line already"],
  "scripts/check-media.mjs#26": [
    "WHY",
    "what it stops and why it is cheap",
    `Every row's storage and kind must be what the classifier says, which is what stops a row being
hand-written or written by a path that guessed.`,
  ],
  "scripts/check-media.mjs#28": [
    "WHY",
    "what a drifted role hides",
    `ROLE, verified against the deriver as kind and storage are: a drifted role hides a real image
or offers half a diagram pair, neither visible from anywhere else.`,
  ],
  "scripts/check-media.mjs#29": [
    "WHY",
    "the disclosure, why the hash is not a defence and which half this is; the measured object, its bytes and the dates go to the history document",
    `NO SOCIAL CARD MAY EXIST FOR A POST THE PUBLIC CANNOT SEE: a draft had a card answering 200
while its page 404d, and the card renders the TITLE. The key is a hash, which is not treated as
a defence: the object is public, immutable and written into D1. THE VISIBILITY RULE IS
IMPORTED, a second copy being what put drafts into the Ask index once already.`,
  ],
  "scripts/check-media.mjs#30": ["WHY", "what an empty read would report; already short"],
  "scripts/check-media.mjs#32": [
    "WHY",
    "the two halves, what each can see that the other cannot, and where the expected set comes from; the plant's date and its readings go to the history document",
    `EVERY PUBLICLY VISIBLE POST HAS A CARD, in the bucket and on the wire. TWO ASSERTIONS OVER ONE
EXPECTED SET, failing for different reasons:

  KEY RECONCILIATION reads the R2 listing and names the DEFECT, the generator not having run.
  THE WIRE READ fetches through the deployed route and sees what keys cannot: an unbound
  bucket, a cache rule swallowing the prefix, a deploy that never happened.

A plant MEASURED that: one key deleted from the live bucket, and the key half named the slug
while the wire half still saw every card answering 200, cards being served immutable. THE
EXPECTED SET IS THE GENERATOR'S OWN DERIVATION, through the same two imported predicates.`,
  ],
  "scripts/check-media.mjs#34": [
    "WHY",
    "what empties the set and why a floor rather than a zero-check; the measurement goes to the history document",
    `SCOPE, PROVEN NON-EMPTY: an artifact whose posts are all drafts empties this set and both loops
sweep clean. A floor rather than a zero-check, a set fallen to one being a scan that stopped.`,
  ],
  "scripts/check-media.mjs#35": [
    "WHY",
    "why the deployed host and why GET",
    `THE WIRE, from the deployed host and not whatever \`--local\` points at. GET rather than HEAD:
the route may answer a HEAD differently, and a 404 body is what was observed.`,
  ],
  "scripts/check-media.mjs#37": ["WHY", "why the body is drained; two lines already"],
  "scripts/check-media.mjs#38": [
    "WHY",
    "why nothing could see the drift, why the page still renders from the file, and why the pairs are extracted; the two strings and the date go to the history document",
    `THE ROSTER'S ALT TEXT AND THE MEDIA INDEX'S MUST BE THE SAME STRING, and they were not: two
owners of one fact, the weaker string the one a screen reader got. NOTHING COULD SEE IT, the
no-alt lens counting EMPTY alt and the typecheck catching a missing alt but not a divergent
one. The pairs are extracted rather than imported, the data file being .ts, and the extraction
count is asserted, so a parser that stopped matching fails rather than sweeping clean.`,
  ],
  "scripts/check-media.mjs#40": [
    "NUMBER",
    "why floored rather than zero-checked; the count goes to the history document",
    `FLOORED rather than zero-checked: the cohort photographs are a FIXED set, so one fewer means
the scan stopped matching one, which is precisely where a drifted alt would hide.`,
  ],
};
