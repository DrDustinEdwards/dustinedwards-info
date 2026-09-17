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
through `stripComments` (the gates' tokenizer), with whitespace-only lines and
trailing blanks dropped: a cut comment leaves no line behind, so blank lines
are the one normalisation. The control changes one code character in the
pristine file and must be detected, so the comparison can tell two things
apart (hard rule 12). Citations are `hard rule N` inside comments, the text
check:invariants section 15 counts; JSDoc heads are `@param {T} name` and the
like, which the scripts' typecheck reads; the marker is `JUSTIFIED
SUBSTITUTION`, which section 15b counts.

| file | code only | control differs | citations | JSDoc heads | markers | bytes before | bytes after | comment before | comment after |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| scripts/check-browser.mjs | identical | yes | 5 / 5 | 91 / 91 | 0 / 0 | 313993 | 173297 | 54.9% | 18.3% |
| scripts/check-invariants.mjs | identical | yes | 34 / 34 | 112 / 112 | 2 / 2 | 300391 | 171269 | 52.9% | 17.3% |
| scripts/check-admin-ui.mjs | identical | yes | 7 / 7 | 54 / 54 | 0 / 0 | 248027 | 145692 | 49.8% | 14.6% |
| scripts/check-features.mjs | identical | yes | 15 / 15 | 78 / 78 | 0 / 0 | 130130 | 80021 | 47.0% | 13.8% |
| scripts/verify-live.mjs | identical | yes | 3 / 3 | 43 / 43 | 0 / 0 | 103771 | 55983 | 54.5% | 15.7% |
| app/routes/admin.media._index.tsx | identical | yes | 0 / 0 | 0 / 0 | 0 / 0 | 92824 | 48290 | 59.0% | 21.2% |
| app/db/index.ts | identical | yes | 5 / 5 | 3 / 3 | 0 / 0 | 87480 | 43799 | 61.6% | 23.4% |
| scripts/ship.mjs | identical | yes | 1 / 1 | 19 / 19 | 0 / 0 | 78340 | 39234 | 62.7% | 25.4% |
| scripts/check-contrast.mjs | identical | yes | 1 / 1 | 42 / 42 | 0 / 0 | 79258 | 42129 | 59.4% | 23.6% |
| scripts/check-all.mjs | identical | yes | 4 / 4 | 17 / 17 | 1 / 1 | 61946 | 26775 | 73.1% | 37.7% |
| **wave 1** | | | | | | 1496160 | 826489 | 55.0% | 18.5% |

Comment bytes 822,560 to 153,037. **The wave is under the 20% target.**
check-all.mjs stays at 37.7%: it is a tier map whose code is mostly short
keys, so even one line per gate is a large share.

## 2. Gates

Offline CI tier (`node scripts/check-all.mjs --ci`), same worktree:

- before the cut: 31 passed, 0 failed
- after the cut: 30 passed, 1 failed: **check:slop** (section 4)
- lint: pass

Every gate in the wave, run alone, before and after:

| gate | before | after |
| --- | --- | --- |
| check:invariants | 518 checks, 0 failures | 518 checks, 0 failures |
| check:invariants --local | 518 checks, 0 failures | 518 checks, 0 failures |
| check:admin-ui | 710 checks, 0 failures | 710 checks, 0 failures |
| check:features | 938 checks, 0 failures | 938 checks, 0 failures |
| check:contrast | 916 checks, 0 failures | 916 checks, 0 failures |
| check:browser | 21 FAIL, 3 SKIP, timeout at the navigation case | identical lines, same timeout |
| check:all (as check:ci) | 31 passed | 30 passed, check:slop red |

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

## 4. check:slop is red, and not because of the new comments

`aislop ci --changes --base origin/main` scores whole files that appear in the
diff. Its eight errors are all in code this job did not change (section 1):

- seven `react-hooks/rules-of-hooks` in app/routes/admin.media._index.tsx:
  the component returns early for the picker and palette JSON branches before
  calling `useSearchParams`, `useNavigation`, `useLocation`, `useState` and
  `useRef`. That is a real rules-of-hooks violation in form.
- one `ai-slop/swallowed-exception` in scripts/ship.mjs (the readiness poll
  logs a failed fetch and lets the streak reset, which is deliberate).

No ai-slop narrative or meta comment finding was raised on the new comment
lines. Score 93 against a floor of 70. Every earlier check:slop run passed
because those diffs touched only stylesheets and markdown. Making it green
needs a code change or a config change, and this job allows neither.

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
