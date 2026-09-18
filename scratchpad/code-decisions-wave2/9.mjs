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

IT RUNS \`node --test\` AND READS ITS SUMMARY. It knows how many files were discovered and how
many tests reported, not whether those tests ASSERT anything: a file of empty bodies counts as
passing tests here exactly as it does for node. It also cannot see whether the tests cover the
right modules; coverage is a judgement, not a count.

WHY IT EXISTS: this was \`npm test --silent\`, and **node exits 0 when the glob matches nothing**.
Every hand-written gate here fails closed on an empty scope; this one structurally could not,
because it delegated to a runner whose "nothing to do" is success, and it is the only gate
asserting BEHAVIOUR of shipped modules.

FAILS CLOSED on zero files, on fewer files than are committed, and on fewer tests than have
been measured.`,
  ],
  "scripts/check-tests.mjs#1": [
    "NUMBER",
    "the measurement rule, why tight and the invariant; five rounds of drift, the missed convention and every dated figure go to the history document",
    `Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it, never summed. The
measurement is the two constants below; re-taking it means running the gate, not reading this.

TIGHT RATHER THAN SLACK, which is this gate's own convention rather than the suite's: these
move UP when somebody adds a test, a one-line edit in the same commit, and the whole point is
to notice the set SHRINKING.

THE INVARIANT: each floor sits just under its own measurement, so the set has to shrink by a
few percent before this notices. The tightness buys an early warning rather than an immediate
one, and the reason to keep it tight is that the margin only ever widens on its own: every test
added without moving these constants makes the floor slacker, silently.`,
  ],
  "scripts/check-tests.mjs#2": [
    "NUMBER",
    "pure chronology beside the constant it describes; every dated reading goes to the history document",
    `Re-taken by running the gate whenever a test file lands.`,
  ],
  "scripts/check-tests.mjs#3": [
    "NUMBER",
    "why this floor drifted unseen and what fixed it; six dated readings and the tolerance arithmetic go to the history document",
    `RE-MEASURED BY RUNNING THIS GATE, never by adding one to the old number. This floor once
drifted eleven files without failing, because it was asserted directly rather than through
\`assertFloor\` and \`check:floors\` never saw the gap: the one floor here the meta-gate could not
police is the one that drifted.`,
  ],
  "scripts/check-tests.mjs#4": [
    "NUMBER",
    "what this floor catches that the file floor cannot; seven dated re-measurements, their gaps and their tolerances go to the history document",
    `RE-MEASURED BY RUNNING THIS GATE. The file floor above catches a file LEAVING; this one
catches a file being hollowed out in place, which no file count can see. It is moved when the
set grows even if the old value has not breached, because a floor left alone while the set
grows gets slacker on its own and waiting for a breach is waiting for the margin to be gone.`,
  ],
  "scripts/check-tests.mjs#6": [
    "WHY",
    "why by command line and why one platform",
    `BY COMMAND LINE, NEVER BY IMAGE NAME: \`node.exe\` on this host selects this gate itself, the
editor's language server and the agent harness. The needle is the runner's own argv, which
nothing else carries. Windows only, because that is where the leak was measured; elsewhere it
reports nothing rather than claiming coverage it has no mechanism for.

@returns {number[]} the pids killed`,
  ],
  "scripts/check-tests.mjs#7": [
    "WHY",
    "what a creeping hang looks like without it, and why both reporters are parsed",
    `The five slowest tests, so a creeping hang is visible BEFORE it becomes a timeout: the suite
went from minutes to never in one commit with nothing printing a duration, so there was no
gradient to notice.

READS WHATEVER REPORTER RAN. A non-TTY run picks tap and a TTY run picks spec, and they carry
the duration differently; both are parsed rather than one assumed, because the reporter is
chosen by something this gate does not control.

@param {string} text the runner's combined output
@returns {Array<{ ms: number, name: string }>}`,
  ],
  "scripts/check-tests.mjs#9": ["CONTRACT", "the tap shape; one line already"],
  "scripts/check-tests.mjs#10": ["CONTRACT", "the spec shape; one line already"],
  "scripts/check-tests.mjs#11": [
    "WHY",
    "why deduped; the measured run goes to the history document",
    `DEDUPED BY NAME, keeping the longest reading: a FAILING test appears twice in tap output,
once in the stream and once in the failure summary, so the same test took two of the five slots
and pushed a real entry off the end.`,
  ],
  "scripts/check-tests.mjs#13": [
    "WHY",
    "why a growing scope floor belongs in the meta-gate and which ones do not",
    `THROUGH assertFloor, because A SCOPE FLOOR OVER A GROWING SET IS AN EXECUTED-COUNT FLOOR
WEARING DIFFERENT CLOTHES: the test file set only ever gets added to, so the measured value
climbs away by itself and the gap widens with no edit. As a bare \`ok()\` this printed no floor
line and the meta-gate had nothing to read.

NOT EVERY SCOPE FLOOR BELONGS HERE, and widening the instrument to cover them all would make it
agree with everything. One over a VOLATILE set must stay out, and one over a set fixed by an
external version has nothing to drift toward. GROWING is the property that matters, not SCOPE.`,
  ],
  "scripts/check-tests.mjs#14": [
    "WHY",
    "the two bounds and what each catches; the leak's file, its date and the lost tiers go to the history document",
    `THE RUN IS BOUNDED, TWICE, AND IT REAPS WHAT IT STARTED. A leaked child once left the runner
with nothing to do and still unable to exit, and this gate waited with it forever, taking down
the two gates that run the offline tier.

TWO BOUNDS, because they catch different things. \`--test-timeout\` is the runner's own per-test
bound and reports a hang as a FAILING TEST, by name, which is the outcome worth having. The
spawn timeout is the backstop for what that cannot see, and is the case that actually happened:
the tests all finished and the PROCESS would not exit.

The gate's bound sits above the runner's so the runner reports first when it can. \`SIGKILL\`
rather than \`SIGTERM\`: the thing being killed has already demonstrated it will not leave.`,
  ],
  "scripts/check-tests.mjs#15": [
    "WHY",
    "why the spawn bound is load-bearing, proven by plant; both measured runs and the timings go to the history document",
    `THE SPAWN BOUND IS LOAD-BEARING, NOT BELT AND BRACES, and a plant proved it rather than this
comment asserting it. Against one file the runner's own bound cancels the test and the process
exits; against the whole suite the per-test cancellation did not get it out.

The difference is the leak: a cancelled test's \`finally\` never runs, because the promise it is
suspended on never settles, so the child survives and the parent waits on it. Alone, later
tests in the same file reach their own teardown and reap it. So the per-test bound names the
culprit and this one ends the run, and neither is decoration.`,
  ],
  "scripts/check-tests.mjs#16": [
    "WHY",
    "why by command line and why on every path",
    `WHATEVER THE RUN LEFT BEHIND, taken down before this gate returns. \`spawnSync\`'s timeout
kills the shell it started and nothing below it, which here is the wrapper and not the node
holding the leak. By COMMAND LINE against the runner's signature, never by image name.

It runs on EVERY path, not just the timeout path, because a run that finished can still have
leaked: that is precisely what the suite did for two days while reporting failures and hanging.`,
  ],
  "scripts/check-tests.mjs#17": [
    "CONTRACT",
    "why the cast is the honest narrowing",
    `TYPED READ OF THE TIMEOUT. \`spawnSync\`'s \`error\` is declared as \`Error\` and the \`ETIMEDOUT\`
a timeout sets lives on \`code\`, which only \`ErrnoException\` declares. The cast is the honest
narrowing rather than a cast to \`any\`.`,
  ],
  "scripts/check-tests.mjs#19": ["CONTRACT", "both reporter spellings; one line already"],
  "scripts/check-tests.mjs#21": [
    "WHY",
    "why the absence is printed",
    `NOT SILENT. A reporter whose durations this cannot read is a reporter change, and the whole
point of the list is to make a creeping hang visible, so its absence has to be visible too.`,
  ],
  "scripts/check-tests.mjs#22": [
    "NUMBER",
    "what this floors and why the slack is zero; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS. The test floor above covers what NODE
ran; this covers the handful this gate makes ABOUT that run, because if those stopped running
the test floor would stop being consulted and nothing would say so.

MEASURED BY RUNNING IT, never summed, with slack of ZERO, which is justified here and almost
nowhere else: this gate asserts a fixed set of properties about one run, so a drop is a removed
assertion rather than natural movement.`,
  ],
  "scripts/check-secrets.mjs#0": [
    "CONTRACT",
    "the boundary, the two arguing sources, the strict path rule and fail-closed; the founding defect, the audit's ranking and the cost paragraph go to the history document",
    `Gate over the secret-handling boundary.

  npm run check:secrets

THIS READS SOURCE TEXT, NOT THE BUNDLE. It asserts that no file outside the server boundary
MENTIONS a secret, so a secret read inside a legitimate \`.server\` module that a future
mis-split inlined into a client chunk is invisible here and would still ship. This is the cheap
half that catches the mistake anyone would actually make. It also says nothing about whether a
secret is USED correctly once read.

Scans \`app/\` and \`workers/\`, deliberately NOT \`scripts/\`: those are Node programs that never
reach a browser.

TWO INDEPENDENT SOURCES ARGUE. The ratified list is transcribed from the ruling, what the code
reads is parsed out of the tree, and what is DECLARED is parsed out of \`app/env.d.ts\`.

THE BOUNDARY IS BY PATH, AND STRICTLY: \`.server.\` in the name, or under \`workers/\`. Loaders and
actions are deliberately NOT carved out even though hard rule 3's prose permits them, because
no route here reads a secret directly and carving them out would mean parsing block scope with
a regex to permit something nothing does. If one ever needs it, the honest move is an ALLOWLIST
entry naming the file and the reason, not a hole shaped like a language feature. Hard rule 3
is what this enforces, and it was PROSE until this gate existed.

FAILS CLOSED: an empty secret list, an unreadable declaration file, a scan that examines no
files, or one that finds no secret reads AT ALL are each a failure, the last because "0
violations" from a broken matcher looks exactly like success.`,
  ],
  "scripts/check-secrets.mjs#1": [
    "WHY",
    "why importing the list does not cost the independence; the two-copies incident goes to the history document",
    `THE RATIFIED LIST IS IMPORTED, NOT RESTATED. It was declared inline here while a page
described a different count, two copies with one of them prose and nothing able to compare
them.

**THE INDEPENDENCE ARGUMENT SURVIVES THE MOVE**, which is the thing to check before assuming it
does not: the imported module IS the ratified list, hand-maintained against the ruling, and
what the tree READS and what the declaration file DECLARES are still parsed independently.`,
  ],
  "scripts/check-secrets.mjs#2": [
    "WHY",
    "why the mechanism exists while the map is empty",
    `Names permitted OUTSIDE the server boundary, each with the reason. EMPTY TODAY, and that is
the correct state. The mechanism exists so that the day one is needed, the decision is recorded
here as a named exception rather than made by deleting an assertion.

@type {Record<string, string>}`,
  ],
  "scripts/check-secrets.mjs#3": [
    "CONTRACT",
    "why a binding is not a secret and why the other namespace is named",
    `Bindings, which are NOT secrets and are NOT guarded: a binding is an object the runtime
injects rather than a value, so it cannot be serialised into a client bundle and a client
component referencing one gets \`undefined\`. Listed only so this file records the full env
surface.

\`import.meta.env\` is a DIFFERENT namespace, build constants inlined at build time and public by
design. The matcher below is anchored so it cannot confuse the two.`,
  ],
  "scripts/check-secrets.mjs#5": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-secrets.mjs#6": ["CONTRACT", "section marker, rule padding cut", `1. every secret is DECLARED`],
  "scripts/check-secrets.mjs#7": [
    "WHY",
    "the tell, in two lines; the module and the widening go to the history document",
    `THE DEFECT THIS GATE WAS WRITTEN FOR: a secret read at a call site and declared nowhere, so
the shared type never knew about it. That is not a leak on its own, it is the tell, because a
secret nobody declared is a secret nobody reviewed.`,
  ],
  "scripts/check-secrets.mjs#8": ["CONTRACT", "the other direction; one line already"],
  "scripts/check-secrets.mjs#9": ["CONTRACT", "section marker, rule padding cut", `2. the boundary, by path`],
  "scripts/check-secrets.mjs#10": [
    "WHY",
    "why the exclusion set was removed rather than kept; the four names and the sweep go to the history document",
    `NO SKIP_DIRS. There was a set, and emptying it produced an IDENTICAL result, because none of
the directories it named exists under the scan roots. Removed rather than kept as insurance: an
exclusion nothing depends on is surface area that reads like protection, and this gate's whole
subject is the difference between the two. If a build artefact ever lands inside a scan root,
the per-root floors below move and somebody looks.`,
  ],
  "scripts/check-secrets.mjs#12": ["CONTRACT", "one line already; kept"],
  "scripts/check-secrets.mjs#14": [
    "NUMBER",
    "why per root and why the small one is tight; the sweep, the measurement and the blind-zone figure go to the history document",
    `A floor PER ROOT, not one on the total. Dropping a whole root and leaving the other's floor
intact reads as a clean run: one root here is a hundred and fifty files and the other is a
handful, so a total-only floor cannot tell that an entire root stopped being scanned. The small
one is the Worker entry, the queue consumer and the Durable Object, the outermost layer of the
boundary this gate polices, and its floor is deliberately tight because a set that small cannot
absorb slack.

@type {Record<string, number>}`,
  ],
  "scripts/check-secrets.mjs#16": ["CONTRACT", "the other direction; one line already"],
  "scripts/check-secrets.mjs#17": ["WHY", "what the anchor refuses; two lines already"],
  "scripts/check-secrets.mjs#19": [
    "WHY",
    "why strings go too, which is this file's own reason",
    `COMMENTS AND STRING LITERALS BOTH GO, and the second half is this file's own reason: its
prose names every secret and so do docblocks across the tree, and strings go because status
fields and operator copy name tokens too.`,
  ],
  "scripts/check-secrets.mjs#20": [
    "WHY",
    "what makes the assertion below mean something, with its citation",
    `ANTI-VACUITY, and this is what makes the one below mean something: if the matcher breaks, or
the tree moves, or the stripper eats too much, the scan finds zero reads and reports zero
violations, which is indistinguishable from a clean repo. Hard rule 10.`,
  ],
  "scripts/check-secrets.mjs#21": ["CONTRACT", "why the rules are a function; already short"],
  "scripts/check-secrets.mjs#22": ["WHY", "what a stale entry becomes; one line already"],
  "scripts/check-secrets.mjs#23": [
    "WHY",
    "why the self-test is synthetic rather than a fixture entry, with its citation; the ruling date goes to the history document",
    `SELF-TEST, on EVERY execution regardless of the allowlist. The map is empty, and empty is
CORRECT, but an empty map means the loop above iterates zero times and its rules could be
inverted or deleted without any run noticing. Hard rule 10.

The fix is NOT a fixture entry in the real allowlist: that would put a fake permission in the
structure that grants permissions, where the next reader has to work out it is a test and where
deleting it to tidy up silently removes the coverage. The rules live in a function instead, and
the real loop and the self-test call the SAME code.`,
  ],
  "scripts/check-secrets.mjs#24": ["CONTRACT", "section marker, rule padding cut", `3. the admin session file is REALLY ignored`],
  "scripts/check-secrets.mjs#25": [
    "WHY",
    "why git is asked rather than the file read, and both directions",
    `**A DOCUMENTED IGNORE THAT IS NOT ACTUALLY IGNORING IS A RECORDED FAILURE SHAPE HERE**, so
this asks git rather than reading \`.gitignore\`. Reading the file back proves the line exists;
it does not prove it MATCHES, because precedence, a later negation, a trailing space or a
directory-scoped pattern all leave it looking correct.

BOTH DIRECTIONS, because they fail differently: the session file must be ignored or the
credential can be committed, and the example must NOT be, or the instructions vanish from the
repo. The path is checked whether or not it exists, because this is a question about the rules.`,
  ],
  "scripts/check-secrets.mjs#27": ["CONTRACT", "what each status means; one line already"],
  "scripts/check-secrets.mjs#28": ["WHY", "why the placeholder is the tell; already short"],
  "scripts/check-secrets.mjs#29": ["CONTRACT", "section marker, rule padding cut", `the operator credentials in .dev.vars`],
  "scripts/check-secrets.mjs#30": [
    "WHY",
    "why they are not wrangler secrets, and why one assertion is conditional while the other is not; the credential names and the date go to the history document",
    `THE \`.dev.vars\` CREDENTIALS ARE NOT WRANGLER SECRETS, AND ARE STILL GUARDED. They are read by
Node programs in \`scripts/\` and never by deployed code, so neither belongs on the ratified
list: adding one would make this gate demand a declaration for a value the Worker never sees.

What they need is the one thing that matters for a credential living on a developer's disk:
**it must never reach git.**

TWO ASSERTIONS, AND THE FIRST WORKS WITHOUT THE FILE. The SHAPE scan runs everywhere, CI
included, and is the half that catches a committed key on a machine with no \`.dev.vars\` at all.
The EXACT-VALUE scan runs only where the file exists: it is strictly stronger there and
impossible elsewhere, which is why it is conditional rather than fail-closed. The pairing is
deliberate, because a conditional assertion that could pass by reading nothing is exactly what
hard rule 10 warns about.`,
  ],
  "scripts/check-secrets.mjs#31": [
    "WHY",
    "one helper, with its citation",
    `REUSES \`gitIgnores\` rather than spelling check-ignore a second time: one helper, one argument
order, one idea of what a non-zero status means, which is hard rule 10's ninth discipline.`,
  ],
  "scripts/check-secrets.mjs#32": [
    "CONTRACT",
    "the shape and why it is loose",
    `The key shape, deliberately loose on the lengths: guessing a width would make the needle miss
a key of a different vintage, and this scan has to work with no credential in hand.`,
  ],
  "scripts/check-secrets.mjs#33": [
    "WHY",
    "why no word boundary, proven by plant; the plant string and the file count go to the history document",
    `NO LEADING \`\\b\`, AND THE PLANT IS WHY: with one, a key glued to a prefix ending in \`_\` did
NOT fire, because \`_\` is a word character and there is no boundary before the \`u\`. A word
boundary is the wrong anchor for a needle that has to find a credential ANYWHERE in a file. The
shape is specific enough to carry itself.`,
  ],
  "scripts/check-secrets.mjs#34": [
    "WHY",
    "what the lookbehind refuses and why; the file, the date and the sequence go to the history document",
    `A \`\\uXXXX\` JSON ESCAPE IS NOT A \`u\` IN THE TEXT. A committed JSON file carrying extracted
PDF text holds control characters, which JSON escapes, and what follows is alphanumeric and
long: the needle matched, which is a scanner reading a file's ENCODING rather than its content.

The lookbehind refuses exactly that and nothing else: a real key is preceded by a quote, a
space, an equals sign, a newline or a word character, never by a backslash. Both directions are
replayed as plants rather than reasoned about.`,
  ],
  "scripts/check-secrets.mjs#35": ["CONTRACT", "what is banned; one line already"],
  "scripts/check-secrets.mjs#36": ["CONTRACT", "one line already; kept"],
  "scripts/check-secrets.mjs#37": [
    "WHY",
    "the empty-needle class with its citation",
    `Guarded on length so an empty or one-character value cannot match every file and report a
plausible number. Hard rule 10, the empty needle.`,
  ],
  "scripts/check-secrets.mjs#38": [
    "NUMBER",
    "what this floors that a scope check cannot, and how the count steps; the measurements and their dates go to the history document",
    `EXECUTED-COUNT FLOOR. The per-root scans refuse an empty scope, but that is a floor on what
was READ; this is the floor on what was ASSERTED, and the two fail on different bugs, because a
scope check cannot see an assertion block that stopped running over a scope that is still full.

MEASURED BY RUNNING IT, never summed. The count is driven by the secret list and the per-root
pairs, so it steps by a known amount when a secret is added.`,
  ],
  "scripts/check-secrets.mjs#39": [
    "NUMBER",
    "chronology beside the constant; the dated readings and the tolerance arithmetic go to the history document",
    `Re-taken by running the gate whenever a section or a secret lands.`,
  ],
  "scripts/check-secrets.mjs#40": [
    "NUMBER",
    "why the number comes from the run; the dated reading and the gap arithmetic go to the history document",
    `The step here is the one the comment above predicts, and the arithmetic answer would have
been wrong in the direction that matters, so the number below comes from the run.`,
  ],
  "scripts/check-media.mjs#0": [
    "CONTRACT",
    "the boundary and its one exception, the four directions, which way each repair runs and fail-closed; the manifest move, the ruling's principle and both dated incidents go to the history document",
    `Gate: the D1 media index must agree with R2 and with \`public/\`, both ways.

  npm run check:media -- --local
  npm run check:media -- --remote

BOUNDARY: it reconciles KEYS. It lists R2, walks \`public/\` and diffs both against D1, and for
everything except the social cards it never FETCHES one of those URLs, so an object that exists
with a row and 404s through the serving route passes. That is how a batch of rows carried
broken thumbnails while this gate was green. A boundary note is a claim that ages, hard rule 7,
and this file has aged one twice.

**THE SOCIAL CARDS ARE THE ONE EXCEPTION, and they are the exception because the key-only
reading is what let them break**: the bucket held cards under old slugs, D1 held the new ones,
and every reconciliation any gate performed was internally consistent.

IT NO LONGER READS THE ASSET MANIFEST. That comparison was pure filesystem and moved offline.
What follows is worth reading twice: this gate still detects a stale manifest, but INDIRECTLY
and only AFTER A REBUILD, and when it speaks it names a missing ROW rather than the manifest
that caused it.

FOUR directions, and it fails on any of them:
  1. an R2 object with no D1 row          -> backfill it
  2. a D1 row with no R2 object           -> delete the row
  3. a public/ file with no row           -> backfill it
  4. a storage='static' row with no file  -> delete the row

**R2 WINS**, and \`public/\` wins for static. A row is deleted because an object is absent; an
object is NEVER deleted because a row is. That asymmetry keeps D1 derived rather than a second
truth, and it is why this only ever REPORTS.

FAILS CLOSED on an empty enumeration: a gate that passes because it examined nothing is the
failure mode that looks most like success.`,
  ],
  "scripts/check-media.mjs#1": [
    "WHY",
    "why derived and why both buckets",
    `DERIVED from the wrangler config, never restated. Two buckets split on lifecycle, and both
are indexed: an object that existed but appeared in no listing is exactly the invisible-object
problem the index exists to end.`,
  ],
  "scripts/check-media.mjs#2": ["CONTRACT", "why one quoted string; already short"],
  "scripts/check-media.mjs#3": ["CONTRACT", "what the projection is; already short"],
  "scripts/check-media.mjs#4": [
    "WHY",
    "why alt joins the projection; the nine false disagreements go to the history document",
    `\`alt\` joins the projection so the roster comparison below has an index side: absent, every
row's alt read as "" and the run reported disagreements that were really one missing column.`,
  ],
  "scripts/check-media.mjs#6": [
    "WHY",
    "why a fixture is needed at all, and why it runs first",
    `The reference collector, over a fixture that exercises every form. **This exists because the
real corpus exercises NONE of it**: no post carries an image, a figure directive or a cover, so
the collector could be completely broken and every other gate would still pass, and "it
returned 0 refs" would look identical either way. Runs FIRST, so a contract failure is
immediate.

@returns {Promise<string[]>} problems`,
  ],
  "scripts/check-media.mjs#7": ["WHY", "why lazy; two lines already"],
  "scripts/check-media.mjs#8": ["CONTRACT", "why zeroes; two lines already"],
  "scripts/check-media.mjs#11": [
    "WHY",
    "what over-collection costs",
    `The negatives matter as much as the positives: over-collection puts rows in \`media_refs\` that
can never join to anything, and every one would refuse a delete forever for a citation that
does not exist.`,
  ],
  "scripts/check-media.mjs#12": ["WHY", "one line already; kept"],
  "scripts/check-media.mjs#14": [
    "WHY",
    "why it is retried; the hung list and its timings go to the history document",
    `RETRIED ONCE. The R2 list has hung with an error carrying no diagnostic header, taking the
tier past its timeout, and was clean on retry. \`retryRead\` wraps a timeout as well as a
rejection precisely for that symptom. Read only.`,
  ],
  "scripts/check-media.mjs#15": ["WHY", "both sides must have found something; two lines already"],
  "scripts/check-media.mjs#16": [
    "NUMBER",
    "what the zero-checks cannot see and why these floors are loose; the sweep, the measurement and its date go to the history document",
    `AND FLOORS, not just the two \`=== 0\` guards above, which catch a listing that returned
NOTHING and nothing else.

The failure they cannot see is the one this gate is for: every comparison below is a set
difference between three enumerations, so they are satisfied by the enumerations shrinking
TOGETHER. A listing that paginates once and stops, a walk that stops descending, a query that
grows a WHERE clause: ten objects against ten rows reconcile perfectly and the rest are
reported by no one.

These track CONTENT, so they are expected to move up as media is added and are deliberately not
tight.`,
  ],
  "scripts/check-media.mjs#20": ["CONTRACT", "why the two sides speak the same strings; two lines already"],
  "scripts/check-media.mjs#22": ["CONTRACT", "direction 1; one line already"],
  "scripts/check-media.mjs#23": ["CONTRACT", "direction 2; one line already"],
  "scripts/check-media.mjs#24": ["CONTRACT", "direction 3; one line already"],
  "scripts/check-media.mjs#25": ["CONTRACT", "direction 4; one line already"],
  "scripts/check-media.mjs#26": [
    "WHY",
    "what it stops and why it is cheap",
    `Every row's storage and kind must be what the classifier says they are, which is what stops a
row being hand-written or written by a path that guessed. One pure function call per row.`,
  ],
  "scripts/check-media.mjs#28": [
    "WHY",
    "what a drifted role hides",
    `ROLE, verified against the deriver exactly as kind and storage are: a row whose role drifts
either hides a real image or offers half a diagram pair, and neither is visible from anywhere
else.`,
  ],
  "scripts/check-media.mjs#29": [
    "WHY",
    "the disclosure, why the hash is not a defence and which half this is; the measured object, its bytes and the dates go to the history document",
    `NO SOCIAL CARD MAY EXIST FOR A POST THE PUBLIC CANNOT SEE. A draft had a card answering 200
while its page answered 404, and the card renders the post's TITLE, so an unpublished headline
was public: the generator had no notion of visibility.

The key is a hash and so is not guessable at a glance. That is not a defence and is not treated
as one: the object is public, unauthenticated, served immutable, and its URL is written into D1
for every post. THE VISIBILITY RULE IS IMPORTED, a second copy here being the shape that put
drafts into the Ask index once already.

This is the SECURITY half, cards that must NOT exist. The other direction is asserted in the
block after it.`,
  ],
  "scripts/check-media.mjs#30": ["WHY", "what an empty read would report; already short"],
  "scripts/check-media.mjs#32": [
    "WHY",
    "the two halves, what each can see that the other cannot, and where the expected set comes from; the plant's date and its readings go to the history document",
    `EVERY PUBLICLY VISIBLE POST HAS A CARD, in the bucket and on the wire. TWO ASSERTIONS OVER
ONE EXPECTED SET, separate because they fail for different reasons and neither implies the
other.

  KEY RECONCILIATION reads the R2 listing this gate already has, and names the DEFECT: the
  generator has not been run since the slug or title moved.
  THE WIRE READ fetches each card through the deployed route, and sees what the key comparison
  cannot: a bucket the route is not bound to, a cache rule swallowing the prefix, a deploy that
  never happened.

A plant MEASURED that rather than arguing it: one key deleted from the live bucket, and the key
reconciliation named the slug immediately while the wire read still reported every card
answering 200, because cards are served immutable and the edge kept serving an object that no
longer existed. Read that both ways: the KEY half sees a missing card the wire cannot see for
up to a year, and the WIRE half sees failures no key comparison can reach.

THE EXPECTED SET IS THE SAME DERIVATION THE GENERATOR USES, through the same two imported
predicates rather than restated: publicly visible, and no cover of its own.`,
  ],
  "scripts/check-media.mjs#34": [
    "WHY",
    "what empties the set and why a floor rather than a zero-check; the measurement goes to the history document",
    `SCOPE, PROVEN NON-EMPTY. An artifact whose posts are all drafts, or a \`cover\` field that
started arriving on everything, empties this set and both loops below sweep clean over nothing.
A floor rather than a zero-check, because a set that has fallen to one is a scan that has
stopped finding posts, not a blog that lost ten.`,
  ],
  "scripts/check-media.mjs#35": [
    "WHY",
    "why the deployed host and why GET",
    `THE WIRE. Fetched from the deployed host and NOT whatever \`--local\` points at, because a
local bucket has no bearing on what a scraper gets. GET rather than HEAD: the route is allowed
to answer a HEAD differently, and a 404 body is what was actually observed.`,
  ],
  "scripts/check-media.mjs#37": ["WHY", "why the body is drained; two lines already"],
  "scripts/check-media.mjs#38": [
    "WHY",
    "why nothing could see the drift, why the page still renders from the file, and why the pairs are extracted; the two strings and the date go to the history document",
    `THE ROSTER'S ALT TEXT AND THE MEDIA INDEX'S MUST BE THE SAME STRING, and they were not: two
owners of one fact, with the weaker string the one a screen reader got, on the only page whose
whole content is photographs of people.

NOTHING COULD SEE IT. The library's no-alt lens counts EMPTY alt, so a row with good text and a
page with worse text is invisible to it; the page renders from a typed data file, where a
missing alt is a typecheck failure and a divergent one is not. Both halves were individually
correct.

The page keeps rendering from the data file, a per-request read for a constant being a cost
with no reader, and THIS is what stops the two drifting. The pairs are extracted rather than
imported because the data file is .ts and this gate is .mjs; the extraction is scoped tightly
and its count is asserted, so a parser that stopped matching fails rather than sweeping clean.`,
  ],
  "scripts/check-media.mjs#40": [
    "NUMBER",
    "why floored rather than zero-checked; the count goes to the history document",
    `FLOORED rather than zero-checked: the cohort photographs are a FIXED set in a committed data
file, so a scan that returns one fewer has stopped matching one of them, and the missing one is
precisely where a drifted alt would hide.`,
  ],
};
