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
    `Trusted scoring glue, run from the DEFAULT branch from a copy stashed before any untrusted byte
exists on the runner.

BOUNDARY: IT NEVER RUNS ATTEMPT-CONTROLLED CODE. It reads the TAP the reporter produced and
counts top-level results, never an exit code.`,
  ],
  "scripts/improve-report.mjs#1": [
    "WHY",
    "why column 0 is unreachable, in two lines",
    `Matched at column 0, which a test cannot reach: node's reporter prefixes its lines with "# ".`,
  ],
  "scripts/improve-report.mjs#2": [
    "WHY",
    "what TAP escaping does not cover; the date and the phase name go to the history document",
    `THE NONCE: TAP escaping protects only output that went through node's reporter, and the
secondary phases pipe a lint tool's RAW stdout into the same stream. Held in a shell variable
and unset from the environment before any attempt code runs.`,
  ],
  "scripts/improve-report.mjs#4": [
    "CONTRACT",
    "what a segment is and why it is declared once",
    `One segment of the container's output stream with the status the trusted shell printed.`,
  ],
  "scripts/improve-report.mjs#6": [
    "WHY",
    "why the map lives here, the offline rule and what null means; the CI plant and the dates go to the history document",
    `The per-repo command map. The secondaries used to be measured by the job that runs attempt code
by design, and a plant set every one of them in a signed report. The two that CAN be recomputed
are recomputed inside the same \`--network none --read-only\` container as the holdout, and EVERY
COMMAND MUST RUN OFFLINE: one that does not run yields NULL, never the forgeable value.`,
  ],
  "scripts/improve-report.mjs#7": [
    "WHY",
    "why two exclusions and that neither is to move a number; the scores and the ruling date go to the history document",
    `UNIT TESTS ONLY, which took two exclusions: the bare runner swept in playwright specs that
cannot run behind \`--network none\`, and excluding them by folder revealed integration tests
outside it. Neither is excluded to make a number go up, and both are UNSCORED on the record.`,
  ],
  "scripts/improve-report.mjs#8": ["CONTRACT", "what null means here; two lines already"],
  "scripts/improve-report.mjs#9": [
    "WHY",
    "what the manifest is not, what it buys and the two consumers; the broken anchor's figures go to the history document",
    `The holdout import manifest: every name the hidden suite imports out of the repo's source. NOT
A SECURITY CONTROL and deliberately not secret. WHAT IT BUYS: a bloat pass removed two exports
on a scan that found no caller, and the holdout imports both while being invisible to anything
running in the repo. TWO CONSUMERS pull opposite ways, the dead-export check reading a name
here as a caller and the sync job refusing a case importing a name that is not.`,
  ],
  "scripts/improve-report.mjs#11": ["CONTRACT", "what the file may contain; two lines already"],
  "scripts/improve-report.mjs#13": [
    "CONTRACT",
    "why relative specifiers only, and why bound names count",
    `Matched on the specifier being RELATIVE: a builtin or a package says nothing about this repo's
exports. Default and namespace imports are reported under the names they bind.`,
  ],
  "scripts/improve-report.mjs#16": [
    "WHY",
    "the anchor and the boundary; the five bad runs and their names go to the history document",
    `ANCHORED AT A STATEMENT START, and the clause may not cross a \`;\`: a lazy match swallowed the
builtin imports above the first relative one and reported names like \`from\` and \`import\`.`,
  ],
  "scripts/improve-report.mjs#17": ["WHY", "the snapshot rule and the no-suppression rule; carries a tool directive, kept byte-identical"],
  "scripts/improve-report.mjs#18": [
    "CONTRACT",
    "what it returns and why it never names a file",
    `The gate on the holdout import manifest. It NEVER names a case file, a filename being part of
the hidden suite and this log readable; it names the missing IMPORTS, which are export names.`,
  ],
  "scripts/improve-report.mjs#21": [
    "WHY",
    "why files rather than an inlined string, and what the tree list buys",
    `Files rather than an inlined string: the container command is a single-quoted shell literal.
\`trees.txt\` is the OTHER half of the trusted map, so an attempt cannot decide which of its own
trees are believed, and taking each declared tree WHOLE keeps a file it deleted deleted.`,
  ],
  "scripts/improve-report.mjs#25": ["CONTRACT", "what counts as a top-level result; already short"],
  "scripts/improve-report.mjs#27": ["CONTRACT", "what null means; two lines already"],
  "scripts/improve-report.mjs#29": [
    "WHY",
    "why zero results is not a pass",
    `One case passes iff its report has a top-level ok and no not-ok. Silence cannot score.`,
  ],
  "scripts/improve-report.mjs#31": [
    "CONTRACT",
    "what bounds the stream and what the four kinds are",
    `Split a concatenated stream into its trusted segments, discarding the preamble. \`##CAPSID-END\`
bounds it, so a truncated stream is visible rather than scored on partial output. Four kinds,
the three phases plus "status", so a phase that could not run is distinguishable from one that
ran and found nothing.`,
  ],
  "scripts/improve-report.mjs#35": [
    "WHY",
    "why the assignment is outside the closure",
    `\`open\` RETURNS the segment and the loop assigns \`current\`: a checker cannot follow an
assignment made in a callback and narrowed it to \`never\` at every later use.`,
  ],
  "scripts/improve-report.mjs#38": ["CONTRACT", "one rule for one case and for a stream; already short"],
  "scripts/improve-report.mjs#40": [
    "WHY",
    "why an unterminated stream scores zero",
    `An unterminated stream scores ZERO, not a partial count: a failed measurement must never look
like a good one.`,
  ],
  "scripts/improve-report.mjs#42": [
    "CONTRACT",
    "where the two numbers come from and what null means",
    `THE RECOMPUTED SECONDARIES, out of the container and never out of the attempt's own artifact.

  test_pass_rate  the top-level TAP ratio of the repo's own test command, in the sandbox
  lint_count      how many lines of the lint output match this repo's pattern

A phase that could not run yields null: an unmeasured metric must never read as the number the
attempt wrote down.`,
  ],
  "scripts/improve-report.mjs#47": [
    "CONTRACT",
    "what counts as having run and why it is spelled out",
    `A phase RAN if the container finished with a status that is not "could not execute". An
explicit null check rather than a predicate helper, so the narrowing is visible to a checker.`,
  ],
  "scripts/improve-report.mjs#51": [
    "WHY",
    "how zero matches read as zero problems; the tool, the date and the exit code go to the history document",
    `A CRASH IS NOT A CLEAN LINT: a linter that could not resolve its binary exited nonzero and
matched no count pattern, so "zero matches" read as "zero problems". Nonzero with no matches
is neither, so it is null.`,
  ],
  "scripts/improve-report.mjs#52": [
    "WHY",
    "what a declared-but-never-reported metric did, and the both-directions test; the audit number goes to the history document",
    `THE SECONDARY METRICS THIS SCORER REPORTS, in report order. It was five: two were emitted as a
literal null by every repo while being declared as signals. The test derives that document's
list from this array and fails BOTH ways.`,
  ],
  "scripts/improve-report.mjs#53": [
    "CONTRACT",
    "why coercion is refused",
    `A finite number or null; coercion is refused so a stray value cannot read as a measurement.`,
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
    `AN EMPTY STREAM IS NOT A RESULT: 0 means both "every hidden test failed" and "none ever ran",
which is correct for a SCORE and useless as a diagnosis.`,
  ],
  "scripts/improve-report.mjs#58": ["CONTRACT", "what it reads and why no filename; already short"],
  "scripts/improve-report.mjs#62": [
    "WHY",
    "what a bare null cannot tell apart",
    `WHY IT IS NULL, IN THE RUN LOG: the log could not tell "the command was not found" from "it
ran and produced nothing parseable", which is a typo in the map against a dropped flag.`,
  ],
  "scripts/improve-report.mjs#63": [
    "WHY",
    "why both ends of the output",
    `HEAD AND TAIL: a Node crash's tail is the version banner, and the missing-module message is at
the TOP, so printing only the tail turned a resolution failure into three closing braces.`,
  ],
  "scripts/improve-report.mjs#64": [
    "WHY",
    "what the leading space defends against; the test name goes to the history document",
    `ONE LEADING SPACE, AND IT IS DELIBERATE: the problem matcher the runner registers for the whole
job anchors at a non-space column, so without it a lint phase that found type errors made every
green run carry annotations against a path nobody wrote.`,
  ],
  "scripts/improve-report.mjs#66": [
    "WHY",
    "what a disagreement looks like and which side wins",
    `THE CROSS-CHECK: the artifact is written on a runner that has already run attempt code, so a
disagreement is what a forged one looks like. The container value wins; the disagreement prints.`,
  ],
  "scripts/improve-report.mjs#71": [
    "WHY",
    "where the anchor comes from and why absent is zero; the audit reference goes to the history document",
    `THE ANCHOR IS NOT READ FROM THE ARTIFACT: it comes from the build job's own outcome, the
artifact being written on a machine that has executed attempt code. Absent is 0, not 1.`,
  ],
  "scripts/improve-report.mjs#72": [
    "WHY",
    "what the artifact is still read for, and why",
    `NOR ARE THE RECOMPUTED SECONDARIES. The artifact is read for bundle_size_bytes and nothing
else: that is the one secondary no offline container can recompute.`,
  ],
  "scripts/improve-report.mjs#73": [
    "WHY",
    "why an unjudged attempt is not a reverted one",
    `WHETHER THE MACHINE WORKED: an attempt carrying \`ok: false\` is left UNJUDGED rather than
reverted, none of the numbers above describing the attempt in that case.`,
  ],
  "scripts/improve-report.mjs#74": ["CONTRACT", "why the direct-run guard; two lines already"],
  "scripts/check-head.mjs#0": [
    "CONTRACT",
    "what it observes, what it inherits and why the counts are not written here; both founding incidents, every cost measurement and the 2881s reading go to the history document",
    `Gate: run the offline tier against a FRESH CHECKOUT OF HEAD, not the disk.

  npm run check:head
  node scripts/check-head.mjs --ref <branch|sha>

BOUNDARY: it observes a CHECKOUT, not the deploy, and it inherits every excluded gate's
blindness, each carrying its grounds at EXCLUDED.`,
  ],
  "scripts/check-head.mjs#1": [
    "CONTRACT",
    "why derived, in two lines",
    `DERIVED from the offline tier minus EXCLUDED, so a gate added to \`check-all.mjs\` and forgotten
here shows up as a mismatch rather than being silently skipped.`,
  ],
  "scripts/check-head.mjs#2": ["CONTRACT", "the recursion, in two lines; kept"],
  "scripts/check-head.mjs#3": [
    "WHY",
    "why it squares rather than loops, and why nothing is lost",
    `RECURSION OF THE SECOND KIND, and it squares rather than looping: \`check:floors\` runs every
counting gate and this runs the tier containing it. Nothing is lost, both numbers being
properties of the GATE rather than of the checkout.`,
  ],
  "scripts/check-head.mjs#4": [
    "WHY",
    "why it can never pass in an extraction, with its citation; the verbatim failure list and both staleness dates go to the history document",
    `\`bootstrap-config.mjs\` creates the real config BY COPYING the example, so real == example by
construction, and this gate's job is asserting they DIFFER. It can never pass in an extraction,
which is the gate being correct rather than a limitation, and is why check:config is
load-bearing on exactly one machine. The list is not restated here, on hard rule 17.`,
  ],
  "scripts/check-head.mjs#5": [
    "WHY",
    "what it reads and why a checkout lacks it; the verbatim error goes to the history document",
    `Defaults to \`--local\`, which reads miniflare state a checkout does not have.`,
  ],
  "scripts/check-head.mjs#6": [
    "WHY",
    "why building to satisfy it would be wrong",
    `Reads gitignored build output. Building inside the worktree would measure a build of HEAD that
nothing deploys, at a full client build's cost per run.`,
  ],
  "scripts/check-head.mjs#7": [
    "WHY",
    "why it is a different kind of exclusion and what it buys; the memory figures and the killed runs go to the history document",
    `NOT a can-it-run exclusion: this one CAN run and its property is proven twice by then, ship
refusing a dirty tree and CI running it on a clean checkout of the same sha. What it buys is
MEMORY: nested here it ran a vitest and three workerd INSIDE this gate's extraction.`,
  ],
  "scripts/check-head.mjs#8": ["CONTRACT", "one line already; kept"],
  "scripts/check-head.mjs#9": [
    "WHY",
    "what a one-line forward lost, why there is a cap and why truncation is announced; the incident and the sizing arithmetic go to the history document",
    `HOW MUCH OF AN INNER GATE'S OUTPUT REACHES THIS ONE'S. This kept the FIRST matching line, and
every gate prints a LABEL then an INDENTED DETAIL, so the detail never survived. THE CAP binds
on lines or characters, whichever comes first, and SAYS SO: silence reads as "that was all".`,
  ],
  "scripts/check-head.mjs#10": ["CONTRACT", "what the fallback covers; already short"],
  "scripts/check-head.mjs#12": ["CONTRACT", "section marker, rule padding cut", `NUL preflight`],
  "scripts/check-head.mjs#13": [
    "WHY",
    "what a NUL defeats and why bytes not text; the two carriers and their durations go to the history document",
    `A NUL byte makes git render a file as binary and ripgrep skip it, so a change rides into a
commit unreviewed. **This reads BYTES, not text**: the class is about files whose byte content
defeats text tooling, so the check guarding it must not be a text check.`,
  ],
  "scripts/check-head.mjs#14": [
    "WHY",
    "why a scan scoped to the last defect catches only the last defect; the file, the dates and the eol reading go to the history document",
    `\`test\` JOINED after the class was found living there. A scan scoped to where the last defect
was found is a scan that can only ever catch the last defect.`,
  ],
  "scripts/check-head.mjs#15": [
    "WHY",
    "why the exemption is named by extension and not by sniffing; the font move and its date go to the history document",
    `Extensions that are BINARY BY NATURE, so a NUL in them is not the defect. **NAMED BY
EXTENSION**, because exempting anything whose bytes fail a UTF-8 decode fails OPEN on exactly
the case this exists for: a \`.ts\` with a NUL in it is a file that looks binary.`,
  ],
  "scripts/check-head.mjs#17": [
    "WHY",
    "why the exemption polices itself",
    `THE EXEMPTION POLICES ITSELF: if the fonts move, this says so rather than widening the scan.`,
  ],
  "scripts/check-head.mjs#18": [
    "NUMBER",
    "what a stale floor gave up; four dated readings, the blind-zone percentages and the claimed-versus-measured account go to the history document",
    `FLOOR, RE-MEASURED THROUGH THIS WALK by running the gate. Earlier values had drifted far enough
under the tree that whole roots could have dropped out and it would still have cleared.`,
  ],
  "scripts/check-head.mjs#19": ["CONTRACT", "section marker, rule padding cut", `the runnable gate set`],
  "scripts/check-head.mjs#20": ["CONTRACT", "section marker, rule padding cut", `the extraction`],
  "scripts/check-head.mjs#21": [
    "WHY",
    "why a junction and why through node",
    `\`ln -s\` COPIES on this host. A junction is the one primitive that links without copying, and
node's \`symlinkSync\` with type "junction" is the only reliable way to make one from here.`,
  ],
  "scripts/check-head.mjs#22": ["CONTRACT", "what bootstrap does and why; two lines already"],
  "scripts/check-head.mjs#23": [
    "WHY",
    "why it is built and why before the content build; the ruling number goes to the history document",
    `THE STACK ARTIFACT, built IN THE WORKTREE and BEFORE the content build, which reads it: it is
gitignored, so without this step the build fails on a file that is not HEAD's fault.`,
  ],
  "scripts/check-head.mjs#24": [
    "WHY",
    "why the local build product is built here",
    `THE LOCAL BUILD PRODUCT, built IN THE WORKTREE against HEAD's own sources, for the same reason.`,
  ],
  "scripts/check-head.mjs#25": [
    "WHY",
    "the same reason, and what it reported when missing",
    `THE PUBLICATION TWINS, same reason, found on the day they landed: the gate comparing them
reported a missing build step rather than anything about HEAD.`,
  ],
  "scripts/check-head.mjs#26": [
    "WHY",
    "the same reason once more, in two lines",
    `THE ENHANCEMENT BUNDLES, same reason: HEAD's \`?url\` imports name files that would not exist.`,
  ],
  "scripts/check-head.mjs#28": [
    "WHY",
    "why cleanup must survive a crash, and why prune runs regardless",
    `Cleanup MUST survive a crash: a stale worktree is invisible, \`git status\` stays clean, and the
next run fails at a path that already exists. Prune runs regardless.`,
  ],
  "scripts/check-head.mjs#29": ["CONTRACT", "one line already; kept"],
  "scripts/check-head.mjs#30": ["CONTRACT", "one line already; kept"],
  "scripts/check-head.mjs#31": [
    "NUMBER",
    "what this floors that the gate floor cannot, and why the floor did not move; both dated re-measurements and the rotted prose go to the history document",
    `EXECUTED-COUNT FLOOR ON THIS GATE'S OWN ASSERTIONS, because if those stopped the gate floor
would stop being consulted and the run would still report clean. RE-MEASURED BY RUNNING IT.`,
  ],
};
