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
    `Gate: every image byte derived through the Images binding is LOSSY, and the transform ladder is
shaped like one.

  node scripts/check-image-weight.mjs [--base <origin>]

BOUNDARY: four assertions over what the route actually served plus the stored placeholders, and
NONE of them carries a number, a tuned constant being a second owner of a value that belongs to
the image. It reads delivered dimensions out of each body, never the requested width.`,
  ],
  "scripts/check-image-weight.mjs#2": [
    "CONTRACT",
    "why D1 holds the key set and why one command string",
    `One read against the media index: \`wrangler r2 object\` has no \`list\` verb, which is why every
reconciliation here reads D1 for the key set. ONE COMMAND STRING, not an argv array: with
\`shell: true\` the SQL arrives as a pile of positional arguments.

@param {string} sql a SELECT, inlined so the repo's own hook can read it`,
  ],
  "scripts/check-image-weight.mjs#3": ["WHY", "why trashed rows are excluded; two lines already"],
  "scripts/check-image-weight.mjs#4": [
    "WHY",
    "why it is not narrowed to one tier",
    `EVERY STORED PLACEHOLDER, whatever tier produced it: the deriving function runs over R2 objects
and static files in one rebuild, so a defect reaches both tiers and a query looking at one would
report the other clean.`,
  ],
  "scripts/check-image-weight.mjs#5": [
    "CONTRACT",
    "what decides the verdict and why the mime column cannot",
    `What a raster buffer IS, read from the container rather than a mime column: a WebP's image data
lives in a different chunk when lossy, and an extended header carries neither. The stored mime
answers the same string for both, which is the distinction assertion 1 exists to make.

@param {Buffer} buf
@returns {{ codec: string, lossy: boolean | null, width: number | null, height: number | null }}`,
  ],
  "scripts/check-image-weight.mjs#6": ["CONTRACT", "which chunks carry no verdict, and the padding; two lines already"],
  "scripts/check-image-weight.mjs#7": ["CONTRACT", "why the function is pure; already at the column limit"],
  "scripts/check-image-weight.mjs#9": ["CONTRACT", "assertion 1; one line already"],
  "scripts/check-image-weight.mjs#10": ["CONTRACT", "assertion 2; one line already"],
  "scripts/check-image-weight.mjs#11": ["WHY", "why equal pixel counts are skipped; two lines already"],
  "scripts/check-image-weight.mjs#12": ["CONTRACT", "assertion 3; one line already"],
  "scripts/check-image-weight.mjs#14": [
    "CONTRACT",
    "the two artifacts, why pure and why the chunk type rather than a ceiling; the second call site and the ratio go to the history document",
    `THE FOURTH ASSERTION, over a STORED placeholder rather than a served rung. TWO ARTIFACTS SATISFY
THIS ONE FUNCTION, the D1 column and the asset manifest's map, because a second copy is how the
two would disagree about the defect they were both written for. THE DEFECT: the same missing
quality in the rebuild rather than the route, where nothing was watching. PURE, so the replay
can feed it a placeholder read out of the live index BEFORE the fix: a gate whose red case can
only be produced by breaking production is a gate nobody proves. NO THRESHOLD: the assertion is
the CHUNK TYPE, and the prefix too, or a wrong column decodes to garbage.

@param {string} key
@param {string} placeholder the stored data URI
@returns {string[]} problems`,
  ],
  "scripts/check-image-weight.mjs#19": [
    "WHY",
    "why a lossless origin is skipped",
    `A LOSSLESS ORIGIN IS SKIPPED, and the restriction is the point: a PNG re-encoded to WebP can
legitimately grow or shrink, and a gate that fails at random gets turned off.`,
  ],
  "scripts/check-image-weight.mjs#21": [
    "WHY",
    "what an empty sweep prints",
    `THE FLOOR: zero examined rows and zero problems produce the same output, and nobody was
watching the thing this measures.`,
  ],
  "scripts/check-image-weight.mjs#22": [
    "CONTRACT",
    "section marker plus why the bytes are the stored ones",
    `4. EVERY STORED PLACEHOLDER IS LOSSY, read out of the index rather than off the wire: a
placeholder is a column, inlined into whatever renders it.`,
  ],
  "scripts/check-image-weight.mjs#23": [
    "WHY",
    "why the ladder's floor does not cover this",
    `ITS OWN FLOOR: a full bucket satisfies the ladder query while this one examines nothing, and an
empty column and a clean column print the same line.`,
  ],
  "scripts/check-image-weight.mjs#24": ["CONTRACT", "why it is importable; one line already"],
  "scripts/check-migrations.mjs#0": [
    "CONTRACT",
    "both boundary halves, why normalized content and why rule 12 cannot be satisfied; the CRLF discovery and the backlog reference go to the history document",
    `Gate: an applied migration is never edited, which is hard rule 14.

  npm run check:migrations
  node scripts/check-migrations.mjs --write [--force]

BOUNDARY: **IT PROVES THE FILES MATCH THE MANIFEST. Nothing more.** It does not prove the
manifest was honest when written, and it does not know what the LIVE database applied, which is
\`check:invariants --remote\`'s half.`,
  ],
  "scripts/check-migrations.mjs#1": [
    "NUMBER",
    "what the floor protects; both dated counts go to the history document",
    `Below this the directory is not a migrations directory. The earlier value could not notice a
third of it being deleted, and the first migration is the only copy of the CREATE TABLEs.`,
  ],
  "scripts/check-migrations.mjs#3": [
    "CONTRACT",
    "why normalized, in two lines",
    `The migration's CONTENT, with CRLF collapsed: with autocrlf on, a working tree and its own
committed blobs disagree, so a raw-byte manifest is valid only where it was written.

@param {string} file`,
  ],
  "scripts/check-migrations.mjs#4": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-migrations.mjs#5": [
    "WHY",
    "why this scope floor is in the meta-gate and why it still exits hard, with its citation",
    `THROUGH assertFloor: migrations are append-only, the purest growing set in the repo, so a floor
left alone goes slack on its own. STILL A HARD EXIT rather than a counted assertion, because
continuing past a truncated directory would measure a corpus that is not there.`,
  ],
  "scripts/check-migrations.mjs#6": ["CONTRACT", "section marker, rule padding cut", `generator`],
  "scripts/check-migrations.mjs#9": [
    "WHY",
    "why a changed hash needs a flag and a new file does not",
    `REFUSES TO LAUNDER AN EDIT: regenerating is the obvious way to make this gate green, so a hash
that CHANGES needs \`--force\`, which puts the decision in the shell history. A NEW file needs
nothing.`,
  ],
  "scripts/check-migrations.mjs#10": ["CONTRACT", "section marker, rule padding cut", `the checking`],
  "scripts/check-migrations.mjs#12": ["CONTRACT", "direction 1; one line already"],
  "scripts/check-migrations.mjs#13": ["CONTRACT", "direction 2; one line already"],
  "scripts/check-migrations.mjs#14": ["CONTRACT", "section marker, rule padding cut", `ship refuses on a pending migration`],
  "scripts/check-migrations.mjs#15": [
    "WHY",
    "why the obligation exists, why it lives in this gate and the boundary; the window number, the migration's name and the lag go to the history document",
    `**AUTHORING A MIGRATION MUST CREATE AN OBLIGATION SOMEWHERE, AND THIS IS IT.** A ship deployed
with every offline gate green and the media admin page 500d on first load, a migration having
been pending on the remote database since the session that authored it. THIS SECTION BELONGS
HERE: what this gate owns is the MIGRATION CONTRACT, and "a migration in the repo is applied
before the code that needs it deploys" is a clause of it. SOURCE LEVEL: it reads what ship
DECLARES, and must not run ship, a deploy guard being proven on its PREDICATE IN ISOLATION.`,
  ],
  "scripts/check-migrations.mjs#16": ["CONTRACT", "one owner; one line already"],
  "scripts/check-migrations.mjs#17": ["WHY", "the prose trap and its victims; two lines already"],
  "scripts/check-migrations.mjs#18": [
    "WHY",
    "why position and why the crudeness is right",
    `ORDERING, the half a presence check cannot see: a guard that runs AFTER the deploy is a report.
The index comparison is crude and it is the right crudeness, moving either end failing it.`,
  ],
  "scripts/check-migrations.mjs#19": ["CONTRACT", "section marker, rule padding cut", `the LOCAL tier's ledger, when there is one to read`],
  "scripts/check-migrations.mjs#20": [
    "WHY",
    "why the blind spot was structural, why read directly, the three states and why names; the lag's duration goes to the history document",
    `**NOTHING READ THE LOCAL DATABASE, AND THAT IS WHY IT SAT TWO MIGRATIONS BEHIND.** The blind
spot was structural: this gate hashes FILES, and the gate that does compare against a database
is remote-gated and builds its third source by REPLAYING the same files. READ DIRECTLY, NOT
THROUGH WRANGLER: \`d1 execute --local\` CREATES the local database when absent, and a gate that
brings its own subject into existence cannot report on it. Opened READ ONLY. A MISSING DATABASE
IS NOT A LAGGING ONE: three states, and only the third can fail. **THE SKIP EMITS NO ASSERTION
ON PURPOSE**, so the floor below is set for the CI case. NAMES, NOT A COUNT: a count passes
when a file is renamed.`,
  ],
  "scripts/check-migrations.mjs#21": ["CONTRACT", "what it answers and what null means; one line already"],
  "scripts/check-migrations.mjs#22": ["WHY", "the zero-scope arm; two lines already"],
  "scripts/check-migrations.mjs#23": [
    "NUMBER",
    "what this floors that the scope floor cannot, and why the environment matters, with its citation; both measured counts go to the history document",
    `EXECUTED-COUNT FLOOR. The scope floor catches a directory that stopped being read; this catches
an assertion block that stopped running over a full one. MEASURED BY RUNNING IT, both cases.
**THE COUNT DEPENDS ON THE ENVIRONMENT and the floor is set for the lower one**, the ledger
section emitting no assertion where there is no local database. It steps by a fixed amount per
migration, which is append-only by hard rule 14.`,
  ],
  "scripts/lib/uptimerobot.mjs#0": [
    "CONTRACT",
    "why one module, that the contract was measured from the API, and the rate limit; the verbatim validation errors and the endpoint inventory go to the history document",
    `The UptimeRobot v3 contract, in one place, shared by the writer and the gate.

BOUNDARY: every value here was MEASURED against the API rather than read off a description of
it, the v3 documentation returning no specification to a fetch, so this is fixture independence
applied to a third party and it ages the day the API does.`,
  ],
  "scripts/lib/uptimerobot.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/lib/uptimerobot.mjs#2": [
    "WHY",
    "why the constant is here and why beside its consumers",
    `Where the monitor ids are recorded. IT LIVES HERE because both consumers need it and the writer
is a PROGRAM: importing a constant out of it would create monitors as a side effect of checking
them. Beside its two consumers, on the precedent that a manifest sits with what it describes.`,
  ],
  "scripts/lib/uptimerobot.mjs#3": [
    "WHY",
    "why not-paused rather than up",
    `THE GATE ASSERTS NOT-PAUSED RATHER THAN UP: a DOWN monitor is one doing its job, so a gate
demanding UP would go red for the site being down. What this owns is whether the instrument
exists, is switched on, and is pointed at the right host.`,
  ],
  "scripts/lib/uptimerobot.mjs#4": [
    "CONTRACT",
    "what a failure may report",
    `One authenticated call. NEVER INTERPOLATES THE KEY INTO A MESSAGE: the status and the API's own
error text are reported, and that text echoes the offending FIELDS, never the bearer token.

@param {string} key
@param {string} path path under the v3 base, leading slash
@param {{ method?: string, body?: unknown }} [options]
@returns {Promise<{ ok: boolean, status: number, body: any, text: string }>}`,
  ],
  "scripts/lib/uptimerobot.mjs#5": ["CONTRACT", "one line already; kept"],
  "scripts/lib/uptimerobot.mjs#6": [
    "WHY",
    "what a first-page read would conclude in each direction",
    `PAGINATES RATHER THAN TAKING THE FIRST PAGE: reading one page would call a monitor missing the
day the account grows past the page size, and would let the writer create a duplicate on every
run. The loop is bounded so a server that never stops advancing cannot spin.

@param {string} key
@returns {Promise<Array<Record<string, any>>>}`,
  ],
  "scripts/lib/uptimerobot.mjs#7": [
    "WHY",
    "that the two views are independent, and which direction is dangerous; the polling timeline and the date go to the history document",
    `THE LIST ENDPOINT IS NOT A RELIABLE READ OF A MONITOR'S STATUS: immediately after a resume the
addressed read and the list answered DIFFERENTLY and did not converge monotonically. **THE
DANGEROUS DIRECTION IS THE REASON THIS EXISTS**: the list reports NOT PAUSED for a monitor
somebody has just switched off, and a monitoring gate whose failure mode is a false green is
worse than no gate. Returns \`null\` for 404, a monitor that is GONE rather than an error.

@param {string} key
@param {number|string} id
@returns {Promise<Record<string, any> | null>}`,
  ],
  "scripts/lib/uptimerobot.mjs#8": [
    "WHY",
    "who owns the host, why the keyword is the longer string and that the status code is a second signal; the body shapes go to the history document",
    `The monitor shapes this repo asks for, derived from one origin. **\`SITE_ORIGIN\` IS THE ONE
OWNER OF THE HOST**, which is why ship calls the writer. THE KEYWORD IS THE FULL OPENING
FRAGMENT, AND THE BARE WORD WOULD HAVE FAILED OPEN: the health endpoint answers the same body
shape for every verdict, so the word appears in every response it can produce. Only the leading
fragment discriminates, which is a real coupling to key order and is stated rather than left to
be discovered. AND IT IS NOT THE ONLY SIGNAL: the accepted status codes exclude the failing one.

@param {string} origin SITE_ORIGIN, no trailing slash
@returns {Array<{ path: string, key: string, shape: Record<string, unknown> }>}`,
  ],
  "scripts/lib/uptimerobot.mjs#9": [
    "WHY",
    "why the trailing slash matters; the dry-run output and its date go to the history document",
    `NO TRAILING SLASH, an idempotency fix rather than a preference: the account stored the origin
without one, so every run would have written a monitor that needed nothing.`,
  ],
  "scripts/lib/uptimerobot.mjs#10": [
    "WHY",
    "why the two monitors differ here",
    `3xx IS ALLOWED HERE AND NOT ON HEALTH: the home page is what a reader types and the cutover
puts a redirect in front of it. The health endpoint has no reason to redirect ever.`,
  ],
  "scripts/lib/uptimerobot.mjs#11": [
    "WHY",
    "why a subset; the example field names go to the history document",
    `A SUBSET, DELIBERATELY: comparing all of the API's fields would redden the day UptimeRobot adds
one, which teaches everybody to ignore it. These decide whether the monitor watches the right
thing in the right way.`,
  ],
  "scripts/lib/uptimerobot.mjs#12": [
    "WHY",
    "the asymmetry, what it costs each consumer and that both values were measured; the field names, the values and the dates go to the history document",
    `Fields the API ACCEPTS in one representation and RETURNS in another, caught by running the thing
twice: one field is written as a string the API refuses any other spelling of and read back as a
number, so the comparison reports drift on a correct monitor forever. The writer would update on
every run and the gate would be PERMANENTLY RED. BOTH VALUES WERE MEASURED, NOT INFERRED FROM
THE FIRST, by writing each and reading it back.`,
  ],
  "scripts/lib/uptimerobot.mjs#13": [
    "CONTRACT",
    "one function for both consumers, with its citation",
    `What the API will RETURN for a field this repo asked to be \`value\`. ONE FUNCTION, BOTH
CONSUMERS: if the writer and the gate disagreed about what "in step" means, one would be wrong
on every run. Hard rule 17.

@param {string} field
@param {unknown} value the value this repo writes
@returns {unknown} the value the API is expected to return`,
  ],
  "scripts/lib/uptimerobot.mjs#15": [
    "WHY",
    "why unchanged rather than undefined, with its citation",
    `A value with no mapping falls through UNCHANGED rather than to undefined: a new enum member
should surface as a mismatch naming both sides, which is hard rule 13.`,
  ],
  "scripts/lib/uptimerobot.mjs#16": ["CONTRACT", "what it answers; already short"],
  "scripts/lib/route-render.mjs#0": [
    "CONTRACT",
    "why it exists, what the stubbing limits it to and what the second consumer brought; the redesign framing goes to the history document",
    `Renders route components to static HTML in Node, so a gate can read the markup they produce.

BOUNDARY: server-only imports are stubbed at resolve time rather than executed, so this proves
things about COMPONENTS and nothing about loaders, actions, or anything server-side.`,
  ],
  "scripts/lib/route-render.mjs#1": [
    "WHY",
    "why it is exported and why it is implausible",
    `What a Vite \`?url\` import resolves to here. Exported so a gate can ASSERT on it rather than
meeting it as a surprising \`src\`, and deliberately not a plausible path.`,
  ],
  "scripts/lib/route-render.mjs#2": ["CONTRACT", "how the alias resolves; two lines already"],
  "scripts/lib/route-render.mjs#3": [
    "CONTRACT",
    "why the stub is CJS",
    `Bundles route modules for Node with their server-only imports stubbed. The stub is a CJS Proxy
rather than an ES module, which would have to declare every named export the importers ask for;
interop gives every name back as a no-op, which is enough, nothing here being called.

@param {string[]} entries repo-relative module paths
@returns {Promise<{ outDir: string, files: string[], cleanup: () => Promise<void> }>}`,
  ],
  "scripts/lib/route-render.mjs#4": [
    "WHY",
    "why inside the repo",
    `Inside the repo, NOT the OS temp directory: react and react-router stay external so the
components share the harness's instances, and a bare specifier only resolves if Node can walk
up into this repo's node_modules.`,
  ],
  "scripts/lib/route-render.mjs#6": ["CONTRACT", "which surfaces are stubbed; two lines already"],
  "scripts/lib/route-render.mjs#7": ["CONTRACT", "why the specifier still needs resolving; two lines already"],
  "scripts/lib/route-render.mjs#8": [
    "WHY",
    "why esbuild refuses it, why not a build product and what the sentinel costs",
    `VITE'S \`?url\` SUFFIX, which esbuild reads as part of the FILENAME and refuses. Stripping it
would not help, several of those files not existing until the enhancement build has run, and a
gate that only runs after a build does not run on a fresh checkout. So the suffix resolves to
the SENTINEL, and the cost is stated: NO GATE USING THIS HARNESS MAY ASSERT ANYTHING ABOUT AN
ENHANCEMENT URL. What survives is the script TAG and every attribute the component writes.`,
  ],
  "scripts/lib/route-render.mjs#9": ["CONTRACT", "why they stay external; two lines already"],
  "scripts/lib/route-render.mjs#10": ["CONTRACT", "why the banner is needed; already short"],
  "scripts/lib/route-render.mjs#11": ["CONTRACT", "what the options are; already short"],
  "scripts/lib/route-render.mjs#13": [
    "WHY",
    "why client state must be seedable and why not through loader data; the session reference goes to the history document",
    `DECLARED INITIAL CLIENT STATE, spread last so it can seed a route's own \`useState\`. The harness
renders ONE static pass and dispatches no event, so any UI behind client state is invisible, and
an admin mutation surface the gate cannot see is the class this exists to close. The route takes
an OPTIONAL prop with a production default, so shipped behaviour is unchanged; seeding from
loader data would put a field in the server contract that no loader returns.`,
  ],
  "scripts/lib/route-render.mjs#17": [
    "CONTRACT",
    "which fields are contractual and why the rest are not",
    `Fields whose VALUE the UI decides, so the value is part of the contract. Everything else in the
payload is the author's content, and recording it would make the fixture a copy of the test data.`,
  ],
  "scripts/lib/route-render.mjs#18": [
    "CONTRACT",
    "what a form's identity is and why disabled controls are excluded",
    `Every request the rendered page can submit, as a stable shape: a form's identity is (action,
method, intent, field names), exactly the tuple the server reads. A DISABLED control submits
nothing, which is how the editor reproduces "absent when unticked" without a checkbox.

@param {string} html
@returns {Array<{ action: string, method: string, intent: string, fields: string[] }>}`,
  ],
  "scripts/lib/route-render.mjs#20": [
    "WHY",
    "why the attribute comes first and why a flat scan suffices",
    `Form ownership is by the \`form\` ATTRIBUTE first and containment second, which is how a browser
resolves it, and the editor has a control outside the form it submits. Forms cannot nest.`,
  ],
  "scripts/lib/route-render.mjs#24": ["WHY", "why disabled controls are skipped; already short"],
  "scripts/lib/route-render.mjs#25": [
    "WHY",
    "why an unchecked box is what makes the field honest",
    `An UNCHECKED checkbox is not submitted either: the checkbox era sent the publish field on a
draft and no key at all on a published post, so an unconditional listing would record a payload
the browser never sends and demand the redesign reproduce it.`,
  ],
  "scripts/lib/route-render.mjs#26": [
    "WHY",
    "why the split is by name, and what a valueless checkbox sends",
    `For a few fields the VALUE is the contract; for the rest only the name is. THE SPLIT IS BY FIELD
NAME, NOT BY WIDGET TYPE: moving a field from a text input to a hidden one changes the widget
and nothing about the request. A checkbox with no \`value\` submits "on" per the spec and React
renders no value, so reading the attribute literally would record an empty string.`,
  ],
  "scripts/lib/route-render.mjs#28": ["CONTRACT", "one line already; kept"],
  "scripts/lib/route-render.mjs#29": ["CONTRACT", "one line already; kept"],
  "scripts/lib/route-render.mjs#30": [
    "WHY",
    "why distinct",
    `DISTINCT, deliberately: the contract is which requests a page can issue, not how many controls
offer each one, and counting duplicates would make the gate object to layout.`,
  ],
};
