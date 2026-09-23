# Building with dustinedwards.info

A personal site and Cloudflare showcase, not a general component library. The
substance of the system is its **CSS custom properties and semantic class
names**, and that is what you design with.

The look is **Swiss editorial on warm limestone paper**: ink text, 1px hairlines
as the only structure, purple as ink rather than as a surface. Every value below
exists in the stylesheet; `check:design-vocabulary` fails the build if this file
names one that does not.

The system is called **Paper and Plate**, and that name is internal: it never
appears on the site. Two halves, and they have different rules. **The page is
paper**, which is everything below. **The drawings are plates**, which is the
figures section near the end.

## Setup

Load `styles.css` (it imports the fonts and the whole stylesheet closure).

There is **no theme provider and no root wrapper component**. The theme is an
attribute: `data-theme="light"` or `data-theme="dark"` on any element
retokenises that subtree, because both selectors are unqualified in the
stylesheet. With no attribute at all, `prefers-color-scheme` decides.

**A themed container MUST set both `background: var(--paper)` and
`color: var(--text)`.** Text color is owned by the `body` rule, so a container
that only sets a background inherits the *light* text color and its paragraphs
render nearly invisible. This cost a preview cycle; it will cost you one too.

## The materials

| Role | Token | Note |
|---|---|---|
| Sheet | `--paper` | the ground of every public page, header and footer included |
| Ink | `--text` | body, titles, row titles, the wordmark |
| Quiet ink | `--text-secondary` | deks, dates, labels, summaries |
| Structure | `--dust` | **every** rule, row separator and hairline, at `--line-w` |
| Clickable ink | `--brand` | links, focus, instrument actions, and nothing else |
| Link states | `--brand-hover` `--brand-pressed` `--visited` | |
| Focus | `--brand` | 2px, 2px offset, square corners |
| Code ground | `--paper` | code sits on the page ground; a rule, not a fill, sets it apart |

`--dust` is a **line color** and is deliberately below the contrast floor. It
rules and separates; it may never be the thing that identifies a control, and it
never sets type.

Purple is ink. There is no purple header, footer, ground or filled public
surface.

**The color system is CLOSED, and each color has one job.** This is the part
a session is most likely to break by reaching for a color that looks right.

- **`--brand` means you can click it.** Links, focus, the mark. Never a fill on
  a public surface, and never a chart series: in light it is the link color, so
  a purple series reads as a row of links.
- **Oxide belongs to figures.** Figure and plate numbers, leaders, labels,
  strokes, and series 1. Never a link, never a rule, never chrome.
- **`--dust` is rules.** Paper and ink are ground and text.

Error may fill. Warning and success never paint on the public plane; they are
admin colors, and they exist as named tokens so nobody borrows oxide for an
error.

## Type

| Face | Token | Where |
|---|---|---|
| Serif | `--font-serif` | post titles, prose, and in-article headings at **every** width |
| Sans | `--font-sans` | nav, `h3`, UI, row summaries |
| Mono | `--font-mono` | dates, IDs, counts, evidence, code, colophon |

Inter runs at **display settings in exactly three places**: the wordmark, the
home page's name, and a page-title label. Everywhere else it is regular.

Sentence case throughout. No tracked caps, no eyebrows, no new font file.

**One mono channel per row, and it is the value.** A date is mono; the words
beside it are a label and stay sans and muted. Prose is never mono.

The type scale carries a size, weight, leading and variation per level:
`--t-h1-size`, `--t-h2-size`, `--t-h3-size`, `--t-nav-size`, `--t-body-size`,
`--t-small-size` and their siblings. Read a level rather than inventing a size.

## The grid

`tracks` is the page grid. Its columns are named, and a child opts into one:

| Class | Column | For |
|---|---|---|
| (default) | text | prose, capped at `--measure` |
| `u-rail` | rail | dates, contents, sidenotes |
| `u-wide` | wide | tables, rosters, charts, index rows |
| `u-full` | full | full-bleed figures |

The rail is a **track of this grid**, `--rail-w` wide with a `--rail-gap-w`
gutter, and is zero on any page that does not opt in. Page margins are
`--gutter`. Spacing is the `--s-1` to `--s-9` scale.

**The 64ch measure is a PROSE rule, not a page rule.** A table, a roster, a
chart or a playground uses the wide or full track. Applying it as page width
caused horizontal scroll at 320 once already.

## Page vocabulary

Chrome is `site-header` (with `site-header-brand`, `site-header-nav`,
`site-header-tools`) and `site-shell-footer`. Both are paper with one `--dust`
rule. The header has no breakpoint: it wraps. `skip-link` is paper with a rule.

A post is `post-head`, then `post-rail` (`post-machine` dates, `post-toc`,
`post-note` with its `post-note-kind` label), then `post-body`: `post-blocks`
of `post-block` rows, `prose`, `post-history`, `post-backlinks`. Long-form copy
is `prose`; a raised sentence is `pull-quote`; a disclosure is `post-details`.

Home is `intro-name`, `intro-line`, the evidence row, then `home-rows` of
`home-row`, then `home-more`.

**The evidence row is a site object, not a per-page flourish.** `evidence` is
one ruled mono line of real computed data in the same slot on every page that
carries it, with an optional `evidence-detail` beneath. Three facts or more, or
the row omits itself.

**Rows, not cards.** A list is ruled `--dust` separators and nothing else.

## The five conditions

These replace the old word bans. A word ban teaches the next session to rename
the class and keep the object, so each condition names the object.

- **CARD.** A repeating public unit grouping title, summary and a metric or
  action inside a raised or filled rectangle. A list item with a dust rule is
  not one.
- **BENTO.** An equal-tile or auto-fit grid of peer cells used as the page
  language. A table, a bibliography, a roster, or the wide/full track is not
  one.
- **PILL.** `border-radius: 999px`, or any capsule.
- **CHIP.** A compact selectable token whose selected state is a filled
  `--brand` capsule. A text link with a dust border, `aria-current` and weight
  is allowed.
- **TRACKED CAPS.** `letter-spacing` plus `text-transform: uppercase` on a
  label or eyebrow. Mono dates are not this.

The English words are not banned in copy.

**Deliberate, not defaults.** The warm paper ground and the mono value labels
are Paper and Plate, chosen on purpose. A model's guidance may list a cream
background or mono labels among generic defaults; here they are the design, and
they are not to be "corrected". What this site does forbid, because it reads as
generic, is italic accent words in headlines, numbered section labels
("01", "02", "03" or "1 Writing"), and pills (the PILL condition above).

## Radius, fill and glass

**Radius 0** on the page, wells, inputs, login and public buttons. Something
that floats and then leaves (a dialog, the image viewer, a tooltip) may use one
small named radius, `--radius-control`. Never a pill.

**No filled public surface.** A selected or current state is an underline or a
weight, never a filled capsule. Error may fill. Admin may fill. The logo's own
fills are the logo.

**Glass is solid first**, blur 12px at most, no brand fill, radius 0, opaque
under `prefers-reduced-transparency` and in print. Where it is allowed at all is
one rule with one owner, and it is the "Light touches only glass" section below.

Shadows are not a style. Motion is CSS only, with a reduced-motion equivalent.

## The drawings are plates

A figure here is a **diagrammatic line drawing in the taxonomic-key tradition**:
outline rather than shading, mono labels on leaders, a scale bar, and a caption
whose label is mono and whose sentence is prose. Drawing that EXPLAINS is
content and is welcome: a cross-section, a labeled plaque, a schematic, a
genome track, a plate grid. Decoration, stock imagery, mascots and texture packs
are not.

**A figure is never lit.** No gradient, no field, no shadowed rim, no haze
behind it. A lit diagram is a diagram pretending to be a photograph, and a plate
shows what is measurable rather than what a camera sees. Figures are flat line
work: outline, hairlines, stipple, leaders, scale bar.

Three series and one texture, and the texture is not a series:

| Role | Light | Dark |
|---|---|---|
| Series 1, and every annotation | `--fig-oxide-400` | `--fig-oxide-300` |
| Series 2 | `--fig-leaf-400` | `--fig-leaf-300` |
| Series 3 | `--chart-cadet` | `--chart-cadet` |
| Texture only: stipple, the halo's dashed ring | `--fig-dust-300` | `--fig-dust-300` |
| Plate I's lawn, a figure fill only | `--fig-lawn` | `--fig-lawn` |
| Plate I's turbid tone, a figure fill only | `--fig-turbid` | `--fig-turbid` |

Read the first two rows carefully: oxide and leaf need a DIFFERENT step per
theme, because the ramp step that reads correctly on limestone is not the one
that reads on ink. The last four rows each name one token that already carries
both values.

`--fig-lawn` and `--fig-turbid` are the plate's two flat fills (seat,
2026-09-22). They fill a figure and nothing else, never a page surface, and
`check:invariants` section 32 fails any use that is not a fill.

`--fig-dust-300` is 2.33:1 on paper. That is fine for stipple and a dashed
circle and is never enough to label a series or set body text. No teal, no
success green, no third brand, and no purple series.

The ruling behind this table collapses the ramps to three names, fig-oxide,
fig-leaf and fig-cadet. **Those three names do not exist in the stylesheet
yet**, which is why they are written here without backticks and why the table
above names the steps that do exist. Use the table.

## Light touches only glass

Light is the one thing on this site that is not paper, and it lands in exactly
one place. **Glass is the thing physically over the page, briefly:** a modal
dialog, the image viewer, and a readout held over a figure. Never the header, a
well, a panel, live results, the rail, or anything sticky, because those are
part of the page rather than over it.

The pane is `--glass-fill-paper` at 82% with a 12px backdrop blur and a lit edge
at 124 degrees, brightest at the leading corner. The specimen inside stays flat;
the pane catches the light. `--lamp-origin` places it, `--lamp-reach` carries
it, `--surface-catch` is its strength and is already zero under
`prefers-reduced-transparency`.

That last part is the argument for the whole rule: when light only ever touches
glass, turning it off costs the page nothing but the glass, and the figure under
it is byte-identical in print and under reduced transparency.

## The machine contract, and what script may do

**First and absolute:** every public page renders its content, data, citations,
dates and structure in server HTML, complete and correct without script, and
keeps its `.md` twin, `llms.txt` entry, JSON-LD and microformats. An agent, a
reader with script off, a reader mode and a printer all see the same facts.
This half never degrades and has no exception path.

**Second and permitted:** on top of that, a page MAY run script for what only a
person would want, such as zooming an image, hovering a chart to read a value,
filtering without a reload, or a lightbox. The standing limit is **no framework
on the public plane**: no hydration, no React on a reading route. Hand-written
modules are the mechanism.

**Geometry is not script.** A CSS-only progress bar, a rail, a haze or a view
transition was never forbidden, so design them freely.

**The URL is the state.** A client-side filter that does not write the query
string makes the person and the agent disagree.

## Deleted from this file

These were the 2025 site's vocabulary and no longer describe what ships: the
`page` wrapper and its 48rem inner, the page-head and page-title heading block,
the post-list listing, the muted secondary class, the tag-chip rows, the login
gate card and its mark, and the PostCard and Pagination components with their
MemoryRouter wrapper.

Token families went with them: the generic surface and chrome surfaces, the
on-chrome text pair and the mark-on-chrome fill, both border tokens, every tint,
the heading, accent and disabled text tokens, and the control height. Most still
exist for the admin plane, which keeps its own fills and radii. The control
height exists nowhere: the paper header retired it, and this file naming it was
the first thing the vocabulary gate caught.

## Where the truth lives

Read `styles.css` and the files it imports before styling anything: they are the
real definitions and they beat this summary.
