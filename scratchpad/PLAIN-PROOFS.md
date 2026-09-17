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

## Review

Grok reviewed the draft (review/grok-comments-plain, 4f9b325) and named five
points it lost. All five are restored:

- app.css type levels: with only `font-weight` the browser interpolates the
  axis itself; both declarations carry the same number at every level;
  optical sizing is off so nothing interpolates on resize.
- app.css Inter fallback: prose computes `font-optical-sizing: auto`, so
  `opsz` moves with the font size, which is why the advance width varies.
- reset.css: the `@layer base` wrapper must stay gone, because with nothing
  else layered it would only change which rules win.
- motion-print.css: the reduced-motion arm, two frames after the click with
  no intermediate state.
- shell.css: do not restore the bar padding "just in case"; against a static
  header it is a blank band at the top of every page.

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
present after one copy goes. Grok's review found the one case this cannot
see: a count written as a word ("two frames"), now restored.

## 3. Prohibitions

123 (block, modal) cases where the block contained never, do not, must or not.
All 123 still carry the same modal in a sentence that shares a subject word.
Negative control: removing a "must" is caught.

## 4. Gates and CSS

After the review fixes:

- `check:design-sheets`, lint and `check:slop` passed.
- `check:contrast` passed (916 checks) after a rebuild.
- `check:page-payload` passed.
- `check:guidelines` passed (9 checks) after `build-capsid-guidelines.mjs`.
- CSS outside comments: 22 of 22 sheets byte-identical under the same regex as
  `stripCssComments` in `.design-sync/build-inputs.mjs` (not exported), with
  no whitespace normalisation. A planted trailing space in reset.css is
  caught. Grok's review repeated this over all 32 tracked sheets: 0
  mismatches.
- Built CSS: both arms produce the same 14 asset names and byte sizes.
- Header shots (`header-shots.mjs`): 10 pairs (/, /blog, a post, /projects,
  /search; light and dark; 1280 wide) at 0.000%. Control (light home against
  dark home): 99.772% different.

On the draft (0e30869), before the review fixes, which changed comment text
only:

- `check:ci`: 30 passed, 0 failed. `check:floors` errored inside that run
  with status 0xC0000142 (a process start failure under memory pressure). Run
  standalone after a build, it had one failure: `check:config`, which always
  fails in a fresh worktree because the bootstrapped example is the real
  config there. The other 41 floor checks passed.

## 5. Bytes

```
   app.css                      75395   61361   14034
   prose.css                    17121   12593    4528
   chrome-nav.css                7832    5138    2694
   public-chrome.css             5169    3214    1955
   shell.css                     5568    3833    1735
   publications.css              9616    7968    1648
   reset.css                     7115    5486    1629
   post-enhancements.css         7717    6399    1318
   projects.css                  6489    5387    1102
   motion-print.css              3969    2925    1044
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
   TOTAL 177831 -> 142850, saved 34981 (19.7%)
```

Generated guidelines (gitignored): 60,389 bytes before, 46,190 after. The
Capsid export beside them is 34,888 bytes.

README: the header (`readme-header.md`) is 9,787 chars, and this branch does
not change it. The generated body was 2,300 chars at the last sync, so the
assembled README is about 12,089 of the 32,000 chars the app inlines.
