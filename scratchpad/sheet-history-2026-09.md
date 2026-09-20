# Sheet history, 2026-09

Extracted from the stylesheets by job_327e4af58a67 under ruling 115, from
9b769c8. Every block the job deleted or shortened is here VERBATIM, with the
sheet and line it had at 9b769c8, its tag, and why it moved. The sheets keep
only the short why; this is where the measurements and the story went.

## app/admin.css

### app/admin.css:1 (WHY, shortened)

admin bundle and cascade whys kept; split date and bundle sizes are history.

```css
/*
 * THE ADMIN PLANE'S STYLESHEETS, split out of `app/app.css` on 2026-08-23.
 *
 * Imported by `routes/admin.tsx`, which is the layout route every `/admin/*`
 * child nests under, and by `routes/login.tsx`. Vite emits it as its own CSS
 * chunk and React Router links it only on the routes that import it, so a
 * reader of the public plane never requests these bytes.
 *
 * ## WHY IT EXISTS
 *
 * `app.css` imported all sixteen stylesheets, so the single built bundle was
 * 109,318 bytes and every visitor to the home page downloaded the media
 * library, the post editor and the revision drawer. `admin-media.css` alone is
 * 72KB of source. Nothing was wrong with the CSS; it was in the wrong bundle.
 *
 * ## THE ORDER IS THE CASCADE, AND IT IS THE SAME ORDER
 *
 * These seven are listed in the relative order they held inside `app.css`, and
 * that is not cosmetic. `app/styles/admin-media-later.css` exists ONLY because
 * `admin-media.css` and it were separated by the whole of `playground.css` in
 * the original file; its own header says merging them would reorder them.
 *
 * What DOES change is that on an admin page these seven now arrive after all
 * nine public sheets rather than interleaved with them. Proven harmless by
 * cascading all sixteen both ways with postcss and comparing the winner of
 * every (selector-context, property) key: 3,657 declarations, ZERO winner
 * differences on an admin page and ZERO on a public page, with a control
 * showing the comparison discriminates. The one real conflict that measurement
 * found was repaired first; see `admin-media-later.css`.
 *
 * ## NO RESET HERE, DELIBERATELY
 *
 * `app.css` imports `styles/reset.css` and is loaded on every route including
 * these, so the reset and the font tokens are already present. A second import
 * would emit a second copy of the reset into this chunk.
 *
 * This paragraph said `@import "tailwindcss"` until 2026-08-27, when Tailwind
 * left the build. The reason it gave was the right one and it outlived the
 * thing it was about, which is why it is reworded rather than deleted.
 */
```

## app/app.css

### app/app.css:3 (WHY, shortened)

CSP and cache whys kept; self-hosting history and weight census moved; restored after Grok review 89352d6.

```css
/* Inter, self-hosted since 2026-08-21: two files from this origin instead of
   three requests to two Google origins. That removes a serialised two-hop
   dependency, Google's view of every visitor, and third-party origins from
   the enforced CSP (`style-src` and `font-src` are now `'self'`).
   These are the variable latin subsets, weight axis 100 to 900, so one file
   covers every weight and 650 interpolates. They are byte-identical to what
   fonts.gstatic.com served, so who serves them changed and not what is
   served. Inter is SIL OFL 1.1 (public/fonts/OFL.txt).
   The static 400 and 700 files in `assets/fonts/` are not unused
   (build-og.mjs and check-logo.mjs need TTF for Satori) and are the wrong
   faces: the stylesheet asks for 400, 500, 600, 650 and 700 plus an italic,
   and 51 of 63 weight declarations are 500 or 600.
   They go through the build, not public/, for caching: Vite hashes them into
   `/assets/`, which `public/_headers` serves `max-age=31536000, immutable`.
   Served from public/fonts/ first, a stable path got `max-age=0,
   must-revalidate`, measured as a 304 round trip per navigation. A `/fonts/*`
   immutable rule would be wrong: stable filenames would leave a year of
   browsers on an old font. `_headers` is unchanged.
   `unicode-range` is kept, so the italic downloads only when italic latin
   text renders. `font-display: swap` matches the old Google URL. */
```

### app/app.css:23 (NUMBER, shortened)

CLS figures are a dated measurement with no gate; the why stays.

```css
/* font-display: optional on the normal face since 2026-08-28, to fix a
   measured layout shift. On /blog at 390x844, Slow 4G, cold cache: CLS 0.0674
   from the tag-chip row re-wrapping; with the woff2 requests blocked, CLS
   0.0000, so swap is the cause.
   The size-adjusted fallback below makes the swap's reflow small but not
   zero: across weights 400 to 700 Inter is 0.955 to 1.029 of the adjusted
   fallback, so one size-adjust cannot match every weight.
   optional blocks briefly and then commits to one face for the page load,
   with no later swap. The cost: a slow connection reads one page load in
   Arial at Inter's metrics; the font is cached after, and the preload in
   root.tsx aims to win the race.
   The italic keeps swap and is not preloaded: it is 79,716 bytes needed only
   on pages with italic latin text, and optional on a late face would mean it
   is essentially never used. Italic is a small part of any page, so its swap
   cannot re-wrap a row. */
```

### app/app.css:49 (HISTORY, deleted)

ruling date and the declined subsetting; its why is carried by the two blocks above.

```css
/* The italic is kept as it is, at 79,716 bytes (ruled 2026-08-26), larger
   than the normal face. `unicode-range` means only pages with italic latin
   text fetch it, so a page with no emphasis never pays a byte, and it is not
   preloaded because preloading would download it on every route.
   Subsetting was refused on effort, not principle: it needs a font pipeline,
   a dependency and a gate. If the corpus comes to lean on italics, the trade
   changes. */
```

### app/app.css:67 (NUMBER, shortened)

metric table is a dated measurement; the declarations own the shipped values; restored after Grok review 89352d6.

```css
/* The metric-adjusted fallback, so the swap does not move the page. Measured
   cold on the audit profile: CLS 0.0065 on home, 0.0128 on a post, 0.0737 on
   /blog.
   Prose computes `font-optical-sizing: auto`, so Inter's `opsz` axis moves
   with the font size (wider and more open when small, narrower when large)
   and its advance width per em is not a constant, which every metric-override
   recipe assumes it is. Arial has no such axis. Measured 2026-08-26 in a real
   browser against the deployed font, body-text sample:
     size    Inter/em   Arial/em   size-adjust
       16     82.3313    78.8799     104.38%
       17     81.9303    78.8799     103.87%
       20     80.7406    78.8799     102.36%
       32     75.9556    78.8799      96.29%
   Tuned to 17px, the prose size; other sizes are a compromise because one
   face carries one set of overrides. A ratio taken at 1000px (96.29%) moves
   body text the wrong way: 9.2% narrow against Inter, where plain Arial was
   5.7% off.
   Ascent and descent do not move with `opsz` and are taken at 1000px, where
   `fontBoundingBox` is not quantised as it is at 16px: Inter is 0.969 and
   0.241 of the em, each divided by the size-adjust.
   Only Arial: Helvetica and generic `sans-serif` resolve to Arial on the
   measuring machine, and naming several `local()` sources would apply Arial's
   numbers to Helvetica Neue on macOS, 8.5% away. Without Arial the stack
   falls through as before. */
```

### app/app.css:102 (WHY, shortened)

serif scope, namespacing and swap whys kept.

```css
/* The serif sets public headings at 32px and up and nothing else. One
   variable roman WOFF2, latin subset, byte-identical to fonts.gstatic.com's
   Source Serif 4 v14; axes read from the binary: `wght` 200 to 900, `opsz` 8
   to 60. The levels name `opsz` 32 and 48, and check:fonts binds the
   declaration to the file.
   The family is namespaced "Source Serif 4 Web" because the installed retail
   "Source Serif 4" is not the same file and would set headings at unmeasured
   metrics. check:fonts maps it explicitly, so the name is not a licence to
   swap the file.
   swap, not optional, the opposite of Inter: this is the late face, not
   preloaded, setting a few heading lines, and optional on a late face means
   it is essentially never used. swap is safe only because the fallback below
   makes it move nothing, as measured. */
```

### app/app.css:126 (NUMBER, shortened)

metric table and CLS arms are a dated measurement; the Georgia-bold trap stays.

```css
/* The serif's metric-adjusted fallback. Measured 2026-09-13 in headless
   Chrome against the binary above, as advance width per em of a `white-space:
   nowrap` span at the shipped settings:
     case                          SS4/em   fallback/em   size-adjust
     h2      32px wght 600 opsz 32  38.8379    39.0430        99.47%
     h1      32px wght 680 opsz 32  39.3838    39.0430       100.87%
     h1      40px wght 680 opsz 48  37.9875    39.0430        97.30%
     serif   48px wght 600 opsz 48  37.4238    39.0430        95.85%
     serif   48px wght 700 opsz 48  38.1396    39.0430        97.69%
     serif   32px wght 700 opsz 32  39.5107    39.0430       101.20%
     display 52px wght 700 opsz 48  38.1394    39.0430        97.69%
   Tuned to the h2 row, 99.47%, as Inter is tuned to 17px: the 2rem heading
   repeats down an archive. The spread is 95.85% to 101.20%, at worst about
   3.6% out, against Inter's 96.29% to 104.38%.
   The trap: `font-weight: 200 900` makes the browser use Georgia regular at
   600 and 700 and never synthesise bold, so a ratio measured against the
   Georgia family is against a bold that will never render. That gave 85.27%
   and a measured CLS 0.0603, a heading going from four lines to six.
   Measured at 390x844, dSF 3, Slow 4G, CPU 4x, cold, font held back 2500ms, a
   six-second settle, headings at 32px and 48px, weights 600 and 700:
     with this block        CLS 0.0000, every heading holds its size across the swap
     without it (Georgia)   CLS 0.0016, the 48px/600 heading 276px -> 221px
   The control arm is what gives the zero meaning.
   Only Georgia: one face carries one set of overrides, and Times New Roman
   did not resolve on the measuring machine, so no second face is guessed.
   Times and generic `serif` stay in the stack without an adjustment. */
```

### app/app.css:163 (WHY, shortened)

the at-rule trap kept; Tailwind history moved.

```css
/* The font stacks, a plain `:root` block since 2026-08-27, three since the
   serif landed on 2026-09-13.
   This was `@theme`, Tailwind v4 syntax for its utility generation, which
   nothing here needs: the stacks are read with `var()` and check:contrast
   parses the declarations directly.
   An unknown at-rule is dropped whole, so removing Tailwind without this made
   every element compute `font-family: "Times New Roman"`. */
```

### app/app.css:170 (WHY, shortened)

one-owner and order whys kept; the old-to-new remap table is history.

```css
/* The stacking scale: one owner per layer, and the layers are named. Measured
   2026-08-28: 24 `z-index` declarations across eight sheets with 14 distinct
   values, including 44, 45 and 46. Values one apart are not a scale.
   The remap moved nothing: `z-index` compares by order within a stacking
   context, never by difference, and the mapping is strictly increasing with
   every old value positive. The gaps leave room for a new layer anywhere.
     old  token              new
       1  --z-tile-raise      10   lifted inside a card, above its own siblings
       2  --z-tile-body       20   the card's body, above those
       3  --z-tile-action     30   an action that must clear the body
      15  --z-sticky         100   sticky inside a scrolling pane
      20  --z-dropdown       200   a menu or panel anchored to a control
      30  --z-popover        300   an editor popover, over the dropdown layer
      35  --z-drawer-scrim   400   the dim behind the mobile admin drawer
      40  --z-drawer         500   the drawer itself
      44  --z-pinned-bar     600   a pinned bulk-action bar
      45  --z-overlay-scrim  700   the dim behind a detail overlay
      46  --z-overlay        800   the overlay itself
      50  --z-progress       900   the reading progress bar
      60  --z-transient     1000   a toast, a modal layer, a footnote preview
     100  --z-skip-link     2000   always last, and it must beat everything
   Not in the colour blocks: check:contrast requires every token there to be a
   hex in a measured pair, and a stacking level is not. */
```

### app/app.css:210 (WHY, shortened)

ruling 96 z-index trap kept; the handoff's rejected numbering is history.

```css
/* The public header's three layers, decided 2026-09-13 (build 2):
     the fixed bar      --z-pinned-bar   600
     the overlay menu   --z-overlay      800
     the skip link      --z-skip-link   2000
   Not --z-dropdown: at 200 it sits below the bar, and the overlay menu hangs
   past the bar and must clear it. The name reads right and is the trap.
   Part A step 6b asked for these as 10 / 20 / 30 under --z-pinned-bar,
   --z-dropdown and --z-overlay-scrim, but those names already exist here at
   600 / 200 / 700 with consumers, so the repo wins and nothing is renumbered.
   The order it wanted holds: skip link above an open menu, menu above the
   bar. */
```

### app/app.css:232 (WHY, shortened)

trimmed to three lines.

```css
/* The serif sets public headings at 32px and up and nothing else: never a
     control, a chip, the logo, the header or an admin screen. "Source Serif 4
     Web Fallback" sits between it and Georgia, as "Inter Fallback" does, so
     `font-display: swap` on this face moves no line. */
```

### app/app.css:239 (WHY, shortened)

one owner and gate reason kept; 'agreed by chance' is history.

```css
/* The elevation shadow, one owner; the pinned bulk bar and the footnote
     preview each wrote it and agreed by chance. Not in the colour blocks,
     because check:contrast requires a hex in a measured pair and a box shadow
     is not one. */
```

### app/app.css:246 (WHY, shortened)

the shorthand ban and the weight and optical-size whys kept (Grok's restored points); restored after Grok review 89352d6.

```css
/* The Paper, Glass, Light type levels ----------------------------------------
   Ruling 65, Part A step 2: eight levels, each five properties rather than
   one composite value.
   No `font` shorthand: `font-variation-settings` cannot ride in it, so `font:
   var(--t-h1)` would silently lose the optical size and variable weight and
   still render. There is no composite `--t-h1`, deprecated or otherwise; a
   consumer sets all five or it is not using the level. The repo has never
   carried a `--t-*` token of either shape.
   The weight is declared twice on purpose: `--t-*-weight` feeds
   `font-weight`, which selects the face, and the `wght` in `--t-*-vars`
   positions the axis. They are not redundant: with only the axis a level
   would match the 400 face and be told to draw at 620, and with only
   `font-weight` the browser would interpolate the axis itself. Both are set,
   to the same number, at every level.
   The optical size is always explicit: `font-optical-sizing` is off at every
   consumer of a level, so nothing interpolates on resize, and `opsz` moves at
   one breakpoint, 48rem, for the two serif levels only. Inter carries `opsz`
   14 to 32 and every Inter level sits inside it, the lowest at 14; Source
   Serif 4 carries 8 to 60 and its levels name 32 and 48. check:fonts ties
   each level's request to its own `--t-*-family`, so an Inter level asking
   for 48 fails by name. */
```

### app/app.css:331 (WHY, shortened)

trimmed to three lines.

```css
/* Tracking is not one of the five and is declared apart so it is not
     mistaken for part of a level. Only three levels carry any; a level with
     none has no token, because a `0` every consumer must remember to apply is
     worse than nothing. */
```

### app/app.css:339 (WHY, shortened)

reader list and no-reader refusal kept; step 2 and step 6b history moved.

```css
/* The strong nav weight, a number for `font-weight`, added in step 6b (step
     2 had none). The active bar destination, the current filter chip and a
     figure caption's lead-in read it.
     Its companion `font-variation-settings` string, `opsz` 15 against
     `--t-nav`'s 16, had no reader and is deleted rather than carried.
     Step 2's "selected chip 640" has no token: step 6b draws the selected
     filter with this weight, so a 640 level would have no reader, which
     section 31 refuses. */
```

### app/app.css:359 (WHY, shortened)

one-breakpoint rule kept.

```css
/* The second optical size step, and the only breakpoint in the type scale. At
   48rem the two serif levels reach the sizes the 48 cut is for. It is one
   declaration per level, so the size, leading and weight above keep one
   owner. Inter levels do not appear here: Inter's axis stops at 32 and no
   level asks for more. */
```

### app/app.css:371 (WHY, shortened)

gate reason kept; handoff history moved.

```css
/* The Paper, Glass, Light space and dimension scales --------------------------
   Part A step 3, plus the four dimension tokens step 6a added.
   Not in the colour blocks, like the stacking scale and the font stacks:
   `check:contrast` requires every token there to be a literal hex in a
   measured pair, and a length is neither.
   The handoff asked for the dimension tokens in both theme blocks with
   identical values, so a future theme could not inherit a dimension it never
   declared. The gate would reject them there, so they are declared once, in a
   bare `:root` that no theme overrides. */
```

### app/app.css:397 (WHY, shortened)

hit target and AA floor distinction kept.

```css
/* Control dimensions are not spacing and do not sit on the scale above.
     44px is the header hit target: the enhanced target size, WCAG 2.2 2.5.5,
     which is AAA. It is not the AA floor and must not be read as one: 2.5.8
     asks for 24px, which is --control-min-dense. The extra size is
     deliberate, because this site is read on phones in one hand. */
```

### app/app.css:426 (WHY, shortened)

naming and easing rules kept.

```css
/* The Paper, Glass, Light motion scale ---------------------------------------
   Part A step 5. Four durations named by job, with no --motion-fast or
   --motion-200: a number name invites reuse by resemblance, and a job name
   asks what the motion is for. A new case that fits none of the four usually
   should not be animated.
   All three easings end flat: no overshoot, bounce or spring. */
```

### app/app.css:433 (WHY, shortened)

trimmed to three lines.

```css
/* The answer to a pointer. Below about 100ms a change is perceived as
     simultaneous with the input, which is what a hover tint should be. Not 0:
     a 90ms ramp hides the one-frame repaint stutter on a slow device that an
     instant swap shows. */
```

### app/app.css:441 (WHY, shortened)

fade window and the not-the-reveal rule kept.

```css
/* The overlay menu fade, the only panel in the foundation. Under about 220ms
     a fade reads as a flicker; over about 300ms the reader is waiting.

     It is NOT the scroll reveal. A `view()` timeline ignores animation-duration
     entirely, so the reveal has no duration to name, which is why this token is
     --motion-panel and not --motion-reveal. */
```

### app/app.css:457 (WHY, shortened)

copy-not-derive, role naming, resolution order and parity kept; ratification date moved.

```css
/* The Hill Country token system ---------------------------------------------
   Ratified 2026-07-28. The specification is dustinedwards/design-tokens.md,
   and every hex below is copied from it, never derived here. `npm run
   check:contrast` reads these declarations back and recomputes the whole
   matrix, so a hand-tuned hex fails the gate.
   Tokens are named for the role a component asks for, never for the hue: a
   destructive button asks for --fill-danger, not crimson. That is how a theme
   flip changes every hue and no component.
   Theme resolution, in source order:
     :root, [data-theme="light"]   light values
     :root:not([data-theme])       dark values, under a dark OS preference
     [data-theme="dark"]           dark values, explicitly chosen
   "System" is the absence of the attribute, not a third value, and that is
   the anti-flash mechanism: with no attribute the OS preference decides in
   pure CSS, and with one the server already wrote the right value from the
   cookie. Nothing is corrected after paint, so no blocking script is needed.
   Both blocks land on `html`, so they do not cascade into each other: a token
   declared in light and missing in dark keeps its light value under a dark
   theme. The two blocks must declare the same names, and check:contrast
   asserts that parity. */
```

### app/app.css:491 (WHY, shortened)

exemption and cue rules kept; ratios are check:contrast's; the deleted token is history.

```css
/* Deliberately below the floor. WCAG 1.4.3 and 1.4.11 both exempt an
     inactive component, and a disabled control at 4.5:1 would read as
     available. Measured on limestone: --text-disabled 2.46:1. It is
     identified by the disabled attribute, the recess to --paper, and visible
     text beside the control saying why; check:contrast carries a named
     exemption. cursor:not-allowed is not a cue: it is pointer-only and
     arrives after the reader has tried.
     --line-disabled (1.64:1 on limestone, with its own 1.4.11 exemption) was
     deleted 2026-09-14 because no rule drew that edge: measuring a thing is
     not building it. */
```

### app/app.css:517 (WHY, shortened)

chrome measuring rule and logo binding kept; ratios are check:contrast's; provisional review history moved.

```css
/* v4 chrome, provisional pending Dustin's visual review
     (chrome-purple-v4.md, ratified 2026-08-11). The public header and footer
     are a brand surface, so everything on them is measured against the
     chrome, not the page canvas. Five role tokens instead of a hex per rule,
     so a rejected review reverts one token block, not a dozen scattered
     literals.
     Light pairs on #4f2d7f, from the ruling: --on-chrome 10.4 (the existing
     white-on-brand pair), --on-chrome-muted 8.7 (tint-brand inverted),
     --focus-ring-on-chrome 8.2 (the on-brand-fill token).
     --mark-on-chrome is the dark-mode brand hex in both themes, by ruling: on
     purple chrome the light logo variant is the legible one. check:logo's
     bindings move with it at commit time, never silently. */
```

### app/app.css:535 (WHY, shortened)

opaque-scrim reason kept; glass floor figures moved.

```css
/* The tile caption scrim is opaque on purpose.
     A gradient fading to transparent makes the caption's real backdrop the
     picture, so a pale and a dark photograph give two different contrast
     ratios and only one was ever measured. design-tokens.md sets a hard floor
     for glass, computed the same way: alpha 0.60 over a white backdrop lands
     at 4.70:1 and 0.50 at 3.42:1, so a fade through that range crosses the
     floor at a point nobody can name.
     So the band under the text is solid and its ratio is constant. The fade
     above it is decoration over a region with no text. Same value in both
     themes: a scrim is a hole in the page, not a surface the page tints.
     #1a1614 is the dark canvas hex, reused rather than invented; white on it
     is 18.4:1, and check:contrast carries the pair. */
```

### app/app.css:572 (WHY, shortened)

decorative-only rule kept; deleted variants are history.

```css
/* Accent: terracotta. Decorative only; it never signals a state. One token:
     a lifted variant and a tint, with contrast pairs of their own, were never
     painted and were deleted 2026-09-14. */
```

### app/app.css:577 (WHY, shortened)

reversible-versus-irreversible distinction kept; mockup ratios are check:contrast's.

```css
/* Destructive: a reversible removal. Not the danger family; the media
     library really makes this distinction.
     `--*-danger` marks the irreversible act (Delete post, Delete
     permanently). It is the loudest thing in the palette and should stay
     rare.
     This marks the reversible act: Trash, Empty trash, "keep this and trash
     the other one". The asset is still served, the row is still there, and
     Restore puts it back. Danger red here would teach an author that trash is
     as final as delete, the misreading ruling 3 of the v6 arc prevents.
     From the v6 mockup, where every pair it forms clears its floor: 7.62 on
     --bg, 6.87 on --surface, 6.34 on --surface-popover. A peer of
     --text-danger (7.46 on --bg), not a weaker sibling. */
```

### app/app.css:595 (WHY, shortened)

trimmed to three lines.

```css
/* Charts, keyed by hue, not by ladder position: the doc lists the two
     ladders in different orders, so a series indexed by position would change
     hue on a theme flip. Core-5 is the unlabeled-safe set; rust is extended
     and requires a direct label. */
```

### app/app.css:606 (WHY, shortened)

role-name reason kept; the build-number state claim removed.

```css
/* PAPER, GLASS, LIGHT. Ruling 65, Part A. The Hill Country roles above
     stay until builds 2 to 4 migrate their consumers; these are the
     names the redesign uses and nothing reads them yet. */
```

### app/app.css:670 (WHY, shortened)

trimmed to three lines.

```css
/* The series slots are the interface; the ramps above are primitives. A
     chart reads --fig-s1 to --fig-s5, never a hue name or a tint index, so
     one piece of markup is correct in both themes: the slot names are stable
     and the ramp behind them inverts. */
```

### app/app.css:685 (WHY, shortened)

one-token reason kept; bar removal and ruling 6 history moved.

```css
/* The lamp's catch hue depends on the backdrop, not the theme. There were
     two tokens because brand purple at 14% over a brand-purple bar is a
     zero-delta composite, so the bar needed its own hue. The bar left
     shell.css on 2026-09-14 and --lamp-chroma-on-bar went with it; ruling 6
     deleted the other four bar tokens that day and missed this one, because a
     mention in check-contrast.mjs still counted as a read. One backdrop, one
     token. */
```

### app/app.css:727 (WHY, shortened)

no-new-surface and ring rule kept; ratios are check:contrast's.

```css
/* v4 chrome, provisional. Dark chrome is the already-ratified hero
       surface #3d2a5c, so no new surface enters the palette. Pairs on it:
       --on-chrome 10.1, --on-chrome-muted 6.9 (brand-hover),
       --focus-ring-on-chrome ~10. The focus ring is the light token here, not
       --focus-ring-on-brand: #4a3d1e was measured against a solid brand fill
       and is invisible on the deep-purple chrome. */
```

### app/app.css:767 (WHY, shortened)

mirror reason kept; ratio figures are check:contrast's.

```css
/* The rust, lifted for dark to mirror the light ratios rather than to
       look similar: 7.59 / 6.80 / 5.94 against 7.62 / 6.87 / 6.34, so the
       control reads with the same weight in both modes. */
```

### app/app.css:860 (WHY, shortened)

trimmed to three lines.

```css
/* Dark, chosen explicitly, with the same values as the block above. Written
   twice rather than shared through a third custom property, because
   check:contrast would then read a name instead of a hex, and the gate has to
   see the hex that ships. */
```

### app/app.css:1018 (WHY, shortened)

placement, gate-order and @property whys kept.

```css
/* The lamp's geometry and strength -------------------------------------------
   Part A step 4. The catch hue is two colour tokens in the palette blocks
   above. These three are a position and two numbers, so they live here:
   `check:contrast` requires every palette token to be a literal hex in a
   measured pair, and a percent is neither.
   They still vary by theme, so this is a second pair of theme blocks, not a
   bare `:root`. It must sit after the palette blocks: the gate finds a
   palette block by the literal text of its selector and takes the first
   match, so a theme block above the palette would be parsed as the palette.
   That is not left to ordering alone: `check:contrast` asserts each block it
   parsed carries `--paper`, so a moved block fails loudly instead of
   measuring the wrong twelve tokens.
   `--surface-catch` is registered with `@property`, and that is load-bearing:
   an unregistered custom property cannot interpolate, so it would jump at the
   halfway point and the lamp coming up under focus would flicker instead of
   fade. It is a bare number, not a percentage, because a number interpolates
   and `calc(var(--surface-catch) * 100%)` does the rest at the use site. */
```

### app/app.css:1053 (WHY, shortened)

trimmed.

```css
/* Dark sits further in: the bar is already light, so a catch at the very
       edge is lost to the bar's own value and reads as a lighter rim rather
       than a lamp. It is also stronger, because the dark composites sit on a
       steeper part of the transfer curve, where 0.14 is under two sRGB steps. */
```

### app/app.css:1069 (WHY, shortened)

trimmed to three lines.

```css
/* At zero the gradient still renders, as a mix of 0%, which is the backdrop.
   There is no second code path or separate rule for the reduced case, and the
   glass fill is untouched: a reduced-transparency reader loses the lamp and
   keeps the surface. */
```

### app/app.css:1081 (WHY, shortened)

narrow-tier and literal-hex rules kept.

```css
/* v3 amendment 3: prefers-contrast: more ---------------------------------
   A deliberately narrow tier: only the two tokens lowest in the matrix move,
   plus the default border promoting to its strong twin. The doc says "no
   other values change under the query", so nothing else does; a tier that
   rewrote the palette would be a second palette to keep in step.
   Literal hexes rather than var(--border-strong), because check:contrast
   reads these blocks back and asserts every token is a hex; an indirection
   would give the gate a name where it needs a value. */
```

### app/app.css:1109 (WHY, shortened)

trimmed.

```css
/* v3 amendment 4: forced-colors: active -----------------------------------
   The palette yields entirely to system colours here. Nothing below
   re-asserts a brand colour; every rule keeps a control's shape once the user
   agent has replaced its background, because in this mode a fill is not a
   fill any more.
   The technique is a transparent outline: forced-colors resolves it to a
   system colour, so a control distinguished only by its background keeps a
   visible edge. Focus is already an outline everywhere (amendment 4 again),
   so it survives untouched. */
```

### app/app.css:1119 (WHY, shortened)

trimmed.

```css
/* The two shadow hairlines, restored as real borders.
     The admin topbar and sidebar draw their edges with `box-shadow` rather
     than a border, because a border-box border is subtracted from a declared
     height or width, and both lengths are alignments (the mark's y and the
     rail's icon column). Amendment 4 says forced-colors strips shadows, so in
     this mode both edges would vanish and the shell would blend into the
     content it frames.
     Restoring the border costs those alignments a sub-pixel, and that is the
     right trade: visible structure beats an exact y on a surface the user can
     no longer see. */
```

### app/app.css:1147 (WHY, shortened)

promotion date moved.

```css
/* The admin plane's chip, promoted out of .mention-chip on 2026-09-06 and
     worn by the mentions filters and the media lenses. Its active state is a
     brand fill, which this mode removes, so it needs the same forced outline
     as the search chip. */
```

### app/app.css:1169 (WHY, shortened)

trimmed to three lines.

```css
/* The cockpit's surface ladder is all background, so here sidebar, canvas,
     card and hovered row all resolve to the one system Canvas. The card keeps
     its border, so the index stays framed, and the hovered row is restated as
     an edge because its tint is gone. */
```

### app/app.css:1178 (WHY, shortened)

trimmed.

```css
/* The published pill lost its fill and the scheduled pill its tint, so all
     three would be the same outline around a different word. The word is the
     first channel; border-style is the second and survives this mode, which
     is why the pills differ by stroke and not only by hue. It is restated on
     the outline too, because the border is what the forced palette most
     likely flattens. */
```

### app/app.css:1220 (WHY, shortened)

placement whys kept; amendment date and old value moved.

```css
/* The shared inset, declared once for the whole site.
     The x where the site's identity mark sits, on the public plane and in the
     admin, in both sidebar states. Amended from 2rem to 1.5rem on 2026-08-01
     so the collapsed admin rail could hold the same icon column the expanded
     one indents to without becoming a 90px slab.
     It is on `body` and not in the token block because check:contrast parses
     every custom property there as a colour and would throw on a length; the
     admin's other lengths are scoped to `.admin` for the same reason. It is
     on `body` and not `.admin` because the public header and footer read it
     too, and two declarations of one alignment let the two planes drift
     apart. */
```

### app/app.css:1242 (WHY, shortened)

CVD grounds, exemption and specificity kept; decision date moved.

```css
/* Rule 2: a link is underlined.
   The grounds are CVD, not taste: brand purple against body text, and visited
   claret against brand purple, both fail Vienot simulation on hue alone, so
   the underline says "link" and the colour only reinforces it.
   The one exemption is stated here: an element that already carries a
   non-colour affordance, a border or a fill, is not leaning on hue and does
   not need a second cue. Those are the chips and buttons, and each opts out
   at its own rule. Everything else underlines, including every nav link.
   Decided with Dustin 2026-07-28.
   These are element-level selectors on purpose: any component rule that sets
   its own colour outranks them, so this changes defaults and overrides
   nothing deliberate. */
```

### app/app.css:1254 (WHY, shortened)

trimmed to three lines.

```css
/* v3 amendment 2. An element-level rule, so a component that sets its own
   heading colour (the brand-purple page and post titles) still outranks it.
   In light mode it resolves to the body text value, so it changes nothing
   there and is not a second colour to keep in step. */
```

### app/app.css:1320 (WHY, shortened)

placement trade and one-card-owner kept; byte sizes moved.

```css
/* ------------------------------------------------------------- The front door

   In app.css and not a route-split sheet, on purpose, and the trade is the
   opposite of the admin one. `admin.css` is split because every home page
   reader was downloading its 60-odd KB to style a plane they cannot reach.
   This is under 2KB and styles the page every reader lands on first;
   splitting it would add a second stylesheet request, a round trip before
   first paint, on the one page where that costs most. Rule 4 is about what
   the reader downloads to see a page, and this arrangement makes that
   smallest where it matters.
   The post cards reuse `.post-list` and `.post-card-*` from blog-index.css,
   which app.css already imports; a second card style would be two owners of
   one appearance. */
```

### app/app.css:1362 (WHY, shortened)

trimmed to three lines.

```css
/* `auto-fit` with a floor: three tiles share a row where there is room and
     stack where there is not, with no breakpoint to keep in step with the
     rest of the site. The floor stops a tile shrinking until its number
     wraps. */
```

### app/app.css:1379 (WHY, shortened)

a count in an example is a number that rots; trimmed.

```css
/* The whole tile is the link target except its detail line, which is prose
   about the number and not part of the control. The link carries both value
   and label, so its accessible name is "25 automated checks" rather than a
   bare digit. */
```

### app/app.css:1478 (WHY, shortened)

outline rule, inset ring and danger exclusion kept; ring ratios are measurements.

```css
/* v3 amendment 4: the focus indicator is an outline, never a box-shadow.
   forced-colors strips shadows, so a shadow ring is absent in Windows High
   Contrast, the mode where it matters most.
   A brand ring is measured against the page background. On a filled control
   it would land on the fill, so filled controls draw their outline inside, in
   the one colour the doc measured against a brand fill. A negative
   outline-offset does that and stays an outline, so it survives forced-colors
   and cannot be clipped by a scroll container.
   The danger fill is deliberately not in this list: --focus-ring-on-brand was
   measured against brand purple and on dark crimson is 1.47:1, a ring you
   cannot see. The doc specifies no ring for a danger fill, so the delete
   button keeps only the outer brand ring, on the page background where it
   measures 8.1:1. */
```

### app/app.css:1501 (WHY, shortened)

trimmed.

```css
/* The site mark. The five purple paths carry this class; the three warm ones
   keep the literal fills from the ratified SVGs, which are identical in the
   light and dark variants.
   This declaration is the dark-mode variant: --brand is #4f2d7f light and
   #b7a5e0 dark, resolved by the same three selectors as every other token, so
   a chosen theme, the light default and system mode all get the right mark
   with no media query of its own. Nothing is hidden, so nothing shifts; the
   token resolves in the first paint, so nothing flashes. Shared by the header
   and the login card. */
```

### app/app.css:1514 (WHY, shortened)

cascade and token-path whys kept; split history moved.

```css
/* The split, 2026-08-21. Everything above is the token system and the two
   accessibility amendments; everything below moved into app/styles/ and is
   imported here.
   The import order is the cascade. The files were cut from one 9,269-line
   stylesheet at existing section boundaries, in order, with nothing reordered
   or rewritten. Reordering an import can change which rule wins.
   The tokens stay here because scripts/lib/tokens.mjs parses this path for
   the palette and check:contrast builds its two-source argument on it; moving
   them would be a gate change disguised as a refactor. */
```

### app/app.css:1523 (WHY, shortened)

import mechanism why kept; split measurements and postcss proof moved.

```css
/* Public stylesheets only, since 2026-08-23. The seven admin sheets moved to
   `app/admin.css`, which `routes/admin.tsx` imports.
   Measured before: this file was the whole site's CSS, one `root-*.css`
   bundle of 109,318 built bytes downloaded by every public reader, and 62% of
   it was the admin plane. `admin-media.css` alone is 72KB of source, more
   than every public sheet together.

   ## The order is still the cascade, and the split proved it

   These files are imported in the order they were cut from the 9,269-line
   app.css, so a rule that won by source position still wins. Removing seven
   imports changes every remaining rule's neighbours, and on an admin page the
   seven now arrive after all nine of these instead of interleaved.
   Proven, not assumed, by cascading all sixteen sheets both ways with postcss
   and comparing the winning declaration for every (selector-context,
   property) key: 3,657 declarations, 3,613 keys, zero winner differences on
   an admin page and zero on a public page. 2,347 keys stop resolving in the
   public bundle: the admin CSS public readers no longer download. Dropping
   one admin sheet from the probe produced 364 differences, so the comparison
   discriminates.
   It found one real conflict, repaired first: the tail of `playground.css`
   was 42 admin-only classes, and seven of their declarations overrode
   `admin-media.css`. They moved into `admin-media-later.css`, where they
   already sat in the cascade; see that file's header.
   `/login` imports `app/admin.css` too: it is a public route that uses
   `.field-alarm` from `admin-editor.css`, and it is the admin plane's door.

   ## Where the imports went, 2026-08-27, and why

   They were nine `@import` statements at the bottom of this file and worked
   only because Tailwind was here. CSS drops an `@import` that follows any
   other rule, and Tailwind's processor hoisted them anyway, so removing
   `@import "tailwindcss"` silently took all nine sheets off the site:
   measured on the first build without it, root CSS fell from 45,778 bytes to
   9,229 and had no `.site-header` rule.
   Hoisting them to the top of this file would fix the build but move the
   cascade, since they would arrive before the rules below instead of after.
   They are JavaScript imports in `app/root.tsx`, in the same order, which
   keeps them after this file's own rules. */
```

## app/styles/admin-editor-feedback.css

### app/styles/admin-editor-feedback.css:1 (WHY, shortened)

cascade rule kept; split history moved.

```css
/*
 * The editor's feedback slot and upload row.
 *
 * Split out of app.css on 2026-08-21. It was 9,269 lines and every layout
 * defect this month lived in it. THE ORDER OF THESE FILES IS THE CASCADE:
 * app.css imports them in the order they were cut, which is the order they
 * sat in the original file, so a rule that won by source position still wins.
 * Moving an import, or moving a rule between files, can change what renders.
 */
```

### app/styles/admin-editor-feedback.css:11 (WHY, shortened)

trimmed.

```css
/* The editor's feedback slot ------------------------------------------------
 *
 * One slot, four states, and the tint changes family with the state rather than
 * the state changing only its words. Rule 4 holds because exactly one of these
 * is ever rendered: the slot is a single node, so there is no arrangement in
 * which two semantic tints appear together. Everything else in the editor that
 * could have carried a tint (the missing-token notice) was moved off one for
 * the same reason.
 *
 * The slot element itself is always present and unstyled when empty, because it
 * is the live region: a container that appears at the same moment as its text
 * announces nothing.
 */
```

### app/styles/admin-editor-feedback.css:82 (WHY, shortened)

trimmed to three lines.

```css
/* First publication. The one act the system reserves to the human, so it is the
   one message that does not look like every other save. The weight is carried
   by size and a heavier edge, never by a colour the other success state does
   not also have: a reader who cannot separate the two hues still sees a
   different shape. */
```

### app/styles/admin-editor-feedback.css:105 (WHY, shortened)

trimmed.

```css
/* THE LEAVE GUARD. A navigation the router stopped because the post is dirty.

   The warning family, the same one the drift alert spends, because this is a
   degradation and not a failure: nothing has been lost and the crash net still
   holds the text. It is the only tint this component adds and it is a tint the
   editor already uses, so no new pair enters the palette and check:contrast has
   nothing new to measure.

   It sits above the form rather than over it: the author's navigation is
   already held by the router, so there is no need to trap them behind a modal
   to ask, and a modal would take focus away from the writing they can go back
   to. */
```

## app/styles/admin-editor.css

### app/styles/admin-editor.css:1 (WHY, shortened)

cascade rule kept; split history moved.

```css
/*
 * The three-region post editor: bar, panes, CodeMirror, settings drawer.
 *
 * Split out of app.css on 2026-08-21. It was 9,269 lines and every layout
 * defect this month lived in it. THE ORDER OF THESE FILES IS THE CASCADE:
 * app.css imports them in the order they were cut, which is the order they
 * sat in the original file, so a rule that won by source position still wins.
 * Moving an import, or moving a rule between files, can change what renders.
 */
```

### app/styles/admin-editor.css:11 (WHY, shortened)

trimmed.

```css
/* The three-region editor -------------------------------------------------
 *
 * Region 1 is a command bar that does not move. Region 2 is the writing canvas
 * and it is the ONLY thing on the page that scrolls. Region 3 is a drawer that
 * is not laid out at all until it is opened.
 *
 * One scroll context is a requirement rather than a preference: a sticky bar
 * over a document that also scrolls gives two scrollbars, and the inner one is
 * the one nobody finds. .admin-content hands its height down for this. */
```

### app/styles/admin-editor.css:38 (WHY, shortened)

trimmed; the 1280px wrap is history.

```css
/* The command bar is a THREE COLUMN GRID, not a flex row with space-between.
   The centre group has to sit at the bar's centre regardless of how wide the
   two side groups are, and space-between centres the middle item only when the
   sides happen to match. `1fr auto 1fr` pins it.

   Fixed height, declared once as --admin-cmdbar-h, because the canvas subtracts
   it. It used to wrap to three rows at 1280px, which is what a wrapping bar of
   unconstrained controls does. Nothing in it may wrap now. */
```

### app/styles/admin-editor.css:54 (WHY, shortened)

scrollport rule kept; the dated elementFromPoint finding moved.

```css
/* Sticky offsets are measured from the SCROLLPORT, not from the viewport, and
     .admin-content is the scrollport here. It already begins below the topbar,
     so asking for --admin-topbar-h again applied the offset twice: the bar was
     pushed 52px down, overlapped the top of the canvas, and covered the title
     input so a click on it landed on a command-bar button instead. Measured by
     elementFromPoint on the live deploy 2026-08-01.

     Zero is correct wherever .admin-content is the scrollport. The narrow
     breakpoint, where the shell releases its height and the DOCUMENT scrolls
     instead, is the one case that needs the real offset, and it sets it. */
```

### app/styles/admin-editor.css:86 (WHY, shortened)

trimmed.

```css
/* ONE control height across the whole bar. Every control in it opts in here
   rather than declaring its own, so the row cannot drift back into the ragged
   set of 28px, 32px and 36px boxes the comp was drawn to replace. 2rem is 32px
   at the root size, comfortably past the 24px WCAG 2.2 target minimum. */
```

### app/styles/admin-editor.css:190 (WHY, shortened)

trimmed.

```css
/* Ruling 3's buffer age, beside the dirty indicator and deliberately QUIETER
   than it. --text-muted rather than the warning colour its neighbour takes when
   dirty: the warning is the state, this only qualifies it with when the crash
   net last caught the draft, and two warning-coloured items would read as two
   problems. No new contrast pair, this is the same muted-on-surface pair the
   bar already carries at rest and check:contrast already measures. */
```

### app/styles/admin-editor.css:209 (WHY, shortened)

declared-height reason kept; uploader anecdote moved.

```css
/* Region 2, and the only scroll context on the page.

   The height is DECLARED rather than left to flex, so the contract is legible:
   the viewport, less the two bars above it. Flex would arrive at the same
   number today and would quietly stop doing so the moment anything else joined
   the column, which is exactly how the image uploader came to be eating 126px
   of it. Nothing may render below this element. */
```

### app/styles/admin-editor.css:250 (WHY, shortened)

trimmed.

```css
/* The title belongs to the thing being edited, so it tracks the EDITOR pane
   rather than the page. In split view it spanned both columns while the editor
   was half of one, which read as a page heading floating above two unrelated
   boxes. The width is derived from the same gap the grid uses, so the two
   cannot drift apart. Preview view needs no rule: there is one column and the
   title spans it. */
```

### app/styles/admin-editor.css:267 (WHY, shortened)

trimmed.

```css
/* The counter sits with the title, not on the page rail.
 *
 * `field-sizing: content` makes the input as wide as what is typed, so the
 * counter lands immediately after the words it counts. Where that is not
 * supported the input keeps `flex: 1` and the counter falls back to the right
 * edge of the title row, which the rules above have already narrowed to the
 * editor pane's measure. Both readings are acceptable; the enhanced one is what
 * was asked for and the fallback is where it used to be minus the full-width
 * rail that made it look unrelated. */
```

### app/styles/admin-editor.css:395 (WHY, shortened)

trimmed to two lines.

```css
/* Write, split and preview ------------------------------------------------
 *
 * The panes are the canvas's content, so they inherit its single scroll
 * context: each pane scrolls its own overflow and the page still does not. */
```

### app/styles/admin-editor.css:449 (WHY, shortened)

prohibition kept; the 20rem history moved.

```css
/* No min-height. It was 20rem, which at a shorter viewport made the pane taller
   than the canvas, so the canvas grew a scrollbar of its own and the preview
   showed TWO stacked on its right edge: the iframe document's and the canvas's.
   The pane is a flex child that fills what it is given; anything it cannot show
   is the iframe's to scroll, and that is the one scroll context it should have. */
```

### app/styles/admin-editor.css:597 (WHY, shortened)

trimmed to three lines.

```css
/* Word count and reading time. Pushed to the far end, away from the drop hint,
   and TABULAR so the strip does not twitch sideways as the count climbs through
   a digit. Muted: it is reference, and the command bar upstream owns anything
   in this view that is actually urgent. */
```

### app/styles/admin-editor.css:793 (WHY, shortened)

trimmed to three lines.

```css
/* The body fills what is left of the canvas rather than carrying a fixed
   height with the page scrolling past it. `resize: none` because a manual
   resize handle inside a flex column fights the layout, and there is nothing
   to resize toward: it is already as tall as the room allows. */
```

### app/styles/admin-editor.css:812 (WHY, shortened)

trimmed to three lines.

```css
/* Once CodeMirror has mounted, the textarea is still the submitted field but
   is no longer the control. It is removed from view and from the accessibility
   tree rather than left as a second, stale copy of the body for a screen
   reader to find. */
```

### app/styles/admin-editor.css:829 (WHY, shortened)

dialog and border rules kept; session history moved.

```css
/* Region 3: the settings drawer -------------------------------------------
 *
 * A real <dialog> opened with showModal(), the same choice the command palette
 * made: the focus trap, Escape, and focus return are the platform's rather than
 * a keydown handler that is subtly wrong in a way nobody notices.
 *
 * It sits on the POPOVER elevation step, so every border inside it is
 * --border-strong. That is the Session 1 finding, and it is not a style
 * preference: --border clears the 3:1 UI floor on --surface by 0.04 in dark
 * mode and drops to 2.66:1 on the popover step. */
```

### app/styles/admin-editor.css:924 (WHY, shortened)

trimmed.

```css
/* The frontmatter controls ------------------------------------------------
   A <details> in the editing form rather than a drawer section, because the
   drawer needs script to open and these have to work without it. Rule 5 sends
   the disclosure's own edge to --border-strong: it is a pinned, elevated
   surface in the sense that rule means, sitting above the canvas.
   ---------------------------------------------------------------------- */
```

## app/styles/admin-history.css

### app/styles/admin-history.css:1 (WHY, shortened)

cascade rule kept; split history moved.

```css
/*
 * Admin version history.
 *
 * Split out of app.css on 2026-08-21. It was 9,269 lines and every layout
 * defect this month lived in it. THE ORDER OF THESE FILES IS THE CASCADE:
 * app.css imports them in the order they were cut, which is the order they
 * sat in the original file, so a rule that won by source position still wins.
 * Moving an import, or moving a rule between files, can change what renders.
 */
```

### app/styles/admin-history.css:69 (WHY, shortened)

trimmed.

```css
/* The documented exception to rule 4 (one semantic tint per view). A diff is a
   data surface whose whole job is to distinguish two states side by side, so
   both tints are load-bearing rather than decorative. Rule 1 still holds: each
   line keeps its literal "+" or "-" prefix in the text, which is the second
   channel, and the tints are the ratified hexes rather than a mix. */
```

## app/styles/admin-media-later.css

### app/styles/admin-media-later.css:1 (WHY, shortened)

reorder reason kept; split history moved.

```css
/*
 * MORE MEDIA LIBRARY, and the name is deliberate. These rules are separated from admin-media.css by the whole of /playground in the source, so merging the two would REORDER them. Order is what this split refuses to change, so they stay two files and this comment is the reason.
 *
 * Split out of app.css on 2026-08-21. It was 9,269 lines and every layout
 * defect this month lived in it. THE ORDER OF THESE FILES IS THE CASCADE:
 * app.css imports them in the order they were cut, which is the order they
 * sat in the original file, so a rule that won by source position still wins.
 * Moving an import, or moving a rule between files, can change what renders.
 */
```

### app/styles/admin-media-later.css:11 (WHY, shortened)

placement why kept; the move and its winner measurement moved.

```css
/* ---- MOVED HERE FROM playground.css, 2026-08-23 -------------------------
 *
 * Everything from `MEDIA v6 session 5` to the end of this file was the TAIL of
 * playground.css. It is 42 admin-only classes and one `.admin-chip.is-active
 * .media-lens-dot` rule, all of them referenced by `admin.media._index.tsx`
 * and by nothing else. They were cut into playground.css on 2026-08-21 because
 * that is where they sat in the 9,269-line app.css, not because they have
 * anything to do with /playground.
 *
 * THE MOVE PRESERVES THE CASCADE EXACTLY, which is the property this file's
 * header refuses to change: playground.css was imported IMMEDIATELY before
 * this file, so its tail sat immediately before `.panel-actions` below, and it
 * still does. Nothing public was imported between them then and nothing is now.
 *
 * WHY IT HAD TO MOVE: splitting the admin stylesheets out of the public bundle
 * would otherwise have left these rules in the PUBLIC one, where they would
 * have stopped overriding `admin-media.css`. Measured before the split, by
 * parsing all sixteen sheets and comparing winners per (context, property):
 * SEVEN declarations changed winner on an admin page, all of them here, all
 * `.media-col-usage` and `.media-usage-dot`. `.media-usage-dot` was a verbatim
 * DUPLICATE of admin-media.css's, so it changed nothing; `.media-col-usage` is
 * the correction whose own comment below says the cell rendered
 * "in template no a..." clipped before it, and reverting that is what the move
 * prevents. Re-measured after: zero winner changes on either plane.
 * ---------------------------------------------------------------------- */
```

### app/styles/admin-media-later.css:37 (WHY, shortened)

token mapping and rule 1 kept; mockup literals moved.

```css
/* MEDIA v6 session 5: the three-state usage model and the surfaces it feeds.
 *
 * THE MOCKUP'S USAGE COLOURS DO NOT SHIP AS DRAWN. Its dots are #6E8F62 (sage),
 * #4F2D7F (brand) and #CE7F44 (rust) as literals, and its muted usage label is
 * #A79C8A at 2.34:1. Two of the three hues map onto tokens this palette already
 * ratifies and the third does not need inventing:
 *
 *   used         --fill-success   the state that needs no action
 *   in template  --brand          the site places it. Brand is not signalling a
 *                                 SEMANTIC state here, it is signalling "this
 *                                 belongs to the site itself", which is what
 *                                 brand means. Rule 6 forbids purple carrying
 *                                 danger, success or warning; this is none of
 *                                 those.
 *   unattached   --text-accent    rust, decorative by rule 6, and paired with
 *                                 the WORD "unattached" in every place it
 *                                 appears, so the colour carries nothing alone.
 *
 * Every dot is aria-hidden with its sentence beside it in text, which is rule 1:
 * colour is never the only channel. */
```

### app/styles/admin-media-later.css:86 (WHY, shortened)

trimmed.

```css
/* THE USAGE CELL IS A COLUMN, and this is a correction.
   `.media-col-usage` is `display: flex` for the dot, so a second child became a
   second item on the SAME ROW: the cell rendered "in template no a..." with both
   the state and its flags clipped. The dot's row is its own element now, and the
   cell stacks. */
```

### app/styles/admin-media-later.css:98 (WHY, shortened)

trimmed.

```css
/* THE PER-ROW FLAGS, under the usage word in the list.
 *
 * --text-accent rather than the mockup's #CE7F44 literal, which is the same
 * rust through the token. Quiet by SIZE, because a flag is a note and not an
 * alarm: three of them on one row should read as a list, not a siren. */
```

### app/styles/admin-media-later.css:116 (WHY, shortened)

trimmed.

```css
/* GRID ONLY. In the list the frame is a 44px thumbnail and an absolutely
   positioned dot lands ON the picture, which is what it did: every row carried a
   coloured spot over its thumbnail. The row already prints the same information
   as words in the Usage cell, so the list needs no dot at all. */
```

### app/styles/admin-media-later.css:167 (WHY, shortened)

undeclared-token trap kept.

```css
/* THE LENS NOTE, which is what stops a narrowed view reading as an accusation.
 *
 * A warm left rule, which is the mockup's device. It takes --border-warning:
 * there is no --border-accent in this palette, and reaching for one was the
 * --surface-2 mistake repeated, an undeclared token that resolves to nothing
 * and that check:contrast structurally cannot see, because the participation
 * assertion walks DECLARED tokens and a token nobody declares is in no block to
 * walk. Caught here by grepping the declarations before shipping rather than by
 * any gate. The surface is --surface rather than the mockup's white-on-cream,
 * because separation here is fill and not a 1.35:1 hairline. */
```

### app/styles/admin-media-later.css:204 (WHY, shortened)

trimmed.

```css
/* THE EMPTY STATES. Three of them, because they mean three different things.
 *
 * The library-empty case is the only one that gets a heading, a paragraph and a
 * button: it is the only state where the reader has nothing to undo and needs
 * to be told what the thing is for. The other two are a sentence and a way
 * back, because the reader already has a view and wants a different one. */
```

### app/styles/admin-media-later.css:254 (WHY, shortened)

trimmed.

```css
/* THE ALT SUGGESTION AND THE TAG CHIPS.
 *
 * A DASHED OUTLINE MEANS "OFFERED", a solid one means "applied". That is the
 * mockup's distinction and it is doing real work: the suggestion and the tag
 * chip are the same size and sit on the same row, so shape is what separates
 * them for a reader who cannot separate the colours. */
```

### app/styles/admin-media-later.css:344 (WHY, shortened)

trimmed; mockup literals moved.

```css
/* MEDIA v6 session 5, part two: the command palette, the shortcuts panel, the
 * toast, and the marks the keyboard navigator leaves.
 *
 * Every one of these needs script and every one degrades to nothing. The
 * mockup's colours are again resolved to tokens: its dropdown border is #4F2D7F
 * (brand, which does ship), its hint row is #8B8274 at 3.27:1 and its toast is
 * #2A2622 with #F3EEE3 text, which are the text and mark colours respectively
 * and are reached here through --scrim and --on-scrim, already ratified for the
 * caption bar and already carried by check:contrast. */
```

### app/styles/admin-media-later.css:371 (WHY, shortened)

trimmed to two lines.

```css
/* THE PALETTE, hung under the bar it belongs to.
 *
 * --surface-popover with --border-strong, per hard rule 5: this is popover
 * elevation and the elevated step never takes --border. */
```

### app/styles/admin-media-later.css:550 (WHY, shortened)

pointer-events and token whys kept; mockup literals and ratio moved.

```css
/* THE TOAST. Bottom centre, over everything, and it never takes pointer events:
 * a message that can be clicked is a message that can swallow a click meant for
 * the grid underneath it.
 *
 * --scrim and --on-scrim, the pair minted for the caption bar and already a
 * matrix row at 18:1. The mockup's #2A2622 on #F3EEE3 is the same idea reached
 * through two literals. */
```

### app/styles/admin-media-later.css:612 (WHY, shortened)

refusal kept; session label moved.

```css
/* MEDIA v6 session 6: the page head, the floating selection bar, and the type
 * treatments the mockup carries.
 *
 * THE FIVE FAILING COLOURS ARE STILL REFUSED. Nothing below reintroduces
 * #F3EEE3, #E5DDCE, #C9BFA9, #A79C8A or #8B8274; separation is still fill and
 * quietness is still size, weight and tracking. */
```

### app/styles/admin-media-later.css:619 (HISTORY, deleted)

y positions and removed rows: a dated measurement of a fixed layout.

```css
/* ---- THE PAGE HEAD ------------------------------------------------------
 *
 * The grid started at y 625 with seven rows above it, where the mockup starts
 * at 345 with four. Three of those rows were structural rather than useful: an
 * upload row of its own, a select-all row of its own, and the gap each one
 * carried. Both controls moved into rows that already existed. */
```

### app/styles/admin-media-later.css:639 (NUMBER, shortened)

gap measurements vs mockup; no gate; the scoping why stays.

```css
/* THE ROWS ABOVE THE GRID CLOSE UP.
 *
 * Measured after the two rows were removed: 28px of gap between every pair,
 * from `.panel`'s own 16px row gap plus each row's own margins stacking on top
 * of it. The mockup runs 18 to 20 between the same rows and 39 between the lens
 * row and the controls. Four consecutive 28px gaps is 40px of slack that the
 * grid pays for.
 *
 * Scoped to the media panel so no other admin section moves. */
```

### app/styles/admin-media-later.css:677 (WHY, shortened)

selection-is-a-mode why kept; old position and ratio moved.

```css
/* ---- THE FLOATING SELECTION BAR ----------------------------------------
 *
 * It was a static block in the content flow at y 564, which put it under the
 * fold on a short viewport at exactly the moment the reader had just selected
 * something and wanted to act on it. The mockup floats it, and the reason is
 * that a selection is a MODE: it persists while you scroll, so its controls
 * have to persist too.
 *
 * `--scrim` and `--on-scrim`, the opaque pair already minted for the caption
 * bar and already priced in the matrix at 18:1, which is what the mockup gets
 * with #2A2622 on #F3EEE3 through two literals. */
```

### app/styles/admin-media-later.css:697 (NUMBER, shortened)

measured box sizes at 56 and 64rem; no gate; the prohibition stays.

```css
/* 64rem, not 56. The mockup's bar carries four controls; this one also
     carries the ruled bulk TAGGING controls, which the mockup has no equivalent
     for. At 56rem the extra width tipped it into wrapping: measured 896x161, a
     four-row block floating over the grid. At 64rem the same content is 991x85.
     It still takes two rows at a 1280 viewport, and that is the honest residue
     of having more controls than the drawing did, not a layout to fix by
     hiding one. */
```

### app/styles/admin-media-later.css:758 (WHY, shortened)

families-are-Dustin's rule kept; the false first draft and CSP narrative moved.

```css
/* ---- TYPE ---------------------------------------------------------------
 *
 * **THE FAMILIES ARE NOT CHANGED HERE, and the first reason written down for
 * that was FALSE, so here is the measured one.**
 *
 * The draft of this comment said the site ships no webfont and has no font-src
 * for a third party. Both are wrong: `app/root.tsx` preconnects to
 * fonts.googleapis.com and fonts.gstatic.com and loads Inter, and
 * `workers/app.ts` already carries `font-src https://fonts.gstatic.com`. A
 * claim written from memory rather than from the file, which is the class this
 * repo keeps paying for.
 *
 * What is actually true:
 *
 *   IBM PLEX SANS would be a SWAP, not an addition. Same origin, same CSP, one
 *   Google Fonts request either way. It is also `--font-sans`, which every
 *   PUBLIC page uses, so it is the site's brand typeface and not a property of
 *   the media library. Changing it is an aesthetic verdict, and those are
 *   Dustin's by the standing delegation.
 *
 *   IBM PLEX MONO would be a real ADDITION. `--font-mono` is a system stack
 *   today and costs nothing; adding a webfont for it puts a new request on the
 *   public plane, because app.css ships as one stylesheet for both.
 *
 * So the TREATMENT matches and the families are left for Dustin: size, weight
 * and tracking are set to the mockup's values, which is what carries the
 * difference between a title that reads as a title and one that reads as a
 * paragraph. */
```

### app/styles/admin-media-later.css:787 (HISTORY, deleted)

old values of a replaced rule.

```css
/* The page title. The mockup is 27px / 600 / -0.018em; this was 20px / 400,
   which is smaller than the search field beneath it. */
```

### app/styles/admin-media-later.css:796 (WHY, shortened)

old value moved.

```css
/* THE GROUP HEADING IS MONO IN THE MOCKUP, and the family is the point: it is a
   machine's label for a folder, not a piece of prose. 11px, 500, wide tracking,
   uppercase. It was 12px Inter at 600, which reads as a small headline. */
```

### app/styles/admin-media-later.css:807 (NUMBER, shortened)

row height arithmetic against the mockup; no gate.

```css
/* ---- THE LIST ROW -------------------------------------------------------
 *
 * 56px against the mockup's 46px, and the 10px was two things: a 19.5px line
 * height on a 13px name where the mockup uses 16.9px, and 1px more padding.
 * A 21 percent taller row is four fewer files on a screen. */
```

### app/styles/admin-media-later.css:824 (WHY, shortened)

trimmed.

```css
/* AND THE COPY CELL IS A FLEX BOX. `.media-col` is `display: block`, so the
   cell was a line box holding an inline-block button, which adds the strut's
   descent under it. That is small next to the margin above, but it is real and
   it is what puts the glyph off the row's optical centre. */
```

### app/styles/admin-media-later.css:834 (WHY, shortened)

trimmed.

```css
/* THE CONFIRMATION MODAL. Replaces `window.prompt`, which was unstyleable, told
 * a screen reader nothing beyond its bare string, blocked the whole browser and
 * is silently disabled in some contexts, where the form submitted unconfirmed.
 *
 * Centred rather than docked, because a confirmation is a question that stops
 * everything, not a panel you work beside. */
```

## app/styles/admin-media.css

### app/styles/admin-media.css:1 (WHY, shortened)

cascade rule kept; split history moved.

```css
/*
 * The media library: grid, facets, SERP and social previews, document card, caption bar, tile, list table.
 *
 * Split out of app.css on 2026-08-21. It was 9,269 lines and every layout
 * defect this month lived in it. THE ORDER OF THESE FILES IS THE CASCADE:
 * app.css imports them in the order they were cut, which is the order they
 * sat in the original file, so a rule that won by source position still wins.
 * Moving an import, or moving a rule between files, can change what renders.
 */
```

### app/styles/admin-media.css:11 (WHY, shortened)

trimmed.

```css
/* MEDIA LIBRARY ------------------------------------------------------------
 *
 * The grid sits on the CANVAS, so --border is correct here; the picker lives in
 * the drawer, which is the popover step, so it takes --border-strong. Both are
 * below. Every tile renders a TRANSFORM, never the original: the src carries
 * ?w=, and the intrinsic width/height attributes match what the transform
 * returns so the grid does not reflow as tiles arrive. */
```

### app/styles/admin-media.css:18 (NUMBER, shortened)

column table from one rendering; no gate asserts it and check:admin-ui cannot see styling.

```css
/* DENSITY, MEASURED IN A BROWSER RATHER THAN CALCULATED.
 *
 * The table that stood here was arithmetic and it was wrong. It read
 * `.admin-content` as the grid's width, when the grid sits inside 24px of
 * padding on each side and the scroll container takes another 15 for its
 * scrollbar. It claimed 6 columns at a 1280 viewport; the page rendered 5.
 *
 * The 6 below is real, and it arrived with the scrollbar fix rather than with a
 * tuning change: the escaped `.sr-only` spans gave the document a second
 * scrollbar, that scrollbar took 15px off the viewport, and 15px was the whole
 * difference between 5 columns and 6. A layout bug was costing a column.
 *
 * These numbers come from rendering this route with 24 seeded rows into the
 * real shell, with the built stylesheet, and reading the layout back out of the
 * browser. gridW is contentW minus 48 of padding minus 15 of scrollbar.
 *
 *   viewport   contentW   gridW   columns   tile
 *   1440       1152       1089    6         171x199
 *   1280       1040        977    6         153x203
 *   1024        784        721    4         171x198
 *    900        660        597    3         191x212
 *    768        768        705    4         167x196     sidebar is a bar here
 *    390        390        327    2         157x189
 *
 * contentW is min(72rem, viewport - 15rem sidebar) above the 800px breakpoint
 * and the viewport below it. Nothing asserts any of this: check:admin-ui
 * reduces the page to what it submits and sees no styling, so this table is the
 * record and it is only as fresh as the last time someone rendered the page. */
```

### app/styles/admin-media.css:46 (NUMBER, shortened)

the 1629ms median is a dated measurement; the behaviour whys stay.

```css
/* PENDING, while a data-changing navigation is in flight.
 *
 * The router sets `data-pending` through `useNavigation`; nothing here polls or
 * animates a widget. A data change on this plane costs a round trip plus a D1
 * query, MEASURED at 1629ms median, and an unmarked page reads as frozen and
 * gets pressed twice.
 *
 * The rows STAY LEGIBLE and stay in place: this dims and stops accepting
 * pointer input, it does not blank the grid or collapse its height, so nothing
 * reflows under the cursor and the previous answer is still readable while the
 * next one is fetched. `aria-busy` on the same element carries it to a screen
 * reader, so the affordance is not visual only.
 *
 * NOT applied to a display change. Those resolve without the loader, so
 * flagging them would flash over a re-render that already happened.
 */
```

### app/styles/admin-media.css:88 (WHY, shortened)

min() correctness and the tile-size prohibition kept; column and filename counts moved.

```css
/* `min(100%, ...)` is the mockup's form and is a correctness fix rather than a
     density one: a bare minimum cannot shrink below itself, so a viewport
     narrower than one tile plus its padding overflows instead of yielding one
     column. It is also the form this stylesheet already uses twice elsewhere.

     THE MOCKUP'S 124px TILE IS NOT ADOPTED, and this is the one place the
     approved look loses to a measurement. At 124px the grid renders SEVEN
     columns at a 1280 viewport and the tile body drops to 131px, at which 18 of
     24 filenames are cut by CSS from the END again: the exact defect the
     middle-elision was built to repair, reintroduced by density. 9.5rem holds
     six columns and no name is cut. */
```

### app/styles/admin-media.css:115 (WHY, shortened)

trimmed.

```css
/* THE FIXED BOX. An explicit ratio on the WRAPPER, so the space is reserved
   before the image arrives and a lazily-loaded tile cannot reflow the rows below
   it. The grid was ragged because it mixes 1200x630 cards, 3:2 photos and 1:1
   icons with nothing constraining them, which also made cards tall enough to
   clip their own buttons. */
```

### app/styles/admin-media.css:121 (WHY, shortened)

load-bearing rule kept; the shipped-defect measurements moved.

```css
/* `display: block` IS LOAD BEARING and its absence was a shipped defect.
     The element became a <span> when the tile gained a link around it, and
     `aspect-ratio` does not apply to a non-replaced INLINE box, so the fixed
     3:2 box silently stopped existing: measured in a browser, an image tile was
     181x181 rather than 181x121 and a PDF tile collapsed to 181x21 with the
     label floating in a stretched card. Both symptoms Dustin reported on the
     first look. */
```

### app/styles/admin-media.css:132 (WHY, shortened)

floor why and undeclared-token trap kept; row counts moved.

```css
/* The floor every tile paints on. An SVG has NO LQIP, because the Images
     binding does not rasterize vectors (11 of 70 rows), so the background image
     below is set only when one exists and this colour is what shows through
     otherwise. That is the difference between a quiet empty tile and a black
     hole.

     **IT WAS `--surface-2`, WHICH THIS STYLESHEET NEVER DECLARED**, in either
     theme, at either of its two use sites. An undefined custom property makes
     the declaration invalid at computed-value time, so `background-color` fell
     back to its initial value, transparent, and the floor this comment
     describes did not exist. check:contrast could not see it: the participation
     assertion walks DECLARED tokens, and a token nobody declares is in no
     block to walk. `--surface-popover` is the recessed step this well already
     wanted, and it is a token both themes carry and the matrix already prices. */
```

### app/styles/admin-media.css:147 (WHY, shortened)

trimmed.

```css
/* Describes the inline LQIP when there is one. `cover` and `center` mirror the
     object-fit below, so the blur sits exactly where the real image lands and
     the swap is invisible. It is a ~20px image scaled up, so the browser's own
     smoothing IS the blur: no filter is applied and none is needed. */
```

### app/styles/admin-media.css:171 (WHY, shortened)

the removed squash is history; the 3:2 reason stays.

```css
/* THE 5:2 SQUASH IS GONE, and the reason it existed is the reason it goes.
   It read "a document has nothing to show, so it does not get a picture's
   height", which was true of a box containing one word. `DocumentCard` now puts
   a title, a suggestion of text and a size in that space, so there IS something
   to show and squashing it would crush the thing that fixed the wall of empty
   boxes. 3:2, which is also every tile's ratio in the mockup. */
```

### app/styles/admin-media.css:178 (WHY, shortened)

row counts moved.

```css
/* What a document shows instead of an image. 31 of 70 rows are PDFs and the
   Images binding cannot render one, so they get a legible label rather than an
   empty box that reads as a failed load. */
```

### app/styles/admin-media.css:193 (WHY, shortened)

trimmed.

```css
/* THE FACET ROW, from the ratified mockup: a fixed-width mono label, the chips,
   and a hint saying who owns the axis. The hint is the design's whole argument,
   so it is copy rather than decoration and it lives in the markup.

   The label column is a fixed width so the row reads as a label and a set
   rather than as a sentence that happens to start with a word. */
```

### app/styles/admin-media.css:218 (WHY, shortened)

the mockup ratio is a measurement; the text floor rule stays.

```css
/* "assigned by the system". Mono and muted, so it reads as an annotation on the
   row rather than as another control in it. --text-muted and not a lighter
   tertiary: the mockup's #8B8274 measures 3.55:1 on the page, under the 4.5
   floor this repo enforces for text, and this is text a reader is meant to
   read. */
```

### app/styles/admin-media.css:236 (WHY, shortened)

trimmed.

```css
/* THE USAGE HONESTY LINE, from the mockup, and the reason it is a tinted box
   rather than a muted sentence: it is the one thing on this page that stops a
   reader deleting a file the site is serving. It sits on the accent tint, which
   is the surface the palette already has for "read this before acting". */
```

### app/styles/admin-media.css:261 (WHY, shortened)

load-bearing rule kept; measured widths moved.

```css
/* Name and Copy share a row, so the control sits beside the thing it copies
   rather than under it as a full-width slab repeated once per tile.

   `min-width: 0` IS LOAD BEARING HERE. Measured: without it the row is a grid
   item with `min-width: auto`, so it refuses to shrink below the name's natural
   width. The row rendered 212px wide inside a 151px tile and `.media-card`'s
   `overflow: hidden` clipped the copy button off the page: the control was
   present, focusable and invisible. */
```

### app/styles/admin-media.css:277 (WHY, shortened)

trimmed.

```css
/* The filename is a LINK to the detail view, and it is the no-script route to
   the address the Copy button writes to the clipboard.
   `color: inherit` and no underline at rest, which does not offend rule 2: the
   link is not distinguished by COLOUR either, so colour is not carrying
   anything alone. What marks it is position and weight inside a tile that is a
   click target end to end, and the underline arrives on hover and focus. An
   underline under an already-elided string reads as a second truncation. */
```

### app/styles/admin-media.css:293 (WHY, shortened)

trimmed.

```css
/* ONE LINE, and the string arrives already elided in the MIDDLE by
     `middleTruncate`. A clamp of two or three lines was measured and rejected:
     it still cuts the END, which is the half of these names that differs. The
     ellipsis here is the backstop for a name that is short in characters and
     wide in pixels, which a server-side character cap cannot see. */
```

### app/styles/admin-media.css:317 (WHY, shortened)

the containing-block fix kept; scroll-height measurements moved.

```css
/* THE PAGE'S ONE JOB, as a compact control beside the name.
 *
 * `position: relative` IS THE FIX FOR THE SECOND SCROLLBAR, and it is not
 * cosmetic. The button carries a `.sr-only` span for its accessible name;
 * `.sr-only` is `position: absolute`, so with no positioned ancestor its
 * containing block was the INITIAL one, which means it was laid out in
 * DOCUMENT coordinates and escaped `.admin-content`'s overflow clip entirely.
 * Measured in a browser: 24 invisible 1px spans dragged the document's scroll
 * height to 1685px inside a 598px shell, which is the second scrollbar and the
 * screen of dead space under the grid. Making the button a containing block
 * puts them back inside the scroller: document scrollHeight 1685 -> 542, equal
 * to clientHeight, no document scroll.
 *
 * `data-copied` is written by the click handler; there is no component state on
 * this page by ruling. */
```

### app/styles/admin-media.css:338 (WHY, shortened)

the reset reason kept; the pixel accounting moved.

```css
/* `.btn-ghost` carries `margin-top: 1.25rem`, which is right for a button
     stacked under a form and wrong for a 22px glyph sitting in a table cell.
     This rule reset the padding and the size and left the margin, so the copy
     control contributed 42px to a row that wanted to be 46: 22 of button and 20
     of a margin meant for something else. Found by measuring the list row and
     walking down to the one child that would not shrink. */
```

### app/styles/admin-media.css:350 (WHY, shortened)

square-versus-label rule kept; overflow measurements moved.

```css
/* A COPY BUTTON THAT CARRIES A WORD IS NOT A 22px SQUARE.
 *
 * `.media-copy` is sized for a TILE, where the measurement is on the record:
 * the word "Copy" cost 41px of a 131px row and pushed the filename back into
 * the end-truncation the middle-elision exists to prevent. So the tile control
 * is a fixed 22x22 glyph, correctly.
 *
 * The inspector's three snippet buttons carry visible labels, added so the
 * adaptive naming ("HTML tag" against "HTML link") can actually warn somebody
 * before they press it. They inherited the fixed square and the labels rendered
 * OUTSIDE their own buttons: measured at 22px wide with the text overhanging by
 * 19, 29 and 12px, overlapping each other. The label shipped invisible for one
 * commit, then shipped overflowing for one more.
 *
 * `:has()` rather than a modifier class, because the condition IS "this button
 * contains a label" and there is no second fact to name. */
```

### app/styles/admin-media.css:394 (WHY, shortened)

trimmed.

```css
/* IT WRAPS RATHER THAN CLIPPING. `nowrap` plus an ellipsis rendered "unused" as
   "unu..." on the live page: measured at a 183px tile the line is exactly as
   wide as the box, so the longer role words cut the usage word off. Wrapping
   costs a line on the few tiles that need one; clipping hides the one word on
   this line a reader is looking for. */
```

### app/styles/admin-media.css:406 (WHY, shortened)

trimmed.

```css
/* THE DETAIL VIEW, above the grid rather than beside it.
 *
 * Above, because a side panel at this content width would take a third of the
 * grid permanently and this page is only ever showing one asset at a time. It
 * is a `?key=` on the same URL, so it is linkable, survives a reload and needs
 * no script. */
```

### app/styles/admin-media.css:412 (WHY, shortened)

fixed-drawer and dvh whys kept; the failed in-flow panel's measurements moved.

```css
/* THE INSPECTOR AS A DOCKED DRAWER, which is what the mockup has and what two
 * previous attempts were not.
 *
 * ## WHAT WAS WRONG WITH THE IN-FLOW PANEL
 *
 * It was `position: sticky` inside a two-column panel grid, and every one of
 * its measured properties was wrong. Opening a file put 23 of the panel's 566
 * pixels on screen and required 507px of scrolling to reach its top. It also
 * SQUEEZED the page behind it: the search bar, the lens row, the usage note and
 * the grid all went from 977px to 573px, the grid dropped from six columns to
 * three, and a 483px void of empty column sat above the panel. Clicking a file
 * to learn about it reflowed the entire library you were reading.
 *
 * ## WHAT IT IS NOW
 *
 * Fixed, flush to the right edge of the viewport, full viewport height, over a
 * scrim, with the page behind it completely unaffected. That is the mockup's
 * design and the reason for it is that inspecting is a SIDE activity: the
 * reader is comparing the panel against the grid, so the grid must not move.
 *
 * `position: fixed` also takes it out of `.admin-content`, which is the shell's
 * scroll container on desktop, so the drawer pins to the viewport rather than
 * to a scrolled box. That is why there is no breakpoint here: the same
 * mechanism is correct at every width, and `min(392px, 100%)` makes it
 * full-bleed on a phone without a media query.
 *
 * 100dvh rather than 100vh, because on mobile Safari 100vh is taller than the
 * visible area and the panel's last control would sit under the browser chrome.
 */
```

### app/styles/admin-media.css:462 (WHY, shortened)

trimmed.

```css
/* THE STICKY HEAD, so the name of the thing you are reading about does not
   scroll away from the facts about it, and Close stays reachable without
   scrolling back up. Negative margins pull it out to the drawer's padding edge
   so the band is full bleed rather than a strip with gaps at its sides. */
```

### app/styles/admin-media.css:479 (WHY, shortened)

trimmed.

```css
/* The name takes the free space and ELLIPSISES rather than wrapping. A
   content-addressed key is 20 characters of hash and a static one is a path;
   either wraps to three lines and pushes the whole panel down. `min-width: 0`
   is what makes the ellipsis possible: a flex item refuses to shrink below its
   content otherwise, and the close control would be pushed off the panel. The
   full string is in the title attribute and in the Address field below. */
```

### app/styles/admin-media.css:531 (WHY, shortened)

trimmed.

```css
/* THE SCRIM. A real link, so closing works with no script at all, and the whole
   area outside the drawer is the target, which is what everybody expects of a
   drawer. `aria-hidden` would be wrong on a focusable control, so it carries a
   real accessible name instead and is simply not announced as decoration. */
```

### app/styles/admin-media.css:540 (WHY, shortened)

the three refusal grounds kept briefly; the first attempt and mockup value moved.

```css
/* THE EXISTING `--scrim` TOKEN AT 28 PERCENT, not a new one.

     A `--scrim-veil: rgba(...)` was written first and check:contrast refused it
     three ways, all correctly: the token block accepts LITERAL HEXES only, so
     an rgba() is unparseable; Lightning CSS minifies it to `#2a262247` so the
     shipped value would not match the declared one either; and the
     participation assertion demands every declared token appear in a measured
     pair, which a translucent veil cannot honestly do because no text ever sits
     on it and it has no ratio.

     `opacity` on the element sidesteps all three. `--scrim` is already declared
     in every theme and already priced in the matrix against `--on-scrim`, and
     nothing is drawn on this layer, so dimming the whole element is exactly
     what is wanted. The mockup's own value is rgba(42,38,34,0.28); this is the
     ratified dark neutral at the same 28 percent. */
```

### app/styles/admin-media.css:565 (WHY, shortened)

trimmed.

```css
/* ONE COLUMN INSIDE THE SIDE PANEL, at every width.
 *
 * The two-column body was written for a card spanning the whole content area,
 * where 20rem of preview beside the facts fits comfortably. In a 24rem panel it
 * does not: measured, the facts column was pushed past the panel edge and the
 * labels rendered as "Ad", "Ke", "Ro", "Ty" down the right margin. The panel is
 * the narrow context now, so it gets the narrow layout, and the media query
 * above stops being the only thing that knows about narrowness. */
```

### app/styles/admin-media.css:578 (WHY, shortened)

trimmed.

```css
/* NOTHING IN THE PANEL MAY BE WIDER THAN THE PANEL.
     An <input> has an intrinsic default width of about 20 characters and does
     NOT shrink to its grid track, so the readonly address field ran past the
     panel edge with its own value hidden under the scrollbar. `min-width: 0` on
     the row and `width: 100%` on the field is the pair that fixes it; either
     alone leaves the overflow. Same class as the list row's name cell. */
```

### app/styles/admin-media.css:602 (WHY, shortened)

the old token name is history.

```css
/* The same floor the tiles paint on, so a transparent PNG and an SVG with no
     LQIP read the same way here as they do in the grid. Was `--surface-2`,
     which nothing declares; see the tile's own note. */
```

### app/styles/admin-media.css:761 (WHY, shortened)

border law and no-imitation rule kept.

```css
/* SERP AND SOCIAL CARD PREVIEWS -------------------------------------------
 *
 * Both live in the drawer, which is the POPOVER STEP, so every border here is
 * --border-strong: --border clears 3:1 on --surface but drops to 2.66:1 on
 * --surface-popover, which is the elevated-surface law this repo already
 * records twice.
 *
 * Neither imitates a specific search engine's or network's chrome. They show
 * the STRINGS the site emits, cut where they will be cut, because the rendering
 * of those strings changes without notice and a pixel-faithful mock would be
 * quietly wrong within a month. */
```

### app/styles/admin-media.css:896 (WHY, shortened)

trimmed.

```css
/* THE UPLOAD CONTROL, one thing in the page head.
 *
 * The file input is visually folded into its label so the head shows a single
 * button rather than a bare picker plus a submit. It is NOT display:none: a
 * hidden input is unreachable by keyboard, and the whole point of layering an
 * enhancement over a working form is that the form keeps working. Clipped to a
 * pixel, the standard sr-only technique, so it stays focusable and its focus
 * ring still lands on the label. */
```

### app/styles/admin-media.css:935 (WHY, shortened)

mockup ratios moved; the fill-not-hairline rule stays.

```css
/* MEDIA v6: the design's own structure.
 *
 * THE SECTION HEADING IS THE SPINE. Small caps, a count, and the note right
 * aligned and quiet. Every value below resolves to a token that clears its
 * floor: the mockup's #A79C8A muted label measures 2.34 to 1 and its #F3EEE3
 * divider 1.16, so neither ships. Quietness comes from SIZE, WEIGHT and
 * TRACKING, and separation from FILL, which is the rule the arc established. */
```

### app/styles/admin-media.css:966 (WHY, shortened)

trimmed.

```css
/* THE NOTE. Right aligned, per the mockup, and the reason the grouping exists.
   --text-muted rather than the mockup's grey: it is the quietest token that
   still clears 4.5 to 1, which is the floor a sentence someone must READ has
   to meet. */
```

### app/styles/admin-media.css:999 (WHY, shortened)

session label moved.

```css
/* MEDIA v6 session 3: group headings, selection, and the drop hint.
 *
 * Same rule as the rest of the arc: no hairline that fails a floor. The heading
 * separates by SPACE and WEIGHT, not by a rule nobody can see. */
```

### app/styles/admin-media.css:1064 (WHY, shortened)

the rebuilt-softness rule kept; the mockup's failing ratios moved.

```css
/* MEDIA v6: the display bar, the two layouts, and the destructive accent.
 *
 * THE SOFTNESS IS REBUILT LEGALLY. The mockup's hairlines (#e5ddce at 1.35:1,
 * #c9bfa9 at 1.82:1, #f3eee3 at 1.16:1) and its two greys (#a79c8a at 2.34:1,
 * #8b8274 at 3.27:1) all fail their floors, so none of them ships. What made
 * the mockup feel calm is reproduced with TINT, SPACING and WEIGHT instead:
 * surfaces separate by fill rather than by a line nobody can see, labels get
 * size and letter-spacing rather than a lighter grey, and rows get air. That is
 * the instruction not to substitute the nearest compliant hairline, which is
 * what made the previous pass read as paint. */
```

### app/styles/admin-media.css:1204 (WHY, shortened)

trimmed; ratios moved.

```css
/* MEDIA v6 session 4: the document card, the caption bar, and the real table.
 *
 * THE MOCKUP'S COLOURS ARE STILL REFUSED, and the same three are refused again
 * here for the same measured reasons: #f3eee3 as a row rule is 1.16:1, #e5ddce
 * as a header rule is 1.35:1, and #a79c8a as a muted label is 2.34:1. What made
 * the mockup calm is rebuilt with FILL, SPACING, SIZE and TRACKING, which is
 * the instruction this arc has followed from the start. Where a line is the
 * only honest way to say "the header ends here", it takes --border, which
 * clears the 3:1 graphical floor, and it is one line rather than one per row. */
```

### app/styles/admin-media.css:1214 (WHY, shortened)

the pair ratios are check:contrast's; row counts moved.

```css
/* ---- THE DOCUMENT CARD --------------------------------------------------
 *
 * 31 of the 70 rows are documents. They rendered as a word floating in an empty
 * band, so a folder of five papers was five identical grey boxes distinguished
 * only by `edw...omics.pdf` against `edw...lysis.pdf`.
 *
 * Every colour here resolves to a token and every one is a pair the matrix
 * already carries: the extension label is --brand on --surface (7.6:1), the
 * title is --text on --surface (13.4:1), the foot is --text-muted on --surface
 * (6.6:1). The mockup's #b7a5e0 label is 2.0:1 on white and does not ship; what
 * makes it read as a label is the size, the tracking and the uppercase, none of
 * which needed the colour to be faint. */
```

### app/styles/admin-media.css:1257 (WHY, shortened)

trimmed.

```css
/* THREE LINES, then the ellipsis. A title is words rather than a slug, so it
   wraps like prose and the cut lands at a line end instead of mid-token. This
   is the one place a line clamp is right on this page: the string is no longer
   a filename whose distinguishing half is its tail. */
```

### app/styles/admin-media.css:1273 (WHY, shortened)

trimmed.

```css
/* THE SUGGESTION OF TEXT. Decoration, aria-hidden in the markup, carrying no
   meaning at all, which is why it may be quiet: WCAG 1.4.11 reaches graphical
   objects needed to UNDERSTAND the content, and nothing is lost by not seeing
   these. They still take --border rather than the mockup's 1.16:1 hairline,
   because this stylesheet does not carry a colour nobody can see even where the
   rule would allow one. Quietness comes from being 1px and from the last one
   stopping at 62 percent, which is what a paragraph looks like from a distance. */
```

### app/styles/admin-media.css:1284 (WHY, shortened)

trimmed.

```css
/* More air than the mockup gives them, and that is a CONSEQUENCE of the
     colour rather than a taste. At #ede6d8 the mockup can stack three rules 3px
     apart and they still read as texture; at --border they are legible lines,
     and three legible lines 3px apart read as a triple underline hanging off
     the title. Spacing them buys back the "paragraph seen from across a room"
     the faint colour was doing for free. */
```

### app/styles/admin-media.css:1294 (WHY, shortened)

trimmed.

```css
/* RAGGED, LIKE TEXT IS. The mockup runs two full-width rules and one at 62
   percent. At this contrast a full-width rule reads as a divider, so all three
   stop short and stop at different places: what makes it read as prose rather
   than as ruling is the uneven right edge, which costs no contrast at all.
   Quietness from SHAPE, which is the same move the labels make with size and
   tracking. */
```

### app/styles/admin-media.css:1317 (WHY, shortened)

trimmed.

```css
/* NO RULE FOR A CARD FOOT, because there is no card foot. The mockup ends its
   document card with "24 pages", which is fixture data there and unstorable
   here, and the size that stood in for it duplicated the tile's own meta line.
   `DocumentCard` carries the full reasoning. */
```

### app/styles/admin-media.css:1322 (WHY, shortened)

trimmed.

```css
/* The three tile sizes give the card different amounts of room, so the parts
   that need room appear only when there is some. At S the card is ~112px wide
   and a clamped title plus three rules plus a foot is a stack of noise, so the
   rules go and the title takes the space. Nothing is HIDDEN that carries
   meaning: the rules are decoration and the foot repeats the meta line below. */
```

### app/styles/admin-media.css:1336 (WHY, shortened)

trimmed.

```css
/* ---- THE CAPTION BAR ----------------------------------------------------
 *
 * Over the picture, on the tile the reader has selected or opened. The frame is
 * what makes it possible: the caption is a SIBLING of the thumbnail link rather
 * than a child, because it carries a button and a <button> inside an <a> is
 * invalid markup that browsers resolve inconsistently. */
```

### app/styles/admin-media.css:1355 (NUMBER, shortened)

measured bar heights; no gate; the why stays.

```css
/* MEASURED AND TIGHTENED. At 7px of padding with inherited line-heights the
     bar came out 56px tall on a 102px tile, and with the fade above it the
     picture the caption exists to label was almost entirely covered. A label
     that hides its subject is not a label. 37px leaves the image readable and
     still fits both lines and the control. */
```

### app/styles/admin-media.css:1423 (WHY, shortened)

trimmed.

```css
/* An OUTLINE rather than a tinted fill. A fill here would have to be a
     translucent white over the scrim, which is the unmeasurable composite the
     scrim exists to remove, and it would be this stylesheet's only
     `color-mix()`, which check:contrast reads values out of. */
```

### app/styles/admin-media.css:1431 (WHY, shortened)

trimmed.

```css
/* ---- THE GRID TILE, now explicitly placed -------------------------------
 *
 * The card became a GRID so the copy control could leave the name row. It had
 * to leave: a name row holding two things is one cell, and the list then has no
 * eighth column to put the button in. Explicit placement means the source order
 * serves the LIST (check, thumb, name, usage, dims, size, added, copy) while
 * the tile still reads thumbnail, then name and copy, then meta. */
```

### app/styles/admin-media.css:1438 (WHY, shortened)

one-tree and reveal rules kept; the before-state narrative moved.

```css
/* **THE TILE IS THE CARD.** It was a card ABOUT a picture: a 102px thumbnail
 * with a 98px text body stapled underneath carrying a middle-elided filename, a
 * role chip, a size and a usage word. Six tiles in a row printed
 * `202...ohort.jpg` six times, which identifies nothing, and the picture, which
 * is the only thing that does identify these files, got half the height.
 *
 * The mockup's answer is the whole tile: 3:2, edge to edge, and the metadata
 * appears over the image on hover or when the tile is picked out. That is the
 * shape a library of photographs wants, and the caption bar built two sessions
 * ago was already most of the mechanism.
 *
 * NOTHING IS DELETED FROM THE MARKUP, so the one-tree rule holds and every
 * control keeps its no-script path. The name link and the copy button are still
 * rendered, still focusable in source order, and revealed by hover, focus or
 * selection rather than drawn at rest.
 */
```

### app/styles/admin-media.css:1475 (WHY, shortened)

trimmed.

```css
/* THE BODY IS THE CAPTION NOW. It stays in the DOM and is laid over the image,
   revealed on hover, on focus-within, on selection and on the open tile. Focus
   is in that list deliberately: a keyboard reader never hovers, and chrome that
   only appears on hover is chrome they can never see. */
```

### app/styles/admin-media.css:1577 (WHY, shortened)

trimmed.

```css
/* THE HOVER LIFT AND RING, the mockup's own values. The inset hairline is the
   tile's resting edge; hover replaces it with a shadow that raises the tile off
   the page, and the 2px transform is what makes it read as a lift rather than a
   glow. */
```

### app/styles/admin-media.css:1588 (WHY, shortened)

no-token rule kept; the arc tally moved.

```css
/* `rgb(0 0 0 / 12%)` is this stylesheet's OWN shadow idiom, already used by
     the popover elevation, rather than a `--shadow-tile` token. A shadow colour
     is not a palette colour: it has no contrast obligation, nothing is drawn on
     it, and minting a token for it would put an entry in the block that the
     participation assertion could never price. Grepping the declarations before
     shipping caught the invented token, which is the fourth instance of that
     class in this arc. */
```

### app/styles/admin-media.css:1627 (NUMBER, shortened)

checkbox geometry is in the declaration; the why stays.

```css
/* THE EXTENSION LABEL CLEARS THE CHECKBOX. Both want the top-left corner: the
   selection box is absolutely positioned there on every tile, and the document
   card's label starts there too, so a PDF card rendered its checkbox ON the
   word and the pair read as "DF". Measured: the box is 19px plus its 6px inset,
   so the label starts past 25px. Grid only; in the list the two are in
   different columns and neither needs to move. */
```

### app/styles/admin-media.css:1637 (WHY, shortened)

trimmed.

```css
/* A DOCUMENT TILE DOES NOT REPEAT ITS OWN NAME.
   The card already carries the title in words and the extension in the corner,
   so the body's filename line rendered `edw...omics.pdf` directly beneath
   `edwards 2024 phage genomics`: the same file, twice, one of them in the
   elided form this design exists to stop being the identifying one.

   HIDDEN, NOT REMOVED. The anchor stays in the markup, so it stays in the
   evaporation scan's link set and stays the no-script route to the address, and
   nothing is lost by not drawing it: the thumbnail above it is a link to the
   same inspector. An image tile keeps its name, because an image card carries
   no text of its own. */
```

### app/styles/admin-media.css:1652 (WHY, shortened)

trimmed.

```css
/* With the name row gone, the copy control has nothing to sit beside on its own
   row, so it drops onto the meta line instead of hovering over an empty track.
   The meta gives up the second column to make room, which it was only spanning
   because there was nothing else on that row. */
```

### app/styles/admin-media.css:1665 (WHY, shortened)

the separate-grids reason kept; track values are in the declaration.

```css
/* ---- THE LIST, AS A REAL TABLE ------------------------------------------
 *
 * Eight tracks, the mockup's own, read out of its source rather than estimated:
 * 34px 44px minmax(160px, 1fr) 112px 78px 68px 84px 50px, 8px gap, rows at
 * 7px 14px and the header at 9px 14px.
 *
 * The header and every row are SEPARATE grids on an IDENTICAL track list, which
 * is how the mockup does it and is why the columns line up while folder
 * sections still break the rows into groups. A single grid spanning all of them
 * could not carry a heading between two rows without breaking the tracks. */
```

### app/styles/admin-media.css:1685 (WHY, shortened)

the mockup ratio moved.

```css
/* The header separates from the rows by FILL, and takes one --border rule
     beneath it because a table's header genuinely does end somewhere. One line
     on the whole table, not one per row: the mockup's per-row #f3eee3 is 1.16:1
     and rows separate here by alternating fill instead. */
```

### app/styles/admin-media.css:1694 (WHY, shortened)

mockup ratios moved.

```css
/* A COLUMN HEADING IS A LINK, because the sort it applies is a URL. Quiet by
   size, tracking and uppercase rather than by an unreadable grey: the mockup's
   #8b8274 is 3.27:1 and its #a79c8a is 2.34:1, and neither ships. */
```

### app/styles/admin-media.css:1736 (WHY, shortened)

the positional-selector prohibition kept; the first-render defect moved.

```css
/* A NUMERIC HEADING SITS OVER THE EDGE ITS VALUES ARE ALIGNED TO, and it reads
   its side off its own attribute.

   It was `nth-of-type`, which was wrong on the first render and looked right in
   the code: that selector counts among siblings of the SAME ELEMENT TYPE, and
   this row mixes anchors with spans, so `:nth-of-type(4)` picked the fourth
   ANCHOR rather than the fourth heading. Size ended up left-aligned in its
   track, hard against a right-aligned Dims, and the two words collided. A
   positional selector over a mixed-type row is a guess about markup that has
   already changed once. */
```

### app/styles/admin-media.css:1761 (WHY, shortened)

the reset reason kept; the measured slab moved.

```css
/* **THE RESET IS THE FIX, AND ITS ABSENCE WAS A SHIPPED DEFECT.**
     `.media-card` sets `background: var(--surface)` on every card for the grid,
     and the list block never took it back, so the `:nth-child(odd)` rule below
     was painting --surface onto rows that were already --surface. Measured in a
     browser: four consecutive rows all rgb(241,235,225), adjacent-row contrast
     1.00:1, which is not banding, it is one solid slab. The comment beside that
     rule said "rows separate by TINT" and had been describing something that
     never happened since the list view shipped. */
```

### app/styles/admin-media.css:1772 (WHY, shortened)

seam rule kept; the ratios are measurements.

```css
/* Rows separate by TINT rather than by a hairline: every hairline in the mockup
   failed its floor (#f3eee3 is 1.16:1), and a filled alternate row needs no
   line at all.

   The measured difference is --surface against the canvas, 1.11:1, which is in
   the same range as the hairline it replaces and is not held to it: this is a
   surface-to-surface seam, and the palette law is explicit that such a seam
   carries no 3:1 obligation (the chrome ruling makes the same call about the
   header seam at 1.80:1). What separates a row here is a BAND the full width of
   the table rather than a one-pixel line, and a band at 1.11 is legible where a
   line at 1.16 is not. */
```

### app/styles/admin-media.css:1834 (WHY, shortened)

trimmed.

```css
/* THE NAME CLIPS HERE RATHER THAN WRAPPING, and that reverses the previous
   pass deliberately. Wrapping was right when a row was 122px tall and had the
   vertical space to spend; a table row is 45px and one wrapped name pushes
   every column in that row out of alignment with the header. The whole name is
   still a hover away in the `title` and a click away in the inspector, and the
   DIRECTORY beneath now carries the half that used to be cut. */
```

### app/styles/admin-media.css:1880 (WHY, shortened)

trimmed to three lines.

```css
/* The usage dot is a SECOND CHANNEL beside the word, never the signal itself:
   the cell says "used" or "unattached" in text right next to it, so the colour
   adds emphasis and carries nothing on its own. That is rule 1 of the palette
   law, and it is why a reader who cannot separate the two hues loses nothing. */
```

### app/styles/admin-media.css:1892 (HISTORY, deleted)

records a removed rule; nothing in the sheet depends on it.

```css
/* THE `data-cited` RULE IS GONE. It coloured the dot of the two-state model,
   where a row was cited or it was not. Nothing has rendered that attribute
   since the three states landed and the dot became `data-usage`, so it was a
   rule matching an attribute no markup carries: dead on the day the model
   changed and invisible to every gate, because a selector for an element
   nobody renders simply never applies. Found by grepping the deployed
   stylesheet for a negative needle. */
```

### app/styles/admin-media.css:1934 (WHY, shortened)

column-drop rules kept; the width arithmetic moved.

```css
/* NARROW VIEWPORTS. The eight fixed tracks add to 470px plus seven 8px gaps
   plus 28px of padding, which is 554px and does not fit a 390px phone: the row
   would overflow and take the whole page sideways with it.

   COLUMNS DROP RATHER THAN THE TABLE SCROLLING. A horizontal scroll would need
   a wrapper around the header AND every group so they scrolled together, and a
   header that scrolled separately from its rows would label the wrong columns.
   Dims and Added go first because they are the two a phone-sized reader is
   least likely to be scanning for, and because Dims is already the column the
   design mutes. Size stays: it is the number somebody pruning a library reads.

   The header's cells are dropped by the same query, so the two stay in step. A
   heading left over a removed column is worse than no heading. */
```

### app/styles/admin-media.css:1964 (WHY, shortened)

trimmed.

```css
/* DRAFT PREVIEW LINKS, in the drawer.
 *
 * The drawer is the popover step, so the rule that draws a line here takes
 * --border-strong and never --border. Hard rule 5.
 *
 * The row is deliberately NOT a `.slug-line`: the token sits beside its expiry
 * AND two controls rather than beside one, so the meta column has to be allowed
 * to shrink while the actions keep their width. */
```

### app/styles/admin-media.css:2162 (WHY, shortened)

trimmed to three lines.

```css
/* A banner, not a control, so the pastel tint is the right register here and
   the fill is not. This is the editor's ONE semantic tint (rule 4): the
   character counter and the invalid-field border alongside it are text and
   border, never a second tinted surface. */
```

## app/styles/admin-posts.css

### app/styles/admin-posts.css:1 (WHY, shortened)

cascade rule kept; split history moved.

```css
/*
 * The admin posts index: toolbar, filters, overflow menu, disabled affordance, bulk bar.
 *
 * Split out of app.css on 2026-08-21. It was 9,269 lines and every layout
 * defect this month lived in it. THE ORDER OF THESE FILES IS THE CASCADE:
 * app.css imports them in the order they were cut, which is the order they
 * sat in the original file, so a rule that won by source position still wins.
 * Moving an import, or moving a rule between files, can change what renders.
 */
```

### app/styles/admin-posts.css:26 (WHY, shortened)

trimmed.

```css
/* SEARCH AND FILTER.
 *
 * A row that wraps rather than a grid, because the three fields have honestly
 * different natural widths and a grid would either stretch the two selects to
 * match the search box or squeeze the search box to match them. The search
 * field is the only one that grows. */
```

### app/styles/admin-posts.css:95 (WHY, shortened)

trimmed to three lines.

```css
/* THE SCHEDULED QUEUE NOTE. Neutral by rule 4: the one semantic tint in this
   view is spent on the drift alert, and this is information rather than a
   demand. The glyph is a clock, so the meaning is not carried by wording
   alone. */
```

### app/styles/admin-posts.css:134 (WHY, shortened)

trimmed.

```css
/* Overflow menu -------------------------------------------------------------
 *
 * See app/components/admin/overflow-menu.tsx for why this is a disclosure
 * rather than a role="menu", and why it is <details> rather than a click
 * handler. */
```

### app/styles/admin-posts.css:215 (WHY, shortened)

ratios are check:contrast's.

```css
/* The hint is muted text, and --text-muted was measured on --surface-popover
   (7.1:1 light, 7.8:1 dark) but not on the brand tint a hovered row paints
   underneath it. Rather than introduce a pair the doc has not ratified, the
   hover row drops the hint back onto body text, which IS measured on the brand
   tint. */
```

### app/styles/admin-posts.css:249 (WHY, shortened)

ratios are check:contrast's.

```css
/* The border is the LIGHTER family token, not the fill again. In dark mode
     the crimson fill sits at 2.49:1 against prairie night, so a same-colour
     border gives the button no edge; --border-danger is 3.4:1 and does. */
```

### app/styles/admin-posts.css:272 (WHY, shortened)

specificity trap and the Link rule kept; the measured failure ratios moved.

```css
/* The (0,1,0) versus (0,1,1) specificity trap design-tokens.md records for the
   wordmark, found live again on the New post control and this time as a real
   contrast failure rather than a wrong hue.

   These classes are worn by anchors as well as buttons, and an anchor is
   reached by the base `a:visited` and `a:hover` rules at (0,1,1), which outrank
   a class-only declaration at (0,1,0). So the base rules won on the colour
   property while the class rules still won on the background, and the label
   was painted with a token measured against the PAGE, on top of a fill:

     rest, once /admin/posts/new was in history
       light  --visited #7f2651 on --brand #4f2d7f          1.14:1
       dark   --visited #d586ac on --brand #b7a5e0          1.21:1
     hover, both themes
       --brand-hover on --brand-hover                       1.00:1

   Naming the link states explicitly puts these at (0,2,0), which outranks the
   base rules, and the label lands back on the three pairs the doc measured for
   a brand fill: 10.43 / 13.06 / 15.26 light, 8.10 / 10.01 / 10.01 dark.
   check:contrast already asserts all three, so the fix is verified by a gate
   rather than by this comment.

   It is invisible in review because it only appears once the destination is in
   the reader's history, which for the person who runs this admin is always.
   Any future filled or bordered control worn by a Link needs the same
   treatment. */
```

### app/styles/admin-posts.css:305 (WHY, shortened)

the found-live date moved.

```css
/* Disabled affordance ------------------------------------------------------
 *
 * WCAG exempts a disabled control from the contrast minimum, so dimming is
 * allowed here in a way it is not anywhere else in this stylesheet. What is NOT
 * exempt is telling the reader the control is unavailable: a button that is
 * blocked and still renders at full strength with a pointer cursor reads as
 * broken rather than as waiting.
 *
 * Found live 2026-08-01 on Insert figure, which correctly refuses to run until
 * alt text exists and gave no sign of it. The state is carried by opacity AND
 * by the cursor, so it survives forced-colors, where opacity is preserved but
 * the fill is not.
 */
```

### app/styles/admin-posts.css:350 (WHY, shortened)

trimmed.

```css
/* Exempt from rule 2 for the same reason .btn is: the border is already a
     non-colour affordance. Without this the three ghost controls that are
     Links underline while the ones that are buttons do not, from the same
     base-rule leak. */
```

### app/styles/admin-posts.css:357 (WHY, shortened)

trimmed.

```css
/* The posts index, in a card. Rule 7 names indexes as what cards are for, and
   this is the site's only one. The card is the third rung of the cockpit's
   surface ladder: shell chrome, canvas, then this sitting on the canvas behind
   a border. */
```

### app/styles/admin-posts.css:370 (WHY, shortened)

trimmed.

```css
/* Bulk actions bar. Present only while something is selected, so the list is
   unchanged for the ordinary read-and-edit pass.

   Rule 5: it is a pinned bar on the popover elevation step, so its seam is
   --border-strong and never --border. It sits INSIDE the card, above the
   table, which is why only the bottom edge is drawn. */
```

### app/styles/admin-posts.css:421 (WHY, shortened)

trimmed.

```css
/* 24px minimum target (WCAG 2.2 AA, 2.5.8). The input is smaller than that in
   every browser default, so the LABEL carries the hit area with the input
   inside it. The label is also what names the control, so one element does both
   jobs rather than a wrapper plus an aria-label that can drift from it. */
```

### app/styles/admin-posts.css:441 (WHY, shortened)

the no-sideways-scroll rule and min-width reason kept; the deployed measurement moved.

```css
/* The table's own scrollport. THE DOCUMENT MUST NOT SCROLL SIDEWAYS; a wide
   table may, inside its own box.

   MEASURED on the deployed build at 480, 400 and 320 once the topbar fold
   landed: `table.posts-table` reaches 582px whatever the viewport, because a
   table's min-content is the sum of its columns' min-contents and this one
   carries a checkbox, a title, a slug, a state chip and a date. That is the
   same 582 the topbar had, which is why this defect was invisible: it sat
   exactly behind another one wearing the same number.

   `min-width: 0` for the same reason the topbar needed it. This div is a flex
   item of the form above it, so without the declaration its automatic minimum
   is the table's min-content and the scrollport would be as wide as the thing
   it is supposed to be clipping. */
```

### app/styles/admin-posts.css:458 (WHY, shortened)

the containing-block rule kept; the measured displacement moved.

```css
/* A SCROLLER MUST ALSO BE A CONTAINING BLOCK, and this is the second time
     this plane has paid for that. `.admin-content` carries the identical
     declaration with the identical reasoning, written when 24 escaped
     `.sr-only` spans dragged the document's scroll HEIGHT to 1685px; this is
     the same defect on the horizontal axis, at a scroller that did not exist
     when that one was fixed.

     MEASURED here: with the scrollport clipping the table correctly, the
     document still scrolled to exactly 510px, and the element at 510 was a
     one-pixel `.sr-only` label inside a row action. It is not wide; it is
     DISPLACED. `.sr-only` is `position: absolute` with no offsets, so it keeps
     its static position, 509px into a table that is 582px wide, and it resolved
     against `.admin-content` rather than against this box. An absolutely
     positioned element whose containing block sits OUTSIDE a scroller is not
     clipped by that scroller: it is laid out in the ancestor's coordinates and
     drags the document out with it, one pixel at a time.

     `position: relative` moves the containing block here, so the label is
     clipped by the box it visually belongs to. */
```

### app/styles/admin-posts.css:509 (WHY, shortened)

trimmed.

```css
/* Hover is the NEUTRAL elevation step, not the brand tint the command palette
   paints its active option with. The palette's row is SELECTED, an answer the
   reader has moved to; a row under a pointer is not a choice, and rule 6 keeps
   brand out of anything that reads as state. The practical half matters more:
   a row carries muted text in the slug and the date, and --text-muted is a
   measured pair against --surface-popover in both the default and the
   prefers-contrast tier, where against a brand tint it is measured nowhere. */
```

### app/styles/admin-posts.css:520 (WHY, shortened)

ratios are check:contrast's.

```css
/* The separator has to come up with the surface under it. --border clears the
   3:1 UI floor on --surface by 0.04 in dark mode and drops to 2.66:1 on the
   popover step, so a hovered row drawn with the default border would quietly
   fall below AA. Measured by check:contrast on the run that introduced the
   hover, not reasoned about afterwards. */
```

### app/styles/admin-posts.css:530 (WHY, shortened)

trimmed.

```css
/* Status pill. Three states out of the two the database stores; see the loader.
 *
 * Rule 1 wants a channel that is not colour, and the word is the first one. The
 * second is BORDER STYLE, which is chosen over a hue difference on purpose:
 * forced-colors takes the fill and the tint away and leaves the stroke, so the
 * three stay separable in exactly the mode where the palette stops existing.
 * Published is filled and solid, scheduled is dashed, draft is dotted. */
```

### app/styles/admin-posts.css:549 (WHY, shortened)

trimmed.

```css
/* Rule 5: a state that is TRUE right now takes a fill. The ring is the LIGHTER
   family token rather than the fill repeated, the same reasoning .btn-danger
   already carries: a fill is not required to clear 3:1 as a shape against the
   surface behind it, so the family's --border-* token is what gives the pill
   an edge. */
```

### app/styles/admin-posts.css:640 (WHY, shortened)

trimmed.

```css
/* The row-action forms, one pair per post, parked below the table.

   They exist only to be pointed at by a `form` attribute: the buttons that
   submit them live in cells inside the bulk selection form, and a form cannot
   nest inside another. `display: none` rather than a visually-hidden class,
   because there is nothing here to read. A hidden input is not content, and a
   form with no rendered control is not a landmark; the same treatment
   `.editor-delete-form` gets for the same reason. Association by `form` is
   unaffected by display, so the buttons still submit them. */
```

### app/styles/admin-posts.css:653 (WHY, shortened)

trimmed.

```css
/* WCAG 2.2 target size (minimum) is 24 by 24 CSS pixels. 1.75rem is 28, so the
   target clears it with the row's own padding still to spare.
   --border-strong rather than --border, because these ride a row that elevates
   to --surface-popover on hover, where --border is 2.66:1 in dark. */
```

### app/styles/admin-posts.css:678 (WHY, shortened)

trimmed.

```css
/* Standing-condition alert. See app/components/admin/alert.tsx for why this is
   a named region and not a live one.
 *
 * The amber family, because drift is a degradation and not a failure: the site
 * works, its search works, and only the AI answer layer is out of step. It is
 * the ONE semantic tint this view spends (rule 4), and the scheduled pill is
 * deliberately the same family so the two can never sit adjacent in different
 * ones. */
```

### app/styles/admin-posts.css:756 (WHY, shortened)

trimmed to three lines.

```css
/* The absence. Left-aligned and allowed to wrap, because it is a SENTENCE and
   not a number: right-aligning it under a numeric header would make it read as
   a value. Muted, but the words carry the meaning on their own, so nothing is
   lost when the colour is not there. */
```

### app/styles/admin-posts.css:769 (WHY, shortened)

trimmed.

```css
/* ============================================================================
   RULING 54. The posts list rebuilt to docs/ADMIN-DESIGN.md, plus the two
   components the mentions page shares with it.

   Two radii and nothing else: --r-control on anything you press, --r-panel on
   anything that contains. Both are declared on .admin in admin-shell.css.
   ========================================================================= */
```

### app/styles/admin-posts.css:863 (WHY, shortened)

specificity reason kept.

```css
/* SPECIFICITY MATCHED TO THE REVEAL, deliberately. The bar's own rule earlier
   in this file is a bare `.posts-bulk` carrying `display: flex`, so a bare
   `.posts-bulk { display: none }` here wins only by source order, and source
   order in this repo is the cascade: moving one import would put the bar back
   on screen with nothing selected and nothing would report it. Both halves are
   scoped to the card, so the pair decides it between themselves. */
```

### app/styles/admin-posts.css:1004 (WHY, shortened)

trimmed.

```css
/* THE NO-SCRIPT STEP. `data-inline` is present on the server render and the
   effect removes it in the same pass that calls showModal(). A dialog with
   neither `open` nor this rule is display:none, which is exactly how a
   scriptless reader would lose the confirmation entirely. */
```

### app/styles/admin-posts.css:1059 (WHY, shortened)

trimmed.

```css
/* A DISABLED DANGER BUTTON KEEPS ITS FILL. Ruling 54: the reader has to see
   that the red button is the one they are being stopped from pressing, and a
   greyed outline reads as a different control. This overrides the shared
   0.55 disabled opacity for this one weight. */
```

## app/styles/admin-shell.css

### app/styles/admin-shell.css:1 (WHY, shortened)

cascade rule kept; split history moved.

```css
/*
 * The admin cockpit frame: sidebar, nav, badges, topbar, panels, and the origin-requests panel.
 *
 * Split out of app.css on 2026-08-21. It was 9,269 lines and every layout
 * defect this month lived in it. THE ORDER OF THESE FILES IS THE CASCADE:
 * app.css imports them in the order they were cut, which is the order they
 * sat in the original file, so a rule that won by source position still wins.
 * Moving an import, or moving a rule between files, can change what renders.
 */
```

### app/styles/admin-shell.css:13 (WHY, shortened)

the broken-transition prohibition kept; the dated measurement moved.

```css
/* `auto` and not the width itself. The width lives on .admin-sidebar, which
     the track then sizes to. Transitioning grid-template-columns directly was
     the obvious way and it is BROKEN: measured 2026-08-01, expanding from the
     rail left the computed template frozen at `60px 1220px` while the variable
     had already resolved to 15rem and the labels were back. `width` on a real
     element interpolates dependably; a track list built from a custom property
     does not. */
```

### app/styles/admin-shell.css:21 (WHY, shortened)

trimmed.

```css
/* A header row spanning both columns, then the body. The topbar used to sit
     inside .admin-main, which put it in the right column and made the mark's x
     a function of the sidebar's width. */
```

### app/styles/admin-shell.css:26 (WHY, shortened)

trimmed.

```css
/* The shell's three declared lengths. Scoped to .admin DELIBERATELY, not
     added to the token block, because check:contrast parses every custom
     property in that block as a colour and would throw on a length.

     --admin-topbar-h  the shell topbar. Ruling 8's offset at the narrow
                       breakpoint, where the document is the scrollport.
     --admin-cmdbar-h  the editor's command bar. The canvas subtracts it, so it
                       has to be a number rather than whatever the content
                       happened to make it.
     --admin-control-h ONE control height across the command bar, 32px. */
```

### app/styles/admin-shell.css:36 (NUMBER, shortened)

the measured header height derivation has no gate; the load-bearing note stays.

```css
/* 4.25rem, not the 4rem the ruling assumed, and the difference is measured
     rather than chosen. .site-header carries `min-height: 4rem`, but that
     minimum never binds: its nav controls are 36px tall, so with 1rem block
     padding the real header is 68.67px and the 32px mark centres at y=18.
     Matching the DECLARED minimum would have put the admin mark at y=16 and
     missed by 2px. 4.25rem is 68px, which centres a 32px mark at exactly 18.
     Load bearing: .editor-canvas subtracts it and the narrow breakpoint offsets
     .editor-bar by it, so both are re-measured as a regression. */
```

### app/styles/admin-shell.css:47 (WHY, shortened)

trimmed.

```css
/* The expanded width, 240px from the ruling. The collapsed one is no longer
     the ruling's 60px: the 2026-08-01 amendment DERIVES it from the inset, so
     the rail can hold the same icon column the expanded state indents to. It
     is applied by an attribute the inline script sets before first paint, so
     the rail never flashes wide and nothing is corrected after the fact. */
```

### app/styles/admin-shell.css:54 (WHY, shortened)

derivation kept; the before-state offsets moved.

```css
/* THE SHARED ICON COLUMN, and the reason it is this exact width.
   *
   * One column and one gap serve the topbar's brand block and every sidebar
   * item, so the mark and the nav icons stand in the same column and the
   * wordmark and the nav labels begin at the same x. Before this the sidebar
   * ran its own inset (10 + 3 + 10 = 23px) while the parity ruling had fixed
   * the mark at 32px, so the two columns missed each other by 9px.
   *
   * 1.44rem is the MARK'S OWN WIDTH and that is what makes the column work at
   * all. The header crop is intrinsically 36x50, so a 2rem-tall mark is
   * 2rem * 36/50 = 1.44rem wide. A wider column would centre the mark by
   * pushing its left edge off the inset; a narrower one would not fit the 20px
   * nav glyphs. Written as the arithmetic rather than as 1.44rem so the 36x50
   * stays visible next to it. */
```

### app/styles/admin-shell.css:74 (WHY, shortened)

trimmed.

```css
/* THE RAIL IS DERIVED, never a literal.
   *
   * inset + column + inset, so the collapsed rail centres the very column the
   * expanded one indents to, and the icons do not move sideways when the rail
   * closes. It resolves to 71.04px. Writing 71px here instead would be a number
   * that silently stops matching the inset the first time the inset is tuned,
   * and the failure would be a 0.5px drift nobody looks for. */
```

### app/styles/admin-shell.css:85 (WHY, shortened)

trimmed.

```css
/* THE TWO RADII, ruling 54, and there is no third.

     --r-control on anything you press: buttons, inputs, pills, menu items.
     --r-panel on anything that contains: panels, notices, dialogs, popovers.
     Scoped to .admin for the same reason the lengths above are, and stated
     here rather than per-component so a third value has nowhere to live.

     The 0.375rem that used to be scattered through this file was a sixth of a
     scale nobody had written down; check:admin-ui now refuses it. */
```

### app/styles/admin-shell.css:102 (WHY, shortened)

the no-transition rule and its circularity kept; the dated measurements moved.

```css
/* Ruling 6 asks that the width transition respect prefers-reduced-motion. There
   is NO width transition, which satisfies it the short way, and that is a
   correctness decision rather than laziness.
 *
 * Measured 2026-08-01, twice. Transitioning `grid-template-columns` left the
 * computed template frozen at `60px 1220px` after expanding, while the variable
 * had already resolved to 15rem and the labels were back. Moving the width onto
 * the sidebar and transitioning that failed the same way in the other
 * direction: computed width stuck at 240px with the variable resolved to
 * 3.75rem, and `getAnimations()` reporting nothing running, so the transition
 * had started, stalled, and left the element at its start value. Setting
 * `transition: none` at runtime snapped it to 60px, which is what identified
 * the cause.
 *
 * Both failures are the same circularity: the sidebar is a grid item in an
 * `auto` track, so the track sizes to the item while the item's width is being
 * animated. A rail that snaps is instant, correct, and cannot get stuck. What
 * still animates is the CHEVRON, a transform, which does not feed back into
 * layout. */
```

### app/styles/admin-shell.css:130 (WHY, shortened)

trimmed.

```css
/* No LEFT padding: the whole inset lives on the item, so the active rule can
     sit flush against the rail's edge. That is what the active item's
     `0 0.5rem 0.5rem 0` radius always described, and with a 10px gutter in
     front of it the shape read as a square-cornered chip floating in the
     column instead of a tab attached to it. */
```

### app/styles/admin-shell.css:136 (WHY, shortened)

trimmed.

```css
/* A SHADOW, for the reason the topbar's hairline is one: `box-sizing` is
     border-box, so a border-right would be subtracted from the width, and the
     collapsed rail's width IS the alignment. The rail is
     inset + column + inset, and a real border would eat a device-pixel-snapped
     slice off it and land the icon at 23.67 instead of 24. Out of the box, the
     content width is exactly what the token says. */
```

### app/styles/admin-shell.css:148 (WHY, shortened)

trimmed.

```css
/* The foot reads as a ZONE, not as two more sections.
 *
 * A hairline is enough to say it, so it is a hairline: both items already carry
 * the nav item's shape, and without a separator they simply extended the list
 * of places you can be with two things that are not places. --border, not
 * --border-strong: the sidebar is not an elevated surface, it is the shell, and
 * the elevated-surface law is about the popover step and pinned bars. */
```

### app/styles/admin-shell.css:164 (WHY, shortened)

trimmed.

```css
/* ONE item shape, and now it is the same shape the topbar's brand block uses.
   The nav links, View site and the collapse toggle all take it: a 44px target,
   the shared icon column, the shared gap, and a 14px label the rail hides.

   The inset is spent ENTIRELY as padding, and the active rule is drawn out of
   flow by the pseudo-element below. */
```

### app/styles/admin-shell.css:179 (WHY, shortened)

the border-or-alignment rule kept; the measurement moved.

```css
/* Measured 2026-08-01: this was briefly `calc(inset - rule)` over a real 3px
     border, and the icon column came out at 31.667 against the mark's 32.
     Chrome snaps a border to whole device pixels, so `3px` RENDERS 2.667 at
     dpr 1.5, and subtracting the DECLARED 3px from the padding cannot cancel a
     rendered 2.667. Same trap as the topbar hairline, one element down: a
     border may participate in an alignment or be a fixed length, not both. */
```

### app/styles/admin-shell.css:190 (WHY, shortened)

trimmed.

```css
/* The glyph is 20px but its BOX is the shared column, so it centres in the same
   column the mark does. The viewBox is square and the height is what binds, so
   `preserveAspectRatio` centres the 20px drawing inside the 23.04px box on its
   own; no wrapper element is needed to make a column out of it. */
```

### app/styles/admin-shell.css:206 (WHY, shortened)

trimmed; the mockup ratio moved.

```css
/* THE SECTION COUNT, and it is deliberately NOT a badge.
 *
 * A badge is an alarm; this is a size. It gets no fill, no pill and no warning
 * colour, only the right edge and a quieter grade of text, which is what the
 * mockup does and is why the two can sit on one row without the eye reading
 * both as problems. `--text-muted` clears the floor at 7.1:1; the mockup's
 * #a79c8a is 2.34:1 and does not ship here any more than it ships in the media
 * table.
 *
 * `margin-left: auto` puts it at the far edge, and the drift badge that may
 * follow it takes the same treatment it always had, so on the one item that can
 * carry both the count sits inboard of the alarm.
 *
 * TABULAR FIGURES, so a rail of counts lines up on the digit rather than
 * jittering between 9 and 31. */
```

### app/styles/admin-shell.css:235 (WHY, shortened)

trimmed.

```css
/* IN THE COLLAPSED RAIL THE COUNT GOES, and the badge stays.
 *
 * There is room for one numeral over a 20px glyph and the alarm is the one
 * worth keeping: a count with no label beside it is a number nobody can read
 * the unit of, which is the exact defect the badge's own accessible name was
 * written to avoid. The count survives as words in the item's aria-label, so
 * nothing is lost to a screen reader, and `title` carries it for a pointer. */
```

### app/styles/admin-shell.css:246 (WHY, shortened)

trimmed.

```css
/* Ask index drift, on the item that owns the repair.
 *
 * A FILL, per the binding rule that interactive semantics take fills and never
 * pastel text on the page. Warning rather than danger: a drifted index means
 * Ask is answering from a stale corpus, which is a degraded enhancement and not
 * a broken site, and this badge sits permanently in the furniture where danger
 * would cry wolf.
 *
 * The numeral is aria-hidden and the item's accessible name carries the count
 * in words, so nothing here has to be readable to be announced. */
```

### app/styles/admin-shell.css:270 (WHY, shortened)

trimmed.

```css
/* In the RAIL the badge stays, and stays a numeral.
 *
 * There is no label left to sit beside, so it anchors to the item's top right
 * and overlaps the icon's corner, which is the ordinary shape of a count on an
 * icon. Kept rather than dropped because the badge exists to pull the eye to
 * Posts from wherever you are, and the collapsed rail is exactly the state in
 * which the label that would otherwise say so is gone. Legibility is what the
 * `title` covers: it carries the same words the accessible name does. The item
 * is already the containing block, for the active rule. */
```

### app/styles/admin-shell.css:286 (WHY, shortened)

trimmed.

```css
/* THE COLLAPSED RAIL. Labels go, targets stay, icons centre. The accessible
   name is an aria-label on the element, so hiding the text costs nothing:
   `display: none` on a label that WAS the name would have made every item
   nameless. */
```

### app/styles/admin-shell.css:294 (WHY, shortened)

derivation reason kept; the amendment's before-state moved.

```css
/* THE RAIL KEEPS THE SHARED COLUMN. This is the 2026-08-01 amendment.
 *
 * The rail used to be 60px with its icons CENTRED, which put them at x 13.146
 * against the mark's 32: the topbar does not collapse, so a rail narrower than
 * inset + column + inset cannot hold the column the expanded state indents to,
 * and the icons jumped sideways every time the rail closed.
 *
 * The amendment moves the inset in to 1.5rem on both planes and sizes the rail
 * FROM it, so the same padding-left serves both states and centring is never
 * asked for. The symmetry Dustin asked to see is then a consequence rather than
 * a technique: the icon sits at the inset, and what is left to its right is the
 * rail less the inset less the column, which is the inset again.
 *
 * The padding is kept rather than zeroed for the same reason it is not
 * `justify-content: center`: centring derives the icon's x from the CONTENT
 * BOX, so the sidebar's right padding and its right border would both have to
 * be zero and stay zero for the number to hold. Positioning it from the left
 * edge depends on nothing but the inset. */
```

### app/styles/admin-shell.css:340 (WHY, shortened)

the override prohibition kept; measured offsets moved.

```css
/* Height only. The WIDTH is the shared column, inherited from .admin-nav-icon,
   which the chevron also carries: overriding it here is what left the toggle's
   glyph 18px wide and centred at 41 while every other item sat at 43.516.
   A little smaller than the nav glyphs on purpose, so the control reads as
   chrome rather than as a sixth section. */
```

### app/styles/admin-shell.css:361 (WHY, shortened)

specificity trap kept; the tally moved.

```css
/* THE IDENTITY BLOCK, at exactly .site-header-brand's treatment.
 *
 * The `:visited` selector is not decoration. `.admin-brand` alone is (0,1,0)
 * and the base `a:visited` is (0,1,1), so without it the wordmark turns claret
 * the moment /admin is in history, which for the person who runs this admin is
 * always. That is the THIRD time this defect has been found on this site: the
 * public wordmark, the New post button, and now here. Any identity element or
 * filled control worn by a Link needs the same treatment.
 *
 * Exempt from the underline rule for the same reason the public wordmark is:
 * an identity block is not a destination the reader has visited, it is who the
 * site is. */
```

### app/styles/admin-shell.css:377 (WHY, shortened)

the measured widths moved.

```css
/* THE FLEX ITEM, not just the text inside it. Measured: truncating
     `.admin-brand-name` alone MADE THE BAR WIDER, from a 519.77px floor to
     597.26px, because `white-space: nowrap` raises this element's own
     min-content from "Edwards" to the whole wordmark while `min-width: auto`
     still refuses to shrink past it. The declaration below is what lets the
     truncation actually take effect. */
```

### app/styles/admin-shell.css:384 (WHY, shortened)

trimmed.

```css
/* The SHARED gap, the same one every sidebar item uses, which is what puts
     the wordmark's left edge and the nav labels' left edge on the same x. It is
     still 0.5rem, the value .site-header-brand carries, so sharing it cost the
     public parity nothing. */
```

### app/styles/admin-shell.css:398 (WHY, shortened)

trimmed.

```css
/* Same height as .site-header-mark, and the same `display: block` plus
   `width: auto`, so the intrinsic 36x50 scales identically on both planes. The
   component is imported, not copied, so check:logo covers this instance;
   `.site-logo-brand` inside it is var(--brand) and needs no rule here. */
```

### app/styles/admin-shell.css:405 (WHY, shortened)

trimmed.

```css
/* The SHARED column, stated rather than left to `width: auto`. The token IS
     the mark's natural width (2rem * 36/50), so the rendered box is the same
     23.04px the public mark occupies and the parity measurement is unmoved;
     what changes is that the column is now declared in one place and the
     sidebar's icons read it too. */
```

### app/styles/admin-shell.css:441 (WHY, shortened)

trimmed.

```css
/* The rule itself, OUT OF FLOW, which is what lets every item spend its whole
   inset on padding and stand in the mark's column.

   It is a BORDER on an absolutely positioned box rather than a background bar,
   and that is the forced-colors half of ruling 5: forced-colors overrides
   `background`, so a painted bar would disappear in exactly the mode this
   channel exists for, while a border is re-coloured and survives. Nothing
   shifts when it lands, because an absolutely positioned box is not in the
   flow at all, which also retires the transparent border every item used to
   carry to reserve the space. */
```

### app/styles/admin-shell.css:458 (WHY, shortened)

trimmed.

```css
/* The nav item treatment, at the nav's own type size.
 *
 * `margin-top: auto` moved to the foot, which is the group that owns the push.
 * The underline goes for a reason the link rule already sanctions: this carries
 * a non-colour affordance of its own, the arrow leaving a box, and it now sits
 * in a list of undecorated items where an underline on one of them read as the
 * odd one out rather than as an affordance. The glyph is the signal that it
 * leaves the plane; the accessible name says so in words. */
```

### app/styles/admin-shell.css:494 (WHY, shortened)

ladder kept; the transparent-topbar history moved.

```css
/* Surface hierarchy in the cockpit.
 *
 * Three questions, three answers, out of the neutrals that already exist:
 *
 *   --surface  the SHELL. Sidebar and topbar together, one continuous L of
 *              chrome that frames the work rather than holding it.
 *   --bg       the CANVAS, inherited from body. What the shell wraps.
 *   --surface  again for a CARD, but sitting on the canvas behind a border.
 *
 * The sidebar and a card resolve to the same hex and never touch, so the
 * ladder still reads as chrome, canvas, raised without inventing a fourth
 * neutral. Rule 7 sanctions a card here without argument: it says cards are
 * for indexes, and the posts list is the only index this admin has.
 *
 * The topbar was transparent before this, so it read as canvas while the
 * sidebar read as chrome, and the shell had a seam down the middle of itself. */
```

### app/styles/admin-shell.css:519 (WHY, shortened)

trimmed.

```css
/* THE SHARED INSET, the same token .site-header and every sidebar item use,
     so the mark's LEFT edge is identical on both planes and in both sidebar
     states. The block padding is 0, so a centred 2rem mark sits at
     (68 - 32) / 2 = 18, which is where .site-header puts its own. */
```

### app/styles/admin-shell.css:524 (WHY, shortened)

trimmed.

```css
/* Ruling 8. On a desktop viewport this bar is ALREADY pinned structurally,
     because .admin-content is the scroll container and this sits outside it.
     `sticky` is here for the narrow breakpoint, where the shell releases its
     height and the document scrolls again; without it the topbar would scroll
     away on exactly the viewport where a fixed reference point is worth most.
     It costs nothing in the case that was already correct. */
```

### app/styles/admin-shell.css:533 (WHY, shortened)

shadow-not-border reason kept; the per-dpr measurements moved.

```css
/* Content scrolls beneath this edge, so it separates two live surfaces
     rather than dividing two static blocks. --border-strong, per the
     elevated-surface law.

     A SHADOW rather than a border, and that is load bearing for the parity this
     bar exists to hold. `box-sizing` is border-box, so a border-bottom is
     subtracted from the declared height: the content box became 68 minus the
     hairline and the centred mark fell to y=17.667. The public header has the
     same hairline and does NOT lose that height, because no height binds there
     and the border adds onto its natural box instead.

     Worse than the 0.333px, the miss was not even CONSTANT. Chrome snaps a
     hairline to a whole device pixel, so `1px` renders 1 at dpr 1, 0.667 at
     1.5 and 0.5 at 2, and a border-box height would have landed the mark at a
     different y on every display while matching on none of them.

     A shadow is outside the box entirely, so the bar stays exactly
     --admin-topbar-h, the mark centres at 18 at every dpr, and the token keeps
     telling .editor-canvas the truth about what to subtract. The line still
     draws over the content below, which is what a pinned bar wants. */
```

### app/styles/admin-shell.css:555 (WHY, shortened)

grid-level min-width rule kept; the deployed measurement moved.

```css
/* THE GRID ITEM, and without this every truncation below it is inert.
     MEASURED on the deployed build at 320: the bar rendered 376 wide with the
     wordmark at its full 120px and nothing shrinking, because a grid item's
     automatic minimum size is min-content. The bar's min-content sized the
     track, the track sized the document, and the flex layout INSIDE the bar
     was therefore never over-constrained: with no overflow to distribute,
     `flex-shrink` had nothing to do and `.admin-brand-name`'s ellipsis never
     engaged. The document grew instead, which is the same shape the comment on
     `.admin-brand` records one level down, at the flex level rather than this
     one. This is the grid-level statement of it. */
```

### app/styles/admin-shell.css:581 (WHY, shortened)

the yield order kept; overflow measurements moved.

```css
/* THE ADMIN PLANE SCROLLED SIDEWAYS BELOW 576px, AND THIS DECLARATION IS THE
     REPAIR. Measured before it: 23px of overflow at 553, 96 at 480, 176 at 400,
     256 at 320. Those are all the same number. 553 + 23, 480 + 96, 400 + 176
     and 320 + 256 are 576 four times, because the bar had a FIXED minimum
     content width and the viewport was simply narrower than it.

     `min-width: auto` is the flex default and resolves to min-content, so a
     flex item cannot shrink past the widest thing inside it however willing its
     `flex-shrink` is. The widest thing inside this one is the operator's email
     address, a single unbreakable token: measured at 199px, inside a block
     measured at 343px once the drawer toggle appears at the 800px breakpoint.
     So the bar could not compress and the document grew instead.

     Three elements yield now rather than one, which is what makes the repair
     hold instead of moving the failure 40px further down. The email truncates,
     the wordmark truncates, and the scope chip leaves at 576. What is left is
     the mark, the drawer toggle and Sign out, which are controls and stay
     whole. */
```

### app/styles/admin-shell.css:612 (WHY, shortened)

trimmed.

```css
/* The sign-out form is the flex ITEM wrapping the button, so this is where the
   button's refusal to shrink has to be declared.

   DIRECT CHILD since the account menu landed: the folded branch renders a
   second sign-out form inside the menu panel, which is not a flex item of this
   bar, and a descendant selector would reach in and declare `flex` on it for
   no reason. */
```

### app/styles/admin-shell.css:623 (WHY, shortened)

fold reason and headroom rule kept; floor measurements moved; restored after Grok review 89352d6.

```css
/* ------------------------------------------------------------------ THE FOLD

   THE ADMIN PLANE SCROLLED SIDEWAYS AT EVERY WIDTH BELOW 582px AND THIS IS THE
   REPAIR. The block above yields three elements and it was not enough: measured
   on the built page, the document floor was 582 UNIFORM across 553, 480, 400
   and 320, and the binding chain was `header.admin-topbar` over
   `.admin-topbar-user`, its form and `button.admin-signout`. Truncation cannot
   fix that, because what is left after the email has given up everything is two
   CONTROLS, and a control that shrinks past its own label is not a repair.

   So below the breakpoint the two of them LEAVE THE BAR and reappear inside the
   account menu, which is the existing overflow-menu component and not a new
   pattern. What stays in the bar is the mark, the truncatable wordmark, the
   drawer toggle and one menu button, all of which fit.

   ## WHY 640 AND NOT 582

   640px is the nearest breakpoint this repository already uses that sits ABOVE
   the measured floor (the others are 800 and 576, and 576 is BELOW 582, which
   is exactly why the earlier narrowing could not have closed this). Folding at
   the floor itself would put the layout's correctness on the exact pixel a
   measurement landed on, and that measurement is a function of a string: the
   floor is what it is because the operator's address is one unbreakable token.
   A longer address moves it. 58px of headroom is the margin that survives
   that, and the widths the browser gate asserts (553, 480, 400, 320) are all
   comfortably inside the folded branch. */
```

### app/styles/admin-shell.css:663 (WHY, shortened)

trimmed.

```css
/* AND THE BLOCK STOPS SHRINKING, which is the half the first fold missed.
     MEASURED at 320 with the fold live: the bar itself fitted at 320 and its
     account menu still ended at 325, because `min-width: 0` above lets this
     block shrink below its own contents and the two controls inside it simply
     spilled out of it. That declaration is right for the WIDE bar, where the
     email is the flexible thing inside; here there is no flexible thing left,
     only a toggle and a menu, and a control that has given up its label has
     given up its job. So the shrinking moves to the one element that can still
     do it honestly: the wordmark, which truncates with an ellipsis while the
     mark beside it keeps identifying the plane. */
```

### app/styles/admin-shell.css:706 (WHY, shortened)

trimmed.

```css
/* Sign out is a CONTROL, so its label does not wrap and does not truncate. A
     broken action label is worse than a narrower bar, and this is the one
     element in the topbar that performs something worth reading before
     pressing. Measured at 320: still 95px, still reading "Sign out".

     `white-space`, not `flex`. The flex ITEM here is the wrapping <form>, so a
     `flex` declaration on this button is inert; the form carries it instead,
     below. */
```

### app/styles/admin-shell.css:715 (WHY, shortened)

trimmed.

```css
/* THE SECONDARY WEIGHT, ruling 54. It carried its own border colour, radius
     and padding, which made it a fourth button shape in a system that has
     three. --border-strong rather than --border, because the topbar is a
     pinned surface and rule 5 governs what sits on one. */
```

### app/styles/admin-shell.css:736 (WHY, shortened)

the fix and its token derivation kept.

```css
/*
   * WCAG 2.2 2.4.11, focus not obscured (minimum).
   *
   * This element is the scrollport, and two bars sit sticky above content that
   * scrolls under them: the shell topbar at `--admin-topbar-h`, and the
   * editor's own command bar on the routes that have one. Tabbing to a control
   * just above the fold scrolls it into view flush with the top of the
   * scrollport, which is UNDER those bars: the focused element is on screen by
   * every geometric test and invisible to the person who focused it.
   *
   * `scroll-padding-top` is the whole fix. It tells the scrollport that the
   * first N pixels are spoken for, so every scroll-into-view, including the one
   * the browser performs for focus, stops short of them.
   *
   * DERIVED FROM THE TOKEN, never a literal. The topbar's height is
   * `--admin-topbar-h` and it is declared once; a number here would be a second
   * copy that goes stale the day the bar is resized, which is rule 17 in the
   * place it is least visible, since the symptom is a control that is merely
   * hard to see rather than a build that fails.
   *
   * The editor's command bar is INSIDE the scrollport and sticks at `top: 0`
   * relative to it, so it stacks below the topbar rather than adding to this
   * offset. The extra `1rem` is breathing room, not a second bar.
   */
```

### app/styles/admin-shell.css:761 (WHY, shortened)

the plane-wide containing-block rule kept; the media-library measurement moved.

```css
/* THE SCROLLER IS ALSO A CONTAINING BLOCK, which fixes the whole admin plane
     at one site rather than one control at a time.

     An absolutely positioned descendant with no positioned ancestor resolves
     against the INITIAL containing block: it is laid out in DOCUMENT
     coordinates and this element's overflow does not clip it. `.sr-only` is
     `position: absolute`, so every visually hidden label inside this scroller
     was a candidate. Measured on the media library: 24 of them dragged the
     document's scroll height to 1685px inside a 598px shell, which is a second
     scrollbar inside the page's own and a screen of dead space below the grid.
     That was repaired on the one button carrying them; this is the repair for
     the plane, so the next `.sr-only` to land in an admin scroller cannot do it
     again. */
```

### app/styles/admin-shell.css:782 (WHY, shortened)

trimmed.

```css
/* The editor is the one page that manages its own height, so the content well
   stops scrolling and stops padding, and hands both to the shell inside it.
   Selected with :has() rather than a route-level class, so the rule lives with
   the layout it describes and cannot be forgotten on a third editor route. */
```

### app/styles/admin-shell.css:814 (WHY, shortened)

trimmed.

```css
/* Ruling 8. The rail is a DESKTOP affordance; a 71px icon strip beside a
     phone-width column would leave the content nothing. Here the sidebar is an
     off-canvas drawer instead, opened from the topbar and dismissed by Escape
     or by the backdrop, and the collapsed attribute is ignored entirely. */
```

### app/styles/admin-shell.css:822 (WHY, shortened)

the placement rule and its mechanism kept; the blank-page measurement moved.

```css
/* **THE PLACEMENT HAS TO COME BACK WITH THE TRACK LIST, and its absence made
     every admin page blank on a phone.**

     `.admin-main` is placed at `grid-column: 2` for the desktop shell, where
     column 1 is the rail. This block collapses the template to a single `1fr`
     track and never reset that placement, so the main column was still asking
     for column 2, which does not exist. Grid does not clamp an out-of-range
     placement, it CREATES an implicit track, and implicit tracks are sized by
     `grid-auto-columns`, which defaults to `auto`.

     Measured at a 420px viewport before this line existed: the explicit `1fr`
     track took 399.78px and the implicit one took 4.88px, so `.admin-main` was
     4.88px wide, `.panel` was 0, the grid was 0, and the document grew to
     9757px as every word wrapped to one character. The header rendered because
     it spans `1 / -1`; everything below it was blank.

     Nothing could see it. `check:admin-ui` renders with NO stylesheet by
     design, no gate measures layout, and the desktop path is unaffected because
     there column 2 is real. It shipped on `0f2f638` and survived every window
     since. */
```

### app/styles/admin-shell.css:885 (WHY, shortened)

trimmed.

```css
/* THE RATIFIED SCRIM PATTERN, not a fourth literal. See
       .media-detail-scrim in admin-media.css for the measured grounds: an
       rgba token is unparseable to check:contrast, Lightning CSS rewrites it,
       and a translucent veil cannot honestly participate in a contrast pair.
       --scrim is the ratified dark neutral and nothing is drawn on this
       layer, so dimming the whole element is exactly what is wanted. */
```

### app/styles/admin-shell.css:920 (WHY, shortened)

the chip-leaves rule and nesting reason kept; the overflow arithmetic moved.

```css
/* 576px is MEASURED, not a framework number that happened to be nearby. The
     four recorded overflows were 23px at 553, 96 at 480, 176 at 400 and 256 at
     320, and every one of those pairs sums to 576: the topbar had a fixed
     minimum content width and 576 is it. So the chip leaves at exactly the
     width where the bar stops fitting, and not one pixel earlier.

     THE SCOPE CHIP IS THE ONLY THING IN THIS BAR THAT IS PURELY AMBIENT.
     "Private plane" repeats what the mark, the drawer and every page title
     already say, and it is the one element here that is neither an identity nor
     a control. Everything else yields by truncating, which keeps it on screen;
     this one leaves, because a chip reading "Priv..." is worse than no chip.

     Nested inside the 800px block rather than written at the top level, because
     it is a narrowing of that breakpoint and not an independent one: the drawer
     toggle it is making room for only exists in here.

     Not `visibility: hidden`, which reserves the box and is the whole problem. */
```

### app/styles/admin-shell.css:992 (WHY, shortened)

trimmed to three lines.

```css
/* Status dots carry a SHAPE as well as a fill, because a dot beside a number
   is otherwise colour on its own and rule 1 forbids that. Circle is healthy,
   ringed circle is degraded, square is failed. The word is in the adjacent
   visually hidden label, so the state reaches assistive tech too. */
```

### app/styles/admin-shell.css:1004 (WHY, shortened)

ratios are check:contrast's.

```css
/* Every dot is RINGED in its family's border token, not just the gold one.
   A fill alone does not reliably clear 3:1 against the page: measured, gold on
   caliche is 2.07:1 and dark crimson on prairie night is 2.49:1, so the fill is
   the identity and the ring is the boundary that makes it discernible. The
   border tokens are the ones the doc measured for exactly this, 3.4 to 4.9. */
```

### app/styles/admin-shell.css:1086 (WHY, shortened)

trimmed.

```css
/* -------------------------------------------------------------------------
 * The origin-requests panel.
 *
 * Tokens only, and no colour carries meaning on its own: the error is a
 * sentence, the bar is a magnitude that the adjacent number states in words.
 * ---------------------------------------------------------------------- */
```

### app/styles/admin-shell.css:1230 (WHY, shortened)

no-new-pair, prefers-contrast and focus rules kept; the redesign date moved.

```css
/* -------------------------------------------------------------------------
 * The webmention moderation queue, redesigned under ruling 21 on 2026-09-05.
 *
 * The block this replaces said LAYOUT ONLY and meant it: every colour came
 * from `.tool-list`, `.muted`, `.chip` and `.btn`, so the page added no token
 * pair for check:contrast to measure. That property is KEPT here, and it is
 * the reason the filter chips are built from the pairs the matrix already
 * carries rather than from a palette of their own:
 *
 *   resting chip   --text / --text-muted / --border  on --surface
 *   active chip    --brand                           on --tint-brand
 *   text button    --text-muted, then --text         on the canvas
 *
 * Every one of those is a row in check:contrast's transcribed list already, so
 * nothing below asks anybody to measure anything new.
 *
 * PREFERS-CONTRAST IS NOT HANDLED HERE, deliberately. --text-muted and
 * --border are the two tokens app.css promotes under prefers-contrast: more,
 * and they are the two this block leans on; a rule here would be a second
 * owner of a tier that already covers it.
 *
 * FOCUS IS NOT HANDLED HERE EITHER, for the same reason: app.css draws every
 * focus indicator as an OUTLINE on :focus-visible, which is what survives
 * forced-colors, and both new controls below inherit it.
 * ---------------------------------------------------------------------- */
```

### app/styles/admin-shell.css:1256 (WHY, shortened)

trimmed.

```css
/* Both feedback boxes carry `margin: 0`, which is right where they are used on
   the editor and left the chip row sitting flush against this one. The gap is
   declared once here rather than on either box, because which box renders is
   the action's decision and the spacing is the same either way. */
```

### app/styles/admin-shell.css:1264 (WHY, shortened)

trimmed.

```css
/* THE STATUS FILTER, and it is a row of LINKS rather than a control: every
   state is a URL, the page needs no script to change filters, and the browser
   history does what a reader expects. Same shape as the media library's lens
   row, which is the pattern this page was told to follow. */
```

### app/styles/admin-shell.css:1293 (WHY, shortened)

specificity trap kept.

```css
/* The (0,1,0) versus (0,1,1) trap admin-posts.css records for .btn, and it
   reaches every class worn by an anchor. a:visited at (0,1,1) outranks a
   class-only colour, so a chip whose destination is in history would be
   painted --visited on --surface, a pair the matrix does not carry. Naming the
   states puts these at (0,2,0) and the colour lands back on a measured pair. */
```

### app/styles/admin-shell.css:1309 (WHY, shortened)

trimmed.

```css
/* THREE CHANNELS for the current filter, which is ruling 5's shape and the one
   the admin nav already uses: a border, a surface, and the WEIGHT.
   forced-colors takes the tint and the hue and leaves the weight and the edge,
   so the active chip is still findable there, and aria-current carries it to
   assistive tech in every mode. */
```

### app/styles/admin-shell.css:1378 (WHY, shortened)

trimmed.

```css
/* A stranger's URL, which can be arbitrarily long and carries no spaces.
   `anywhere` rather than `break-all` so an ordinary URL still breaks at its
   slashes and only a pathological one is broken mid-token.

   MONOSPACE because it is a string to compare character by character, not
   prose, and the reader's only use for it is checking it against somewhere
   else. Still not a link, which is the row's oldest rule. */
```

### app/styles/admin-shell.css:1426 (WHY, shortened)

the ordering constraint kept.

```css
/* REJECT IS THE SECONDARY, and .btn-ghost is already exactly that: a border
   and body text where .btn is a brand fill. Only the geometry is brought into
   line with the primary beside it, because the ghost's own metrics were set
   for a standalone control with a margin above it. This has to come after
   .tool-row .btn-ghost above, which is the same specificity and would
   otherwise win on the font size. */
```

### app/styles/admin-shell.css:1446 (WHY, shortened)

trimmed.

```css
/* THE THIRD WEIGHT, which the admin plane did not have as a shared class.
   .btn is the brand fill and .btn-ghost is the bordered secondary; the only
   text-weight control in the repo was .md-tool-text, scoped to the markdown
   toolbar. This is that treatment given a name, so Delete can sit on a row it
   is not the point of.

   Sized to 1.75rem for the same 24px target reason the chips are, and its
   resting edge is a TRANSPARENT border so the hover does not move anything. */
```

### app/styles/admin-shell.css:1500 (WHY, shortened)

the stacking reason kept; the dated measurement moved.

```css
/*
 * THE ROW STACKS ON A PHONE, and this is a MEASURED repair rather than a
 * precaution.
 *
 * `.tool-row` is a flex row that does not wrap, and `.mention-actions` above
 * declares `flex-shrink: 0` on purpose, so the action column keeps its
 * max-content width and the text side absorbs the whole squeeze. With three
 * controls and a clause under Approve that width is about 330px, which is more
 * than the entire content column has at 375: measured 2026-09-05 in a real
 * browser at the width the admin canvas actually gives this route,
 * `.mention-actions`, `.mention-delete` and `.btn-text` all crossed the right
 * edge, at both themes, on every state rendered.
 *
 * 640px is this stylesheet's existing narrow breakpoint, not a new one. It is
 * below the 800px at which the sidebar becomes a bar above the content, so
 * everything here is about a column that already has the full viewport.
 *
 * DELETE GOES TO THE FAR EDGE once the actions have a row of their own, which
 * is where ruling 21d wanted it and where the wide layout could only approximate
 * it with a margin.
 */
```

### app/styles/admin-shell.css:1544 (WHY, shortened)

trimmed.

```css
/*
   * .btn-text gets its shape from a background and a transparent border, and
   * this mode replaces the background and does not reliably re-colour a
   * transparent border. A transparent OUTLINE is the technique app.css uses
   * for every other control whose shape came from a fill, and it is resolved
   * to a system colour here, so the button keeps an edge.
   */
```

### app/styles/admin-shell.css:1555 (WHY, shortened)

trimmed.

```css
/*
   * The active chip's tint and hue are both gone in this mode. The weight
   * above survives on its own, and the edge is restated in currentColor so the
   * chosen filter is still the one with a visible boundary.
   */
```

### app/styles/admin-shell.css:1565 (WHY, shortened)

trimmed.

```css
/* ============================================================================
   RULING 54. The page shell every admin page opens with, the one notice
   pattern, and the overview's table and figures.

   These live in the SHELL sheet rather than beside the posts list because the
   page head and the notice are the shell's job: every admin page opens with a
   title and one status sentence, and a notice looks the same wherever it lands.
   ========================================================================= */
```

### app/styles/admin-shell.css:1596 (WHY, shortened)

trimmed.

```css
/* THE EDGE IS THE VARIANT, NEVER THE FILL. A tinted notice competes with the
   page for attention on every load and spends the one-tint-per-view budget
   (rule 4) on something that is usually not the most important thing on
   screen. A 4px edge in the semantic colour reads instantly, survives
   forced-colors because it is a border rather than a background, and leaves
   the tint free for the surface that actually needs it. */
```

## app/styles/blog-index.css

### app/styles/blog-index.css:52 (WHY, shortened)

the no-opacity rule kept; the old declaration moved.

```css
/* A token, not an opacity. It was `color: inherit; opacity: 0.7`.
   On the filled current chip that put `--on-brand` over `--brand` at 70%
   opacity, a composite the ratified pair was never measured at. And
   check:contrast cannot see it: it reads token hexes and opacity is applied
   afterwards, so any opacity on text hides a failing pair behind a passing
   one.
   So the count takes `--text-muted`, measured against the chip surface, and
   on the current chip inherits `--on-brand` at full strength, the ratified
   pair. */
```

### app/styles/blog-index.css:126 (WHY, shortened)

measured sizes moved; the method and exception scope kept.

```css
/* WCAG 2.2 2.5.8, target size (minimum). Measured at 39x23 and 33x23 for
   "Older" and "Newer" against a 24px floor: the height was 23px because a
   bare inline anchor's box is its line box, and a pixel is not a rounding
   artefact when the floor is 24 with no tolerance.
   `inline-flex` with a min-height, not padding, so the target grows around
   the text and the pagination's `align-items: center` keeps both links on one
   centreline.
   The inline-target exception does not apply: it covers links inside a
   sentence, and these sit alone in a nav. */
```

## app/styles/blog-search.css

### app/styles/blog-search.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/blog-search.css:6 (WHY, shortened)

the mirror admission kept; measurements moved.

```css
/* The same column as everything around it. Measured at 1280: this form was
   1216px wide from x=32 while `.page-head`, `.tag-chips` and `.post-list`
   were each 768px from x=256, so the search field was the only full-bleed
   element on the page.
   This restates the siblings' `max-width: 48rem; margin: 0 auto`, a mirror of
   a value this repo normally refuses; the real fix is a shared class across
   all four, a refactor of an 8,700-line stylesheet. There are now four
   places, not three. */
```

## app/styles/chrome-nav.css

### app/styles/chrome-nav.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/chrome-nav.css:7 (WHY, shortened)

trimmed.

```css
/* One row, one centreline, one control height. Every item on the row gets
   --control-h explicitly, so the row's height no longer depends on whichever
   item is tallest.
   --control-h is declared here rather than in the token blocks because only
   these three controls share it and check:contrast parses :root for colour
   tokens. */
```

### app/styles/chrome-nav.css:25 (WHY, shortened)

specificity and no-visited rules kept; the proof note moved.

```css
/* Amended rule 2: nav links are bare text, so they underline. The base `a`
   rule does that and this only sets the colour; the icon search control opts
   out on its own rule. v4 keeps the underline.
   v4 also gives nav links no :visited state: wayfinding is not a trail
   marker. `.site-header-nav a:visited` is (0,2,1) against the base
   `a:visited` at (0,1,1), so this wins rather than tying, which only shows
   once /blog is in history. Proved with / and /blog in the browser history. */
```

### app/styles/chrome-nav.css:37 (WHY, shortened)

trimmed.

```css
/* The text link gets the same hit area as the controls, so its baseline lands
   on their centreline. Centring the text in a fixed-height box keeps the
   underline still. `:not()` because the search control is also an anchor here
   and sizes itself. */
```

### app/styles/chrome-nav.css:52 (WHY, shortened)

the unmeasured-pair rule kept; the pressed-state date moved.

```css
/* The two pill controls borrow the chrome's own three values. Against purple,
   --border and --text-muted vanish and the --tint-brand hover fill is either
   invisible (in light it is --on-chrome-muted) or a dark patch, so no
   unmeasured pair enters.
   Hover is a colour step rather than a fill: since 2026-08-29 there is no
   pressed state, nothing in the header is filled, and one filled control
   would be the loudest thing on the row. */
```

### app/styles/chrome-nav.css:76 (WHY, shortened)

the one-visible-button mechanism and specificity kept; the order history moved.

```css
/* Theme toggle. One button since 2026-08-29, ordered by Dustin.
   Two buttons ship and exactly one is displayed. The hidden one is `display:
   none`, so a screen reader finds one button, not two, and it names the
   action it will perform.
   With no explicit choice, `prefers-color-scheme` picks with no script, so
   the visible button is the one the no-script form submits and the server
   never has to guess.
   With an explicit choice, `html[data-theme]` picks, and it must outrank the
   media query so a reader who chose dark on a light machine sees the dark
   control. It does, (0,3,1) against (0,2,0), so the media query needs no
   `:not()`.
   Script only sets or removes that attribute and the control follows by
   cascade, so no icon is swapped in JavaScript.
   No transition: a theme flip repaints every surface at once, so it is
   immediate and there is nothing for prefers-reduced-motion to undo. */
```

## app/styles/katex-overrides.css

### app/styles/katex-overrides.css:1 (WHY, shortened)

the two-owner split, the build requirement and the no-colour rule kept.

```css
/*
 * The site's half of the math stylesheet. HAND WRITTEN, and appended to the
 * derived upstream CSS by `scripts/build-katex.mjs`.
 *
 * Two files rather than one so each has an owner: everything above the marker
 * in `katex.generated.css` comes from the katex package and is replaced whole
 * on a version bump, and everything here is a decision this repo made. Editing
 * this file without running `npm run build:katex` is a named `check:content`
 * failure, because the generated artifact is byte-compared.
 *
 * IT SHIPS ONLY WITH THE MATH STYLESHEET, which is the point. A post with no
 * math links neither file, so these rules cost a mathless reader nothing. That
 * is why they are not in `prose.css`, where they would ride on all twelve posts
 * to serve one.
 *
 * NOTHING HERE SETS A COLOUR, and that is deliberate rather than unfinished.
 * KaTeX draws glyphs as text and rules as borders, and its SVG delimiters
 * declare `fill: currentColor; stroke: currentColor`, so every mark takes the
 * colour `.prose` is already painting. Both themes and forced-colors follow for
 * free, and a hardcoded value here would be the one thing that broke them.
 */
```

### app/styles/katex-overrides.css:23 (WHY, shortened)

scroll, overflow-y, focus and margin whys kept.

```css
/*
 * DISPLAY MATH SCROLLS INSIDE ITSELF.
 *
 * KaTeX's own `.katex-display > .katex` sets `white-space: nowrap`, so a long
 * equation is wider than the 44rem column BY CONSTRUCTION rather than as an
 * edge case, and without this the whole document scrolls sideways on a phone.
 * Same repair, same reason, as `.prose pre`, which has had `overflow-x: auto`
 * since the first code block.
 *
 * `overflow-y: hidden` is what keeps the box from growing a second scrollbar it
 * has nothing to scroll, and the padding is what stops that hidden axis
 * clipping a subscript on the bottom row.
 *
 * NOT FOCUSABLE, and the omission is consistent rather than overlooked: this
 * site's other scrollable region, `.prose pre`, carries no `tabindex` either.
 * A keyboard user reaches both the same way. Changing that is a decision about
 * both, in one commit, not a difference introduced here.
 *
 * The margin comes with it: upstream is `1em 0`, measured in the 1.21em math
 * font and therefore wider than every other block in the column. Matched to
 * `.prose pre` so an equation sits in the prose rhythm rather than above it.
 */
```

## app/styles/motion-print.css

### app/styles/motion-print.css:21 (WHY, shortened)

trimmed.

```css
/* The print rule colour, declared here only: a mid grey that reads on
     paper. It is not a theme token and must not become one, because
     check:contrast requires every theme token to sit in a measured screen
     pair and this colour only exists on paper. Scoping it to print keeps it
     out of screen rules. */
```

### app/styles/motion-print.css:90 (NUMBER, shortened)

frame counts and durations are a dated measurement; check:browser asserts the null viewTransition; restored after Grok review 89352d6.

```css
/* The public plane opts out of cross-document view transitions. Measured on
   production, `/` to `/blog`, three runs per cell, both themes: with the
   transition on, 12 to 14 intermediate frames matched neither page, lasting
   214-220 ms dark and 245-259 ms light, 33 to 66 times the noise floor; under
   reduced motion, two frames after the click with no intermediate state; with
   it off, one frame after the click with no intermediate state. That is
   Chrome's default crossfade showing both pages stacked on every header
   click.
   There is no reduced-motion block: with the transition off for everyone it
   has nothing to do. The old one skipped the fade but left the transition on,
   so readers with reduced motion were the only ones not seeing the blink.
   Chrome's paint holding replaces it: the old page stays until the new one's
   first contentful paint. check:browser asserts that `pagereveal` fires with
   a null `viewTransition`. */
```

## app/styles/page-shell.css

### app/styles/page-shell.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/page-shell.css:42 (WHY, shortened)

trimmed.

```css
/* The shell owns the viewport so the editor can own one scroll context: a
   command bar that stays put over a canvas that scrolls. A body scrolling
   behind both would be the double-scroll the spec forbids. Ordinary pages are
   unaffected: .admin-content scrolls instead of the body. */
```

## app/styles/palette-dialog.css

### app/styles/palette-dialog.css:16 (WHY, shortened)

history of two spellings moved.

```css
/* The ratified scrim. This site and the admin drawer backdrop once wrote it
     as `45%` and `0.45`, which is how one role ends up with two owners that
     agree by luck. */
```

### app/styles/palette-dialog.css:55 (WHY, shortened)

trimmed.

```css
/* 2.4.7 is not satisfied by removing the indicator. The input takes focus as
   soon as the palette opens, so without a ring a keyboard reader cannot tell
   where focus went.
   `:focus-visible`, not `:focus`, so a pointer user does not get a ring they
   did not ask for. The token is the on-surface ring the elevated chrome uses,
   not a new colour, so it stays inside what the contrast gate reads. */
```

## app/styles/playground.css

### app/styles/playground.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/playground.css:3 (WHY, shortened)

trimmed.

```css
/* /playground. Each demo's controls and result sit on `--surface` while the
   prose stays on the canvas, which is binding rule 7 read correctly: the
   surfaces are interruptions, like code blocks in an article.
   No colour carries meaning alone (rule 1): pass and fail are words, and the
   error block is a word plus a border. */
```

### app/styles/playground.css:211 (NUMBER, shortened)

the overflow measurement has no gate; the why stays.

```css
/* Tightened from 0.75rem: at the 48rem measure the six columns overflowed
     by 26px and clipped the fused total, the one number the table exists to
     show. It still scrolls if a title forces it to. */
```

## app/styles/post-enhancements.css

### app/styles/post-enhancements.css:40 (WHY, shortened)

trimmed; the audit tier note moved.

```css
/* Code block furniture. The label and button are script-added, so their room
   is reserved conditionally; unconditionally, a reader with no script got
   2.25rem of empty space above every fence for a button that could never
   arrive (audit tier 3).
   `scripting: enabled` reserves it at first paint where supported, so nothing
   moves. `[data-enhanced]`, set by the enhancement when it appends the
   furniture, covers a browser that runs script but does not know that media
   feature, at the cost of one small shift.
   With no script neither matches and there is no gap. `position: relative`
   stays unconditional; it reserves nothing. */
```

### app/styles/post-enhancements.css:93 (WHY, shortened)

trimmed.

```css
/* Line highlighting from the pipeline. The band is a neutral surface, not a
   brand tint, because syntax tokens are verified for contrast only against
   the code surfaces; check:contrast holds every token to 4.5:1 against both
   --surface-code and --surface-popover. The brand shows as the left bar,
   where no text sits. */
```

### app/styles/post-enhancements.css:132 (WHY, shortened)

top-layer reason kept; the date moved.

```css
/* A native <dialog> since 2026-08-28. `position: fixed` and `z-index` are
   gone: a modal dialog is in the top layer, above every stacking context,
   which a z-index race can never win reliably. The scrim is `::backdrop`, so
   the dialog sizes to its content while the scrim covers the viewport. The
   palette's dialog works the same way. */
```

### app/styles/post-enhancements.css:163 (WHY, shortened)

trimmed.

```css
/* The close button: Escape and a backdrop click both work but neither is
   discoverable. It is positioned against the dialog, which is why the dialog
   keeps `overflow: visible`. It takes `--border-strong` per hard rule 5,
   because `--border` does not hold on elevated furniture over a scrim. */
```

### app/styles/post-enhancements.css:214 (WHY, shortened)

trimmed.

```css
/* Further reading, related, and mentions. Mentions joins these selectors
   rather than copying their spacing, so the shared rhythm has one owner.
   Its own rules add only what a citation list needs and further reading does
   not: a gap between entries, which run to three lines, and no bullet, since
   the author's name is the marker. No new colour token. */
```

## app/styles/post-shell.css

### app/styles/post-shell.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/post-shell.css:46 (WHY, shortened)

measured sizes and audit note moved.

```css
/* WCAG 2.2 2.5.8. Measured at 497.6 x 22.5 and 493.9 x 22.5: wide links a
   pixel and a half short in height, because a bare anchor's box is its line
   box.
   The audit's list did not name these; they were found by measuring every
   target on a post, since the list is not the instrument. */
```

## app/styles/projects.css

### app/styles/projects.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/projects.css:3 (WHY, shortened)

the start-alignment reason kept; the ruling date moved.

```css
/* Projects index: cards on the canvas, which binding rule 7 permits for an
   index. The metric leads each card, above the name: a number before a claim.
   `auto-fit` with a minimum, so the grid collapses to one column at narrow
   widths with no breakpoint and no JavaScript.
   A card ends where its content ends (since 2026-08-30, Dustin's call from
   screenshots): stretching every card to the tallest left roughly four
   hundred pixels of empty card under short ones. `start` moves that space
   below the card. The foot blocks' auto margins are not dead: they still
   order the links above the evidence and act on rows of similar length. */
```

### app/styles/projects.css:80 (WHY, shortened)

trimmed.

```css
/* What is technically notable: prose inside a card, so it takes the card's
   muted body colour and the same measure as the description. No marker or
   indent: these are three sentences, not an enumeration, and a bullet would
   promise an order the list does not have. */
```

### app/styles/projects.css:150 (WHY, shortened)

trimmed.

```css
/* Pushed to the card's foot. `auto` on the top margin only works on the last
   flex child, so the evidence block takes it when present and this keeps it
   otherwise. With the grid on `align-items: start` there is usually no slack
   to consume, but it still orders the two foot blocks and still works on rows
   of similar length. */
```

## app/styles/prose.css

### app/styles/prose.css:55 (WHY, shortened)

trimmed.

```css
/* The low-quality placeholder behind a prose image. The pipeline
   (pipeline.mjs, rehypeImageSources) writes `class="has-lqip"` and an inline
   `background-image` holding a twenty-pixel WebP; only the per-image URL is
   inline and everything shared is here, as the no-inline-style rule asks.
   `cover` and `center` crop the blurred wash the way the image will be
   cropped.
   No transition and no cleanup: the loaded image is opaque and covers it. A
   transparent image would show the wash through; exclude it at derivation
   instead of adding script.
   `width` and `height` are always on the image, so the box is at its final
   size before anything paints. */
```

### app/styles/prose.css:72 (WHY, shortened)

trimmed.

```css
/* Every body image links to its original file (pipeline.mjs,
   rehypeImageSources).
   Rule 2's underline exemption applies, as it does for `.btn` and
   `.search-chip`: the affordance is not colour, since the whole content is an
   image, and an underline would just draw a line under the picture.
   The cursor is on the anchor because it is the click target and works with
   script off; without the lightbox the click opens the original, so `zoom-in`
   is honest either way. */
```

### app/styles/prose.css:100 (WHY, shortened)

the no-opacity rule kept; the dated composite ratios moved.

```css
/* No opacity on this text. Measured 2026-08-21: at `opacity: 0.8` the
   inherited `--text-muted` composites against `--bg` to #7c736a in light
   mode, 4.35:1, below the 4.5 AA floor; check:contrast saw only the declared
   7.13:1 because opacity is applied after it reads token hexes. Dark was
   5.41:1.
   Size already separates the credit from the caption (0.8125rem against
   0.875rem). `.tag-count` had the same fix, from opacity 0.7 to a token. */
```

### app/styles/prose.css:113 (WHY, shortened)

trimmed.

```css
/* Charts. The renderer strips the <style> block Observable Plot injects into
   each SVG: it carried `--plot-background: white`, the one colour literal
   breaking the tokens-only rule, and N charts would ship N copies. These
   rules replace it once.
   The SVG has `fill="currentColor"`, so axes and labels inherit --text.
   Series colours are var(--chart-*) properties written in at build time and
   resolved per theme, so one stored SVG serves light and dark. */
```

### app/styles/prose.css:158 (WHY, shortened)

trimmed.

```css
/* Diagrams are build-time assets in <img>, not inline SVG, because mermaid
   needs a real browser engine for font metrics and a Worker has none (Capsid
   `dustinedwards/chart-stack.md`).
   There are two images because the page's custom properties never reach an
   SVG loaded through <img>, so each theme gets its own render and these rules
   pick one.
   `display: none`, not opacity or visibility, because only it also removes
   the hidden image from the accessibility tree, so both share one alt without
   a screen reader reading the diagram twice.
   The selectors follow the site's theme resolution: light by default, dark
   under a dark OS preference with no attribute, dark when chosen. The server
   writes the attribute in the first byte, so the right image shows before
   paint. */
```

### app/styles/prose.css:230 (WHY, shortened)

the anywhere-not-break-word rule kept; the CI finding moved.

```css
/* Inline code may break, because its contents (file paths, gate names) are
     single unbreakable tokens. The CI browser run on Linux found /colophon
     scrolling sideways by 2px at 320px: the fallback monospace is a different
     width on each platform.
     `anywhere`, not `break-word`, because only `anywhere` also lowers
     min-content, which stops a long token widening its container past the
     viewport. It breaks only when it must, so short spans are unchanged. */
```

### app/styles/prose.css:240 (WHY, shortened)

trimmed.

```css
/* The colour swatch from the `:swatch` directive.
   The label is not styled here, deliberately: `.swatch-label` is a real
   `<code>` inside a `<span>`, so the inline-code rule above already gives it
   surface, padding, radius and `overflow-wrap: anywhere`. A second
   declaration would drift.
   No per-theme block either: the border is `--border`, measured in every
   theme block, and the fill is the post's own hex on the element. */
```

### app/styles/prose.css:273 (WHY, shortened)

trimmed.

```css
/* The chip is flattened in forced-colors, and that is intended: the mode
     replaces every background, and the ratified v3 policy is that the palette
     yields to system colours. `forced-color-adjust: none` would override that
     and is deliberately not used.
     The value survives as text in the code span beside the chip, not a
     `title` or tooltip, so the reader loses the sample and keeps the hex.
     The border is repainted in CanvasText so the chip keeps its shape. */
```

### app/styles/prose.css:309 (WHY, shortened)

trimmed.

```css
/* `.sr-only` lives only in reset.css. A second copy here won on cascade
   order, which stopped being reliable once prose.css was no longer on every
   page, so one class would have behaved differently with and without prose.
   One owner, rule 17. */
```

### app/styles/prose.css:316 (WHY, shortened)

measured size moved.

```css
/* WCAG 2.2 2.5.8 as well as 1.4.3. Measured at 14.8 x 29 against a 24px
   floor: the width was short and the height never was.
   `inline-flex` with a min-width, not padding, because padding would push the
   anchor away from its heading; the heading's line box already gives the
   height. */
```

### app/styles/prose.css:330 (WHY, shortened)

the no-partial-opacity rule kept; the old values and date moved.

```css
/* The reveal is scoped to pointers that can hover (since 2026-08-28), so the
   touch path has no opacity.
   It was `opacity: 0` with a `hover: none` override to 0.55. A partial
   opacity composites after check:contrast measures: `--text-muted` passes and
   0.55 of it does not, and no gate sees it.
   Inside the query the values are 0 then 1, a reveal rather than a shade, so
   nothing paints at an unmeasured contrast. On touch the anchor is plain
   `--text-muted` at full strength.
   `focus-visible` sits inside the query safely: outside it the anchor is
   already fully visible. */
```

### app/styles/prose.css:353 (WHY, shortened)

trimmed.

```css
/* Shiki dual themes: the generator emits both palettes as custom properties
   on every token, so switching needs no script and no second stylesheet.
   The theme's own background is dropped: github-dark's blue-black #24292e
   fights the warm prairie night, and a block with its own surface would be
   the one rectangle the token system does not own. Blocks sit on
   --surface-code, and check:contrast holds every syntax token to 4.5:1
   against --surface-code and --surface-popover (the highlighted-line band) in
   both modes.
   Resolution mirrors the token block: with no attribute
   :root:not([data-theme]) answers, and with one only the attribute rules
   match, so no [data-theme="light"] override is needed. */
```

### app/styles/prose.css:376 (WHY, shortened)

trimmed.

```css
/* Some theme rules pair a foreground with their own background: the diff
   scopes (markup.inserted, markup.deleted, markup.changed, markup.ignored)
   and carriage-return. Those foregrounds are only legible on that background,
   so those spans keep it. The attribute test matters: custom properties
   inherit, so a blanket rule would paint every token with the pre's value. */
```

## app/styles/public-chrome.css

### app/styles/public-chrome.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/public-chrome.css:3 (WHY, shortened)

seam and scope rules kept; the provisional-review provenance and ratios moved.

```css
/* Public header. v4 (provisional, chrome-purple-v4.md): the chrome is a brand
   surface in both themes, because nav links at --text-muted #5c5248 read
   green beside the purple wordmark.
   The seam takes --border-strong, not --border: in dark mode the
   chrome-to-canvas step is 1.4:1. That is not a failure, since seams need no
   3:1, but it needs a visible edge.
   Public plane only; the admin chrome is not covered. */
```

### app/styles/public-chrome.css:10 (WHY, shortened)

the wrap rule on both elements kept; the overflow measurement moved.

```css
/* The header wraps, because when it did not, every public page scrolled
   sideways on a phone. Measured at a 320px viewport: `.site-header-nav` was
   414px wide with its right edge at 552, so scrollWidth was 552 against a
   clientWidth of 320.
   `flex-wrap` is on both. On the nav alone the brand and nav still share one
   line and the nav's wrap point never arrives; on the header alone the nav
   stays a 414px unbreakable row.
   No media query: wrapping holds at 320, at 280, and after another link is
   added. */
```

### app/styles/public-chrome.css:40 (WHY, shortened)

the identity exemption, specificity and the do-not-simplify prohibition kept verbatim; ruling date and ratios moved; restored after Grok review 89352d6.

```css
/* Rule 2 identity exemption, extended by Dustin's ruling 2026-07-30: an
   identity element must not take :visited styling.
   `.site-header-brand` is (0,1,0) and the base `a:visited` is (0,1,1), so
   without these rules the base wins and the wordmark turns visited claret for
   any returning reader. The site's name is not a place the reader has been.
   v4: the wordmark takes --on-chrome, the ratified white-on-brand pair
   (10.4:1 light, 10.1:1 dark). Hover steps down to --on-chrome-muted because
   rest is already the lightest measured value here.
   The `:visited` and `:hover` selectors are (0,2,0) and outrank the base
   pseudo-class rules deliberately. Do not "simplify" them away.
   No colour pseudo-class reaches the mark; it takes the dark-mode variant on
   chrome in both themes, which is a fill. */
```

## app/styles/publications.css

### app/styles/publications.css:1 (WHY, shortened)

the separate-sheet reason kept; the restore provenance moved.

```css
/* The publications index and per-paper pages, restored 2026-09-12 from
   `app/app.css` at `a04f922`, before PR #3 retired the academic routes. A
   separate sheet because page styles left app.css on 2026-08-27; putting 200
   lines back would undo that.
   The token names are not the ones this CSS was written against: the Hill
   Country system landed at `081ddb2`, so colours were re-pointed (`--fg` to
   `--text`, `--muted` to `--text-muted`, `--brand-fg` to `--on-brand`, `--ok`
   to the success pair). A literal restore would have compiled and painted
   inherited colours with nothing failing.
   `.research-heading` is not here: `/research` does not exist, so the rule it
   shared with `.pub-year-heading` is now one selector. */
```

### app/styles/publications.css:57 (WHY, shortened)

trimmed.

```css
/* Not `opacity`. The original dimmed the count with `opacity: 0.75`, and
     check:contrast never sees an alpha applied after the declared pair;
     core.md lists that gap, so this does not add to it. The count uses the
     chip's own colour, a measured pair. */
```

### app/styles/publications.css:207 (WHY, shortened)

date moved.

```css
/* One paper's page, added 2026-09-12 with `/publications/<slug>/`. It reuses
   `.pub-badge`, `.pub-links`, `.pub-chip` and `.pub-author-me`: the two pages
   show the same facts at different densities, and a second set of names would
   drift. */
```

### app/styles/publications.css:218 (WHY, shortened)

the corpus figure moved.

```css
/* Smaller than other page titles on purpose: a paper title is a sentence,
     up to 150 characters here, which is four lines at page-title size. */
```

### app/styles/publications.css:285 (WHY, shortened)

the entry count moved.

```css
/* Who cites this paper. A list of sentences, so it reads rather than tabulates:
   each entry is a title, a venue and a year, and the longest here runs to 50
   entries. Numbered because the order is meaningful (newest first). */
```

### app/styles/publications.css:340 (WHY, shortened)

the tense-bound state claim removed.

```css
/* A retraction, correction or expression of concern. Tinted, unlike
   .paper-summary, because this is the publisher contradicting the document
   and must be seen before the abstract.
   It uses the warning trio (--tint-warning, --on-tint-warning,
   --border-warning), already a measured contrast pair in both themes, so no
   new colour needs checking. No record carries a notice today; the styling
   ships with the path. */
```

## app/styles/reset.css

### app/styles/reset.css:1 (WHY, shortened)

the reset's role and the @layer prohibition kept (Grok's restored point); vendoring census moved.

```css
/* The base reset, vendored from Tailwind's preflight on 2026-08-27 when
   Tailwind left the build.
   It is not leftover nobody bothered to delete: this site has no reset of its
   own and never has, and removing it moved 5,700 computed values across nine
   pages, including every element's font. Of Tailwind's 8,356 bytes (8 KB of a
   45 KB stylesheet), 3,048 were utilities of which the HTML used only
   `.sr-only`, and about 1,150 were a polyfill for utilities the site never
   asked for; both are gone.
   Changes from the original, exhaustively: (1)
   `--theme(--default-font-family, ...)` and
   `--theme(--default-mono-font-family, ...)` become `var(--font-sans)` and
   `var(--font-mono)`; (2) the `font-feature-settings` and
   `font-variation-settings` lines that resolved to `normal` are dropped; (3)
   the `@layer base` wrapper is gone, and must stay gone: nothing else here is
   layered, so the wrapper would only change which rules win. Nothing else is
   edited, because a reset is a list of known browser bugs.
   Imported at the top of app.css, where `@import "tailwindcss"` sat, so the
   site's own rules still win over it by source position. */
```

### app/styles/reset.css:174 (WHY, shortened)

vendored note compressed to one line.

```css
/*
  Set the default placeholder color to a semi-transparent version of the
  current text color in browsers that do not crash when using color-mix()
  with currentcolor.
*/
```

### app/styles/reset.css:237 (WHY, shortened)

trimmed.

```css
/* Hidden elements stay hidden. This is load-bearing here, not a formality:
   the search shortcut hint ships with `hidden` and also carries `.sr-only`,
   which sets its own `position`, `width` and `clip-path`. The browser's own
   `[hidden] { display: none }` loses to a class rule; this one does not lose,
   so a still-hidden hint is out of the accessibility tree, not just off
   screen. */
```

### app/styles/reset.css:247 (WHY, shortened)

the one-edit note kept; the post.css history moved.

```css
/* `.sr-only`, the one utility the site used from Tailwind's 44-rule utilities
   layer, copied so computed values do not move, with one edit: `border-width:
   0` became `border: 0`.
   Tailwind's copy was never the rule that won: an older `post.css` copy
   spelled `border: 0` won on every page. `border-width: 0` alone leaves
   `border-style: solid` from the `*` rule, which renders the same. It was the
   only computed-style difference on the site after the split, on three
   elements per page, so this matches what shipped. */
```

## app/styles/search-trigger.css

### app/styles/search-trigger.css:7 (WHY, shortened)

trimmed; the ruling date moved.

```css
/* Search entry point: one control, an icon and nothing else. The visible "/"
   is gone (Dustin, 2026-08-29): it should not be painted at all. The shortcut
   is announced through the control's `title` and an `aria-describedby`
   region, both written by the enhancement, so the promise exists only once
   the listener does.
   Rule 2 is met because the anchor renders no text and carries a border.
   Height comes from --control-h on .site-header-nav, so this control, the
   theme button and the Blog link share one height and centreline. The padding
   keeps it a square above the 24px WCAG 2.2 target floor, and its shape does
   not change when script arrives. */
```

## app/styles/shell.css

### app/styles/shell.css:1 (WHY, shortened)

the bar-padding prohibition kept (Grok's restored point); dated removals moved.

```css
/* The track grid and the footer. Ruling 65, Part A steps 3 and 6b, build 2.
   The header rules left this sheet on 2026-09-14; public-chrome.css and
   chrome-nav.css own the header. The bar is not fixed, so section 4's padding
   and anchor offsets went too, and `--bar-h` was deleted on 2026-09-14. Do
   not restore that padding "just in case": against a static header it is a
   blank band at the top of every page.
   Imported last in root.tsx because that list is the cascade and must not be
   sorted; it no longer needs to outrank the two chrome sheets. */
```

### app/styles/shell.css:10 (WHY, shortened)

the .tracks-not-.page rule kept; the canvas sentinel and date moved.

```css
/* 1 · The track grid.
   Named `.tracks`, not `.page`: this repo already has a `.page` (`padding:
   2rem`, `.page-inner` at `max-width: 48rem`) with live consumers on every
   public route, and one name for two jobs is the drift the gates catch.
   `.page` retires page by page as Part B lands.
   The track is the measure, not a max-width on the child, so a full-bleed
   figure and a paragraph share one source of truth. At 375 the two `1fr`
   tracks are zero and `text`, `wide` and `full` share one column, so the
   narrow case needs no media query.
   This sheet first reached the design canvas on 2026-09-16
   (TRACKGRID-SENTINEL-7Q42). */
```

### app/styles/shell.css:26 (WHY, shortened)

the prohibition kept; the check:browser measurement moved.

```css
/* 100% minus the gutters, not 100%. check:browser caught this at 320 on
       every public page: scrollWidth 340 against clientWidth 320.
       The text track took min(--measure, 100%), but 100% is the full grid
       container, so at 320 the fixed tracks summed to 20 + 320 + 20 and the
       two 1fr tracks could not absorb it: the row was 40 wider than its box. */
```

### app/styles/shell.css:48 (WHY, shortened)

trimmed.

```css
/* Flow spacing is single-direction because a grid does not collapse margins:
   two `--s-7` blocks would add up to 96px. Only start margins exist, so no
   two margins meet.
   A heading binds to whatever follows it, figures included, and wins on
   specificity: `.tracks > h2 + *` is (0,1,2) against `.tracks > figure` at
   (0,1,1). */
```

## app/styles/skip-link.css

### app/styles/skip-link.css:1 (WHY, shortened)

stale line pointer (app.css:1885 does not exist) replaced by the rule itself.

```css
/* See split header, canonical statement is app/app.css:1885 */
```

### app/styles/skip-link.css:3 (WHY, shortened)

phase label moved.

```css
/* Blog phase 3. Everything below styles server-rendered markup or elements
   the enhancement script adds. None of it is needed to read the page, and
   every animation is off under prefers-reduced-motion. */
```

### app/styles/skip-link.css:7 (WHY, shortened)

trimmed.

```css
/* Skip link, visible only when focused. It sits at top 0, so it is only ever
   seen against the chrome, where a --brand fill is invisible in light mode.
   It takes the chrome's inverted pair, the one the pressed theme toggle
   takes, so no new pair enters (a v4 consequence).
   The reading-progress bar keeps --brand: the header is not sticky, and the
   bar is scaleX(0) at scroll 0, so it has width only after the chrome has
   scrolled away. */
```

### app/styles/skip-link.css:25 (WHY, shortened)

ratio moved.

```css
/* Its inset ring: the fill it sits in is pale, and #f3e3b8 on it is ~1.1:1.
   At (0,1,1) it ties the base inset rule's specificity and wins on order, so
   it must stay below that block. */
```
