// Chunk 18: lib/d1-address 0-5, check-volumes 0-10, extract-publication-text 0-6, lib/python
// 0-7, lib/ask-converge 0-8, build-template-refs 0-9, lib/ci-status 0-4, lib/raster 0-11,
// lib/content 0-7, build-enhance 0-4, require-clean-tree 0-2, lib/retry 0-7, fetch-cited-by
// 0-9, build-publication-twins 0-6, lib/dev-vars 0-4, lib/sqlite-tables 0-3,
// lib/wrangler-config 0-7, lib/artifact 0-4.
//
// Written at wave 1's rate. These are the small shared modules, so most blocks are already a
// line of contract and the cut falls almost entirely on the headers.
export default {
  "scripts/lib/d1-address.mjs#0": [
    "CONTRACT",
    "the rule, why --local keeps the name, and the fail-closed direction; the defect, the run id and the dates go to the history document",
    `How a script ADDRESSES the site database, which is not always its name: a remote operation takes
the account-side UUID, because the by-name spelling resolves through a config a clean checkout
bootstraps with a placeholder.

BOUNDARY: \`--local\` keeps the NAME deliberately, Miniflare having no account-side UUID to
resolve, and a lookup that cannot produce one THROWS rather than falling back, which would be
hard rule 13's substituted value wearing a passing lookup.

@see scripts/check-d1-address.mjs, which refuses the by-name spelling`,
  ],
  "scripts/lib/d1-address.mjs#1": [
    "WHY",
    "why self-contained and why run is still an argument; the call-site count goes to the history document",
    `The default lookup, self-contained on purpose: threading the caller's runner through every call
site would be nine bespoke wirings of one fact, and two of them are inside a callback with no
runner in scope. \`run\` remains an argument, because two gates already have runners carrying
their own cwd and buffer settings.

@param {string} command`,
  ],
  "scripts/lib/d1-address.mjs#2": [
    "WHY",
    "why memoised and why it is safe",
    `MEMOISED PER PROCESS, per database: one script addresses the database five times in a run, and
an account lookup per call site would be five round trips to answer one unchanging question. The
answer cannot change mid-run, a database not getting a new UUID while a script talks to it.

@type {Map<string, string>}`,
  ],
  "scripts/lib/d1-address.mjs#3": [
    "CONTRACT",
    "what it returns; one line already",
    `The account-side UUID for a database, or the name when the target is local.

@param {string} dbName the database name, as \`wrangler.jsonc\` spells it
@param {string} target \`--remote\` or \`--local\`
@param {(command: string) => { status: number | null, stdout: string }} [run]
@returns {string} a UUID for a remote target, the name for a local one`,
  ],
  "scripts/lib/d1-address.mjs#4": [
    "WHY",
    "why the slice; one line",
    `THE JSON STARTS AT THE FIRST \`[\`, not at byte zero: wrangler prints a banner and a header
before its JSON on a runner, and parsing the whole stream fails there and only there.`,
  ],
  "scripts/check-volumes.mjs#0": [
    "CONTRACT",
    "the tier limitation, the credential rule and what is not restated; the volumes, the byte counts and the sibling defects go to the history document",
    `Gate: the ACTIVE decisions volume has not passed its own stated freeze point.

  npm run check:volumes

BOUNDARY: NETWORK TIER and it cannot be otherwise, a decisions volume being a Capsid document
with no disk to read, so a volume can pass its freeze point between runs. Nothing here restates
a limit, hard rule 17 putting that number in the volume that owns it, and frozen volumes PASS.`,
  ],
  "scripts/check-volumes.mjs#1": ["CONTRACT", "what the floor means; one line already"],
  "scripts/check-volumes.mjs#4": [
    "CONTRACT",
    "what it calls; one line already",
    `One JSON-RPC call against Capsid's MCP endpoint.

@param {string} token @param {string} name @param {Record<string, unknown>} args`,
  ],
  "scripts/check-volumes.mjs#5": [
    "WHY",
    "why the last data line",
    `The endpoint may answer as SSE, and the LAST \`data:\` line is the one taken: a stream can carry
progress frames ahead of the result, and reading the first would parse a notification as the
answer.`,
  ],
  "scripts/check-volumes.mjs#6": [
    "WHY",
    "the order and the fail-closed rule",
    `ENV FIRST, then \`.dev.vars\`: the env path is what lets this run somewhere that keeps the
credential in a secret store. Either way it FAILS CLOSED when neither has it.`,
  ],
  "scripts/check-volumes.mjs#9": [
    "WHY",
    "the scope rule; one line already",
    `SCOPE FIRST: a listing that returned nothing classifies to no active volume, and every
assertion below would pass by examining it.`,
  ],
  "scripts/check-volumes.mjs#10": [
    "WHY",
    "why a missing limit fails; one line already",
    `A VOLUME THAT STATES NO LIMIT FAILS: comparing against a missing number would be a condition
that cannot be false, which is the class this gate was written in response to.`,
  ],
  "scripts/extract-publication-text.mjs#0": [
    "CONTRACT",
    "why committed, why verbatim per page and what it is for; the sizes, the ruling and the named import defect go to the history document",
    `Extracts the text of every hosted publication PDF into a committed artifact.

  node scripts/extract-publication-text.mjs

BOUNDARY: the text is stored VERBATIM, per page, with no de-hyphenation or column repair, so
what it is fit for is RETRIEVAL rather than citation; the presentation belongs to the twin that
joins the pages, and nothing on the rendered page is derived from this file.`,
  ],
  "scripts/extract-publication-text.mjs#1": ["CONTRACT", "read rather than typed; one line already"],
  "scripts/extract-publication-text.mjs#2": [
    "WHY",
    "why hosted only; one line",
    `HOSTED ONLY: a record whose PDF this site does not serve has no bytes here to extract from, and
reaching out to a publisher would be a network dependency in a script whose input is committed.`,
  ],
  "scripts/extract-publication-text.mjs#4": [
    "WHY",
    "why sorted; one line already",
    `Sorted by the casefolded DOI so the file's key order is a property of the corpus rather than of
insertion order.`,
  ],
  "scripts/extract-publication-text.mjs#6": [
    "CONTRACT",
    "what the date is and what the gate actually compares",
    `A DATED OBSERVATION, which is what this file is: the date is the day the PDFs were read and no
gate compares it. What the gate compares is each digest against the file on disk, which is the
claim that can go stale. Rule 17's exception for evidence.`,
  ],
  "scripts/lib/python.mjs#0": [
    "CONTRACT",
    "why resolved, why the probe runs a program and the fail-closed rule; the per-shell measurements and the dates go to the history document",
    `Resolving the Python a gate needs, the SAME WAY THE HOOKS DO, because the bare name resolves
under git bash and is absent under the PowerShell that runs ship.

BOUNDARY: the probe RUNS A PROGRAM and matches its output exactly, because the bare name on
Windows is often a Store stub that satisfies a lookup and is not an interpreter. Matching the
hooks' own probe is load-bearing for the gate that compiles what a hook embeds.`,
  ],
  "scripts/lib/python.mjs#1": [
    "CONTRACT",
    "why the duplication is stated",
    `The candidates and their order, IDENTICAL to the hooks' own. One owner would be better; a shell
script and an ES module cannot share a constant, so the duplication is stated here rather than
left for a reader to notice.`,
  ],
  "scripts/lib/python.mjs#2": ["CONTRACT", "what the probe must print; one line already"],
  "scripts/lib/python.mjs#4": [
    "CONTRACT",
    "what it returns; one line already",
    `The first candidate that actually runs a program, or null if none does. Memoised, including
the null.

@returns {{ path: string } | null}`,
  ],
  "scripts/lib/python.mjs#5": [
    "WHY",
    "why equality; one line already",
    `Equality after trimming, never a substring: the Store stub's banner mentions Python and would
satisfy a loose match.`,
  ],
  "scripts/lib/python.mjs#6": ["CONTRACT", "what the caller prints; one line already"],
  "scripts/lib/python.mjs#7": [
    "CONTRACT",
    "why parse rather than exec and why the source crosses as bytes",
    `Compile a Python source string, WITHOUT EXECUTING IT: the subject is whether the string PARSES,
and running a hook's checker here would execute repository logic for no benefit.

THE SOURCE CROSSES AS BYTES, WHICH IS THE POINT. The platform text layer is not UTF-8 on this
host, and these hooks carry non-ASCII literals on purpose, so reading the bytes and naming the
encoding is what keeps a syntax question about syntax. Passing the source as an argv argument is
worse: the strings are multi-line and quote-bearing, and Windows argv quoting is a hazard this
repo has already been bitten by.

@param {string} pythonPath
@param {string} source
@returns {{ ok: true } | { ok: false, error: string }}`,
  ],
  "scripts/lib/ask-converge.mjs#0": [
    "CONTRACT",
    "why there is a window, why the reading must be read-only and why two bounds; the measurement and its date go to the history document",
    `The Ask index convergence window ship waits out before declaring a miss.

BOUNDARY: the DECISION only, a pure loop over readings, while the reading itself is a network
call ship supplies. This cannot enforce that the reading is read-only; what it does is refuse to
do the reading itself, so that choice is made at one visible call site.`,
  ],
  "scripts/lib/ask-converge.mjs#1": ["NUMBER", "what the attempts mean; one line already"],
  "scripts/lib/ask-converge.mjs#2": ["NUMBER", "why the wait comes first; one line already"],
  "scripts/lib/ask-converge.mjs#3": ["NUMBER", "the ruled window; one line already"],
  "scripts/lib/ask-converge.mjs#4": [
    "CONTRACT",
    "the parameters, with the unreadable-poll rule kept",
    `Waits for a drift reading to report ok, or gives up at the bound.

@param {object} options
@param {() => Promise<{ ok: boolean, expected?: number, present?: number } | null>} options.reading
  One read-only observation. Returning null, or throwing, counts as an
  unreadable poll and is neither convergence nor a miss: it consumes an
  attempt and the loop carries on.
@param {(ms: number) => Promise<unknown>} options.sleep
@param {() => number} [options.now]
@param {number} [options.attempts]
@param {number} [options.intervalMs]
@param {number} [options.windowMs]
@param {(event: { poll: number, reading: any }) => void} [options.onPoll]
@returns {Promise<{ converged: boolean, polls: number, latest: any }>}`,
  ],
  "scripts/lib/ask-converge.mjs#7": [
    "CONTRACT",
    "what is not an unreadable poll",
    `An unreadable poll, same as a null. A failing status is NOT this: that is a readable answer
about a failing check somewhere, and the caller parses the body regardless of status.`,
  ],
  "scripts/lib/ask-converge.mjs#8": [
    "WHY",
    "the one line the recorded failure lives on",
    `The one line the "single fetch wearing a loop" failure lives on: this returns ONLY on ok, and a
not-yet-converged reading continues the loop.`,
  ],
  "scripts/build-template-refs.mjs#0": [
    "CONTRACT",
    "the third usage state, the split and the observation boundary; the photograph count goes to the history document",
    `Scans the repository source for asset references into a committed manifest, which is how the
media library answers "does the SITE ITSELF place this".

  npm run build:template-refs

BOUNDARY: it reads SOURCE TEXT and matches asset paths as literal strings, so a constructed path
reads as unattached. That is a false negative in the safe direction: this under-claims usage and
never invents it, which is why the page says "no reference found" rather than "unused".`,
  ],
  "scripts/build-template-refs.mjs#1": [
    "WHY",
    "why readFileSync rather than an import attribute",
    `\`readFileSync\` rather than an import attribute: the attribute form is only legal under a newer
module setting than this repo's, and it fails the TYPECHECK rather than the run, so it looks
fine until the build.`,
  ],
  "scripts/build-template-refs.mjs#2": [
    "WHY",
    "why forward slashes always",
    `Every source file under the scanned roots, repo-relative with forward slashes always, because
the artifact is committed and compared: a backslash would make it disagree with itself across
machines.

@param {string} dir
@returns {Promise<string[]>}`,
  ],
  "scripts/build-template-refs.mjs#4": ["CONTRACT", "its @returns line is over the column limit; kept byte-identical"],
  "scripts/build-template-refs.mjs#7": [
    "WHY",
    "why comments go first and why JSON does not",
    `COMMENTS GO FIRST: a doc comment naming an asset is prose about it, not a placement of it, and
this module's own header caught exactly that. JSON has no comments, so it is passed through
rather than run through a tokenizer that would treat a \`//\` inside a URL string as one.`,
  ],
  "scripts/build-template-refs.mjs#8": [
    "WHY",
    "why the scope number rides in the artifact",
    `SCOPE, carried in the artifact rather than printed and forgotten: a scan that read zero files
reports the same "no references" as a repository that genuinely has none.`,
  ],
  "scripts/build-template-refs.mjs#9": [
    "WHY",
    "why pathToFileURL; the slash measurement goes to the history document",
    `THROUGH \`pathToFileURL\`, NEVER BY CONCATENATING A URL SCHEME: the hand-rolled form silently did
nothing on this host, the two spellings differing in their slashes, so the script exited 0 and
the artifact was never written. A build step that succeeds while producing no output is the
worst shape a build step can have.`,
  ],
  "scripts/lib/ci-status.mjs#0": [
    "CONTRACT",
    "why split out and why apiBase is injectable",
    `Reading GitHub's verdict on a commit, and deciding whether it may deploy.

BOUNDARY: the decision is pure and the fetch decides nothing, so the refusal paths can be driven
by tests rather than by shipping a commit whose CI had deliberately been made to look failed.

@see scripts/ship.mjs
@see test/ci-status.test.mjs`,
  ],
  "scripts/lib/ci-status.mjs#1": [
    "CONTRACT",
    "the four refusals and why the run set is derived",
    `May this commit deploy? FAIL CLOSED IN EVERY DIRECTION, four refusals, each a state a naive
check reads as success:

  - **no push-triggered run**: an empty list is the same shape as "nothing failed", which is
    what a truthy \`every()\` over an empty array gets wrong, silently, forever.
  - **still running**: the conclusion is null while a run is in flight, and green so far is not
    green.
  - **not success**: named explicitly, because cancelled, timed out and action required are
    none of them failures and none of them passes.
  - **unparseable payload**: an answer this function did not understand, not an empty result.

PUSH-TRIGGERED RUNS ONLY, derived rather than named: filtering on the workflow file would go
stale the day a second push workflow lands.

@param {unknown} payload the parsed GitHub \`actions/runs\` response
@param {string} sha for the message, short or full
@returns {{ ok: boolean, why: string, remedy: string }}`,
  ],
  "scripts/lib/ci-status.mjs#3": [
    "CONTRACT",
    "why it throws rather than returning a verdict",
    `Fetches the runs for one sha. Throws on anything that is not a 2xx body, deliberately: an
unreachable API and a failed CI run are different facts and the caller words them differently.

@param {{ owner: string, repo: string, sha: string, token?: string, apiBase?: string }} options`,
  ],
  "scripts/lib/ci-status.mjs#4": [
    "WHY",
    "why a 404 is worded as authentication; the date and the void assumption go to the history document",
    `**THE REPOSITORY IS PRIVATE**, so a 404 here is almost always an authentication problem rather
than a missing repo, and saying so is the difference between a one-minute fix and an afternoon:
GitHub answers 404 rather than 403 for a private resource you may not see, so an unauthenticated
caller is told the repo does not exist. A token is REQUIRED, not an optimisation.`,
  ],
  "scripts/lib/raster.mjs#0": [
    "CONTRACT",
    "why hand-rolled, why every function throws and what self-tests them",
    `Minimal readers for the two binary container formats the icon suite ships.

BOUNDARY: not a decoder in the general sense. The gate asks for a header and one corner pixel,
both reachable without decompressing an image, and every function throws rather than returning a
sentinel, because a gate that carries on past a null passes on a file it could not read.`,
  ],
  "scripts/lib/raster.mjs#1": ["CONTRACT", "what the table holds; one line already"],
  "scripts/lib/raster.mjs#3": [
    "CONTRACT",
    "what it returns; one line already",
    `Walks a PNG's chunk list and returns its IHDR fields plus the joined IDAT.

@param {Buffer} buf
@returns {PngHeader & { idat: Buffer }}`,
  ],
  "scripts/lib/raster.mjs#6": ["CONTRACT", "the chunk layout; one line already"],
  "scripts/lib/raster.mjs#7": [
    "CONTRACT",
    "why the first pixel is exact and that the limit is deliberate",
    `The colour of pixel (0, 0), as an uppercase #RRGGBB string.

WHY ONLY THE FIRST PIXEL, and why it is exact rather than approximate. A PNG scanline is
filtered against its left neighbour and the row above, so an arbitrary pixel means
reconstructing every row before it. The FIRST pixel of the FIRST row has neither, so all five
filter types collapse to the identity there and one inflate answers it with no unfiltering loop
to get wrong. A deliberate limit, not an unfinished decoder.

@param {Buffer} buf`,
  ],
  "scripts/lib/raster.mjs#10": ["CONTRACT", "its @returns line is over the column limit; kept byte-identical"],
  "scripts/lib/raster.mjs#11": [
    "CONTRACT",
    "what it returns; one line already",
    `The payload of one ICO entry, for handing to the PNG readers.

@param {Buffer} buf
@param {{ offset: number, bytes: number }} entry`,
  ],
  "scripts/lib/content.mjs#0": [
    "CONTRACT",
    "the split and what it buys",
    `Node adapter for the shared markdown pipeline.

BOUNDARY: the pipeline itself lives where the Worker can import it too and everything Node-only
stays here, so the two callers differ in how they read a file and in nothing else.`,
  ],
  "scripts/lib/content.mjs#1": ["CONTRACT", "what it resolves from; one line already"],
  "scripts/lib/content.mjs#2": [
    "WHY",
    "why read rather than imported, and why module scope",
    `The committed manifest, READ rather than imported, once per process. Read because it is what
the Worker side does, so the two resolvers differ in the path they read and in nothing else, and
because an import attribute gives a type whose literal keys make a variable lookup an error that
has to be cast away. Module scope, because the build makes one resolver per post.

@type {Promise<Record<string, { sha: string, lqip: string }>> | null}`,
  ],
  "scripts/lib/content.mjs#3": [
    "CONTRACT",
    "the two things that must not be derived here and why; the finding id goes to the history document",
    `Builds a resolver that measures an image on disk. A missing file is a build failure, never a
silently absent attribute, the whole point being to prevent layout shift.

A media blob is resolved from the KEY, not from bytes: those live only in R2, so this build
cannot read them at all while the Worker could, which meant the first such citation would commit
HTML the build could not reproduce. The key now carries the dimensions and both resolvers parse
it the same way.

THE PLACEHOLDER COMES FROM THE COMMITTED MANIFEST, for the same reason: this side has an encoder
the Worker does not, so a value computed at render time is one the two writers could never agree
on. Exported so the invariants gate can compare it against the Worker's resolver directly.

@param {string} file source markdown path, for the error message
@returns {(src: string) => Promise<{ width: number, height: number, placeholder?: string }>}`,
  ],
  "scripts/lib/content.mjs#6": [
    "CONTRACT",
    "absent is a real answer; one line already",
    `Absent for anything the manifest does not cover. Absent is a real answer: the image renders
without a placeholder, exactly as it did before this existed.`,
  ],
  "scripts/lib/content.mjs#7": [
    "CONTRACT",
    "what it returns; one line already",
    `Renders one markdown file into the row shape the database stores.

@param {string} file path relative to the repo root
@param {string} raw file contents`,
  ],
  "scripts/build-enhance.mjs#0": [
    "CONTRACT",
    "the boundary, why prebuilt and why self-contained is asserted; the dates and the measured serve go to the history document",
    `Bundles every module in app/enhance/ into a self-contained asset, because a \`?url\` import copies
bytes verbatim and the thing it points at has to be finished JavaScript.

  npm run build:enhance

BOUNDARY: it builds and then reads back its OWN output, proving each bundle is import-free and
parses. It cannot prove the app build serves these files, which \`check:page-payload\` asserts,
and it cannot see the wire.`,
  ],
  "scripts/build-enhance.mjs#1": [
    "CONTRACT",
    "what counts as a module dependency; one line already",
    `True when the AST contains any statement that would reach the network for another module. A
plain \`export {}\` has no source and is fine in a module script.

@param {any} node
@returns {string | null} a description of the offending node, or null`,
  ],
  "scripts/build-enhance.mjs#2": ["CONTRACT", "why excluded; one line already"],
  "scripts/build-enhance.mjs#3": [
    "CONTRACT",
    "what it makes legal; one line already",
    `One chunk per entry, dynamic imports inlined, which is what makes a lazy import legal under the
no-imports rule below.`,
  ],
  "scripts/build-enhance.mjs#4": [
    "CONTRACT",
    "both directions; one line already",
    `Both directions: a file in the output directory that no module produced is a stale bundle a
\`?url\` import could still be serving.`,
  ],
  "scripts/require-clean-tree.mjs#0": [
    "CONTRACT",
    "the boundary, why a refusal rather than an archive build and why no override; the audit item goes to the history document",
    `Refuses a deploy from a working tree that is not clean, because the build reads the WORKING TREE
rather than HEAD. Wired as \`predeploy\`.

BOUNDARY: it reads \`git status --porcelain\` and nothing else. It proves the tree matches HEAD;
it does NOT prove HEAD is pushed, or that the deployed Worker corresponds to the commit it
names.`,
  ],
  "scripts/require-clean-tree.mjs#2": [
    "WHY",
    "why an unreadable answer refuses",
    `FAILS CLOSED on an unreadable answer: a missing git and a directory that is not a repository
both mean the tree cannot be compared to anything, and "I could not check" must not deploy.`,
  ],
  "scripts/lib/retry.mjs#0": [
    "CONTRACT",
    "the class, why it prints first and the reads-only rule; the five incidents, their errors and the dates go to the history document",
    `One retry, for Cloudflare READ paths only, wrapping a rejection AND a timeout because the class
has appeared as both a fast death and a hang.

BOUNDARY: READS ONLY, never a write, a retried write being one that may have landed twice. It
PRINTS BEFORE IT RETRIES, and a SECOND failure propagates unchanged, so the caller fails exactly
as it would have without this wrapper.`,
  ],
  "scripts/lib/retry.mjs#1": ["NUMBER", "why generous; one line already"],
  "scripts/lib/retry.mjs#2": ["CONTRACT", "the signature; type annotation only"],
  "scripts/lib/retry.mjs#3": [
    "WHY",
    "why the promise is normalised; one line already",
    `\`fn\` may be synchronous, as the wrangler spawns are, and normalising both here avoids forcing
every call site to become async.`,
  ],
  "scripts/lib/retry.mjs#5": [
    "WHY",
    "named before the retry; one line already",
    `NAMED AND PRINTED BEFORE THE RETRY: an undiagnosable transient is worse than a visible one.`,
  ],
  "scripts/lib/retry.mjs#6": ["CONTRACT", "the second failure propagates; one line already"],
  "scripts/fetch-cited-by.mjs#0": [
    "CONTRACT",
    "why committed, why it is not a gate and the cap; the byte sizes, the credit costs and the ruling go to the history document",
    `Who cites each paper, from OpenAlex, into a committed artifact.

  node scripts/fetch-cited-by.mjs          report only
  node scripts/fetch-cited-by.mjs --write  update the artifact

BOUNDARY: NOT A GATE, AND NEVER RUN BY ONE, because a gate that fetches a third party is red on
their bad day rather than on ours. A human runs it, the result is committed with the date it was
read, and the gate checks the committed file.`,
  ],
  "scripts/fetch-cited-by.mjs#1": ["NUMBER", "the ruled cap and its shape consequence; one line already"],
  "scripts/fetch-cited-by.mjs#2": ["CONTRACT", "what identifies the caller; one line already"],
  "scripts/fetch-cited-by.mjs#6": [
    "WHY",
    "why the field selection; one line already",
    `\`select\` keeps the response to the fields the page renders: the default is a large record per
work and this asks for many of them.`,
  ],
  "scripts/fetch-cited-by.mjs#8": [
    "CONTRACT",
    "why stripped here; one line already",
    `The DOI as OpenAlex gives it is a full URL and the page needs the bare name, stripped here so
the artifact carries one form.`,
  ],
  "scripts/fetch-cited-by.mjs#9": ["CONTRACT", "the artifact convention; one line already"],
  "scripts/build-publication-twins.mjs#0": [
    "CONTRACT",
    "why gitignored, where it runs and why it prunes; the ruling and the named sources go to the history document",
    `Writes the markdown twin of every paper into the public directory.

  npm run build:publication-twins

BOUNDARY: a gitignored BUILD PRODUCT, derived entirely from tracked sources, and it PRUNES: a
paper removed or a DOI corrected leaves a twin this script would never overwrite and the next
deploy would upload. Directly under the directory, never recursive, the subdirectories holding
the PDFs.`,
  ],
  "scripts/build-publication-twins.mjs#2": [
    "CONTRACT",
    "why exported; one line already",
    `Every twin, as a map from filename to bytes. Exported so the gate can generate and compare
without writing: a gate that repairs its subject before looking at it cannot fail.

@returns {Promise<Map<string, string>>}`,
  ],
  "scripts/build-publication-twins.mjs#3": [
    "WHY",
    "why the key is folded; the mixed-case count goes to the history document",
    `Text is keyed by DOI as deposited and some are mixed case, so a raw-string lookup would silently
produce a twin with no full text.`,
  ],
  "scripts/build-publication-twins.mjs#5": [
    "CONTRACT",
    "why null and empty differ",
    `Null and empty are different states and the twin renders them differently: null is "this site
does not host the PDF" and produces no full-text section, while an empty array is "the PDF is
here and extraction found nothing", which the twin says out loud.`,
  ],
  "scripts/build-publication-twins.mjs#6": [
    "CONTRACT",
    "why the write is guarded; one line already",
    `Writes only when run directly, so the gate's import cannot rewrite the files it is about to
compare.`,
  ],
  "scripts/lib/dev-vars.mjs#0": [
    "CONTRACT",
    "why it takes a name and why absent is null; the two callers go to the history document",
    `Reads ONE named value out of the gitignored \`.dev.vars\`.

BOUNDARY: **IT TAKES A NAME AND RETURNS ONE STRING. It never returns the file, never returns a
map, and never logs a value.** Absent is a named answer rather than an empty string: it returns
null and the CALLER decides what that means, and the two callers decide differently.`,
  ],
  "scripts/lib/dev-vars.mjs#1": ["CONTRACT", "one path, named once; one line already"],
  "scripts/lib/dev-vars.mjs#2": ["CONTRACT", "the signature; type annotation only"],
  "scripts/lib/dev-vars.mjs#3": [
    "WHY",
    "why anchored to the line and the name; hard rule 10 kept",
    `ANCHORED TO THE LINE AND TO THE NAME: an unanchored needle would match a longer variable whose
name ends with this one and hand back the wrong credential, which is hard rule 10's anchoring
discipline applied to a value rather than to a count. The name is escaped, a caller being able
to pass anything.`,
  ],
  "scripts/lib/dev-vars.mjs#4": [
    "CONTRACT",
    "the parse order; one line already",
    `Strip a trailing comment only when the value is unquoted, then one matching pair of quotes, then
whitespace. A \`#\` inside quotes is part of the value.`,
  ],
  "scripts/lib/sqlite-tables.mjs#0": [
    "CONTRACT",
    "the three rules and why each is derived; the three call sites and the date go to the history document",
    `Classifying \`sqlite_master\` rows into virtual, shadow and real tables. ONE ENUMERATOR RULE, for
the callers that read a live database and the one that replays the migrations into memory.

BOUNDARY: source-agnostic, so it takes rows rather than a database, and each class is derived
from the DDL or the naming rule rather than from a list. Platform bookkeeping is NOT handled
here, being a property of where the rows came from rather than of SQLite.

@param {{ name: string, sql: string | null }[]} rows
@returns {{ virtual: string[], shadow: string[], real: string[] }}`,
  ],
  "scripts/lib/sqlite-tables.mjs#3": [
    "CONTRACT",
    "what the set is and both ways of getting it wrong",
    `Every table name an FTS index owns, which is the set that must never be written to directly:
deleting from any of them corrupts the index and the repair is a rebuild. Counting rows in one
is equally wrong in the other direction, a count on an external-content index reading THROUGH to
the content table, which is why the health checks count the docsize shadow instead.

@param {{ virtual: string[], shadow: string[] }} classified
@returns {string[]}`,
  ],
  "scripts/lib/wrangler-config.mjs#0": [
    "CONTRACT",
    "the rule and why the real file; the prune's arrival goes to the history document",
    `Reads resource names out of the real wrangler config, because nothing that talks to a bucket may
name one in a string literal: a stale literal aims a DELETE at whatever still answers to it.

BOUNDARY: it reads the REAL file, the example carrying placeholder ids that a build script
cannot use, and \`check:config\` is what keeps the two describing the same binding surface.`,
  ],
  "scripts/lib/wrangler-config.mjs#1": [
    "CONTRACT",
    "what it converts; one line already",
    `JSONC to JSON. Comments only; this config has no trailing commas.

@returns {any}`,
  ],
  "scripts/lib/wrangler-config.mjs#2": [
    "WHY",
    "why the weak stripper and why weak is enough; the measurement date goes to the history document",
    `WEAK ON PURPOSE, this being JSONC on its way to JSON.parse: the shared strong stripper's
line-comment rule eats a protocol-relative url and takes the rest of the line with it. Weak is
SUFFICIENT, because JSON.parse throws on any comment this fails to remove.`,
  ],
  "scripts/lib/wrangler-config.mjs#3": [
    "CONTRACT",
    "what it returns; one line already",
    `Every R2 bucket name the Worker binds, keyed by binding name.

@returns {Record<string, string>}`,
  ],
  "scripts/lib/wrangler-config.mjs#5": [
    "WHY",
    "why derived; the literal it replaced goes to the history document",
    `The D1 database NAME for a binding, or a named failure. DERIVED, not restated: another script
carries the same value as a literal, which is the mirror shape this repo keeps paying for.

@param {string} binding`,
  ],
  "scripts/lib/wrangler-config.mjs#7": [
    "CONTRACT",
    "why it throws; one line already",
    `One bucket by binding name, or a named failure. Throws rather than returning undefined, so a
typo cannot become \`undefined\` interpolated into a wrangler command line.

@param {string} binding`,
  ],
  "scripts/lib/artifact.mjs#0": [
    "CONTRACT",
    "one writer and where it moved; the arc goes to the history document",
    `The on-disk shape of the local content build product, with ONE writer.

BOUNDARY: it lives beside the scripts rather than in the app because the Worker imports nothing
from it: the editor renders straight into D1 instead of through this shape.`,
  ],
  "scripts/lib/artifact.mjs#1": ["CONTRACT", "the signature; type annotation only"],
  "scripts/lib/artifact.mjs#2": [
    "WHY",
    "why pages is required and the throw is the point; the ruling goes to the history document",
    `\`pages\` is REQUIRED, and the throw is the point: hand-authored pages are in the search corpus,
so the records array is no longer derivable from the posts alone. A caller that forgot the
second argument would produce a SMALLER artifact that is internally consistent and passes every
shape check, and the gate would go red on the next ordinary build with a byte difference nobody
could place.`,
  ],
  "scripts/lib/artifact.mjs#3": [
    "WHY",
    "why not defaulted; the record count goes to the history document",
    `\`papers\` IS REQUIRED FOR THE SAME REASON, and required rather than defaulted to an empty array
on purpose: a default is the failure above reintroduced, an artifact missing every paper,
internally consistent, and red on the next unrelated build.`,
  ],
  "scripts/lib/artifact.mjs#4": [
    "WHY",
    "why records are derived and why the order is fixed",
    `Records are derived here rather than stored per post, so adding a post cannot leave another
post's records stale, and each group is internally sorted so the order is stable across writers
and the gate never fails on ordering alone.`,
  ],
};
