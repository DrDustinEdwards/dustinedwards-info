// Chunk 14: check-hook-matchers 0-17, check-mail 0-21, check-stack 0-18, check-worker 0-11,
// build-diagrams 0-21, lib/rss 0-16, lib/strip-comments 0-10.
//
// Wave 1's rule. lib/strip-comments is the module the whole wave's tooling depends on, and its
// header is the record of one job implemented nine times: the drift-in-strength argument is why
// it exists at all, so it stays. What goes is the transcript of the two rewrites and the
// measured fixture counts.
export default {
  "scripts/check-hook-matchers.mjs#0": [
    "CONTRACT",
    "the defect, the boundary, the residual, fail-closed and the two branches; the tool names, the 59 days and the earlier fix go to the history document",
    `Gate: no tool that can reach a guarded act is missing from the hook matchers.

  npm run check:hook-matchers

WHY IT EXISTS: a PreToolUse matcher is a regex over the TOOL NAME, and the matchers here named
one shell tool while the session held pre-approved rules for another, so the deploy door, the
scoped-add check and the pre-push lint were reachable with no prompt for weeks. It had been
fixed once already, one tool name earlier.

BOUNDARY, AND IT IS THE IMPORTANT HALF: **THE HARNESS TOOL LIST IS NOT IN THIS REPO**, so the
assertion a reader wants is not statically decidable here. What IS on disk is the PERMISSION
ALLOW LIST, a DIFFERENT file from the one under test, which is the fixture independence rule 10
asks for. THE RESIDUAL: a tool used under one-off approvals writes no rule, which is why the
required names carry a hard floor too. FAILS CLOSED ON AN UNKNOWN TOOL, the defect having been
a new tool name arriving and nothing noticing. TWO BRANCHES, the local settings file being
gitignored, printing DIFFERENT floor names.`,
  ],
  "scripts/check-hook-matchers.mjs#2": [
    "CONTRACT",
    "why every matcher and not some",
    `TOOLS THAT EXECUTE A COMMAND STRING. Each must appear in EVERY PreToolUse matcher registered
here, because every hook reads the command and none reads the tool name.

@type {Record<string, string>}`,
  ],
  "scripts/check-hook-matchers.mjs#3": ["CONTRACT", "which matcher these belong to; already short"],
  "scripts/check-hook-matchers.mjs#4": [
    "CONTRACT",
    "why the exclusions are enumerated, with its citation",
    `TOOLS THAT NEED NO MATCHER, enumerated rather than defaulted. AN EXCLUSION NAMING A TOOL
EXCLUDES EVERYTHING IT CAN DO, which is rule 10's discipline about enumerating inside
exclusions, so each carries the reason it cannot reach a guarded act.

@type {Record<string, string>}`,
  ],
  "scripts/check-hook-matchers.mjs#5": [
    "CONTRACT",
    "why a hard floor beside the observed set",
    `The names asserted present whether or not a permission rule still mentions them: a tool used
under one-off approvals leaves no rule behind, and a rule deleted in a tidy-up must not delete
the requirement with it.`,
  ],
  "scripts/check-hook-matchers.mjs#6": [
    "WHY",
    "why the observed set can never demand these; the measurement and the printed line go to the history document",
    `The same floor for the dash matcher, and here it is the ONLY thing asserting anything: those
tools appear in no allow list and never will, being permitted by default. A content half built
purely on observation asserts NOTHING while reporting a clean sweep.`,
  ],
  "scripts/check-hook-matchers.mjs#8": [
    "CONTRACT",
    "the gap the sibling gate names and cannot close",
    `1. REGISTRATION, both directions. This is the gap \`check:hook-syntax\` names and cannot close:
it compiles what it finds in the directory, so an unregistered hook compiles cleanly and guards
nothing, and a drifted path takes a guard out while leaving its file to be read and believed.`,
  ],
  "scripts/check-hook-matchers.mjs#9": [
    "CONTRACT",
    "why the shape is declared; the six errors and the catching hook go to the history document",
    `ONE SHAPE FOR A HOOK ENTRY, declared rather than inferred: parsing JSON returns \`any\`.

@typedef {{ matcher?: string, hooks?: Array<{ command?: string }> }} HookEntry`,
  ],
  "scripts/check-hook-matchers.mjs#11": [
    "CONTRACT",
    "where the expected set comes from, with its citation",
    `2. THE MATCHERS AGAINST THE PERMISSION ALLOW LISTS. The tool names come from the allow rules, a
different file in one case and a different SECTION in the other, so the expected set is not
produced by the thing being checked, which is what rule 10 means by fixture independence.`,
  ],
  "scripts/check-hook-matchers.mjs#14": [
    "CONTRACT",
    "how a name is read off a rule and why MCP rules are dropped",
    `THE TOOL NAME IS THE PREFIX BEFORE THE PAREN, and a rule with no paren is the whole name. MCP
rules are dropped: such a tool cannot reach this tree or this shell.`,
  ],
  "scripts/check-hook-matchers.mjs#16": [
    "WHY",
    "why the content tools are asked of one matcher",
    `THE CONTENT TOOLS, against the matcher that registers the dash hook: demanding them on the
shell-only group is a false requirement somebody eventually satisfies by widening the wrong
matcher.`,
  ],
  "scripts/check-hook-matchers.mjs#17": [
    "NUMBER",
    "why the names are split even while the counts agree; both measured runs and the date go to the history document",
    `EXECUTED-COUNT FLOOR, one name per branch, MEASURED BY RUNNING IT BOTH WAYS. THE TWO ARE EQUAL
TODAY AND THE SPLIT IS STILL RIGHT: the moment a new COMMAND tool is granted locally, that
branch gains an assertion per matcher and the other gains none.`,
  ],
  "scripts/check-mail.mjs#0": [
    "CONTRACT",
    "why it exists, the two paths, who owns the domain, the boundary and why an independent resolver; the record inventory and the dated measurement go to the history document",
    `Gate over the DNS records that make the watchdog's alert mail authenticate.

  npm run check:mail

NETWORK TIER. It resolves live DNS, which is why it is not in the tier ship runs.

WHY IT EXISTS: the watchdog's whole value is one email arriving, and SPF, DKIM and DMARC decide
whether it is delivered or silently dropped from a dashboard where a click can remove one.

TWO PATHS, NAMED SEPARATELY, BECAUSE THEY ARE DIFFERENT CLAIMS: SENDING puts its SPF and
selector on a bounce subdomain, ROUTING uses the apex and another selector, so a gate asserting
the apex SPF would stay green through the sending record being deleted. THE MAIL DOMAIN HAS ONE
OWNER AND IT IS NOT THIS FILE: it is read out of the watchdog's own constant.

BOUNDARY: this proves the RECORDS ARE PUBLISHED AND WELL FORMED, never that a message
authenticates, and a published key that no longer matches the private one looks good here.
Resolution goes through a THIRD-PARTY resolver, every record being managed by one party, and a
resolver that cannot answer is a FAILURE.`,
  ],
  "scripts/check-mail.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#2": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#3": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#4": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#5": ["CONTRACT", "what the floor counts; one line already"],
  "scripts/check-mail.mjs#6": [
    "CONTRACT",
    "why the argument order and what the first version did; the FAILURES reference goes to the history document",
    `The argument order every gate here uses, and NOT a style preference: the first version took the
path first, so a string sat in the condition slot and every assertion would have passed forever.

@param {string} label
@param {boolean} condition
@param {string} [detail]`,
  ],
  "scripts/check-mail.mjs#7": [
    "WHY",
    "why it is anchored on the declaration, with its citation",
    `THE MAIL DOMAIN, read from its one owner, anchored on the DECLARATION rather than an
address-shaped string. Hard rule 10: stripping comments is not enough, the needle has to name
the binding.`,
  ],
  "scripts/check-mail.mjs#8": ["CONTRACT", "fail closed on anything that is not a clean answer; already short"],
  "scripts/check-mail.mjs#9": [
    "WHY",
    "why transport failures only; the failing run goes to the history document",
    `RETRIED, and measured rather than defensive: one query of six failed on the transport while the
other five answered. TRANSPORT FAILURES ONLY, and an answered query is never retried however
unwelcome: retrying a finding until it changes is how a gate is talked out of a true failure.`,
  ],
  "scripts/check-mail.mjs#10": ["CONTRACT", "which answer types count; two lines already"],
  "scripts/check-mail.mjs#12": [
    "CONTRACT",
    "why the strings must be joined",
    `A TXT record over the size limit reaches the wire as several quoted strings and MUST be
concatenated: a DKIM key is always over it.`,
  ],
  "scripts/check-mail.mjs#14": [
    "CONTRACT",
    "why exactly one",
    `SPF, asserted the same way on both paths. EXACTLY ONE record: two on one name is a permanent
error under the RFC and resolves to neither.

@param {string} path
@param {string} name`,
  ],
  "scripts/check-mail.mjs#15": [
    "CONTRACT",
    "why presence is not enough",
    `DKIM, by selector, checked for PRESENCE and NON-EMPTINESS: an empty value is the documented way
to REVOKE a key and is valid syntax.

@param {string} path
@param {string} name`,
  ],
  "scripts/check-mail.mjs#16": ["CONTRACT", "section marker, rule padding cut", `SENDING: the alert mail`],
  "scripts/check-mail.mjs#17": [
    "WHY",
    "why the specific policy and not merely a policy",
    `The strict policy SPECIFICALLY, not merely "a policy": the failure worth catching is a
WEAKENING, which looks valid to any check that asks only whether a record is present.`,
  ],
  "scripts/check-mail.mjs#18": [
    "WHY",
    "what enforcing without reporting is",
    `A reporting address, so failures are OBSERVABLE: without one the policy is enforcing and
reporting to nobody, which is the state this zone was in.`,
  ],
  "scripts/check-mail.mjs#19": ["CONTRACT", "section marker, rule padding cut", `ROUTING: what the domain receives`],
  "scripts/check-mail.mjs#20": [
    "NUMBER",
    "why records rather than assertions, and why no slack; the six names go to the history document",
    `FLOOR ON RECORDS CHECKED: every assertion hangs off a resolve call, so a gate that queried
nothing reports clean, and counting ASSERTIONS would not catch it because a query that fails
closed still increments. MEASURED BY RUNNING IT, with no slack, the set being enumerated here.`,
  ],
  "scripts/check-mail.mjs#21": [
    "WHY",
    "why exitCode; the measurement goes to the history document",
    `\`exitCode\` rather than \`process.exit()\`, which tears the process down mid stdout write.`,
  ],
  "scripts/check-stack.mjs#0": [
    "CONTRACT",
    "what the subject is, both boundary limits, both directions and the re-derivation; the ruling number, the CI argument's history and the deleted entry go to the history document",
    `Gate over the colophon's generated stack data.

  npm run check:stack

THE SUBJECT IS A BUILD PRODUCT, NOT A COMMIT: the artifact is gitignored and written before the
gates, so this asserts that a build HAPPENED and reconciles with its sources. Comparing a
committed copy against a fresh derivation made every dependency bump a two-file change no bot
could complete.

BOUNDARY, TWO LIMITS. It cannot tell whether the PROSE is true: a note is reconciled against
the binding it describes and nothing more. And **it reads the EXAMPLE config, which is not what
is deployed**: only \`check:config\` binds the two, on one machine, and **CI CANNOT CLOSE THIS
GAP**, a checkout bootstrapping the example into place.

BOTH DIRECTIONS, ON EVERY SOURCE: a row with no binding is the one that actually happens, a
resource being removed while the page keeps advertising it. IT RE-DERIVES RATHER THAN TRUSTING
THE ARTIFACT, calling the builder's own exported derivations. FAILS CLOSED.`,
  ],
  "scripts/check-stack.mjs#2": ["CONTRACT", "both directions as one pair; already short"],
  "scripts/check-stack.mjs#3": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-stack.mjs#4": [
    "WHY",
    "how two blind sides agree; the plant goes to the history document",
    `The blind spot, made loud: a binding KIND no reader understands produces no rows on either side,
so the artifact and the config agree by both being empty.`,
  ],
  "scripts/check-stack.mjs#5": ["CONTRACT", "section marker, rule padding cut", `shape and freshness`],
  "scripts/check-stack.mjs#6": [
    "WHY",
    "what the old comparison was asking and why mtime answers the right question; the ruling number and the PR numbers go to the history document",
    `FRESHNESS, WHICH REPLACED A COMPARISON THAT WAS ASKING THE WRONG QUESTION. It compared A COMMIT
TO A BUILD, so the only way to satisfy it was a human running the build and committing the
result in the same change, and a dependency bot cannot run a build. The question is now "did a
build happen", which mtime answers. The reconciles below read the artifact's CONTENT, so they
catch a regeneration that produced the wrong thing.`,
  ],
  "scripts/check-stack.mjs#7": ["CONTRACT", "section marker, rule padding cut", `both directions`],
  "scripts/check-stack.mjs#10": ["CONTRACT", "section marker, rule padding cut", `the hand-written half, both directions`],
  "scripts/check-stack.mjs#14": [
    "WHY",
    "why the two statuses are different claims, why the vocabulary is closed and who else owns it; the deleted entry and the dates go to the history document",
    `A refusal and an accepted gap are DIFFERENT CLAIMS and the page states which: one entry was not
a refusal, and calling it one would publish a decision nobody made, on the page whose subject is
what was decided. The status is CLOSED rather than free text. This list is the SECOND owner of
that vocabulary: \`check:features\` asserts both directions against the page's label map.`,
  ],
  "scripts/check-stack.mjs#17": ["CONTRACT", "section marker, rule padding cut", `runtime facts`],
  "scripts/check-stack.mjs#18": [
    "NUMBER",
    "what an empty roster would do; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR. Reconciling a GENERATED artifact against its sources is the shape most
able to pass by checking nothing: an artifact that parsed to an empty roster iterates zero
times. MEASURED BY RUNNING IT, and it tracks the colophon's declared inventory.`,
  ],
  "scripts/check-worker.mjs#0": [
    "CONTRACT",
    "the boundary, why it exists and the shared failure mode; the audit's counts and the three defects go to the history document",
    `Gate: run the Worker test layer, and refuse to believe an empty one.

  npm run test:worker

BOUNDARY: **IT RUNS VITEST IN WORKERD AND READS ITS SUMMARY**, so it knows how many files were
discovered and how many cases the runner counted, not whether those cases ASSERT anything.

WHY IT EXISTS: an audit found hundreds of pure-function tests and a real-browser gate with
NOTHING BETWEEN THEM, so every route-level fact had to be established by probing production.
THE SAME FAILURE MODE AS \`check:tests\`, AND THE SAME REPAIR: **the runner exits 0 when its
include glob matches nothing**, so this gate discovers the files itself and floors both counts
before believing an exit code.`,
  ],
  "scripts/check-worker.mjs#1": [
    "NUMBER",
    "the measurement rule, why tight, and who owns the tolerance; the restated percentage and its failing run go to the history document",
    `Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it. Tight rather than slack, on
\`check:tests\`' convention: they move UP with a case, and the point is to notice the set
SHRINKING. HOW FAR UNDER IS \`check:floors\`' TO SAY: this docblock used to carry a percentage,
and the two disagreed by one case on the first run after it was written down.`,
  ],
  "scripts/check-worker.mjs#2": [
    "NUMBER",
    "the relationship every pair here has had; the dated readings go to the history document",
    `One below the measurement, so a single file leaving the pattern trips it.`,
  ],
  "scripts/check-worker.mjs#3": [
    "NUMBER",
    "what this catches that a file count cannot; the dated readings and the corrected pair go to the history document",
    `The file floor catches a file LEAVING; this catches one hollowed out in place. Re-run, never
adjusted by arithmetic.`,
  ],
  "scripts/check-worker.mjs#4": [
    "NUMBER",
    "where the tolerance rule lives and why the first attempt went undetected locally; every count and date goes to the history document",
    `SET THROUGH \`check:floors\`' OWN TOLERANCE, after CI caught the first attempt, which read a
percentage out of a comment in another gate: the rule belongs to the gate that enforces it. It
went undetected locally because \`check:floors\` runs LAST and the tier hung before it here.`,
  ],
  "scripts/check-worker.mjs#7": [
    "WHY",
    "why this scope floor is in the meta-gate",
    `THROUGH assertFloor: the worker test set only ever grows, so the measured value climbs away by
itself. As a bare assertion it printed no floor line and the meta-gate had nothing to read.`,
  ],
  "scripts/check-worker.mjs#8": [
    "WHY",
    "what was observed, that the cause was not established, and why a contract rather than a better needle; the version, the banner lines and the refuted candidate go to the history document",
    `THE COUNTS COME FROM THE JSON REPORTER, NOT FROM THE HUMAN OUTPUT. The first version read the
totals off the default reporter, and CI's first clean-checkout run caught it: the tests passed
and the log carried none of the runner's stdout, so the gate read no count and failed closed.
**THE CAUSE WAS NOT ESTABLISHED, and this comment does not invent one**; the obvious candidate
was REFUTED. Which is why the repair is not a better regex: the needle was pointed at a
HUMAN-FACING RENDERING, free to differ per environment, which is hard rule 10's own mistake.
BOTH REPORTERS RUN, and IT STILL DELEGATES: package.json defines what this layer's run IS.`,
  ],
  "scripts/check-worker.mjs#11": [
    "NUMBER",
    "what this floors and why slack is zero; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS: if those stopped, the case floor would stop
being consulted and nothing would say so. Slack of ZERO, a fixed set of properties about one run.`,
  ],
  "scripts/build-diagrams.mjs#0": [
    "CONTRACT",
    "why build time, the gap it leaves, why the bytes are never gated and why two renders; the two engine errors and the ruling reference go to the history document",
    `Renders every \`:::diagram\` in the corpus to a static SVG asset.

  npm run build:diagrams [-- --force]

BUILD TIME ONLY, in Node, driving a real browser, and that was decided by measurement: diagram
layout needs real font metrics, so the DOM-shim renderers die on the text measurement call.
Charts pass the both-writers rule and render inline; diagrams take the social-card pattern.
The gap is the same one social cards have: a diagram authored in the editor has no asset until
this runs, which is why the gate fails on a referenced asset that is not on disk.

Nothing here touches the gated artifact: the SVG bytes come out of a browser engine and are
exactly what a byte-comparison gate must never be handed. TWO RENDERS PER DIAGRAM, LIGHT AND
DARK, forced rather than chosen: the renderer will not accept a custom property, an SVG
referenced by \`<img>\` resolves against nothing, and this site resolves its theme from a cookie.`,
  ],
  "scripts/build-diagrams.mjs#1": [
    "CONTRACT",
    "why it is set explicitly",
    `The id written onto the SVG root and prefixed onto every internal id, set explicitly so the
bytes do not move if the tool's default does. Two diagrams on one page cannot collide: each
asset is its own document behind its own \`<img>\`.`,
  ],
  "scripts/build-diagrams.mjs#2": ["CONTRACT", "why fixed; one line already"],
  "scripts/build-diagrams.mjs#3": [
    "WHY",
    "why a recorded limitation rather than a solved problem",
    `The font stack the diagram is laid out with, a recorded limitation rather than a solved problem:
an SVG inside an \`<img>\` may not load external resources, so the viewer's font is not guaranteed
to be the one this build measured text with, which is why the padding below is generous.`,
  ],
  "scripts/build-diagrams.mjs#4": ["CONTRACT", "the parameters plus where the colours came from; already short"],
  "scripts/build-diagrams.mjs#5": ["CONTRACT", "why this theme; two lines already"],
  "scripts/build-diagrams.mjs#6": ["CONTRACT", "why the audit exists; already short"],
  "scripts/build-diagrams.mjs#7": [
    "WHY",
    "what a foreignObject does inside an img",
    `Labels as real text, never \`<foreignObject>\`: a foreignObject is not rendered at all through
\`<img>\`, so every node would come out blank on the page while looking correct standalone.`,
  ],
  "scripts/build-diagrams.mjs#8": [
    "WHY",
    "why layout rather than taste; the measured widths go to the history document",
    `Tightened from the defaults, for layout rather than taste: a wider drawing is scaled down and
takes its type with it, and narrowing the gaps shrinks the drawing without shrinking the text.`,
  ],
  "scripts/build-diagrams.mjs#9": ["WHY", "what the mirrored row costs; two lines already"],
  "scripts/build-diagrams.mjs#10": [
    "WHY",
    "what an img does with no intrinsic width, and why a targeted rewrite",
    `Makes the SVG sizeable by an \`<img>\`: the renderer emits a percentage width, which inside an
\`<img>\` is an SVG with no intrinsic width, so the viewBox's real size is copied onto the root.
A targeted rewrite of the ROOT TAG rather than parsing and re-serialising: an \`.svg\` is parsed
strictly, so one unclosed tag produces a file that renders as nothing.

@param {string} svg
@param {string} label`,
  ],
  "scripts/build-diagrams.mjs#11": [
    "CONTRACT",
    "the three reasons, the first of them measured",
    `The renderer's own API against a browser this script owns, rather than its command line. Node
refuses to spawn the shim without a shell, and a shell concatenates an argument array WITHOUT
quoting, which has already split a value containing spaces here; one browser then serves every
render, and neither the source nor the config touches a temp file.

@param {import("puppeteer").Browser} browser
@param {string} source
@param {"light" | "dark"} theme
@param {Record<string, string>} colours
@param {string} label`,
  ],
  "scripts/build-diagrams.mjs#14": ["CONTRACT", "why one asset; two lines already"],
  "scripts/build-diagrams.mjs#16": ["WHY", "why the launch is conditional; two lines already"],
  "scripts/build-diagrams.mjs#19": ["WHY", "why it is audited before it is written; two lines already"],
  "scripts/build-diagrams.mjs#20": [
    "WHY",
    "why a write path alone is not enough",
    `Prune: an upsert keyed by filename leaves a deleted diagram on disk forever, and the write path
alone is not enough.`,
  ],
  "scripts/build-diagrams.mjs#21": [
    "WHY",
    "what follows automatically and what cannot",
    `These assets are in the MEDIA INDEX, so rendering or pruning one changes what \`check:media\`
expects. The manifest is regenerated automatically, being derived from the filesystem; the index
cannot be, needing the Worker's binding, so this can only say so loudly.`,
  ],
  "scripts/lib/rss.mjs#0": [
    "CONTRACT",
    "why a separate process, what is counted, what the metric is and that it fails soft; the five killed runs and the dates go to the history document",
    `PEAK RESIDENT MEMORY OF A PROCESS TREE, sampled from outside it.

The tier runs its gates with a BLOCKING spawn, so any sampler living in this event loop would
record nothing for exactly the span it exists to measure. The sampler is a separate process
writing to a FILE, and the runner attributes each sample to whichever gate owned the clock.

WHY IT EXISTS: tier runs were killed by the OS for low memory, and every diagnosis was an
inference from which gate happened to be printing. WHAT IS COUNTED, STATED PLAINLY: the whole
descendant tree plus the root, summed, the runner's own resident set included, because the
number that matters for an OOM kill is what the machine was holding. FAILS SOFT, ALWAYS: this
is an instrument, not a gate.`,
  ],
  "scripts/lib/rss.mjs#1": ["CONTRACT", "one platform; one line already"],
  "scripts/lib/rss.mjs#2": [
    "WHY",
    "the bare-name trap in the other direction",
    `BY ABSOLUTE PATH, never by bare name: a gate that spawns a tool by bare name is green in the
shell it was written in and absent in the one that ships, which a sibling gate paid for.`,
  ],
  "scripts/lib/rss.mjs#3": [
    "CONTRACT",
    "why the walk is in the sampler and why it appends",
    `The sampling loop. The descendant walk happens in the SAMPLER, so the file already holds the
answer and a reader that starts late still gets correct history. Appends per line and never
truncates: a gap is visible, whereas a rewritten file would be empty in the case worth reading.`,
  ],
  "scripts/lib/rss.mjs#7": ["CONTRACT", "the parameters; already short"],
  "scripts/lib/rss.mjs#8": [
    "WHY",
    "why the values are substituted; the silent no-op goes to the history document",
    `THE VALUES ARE SUBSTITUTED INTO THE SCRIPT, not passed after it, where they are consumed as
arguments to the interpreter. Measured on the first run, which started cleanly and wrote zero
samples.`,
  ],
  "scripts/lib/rss.mjs#9": [
    "WHY",
    "why not detached",
    `DETACHED IS WRONG HERE: a detached sampler outlives a killed runner and becomes exactly the
orphan the memory work exists to remove. It stays a child, so the tree kill takes it too.`,
  ],
  "scripts/lib/rss.mjs#10": ["CONTRACT", "one line already; kept"],
  "scripts/lib/rss.mjs#11": [
    "CONTRACT",
    "why null rather than zero",
    `The peak sample inside a window, or null when nothing was sampled: zero is a measurement and
"nobody looked" is not, a gate faster than the sampling interval landing here legitimately.

@param {string} outPath
@param {number} fromMs inclusive, epoch milliseconds
@param {number} toMs inclusive, epoch milliseconds
@returns {number | null}`,
  ],
  "scripts/lib/rss.mjs#12": ["CONTRACT", "what the third field is; two lines already"],
  "scripts/lib/rss.mjs#13": ["CONTRACT", "one line already; kept"],
  "scripts/lib/rss.mjs#15": [
    "CONTRACT",
    "why the sampler is the oracle, and why pids not names; the measured browser count goes to the history document",
    `THE PIDS OF THE MOST RECENT SAMPLED TREE: the sampler already walks the tree every tick, so it
writes the membership beside the total and becomes the tree ORACLE as well as the meter, which
matters because the blocking spawn leaves this process unable to enumerate anything. PIDS,
NEVER NAMES: a sweep matching a process name would reach the user's own browser and editor.

@param {string} outPath
@returns {number[]}`,
  ],
  "scripts/lib/rss.mjs#16": [
    "CONTRACT",
    "what a single sample misses, why a window and what the residual is; the killed run's figures go to the history document",
    `EVERY PID SEEN IN THE LAST WINDOW OF SAMPLING, as one set. A single sample is right for "what
is the tree right now" and WRONG for cleaning up after a run that died, whose heavy processes
were spawned minutes earlier. WHY A WINDOW RATHER THAN THE WHOLE FILE: WINDOWS REUSES PIDS and
this list is fed to a KILL. The window bounds the risk rather than proving against it, and the
residual is accepted and stated; matching on NAMES is worse by a wide margin.

@param {string} outPath
@param {number} windowMs how far back from the last sample to gather
@returns {number[]}`,
  ],
  "scripts/lib/strip-comments.mjs#0": [
    "CONTRACT",
    "the trap, the drift-in-strength argument, that the old boundary moved, why the weak forms stay and what is not this job; the six victims, the measurements and the dates go to the history document",
    `THE JS-SCAN COMMENT STRIPPER, in one place.

WHAT THIS IS FOR: a gate that searches source for a literal will find it in the PROSE explaining
why it is forbidden. Six gates here have hit it, one passing every row for the wrong reason.
Stripping comments before matching is hard rule 10's discipline, and it was implemented NINE
TIMES: nine copies of one job drift in STRENGTH, and a copy weaker than its siblings passes for
a reason nobody checks.

IT IS A TOKENIZER, AND THE OLD BOUNDARY MOVED WITH IT. The colon guard that protected a URL
inside a string was load-bearing and was also the shape of the boundary. **THAT IS NO LONGER
TRUE, AND THE TESTS NOW ASSERT THE OPPOSITE**: a string literal is consumed whole. A boundary
note is a claim that ages, per hard rule 7, and this one aged in the commit that changed it.

THE WEAK FORMS STAY ANYWAY, on a narrower argument: THIS IS A JAVASCRIPT TOKENIZER, so it reads
an apostrophe in SVG text as opening a string and a slash after an operator as opening a regex.
JOBS THAT ARE NOT THIS JOB: a string-aware scanner, a reader that needs \`//host\` inside strings
to survive, and the CSS readers where \`//\` is never a comment.

@see test/strip-comments.test.mjs`,
  ],
  "scripts/lib/strip-comments.mjs#1": [
    "CONTRACT",
    "why one pass, what it understands, the regex heuristic and the unterminated rule; both dated rewrites and the measured counts go to the history document",
    `ONE LEFT-TO-RIGHT PASS, and both exported functions are it.

WHY ONE PASS: "is this a comment opener" is a question about everything to its left, and no
number of independent regex passes can answer it. This module learned that twice, once when
apostrophes inside double-quoted labels paired up, and once when a slash-star inside a string
opened a comment running to the next star-slash anywhere in the file. THE DIFFERENTIAL IS WHAT
SAID SO the second time: the string-blanking wrapper ran its own tokenizer, which does not
understand REGEX LITERALS.

A slash opens a regex when the previous significant character cannot END an expression, the
standard heuristic rather than a parser, **adopted on a MEASUREMENT rather than on the
argument**: without it, one gate's own regex hid six assertion calls. An UNTERMINATED literal is
emitted verbatim to the end of the file rather than swallowing it.

@param {string} source
@param {{ preserveLines?: boolean, blankStrings?: boolean }} options
@returns {string}`,
  ],
  "scripts/lib/strip-comments.mjs#2": ["CONTRACT", "what decides a slash; one line already"],
  "scripts/lib/strip-comments.mjs#3": ["CONTRACT", "what a string literal cannot do; one line already"],
  "scripts/lib/strip-comments.mjs#4": [
    "WHY",
    "why the newlines are kept",
    `BLANKED TO TWO CHARACTERS PLUS THE NEWLINES IT SPANNED: a reader computes a LINE from this
text, and a collapsing multi-line template moved every line after it.`,
  ],
  "scripts/lib/strip-comments.mjs#5": ["CONTRACT", "what is copied whole; one line already"],
  "scripts/lib/strip-comments.mjs#6": ["CONTRACT", "why it falls through; two lines already"],
  "scripts/lib/strip-comments.mjs#7": ["CONTRACT", "what replaces a block comment; one line already"],
  "scripts/lib/strip-comments.mjs#8": [
    "WHY",
    "why the guard is gone",
    `A line comment. The colon guard is GONE and is not needed: a string is consumed whole by the
branch above, so a \`//\` reaching here is in code.`,
  ],
  "scripts/lib/strip-comments.mjs#9": [
    "CONTRACT",
    "what the option is for; the gate that learned it goes to the history document",
    `Comments out, strings kept. \`preserveLines\` replaces a block comment with the NEWLINES IT
SPANNED, so a multi-line anchor still matches and reported line numbers do not shift.

@param {string} source
@param {{ preserveLines?: boolean }} [options]
@returns {string}`,
  ],
  "scripts/lib/strip-comments.mjs#10": [
    "CONTRACT",
    "who needs it and why it is the same tokenizer",
    `Comments out, STRING LITERALS BLANKED as well. Two gates need this and both for the same
reason: they search for names that also appear inside ordinary strings. The same tokenizer, with
the strings blanked; it used to be a separate implementation that ran AFTER the stripper, which
is how the two disagreed about regex literals.

@param {string} source
@returns {string}`,
  ],
};
