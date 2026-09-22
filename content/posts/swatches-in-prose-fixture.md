---
title: "Swatches in prose: the colors the pipeline has to survive"
slug: swatches-in-prose-fixture
description: "A pipeline fixture carrying every form the swatch directive accepts: the three hex lengths, a prose label, both spellings of one color, a chip against each surface, and the directive written inside a code fence where it must stay text."
date: 2026-09-08
tags: [design, color]
draft: true
---

This post is a fixture, on the same footing as the math and chart fixtures
beside it. It exists so the swatch directive has real chips in the corpus, which
is what lets `check:content` compare the rendered html against the stored
markdown over the whole corpus, and what gives `check:browser` a page to measure
at 1280 and 375 in both themes. It is `draft: true` and stays that way: nothing
here is written for a reader.

The prose is deliberately thin. Every swatch below is here because a gate
asserts something about it.

## The three hex lengths

Six digits, the ordinary case, and the one every other post will use:
:swatch[#4F2D7F] is the ratified brand purple.

Three digits, which the directive expands nowhere and passes through as written:
:swatch[#ABC] is a short hex, and the chip beside it is the color a browser
resolves it to.

Eight digits, carrying alpha: :swatch[#4F2D7FCC] is the same purple at 80
percent, composited over whatever surface the chip is sitting on. Nothing in the
pipeline flattens it, so what is drawn here is a real composite and not a
precomputed solid.

## A label that is not the hex

When the color has a name worth reading, the label carries the name and the
attribute carries the value: :swatch[Bluebonnet purple]{color=#4F2D7F} and
:swatch[Prairie gold]{color=#E0A428} both render a chip beside a word rather
than beside a number.

## Two spellings, one page

These two are written differently in the source and must render identically:
:swatch[#6b4fbb] and :swatch[#6B4FBB]. The renderer upper-cases every hex on the
way out, so the html carries one spelling no matter which one was typed, and
`check:content` asserts the case fold on the output rather than trusting the
validator to have done it.

## Chips that fight their own surface

The border is the reason these are still visible. A chip at or near the light
canvas, :swatch[#FAF7F2], and one at or near the dark canvas, :swatch[#1A1614],
each disappear into one of the two themes without it. Both are in the fixture so
a border regression shows up as an invisible square in a screenshot rather than
as nothing at all.

## Inside a code fence, where it stays text

The block below documents the syntax. Every line in it is literal: no chip is
rendered here, and `check:content` strips fenced code before it looks for the
directive, so a post that explains the feature is not read as a post whose
swatches failed to render.

```markdown
:swatch[#6B4FBB]
:swatch[Brand purple]{color=#6B4FBB}
```

The same is true of an inline code span: `:swatch[#6B4FBB]` written this way is
a string about the directive, not a use of it.

## What is refused

Not shown, because each one fails the build by design: a named color, an
`rgb()` call, a `color-mix()` expression, `currentColor`, and any hex that is
not three, six or eight digits. The refusals are exercised by the plants in the
gate rather than by this file, since a fixture carrying one could not be
rendered at all.
