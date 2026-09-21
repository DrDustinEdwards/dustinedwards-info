# Building with dustinedwards.info

A personal site and Cloudflare showcase, not a general component library. The
substance of the system is its **CSS custom properties and semantic class
names**, and that is what you design with.

The look is **Swiss editorial on warm limestone paper**: ink text, 1px hairlines
as the only structure, purple as ink rather than as a surface. Every value below
exists in the stylesheet; `check:design-vocabulary` fails the build if this file
names one that does not.

## Setup

Load `styles.css` (it imports the fonts and the whole stylesheet closure).

There is **no theme provider and no root wrapper component**. The theme is an
attribute: `data-theme="light"` or `data-theme="dark"` on any element
retokenises that subtree, because both selectors are unqualified in the
stylesheet. With no attribute at all, `prefers-color-scheme` decides.

**A themed container MUST set both `background: var(--paper)` and
`color: var(--text)`.** Text colour is owned by the `body` rule, so a container
that only sets a background inherits the *light* text colour and its paragraphs
render nearly invisible. This cost a preview cycle; it will cost you one too.

## The materials

| Role | Token | Note |
|---|---|---|
| Sheet | `--paper` | the ground of every public page, header and footer included |
| Ink | `--text` | body, titles, row titles, the wordmark |
| Quiet ink | `--text-secondary` | deks, dates, labels, summaries |
| Structure | `--dust` | **every** rule, row separator and hairline, at `--line-w` |
| Clickable ink | `--brand` | links, focus, instrument actions, and nothing else |
| Link states | `--brand-hover` `--brand-active` `--visited` | |
| Focus | `--focus-ring` | 2px, 2px offset, square corners |
| Code ground | `--surface-code` | the one permitted departure from paper, so code survives print |

`--dust` is a **line colour** and is deliberately below the contrast floor. It
rules and separates; it may never be the thing that identifies a control.

Purple is ink. There is no purple header, footer, ground or filled public
surface.

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

## Radius, fill and glass

**Radius 0** on the page, wells, inputs, login and public buttons. Something
that floats and then leaves (a dialog, the image viewer, a tooltip) may use one
small named radius, `--radius-control`. Never a pill.

**No filled public surface.** A selected or current state is an underline or a
weight, never a filled capsule. Error may fill. Admin may fill. The logo's own
fills are the logo.

**Glass only on dialogs, the image viewer and tooltips**: solid first, blur 12px
at most, no brand fill, radius 0, opaque under `prefers-reduced-transparency`
and in print. Never on live results, the header, wells, or anything that stays
after the pointer leaves.

Shadows are not a style. Motion is CSS only, with a reduced-motion equivalent.

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
