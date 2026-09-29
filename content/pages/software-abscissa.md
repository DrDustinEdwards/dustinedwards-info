---
path: /software/abscissa
title: "Abscissa"
seo_title: "Abscissa: accessible, server-rendered charts"
description: "Abscissa is an open-source library for accessible charts and scientific figures, drawn on the server into the HTML. It is an early alpha, MIT licensed."
schema_type: SoftwareApplication
code_repository: https://github.com/DrDustinEdwards/abscissa
---

## Charts that arrive with the page

Abscissa draws charts on the server, into the HTML, so they appear without JavaScript and can be read by search engines and assistive technology. It is built on [Observable Plot](https://observablehq.com/plot/) and returns plain HTML strings, so it works in any server framework and any JavaScript runtime: Node.js, Cloudflare Workers, Deno and Bun.

Every chart is a figure whose SVG carries the text alternative its author writes, followed by an equivalent data table. Colors come from the theme's stylesheet through CSS custom properties, so the same markup follows light and dark mode without a re-render, and a theme's contrast and color-vision-deficiency differences can be measured before it ships. The charts on the [CV](/cv) are drawn with it.

## Why the name

An abscissa is a point's horizontal coordinate, its distance along the x-axis. In most charts that axis carries what is being varied, such as time, dose or dilution, and each measurement is read against it. The library takes its name from that axis.

## Status

Abscissa is in active development. It is an early alpha, published on npm under the `next` tag, and its API will change before 0.1.0, so it is not yet for production use. It is MIT licensed.

- Source: [DrDustinEdwards/abscissa on GitHub](https://github.com/DrDustinEdwards/abscissa)
- Package: [abscissa on npm](https://www.npmjs.com/package/abscissa)
- Gallery: [abscissa.dustinedwards.info](https://abscissa.dustinedwards.info)
