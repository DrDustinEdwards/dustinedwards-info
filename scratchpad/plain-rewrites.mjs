// Plain rewrites of KEEP comment blocks, keyed "sheet#ordinal".
// One line per paragraph; apply-plain.mjs wraps and indents.
// A KEEP block absent from this map was already plain and is left as it is.
export const REWRITES = {
  // ---------------- public-chrome.css ----------------
  "app/styles/public-chrome.css#1":
    "Public header. v4 (provisional, chrome-purple-v4.md): the chrome is a brand surface in both themes, because nav links at --text-muted #5c5248 read green beside the purple wordmark.\n" +
    "The seam takes --border-strong, not --border: in dark mode the chrome-to-canvas step is 1.4:1. That is not a failure, since seams need no 3:1, but it needs a visible edge.\n" +
    "Public plane only; the admin chrome is not covered.",
  "app/styles/public-chrome.css#2":
    "The header wraps, because when it did not, every public page scrolled sideways on a phone. Measured at a 320px viewport: `.site-header-nav` was 414px wide with its right edge at 552, so scrollWidth was 552 against a clientWidth of 320.\n" +
    "`flex-wrap` is on both. On the nav alone the brand and nav still share one line and the nav's wrap point never arrives; on the header alone the nav stays a 414px unbreakable row.\n" +
    "No media query: wrapping holds at 320, at 280, and after another link is added.",
  "app/styles/public-chrome.css#3":
    "The shared inset. The admin topbar reads this same declaration, so the mark sits at the same x on both planes.",
  "app/styles/public-chrome.css#4":
    "The chrome is a fill, so its focus ring sits on brand purple, not on the page canvas --focus-ring was measured against. These descendant selectors are (0,2,0) and outrank the bare `:focus-visible` at (0,1,0).",
  "app/styles/public-chrome.css#5":
    "Rule 2 identity exemption, extended by Dustin's ruling 2026-07-30: an identity element must not take :visited styling.\n" +
    "`.site-header-brand` is (0,1,0) and the base `a:visited` is (0,1,1), so without these rules the base wins and the wordmark turns visited claret for any returning reader. The site's name is not a place the reader has been.\n" +
    "v4: the wordmark takes --on-chrome, the ratified white-on-brand pair (10.4:1 light, 10.1:1 dark). Hover steps down to --on-chrome-muted because rest is already the lightest measured value here.\n" +
    "The `:visited` and `:hover` selectors are (0,2,0) and outrank the base pseudo-class rules deliberately. Do not \"simplify\" them away.\n" +
    "No colour pseudo-class reaches the mark; it takes the dark-mode variant on chrome in both themes, which is a fill.",

  // ---------------- page-shell.css ----------------
  "app/styles/page-shell.css#1":
    "The error boundary's dev-only stack. Not `.prose pre`: this is diagnostic output, not writing. `overflow-x: auto` stops a long frame widening the document.",
  "app/styles/page-shell.css#3":
    "The shell owns the viewport so the editor can own one scroll context: a command bar that stays put over a canvas that scrolls. A body scrolling behind both would be the double-scroll the spec forbids. Ordinary pages are unaffected: .admin-content scrolls instead of the body.",

  // ---------------- chrome-nav.css ----------------
  "app/styles/chrome-nav.css#1":
    "Blog. Post bodies are generated HTML stored in D1, and Tailwind never sees that markup, so every class they use (including sr-only, which remark-gfm emits on the footnotes label) is defined here.",
  "app/styles/chrome-nav.css#2":
    "One row, one centreline, one control height. Every item on the row gets --control-h explicitly, so the row's height no longer depends on whichever item is tallest.\n" +
    "--control-h is declared here rather than in the token blocks because only these three controls share it and check:contrast parses :root for colour tokens.",
  "app/styles/chrome-nav.css#3":
    "The measurement is on `.site-header` above. Wrapping here lets the four labels and three controls break; wrapping there gives them a line of their own to break onto.",
  "app/styles/chrome-nav.css#4":
    "Amended rule 2: nav links are bare text, so they underline. The base `a` rule does that and this only sets the colour; the icon search control opts out on its own rule. v4 keeps the underline.\n" +
    "v4 also gives nav links no :visited state: wayfinding is not a trail marker. `.site-header-nav a:visited` is (0,2,1) against the base `a:visited` at (0,1,1), so this wins rather than tying, which only shows once /blog is in history. Proved with / and /blog in the browser history.",
  "app/styles/chrome-nav.css#5":
    "The text link gets the same hit area as the controls, so its baseline lands on their centreline. Centring the text in a fixed-height box keeps the underline still. `:not()` because the search control is also an anchor here and sizes itself.",
  "app/styles/chrome-nav.css#6":
    "The two pill controls borrow the chrome's own three values. Against purple, --border and --text-muted vanish and the --tint-brand hover fill is either invisible (in light it is --on-chrome-muted) or a dark patch, so no unmeasured pair enters.\n" +
    "Hover is a colour step rather than a fill: since 2026-08-29 there is no pressed state, nothing in the header is filled, and one filled control would be the loudest thing on the row.",
  "app/styles/chrome-nav.css#7":
    "Theme toggle. One button since 2026-08-29, ordered by Dustin.\n" +
    "Two buttons ship and exactly one is displayed. The hidden one is `display: none`, so a screen reader finds one button, not two, and it names the action it will perform.\n" +
    "With no explicit choice, `prefers-color-scheme` picks with no script, so the visible button is the one the no-script form submits and the server never has to guess.\n" +
    "With an explicit choice, `html[data-theme]` picks, and it must outrank the media query so a reader who chose dark on a light machine sees the dark control. It does, (0,3,1) against (0,2,0), so the media query needs no `:not()`.\n" +
    "Script only sets or removes that attribute and the control follows by cascade, so no icon is swapped in JavaScript.\n" +
    "No transition: a theme flip repaints every surface at once, so it is immediate and there is nothing for prefers-reduced-motion to undo.",
  "app/styles/chrome-nav.css#10":
    "Default layer: with no cookie the machine decides. A browser reporting no preference gets light, the palette's own default.",
  "app/styles/chrome-nav.css#11":
    "Explicit layer: outranks the media query, so a chosen theme beats the machine's preference.",

  // ---------------- skip-link.css ----------------
  "app/styles/skip-link.css#1":
    "Blog phase 3. Everything below styles server-rendered markup or elements the enhancement script adds. None of it is needed to read the page, and every animation is off under prefers-reduced-motion.",
  "app/styles/skip-link.css#2":
    "Skip link, visible only when focused. It sits at top 0, so it is only ever seen against the chrome, where a --brand fill is invisible in light mode. It takes the chrome's inverted pair, the one the pressed theme toggle takes, so no new pair enters (a v4 consequence).\n" +
    "The reading-progress bar keeps --brand: the header is not sticky, and the bar is scaleX(0) at scroll 0, so it has width only after the chrome has scrolled away.",
  "app/styles/skip-link.css#3":
    "Its inset ring: the fill it sits in is pale, and #f3e3b8 on it is ~1.1:1. At (0,1,1) it ties the base inset rule's specificity and wins on order, so it must stay below that block.",

  // ---------------- motion-print.css ----------------
  "app/styles/motion-print.css#1":
    "The print rule colour, declared here only: a mid grey that reads on paper. It is not a theme token and must not become one, because check:contrast requires every theme token to sit in a measured screen pair and this colour only exists on paper. Scoping it to print keeps it out of screen rules.",
  "app/styles/motion-print.css#4":
    "The public plane opts out of cross-document view transitions. Measured on production, `/` to `/blog`, three runs per cell, both themes: with the transition on, 12 to 14 intermediate frames matched neither page, lasting 214-220 ms dark and 245-259 ms light, 33 to 66 times the noise floor; under reduced motion, two frames after the click with no intermediate state; with it off, one frame after the click with no intermediate state. That is Chrome's default crossfade showing both pages stacked on every header click.\n" +
    "There is no reduced-motion block: with the transition off for everyone it has nothing to do. The old one skipped the fade but left the transition on, so readers with reduced motion were the only ones not seeing the blink.\n" +
    "Chrome's paint holding replaces it: the old page stays until the new one's first contentful paint. check:browser asserts that `pagereveal` fires with a null `viewTransition`.",

  // ---------------- search-trigger.css ----------------
  "app/styles/search-trigger.css#1":
    "Command palette, enhancement only. Every rule here styles markup that app/enhance/palette.ts creates, so a reader without script never sees any of it.",
  "app/styles/search-trigger.css#2":
    "Search entry point: one control, an icon and nothing else. The visible \"/\" is gone (Dustin, 2026-08-29): it should not be painted at all. The shortcut is announced through the control's `title` and an `aria-describedby` region, both written by the enhancement, so the promise exists only once the listener does.\n" +
    "Rule 2 is met because the anchor renders no text and carries a border.\n" +
    "Height comes from --control-h on .site-header-nav, so this control, the theme button and the Blog link share one height and centreline. The padding keeps it a square above the 24px WCAG 2.2 target floor, and its shape does not change when script arrives.",

  // ---------------- shell.css ----------------
  "app/styles/shell.css#0":
    "The track grid and the footer. Ruling 65, Part A steps 3 and 6b, build 2.\n" +
    "The header rules left this sheet on 2026-09-14; public-chrome.css and chrome-nav.css own the header. The bar is not fixed, so section 4's padding and anchor offsets went too, and `--bar-h` was deleted on 2026-09-14. Do not restore that padding \"just in case\": against a static header it is a blank band at the top of every page.\n" +
    "Imported last in root.tsx because that list is the cascade and must not be sorted; it no longer needs to outrank the two chrome sheets.",
  "app/styles/shell.css#1":
    "1 · The track grid.\n" +
    "Named `.tracks`, not `.page`: this repo already has a `.page` (`padding: 2rem`, `.page-inner` at `max-width: 48rem`) with live consumers on every public route, and one name for two jobs is the drift the gates catch. `.page` retires page by page as Part B lands.\n" +
    "The track is the measure, not a max-width on the child, so a full-bleed figure and a paragraph share one source of truth. At 375 the two `1fr` tracks are zero and `text`, `wide` and `full` share one column, so the narrow case needs no media query.\n" +
    "This sheet first reached the design canvas on 2026-09-16 (TRACKGRID-SENTINEL-7Q42).",
  "app/styles/shell.css#2":
    "100% minus the gutters, not 100%. check:browser caught this at 320 on every public page: scrollWidth 340 against clientWidth 320.\n" +
    "The text track took min(--measure, 100%), but 100% is the full grid container, so at 320 the fixed tracks summed to 20 + 320 + 20 and the two 1fr tracks could not absorb it: the row was 40 wider than its box.",
  "app/styles/shell.css#3":
    "Flow spacing is single-direction because a grid does not collapse margins: two `--s-7` blocks would add up to 96px. Only start margins exist, so no two margins meet.\n" +
    "A heading binds to whatever follows it, figures included, and wins on specificity: `.tracks > h2 + *` is (0,1,2) against `.tracks > figure` at (0,1,1).",
  "app/styles/shell.css#4":
    "5 · The footer. Tonal: limestone ground, one dust rule above, sentence-case purple links. No purple fill, no logo repeat, no social row, no tracked caps.",

  // ---------------- post-shell.css ----------------
  "app/styles/post-shell.css#1":
    "WCAG 2.2 2.5.8. Measured at 497.6 x 22.5 and 493.9 x 22.5: wide links a pixel and a half short in height, because a bare anchor's box is its line box.\n" +
    "The audit's list did not name these; they were found by measuring every target on a post, since the list is not the instrument.",
  "app/styles/post-shell.css#2":
    "The dek: larger than body text and quieter than the title. It carries the meta description's sentence, so it reads as a summary, not the first paragraph.",
  "app/styles/post-shell.css#3":
    "The cover: full column width, height left to the image. D1 stores no intrinsic dimensions, so fixing the width limits the layout shift to one axis.",
  "app/styles/post-shell.css#6":
    "The share row is the same kind of thing as the agent row above it, so it inherits .post-actions and only sets its own spacing.",
  "app/styles/post-shell.css#7":
    "The series reading path: two targets under the parts list. They share .post-nav-target with the prev/next pair, so there is one bordered-target style, not two.",

  // ---------------- prose.css ----------------
  "app/styles/prose.css#0":
    "The low-quality placeholder behind a prose image. The pipeline (pipeline.mjs, rehypeImageSources) writes `class=\"has-lqip\"` and an inline `background-image` holding a twenty-pixel WebP; only the per-image URL is inline and everything shared is here, as the no-inline-style rule asks.\n" +
    "`cover` and `center` crop the blurred wash the way the image will be cropped.\n" +
    "No transition and no cleanup: the loaded image is opaque and covers it. A transparent image would show the wash through; exclude it at derivation instead of adding script.\n" +
    "`width` and `height` are always on the image, so the box is at its final size before anything paints.",
  "app/styles/prose.css#1":
    "Every body image links to its original file (pipeline.mjs, rehypeImageSources).\n" +
    "Rule 2's underline exemption applies, as it does for `.btn` and `.search-chip`: the affordance is not colour, since the whole content is an image, and an underline would just draw a line under the picture.\n" +
    "The cursor is on the anchor because it is the click target and works with script off; without the lightbox the click opens the original, so `zoom-in` is honest either way.",
  "app/styles/prose.css#2":
    "No opacity on this text. Measured 2026-08-21: at `opacity: 0.8` the inherited `--text-muted` composites against `--bg` to #7c736a in light mode, 4.35:1, below the 4.5 AA floor; check:contrast saw only the declared 7.13:1 because opacity is applied after it reads token hexes. Dark was 5.41:1.\n" +
    "Size already separates the credit from the caption (0.8125rem against 0.875rem). `.tag-count` had the same fix, from opacity 0.7 to a token.",
  "app/styles/prose.css#3":
    "Charts. The renderer strips the <style> block Observable Plot injects into each SVG: it carried `--plot-background: white`, the one colour literal breaking the tokens-only rule, and N charts would ship N copies. These rules replace it once.\n" +
    "The SVG has `fill=\"currentColor\"`, so axes and labels inherit --text. Series colours are var(--chart-*) properties written in at build time and resolved per theme, so one stored SVG serves light and dark.",
  "app/styles/prose.css#5":
    "The equivalent data table, collapsed because it repeats the chart. It is still real content: the accessible name is on the SVG, never on this figure, so nothing here is presentational.",
  "app/styles/prose.css#6":
    "Diagrams are build-time assets in <img>, not inline SVG, because mermaid needs a real browser engine for font metrics and a Worker has none (Capsid `dustinedwards/chart-stack.md`).\n" +
    "There are two images because the page's custom properties never reach an SVG loaded through <img>, so each theme gets its own render and these rules pick one.\n" +
    "`display: none`, not opacity or visibility, because only it also removes the hidden image from the accessibility tree, so both share one alt without a screen reader reading the diagram twice.\n" +
    "The selectors follow the site's theme resolution: light by default, dark under a dark OS preference with no attribute, dark when chosen. The server writes the attribute in the first byte, so the right image shows before paint.",
  "app/styles/prose.css#7":
    "Inline code may break, because its contents (file paths, gate names) are single unbreakable tokens. The CI browser run on Linux found /colophon scrolling sideways by 2px at 320px: the fallback monospace is a different width on each platform.\n" +
    "`anywhere`, not `break-word`, because only `anywhere` also lowers min-content, which stops a long token widening its container past the viewport. It breaks only when it must, so short spans are unchanged.",
  "app/styles/prose.css#8":
    "The colour swatch from the `:swatch` directive.\n" +
    "The label is not styled here, deliberately: `.swatch-label` is a real `<code>` inside a `<span>`, so the inline-code rule above already gives it surface, padding, radius and `overflow-wrap: anywhere`. A second declaration would drift.\n" +
    "No per-theme block either: the border is `--border`, measured in every theme block, and the fill is the post's own hex on the element.",
  "app/styles/prose.css#10":
    "The border is load-bearing, not trim: a chip near the page surface colour (near-white in light, near-black in dark) would otherwise be an invisible square, exactly for the colours a palette article discusses.",
  "app/styles/prose.css#11":
    "The fallback keeps `--swatch` out of the theme blocks: read with a default here, it never becomes a token, so check:contrast's participation check and its exemption map have nothing new to handle.",
  "app/styles/prose.css#13":
    "The chip is flattened in forced-colors, and that is intended: the mode replaces every background, and the ratified v3 policy is that the palette yields to system colours. `forced-color-adjust: none` would override that and is deliberately not used.\n" +
    "The value survives as text in the code span beside the chip, not a `title` or tooltip, so the reader loses the sample and keeps the hex.\n" +
    "The border is repainted in CanvasText so the chip keeps its shape.",
  "app/styles/prose.css#17":
    "`.sr-only` lives only in reset.css. A second copy here won on cascade order, which stopped being reliable once prose.css was no longer on every page, so one class would have behaved differently with and without prose. One owner, rule 17.",
  "app/styles/prose.css#19":
    "WCAG 2.2 2.5.8 as well as 1.4.3. Measured at 14.8 x 29 against a 24px floor: the width was short and the height never was.\n" +
    "`inline-flex` with a min-width, not padding, because padding would push the anchor away from its heading; the heading's line box already gives the height.",
  "app/styles/prose.css#20":
    "The reveal is scoped to pointers that can hover (since 2026-08-28), so the touch path has no opacity.\n" +
    "It was `opacity: 0` with a `hover: none` override to 0.55. A partial opacity composites after check:contrast measures: `--text-muted` passes and 0.55 of it does not, and no gate sees it.\n" +
    "Inside the query the values are 0 then 1, a reveal rather than a shade, so nothing paints at an unmeasured contrast. On touch the anchor is plain `--text-muted` at full strength.\n" +
    "`focus-visible` sits inside the query safely: outside it the anchor is already fully visible.",
  "app/styles/prose.css#21":
    "Shiki dual themes: the generator emits both palettes as custom properties on every token, so switching needs no script and no second stylesheet.\n" +
    "The theme's own background is dropped: github-dark's blue-black #24292e fights the warm prairie night, and a block with its own surface would be the one rectangle the token system does not own. Blocks sit on --surface-code, and check:contrast holds every syntax token to 4.5:1 against --surface-code and --surface-popover (the highlighted-line band) in both modes.\n" +
    "Resolution mirrors the token block: with no attribute :root:not([data-theme]) answers, and with one only the attribute rules match, so no [data-theme=\"light\"] override is needed.",
  "app/styles/prose.css#22":
    "The pre carries --shiki-light-bg inline but no inline background-color, so this wins cleanly. Checked against real pipeline output: <pre class=\"shiki ...\" style=\"--shiki-light:#...;--shiki-light-bg:#fff;...\">",
  "app/styles/prose.css#23":
    "Some theme rules pair a foreground with their own background: the diff scopes (markup.inserted, markup.deleted, markup.changed, markup.ignored) and carriage-return. Those foregrounds are only legible on that background, so those spans keep it. The attribute test matters: custom properties inherit, so a blanket rule would paint every token with the pre's value.",

  // ---------------- blog-index.css ----------------
  "app/styles/blog-index.css#2":
    "A token, not an opacity. It was `color: inherit; opacity: 0.7`.\n" +
    "On the filled current chip that put `--on-brand` over `--brand` at 70% opacity, a composite the ratified pair was never measured at. And check:contrast cannot see it: it reads token hexes and opacity is applied afterwards, so any opacity on text hides a failing pair behind a passing one.\n" +
    "So the count takes `--text-muted`, measured against the chip surface, and on the current chip inherits `--on-brand` at full strength, the ratified pair.",
  "app/styles/blog-index.css#3":
    "WCAG 2.2 2.5.8, target size (minimum). Measured at 39x23 and 33x23 for \"Older\" and \"Newer\" against a 24px floor: the height was 23px because a bare inline anchor's box is its line box, and a pixel is not a rounding artefact when the floor is 24 with no tolerance.\n" +
    "`inline-flex` with a min-height, not padding, so the target grows around the text and the pagination's `align-items: center` keeps both links on one centreline.\n" +
    "The inline-target exception does not apply: it covers links inside a sentence, and these sit alone in a nav.",

  // ---------------- post-enhancements.css ----------------
  "app/styles/post-enhancements.css#0":
    "Code block furniture. The label and button are script-added, so their room is reserved conditionally; unconditionally, a reader with no script got 2.25rem of empty space above every fence for a button that could never arrive (audit tier 3).\n" +
    "`scripting: enabled` reserves it at first paint where supported, so nothing moves. `[data-enhanced]`, set by the enhancement when it appends the furniture, covers a browser that runs script but does not know that media feature, at the cost of one small shift.\n" +
    "With no script neither matches and there is no gap. `position: relative` stays unconditional; it reserves nothing.",
  "app/styles/post-enhancements.css#1":
    "Line highlighting from the pipeline. The band is a neutral surface, not a brand tint, because syntax tokens are verified for contrast only against the code surfaces; check:contrast holds every token to 4.5:1 against both --surface-code and --surface-popover. The brand shows as the left bar, where no text sits.",
  "app/styles/post-enhancements.css#2":
    "A native <dialog> since 2026-08-28. `position: fixed` and `z-index` are gone: a modal dialog is in the top layer, above every stacking context, which a z-index race can never win reliably. The scrim is `::backdrop`, so the dialog sizes to its content while the scrim covers the viewport. The palette's dialog works the same way.",
  "app/styles/post-enhancements.css#3":
    "The ratified scrim at the lightbox weight, heavier than the 45 percent the three dialog backdrops use: an image viewer hides the page rather than dimming it.",
  "app/styles/post-enhancements.css#4":
    "The close button: Escape and a backdrop click both work but neither is discoverable. It is positioned against the dialog, which is why the dialog keeps `overflow: visible`. It takes `--border-strong` per hard rule 5, because `--border` does not hold on elevated furniture over a scrim.",
  "app/styles/post-enhancements.css#6":
    "Further reading, related, and mentions. Mentions joins these selectors rather than copying their spacing, so the shared rhythm has one owner.\n" +
    "Its own rules add only what a citation list needs and further reading does not: a gap between entries, which run to three lines, and no bullet, since the author's name is the marker. No new colour token.",

  // ---------------- blog-search.css ----------------
  "app/styles/blog-search.css#1":
    "Search. Layer 0 is server rendered and must work fully with scripting off, so nothing here depends on a class a script adds.",
  "app/styles/blog-search.css#2":
    "The same column as everything around it. Measured at 1280: this form was 1216px wide from x=32 while `.page-head`, `.tag-chips` and `.post-list` were each 768px from x=256, so the search field was the only full-bleed element on the page.\n" +
    "This restates the siblings' `max-width: 48rem; margin: 0 auto`, a mirror of a value this repo normally refuses; the real fix is a shared class across all four, a refactor of an 8,700-line stylesheet. There are now four places, not three.",

  // ---------------- palette-dialog.css ----------------
  "app/styles/palette-dialog.css#1":
    "The ratified scrim. This site and the admin drawer backdrop once wrote it as `45%` and `0.45`, which is how one role ends up with two owners that agree by luck.",
  "app/styles/palette-dialog.css#2":
    "2.4.7 is not satisfied by removing the indicator. The input takes focus as soon as the palette opens, so without a ring a keyboard reader cannot tell where focus went.\n" +
    "`:focus-visible`, not `:focus`, so a pointer user does not get a ring they did not ask for. The token is the on-surface ring the elevated chrome uses, not a new colour, so it stays inside what the contrast gate reads.",

  // ---------------- reset.css ----------------
  "app/styles/reset.css#0":
    "The base reset, vendored from Tailwind's preflight on 2026-08-27 when Tailwind left the build.\n" +
    "It is not leftover nobody bothered to delete: this site has no reset of its own and never has, and removing it moved 5,700 computed values across nine pages, including every element's font. Of Tailwind's 8,356 bytes (8 KB of a 45 KB stylesheet), 3,048 were utilities of which the HTML used only `.sr-only`, and about 1,150 were a polyfill for utilities the site never asked for; both are gone.\n" +
    "Changes from the original, exhaustively: (1) `--theme(--default-font-family, ...)` and `--theme(--default-mono-font-family, ...)` become `var(--font-sans)` and `var(--font-mono)`; (2) the `font-feature-settings` and `font-variation-settings` lines that resolved to `normal` are dropped; (3) the `@layer base` wrapper is gone, and must stay gone: nothing else here is layered, so the wrapper would only change which rules win. Nothing else is edited, because a reset is a list of known browser bugs.\n" +
    "Imported at the top of app.css, where `@import \"tailwindcss\"` sat, so the site's own rules still win over it by source position.",
  "app/styles/reset.css#2":
    "Hidden elements stay hidden. This is load-bearing here, not a formality: the search shortcut hint ships with `hidden` and also carries `.sr-only`, which sets its own `position`, `width` and `clip-path`. The browser's own `[hidden] { display: none }` loses to a class rule; this one does not lose, so a still-hidden hint is out of the accessibility tree, not just off screen.",
  "app/styles/reset.css#3":
    "`.sr-only`, the one utility the site used from Tailwind's 44-rule utilities layer, copied so computed values do not move, with one edit: `border-width: 0` became `border: 0`.\n" +
    "Tailwind's copy was never the rule that won: an older `post.css` copy spelled `border: 0` won on every page. `border-width: 0` alone leaves `border-style: solid` from the `*` rule, which renders the same. It was the only computed-style difference on the site after the split, on three elements per page, so this matches what shipped.",

  // ---------------- projects.css ----------------
  "app/styles/projects.css#1":
    "Projects index: cards on the canvas, which binding rule 7 permits for an index. The metric leads each card, above the name: a number before a claim.\n" +
    "`auto-fit` with a minimum, so the grid collapses to one column at narrow widths with no breakpoint and no JavaScript.\n" +
    "A card ends where its content ends (since 2026-08-30, Dustin's call from screenshots): stretching every card to the tallest left roughly four hundred pixels of empty card under short ones. `start` moves that space below the card. The foot blocks' auto margins are not dead: they still order the links above the evidence and act on rows of similar length.",
  "app/styles/projects.css#4":
    "What is technically notable: prose inside a card, so it takes the card's muted body colour and the same measure as the description. No marker or indent: these are three sentences, not an enumeration, and a bullet would promise an order the list does not have.",
  "app/styles/projects.css#7":
    "Pushed to the card's foot. `auto` on the top margin only works on the last flex child, so the evidence block takes it when present and this keeps it otherwise. With the grid on `align-items: start` there is usually no slack to consume, but it still orders the two foot blocks and still works on rows of similar length.",
  "app/styles/projects.css#8":
    "The citations, last in the card, take the auto margin that pushes the foot down; when both are present the links row sits directly above and its own margin collapses to nothing.",
  "app/styles/projects.css#9":
    "An h3 under the card's h2: the element is a heading so the outline is right, but the type is not, sized as a label so it introduces the list instead of competing with the project name.",

  // ---------------- publications.css ----------------
  "app/styles/publications.css#0":
    "The publications index and per-paper pages, restored 2026-09-12 from `app/app.css` at `a04f922`, before PR #3 retired the academic routes. A separate sheet because page styles left app.css on 2026-08-27; putting 200 lines back would undo that.\n" +
    "The token names are not the ones this CSS was written against: the Hill Country system landed at `081ddb2`, so colours were re-pointed (`--fg` to `--text`, `--muted` to `--text-muted`, `--brand-fg` to `--on-brand`, `--ok` to the success pair). A literal restore would have compiled and painted inherited colours with nothing failing.\n" +
    "`.research-heading` is not here: `/research` does not exist, so the rule it shared with `.pub-year-heading` is now one selector.",
  "app/styles/publications.css#1":
    "Controls. Filter state lives in the URL, so the chips are links and search and sort are a GET form; nothing needs scripting.",
  "app/styles/publications.css#4":
    "Not `opacity`. The original dimmed the count with `opacity: 0.75`, and check:contrast never sees an alpha applied after the declared pair; core.md lists that gap, so this does not add to it. The count uses the chip's own colour, a measured pair.",
  "app/styles/publications.css#5":
    "The open-access badge uses the success family: its text colour and edge colour are separate tokens and not interchangeable, because the edge may be lighter than text contrast allows.",
  "app/styles/publications.css#7":
    "One paper's page, added 2026-09-12 with `/publications/<slug>/`. It reuses `.pub-badge`, `.pub-links`, `.pub-chip` and `.pub-author-me`: the two pages show the same facts at different densities, and a second set of names would drift.",
  "app/styles/publications.css#8":
    "Smaller than other page titles on purpose: a paper title is a sentence, up to 150 characters here, which is four lines at page-title size.",
  "app/styles/publications.css#11":
    "The plain-language line: larger than body text and set apart by space rather than a rule or tint, because it is the author speaking plainly, not a pull quote. It sits above the abstract for readers who skip it.",
  "app/styles/publications.css#12":
    "The deposits behind a paper, shaped like .paper-citedby: a short heading and a row of links under the abstract, since checking a paper is a different errand from reading it.",
  "app/styles/publications.css#13":
    "A retraction, correction or expression of concern. Tinted, unlike .paper-summary, because this is the publisher contradicting the document and must be seen before the abstract.\n" +
    "It uses the warning trio (--tint-warning, --on-tint-warning, --border-warning), already a measured contrast pair in both themes, so no new colour needs checking. No record carries a notice today; the styling ships with the path.",

  // ---------------- playground.css ----------------
  "app/styles/playground.css#1":
    "/playground. Each demo's controls and result sit on `--surface` while the prose stays on the canvas, which is binding rule 7 read correctly: the surfaces are interruptions, like code blocks in an article.\n" +
    "No colour carries meaning alone (rule 1): pass and fail are words, and the error block is a word plus a border.",
  "app/styles/playground.css#8":
    "Tightened from 0.75rem: at the 48rem measure the six columns overflowed by 26px and clipped the fused total, the one number the table exists to show. It still scrolls if a title forces it to.",
  "app/styles/playground.css#9":
    "In and Out inside a demo's result: an h3 under the demo's h2 so the outline stays ordered, sized as a label because it separates two panes rather than starting a new topic.",
  "app/styles/playground.css#10":
    "The snippet verbatim, deliberately not highlighted: it is the input, and highlighting it would render the demo's subject with the demo's subject. It scrolls in its own box so the page never scrolls sideways.",
  "app/styles/playground.css#11":
    "The rendered body. `.prose` already styles everything the pipeline emits, so this only adds separation; a rule here would be a second answer to what prose.css owns.",

  // ---------------- app.css: fonts ----------------
  "app/app.css#0":
    "Inter, self-hosted since 2026-08-21: two files from this origin instead of three requests to two Google origins. That removes a serialised two-hop dependency, Google's view of every visitor, and third-party origins from the enforced CSP (`style-src` and `font-src` are now `'self'`).\n" +
    "These are the variable latin subsets, weight axis 100 to 900, so one file covers every weight and 650 interpolates. They are byte-identical to what fonts.gstatic.com served, so who serves them changed and not what is served. Inter is SIL OFL 1.1 (public/fonts/OFL.txt).\n" +
    "The static 400 and 700 files in `assets/fonts/` are not unused (build-og.mjs and check-logo.mjs need TTF for Satori) and are the wrong faces: the stylesheet asks for 400, 500, 600, 650 and 700 plus an italic, and 51 of 63 weight declarations are 500 or 600.\n" +
    "They go through the build, not public/, for caching: Vite hashes them into `/assets/`, which `public/_headers` serves `max-age=31536000, immutable`. Served from public/fonts/ first, a stable path got `max-age=0, must-revalidate`, measured as a 304 round trip per navigation. A `/fonts/*` immutable rule would be wrong: stable filenames would leave a year of browsers on an old font. `_headers` is unchanged.\n" +
    "`unicode-range` is kept, so the italic downloads only when italic latin text renders. `font-display: swap` matches the old Google URL.",
  "app/app.css#1":
    "font-display: optional on the normal face since 2026-08-28, to fix a measured layout shift. On /blog at 390x844, Slow 4G, cold cache: CLS 0.0674 from the tag-chip row re-wrapping; with the woff2 requests blocked, CLS 0.0000, so swap is the cause.\n" +
    "The size-adjusted fallback below makes the swap's reflow small but not zero: across weights 400 to 700 Inter is 0.955 to 1.029 of the adjusted fallback, so one size-adjust cannot match every weight.\n" +
    "optional blocks briefly and then commits to one face for the page load, with no later swap. The cost: a slow connection reads one page load in Arial at Inter's metrics; the font is cached after, and the preload in root.tsx aims to win the race.\n" +
    "The italic keeps swap and is not preloaded: it is 79,716 bytes needed only on pages with italic latin text, and optional on a late face would mean it is essentially never used. Italic is a small part of any page, so its swap cannot re-wrap a row.",
  "app/app.css#2":
    "The italic is kept as it is, at 79,716 bytes (ruled 2026-08-26), larger than the normal face. `unicode-range` means only pages with italic latin text fetch it, so a page with no emphasis never pays a byte, and it is not preloaded because preloading would download it on every route.\n" +
    "Subsetting was refused on effort, not principle: it needs a font pipeline, a dependency and a gate. If the corpus comes to lean on italics, the trade changes.",
  "app/app.css#3":
    "The metric-adjusted fallback, so the swap does not move the page. Measured cold on the audit profile: CLS 0.0065 on home, 0.0128 on a post, 0.0737 on /blog.\n" +
    "Prose computes `font-optical-sizing: auto`, so Inter's `opsz` axis moves with the font size (wider and more open when small, narrower when large) and its advance width per em is not a constant, which every metric-override recipe assumes it is. Arial has no such axis. Measured 2026-08-26 in a real browser against the deployed font, body-text sample:\n" +
    "  size    Inter/em   Arial/em   size-adjust\n" +
    "    16     82.3313    78.8799     104.38%\n" +
    "    17     81.9303    78.8799     103.87%\n" +
    "    20     80.7406    78.8799     102.36%\n" +
    "    32     75.9556    78.8799      96.29%\n" +
    "Tuned to 17px, the prose size; other sizes are a compromise because one face carries one set of overrides. A ratio taken at 1000px (96.29%) moves body text the wrong way: 9.2% narrow against Inter, where plain Arial was 5.7% off.\n" +
    "Ascent and descent do not move with `opsz` and are taken at 1000px, where `fontBoundingBox` is not quantised as it is at 16px: Inter is 0.969 and 0.241 of the em, each divided by the size-adjust.\n" +
    "Only Arial: Helvetica and generic `sans-serif` resolve to Arial on the measuring machine, and naming several `local()` sources would apply Arial's numbers to Helvetica Neue on macOS, 8.5% away. Without Arial the stack falls through as before.",
  "app/app.css#4":
    "The serif sets public headings at 32px and up and nothing else. One variable roman WOFF2, latin subset, byte-identical to fonts.gstatic.com's Source Serif 4 v14; axes read from the binary: `wght` 200 to 900, `opsz` 8 to 60. The levels name `opsz` 32 and 48, and check:fonts binds the declaration to the file.\n" +
    "The family is namespaced \"Source Serif 4 Web\" because the installed retail \"Source Serif 4\" is not the same file and would set headings at unmeasured metrics. check:fonts maps it explicitly, so the name is not a licence to swap the file.\n" +
    "swap, not optional, the opposite of Inter: this is the late face, not preloaded, setting a few heading lines, and optional on a late face means it is essentially never used. swap is safe only because the fallback below makes it move nothing, as measured.",
  "app/app.css#5":
    "The serif's metric-adjusted fallback. Measured 2026-09-13 in headless Chrome against the binary above, as advance width per em of a `white-space: nowrap` span at the shipped settings:\n" +
    "  case                          SS4/em   fallback/em   size-adjust\n" +
    "  h2      32px wght 600 opsz 32  38.8379    39.0430        99.47%\n" +
    "  h1      32px wght 680 opsz 32  39.3838    39.0430       100.87%\n" +
    "  h1      40px wght 680 opsz 48  37.9875    39.0430        97.30%\n" +
    "  serif   48px wght 600 opsz 48  37.4238    39.0430        95.85%\n" +
    "  serif   48px wght 700 opsz 48  38.1396    39.0430        97.69%\n" +
    "  serif   32px wght 700 opsz 32  39.5107    39.0430       101.20%\n" +
    "  display 52px wght 700 opsz 48  38.1394    39.0430        97.69%\n" +
    "Tuned to the h2 row, 99.47%, as Inter is tuned to 17px: the 2rem heading repeats down an archive. The spread is 95.85% to 101.20%, at worst about 3.6% out, against Inter's 96.29% to 104.38%.\n" +
    "The trap: `font-weight: 200 900` makes the browser use Georgia regular at 600 and 700 and never synthesise bold, so a ratio measured against the Georgia family is against a bold that will never render. That gave 85.27% and a measured CLS 0.0603, a heading going from four lines to six.\n" +
    "Measured at 390x844, dSF 3, Slow 4G, CPU 4x, cold, font held back 2500ms, a six-second settle, headings at 32px and 48px, weights 600 and 700:\n" +
    "  with this block        CLS 0.0000, every heading holds its size across the swap\n" +
    "  without it (Georgia)   CLS 0.0016, the 48px/600 heading 276px -> 221px\n" +
    "The control arm is what gives the zero meaning.\n" +
    "Only Georgia: one face carries one set of overrides, and Times New Roman did not resolve on the measuring machine, so no second face is guessed. Times and generic `serif` stay in the stack without an adjustment.",
  "app/app.css#6":
    "The font stacks, a plain `:root` block since 2026-08-27, three since the serif landed on 2026-09-13.\n" +
    "This was `@theme`, Tailwind v4 syntax for its utility generation, which nothing here needs: the stacks are read with `var()` and check:contrast parses the declarations directly.\n" +
    "An unknown at-rule is dropped whole, so removing Tailwind without this made every element compute `font-family: \"Times New Roman\"`.",
  "app/app.css#7":
    "The stacking scale: one owner per layer, and the layers are named. Measured 2026-08-28: 24 `z-index` declarations across eight sheets with 14 distinct values, including 44, 45 and 46. Values one apart are not a scale.\n" +
    "The remap moved nothing: `z-index` compares by order within a stacking context, never by difference, and the mapping is strictly increasing with every old value positive. The gaps leave room for a new layer anywhere.\n" +
    "  old  token              new\n" +
    "    1  --z-tile-raise      10   lifted inside a card, above its own siblings\n" +
    "    2  --z-tile-body       20   the card's body, above those\n" +
    "    3  --z-tile-action     30   an action that must clear the body\n" +
    "   15  --z-sticky         100   sticky inside a scrolling pane\n" +
    "   20  --z-dropdown       200   a menu or panel anchored to a control\n" +
    "   30  --z-popover        300   an editor popover, over the dropdown layer\n" +
    "   35  --z-drawer-scrim   400   the dim behind the mobile admin drawer\n" +
    "   40  --z-drawer         500   the drawer itself\n" +
    "   44  --z-pinned-bar     600   a pinned bulk-action bar\n" +
    "   45  --z-overlay-scrim  700   the dim behind a detail overlay\n" +
    "   46  --z-overlay        800   the overlay itself\n" +
    "   50  --z-progress       900   the reading progress bar\n" +
    "   60  --z-transient     1000   a toast, a modal layer, a footnote preview\n" +
    "  100  --z-skip-link     2000   always last, and it must beat everything\n" +
    "Not in the colour blocks: check:contrast requires every token there to be a hex in a measured pair, and a stacking level is not.",
  "app/app.css#22":
    "The public header's three layers, decided 2026-09-13 (build 2):\n" +
    "  the fixed bar      --z-pinned-bar   600\n" +
    "  the overlay menu   --z-overlay      800\n" +
    "  the skip link      --z-skip-link   2000\n" +
    "Not --z-dropdown: at 200 it sits below the bar, and the overlay menu hangs past the bar and must clear it. The name reads right and is the trap.\n" +
    "Part A step 6b asked for these as 10 / 20 / 30 under --z-pinned-bar, --z-dropdown and --z-overlay-scrim, but those names already exist here at 600 / 200 / 700 with consumers, so the repo wins and nothing is renumbered. The order it wanted holds: skip link above an open menu, menu above the bar.",
  "app/app.css#23":
    "\"Inter Fallback\" sits between the real face and the generic families, so a reader waiting for the download gets Arial at Inter's metrics. It is not a font anyone sees named; it is Arial measured to take Inter's space.",
  "app/app.css#24":
    "A token because CodeMirror needs the mono stack a third time, after the editor body and prose code blocks; restating it would make a fourth copy to drift.",
  "app/app.css#25":
    "The serif sets public headings at 32px and up and nothing else: never a control, a chip, the logo, the header or an admin screen. \"Source Serif 4 Web Fallback\" sits between it and Georgia, as \"Inter Fallback\" does, so `font-display: swap` on this face moves no line.",
  "app/app.css#26":
    "The elevation shadow, one owner; the pinned bulk bar and the footnote preview each wrote it and agreed by chance. Not in the colour blocks, because check:contrast requires a hex in a measured pair and a box shadow is not one.",
  "app/app.css#27":
    "The Paper, Glass, Light type levels ----------------------------------------\n" +
    "Ruling 65, Part A step 2: eight levels, each five properties rather than one composite value.\n" +
    "No `font` shorthand: `font-variation-settings` cannot ride in it, so `font: var(--t-h1)` would silently lose the optical size and variable weight and still render. There is no composite `--t-h1`, deprecated or otherwise; a consumer sets all five or it is not using the level. The repo has never carried a `--t-*` token of either shape.\n" +
    "The weight is declared twice on purpose: `--t-*-weight` feeds `font-weight`, which selects the face, and the `wght` in `--t-*-vars` positions the axis. They are not redundant: with only the axis a level would match the 400 face and be told to draw at 620, and with only `font-weight` the browser would interpolate the axis itself. Both are set, to the same number, at every level.\n" +
    "The optical size is always explicit: `font-optical-sizing` is off at every consumer of a level, so nothing interpolates on resize, and `opsz` moves at one breakpoint, 48rem, for the two serif levels only. Inter carries `opsz` 14 to 32 and every Inter level sits inside it, the lowest at 14; Source Serif 4 carries 8 to 60 and its levels name 32 and 48. check:fonts ties each level's request to its own `--t-*-family`, so an Inter level asking for 48 fails by name.",
  "app/app.css#28":
    "Prose and UI body at 420, not 400: on limestone Inter's 400 goes thin under greyscale antialiasing. The standfirst is this level at 1.25rem, a size alias, not a ninth level.",
  "app/app.css#29":
    "Field labels, buttons, chips. Weight 600, not 560: step 2 set 560 and step 6b restated the level at 600, and the later step wins.",
  "app/app.css#30":
    "Bar destinations and footer links. No leading token: nothing ever set a line-height from it. A level member with no reader is not a scale hole; add the token back in the commit that reads it.",
  "app/app.css#35":
    "Tracking is not one of the five and is declared apart so it is not mistaken for part of a level. Only three levels carry any; a level with none has no token, because a `0` every consumer must remember to apply is worse than nothing.",
  "app/app.css#36":
    "The strong nav weight, a number for `font-weight`, added in step 6b (step 2 had none). The active bar destination, the current filter chip and a figure caption's lead-in read it.\n" +
    "Its companion `font-variation-settings` string, `opsz` 15 against `--t-nav`'s 16, had no reader and is deleted rather than carried.\n" +
    "Step 2's \"selected chip 640\" has no token: step 6b draws the selected filter with this weight, so a 640 level would have no reader, which section 31 refuses.",
  "app/app.css#38":
    "The second optical size step, and the only breakpoint in the type scale. At 48rem the two serif levels reach the sizes the 48 cut is for. It is one declaration per level, so the size, leading and weight above keep one owner. Inter levels do not appear here: Inter's axis stops at 32 and no level asks for more.",
  "app/app.css#39":
    "The Paper, Glass, Light space and dimension scales --------------------------\n" +
    "Part A step 3, plus the four dimension tokens step 6a added.\n" +
    "Not in the colour blocks, like the stacking scale and the font stacks: `check:contrast` requires every token there to be a literal hex in a measured pair, and a length is neither.\n" +
    "The handoff asked for the dimension tokens in both theme blocks with identical values, so a future theme could not inherit a dimension it never declared. The gate would reject them there, so they are declared once, in a bare `:root` that no theme overrides.",
  "app/app.css#42":
    "Control dimensions are not spacing and do not sit on the scale above.\n" +
    "44px is the header hit target: the enhanced target size, WCAG 2.2 2.5.5, which is AAA. It is not the AA floor and must not be read as one: 2.5.8 asks for 24px, which is --control-min-dense. The extra size is deliberate, because this site is read on phones in one hand.",
  "app/app.css#44":
    "The Paper, Glass, Light motion scale ---------------------------------------\n" +
    "Part A step 5. Four durations named by job, with no --motion-fast or --motion-200: a number name invites reuse by resemblance, and a job name asks what the motion is for. A new case that fits none of the four usually should not be animated.\n" +
    "All three easings end flat: no overshoot, bounce or spring.",
  "app/app.css#49":
    "The Hill Country token system ---------------------------------------------\n" +
    "Ratified 2026-07-28. The specification is dustinedwards/design-tokens.md, and every hex below is copied from it, never derived here. `npm run check:contrast` reads these declarations back and recomputes the whole matrix, so a hand-tuned hex fails the gate.\n" +
    "Tokens are named for the role a component asks for, never for the hue: a destructive button asks for --fill-danger, not crimson. That is how a theme flip changes every hue and no component.\n" +
    "Theme resolution, in source order:\n" +
    "  :root, [data-theme=\"light\"]   light values\n" +
    "  :root:not([data-theme])       dark values, under a dark OS preference\n" +
    "  [data-theme=\"dark\"]           dark values, explicitly chosen\n" +
    "\"System\" is the absence of the attribute, not a third value, and that is the anti-flash mechanism: with no attribute the OS preference decides in pure CSS, and with one the server already wrote the right value from the cookie. Nothing is corrected after paint, so no blocking script is needed.\n" +
    "Both blocks land on `html`, so they do not cascade into each other: a token declared in light and missing in dark keeps its light value under a dark theme. The two blocks must declare the same names, and check:contrast asserts that parity.",
  "app/app.css#51":
    "Deliberately below the floor. WCAG 1.4.3 and 1.4.11 both exempt an inactive component, and a disabled control at 4.5:1 would read as available. Measured on limestone: --text-disabled 2.46:1. It is identified by the disabled attribute, the recess to --paper, and visible text beside the control saying why; check:contrast carries a named exemption. cursor:not-allowed is not a cue: it is pointer-only and arrives after the reader has tried.\n" +
    "--line-disabled (1.64:1 on limestone, with its own 1.4.11 exemption) was deleted 2026-09-14 because no rule drew that edge: measuring a thing is not building it.",
  "app/app.css#53":
    "v4 chrome, provisional pending Dustin's visual review (chrome-purple-v4.md, ratified 2026-08-11). The public header and footer are a brand surface, so everything on them is measured against the chrome, not the page canvas. Five role tokens instead of a hex per rule, so a rejected review reverts one token block, not a dozen scattered literals.\n" +
    "Light pairs on #4f2d7f, from the ruling: --on-chrome 10.4 (the existing white-on-brand pair), --on-chrome-muted 8.7 (tint-brand inverted), --focus-ring-on-chrome 8.2 (the on-brand-fill token).\n" +
    "--mark-on-chrome is the dark-mode brand hex in both themes, by ruling: on purple chrome the light logo variant is the legible one. check:logo's bindings move with it at commit time, never silently.",
  "app/app.css#54":
    "The tile caption scrim is opaque on purpose.\n" +
    "A gradient fading to transparent makes the caption's real backdrop the picture, so a pale and a dark photograph give two different contrast ratios and only one was ever measured. design-tokens.md sets a hard floor for glass, computed the same way: alpha 0.60 over a white backdrop lands at 4.70:1 and 0.50 at 3.42:1, so a fade through that range crosses the floor at a point nobody can name.\n" +
    "So the band under the text is solid and its ratio is constant. The fade above it is decoration over a region with no text. Same value in both themes: a scrim is a hole in the page, not a surface the page tints.\n" +
    "#1a1614 is the dark canvas hex, reused rather than invented; white on it is 18.4:1, and check:contrast carries the pair.",
  "app/app.css#55":
    "Accent: terracotta. Decorative only; it never signals a state. One token: a lifted variant and a tint, with contrast pairs of their own, were never painted and were deleted 2026-09-14.",
  "app/app.css#56":
    "Destructive: a reversible removal. Not the danger family; the media library really makes this distinction.\n" +
    "`--*-danger` marks the irreversible act (Delete post, Delete permanently). It is the loudest thing in the palette and should stay rare.\n" +
    "This marks the reversible act: Trash, Empty trash, \"keep this and trash the other one\". The asset is still served, the row is still there, and Restore puts it back. Danger red here would teach an author that trash is as final as delete, the misreading ruling 3 of the v6 arc prevents.\n" +
    "From the v6 mockup, where every pair it forms clears its floor: 7.62 on --bg, 6.87 on --surface, 6.34 on --surface-popover. A peer of --text-danger (7.46 on --bg), not a weaker sibling.",
  "app/app.css#58":
    "Charts, keyed by hue, not by ladder position: the doc lists the two ladders in different orders, so a series indexed by position would change hue on a theme flip. Core-5 is the unlabeled-safe set; rust is extended and requires a direct label.",
  "app/app.css#74":
    "The series slots are the interface; the ramps above are primitives. A chart reads --fig-s1 to --fig-s5, never a hue name or a tint index, so one piece of markup is correct in both themes: the slot names are stable and the ramp behind them inverts.",
  "app/app.css#80":
    "The lamp's catch hue depends on the backdrop, not the theme. There were two tokens because brand purple at 14% over a brand-purple bar is a zero-delta composite, so the bar needed its own hue. The bar left shell.css on 2026-09-14 and --lamp-chroma-on-bar went with it; ruling 6 deleted the other four bar tokens that day and missed this one, because a mention in check-contrast.mjs still counted as a read. One backdrop, one token.",
  "app/app.css#82":
    "No attribute and a dark OS preference. This is the no-script path and the \"system\" setting, which are the same code path by construction.",
  "app/app.css#85":
    "v4 chrome, provisional. Dark chrome is the already-ratified hero surface #3d2a5c, so no new surface enters the palette. Pairs on it: --on-chrome 10.1, --on-chrome-muted 6.9 (brand-hover), --focus-ring-on-chrome ~10. The focus ring is the light token here, not --focus-ring-on-brand: #4a3d1e was measured against a solid brand fill and is invisible on the deep-purple chrome.",
  "app/app.css#87":
    "The rust, lifted for dark to mirror the light ratios rather than to look similar: 7.59 / 6.80 / 5.94 against 7.62 / 6.87 / 6.34, so the control reads with the same weight in both modes.",
  "app/app.css#111":
    "Dark, chosen explicitly, with the same values as the block above. Written twice rather than shared through a third custom property, because check:contrast would then read a name instead of a hex, and the gate has to see the hex that ships.",
  "app/app.css#139":
    "The lamp's geometry and strength -------------------------------------------\n" +
    "Part A step 4. The catch hue is two colour tokens in the palette blocks above. These three are a position and two numbers, so they live here: `check:contrast` requires every palette token to be a literal hex in a measured pair, and a percent is neither.\n" +
    "They still vary by theme, so this is a second pair of theme blocks, not a bare `:root`. It must sit after the palette blocks: the gate finds a palette block by the literal text of its selector and takes the first match, so a theme block above the palette would be parsed as the palette. That is not left to ordering alone: `check:contrast` asserts each block it parsed carries `--paper`, so a moved block fails loudly instead of measuring the wrong twelve tokens.\n" +
    "`--surface-catch` is registered with `@property`, and that is load-bearing: an unregistered custom property cannot interpolate, so it would jump at the halfway point and the lamp coming up under focus would flicker instead of fade. It is a bare number, not a percentage, because a number interpolates and `calc(var(--surface-catch) * 100%)` does the rest at the use site.",
  "app/app.css#141":
    "Dark sits further in: the bar is already light, so a catch at the very edge is lost to the bar's own value and reads as a lighter rim rather than a lamp. It is also stronger, because the dark composites sit on a steeper part of the transfer curve, where 0.14 is under two sRGB steps.",
  "app/app.css#142":
    "At zero the gradient still renders, as a mix of 0%, which is the backdrop. There is no second code path or separate rule for the reduced case, and the glass fill is untouched: a reduced-transparency reader loses the lamp and keeps the surface.",
  "app/app.css#143":
    "v3 amendment 3: prefers-contrast: more ---------------------------------\n" +
    "A deliberately narrow tier: only the two tokens lowest in the matrix move, plus the default border promoting to its strong twin. The doc says \"no other values change under the query\", so nothing else does; a tier that rewrote the palette would be a second palette to keep in step.\n" +
    "Literal hexes rather than var(--border-strong), because check:contrast reads these blocks back and asserts every token is a hex; an indirection would give the gate a name where it needs a value.",
  "app/app.css#144":
    "v3 amendment 4: forced-colors: active -----------------------------------\n" +
    "The palette yields entirely to system colours here. Nothing below re-asserts a brand colour; every rule keeps a control's shape once the user agent has replaced its background, because in this mode a fill is not a fill any more.\n" +
    "The technique is a transparent outline: forced-colors resolves it to a system colour, so a control distinguished only by its background keeps a visible edge. Focus is already an outline everywhere (amendment 4 again), so it survives untouched.",
  "app/app.css#145":
    "The two shadow hairlines, restored as real borders.\n" +
    "The admin topbar and sidebar draw their edges with `box-shadow` rather than a border, because a border-box border is subtracted from a declared height or width, and both lengths are alignments (the mark's y and the rail's icon column). Amendment 4 says forced-colors strips shadows, so in this mode both edges would vanish and the shell would blend into the content it frames.\n" +
    "Restoring the border costs those alignments a sub-pixel, and that is the right trade: visible structure beats an exact y on a surface the user can no longer see.",
  "app/app.css#146":
    "The admin plane's chip, promoted out of .mention-chip on 2026-09-06 and worn by the mentions filters and the media lenses. Its active state is a brand fill, which this mode removes, so it needs the same forced outline as the search chip.",
  "app/app.css#147":
    "Status dots carried their state in a background, which this mode removes. The word beside them was always the real channel; a forced border keeps the dots visible at all.",
  "app/app.css#149":
    "The cockpit's surface ladder is all background, so here sidebar, canvas, card and hovered row all resolve to the one system Canvas. The card keeps its border, so the index stays framed, and the hovered row is restated as an edge because its tint is gone.",
  "app/app.css#150":
    "The published pill lost its fill and the scheduled pill its tint, so all three would be the same outline around a different word. The word is the first channel; border-style is the second and survives this mode, which is why the pills differ by stroke and not only by hue. It is restated on the outline too, because the border is what the forced palette most likely flattens.",
  "app/app.css#153":
    "The shared inset, declared once for the whole site.\n" +
    "The x where the site's identity mark sits, on the public plane and in the admin, in both sidebar states. Amended from 2rem to 1.5rem on 2026-08-01 so the collapsed admin rail could hold the same icon column the expanded one indents to without becoming a 90px slab.\n" +
    "It is on `body` and not in the token block because check:contrast parses every custom property there as a colour and would throw on a length; the admin's other lengths are scoped to `.admin` for the same reason. It is on `body` and not `.admin` because the public header and footer read it too, and two declarations of one alignment let the two planes drift apart.",
  "app/app.css#154":
    "Rule 2: a link is underlined.\n" +
    "The grounds are CVD, not taste: brand purple against body text, and visited claret against brand purple, both fail Vienot simulation on hue alone, so the underline says \"link\" and the colour only reinforces it.\n" +
    "The one exemption is stated here: an element that already carries a non-colour affordance, a border or a fill, is not leaning on hue and does not need a second cue. Those are the chips and buttons, and each opts out at its own rule. Everything else underlines, including every nav link. Decided with Dustin 2026-07-28.\n" +
    "These are element-level selectors on purpose: any component rule that sets its own colour outranks them, so this changes defaults and overrides nothing deliberate.",
  "app/app.css#155":
    "v3 amendment 2. An element-level rule, so a component that sets its own heading colour (the brand-purple page and post titles) still outranks it. In light mode it resolves to the body text value, so it changes nothing there and is not a second colour to keep in step.",
  "app/app.css#158":
    "------------------------------------------------------------- The front door\n" +
    "\n" +
    "In app.css and not a route-split sheet, on purpose, and the trade is the opposite of the admin one. `admin.css` is split because every home page reader was downloading its 60-odd KB to style a plane they cannot reach. This is under 2KB and styles the page every reader lands on first; splitting it would add a second stylesheet request, a round trip before first paint, on the one page where that costs most. Rule 4 is about what the reader downloads to see a page, and this arrangement makes that smallest where it matters.\n" +
    "The post cards reuse `.post-list` and `.post-card-*` from blog-index.css, which app.css already imports; a second card style would be two owners of one appearance.",
  "app/app.css#160":
    "`auto-fit` with a floor: three tiles share a row where there is room and stack where there is not, with no breakpoint to keep in step with the rest of the site. The floor stops a tile shrinking until its number wraps.",
  "app/app.css#161":
    "The whole tile is the link target except its detail line, which is prose about the number and not part of the control. The link carries both value and label, so its accessible name is \"25 automated checks\" rather than a bare digit.",
  "app/app.css#162":
    "v3 amendment 4: the focus indicator is an outline, never a box-shadow. forced-colors strips shadows, so a shadow ring is absent in Windows High Contrast, the mode where it matters most.\n" +
    "A brand ring is measured against the page background. On a filled control it would land on the fill, so filled controls draw their outline inside, in the one colour the doc measured against a brand fill. A negative outline-offset does that and stays an outline, so it survives forced-colors and cannot be clipped by a scroll container.\n" +
    "The danger fill is deliberately not in this list: --focus-ring-on-brand was measured against brand purple and on dark crimson is 1.47:1, a ring you cannot see. The doc specifies no ring for a danger fill, so the delete button keeps only the outer brand ring, on the page background where it measures 8.1:1.",
  "app/app.css#163":
    "The site mark. The five purple paths carry this class; the three warm ones keep the literal fills from the ratified SVGs, which are identical in the light and dark variants.\n" +
    "This declaration is the dark-mode variant: --brand is #4f2d7f light and #b7a5e0 dark, resolved by the same three selectors as every other token, so a chosen theme, the light default and system mode all get the right mark with no media query of its own. Nothing is hidden, so nothing shifts; the token resolves in the first paint, so nothing flashes. Shared by the header and the login card.",
  "app/app.css#164":
    "The split, 2026-08-21. Everything above is the token system and the two accessibility amendments; everything below moved into app/styles/ and is imported here.\n" +
    "The import order is the cascade. The files were cut from one 9,269-line stylesheet at existing section boundaries, in order, with nothing reordered or rewritten. Reordering an import can change which rule wins.\n" +
    "The tokens stay here because scripts/lib/tokens.mjs parses this path for the palette and check:contrast builds its two-source argument on it; moving them would be a gate change disguised as a refactor.",
  "app/app.css#165":
    "Public stylesheets only, since 2026-08-23. The seven admin sheets moved to `app/admin.css`, which `routes/admin.tsx` imports.\n" +
    "Measured before: this file was the whole site's CSS, one `root-*.css` bundle of 109,318 built bytes downloaded by every public reader, and 62% of it was the admin plane. `admin-media.css` alone is 72KB of source, more than every public sheet together.\n" +
    "\n" +
    "## The order is still the cascade, and the split proved it\n" +
    "\n" +
    "These files are imported in the order they were cut from the 9,269-line app.css, so a rule that won by source position still wins. Removing seven imports changes every remaining rule's neighbours, and on an admin page the seven now arrive after all nine of these instead of interleaved.\n" +
    "Proven, not assumed, by cascading all sixteen sheets both ways with postcss and comparing the winning declaration for every (selector-context, property) key: 3,657 declarations, 3,613 keys, zero winner differences on an admin page and zero on a public page. 2,347 keys stop resolving in the public bundle: the admin CSS public readers no longer download. Dropping one admin sheet from the probe produced 364 differences, so the comparison discriminates.\n" +
    "It found one real conflict, repaired first: the tail of `playground.css` was 42 admin-only classes, and seven of their declarations overrode `admin-media.css`. They moved into `admin-media-later.css`, where they already sat in the cascade; see that file's header.\n" +
    "`/login` imports `app/admin.css` too: it is a public route that uses `.field-alarm` from `admin-editor.css`, and it is the admin plane's door.\n" +
    "\n" +
    "## Where the imports went, 2026-08-27, and why\n" +
    "\n" +
    "They were nine `@import` statements at the bottom of this file and worked only because Tailwind was here. CSS drops an `@import` that follows any other rule, and Tailwind's processor hoisted them anyway, so removing `@import \"tailwindcss\"` silently took all nine sheets off the site: measured on the first build without it, root CSS fell from 45,778 bytes to 9,229 and had no `.site-header` rule.\n" +
    "Hoisting them to the top of this file would fix the build but move the cascade, since they would arrive before the rules below instead of after. They are JavaScript imports in `app/root.tsx`, in the same order, which keeps them after this file's own rules.",
};
