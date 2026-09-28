---
path: /research/tools/webbed-plate
title: "Webbed Plate Calculator"
seo_title: "Webbed Plate Calculator: Phage Lysate Volumes"
description: "How much phage lysate and which dilution to plate for webbed plates from a lysate of known titer, and how much lysate flooding them gives back."
---

A webbed plate has so many plaques that they touch, leaving a lacy web of host. Flooding webbed plates with phage buffer gives the high-titer lysate. This calculator works out what to plate for a web from a lysate of known titer, and how much lysate the plates should give back.

## Formula

    µl of lysate per plate = pfu wanted per plate / titer (pfu/ml) x 1,000 µl/ml
    concentration to plate (pfu/ml) = pfu wanted per plate / µl plated x 1,000 µl/ml
    lysate recovered (ml) = plates flooded x 5 to 7 ml
    plates needed = ml of lysate wanted / 5 to 7 ml per plate

The volume from the first line is usually far too small to pipette, so it is plated by dilution: the lysate is diluted to the concentration in the second line (with the [serial dilution planner](/research/tools/dilution)'s arithmetic) and a pipettable volume of the last tube goes on each plate.

## Worked example: plating the web

A lysate at 1.11 x 10^10 pfu/ml, aiming for 11,100 pfu on each plate, 10 µl per plate, 6 plates. The titer and target are from the lab's notebooks ([Lab Calculations and Common Questions](/teaching/virus-isolation/faq)).

1. Lysate per plate: 11,100 / 1.11 x 10^10 pfu/ml x 1,000 µl/ml = 1 x 10^-3 µl.
2. To plate that in 10 µl, the tube must hold 11,100 pfu / 10 µl x 1,000 = 1.11 x 10^6 pfu/ml.
3. Total dilution: 1.11 x 10^10 / 1.11 x 10^6 = 10,000-fold.
4. That is 10^4: four 10-fold steps.
5. Tube 1: 10 µl lysate + 90 µl phage buffer = 10^-1, 1.11 x 10^9 pfu/ml.
6. Tube 2: 10 µl tube 1 + 90 µl phage buffer = 10^-2, 1.11 x 10^8 pfu/ml.
7. Tube 3: 10 µl tube 2 + 90 µl phage buffer = 10^-3, 1.11 x 10^7 pfu/ml.
8. Tube 4: 10 µl tube 3 + 90 µl phage buffer = 10^-4, 1.11 x 10^6 pfu/ml.
9. Enough of the last tube: 6 plates x 10 µl = 60 µl.

Plate 10 µl of tube 4 on each of the 6 plates. In the notebook this lysate came from, six of seven plates made this way webbed in 24 hours, and the pooled lysate titered 2.2 x 10^11 pfu/ml.

## Worked example: lysate from flooding

The same 6 plates, each flooded with 8 ml of phage buffer:

1. Flooded with 8 ml of phage buffer each, a plate returns about 5 to 7 ml.
2. 6 plates x 5 to 7 ml = 30 to 42 ml of lysate.

The other way round, for 20 ml of lysate (10 ml to archive plus 10 ml for DNA extraction):

1. At 7 ml per plate: 20 / 7 = 2.86, so 3 plates.
2. At 5 ml per plate: 20 / 5 = 4, so 4 plates.

The lab plans 6 plates for this, because some plates do not web or yield less.

## How many pfu make a web

It depends on plaque size, so no calculator can supply it. In the lab's notebooks, on *Mycobacterium smegmatis* 1,000 to 4,000 pfu gave no web and 8,000 to 12,000 pfu webbed. For one *Microbacterium foliorum* phage, about 5,000 pfu gave few or no webs and about 20,000 pfu webbed, and targets of 280 to 1,500 pfu never webbed on *M. foliorum*. The dilution that webs also shifts between lysate batches, so the lab brackets: it plates a 10-fold series across whole decades, sees which one webs, and pours more plates of that one ([the bracketing shortcut](/research/protocols/phage-isolation#the-bracketing-shortcut)).

## Where the numbers come from

- **10 µl plated per plate**, with 250 µl of host: [full plate titer](/research/protocols/phage-isolation#full-plate-titer).
- **No more than 25 µl of lysate** on 250 µl of host (10% of the cell volume), or the cells lyse: [the bracketing shortcut](/research/protocols/phage-isolation#the-bracketing-shortcut). The calculator warns above it.
- **8 ml flood, 5 to 7 ml back per plate, and about 6 plates** for 10 ml to archive plus 10 ml for DNA extraction: [yields](/research/protocols/phage-isolation#yields). Dry or aged plates return less; one returned only 3.5 ml of an 8 ml flood.
