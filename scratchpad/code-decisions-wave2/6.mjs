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

BOUNDARY: it takes its OWN export, so the claim is that the path round-trips rather than that a
kept artifact is restorable, and it never touches production, enforced by one guarded writer.
D1 Time Travel is the other restore path and cannot be drilled here at all, because it restores
a database IN PLACE and no form of it targets a different one.`,
  ],
  "scripts/restore-drill.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/restore-drill.mjs#2": [
    "WHY",
    "why the UUID and which database the config poisons; the error text, the CI runs and the class note go to the history document",
    `Production's UUID at runtime, because THE NAME IS NOT ADDRESSABLE FROM CI: the export resolves
through the gitignored config, which CI bootstraps with a placeholder id. The asymmetry is the
trap: it poisons exactly this database while the scratch one, in no config, works.

@type {string | null}`,
  ],
  "scripts/restore-drill.mjs#3": [
    "WHY",
    "why dated and why prefixed, in two lines",
    `Dated rather than random so a leaked database is identifiable, and prefixed for the guard.`,
  ],
  "scripts/restore-drill.mjs#4": [
    "CONTRACT",
    "the argument order and what a string in the condition slot does",
    `The argument order every gate here uses: a string in the condition slot is always truthy.

@param {string} label
@param {boolean} condition
@param {string} [detail]`,
  ],
  "scripts/restore-drill.mjs#5": [
    "CONTRACT",
    "why one quoted string; the FAILURES reference goes to the history document",
    `One already-quoted command string: with \`shell: true\` an array concatenates without quoting.

@param {string} args
@returns {{ stdout: string, status: number }}`,
  ],
  "scripts/restore-drill.mjs#6": [
    "WHY",
    "what a head slice reported; the banner enumeration goes to the history document",
    `The END of wrangler's output, which is where its error is: a head slice reported the banner.

@param {string} text
@param {number} [max]`,
  ],
  "scripts/restore-drill.mjs#7": [
    "CONTRACT",
    "the guard and why it checks both directions",
    `THE GUARD: one place a write can learn what to aim at. Both directions, the scratch prefix AND
not production's, the second kept because the first depends on an editable constant.

@param {string} name
@returns {string}`,
  ],
  "scripts/restore-drill.mjs#8": [
    "WHY",
    "resolving bindings rather than spellings, on the guard",
    `PRODUCTION NOW HAS TWO SPELLINGS: a write handed \`PRODUCTION_ID\` carries no name.`,
  ],
  "scripts/restore-drill.mjs#9": [
    "CONTRACT",
    "why --json rather than the printed table",
    `\`--json\` rather than the table wrangler prints, a display format that has changed shape.

@param {string} db
@param {string} sql must be a SELECT; nothing here writes
@returns {Promise<Array<Record<string, unknown>>>}`,
  ],
  "scripts/restore-drill.mjs#10": [
    "WHY",
    "why the payload is located rather than parsed whole",
    `The payload is located by its first \`[\`, so a banner that changes shape costs nothing.`,
  ],
  "scripts/restore-drill.mjs#11": [
    "WHY",
    "why the runner cannot be used and what replaces the bookkeeping table; the measurement and the refusal text go to the history document",
    `\`wrangler d1 migrations apply\` CANNOT run against the scratch database: it resolves
\`migrations_dir\` from a d1_databases entry and refuses one absent from the config. So the files
are applied directly in sorted order. What is lost is \`d1_migrations\`, which is why the
integrity query skips it: hard rule 18 makes a hand INSERT a second truth in a derived store,
and the schema comparison below is what the row count stood in for.

@returns {Promise<string[]>}`,
  ],
  "scripts/restore-drill.mjs#12": [
    "WHY",
    "why derived, in one line",
    `DERIVED from \`drizzle/\`: a hardcoded list that stops covering a new table is the failure.

@returns {Promise<string[]>}`,
  ],
  "scripts/restore-drill.mjs#13": [
    "WHY",
    "why order matters despite the PRAGMA, and why the edges are derived; both measured runs go to the history document",
    `Tables in DEPENDENCY ORDER despite the export's PRAGMA: \`defer_foreign_keys\` resets at every
COMMIT and \`--file\` batches across transactions. DERIVED from the \`REFERENCES\` clauses, since
a hardcoded order is correct today and silently wrong at the next relation.

@returns {Promise<string[]>}`,
  ],
  "scripts/restore-drill.mjs#15": [
    "WHY",
    "why the caller asserts it and what the silent zero is",
    `A NON-EMPTY EDGE SET IS ASSERTED BY THE CALLER: a regex that stops matching returns every
table with no parents, which sorts alphabetically and reproduces the defect this fixes.`,
  ],
  "scripts/restore-drill.mjs#18": ["CONTRACT", "one line already; kept"],
  "scripts/restore-drill.mjs#20": [
    "WHY",
    "why the shadow tables, in two lines",
    `IN THE SPELLING \`/api/health\` USES. Counts come off the \`_docsize\` shadow tables, because
\`COUNT(*)\` on an external-content fts5 table reads through and can never disagree.`,
  ],
  "scripts/restore-drill.mjs#21": [
    "CONTRACT",
    "why sqlite_master and why the DDL comes with it",
    `\`sqlite_master\` with its DDL, so shadows are separated by the rule rather than by a suffix list.`,
  ],
  "scripts/restore-drill.mjs#22": [
    "CONTRACT",
    "whose tables these are, in two lines",
    `D1 and wrangler's bookkeeping, the same set \`check:backup\` excludes.`,
  ],
  "scripts/restore-drill.mjs#23": [
    "WHY",
    "why a sweep exists and why it is bounded; the two leaked names go to the history document",
    `SWEEP FIRST, because the \`finally\` does not run on a hard kill. Only the prefix and only older
than the window, so a concurrent run is safe, and the count is REPORTED: a weekly sweep of
something is a leak nobody is fixing.`,
  ],
  "scripts/restore-drill.mjs#24": [
    "WHY",
    "why it is parsed outside the branch, in two lines",
    `PARSED ONCE, OUTSIDE THE SWEEP'S \`if\`: the sweep is best-effort and the UUID resolution fails
closed, so it cannot sit inside a branch a failed list skips.`,
  ],
  "scripts/restore-drill.mjs#26": [
    "WHY",
    "why there is no fallback, in one line",
    `FAILS CLOSED, and loudly: falling back to the name substitutes a different value and
reintroduces the lookup failure this removes, wearing a passing lookup.`,
  ],
  "scripts/restore-drill.mjs#28": ["CONTRACT", "section marker, rule padding cut", `1. the export, from production, READ ONLY`],
  "scripts/restore-drill.mjs#29": [
    "WHY",
    "the silent fallback the scope check catches",
    `THE EDGE PARSE IS PROVEN NON-EMPTY: its failure is a silent alphabetical fallback.`,
  ],
  "scripts/restore-drill.mjs#31": [
    "WHY",
    "why there is no status check and which throw is load-bearing",
    `NO STATUS CHECK AFTER THIS: \`retryRead\` returns what the inner function returned and that
throws on non-zero, so a check would be hard rule 10's unfailable condition. The throw INSIDE
the callback is load-bearing, wrangler returning rather than rejecting on a failed command.`,
  ],
  "scripts/restore-drill.mjs#32": [
    "WHY",
    "why progress is printed, in one line",
    `PROGRESS: this gate is minutes of round trips and a long silence looks like a hang.`,
  ],
  "scripts/restore-drill.mjs#33": ["CONTRACT", "section marker, rule padding cut", `2. production's own answers, READ ONLY`],
  "scripts/restore-drill.mjs#34": ["CONTRACT", "section marker, rule padding cut", `3. build the scratch database`],
  "scripts/restore-drill.mjs#35": ["CONTRACT", "section marker, rule padding cut", `3a. a migrated database is NOT an empty one`],
  "scripts/restore-drill.mjs#36": [
    "WHY",
    "the collision, the reverse order and why no index can reach the list; the measurement goes to the history document",
    `MIGRATIONS SEED, AND A SEED COLLIDES WITH A RESTORE: applying them leaves a schema-correct
database already carrying a \`settings\` row, and the dump then trips a UNIQUE constraint,
presenting as "the backup is corrupt". REVERSE dependency order, and ONLY REAL TABLES, since
hard rule 2 forbids \`DELETE FROM\` on an index.`,
  ],
  "scripts/restore-drill.mjs#37": ["CONTRACT", "section marker, rule padding cut", `4. load the dump`],
  "scripts/restore-drill.mjs#38": [
    "WHY",
    "why one file and what the PRAGMA buys; the two failing tables and the per-table history go to the history document",
    `ONE FILE, WITH FOREIGN KEYS DEFERRED: a per-table restore is order-dependent in a way
alphabetical order gets wrong. The PRAGMA holds enforcement to the end of the transaction, so
a broken reference still fails at commit.`,
  ],
  "scripts/restore-drill.mjs#40": ["CONTRACT", "one line already; kept"],
  "scripts/restore-drill.mjs#41": [
    "WHY",
    "the citation and what makes the equalities meaningful",
    `THE INDEXES ARE REBUILT, NOT RESTORED, hard rule 2: an fts5 virtual table cannot be exported.
That is also what makes the equalities below meaningful.`,
  ],
  "scripts/restore-drill.mjs#42": ["CONTRACT", "section marker, rule padding cut", `5. the restored database answers the same questions`],
  "scripts/restore-drill.mjs#43": [
    "WHY",
    "why per column rather than one deep-equal",
    `ONE NAMED ASSERTION PER COLUMN: a single "the rows match" leaves the reader diffing at 2am.`,
  ],
  "scripts/restore-drill.mjs#45": [
    "WHY",
    "what this drill can say that nothing else can",
    `ASSERTED WITHIN THE RESTORED DATABASE, not against production, which is \`/api/health\`'s job.`,
  ],
  "scripts/restore-drill.mjs#47": ["CONTRACT", "section marker, rule padding cut", `5a. the SCHEMA, both sides`],
  "scripts/restore-drill.mjs#48": [
    "WHY",
    "what the comparison replaces and why both sides use one classifier; RECOVERY.md's dated observation goes to the history document",
    `THE ASSERTION \`d1_migrations\` WAS STANDING IN FOR, made directly and re-runnably, which is
what hard rule 17 asks of a number somebody wants to keep believing. One classifier on both
sides, so the platform's bookkeeping is excluded identically.`,
  ],
  "scripts/restore-drill.mjs#50": ["CONTRACT", "section marker, rule padding cut", `6. the media mirror, EVERY key`],
  "scripts/restore-drill.mjs#51": [
    "WHY",
    "why not a sample and what this adds over the health poll; the bucket's object count goes to the history document",
    `EVERY KEY, NOT A SAMPLE: a sample from a population this small is hard rule 10's zero-scope
vacuity. What this adds over the health poll is that it reads the buckets from OUTSIDE the
Worker, so the mirror is asserted by something that is not maintaining it.`,
  ],
  "scripts/restore-drill.mjs#53": [
    "WHY",
    "why size corroborates and why the rule is restated here",
    `ETAG, corroborated by SIZE, degrading to size for a multipart etag. \`backup.server.ts\` holds
the reason; this runs outside the Worker and cannot import it.`,
  ],
  "scripts/restore-drill.mjs#54": ["CONTRACT", "section marker, rule padding cut", `7. the scratch database always goes away`],
  "scripts/restore-drill.mjs#55": [
    "NUMBER",
    "what the count moves with; the measurement, the date and the two earlier readings go to the history document",
    `MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it. It moves with the number of MIGRATION
FILES and not with the table list, the load being one assertion over one combined file.`,
  ],
  "scripts/restore-drill.mjs#56": [
    "WHY",
    "why exitCode; the measurement goes to the history document",
    `\`exitCode\` rather than \`process.exit()\`, which tears the process down mid stdout write.`,
  ],
  "scripts/check-config.mjs#0": [
    "CONTRACT",
    "the subject, the two pairs, the boundary and what is and is not compared; the images-binding incident, the conventions quotation and the aged boundary note go to the history document",
    `Gate: every committed \`.example\` declares the same BINDING SURFACE as the real config beside it.

  npm run check:config [-- --remote]

BOUNDARY: it compares each pair to itself, asks Cloudflare nothing without \`--remote\`, and knows
only the binding kinds \`surfaceOf()\` enumerates.`,
  ],
  "scripts/check-config.mjs#1": [
    "WHY",
    "why it is declared here; the ReferenceError run goes to the history document",
    `DECLARED HERE rather than beside the floor that reads it: the \`--remote\` block runs first and
a \`const\` further down is in the temporal dead zone.`,
  ],
  "scripts/check-config.mjs#3": [
    "WHY",
    "what the map holds and why the shape is per entry",
    `Vars whose VALUE is deliberately not committed, name to reason to a legal placeholder.
Self-policing both ways, and per entry, because "a run of zeros" is right for an id and
impossible for an address; \`example.com\` cannot be a real inbox by construction.

@type {Map<string, { why: string, placeholder: RegExp, shape: string }>}`,
  ],
  "scripts/check-config.mjs#4": [
    "CONTRACT",
    "why one routine rather than two",
    `SHARED BY BOTH PAIRS: two routines walking two configs is the mirror this gate's own subject
warns about, and one tightened on a single pair fails in the direction that never reports.

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
equally blind. Reported against both files, since either may carry it.`,
  ],
  "scripts/check-config.mjs#7": ["WHY", "one line already; kept"],
  "scripts/check-config.mjs#8": [
    "NUMBER",
    "what `> 0` cannot see; the sweep's date and the measurement go to the history document",
    `AND A FLOOR, not just non-empty: what \`> 0\` cannot see is \`surfaceOf()\` ceasing to recognise a
TYPE, so both sides drop it and compare equal.`,
  ],
  "scripts/check-config.mjs#9": ["CONTRACT", "one line already; kept"],
  "scripts/check-config.mjs#10": [
    "WHY",
    "why vars are compared at all, and the two-questions distinction; the discovery date and both examples go to the history document",
    `PLAIN VARS, BOTH DIRECTIONS, keys and values: \`surfaceOf()\` carries bindings and a var is not
one, so a var added to the real config reaches the Worker and is absent from every clone.
NOT-A-CREDENTIAL AND NOT-COMMITTABLE ARE DIFFERENT QUESTIONS, so a var may be REDACTED by
name, with its reason, checked both ways against the declared placeholder SHAPE.`,
  ],
  "scripts/check-config.mjs#13": [
    "WHY",
    "what an invocation log carries and why parity is not the property; the date goes to the history document",
    `Observability, which \`surfaceOf()\` cannot carry. Invocation logs were measured to include the
request's cookie header and connecting IP with no field-level redaction, so \`invocation_logs:
false\` IS the mechanism. Parity is not the property, so the VALUE is asserted in each.`,
  ],
  "scripts/check-config.mjs#14": ["CONTRACT", "section marker, rule padding cut", `the site Worker`],
  "scripts/check-config.mjs#15": [
    "WHY",
    "what a clone without it would do, in two lines",
    `Workers Cache is not a binding, but a clone built without it would re-encode every thumbnail.`,
  ],
  "scripts/check-config.mjs#16": [
    "WHY",
    "why the value is asserted and not just parity",
    `PARITY IS NOT THE PROPERTY: the comparison above passes with the cache OFF in both, which is
not the state \`workers/app.ts\` is written against. Asserted by VALUE, in both files.`,
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
    `THE SENTINEL IS A WORD, NOT A NUL: a NUL makes git render the file BINARY and ripgrep skip it,
so every later change here would ride in unreviewed.`,
  ],
  "scripts/check-config.mjs#20": ["CONTRACT", "section marker, rule padding cut", `the watchdog Worker`],
  "scripts/check-config.mjs#21": [
    "WHY",
    "what described the watchdog before, and why workers_dev is asserted false; the date goes to the history document",
    `The watchdog is a second Worker with its own config, cron and redacted var. \`workers_dev\` is
false in both: it exports \`scheduled\` only, so a public route is a second way in to a Worker
holding the operator token.`,
  ],
  "scripts/check-config.mjs#22": [
    "WHY",
    "who owns the cron and why exactly one; the section-25 history goes to the history document",
    `THE CRON, AND THIS CONFIG IS ITS ONE OWNER: the trigger exists, there is EXACTLY ONE, and it
means fifteen minutes. Exactly one, because \`check:invariants\` section 25 compares one schedule
against one constant. In both files, or a clone deploys a Worker with no schedule.`,
  ],
  "scripts/check-config.mjs#23": [
    "WHY",
    "why absent is not empty and why present-and-array; the stray cron's dates go to the history document",
    `THE SITE'S CRON SET IS DECLARED, AND DECLARING IT EMPTY IS THE POINT: absent is not empty, so
with no \`triggers\` key wrangler leaves whatever is registered, and an hourly trigger sat on a
Worker exporting no \`scheduled()\`. ASSERTED AS PRESENT-AND-ARRAY, since two files that both
omit the key agree perfectly.`,
  ],
  "scripts/check-config.mjs#24": ["CONTRACT", "section marker, rule padding cut", `both, against the tree`],
  "scripts/check-config.mjs#26": [
    "WHY",
    "what the per-field assertions miss and why the needles are read; the ae-probe incident goes to the history document",
    `THE REAL REDACTED VALUES APPEAR IN NO TRACKED FILE: the placeholder assertions police one
field in one file and say nothing about the same digits in a script, which is where the account
id was. The needles are READ OUT OF THE REAL CONFIGS and scoped to \`git ls-files\`.`,
  ],
  "scripts/check-config.mjs#27": ["CONTRACT", "type annotation plus what the pair holds; one line already"],
  "scripts/check-config.mjs#31": [
    "WHY",
    "both arms, and why the floor is on the count",
    `SCOPE, ASSERTED on both halves: an empty needle list finds nothing because it looked for
nothing, and a short one matches noise, which is why the floor is on the COUNT.`,
  ],
  "scripts/check-config.mjs#33": ["CONTRACT", "one line already; kept"],
  "scripts/check-config.mjs#34": ["CONTRACT", "section marker, rule padding cut", `the traces ruling`],
  "scripts/check-config.mjs#35": [
    "WHY",
    "what a span carries and why explicitly-false; the ruling's date and the redact aside go to the history document",
    `TRACES STAY OFF ON BOTH WORKERS, asserted as the RULING: a fetch span carries the full path,
and this site puts a capability in one. EXPLICITLY-FALSE, not merely falsy: absent is off by
nobody having decided, so a config that DROPPED the key would pass a truthiness check.`,
  ],
  "scripts/check-config.mjs#36": ["CONTRACT", "section marker, rule padding cut", `--remote: the live schedules`],
  "scripts/check-config.mjs#37": [
    "WHY",
    "what the live half adds, why it is behind a flag and why it fails closed; the aged boundary note and the stray cron's dates go to the history document",
    `THE ONE ASSERTION THIS GATE COULD NOT MAKE. check:browser proves the WATCHDOG's cron fires and
says nothing about a cron registered on the SITE Worker that should not exist. One was. So the
platform's schedules are compared IN BOTH DIRECTIONS. Behind \`--remote\` rather than a new gate,
this one being tiered offline, and FAILING CLOSED ON A MISSING CREDENTIAL, since \`--remote\` was
asked for and a quiet pass reports the same green as "I did not look".`,
  ],
  "scripts/check-config.mjs#38": ["CONTRACT", "one line already; kept"],
  "scripts/check-config.mjs#40": [
    "WHY",
    "why the two directions are named separately",
    `BOTH DIRECTIONS, NAMED SEPARATELY: one comparison of two sorted arrays says only "they differ".`,
  ],
  "scripts/check-config.mjs#43": [
    "NUMBER",
    "what an empty surface would do; the three dated readings and the guessed figure go to the history document",
    `EXECUTED-COUNT FLOOR. If a parse returned an empty surface, every comparison for that pair
would iterate nothing and report perfect agreement. RE-MEASURED BY RUNNING IT, never summed.`,
  ],
  "scripts/check-config.mjs#44": [
    "NUMBER",
    "why the floor tracks the offline count; the two dated runs and the tolerance arithmetic go to the history document",
    `The floor tracks the OFFLINE count deliberately: \`--remote\` adds assertions, and a floor set
from the remote count breaches on every offline run, which is the tier ship uses.`,
  ],
  "scripts/check-config.mjs#45": [
    "NUMBER",
    "why one name per branch; the measurement and the failing run go to the history document",
    `NAMED PER BRANCH: one name for both judges whichever branch ran last against the other's floor,
which is what happened here, passing standalone and failing inside \`check:all\`.`,
  ],
  "scripts/check-config.mjs#46": [
    "WHY",
    "why exitCode, and why a race is worse than a consistent failure; the assertion text goes to the history document",
    `\`exitCode\` RATHER THAN \`process.exit()\`, \`--remote\` having made this gate do network I/O: it
tears the process down while sockets close and exits 127 under a clean table. It is a RACE,
which is worse than a consistent failure because \`check-all.mjs\` reads exit codes.`,
  ],
};
