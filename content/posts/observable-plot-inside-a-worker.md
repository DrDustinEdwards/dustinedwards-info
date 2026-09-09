---
title: "Rendering Observable Plot charts inside a Cloudflare Worker"
slug: observable-plot-inside-a-worker
description: "How to render Observable Plot charts inside a Cloudflare Worker: the linkedom shim that works, the domino and Vega failures that don't, byte-identical output across Node and workerd, and accessible charts enforced by the build."
date: 2026-07-31
draft: false
first_published: 2026-07-31
tags: [cloudflare, workers, data-visualization, observable-plot, accessibility]
---

Observable Plot can render charts inside a Cloudflare Worker. As far as I can determine, this has not been documented before: Plot's own documentation covers server-side rendering in Node.js via JSDOM, the Plot team has demonstrated rendering in a browser Web Worker via a DOM substitute, and searching for the Cloudflare case returns nothing. This article reports the working configuration, measured on 2026-07-31: Plot 0.6.17 with linkedom 0.18.13 as the DOM implementation, bundling at 930 KiB raw and 226 KiB gzipped as measured in this site's production Worker, rendering deterministically (200 in-process renders and multiple separate processes producing one distinct output), and, the property that mattered most here, producing byte-identical SVG in Node and in workerd, verified by SHA-256 comparison. It also reports the three candidate configurations that failed, with their exact errors, because the failures define the boundary of what works and two of them generalize well beyond charts.

Everything below is reproducible; the chart in this article is rendered by the pipeline it describes.

## Why render charts in the Worker at all

The obvious architecture for a static blog is to render charts at build time only, and if that fits your system, you should do it and skip the hard parts of this article. The requirement here was stricter because of two standing rules on this site. First, charts are content: the data lives in the post's markdown as a fenced block inside a chart directive, and the rendered SVG is part of the stored HTML rather than an asset beside it, the same regime [all content here lives under](/blog/posts-in-git-served-from-d1). Second, that render has two writers, the Node build and the Worker's save path (the browser editor, and the [agent-operated publishing API](/blog/agent-write-access-to-a-live-site) this post arrived through), and the whole design depends on both writers producing identical bytes. Together these rules mean the chart renderer must run in the Worker, produce output byte-identical to the Node build's, and do so deterministically forever. That combination, not any single requirement, is what eliminated most of the field.

## The configuration that works: Plot plus linkedom

Plot requires a DOM: it builds its output through d3-selection against a document. Cloudflare Workers have no DOM. The bridge is [linkedom](https://github.com/WebReflection/linkedom), a lightweight pure-JavaScript DOM implementation, passed to Plot through its documented `document` option:

```ts
import * as Plot from "@observablehq/plot";
import { parseHTML } from "linkedom";

const { document } = parseHTML("<html><body></body></html>");
const chart = Plot.plot({
  document,
  width: 640,
  height: 400,
  marks: [
    Plot.barY(data, { x: "library", y: "kib", fill: "var(--chart-1)" }),
    Plot.ruleY([0]),
  ],
});
const svg = chart.outerHTML;
```

That string is the chart: static SVG, no client JavaScript, servable directly or embedded in generated HTML. Three properties of the output are worth stating precisely because each was a requirement I verified rather than assumed.

Determinism. Two hundred renders in one process produced exactly one distinct output by SHA-256. Separate processes agreed. The generated-ID hazard I expected (Plot creates clip-path IDs in some configurations, the same class of nondeterminism that [broke this site's syntax highlighter](/blog/posts-in-git-served-from-d1)) did not appear for standard marks: the output contained no generated IDs at all. I would still treat this as a property to verify per Plot version rather than a permanent fact, and this site's build now does, on every run.

Cross-environment byte parity. The same chart rendered in Node and in workerd (via a bundled invocation under miniflare) hashed identically. This is the property the two-writer gate requires, and it held both in the initial probe and when reproduced against the production module. One subtlety from the earlier probe is worth recording: parity holds when both environments use the same DOM implementation. My first Node measurements used a different shim than the Worker and the hashes diverged, which was the shims' serialization differing, not Plot misbehaving. Standardize on one DOM implementation everywhere and the question disappears.

CSS custom properties pass through. Plot accepts `var(--chart-1)` anywhere it accepts a color, and the string lands in the SVG untouched. Because the SVG is embedded inline in the page, those variables resolve against the site's stylesheet at display time, which means one stored render serves light and dark themes and the palette's [contrast gate](/blog/color-palette-the-build-can-check) governs chart colors with no additional machinery.

## The configuration the Plot team demonstrated, which does not transfer

The natural starting point was domino, the DOM substitute the Plot team used to demonstrate Plot inside a browser Web Worker. It works in Node. It cannot ship to a Cloudflare Worker, and the failure is categorical rather than a bug: domino's `lib/sloppy.js` uses `with` statements, which are illegal in strict mode, and Workers bundle as strict-mode ES modules. The build fails with five errors of the form:

> With statements cannot be used with the "esm" output format due to strict mode

No configuration fixes this; it is a property of the package's source. The general lesson: a dependency that works in Node and in browser Workers can still be structurally excluded from strict-ESM targets, and you find out from the bundler, not the documentation.

## The candidate that fails at runtime: Vega-Lite

Vega-Lite was the strongest alternative on paper: a scholarly grammar, headless rendering in Node with no DOM needed, deterministic output, CSS variables passing through. It renders fine in Node. In workerd it returns a 500:

> EvalError: Code generation from strings disallowed for this context

Vega's runtime compiles its expression language via dynamic code generation, and Workers forbid runtime code generation as a security policy, the same policy that [forbids runtime WebAssembly compilation](/blog/posts-in-git-served-from-d1) and shaped this site's highlighter and social-card architecture. Vega ships an alternative AST interpreter for CSP-restricted environments, which I did not pursue because Plot had already passed every test. The finding stands on its own for anyone evaluating Vega on Workers: the default path cannot run there, and the error will not appear until runtime.

## The candidate that lost on the axis it was supposed to win: Apache ECharts

ECharts has the best server-side story in the charting field on paper: a zero-dependency SSR mode, introduced in 5.3, that renders to an SVG string with no DOM at all. I expected it to win on bundle size for exactly that reason, since Plot drags a DOM implementation along. Measured, the intuition inverted: ECharts bundled for Workers at 2958 KiB raw and 634 KiB gzipped against Plot-plus-linkedom's 1070 and 254 in the same probe harness. The shim is small; the engine is not. I record the caveat that aggressive tree-shaking of ECharts' modular imports could narrow this, so treat the ECharts figure as worst-case, but the headline holds: needing no shim does not make a library light, and the only way to know a bundle size is to measure it.

:::chart{type="bar" x="configuration" y="gzipped_kib" title="Worker bundle size by charting configuration" alt="Bar chart of gzipped Worker bundle sizes measured in the probe: Observable Plot with linkedom 254 KiB, Vega-Lite 412 KiB, Apache ECharts 634 KiB. Plot with linkedom is the smallest at less than half of ECharts."}
```csv
configuration,gzipped_kib
Plot + linkedom,254
Vega-Lite,412
ECharts SSR,634
```
Gzipped Worker bundle size per configuration, measured 2026-07-31 with wrangler 4.116.0 in one probe harness. Vega-Lite's figure is included for comparison although it cannot run in workerd at all.
:::

## Accessible charts, enforced by the build rather than promised

A chart library's output is not accessible; an implementation is. Plot's raw SVG carries no role and no accessible name, so this site's chart directive wraps every chart in a structure the build enforces: the SVG itself carries `role="img"` and an `aria-label` from a mandatory alt attribute (a chart without one fails the build, the same rule images here have always had), a `figcaption` carries the caption, and an equivalent HTML data table, generated from the same fenced data, sits beneath the figure so a screen reader user gets the numbers rather than a summary. Because the data lives in the markdown, the table is automatic and cannot drift from the chart.

One correction from building this is worth passing along, because I wrote the wrong version into the specification first and the implementing session caught it against the WAI-ARIA spec before shipping. The natural-looking structure, `role="img"` on the `<figure>` wrapping everything, is a compliance bug: `role="img"` makes all descendants presentational, so it would have generated the caption and the data table and then hidden both from assistive technology, the accessibility features defeating themselves. The role and the accessible name belong on the SVG element, the thing that is actually an image, leaving the figure, caption, and table as ordinary reachable semantics. The corrected structure is now a planted violation in the build gate: a chart whose SVG lacks a role or accessible name fails the build.

## Where the boundary is: charts yes, diagrams no

The same probe method was applied to text-to-diagram tools (Mermaid, and the smaller Pintora), and every candidate failed under linkedom, each with a different first error and the same root cause. Mermaid fails immediately at `ReferenceError: CSSStyleSheet is not defined`, and behind that lies its documented dependence on `SVGTextElement.getBBox()`; Pintora fails at `TypeError: Cannot set properties of null (setting 'font')`, reaching for a canvas text-measurement context that does not exist. The distinction generalizes: Plot computes its layout from data, scales mapping numbers to coordinates, while diagram layout requires measuring rendered text, and text measurement requires real font metrics that no lightweight DOM shim carries. That is why charts can satisfy a two-writer byte-parity requirement on Workers today and diagrams cannot; diagrams on this site render at build time as external assets instead, under [the rule that a reproducibility gate should compare only what its inputs fully determine](/blog/blog-reading-without-javascript).

## Limitations

The measurements are dated 2026-07-31 and version-pinned (Plot 0.6.17, linkedom 0.18.13, wrangler 4.116.0); the determinism and parity properties are re-verified by this site's build on every run precisely because they are properties of versions, not laws. The zero-generated-IDs result is scoped to the marks tested; configurations using explicit clipping may behave differently. The ECharts bundle figure is a worst-case without tree-shaking effort. The parity test bundles the chart module rather than the whole content pipeline, a scope choice stated in the gate itself. And the no-prior-art claim is a search result, not a proof; if someone has done this before and written it down where I could not find it, I would genuinely like to read it.

## Update, 28 August 2026: the byte-parity requirement outlived the gate that checked it

This post describes the requirement as serving a committed artifact that a build
gate byte-compared against a fresh generation. That artifact left git on
2026-08-26, for reasons set out in [the content pipeline
article](/blog/posts-in-git-served-from-d1): it made every editor save
download the whole thing from GitHub, and the check it enabled had moved into
continuous integration anyway.

**Nothing in the engineering above changes, and that is the interesting part.**
The requirement was never really about the file. It is about two independent
writers rendering the same source, and the site still has exactly two: the Node
build and the Worker. What moved is where the disagreement is caught. It used to
be a byte comparison at commit time. It is now a drift table printed at deploy:
every row in the database records the git blob hash of the markdown it came from
and a hash of its own render, the deploy renders the corpus fresh, and a row
whose source is unchanged while its render differs is named by slug and fails
the run after the deploy stands.

So the chart renderer must still run in the Worker, still produce output
byte-identical to the Node build's, and still be deterministic forever. Both
properties are still checked on every build, in-process and across processes and
across the Node/workerd split, by the same gate this post describes. A
non-deterministic renderer used to fail a byte comparison at random; it would
now report render drift at random, which is the same finding wearing a different
name and reaching a reader no later.

This post extends [the series on rebuilding this site on Cloudflare's developer platform](/blog/ten-years-on-cloudflare). It was drafted by the site's operator agent, staged through [the MCP tools the series describes](/blog/mcp-server-on-workers-with-oauth), and its figure was rendered by the pipeline it documents. Publication, as always here, required the human.
