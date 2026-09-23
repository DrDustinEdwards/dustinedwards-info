# Paper and Plate: the design law

Draft for the seat to file as `dustinedwards/design-law.md`. Every STANDING design ruling, merged, as it stands on 2026-09-23. Each line cites where it comes from. Where two rulings disagree the later one is written here, and the conflict is listed at the end. No history: the volumes and `history-index.md` keep that.

## Name and standard
- The system is called Paper and Plate internally; the name never appears on the site. (123.1)
- A public page has no flaw a senior product designer would find, and is never mistakable for Linear, Stripe, Vercel or a university site. (78, kept in the redesign brief)
- References: ciechanow.ski for essay plus operable figure, rauno.me for restraint. Copy neither. (117L.15)
- The warm paper ground and the mono value labels are deliberate, and are never "corrected" as model defaults. Numbered section labels, italic accent words in headlines and pills are the generic defaults this site refuses. (133.2)

## Materials
- Every public page is Swiss editorial on warm limestone `--paper`, with `--text` ink. 1px `--dust` hairlines are the only structure. (117D.1)
- No filled public surface. A selected or current state is an underline or a weight. Error may fill, admin may fill, and the logo's own colors are the logo. (118.2)
- Radius is 0 on the page, wells, inputs, login and public buttons. Something that floats and then leaves (a dialog, the image viewer, a figure readout) may use the one small `--radius-control`. Nothing is ever a pill. (118.3, over 117D.5)
- No shadows as style. (117L.12, carried by conventions.md)

## Color: one job each
- `--brand` means you can click it: links, focus, the mark. It is never a public fill and never a chart series. (122.1)
- Visited links are the named second purple `--visited`, AA on paper. (79)
- Figure oxide is for figure and plate numbers, leaders, labels, strokes and series 1. It is never a link, a rule or chrome. (122.1)
- `--dust` is rules only. It never sets type and never identifies a control. (122.1)
- Figures use three series (oxide, then leaf, then cadet) and `--fig-dust-300` as texture only. No teal, no success green, no third brand, no purple series. (122.2)
- Figure axes and grid lines use `--fig-dust-400`, 3:1 on the figure ground in both themes, and never `--fig-dust-300`. (95)
- `--fig-lawn` and `--fig-turbid` fill figures only (the lawn and a partial clearing), never a page surface or chrome. (132)
- Error may fill. Warning and success never paint on the public plane, and they exist as named tokens so oxide is never borrowed for an error. (122.3)
- Every declared token paints something by 2026-11-30 or is deleted. A carried token names its owner, and when that owner ships without it, the token goes. (119.8, 103, 105)

## Type
- Source Serif sets titles, prose and in-article headings, at every width. (117D.3)
- Inter at display settings sets only the wordmark, the home name and a page-title label. Inter regular sets nav, `h3`, UI and row summaries. (117D.3)
- Mono sets dates, IDs, counts, evidence and code, at 12px or larger. It carries values only; the label beside a value is sans and muted. (117D.3, 123.2)
- One mono channel per row, and it is the value. Prose is never mono. (118.6)
- Sentence case throughout. No tracked caps, no eyebrows, no font file beyond Inter, Source Serif 4 and system mono. (117L.4)
- The serif is served under a namespaced family with a size-adjusted local fallback, so an installed copy cannot override it and its arrival shifts nothing. (84)

## Grid and page objects
- The page grid is `.tracks`; the old `.page` retires page by page. (99)
- The 64ch measure caps prose only. Tables, rosters, charts, index rows and the playground use the wide or full track. (118.4)
- The site's own objects carry its identity: the evidence row (one ruled mono line of real computed data, same slot on every page, omitted below three facts), the figure treatment and the rail. (117D.7)
- Lists are rows, not cards. /projects and /colophon are ruled index rows in the column, never a grid of tiles. (117L.5)
- Login is a plain form in the text column, radius 0, never a card. Its button is ink plus a rule, not a fill. (117L.10)
- Instruments are live figures or ruled opaque wells with ink-plus-rule actions. Ask is a GET form on /search, with no floating chip. (117L.11)
- The admin standard is `docs/ADMIN-DESIGN.md` until the admin design pass lands. (54)

## The five conditions (these replace word bans)
- CARD: a raised or filled repeating unit. BENTO: an equal-tile or auto-fit grid of peer cells used as page language. PILL: radius 999px or any capsule. CHIP: a selected state that is a filled `--brand` capsule. TRACKED CAPS: letter-spacing plus uppercase on a label. All five are banned as objects; the English words stay allowed in copy. (118.7)

## Header and footer
- The header is paper with one `--dust` rule under it. Search and theme are icon-only glyphs with no border, radius or fill. The wordmark is exempt from `:visited`. (117L.7)
- Desktop: nav visible, sticky, one line, opaque, and it does not animate. (126.1)
- Mobile: one line (logo, wordmark, search, theme, and a button labelled "Menu"); the footer carries the full link list. (126.2)
- The mobile header hides on scroll down and returns after a few pixels up with a 300 to 400ms slide. It never hides under reduced motion. (126.3)
- The menu works with scripting off, is opaque paper with radius 0 and ruled rows, and no focused element hides behind the header. Anything that must clear the header takes `--z-overlay`, never `--z-dropdown`. (126.4, 96)
- The footer is paper with one 1px `--dust` rule and sentence-case text links: no band, gradient or purple. (118.1)

## The drawings are plates
- Drawing that explains (a diagram, cross-section, labelled plaque, schematic, scale bar, plate grid or genome track) is content. It is server-rendered SVG with alt text, in ink on paper with dust rules and figure colors. Stock imagery, mascots, texture and decorative drawing are forbidden. A portrait of Dustin is his call. (121)
- Figures are line drawings in the taxonomic-key tradition: outline not shading, mono labels on leaders, a scale bar, and a caption split into a mono label and a prose sentence. One drawing style everywhere. (123.3, 125.1)
- A figure is never lit: no gradient, field, haze or shadowed rim. (124.1)
- The home plate draws established knowledge and carries no citations. (127.2)

## Glass and light
- Glass appears only on modal dialogs, the image viewer and a readout held over a figure. Never on the header, a well, a panel, search results, the rail or anything sticky. (124.3, over 117D.5's tooltip)
- Glass is solid first, blurs at most 12px and never animates the blur, carries no brand fill, and drops to an opaque composite under reduced transparency and in print. (117D.5, 72)
- The pane is `--glass-fill-paper` at 82% with a 12px backdrop blur and a lit edge at 124 degrees, brightest at the leading corner. The specimen inside stays flat and byte-identical when the pane goes opaque. (124.4)
- The lamp tokens never paint a figure or the page. Their only consumer is the glass pane's lit edge. (124.2)

## Motion
- Page motion is view transitions, the reading bar, and hover and focus states, in CSS. Nothing delays first paint or shifts layout. (125.3, 67)
- Only a short list of cornerstone diagrams, chosen by Dustin, animate, and their motion shows what the drawing explains. Every other figure is still. (125.2)
- Everything that moves has a finished still under `prefers-reduced-motion`. (125.4, 67)

## Home
- The writing list leads with the featured post, then the newest non-featured posts. (57)

## Voice
- Titles carry the slug's voice and the description carries the search terms. Headings are spoken sentences. A post opens with the thing itself. (46)

## Conflicts resolved above, for the seat to confirm
1. Glass radius: 117D.5 says radius 0; 118.3 (later) gives floating things `--radius-control`. Written as 118.3.
2. Glass placement: 117D.5 lists tooltips; 124.3 (later) lists a figure readout. Written as 124.3.
3. Home section numerals: the unnumbered vol 19 Plate I entry says "four numbered sections"; 133 (later) drops them. Written as 133.
4. Motion: conventions.md's flat "Motion is CSS only" against 125.2 (animated cornerstones) and 126.3 (script toggles the header). Written as 125.3 plus 125.2.
5. View transitions: vol 16 turned them off (unnumbered, 1686751, `navigation: none` still in motion-print.css), while 67 and 125.3 list them as allowed motion. Written as allowed, pending the seat: a session reading 125.3 could re-enable what vol 16 measured as a blink.
