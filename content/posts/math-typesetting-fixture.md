---
title: "Math on Workers: the expressions the pipeline has to survive"
slug: math-typesetting-fixture
description: "A pipeline fixture carrying every KaTeX construction the gates assert on: inline and display, fractions, Greek, subscripts, a matrix, and a display line far wider than the column."
date: 2026-09-06
tags: [cloudflare, math]
draft: true
---

This post is a fixture, on the same footing as the chart fixture beside it. It
exists so the math pipeline has real expressions in the corpus, which is what
lets `check:content` render them twice and byte-compare, and what gives
`check:browser` a page to measure at 375px. It is `draft: true` and stays that
way: nothing here is written for a reader.

The prose is deliberately thin. Every expression below is here because a gate
asserts something about it.

## Inline

The one everybody knows, $E = mc^2$, set inside a sentence so the baseline and
the line height can be looked at against the text around it. Beside it, a
subscript and a superscript in running prose: the $i$-th residual is
$r_i = y_i - \hat{y}_i$, and its square is $r_i^2$.

Greek, inline, because the letters come from `KaTeX_Math` rather than from the
face the rest of the sentence uses: $\alpha$, $\beta$, $\gamma$, $\sigma$,
$\theta$, $\mu$, $\Sigma$, $\Omega$.

An inline fraction, $\tfrac{1}{2}$, which KaTeX sets at text size rather than
opening the line up.

## Display

A display fraction on its own line:

$$
\frac{\partial u}{\partial t} = \alpha \nabla^2 u
$$

A sum with limits above and below, which is the construction that makes a line
taller than the one before it:

$$
\bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i
$$

## A matrix

Two by two, with double subscripts, because the array machinery and the
stretched brackets are separate parts of KaTeX and each has its own font:

$$
A = \begin{bmatrix} a_{11} & a_{12} \\ a_{21} & a_{22} \end{bmatrix}
$$

## A line that does not fit

This one is here to overflow. The column is 44rem and this expression is wider
than that on a desktop, let alone on a phone, so it is what proves the display
box scrolls inside itself instead of dragging the document sideways:

$$
L(\theta) = \prod_{i=1}^{N} p(x_i \mid \theta) \cdot \exp\left(-\frac{1}{2}\sum_{j=1}^{M}\left(\frac{y_j - f(x_j;\theta)}{\sigma_j}\right)^2\right) \cdot \frac{1}{\sqrt{2\pi\sigma^2}} \cdot \Gamma(\alpha+\beta) \cdot \binom{n}{k}
$$

## A dollar sign that is not math

KaTeX only claims a `$` that pairs with another one, so a lone dollar in prose
is still a dollar: the Workers paid plan is $5 a month. That sentence is in the
fixture because it is the regression an author would hit first.
