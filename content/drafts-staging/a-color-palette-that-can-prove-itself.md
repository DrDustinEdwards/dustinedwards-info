---
title: "A color palette that can prove itself"
slug: a-color-palette-that-can-prove-itself
description: "Designing a WCAG 2.2 palette as an engineering artifact: every claim computed, three failures kept in the text, and one small impossibility proof."
date: 2026-07-28
draft: true
tags: [design, accessibility, color, wcag]
---

I needed a palette for this site. The constraints: one locked brand purple (#4F2D7F), a western Texas character, light and dark modes, and WCAG 2.2 AA throughout. The usual way to do this is taste plus a contrast checker at the end. I did it the other way around: arithmetic first, taste inside the bounds the arithmetic allowed, and every claim in this post is reproducible from a script in the repo.

Three of my attempts failed in instructive ways. They stay in the post, because the failures are where the actual knowledge is.

## The method

WCAG contrast is not a vibe, it is a formula: relative luminance of each color, then (L1 + 0.05) / (L2 + 0.05). Fifteen lines of Python. So before proposing a single hex I wrote the ratio function and ran candidates through it, and no color entered the palette without a computed pair: text on its background, text on its tint, border on its surface. The final system is 60+ pairs, all passing 4.5:1 for text and 3:1 for UI, in both modes.

For the perceptual analysis I used OKLCH rather than HSL, because HSL lightness is a lie: it is a transform of screen RGB, not of human vision, and a yellow and a blue at the same HSL lightness are nowhere near the same brightness. OKLCH is approximately perceptually uniform, with a known caveat that the approximation is weakest in deep blues and purples. My brand color lives exactly there, which is a scientific argument for verifying its pairs individually rather than trusting any formula. I did.

## Failure one: harmony math produces neon

I found a published "Western Sunset" palette whose violet sat 16 degrees of hue from my purple, and tried mapping the whole palette onto my brand by applying the full transform: the hue shift plus the saturation and lightness scaling that carried its violet to my purple. Measured result: desert sand became pure white and the red became #FF1942, which is a nightclub, not Marfa. The purple's depth is a property of the purple, and propagating it destroys its neighbors. The correct re-keying is the hue rotation alone, with per-color contrast tuning afterward. Formulas draft; they do not decide.

## Failure two: my own fix recreated the collision it fixed

Hue analysis flagged that my rust accent sat 16 degrees from my danger red, close enough to confuse, so I moved rust away. Then I assigned the warning role to a burnt tangerine sitting almost exactly where rust had been. Same collision, now between two semantic colors, which is worse. Warning moved to the amber family, where sixty years of UI convention wanted it anyway, and the tangerine went back to decoration. The lesson: run the pairwise check after every change, not once.

## Failure three, and a small impossibility result

I claimed my six chart colors were distinguishable under color vision deficiency because "the lightness spread covers it." Then I computed the pairwise lightness differences. Three pairs sat within 0.01 of each other in OKLab lightness, including an orange-green pair, which is the classic deuteranopia collapse. The claim was false.

Fixing it produced the most interesting number in the project. For unlabeled categorical colors I wanted every pair separated by at least 0.08 in OKLab L, a threshold I chose as an engineering margin, not a citation. Six colors need five gaps, so 0.40 of lightness span. But every chart color also needs 3:1 contrast against the light background, which caps the usable span at roughly 0.30. Six fully lightness-separated categorical colors cannot exist inside AA contrast bounds. This is not a defect of my palette; it is arithmetic, and it is why serious data-visualization palettes are small or rely on redundant encoding. My answer is the same one: a core five on a strict lightness ladder, a sixth color available only to charts with direct labels, and a binding rule that color is never the only channel.

## Testing for color vision deficiency, honestly

I simulated protanopia and deuteranopia with the Vienot 1999 matrices and measured post-simulation OKLab distances for every semantic pair. Worst finding: danger red versus success sage, the exact pair form validation puts side by side, is marginal in light mode and collapses in dark mode under deuteranopia. Blue versus purple fails under both deficiency types.

Two disclosures before anyone quotes that. First, Vienot models complete dichromacy, the worst case; most real color vision deficiency is anomalous trichromacy and milder, so these numbers are a floor, not a portrait of how colorblind readers see. Second, my pass thresholds (0.08 to 0.09 OKLab distance) are chosen working values, not standards.

The resolution is the one accessibility practice has always used and WCAG codifies as success criterion 1.4.1: color is never the sole carrier of meaning. Errors are red plus an icon plus a message. Links are underlined, always, which makes the blue-purple confusion moot. Charts label their series directly. And interactive semantic elements use saturated fills rather than the pastel text colors, which brings me to the last measurement.

## Where WCAG 2 and APCA disagree, measured

AA compliance forced every dark-mode accent light, and WCAG 2's formula rates the resulting pastels generously: my dark danger text scores 8.4:1. APCA, the candidate successor algorithm built on more recent perceptual research, rates the same pair at Lc 60, barely adequate for large text and short of its body-text target. That gap is a known property of the WCAG 2 formula in dark polarity, and it is why my dark mode carries saturated fill variants for buttons: a pink "Delete post" reads gentle, and gentle is the one thing a delete button must not be.

I use APCA as an advisory check only, since WCAG 2.x remains the standard with legal weight. And because quoting an algorithm you implemented yourself invites the fair question of whether you implemented it correctly: my implementation reproduces the published APCA keystone test vectors to the last decimal place, and reports polarity as the conformance rules require. The verification is in the repo next to the palette gate.

## What I will not overclaim

The palette's hues resolved into a recognizable structure: a warm analogous run from crimson through terracotta to amber, balanced by a cool triad, three warm and three cool in both modes. A traditionalist would call it a double split-complementary. I am reporting that as description, not validation, because hue-harmony templates are craft tradition, not science. The measurable coherence is elsewhere: the light-mode anchors span 0.15 of OKLab lightness and the dark-mode chroma spread is 0.06, tight tone bands on both perceptual axes, which the research on color harmony treats as co-equal with hue geometry and which, in my experience of this project, matters more.

## The part that outlives the post

The final system is forty-odd tokens per mode with every ratio recorded, six binding usage rules, and a check script in CI that recomputes the entire contrast matrix from the shipped CSS variables on every build, with APCA as a signed advisory column. If a future edit nudges one hex below its requirement, the build fails and names the pair. A palette that can prove itself is the difference between a design decision and a design document, and the proof costs fifteen lines of Python plus the willingness to keep your failures in the text.

Every number in this post is reproducible from the repository, and the palette you are reading right now is the one being proven.
