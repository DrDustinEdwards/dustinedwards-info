# VERIFICATION.md

How to prove a deploy, a claim, or a gate.

Techniques learned by being wrong, not by being designed. Each one names what it
cost. **Hard rules 7, 10 and 12 in `CLAUDE.md` are the principles; this is how to
execute them.**

**Provenance is marked per entry**, because this file exists to be trusted and
some of these were measured by earlier sessions rather than the one that wrote
them down.

## Why this file is in the repo

*Moved from Capsid `dustinedwards/verification-method.md` on 2026-08-20, with the
hard rules, for one reason.*

**Capsid cannot be gated, because every gate verifies disk.** A method document
the gates cannot reach is a method document nothing can check, and the measured
consequence was a month of numbers that were confidently wrong: gate counts,
suite timings, and a hard-rule list that existed in NO current document for a
period. The Capsid copy is now the historical one. This is the live one.

That does NOT make the numbers here self-checking. **Every duration and count
below is a dated observation, not a maintained value**, on the same rule as a
commit message. Re-measure before relying on one, and read the date first.

---

## Proving a build

### Validate the negative against HEAD~1 before trusting it

*Measured 2026-08-07.*

Hard rule 7 says prove a deploy both directions: strings the commit ADDED are
present, strings it DELETED are absent. The trap is that the negative may not
discriminate.

On 2026-08-07 the corrected colophon sentence was a **strict prefix extension**
of the false one. The obvious negative, `"rather than reimplementing it"`, was
present in the old build AND the new one, so it would have passed against the
code being replaced and proved nothing. The only genuinely removed string was an
**adjacency across a sentence boundary**, `"reimplementing it. Safety rails"`,
which existed because the new sentence now sits between them.

So: before running a needle against production, run it against `HEAD~1`. It must
be present there and absent at `HEAD`. A needle that matches both is not
evidence.

This generalizes past prefix extensions. Any purely additive change has no
deleted string at all, and the honest report is that a both-directions test is
unavailable, not a passing one-directional test dressed up.

**The positive needs the same validation.** *Measured 2026-08-09, applied
2026-08-10:* proving the deployed build contained `check:secrets` was done by
first confirming the pre-secrets artifact at `73fc7af` contained that string ZERO
times, so the hit against production discriminated between builds rather than
matching something that was always there.

### Assert the shape that exists, not the shape you assumed

*Measured 2026-08-07.*

The colophon gate-count verification was specified as "confirm `/colophon` reads
18 gates", and the literal string `18 gates` **does not appear** on the page or
in the index. The section lists gate NAMES; nothing counts them in prose. A
needle for `"18 gates"` returns zero against a page that is entirely correct, and
a session under pressure to report a pass could easily have reached for `"18"`
alone, which matches noise.

Read the artifact first, then write the assertion. Here the honest form was to
count distinct `check:[a-z-]+` names and confirm the new one is among them, which
gave 18 on the page and 18 in D1, validated against the previous artifact at 17.

### A commit can be correct, shipped, and have no wire signature

*Measured 2026-08-07.*

`b9c050c` landed two files that were already running in production, because an
earlier deploy had built them out of a dirty working tree. Committing them
changed no served byte. There is no probe that can distinguish "committed" from
"uncommitted but deployed", because the wire only ever shows what the build
contains.

The consequence: **the wire proves the DEPLOY, never the REPO.**

### There are now FOUR instruments, and they answer four different questions

*Third and fourth arms added 2026-08-20, when CI landed.*

Confusing them is how a green result gets attributed to the wrong subject.

| Instrument | Subject | Blind to |
| --- | --- | --- |
| gates on this disk | the working tree | anything uncommitted |
| `check:head` | a committed ref, extracted to a worktree | this machine's private state: it reuses `node_modules` and a real `wrangler.jsonc` |
| **CI** (`.github/workflows/ci.yml`) | a clean checkout on a machine that has never seen this repo | anything needing credentials or account-scoped config |
| a live probe | the deployed build | which commit produced it |

**Every gate verifies DISK, not HEAD**, so a gate can be green while its subject
is uncommitted. That is what `check:head` exists for. But `check:head` runs HERE,
with this machine's `node_modules`, generated types and real `wrangler.jsonc`, so
it cannot see a dependency installed locally and absent from the lockfile, or a
gate that silently depends on account-scoped config.

**CI is the review the author is not.** *Measured 2026-08-20 on the first clean
checkout: 22 passed, 4 failed.* Two failures were real and permanent and are now
named in `CI_EXCLUDED` with their reasons (`check:config` cannot pass in ANY
checkout by construction; `check:backup` needs gitignored miniflare state).
**The other two were artifacts of the measurement itself**: the trial used
`git archive`, which produces no `.git`, so `check:content`'s gitignore tripwire
and `check:head`'s worktree both failed on "not a git repository".
`actions/checkout` provides a real repository, so neither is excluded.

That is worth its own line. **Two of four failures were properties of the probe,
not of the subject**, and excluding all four would have permanently blinded CI to
two real gates on the strength of a measurement artifact. Establish what the
instrument itself contributes before ruling on what it found.

### Poll to stability, not to first success

*Recorded earlier, unchanged.*

A probe sent during the rollout window can be served by the PREVIOUS version, so
a fix can look broken and, worse, a bug can look fixed. Force a MISS with a fresh
cache key; the public routes carry `stale-while-revalidate` at the edge (`app/lib/seo.ts`
owns the window) and will otherwise serve a stale body.

---

## Querying and searching

### A ZERO FROM A SEARCH PROVES NOTHING UNTIL THE SCOPE IS PROVEN NON-EMPTY

*Measured 2026-08-09.*

`grep -rn --include="*.{ts,tsx,mjs,json,md}" TERM dirs/` matched ZERO FILES,
because grep does not brace-expand: the pattern is taken literally as one
filename glob. Three searches for confabulated identifiers each returned a clean
zero, and all three zeros were meaningless, indistinguishable from the true
negatives they were mistaken for. The correct answer happened to also be zero,
which is exactly why the defect class is dangerous: the wrong instrument agreed
with reality by coincidence.

Caught by a one-line control: count the files the search examined before trusting
its result. **A search whose scope is empty reports the same thing as a search
that found nothing.**

The discipline pairs with the plant discipline and covers the other direction. A
plant proves the POSITIVE can fire. The scope count proves the NEGATIVE means
something. An investigation that reports "zero hits" without either has reported
the color of its own blindfold.

### AN UNANCHORED NEEDLE IS NOT EVIDENCE EITHER

*Measured 2026-08-10, live, during a plant.*

The `check:head` recursion guard was first verified with `grep -c "check:head"`
against the executed-gate list, which returned 1 and looked like a violation. The
match was `check:headers`. Re-checked with `grep -cx` (whole-line): zero
`check:head`, one `check:headers`, guard correct.

The needle prefix problem is structural in this repo:
`check:head`/`check:headers` and `check:content`/`check:contrast` are both prefix
pairs. **Anchor every needle that verifies a name: `-x` for whole lines, `-w` for
words, or delimit the match.** An exit code or count from an unanchored needle
inherits the ambiguity of the needle.

### AND AN EMPTY NEEDLE COUNTS EVERY LINE, WHICH LOOKS LIKE A MEASUREMENT

*Measured 2026-08-20, while checking whether this very file's line-ending entry
was stale.*

The degenerate case of the class above, and worse than it, because the failure
does not present as a suspicious zero. It presents as a plausible number.

Checking how many tracked files still carried CRLF ran a carriage-return needle
through grep inside a command substitution, and reported:

    scripts/check-all.mjs: 436 CRLF lines
    app/routes/search.tsx:  521 CRLF lines

Both files are 100% LF. **436 is the total line count of `check-all.mjs`, and 521
is the total line count of `search.tsx`.** The carriage return did not survive
command substitution, grep received an EMPTY pattern, and an empty pattern
matches every line. The reading was not merely wrong; it was a confident,
specific, per-file count that agreed with the stale claim being tested.

Isolated by running the same needle four ways on the same file in the same shell,
with a control:

| form | result |
| --- | --- |
| the needle, bare | 0 |
| the needle, bare, inside a `for` loop | 0 |
| the needle inside `$(...)` | **436** |
| the needle inside `$(...)` inside an `echo` | **436** |
| control: an explicitly empty pattern | 436 |

So **command substitution is what ate it**, not the loop, and the control pins
the mechanism rather than leaving it inferred.

Two disciplines, and the second is the general one:

1. **Do not pass a bare control character as a pattern.** Use something the shell
   cannot flatten: `grep -cP` with an escape sequence, or better, ask git
   directly with `git ls-files --eol`, which reports the working-tree and index
   endings per file and cannot degenerate.
2. **A needle that can degenerate to empty needs a control proving it did not.**
   The empty pattern's signature is that the count EQUALS the line count.
   Comparing against `wc -l` is one line and would have caught this instantly.

This is the same shape as the unfailable-condition class in hard rule 10, moved
out of the gate scripts and into the verification commands, where nothing lints
it. The gates are audited for assertions that cannot fail. **The shell commands
used to audit the gates are not.**

### `instr()`, not `LIKE`, for a case-sensitive D1 check

*Recorded from prior measurement; the 2026-08-07 checks used `instr()` on this
basis.*

SQLite's `LIKE` is **case-insensitive for ASCII by default**. A check meant to
distinguish two spellings matched the same row twice. `instr()` is case-sensitive
and is the right instrument for an exact-text assertion.

### A substring search over source files is not a claim about what the index retrieves

*Recorded from prior measurement.*

The classic index is stemmed (porter, for prose) and section-grained. Grepping
the corpus for a phrase tells you the phrase is in a file. It does not tell you
the phrase is retrievable, which token it stems to, which record carries it, or
whether a query for it returns anything. Assert against the index when the claim
is about search, and against the file when the claim is about content.

---

## Diagnosing a gate

### EXIT 1 IS NOT EVIDENCE THAT THE PLANT WORKED

*Measured 2026-08-07, and it is the most useful entry in this file.*

A plant is supposed to prove one specific assertion can fail. A non-zero exit
proves only that SOMETHING failed.

Planting the removal of `check:claude-md`'s line-ending normalization took three
attempts. The first two were mangled by shell quoting: the edit to the gate never
applied, so what actually ran was the unmodified gate against a CRLF file, which
tripped a DIFFERENT assertion, the line-ending pin. Both attempts printed
`1 FAILED` and `EXIT=1`. Both looked exactly like success. The normalization was
still completely unproven.

It was caught only by **reading which assertion fired** and noticing it named the
pin rather than the heading.

**The discipline: a plant names in advance the assertion it expects to fire, and
the report confirms THAT assertion, not merely a non-zero exit.** When the
expected assertion cannot be isolated, neutralize the others first.

Two earlier instances of the same shape, both 2026-08-07: planting a duplicate
`isAllowedUrl` as a top-level function exited 1 from a JavaScript SyntaxError
rather than from the gate; and removing the shared predicate from `cover.src`
produced exactly ONE failure while 96 behavioral checks stayed green, which is
the result that justified the assertion existing at all.

*Applied in full 2026-08-10 on the `check:head` build:* four plants, each naming
its assertion in advance, each confirmed by the verbatim firing line.

**And the corollary, hard rule 12's second half: a plant is proven APPLIED before
any result is read.** A green run after a failed plant proves nothing. *Measured
2026-08-20:* `check:policy` had an assertion satisfied by a COMMENT rather than
by code, and the comment stripper meant to prevent exactly that carried a regex
missing one backslash, so it had only ever stripped comments in column zero. The
defect was found by a plant that PASSED.

### A GREEN GATE CAN BE READING A COMMENT YOU JUST WROTE

*Measured 2026-08-20, twice in one session, in opposite directions.*

The first form: an assertion searched a file for a phrase, and the phrase was
present because it appeared in a comment explaining the rule. The gate was
grading the documentation of the code, not the code.

The second form, found while fixing the first: the replacement extracted a
900-character window around the anchor, which reached PAST the function under
test and read a NEIGHBOURING function's compliance. The repair was to extract the
function body by brace matching, so the window cannot spill.

Both are hard rule 10's comment-satisfied-anchor and unanchored-needle classes.
**When a gate asserts that source does something, strip comments first and bound
the window to the syntactic unit**, not to a character count.

The same trap has a mirror image in the gate's OWN prose. *Measured 2026-08-20:*
`check:claude-md` asserted the presence of the word "frozen" to prove the
numbering note was still there. Unfreezing the numbering wrote a sentence
containing that word, so the assertion would have passed on the very commit that
falsified it. **A needle can match inside a sentence asserting the opposite of
what the needle is testing.**

### ONE HELPER NAME WITH TWO ARGUMENT ORDERS IS A VACUITY MACHINE (the tenth class)

*Measured 2026-08-11 by the external audit and its fix session; triaged and
recorded by a third.*

`assert()` was defined seven times across the gates with FOUR argument orders. An
assertion copied between two disagreeing gates lands a non-empty STRING in the
condition slot; a string is truthy, so the assertion can never fail, and the
checks counter still increments, so the gate reports MORE coverage than before it
went blind. Both directions demonstrated: `assert(1 === 2, "must fail")` in a
label-first gate read 98/0, and `assert("must fail", 1 === 2)` in a
condition-first gate read 7/0.

The class lives in the API surface BETWEEN instruments, where a per-file lint
cannot look, which is why nine prior classes and a dedicated lint all missed it.
Three repairs, and the order matters:

1. **Distinct names for distinct shapes.** The condition-first helpers were
   RENAMED to `assertThat`, so a copy between shapes is a ReferenceError rather
   than a silent pass. A rename, deliberately not an argument swap: rewriting 58
   call sites at the end of a long session is exactly the operation that silently
   inverts an assertion.
2. **A consistency assertion**: one helper name, one first argument, everywhere
   it is defined, harvested from the definitions rather than assumed.
3. **A direct rule on the condition slot** (a string literal there is always
   truthy), which is LOAD-BEARING after the rename: a hand-written
   false-condition-in-the-label-slot call still passed 98/0 with the names
   unified, because nothing stops an author writing the arguments backwards by
   hand.

*Still true 2026-08-20:* three shapes coexist by design,
`ok(label, condition, detail)`, `assertThat(condition, label, detail)` and
`assert(label, ok, detail)`. **The names differ, and that is the property.** Do
not "tidy" them into one.

### A DICHOTOMY INHERITS ITS AUTHOR'S FRAME

*Measured 2026-08-11, resolving the audit's one contradiction.*

The contradiction was specified as a two-branch measurement: plant a no-predicate
`posts` read in `search.server.ts`; if section 6 fires, the auditor misread, and
if it does not, the shipped fix has a hole. The plant fired, and the auditor had
NOT misread: the queries it flagged read `search_docs`, a different table outside
section 6's jurisdiction, so both branches of the dichotomy were about the wrong
subject. Run as written, the test would have produced a confident, measured,
false verdict.

The discriminating measurement was deleting the predicate from the ACTUAL flagged
query and watching five gates stay green. **Before resolving an either-or by
measurement, check the question's own scope assumption against the artifact**: a
plant proves something about what it plants against, and the framing of the
question chose the target before any evidence was taken.

### Diagnose by DURATION, and there are THREE arms

*Two arms recorded earlier. The third measured 2026-08-07.*

- **Died early: it did not look.** A gate that exits far under its normal time
  has not done its work.
- **Full duration: it looked.** A failure at the usual runtime is a real finding.
- **FAR OVER: it stalled.**

Duration is the cheapest discriminator available, and it works before reading a
line of output.

The third arm came from `check:all` timing out at **10 minutes** against a 116 to
160 second norm. Isolated by running the network gates individually:
`check:media` had hit a transient R2 400 and was clean on retry at 27 seconds.

**A hang and a five-second death are the same transient class wearing opposite
symptoms.** The 2026-08-05 `check:backup` failure died in seconds on a
`sqlite_master` read; this one hung. Neither is a code defect and both look like
one. Establish the normal range before treating a duration as a signal:
`check:backup` alone has been measured at 272s, 54s, 58s, 66s and 53s.

**Norms measured 2026-08-20, and stale the moment a gate is added:** `check:head`
standalone 179s, and 98.9s when run inside `ship`. Read the next entry before
believing any number here that looks like a regression.

### BEFORE DIAGNOSING A SLOWDOWN, ACCOUNT FOR YOUR OWN LEFTOVER PROCESSES

*Measured 2026-08-20. It cost a session most of an investigation.*

`check:head` was observed at **2881 seconds** against a recorded norm of 41 to
59s, and was reported and investigated as a 32x regression. It was not a
regression. **The machine was running leftover `vite preview` servers and
Puppeteer browsers from earlier in the same session**, started by the browser
gate and never reaped. Re-measured on a quiet machine: 179s standalone.

The recorded norm was ALSO stale, which is why the two numbers looked so far
apart, so this was two independent errors reinforcing each other into a confident
false finding.

Three consequences, all now standing practice:

1. **`check:browser` leaks a preview server and a browser when interrupted.** A
   session that starts one stops it before measuring anything else.
2. **A duration compared against a recorded norm is a comparison against a dated
   observation.** Re-measure the baseline on the current machine before calling a
   delta a regression.
3. The cheapest control is a process list. It costs one command and it discharges
   the entire hypothesis.

### A HOOK THAT REPORTS "NO OUTPUT" MAY BE READING THE WRONG STREAM

*Measured 2026-08-19.*

The Stop hook ran `npm run -s typecheck` and reported **"No stderr output"** on
every stop while `tsc -b` was RED on `main`. **`tsc` writes its diagnostics to
STDOUT**, not stderr. The hook was faithfully reporting an empty stream while the
build was broken underneath it.

Found by the fix for a DIFFERENT defect in the same hook. Repaired properly by
promoting the typecheck to a gate, `check:types`, so a build that does not
compile fails the suite and CI rather than whispering into a hook's stderr.

**When an instrument reports "nothing", confirm it was pointed at the stream the
subject writes to.** This is the scope-count discipline applied to a file
descriptor.

### Plant to prove a gate, and prefer the assertion that can fail

*Measured 2026-08-07.*

`check:claude-md` shipped with an assertion that could not fail: a 10,000
character ceiling on an 8,479 character file, so moving the hard-rules section to
the very END still passed. A threshold larger than the whole input is not a
threshold. It was replaced by an ordinal check, falsifiable at any file size, and
the original was kept with a header note saying which of the two has teeth.

### An empty collection makes its per-item checks unfalsifiable; the repair is a self-testing validator, not a fixture

*Measured and repaired 2026-08-10.*

`check:secrets` shipped with per-entry assertions over `CLIENT_ALLOWED`, which is
empty, and empty is the CORRECT state. Both assertions iterated zero times and
could not fail. Planting a real entry to make them run would have polluted the
shipped artifact to satisfy the instrument.

The repair: extract the checks into `validateAllowlistEntry()`, keep the real
loop calling it, and add self-tests that run on EVERY execution against synthetic
good and bad entries. The checks stay falsifiable while the collection stays
empty. Proven by inverting a condition inside the validator: three named
self-test assertions fired.

The general form: when a gate's assertions live inside a loop over data that is
legitimately empty, the assertions need an execution path that does not depend on
the data.

---

## Driving a browser

*Section added 2026-08-20, when `check:browser` became the twenty-eighth gate. It
found eight real layout defects on its first run, against twenty-seven gates that
had never laid the site out.*

### ASSERT THE PAGE IS STYLED BEFORE ASSERTING ANYTHING ABOUT LAYOUT

*Measured 2026-08-20, and it nearly shipped a gate asserting on a blank page.*

The first draft drove the DEV server. **The dev server served ZERO applied CSS
rules**, so every element measured at its unstyled position. A layout assertion
against an unstyled page is not a weak test, it is a test of a different page,
and the numbers it produces are stable, repeatable and meaningless.

Two repairs, both kept:

1. Drive a PREVIEW build, not the dev server.
2. **The first assertion in the gate proves a stylesheet applied**, by counting
   rules reachable from `document.styleSheets`. Every later assertion is
   conditional on that one, which is the scope-count discipline from the search
   section applied to a rendering.

### AN EMULATION THAT SILENTLY DOES NOT TAKE MAKES THE READING INCONCLUSIVE, NOT NEGATIVE

*Measured 2026-08-20.*

Verifying that heading permalinks are reachable on touch meant emulating a coarse
pointer. `Emulation.setEmulatedMedia` was set for `hover: none`, and
`matchMedia("(hover: none)").matches` came back **false**. The emulation did not
take, and CDP reported no error.

Had the anchor's opacity then read 0, the honest conclusion was NOT "the fix
failed". It was "this instrument did not configure the condition under test".

**Confirm the emulated condition from inside the page before measuring anything
that depends on it.** When it cannot be confirmed, say the reading is
inconclusive and fall back to a different subject: here, asserting the
`@media (hover: none)` rule is present in the shipped CSS bytes, which is a
weaker claim honestly stated rather than a stronger one invented.

### "ABOVE THE FOLD" MEANS DUSTIN'S SCREEN, IN CSS PIXELS

*Recorded 2026-09-23 (job_6c8048097288).*

A screen size quoted in physical pixels is not the viewport a page lays out in.
PR #84 took "1920x890" as CSS pixels and reported the key row above the fold; on
Dustin's Windows 150% display it was not visible at all. **Any fold check measures
at 1280x593 CSS pixels, device scale factor 1.5** (his 1920x1080 monitor at 150%
scaling with a bookmarks bar), and states the viewport it used in its output.

---

## Recording

### A stale number in a pushed commit message is superseded, not amended

*2026-08-07.*

Commit `69ba15b`'s message records `check:all` at 159s. That was true when
written. The suite has since ranged 116s to over 600s, so the figure is now
meaningless as a norm.

**It is not amended.** History is not rewritten for a stale figure: an amend
changes a sha, and a sha that moved is a worse problem than a number that
drifted, especially in a repo where the deploy and the commit history have
already disagreed once.

The correction lives in the record instead. The general form: a commit message is
a dated statement of what was observed, not a maintained document. **Durable
numbers belong where they can be re-run and re-written; commit messages carry the
measurement that justified the change at the moment it landed.**

### A BOUNDARY NOTE IS A CLAIM THAT AGES

*Hard rule 7's second half. Two have gone false since being written.*

Every gate states its OBSERVATION BOUNDARY and `check:assertions` asserts the
note is present. **Presence is all it can assert.** Nothing checks that the note
is still TRUE, and the two that went false did so because the subsystem changed
underneath a correct sentence, which is the same failure mode as every stale
number in this file. Re-read the boundary note of any gate you are about to trust
for something load-bearing.

---

## Platform facts, measured

### `application/ld+json` is NOT gated by `script-src`; `speculationrules` IS

*Measured 2026-08-06 in the Report-Only observation window. **That window closed
on 2026-08-17: the CSP has been ENFORCED since `20c27d6`.** The asymmetry below
is the browser's and did not change with the phase.*

Both are non-executable data blocks in a `<script>` element, so the expectation is
that either both are gated or neither is. The browser disagrees. Ten violation
reports, all `script-src-elem`: `/` carries two un-nonced `ld+json` blocks and was
not reported; `/blog` carries an un-nonced `ld+json` AND a speculationrules block
and WAS reported; post pages isolate it further, with `ld+json` alone on line 1
never reported while the speculationrules block on line 53 was.

So the speculationrules element needs a nonce and the JSON-LD does not. Do not
"consistently" add one to the JSON-LD or remove the other; the asymmetry is the
browser's.

This is also the case for shipping a CSP **Report-Only first**. The asymmetry was
not going to be reasoned out.

*And the enforcement phase produced its own instance, 2026-08-17:* the editor
never mounted, because React's own scripts had no nonce. Report-Only had recorded
that violation and served the page anyway. **A Report-Only window tells you what
WILL break. It does not tell you what breaking looks like.**

### `light-dark()` and `@media (prefers-color-scheme)` resolve off DIFFERENT inputs

*Recorded from prior measurement.*

`light-dark()` resolves against the element's computed `color-scheme`.
`@media (prefers-color-scheme)` resolves against the OS preference. They are not
two spellings of one thing.

**No partial migration is safe.** A stylesheet that uses both will disagree with
itself exactly for the reader whose chosen theme differs from their OS setting,
which is the population this site's cookie-based theme exists to serve, and it is
the population least likely to be in the room when it is tested.

### `Vary` in Cache Rules, and what `cf.vary` is not

*Recorded from prior research.*

Origin `Vary` is honored through **Cache Rules**, which shipped 2026-07-02 on
all plans. It is **zone-gated**: it needs a proxied zone, and `workers.dev` has
none, which is why the `Vary` behavior on this site could not be configured
before DNS cutover.

`cf.vary` is **subrequest-only** and does not apply to a Worker acting as the
origin. It is not the mechanism for this problem and reaching for it wastes a
session.

The underlying constraint that neither of these fixes: the Workers Cache key is
entrypoint plus path and query plus Worker version plus `ctx.props`, and **`Vary`
is not part of it**. An ABSENT `Cookie` header is not its own variant either.
See `dustinedwards/workers-cache-vary.md`.

### Line endings are part of what a gate measures

*Measured 2026-08-07. Direction INVERTED by measurement 2026-08-10. **Disk state
RESOLVED 2026-08-11 and re-confirmed 2026-08-20.***

`core.autocrlf` was true on this host and `.gitattributes` pinned only specific
paths to LF. A file written directly by a tool was LF on disk; the same file from
a checkout was CRLF. A gate matching a literal newline-plus-heading therefore
passed on the author's disk and matched nothing in a clean extraction of the
identical commit. `check:claude-md` shipped that way and was **green locally and
red on every fresh Windows clone**, found by extraction.

Then the divergence ran the OTHER way. Once `cab1c9e` pinned `* text=auto eol=lf`
a fresh checkout produced LF, and the STALE copy became the disk: 130 of 274
tracked files differed from their committed blob in line endings ONLY, and
`git status` showed NOTHING, because `core.autocrlf=true` applied the same
conversion on the way in.

**Current state, measured 2026-08-20: 0 of 256 tracked text files carry a
carriage return, `core.autocrlf` is `false` for this repository (the system value
is still `true` and global is unset), and `git diff` is empty.** The whole tree
is pinned to LF.

**The method survives the repair, and that is the point of the entry.** Both
directions have now happened here, eleven days apart. **WHICH copy is stale
depends on when the pin landed relative to git last touching the file.** Measure,
do not assume the direction, and do not assume the disk is clean because this
paragraph says it was clean once. **The gates were made line-ending agnostic
anyway; that is the mechanism, and the clean disk is only the belt.**

Do not rely on trimming for this. The ordinal check in `check:claude-md` survived
the original break by accident, because a trim happens to strip a trailing
carriage return. Accident is not a mechanism.

*And the instrument used to confirm the current state got it wrong on the first
attempt. See "AN EMPTY NEEDLE COUNTS EVERY LINE" above. That entry exists because
of this one.*
