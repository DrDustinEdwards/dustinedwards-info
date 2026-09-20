# Ruling 115, wave 1: proofs (job_2cec82881996)

Base: cdb4300 (PR #40's merge). Pristine files are in
`scratchpad/code-history-before/` (gitignored, made by `node
scratchpad/code-history-apply.mjs snapshot`). Reproduce the cut with
`node scratchpad/code-history-apply.mjs apply`, and the proof with `prove`.

## What moved

2,013 comment blocks in the ten files with the most comment bytes (the same
ten Grok measured at 5b8007e, re-ranked at cdb4300 by `code-measure.mjs`).

- Tags (`code-history-tags.tsv`): WHY 1156, CONTRACT 784, NUMBER 21,
  HISTORY 52. Actions: keep 655, rewrite 1306, delete 52. 447 of the kept
  blocks are type annotations or tool directives, classified by the tooling.
- `code-history-2026-09-wave1.md` (909,647 bytes) holds every deleted or
  shortened block VERBATIM with its file and line at cdb4300, its tag, and
  why it moved. The seat files it in Capsid.
- No assertions were added. An unasserted NUMBER was cut from the source and
  kept in the history file, so executable code is unchanged everywhere.
- Waves 2 to 4 are in `code-history-waves-2-4.md`.

## 1. Code unchanged, and the machine-read comment content with it

`node scratchpad/code-history-apply.mjs prove`. "code only" is the source
through `stripComments` (the gates' tokenizer), with the leftover blank lines
dropped. THAT IS NOW THE ONLY NORMALISATION: the trailing-blank strip the first
draft also ran was measured and is redundant, 0 of 10 files need it, so every
surviving line is compared byte for byte. The control changes one code
character in the pristine file and must be detected, so the comparison can tell
two things apart (hard rule 12). Citations are `hard rule N` inside comments,
the text check:invariants section 15 counts; JSDoc heads are `@param {T} name`
and the like, which the scripts' typecheck reads; the marker is `JUSTIFIED
SUBSTITUTION`, which section 15b counts.

**Why a raw strip cannot be identical here the way it was in the sheets.** PR
#40 closed the same finding by keeping the line each deleted comment sat alone
on, because `stripCssComments` replaces a comment with NOTHING and an empty
line is then exactly what the old sheet stripped to. This tokenizer replaces a
comment with A SPACE, so an own-line `//` strips to its indent plus a space and
a `//` run that loses a line loses a whitespace-only line from the strip. No
blank line in the source can put that space back; only a bare `//` could, which
is filler. Measured before this comparison was settled: all ten files differ by
whitespace-only lines and by nothing else, every one of them on the before side,
and no line carrying code differs in any file.

| file | code only | control differs | citations | JSDoc heads | markers | bytes before | bytes after | comment before | comment after |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scripts/check-browser.mjs | identical | yes | 5 / 5 | 91 / 91 | 0 / 0 | 313993 | 174294 | 54.9% | 18.8% |
| scripts/check-invariants.mjs | identical | yes | 34 / 34 | 112 / 112 | 2 / 2 | 300391 | 171269 | 52.9% | 17.3% |
| scripts/check-admin-ui.mjs | identical | yes | 7 / 7 | 54 / 54 | 0 / 0 | 248027 | 145692 | 49.8% | 14.6% |
| scripts/check-features.mjs | identical | yes | 15 / 15 | 78 / 78 | 0 / 0 | 130130 | 81035 | 47.0% | 14.9% |
| scripts/verify-live.mjs | identical | yes | 3 / 3 | 43 / 43 | 0 / 0 | 103771 | 56168 | 54.5% | 16.0% |
| app/routes/admin.media._index.tsx | reordered | yes | 0 / 0 | 0 / 0 | 0 / 0 | 92824 | 48663 | 59.0% | 21.8% |
| app/db/index.ts | identical | yes | 5 / 5 | 3 / 3 | 0 / 0 | 87480 | 45281 | 61.6% | 25.9% |
| scripts/ship.mjs | identical | yes | 1 / 1 | 19 / 19 | 0 / 0 | 78340 | 39711 | 62.7% | 26.3% |
| scripts/check-contrast.mjs | identical | yes | 1 / 1 | 42 / 42 | 0 / 0 | 79258 | 42129 | 59.4% | 23.6% |
| scripts/check-all.mjs | identical | yes | 4 / 4 | 17 / 17 | 1 / 1 | 61946 | 26775 | 73.1% | 37.7% |
| **wave 1** | | | | | | 1496160 | 831017 | 55.0% | 19.0% |

Comment bytes 822,560 to 157,545. **The wave is under the 20% target.**
check-all.mjs stays at 37.7%: it is a tier map whose code is mostly short
keys, so even one line per gate is a large share.

**admin.media._index.tsx reads `reordered`** and it is the one file in the wave
whose code moved: its early return goes below the hooks, which is the repair for
section 4's seven errors, and it landed as its own commit so the diff can be
read on its own. `prove` names it in `REORDERED` and compares its code as a
multiset of lines rather than byte for byte, which is a deliberate weakening of
one row: the constant carries the reason, so adding a second name is a decision
somebody has to write down. `node scratchpad/hooks-diff.mjs` compares the
stripped code lines as a MULTISET: 1,064 lines before, 1,064 after, none added,
none removed, none edited, with a one-line control proving the comparison can
tell two things apart. That says the change is a reordering and nothing else.
It cannot say the new order is the right one, because a multiset is blind to
order by construction; the diff, the typecheck and seven rules-of-hooks errors
going to zero are that half.

## 2. Gates

Offline CI tier (`node scripts/check-all.mjs --ci`), same worktree:

- before the cut: 31 passed, 0 failed
- after the cut: 30 passed, 1 failed: **check:slop** (section 4)
- after the review pass, with section 4 repaired: **31 passed, 0 failed**
- lint: pass, and typecheck clean

Every gate in the wave, run alone, before and after:

| gate | before | after |
| --- | --- | --- |
| check:invariants | 518 checks, 0 failures | 518 checks, 0 failures |
| check:invariants --local | 518 checks, 0 failures | 518 checks, 0 failures |
| check:admin-ui | 710 checks, 0 failures | 710 checks, 0 failures |
| check:features | 938 checks, 0 failures | 938 checks, 0 failures |
| check:contrast | 916 checks, 0 failures | 916 checks, 0 failures |
| check:browser | 21 FAIL, 3 SKIP, timeout at the navigation case | identical lines, same timeout |
| check:all (as check:ci) | 31 passed | 31 passed, 0 failed (was 30 / 1 before section 4's repair) |

check:contrast and check:browser were run as a PAIR (the pristine file copied
beside the cut one and run back to back), because the first separate runs
differed for environmental reasons: check:contrast counts 712 with no client
build and 916 with one, and check:browser's navigation cases are flaky around
its timeout. On the same tree state both agree exactly.

check:browser is red on the unchanged tree: the theme-control cases, the
privacy-link order case and a navigation timeout, all of which predate this
job (job_3e8ed7ac95ef is queued for them).

Not run: `verify-live` (billed Ask probes, needs a deploy) and `ship.mjs`
(deploys). Both are covered only by section 1.

## 3. Plants, after the cut

All three applied together, proven on disk by grep before any run, then
reverted by targeted edit; the tree was clean afterwards and `prove` passed.

- check:invariants: `hard rule 99` added to a comment in check-all.mjs.
  Caught: `every cited hard-rule number is defined in CLAUDE.md`, 518 checks,
  1 failure.
- check:admin-ui: the media usage note says "quotes" instead of "cites".
  Caught: `the standing usage note names all three checks`, 1 of 710.
- check:browser: the header NavLink given `end={false}`, the defect its
  case 3 exists for. Caught: `Blog -> /blog carries aria-current on
  /blog/observable-plot-inside-a-worker`; 22 FAIL lines against 21.

## 4. check:slop was red, and the two halves were repaired differently

`aislop ci --changes --base origin/main` scores whole files that appear in the
diff. Its eight errors were all in code the cut did not change (section 1), and
each half got the repair its kind of finding deserves:

- seven `react-hooks/rules-of-hooks` in app/routes/admin.media._index.tsx: the
  component returned early for the picker and palette JSON branches before
  calling `useSearchParams`, `useNavigation`, `useLocation`, `useState` and
  `useRef`. **A real violation, so it was FIXED**: the hooks move above the
  early return, none of them reads loaderData, and the move is proven a pure
  reordering in section 1.
- one `ai-slop/swallowed-exception` in scripts/ship.mjs: the readiness poll
  logs a failed fetch and leaves `status` at 0, which resets the streak and
  makes the refusal below it fire. **A false positive, so it was CONFIGURED**:
  one line in `.aislop/config.yml` drops it to a warning, with the reason
  beside it, in the same shape as the four rules already there.

No ai-slop narrative or meta comment finding was raised on the new comment
lines, before the review pass or after it. **0 errors, 33 warnings, score 96
against a floor of 70.** Every earlier check:slop run passed because those diffs
touched only stylesheets and markdown; this is the first run over a code diff
here that is green on its merits.

## 5. Decisions the review should look at

Restored by the driver after the chunk agents reported:

- check-invariants token section: the "revisit gate 4 and 3d once the scales
  land" note, which ruling 88 says must not be lost.
- check-browser admin session: "there is no test-only auth bypass".
- admin.media harness seams: the ceiling of three (admin queue ruling 8).

Flagged by the agents and left as cut (verbatim in the history file):

- check-browser.mjs:2734 at cdb4300 (block #156) described a live desktop nav bug
  (`.site-header-nav` display none at every width). It is a finding, not
  history, and has no tracker.
- check-admin-ui.mjs floor log (#353) and check-contrast floor log (#130):
  the floors stay asserted in code, the re-measurement stories moved.
- check-features.mjs header (#0): the four anchor kinds are no longer listed
  one per line.

## 6. Grok's review: the nine losses, restored

Review at `scratchpad/grok-review-code-wave1.md` on `review/grok-code-wave1`
(a061759), against `origin/main` cdb4300. It named nine losses in seven
places. Each is back in plain words rather than verbatim, because the point was
the meaning, not the paragraph.

| # | where | what came back |
| --- | --- | --- |
| 1 | check-browser.mjs, header-nav viewport | re-measured, see below |
| 2 | check-browser.mjs, `maskTheme` | the set only ever SHRINKS: a wider mask hides a control that has started varying by theme and still passes |
| 3 | check-browser.mjs, hover before the click | the dwell is prerender-era and kept because a hovered click is the realistic gesture, not because it is load-bearing |
| 4 | app/db/index.ts, default media sort | NULL `uploaded_at` on static rows inverted the library; a CASE in the view, never a stored sort column; never a prefix on an explicit sort |
| 5 | app/db/index.ts, `mediaTwins` | no look-alike feature in front of a delete button; the hash is read off the key, never recomputed from R2; trash leaves both URLs serving |
| 6 | check-features.mjs, header | the next nested PUBLIC route fails here and it will read like rot in the anchors file; and the no-literals contract |
| 7 | check-features.mjs, WCAG | never restore the "WCAG 3" string ban: it made the next TRUE sentence fail the build |
| 8 | ship.mjs, step 1b | never put the empty PLACEHOLDERS loop back; the property lives in check:admin-ui |
| 9 | verify-live.mjs, Ask probe cap | the per-IP rate limit arm, so raising the probe count reads as a collision rather than better coverage |

### Finding 1 was re-measured and is no longer true

The old comment reported `.site-header-nav` computing `display: none` at every
width, measured 2026-09-14 on the deployed site. Hard rule 10 says a carried
claim is re-measured rather than copied, so it was, before anything was written
back. `node scratchpad/nav-1280.mjs` drives the deployed origin at 1280 in
light and writes one screenshot of `.site-header`.

MEASURED 2026-09-17: `display: flex`, `visibility: visible`, a 490.9 x 36 box,
and seven links each with a box. The screenshot shows all six destinations plus
the search and theme controls. The shot is gitignored, like the other shot
directories here; the script is not, so anyone can take it again.

**What happened between the two measurements is in the log.** Build 2's header
was reverted on 2026-09-14 by fb6a988, "Put the header back exactly as it was",
byte-identical to 94ded20 and verified by picture at five widths in both
themes. The nav is a wrapping row with no breakpoint of its own now, so writing
Grok's paragraph back would have planted a false claim in the source. What went
in instead is the durable half: why the case checks for a box before clicking,
plus the dated observation.

**One live finding fell out of the re-measurement, and it is reported rather
than absorbed.** check-browser.mjs still falls back to
`.site-shell-menu a[href="/blog"]` and `details.site-shell-overflow`, which are
build 2's markup: nothing in `app/` renders either selector today, and the probe
confirms neither is in the document. The fallback is dead code in a gate. It is
named in the comment and left standing, because this branch changes executable
code in one place only and that place is section 4's repair.

## 7. The raw strip, and what closed it

Grok's last section measured the strips as not byte-identical, all ten files
smaller on the draft side. Re-measured: the whole difference is whitespace-only
lines, every one of them on the before side, and no line carrying code differs
anywhere. Dropping those leftover blank lines makes all ten byte-identical, 10
of 10, and it is now the ONLY normalisation the proof runs: the trailing-blank
strip was measured redundant and deleted.

Why this could not be closed the way PR #40 closed it is in section 1. Short
version: the CSS regex replaces a comment with nothing, this tokenizer replaces
one with a space, and no blank line in the source can put a space back.
