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
These faces were committed from a CDN, so they have no upstream to compare against, and a
browser CLAMPS an out-of-range axis value SILENTLY. Per block that names a file: weight range
against \`wght\` EXACTLY, style against the italic evidence, stretch against \`wdth\`, family
against the file's name table, and every axis requested anywhere must EXIST and CONTAIN the
value. THE BASELINE, because all of that survives a re-subset: each binary carries a pinned
digest, and \`--update\` rewrites it, deliberately loud. BOUNDARY: it reads DISK, never the wire.`,
  ],
  "scripts/check-fonts.mjs#1": [
    "CONTRACT",
    "why the parameter is named ok, in two lines",
    `The first argument is named \`ok\` as six other gates spell it, \`check:invariants\` section 17
refusing two argument orders for one name: a copied assertion would put a truthy STRING in the
condition slot and still increment the count.

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
    `Axis requests anywhere in the sheet, which is what catches a type scale asking for an optical
size the file cannot serve.`,
  ],
  "scripts/check-fonts.mjs#9": [
    "WHY",
    "why the levels need their own reader and why the family travels with the request; the two ranges go to the history document",
    `AND THE TYPE LEVELS, which spell \`font-variation-settings\` nowhere: the scale carries a level's
axes and its family in separate tokens, so the regex above sees neither. THE FAMILY IS CARRIED
WITH THE REQUEST: two shipped families carry \`opsz\` on different ranges, so checking against
every carrier fails a legitimate value and checking against none lets a level be clamped.`,
  ],
  "scripts/check-fonts.mjs#10": [
    "WHY",
    "why a variant has no family of its own, and why it is not spelled out",
    `A VARIANT INHERITS ITS LEVEL'S FAMILY: a heavier spelling of a level is not a ninth level, so a
family token of its own would be a second owner. The base is the level name minus its last
segment, and only when no exact token exists. The variant is NOT spelled in full here: section
31's token scan reads \`scripts/\` without stripping comments, so naming it would mark it
referenced and then fail it for being referenced.`,
  ],
  "scripts/check-fonts.mjs#11": [
    "WHY",
    "the tenth vacuity class and why the floors are low bars",
    `SCOPE, ASSERTED BEFORE ANY PER-BLOCK ASSERTION: a regex that stopped matching iterates nothing
and every loop reports a clean sweep. Low bars, existing to prove the parse happened at all.`,
  ],
  "scripts/check-fonts.mjs#12": [
    "WHY",
    "why split rather than filtered, and why the annotation is a double star",
    `Split rather than filtered, so \`file\` is a string in the half that has one: filtering leaves
the type nullable and every use needs a cast, which tells the typechecker to stop looking at
the field this gate cares about. The annotation below is a DOUBLE-STAR block on purpose:
written \`/*\` the \`@type\` is not JSDoc, the array infers \`any[]\`, and nothing is checked.`,
  ],
  "scripts/check-fonts.mjs#15": [
    "WHY",
    "why the skip is explicit and why the list is exact; the two names go to the history document",
    `The local()-only faces are SKIPPED EXPLICITLY and counted, so a future file-backed block cannot
fall into the skip path unnoticed. Exact rather than a count: WHICH two is the assertion.`,
  ],
  "scripts/check-fonts.mjs#16": ["CONTRACT", "one line already; kept"],
  "scripts/check-fonts.mjs#17": ["CONTRACT", "one line already; kept"],
  "scripts/check-fonts.mjs#21": [
    "WHY",
    "what a namespaced family is for and why the map polices itself",
    `NAMESPACED FAMILIES are the one case where the declared family and the binary's name table
legitimately differ: the serif is namespaced so a reader with the retail family installed
cannot put a different file in the resolution path. This map keeps that from being a licence,
the declaration still being pinned to ONE binary family. It polices itself both directions.`,
  ],
  "scripts/check-fonts.mjs#22": ["CONTRACT", "type annotation plus what the map maps; one line already"],
  "scripts/check-fonts.mjs#23": ["CONTRACT", "what the file calls itself; already short"],
  "scripts/check-fonts.mjs#24": ["WHY", "both directions of the self-policing; already short"],
  "scripts/check-fonts.mjs#25": [
    "WHY",
    "what a clamp looks like, in two lines",
    `AXIS REQUESTS FROM THE SHEETS, IN RANGE: a browser clamps silently, so the level renders at
the wrong optical size with nothing reporting it.`,
  ],
  "scripts/check-fonts.mjs#26": [
    "WHY",
    "the zero-scope arm and what the floor is for; the level count goes to the history document",
    `A ZERO-SCOPE SEARCH REPORTS A CLEAN SWEEP. The floor proves the parse happened at all.`,
  ],
  "scripts/check-fonts.mjs#27": ["CONTRACT", "what the indirection resolves to; already short"],
  "scripts/check-fonts.mjs#28": ["WHY", "the zero-scope class for an unresolvable family; two lines already"],
  "scripts/check-fonts.mjs#29": ["CONTRACT", "which faces a request is checked against; already short"],
  "scripts/check-fonts.mjs#30": [
    "WHY",
    "why the cards are asserted here, which build is canonical and what was refused; both build strings, the ruling date and the outline measurement go to the history document",
    `THE SATORI FACES, which are in no stylesheet: the cards are drawn from static TTFs that are the
same typeface as the served woff2 and a DIFFERENT BUILD of it, and nothing reconciled them.
THE SERVED woff2 BUILD IS CANONICAL, cards being a secondary artifact of that identity, and
THE TWO CANNOT CHEAPLY BE ALIGNED, satori not reading woff2. So the difference STANDS, and what
was refused with it was an instancing pipeline: a dependency, a build step and a gate.`,
  ],
  "scripts/check-fonts.mjs#31": [
    "WHY",
    "why a token and not the first block; the serif's arrival and its date go to the history document",
    `THE FAMILY THE SITE SERVES, read from the \`--font-sans\` token rather than the FIRST
\`@font-face\` block, which was true only while one family lived there: a second made that a
statement about source ORDER. The token is an independent declaration and the right source
anyway, the cards drawing body-weight text.`,
  ],
  "scripts/check-fonts.mjs#32": ["WHY", "what the baseline catches that the axes cannot; two lines already"],
  "scripts/check-fonts.mjs#35": [
    "NUMBER",
    "why measured by running and why the mode matters; both dated readings and the tolerance arithmetic go to the history document",
    `THE FLOOR, measured by RUNNING this gate: a hand-counted floor is a second owner of a number
the gate already knows. MEASURED ON A PLAIN RUN, and that distinction cost a wrong floor once:
\`--update\` SKIPS the per-binary baseline comparisons.`,
  ],
  "scripts/check-backup.mjs#0": [
    "CONTRACT",
    "the boundary, why per table, why the list is derived and what the media pull covers; the portfolio incident and the ruling reference go to the history document",
    `Verifies the per-table backup path against the live schema.

  npm run check:backup -- --local
  npm run check:backup -- --remote

BOUNDARY: it proves the export PATH works and that the table list matches the migrations. It
never restores. \`wrangler d1 export\` does not work on this database, refusing while any fts5
virtual table exists, so the documented path is per table and this keeps that claim honest.
THE TABLE LIST IS DERIVED and compared BOTH ways, a list that stops covering a new table being
the failure this guards, and every export is checked for real ROWS. IT ALSO PULLS THE MEDIA
OBJECTS to the same root: both bucket copies live in one account. \`--remote\` only, and it says
so rather than counting zero as a pass.`,
  ],
  "scripts/check-backup.mjs#1": [
    "WHY",
    "why the other bucket is not pulled",
    `The irreplaceable bucket. The OG bucket is deliberately NOT pulled: every card is regenerable,
and backing up output that has a rebuild door grows a backup set without making it safer.`,
  ],
  "scripts/check-backup.mjs#2": ["CONTRACT", "whose tables these are; two lines already"],
  "scripts/check-backup.mjs#3": [
    "WHY",
    "why both targets are worth running; the discovery goes to the history document",
    `Local only: miniflare creates it and remote D1 does not have it.`,
  ],
  "scripts/check-backup.mjs#4": [
    "CONTRACT",
    "why one quoted string, in two lines",
    `One already-quoted command string: an args array with \`shell: true\` concatenates without
quoting and has split an argument containing a space twice in this repo.

@param {string} args
@returns {{ stdout: string, status: number }}`,
  ],
  "scripts/check-backup.mjs#5": [
    "WHY",
    "what a head slice reported; the sibling gate's identical bug and the two CI runs go to the history document",
    `The END of wrangler's output, which is where its error is: both throws used the HEAD, which is
the banner.

@param {string} text
@param {number} [max]`,
  ],
  "scripts/check-backup.mjs#6": [
    "WHY",
    "why the UUID for remote and why the name for local; the error code and the CI observation go to the history document",
    `How this gate ADDRESSES the database, which is not always its name: the export resolves the
name through the gitignored config, which a clean checkout bootstraps with a placeholder id.
\`--local\` keeps the NAME deliberately, miniflare state being keyed by the config's id.

@param {string} target
@returns {string}`,
  ],
  "scripts/check-backup.mjs#8": [
    "WHY",
    "why there is no fallback",
    `FAILS CLOSED: falling back to the name substitutes a different value and reintroduces the
lookup failure wearing a passing lookup.`,
  ],
  "scripts/check-backup.mjs#9": ["CONTRACT", "one line already; kept"],
  "scripts/check-backup.mjs#10": [
    "CONTRACT",
    "why virtual tables are excluded",
    `Virtual tables are deliberately excluded: they cannot be exported and are rebuilt from their
content table, so including them would make the expected set disagree by construction.

@returns {Promise<Set<string>>}`,
  ],
  "scripts/check-backup.mjs#12": ["CONTRACT", "why comments are stripped; one line already"],
  "scripts/check-backup.mjs#13": [
    "CONTRACT",
    "why shadows are found by prefix",
    `Shadow tables are found by prefix against the virtual table names rather than by a hardcoded
suffix list, so a future fts5 table brings its own shadows along.

@param {string} target
@returns {Promise<{ real: Set<string>, virtual: Set<string>, shadow: Set<string> }>}`,
  ],
  "scripts/check-backup.mjs#14": [
    "WHY",
    "why this read is retried and what is not; both dates go to the history document",
    `RETRIED ONCE: this read has died with a transient open failure and been clean immediately
after. The per-table export is wrapped too; nothing that WRITES is.`,
  ],
  "scripts/check-backup.mjs#15": ["CONTRACT", "why the throw is deliberate; two lines already"],
  "scripts/check-backup.mjs#17": [
    "WHY",
    "why one classifier and why the platform set stays here",
    `Classified by the shared module, the same one \`check:invariants\` reads: the rules were already
identical and a comment said so, and one module makes that a fact. PLATFORM_TABLES stays HERE,
being a property of where these rows came from rather than of SQLite.`,
  ],
  "scripts/check-backup.mjs#20": [
    "NUMBER",
    "the blind spot in a both-directions comparison, and why the floors are structural; the sweep, the measurement and the counts go to the history document",
    `SCOPE FLOORS. This gate had none, and it is the one that decides whether this database can be
recovered at all. The two loops are both directions between two independent sources, a strong
shape with one blind spot: they are satisfied by the sources shrinking TOGETHER. MEASURED BOTH
WAYS, the two targets agreeing on every structural count and differing only in bytes, which is
why the floors are on STRUCTURE.`,
  ],
  "scripts/check-backup.mjs#24": ["WHY", "what each direction means; already short"],
  "scripts/check-backup.mjs#26": [
    "CONTRACT",
    "why it was lifted out unchanged",
    `Exports one table and reads back what it wrote. LIFTED OUT OF THE LOOP UNCHANGED so the loop
could become a pool: every assertion is the one the serial loop made.

@param {string} name`,
  ],
  "scripts/check-backup.mjs#27": [
    "WHY",
    "why an export may be retried and why writes are not; the failing table, the date and the instance count go to the history document",
    `RETRIED ONCE. An export is a READ: it pulls rows and writes a LOCAL temp file, so a second
attempt overwrites its own output. The throw is load-bearing, wrangler RETURNING on a failed
command rather than rejecting.`,
  ],
  "scripts/check-backup.mjs#28": [
    "WHY",
    "the unfailable condition with its citation, and what the removed branch printed",
    `NO STATUS CHECK AFTER THIS. There was one and it could not fire: \`retryRead\` hands back what
the callback returned and the callback throws on non-zero. Hard rule 10's first class, and it
printed what read as the diagnostic for a failed export.`,
  ],
  "scripts/check-backup.mjs#29": ["WHY", "why INSERTs are counted; two lines already"],
  "scripts/check-backup.mjs#30": [
    "WHY",
    "the identity argument, why the cost was scheduling and why the bound; every timing goes to the history document",
    `THE EXPORTS RUN CONCURRENTLY, and NOTHING ELSE ABOUT THEM CHANGED: the same commands against
the same target, each writing its own file, each a READ, and the output re-sorted. THE COST WAS
SCHEDULING RATHER THAN WORK, process startup being the cost. THE BOUND IS ARGUED RATHER THAN
TUNED: enough processes to saturate the machine puts the cost back as scheduler contention.`,
  ],
  "scripts/check-backup.mjs#32": [
    "WHY",
    "why the output is re-sorted",
    `RE-SORTED BEFORE REPORTING: a pool completes out of order, and output order that depends on
which export finished first is a gate whose diffs are noise.`,
  ],
  "scripts/check-backup.mjs#33": [
    "WHY",
    "what the pool can fail at that the loop could not",
    `SCOPE, ASSERTED, and new with the pool: a worker that returned early leaves exports unrun, and
every count below is then computed over a smaller set that agrees with itself.`,
  ],
  "scripts/check-backup.mjs#34": [
    "WHY",
    "why empty reports rather than fails",
    `Empty tables are legitimate, so this reports. EVERY table being empty is not: that is the
export path broken rather than the data absent.`,
  ],
  "scripts/check-backup.mjs#35": [
    "NUMBER",
    "why the check above is the weakest form; the measured tables and their names go to the history document",
    `AND A FLOOR ON HOW MANY CARRIED ROWS, the check above failing only when every export is empty.
This moves with CONTENT, so it is deliberately the loosest floor in the file.`,
  ],
  "scripts/check-backup.mjs#36": [
    "WHY",
    "why it is here rather than a second script, and why remote only; the ruling reference goes to the history document",
    `THE MEDIA OBJECTS, to the SAME backup root: the mirror bucket answers this site's own code
deleting an object and NOTHING about account loss, so this is the only copy outside it. REMOTE
ONLY, AND SAID RATHER THAN SKIPPED SILENTLY, \`--local\` reading a miniflare that holds no
objects. THE FLOOR IS THE LIST, NOT A CONSTANT: downloaded against what R2 listed in the call.`,
  ],
  "scripts/lib/child-processes.mjs#0": [
    "CONTRACT",
    "the two kill shapes, why a registry and not a sweep, what the port probe adds and the pid-reuse rule; every process count goes to the history document",
    `Killing a gate's long-running children, and clearing the ones a kill left behind last time.

THE DEFECT: \`check:browser\` starts a preview server and a browser, cleaned up on every ORDERLY
exit and neither on a hard kill, which on Windows is not deliverable as a signal. TWO KILL
SHAPES LEAVE DIFFERENT WRECKAGE: kill the gate node and the preview side survives holding its
port; kill the wrappers above it and everything stands, self-clearing only if the orphan is
allowed to finish. WHY A REGISTRY AND NOT A SWEEP: scanning every process is too slow on
Windows and "looks like ours" gets to close a stranger's tabs when it is wrong. PID REUSE IS
THE WHOLE SAFETY PROBLEM, so the live command line is read first and must still match.`,
  ],
  "scripts/lib/child-processes.mjs#1": [
    "CONTRACT",
    "why one normalised form",
    `Command lines are compared in ONE normalised form: the same process is spelled differently by
the two things that report it, and a needle must not miss for a reason unrelated to identity.

@param {string | null | undefined} command
@returns {string}`,
  ],
  "scripts/lib/child-processes.mjs#2": [
    "CONTRACT",
    "why this source and what an empty map means",
    `Every live process, as \`pid -> { ppid, command }\`, through PowerShell rather than \`wmic\`, which
is absent on newer builds, or \`tasklist\`, which reports no command line: a source that cannot
supply one is not a fallback. An EMPTY MAP means "cannot verify", and the only thing callers do
with an unverifiable entry is leave it alone.

@returns {Map<number, { ppid: number, command: string }>}`,
  ],
  "scripts/lib/child-processes.mjs#4": [
    "WHY",
    "why an unreadable command line still gets an entry",
    `A process with no readable command line still gets an entry, so it can be seen to EXIST, and it
can never satisfy a needle.`,
  ],
  "scripts/lib/child-processes.mjs#5": [
    "CONTRACT",
    "when it is used and what recording only the spawned pid would record",
    `Every descendant pid of \`rootPid\`, from a table already read. Used at ONE moment: recording the
wrapper chain, because when the gate node is killed the wrapper DIES with it and the
grandchildren survive, so recording only what \`spawn()\` returned records the one process
guaranteed to be gone.

@param {number} rootPid
@param {Map<number, { ppid: number, command: string }>} table
@returns {number[]}`,
  ],
  "scripts/lib/child-processes.mjs#7": [
    "WHY",
    "why the walk is bounded",
    `Bounded by the table size: a cycle in reported parentage, which a reused pid can manufacture,
would spin here forever.`,
  ],
  "scripts/lib/child-processes.mjs#9": [
    "WHY",
    "why a snapshot is not enough and why EPERM is positive; the replay's date goes to the history document",
    `Whether a pid is live RIGHT NOW rather than when a table was read. Signal 0 checks existence
without delivering anything and \`EPERM\` is a positive answer. This exists because the preflight
loop invalidates its own snapshot: killing one tree removes processes further down the list,
and entries already gone were reported as FAILED TO KILL.

@param {number} pid
@returns {boolean}`,
  ],
  "scripts/lib/child-processes.mjs#11": [
    "WHY",
    "why the probe exists beside the registry, the protocol gotcha and the three states; the measured run and its pid go to the history document",
    `The pids LISTENING on a TCP port, asked of the OPERATING SYSTEM, because the registry is
written by the process that dies and cannot record what outlives a hard kill. THE MEASURED
GOTCHA: the IPv4 flag DOES NOT LIST THE HOLDER, the server binding an IPv6 loopback, so the
listing is taken UNFILTERED and the protocol matched here. THREE STATES, NOT TWO: \`null\` means
no listing could be taken and must never collapse into "nobody is listening".

@param {number} port
@returns {number[] | null} listening pids, or null if no listing could be taken`,
  ],
  "scripts/lib/child-processes.mjs#13": ["CONTRACT", "the sample line the parse is written against; one line already"],
  "scripts/lib/child-processes.mjs#14": [
    "WHY",
    "why the last colon, in two lines",
    `Anchored on the LAST colon, so a bracketed IPv6 address cannot be satisfied by one that merely
contains the digits.`,
  ],
  "scripts/lib/child-processes.mjs#15": [
    "WHY",
    "which exit is an answer and which is unverifiable",
    `lsof exits 1 when it matched nothing, which is an ANSWER. Only a missing binary is unverifiable.`,
  ],
  "scripts/lib/child-processes.mjs#16": [
    "CONTRACT",
    "which flag is load-bearing and why",
    `Kill a process AND everything under it. The tree flag is load-bearing: the interesting
processes are always grandchildren.

@param {number} pid
@returns {boolean} whether the kill reported success`,
  ],
  "scripts/lib/child-processes.mjs#17": ["CONTRACT", "what the negative pid needs; two lines already"],
  "scripts/lib/child-processes.mjs#18": [
    "WHY",
    "why append-per-line rather than rewrite-at-exit",
    `The on-disk record of what this gate started, one JSON object per line appended at each spawn,
so a gate killed between two spawns still leaves a usable record of the first.`,
  ],
  "scripts/lib/child-processes.mjs#20": [
    "CONTRACT",
    "what a needle must be and why",
    `Record a child. \`needles\` are what the live command line must STILL contain for a later run to
kill this pid, so they name the process rather than describing it: normalised, and specific
enough that a process inheriting the pid cannot satisfy them by accident.

@param {number | undefined} pid
@param {string} kind
@param {string[]} needles`,
  ],
  "scripts/lib/child-processes.mjs#21": [
    "WHY",
    "what a failed write may and may not cost",
    `A registry that cannot be written costs the NEXT run its cleanup. It must never cost THIS run
its gate result.`,
  ],
  "scripts/lib/child-processes.mjs#23": ["CONTRACT", "one line already; kept"],
  "scripts/lib/child-processes.mjs#24": ["CONTRACT", "the four outcomes, which is the contract; already at the column limit"],
  "scripts/lib/child-processes.mjs#26": [
    "WHY",
    "why unverifiable entries are kept rather than killed",
    `No listing means no way to tell ours from a stranger's, and killing on the pid alone is the one
thing this module refuses to do, so the entries are KEPT.`,
  ],
  "scripts/lib/child-processes.mjs#27": [
    "WHY",
    "why the two states share a label",
    `Gone when the table was read, or gone since: an earlier entry's tree kill takes its whole
subtree. Both are the same fact.`,
  ],
  "scripts/lib/child-processes.mjs#28": [
    "CONTRACT",
    "what it refuses, why by command line and why an unreadable one is safe; the EBUSY incident and its date go to the history document",
    `Processes matching any of \`needles\`, by COMMAND LINE. Ship's preflight refuses when a tier run,
a browser run or an orphaned preview server is alive, all three writing the build directory or
the database underneath it. BY COMMAND LINE, BY PID, NEVER BY NAME: every one is \`node\` or a
child of it. AN UNREADABLE COMMAND LINE CAN NEVER MATCH.

@param {Map<number, { ppid: number, command: string }>} table
@param {Array<{ needle: string, what: string }>} needles
@param {number} [self] a pid to exclude, normally \`process.pid\`
@returns {Array<{ pid: number, what: string }>}`,
  ],
  "scripts/lib/child-processes.mjs#30": [
    "WHY",
    "why the list lives here and why the needle is the shorter one; the measured holder and the file reference go to the history document",
    `What ship's preflight refuses to run alongside. HERE RATHER THAN IN \`ship.mjs\` so the test can
import the real list: a copy would keep passing after somebody removed a needle, and \`ship.mjs\`
cannot be imported by a test because importing it RUNS a ship. The needle is the SHORTER
spelling, the process that binds the port being the resolved binary.`,
  ],
};
