# Building with dustinedwards.info

A personal site and Cloudflare showcase, not a general component library. You design with its
**CSS custom properties and semantic class names**. The approved visual system,
`templates/visual-system/`, is the design authority; this file states the intent behind it, and
the stylesheets are the real values. Where this file and a stylesheet disagree, the stylesheet
is right.

## Setup

Load `styles.css`. The theme is an attribute: `data-theme="light"` or `"dark"` retokenises that
subtree; with none, `prefers-color-scheme` decides.

**A themed container sets both `background: var(--paper)` and `color: var(--text)`.** Setting
only the background inherits the other theme's text color, and the copy goes nearly invisible.

## What each color does

The color system is closed, and each color has one job.

| Color | Token | Its one job |
|---|---|---|
| Paper | `--paper` | the ground of every page, header and footer included |
| Ink | `--text`, `--text-heading` | body and titles |
| Quiet ink | `--text-secondary` | deks, dates, labels, summaries |
| Dust | `--dust` | every rule and hairline, at `--line-w`; never text, never what identifies a control |
| Purple | `--brand` and its states | anything a reader can click, and the focus ring. Nothing else |
| Oxide | `--fig-oxide-400` light, `--fig-oxide-300` dark | figures only: numbers, leaders, labels, series 1 |
| Leaf, cadet | cadet is `--chart-cadet`; leaf gets a token when a figure first paints it | figures only: series 2 and 3 |

Purple is never a fill, a surface or a chart series: in light it is the link color, so a purple
series reads as a row of links. Oxide and leaf never land on a control. Error may fill; warning
and success are admin colors.

Never invent a token. Every color, space, radius, weight and layer has a custom property, and
their contrast pairs are measured by `check:contrast`. A new name is a value with no owner.

## Type

Serif (`--font-serif`) for post titles, prose and in-article headings. Sans (`--font-sans`) for
nav, `h3`, UI and row summaries. Mono (`--font-mono`) for values: dates, IDs, counts, code. One
mono value per row; the words beside it stay sans. Sentence case throughout. Read a level of the
type scale (`--t-h1-*`, `--t-h2-*`, `--t-body-*`, `--t-small-*`) rather than inventing a size.

## Avoid: the five conditions

Each names the object, not a word, because a word ban only teaches renaming the class.

- **CARD.** A repeating public unit grouping title, summary and a metric or action inside a
  raised or filled rectangle. A list item with a dust rule is not one.
- **BENTO.** An equal-tile or auto-fit grid of peer cells used as the page language. A table, a
  bibliography, a roster or the wide track is not one.
- **PILL.** `border-radius: 999px`, or any capsule.
- **CHIP.** A compact selectable token whose selected state is a filled `--brand` capsule. A text
  link with a dust border, `aria-current` and weight is allowed.
- **TRACKED CAPS.** `letter-spacing` plus `text-transform: uppercase` on a label or eyebrow.

Also not on this site: italic accent words in headlines, numbered section labels, stock photos,
and shadows as a style. The warm paper ground and mono value labels are the design, chosen on
purpose, and are not to be "corrected" as generic defaults.

## Structure

Rows, not cards: a list is ruled with dust and nothing else. Radius 0 on the page. A selected or
current state is an underline or a weight, never a filled capsule.

`tracks` is the page grid, with named columns a child opts into: text (default, capped at
`--measure`), `u-rail`, `u-wide`, `u-full`. The measure is a prose rule, not a page width: a
table, roster or chart takes the wide or full track.

The header is paper and sticky, with one dust rule under it. On a phone its destinations move
into a labelled Menu. The logo is in full color.

## The illustrations

Figures are scientific line drawings: flat, outline rather than shading, hairlines and stipple,
mono labels on oxide leaders, a scale bar, a caption with a mono label and a prose sentence. A
drawing that explains is welcome; decoration, mascots and texture packs are not.

**An illustration is never lit.** No gradient, glow, shadow or haze on or behind a figure,
anywhere, including inside the image viewer, where it sits on solid paper. `--fig-lawn` and
`--fig-turbid` are figure fills only, never a page surface.

## Glass, on two overlays only

Glass is on the **search dialog** and the **image viewer**, and nowhere else: not the sticky
header, not a panel, not the rail. It is 82% untinted paper (`--glass-pane`) with a 12px blur
(`--glass-blur`), over a scrim, with a 1px lit edge. In dark mode the edge is a faint catch. Under
`prefers-reduced-transparency`, and in print, it is solid paper. The light does not spread beyond
the pane.

## Machines and people

AI-first: everything machines use (content, data, structure, citations, dates, feeds, the .md
twins, llms.txt, JSON-LD, microformats) is served without script, and machines get the same facts
people do, never a thinner version. If an interactive figure lets a person explore data, the
facts and numbers are in the server HTML or the .md twin as text.

For people, the site uses whatever makes it its best, script included. A feature that needs a
framework loads it on its own route only, never on the shared shell, and its size is measured.
The URL is the state: a filter that does not write the query string makes person and agent
disagree.
