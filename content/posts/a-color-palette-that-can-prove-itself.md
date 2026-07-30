---
title: "Build a color palette that can prove itself"
slug: a-color-palette-that-can-prove-itself
description: "A working method for designing a WCAG 2.2 palette as an engineering artifact: the ratio function, the pairwise matrix, CVD simulation, the chart ladder math, and a build gate that keeps it honest."
date: 2026-07-28
tags: [design, accessibility, color, wcag]
draft: false
first_published: 2026-07-30
---

This is a method for building a site palette the way you would build any other engineered artifact: requirements first, arithmetic before taste, and a check in the build so the properties you proved stay proved. I used it to build the palette this site is wearing. You need about fifteen lines of Python, a free evening, and the willingness to let a computation veto a color you like.

The constraints I was working under, so you can map them to yours: one locked brand color (a deep purple, `#4F2D7F`), light and dark modes, WCAG 2.2 AA everywhere, and a regional character I wanted to keep (warm West Texas neutrals rather than the blue-gray everything defaults to). Your brand color and character will differ. The method does not.

Three of my attempts failed along the way. I have left them in as warnings at the point in the procedure where you would make the same mistake, because you probably will, and recognizing the failure is faster than rediscovering it.

## Step 1: write the ratio function before choosing any color

WCAG contrast is a formula, not a judgment. Relative luminance for each color, then `(L1 + 0.05) / (L2 + 0.05)` with the lighter luminance on top. Write it yourself rather than relying on a web checker, because you are about to run hundreds of pairs and you want them in a loop:

```python
def srgb_channel(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def luminance(hexcolor):
    h = hexcolor.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return (0.2126 * srgb_channel(r)
          + 0.7152 * srgb_channel(g)
          + 0.0722 * srgb_channel(b))

def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)
```

The targets you will hold every pair to: `4.5:1` for normal text, `3:1` for large text and for user interface components such as borders and focus indicators. Those come from WCAG 2.2 success criteria 1.4.3 and 1.4.11. Write them down as constants; they are about to become your veto.

## Step 2: inventory the roles before the colors

A palette is not a list of nice colors, it is a set of jobs. List the jobs first, because the jobs determine how many computed pairs each color owes you. The inventory that has worked for me, and that most sites eventually converge on whether they planned to or not:

Neutrals: page background, one or two raised surfaces, body text, muted text, disabled text, a default border, a strong border. Brand: the brand color itself, hover and active steps, a tinted surface, a visited-link color, text selection, and a focus ring, including a focus ring that will sit on top of brand-colored fills, which people forget until their primary button's focus outline vanishes into the button. Semantic roles, one hue each: danger, warning, success, info. For each semantic role you want four variants: a text color, a tinted background, a border, and a saturated fill for interactive elements. The fill tier is the one most palettes are missing, and the reason it matters is a dark-mode problem I will get to in step 6. Then a highlight color for search marks, and a categorical set for charts.

Count the pairs this implies: every text on its background, every text on its tint, every border on its surface, every fill against its label text. Mine came to sixty-plus pairs per mode. That number is why step 1 was a function and not a website.

## Step 3: work in OKLCH, not HSL

When you start generating candidates, use OKLCH coordinates (lightness, chroma, hue) rather than HSL. HSL lightness is a transform of screen RGB, not of human vision: a yellow and a blue at the same HSL lightness differ enormously in perceived brightness, so any reasoning you do about "same lightness" in HSL is wrong before you start. OKLCH is approximately perceptually uniform, browsers support it natively in CSS now, and every serious color tool speaks it.

One caveat you should carry: the OKLab model's approximation is weakest in deep blues and purples. If your brand color lives there, as mine does, treat OKLCH as the drafting space and the WCAG ratio function as the verdict, and verify every pair involving the brand individually rather than trusting anything derived.

A warning from my first failed attempt. I found a published palette whose violet sat sixteen degrees of hue from my brand purple and tried to adapt the whole palette by applying the full transform between the two violets, hue shift plus the saturation and lightness scaling, to every color. The result was neon: the sand tone went to pure white and the red landed on `#FF1942`. The depth of a dark brand color is a property of that color, and propagating its lightness transform destroys its neighbors. If you adapt an existing palette, rotate hue only, then re-tune each color's lightness individually against your contrast targets. Formulas draft. They do not decide.

## Step 4: run the full pairwise matrix, and rerun it after every change

Put your candidate hexes in a table of (foreground, background, required ratio) triples and loop the ratio function over all of them. Any pair below its requirement fails the whole candidate set; adjust the OKLCH lightness of the offender and rerun. You will iterate this loop dozens of times, which is fine, because it is a loop.

The warning attached to this step comes from my second failure. Partway through, a hue analysis showed my decorative rust accent sitting sixteen degrees from my danger red, close enough that the two could be confused, so I moved rust away. Then, choosing a warning color, I picked a burnt tangerine that sat almost exactly where rust had been, and recreated the same collision between two colors that now both carried meaning. The fix was moving warning to the amber family, where decades of interface convention already put it. The procedural lesson is the one to keep: the pairwise check, both the contrast matrix and a simple hue-distance scan between roles, runs after every change, not once at the end. A palette is a system, and edits have neighbors.

## Step 5: the chart ladder, and an impossibility worth knowing in advance

Categorical chart colors have a harder job than interface colors: they must be distinguishable from each other, not just from the background, including by readers with color vision deficiency. The reliable channel for that is lightness, because it survives every type of CVD. So build your chart set as a lightness ladder: pick your hues, then force their OKLab lightness values apart by a fixed margin.

Here is the arithmetic that will stop you from promising too much, and it is worth doing for your own numbers before you commit to a set size. I wanted every pair of unlabeled categorical colors separated by at least `0.08` in OKLab lightness, a margin I chose as an engineering value, not a citation. Six colors means five gaps, so `0.40` of total lightness span. But every chart color must also hold `3:1` against the page background, and on my light background that constraint caps the usable lightness span at roughly `0.30`. Six fully lightness-separated categorical colors cannot exist inside AA contrast bounds. That is not a property of my palette; it is arithmetic, and it is why mature data visualization palettes are small or lean on redundant encoding. My resolution, which I recommend as the general pattern: a core set of five on a strict ladder, safe anywhere; a sixth color permitted only in charts whose series are directly labeled; and a binding rule that hue alone is never the distinguishing channel between adjacent series.

I arrived at this the embarrassing way: I claimed my six chart colors were CVD-safe because "the lightness spread covers it," then computed the pairwise differences and found three pairs within `0.01` of each other, including an orange against a green, the classic deuteranopia collapse. Compute before you claim. It is the entire method in four words.

## Step 6: simulate color vision deficiency, and read the results honestly

Simulate protanopia and deuteranopia with the Vienot 1999 matrices, applied in linear RGB, then measure the OKLab distance between each pair of colors that carry meaning near each other. The pairs to care about most are the ones your interface will actually juxtapose: danger against success (form validation puts them side by side), link color against body text, and adjacent chart series.

My results, so you know what to expect: danger red versus success sage was marginal in light mode and collapsed in dark mode under deuteranopia, and blue versus purple failed under both deficiency types. Yours will fail somewhere too, because no six-hue palette passes on hue alone, and knowing that changes what the fix is. The fix is not better hues. It is the rule WCAG codifies as success criterion 1.4.1: color is never the only channel. Errors are red plus an icon plus a message. Links are underlined. Charts label series directly. Once those rules are binding, the CVD simulation stops being a pass-fail test of your hues and becomes a map of exactly where the second channel is load-bearing.

Two disclosures to attach if you publish your own numbers, because a careful reader will ask. The Vienot matrices model complete dichromacy, the worst case; most real CVD is anomalous trichromacy and milder, so simulated results are a floor, not a portrait. And any OKLab distance threshold you adopt as a pass mark is a chosen engineering value; there is no standard to cite for it, and pretending otherwise is the kind of overclaim that gets a methods section rejected.

## Step 7: dark mode is where WCAG 2 needs a second opinion

Dark mode will force every accent color light, because that is what the contrast math demands against a dark background. Run those pastels through WCAG 2 and they score generously; my dark danger text scores `8.4:1`. Then run them through APCA, the candidate successor contrast algorithm built on more recent perceptual research, and watch the same pastel score around `Lc 60`, adequate for large text and short of body-text targets. That disagreement is a known property of the WCAG 2 formula in dark polarity, and it has a practical design consequence you can adopt regardless of which algorithm you trust: interactive semantic elements in dark mode should use saturated fill variants, not pastel text colors, because a soft pink Delete button reads gentle, and gentle is the one thing a delete button must not be.

Use APCA as an advisory column, not a gate, since WCAG 2.x remains the standard with legal weight. And if you implement APCA yourself, verify the implementation against the published keystone test vectors before you quote a single number from it; mine reproduces them to the last decimal, and checking took ten minutes that made every subsequent claim defensible.

## Step 8: wire it into the build, or you did all of this once

The palette is only proved for as long as nothing changes, which is to say, it is not proved at all unless the proof runs automatically. The last step is a script in your build that reads the shipped CSS custom properties, recomputes the entire pairwise matrix from the actual deployed values, fails the build if any pair drops below its requirement, and prints the APCA advisory alongside. Mine currently checks the full matrix across both modes on every build, and if a future edit nudges one hex below its floor, the build fails and names the pair.

Before you trust that gate, break it on purpose: change one value to something failing and confirm the build goes red with the right pair named. A gate you have never seen fail is a hope, not a gate.

Two smaller rules that earn their keep once the gate exists. Keep the palette's authoritative values in one specification document with every ratio recorded, so the gate has a source of truth to check the CSS against rather than checking the CSS against itself. And write your usage rules down as numbered law next to the values: color never the sole channel, links underlined, charts labeled, one semantic tint per view, fills for interactive semantics. The colors pass contrast; the rules are what make the system accessible, and a palette document without them is half a deliverable.

What you get at the end is fifty-odd tokens per mode, every ratio recorded, a handful of binding rules, and a build that refuses to ship a regression. The method costs one evening more than picking colors by eye. The difference is that when someone asks whether your palette is accessible, you can answer with a script instead of an adjective, and when you change a color next year, the build will tell you what you broke before your readers do.
