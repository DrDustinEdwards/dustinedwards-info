# CSS comment slop measure (Grok audit)

Read-only audit of the 22 public-plane stylesheets in `.design-sync/build-inputs.mjs` `SHEETS` (21 listed plus `app/styles/shell.css`, which is already in that array). Tags: KEEP, POINTER, CUT. Nothing under `app/`, `workers/`, `scripts/` or `.design-sync/` was modified.

## Per sheet

| sheet | total bytes | comment bytes | blocks | comment % |
| --- | ---: | ---: | ---: | ---: |
| `app/styles/reset.css` | 9855 | 6614 | 35 | 67.1 |
| `app/app.css` | 79947 | 59898 | 159 | 74.9 |
| `app/styles/public-chrome.css` | 5584 | 4814 | 8 | 86.2 |
| `app/styles/page-shell.css` | 4016 | 2708 | 10 | 67.4 |
| `app/styles/chrome-nav.css` | 8824 | 7038 | 13 | 79.8 |
| `app/styles/skip-link.css` | 2141 | 1810 | 4 | 84.5 |
| `app/styles/motion-print.css` | 4000 | 2718 | 6 | 68.0 |
| `app/styles/search-trigger.css` | 2013 | 1671 | 3 | 83.0 |
| `app/styles/shell.css` | 5568 | 3826 | 5 | 68.7 |
| `app/styles/prose.css` | 17203 | 12750 | 25 | 74.1 |
| `app/styles/blog-index.css` | 4005 | 2170 | 4 | 54.2 |
| `app/styles/blog-index-extras.css` | 770 | 39 | 1 | 5.1 |
| `app/styles/post-shell.css` | 4174 | 2270 | 10 | 54.4 |
| `app/styles/post-enhancements.css` | 7903 | 3969 | 14 | 50.2 |
| `app/styles/blog-search.css` | 2062 | 1494 | 4 | 72.5 |
| `app/styles/search-page.css` | 2244 | 224 | 2 | 10.0 |
| `app/styles/search-facets.css` | 1467 | 0 | 0 | 0.0 |
| `app/styles/ask.css` | 1654 | 164 | 2 | 9.9 |
| `app/styles/projects.css` | 6928 | 4114 | 13 | 59.4 |
| `app/styles/publications.css` | 9699 | 5045 | 15 | 52.0 |
| `app/styles/palette-dialog.css` | 4911 | 1066 | 5 | 21.7 |
| `app/styles/playground.css` | 7728 | 2814 | 13 | 36.4 |
| **total** | **192696** | **127216** | **351** | **66.0** |

## Tag counts

| tag | count |
| --- | ---: |
| KEEP | 188 |
| POINTER | 11 |
| CUT | 152 |
| **total** | **351** |

## KEEP prohibition sentences

One sentence per KEEP block, the prohibition or the load-bearing why/measurement that justified KEEP.

- `app/styles/reset.css:1` "It was "keep a reset you cannot read because it is generated, or keep one you can"."
- `app/styles/reset.css:250` "Set the default placeholder color to a semi-transparent version of the current text color in browsers that do not crash when using color-mix() with currentcolor."
- `app/styles/reset.css:325` "LOAD-BEARING ON THIS SITE, not a formality."
- `app/styles/reset.css:340` "Copied from that output rather than rewritten, so the computed values do not move, WITH ONE EDIT: `border-width: 0` is `border: 0`."
- `app/app.css:3` "Those two files are NOT unused: `build-og.mjs` and `check-logo.mjs` load them because Satori needs TTF buffers to draw the social cards."
- `app/app.css:63` "Italic text is also a small fraction of any page, so its swap cannot re-wrap a whole row."
- `app/app.css:112` "That is why it is also NOT preloaded, unlike the normal face."
- `app/app.css:143` "The ascent and descent come from the font rather than from the glyphs and do not move with `opsz`; they are taken at 1000px, where `fontBoundingBox` is not quantised to whole pixels as it is at 16px."
- `app/app.css:213` "`swap` is only safe here because the fallback block below makes the swap move nothing, which is measured rather than assumed."
- `app/app.css:255` "A ratio measured against the Georgia FAMILY is therefore a ratio against a face that will never render, because the family resolves a real Georgia Bold at those weights and Bold is wider."
- `app/app.css:324` "THE FONT STACKS."
- `app/app.css:340` "Only the order of two values decides which paints on top, never their difference."
- `app/app.css:398` "Those names are already taken here, at 600 / 200 / 700, with consumers, so the repo wins and nothing is renumbered: the handoff was reasoning about a scale this site does not have."
- `app/app.css:419` "It is not a font anyone ever sees named; it is the same Arial, measured to occupy the same space."
- `app/app.css:425` "It is a token now because CodeMirror needs it a third time, and a theme that restated the stack would be a fourth copy to drift."
- `app/app.css:429` "The serif sets public headings at 32px and up and NOTHING else: never a control, a chip, the logo, the header or an admin screen."
- `app/app.css:437` "Not in the colour blocks for the reason the stacking scale is not: check:contrast requires a literal hex in a measured pair, and a box shadow is neither."
- `app/app.css:445` "The repo has never carried a `--t-*` token of either shape; checked before writing this, and the design handoff's instruction to delete rather than deprecate had nothing to act on."
- `app/app.css:488` "The standfirst is this level at 1.25rem, a size alias rather than a ninth level."
- `app/app.css:504` "WEIGHT 600, NOT 560."
- `app/app.css:515` "A level member with no reader is not a scale hole the way a missing spacing step is: a reader that needs nav leading adds the token back in the commit that reads it."
- `app/app.css:534` "THE SERIF FLOOR: 2rem fixed, never fluid, because "headings 32px and up" has to stay true at 375 as well as at 1280, and the face is not cut for less."
- `app/app.css:543` "Lands on exactly 2rem at 375, so the serif never sets below its floor."
- `app/app.css:558` "TRACKING IS NOT ONE OF THE FIVE, and is declared apart so it cannot be mistaken for part of a level."
- `app/app.css:583` "ALIASES, NOT LEVELS."
- `app/app.css:593` "The Inter levels do not appear here at all: Inter's axis stops at 32 and no level asks for more."
- `app/app.css:606` "NOT IN THE COLOUR BLOCKS, for the reason the stacking scale and the font stacks are not: `check:contrast` walks those and requires a literal hex that participates in a measured pair."
- `app/app.css:636` "The TRACK is the measure, not a max-width on a child, so a full-bleed figure and a paragraph share one source of truth."
- `app/app.css:640` "Control dimensions are NOT spacing and do not sit on the scale above."
- `app/app.css:671` "If a new case fits none of the four, the answer is usually that it should not be animated."
- `app/app.css:682` "Not 0: a 90ms ramp hides the one-frame repaint stutter on a slow device that an instant swap shows."
- `app/app.css:687` "A state a reader should notice: between about 120 and 200ms the eye reads a change FROM one state TO another rather than simply being different."
- `app/app.css:690` "It is NOT the scroll reveal."
- `app/app.css:706` "A destructive button asks for --fill-danger; it does not ask for crimson."
- `app/app.css:746` "No split in light mode: halation is a light-on-dark effect, so the heading token exists here only so components can ask for the role unconditionally."
- `app/app.css:750` "Deleted 2026-09-14: MEASURING A THING IS NOT BUILDING IT."
- `app/app.css:767` "It never signals a state."
- `app/app.css:778` "It is a deliberate variant assignment, so check:logo's bindings move with it at commit time and never silently."
- `app/app.css:798` "Same value in both themes: a scrim is a hole punched in the page, not a surface the page tints. #1a1614 is the dark canvas hex, reused rather than invented, and white on it is 18.4:1. check:contrast carries the pair."
- `app/app.css:844` "It never signals a state."
- `app/app.css:849` "Not the danger family, and the distinction is one the media library actually makes rather than a shade."
- `app/app.css:872` "Keyed by HUE, not by ladder position, because the doc lists the two ladders in different orders: a series indexed by position would change hue on a theme flip."
- `app/app.css:890` "all muted copy. dust never sets type"
- `app/app.css:892` "a hint below the value that will replace it, NOT --text-secondary"
- `app/app.css:895` "lines only: rules, hairlines, disabled outlines. never text, never a functional boundary"
- `app/app.css:897` "edges that IDENTIFY a control. dust is 1.57:1 on limestone and cannot"
- `app/app.css:899` "a press is not a hover and is never --visited"
- `app/app.css:901` "legal on /search over paper and NOWHERE else"
- `app/app.css:904` "error TEXT, and the field border at --line-w-thick"
- `app/app.css:918` "Figures only: no semantic colour ever appears in one, because a chart series is not a state."
- `app/app.css:921` "figures sit on paper, never on raised"
- `app/app.css:947` "A chart reads --fig-s1 to --fig-s5 and never a hue name or a tint index, which is what makes one piece of markup correct in both themes: the slot names are stable and the ramp behind them inverts."
- `app/app.css:962` "THE LAMP'S CATCH HUE IS A FUNCTION OF THE BACKDROP, NOT THE THEME."
- `app/app.css:974` "No attribute and a dark OS preference."
- `app/app.css:980` "Warm brown-black, never blue-black."
- `app/app.css:985` "v3 split: body steps one off maximum to reduce halation for astigmatic readers, still 13.1:1, and it buys dark mode a heading/body hierarchy."
- `app/app.css:1005` "The focus ring is the LIGHT token here and not --focus-ring-on-brand, because #4a3d1e was measured against a solid brand fill and is invisible on the deep-purple chrome."
- `app/app.css:1062` "Chosen to MIRROR the light ratios rather than to look similar: 7.59 / 6.80 / 5.94 against 7.62 / 6.87 / 6.34, so the control reads with the same weight in both modes."
- `app/app.css:1169` "They are written twice rather than shared through a third custom property because a token indirection would make check:contrast read a name instead of a hex, and the gate has to see the hex that ships."
- `app/app.css:1190` "The doc specifies no dark brand-active."
- `app/app.css:1253` "Mirrors the media-query dark block above."
- `app/app.css:1359` "It is a bare NUMBER, not a percentage, because a number interpolates and `calc(var(--surface-catch) * 100%)` does the rest at the use site."
- `app/app.css:1392` "Light sits near the leading edge, where the eye enters the control, because the bar is dark and the catch is high-contrast against it."
- `app/app.css:1402` "Dark has to sit further in: the bar is already light, so a catch at the very edge is lost to the bar's own value and reads as a lighter rim rather than as a lamp."
- `app/app.css:1419` "AT ZERO THE GRADIENT STILL RENDERS, as a mix of 0%, which is the backdrop."
- `app/app.css:1431` "Literal hexes rather than var(--border-strong), because check:contrast reads these blocks back and asserts every token is a hex."
- `app/app.css:1462` "Nothing below re-asserts a brand colour; every rule exists to make a control keep its SHAPE once the user agent has replaced its background, because in this mode a fill is not a fill any more."
- `app/app.css:1475` "The admin topbar and sidebar draw their edges with `box-shadow` rather than a border, because a border-box border is subtracted from a declared height or width and both of those lengths ARE alignments (the mark's y and the rail's icon column)."
- `app/app.css:1506` "The admin plane's chip, promoted out of .mention-chip 2026-09-06 and now worn by the mentions filters and the media lenses."
- `app/app.css:1515` "Status dots carried their state in a background, which is exactly what this mode removes."
- `app/app.css:1522` "Selected rows in the palette lose their tint, so the selection is restated as an edge rather than left to disappear."
- `app/app.css:1528` "The card keeps its border, so the index is still framed, and the hovered row is restated as an edge because its tint is gone."
- `app/app.css:1537` "The word is a real channel and was always the first one, but border-style is the second and it SURVIVES this mode, which is the reason the pills differ by stroke rather than only by hue."
- `app/app.css:1555` "The alert's tint is gone, so the edge is the only thing left holding it together, and the glyph plus the heading carry the meaning."
- `app/app.css:1561` "Both are shapes made of a background: the panel floats over the page on a popover surface, and a menu item highlights on a tint."
- `app/app.css:1579` "It is on `body` rather than in `.admin` because the public header and footer read it too, and two declarations of one alignment is how the two planes drift apart."
- `app/app.css:1619` "In light mode this resolves to the same value as body text, so it changes nothing there and is not a second colour to keep in step."
- `app/app.css:1676` "The affiliation sits under the role as a quieter line: it answers "where do they work", which is a fact a reader wants available rather than announced, and giving it the role's weight would make the hero two headlines."
- `app/app.css:1685` "IN app.css AND NOT A ROUTE-SPLIT SHEET, deliberately, and the trade is the opposite of the admin one."
- `app/app.css:1709` "The hero it replaces filled the viewport and put everything that answers "why believe you" below the fold, which is the one place the proof cannot do its job."
- `app/app.css:1729` "`auto-fit` with a floor, so three tiles sit in a row where there is room and stack where there is not, with no breakpoint to keep in step with the rest of the site."
- `app/app.css:1746` "The link carries both the value and the label so its accessible name is "25 automated checks" rather than a bare digit."
- `app/app.css:1846` "The DANGER fill is deliberately not in this list. --focus-ring-on-brand was measured against brand purple, and on dark crimson it comes out at 1.47:1, which is a ring you cannot see."
- `app/app.css:1871` "The five purple paths carry this class; the warm three keep the literal fills the ratified SVGs give them, because those are identical in the light and dark variants."
- `app/app.css:1885` "The tokens stay HERE rather than moving to a file of their own, because scripts/lib/tokens.mjs parses this path for the palette and check:contrast builds its whole two-source argument on it."
- `app/app.css:1899` "MEASURED BEFORE: this file was the whole site's CSS."
- `app/styles/public-chrome.css:11` "Light does not need it and is not harmed by it."
- `app/styles/public-chrome.css:27` "THE HEADER WRAPS, because it did not and every public page scrolled sideways on a phone."
- `app/styles/public-chrome.css:66` "The chrome is a fill, so a focus ring on it lands on brand purple, not on the page canvas the default --focus-ring was measured against."
- `app/styles/public-chrome.css:74` "Hover steps DOWN to --on-chrome-muted rather than up, because rest is already the lightest measured value on this surface and rule 2 wants hover feedback, not a brighter maximum."
- `app/styles/public-chrome.css:112` "v4 variant assignment. (0,2,0) beats `.site-logo-brand` at (0,1,0), so the login card's mark is untouched and keeps following --brand."
- `app/styles/public-chrome.css:118` "2rem keeps the brand row inside the header's existing 4rem min-height, so adding the mark moves nothing below it."
- `app/styles/page-shell.css:20` "Deliberately not `.prose pre`: this is diagnostic output, not writing, and `overflow-x: auto` is what stops a long frame widening the document the way the header used to."
- `app/styles/page-shell.css:50` "Public footer."
- `app/styles/page-shell.css:59` "Moves WITH the header."
- `app/styles/page-shell.css:73` "The copyright line carries `.muted`, which is --text-muted at (0,1,0) and olive on purple. (0,2,0) repoints it at the chrome's own muted value."
- `app/styles/page-shell.css:79` "Login keeps its quieter role by SIZE and position, which is what the component comment says carries it, not by being the only muted thing on the row."
- `app/styles/page-shell.css:103` "WCAG 2.2 2.5.8 for the footer, same measurement and same repair as the pagination links: bare inline anchors whose box is their line box, which lands a pixel under the 24px floor."
- `app/styles/page-shell.css:120` "The shell owns the viewport, so the editor can own one scroll context inside it."
- `app/styles/chrome-nav.css:11` "Tailwind never sees that markup, so every class it uses (including sr-only, which remark-gfm emits on the footnotes label) is defined here rather than assumed from a utility scan."
- `app/styles/chrome-nav.css:18` "Everything on the row is given that height explicitly rather than left to stretch, so the row's height stops depending on which item happens to be tallest."
- `app/styles/chrome-nav.css:43` "PROVED with both / and /blog in the dev browser's history, not asserted."
- `app/styles/chrome-nav.css:61` "Centring the text inside a fixed-height box is what keeps the underline still: the box grew, the text did not move."
- `app/styles/chrome-nav.css:77` "Hover is a COLOUR step rather than a fill."
- `app/styles/chrome-nav.css:114` "The hidden one is `display: none`, so it leaves the accessibility tree as well as the screen: a screen reader finds one button, not two, and the one it finds names the action it will perform."
- `app/styles/chrome-nav.css:164` "WCAG 2.2 target size: 28px square, above the 24px floor."
- `app/styles/chrome-nav.css:180` "THE DEFAULT LAYER: no cookie, so the machine decides."
- `app/styles/chrome-nav.css:197` "THE EXPLICIT LAYER, outranking the media query so a chosen theme beats a machine preference that disagrees with it."
- `app/styles/skip-link.css:18` "Visible only when focused, which is the point. v4 CONSEQUENCE, not part of the ruling but forced by it: this is absolutely positioned at top 0, so the only thing it is ever seen against is the chrome."
- `app/styles/skip-link.css:42` "And its inset ring, for the reason the pressed toggle needs one: the fill it sits inside is pale now, and #f3e3b8 on it is ~1.1:1. (0,1,1) matches the base inset rule's specificity and wins on order, which is why this must stay below that block."
- `app/styles/motion-print.css:1` "Every enhancement above becomes instant rather than absent."
- `app/styles/motion-print.css:22` "Print-scoped, so it also cannot leak into a screen rule by being reachable from one."
- `app/styles/motion-print.css:66` "`[data-enhanced]` is carried too, or it would outrank this by one attribute selector and print a fence with 2.25rem of space above it for a button that this same block sets to display: none."
- `app/styles/motion-print.css:77` "A printed page cannot be clicked, so link targets are spelled out."
- `app/styles/motion-print.css:96` "It set `animation: none` on the transition pseudo-elements, which skipped the fade while leaving the transition opted in, so readers with reduced motion were the only ones NOT seeing the blink."
- `app/styles/search-trigger.css:15` "It had already moved twice chasing a shape that did not read as a stray character parked beside an icon; the ruling is that it should not be painted at all."
- `app/styles/shell.css:1` "THE BAR IS NOT FIXED ANY MORE, which is why section 4 went with it."
- `app/styles/shell.css:25` "THE TRACK IS THE MEASURE, not a max-width on the child, so a full-bleed figure and a paragraph share one source of truth."
- `app/styles/shell.css:50` "So at 320 the fixed tracks summed to 20 + 320 + 20 and the two 1fr tracks could not absorb it: the row was 40 wider than the box holding it."
- `app/styles/shell.css:78` "FLOW SPACING IS SINGLE-DIRECTION, because a grid does not collapse margins."
- `app/styles/shell.css:110` "5 · THE FOOTER Tonal."
- `app/styles/prose.css:56` "`cover` and `center` rather than a stretch, so the placeholder is cropped the way the image will be rather than distorted."
- `app/styles/prose.css:85` "The cursor goes on the anchor rather than the image because the anchor is the click target and is the thing that still works with script off."
- `app/styles/prose.css:120` "NO OPACITY ON THIS TEXT."
- `app/styles/prose.css:139` "Series colours come in as var(--chart-*) custom properties written into the SVG at build time and resolved by the browser per theme, which is why one stored SVG serves light and dark."
- `app/styles/prose.css:176` "Collapsed by default because it repeats the chart rather than adding to it, but it is real content in the accessibility tree: the accessible name sits on the SVG, never on this figure, so nothing here is made presentational."
- `app/styles/prose.css:196` "A diagram is a build-time asset referenced by <img>, not inline SVG, because mermaid needs real font metrics and therefore a real browser engine, which a Worker does not have."
- `app/styles/prose.css:277` "INLINE CODE MAY BREAK, because what goes in it here cannot."
- `app/styles/prose.css:292` "THE LABEL IS NOT STYLED HERE AND THAT IS DELIBERATE."
- `app/styles/prose.css:311` "Sized in em so the chip tracks the text it sits beside rather than a fixed pixel size that is wrong at one of the two type scales."
- `app/styles/prose.css:316` "THE BORDER IS LOAD-BEARING, not trim."
- `app/styles/prose.css:322` "The fallback is what keeps `--swatch` OUT of the theme blocks: read with a default here, the property never has to be declared as a token, so check:contrast's participation assertion has nothing new to account for and its exemption map stays empty."
- `app/styles/prose.css:327` "Never absorb the flex line's shrink: the label shrinks, the chip does not, because a chip narrower than it is tall stops being a colour sample."
- `app/styles/prose.css:333` "`forced-color-adjust: none` would hold the hex against that ruling and is deliberately not used."
- `app/styles/prose.css:357` "Also set here, not only on .shiki, so a fence in an unlisted language still lands on a surface instead of the page background."
- `app/styles/prose.css:389` "MEASURED at 14.8 x 29 against a 24px floor, so the width was the problem and the height never was."
- `app/styles/prose.css:406` "On touch the anchor is simply `--text-muted`, which is a measured token at full strength."
- `app/styles/prose.css:440` "The theme's own BACKGROUND is dropped. github-dark ships a blue-black (#24292e) that fights the ratified warm prairie night, and a code block that carried its own surface would be the one rectangle on the page the token system does not own."
- `app/styles/prose.css:461` "Measured against real pipeline output rather than assumed: the emitted tag is <pre class="shiki ..." style="--shiki-light:#...;--shiki-light-bg:#fff;...">"
- `app/styles/prose.css:469` "A handful of theme rules pair a foreground with a background of their own: the diff scopes (markup.inserted, markup.deleted, markup.changed, markup.ignored) and carriage-return."
- `app/styles/blog-index.css:31` "24px minimum target, WCAG 2.2 AA."
- `app/styles/blog-index.css:52` "ON THE FILLED CURRENT CHIP the count is `--on-brand` over `--brand` at 70% opacity, which is a composite the ratified pair was never measured at."
- `app/styles/blog-index.css:137` "The undersized-target exception for "inline" targets does NOT apply."
- `app/styles/post-shell.css:55` "Found by measuring every interactive target on a post rather than only the ones on the list, which is why the list is not the instrument."
- `app/styles/post-shell.css:87` "Larger than body text and quieter than the title, which is what a standfirst is: the same sentence the meta description carries, so it reads as a summary rather than as the first paragraph."
- `app/styles/post-shell.css:97` "Full column width with the height left to the image, because D1 stores no intrinsic dimensions; fixing the width is what bounds the shift to one axis."
- `app/styles/post-enhancements.css:43` "It used to be unconditional, and a reader with no script got 2.25rem of empty space above every fence, on every post, for a button that could never arrive."
- `app/styles/post-enhancements.css:106` "The band is a NEUTRAL surface, not a brand tint, because syntax tokens are verified for contrast against the code surfaces and a tinted band would put them on a colour nothing measured."
- `app/styles/post-enhancements.css:148` "`position: fixed` and `z-index` are gone: a modal dialog is in the TOP LAYER, above every stacking context on the page, which is the thing a z-index race can never win reliably."
- `app/styles/post-enhancements.css:173` "The ratified scrim pattern at the LIGHTBOX weight, which is a heavier veil than the 45 percent the three dialog backdrops take: an image viewer hides the page rather than dimming it."
- `app/styles/post-enhancements.css:244` "Its own rules below are only what a citation list needs and further reading does not: a gap between entries, because each one is three lines rather than one, and no bullet, because the author's name is the marker."
- `app/styles/post-enhancements.css:294` "A stranger's excerpt, which can be up to 280 characters with no spaces in it if they choose."
- `app/styles/blog-search.css:15` "Recorded so the next person widening the column knows there are now four places and not three."
- `app/styles/search-page.css:116` "Purple would read as brand rather than as a match, and rule 6 keeps purple off any signalling job."
- `app/styles/ask.css:14` "24px minimum target, per the accessibility rule."
- `app/styles/ask.css:26` "A visible left edge so the generated answer is never mistaken for the site's own prose at a glance."
- `app/styles/projects.css:11` "The auto margins on the foot blocks are kept and are not dead: they still order the links row above the evidence block, and they come back into effect for any row whose cards are close enough in length to leave slack."
- `app/styles/projects.css:55` "The metric block."
- `app/styles/projects.css:78` "The date is deliberately quiet but never absent: an undated number keeps looking authoritative long after it stops being true."
- `app/styles/projects.css:104` "Marker suppressed and indent removed: these are three sentences, not an enumeration, and a bullet would promise an ordering the list does not have."
- `app/styles/projects.css:131` "Rule 1: the status is never carried by colour alone."
- `app/styles/projects.css:164` "These are not links and carry no affordance beyond the label."
- `app/styles/projects.css:174` "Pushed to the card's foot."
- `app/styles/projects.css:191` "The citations."
- `app/styles/projects.css:199` "Sized down to a label rather than a heading, because it introduces the list rather than competing with the project name; the element is a heading so the outline is right, the type is not."
- `app/styles/projects.css:211` "Stacked, not a row: these are article titles and a flex row would set two long titles side by side and hyphenate both."
- `app/styles/projects.css:224` "Titles wrap to two or three lines at a card's width, so the lines need to sit closer than the default body leading or the list reads as paragraphs."
- `app/styles/publications.css:1` "Restoring the comma would be restoring a claim about a route that does not exist."
- `app/styles/publications.css:51` "0.5rem block padding puts the target at 40px, over the 24px minimum."
- `app/styles/publications.css:193` "`--ok` in the original, which the token system replaced with a family rather than a single value: the readable text colour and the edge colour are separate tokens and are NOT interchangeable, because the edge is allowed to be lighter than text contrast would permit."
- `app/styles/publications.css:234` "It reuses `.pub-badge`, `.pub-links`, `.pub-chip` and `.pub-author-me` rather than restating them: the two pages show the same facts at different densities, and a second set of names for one visual language is how they would drift apart."
- `app/styles/publications.css:248` "Smaller than the site's other page titles on purpose."
- `app/styles/publications.css:316` "A list of sentences, so it reads rather than tabulates: each entry is a title, a venue and a year, and the longest here runs to 50 entries."
- `app/styles/publications.css:346` "Larger than body text and set apart by space rather than by a rule or a tint: it is the author speaking plainly, not a pull quote."
- `app/styles/publications.css:372` "A RETRACTION, CORRECTION OR EXPRESSION OF CONCERN."
- `app/styles/palette-dialog.css:10` "Sits nearer the top than centred: the list grows downward and a centred dialog would jump as results arrive."
- `app/styles/palette-dialog.css:16` "The ratified scrim pattern."
- `app/styles/palette-dialog.css:55` "`:focus-visible` rather than `:focus`, so a pointer user opening the palette does not get a ring they did not ask for, while a keyboard user always does."
- `app/styles/playground.css:11` "That is binding rule 7 read correctly rather than stretched: the prose stays on the canvas and the distinct surfaces are interruptions, the same standing code blocks and figures have inside an article."
- `app/styles/playground.css:47` "The form is a row that wraps on its own, so a narrow viewport needs no breakpoint and no script."
- `app/styles/playground.css:83` "24px minimum target, WCAG 2.2 2.5.8."
- `app/styles/playground.css:126` "The cap is stated in the UI, not just enforced in the loader."
- `app/styles/playground.css:168` "The only element on the site whose colours are legitimately inline: they are the reader's own input, so no token could name them."
- `app/styles/playground.css:225` "Tightened from 0.75rem: at the 48rem measure the six columns overflowed the container by 26px, which clipped the fused total, the one number the table exists to show."
- `app/styles/playground.css:256` "An h3 under the demo's h2, so the document outline stays ordered; sized as a label rather than a heading because it separates two panes rather than introducing a new topic."
- `app/styles/playground.css:268` "The snippet verbatim, deliberately NOT highlighted: this is the input, and highlighting it would render the demo's subject with the demo's subject."
- `app/styles/playground.css:282` "The rendered body."
- `app/styles/playground.css:294` "`.prose` sets a top margin on its first block for body flow; inside a boxed pane that reads as a stray gap."

## aislop scan

Command: `npx aislop@latest scan --json` at the repo root. Saved as `scratchpad/aislop.grok.json`.

- score: **73** (Needs Work)
- cliVersion: 0.16.1
- supported files: 440
- diagnostics: 324
- summary: 23 errors, 288 warnings, 33 fixable, 440 files

### Engine issue counts

| engine | issues |
| --- | ---: |
| format | 0 |
| lint | 60 |
| code-quality | 169 |
| ai-slop | 83 |
| security | 12 |

### Per-rule counts

| engine / rule | count |
| --- | ---: |
| code-quality / complexity/function-too-long | 62 |
| code-quality / complexity/file-too-large | 59 |
| code-quality / code-quality/duplicate-block | 46 |
| lint / jsx-a11y/prefer-tag-over-role | 30 |
| ai-slop / ai-slop/console-leftover | 17 |
| ai-slop / ai-slop/hardcoded-url | 12 |
| ai-slop / ai-slop/todo-stub | 12 |
| ai-slop / ai-slop/narrative-comment | 10 |
| lint / react/set-state-in-effect | 10 |
| security / security/dangerously-set-innerhtml | 8 |
| ai-slop / ai-slop/double-type-assertion | 7 |
| ai-slop / ai-slop/meta-comment | 7 |
| lint / react-hooks/rules-of-hooks | 7 |
| ai-slop / ai-slop/duplicate-import | 6 |
| lint / jsx-a11y/control-has-associated-label | 4 |
| ai-slop / ai-slop/hallucinated-import | 3 |
| ai-slop / ai-slop/hidden-fallback | 3 |
| lint / import/no-duplicates | 3 |
| ai-slop / ai-slop/swallowed-exception | 2 |
| ai-slop / ai-slop/thin-wrapper | 2 |
| ai-slop / ai-slop/unsafe-type-assertion | 2 |
| code-quality / complexity/deep-nesting | 2 |
| lint / jsx-a11y/no-noninteractive-element-to-interactive-role | 2 |
| lint / jsx-a11y/no-noninteractive-tabindex | 2 |
| security / security/innerhtml | 2 |
| lint / import/namespace | 1 |
| lint / jsx-a11y/no-autofocus | 1 |
| security / security/dependency-audit-skipped | 1 |
| security / security/hardcoded-secret | 1 |

