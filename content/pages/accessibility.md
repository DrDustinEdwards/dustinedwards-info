---
path: /accessibility
title: "Accessibility"
seo_title: "Accessibility | {{identity.name}}"
description: "What this site's build and browser checks test about accessibility, and how to report a problem they missed."
draft: true
schema_type: WebPage
---

What this site checks about accessibility, and where each check lives. Every statement here describes something the source does; nothing is aspirational. This page claims no overall conformance level, because no check here tests the whole site against one. Where a check measures against a specific WCAG success criterion, the criterion is named.

## Color and contrast

Every color the site uses is a named token, in a light theme and a dark theme. On every build, a check recomputes the contrast of every pair in the site's table of color pairs, such as body text on the page, a link on the page, and a label on a filled button, and fails the build if any pair drops below its minimum. Text pairs are held to 4.5:1, the WCAG 2 minimum for normal text (success criterion 1.4.3, level AA). Borders, focus rings and other parts of the interface are held to 3:1 (success criterion 1.4.11). The check also confirms that the dark theme chosen with the theme button and the dark theme your device asks for are the same colors.

If your device asks for more contrast, the site switches to a higher-contrast set of muted text and border colors, and the same check confirms that each of them clears its minimum and is stronger than the default it replaces. The colors of highlighted code are measured too, in both themes.

How the palette was designed, and why the check exists, is in [Designing a color palette the build can check](/writing/color-palette-the-build-can-check).

## Images, charts and diagrams

The build refuses a figure, a cover image, a chart or a diagram that has no text alternative, and the prose pages may not carry images at all. A chart is drawn on the server with [Enarratio](/software/enarratio): its image carries the alternative text as its accessible name, and an equivalent data table, generated from the same data, follows it, so the numbers are there for a screen reader rather than only a summary. A test fails if either goes missing. How the charts are built is in [Observable Plot inside a Worker](/writing/observable-plot-inside-a-worker).

## Reading without script

The public pages are rendered complete on the server, and their scripts only add to them. The site keeps a list of every one of those scripts with what a reader gets when it does not run, and a check fails when a script is missing from the list or the fallback it names cannot be found in the server-rendered code. How that works is in [A blog reading experience that works without JavaScript](/writing/blog-reading-without-javascript).

## Keyboard and focus

A browser check runs these against the site:

- Each page tested starts with a skip link, and the place it points to exists.
- The header menus open with Enter or Space, close with Escape, and hand focus back to the button that opened them. While a menu is open, the rest of the page is inert.
- An enlarged image opens in a real modal dialog that takes focus, closes with Escape, and returns focus to the link that opened it.
- A footnote preview stays open while the pointer moves onto it, closes with Escape without moving focus, and does not vanish on scroll (success criterion 1.4.13).
- The footer's links are in the same order on every page tested, so help is found in the same place (success criterion 3.2.6).
- The theme button is at least 24 by 24 CSS pixels.

## Motion and small screens

If your device asks for reduced motion, the animated transition between pages is turned off, and a browser check confirms it. The same checks load the home page, the article list, search, the colophon and the software page at 320 pixels wide and fail if any of them scrolls sideways.

## The system map

The [system map](/systems) has its own check on every change to it: every node can be reached by keyboard, it respects reduced motion, and the axe accessibility engine, run with its WCAG 2.0, 2.1 and 2.2 level A and AA rules, finds nothing in either theme.

## What is not checked

Anything not named above is not tested by a check, and this page makes no claim about it. The checks run against this site's own code and content; the pages on other sites that it links to are outside them.

## Report a problem

If something on this site is hard or impossible to use, please say so through the [contact page](/contact). Say which page, what you were trying to do, and what you use to browse if you are willing to share it. A problem a check missed is a bug in the check as well as the page.
