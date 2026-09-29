---
path: /software/enarratio
title: "Enarratio"
seo_title: "Enarratio: accessible, server-rendered charts"
description: "Enarratio is an open-source library for accessible charts and scientific figures, drawn on the server into the HTML. It is an early alpha, MIT licensed."
schema_type: SoftwareSourceCode
code_repository: https://github.com/DrDustinEdwards/enarratio
license: https://spdx.org/licenses/MIT.html
programming_language: JavaScript
runtime_platform: "Node.js, Cloudflare Workers, Deno and Bun"
---

## Charts that arrive with the page

Enarratio draws charts on the server, into the HTML, so they appear without JavaScript and can be read by search engines and assistive technology. It is built on [Observable Plot](https://observablehq.com/plot/) and returns plain HTML strings, so it works in any server framework and any JavaScript runtime: Node.js, Cloudflare Workers, Deno and Bun.

Every chart is a figure whose SVG carries the text alternative its author writes, followed by an equivalent data table. Colors come from the theme's stylesheet through CSS custom properties, so the same markup follows light and dark mode without a re-render, and a theme's contrast and color-vision-deficiency differences can be measured before it ships. The charts on the [CV](/cv) are drawn with it.

## Why the name

Enarratio was the Roman grammar teacher's explanation of a text. Quintilian names it as one of grammar's two parts: once a passage had been read aloud correctly, the teacher explained its words, figures, meter and stories so that students could understand it. Enarratio does the same for a figure, giving each chart its written description and its data, so that people, screen readers and AI agents can all read what it shows. The library was called Abscissa until September 2026.

## Status

Enarratio is in active development. It is an early alpha, published on npm under the `next` tag, and its API will change before 0.1.0, so it is not yet for production use. It is MIT licensed.

- Source: [DrDustinEdwards/enarratio on GitHub](https://github.com/DrDustinEdwards/enarratio)
- Package: [enarratio on npm](https://www.npmjs.com/package/enarratio)
- Gallery: [enarratio.dustinedwards.info](https://enarratio.dustinedwards.info)
