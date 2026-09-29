---
path: /research/tools/lysate-volume
title: "Lysate Volume Planner"
seo_title: "Phage Lysate Volume Planner for Webbed Plates"
description: "How much phage lysate a set of webbed plates needs, from the lysate's titer, the pfu wanted per plate and the number of plates, with every step shown."
---

Before pouring a set of webbed plates, it helps to know how much lysate the whole set will use and whether it can go on undiluted. This planner works that out from the lysate's titer, the pfu wanted on each plate and the number of plates.

## Formula

    lysate needed (µl) = pfu wanted per plate x plates / titer (pfu/ml) x 1,000 µl/ml
    lysate per plate (µl) = lysate needed / plates

If the lysate per plate is less than the volume you plate on each plate, the lysate is mixed with phage buffer to make plates x µl per plate, and that mix is plated. If the lysate needed is under 1 µl, it is too little to pipette, and the [webbed plate calculator](/research/tools/webbed-plate) plans a serial dilution instead.

## Worked example

These numbers are illustrative, chosen to make the arithmetic easy to follow: a lysate at 1 x 10^7 pfu/ml, 10,000 pfu on each plate, 6 plates, 10 µl plated per plate.

1. pfu for all plates: 10,000 x 6 = 60,000 pfu.
2. Lysate for all plates: 60,000 / 1 x 10^7 pfu/ml x 1,000 µl/ml = 6 µl.
3. Per plate: 6 µl / 6 = 1 µl.
4. To plate 10 µl on each: 6 plates x 10 µl = 60 µl, so mix 6 µl lysate + 54 µl phage buffer.

The plan is 6 µl of lysate in 60 µl, 10 µl on each of 6 plates.

## How many pfu make a web

The 10,000 pfu the calculator opens with is the worked example's number, not a lab setting, because what webs depends on plaque size and host. In the lab's notebooks, on *Mycobacterium smegmatis* 1,000 to 4,000 pfu gave no web and 8,000 to 12,000 pfu webbed. For one *Microbacterium foliorum* phage, about 5,000 pfu gave few or no webs and about 20,000 pfu webbed ([Lab Calculations and Common Questions](/teaching/virus-isolation/faq)). When nothing has webbed yet, bracket across a 10-fold series first ([the bracketing shortcut](/research/protocols/phage-isolation#the-bracketing-shortcut)).

## Where the numbers come from

- **10 µl plated per plate**, with 250 µl of host: [full plate titer](/research/protocols/phage-isolation#full-plate-titer).
- **About 6 plates** for 10 ml to archive plus 10 ml for DNA extraction: [yields](/research/protocols/phage-isolation#yields).
- **No more than 25 µl of lysate** on 250 µl of host (10% of the cell volume), or the cells lyse: [the bracketing shortcut](/research/protocols/phage-isolation#the-bracketing-shortcut). The calculator warns above it.

The other calculators are the [titer calculator](/research/tools/titer), the [serial dilution planner](/research/tools/dilution), the [webbed plate calculator](/research/tools/webbed-plate), the [MOI calculator](/research/tools/moi) and the [efficiency of plating calculator](/research/tools/eop).
