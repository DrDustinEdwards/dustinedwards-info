# History-out review: `review/history-out-draft` vs `main`

Compared `origin/main` `9b769c8` to `origin/review/history-out-draft` `a24cc79`. The branch deletes four HISTORY comment blocks and rewrites the rest to a short why; CSS rules are unchanged.

Dated measurements that still have their why beside the rule (CLS tables, column counts, 1629ms, caption bar heights, and the rest of the 13 NUMBER tags) are not listed. Those numbers moved on purpose under ruling 115 and hard rule 17. What follows is meaning a reader of the new comment no longer has.

The three restorations from the comments-plain review that this branch kept: `@layer base` must stay gone because nothing else is layered; do not restore bar padding against a static header (it is a blank band); Inter's fallback still says prose computes `font-optical-sizing: auto`.

## Lost or changed meaning

### 1. `app/app.css` (Inter header)

**Old:**

> `unicode-range` is kept, so the italic downloads only when italic latin text renders. `font-display: swap` matches the old Google URL.

**New:**

> unicode-range keeps the italic to pages with italic latin text. font-display: swap.

**Lost:** "Matches the old Google URL" was a historical note. The shortened line reads as the current Inter rule. The next comment still says the normal face is `optional`, and the `@font-face` agrees, but the header now states swap over both faces.

### 2. `app/app.css` (type levels)

**Old:**

> The weight is declared twice on purpose: `--t-*-weight` feeds `font-weight`, which selects the face, and the `wght` in `--t-*-vars` positions the axis. They are not redundant: with only the axis a level would match the 400 face and be told to draw at 620, and with only `font-weight` the browser would interpolate the axis itself. Both are set, to the same number, at every level.

**New:**

> Weight is set twice to one number: font-weight selects the face, wght positions the axis; with only font-weight the browser interpolates the axis.

**Lost:** The axis-only failure mode: matching the 400 face and drawing at 620. The comments-plain pass restored both arms; this cut keeps only the font-weight-only arm. "To one number" still says they match.

### 3. `app/app.css` (Inter metric fallback)

**Old:**

> Tuned to 17px, the prose size; other sizes are a compromise because one face carries one set of overrides. A ratio taken at 1000px (96.29%) moves body text the wrong way: 9.2% narrow against Inter, where plain Arial was 5.7% off.

**New:**

> Arial sized to Inter, tuned at 17px, the prose size. Prose computes font-optical-sizing: auto, so opsz moves with the font size and Inter's advance width varies (ascent and descent do not).

**Lost:** Why 17px rather than the 1000px recipe: that ratio is 96.29% and moves body text the wrong way (9.2% narrow vs 5.7% for unadjusted Arial). A retune that follows the usual override sample would undo the 17px choice. The table itself is a dated measurement and is not the loss.

### 4. `app/styles/admin-shell.css` (account fold)

**Old:**

> 640px is the nearest breakpoint this repository already uses that sits ABOVE the measured floor (the others are 800 and 576, and 576 is BELOW 582, which is exactly why the earlier narrowing could not have closed this). Folding at the floor itself would put the layout's correctness on the exact pixel a measurement landed on, and that measurement is a function of a string: the floor is what it is because the operator's address is one unbreakable token. A longer address moves it. 58px of headroom is the margin that survives that, and the widths the browser gate asserts (553, 480, 400, 320) are all comfortably inside the folded branch.

**New:**

> The breakpoint sits above the measured floor with headroom, because a longer address moves that floor.

**Lost:** 576 is an existing repo breakpoint and it is below the 582px floor, so it cannot be the fold. 640 is the nearest existing breakpoint above that floor. The new text keeps "headroom" and the address-string why, and not the 576 trap.

### 5. `app/styles/public-chrome.css` (wordmark hover)

**Old:**

> Hover steps down to --on-chrome-muted because rest is already the lightest measured value here.

**New:**

> It takes --on-chrome; hover steps to --on-chrome-muted.

**Lost:** Why muted, not a lighter hover: rest is already the lightest measured value on chrome. The identity exemption, the (0,1,0) vs (0,1,1) trap, and "Do not simplify them away" are still there.

### 6. `app/styles/motion-print.css` (view transitions)

**Old:**

> There is no reduced-motion block: with the transition off for everyone it has nothing to do. The old one skipped the fade but left the transition on, so readers with reduced motion were the only ones not seeing the blink.

**New:**

> The reduced-motion arm was two frames after the click with no intermediate state, so none is needed.

**Lost:** The prohibition on the shape of a future reduced-motion block: skip-the-fade while leaving the transition on inverts the protection (reduced-motion readers become the only ones who do not see the blink). The two-frame measurement is kept; the 12-to-14-frame as-is arm is a dated measurement and is not the loss.

## Comment-stripped CSS

The stripper is the same regex as `stripCssComments` in `.design-sync/build-inputs.mjs` (`/\/\*[\s\S]*?\*\//g`), with the match replaced by the empty string and no whitespace normalisation. All 32 tracked `.css` files were compared.

Raw strip is not byte-identical: three sheets differ only by leftover empty lines where a deleted HISTORY block sat alone (`app/app.css` one line, `app/styles/admin-media-later.css` two, `app/styles/admin-media.css` one). No rule, selector, or declaration differs.

Dropping whitespace-only lines, all 32 sheets are byte-identical. Mismatch count on that comparison: 0.
