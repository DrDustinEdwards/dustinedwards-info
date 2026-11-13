---
path: /software/capsomer
title: "Capsomer"
seo_title: "Capsomer: an open-source design system in plain CSS"
description: "Capsomer is an open-source design system in plain CSS, with optional React wrappers: components, design tokens, themes and page patterns, checked against WCAG 2.2 AA."
schema_type: SoftwareApplication
product_url: https://capsomer.dustinedwards.info
code_repository: https://github.com/DrDustinEdwards/capsomer
license: https://spdx.org/licenses/MIT.html
application_category: DeveloperApplication
programming_language: "CSS, TypeScript"
---

## A design system for any site or app

Capsomer is an open-source design system for websites and web apps. It is plain CSS built on design tokens, so it works with any framework or none, and most components also come with an optional script for their behavior and a React component. It covers what most products need, from buttons, forms, dialogs and data tables to an app shell, editors, charts and marketing blocks, in light and dark themes. It is MIT licensed, and its documentation, with live examples of every component, is at [capsomer.dustinedwards.info](https://capsomer.dustinedwards.info).

## What it gives you

- **Design tokens.** Color, type, spacing, radius, shadow, motion and density as CSS custom properties, also published as JSON. Color comes in ten ready families, each a 12-step OKLCH scale for light and dark, and the palette module builds a matching family from your own brand color.
- **Plain CSS in cascade layers.** Every rule sits in Capsomer's own layers, so a site's own CSS wins without specificity fights. No Tailwind or other CSS framework.
- **Only what a page uses.** Each component is its own import: its CSS and, where it needs them, its script and its React component.
- **Accessibility checked in every state.** Each component's states are scanned with axe against WCAG 2.2 A and AA in light and dark, and the build refuses any color pair below WCAG contrast. The same scan is a helper a site can run on its own pages.
- **Works under Trusted Types.** Its scripts hand markup to the page only through one Trusted Types policy, so they keep working on a site that enforces it.

## How to use it

Capsomer installs from a release tag on [GitHub](https://github.com/DrDustinEdwards/capsomer); it is not on the npm registry. Pin the newest tag from its releases, import the tokens once, then the components a page uses:

```js
// npm install github:DrDustinEdwards/capsomer#vX.Y.Z
import "capsomer/tokens.css";
import "capsomer/base.css";
import "capsomer/button.css";
import { Button } from "capsomer/react/button"; // optional
```

Without React, the HTML is enough: `<button class="cap-btn" data-variant="primary">Save</button>`. Capsomer is still before version 1.0, so read the changelog before moving to a newer tag.

## Where it runs

Capsomer began as the shared parts of Dustin Edwards's own sites and still runs them, from this site to [Foxing](/software/foxing) and TXASM, each with its own brand color. Every page there is a test of the same components you install.

## Why the name

A capsid is built from many identical capsomers repeated across its surface. A site built with Capsomer is made the same way, from the same small parts repeated across every page.

## On this site

The [colophon](/colophon) describes how this site uses Capsomer.
