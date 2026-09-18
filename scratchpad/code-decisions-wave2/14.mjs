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
one shell tool while the session held pre-approved permission rules for another. Every hook in
this directory fired on one tool and on nothing else, so the deploy door, the scoped-add check
and the pre-push lint were all reachable with no prompt and no guard, for weeks. It had been
fixed once already, one tool name earlier.

BOUNDARY, AND IT IS THE IMPORTANT HALF: **THE HARNESS TOOL LIST IS NOT IN THIS REPO.** Nothing
in a checkout knows which tools a session can call, so the assertion a reader actually wants is
NOT statically decidable here.

What IS on disk is the PERMISSION ALLOW LIST, so the matchers are compared against a set derived
from a DIFFERENT file than the one under test, which is the fixture independence rule 10 asks
for. That comparison is exactly the desync that went unnoticed.

THE RESIDUAL, stated rather than hidden: a tool used under one-off approvals writes no
permission rule, so this cannot see it. The window it closes is the one that happened; the
window it leaves open is a tool nobody has ever granted, which is why the required names carry a
hard floor too.

FAILS CLOSED ON AN UNKNOWN TOOL. Every name found in an allow list must be CLASSIFIED below, and
a name this file has never been told about is a FAILURE with a message saying which bucket to
put it in: the defect was a new tool name arriving and nothing noticing.

TWO BRANCHES, because the local settings file is gitignored, and they print DIFFERENT floor
names so a floor measured under one is never read against the other.`,
  ],
  "scripts/check-hook-matchers.mjs#2": [
    "CONTRACT",
    "why every matcher and not some",
    `TOOLS THAT EXECUTE A COMMAND STRING. Each must appear in EVERY PreToolUse matcher registered
here, because every hook reads the command and none reads the tool name: a hook is blind to
which tool sent it, so the matcher is the only thing deciding.

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
    `The names asserted present whether or not a permission rule still mentions them. A hard floor,
because the residual above is real: a tool used under one-off approvals leaves no rule behind,
and a rule deleted in a tidy-up must not quietly delete the requirement with it.`,
  ],
  "scripts/check-hook-matchers.mjs#6": [
    "WHY",
    "why the observed set can never demand these; the measurement and the printed line go to the history document",
    `The same floor for the dash matcher, and here it is the ONLY thing asserting anything: those
tools appear in no allow list and never will, because they are permitted by default and a rule
is only written for something that prompts. A content half built purely on observation asserts
NOTHING while reporting a clean sweep, which is the unfailable-condition class.`,
  ],
  "scripts/check-hook-matchers.mjs#8": [
    "CONTRACT",
    "the gap the sibling gate names and cannot close",
    `1. REGISTRATION. Every hook file on disk is registered, and every registration points at a
file that exists. This is the gap \`check:hook-syntax\` names in its own header and cannot close:
it compiles what it finds in the directory, so a hook nobody registered compiles cleanly and
guards nothing, and a registration whose path has drifted takes a guard out while leaving its
file in place to be read and believed.`,
  ],
  "scripts/check-hook-matchers.mjs#9": [
    "CONTRACT",
    "why the shape is declared; the six errors and the catching hook go to the history document",
    `ONE SHAPE FOR A HOOK ENTRY, declared rather than inferred: parsing JSON returns \`any\`, and an
untyped read of it is where implicit-any errors land.

@typedef {{ matcher?: string, hooks?: Array<{ command?: string }> }} HookEntry`,
  ],
  "scripts/check-hook-matchers.mjs#11": [
    "CONTRACT",
    "where the expected set comes from, with its citation",
    `2. THE MATCHERS AGAINST THE PERMISSION ALLOW LISTS. The tool names are taken from the allow
rules, which are a different file from the matchers in one case and a different SECTION of the
same file in the other. Either way the expected set is not produced by the thing being checked,
which is what rule 10 means by fixture independence.`,
  ],
  "scripts/check-hook-matchers.mjs#14": [
    "CONTRACT",
    "how a name is read off a rule and why MCP rules are dropped",
    `THE TOOL NAME IS THE PREFIX BEFORE THE PAREN, and a rule with no paren is the whole name. MCP
rules are dropped: such a tool runs on a server and cannot reach this tree or this shell, and
they would otherwise be hundreds of names demanding classification.`,
  ],
  "scripts/check-hook-matchers.mjs#16": [
    "WHY",
    "why the content tools are asked of one matcher",
    `THE CONTENT TOOLS, against the matcher that registers the dash hook rather than against all of
them: asking every matcher for them would demand them on the shell-only group, which reads no
file content, and that is a false requirement somebody eventually satisfies by widening the
wrong matcher.`,
  ],
  "scripts/check-hook-matchers.mjs#17": [
    "NUMBER",
    "why the names are split even while the counts agree; both measured runs and the date go to the history document",
    `EXECUTED-COUNT FLOOR, one name per branch, MEASURED BY RUNNING IT BOTH WAYS rather than by
subtracting.

THE TWO ARE EQUAL TODAY AND THE SPLIT IS STILL RIGHT: they are equal because every tool the
local file adds is either already in the hard floor or unguarded, and an unguarded tool asserts
nothing. The moment a new COMMAND tool is granted locally, that branch gains an assertion per
matcher and the other gains none, so a single floor would be measured on one machine and read
against CI.`,
  ],
  "scripts/check-mail.mjs#0": [
    "CONTRACT",
    "why it exists, the two paths, who owns the domain, the boundary and why an independent resolver; the record inventory and the dated measurement go to the history document",
    `Gate over the DNS records that make the watchdog's alert mail authenticate.

  npm run check:mail

NETWORK TIER. It resolves live DNS and cannot run offline, which is why it is not in the tier
ship runs.

WHY IT EXISTS: the watchdog is the thing that says the site is down, and its whole value is one
email arriving. SPF, DKIM and DMARC decide whether that email is delivered or silently dropped,
they all live in a dashboard where a click can remove one, and nothing else in this repo can see
them.

TWO PATHS, NAMED SEPARATELY, BECAUSE THEY ARE DIFFERENT CLAIMS, and conflating them fails in the
direction that looks green. SENDING is what the alert mail uses and puts its SPF and selector on
a bounce subdomain; ROUTING is what the domain receives on and uses the apex and a different
selector. A gate asserting the apex SPF would be checking the ROUTING path while claiming to
protect the ALERT MAIL, and would stay green through the sending record being deleted.

THE MAIL DOMAIN HAS ONE OWNER AND IT IS NOT THIS FILE: it is read out of the watchdog's own
constant, deliberately NOT the serving origin, which is a different fact. Parsed rather than
imported, the Worker entry not loading under node.

BOUNDARY: this proves the RECORDS ARE PUBLISHED AND WELL FORMED. It does not prove a message
authenticates, which only a received message's headers can, and it cannot see key VALIDITY: a
published key that no longer matches the private one is indistinguishable from a good one here.

Resolution goes through a THIRD-PARTY resolver, and the independence is the point: every record
is managed by one party, so asking that party's own resolver would put it on both sides. A
resolver that cannot answer is a FAILURE and never a pass.`,
  ],
  "scripts/check-mail.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#2": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#3": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#4": ["CONTRACT", "one line already; kept"],
  "scripts/check-mail.mjs#5": ["CONTRACT", "what the floor counts; one line already"],
  "scripts/check-mail.mjs#6": [
    "CONTRACT",
    "why the argument order and what the first version did; the FAILURES reference goes to the history document",
    `The argument order every gate here uses, and it is NOT a style preference: the first version
took the path first, so the label sat where the condition belongs, and a string in the condition
slot is always truthy. Every assertion would have passed forever while the count went on rising.
The path stays visible by leading the LABEL instead.

@param {string} label
@param {boolean} condition
@param {string} [detail]`,
  ],
  "scripts/check-mail.mjs#7": [
    "WHY",
    "why it is anchored on the declaration, with its citation",
    `THE MAIL DOMAIN, read from its one owner, anchored on the DECLARATION rather than on any
address-shaped string, so a mention in a comment cannot satisfy it. Hard rule 10: stripping
comments is not enough on its own, the needle has to name the binding.`,
  ],
  "scripts/check-mail.mjs#8": ["CONTRACT", "fail closed on anything that is not a clean answer; already short"],
  "scripts/check-mail.mjs#9": [
    "WHY",
    "why transport failures only; the failing run goes to the history document",
    `RETRIED, and the reason is measured rather than defensive: one query of six failed on the
transport while the other five answered, so the record was fine and the network blinked. A
monitoring gate that cries wolf on a dropped packet gets ignored.

TRANSPORT FAILURES ONLY. An answered query is never retried however unwelcome the answer: a
missing or wrong record is a FINDING, and retrying a finding until it changes is how a gate is
talked out of a true failure.`,
  ],
  "scripts/check-mail.mjs#10": ["CONTRACT", "which answer types count; two lines already"],
  "scripts/check-mail.mjs#12": [
    "CONTRACT",
    "why the strings must be joined",
    `A TXT record over the size limit reaches the wire as several quoted strings and MUST be
concatenated before matching: a DKIM key is always over it, so a matcher that skipped this would
read a truncated key and never find the end of it.`,
  ],
  "scripts/check-mail.mjs#14": [
    "CONTRACT",
    "why exactly one",
    `SPF, asserted the same way on both paths. EXACTLY ONE record, because two on one name is a
permanent error under the RFC and resolves to neither.

@param {string} path
@param {string} name`,
  ],
  "scripts/check-mail.mjs#15": [
    "CONTRACT",
    "why presence is not enough",
    `DKIM, asserted by selector. The public key is checked for PRESENCE and NON-EMPTINESS: an empty
value is the documented way to REVOKE a key and is valid syntax, so a gate that only checked the
record parsed would pass a revoked selector.

@param {string} path
@param {string} name`,
  ],
  "scripts/check-mail.mjs#16": ["CONTRACT", "section marker, rule padding cut", `SENDING: the alert mail`],
  "scripts/check-mail.mjs#17": [
    "WHY",
    "why the specific policy and not merely a policy",
    `The strict policy SPECIFICALLY, not merely "a policy": the zone has been there since before
this gate existed, and the failure worth catching is a WEAKENING, which looks like a valid
record to any check that only asks whether one is present.`,
  ],
  "scripts/check-mail.mjs#18": [
    "WHY",
    "what enforcing without reporting is",
    `A reporting address, so failures are OBSERVABLE: without one the policy is enforcing and
reporting to nobody, which is the state this zone was in when the gate was written.`,
  ],
  "scripts/check-mail.mjs#19": ["CONTRACT", "section marker, rule padding cut", `ROUTING: what the domain receives`],
  "scripts/check-mail.mjs#20": [
    "NUMBER",
    "why records rather than assertions, and why no slack; the six names go to the history document",
    `FLOOR ON RECORDS CHECKED, which is the count that matters here: every assertion hangs off a
resolve call, so a gate that queried nothing would print no failures and report clean. Counting
ASSERTIONS would not catch it either, because a query that fails closed still increments that
count.

MEASURED BY RUNNING IT, never summed, with no slack, because the set is enumerated in this file
rather than discovered and cannot drift without someone editing the enumeration.`,
  ],
  "scripts/check-mail.mjs#21": [
    "WHY",
    "why exitCode; the measurement goes to the history document",
    `\`exitCode\` rather than \`process.exit()\`, which tears the process down while libuv still holds
queued stdout writes and the gate exits 127 with its output lost.`,
  ],
  "scripts/check-stack.mjs#0": [
    "CONTRACT",
    "what the subject is, both boundary limits, both directions and the re-derivation; the ruling number, the CI argument's history and the deleted entry go to the history document",
    `Gate over the colophon's generated stack data.

  npm run check:stack

THE SUBJECT IS A BUILD PRODUCT, NOT A COMMIT. The artifact is gitignored and written before the
gates, so this asserts that a build HAPPENED and that what it produced reconciles with its
sources. It no longer compares a committed copy against a fresh derivation, because that
compared a commit to a build and made every dependency bump a two-file change no bot could
complete.

BOUNDARY, AND THERE ARE TWO LIMITS. First, it cannot tell whether the PROSE is true: a
hand-written note is reconciled against the binding it describes, so the gate knows the binding
exists and nothing more. Second, and easier to miss, **it reads the EXAMPLE config, which is not
what is deployed.** The only thing binding the example to the running Worker is \`check:config\`,
which can only run where the real file exists, which is one machine, **and CI CANNOT CLOSE THIS
GAP**: a checkout bootstraps the example into place, so real equals example by construction. A
green run here says the artifact matches the example.

BOTH DIRECTIONS, ON EVERY SOURCE. A binding with no row is the obvious one; a row with no
binding is the one that actually happens, because a resource gets removed and the page keeps
advertising it. The hand-written notes get the same treatment, or the notes file becomes where
stale claims accumulate.

IT RE-DERIVES RATHER THAN TRUSTING THE ARTIFACT: every expectation is computed by calling the
builder's own exported derivations against the live sources, so nothing here restates a binding
name, a version, a migration or a gate.

FAILS CLOSED: "0 differences" must never be reachable by examining nothing.`,
  ],
  "scripts/check-stack.mjs#2": ["CONTRACT", "both directions as one pair; already short"],
  "scripts/check-stack.mjs#3": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-stack.mjs#4": [
    "WHY",
    "how two blind sides agree; the plant goes to the history document",
    `The blind spot, made loud. A binding KIND no reader understands produces no rows on either
side of every comparison below, so the artifact and the config agree by both being empty.`,
  ],
  "scripts/check-stack.mjs#5": ["CONTRACT", "section marker, rule padding cut", `shape and freshness`],
  "scripts/check-stack.mjs#6": [
    "WHY",
    "what the old comparison was asking and why mtime answers the right question; the ruling number and the PR numbers go to the history document",
    `FRESHNESS, WHICH REPLACED A COMPARISON THAT WAS ASKING THE WRONG QUESTION. It compared a fresh
derivation against the committed artifact and was described as the strongest assertion in the
file. It was comparing A COMMIT TO A BUILD, which is the defect rather than a strength: the only
way to satisfy it was for a human to run the build and commit the result in the same change as
the edit that moved it, and a dependency bot cannot run a build.

The artifact is now a gitignored build product derived before the gates, so the question is no
longer "does the commit match a build" but "did a build actually happen", and mtime against the
file this gate exists to track is what answers it.

The reconciles below are not redundant with this: they read the artifact's CONTENT, so they
catch a regeneration that ran and produced the wrong thing, where mtime only catches one that
did not run at all.`,
  ],
  "scripts/check-stack.mjs#7": ["CONTRACT", "section marker, rule padding cut", `both directions`],
  "scripts/check-stack.mjs#10": ["CONTRACT", "section marker, rule padding cut", `the hand-written half, both directions`],
  "scripts/check-stack.mjs#14": [
    "WHY",
    "why the two statuses are different claims, why the vocabulary is closed and who else owns it; the deleted entry and the dates go to the history document",
    `A refusal and an accepted gap are DIFFERENT CLAIMS and the page states which. The list was
originally called the refusals throughout, and one entry was not one: no ruling declined it, and
calling it a refusal would have published a decision nobody made, on the one page whose whole
subject is what was decided.

The status is CLOSED rather than free text, because values a reader can rely on are worth more
than an open vocabulary that drifts into synonyms.

This list is the SECOND owner of that vocabulary rather than the first: the page renders through
a label map, and \`check:features\` asserts in both directions that the labels and the statuses in
use are the same set, so adding the next one means editing both.`,
  ],
  "scripts/check-stack.mjs#17": ["CONTRACT", "section marker, rule padding cut", `runtime facts`],
  "scripts/check-stack.mjs#18": [
    "NUMBER",
    "what an empty roster would do; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR. This gate reconciles a GENERATED artifact against its sources, which is
the shape most able to pass by checking nothing: if the artifact parsed to an empty roster,
every loop would iterate zero times and report green.

MEASURED BY RUNNING IT, never summed. The count tracks the colophon's declared bindings, gates,
migrations and dependencies, so it grows with the stack rather than wandering.`,
  ],
  "scripts/check-worker.mjs#0": [
    "CONTRACT",
    "the boundary, why it exists and the shared failure mode; the audit's counts and the three defects go to the history document",
    `Gate: run the Worker test layer, and refuse to believe an empty one.

  npm run test:worker

BOUNDARY: **IT RUNS VITEST IN WORKERD AND READS ITS SUMMARY.** It knows how many files were
discovered and how many cases the runner counted, not whether those cases ASSERT anything: an
empty body counts as a passing case here exactly as it does for the runner. It cannot see the
deployed build or the platform's cache, which are other gates' subjects.

WHY IT EXISTS: an audit found hundreds of pure-function tests and a real-browser gate with
NOTHING BETWEEN THEM. No test ran a loader, an action, or any binding, so every route-level fact
had to be established by probing production.

THE SAME FAILURE MODE AS \`check:tests\`, AND THE SAME REPAIR: **the runner exits 0 when its
include glob matches nothing**, so a rename or a config edit would empty this layer and the
runner would call it success. This gate discovers the files itself, floors the count, and floors
the executed cases, all before believing an exit code.`,
  ],
  "scripts/check-worker.mjs#1": [
    "NUMBER",
    "the measurement rule, why tight, and who owns the tolerance; the restated percentage and its failing run go to the history document",
    `Floors, MEASURED THROUGH THIS GATE'S OWN DISCOVERY by RUNNING it, never summed. Re-taking the
measurement means running the gate.

Tight rather than slack, on \`check:tests\`' convention and for its reason: these move UP when
somebody adds a case, and the whole point is to notice the set SHRINKING.

HOW FAR UNDER IS \`check:floors\`' TO SAY, and it is not restated here. This docblock used to
carry a percentage, which is a second owner of a rule that gate enforces, and the two disagreed
by one case on the first run after it was written down.`,
  ],
  "scripts/check-worker.mjs#2": [
    "NUMBER",
    "the relationship every pair here has had; the dated readings go to the history document",
    `One below the measurement, so a single file leaving the pattern trips it.`,
  ],
  "scripts/check-worker.mjs#3": [
    "NUMBER",
    "what this catches that a file count cannot; the dated readings and the corrected pair go to the history document",
    `The file floor catches a file LEAVING; this one catches a file being hollowed out in place,
which no file count can see. Re-run, never adjusted by arithmetic.`,
  ],
  "scripts/check-worker.mjs#4": [
    "NUMBER",
    "where the tolerance rule lives and why the first attempt went undetected locally; every count and date goes to the history document",
    `SET THROUGH \`check:floors\`' OWN TOLERANCE, after CI caught the first attempt. That attempt
read a percentage out of a comment in another gate and applied it to four floors: the rule
belongs to the gate that enforces it, and prose about a gate ages while the gate does not.

It went undetected locally because \`check:floors\` runs the whole offline tier and therefore
runs LAST, and the tier hung before it on this host. CI reached it on the first push.`,
  ],
  "scripts/check-worker.mjs#7": [
    "WHY",
    "why this scope floor is in the meta-gate",
    `THROUGH assertFloor. The worker test set only ever gets added to, so this is a scope floor over
a GROWING set: the measured value climbs away by itself and the gap widens with no edit. It
printed no floor line while it was a bare assertion, so the meta-gate had nothing to read.`,
  ],
  "scripts/check-worker.mjs#8": [
    "WHY",
    "what was observed, that the cause was not established, and why a contract rather than a better needle; the version, the banner lines and the refuted candidate go to the history document",
    `THE COUNTS COME FROM THE JSON REPORTER, NOT FROM THE HUMAN OUTPUT. The first version read the
totals off the default reporter with an anchored regex, and CI's first clean-checkout run caught
it: the tests RAN and passed, and the log carries none of the runner's stdout at all, so the gate
read no count and failed closed.

**THE CAUSE WAS NOT ESTABLISHED, and this comment does not invent one.** The obvious candidate
was checked and REFUTED, so whatever ate that stream is not reproducible here.

That is exactly why the repair is not a better regex. The mistake underneath is hard rule 10's
own: the needle was pointed at a HUMAN-FACING RENDERING, which is free to differ per environment
and did. The JSON reporter is a CONTRACT instead, read off a file this gate names itself.

BOTH REPORTERS RUN, because a person reading a failure wants the case name and the diff. IT
STILL DELEGATES, on the anti-mirror rule: package.json defines what this layer's run IS and the
flags only add an output format.`,
  ],
  "scripts/check-worker.mjs#11": [
    "NUMBER",
    "what this floors and why slack is zero; the measurement and its date go to the history document",
    `EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS. The case floor above covers what the
RUNNER ran; this covers the assertions this gate makes ABOUT that run, because if those stopped
running the case floor would stop being consulted and nothing would say so.

MEASURED BY RUNNING IT, never summed. Slack of ZERO: this gate asserts a fixed set of properties
about one run, so a drop is a removed assertion rather than natural movement.`,
  ],
  "scripts/build-diagrams.mjs#0": [
    "CONTRACT",
    "why build time, the gap it leaves, why the bytes are never gated and why two renders; the two engine errors and the ruling reference go to the history document",
    `Renders every \`:::diagram\` in the corpus to a static SVG asset.

  npm run build:diagrams [-- --force]

BUILD TIME ONLY, in Node, driving a real browser. That is the ruling and it was decided by
measurement: diagram layout needs real font metrics, so the DOM-shim renderers die on the text
measurement call. Charts pass the both-writers rule and render inline; diagrams cannot and take
the social-card pattern instead.

The gap that leaves is the same one social cards have and is recorded rather than papered over:
a diagram authored in the editor has no asset until this runs, and the post still renders with a
missing image, which is why the gate fails on a referenced asset that is not on disk.

Nothing here touches the gated artifact. The KEY is deterministic content; the SVG bytes come
out of a browser engine and are exactly the kind of input a byte-comparison gate must never be
handed.

TWO RENDERS PER DIAGRAM, LIGHT AND DARK. Forced, not chosen, and both halves were measured: the
renderer will not accept a custom property at all, and an SVG referenced by \`<img>\` is an
independent document, so even a successfully embedded one would resolve against nothing. This
site resolves its theme from a cookie rather than the OS, so a media query inside the asset
would hand a reader the wrong drawing.`,
  ],
  "scripts/build-diagrams.mjs#1": [
    "CONTRACT",
    "why it is set explicitly",
    `The id written onto the SVG root and prefixed onto every internal id. Set explicitly rather
than left to the tool's default, so the bytes do not move if that default does. Two diagrams on
one page cannot collide on it: each asset is its own document behind its own \`<img>\`.`,
  ],
  "scripts/build-diagrams.mjs#2": ["CONTRACT", "why fixed; one line already"],
  "scripts/build-diagrams.mjs#3": [
    "WHY",
    "why a recorded limitation rather than a solved problem",
    `The font stack the diagram is laid out with, and displayed in. A recorded limitation rather
than a solved problem: an SVG inside an \`<img>\` may not load external resources, so a diagram
cannot be set in the site's webfont without embedding it in every asset. The viewer's font is
therefore not guaranteed to be the one this build measured text with, which is why the padding
below is generous rather than default.`,
  ],
  "scripts/build-diagrams.mjs#4": ["CONTRACT", "the parameters plus where the colours came from; already short"],
  "scripts/build-diagrams.mjs#5": ["CONTRACT", "why this theme; two lines already"],
  "scripts/build-diagrams.mjs#6": ["CONTRACT", "why the audit exists; already short"],
  "scripts/build-diagrams.mjs#7": [
    "WHY",
    "what a foreignObject does inside an img",
    `Labels as real text, never \`<foreignObject>\`: the default wraps flowchart labels in one, and a
foreignObject is not rendered at all when an SVG is loaded through \`<img>\`, so every node would
come out blank on the page while looking correct in a standalone viewer.`,
  ],
  "scripts/build-diagrams.mjs#8": [
    "WHY",
    "why layout rather than taste; the measured widths go to the history document",
    `Tightened from the defaults, and the reason is layout rather than taste: the prose column is
narrow, so a wider drawing is scaled down and takes its type with it. Narrowing the gaps shrinks
the drawing without shrinking the text, which is the only lever that helps.`,
  ],
  "scripts/build-diagrams.mjs#9": ["WHY", "what the mirrored row costs; two lines already"],
  "scripts/build-diagrams.mjs#10": [
    "WHY",
    "what an img does with no intrinsic width, and why a targeted rewrite",
    `Makes the SVG sizeable by an \`<img>\`. The renderer emits a percentage width plus an inline
max-width, which inside an \`<img>\` is an SVG with no intrinsic width, so the browser falls back
to the default replaced-element size. The viewBox carries the real size, so it is copied onto
the root.

Done with a targeted rewrite of the ROOT TAG rather than by parsing and re-serialising: an
\`.svg\` is served as XML and parsed strictly, so a serialiser that emits one unclosed tag
produces a file that renders as nothing.

@param {string} svg
@param {string} label`,
  ],
  "scripts/build-diagrams.mjs#11": [
    "CONTRACT",
    "the three reasons, the first of them measured",
    `The renderer's own API against a browser this script owns, rather than its command line.
Three reasons, the first measured here: Node refuses to spawn the shim without a shell, and a
shell concatenates an argument array WITHOUT quoting, which has already split a value containing
spaces in this repo. One browser then serves every render instead of one launch per file, and
neither the source nor the config touches a temp file or a command line.

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
    `Prune. An upsert keyed by filename leaves a deleted diagram on disk forever, and the same
reasoning already applies to the Ask index: the write path alone is not enough, something has to
remove what the corpus no longer names.`,
  ],
  "scripts/build-diagrams.mjs#21": [
    "WHY",
    "what follows automatically and what cannot",
    `These assets are in the MEDIA INDEX, so rendering or pruning one changes what \`check:media\`
expects, and neither consequence should have to be remembered. The manifest is regenerated
automatically, being derived from the filesystem. The index itself cannot be, because the
rebuild needs the Worker's binding, so this can only say so, and saying it loudly is the point:
somebody was always going to hit this cold, with a red gate and no obvious cause.`,
  ],
  "scripts/lib/rss.mjs#0": [
    "CONTRACT",
    "why a separate process, what is counted, what the metric is and that it fails soft; the five killed runs and the dates go to the history document",
    `PEAK RESIDENT MEMORY OF A PROCESS TREE, sampled from outside it.

The tier runs its gates with a BLOCKING spawn, so while a gate runs this process cannot execute
a timer or read a pipe, and any sampler living in this event loop would record nothing for
exactly the span it exists to measure. So the sampler is a separate process writing to a FILE,
and the runner attributes each sample to whichever gate owned the clock.

WHY IT EXISTS: tier runs were killed by the OS for low memory, and every diagnosis was an
inference from which gate happened to be printing when the run died. A gate that is merely SLOW
and one holding a gigabyte look identical in a log of names and durations.

WHAT IS COUNTED, STATED PLAINLY: the whole descendant tree plus the root, summed, which includes
the runner's own resident set. Reporting the total is the honest form, because the number that
matters for an out-of-memory kill is what the machine was holding, and subtracting a baseline
would invent a figure nothing measured. Resident is not committed or virtual, and a process
paged out shrinks here without having freed anything.

FAILS SOFT, ALWAYS. A sampler that cannot start reports "not measured" and the tier runs as
before: this is an instrument, not a gate, and it must never be the reason a check run fails.`,
  ],
  "scripts/lib/rss.mjs#1": ["CONTRACT", "one platform; one line already"],
  "scripts/lib/rss.mjs#2": [
    "WHY",
    "the bare-name trap in the other direction",
    `BY ABSOLUTE PATH, never by bare name: a gate that spawns a tool by bare name is green in the
shell it was written in and absent in the one that ships, which a sibling gate paid for at a
ship step. The same trap is available here in the other direction.`,
  ],
  "scripts/lib/rss.mjs#3": [
    "CONTRACT",
    "why the walk is in the sampler and why it appends",
    `The sampling loop. Doing the descendant walk in the SAMPLER rather than in the reader means
the file already holds the answer, so a reader that starts late still gets correct history.

Appends per line and never truncates: a sample lost to a crash is a gap, and a gap is visible,
whereas a rewritten file would be empty in exactly the case worth reading.`,
  ],
  "scripts/lib/rss.mjs#7": ["CONTRACT", "the parameters; already short"],
  "scripts/lib/rss.mjs#8": [
    "WHY",
    "why the values are substituted; the silent no-op goes to the history document",
    `THE VALUES ARE SUBSTITUTED INTO THE SCRIPT, not passed after it: passed after, they are
consumed as arguments to the interpreter itself and the script sees nothing. Measured on the
first run, which started cleanly and wrote zero samples, which is the shape a silent no-op
takes.`,
  ],
  "scripts/lib/rss.mjs#9": [
    "WHY",
    "why not detached",
    `DETACHED IS WRONG HERE, and the reason is the bug this file is part of: a detached sampler
outlives a killed runner and becomes exactly the orphan the memory work exists to remove. It
stays a child, so the runner's own tree kill takes it too.`,
  ],
  "scripts/lib/rss.mjs#10": ["CONTRACT", "one line already; kept"],
  "scripts/lib/rss.mjs#11": [
    "CONTRACT",
    "why null rather than zero",
    `The peak sample inside a window, or null when nothing was sampled. A window with NO samples
returns null rather than 0, because zero is a measurement and "nobody looked" is not: a gate
faster than the sampling interval legitimately lands here.

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
    `THE PIDS OF THE MOST RECENT SAMPLED TREE. The sampler already walks the tree every tick to sum
it, so it writes the membership beside the total, which makes it the tree ORACLE as well as the
meter. That matters because the blocking spawn means this process cannot enumerate anything
while a gate runs, and afterwards its grandchildren are exactly the processes nobody recorded.

PIDS, NEVER NAMES. A sweep matching a process name on this machine would reach the user's own
browser and editor, which is not a cleanup, it is an outage. A pid is only meaningful while it
is alive and Windows reuses them, so a caller kills only what it can still see.

@param {string} outPath
@returns {number[]}`,
  ],
  "scripts/lib/rss.mjs#16": [
    "CONTRACT",
    "what a single sample misses, why a window and what the residual is; the killed run's figures go to the history document",
    `EVERY PID SEEN IN THE LAST WINDOW OF SAMPLING, as one set. Reading a single sample is right
for "what is the tree right now" and WRONG for cleaning up after a run that died: a run that
exhausted the machine left processes the final sample did not name, because the heavy ones had
been spawned minutes earlier and were still resident.

WHY A WINDOW RATHER THAN THE WHOLE FILE: WINDOWS REUSES PIDS, and this list is fed to a KILL.
The window is anchored to the LAST sample rather than to the clock, because the interesting case
is a file written by a run that died a while ago.

The window is a bound on the risk, not a proof against it: a caller kills only pids still alive,
and the residual, a pid reused inside the window, is accepted and stated rather than hidden. The
alternative, matching on NAMES, is worse by a wide margin.

@param {string} outPath
@param {number} windowMs how far back from the last sample to gather
@returns {number[]}`,
  ],
  "scripts/lib/strip-comments.mjs#0": [
    "CONTRACT",
    "the trap, the drift-in-strength argument, that the old boundary moved, why the weak forms stay and what is not this job; the six victims, the measurements and the dates go to the history document",
    `THE JS-SCAN COMMENT STRIPPER, in one place.

WHAT THIS IS FOR: a gate that searches source for a literal will find that literal in the PROSE
explaining why it is forbidden. Six gates here have hit it, and one passed every row for the
wrong reason. Stripping comments before matching is hard rule 10's discipline, and it was
implemented NINE TIMES. Nine copies of one job can drift in STRENGTH, which is the whole risk: a
copy weaker than its siblings does not fail, it passes for a reason nobody checks.

IT IS A TOKENIZER, AND THE OLD BOUNDARY MOVED WITH IT. This removed comments with a regex and
carried a colon guard so a URL inside a string was not read as one; that guard was load-bearing
and was also the shape of the boundary, since it could not protect a PROTOCOL-RELATIVE url whose
slashes follow a quote. **THAT IS NO LONGER TRUE, AND THE TESTS NOW ASSERT THE OPPOSITE**: a
string literal is consumed whole before any slash inside it is considered. A boundary note is a
claim that ages, per hard rule 7, and this one aged in the commit that changed the mechanism.

THE WEAK FORMS STAY ANYWAY, on a narrower argument: THIS IS A JAVASCRIPT TOKENIZER, so it reads
an apostrophe in SVG text as opening a string and a slash after an operator as opening a regex,
neither of which means anything in those formats. On today's fixtures neither costs anything, so
moving a weak reader onto this one needs a measurement rather than a tidy-up.

JOBS THAT ARE NOT THIS JOB: a string-aware scanner, a reader that needs \`//host\` inside strings
to survive, and the CSS readers where \`//\` is never a comment. Unifying different jobs is the
wrong cut.

@see test/strip-comments.test.mjs`,
  ],
  "scripts/lib/strip-comments.mjs#1": [
    "CONTRACT",
    "why one pass, what it understands, the regex heuristic and the unterminated rule; both dated rewrites and the measured counts go to the history document",
    `ONE LEFT-TO-RIGHT PASS, and both exported functions are it.

WHY ONE PASS: "is this a comment opener" is a question about everything to its left, and no
number of independent regex passes can answer it. This module learned that twice, once when
apostrophes inside double-quoted labels paired up across a single-quote pass, and once when a
slash-star inside a string opened a comment running to the next star-slash anywhere in the file.

The second fix could not live in one function alone, and THE DIFFERENTIAL IS WHAT SAID SO: the
string-blanking wrapper ran its own tokenizer, which does not understand REGEX LITERALS, so once
comments stopped mangling them the quotes inside character classes mispaired there instead.

WHAT IT UNDERSTANDS: string literals in all three quotes with escapes honoured, block and line
comments, and regex literals including a slash inside a character class.

A slash opens a regex when the previous significant character cannot END an expression, which is
the standard heuristic rather than a parser and is wrong only for a division whose left operand
ends in an operator. **It was adopted on a MEASUREMENT rather than on the argument**: without
it, one gate's own regex hid six assertion calls from the section that exists to catch invisible
assertions.

An UNTERMINATED literal of any kind is emitted verbatim to the end of the file rather than
swallowing it: a source that does not parse is a different problem, and eating the remainder is
the failure this module exists to remove.

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
text, and a multi-line template collapsing to two characters moved every line after it.`,
  ],
  "scripts/lib/strip-comments.mjs#5": ["CONTRACT", "what is copied whole; one line already"],
  "scripts/lib/strip-comments.mjs#6": ["CONTRACT", "why it falls through; two lines already"],
  "scripts/lib/strip-comments.mjs#7": ["CONTRACT", "what replaces a block comment; one line already"],
  "scripts/lib/strip-comments.mjs#8": [
    "WHY",
    "why the guard is gone",
    `A line comment. The colon guard is GONE and is not needed: it existed so a URL inside a string
was not read as a comment, and a string is consumed whole by the branch above, so a \`//\`
reaching here is in code.`,
  ],
  "scripts/lib/strip-comments.mjs#9": [
    "CONTRACT",
    "what the option is for; the gate that learned it goes to the history document",
    `Comments out, strings kept. \`preserveLines\` replaces a block comment with the NEWLINES IT
SPANNED rather than a space, so a multi-line anchor still matches across code that had a comment
between its lines and reported line numbers do not shift.

@param {string} source
@param {{ preserveLines?: boolean }} [options]
@returns {string}`,
  ],
  "scripts/lib/strip-comments.mjs#10": [
    "CONTRACT",
    "who needs it and why it is the same tokenizer",
    `Comments out, STRING LITERALS BLANKED as well. Two gates need this and both for the same
reason: they search for names that also appear inside ordinary strings, one quoting the very
patterns it hunts and the other reading files that name their own flags in user-facing copy.

The same tokenizer, with the strings blanked instead of copied. It used to be a separate
implementation that ran AFTER the stripper, which is how the two disagreed about regex literals.

@param {string} source
@returns {string}`,
  ],
};
