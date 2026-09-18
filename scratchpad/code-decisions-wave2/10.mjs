// Chunk 10: scripts/check-fonts.mjs 0-35, scripts/check-backup.mjs 0-37,
// scripts/lib/child-processes.mjs 0-30.
//
// Wave 1's rule. child-processes is the wave's clearest case of an incident that IS the
// prohibition: the two kill shapes, the pid-reuse rule and the IPv6 netstat gotcha are not
// stories about how the module was written, they are the reasons it may not be simplified.
// They stay, one clause each, with their pids, counts and dates cut.
export default {
  "scripts/check-fonts.mjs#0": [
    "CONTRACT",
    "the hole, what it asserts, why the baseline and the boundary; the type-scale motivation, the opsz range and the overlap paragraph go to the history document",
    `Gate over the self-hosted fonts: every \`@font-face\` DECLARATION must be true of the BINARY it
names.

THE HOLE THIS FILLS: \`font-weight: 100 900\` is a claim about a file and nothing checked it.
These faces were taken from a CDN and committed, so unlike every other derived thing here they
have no upstream to compare against, and a browser CLAMPS an out-of-range axis value SILENTLY,
which is the class this is for.

It asserts, per block that names a file: the declared weight range against the \`wght\` axis
EXACTLY rather than as a subset, style against the italic evidence, stretch against \`wdth\`, the
declared family against the file's own name table, and every axis named anywhere in the sheets
must EXIST in that family's faces and CONTAIN the requested value.

THE BASELINE, because all of that is satisfied by a file re-subsetted with its axes intact:
each binary carries a pinned digest. \`--update\` rewrites it, deliberately loud.

BOUNDARY: it reads DISK, never the wire, and asserts AGREEMENT rather than judgment.`,
  ],
  "scripts/check-fonts.mjs#1": [
    "CONTRACT",
    "why the parameter is named ok, in two lines",
    `The first argument is named \`ok\` because six other gates spell it that way and
\`check:invariants\` section 17 refuses two argument orders for one helper name: a copied
assertion would otherwise put a truthy STRING in the condition slot and still increment the
count.

@param {boolean} ok
@param {string} label
@param {string} [detail]`,
  ],
  "scripts/check-fonts.mjs#2": ["CONTRACT", "which sheets are read and why both; already short"],
  "scripts/check-fonts.mjs#3": [
    "WHY",
    "the strip rule with its citation, in one line",
    `Comments are stripped BEFORE matching, hard rule 10: prose about a face is not a face.

@param {string} css
@returns {string}`,
  ],
  "scripts/check-fonts.mjs#7": ["CONTRACT", "which url and what a fileless block is; two lines already"],
  "scripts/check-fonts.mjs#8": [
    "WHY",
    "why the scan is not limited to the face blocks",
    `Axis requests anywhere in the sheet, not only inside \`@font-face\`: this is what catches a
type scale asking for an optical size the file cannot serve.`,
  ],
  "scripts/check-fonts.mjs#9": [
    "WHY",
    "why the levels need their own reader and why the family travels with the request; the two ranges go to the history document",
    `AND THE TYPE LEVELS, which spell \`font-variation-settings\` nowhere: the scale carries a
level's axes and its family in separate tokens, so the regex above sees neither and this gate
would have been blind to the exact defect its header says it was written for.

THE FAMILY IS CARRIED WITH THE REQUEST, and that is what makes the assertion sharp. Two shipped
families carry \`opsz\` on different ranges: checking a request against every carrier would fail
one family's legitimate value against the other, and checking it against none would let a level
be clamped in silence. Each level is checked against the family its own token names.`,
  ],
  "scripts/check-fonts.mjs#10": [
    "WHY",
    "why a variant has no family of its own, and why it is not spelled out",
    `A VARIANT INHERITS ITS LEVEL'S FAMILY: a heavier spelling of a level is not a ninth level, so
it has no family token of its own and must not, a second one being a second owner of the same
decision. The base is the level name with its last segment dropped, and only when no exact
token exists, so a real level always wins over the fallback.

The variant is NOT spelled in full here on purpose: section 31's token scan reads \`scripts/\`
without stripping comments, so naming it would mark it referenced and then fail it for being
referenced.`,
  ],
  "scripts/check-fonts.mjs#11": [
    "WHY",
    "the tenth vacuity class and why the floors are low bars",
    `SCOPE, ASSERTED BEFORE ANY PER-BLOCK ASSERTION: a regex that stopped matching would iterate
nothing and every loop below would report a clean sweep. The floors are the inventory as it
stands and are deliberately low bars, existing to prove the parse happened at all.`,
  ],
  "scripts/check-fonts.mjs#12": [
    "WHY",
    "why split rather than filtered, and why the annotation is a double star",
    `Split rather than filtered, so \`file\` is a string in the half that has one: filtering leaves
the type nullable and every use below would need a cast, which is a way of telling the
typechecker to stop looking at exactly the field whose absence this gate cares about.

The annotation below is a DOUBLE-STAR block on purpose. Written as a plain \`/*\` the \`@type\` is
not JSDoc, TypeScript ignores it, and the array infers \`any[]\`: every null error disappears and
nothing is checked, which is a silent pass wearing the costume of a fix.`,
  ],
  "scripts/check-fonts.mjs#15": [
    "WHY",
    "why the skip is explicit and why the list is exact; the two names go to the history document",
    `The local()-only faces are SKIPPED EXPLICITLY and counted, so a future file-backed block
cannot fall into the skip path unnoticed. The list is exact rather than a count, because a
count is satisfied by any two fileless faces and the thing worth asserting is WHICH two.`,
  ],
  "scripts/check-fonts.mjs#16": ["CONTRACT", "one line already; kept"],
  "scripts/check-fonts.mjs#17": ["CONTRACT", "one line already; kept"],
  "scripts/check-fonts.mjs#21": [
    "WHY",
    "what a namespaced family is for and why the map polices itself",
    `NAMESPACED FAMILIES are the one case where the declared family and the binary's own name
table legitimately differ: the serif is declared under a namespaced name so a reader with the
retail family installed cannot put a different file in the resolution path.

This map is what keeps that from being a licence: the declaration is still pinned to ONE binary
family, so swapping the typeface behind the namespaced name fails exactly as it would without
one. It polices itself below in both directions, because an entry naming a family no sheet
declares is a hole nobody would notice.`,
  ],
  "scripts/check-fonts.mjs#22": ["CONTRACT", "type annotation plus what the map maps; one line already"],
  "scripts/check-fonts.mjs#23": ["CONTRACT", "what the file calls itself; already short"],
  "scripts/check-fonts.mjs#24": ["WHY", "both directions of the self-policing; already short"],
  "scripts/check-fonts.mjs#25": [
    "WHY",
    "what a clamp looks like, in two lines",
    `AXIS REQUESTS FROM THE SHEETS. The value must be IN RANGE, because a browser clamps an
out-of-range axis silently: the level renders, at the wrong optical size, with nothing
reporting it.`,
  ],
  "scripts/check-fonts.mjs#26": [
    "WHY",
    "the zero-scope arm and what the floor is for; the level count goes to the history document",
    `A ZERO-SCOPE SEARCH REPORTS A CLEAN SWEEP. The floor is the inventory as it stands and exists
to prove the parse happened at all rather than to bound it.`,
  ],
  "scripts/check-fonts.mjs#27": ["CONTRACT", "what the indirection resolves to; already short"],
  "scripts/check-fonts.mjs#28": ["WHY", "the zero-scope class for an unresolvable family; two lines already"],
  "scripts/check-fonts.mjs#29": ["CONTRACT", "which faces a request is checked against; already short"],
  "scripts/check-fonts.mjs#30": [
    "WHY",
    "why the cards are asserted here, which build is canonical and what was refused; both build strings, the ruling date and the outline measurement go to the history document",
    `THE SATORI FACES, which are in no stylesheet. The social cards are drawn from static TTFs that
are the same typeface as the served woff2 and a DIFFERENT BUILD of it, and nothing reconciled
them. That is tolerable and it is not nothing, which is why it is asserted rather than left to
be discovered.

THE SERVED woff2 BUILD IS CANONICAL: it is what every reader sees, and cards are a secondary
artifact of that identity. THE TWO CANNOT CHEAPLY BE ALIGNED, because satori does not read
woff2 and statics compiled from the canonical build do not exist to download. So the difference
STANDS, and what was refused with it was an instancing pipeline: a dependency, a build step and
a gate to keep the two in step. This section plus the byte baseline is what holds the line.`,
  ],
  "scripts/check-fonts.mjs#31": [
    "WHY",
    "why a token and not the first block; the serif's arrival and its date go to the history document",
    `THE FAMILY THE SITE SERVES, read from the \`--font-sans\` token rather than from the FIRST
\`@font-face\` block. The first block was true for exactly as long as one family lived there, and
a second one made that selector a statement about source ORDER: reordering would have silently
re-pointed this comparison at the wrong typeface and passed. The token is an independent
declaration and the right source anyway, since the cards draw body-weight text.`,
  ],
  "scripts/check-fonts.mjs#32": ["WHY", "what the baseline catches that the axes cannot; two lines already"],
  "scripts/check-fonts.mjs#35": [
    "NUMBER",
    "why measured by running and why the mode matters; both dated readings and the tolerance arithmetic go to the history document",
    `THE FLOOR. Measured by RUNNING this gate, never by summing the assertions above: a
hand-counted floor is a second owner of a number the gate already knows.

MEASURED ON A PLAIN RUN, and the distinction cost a wrong floor once already: \`--update\` SKIPS
the per-binary baseline comparisons, so a floor measured from one sits well under the count it
is supposed to guard.`,
  ],
  "scripts/check-backup.mjs#0": [
    "CONTRACT",
    "the boundary, why per table, why the list is derived and what the media pull covers; the portfolio incident and the ruling reference go to the history document",
    `Verifies the per-table backup path against the live schema.

  npm run check:backup -- --local
  npm run check:backup -- --remote

BOUNDARY: it proves the export PATH works and that the table list matches the migrations. It
never restores, so it cannot tell you the dump would reconstruct the database.

\`wrangler d1 export\` does not work on this database: it refuses while any fts5 virtual table
exists, which is permanent. The documented path is per table, and this keeps that claim honest.

THE TABLE LIST IS DERIVED, never hardcoded, and compared BOTH ways: a backup list that silently
stops covering a new table is the exact failure this guards, and it has happened here. Every
export is then checked for real ROWS, an empty file being a passing export of nothing.

IT ALSO PULLS THE MEDIA OBJECTS to the same backup root: both bucket copies live in one account,
so this pull is the only copy outside it. \`--remote\` only, and it says so rather than counting
zero as a pass.`,
  ],
  "scripts/check-backup.mjs#1": [
    "WHY",
    "why the other bucket is not pulled",
    `The irreplaceable bucket. The OG bucket is deliberately NOT pulled: every card is regenerable
from the corpus, and backing up output that has a rebuild door is how a backup set grows
without getting safer.`,
  ],
  "scripts/check-backup.mjs#2": ["CONTRACT", "whose tables these are; two lines already"],
  "scripts/check-backup.mjs#3": [
    "WHY",
    "why both targets are worth running; the discovery goes to the history document",
    `Local only: miniflare creates it and remote D1 does not have it, which is one reason both
targets are worth running.`,
  ],
  "scripts/check-backup.mjs#4": [
    "CONTRACT",
    "why one quoted string, in two lines",
    `One already-quoted command string: an args array alongside \`shell: true\` concatenates without
quoting and has split an argument containing a space twice in this repo.

@param {string} args
@returns {{ stdout: string, status: number }}`,
  ],
  "scripts/check-backup.mjs#5": [
    "WHY",
    "what a head slice reported; the sibling gate's identical bug and the two CI runs go to the history document",
    `The END of wrangler's output, which is where its error is: both throws here used the HEAD,
which is the banner, so the actual error never reached the log.

@param {string} text
@param {number} [max]`,
  ],
  "scripts/check-backup.mjs#6": [
    "WHY",
    "why the UUID for remote and why the name for local; the error code and the CI observation go to the history document",
    `How this gate ADDRESSES the database, which is not always its name. \`wrangler d1 export\`
resolves the name through the gitignored config's entry, which a clean checkout bootstraps from
the example with a placeholder id, so a \`--remote\` run there addresses a database that does not
exist.

\`--local\` keeps the NAME deliberately: miniflare state is keyed by the config's id and there is
no UUID to resolve, so an account lookup would answer a question about the wrong database.

@param {string} target
@returns {string}`,
  ],
  "scripts/check-backup.mjs#8": [
    "WHY",
    "why there is no fallback",
    `FAILS CLOSED: falling back to the name would substitute a different value for the one asked
for and reintroduce the lookup failure wearing a passing lookup.`,
  ],
  "scripts/check-backup.mjs#9": ["CONTRACT", "one line already; kept"],
  "scripts/check-backup.mjs#10": [
    "CONTRACT",
    "why virtual tables are excluded",
    `Virtual tables are deliberately excluded: they cannot be exported, they are rebuilt from
their content table, and including them would make the expected set disagree with the
exportable set by construction.

@returns {Promise<Set<string>>}`,
  ],
  "scripts/check-backup.mjs#12": ["CONTRACT", "why comments are stripped; one line already"],
  "scripts/check-backup.mjs#13": [
    "CONTRACT",
    "why shadows are found by prefix",
    `Shadow tables are found by prefix against the virtual table names rather than by a hardcoded
suffix list, so a future fts5 table brings its own shadows along without an edit here.

@param {string} target
@returns {Promise<{ real: Set<string>, virtual: Set<string>, shadow: Set<string> }>}`,
  ],
  "scripts/check-backup.mjs#14": [
    "WHY",
    "why this read is retried and what is not; both dates go to the history document",
    `RETRIED ONCE. This exact read has died with a transient open failure and been clean on an
immediate retry. The per-table export below is wrapped too; nothing that WRITES is.`,
  ],
  "scripts/check-backup.mjs#15": ["CONTRACT", "why the throw is deliberate; two lines already"],
  "scripts/check-backup.mjs#17": [
    "WHY",
    "why one classifier and why the platform set stays here",
    `Classified by the shared module, the same one \`check:invariants\` reads. The rules here and
there were already identical and a comment said so; one module makes that a fact rather than a
coincidence that held twice.

PLATFORM_TABLES stays HERE: it is a property of where these rows came from, a live D1 carrying
Cloudflare bookkeeping, not a property of SQLite.`,
  ],
  "scripts/check-backup.mjs#20": [
    "NUMBER",
    "the blind spot in a both-directions comparison, and why the floors are structural; the sweep, the measurement and the counts go to the history document",
    `SCOPE FLOORS. This gate had NO floor of any kind, and it is the one that decides whether this
database can be recovered at all.

The two loops below are BOTH DIRECTIONS between two independent sources, which is a strong
shape with one blind spot: it is satisfied by the two sources shrinking TOGETHER. If the
migration parser stops matching and the sqlite_master filter over-excludes in the same edit,
both sets go small, every loop agrees, the export writes the handful that survived, and the run
reports ok.

MEASURED BOTH WAYS, because the offline tier runs one and \`check:all\` the other: the two agree
on every structural count and differ only in bytes, which is why the floors are on STRUCTURE. A
byte floor would be a floor on content and would read differently on the two targets.`,
  ],
  "scripts/check-backup.mjs#24": ["WHY", "what each direction means; already short"],
  "scripts/check-backup.mjs#26": [
    "CONTRACT",
    "why it was lifted out unchanged",
    `Exports one table and reads back what it wrote. LIFTED OUT OF THE LOOP UNCHANGED so the loop
could become a pool: every assertion it makes is the one the serial loop made, on the same
command against the same target writing the same file.

@param {string} name`,
  ],
  "scripts/check-backup.mjs#27": [
    "WHY",
    "why an export may be retried and why writes are not; the failing table, the date and the instance count go to the history document",
    `RETRIED ONCE. An export is a READ: it pulls rows and writes a LOCAL temp file, so a second
attempt overwrites its own output and lands nowhere else. Nothing that writes to D1 or R2 is
wrapped, and that stays true. The throw is load-bearing, because wrangler RETURNS on a failed
command rather than rejecting.`,
  ],
  "scripts/check-backup.mjs#28": [
    "WHY",
    "the unfailable condition with its citation, and what the removed branch printed",
    `NO STATUS CHECK AFTER THIS. There was one and it could not fire: \`retryRead\` hands back what
the callback RETURNED and the callback throws on a non-zero status, so anything reaching the
next line already has \`status === 0\`. Hard rule 10's first class. It also printed what read as
the diagnostic for a failed export and was the one branch that never ran.`,
  ],
  "scripts/check-backup.mjs#29": ["WHY", "why INSERTs are counted; two lines already"],
  "scripts/check-backup.mjs#30": [
    "WHY",
    "the identity argument, why the cost was scheduling and why the bound; every timing goes to the history document",
    `THE EXPORTS RUN CONCURRENTLY, and NOTHING ELSE ABOUT THEM CHANGED. The serial loop and this
pool issue the SAME commands against the same target, each writing its own file, and each is a
READ, so no two touch the same byte and the order cannot change what any produces. The output is
re-sorted, so even that is byte-identical to the serial version's.

THE COST WAS SCHEDULING RATHER THAN WORK: the bytes are not the cost, process startup is.

THE BOUND IS ARGUED RATHER THAN TUNED: enough concurrent processes to saturate the machine puts
the cost straight back as scheduler contention, which this repo has measured once already.`,
  ],
  "scripts/check-backup.mjs#32": [
    "WHY",
    "why the output is re-sorted",
    `RE-SORTED BEFORE REPORTING: a pool completes out of order, and a gate whose output line order
depends on which export finished first is a gate whose diffs are noise.`,
  ],
  "scripts/check-backup.mjs#33": [
    "WHY",
    "what the pool can fail at that the loop could not",
    `SCOPE, ASSERTED, and it is new with the pool: a worker that returned early would leave
exports unrun, and every count below would be computed over a smaller set, so the empty check
would be false, the with-rows floor would be met by the few that ran, and the gate would report
ok.`,
  ],
  "scripts/check-backup.mjs#34": [
    "WHY",
    "why empty reports rather than fails",
    `Empty tables are legitimate, so this reports rather than fails. What would NOT be legitimate
is every table being empty, which means the export path is broken rather than the data absent.`,
  ],
  "scripts/check-backup.mjs#35": [
    "NUMBER",
    "why the check above is the weakest form; the measured tables and their names go to the history document",
    `AND A FLOOR ON HOW MANY CARRIED ROWS, because the check above fails only when EVERY export is
empty, so a path that broke for all but one table reads as a pass. This one moves with CONTENT
rather than schema, so it is deliberately the loosest floor in the file.`,
  ],
  "scripts/check-backup.mjs#36": [
    "WHY",
    "why it is here rather than a second script, and why remote only; the ruling reference goes to the history document",
    `THE MEDIA OBJECTS, to the SAME backup root. The mirror bucket answers this site's own code
deleting an object and NOTHING about account loss, both copies living in one account, so this
pull is the only copy outside it and it sits beside the D1 export so one command produces a
complete restore set.

REMOTE ONLY, AND SAID RATHER THAN SKIPPED SILENTLY: \`--local\` reads miniflare, which holds no
objects, so the pull would download nothing and report a clean sweep. THE FLOOR IS THE LIST, NOT
A CONSTANT: what was downloaded is compared against what R2 listed in the same call.`,
  ],
  "scripts/lib/child-processes.mjs#0": [
    "CONTRACT",
    "the two kill shapes, why a registry and not a sweep, what the port probe adds and the pid-reuse rule; every process count goes to the history document",
    `Killing a gate's long-running children, and clearing the ones a kill left behind last time.

THE DEFECT THIS IS FOR: \`check:browser\` starts a preview server and a browser, both cleaned up
on every ORDERLY exit and neither on a hard kill, because a hard kill on Windows is not
deliverable as a signal and no \`finally\` runs.

TWO KILL SHAPES LEAVE DIFFERENT WRECKAGE. Kill the gate node and the browsers die with it while
the preview side survives holding its port, so the next run cannot bind. Kill the wrappers ABOVE
it and everything stands, but it self-clears IF the orphan is allowed to finish, and becomes
permanent when the orphan is killed too, which is what a supervisor retrying a kill does.

WHY A REGISTRY AND NOT A SWEEP: scanning every process and killing what looks like ours is too
slow to finish on Windows, and it has the worst failure mode available here, because "looks
like ours" gets to close a stranger's browser tabs when it is wrong.

PID REUSE IS THE WHOLE SAFETY PROBLEM. A pid in the file is a claim that the process WAS ours,
and Windows reuses pids freely, so the live command line is read first and must still match.
That check is why this module reads a process table at all.`,
  ],
  "scripts/lib/child-processes.mjs#1": [
    "CONTRACT",
    "why one normalised form",
    `Command lines are compared in ONE normalised form, because the same process is spelled
differently by the two things that report it: a needle must not fail to match for a reason that
has nothing to do with identity.

@param {string | null | undefined} command
@returns {string}`,
  ],
  "scripts/lib/child-processes.mjs#2": [
    "CONTRACT",
    "why this source and what an empty map means",
    `Every live process, as \`pid -> { ppid, command }\`. Through PowerShell rather than \`wmic\`,
which is deprecated and absent on newer builds, and rather than \`tasklist\`, which does not
report a command line at all: a missing command line is fatal to this module's safety story, so
a source that cannot supply one is not a fallback.

Returns an EMPTY MAP if the listing cannot be taken, which callers treat as "cannot verify", and
the only thing they do with an unverifiable entry is leave it alone.

@returns {Map<number, { ppid: number, command: string }>}`,
  ],
  "scripts/lib/child-processes.mjs#4": [
    "WHY",
    "why an unreadable command line still gets an entry",
    `A process with no readable command line still gets an entry, so it can be seen to EXIST. It
can never satisfy a needle, which is the fail-closed direction.`,
  ],
  "scripts/lib/child-processes.mjs#5": [
    "CONTRACT",
    "when it is used and what recording only the spawned pid would record",
    `Every descendant pid of \`rootPid\`, from a table already read. Used at ONE moment: to record
the wrapper chain between the gate and the actual server process. When the gate node is killed
the wrapper it spawned DIES with it and the grandchildren survive, so recording only the pid
\`spawn()\` handed back records the one process guaranteed to be gone by the time anybody looks.

@param {number} rootPid
@param {Map<number, { ppid: number, command: string }>} table
@returns {number[]}`,
  ],
  "scripts/lib/child-processes.mjs#7": [
    "WHY",
    "why the walk is bounded",
    `Bounded by the table size: a cycle in reported parentage, which a reused pid can manufacture,
would otherwise spin here forever.`,
  ],
  "scripts/lib/child-processes.mjs#9": [
    "WHY",
    "why a snapshot is not enough and why EPERM is positive; the replay's date goes to the history document",
    `Whether a pid is live RIGHT NOW, as opposed to when a table was read. Signal 0 checks for
existence without delivering anything, and \`EPERM\` is a positive answer: the process is there
and simply not ours to signal.

This exists because a process table is a SNAPSHOT and the preflight loop invalidates it as it
goes: killing one recorded tree removes processes further down the same list, and asking the
snapshot about them afterwards says they are alive, so entries already gone were reported as
FAILED TO KILL.

@param {number} pid
@returns {boolean}`,
  ],
  "scripts/lib/child-processes.mjs#11": [
    "WHY",
    "why the probe exists beside the registry, the protocol gotcha and the three states; the measured run and its pid go to the history document",
    `The pids LISTENING on a TCP port, asked of the OPERATING SYSTEM, because the registry is
written by the process that dies and cannot record the one thing that outlives a hard kill: a
killed run left a server holding the port with an empty registry, and the next preflight
reported nothing stale while the port was occupied.

THE MEASURED GOTCHA, AND IT IS WHY THIS IS NOT A ONE-LINER: the IPv4 flag DOES NOT LIST THE
HOLDER, because the server binds an IPv6 loopback, reported under a separate protocol. The
listing is taken UNFILTERED and the protocol matched here.

THREE STATES, NOT TWO: an array is an answer, and \`null\` means the listing could not be taken,
which is NOT "nobody is listening" and must never be collapsed into it.

@param {number} port
@returns {number[] | null} listening pids, or null if no listing could be taken`,
  ],
  "scripts/lib/child-processes.mjs#13": ["CONTRACT", "the sample line the parse is written against; one line already"],
  "scripts/lib/child-processes.mjs#14": [
    "WHY",
    "why the last colon, in two lines",
    `Anchored on the LAST colon, so a bracketed IPv6 address cannot be satisfied by one that
merely contains the digits, and a longer port number cannot match.`,
  ],
  "scripts/lib/child-processes.mjs#15": [
    "WHY",
    "which exit is an answer and which is unverifiable",
    `lsof exits 1 when it simply matched nothing, which is an ANSWER. Only a missing or erroring
binary is the unverifiable state.`,
  ],
  "scripts/lib/child-processes.mjs#16": [
    "CONTRACT",
    "which flag is load-bearing and why",
    `Kill a process AND everything under it. The tree flag is the load-bearing one: the interesting
processes here are always grandchildren, and killing the root alone reproduces the defect
rather than fixing it.

@param {number} pid
@returns {boolean} whether the kill reported success`,
  ],
  "scripts/lib/child-processes.mjs#17": ["CONTRACT", "what the negative pid needs; two lines already"],
  "scripts/lib/child-processes.mjs#18": [
    "WHY",
    "why append-per-line rather than rewrite-at-exit",
    `The on-disk record of what this gate started. One JSON object per line, appended as each child
is launched, so a gate killed between two spawns still leaves a usable record of the first: a
rewritten-at-exit file would be empty in exactly the case it exists for.`,
  ],
  "scripts/lib/child-processes.mjs#20": [
    "CONTRACT",
    "what a needle must be and why",
    `Record a child. \`needles\` are what the live command line must STILL contain for a later run to
be allowed to kill this pid, so they name the process rather than merely describing it:
normalised, and specific enough that an unrelated process inheriting the pid cannot satisfy
them by accident.

@param {number | undefined} pid
@param {string} kind
@param {string[]} needles`,
  ],
  "scripts/lib/child-processes.mjs#21": [
    "WHY",
    "what a failed write may and may not cost",
    `A registry that cannot be written costs the NEXT run its cleanup. It must never cost THIS run
its gate result, which is the only thing anybody is waiting on.`,
  ],
  "scripts/lib/child-processes.mjs#23": ["CONTRACT", "one line already; kept"],
  // Kept byte-identical: its @returns type is already past the 110-column limit at this
  // indent, and the type cannot wrap without the JSDoc head resolving to a bare @returns.
  "scripts/lib/child-processes.mjs#24": ["CONTRACT", "the four outcomes, which is the contract; already at the column limit"],
  "scripts/lib/child-processes.mjs#26": [
    "WHY",
    "why unverifiable entries are kept rather than killed",
    `No listing means no way to tell ours from a stranger's. Killing on the pid alone is the one
thing this module refuses to do, so the entries are KEPT for a later run that can read a table.`,
  ],
  "scripts/lib/child-processes.mjs#27": [
    "WHY",
    "why the two states share a label",
    `Gone when the table was read, or gone since: an earlier entry's tree kill takes its whole
subtree, and the rest of this list is full of that subtree. Both are the same fact.`,
  ],
  "scripts/lib/child-processes.mjs#28": [
    "CONTRACT",
    "what it refuses, why by command line and why an unreadable one is safe; the EBUSY incident and its date go to the history document",
    `Processes matching any of \`needles\`, by COMMAND LINE. Ship's preflight refuses when a tier run,
a browser run or an orphaned preview server is alive, because all three write the build
directory or the database underneath it, and a ship has failed with EBUSY for exactly that.

BY COMMAND LINE, BY PID, NEVER BY NAME: every one of these is \`node\` or a child of it, so a name
match would refuse on ship's own process. \`self\` is excluded so a caller cannot refuse on
itself. AN UNREADABLE COMMAND LINE CAN NEVER MATCH, which is the safe way round.

@param {Map<number, { ppid: number, command: string }>} table
@param {Array<{ needle: string, what: string }>} needles
@param {number} [self] a pid to exclude, normally \`process.pid\`
@returns {Array<{ pid: number, what: string }>}`,
  ],
  "scripts/lib/child-processes.mjs#30": [
    "WHY",
    "why the list lives here and why the needle is the shorter one; the measured holder and the file reference go to the history document",
    `What ship's preflight refuses to run alongside, and what each one is.

HERE RATHER THAN IN \`ship.mjs\` so the test can import the real list: a copy in the test would keep
passing after somebody removed a needle from ship, and the plant would go on proving a refusal
that no longer exists. \`ship.mjs\` cannot be imported by a test, because importing it RUNS a ship.

The needle is the SHORTER spelling, because the process that actually binds the port is the
resolved binary rather than the command somebody types. The longer one matched nothing, and the
test above is what caught it.`,
  ],
};
