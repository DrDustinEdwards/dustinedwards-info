// Chunk 13: check-hook-scope 0-18, lib/tokens 0-20, check-charts 0-39, lib/readiness 0-17,
// build-icons 0-27.
//
// Wave 1's rule. check-hook-scope is the wave's one gate over a SECURITY GUARD's scope, and its
// cases are paired on purpose: each loosening alone would pass on a hook that had simply stopped
// checking. The pairing rule stays on every case; the measured bypasses go.
//
// lib/tokens carries the same narrowing three times over, once per stylesheet split, and each
// time the anti-vacuity floor is what caught it. The recurrence is the argument for the
// function, so it stays in one clause with its counts cut.
export default {
  "scripts/check-hook-scope.mjs#0": [
    "CONTRACT",
    "why a scope change is the dangerous edit, why the cases are paired, the boundary and why the interpreter is resolved; the ruling number, the ENOENT run and the deleted gate go to the history document",
    `Gate: the deploy hook blocks a deploy HERE and allows one elsewhere.

  npm run check:hook-scope

WHY IT EXISTS: the hook was scoped to this repo after it refused a deploy in a sibling repo,
which hard rule 16 has nothing to say about. A SCOPE CHANGE TO A GUARD IS THE MOST DANGEROUS
KIND OF EDIT THERE IS: the failure it introduces is SILENT and in the permissive direction, and
the only symptom is a deploy that should have been refused going through.

So both directions are replayed, and every case drives the REAL hook with a REAL payload and
reads its exit code. EVERY LOOSENING IS PAIRED WITH A CONTROL, because a loosening alone would
pass on a hook that had simply stopped checking.

BOUNDARY: it does NOT prove the harness invokes the hook at all, which is the settings file's
business: a hook unregistered there would pass every case here and protect nothing.

THE INTERPRETER IS RESOLVED, NOT NAMED. Spawning it by bare name made this a gate that depended
on the shell it was written in: green in every session whose harness supplies one, and ENOENT
from the shell that runs ship.

FAILS CLOSED on an unreadable hook, a missing interpreter or an unexpected exit code.`,
  ],
  "scripts/check-hook-scope.mjs#2": [
    "WHY",
    "why the resolution is a precondition rather than per case",
    `RESOLVED BEFORE THE FIRST CASE, and a failure is ONE line. Resolving inside the runner would
report a missing interpreter once per case, which is what the failing run looked like: six
failures describing the same single fact, none of which named it.`,
  ],
  "scripts/check-hook-scope.mjs#3": [
    "CONTRACT",
    "why the path gets its own const",
    `The path is bound to its own const rather than read off the object at the call site: the
runner is a hoisted declaration, so the compiler cannot carry the null check into a body that
could in principle run before it, and an assertion there would be the check written twice with
only one of them enforced.`,
  ],
  "scripts/check-hook-scope.mjs#4": [
    "CONTRACT",
    "what cwd is and what moves the command",
    `Run the hook against one command, from one working directory. \`cwd\` is what the payload
carries: the SESSION's directory, not the command's. The command's own \`cd\` is what moves it,
which is the whole subject of this gate.

@param {string} command
@param {string} cwd
@returns {number} the hook's exit code: 2 blocks, 0 allows`,
  ],
  "scripts/check-hook-scope.mjs#5": [
    "CONTRACT",
    "why the parent directory is derived; the case count and the sibling's name go to the history document",
    `The cases, each naming the defect it would catch. The parent directory is DERIVED rather than
written, so this reads correctly from any clone path, and the sibling is resolved whether or not
it exists, which is correct: a deploy into a directory that is not there fails at the shell
rather than at this guard.`,
  ],
  "scripts/check-hook-scope.mjs#6": [
    "WHY",
    "why the return path is derived, and what a fixture about the checkout's name asserts; the catching gate and the run go to the history document",
    `THE RETURN PATH IS DERIVED FROM THE CHECKOUT rather than written out. Caught on this case's
first run by the gate that replays the tier against a fresh extraction, where the written name
lands somewhere genuinely outside the repo, so the hook correctly ALLOWED and the case failed:
the hook was right and the fixture was wrong.

The case had been asserting something about the checkout's NAME rather than the behaviour under
test, which is a fixture that holds only while the world is arranged the way its author happened
to find it.`,
  ],
  "scripts/check-hook-scope.mjs#7": [
    "WHY",
    "the pairing rule, stated once for every pair below",
    `THE PAIR IS THE ASSERTION. The case above alone would pass on a hook that had simply stopped
blocking deploys, which is the failure the loosening could introduce and the one that is silent.
This is the same command with the flag removed, so the two differ in exactly the thing under
test and nothing else.`,
  ],
  "scripts/check-hook-scope.mjs#8": [
    "WHY",
    "what the semicolon did, in two lines; the exit code and the arm's message go to the history document",
    `THE SEMICOLON IS THE WHOLE CASE. The segment regex stopped at the first \`;\` ANYWHERE,
including one inside the quoted SQL, so the tail held an unterminated quote and no command could
be read off it: a read was refused for ending the way SQL normally ends.`,
  ],
  "scripts/check-hook-scope.mjs#9": [
    "WHY",
    "the pair, on the first pair's grounds",
    `THE PAIR. The case above alone would pass on a hook that had stopped reading these statements
at all, which is exactly what a widened segment regex could cause. Same shape, one verb
different.`,
  ],
  "scripts/check-hook-scope.mjs#10": [
    "WHY",
    "why refusing a read is still wrong",
    `USAGE TEXT IS NOT A STATEMENT: it carries no SQL, which is why it hit the unverifiable arm.
Refusing a read is the safe direction and is still wrong, because the workaround is a session
running these commands outside the guard.`,
  ],
  "scripts/check-hook-scope.mjs#11": [
    "WHY",
    "what an unresolvable path was read as, and why home; the ruling number goes to the history document",
    `\`cd ~\` USED TO BE UNRESOLVABLE: the hook returned nothing for it, the caller reads nothing as
INSIDE this repo, and a deploy anywhere reachable only by a tilde was refused for a rule that
has nothing to say about it. HOME, NOT A SIBLING PATH, deliberately: it is somewhere this gate
can name from any clone without assuming where the checkout sits.`,
  ],
  "scripts/check-hook-scope.mjs#12": [
    "WHY",
    "the unsafe way to implement the loosening",
    `THE PAIR FOR THE TILDE CASE, and it is the one that matters. Accepting shell variables is a
loosening, and the unsafe implementation lets an unresolved one normalise into a path that is
not this repo, read as OUTSIDE, and unblock a deploy. Expanding first and testing the RESULT is
what prevents that.`,
  ],
  "scripts/check-hook-scope.mjs#13": [
    "WHY",
    "why the word boundary failed, and why folding alone was not enough; every measured bypass and the date go to the history document",
    `THE EXECUTABLE-NAME CASES, added for a live bypass of all four arms at once. The bare word
matches INSIDE the executable's full name, because the dot is a word boundary, so the segment
capture began at the extension and every arm below reads a verb slot.

The case half is the same defect wearing Windows, and FOLDING THE CHECKER WAS NOT ENOUGH ON ITS
OWN: the hook opens with a CHEAP PREFILTER which ran first, matched neither spelling, and exited
before the folded checker was reached.`,
  ],
  "scripts/check-hook-scope.mjs#14": [
    "WHY",
    "why widening the name must not widen the scope",
    `THE CONTROL FOR THE CASE ABOVE. Widening the NAME must not widen the SCOPE: the ruling still
exempts a sibling repo, and a fix that blocked both would pass the case above while breaking
that repo's deploy.`,
  ],
  "scripts/check-hook-scope.mjs#15": [
    "WHY",
    "two owners of one needle, and what it cost",
    `THE PREFILTER CASE, which stayed green through the first attempt at the fix, because the
prefilter is a separate statement of the same needle and was still case-sensitive. Two owners of
one fact, and the cost was a fold that could not fire.`,
  ],
  "scripts/check-hook-scope.mjs#16": [
    "WHY",
    "why over-blocking is the cheapest wrong fix, and why the flag is not folded",
    `THE CONTROL FOR THE FOLD. A fold that over-blocks is the cheapest way to pass every blocking
case above while breaking the earlier loosening, and the flag is deliberately NOT folded,
because the argument parser reads flags case-sensitively and accepting a folded one would stand
the guard down for a flag wrangler itself would reject.`,
  ],
  "scripts/check-hook-scope.mjs#17": [
    "WHY",
    "why passes are printed too",
    `EACH VERDICT IS PRINTED, not only the failures: a guard whose replay says nothing when it
passes is a replay nobody reads, and the whole value here is that somebody changing the hook can
see both directions move.`,
  ],
  "scripts/check-hook-scope.mjs#18": [
    "NUMBER",
    "why a one-array gate needs this floor and why slack is zero; three dated counts go to the history document",
    `EXECUTED-COUNT FLOOR. Every case comes from one array, which is exactly the shape that fails
quietly: an array that stopped parsing would run zero cases and report a clean sweep of a
security guard.

MEASURED BY RUNNING IT. Slack of zero, because the set is a fixed enumeration of the ruling's
own cases and a drop is a removed case rather than natural movement.`,
  ],
  "scripts/lib/tokens.mjs#0": [
    "CONTRACT",
    "what it is for and why check:contrast keeps its own copy",
    `Reads the ratified colour tokens back out of the stylesheet that ships. Anything that needs a
colour at BUILD time resolves it from here rather than restating a hex, so a retuned token moves
the thing that uses it instead of quietly disagreeing with it.

\`check:contrast\` deliberately keeps its own copy of this parsing: it is the gate whose entire
design is that two independent sources argue, so sharing a reader would give the palette one
implementation to be wrong in rather than two to disagree.`,
  ],
  "scripts/lib/tokens.mjs#1": [
    "CONTRACT",
    "why the token block stayed put; the split's date goes to the history document",
    `The stylesheet that declares the TOKENS. Still one file, deliberately: this module and
\`check:contrast\` both parse this path, and moving the palette would have been a gate change
wearing a refactor's clothes.`,
  ],
  "scripts/lib/tokens.mjs#2": [
    "WHY",
    "why both entries must be followed, and that the floor caught it again; the two counts and the dates go to the history document",
    `THE ADMIN PLANE'S ENTRY. One stylesheet stopped being the whole site's when the admin parts
moved out so a public reader stops downloading them, and every gate that reasons about "the
stylesheets" has to follow BOTH entries or it silently narrows to the public plane.

It happened again, and it FAILED AGAIN RATHER THAN PASSING QUIETLY: a resolution scan dropped by
half and tripped its own floor. Two splits, two narrowings, two catches by the same assertion.

NOT the token block, which is why this constant is only ever used for the SWEEP.`,
  ],
  "scripts/lib/tokens.mjs#3": [
    "CONTRACT",
    "why this module is the source of the public order; the previous location goes to the history document",
    `The module that declares the PUBLIC stylesheet set, and its order: it matches on every route,
so its CSS imports are the sheets every page loads and the order they load in. Before it, the
order lived in \`@import\` statements at the bottom of the entry sheet, which is a position CSS
does not allow.`,
  ],
  "scripts/lib/tokens.mjs#4": [
    "CONTRACT",
    "why it exists, why derived, why imports come first; three narrowings, their counts and the Tailwind history go to the history document",
    `EVERY source stylesheet, in CASCADE ORDER, derived from the entries' own imports.

WHY THIS EXISTS: one stylesheet became an entry importing sixteen parts, and any gate that
reasoned about "the stylesheet" by reading that one path silently narrowed to the token block
the moment the split landed. Both victims FAILED rather than passing quietly, which is the
anti-vacuity floors doing their job.

DERIVED, NOT RESTATED: the order comes from the entry module's CSS imports and each file's own
\`@import\` lines, so adding a part means editing the file that loads it and nothing else. A
hand-kept list would go stale in exactly the direction that hides CSS from a gate.

THE PUBLIC ORDER MOVED OUT OF CSS, and this follows it. Those sheets were \`@import\` statements
at the BOTTOM of the entry, and CSS requires \`@import\` before every other rule, so a late
\`@import\` is dropped and they were surviving on a processor hoisting them. This function read
those \`@import\` lines, so left alone it would have returned a list with all of them missing.

IMPORTS COME BEFORE THE FILE THAT IMPORTS THEM: a file's imports are expanded first,
recursively, and then the file itself. That is not a convention here, it is what the browser
does.

@returns {string[]} absolute paths, in cascade order`,
  ],
  "scripts/lib/tokens.mjs#7": ["CONTRACT", "where the public cascade is read from; already short"],
  "scripts/lib/tokens.mjs#8": [
    "CONTRACT",
    "why both import forms",
    `Every stylesheet a module names, in source order. BOTH IMPORT FORMS, and the second is not
decoration: a bare import puts the sheet in that module's bundle, and a \`?url\` import hands back
a hashed URL for something to fetch later. A sheet reachable only through the second form is
still the site's CSS and still has to be graded.

@param {string} source @param {string} base`,
  ],
  "scripts/lib/tokens.mjs#9": [
    "WHY",
    "why route sheets are included and what is and is not claimed about order",
    `THEN THE ROUTE-SCOPED SHEETS. Public CSS stopped being one site-wide bundle when a route began
importing the sheets its own markup needs, which is the third time this function could have been
left reading a strict subset of the site's CSS.

ORDER BETWEEN ROUTES IS NOT MEANINGFUL and is not claimed to be, two routes never rendering at
once; they are sorted purely so the list is stable run to run. Order WITHIN a route is its import
order, which is a real cascade and is preserved.`,
  ],
  "scripts/lib/tokens.mjs#10": [
    "WHY",
    "why every module and not only routes",
    `EVERY MODULE UNDER the app directory, not just the routes: a stylesheet can be named by a
component as easily as by a route, and the one sheet fetched when a reader opens the palette is
referenced by a component alone. Scanning routes would have dropped it.`,
  ],
  "scripts/lib/tokens.mjs#12": [
    "WHY",
    "why the admin entry is placed by hand",
    `The admin entry FIRST among the non-root sheets, so an admin page's cascade is still
root-then-admin, which is what it loads; the route loop would otherwise interleave it. Named
rather than left to that loop, so the set does not silently narrow if the route stops importing
it.`,
  ],
  "scripts/lib/tokens.mjs#13": ["CONTRACT", "fail closed on a missing file; already short"],
  "scripts/lib/tokens.mjs#14": ["CONTRACT", "why one of them is a :not(); two lines already"],
  "scripts/lib/tokens.mjs#15": [
    "CONTRACT",
    "the two traps, both already paid for once",
    `Pulls the custom properties out of one rule block, located by the literal text of its
selector. Two traps, both already paid for once in \`check:contrast\`:

  1. Comments are stripped FIRST, because the token block's own comment spells out all three
     selectors, so searching the raw file finds the prose and parses whichever block follows it.
  2. CRLF is normalised FIRST: the file is not pinned by \`.gitattributes\` and this repo runs
     autocrlf, so a fresh clone gets CRLF and every multi-line selector match stops matching.

@param {string} label
@param {string} selector
@returns {Record<string, string>}`,
  ],
  "scripts/lib/tokens.mjs#17": ["WHY", "the zero-scope rule; one line already"],
  "scripts/lib/tokens.mjs#18": [
    "CONTRACT",
    "both fail-closed directions",
    `Fails closed twice over: on a token the stylesheet does not declare, and on a declared token
whose value is not a plain hex. A \`var()\` indirection would resolve in a browser and be
meaningless to a build-time renderer, so it has to be an error rather than a string passed along.

@param {Record<string, string>} nameMap keys are arbitrary, values are token names
@param {Record<string, string>} block output of tokenBlock
@param {string} label
@returns {Record<string, string>}`,
  ],
  "scripts/lib/tokens.mjs#20": [
    "CONTRACT",
    "why normalisation is needed",
    `Normalises a hex for comparison: the CSS toolchain rewrites long form to short, and the
diagram renderer writes some of its own output short, so a literal comparison reports colours
missing from output that carries them.

@param {string} hex`,
  ],
  "scripts/check-charts.mjs#0": [
    "CONTRACT",
    "the boundary, the four assertions and the scope note; the shiki incident and the corpus-gate aside go to the history document",
    `Gate for the chart directive.

BOUNDARY: determinism, Node-versus-Worker parity and the emitted contract. It bundles the chart
module ALONE, not the markdown pipeline, and never looks at a chart in a browser, so nothing here
sees whether a chart is legible or correctly scaled.

  1. DETERMINISM IN-PROCESS. Every fixture rendered many times must yield exactly one output.
  2. DETERMINISM ACROSS PROCESSES, because module-level state and hash-order effects only show
     up across process boundaries.
  3. NODE VERSUS WORKER PARITY. The two writers are a Node build script and a Worker, and the
     artifact must be byte-identical or the editor commits HTML the next build will not
     reproduce. The Worker half runs the SAME module under real workerd.
  4. THE DIRECTIVE CONTRACT: palette tokens only, an accessible name on the SVG, a generated
     data table, no legend, and a validation failure for every rule the contract states.

SCOPE NOTE: the parity run deliberately does NOT re-bundle the markdown pipeline, which would
drag in a WASM module and end up testing the bundler's wasm handling rather than the renderer.`,
  ],
  "scripts/check-charts.mjs#1": ["CONTRACT", "where the number comes from; one line already"],
  "scripts/check-charts.mjs#2": ["CONTRACT", "where the number comes from; one line already"],
  "scripts/check-charts.mjs#4": [
    "CONTRACT",
    "why every rule has a paired negative",
    `Asserts that rendering throws, and that the message names the reason. A rule with no paired
negative is not a verified rule.

@param {string} label
@param {Record<string, any>} attrs an omitted attribute is \`undefined\`, which
  is exactly what the directive hands over when an author leaves it out
@param {string} csv
@param {RegExp} expected`,
  ],
  "scripts/check-charts.mjs#5": ["CONTRACT", "why both shapes; already short"],
  "scripts/check-charts.mjs#7": ["CONTRACT", "one line already; kept"],
  "scripts/check-charts.mjs#10": ["CONTRACT", "one line already; kept"],
  "scripts/check-charts.mjs#11": ["CONTRACT", "why the same file; two lines already"],
  "scripts/check-charts.mjs#12": ["CONTRACT", "one line already; kept"],
  "scripts/check-charts.mjs#13": ["CONTRACT", "why the same conditions; two lines already"],
  "scripts/check-charts.mjs#14": ["WHY", "which comments come out first and why; already short"],
  "scripts/check-charts.mjs#15": [
    "WHY",
    "why weak is required and why weak is sufficient; the measurement goes to the history document",
    `WEAK ON PURPOSE. This is JSONC on its way to a parser, so the shared strong stripper must NOT
be used: its line-comment rule eats a protocol-relative url, whose slashes follow a quote rather
than a colon, and takes the rest of the line with it.

Weak is SUFFICIENT here, which is the other half: the parser throws on any comment this fails to
remove, so an under-strip cannot pass quietly.`,
  ],
  "scripts/check-charts.mjs#16": [
    "WHY",
    "why the converter rather than hand-built options; the version, the error and the date go to the history document",
    `THROUGH THE LIBRARY'S OWN CONVERTER, and the indirection is not decoration: a major version
reshaped the constructor and refuses the pair this used to pass. The library ships this converter
for exactly this case, so the options below stay in the shape a reader can compare against the
wrangler config beside them, and the translation is the library's rather than a hand-built copy
that would drift at the next reshape. Found by RUNNING, not by reading a changelog.`,
  ],
  "scripts/check-charts.mjs#18": [
    "NUMBER",
    "what an empty list would make agree, why input and output floors differ, and why exact here",
    `SCOPE FLOOR. Every block below iterates the fixtures, and an empty or shortened list makes all
three agree about nothing, with the two that compare hashes saying "identical" loudest.

The executed-count floor at the end catches a large truncation, but it is a floor on OUTPUT and
this is a floor on INPUT: they fail on different bugs, and a fixture list rebuilt shorter while
some other block grew would slip past the first.

EXACT rather than under, uniquely here, because this list is not measured, it is CONSTRUCTED:
the mark types crossed with the two shapes. It moves only when a mark type is added, which is a
deliberate edit to the array directly above.`,
  ],
  "scripts/check-charts.mjs#19": ["CONTRACT", "assertion 1; one line already"],
  "scripts/check-charts.mjs#22": ["CONTRACT", "assertion 2; one line already"],
  "scripts/check-charts.mjs#24": ["CONTRACT", "assertion 3; one line already"],
  "scripts/check-charts.mjs#25": ["CONTRACT", "assertion 4; one line already"],
  "scripts/check-charts.mjs#26": [
    "WHY",
    "why the name is on the SVG",
    `The name must be on the SVG, never on the figure: the image role makes its descendants
presentational, so naming the figure would hide the caption and the data table from the readers
the table exists for.`,
  ],
  "scripts/check-charts.mjs#27": [
    "WHY",
    "why the internal names must not surface",
    `The model reshapes data internally, and those names are an implementation detail that must
never surface as an axis label: the default would print the data structure rather than the thing
measured.`,
  ],
  "scripts/check-charts.mjs#28": ["CONTRACT", "why the arrow is optional; two lines already"],
  "scripts/check-charts.mjs#29": ["CONTRACT", "the ruled rule; one line already"],
  "scripts/check-charts.mjs#30": ["CONTRACT", "one line already; kept"],
  "scripts/check-charts.mjs#31": ["CONTRACT", "assertion 5; one line already"],
  "scripts/check-charts.mjs#32": ["CONTRACT", "assertion 6; one line already"],
  "scripts/check-charts.mjs#33": ["CONTRACT", "assertion 7; one line already"],
  "scripts/check-charts.mjs#34": [
    "WHY",
    "what an unhandled directive renders as; the ruling date goes to the history document",
    `Unknown directives fail closed. An unhandled directive is not inert: the renderer emits a bare
element, so a typo publishes a silent empty block where a figure was meant to be.`,
  ],
  "scripts/check-charts.mjs#36": ["WHY", "why the advertised escape must work; two lines already"],
  "scripts/check-charts.mjs#37": [
    "WHY",
    "why two assertions rather than one adjacency; the date and the old pattern go to the history document",
    `And the known ones still render, so the check is not simply refusing everything.

TWO ASSERTIONS RATHER THAN ONE ADJACENCY. This pinned two tags as neighbours and went red when
the pipeline started wrapping body images in a link: the figure rendered perfectly and the two
had simply stopped being adjacent. A control that pins markup BETWEEN the things it cares about
fails on changes it has no opinion about, and its label then names the wrong subject.`,
  ],
  "scripts/check-charts.mjs#38": [
    "NUMBER",
    "why an async gate is the shape most able to skip; both dated counts go to the history document",
    `EXECUTED-COUNT FLOOR. This gate is ASYNC and spawns a bundler and a worker runtime, which is
the shape most able to skip silently: an await that resolves to an empty fixture list, a parity
block that returns early, a determinism loop that runs zero renders. All of them leave the
failure count at zero.

MEASURED BY RUNNING IT, never summed. The count is a fixed function of the fixtures crossed with
the mark types and the planted negatives, so it moves only when one is added.`,
  ],
  "scripts/lib/readiness.mjs#0": [
    "CONTRACT",
    "why it is extracted, what five 200s are blind to and why the body rather than the status; the schedule aside goes to the history document",
    `Ship's readiness verdict: does the health endpoint say this deploy is healthy.

EXTRACTED because the decision is pure, \`node:test\` can drive every branch, and the alternative
is a branch that can only be exercised by running a real deploy. A refusal path that has never
been executed is not a refusal path.

WHAT THIS IS FOR: ship polled a page for five 200s and never asked the health endpoint, and
those are different questions. Five 200s prove the Worker booted, the route table resolves and
the rollout finished. They are blind to every invariant this site watches, all of which serve
that page with a 200.

THE VERDICT COMES FROM THE BODY, NOT THE STATUS LINE. They agree today, and reading the status
alone would make this step depend on an agreement that lives in a different file and is not this
module's to assume. Naming the failing checks is most of the value of refusing.`,
  ],
  "scripts/lib/readiness.mjs#2": ["CONTRACT", "the verdict shape; type annotation only"],
  "scripts/lib/readiness.mjs#3": ["CONTRACT", "one line already; kept"],
  "scripts/lib/readiness.mjs#4": [
    "CONTRACT",
    "why it fails closed everywhere, and what deferring is for; the ruling number and the dated ship go to the history document",
    `Reads a readiness verdict out of a response.

FAILS CLOSED IN EVERY UNCERTAIN DIRECTION, and the list is long because this value arrives over
a network from an endpoint that can be rate limited, replaced by a 404 page, or fronted by a
proxy. "I could not tell" and "it is healthy" must never take the same branch on the last step
before a production write.

DEFERRED CHECKS name the ones this step REPORTS but does not gate on, because asserting them
here would block the very step that repairs them: a ship once refused at readiness on a drift
the later sync is exactly what converges, leaving production serving a build whose index nothing
had updated. A deferred check is still printed, and ship asserts it AFTER the repair.

@param {number} status the HTTP status
@param {string} text the raw body
@param {string} path the path asked, for the messages
@param {string[]} deferred check names this step reports but does not gate on
@returns {ReadinessVerdict}`,
  ],
  "scripts/lib/readiness.mjs#5": [
    "WHY",
    "why the rate-limited case is separate",
    `A rate-limited answer IS CALLED OUT SEPARATELY, because a burst from this address can refuse
the check and "rate limited" and "unhealthy" need completely different repairs: collapsing them
would send somebody to look for a drifted index that is fine.`,
  ],
  "scripts/lib/readiness.mjs#9": [
    "WHY",
    "why an empty checks array is a refusal",
    `NO CHECKS IS A REFUSAL. A body carrying no verdicts is not a health report, so reading its
verdict field would be trusting one field of a shape nothing recognises: any JSON document on the
origin can carry that field by accident, and only a health report carries a checks array.
Requiring it is what stops this step passing on the wrong URL.`,
  ],
  "scripts/lib/readiness.mjs#10": [
    "WHY",
    "why the top-level field is not the subject",
    `A GATING CHECK DECIDES THIS STEP, and the endpoint's own verdict field is deliberately NOT the
subject: it reports failure when ANY check fails, deferred ones included, so reading it here
would reinstate the refusal the deferral removed.`,
  ],
  "scripts/lib/readiness.mjs#11": [
    "WHY",
    "why a self-disagreeing endpoint is refused",
    `The verdict is false and nothing is marked failing: an endpoint disagreeing with itself.
Refused, because two halves of a health report that do not agree cannot both be trusted, and
this is the last step before a write.`,
  ],
  "scripts/lib/readiness.mjs#12": [
    "CONTRACT",
    "why the counts print only sometimes",
    `One printable line per check, so a refusal and a pass show the same table. The counts print
only when the endpoint sent them, which it does for a FAILING drift check and nothing else; that
pair is the whole triage.

@param {HealthCheckRow[]} checks
@returns {string[]}`,
  ],
  "scripts/lib/readiness.mjs#13": [
    "CONTRACT",
    "why it is a function, that the meaning inverts, why a missing row is a miss and why the detail is absent; the ruling number goes to the history document",
    `The verdict on the DEFERRED checks, read after their repair steps have run. A function rather
than inline, so the plant that proves a body passes readiness and then fails HERE by name is
writable at all.

THE MEANING INVERTS BETWEEN THE TWO SITES, which is the whole design. At readiness a failing
deferred check means "the index is behind", the ordinary state of a corpus just committed. Here,
after its repair has run, the same row means THE REPAIR RAN AND DID NOT WORK.

A MISSING ROW IS A MISS, NOT A PASS: an endpoint that stopped reporting a check proves nothing
about it. THE DETAIL STRING IS NOT IN THESE MESSAGES because it is not on the wire: the public
body drops it DELIBERATELY, those strings carrying row counts and an object key on an
unauthenticated endpoint.

@param {HealthCheckRow[]} checks every row the endpoint returned
@param {Record<string, string>} deferred check name to the step that repairs it
@param {string} [path] for the messages
@returns {{ misses: string[], converged: string[] }}`,
  ],
  "scripts/lib/readiness.mjs#16": [
    "CONTRACT",
    "the rule, why a value per key and what still gates; both incidents, their versions and dates go to the history document",
    `CHECKS THE READINESS STEP REPORTS BUT DOES NOT GATE ON, each with the step that repairs it.

THE RULE: readiness gates only on checks whose repair is NOT a later ship step. A step that
refuses before its own remedy is a deadlock, and the remedy is the thing the refusal prevents
from running. Two checks forced it in turn, the second costing two deploys that both landed,
both refused here, and both synced nothing.

A VALUE PER KEY, naming the step, because the whole point of deferring is that something later
fixes it: a check with nothing to name does not belong here, which is the test to apply before
adding another.

STILL GATING, deliberately: the ones with no ship step that repairs them.`,
  ],
  "scripts/build-icons.mjs#0": [
    "CONTRACT",
    "that it is a generator, what proves its output, what nothing sees and why the builder is written down; the dated gates and the v4 supersession go to the history document",
    `Renders the icon suite from the ratified mark geometry.

  node scripts/build-icons.mjs --out <dir>

BOUNDARY: this is a GENERATOR, not a gate. It renders and asserts nothing about what is already
on disk. What proves its output is committed is the manifest comparison; what proves the output
itself is \`check:logo\`.

WHAT STILL NOTHING SEES: the SHAPE of a rendered raster. An icon whose tile is right and whose
mark is clipped, mirrored or drawn in the wrong purple passes every assertion in this repo. Eyes
remain the instrument for that.

WHY THIS EXISTS: the shipped icons came from a parametric builder that was never in this repo,
which was survivable while they never changed. The choice was to hand-edit binaries nobody could
reproduce, or to write the builder down. Path data is VERBATIM from the spec, the same source
the component and the fixtures come from, so a variation is a rebuild and never a hand edit.`,
  ],
  "scripts/build-icons.mjs#1": [
    "CONTRACT",
    "why there is no second constant",
    `The ratified dark-mode purple, transcribed from the spec. Its light twin is not a separate
constant here: since the SVG favicon became a tile, every use of that hex in this file is the
TILE.`,
  ],
  "scripts/build-icons.mjs#2": ["CONTRACT", "which token it is; one line already"],
  "scripts/build-icons.mjs#3": [
    "NUMBER",
    "what the tile cost and which sizes recover it; the three measured ratios and the ruling date go to the history document",
    `The mark hex for the FAVICON tiles only. The tile was adopted partly on the ground that it
gives the silhouette an edge at the smallest size. It does, and it also HALVED the mark's
contrast, which is the opposite of what that rationale predicted.

So the small tiles take the muted chrome token and recover most of the loss. The LARGE tiles
keep lavender: at that size the silhouette is not contrast-limited, and lavender is the ratified
mark variant. This is a legibility exception at the sizes that need it, not a second identity.`,
  ],
  "scripts/build-icons.mjs#4": [
    "CONTRACT",
    "where the paths come from and which carry a placeholder",
    `The eight paths in the spec's paint order, VERBATIM. The five purple ones carry a placeholder
the caller substitutes; the warm three are constant across every variant and are written as
their literals, exactly as the component does.`,
  ],
  "scripts/build-icons.mjs#5": [
    "CONTRACT",
    "why it is derived from the construction; the coordinates go to the history document",
    `The mark's INK bounding box in spec coordinates, derived from the CONSTRUCTION rather than
from the path control points, because the extremes are on ARCS and a control-point box would
crop the ring.`,
  ],
  "scripts/build-icons.mjs#6": ["CONTRACT", "the parameters; already short"],
  "scripts/build-icons.mjs#7": [
    "WHY",
    "why the longer dimension",
    `Fit by the LONGER ink dimension, so the padding is a real guarantee on both axes rather than
only on the one that happened to be measured.`,
  ],
  "scripts/build-icons.mjs#8": ["CONTRACT", "one line already; kept"],
  "scripts/build-icons.mjs#9": [
    "WHY",
    "which variable the query was keyed on and why a tile has no such dependency; the live demonstration and the ruling date go to the history document",
    `favicon.svg, a TILE like everything else, superseding the media-query version.

WHAT WAS WRONG WITH IT, and it was not a detail: the embedded query keyed on the OPERATING
SYSTEM's colour scheme, while the thing it was trying to survive is the TAB STRIP's colour, set
by the BROWSER THEME, which no media query can see. The two are independent, so the query
answered a question nobody asked.

A tile has no such dependency, which is the same argument that put every raster on a tile, and
it applies here more strongly: an SVG favicon renders small, so it takes the small-size
treatment. Same padding geometry as the rasters, from the same helper, so the two cannot drift.`,
  ],
  "scripts/build-icons.mjs#11": [
    "CONTRACT",
    "what the container holds and that it was measured",
    `An ICO is a CONTAINER. This writes the same structure the shipped file already uses, measured
before anything was regenerated. No size is added and none is dropped.

@param {Array<{ size: number, data: Buffer }>} images`,
  ],
  "scripts/build-icons.mjs#12": ["CONTRACT", "field label; one word already"],
  "scripts/build-icons.mjs#13": ["CONTRACT", "field label; one word already"],
  "scripts/build-icons.mjs#14": ["CONTRACT", "field label; already short"],
  "scripts/build-icons.mjs#15": ["CONTRACT", "field label; one word already"],
  "scripts/build-icons.mjs#16": ["CONTRACT", "field label; already short"],
  "scripts/build-icons.mjs#17": ["CONTRACT", "field label; one word already"],
  "scripts/build-icons.mjs#18": ["CONTRACT", "field label; already short"],
  "scripts/build-icons.mjs#19": ["CONTRACT", "field label; already short"],
  "scripts/build-icons.mjs#20": ["CONTRACT", "section marker, rule padding cut", `output`],
  "scripts/build-icons.mjs#22": ["CONTRACT", "why transparent; one line already"],
  "scripts/build-icons.mjs#23": ["CONTRACT", "why these sizes and that they are measured; two lines already"],
  "scripts/build-icons.mjs#24": [
    "WHY",
    "why the small tiles get less padding",
    `Small tiles get less padding: at the smallest size the silhouette needs the room, and the tile
is what gives it an edge in the first place.`,
  ],
  "scripts/build-icons.mjs#25": [
    "NUMBER",
    "why the padding is geometric rather than stylistic; the two candidate values and their headroom go to the history document",
    `Maskable: the launcher may crop to a CIRCLE, so the ink must fit inside that circle and not
merely inside a square. For ink of this aspect the DIAGONAL is what has to clear it, which is
why the padding here is much larger than the others and is NOT a style choice. The tighter
candidate left too little headroom for a spec launchers implement loosely.`,
  ],
  "scripts/build-icons.mjs#26": [
    "WHY",
    "why the manifest is regenerated here and only when writing to public; the ruling reference goes to the history document",
    `REGENERATE THE ASSET MANIFEST, because everything above writes into \`public/\` and the manifest
is derived from exactly that directory. There is no world in which a stale one is wanted, so it
is not left to be remembered: this script has no npm alias, is run by hand and rarely, and is the
only generator that adds NEW files rather than rewriting listed ones.

ONLY WHEN WRITING TO \`public/\`: with an output directory elsewhere this is rendering for
inspection, nothing under \`public/\` moved, and regenerating would be a side effect nobody asked
for. The media index itself still cannot be rebuilt from here, because it needs the Worker's
binding, and saying so loudly is all this can do.`,
  ],
  "scripts/build-icons.mjs#27": [
    "WHY",
    "why the cwd is pinned",
    `cwd pinned to the repo root: the manifest builder resolves its paths relative to the working
directory, so inheriting a caller's cwd would walk the wrong tree or write the artifact somewhere
nobody looks.`,
  ],
};
