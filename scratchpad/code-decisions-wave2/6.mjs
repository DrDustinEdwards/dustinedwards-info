// Chunk 6: scripts/restore-drill.mjs blocks 0-57, scripts/check-config.mjs blocks 0-46.
//
// Wave 1's rule. Both files are unusually dense in measured incidents rather than arguments,
// and the incidents are the reason several assertions are shaped the way they are: the 7404
// from a bootstrapped config, the foreign-key order, the seeded settings row, the stray hourly
// cron. Each survives as the prohibition it produced, with its date and its tally cut.
//
// restore-drill carries six hard-rule citations and every one is load-bearing, so each stays
// on one line: a citation that wraps resolves to nothing.
export default {
  "scripts/restore-drill.mjs#0": [
    "CONTRACT",
    "the boundary against check:backup, what it restores from, the Time Travel limit and the production guard; the backup-store argument and the deletion note go to the history document",
    `Gate: proves the documented backup path RECONSTRUCTS the database.

  npm run check:restore

BOUNDARY, and the reason this is beside \`check:backup\`: that gate proves an export was WRITTEN
and cannot tell you the dump would reconstruct anything. This takes the dump, builds an empty
database from the migrations, loads it, and asks the restored copy what \`/api/health\` asks
production.

IT TAKES ITS OWN EXPORT, there being no backup store to read, so the claim is that the path
round-trips rather than that a kept artifact is restorable. Time Travel restores IN PLACE, so
no non-destructive drill can exercise it.

IT NEVER TOUCHES PRODUCTION, ENFORCED: every WRITE goes through \`scratch()\`, which refuses any
name that is not this run's. The hook blocking a non-SELECT \`d1 execute\` cannot see inside a
node script, so it is not what protects production here.`,
  ],
  "scripts/restore-drill.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/restore-drill.mjs#2": [
    "WHY",
    "why the UUID and which database the config poisons; the error text, the CI runs and the class note go to the history document",
    `Production's UUID, resolved at runtime, because THE NAME IS NOT ADDRESSABLE FROM CI: the
export resolves through the \`d1_databases\` entry in the gitignored config, which CI bootstraps
from the example with a placeholder id. The asymmetry is the trap, since that poisons EXACTLY
the database this drill reads while the scratch database, in no config at all, works.

@type {string | null}`,
  ],
  "scripts/restore-drill.mjs#3": [
    "WHY",
    "why dated and why prefixed, in two lines",
    `Dated rather than random so a leaked database is identifiable by eye, and prefixed so the
guard below has something to anchor on that production's name can never satisfy.`,
  ],
  "scripts/restore-drill.mjs#4": [
    "CONTRACT",
    "the argument order and what a string in the condition slot does",
    `The argument order every gate here uses: a string in the condition slot is always truthy,
which is the shape \`check:invariants\` section 17 refuses.

@param {string} label
@param {boolean} condition
@param {string} [detail]`,
  ],
  "scripts/restore-drill.mjs#5": [
    "CONTRACT",
    "why one quoted string; the FAILURES reference goes to the history document",
    `One already-quoted command string: an args array alongside \`shell: true\` concatenates without
quoting and splits any argument containing a space.

@param {string} args
@returns {{ stdout: string, status: number }}`,
  ],
  "scripts/restore-drill.mjs#6": [
    "WHY",
    "what a head slice reported; the banner enumeration goes to the history document",
    `The END of wrangler's output, which is where its error is: a head slice reported the banner
on every failure with the SQLite error below the cut, which is the same class as an assertion
that cannot fail.

@param {string} text
@param {number} [max]`,
  ],
  "scripts/restore-drill.mjs#7": [
    "CONTRACT",
    "the guard and why it checks both directions",
    `THE GUARD. Every write path calls this instead of naming a database, so there is exactly one
place a write can learn what to aim at. Both directions: the name must carry the scratch prefix
AND must not be production's, the second half kept because the first depends on a constant
somebody could edit.

@param {string} name
@returns {string}`,
  ],
  "scripts/restore-drill.mjs#8": [
    "WHY",
    "resolving bindings rather than spellings, on the guard",
    `PRODUCTION NOW HAS TWO SPELLINGS, so the guard needs both: a write handed \`PRODUCTION_ID\`
carries no name and the check above would wave it through.`,
  ],
  "scripts/restore-drill.mjs#9": [
    "CONTRACT",
    "why --json rather than the printed table",
    `\`--json\` rather than parsing the table wrangler prints, which is a display format and has
changed shape between versions.

@param {string} db
@param {string} sql must be a SELECT; nothing here writes
@returns {Promise<Array<Record<string, unknown>>>}`,
  ],
  "scripts/restore-drill.mjs#10": [
    "WHY",
    "why the payload is located rather than parsed whole",
    `The JSON is preceded by wrangler's banner, so the payload is located by its first \`[\`: a
banner that changes shape then costs nothing, where parsing the whole stream would fail.`,
  ],
  "scripts/restore-drill.mjs#11": [
    "WHY",
    "why the runner cannot be used and what replaces the bookkeeping table; the measurement and the refusal text go to the history document",
    `\`wrangler d1 migrations apply\` CANNOT be used against the scratch database: it resolves
\`migrations_dir\` out of a d1_databases entry and refuses anything absent from the config, which
a database created at runtime is by construction. So the files are applied directly in sorted
order, the same order and bytes the runner would use.

What is lost is the \`d1_migrations\` table, which is why the integrity query skips it: a hand
INSERT would write a second truth into a derived store (hard rule 18), and the SCHEMA
comparison below is what the row count was standing in for.

@returns {Promise<string[]>}`,
  ],
  "scripts/restore-drill.mjs#12": [
    "WHY",
    "why derived, in one line",
    `DERIVED from \`drizzle/\`, never hardcoded: a hardcoded list that silently stops covering a new
table is the exact failure a backup gate exists to catch.

@returns {Promise<string[]>}`,
  ],
  "scripts/restore-drill.mjs#13": [
    "WHY",
    "why order matters despite the PRAGMA, and why the edges are derived; both measured runs go to the history document",
    `The tables in DEPENDENCY ORDER, parents before children, which matters despite the export's
PRAGMA: \`defer_foreign_keys\` is reset at every COMMIT and \`d1 execute --file\` batches across
more than one transaction, so a child landing before its parent fails whatever the PRAGMA says.

DERIVED, NOT LISTED: the edges come from the \`REFERENCES\` clauses, because a hardcoded order
would be correct today and silently wrong the first time a migration adds a relation.

@returns {Promise<string[]>}`,
  ],
  "scripts/restore-drill.mjs#15": [
    "WHY",
    "why the caller asserts it and what the silent zero is",
    `A NON-EMPTY EDGE SET IS ASSERTED BY THE CALLER, because this function's failure mode is a
silent zero: a regex that stops matching returns every table with no parents, which sorts
alphabetically and reproduces the exact defect this exists to fix.`,
  ],
  "scripts/restore-drill.mjs#18": ["CONTRACT", "one line already; kept"],
  "scripts/restore-drill.mjs#20": [
    "WHY",
    "why the shadow tables, in two lines",
    `IN THE SPELLING \`/api/health\` USES. The index counts are taken on the \`_docsize\` shadow
tables, because \`COUNT(*)\` on an external-content fts5 table reads through to its content table
and can never disagree with it, so counting the virtual tables would pass on a broken index.`,
  ],
  "scripts/restore-drill.mjs#21": [
    "CONTRACT",
    "why sqlite_master and why the DDL comes with it",
    `\`sqlite_master\` rather than a name list, and the DDL comes with it so \`classifySqliteTables\`
separates virtual tables from their shadows by the rule rather than by a suffix list that
differs across fts5 versions.`,
  ],
  "scripts/restore-drill.mjs#22": [
    "CONTRACT",
    "whose tables these are, in two lines",
    `D1 and wrangler's own bookkeeping: no migration declares them and they are not part of a
content restore. The same set \`check:backup\` excludes.`,
  ],
  "scripts/restore-drill.mjs#23": [
    "WHY",
    "why a sweep exists and why it is bounded; the two leaked names go to the history document",
    `SWEEP FIRST, because the \`finally\` below does not run on a hard kill and cleanup that only
exists on the happy path is cleanup that accumulates. Only the prefix, and only older than the
window, so a concurrent run cannot delete a database another run is using. The count is
REPORTED: a sweep quietly removing something every week is a leak nobody is fixing.`,
  ],
  "scripts/restore-drill.mjs#24": [
    "WHY",
    "why it is parsed outside the branch, in two lines",
    `PARSED ONCE, OUTSIDE THE SWEEP'S \`if\`, because the two readers need opposite tolerances: the
sweep is best-effort, and the UUID resolution below fails closed and cannot sit inside a branch
a failed list silently skips.`,
  ],
  "scripts/restore-drill.mjs#26": [
    "WHY",
    "why there is no fallback, in one line",
    `FAILS CLOSED, and loudly: falling back to the name would substitute a different value for the
one asked for and reintroduce the very lookup failure this removes, wearing a passing lookup.`,
  ],
  "scripts/restore-drill.mjs#28": ["CONTRACT", "section marker, rule padding cut", `1. the export, from production, READ ONLY`],
  "scripts/restore-drill.mjs#29": [
    "WHY",
    "the silent fallback the scope check catches",
    `THE EDGE PARSE IS PROVEN NON-EMPTY, because its failure is a silent alphabetical fallback: a
\`REFERENCES\` regex that stops matching returns every table with no parents and the load fails
the way it did before the ordering existed.`,
  ],
  "scripts/restore-drill.mjs#31": [
    "WHY",
    "why there is no status check and which throw is load-bearing",
    `NO STATUS CHECK AFTER THIS, deliberately: \`retryRead\` returns what the inner function
RETURNED and that function throws on a non-zero status, so any value reaching here already has
\`status === 0\`. A check would be Hard rule 10's unfailable condition. The throw INSIDE the
callback is the load-bearing one, since wrangler returns on a failed command rather than
rejecting.`,
  ],
  "scripts/restore-drill.mjs#32": [
    "WHY",
    "why progress is printed, in one line",
    `PROGRESS, because this gate is minutes of network round trips and a long silence is
indistinguishable from a hang.`,
  ],
  "scripts/restore-drill.mjs#33": ["CONTRACT", "section marker, rule padding cut", `2. production's own answers, READ ONLY`],
  "scripts/restore-drill.mjs#34": ["CONTRACT", "section marker, rule padding cut", `3. build the scratch database`],
  "scripts/restore-drill.mjs#35": ["CONTRACT", "section marker, rule padding cut", `3a. a migrated database is NOT an empty one`],
  "scripts/restore-drill.mjs#36": [
    "WHY",
    "the collision, the reverse order and why no index can reach the list; the measurement goes to the history document",
    `MIGRATIONS SEED, AND A SEED COLLIDES WITH A RESTORE: a migration inserts a \`settings\` row, so
applying them leaves a database that is schema-correct and already carries data, and the dump
then trips a UNIQUE constraint. It presents to a human as "the backup is corrupt".

REVERSE dependency order, so a child is emptied before its parent. ONLY REAL TABLES, because
\`orderedTables\` is built from \`CREATE TABLE\` and hard rule 2 forbids \`DELETE FROM\` on an index.`,
  ],
  "scripts/restore-drill.mjs#37": ["CONTRACT", "section marker, rule padding cut", `4. load the dump`],
  "scripts/restore-drill.mjs#38": [
    "WHY",
    "why one file and what the PRAGMA buys; the two failing tables and the per-table history go to the history document",
    `ONE FILE, WITH FOREIGN KEYS DEFERRED. A per-table restore is order-dependent in a way
alphabetical order gets wrong, which was a defect in the RUNBOOK's instructions as much as in
this gate. The PRAGMA holds enforcement until the end of the transaction, so this is a real
restore rather than one with the checks off: a broken reference still fails at commit.`,
  ],
  "scripts/restore-drill.mjs#40": ["CONTRACT", "one line already; kept"],
  "scripts/restore-drill.mjs#41": [
    "WHY",
    "the citation and what makes the equalities meaningful",
    `THE INDEXES ARE REBUILT, NOT RESTORED. Hard rule 2: an fts5 virtual table cannot be exported
and the repair is \`('rebuild')\`. That is also what makes the equalities below meaningful, since
they compare a rebuilt index against restored content.`,
  ],
  "scripts/restore-drill.mjs#42": ["CONTRACT", "section marker, rule padding cut", `5. the restored database answers the same questions`],
  "scripts/restore-drill.mjs#43": [
    "WHY",
    "why per column rather than one deep-equal",
    `ONE NAMED ASSERTION PER COLUMN rather than one deep-equal: a single "the rows match" fails
with both objects printed and leaves the reader to diff them at 2am.`,
  ],
  "scripts/restore-drill.mjs#45": [
    "WHY",
    "what this drill can say that nothing else can",
    `ASSERTED WITHIN THE RESTORED DATABASE, not against production, whose own equality is
\`/api/health\`'s job: what this drill can say that nothing else can is whether a REBUILD over
RESTORED content produces an index that agrees with it.`,
  ],
  "scripts/restore-drill.mjs#47": ["CONTRACT", "section marker, rule padding cut", `5a. the SCHEMA, both sides`],
  "scripts/restore-drill.mjs#48": [
    "WHY",
    "what the comparison replaces and why both sides use one classifier; RECOVERY.md's dated observation goes to the history document",
    `THE ASSERTION \`d1_migrations\` WAS STANDING IN FOR, made directly. RECOVERY.md records the same
comparison as a DATED observation, which is a record rather than a current claim; this makes it
re-runnable, which is what hard rule 17 asks of a number somebody wants to keep believing. Both
sides are classified by one function, so the platform's bookkeeping is excluded identically.`,
  ],
  "scripts/restore-drill.mjs#50": ["CONTRACT", "section marker, rule padding cut", `6. the media mirror, EVERY key`],
  "scripts/restore-drill.mjs#51": [
    "WHY",
    "why not a sample and what this adds over the health poll; the bucket's object count goes to the history document",
    `EVERY KEY, NOT A SAMPLE: a sample drawn from a population this small is the zero-scope vacuity
hard rule 10 forbids, and it is weaker than the health poll, which compares both key sets and
every etag. What this adds is that it reads the buckets from OUTSIDE the Worker, so the mirror
is asserted by something that is not the thing maintaining it.`,
  ],
  "scripts/restore-drill.mjs#53": [
    "WHY",
    "why size corroborates and why the rule is restated here",
    `ETAG, corroborated by SIZE, degrading to size for a multipart etag. The same rule
\`backup.server.ts\` states, restated only because this runs outside the Worker and cannot import
it; the reason lives there.`,
  ],
  "scripts/restore-drill.mjs#54": ["CONTRACT", "section marker, rule padding cut", `7. the scratch database always goes away`],
  "scripts/restore-drill.mjs#55": [
    "NUMBER",
    "what the count moves with; the measurement, the date and the two earlier readings go to the history document",
    `MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed. The count moves with
the number of MIGRATION FILES, each of which is its own assertion, and that only goes up. It
does NOT move with the table list: the load is one assertion over one combined file.`,
  ],
  "scripts/restore-drill.mjs#56": [
    "WHY",
    "why exitCode; the measurement goes to the history document",
    `\`exitCode\` rather than \`process.exit()\`, which tears the process down while libuv still holds
queued stdout writes and the gate exits 127 with its output lost.`,
  ],
  "scripts/check-config.mjs#0": [
    "CONTRACT",
    "the subject, the two pairs, the boundary and what is and is not compared; the images-binding incident, the conventions quotation and the aged boundary note go to the history document",
    `Gate over the wrangler configs: every committed \`.example\` must declare the same BINDING
SURFACE as the real file beside it. Two pairs, the site and the watchdog; both real files are
gitignored and both examples tracked, which makes the example the only description of a
Worker's bindings a fresh clone can see.

BOUNDARY: it compares each pair to itself. It does not ask Cloudflare whether any resource
EXISTS, and it knows only the kinds \`surfaceOf()\` enumerates. Without \`--remote\` it cannot tell
whether a cron is registered on the deployed Worker; with it, the schedules are compared both
ways.

WHAT IS COMPARED: binding names, kinds, and the non-identifying settings. WHAT IS NOT: the
account-scoped identifiers, which are what the example holds placeholders for. FAILS CLOSED: a
missing or unparseable file is a failure, never a skip.`,
  ],
  "scripts/check-config.mjs#1": [
    "WHY",
    "why it is declared here; the ReferenceError run goes to the history document",
    `DECLARED HERE rather than beside the floor that reads it, because the \`--remote\` block runs
long before that point and a \`const\` further down is in the temporal dead zone: a gate that
dies before its floor prints has no floor.`,
  ],
  "scripts/check-config.mjs#3": [
    "WHY",
    "what the map holds and why the shape is per entry",
    `Vars whose VALUE is deliberately not committed, name to reason and to a legal placeholder.
Self-policing both ways: an entry naming a var no config declares fails, and a var here must
match its placeholder SHAPE rather than merely differing from the real value.

PER ENTRY, because "a run of zeros" is right for an id and impossible for an address.
\`example.com\` is reserved, so that placeholder cannot be a real inbox by construction, which is
the property a row of zeros has for an id.

@type {Map<string, { why: string, placeholder: RegExp, shape: string }>}`,
  ],
  "scripts/check-config.mjs#4": [
    "CONTRACT",
    "why one routine rather than two",
    `SHARED BY BOTH PAIRS rather than written twice: two comparison routines walking two configs
is the mirror this gate's own subject warns about, and a check tightened on one pair and
forgotten on the other fails in the direction that never reports.

@param {{
  label: string,
  realPath: string,
  examplePath: string,
  floor: number,
  measured: number,
  settingKeys: string[],
}} pair
@returns {{ real: any, example: any, surface: Map<string, string> }}`,
  ],
  "scripts/check-config.mjs#5": ["CONTRACT", "why narrowed; two lines already"],
  "scripts/check-config.mjs#6": [
    "WHY",
    "how two blind surfaces agree; the plant goes to the history document",
    `A binding KIND no reader understands is absent from BOTH surfaces, so the two agree by being
equally blind and this gate passes. Reported against both files, since either may carry it.`,
  ],
  "scripts/check-config.mjs#7": ["WHY", "one line already; kept"],
  "scripts/check-config.mjs#8": [
    "NUMBER",
    "what `> 0` cannot see; the sweep's date and the measurement go to the history document",
    `AND A FLOOR, not just a non-empty check. The failure \`> 0\` cannot see is the one that happens:
\`surfaceOf()\` stops recognising a binding TYPE, so one binding drops out of both sides and two
configs that both omit it compare equal. Floored just under, because the set is small and moves
in the same commit that adds to both files.`,
  ],
  "scripts/check-config.mjs#9": ["CONTRACT", "one line already; kept"],
  "scripts/check-config.mjs#10": [
    "WHY",
    "why vars are compared at all, and the two-questions distinction; the discovery date and both examples go to the history document",
    `PLAIN VARS, BOTH DIRECTIONS, keys and values. \`surfaceOf()\` carries BINDINGS and a var is not
one, so before this the \`vars\` object was compared by nothing: a var added to the real config
and forgotten in the example reaches the running Worker and is absent from every clone.

NOT-A-CREDENTIAL AND NOT-COMMITTABLE ARE TWO DIFFERENT QUESTIONS: an identifier grants nothing
on its own and is still account-scoped. So a var may be REDACTED, by name, with its reason,
checked both ways against the declared placeholder SHAPE.`,
  ],
  "scripts/check-config.mjs#13": [
    "WHY",
    "what an invocation log carries and why parity is not the property; the date goes to the history document",
    `Observability, which \`surfaceOf()\` cannot carry. It stopped being a debugging preference when
invocation logs were measured to include the request's cookie header and connecting IP, and
there is no field-level redaction, so \`invocation_logs: false\` IS the mechanism. Parity is not
the property, so the VALUE is asserted in each, with \`enabled\` true alongside it.`,
  ],
  "scripts/check-config.mjs#14": ["CONTRACT", "section marker, rule padding cut", `the site Worker`],
  "scripts/check-config.mjs#15": [
    "WHY",
    "what a clone without it would do, in two lines",
    `Workers Cache is not a binding, but it is the kind of setting this gate exists for: a clone
built without it would re-decode and re-encode every thumbnail and never say so.`,
  ],
  "scripts/check-config.mjs#16": [
    "WHY",
    "why the value is asserted and not just parity",
    `PARITY IS NOT THE PROPERTY: the comparison above passes with the cache OFF in both files,
which is the state \`workers/app.ts\` is written against, since its \`private, no-store\` default
exists precisely because a response with no Cache-Control is cached rather than skipped.
Asserted by VALUE, in both files.`,
  ],
  "scripts/check-config.mjs#17": ["CONTRACT", "two lines already; kept"],
  "scripts/check-config.mjs#18": [
    "WHY",
    "what the length check makes explicit; the simplification account goes to the history document",
    `The length check makes the empty case explicit rather than incidental.`,
  ],
  "scripts/check-config.mjs#19": [
    "WHY",
    "why a word and not a NUL; the arrival-as-a-byte account goes to the history document",
    `THE SENTINEL IS A WORD, NOT A NUL: these comparisons need a fallback that can never equal a
real id, and a NUL makes git render the file as BINARY and makes ripgrep skip it, so every
later change here would ride in unreviewed and invisible to a repo-wide grep.`,
  ],
  "scripts/check-config.mjs#20": ["CONTRACT", "section marker, rule padding cut", `the watchdog Worker`],
  "scripts/check-config.mjs#21": [
    "WHY",
    "what described the watchdog before, and why workers_dev is asserted false; the date goes to the history document",
    `The watchdog is a second Worker with its own config, cron and redacted var, and before this it
was described by nothing. \`workers_dev\` is asserted false in both: this Worker exports
\`scheduled\` and nothing else, so a public route would answer errors to anyone who found it and
be a second way in to a Worker holding the operator token.`,
  ],
  "scripts/check-config.mjs#22": [
    "WHY",
    "who owns the cron and why exactly one; the section-25 history goes to the history document",
    `THE CRON, AND THIS CONFIG IS ITS ONE OWNER: what lives here is that the trigger exists, that
there is exactly ONE of it, and that it means fifteen minutes. EXACTLY ONE, because
\`check:invariants\` section 25 compares one schedule against one constant and cannot arbitrate
between two. Asserted in both files, since a cron in the real config and none in the example
describes a Worker a clone would deploy without a schedule.`,
  ],
  "scripts/check-config.mjs#23": [
    "WHY",
    "why absent is not empty and why present-and-array; the stray cron's dates go to the history document",
    `THE SITE'S CRON SET IS DECLARED, AND DECLARING IT EMPTY IS THE POINT. \`triggers\` was ABSENT
from both configs, and absent is not empty: wrangler syncs the cron set from that key, so with
no key it leaves whatever is registered untouched, and an hourly trigger sat on a Worker that
exports no \`scheduled()\`. ASSERTED AS PRESENT-AND-ARRAY, because two files that both omit the
key agree perfectly, which is the state that hid it.`,
  ],
  "scripts/check-config.mjs#24": ["CONTRACT", "section marker, rule padding cut", `both, against the tree`],
  "scripts/check-config.mjs#26": [
    "WHY",
    "what the per-field assertions miss and why the needles are read; the ae-probe incident goes to the history document",
    `THE REAL REDACTED VALUES APPEAR IN NO TRACKED FILE. The placeholder assertions each police ONE
field in ONE file and say nothing about the same digits being written into a script, which is
where the account id actually was. The needles are READ OUT OF THE REAL CONFIGS, never typed
here, and scoped to \`git ls-files\`, which is the definition of "committed" that matters.`,
  ],
  "scripts/check-config.mjs#27": ["CONTRACT", "type annotation plus what the pair holds; one line already"],
  "scripts/check-config.mjs#31": [
    "WHY",
    "both arms, and why the floor is on the count",
    `SCOPE, ASSERTED on both halves: an empty needle list finds nothing because it looked for
nothing, and a short one would match noise, which is why the floor is on the COUNT.`,
  ],
  "scripts/check-config.mjs#33": ["CONTRACT", "one line already; kept"],
  "scripts/check-config.mjs#34": ["CONTRACT", "section marker, rule padding cut", `the traces ruling`],
  "scripts/check-config.mjs#35": [
    "WHY",
    "what a span carries and why explicitly-false; the ruling's date and the redact aside go to the history document",
    `TRACES STAY OFF ON BOTH WORKERS, and this asserts the RULING rather than the default: a fetch
span carries the full path, and this site puts a capability in one at \`/preview/<token>\`.

ASSERTED AS EXPLICITLY-FALSE, not merely falsy. Absent is also "off", and it is off by nobody
having decided; \`{ enabled: false }\` is off because somebody did, so a config that DROPPED the
key would pass a truthiness check and fail this one.`,
  ],
  "scripts/check-config.mjs#36": ["CONTRACT", "section marker, rule padding cut", `--remote: the live schedules`],
  "scripts/check-config.mjs#37": [
    "WHY",
    "what the live half adds, why it is behind a flag and why it fails closed; the aged boundary note and the stray cron's dates go to the history document",
    `THE ONE ASSERTION THIS GATE COULD NOT MAKE. The boundary note it replaces pointed at
check:browser's freshness assertion, which proves the WATCHDOG's cron fires and says nothing
about a cron registered on the SITE Worker that should not exist at all. One was.

So this reads the schedules the platform holds and compares them IN BOTH DIRECTIONS: in the
config and not on the platform is a Worker that will not fire, on the platform and not in the
config is that defect.

BEHIND \`--remote\` RATHER THAN A NEW GATE, because this gate is tiered OFFLINE and ship runs the
offline tier. FAILS CLOSED ON A MISSING CREDENTIAL: \`--remote\` was ASKED FOR, and a gate that
quietly passed would report the same green for "no stray cron" and "I did not look".`,
  ],
  "scripts/check-config.mjs#38": ["CONTRACT", "one line already; kept"],
  "scripts/check-config.mjs#40": [
    "WHY",
    "why the two directions are named separately",
    `BOTH DIRECTIONS, NAMED SEPARATELY: one assertion comparing two sorted arrays would report
"they differ" and leave the reader to work out which way, and the two mean different things.`,
  ],
  "scripts/check-config.mjs#43": [
    "NUMBER",
    "what an empty surface would do; the three dated readings and the guessed figure go to the history document",
    `EXECUTED-COUNT FLOOR. This gate is the only thing binding the tracked examples to the configs
that actually run: if a parse returned an empty surface, every comparison for that pair would
iterate nothing and report perfect agreement. RE-MEASURED BY RUNNING IT, NEVER SUMMED, and
floored under, because the count steps by two or three per binding.`,
  ],
  "scripts/check-config.mjs#44": [
    "NUMBER",
    "why the floor tracks the offline count; the two dated runs and the tolerance arithmetic go to the history document",
    `The floor tracks the OFFLINE count deliberately, because \`--remote\` adds assertions and a
floor set to the remote count would breach on every offline run, which is the tier ship uses.`,
  ],
  "scripts/check-config.mjs#45": [
    "NUMBER",
    "why one name per branch; the measurement and the failing run go to the history document",
    `NAMED PER BRANCH, and this gate needed it the moment \`--remote\` landed: one name for both
judges whichever branch ran last against a floor set from the other, which is what happened
here, an offline floor passing standalone and failing inside \`check:all\`.`,
  ],
  "scripts/check-config.mjs#46": [
    "WHY",
    "why exitCode, and why a race is worse than a consistent failure; the assertion text goes to the history document",
    `\`exitCode\` RATHER THAN \`process.exit()\`, since \`--remote\` made this gate do network I/O: it
tears the process down while keep-alive sockets are still closing and the gate exits 127 with a
clean table above it. It is a RACE, which is worse than a consistent failure because
\`check-all.mjs\` reads exit codes.`,
  ],
};
