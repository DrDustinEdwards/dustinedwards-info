// Chunk 12: check-image-weight 0-24, check-migrations 0-23, lib/uptimerobot 0-16,
// lib/route-render 0-30.
//
// Wave 1's rule. Two files here argue for a MEASURE rather than a threshold, and both arguments
// stay because the measure is the whole design: bytes per delivered pixel rather than raw bytes,
// and the chunk type rather than a byte ceiling. Their tables of measurements go.
//
// uptimerobot is the wave's one third-party contract. Every value in it was read off the API by
// sending invalid requests, which is fixture independence applied to somebody else's service,
// and that survives as the rule while the verbatim error messages go.
export default {
  "scripts/check-image-weight.mjs#0": [
    "CONTRACT",
    "the four assertions, why no thresholds, why bytes per pixel, why delivered dimensions and why two floors; the defect's byte table, the ladder table and the dated measurements go to the history document",
    `Every image byte this site derives through the Images binding must be LOSSY, and the transform
ladder must be SHAPED like a transform ladder.

  node scripts/check-image-weight.mjs [--base <origin>]

THE DEFECT: the binding defaults to LOSSLESS, and the transform route asked for no quality, so
every rung came back lossless WebP and every rung was heavier than the object it resizes, which
inverts the whole purpose of \`srcset\` and bills a transformation for the privilege.

FOUR ASSERTIONS, AND NONE OF THEM CARRIES A NUMBER, because a tuned constant here would be a
second owner of a value that belongs to the image:

  1. Every rung is lossy, by CHUNK TYPE. The defect verbatim, and it needs no threshold.
  2. Bytes per delivered pixel never rises as delivered pixels rise, equality allowed.
  3. The narrowest rung is smaller than the origin, which catches serving the original
     unresized under a width parameter.
  4. Every STORED placeholder is lossy, from the index rather than the wire.

RAW BYTES WAS THE FIRST RULING AND THE MEASUREMENT CHANGED IT. Two things fire a raw-byte rule
on correct output: a rung can be BIGGER than the origin, because re-encoding costs more than a
source compressed harder, and a rung past the source width is capped and becomes a native-size
re-encode, so it is SMALLER than the rung below it. Bytes per pixel falls monotonically through
both, which is what separates the two cases without a threshold.

DELIVERED DIMENSIONS, NEVER THE REQUESTED WIDTH, read out of the response body's own header: a
ladder ordered by requested width would compare two rungs that are the same size. Rungs with
EQUAL delivered pixels are not compared at all, since otherwise the verdict would depend on sort
stability.

TWO FLOORS rather than one, because the subjects are selected by different queries: a bucket
full of gradeable ladders satisfies the first while the placeholder column is empty, and one
floor covering both would be satisfied by either.`,
  ],
  "scripts/check-image-weight.mjs#2": [
    "CONTRACT",
    "why D1 holds the key set and why one command string",
    `One read against the media index. \`wrangler r2 object\` has no \`list\` verb, which is why every
reconciliation in this repo reads D1 for the key set.

ONE COMMAND STRING, not an argv array: with \`shell: true\` an argument carrying spaces is split
before wrangler sees it, and the SQL arrives as a pile of positional arguments.

@param {string} sql a SELECT, inlined so the repo's own hook can read it`,
  ],
  "scripts/check-image-weight.mjs#3": ["WHY", "why trashed rows are excluded; two lines already"],
  "scripts/check-image-weight.mjs#4": [
    "WHY",
    "why it is not narrowed to one tier",
    `EVERY STORED PLACEHOLDER, whatever tier produced it, and the width is the assertion rather
than a convenience: the deriving function runs over R2 objects and over static files in the same
rebuild, so a defect in it reaches both tiers at once and a query that looked at one would report
the other clean without examining it.`,
  ],
  "scripts/check-image-weight.mjs#5": [
    "CONTRACT",
    "what decides the verdict and why the mime column cannot",
    `What a raster buffer IS, read from the container rather than from a mime column or a file
extension: a WebP's image data lives in a different chunk when lossy than when lossless, and an
extended header carries neither and must be walked past. The stored mime answers the same string
for both, which is precisely the distinction assertion 1 exists to make.

Dimensions come from the same parse, because the delivered size is what assertion 2 orders by.

@param {Buffer} buf
@returns {{ codec: string, lossy: boolean | null, width: number | null, height: number | null }}`,
  ],
  "scripts/check-image-weight.mjs#6": ["CONTRACT", "which chunks carry no verdict, and the padding; two lines already"],
  // Kept byte-identical: one @param line carries a wide array type already past the
  // 110-column limit, and the type cannot wrap without the JSDoc head resolving to a bare tag.
  "scripts/check-image-weight.mjs#7": ["CONTRACT", "why the function is pure; already at the column limit"],
  "scripts/check-image-weight.mjs#9": ["CONTRACT", "assertion 1; one line already"],
  "scripts/check-image-weight.mjs#10": ["CONTRACT", "assertion 2; one line already"],
  "scripts/check-image-weight.mjs#11": ["WHY", "why equal pixel counts are skipped; two lines already"],
  "scripts/check-image-weight.mjs#12": ["CONTRACT", "assertion 3; one line already"],
  "scripts/check-image-weight.mjs#14": [
    "CONTRACT",
    "the two artifacts, why pure and why the chunk type rather than a ceiling; the second call site and the ratio go to the history document",
    `THE FOURTH ASSERTION, over a STORED placeholder rather than a served rung.

TWO ARTIFACTS SATISFY THIS ONE FUNCTION: the column in D1, swept below, and the map in the asset
manifest, which another gate checks by importing this. One statement of what a placeholder IS,
because a second copy is how the two would come to disagree about the defect they were both
written for.

THE DEFECT: the same missing quality at the OTHER call site, in the rebuild rather than the
route, where nothing was watching it at all, so every stored placeholder is a lossless data URI
in a column that exists to hold something small enough to inline.

PURE for the same reason as the ladder's: the replay feeds it a placeholder read out of the live
index BEFORE the fix and watches it name the defect, because a gate whose red case can only be
produced by breaking production is a gate nobody proves.

NO THRESHOLD, AGAIN: the assertion is the CHUNK TYPE. The prefix is asserted too, because a row
holding something that is not a WebP data URI would otherwise decode to garbage and be reported
as an unknown codec rather than as a wrong column.

@param {string} key
@param {string} placeholder the stored data URI
@returns {string[]} problems`,
  ],
  "scripts/check-image-weight.mjs#19": [
    "WHY",
    "why a lossless origin is skipped",
    `A LOSSLESS ORIGIN IS SKIPPED, and the restriction is the point: a PNG re-encoded to WebP can
legitimately grow or shrink, so every assertion here would be a coin toss, and a gate that fails
at random gets turned off. A lossy origin has already paid the compression cost.`,
  ],
  "scripts/check-image-weight.mjs#21": [
    "WHY",
    "what an empty sweep prints",
    `THE FLOOR. Zero examined rows and zero problems produce the same output, and the whole point
of this gate is that nobody was watching the thing it measures.`,
  ],
  "scripts/check-image-weight.mjs#22": [
    "CONTRACT",
    "section marker plus why the bytes are the stored ones",
    `4. EVERY STORED PLACEHOLDER IS LOSSY. Read out of the index rather than off the wire, because
a placeholder is not served: it is a column, inlined into whatever renders it.`,
  ],
  "scripts/check-image-weight.mjs#23": [
    "WHY",
    "why the ladder's floor does not cover this",
    `ITS OWN FLOOR, because the ladder query and this one select different rows: a full bucket can
satisfy the first while this one examines nothing, and an empty column and a clean column print
the same line.`,
  ],
  "scripts/check-image-weight.mjs#24": ["CONTRACT", "why it is importable; one line already"],
  "scripts/check-migrations.mjs#0": [
    "CONTRACT",
    "both boundary halves, why normalized content and why rule 12 cannot be satisfied; the CRLF discovery and the backlog reference go to the history document",
    `Gate: an applied migration is never edited.

  npm run check:migrations
  node scripts/check-migrations.mjs --write [--force]

BOUNDARY: **IT PROVES THE FILES MATCH THE MANIFEST. Nothing more.** It does NOT prove the
manifest was honest when written; what stops that is the diff, which shows both changes, and
\`--write\` refusing to alter an existing hash without \`--force\`. It does NOT know what the LIVE
database applied, which is \`check:invariants --remote\`'s half.

IT HASHES NORMALIZED CONTENT, NOT RAW BYTES, and that was learned the hard way: with autocrlf
on, the working tree and its own committed blobs disagree about line endings, so a raw-byte
manifest is valid only on the machine that wrote it and fails against every fresh checkout.
CRLF is collapsed before hashing, so the hash is a property of the CONTENT.

WHY IT EXISTS: hard rule 14. The section that replays migrations into an empty database catches
an edit that MOVES A COLUMN and nothing else, so editing seed data, an index, a trigger or FTS
DDL inside an applied file is invisible to every other gate.

**RULE 12 CANNOT BE SATISFIED HERE, and that is stated rather than papered over.** A new gate is
tested by replaying the defect it was written for, and no such defect exists: no migration here
has ever been edited after being applied. So this is verified by PLANTS ONLY, which that rule
warns are written to match the implementation rather than the bug.`,
  ],
  "scripts/check-migrations.mjs#1": [
    "NUMBER",
    "what the floor protects; both dated counts go to the history document",
    `Below this the directory is not a migrations directory and something is wrong. The earlier
value could not notice a third of it being deleted, and the first migration is the only copy of
the CREATE TABLE statements that exists anywhere.`,
  ],
  "scripts/check-migrations.mjs#3": [
    "CONTRACT",
    "why normalized, in two lines",
    `The migration's CONTENT, with CRLF collapsed: with autocrlf on, a working tree and its own
committed blobs disagree on line endings, so a raw-byte manifest is only valid on the machine
that wrote it.

@param {string} file`,
  ],
  "scripts/check-migrations.mjs#4": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-migrations.mjs#5": [
    "WHY",
    "why this scope floor is in the meta-gate and why it still exits hard, with its citation",
    `THROUGH assertFloor. Migrations are append-only, so this is the purest growing
set in the repo: the count can only climb and a floor left alone goes slack on its own. As a
bare early exit it printed no floor line and the meta-gate could not see the gap.

STILL A HARD EXIT rather than a counted assertion, because everything below reads these files
and continuing past a truncated directory would measure a corpus that is not there.`,
  ],
  "scripts/check-migrations.mjs#6": ["CONTRACT", "section marker, rule padding cut", `generator`],
  "scripts/check-migrations.mjs#9": [
    "WHY",
    "why a changed hash needs a flag and a new file does not",
    `REFUSES TO LAUNDER AN EDIT. Regenerating is the obvious way to make this gate green after
editing an applied migration, so a hash that CHANGES needs \`--force\`, which puts the decision in
the command line and therefore in the shell history and the reviewer's question. Adding a NEW
file needs nothing.`,
  ],
  "scripts/check-migrations.mjs#10": ["CONTRACT", "section marker, rule padding cut", `the checking`],
  "scripts/check-migrations.mjs#12": ["CONTRACT", "direction 1; one line already"],
  "scripts/check-migrations.mjs#13": ["CONTRACT", "direction 2; one line already"],
  "scripts/check-migrations.mjs#14": ["CONTRACT", "section marker, rule padding cut", `ship refuses on a pending migration`],
  "scripts/check-migrations.mjs#15": [
    "WHY",
    "why the obligation exists, why it lives in this gate and the boundary; the window number, the migration's name and the lag go to the history document",
    `**AUTHORING A MIGRATION MUST CREATE AN OBLIGATION SOMEWHERE, AND THIS IS IT.** A ship deployed
with every offline gate green and the media admin page returned a 500 on its first load, because
a migration had been pending on the remote database since the session that authored it: the
columns did not exist and every loader query threw.

THIS SECTION BELONGS HERE rather than in a gate of its own, and that is a judgement worth
stating. What this gate owns is the MIGRATION CONTRACT, and "a migration that exists in the repo
must be applied before the code that needs it deploys" is a clause of that same contract.

SOURCE LEVEL, and the boundary is real: it reads what ship DECLARES. It cannot run ship and must
not, because the ship-guard law is that a deploy guard is proven on its PREDICATE IN ISOLATION,
never by invoking the deploy.`,
  ],
  "scripts/check-migrations.mjs#16": ["CONTRACT", "one owner; one line already"],
  "scripts/check-migrations.mjs#17": ["WHY", "the prose trap and its victims; two lines already"],
  "scripts/check-migrations.mjs#18": [
    "WHY",
    "why position and why the crudeness is right",
    `ORDERING, which is the half a presence check cannot see: a guard that runs AFTER the deploy is
not a guard, it is a report. The index comparison is crude and it is the right crudeness, since
it reads the position of the guard's own announce against the deploy's and moving either fails.`,
  ],
  "scripts/check-migrations.mjs#19": ["CONTRACT", "section marker, rule padding cut", `the LOCAL tier's ledger, when there is one to read`],
  "scripts/check-migrations.mjs#20": [
    "WHY",
    "why the blind spot was structural, why read directly, the three states and why names; the lag's duration goes to the history document",
    `**NOTHING READ THE LOCAL DATABASE, AND THAT IS WHY IT SAT TWO MIGRATIONS BEHIND.** The blind
spot was structural: this gate hashes FILES and never opened a database, and the gate that does
compare against one is remote-gated and builds its third source by REPLAYING the same files, so
it agrees with them by construction. Every instrument read the files or read production.

READ DIRECTLY, NOT THROUGH WRANGLER, AND THE REASON IS A SIDE EFFECT: \`wrangler d1 execute
--local\` CREATES the local database when it is absent, and a gate that brings its own subject
into existence cannot report on it. Opened READ ONLY, the path another gate already uses.

A MISSING DATABASE IS NOT A LAGGING ONE, and conflating them would put a false red on every
fresh checkout and on CI. Three states, and only the third can fail: no file at all, a file with
no ledger (created lazily, indistinguishable from a first run), and a file WITH a ledger.

**THE SKIP EMITS NO ASSERTION ON PURPOSE**, so the executed count is lower on CI than on a
developer machine and the floor below is set for the CI case: a skip that counted would make the
floor mean different things in different environments.

NAMES, NOT A COUNT, for the same cost: a count passes when a file is renamed, or when the ledger
holds the right number of rows that are not these rows.`,
  ],
  "scripts/check-migrations.mjs#21": ["CONTRACT", "what it answers and what null means; one line already"],
  "scripts/check-migrations.mjs#22": ["WHY", "the zero-scope arm; two lines already"],
  "scripts/check-migrations.mjs#23": [
    "NUMBER",
    "what this floors that the scope floor cannot, and why the environment matters, with its citation; both measured counts go to the history document",
    `EXECUTED-COUNT FLOOR. The scope floor above catches a directory that stopped being read; this
catches an assertion block that stopped running over a directory that is still full, and neither
can see the other's bug.

MEASURED BY RUNNING IT, both cases, and never summed. **THE COUNT DEPENDS ON THE ENVIRONMENT
and the floor is set for the lower one**, which is the half that would otherwise bite CI: the
ledger section skips and emits no assertion where there is no local database. The count steps by
a fixed amount per migration, which is append-only by hard rule 14.`,
  ],
  "scripts/lib/uptimerobot.mjs#0": [
    "CONTRACT",
    "why one module, that the contract was measured from the API, and the rate limit; the verbatim validation errors and the endpoint inventory go to the history document",
    `The UptimeRobot v3 contract, in one place, shared by the writer and the gate. Both need the
same base URL, the same auth header, the same monitor SHAPES and the same idea of what "paused"
is, and a second copy of any of those is the drift rule 17 exists about.

EVERY VALUE BELOW WAS MEASURED, NOT READ OFF A BLOG POST. The v3 documentation page is a
client-side application that returns no specification to a fetch and every obvious
specification path answers 404, so the contract was taken from the API itself by sending
deliberately invalid requests and reading the validation errors back. That is fixture
independence applied to a third party: the expectations come from the service, not from a
description of it.

Two shapes worth carrying here because they are counter-intuitive: a keyword monitor is its own
TYPE rather than an HTTP monitor carrying a keyword, and \`status\` is NOT writable through the
update verb, so pausing and resuming are their own endpoints.

THE RATE LIMIT IS REAL AND IT IS SMALL. The writer spends a handful of requests in a run and the
gate spends few; neither loops and nothing retries tightly, because a monitoring integration that
gets itself throttled reports nothing.`,
  ],
  "scripts/lib/uptimerobot.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/lib/uptimerobot.mjs#2": [
    "WHY",
    "why the constant is here and why beside its consumers",
    `Where the monitor ids are recorded. IT LIVES HERE because both the writer and the gate need
it, and the writer is a PROGRAM: importing a constant out of it would run it, so the gate would
create monitors as a side effect of checking them.

Beside its two consumers rather than with the things the SITE reads, on the precedent that a
manifest sits with the thing it describes.`,
  ],
  "scripts/lib/uptimerobot.mjs#3": [
    "WHY",
    "why not-paused rather than up",
    `THE GATE ASSERTS NOT-PAUSED RATHER THAN UP, and the difference is the whole point: a DOWN
monitor is one doing its job and reporting an outage, so a gate demanding UP would go red for the
site being down, which is the monitor's job to say and not the gate's. What this owns is whether
the instrument exists, is switched on, and is pointed at the right host.`,
  ],
  "scripts/lib/uptimerobot.mjs#4": [
    "CONTRACT",
    "what a failure may report",
    `One authenticated call. NEVER INTERPOLATES THE KEY INTO A MESSAGE: on a failure the status and
the response body are reported, and the body is the API's own error text, which echoes the
offending FIELDS and never the bearer token.

@param {string} key
@param {string} path path under the v3 base, leading slash
@param {{ method?: string, body?: unknown }} [options]
@returns {Promise<{ ok: boolean, status: number, body: any, text: string }>}`,
  ],
  "scripts/lib/uptimerobot.mjs#5": ["CONTRACT", "one line already; kept"],
  "scripts/lib/uptimerobot.mjs#6": [
    "WHY",
    "what a first-page read would conclude in each direction",
    `PAGINATES RATHER THAN TAKING THE FIRST PAGE. A gate that read one page and concluded a monitor
was missing would fail for the wrong reason the day the account grows past the page size, and one
that concluded a DUPLICATE was absent would let the writer create a second copy on every run. The
loop is bounded so a server that never stops advancing cannot spin.

@param {string} key
@returns {Promise<Array<Record<string, any>>>}`,
  ],
  "scripts/lib/uptimerobot.mjs#7": [
    "WHY",
    "that the two views are independent, and which direction is dangerous; the polling timeline and the date go to the history document",
    `THE LIST ENDPOINT IS NOT A RELIABLE READ OF A MONITOR'S STATUS. Immediately after a resume the
addressed read and the list answered DIFFERENTLY for the same monitor at the same moment, and
they did not converge monotonically: they are two independently updated views, not one view with
a delay.

**THE DANGEROUS DIRECTION IS THE REASON THIS EXISTS.** A gate reading the list would report a
stale status for tens of seconds after a change, which includes reporting NOT PAUSED for a
monitor somebody has just switched off, and a monitoring gate whose failure mode is a false green
is worse than no gate. So every monitor is read by id, at one request each against an allowance
that can carry it.

Returns \`null\` for 404, which is a monitor that is GONE rather than an error.

@param {string} key
@param {number|string} id
@returns {Promise<Record<string, any> | null>}`,
  ],
  "scripts/lib/uptimerobot.mjs#8": [
    "WHY",
    "who owns the host, why the keyword is the longer string and that the status code is a second signal; the body shapes go to the history document",
    `The monitor shapes this repo asks for, derived from one origin. **\`SITE_ORIGIN\` IS THE ONE
OWNER OF THE HOST**, which is why ship calls the writer rather than somebody editing a dashboard
field twice.

THE KEYWORD IS THE FULL OPENING FRAGMENT, AND THE BARE WORD WOULD HAVE FAILED OPEN. The health
endpoint answers the SAME BODY SHAPE for every verdict, so the word appears in every response it
can produce and a monitor keyed on it is green while the site is failing; even the word with its
true value appears inside the per-check array when the top-level verdict is false. Only the
leading fragment discriminates, which is a real coupling to the order that builder writes its
keys in and is stated here rather than left to be discovered.

**AND IT IS NOT THE ONLY SIGNAL**: the accepted status codes exclude the code that route answers
for a failing check, so two independent mechanisms have to both miss.

@param {string} origin SITE_ORIGIN, no trailing slash
@returns {Array<{ path: string, key: string, shape: Record<string, unknown> }>}`,
  ],
  "scripts/lib/uptimerobot.mjs#9": [
    "WHY",
    "why the trailing slash matters; the dry-run output and its date go to the history document",
    `NO TRAILING SLASH, and that is an idempotency fix rather than a preference: the account stored
the origin without one and asking for it with one reported an update against a monitor that was
already correct, so every run would have written a monitor that needed nothing.`,
  ],
  "scripts/lib/uptimerobot.mjs#10": [
    "WHY",
    "why the two monitors differ here",
    `3xx IS ALLOWED HERE AND NOT ON HEALTH. The home page is the URL a reader types and the cutover
puts a redirect in front of it, so a monitor that reddened on a legitimate redirect would be
retired for crying wolf. The health endpoint has no reason to redirect ever.`,
  ],
  "scripts/lib/uptimerobot.mjs#11": [
    "WHY",
    "why a subset; the example field names go to the history document",
    `A SUBSET, DELIBERATELY. The API returns dozens of fields, most of them defaults this repo has
no opinion about, and comparing all of them would make the gate red the day UptimeRobot adds one,
which teaches everybody to ignore it. These decide whether the monitor is watching the right
thing in the right way.`,
  ],
  "scripts/lib/uptimerobot.mjs#12": [
    "WHY",
    "the asymmetry, what it costs each consumer and that both values were measured; the field names, the values and the dates go to the history document",
    `Fields the API ACCEPTS in one representation and RETURNS in another.

THE DEFECT THIS EXISTS FOR, caught by running the thing twice: one field is written as a string
the API refuses any other spelling of, and read back as a number. So a comparison of
what-was-asked-for against what-is-stored reports drift on a monitor that is exactly right,
forever.

That is not cosmetic in either consumer. The writer would update on every single run, which is
the precise opposite of idempotent, and the gate would be PERMANENTLY RED on a correct monitor,
which is a gate everybody learns to ignore.

BOTH VALUES WERE MEASURED, NOT INFERRED FROM THE FIRST, by writing each and reading it back:
filling in the second on the strength of having seen the first would have been a guess in a table
whose whole job is to be right. Every other compared field round-trips identically, verified in
the same read.`,
  ],
  "scripts/lib/uptimerobot.mjs#13": [
    "CONTRACT",
    "one function for both consumers, with its citation",
    `What the API will RETURN for a field this repo asked to be \`value\`. ONE FUNCTION, BOTH
CONSUMERS: the writer decides whether to update and the gate decides whether to fail, and if the
two disagreed about what "in step" means then one would be wrong on every run. Hard rule 17.

@param {string} field
@param {unknown} value the value this repo writes
@returns {unknown} the value the API is expected to return`,
  ],
  "scripts/lib/uptimerobot.mjs#15": [
    "WHY",
    "why unchanged rather than undefined, with its citation",
    `A value with no mapping falls through UNCHANGED rather than to undefined: a new enum member
should surface as a visible mismatch naming both sides, not as a comparison against nothing.
Hard rule 13.`,
  ],
  "scripts/lib/uptimerobot.mjs#16": ["CONTRACT", "what it answers; already short"],
  "scripts/lib/route-render.mjs#0": [
    "CONTRACT",
    "why it exists, what the stubbing limits it to and what the second consumer brought; the redesign framing goes to the history document",
    `Renders route components to static HTML in Node, so a gate can read the markup they actually
produce.

WHY IT EXISTS: /admin sits behind a real session, so no gate can reach those pages over HTTP,
and the property that matters most is invisible to a typecheck. A route may move a control
anywhere it likes, but it may not change WHAT PRESSING IT SENDS, and that is a fact about
rendered markup.

The route modules import server-only code at the top level for their loaders and actions. None
of it runs during a render, so it is stubbed at resolve time rather than executed, and that is a
deliberate limit worth stating: this harness proves things about COMPONENTS and nothing about
loaders, actions, or anything server-side.

TWO GATES USE IT, because a microformats class is the same kind of fact in a different disguise.
The alternative was a second copy of the bundler, which is how the two would have come to
disagree about what a stub is. The public routes brought one requirement the admin routes did
not, which is the \`?url\` sentinel below.`,
  ],
  "scripts/lib/route-render.mjs#1": [
    "WHY",
    "why it is exported and why it is implausible",
    `What a Vite \`?url\` import resolves to inside this harness. Exported so a gate can ASSERT on it
rather than discovering it as a surprising \`src\` in a diff, and deliberately not a plausible
path: a sentinel that looked like a real asset URL is one somebody would eventually compare
against a real asset URL.`,
  ],
  "scripts/lib/route-render.mjs#2": ["CONTRACT", "how the alias resolves; two lines already"],
  "scripts/lib/route-render.mjs#3": [
    "CONTRACT",
    "why the stub is CJS",
    `Bundles route modules for Node with their server-only imports stubbed. The stub is a CJS Proxy
rather than an ES module, because an ES stub has to declare every named export the importer asks
for and the importers ask for dozens; interop gives every name back as a no-op, which is enough,
since nothing here is called.

@param {string[]} entries repo-relative module paths
@returns {Promise<{ outDir: string, files: string[], cleanup: () => Promise<void> }>}`,
  ],
  "scripts/lib/route-render.mjs#4": [
    "WHY",
    "why inside the repo",
    `Inside the repo, NOT the OS temp directory: react and react-router stay external so the
components share the harness's instances, and a bare specifier only resolves if Node can walk up
into this repo's node_modules, which it cannot do from a temp path.`,
  ],
  "scripts/lib/route-render.mjs#6": ["CONTRACT", "which surfaces are stubbed; two lines already"],
  "scripts/lib/route-render.mjs#7": ["CONTRACT", "why the specifier still needs resolving; two lines already"],
  "scripts/lib/route-render.mjs#8": [
    "WHY",
    "why esbuild refuses it, why not a build product and what the sentinel costs",
    `VITE'S \`?url\` SUFFIX, which esbuild does not speak: it reads that as part of the FILENAME and
refuses. Teaching it to strip the suffix would not help, because several of those files do not
exist until the enhancement build has run, and a gate that only runs after a build is a gate that
does not run on a fresh checkout.

So the suffix resolves to the SENTINEL, and what that costs is stated rather than left to be
discovered: the rendered \`src\` is that string and not the hashed asset path, so NO GATE USING
THIS HARNESS MAY ASSERT ANYTHING ABOUT AN ENHANCEMENT URL. What survives here is the script TAG's
existence and every attribute the component writes itself.`,
  ],
  "scripts/lib/route-render.mjs#9": ["CONTRACT", "why they stay external; two lines already"],
  "scripts/lib/route-render.mjs#10": ["CONTRACT", "why the banner is needed; already short"],
  "scripts/lib/route-render.mjs#11": ["CONTRACT", "what the options are; already short"],
  "scripts/lib/route-render.mjs#13": [
    "WHY",
    "why client state must be seedable and why not through loader data; the session reference goes to the history document",
    `DECLARED INITIAL CLIENT STATE, spread last so a state declaration can seed a route's own
\`useState\`. The harness renders ONE static pass and never dispatches an event, so any UI behind
client state is invisible however the fixture is regenerated, and an admin mutation surface the
gate cannot see is the whole class this exists to close.

The route takes an OPTIONAL prop with a production default, so the router never supplies it and
shipped behaviour is unchanged. Seeding from loader data was the alternative and is worse: it
would put a field in the server contract that no loader returns, and policing that contract is
what the gate is for.`,
  ],
  "scripts/lib/route-render.mjs#17": [
    "CONTRACT",
    "which fields are contractual and why the rest are not",
    `Fields whose VALUE the UI decides, so the value is part of the contract: the publish state
reduced to one key, the flag that picks the create path over the edit path, and the server-owned
facts the form carries back untouched. Everything else in the payload is the author's content,
and recording its value would make the fixture a copy of the test data.`,
  ],
  "scripts/lib/route-render.mjs#18": [
    "CONTRACT",
    "what a form's identity is and why disabled controls are excluded",
    `Every request the rendered page can submit, as a stable shape. A form's identity is (action,
method, intent, field names), which is exactly the tuple the server reads, so two markups with
the same tuple set send the same thing however they are laid out.

A DISABLED control submits nothing, and that is load bearing rather than a detail: it is how the
editor reproduces a checkbox's "absent when unticked" without a checkbox.

@param {string} html
@returns {Array<{ action: string, method: string, intent: string, fields: string[] }>}`,
  ],
  "scripts/lib/route-render.mjs#20": [
    "WHY",
    "why the attribute comes first and why a flat scan suffices",
    `Form ownership is by the \`form\` ATTRIBUTE first and containment second, which is how a browser
resolves it: modelling only containment would be a lie the moment a control sits outside the form
it submits, and the editor has exactly that case. Forms cannot nest, so a flat scan is enough.`,
  ],
  "scripts/lib/route-render.mjs#24": ["WHY", "why disabled controls are skipped; already short"],
  "scripts/lib/route-render.mjs#25": [
    "WHY",
    "why an unchecked box is what makes the field honest",
    `An UNCHECKED checkbox is not submitted either, and modelling that is what makes the publish
field honest: the checkbox era sent it on a draft and sent no key at all on a published post, so a
baseline listing the field unconditionally would record a payload the browser never sends and then
demand the redesign reproduce it.`,
  ],
  "scripts/lib/route-render.mjs#26": [
    "WHY",
    "why the split is by name, and what a valueless checkbox sends",
    `For a few fields the VALUE is the contract; for the rest only the name is. THE SPLIT IS BY
FIELD NAME, NOT BY WIDGET TYPE: keying it on the input type was the obvious first cut and was
wrong, because moving a field from a text input to a hidden one driven by a picker changes the
widget and nothing about the request. What is contractual is the set of fields the UI decides on
the author's behalf.

A checkbox with no \`value\` submits the string "on" per the HTML spec, and React renders no value,
so reading the attribute literally would record an empty string while the browser sends "on".`,
  ],
  "scripts/lib/route-render.mjs#28": ["CONTRACT", "one line already; kept"],
  "scripts/lib/route-render.mjs#29": ["CONTRACT", "one line already; kept"],
  "scripts/lib/route-render.mjs#30": [
    "WHY",
    "why distinct",
    `DISTINCT, deliberately: the contract is which requests a page can issue, not how many controls
offer each one, and counting duplicates would make the gate object to layout, which is the one
thing a redesign is allowed to change.`,
  ],
};
