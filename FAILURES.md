# FAILURES.md

Recurring failure SHAPES in this repo. One line each, with one citation.

Every one of these was already written down somewhere, at length, when it
happened again. That is the problem this page exists to solve: a pile of stories
is not findable, a list is. **If this page grows past one screen it has failed
at its own job.**

Scope, so it does not become a second copy of something: it leaves out the
GATE-WRITING disciplines (anchor needles, strip before matching, enumerate inside
exclusions, floors through the pipeline). This page carries the REASONING shapes,
which is what repeats across people and sessions.

## Sweeping

- **A fix in N-1 of N sites is not a fix.** The empty-trash guard was fixed on one
  instance; three sibling delete paths kept failing open for weeks. `0ad6c86`
- **A correct rule applied to a category nobody verified is uniform destroys what
  was hiding inside it.** "Cut current state" was right; bindings had been filed
  inside status paragraphs. Extract, then cut. `capsid:dustinedwards/decisions-vol-7.md`

## Believing a claim

- **A written record is a dated claim, not a current property.** A clause from
  history put a stale fact back into the file sessions read first; two gate
  notes went false after being written, one in the commit that wrote it; a
  "32x regression" ran against a stale baseline. `CLAUDE.md` rule 15 `3fb98fb`
- **A stop is a claim until an independent check confirms it.** The Stop hook
  reported a clean stop for days while `tsc -b` was red, because it read the
  wrong stream. `4fe03d7`

## Proving

- **A plant is proven APPLIED, in the ARTIFACT THE GATE READS, before any
  result is read, and must produce the NAMED failure.** Exit 1 only proves
  something failed. A 30 KB constant planted in source was folded to 3e4 by the
  minifier: the gated chunk grew 17 bytes and the plant never applied.
  `VERIFICATION.md` `scripts/check-page-payload.mjs`
- **A search with an empty scope or an empty needle returns a plausible
  number.** A scan that examined no files reports what a clean sweep reports;
  an empty needle matched every line and two files reported "436 CRLF lines"
  and "521 CRLF lines", which are their line counts. `VERIFICATION.md`
- **A limit positioned where it cannot bite is not a limit, and it drifts there
  quietly.** Three forms: a 10,000-character ceiling over an 8,479-character
  file; a floor 54 under its own count, so 54 assertions could stop running and
  still pass; and a breach that set `process.exitCode = 1` one line above an
  unconditional reassignment. Re-measure by RUNNING, never by arithmetic on the
  old number. `VERIFICATION.md` `scripts/check-floors.mjs`
- **A rule whose instrument the instrument-checker cannot reach is not gated.**
  A scope floor over a GROWING set is an executed-count floor in disguise:
  `MINIMUM_FILES` drifted eleven files unseen, printing no floor line for
  `check:floors` to read. `34e62f1`
- **A replay aimed at wall-clock time measures the instrument's own latency
  first.** A loop aimed 300 ms before a minute boundary started 39 s later, at
  a random phase; 0 of 3 reproduced a failure that was real. `1748513`
- **A spawned process behaves differently in the shell that ships.** A bare
  `bash` passed every session under git bash and refused six times with ENOENT
  at ship step 4 in PowerShell; `shell: true` on Windows joined argv unquoted,
  so a seed SQL string became a program named after its first word. Resolve the
  binary, skip the shell. `dc0ce97` `scripts/check-browser.mjs`

## Measuring the wrong thing

- **An instrument only sees what it was threaded through. Prefer structure.** A
  timing instrument threaded through one call site proved nothing about the
  other. `5940242`
- **A proxy is not the property, and it passes while the property fails.**
  One `artifact_load` mark reported while two reads happened; a headless render
  read a non-empty root as clean while the text was invisible; a probe anchor
  measured 10px and gave a threshold 10px wrong.
  `scripts/check-invariants.mjs` `app/components/site-header.tsx`
- **Two gates can cancel: one demands a name be written down, the other reads
  the writing as use.** Neither is wrong alone, neither can fail. `af69b45`
- **A whole-document match is satisfied by a neighbor.** A 900-character window
  around the anchor read the next function's compliance. `df99bf1`
- **A comment can satisfy an assertion about code, and can fail one.** Both
  happened in one week; a needle can also match inside a sentence asserting the
  opposite of what it tests. `ff0d738`
- **One helper name with two argument orders can never fail.** The string lands
  in the condition slot, is truthy, and the check count still goes up.
  `scripts/check-invariants.mjs` section 17
- **A hardening change can silently be a change to a value another subsystem
  reads.** Wrapping the Ask question in delimiters also rewrote the retrieval
  query, since AI Search searches the last user message; every question then
  retrieved nothing and the new zero-chunk guard answered every reader with the
  no-answer text, correctly. `app/lib/search/ask-prompt.mjs`
- **A construct the scan does not reach is not exempt; it is a subject with no
  gate, and the pass reads as absence.** Three forms so far: the mentions reader
  passed both visibility sections by carrying no predicate either scans; a
  `reject` hid from `check:destructive` behind a ternary; an entire operator
  surface spelled its verbs with a different noun. Teach the gate the other
  spelling, then prove it bites. `app/db/index.ts`
  `app/routes/admin.mentions.tsx` `scripts/check-destructive.mjs`
- **A backslash escape in prose can reach disk as a control byte and still
  render close enough to survive review.** Three: backslash-f left
  `ont-display` in app.css, backslash-b broke a gate needle, backslash-a
  ate a separator in a libuv path. `scripts/check-invariants.mjs` section 29
