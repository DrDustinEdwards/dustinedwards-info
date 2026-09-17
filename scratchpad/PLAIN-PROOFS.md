# Plain comments: proofs (job_f5413b4165bc)

Base: origin/main 5b8007e. Pristine sheets live in `scratchpad/before/`
(gitignored, made by `node scratchpad/snapshot.mjs before`).

## Scope

233 KEEP blocks in today's sheets (238 in the merged TSV, minus the 5 that
PR #38 removed), located by `keep-inventory.mjs`, 0 unmatched.

- 140 rewritten (`plain-rewrites.mjs`, applied by `apply-plain.mjs`).
- 93 left as they are. Each is at most 360 bytes and already at most four
  lines: short labels, one-line inline notes, primitive maps. One of them,
  `app.css#45`, was also left because its prohibition is the bare sentence
  "Not 0:", which the subject-word check cannot pair with anything.

Reproduce: `node scratchpad/iterate.mjs` restores the pristine sheets,
applies the rewrites, regenerates the guidelines and runs the proofs.

## 1. Classification

The generator classifies 56 blocks before and after (lost 0, gained 0). Blocks
are matched by sheet and position within the sheet. The job text says 66; the
real baseline on 5b8007e is 56, because the audit cut the count to 63 and
PR #38 cut it to 56.

## 2. Numbers

Per-block sets of numeric tokens (units, ratios, hexes, dates, specificity
triples): 0 differences in 140 rewritten blocks. None removed deliberately.
Negative control: removing a unique `96px` from a rewrite is caught. The
comparison is by set, so a value that appears twice in a block is still
present after one copy goes.

## 3. Prohibitions

123 (block, modal) cases where the block contained never, do not, must or not.
All 123 still carry the same modal in a sentence that shares a subject word.
Negative control: removing a "must" is caught.

## 4. Gates and CSS

- `check:design-sheets`, `check:contrast` passed, standalone and in
  `check:ci`.
- `check:guidelines` passed (9 checks) after `build-capsid-guidelines.mjs`.
- `check:slop` passed (0 errors, 0 warnings, 440 files). Lint passed.
- `check:ci` result: 30 passed, 0 failed. `check:floors` errored inside that
  run with status 0xC0000142 (a process start failure under memory pressure).
  A standalone rerun after a build left one failure: `check:config`, which
  always fails in a fresh worktree because the bootstrapped example is the
  real config there. The other 41 floor checks passed.
- `check:page-payload` passed (145 checks).
- CSS outside comments: 22 of 22 sheets byte-identical under the same regex as
  `stripCssComments` in `.design-sync/build-inputs.mjs` (not exported), with
  no whitespace normalisation. A planted trailing space in reset.css is
  caught.
- Built CSS: both arms produce the same 14 asset names and byte sizes.
- Header shots (`header-shots.mjs`): 10 pairs (/, /blog, a post, /projects,
  /search; light and dark; 1280 wide) at 0.000%. Control (light home against
  dark home): 99.772% different.

## 5. Bytes

```
   app.css                      75395   60998   14397
   prose.css                    17121   12593    4528
   chrome-nav.css                7832    5138    2694
   public-chrome.css             5169    3214    1955
   shell.css                     5568    3714    1854
   reset.css                     7115    5383    1732
   publications.css              9616    7968    1648
   post-enhancements.css         7717    6399    1318
   motion-print.css              3969    2815    1154
   projects.css                  6489    5387    1102
   blog-index.css                4005    3052     953
   skip-link.css                 1718    1246     472
   playground.css                7334    6895     439
   search-trigger.css            1641    1237     404
   blog-search.css               1687    1293     394
   post-shell.css                3377    3125     252
   palette-dialog.css            4768    4544     224
   page-shell.css                1295    1139     156
   blog-index-extras.css          730     730       0
   search-page.css               2164    2164       0
   search-facets.css             1467    1467       0
   ask.css                       1654    1654       0
   TOTAL 177831 -> 142155, saved 35676 (20.1%)
```

Generated guidelines (gitignored): 60,389 bytes before, 45,707 after.
