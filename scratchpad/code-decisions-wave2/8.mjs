// Chunk 8: scripts/improve-report.mjs blocks 0-74, scripts/check-head.mjs blocks 0-31.
//
// Wave 1's rule. improve-report is the wave's one SECURITY file: nearly every comment is a
// prohibition with an attack behind it, and the attacks are what make the prohibitions
// readable, so they stay in one clause each while their audit numbers and dates go. check-head
// is the opposite, a file of measured exclusions, and each survives as the reason the gate
// cannot run there rather than as the transcript of the run that proved it.
export default {
  "scripts/improve-report.mjs#0": [
    "CONTRACT",
    "where it runs, what it never reads, why TAP and the stream mode; the two audit findings and the byte-identical note go to the history document",
    `Trusted scoring glue, run from the DEFAULT branch from a copy stashed before any untrusted
byte exists on the runner. IT NEVER RUNS ATTEMPT-CONTROLLED CODE: it reads the TAP the reporter
produced and counts TOP-LEVEL ok / not ok lines, never an exit code, because an early
\`process.exit(0)\` means the ok line is never written and the pass it never earned is absent
rather than assumed.

THE STREAM MODE has no destination file: the container writes TAP to its stdout, the runner
captures that pipe from OUTSIDE, and this splits on markers the trusted shell emits, because a
destination file inside the attempt's own filesystem could be rewritten after the reporter
flushed. A test's own stdout is re-emitted as \`# \` comments, so nothing it prints can produce a
result line or a marker at column 0.`,
  ],
  "scripts/improve-report.mjs#1": [
    "WHY",
    "why column 0 is unreachable, in two lines",
    `Matched at column 0, which a test cannot reach: node's TAP reporter prefixes every line a
test writes with "# ", so an injected marker arrives commented out.`,
  ],
  "scripts/improve-report.mjs#2": [
    "WHY",
    "what TAP escaping does not cover; the date and the phase name go to the history document",
    `THE NONCE. TAP escaping protects only output that went through node's reporter, and the
secondary phases pipe a lint tool's RAW stdout into the same stream, where a diagnostic can
carry attacker text at column 0. The nonce is held in a shell variable and unset from the
environment before any attempt code runs.`,
  ],
  "scripts/improve-report.mjs#4": [
    "CONTRACT",
    "what a segment is and why it is declared once",
    `One segment of the container's output stream, plus the exit status the trusted shell printed
after it. Declared once because \`splitStream\` builds them and both readers narrow them.`,
  ],
  "scripts/improve-report.mjs#6": [
    "WHY",
    "why the map lives here, the offline rule and what null means; the CI plant and the dates go to the history document",
    `The per-repo command map. The secondaries used to be measured by the job that runs attempt
code by design, and a plant set every one of them in a signed report: the anchors held, the
tuning signal did not. The two that CAN be recomputed are recomputed inside the same
\`--network none --read-only\` container as the holdout.

EVERY COMMAND MUST RUN OFFLINE: nothing may install, fetch or resolve. A command that does not
run yields NULL rather than falling back to the forgeable value.`,
  ],
  "scripts/improve-report.mjs#7": [
    "WHY",
    "why two exclusions and that neither is to move a number; the scores and the ruling date go to the history document",
    `UNIT TESTS ONLY, and that took two exclusions rather than one: the bare runner swept in
playwright specs that cannot run behind \`--network none\`, and excluding them by folder revealed
integration tests living outside that folder. Neither is excluded to make a number go up: a
score the loop cannot move is noise it optimises against, and both are UNSCORED on the record.`,
  ],
  "scripts/improve-report.mjs#8": ["CONTRACT", "what null means here; two lines already"],
  "scripts/improve-report.mjs#9": [
    "WHY",
    "what the manifest is not, what it buys and the two consumers; the broken anchor's figures go to the history document",
    `The holdout import manifest: every name the hidden suite imports out of the repo's own source.
NOT A SECURITY CONTROL and deliberately not secret, an export name being in the source already.

WHAT IT BUYS: a bloat pass removed two exports on a scan that found no caller, and the holdout
imports both while being structurally invisible to anything that runs in the repo. The list is
the missing third place to look.

TWO CONSUMERS pulling opposite ways: the dead-export check treats a name here as a caller, and
the sync job refuses a case importing a name that is NOT here.`,
  ],
  "scripts/improve-report.mjs#11": ["CONTRACT", "what the file may contain; two lines already"],
  "scripts/improve-report.mjs#13": [
    "CONTRACT",
    "why relative specifiers only, and why bound names count",
    `Matched on the specifier being RELATIVE: an import of a builtin or an npm package says
nothing about this repo's exports. Default and namespace imports are reported under the names
they bind, since removing what they point at breaks the case just the same.`,
  ],
  "scripts/improve-report.mjs#16": [
    "WHY",
    "the anchor and the boundary; the five bad runs and their names go to the history document",
    `ANCHORED AT A STATEMENT START, and the clause may not cross a \`;\`. A lazy match for the
clause crossed statement boundaries and swallowed the builtin imports above the first relative
one, reporting names like \`from\` and \`import\`. An import clause never contains a semicolon.`,
  ],
  // Kept byte-identical: the block names a lint rule in an eslint-disable discussion, and the
  // validator refuses a rewrite of any block carrying a tool directive.
  "scripts/improve-report.mjs#17": ["WHY", "the snapshot rule and the no-suppression rule; carries a tool directive, kept byte-identical"],
  "scripts/improve-report.mjs#18": [
    "CONTRACT",
    "what it returns and why it never names a file",
    `The gate on the holdout import manifest. It NEVER names a case file: a filename is part of
the hidden suite and this runs in a job whose log is readable. It names the missing IMPORTS,
which are source export names and are what the operator has to add.`,
  ],
  "scripts/improve-report.mjs#21": [
    "WHY",
    "why files rather than an inlined string, and what the tree list buys",
    `Files rather than an inlined string, because the container command is a single-quoted shell
literal and embedding a per-repo command into it is a quoting hazard.

\`trees.txt\` is the OTHER half of the trusted map: the container builds its working tree as the
default-branch checkout with these paths, and only these, replaced by the attempt. Taking the
list from the trusted map means an attempt cannot decide which of its own trees are believed,
and taking each declared tree WHOLE means a file the attempt deleted stays deleted.`,
  ],
  "scripts/improve-report.mjs#25": ["CONTRACT", "what counts as a top-level result; already short"],
  "scripts/improve-report.mjs#27": ["CONTRACT", "what null means; two lines already"],
  "scripts/improve-report.mjs#29": [
    "WHY",
    "why zero results is not a pass",
    `One case passes iff its report has at least one top-level ok and no top-level not-ok. Zero
results is NOT a pass: silence cannot score.`,
  ],
  "scripts/improve-report.mjs#31": [
    "CONTRACT",
    "what bounds the stream and what the four kinds are",
    `Split a concatenated stream into its trusted segments; anything before the first marker is
container preamble and is discarded. \`##CAPSID-END\` bounds the stream, so a truncated one is
visible rather than silently scored on partial output.

Four kinds: "case", "test" and "lint" for the phases, and "status" for the exit code the
trusted shell printed, so a phase that could not run is distinguishable from one that ran and
found nothing.`,
  ],
  "scripts/improve-report.mjs#35": [
    "WHY",
    "why the assignment is outside the closure",
    `\`open\` RETURNS the segment and the loop assigns \`current\`, rather than assigning from inside
the closure: a checker cannot follow an assignment made in a callback and narrowed \`current\` to
\`never\` at every later use.`,
  ],
  "scripts/improve-report.mjs#38": ["CONTRACT", "one rule for one case and for a stream; already short"],
  "scripts/improve-report.mjs#40": [
    "WHY",
    "why an unterminated stream scores zero",
    `An unterminated stream scores ZERO, not a partial count: a container killed halfway through
is a failed measurement, and a failed measurement must never look like a good one.`,
  ],
  "scripts/improve-report.mjs#42": [
    "CONTRACT",
    "where the two numbers come from and what null means",
    `THE RECOMPUTED SECONDARIES. Both come out of the container, never out of the artifact the
attempt's own job wrote.

  test_pass_rate  the top-level TAP ratio of the repo's own test command, in the sandbox
  lint_count      how many lines of the lint output match this repo's pattern

A phase that could not run yields null rather than falling back: an unmeasured metric must
never be readable as the number the attempt wrote down.`,
  ],
  "scripts/improve-report.mjs#47": [
    "CONTRACT",
    "what counts as having run and why it is spelled out",
    `A phase RAN if the container finished and reported an exit status that is not "could not
execute". Written as an explicit null check rather than a predicate helper, so the narrowing is
visible to a checker: the callers dereference \`.lines\` on the strength of it.`,
  ],
  "scripts/improve-report.mjs#51": [
    "WHY",
    "how zero matches read as zero problems; the tool, the date and the exit code go to the history document",
    `A CRASH IS NOT A CLEAN LINT. A linter that could not resolve its own binary exited nonzero
and printed a dump that matched no count pattern, so "zero matches" read as "zero problems". A
clean lint exits 0; one that found problems exits nonzero AND matches. Nonzero with no matches
is neither, so it is null.`,
  ],
  "scripts/improve-report.mjs#52": [
    "WHY",
    "what a declared-but-never-reported metric did, and the both-directions test; the audit number goes to the history document",
    `THE SECONDARY METRICS THIS SCORER ACTUALLY REPORTS, in report order. It used to be five: two
were emitted as a literal null by every repo on every run while being declared in every scores
document as though they were signals. The test derives that document's list from this array and
fails BOTH ways, so a metric cannot be declared without something reporting it, or reported
without being declared.`,
  ],
  "scripts/improve-report.mjs#53": [
    "CONTRACT",
    "why coercion is refused",
    `A finite number, or null for anything else. Coercion is refused so a stray value cannot read
as a real measurement.`,
  ],
  "scripts/improve-report.mjs#55": [
    "CONTRACT",
    "the six modes, kept because they are the interface; the trusted-stash aside goes to the history document",
    `CLI. Six modes, all trusted, none of which runs attempt code:

  --holdout <reportPath>              exit 0 if that single report passed, 1 otherwise.
  --holdout-stream <tapPath> [nonce]  print how many cases passed in a piped stream.
  --rate <testReportPath>             print the top-level pass rate, or "" if nothing ran.
  --secondary-scripts <ns> <dir>      write this repo's sandbox commands as shell files.
  --secondary <tapPath> <ns> <nonce> <metricsPath>
                                      print the RECOMPUTED secondaries, and any disagreement.
  <metricsPath> <total> <passed>      emit the score-report body. The key never touches this.`,
  ],
  "scripts/improve-report.mjs#57": [
    "WHY",
    "what a clean zero cannot distinguish",
    `AN EMPTY STREAM IS NOT A RESULT: the pass count returns 0 both for "every hidden test failed"
and for "no hidden test ever ran", which is correct for a SCORE and useless as a diagnosis,
because the loop then reverts a change it never measured.`,
  ],
  "scripts/improve-report.mjs#58": ["CONTRACT", "what it reads and why no filename; already short"],
  "scripts/improve-report.mjs#62": [
    "WHY",
    "what a bare null cannot tell apart",
    `WHY IT IS NULL, IN THE RUN LOG. A null that does not say why is the shape this exists to
stop: the log could not distinguish "the command was not found" from "it ran and produced no
parseable result", which is the difference between a typo in the map and a flag the tool
dropped.`,
  ],
  "scripts/improve-report.mjs#63": [
    "WHY",
    "why both ends of the output",
    `HEAD AND TAIL. The tail of a Node crash is the version banner, which says nothing; the
message naming the missing module is at the TOP, and printing only the tail turned a resolution
failure into three closing braces.`,
  ],
  "scripts/improve-report.mjs#64": [
    "WHY",
    "what the leading space defends against; the test name goes to the history document",
    `ONE LEADING SPACE, AND IT IS DELIBERATE. These lines echo the sandbox tool's raw output, and
the problem matcher the runner registers for the WHOLE job anchors at a non-space column:
without the space, a lint phase that found type errors made every green CI run carry failure
annotations against a path and a line nobody wrote.`,
  ],
  "scripts/improve-report.mjs#66": [
    "WHY",
    "what a disagreement looks like and which side wins",
    `THE CROSS-CHECK. The artifact is written on a runner that has already run attempt code, so a
disagreement is what a forged one looks like. The container value wins in every case; the
disagreement is printed so the run log carries it.`,
  ],
  "scripts/improve-report.mjs#71": [
    "WHY",
    "where the anchor comes from and why absent is zero; the audit reference goes to the history document",
    `THE ANCHOR IS NOT READ FROM THE ARTIFACT. It comes from the build job's own outcome, which
the runner sets; the artifact is written on a machine that has already executed attempt code
and is treated as hostile for this field. Absent is 0, not 1.`,
  ],
  "scripts/improve-report.mjs#72": [
    "WHY",
    "what the artifact is still read for, and why",
    `THE RECOMPUTED SECONDARIES ARE NOT READ FROM THE ARTIFACT EITHER. It is read for
bundle_size_bytes and for NOTHING else: that is the one secondary no offline container can
recompute, because measuring it means running the repo's bundler.`,
  ],
  "scripts/improve-report.mjs#73": [
    "WHY",
    "why an unjudged attempt is not a reverted one",
    `WHETHER THE MACHINE WORKED. An attempt carrying \`ok: false\` is left UNJUDGED rather than
reverted, because none of the numbers above describe the attempt in that case.`,
  ],
  "scripts/improve-report.mjs#74": ["CONTRACT", "why the direct-run guard; two lines already"],
  "scripts/check-head.mjs#0": [
    "CONTRACT",
    "what it observes, what it inherits and why the counts are not written here; both founding incidents, every cost measurement and the 2881s reading go to the history document",
    `Gate: run the offline tier against a FRESH CHECKOUT OF HEAD, not the disk.

  npm run check:head
  node scripts/check-head.mjs --ref <branch|sha>

IT OBSERVES A CHECKOUT, NOT THE DEPLOY. It extracts a ref into a throwaway worktree and runs
gates there, catching the two things nothing else here catches: work that is on disk and not
committed, and line-ending divergence between what you have and what a clone gets. It cannot
see the running Worker.

IT INHERITS EVERY EXCLUDED GATE'S BLINDNESS, and the set is not small: some cannot run in an
extraction at all, two stop recursion, and one that COULD run is answered by CI on the same
sha. Each carries its grounds at EXCLUDED. A green run means "the ones that CAN run and are not
answered elsewhere, do".

THE COUNTS ARE DELIBERATELY NOT WRITTEN HERE: they were, and both went stale. The gate PRINTS
them every run.

THE TYPECHECK IS COLD HERE, ALWAYS, AND THAT IS CORRECT. Copying the incremental state in would
halve it and would be WRONG: it would decide what to skip against hashes taken from DISK while
checking the sources of HEAD.`,
  ],
  "scripts/check-head.mjs#1": [
    "CONTRACT",
    "why derived, in two lines",
    `DERIVED from the offline tier minus EXCLUDED, rather than hardcoded, so a gate added to
\`check-all.mjs\` and forgotten here shows up as a mismatch rather than being silently skipped.`,
  ],
  "scripts/check-head.mjs#2": ["CONTRACT", "the recursion, in two lines; kept"],
  "scripts/check-head.mjs#3": [
    "WHY",
    "why it squares rather than loops, and why nothing is lost",
    `RECURSION OF THE SECOND KIND, and it squares rather than looping forever: \`check:floors\` runs
every counting gate, and this gate runs the tier that contains it, so the whole tier would be
paid twice inside a gate that already costs minutes.

Nothing is lost. Both numbers it compares are properties of the GATE rather than of the
checkout, so an extraction reports the same floors as disk unless disk is dirty, and a dirty
tree is what the rest of this gate is for.`,
  ],
  "scripts/check-head.mjs#4": [
    "WHY",
    "why it can never pass in an extraction, with its citation; the verbatim failure list and both staleness dates go to the history document",
    `\`bootstrap-config.mjs\` creates the real config BY COPYING the example, because the real one is
gitignored and absent from any extraction. That makes real == example by construction, and this
gate's whole job is asserting they DIFFER in the redacted values.

It can never pass in an extraction. That is the gate being correct rather than a limitation to
work around, and it is why check:config is load-bearing on exactly one machine. The failure
list is not restated here, on Hard rule 17: running the gate is what takes it.`,
  ],
  "scripts/check-head.mjs#5": [
    "WHY",
    "what it reads and why a checkout lacks it; the verbatim error goes to the history document",
    `Defaults to \`--local\`, which reads miniflare state under a gitignored directory that a
checkout does not have.`,
  ],
  "scripts/check-head.mjs#6": [
    "WHY",
    "why building to satisfy it would be wrong",
    `Reads gitignored build output, absent from any extraction. Building inside the worktree to
satisfy it would measure a build of HEAD that nothing deploys, at a full client build's cost
per run.`,
  ],
  "scripts/check-head.mjs#7": [
    "WHY",
    "why it is a different kind of exclusion and what it buys; the memory figures and the killed runs go to the history document",
    `NOT a can-it-run exclusion like the four above: this one CAN run and is excluded because the
property it proves is proven twice over by the time this gate runs. Ship refuses a dirty tree at
step 1, so at the moment it matters disk EQUALS HEAD; and CI runs it on a clean checkout of the
same sha on a machine that has never seen this repo. What it buys is MEMORY, which is why it was
found: nested here it ran a vitest and three workerd INSIDE this gate's extraction.`,
  ],
  "scripts/check-head.mjs#8": ["CONTRACT", "one line already; kept"],
  "scripts/check-head.mjs#9": [
    "WHY",
    "what a one-line forward lost, why there is a cap and why truncation is announced; the incident and the sizing arithmetic go to the history document",
    `HOW MUCH OF AN INNER GATE'S OUTPUT REACHES THIS ONE'S. This kept the FIRST matching line, and
every gate here prints a failure as a LABEL followed by an INDENTED DETAIL, so what survived
was always the label and the detail never was.

THE CAP is bounded by lines and by characters, whichever binds first, and it SAYS SO when it
truncates: a silent truncation reads as "that was all of it".`,
  ],
  "scripts/check-head.mjs#10": ["CONTRACT", "what the fallback covers; already short"],
  "scripts/check-head.mjs#12": ["CONTRACT", "section marker, rule padding cut", `NUL preflight`],
  "scripts/check-head.mjs#13": [
    "WHY",
    "what a NUL defeats and why bytes not text; the two carriers and their durations go to the history document",
    `A NUL byte makes git render a file as binary and makes ripgrep skip it in a directory search,
so a change to it rides into a commit unreviewed and is invisible to every text search. Two
source files here carried one for over a week and were found only by reading
\`git ls-files --eol\`.

**This reads BYTES, not text.** The whole class is about files whose byte content defeats text
tooling, so the check that guards it must not be a text check.`,
  ],
  "scripts/check-head.mjs#14": [
    "WHY",
    "why a scan scoped to the last defect catches only the last defect; the file, the dates and the eol reading go to the history document",
    `\`test\` JOINED after the class it guards was found living there: a test file carried two
literal NUL bytes in a comment that meant to write the escape, and it was invisible here
because this list named the three roots the earlier instances happened to live in. A scan
scoped to where the last defect was found is a scan that can only ever catch the last defect.`,
  ],
  "scripts/check-head.mjs#15": [
    "WHY",
    "why the exemption is named by extension and not by sniffing; the font move and its date go to the history document",
    `Extensions that are BINARY BY NATURE, so a NUL in them is not the defect: the class this guards
is a file that LOOKS like source and defeats text tooling, and git already treats a woff2 as
binary by content.

**NAMED BY EXTENSION, not "skip anything that looks binary".** The tempting version exempts any
file whose bytes fail a UTF-8 decode, and that fails OPEN on exactly the case this exists for: a
\`.ts\` with a NUL in it is a file that looks binary.`,
  ],
  "scripts/check-head.mjs#17": [
    "WHY",
    "why the exemption polices itself",
    `THE EXEMPTION POLICES ITSELF: if the fonts move again, or the extension list outlives the
files it was written for, this says so rather than quietly widening the scan's blind spot.`,
  ],
  "scripts/check-head.mjs#18": [
    "NUMBER",
    "what a stale floor gave up; four dated readings, the blind-zone percentages and the claimed-versus-measured account go to the history document",
    `FLOOR, RE-MEASURED THROUGH THIS WALK by running the gate. Earlier values had drifted far
enough under the tree that whole roots could have dropped out of the scan and it would still
have cleared. The class this preflight guards is a file whose bytes defeat text tooling, so a
scan that quietly stops covering a third of the tree is precisely the failure it must not have.`,
  ],
  "scripts/check-head.mjs#19": ["CONTRACT", "section marker, rule padding cut", `the runnable gate set`],
  "scripts/check-head.mjs#20": ["CONTRACT", "section marker, rule padding cut", `the extraction`],
  "scripts/check-head.mjs#21": [
    "WHY",
    "why a junction and why through node",
    `\`ln -s\` COPIES on this host and an install in a throwaway tree would cost minutes. A junction
is the one primitive that links without copying, and node's \`symlinkSync\` with type "junction"
is the only reliable way to make one from here: the shell form loses its arguments to path
conversion.`,
  ],
  "scripts/check-head.mjs#22": ["CONTRACT", "what bootstrap does and why; two lines already"],
  "scripts/check-head.mjs#23": [
    "WHY",
    "why it is built and why before the content build; the ruling number goes to the history document",
    `THE STACK ARTIFACT, built IN THE WORKTREE and BEFORE the content build, which reads it.
Gitignored, so an extraction has its sources and not it; without this step the content build
fails on a missing file that is not HEAD's fault.`,
  ],
  "scripts/check-head.mjs#24": [
    "WHY",
    "why the local build product is built here",
    `THE LOCAL BUILD PRODUCT, built IN THE WORKTREE against HEAD's own sources: it is gitignored,
so an extraction has markdown and no build product, and the gates that read it would fail on a
missing file that is not HEAD's fault.`,
  ],
  "scripts/check-head.mjs#25": [
    "WHY",
    "the same reason, and what it reported when missing",
    `THE PUBLICATION TWINS, for the same reason and found on the day they landed: they are
gitignored build product, so an extraction has the PDFs and no twins, and the gate that
compares them reported a missing build step rather than anything about HEAD.`,
  ],
  "scripts/check-head.mjs#26": [
    "WHY",
    "the same reason once more, in two lines",
    `THE ENHANCEMENT BUNDLES, for the same reason: the dist directory is gitignored, so an
extraction has the source and no bundles, and HEAD's \`?url\` imports name files that would not
exist.`,
  ],
  "scripts/check-head.mjs#28": [
    "WHY",
    "why cleanup must survive a crash, and why prune runs regardless",
    `Cleanup MUST survive a crash. A stale worktree is invisible: \`git status\` stays clean, and
the next run fails to create one at a path that already exists. Prune runs regardless, because
\`remove\` fails if the directory was already gone.`,
  ],
  "scripts/check-head.mjs#29": ["CONTRACT", "one line already; kept"],
  "scripts/check-head.mjs#30": ["CONTRACT", "one line already; kept"],
  "scripts/check-head.mjs#31": [
    "NUMBER",
    "what this floors that the gate floor cannot, and why the floor did not move; both dated re-measurements and the rotted prose go to the history document",
    `EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS. The other floor covers the GATES that ran
inside the extraction; this covers what this gate asserts AROUND that run, because if those
stopped the gate floor would stop being consulted and the run would still report clean.
RE-MEASURED BY RUNNING IT, never summed; most of the count is one assertion per gate run.`,
  ],
};
