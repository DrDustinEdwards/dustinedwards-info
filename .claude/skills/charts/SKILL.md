---
name: charts
description: How to author a chart or a diagram on dustinedwards.info. Use whenever adding, editing or reviewing a chart, graph, plot, data figure, flowchart, sequence diagram or architecture drawing in a blog post, or when a post needs to show measured numbers or a structure. Covers the :::chart and :::diagram directives.
---

# Charts and diagrams on dustinedwards.info

`:::chart` draws MEASUREMENTS from inline CSV; its SVG lands inline in the rendered HTML
that D1 stores. `:::diagram` draws a STRUCTURE from mermaid source; its SVG is a
build-time asset the rendered HTML only points at. Neither does the other's job.

# Charts

Charts are content: Enarratio renders them to static SVG through Prelum's
`editorialPack`, so they work with scripting off. You never write SVG and you never
pick a color. Gate: `npm run check:content`.

## Syntax

A container directive whose body is exactly one fenced `csv` block, optionally followed
by caption markdown.

    :::chart{type=bar x=mechanism y=allowed,ceiling labels="Allowed,Ceiling" title="..." alt="..."}
    ```csv
    mechanism,allowed,ceiling
    GA ratelimit,11,5
    async DO storage,8,3
    ```
    An optional caption, rendered as markdown.
    :::

| Attribute | Required | Meaning                                                              |
| --------- | -------- | -------------------------------------------------------------------- |
| `type`    | yes      | `bar`, `line`, `dot` or `area`.                                      |
| `x`       | yes      | The column for the x axis. Also becomes the x axis label.            |
| `y`       | yes      | One column, or several comma separated for multi-series.             |
| `alt`     | **yes**  | Prose describing what the chart shows, including the finding.        |
| `title`   | no       | Rendered above the chart. Not a heading, so it stays out of the TOC. |
| `labels`  | no       | Comma separated display names overriding the y column headers.       |

CSV: first line is the header, one row per x value, every `y` cell a finite number;
quote a field that contains a comma. `line`, `area` and `dot` read x as a number or a
date. Text x columns keep the order written.

## Rules

1. **`alt` is mandatory.** Write what the chart SHOWS, including the finding, because
   for a screen reader user it replaces the chart. "Bar chart of refusals" is a
   failure. "Four runs against a limit of five refused 1, then 2, then 9, then 0,
   where a limiter honoring the limit refuses 7 every time" is the standard.
2. **Never write a color.** Enarratio's theme assigns them from the family tokens, and
   one stored SVG serves light and dark.
3. **Data must be real and recorded.** Every quantitative claim is computed and
   reproducible; no illustrative or shaped numbers. If the measurement does not exist,
   the chart does not exist.
4. If prose has a colon followed by a word, escape it as `\:` or use a code span.

The caption carries the method and the caveat, not the numbers the chart already shows.

## Example

From `content/posts/charts-on-workers-fixture.md`:

    :::chart{type=bar x=run y=refused title="Requests refused by the GA ratelimit binding" alt="Four runs against a limit of five, twelve concurrent requests each. The binding refused 1, then 2, then 9, then 0 requests. A limiter honoring the limit would refuse 7 every time."}
    ```csv
    run,refused
    run 1,1
    run 2,2
    run 3,9
    run 4,0
    ```
    Four consecutive runs, twelve concurrent requests, limit of five. Cloudflare
    documents the binding as permissive and eventually consistent.
    :::

# Diagrams

A diagram is mermaid source in the markdown, rendered to a pair of static SVG assets in
`public/diagrams/` at build time under a key that is a hash of the source. The SVG is
NOT in the rendered HTML (mermaid needs a real browser engine, which a Worker lacks), so
**a new or edited diagram has no picture until someone runs `build:diagrams`.**

Three posts (`policy-in-the-api-not-the-mcp`, `mcp-server-on-workers-with-oauth`,
`agent-write-access-to-a-live-site`) keep their `:::diagram` block, and
`app/lib/content/blog-diagrams.mjs` replaces the images with one inline SVG.
`build:diagrams` does not draw these three, and `check:content` refuses a change to
their mermaid source until the inline drawing is updated to match.

## Syntax

A container directive whose body is exactly one fenced `mermaid` block, optionally
followed by caption markdown.

    :::diagram{title="..." alt="..."}
    ```mermaid
    flowchart TB
      a[One box] --> b[Another box]
    ```
    An optional caption, rendered as markdown.
    :::

`alt` is required, `title` is optional. The fence language must be `mermaid`.

## Rules

1. **`alt` is mandatory, and it IS the structure:** name the boxes and the arrows, in
   reading order. "Flowchart of the save path" is a failure.
2. **Never choose a color.** Colors come from the palette tokens in
   `app/lib/content/diagram.mjs`. Say what a thing means with shape and label: a
   refusal is an edge labeled `403`, not a red arrow.
3. **Keep it narrow.** The prose column is 44rem; a drawing wider than about 700px is
   scaled down with its type. Prefer `flowchart TB` over `LR`, keep labels short, and
   drop a participant before you accept a wide drawing. `build:diagrams` prints each
   asset's size.

## Example

    :::diagram{title="Two credentials, two questions, two different failures" alt="A sequence diagram with three participants: the AI client, the MCP server and the publish API. The client calls a tool and the MCP server verifies the request; a note records that this leg answers who is operating and fails with a 401. The server then makes the request a script would make to the publish API; a second note records that this leg answers what operators may do and fails with a 403."}
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

## After editing a chart or a diagram

    npm run build:content     # regenerate the local build product, SVG included
    npm run build:diagrams    # diagrams only: renders anything whose key has no asset yet
    npm run check:content     # validity, render determinism, every diagram asset exists

Commit the markdown, and for a diagram the assets TOGETHER; `posts.json` is a gitignored
build product. A diagram saved through the admin editor or the operator API has no asset
until `build:diagrams` runs from a clone; `check:content` is red on purpose in that
window. Do not hand-edit an SVG in `public/diagrams/`.
