---
name: charts
description: How to author a chart or a diagram on dustinedwards.info. Use whenever adding, editing or reviewing a chart, graph, plot, data figure, flowchart, sequence diagram or architecture drawing in a blog post, or when a post needs to show measured numbers or a structure. Covers the :::chart and :::diagram directives, the CSV and mermaid shapes, the mandatory alt rule, the palette-token rule, and the gates that enforce them.
---

# Charts and diagrams on dustinedwards.info

Two directives, two different mechanisms, and the difference is worth knowing
before you pick one.

`:::chart` draws MEASUREMENTS from inline CSV, and its SVG lands inline in the
rendered HTML that D1 stores. `:::diagram` draws a STRUCTURE from mermaid
source, and its SVG is a build-time asset the rendered HTML only points at.
Neither can do the other's
job: `:::chart` cannot draw a flowchart, and `:::diagram` must not be used to
plot numbers.

# Charts

Charts are CONTENT, not a widget. Observable Plot renders them to static SVG
through the shared pipeline, so the SVG lands inline in the rendered HTML both
writers produce (the local build product and the Worker's saves alike), it is
covered by `check:content`'s determinism pass exactly like prose, and it works
with scripting off. You never write SVG and you never pick a colour.

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

The ordinary content workflow applies (markdown is the only committed form;
posts.json is a gitignored local build product):

    npm run build:content     # regenerate the local build product, SVG included
    npm run check:content     # validity and render determinism
    npm run check:charts      # determinism, Node/Worker parity, the contract

Commit the markdown alone; `sync:content` or the next ship lands the render in
D1, and the content-drift health check repairs any gap within one poll.

If you bump `@observablehq/plot` or `linkedom` (pinned to exact versions,
deliberately), rerun `check:charts`: determinism and Node-versus-workerd byte
parity are properties of those versions and nothing else proves them.

# Diagrams

Built 2026-07-30. A diagram is a picture of a STRUCTURE: a flow, a sequence, a
layering. It is mermaid source in the markdown, rendered to a pair of static SVG
assets at build time.

**The one structural difference from charts, and everything follows from it:**
the SVG is NOT in the rendered HTML. Diagram layout needs real font metrics, so
mermaid needs a real browser engine, which a Worker does not have. The assets
live in `public/diagrams/` under a key that is a hash of the source, and the
rendered HTML carries the key. Same pattern as the social cards, and the same gap: **a
new or edited diagram has no picture until someone runs `build:diagrams`.**

## Syntax

A container directive whose body is exactly one fenced `mermaid` block,
optionally followed by caption markdown.

    :::diagram{title="..." alt="..."}
    ```mermaid
    flowchart TB
      a[One box] --> b[Another box]
    ```
    An optional caption, rendered as markdown.
    :::

| Attribute | Required | Meaning |
|---|---|---|
| `alt` | **yes** | Prose describing the structure, including what it shows. |
| `title` | no | Rendered above the diagram. Not a heading, so it stays out of the TOC. |

The fence language must be `mermaid`. That is checked, and not only for typos:
the fence is what makes the source render as a diagram in the `.md` twin, on
GitHub, and anywhere else reading the markdown instead of the page.

## The rules that fail the build

1. **`alt` is mandatory**, as on `:::chart` and `:::figure`. For a diagram the
   alt IS the structure: name the boxes and the arrows. "Flowchart of the save
   path" is a failure. The worked example below is the standard.
2. **You never choose a colour, and there is no colour vocabulary.** Every
   colour comes from the ratified tokens, mapped once in
   `app/lib/content/diagram.mjs` and resolved from `app.css` at build time.
   A diagram says what it means with SHAPE and LABEL: a refusal is an edge
   labelled `403`, not a red arrow. A colour mermaid derives rather than takes
   from the palette fails `build:diagrams` naming the rule that carried it.
3. **Keep it narrow.** The prose column is 44rem. A drawing wider than about
   700px is scaled down and takes its type with it, so a default
   five-participant sequence diagram lands 16px text at an effective 9px. Prefer
   `flowchart TB` over `LR`, keep message labels short, and drop a participant
   before you accept a wide drawing. `build:diagrams` prints each asset's size.
4. **Unknown directives fail closed**, and `diagram` is a known one. If you add
   another, it goes in `KNOWN_DIRECTIVES` in the same commit.

## Worked example

    :::diagram{title="Two credentials, two questions, two different failures" alt="A sequence diagram with four participants: the AI client, the MCP server, the identity provider, and the publish API. The client calls a tool and the MCP server answers with an authorization challenge. The client completes an OAuth walk at the identity provider, which returns an identity restricted to the site owner, and calls the tool again carrying it. A note records that this leg answers who is operating and that its failure is a 401. The MCP server then makes the same bearer-authenticated request a script would make to the publish API, and a second note records that this leg answers what operators may do and that its failure is a 403 naming the policy."}
    ```mermaid
    sequenceDiagram
      participant C as AI client
      participant M as MCP server
      participant API as Publish API
      C->>M: call a tool
      M->>M: verify per request
      Note over C,M: who is operating? 401
      M->>API: the request a script would make
      Note over M,API: what may operators do? 403
    ```
    The MCP server holds no policy.
    :::

Note what the alt does: it walks the diagram in reading order and states the
finding, because for a reader who cannot see it, that prose is the diagram.

## After adding or editing a diagram

    npm run build:content     # the key changes with the source
    npm run build:diagrams    # renders anything whose key has no asset yet
    npm run check:content     # validity and render determinism
    npm run check:diagrams    # the assets exist, and every colour is a token

Commit the markdown and the assets TOGETHER (posts.json is a gitignored local
build product and is never committed). `build:diagrams` is
idempotent (an unchanged diagram is skipped) and prunes assets the corpus no
longer references, so a re-render is only paid for by what actually changed.

**Editing through the admin editor or the operator API is fine and needs no
special care**, because the reference is derived from the source rather than
stored: an unchanged diagram computes the same key on every writer. But a NEW or
CHANGED diagram saved that way has no asset until `build:diagrams` runs from a
clone, exactly like a retitled post has no social card. `check:diagrams` is what
tells you, and it is red on purpose in that window.

Do not hand-edit an SVG in `public/diagrams/`. `check:diagrams` audits every
colour in every committed asset and exists to catch precisely that.
