# Ruling 115, commit 2: numbers and their gates

Every block tagged NUMBER in `history-tags.tsv`, and what happens to its value.
The job's allowed gates are check:contrast, check:design-sheets,
check:page-payload and check:floors. None of the four reads layout, font
metrics or timing, so **no gate assertion was added**. The reasons are below,
one row per block. Each moved value is kept verbatim in
`sheet-history-2026-09.md` (commit 3).

| sheet:line at 9b769c8 | value | verdict |
| --- | --- | --- |
| app.css:23 | CLS 0.0674 vs 0.0000 on /blog, weight spread 0.955 to 1.029 | Nobody needs it in the sheet: a dated lab measurement. Re-deriving it needs a throttled browser run, which no allowed gate does. Moves to Capsid. |
| app.css:67 | Inter/Arial advance-width table, CLS on three pages | The shipped `size-adjust` and overrides are the declarations below the comment, which own them. A gate asserting them would compare the file against itself (rule 10, fixture independence). The table is how they were derived; moves to Capsid. |
| app.css:126 | Source Serif 4/Georgia table, CLS arms, 85.27% trap value | Same as above. The Georgia-bold trap stays in the sheet as a why. |
| admin-media-later.css:639 | 28px gaps vs the mockup's 18 to 20 | Nobody needs it: a before/after measurement of a layout already fixed. |
| admin-media-later.css:697 | 896x161 at 56rem, 991x85 at 64rem | Nobody needs it. The prohibition (do not hide a control to stop the wrap) stays. |
| admin-media-later.css:807 | 56px vs 46px row, 19.5px vs 16.9px line height | Nobody needs it: the declarations own the fixed values. |
| admin-media.css:18 | columns per viewport table | Nobody can gate it here: check:admin-ui renders without a stylesheet, and none of the allowed gates lays out a page. The sheet now says to re-render before trusting a number. |
| admin-media.css:46 | 1629ms median data round trip | Nobody needs it: a dated timing; the behaviour it justified stays. |
| admin-media.css:1355 | 56px bar on a 102px tile, 37px after | Nobody needs it: the declaration owns the value. |
| admin-media.css:1627 | 19px box + 6px inset = 25px | The declaration owns the value. |
| admin-shell.css:36 | header 68.67px, mark at y=18 | Not asserted by any gate. It would need check:browser (outside the allowed list) to measure both planes. Reported rather than gated; the load-bearing note stays. |
| motion-print.css:90 | 12 to 14 frames, 214 to 259 ms | check:browser already asserts the property that matters: `pagereveal` fires with a null `viewTransition`. The frame counts move to Capsid; the reduced-motion arm stays in words. |
| playground.css:211 | 26px overflow at the 48rem measure | Nobody needs it: the declaration owns the fixed padding. |

## Contrast ratios removed from WHY blocks

32 WHY blocks lost one or more `N:1` ratios (measured by comparing each
block's ratio tokens before and after). They are two kinds:

- **Ratios of shipped token pairs** (10.4:1, 18.4:1, 2.66:1 and so on).
  check:contrast re-derives these from the token hexes on every run and
  asserts each pair against its floor, so rule 17 already names the gate as
  their owner; the prose copies were duplicates. The pairs check:contrast
  deliberately leaves unasserted (1.47:1, 2.46:1) are recorded in
  check-contrast.mjs's own comments, next to the refusal.
- **Ratios of mockup literals the site refuses to ship** (#e5ddce at 1.35:1,
  #a79c8a at 2.34:1 and so on). No gate measures them because nothing ships
  them, and none should: the sheet keeps the refusal, and the numbers move to
  Capsid.

## Values still stated in sheets

WCAG thresholds (24px, 44px, 3:1, 4.5:1) and axis ranges read from the font
files stay. They are specification values or file properties, not
measurements of this site, and check:fonts binds the axis declarations to the
files.
