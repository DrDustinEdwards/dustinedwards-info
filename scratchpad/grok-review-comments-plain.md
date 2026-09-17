# Comment rewrite review: `review/comments-plain-draft` vs `main`

Compared `origin/main` `5b8007e` to `origin/review/comments-plain-draft` `0e30869`. The branch rewrites 140 KEEP comments and leaves 165 others byte-for-byte; both sides have 305 comment blocks.

Digit tokens (hex, dates, specificity triples, ratios, px/rem/ms/%, bare numbers) match in every rewritten block: 0 removed, 0 added. Named citations (`rule N`, `hard rule N`, `binding rule N`, `ruling N`, `WCAG …`, `check:…`, `section N`, `amendment N`) match as strings too. What follows is meaning that those checks cannot see.

## Lost or changed meaning

### 1. `app/app.css` (type levels)

**Old:**

> The weight is declared twice, deliberately. `--t-*-weight` feeds `font-weight` and the `wght` inside `--t-*-vars` feeds the axis. They are not redundant: `font-weight` is what the font-matching algorithm selects a FACE with, and `wght` is what actually positions the variable axis once a face is chosen. A level that set only the axis would match the face at weight 400 and then be told to draw at 620, and a level that set only `font-weight` would leave the axis to the browser's own interpolation. Both are set, to the same number, at every level.
>
> `font-optical-sizing` is left OFF at every consumer, so nothing interpolates on resize; `opsz` moves at one breakpoint only, 48rem, and only for the two serif levels.

**New:**

> The weight is declared twice on purpose: `--t-*-weight` feeds `font-weight`, which selects the face, and the `wght` in `--t-*-vars` positions the axis. They are not redundant; with only the axis a level would match the 400 face and be told to draw at 620.
>
> The optical size is always explicit: `font-optical-sizing` is off at every consumer, and `opsz` moves at one breakpoint, 48rem, for the two serif levels only.

**Lost:**

- The second failure mode: setting only `font-weight` leaves the axis to the browser's interpolation. The new text keeps only the axis-only failure (400 face drawn at 620).
- The constraint that both declarations are the same number at every level.
- Why optical sizing is off: so nothing interpolates on resize.

### 2. `app/app.css` (Inter metric fallback)

**Old:**

> `font-optical-sizing` computes to `auto` on this site's prose, so Inter's `opsz` axis moves with the font size: the small-text variant is wider and more open, the display variant is narrower. Its advance width per em is therefore NOT a constant, which is the assumption every metric-override recipe makes. Arial has no such axis and measures the same at every size.

**New:**

> Inter has an optical size axis, so its advance width per em is not a constant; Arial's is.

**Lost:** The why is no longer that prose computes `font-optical-sizing: auto`, so `opsz` moves with size. "Has an axis" is not the same claim: an unused axis does not change advance width. The type-level comment still says optical sizing is off at those consumers, so a reader of this fallback note can now conclude the wrong thing about when Inter's width varies.

### 3. `app/styles/reset.css` (preflight header)

**Old:**

> 3. The `@layer base` wrapper is gone. There are no layers here now, and a layer with nothing to lose to would only change specificity.

**New:**

> (3) the `@layer base` wrapper is gone.

**Lost:** Why the wrapper must stay gone: re-adding `@layer base` with nothing else in a layer would change specificity, not leave the cascade as it is.

### 4. `app/styles/motion-print.css` (view transitions)

**Old:**

> as-is    12 to 14 intermediate frames matching NEITHER page, 214-220 ms
>          dark and 245-259 ms light, 33 to 66 times the noise floor
> reduce   two frames after the click, no intermediate state
> none     one frame after the click, no intermediate state

**New:**

> with the transition on, 12 to 14 intermediate frames matched neither page, lasting 214-220 ms dark and 245-259 ms light, 33 to 66 times the noise floor; with it off, one frame after the click.

**Lost:** The reduced-motion arm, including the number two frames. The old measurement was three cells (as-is / reduce / none). The new one is on versus off. Digit-token comparison cannot see "two", and the rewrite still says the old reduced-motion block skipped the fade while leaving the transition on, so the prohibition survived; the measured third arm did not.

### 5. `app/styles/shell.css` (sheet header)

**Old:**

> THE BAR IS NOT FIXED ANY MORE, which is why section 4 went with it. It paid for `position: fixed` by adding a bar's height of padding to every main element and offsetting every anchor by the same amount. Against a static header that padding is a blank band at the top of every page, so it could not be kept "just in case" the way a colour could.

**New:**

> The bar is not fixed, so section 4's padding and anchor offsets went too, and `--bar-h` was deleted on 2026-09-14.

**Lost:** Why the padding must not be restored while the header is static: it is a blank band at the top of every page, and unlike a colour it cannot be kept just in case.

## Comment-stripped CSS

Stripping comments from both sides leaves every stylesheet byte-identical.

The stripper is the same regex as `stripCssComments` in `.design-sync/build-inputs.mjs` (`/\/\*[\s\S]*?\*\//g`), with the match replaced by the empty string and no whitespace normalisation. All 32 tracked `.css` files were compared, not only the 22 design sheets: 18 public sheets whose comments changed, 4 public sheets this branch did not touch (`ask.css`, `blog-index-extras.css`, `search-page.css`, `search-facets.css`), and the 10 admin sheets, which are raw-identical. Mismatch count: 0.
