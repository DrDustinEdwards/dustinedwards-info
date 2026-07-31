---
name: charts
description: How to author a chart on dustinedwards.info. Use whenever adding, editing or reviewing a chart, graph, plot or data figure in a blog post, or when a post needs to show measured numbers. Covers the :::chart directive, its CSV shape, the mandatory alt rule, the palette-token rule, and the gates that enforce them.
---

# Charts on dustinedwards.info

Charts are CONTENT, not a widget. Observable Plot renders them to static SVG at
build time and the SVG lands inline in `content/generated/posts.json`, so a chart
is byte-compared by `check:content` exactly like prose and works with scripting
off. You never write SVG and you never pick a colour.

Ruling and measurements: Capsid `dustinedwards/chart-stack.md`. Editorial rules:
`dustinedwards/blog-content.md`. Mechanics: the repo CLAUDE.md. Renderer:
`app/lib/content/chart.mjs`. Gate: `npm run check:charts`.

## Syntax

A container directive whose body is exactly one fenced `csv` block, optionally
followed by caption markdown.

    :::chart{type=bar x=mechanism y=allowed,ceiling labels="Allowed,Ceiling" title="..." alt="..."}
    ```csv
    mechanism,allowed,ceiling
    GA ratelimit,11,5
    async DO storage,8,3
    sync SQLite DO,3,3
    ```
    An optional caption, rendered as markdown.
    :::

### Attributes

| Attribute | Required | Meaning |
|---|---|---|
| `type` | yes | `bar`, `line`, `dot` or `area`. Anything else fails the build. |
| `x` | yes | The column for the x axis. Also becomes the x axis label. |
| `y` | yes | One column, or several comma separated for multi-series. |
| `alt` | **yes** | Prose describing what the chart shows, including the finding. |
| `title` | no | Rendered above the chart. Not a heading, so it stays out of the TOC. |
| `labels` | no | Comma separated display names overriding the y column headers. |

Captions come from the directive BODY, not an attribute, so they can carry
markdown.

### CSV shape

First line is the header, one row per x value. Fields are trimmed; quote a field
that contains a comma. Every `y` cell must parse as a finite number. A ragged
row, a duplicate or empty column name, an empty body or a header with no rows
all fail the build naming the problem.

Numeric x columns get a linear scale automatically. Text x columns keep the
order they are written in, so the chart reads in the order the markdown does.

## The rules that fail the build

1. **`alt` is mandatory**, exactly as on `:::figure`. Write what the chart SHOWS,
   including the finding, because for a screen reader user it replaces the chart.
   "Bar chart of refusals" is a failure. "Four runs against a limit of five
   refused 1, then 2, then 9, then 0, where a limiter honouring the limit refuses
   7 every time" is the standard.
2. **Every series must be labelled, and labels must be unique**, on any chart
   with more than one `y` column. Multi-series charts label series DIRECTLY on
   the chart and never emit a legend, because hue is never the sole channel
   (design-tokens.md rule 3). Verified under forced colors: when every fill
   collapses to one system colour the chart still reads.
3. **Colours are the ratified ladder, as tokens, assigned automatically:**
   `--chart-cadet`, `--chart-purple`, `--chart-claret`, `--chart-sage`,
   `--chart-gold`, then extended `--chart-rust`. NEVER write a hex, and never ask
   for a specific colour. One stored SVG serves light and dark because the custom
   property resolves per theme in the browser. More than six series fails the
   build rather than repeating a colour.
4. **Data must be real and recorded.** House voice standard: every quantitative
   claim is computed and reproducible. No illustrative or shaped numbers. If the
   measurement does not exist, the chart does not exist.
5. **Unknown directives fail closed.** `:::figrue` is a build error naming the
   post, the line and the known directive list, not a silent empty div. If prose
   genuinely contains a colon followed by a word, escape it as `\:` or use a code
   span. Bare ratios like `4.5:1` and `12:30` are handled automatically and need
   no escaping.

## What you get, automatically

    <figure class="chart-figure">
      <p class="chart-title">...</p>          when title is set
      <svg role="img" aria-label="{alt}">     the accessible name lives HERE
      <figcaption>...</figcaption>            when the body has a caption
      <details class="chart-data">            generated equivalent data table
    </figure>

The name goes on the SVG and NEVER on the figure. `role="img"` makes its
descendants presentational per WAI-ARIA, so naming the figure would generate the
caption and data table and then hide both from the readers they exist for. The
gate asserts this in both directions.

The data table is generated from the same inline CSV, so it cannot drift, and it
prints the original cells rather than reparsed numbers.

## Worked example

From `content/posts/charts-on-workers-fixture.md`, using the real rate limiter
measurements taken while building the Ask guards:

    :::chart{type=bar x=run y=refused title="Requests refused by the GA ratelimit binding" alt="Bar chart of four runs against a limit of five, twelve concurrent requests each. The binding refused 1, then 2, then 9, then 0 requests. A limiter honouring the limit would refuse 7 every time."}
    ```csv
    run,refused
    run 1,1
    run 2,2
    run 3,9
    run 4,0
    ```
    Four consecutive runs, twelve concurrent requests, limit of five. Cloudflare
    documents the binding as permissive and eventually consistent; under
    sustained load it sheds rather than counts.
    :::

Note what the caption does: the numbers are already on the chart and in the
table, so the caption carries the METHOD and the caveat instead of repeating them.

## After editing a chart

Charts live in the gated artifact, so the ordinary content workflow applies:

    npm run build:content     # regenerate the artifact, including the SVG
    npm run check:content     # byte-compares it against a fresh generation
    npm run check:charts      # determinism, Node/Worker parity, the contract

Commit the markdown and the regenerated artifact TOGETHER. Never hand-edit the
SVG in the artifact; `check:content` exists to catch exactly that.

If you bump `@observablehq/plot` or `linkedom` (pinned to exact versions,
deliberately), rerun `check:charts`: determinism and Node-versus-workerd byte
parity are properties of those versions and nothing else proves them.

## Not charts

Diagrams (flowcharts, architecture) are a SEPARATE and currently UNBUILT ruling.
No diagram tool passes the both-writers rule, because diagram layout needs real
font metrics while Plot computes layout from data. When built they will be
Mermaid rendered to build-time assets, not inline in the artifact. Do not try to
draw a diagram with `:::chart`.
