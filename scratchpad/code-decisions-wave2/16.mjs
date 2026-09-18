// Chunk 16: wrangler-surface 0-11, lib/floor 0-4, check-media-axes 0-12,
// apply-config-ids 0-6, check-uptime 0-13, lib/colophon-facts 0-9, build-katex 0-14,
// lib/diagram-audit 0-15, lib/bash 0-12, check-d1-address 0-11.
//
// Written at wave 1's rate from the start rather than cut down to it: one line a block, a
// header of four to six with its invocation, separators keeping their label and losing their
// dashes, and every choice-justification deleted rather than compressed.
export default {
  "scripts/lib/wrangler-surface.mjs#0": [
    "CONTRACT",
    "what it enumerates and the two deliberate omissions; the move and its date go to the history document",
    `The Worker's binding surface, derived from a wrangler config. ONE enumerator, so two walkers of
the same config cannot disagree about what this Worker binds.

BOUNDARY: it knows the binding kinds it enumerates and reports the rest separately, because a
kind no reader understands is absent from both sides of every comparison built on this.`,
  ],
  "scripts/lib/wrangler-surface.mjs#1": [
    "CONTRACT",
    "what it converts; one line already",
    `JSONC to JSON. Comments only; these configs have no trailing commas.

@param {string} path
@returns {any}`,
  ],
  "scripts/lib/wrangler-surface.mjs#2": [
    "WHY",
    "why the weak stripper and why weak is enough; the measurement date goes to the history document",
    `WEAK ON PURPOSE, this being JSONC on its way to JSON.parse: the shared strong stripper's
line-comment rule eats a protocol-relative url and takes the rest of the line with it. Weak is
SUFFICIENT, because JSON.parse throws on any comment this fails to remove.`,
  ],
  "scripts/lib/wrangler-surface.mjs#3": [
    "CONTRACT",
    "one table so the two readers cannot disagree, and what the settings string omits",
    `How each binding kind is read, keyed by the config key that declares it. ONE table, so
\`surfaceOf\` and \`unhandledBindingKinds\` cannot disagree about what is handled. The settings
string omits account-scoped IDENTIFIERS, the tracked example carrying placeholders for those.

@type {Record<string, (config: any, out: Map<string, string>) => void>}`,
  ],
  "scripts/lib/wrangler-surface.mjs#4": [
    "WHY",
    "why the dataset name is compared; one line",
    `The dataset NAME is compared rather than omitted as account-scoped: it is the table the SQL
API reads, and two files disagreeing would have the Worker writing where nothing queries.`,
  ],
  "scripts/lib/wrangler-surface.mjs#5": [
    "WHY",
    "why the service name is compared; one line",
    `The SERVICE NAME is compared rather than omitted: it names which Worker is called, and two
files disagreeing would point the watchdog at nothing.`,
  ],
  "scripts/lib/wrangler-surface.mjs#6": [
    "WHY",
    "the key that differs and why restrictions are settings; the dates and the widening go to the history document",
    `Email Sending. KEYED BY \`name\`, NOT \`binding\`, which every other binding kind uses: that put
it through the detector's array arm unread, so it was invisible to the comparison AND to the
detector meant to catch exactly that. The RESTRICTIONS are settings, not just the name, since a
binding pinned in one file and unrestricted in the other describes a different blast radius.`,
  ],
  "scripts/lib/wrangler-surface.mjs#7": [
    "CONTRACT",
    "what it returns; one line already",
    `Every binding the config declares, as \`KIND:NAME\`, mapped to the settings that are not
account-scoped identifiers.

@param {any} config
@returns {Map<string, string>}`,
  ],
  "scripts/lib/wrangler-surface.mjs#9": [
    "CONTRACT",
    "why it exists, the three shapes, and the one key that matches none; the plant, the dates and the widening go to the history document",
    `Config keys that DECLARE BINDINGS and that \`surfaceOf\` cannot read. **The absence of this was
a live hole**: a kind no reader knows about produces no rows on either side of every comparison,
and a gate that compares two blind spots agrees with itself.

Detection is STRUCTURAL rather than a list of Cloudflare's products, so a binding type that does
not exist yet is still caught. A declaration is one of exactly three shapes:

  an object with a \`binding\`                     assets, images, browser
  an array of objects carrying \`binding\` or      d1, kv, r2, vectorize, ai,
    \`name\`                                         services, send_email
  an object with a \`bindings\` array              durable_objects, workflows

\`queues\` matches none of these, correctly: a consumer has no \`binding\` and is handled above.

@param {any} config
@returns {string[]}`,
  ],
  "scripts/lib/floor.mjs#0": [
    "CONTRACT",
    "what it owns and why it returns a string; the drift measurement, the ruling and the worked example go to the history document",
    `One owner for the floor comparison, and for the line that proves it ran.

BOUNDARY: it owns the COMPARISON and both MESSAGES and asserts nothing itself, returning a
string so each call site keeps its own reporter, and the success line it prints on a HOLDING
floor is what \`check:floors\` reads back. Making a shared helper assert instead would be the
tenth vacuity class of hard rule 10.`,
  ],
  "scripts/lib/floor.mjs#1": [
    "CONTRACT",
    "one owner for the spelling, and the anchoring constraint",
    `The machine-readable success line. One owner, so writer and reader cannot drift apart, and
anchored at the start of a line by \`check:floors\`, so this is never indented at a call site.`,
  ],
  "scripts/lib/floor.mjs#2": [
    "WHY",
    "why the gate is two segments and not a greedy run; the sha, the dates and the discovery go to the history document",
    `THE GATE IS THE FIRST TWO SEGMENTS, NOT A GREEDY RUN. With \`\\S+\` a floor NAME containing a
colon split in the wrong place, so \`check:browser\`'s floors parsed under a gate name of three
segments. The count comparison still read the right numbers; what broke was the assertion that
every floored gate PRINTED a floor, which reported that gate silent on every run. Non-greedy
alone would not do either: it would take the first segment as the gate.`,
  ],
  "scripts/lib/floor.mjs#3": [
    "CONTRACT",
    "the parameters, with the why-belongs-to-the-site rule kept",
    `Compare an executed count against its floor.

@param {string} gate the npm script name, e.g. "check:secrets"
@param {string} name what is being counted, unique within the gate
@param {number} executed the count the gate actually reached
@param {number} minimum the floor
@param {string} [why] this site's own reasoning, appended to the breach
  detail. Hard rule 17: flattening thirty bespoke explanations into one
  generic sentence would destroy the part that tells a reader what broke.
@returns {string | null} the breach detail for the caller's own reporter, or
  null when the floor holds`,
  ],
  "scripts/lib/floor.mjs#4": [
    "WHY",
    "why NaN reads as a breach; one line",
    `A NaN or a negative reads as a breach rather than a pass: a counter that has become undefined
is the failure this exists to catch, and \`NaN < minimum\` is false.`,
  ],
  "scripts/check-media-axes.mjs#0": [
    "CONTRACT",
    "the boundary, the derivation and the fail-closed rule; the defect, its production measurements and the dates go to the history document",
    `Gate: every listing axis \`listMediaPage\` declares actually REACHES SQL.

  npm run check:media-axes

BOUNDARY: a SOURCE gate. It proves the axis list is derived rather than restated and that the
forwarding is a spread rather than a hand-copied key list, but it does NOT run a query, so it
sees DROPPED, not MISBUILT.`,
  ],
  "scripts/check-media-axes.mjs#2": [
    "CONTRACT",
    "what it blanks and why length is preserved",
    `Blanks comments and string bodies so brace matching cannot be thrown by a \`{\` inside a doc
comment. Length is PRESERVED, so every offset computed on the stripped text indexes the original.

@param {string} src`,
  ],
  "scripts/check-media-axes.mjs#3": [
    "CONTRACT",
    "what it returns; one line already",
    `Returns the index just past the block opened at \`open\`.

@param {string} s
@param {number} open
@param {string} o
@param {string} c`,
  ],
  "scripts/check-media-axes.mjs#4": [
    "CONTRACT",
    "section marker, rule padding cut",
    `1. Derive the axis vocabulary from \`listMediaPage\`'s own signature.`,
  ],
  "scripts/check-media-axes.mjs#5": [
    "NUMBER",
    "the scope rule and where the number came from; the measurement date goes to the history document",
    `SCOPE NON-EMPTINESS, hard rule 10: every per-axis assertion below is vacuous if this list is
empty. The floor is the count MEASURED when this gate was written, so losing an axis from the
signature fails here rather than quietly shrinking the gate.`,
  ],
  "scripts/check-media-axes.mjs#6": ["CONTRACT", "section marker, rule padding cut", `2. Every declared axis is READ in listMediaPage's body.`],
  "scripts/check-media-axes.mjs#7": [
    "WHY",
    "why helpers are followed and why by shape; the first run's false accusations go to the history document",
    `THE OPTIONS OBJECT IS FOLLOWED INTO HELPERS, because an axis is just as consumed when the whole
object is handed on. Matched by SHAPE rather than by the spelling that exists today: any
\`name(options)\` call pulls that function's body into the searched text.`,
  ],
  "scripts/check-media-axes.mjs#8": [
    "WHY",
    "why the parameter list is stepped over; the named example goes to the history document",
    `Step over the PARAMETER LIST before looking for the body: a helper whose options are typed
inline carries a \`{\` in its own signature, and that type mentions every axis name and reads none
of them, so the naive offset accused them anyway.`,
  ],
  "scripts/check-media-axes.mjs#9": ["CONTRACT", "section marker, rule padding cut", `3. listMedia's options type is DERIVED, not restated.`],
  "scripts/check-media-axes.mjs#10": [
    "CONTRACT",
    "section marker, rule padding cut",
    `4. Every axis actually reaches the call. NAMES the ones that do not.`,
  ],
  "scripts/check-media-axes.mjs#11": [
    "WHY",
    "what a spread covers and what the plant exercises",
    `A spread forwards the whole object, so it covers every axis by construction; without one only
the keys written out arrive, and the gate NAMES the rest. That is what the plant exercises.`,
  ],
  "scripts/check-media-axes.mjs#12": [
    "NUMBER",
    "how it was measured and why the slack; the date and the arithmetic mistake go to the history document",
    `EXECUTED-COUNT FLOOR, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed and
never the value first written here from counting the source by eye. The slack is two, so
retiring a genuinely dead axis does not fail the floor while dropping a whole BLOCK still does.`,
  ],
  "scripts/apply-config-ids.mjs#0": [
    "CONTRACT",
    "what it patches, why not the whole file, and the five refusals; the dates, the secret's history and the panel symptom go to the history document",
    `Puts the redacted values into the bootstrapped wrangler configs, for CI only.

  node scripts/apply-config-ids.mjs

BOUNDARY: it patches named placeholders by text and REFUSES rather than patching partially, five
ways, each named. It never prints an id, only which field was patched, and it never
parse-and-reserialises, which would strip comments this repo's configs depend on.`,
  ],
  "scripts/apply-config-ids.mjs#2": [
    "CONTRACT",
    "what the list is and what a change to the example does",
    `The placeholders the tracked example carries, stated as the values this script expects to
REPLACE, so a change to the example fails loudly here rather than leaving a deploy bound to a
database that does not exist.`,
  ],
  "scripts/apply-config-ids.mjs#3": [
    "WHY",
    "why the needle carries the key; the dates, the stopped deploy and the control go to the history document",
    `The needle for one field: its JSON KEY and its placeholder together. The placeholder alone was
unambiguous only while every placeholder differed, and two fields legitimately share a value of
thirty-two zeros, so the occurrence count became 2 and this refused every run. That refusal was
RIGHT, which is why the defect was a stopped deploy rather than a Worker bound to the wrong
namespace; what was missing was a needle specific enough for two fields to share a value.

@param {{ key: string, placeholder: string }} field`,
  ],
  "scripts/apply-config-ids.mjs#4": ["CONTRACT", "what the list is; one line already"],
  "scripts/apply-config-ids.mjs#5": [
    "WHY",
    "why the count comes first; one line",
    `Counted before replacing: \`replace\` on a string swaps the FIRST match and reports nothing, so
a needle appearing twice would leave one behind and this would print success.`,
  ],
  "scripts/apply-config-ids.mjs#6": [
    "WHY",
    "why the read-back; one line already",
    `READ BACK, because a write that did not take is the failure this file exists to prevent and is
invisible from the exit code of writeFileSync.`,
  ],
  "scripts/check-uptime.mjs#0": [
    "CONTRACT",
    "the boundary, the three-way comparison and the fail-closed rule; nothing here is dated",
    `Gate: both monitors this repo asks for EXIST, are NOT PAUSED, and point at the CURRENT hostname.

  npm run check:uptime

BOUNDARY: it reads UptimeRobot's record of its own configuration, so it does NOT prove a check
has ever run, that an alert would be delivered, or that the mailbox is read. It is also not a
check that the site is up: a DOWN monitor is one doing its job. NETWORK ONLY.`,
  ],
  "scripts/check-uptime.mjs#2": ["CONTRACT", "section marker, rule padding cut", `fail closed first`],
  "scripts/check-uptime.mjs#4": [
    "WHY",
    "the scope rule; one line",
    `SCOPE IS PROVEN NON-EMPTY BEFORE ANYTHING IS COMPARED (hard rule 10): an empty desired list or
an empty manifest would make every loop below report a clean sweep of a set it never looked at.`,
  ],
  "scripts/check-uptime.mjs#5": ["CONTRACT", "section marker, rule padding cut", `code vs manifest (hostname)`],
  "scripts/check-uptime.mjs#6": ["CONTRACT", "section marker, rule padding cut", `manifest vs live`],
  "scripts/check-uptime.mjs#7": [
    "WHY",
    "why by id and which direction matters; the measured window goes to the history document",
    `READ BY ID, NEVER OFF THE LIST: the list endpoint has been measured disagreeing with the
addressed read in both directions after a status change, and the direction that matters is a
list still reporting a monitor as running after somebody paused it.`,
  ],
  "scripts/check-uptime.mjs#9": ["CONTRACT", "trailing note; one line already"],
  "scripts/check-uptime.mjs#10": [
    "WHY",
    "why the reads are counted and how it pairs with the floor",
    `THE READS ACTUALLY HAPPENED (hard rule 10, prove scope non-empty). Every per-monitor assertion
lives inside a loop, and a loop that iterated nothing reports what a clean sweep reports. Paired
with the floor rather than replacing it: that counts ASSERTIONS, this counts what they were about.`,
  ],
  "scripts/check-uptime.mjs#11": [
    "NUMBER",
    "how it was measured and why a little under; the shape of the two monitors goes to the history document",
    `EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE, never summed: the two monitors contribute
a different number of assertions each. Floored a little under, so one added assertion does not
have to move it and a monitor dropping out of the desired set shows up as a smaller number.`,
  ],
  "scripts/check-uptime.mjs#12": [
    "NUMBER",
    "why this is the slackest legal value; the dates, the first value and the tier accident go to the history document",
    `RE-MEASURED BY RUNNING IT. The first value was refused by \`check:floors\` for too wide a gap,
and only inside \`check:all\`: this gate is network-tiered, so the offline tier that
\`check:floors\` runs standalone never reaches it. This is the slackest legal value.`,
  ],
  "scripts/check-uptime.mjs#13": [
    "WHY",
    "why exitCode and where exit is still safe; the measurement, its date and the libuv assertion go to the history document",
    `\`exitCode\` RATHER THAN \`process.exit()\`, a Windows correctness fix: exit tears the process down
while undici's keep-alive sockets are still closing, and a gate that prints a clean pass and
exits 127 is a FAILING gate to \`check-all.mjs\`, which reads exit codes. The two fail-closed
branches above still exit directly and are safe, both running BEFORE any fetch.`,
  ],
  "scripts/lib/colophon-facts.mjs#0": [
    "CONTRACT",
    "why a module, and why it is not derived; the shipped defect, the crash and the ship window go to the history document",
    `Every discrete fact each colophon section's RECORD BODY was assembled from, as needles to match
against the RENDERED page.

BOUNDARY: these are authored independently of the record body rather than derived from it,
because hard rule 10 is that a gate whose expected values are produced by the process it checks
cannot fail, so the test asserts COVERAGE of the section set rather than equality of the values.

@see app/lib/colophon-sections.mjs, scripts/verify-live.mjs`,
  ],
  "scripts/lib/colophon-facts.mjs#1": [
    "WHY",
    "why element-delimited; the named substring case goes to the history document",
    `Element-delimited, so a token cannot pass on a neighbour's substring: one dependency name is a
substring of two others, so a bare \`includes\` survives its entry being dropped entirely.

@param {string} v`,
  ],
  "scripts/lib/colophon-facts.mjs#2": [
    "CONTRACT",
    "what it reads and the two matching constraints; the status-label defect and its date go to the history document",
    `The fact needles for one section, read from the same two JSON files the page renders.

The status is swept through \`statusLabel()\` rather than as a literal, so this cannot drift from
what the page renders; the raw enum was indexed while the page rendered a label, and for one
value the token was on the page in no casing at all. Callers match these against HTML that has
had comments stripped and character references decoded.

@param {any} stack    content/generated/stack.json
@param {any} features content/features.json
@param {string} id    a section id from COLOPHON_SECTIONS
@returns {string[]}`,
  ],
  "scripts/lib/colophon-facts.mjs#6": [
    "CONTRACT",
    "why the sentences and why the same constant; the crash goes to the history document",
    `The sentences themselves, from the SAME constant the record body is built from; the page
renders each as its own \`<p>\`, so the element delimiters are exact.`,
  ],
  "scripts/lib/colophon-facts.mjs#7": [
    "CONTRACT",
    "identical treatment to the section above; the ship-window history goes to the history document",
    `Identical treatment to the section above, and from the same constant.`,
  ],
  "scripts/lib/colophon-facts.mjs#9": [
    "WHY",
    "why it fails closed and why it is kept beside the test",
    `Fail closed: a section added with no rule here would be swept as its lead alone, which passes
and proves nothing about the content underneath it. KEPT even though a test catches the omission
offline, the test being the early warning and this the guarantee.`,
  ],
  "scripts/build-katex.mjs#0": [
    "CONTRACT",
    "the two reasons it is derived, where the output lives and the byte comparison; the measured file counts and the date go to the history document",
    `Derives the math stylesheet and its faces from the installed \`katex\` package.

  npm run build:katex

BOUNDARY: importing the upstream sheet from a component would land it in one route's stylesheet
for every post, most of which carry no math, and hard rule 4 asks for the bytes a reader
downloads; it would also ship three font formats where every supported browser reads one. The
output is committed and \`check:content\` byte-compares it.`,
  ],
  "scripts/build-katex.mjs#1": ["CONTRACT", "what the file is; one line already"],
  "scripts/build-katex.mjs#2": ["CONTRACT", "what the marker separates; one line already"],
  "scripts/build-katex.mjs#3": ["CONTRACT", "read rather than restated; one line already"],
  "scripts/build-katex.mjs#4": [
    "WHY",
    "why anchored on the format keyword and why a sourceless face is left alone",
    `A \`src:\` list with everything but woff2 removed. ANCHORED on the format keyword rather than on
the extension, which appears inside the filename too, and hard rule 10 spends a paragraph on
the unanchored needle. A face declaring NO woff2 source is left ALONE and reported by the
caller: dropping every source it has would be a silent removal of the face.

@param {string} src the contents of one \`src:\` declaration
@returns {string | null} the trimmed list, or null when there is no woff2`,
  ],
  "scripts/build-katex.mjs#5": [
    "CONTRACT",
    "what it returns; one line already",
    `The stylesheet, with the legacy formats stripped and the font urls pointed at the copies this
script writes.

@param {string} css the contents of katex.min.css
@returns {{ css: string, faces: string[], untrimmed: string[] }}`,
  ],
  "scripts/build-katex.mjs#6": ["CONTRACT", "what the set holds; one line already"],
  "scripts/build-katex.mjs#7": ["CONTRACT", "what the list holds; one line already"],
  "scripts/build-katex.mjs#8": [
    "WHY",
    "why the rewrite runs over the whole sheet",
    `The url rewrite runs over the WHOLE stylesheet after trimming, so a woff2 url surviving outside
an @font-face block is caught too, and every match is recorded, which is what makes the
copied-every-font assertion below a measurement rather than a hope.`,
  ],
  "scripts/build-katex.mjs#9": [
    "CONTRACT",
    "why it is exported; one line already",
    `The stylesheet exactly as it should be on disk, header included. Exported so \`check:content\`
can derive it and byte-compare without shelling out to this script.`,
  ],
  "scripts/build-katex.mjs#10": [
    "WHY",
    "why appended and why read from their own file",
    `The overrides are APPENDED rather than left as a second link, so a math post costs one request,
and they are read from their own file so the hand-written rules have one editable home.`,
  ],
  "scripts/build-katex.mjs#11": ["CONTRACT", "what it hashes; one line already"],
  "scripts/build-katex.mjs#12": [
    "WHY",
    "why replaced rather than merged",
    `The font directory is REPLACED, not merged: a face removed upstream would otherwise stay on
disk forever, and the next reader could not tell whether it mattered.`,
  ],
  "scripts/build-katex.mjs#13": [
    "WHY",
    "both directions; one line",
    `BOTH DIRECTIONS: the loop above proves every named face was copied, this proves nothing else is
in the directory, and a one-directional copy is how a stale face survives a version bump.`,
  ],
  "scripts/build-katex.mjs#14": [
    "WHY",
    "why pathToFileURL; the host measurement goes to the history document",
    `\`pathToFileURL\`, not a hand-rolled comparison: on this host the two spellings differ in their
slashes, so the hand-rolled form is false forever and the build step exits 0 having written
nothing.`,
  ],
  "scripts/lib/diagram-audit.mjs#0": [
    "CONTRACT",
    "the two callers, what reachability means and why the cascade clause; nothing here is dated",
    `The tokens-only audit over a rendered diagram SVG, run by the build on every asset it writes and
by the gate over every asset already committed.

BOUNDARY: it asserts that every colour a reader can SEE comes from the palette, computing
reachability structurally rather than from an allowlist, so what it cannot judge is a rule or an
attribute this document never paints with.`,
  ],
  "scripts/lib/diagram-audit.mjs#1": ["CONTRACT", "what the set holds; one line already"],
  "scripts/lib/diagram-audit.mjs#2": [
    "CONTRACT",
    "why currentColor is included",
    `Values that name no colour at all. \`currentColor\` is included because it resolves to the
\`color\` property, which is itself audited wherever it is set.`,
  ],
  "scripts/lib/diagram-audit.mjs#3": [
    "WHY",
    "why brace depth and not a split",
    `Splits a stylesheet into top level rules by BRACE DEPTH, not by splitting on \`}\`: mermaid's
stylesheet opens with at-rules whose bodies a naive split cuts into fragments.

@param {string} text
@returns {Array<{ selector: string, body: string }>}`,
  ],
  "scripts/lib/diagram-audit.mjs#5": [
    "CONTRACT",
    "what it returns; one line already",
    `Every colour-carrying declaration in a rule body or an inline style.

@param {string} body
@returns {Array<{ property: string, value: string }>}`,
  ],
  "scripts/lib/diagram-audit.mjs#7": [
    "WHY",
    "what fail-closed by construction catches; the emitted forms go to the history document",
    `Decides whether one colour value is allowed, fail closed by construction: the value must BE a
palette colour, a keyword naming no colour, or a paint reference. Anything else is reported,
which is what catches the forms a hex-hunting regex misses.

@param {string} value
@param {Set<string>} palette normalised hexes`,
  ],
  "scripts/lib/diagram-audit.mjs#8": [
    "CONTRACT",
    "what it audits against; one line already",
    `Audits one rendered SVG against one theme's resolved palette.

@param {string} svg
@param {string[]} paletteHexes every colour this theme is allowed to use
@returns {{ checked: number, skippedRules: number, overridden: number, problems: string[] }}`,
  ],
  "scripts/lib/diagram-audit.mjs#10": [
    "CONTRACT",
    "section marker plus why the rules are kept",
    `The stylesheet mermaid embeds. Kept afterwards as well, so the attribute pass can ask which
properties a rule takes over for a given element.`,
  ],
  "scripts/lib/diagram-audit.mjs#12": [
    "WHY",
    "fail-closed direction; one line already",
    `A selector this parser cannot evaluate is treated as reachable, so an unreadable rule fails
loudly rather than passing by default.`,
  ],
  "scripts/lib/diagram-audit.mjs#13": [
    "CONTRACT",
    "what it answers; one line already",
    `Whether a stylesheet rule takes this property over on this element, which is what makes a
presentation attribute dead rather than shipped.

@param {any} element
@param {string} property`,
  ],
  "scripts/lib/diagram-audit.mjs#14": [
    "CONTRACT",
    "section marker plus the defs rule",
    `Attributes and inline styles on drawn elements. Anything inside a \`<defs>\` subtree nothing
points at is never painted; the markers that draw arrowheads ARE pointed at, so they are audited.`,
  ],
  "scripts/lib/bash.mjs#0": [
    "CONTRACT",
    "the candidate order, why a walk, and the proof-by-running rule; the defect, its date and the measured paths go to the history document",
    `Resolving the bash binary a gate needs, ONCE, from any shell, because a bare name is on PATH
under git bash and absent under the PowerShell that runs ship.

BOUNDARY: every candidate is PROVEN BY RUNNING IT rather than by existing on disk, and it FAILS
CLOSED, returning null so the caller prints one line instead of a spawn error per case.`,
  ],
  "scripts/lib/bash.mjs#1": [
    "WHY",
    "why forward slashes; one line",
    `The default Git for Windows install location, spelled with forward slashes: Windows resolves
either, and a forward-slash literal cannot be damaged by a scripted edit the way a backslash can.`,
  ],
  "scripts/lib/bash.mjs#2": ["CONTRACT", "what the limit bounds; one line already"],
  "scripts/lib/bash.mjs#4": [
    "CONTRACT",
    "what it returns; one line already",
    `Where \`git --exec-path\` says git lives, or null if git cannot be asked.

@returns {string | null}`,
  ],
  "scripts/lib/bash.mjs#5": [
    "WHY",
    "why no shell; one line already",
    `No \`shell: true\`: \`git\` is a real executable rather than a \`.cmd\` shim, so it spawns directly
on Windows, which is how every other gate here already calls it.`,
  ],
  "scripts/lib/bash.mjs#6": [
    "CONTRACT",
    "why deduplicated; one line already",
    `Every place a bash might be, in the order they are tried. Deduplicated on the path, so a
machine where the walk and the literal default agree does not probe the same binary twice.

@returns {{ path: string, source: string }[]}`,
  ],
  "scripts/lib/bash.mjs#8": [
    "WHY",
    "why the walk terminates; one line already",
    `dirname of a root returns the root, so the walk stops rather than spinning at the top of the drive.`,
  ],
  "scripts/lib/bash.mjs#10": [
    "CONTRACT",
    "what it answers; one line already",
    `Whether this candidate can actually run a program.

@param {string} path
@returns {boolean}`,
  ],
  "scripts/lib/bash.mjs#11": [
    "WHY",
    "why memoised including the null",
    `The first candidate that runs, or null if none does. Memoised INCLUDING THE NULL: a gate that
drives a hook once per case must not pay a process-spawning search per case, and a machine with
no bash must not be searched repeatedly to be told the same thing.

@returns {{ path: string, source: string } | null}`,
  ],
  "scripts/lib/bash.mjs#12": [
    "WHY",
    "why the candidates are in the message",
    `The ONE line a caller prints when nothing ran, and the candidates under it: "bash could not be
found" with no places named is unactionable, the reader being unable to tell a machine with no
git from one whose Git install is somewhere this does not look.

@returns {string}`,
  ],
  "scripts/check-d1-address.mjs#0": [
    "CONTRACT",
    "what is refused and what is allowed, plus the two scan rules; the defect, the run id and the dates go to the history document",
    `Gate: no script addresses the site database BY NAME for a remote operation.

  npm run check:d1-address

BOUNDARY: a per-file scan over comment-stripped source, with scope proven non-empty first,
which is hard rule 10. \`--local\` is allowed deliberately, Miniflare keying state by the config
id, and so are the lookup itself and the migrations path.`,
  ],
  "scripts/check-d1-address.mjs#1": ["CONTRACT", "read from its one owner; one line already"],
  "scripts/check-d1-address.mjs#2": [
    "CONTRACT",
    "why enumerated and argued",
    `Files whose \`d1\` strings are FIXTURES, never invocations. ENUMERATED AND ARGUED, never a glob:
an exclusion naming a file excludes everything in it, so each states why the rule does not reach
it.`,
  ],
  "scripts/check-d1-address.mjs#6": [
    "WHY",
    "why two forms and which subcommands cannot match",
    `A \`d1\` subcommand followed by the database NAME, in either spelling: the literal and the
interpolation several scripts bind to it, because a needle for the literal alone would miss
every site of the second kind. \`d1 list\` cannot match, taking no database argument.`,
  ],
  "scripts/check-d1-address.mjs#7": [
    "WHY",
    "where the boundary goes and why; the wrong counts and how it was caught go to the history document",
    `THE WORD BOUNDARY GOES INSIDE THE FIRST ALTERNATIVE, NOT AFTER THE GROUP. A trailing \`\\b\` can
never match the interpolated alternative, \`}\` being a non-word character followed by a space,
so the needle was BLIND to most of the sites and read as a nearly clean repo. Caught by counting
the sites and disbelieving the number, which is why the count is printed.`,
  ],
  "scripts/check-d1-address.mjs#8": ["CONTRACT", "what the set holds; one line already"],
  "scripts/check-d1-address.mjs#9": [
    "WHY",
    "why preserveLines; one line",
    `\`preserveLines\`, because a reported line number that does not match the file sends the reader
to the wrong place with confidence.`,
  ],
  "scripts/check-d1-address.mjs#10": [
    "WHY",
    "why the flag is read from the line",
    `\`--local\` ON THE SAME LINE is what makes the name correct, read from the line rather than the
file so a \`--local\` belonging to another command cannot license this one.`,
  ],
  "scripts/check-d1-address.mjs#11": [
    "NUMBER",
    "why the sites are counted separately from the floor",
    `THE SITES ARE COUNTED AND THE COUNT IS PRINTED, because "0 violations" and "0 lines examined"
are otherwise the same output. Every assertion here comes from a site, so the scope assertion is
separate and unconditional.`,
  ],
};
