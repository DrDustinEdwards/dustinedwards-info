---
path: /research/tools/dilution
title: "Serial Dilution Planner"
seo_title: "Phage Serial Dilution Calculator: Plan the Tubes"
description: "Plan a serial dilution of a phage lysate to a target concentration: how many 10-fold tubes, what to carry and how much buffer, with every step shown."
---

A serial dilution takes a lysate down to a concentration you can plate: countable plaques for a titer, or the right number of pfu for a webbed plate. This planner works out the tubes from the lysate's titer and the concentration you want.

## Formula

    10 µl phage + 90 µl phage buffer = 1/10
    total dilution = starting titer (pfu/ml) / target concentration (pfu/ml)
    10-fold steps = the whole part of log10(total dilution)

When the total is not a power of ten, one last, smaller step takes up the rest: carry v µl into v x (fold - 1) µl of buffer. Each tube's concentration is the one before it divided by that step's fold. If you need more than the last tube holds, for example plates x µl per plate, the last tube is made larger, and each tube before it at least as large as the next one takes.

## Worked example: a power of ten

A lysate at 1.11 x 10^10 pfu/ml (the [titer calculator](/research/tools/titer)'s worked example), diluted so that 10 µl carries 11,100 pfu, which is 1.11 x 10^6 pfu/ml (the [webbed plate calculator](/research/tools/webbed-plate)'s worked example).

1. Total dilution: 1.11 x 10^10 / 1.11 x 10^6 = 10,000-fold.
2. That is 10^4: four 10-fold steps.
3. Tube 1: 10 µl lysate + 90 µl phage buffer = 10^-1, 1.11 x 10^9 pfu/ml.
4. Tube 2: 10 µl tube 1 + 90 µl phage buffer = 10^-2, 1.11 x 10^8 pfu/ml.
5. Tube 3: 10 µl tube 2 + 90 µl phage buffer = 10^-3, 1.11 x 10^7 pfu/ml.
6. Tube 4: 10 µl tube 3 + 90 µl phage buffer = 10^-4, 1.11 x 10^6 pfu/ml.

The notebook that ran this lysate made the same 10^-4 in two tubes instead of four: 1 µl lysate + 999 µl buffer (10^-3), then 7 µl of that + 63 µl buffer (10^-4). That makes 70 µl, enough for 7 plates at 10 µl ([Lab Calculations and Common Questions](/teaching/virus-isolation/faq)).

## Worked example: not a power of ten

From the lab's notebooks: a 3.0 x 10^9 pfu/ml lysate, with a target of 6,000 pfu for a webbed plate, is 6 x 10^5 pfu/ml in a 10 µl plating ([the bracketing shortcut](/research/protocols/phage-isolation#the-bracketing-shortcut)).

1. Total dilution: 3 x 10^9 / 6 x 10^5 = 5,000-fold.
2. That is 10^3 x 5: three 10-fold steps, then one 5-fold step.
3. Tube 1: 10 µl lysate + 90 µl phage buffer = 10^-1, 3 x 10^8 pfu/ml.
4. Tube 2: 10 µl tube 1 + 90 µl phage buffer = 10^-2, 3 x 10^7 pfu/ml.
5. Tube 3: 10 µl tube 2 + 90 µl phage buffer = 10^-3, 3 x 10^6 pfu/ml.
6. Tube 4: 10 µl tube 3 + 40 µl phage buffer = 1/5,000, 6 x 10^5 pfu/ml.

## Where the numbers come from

- **10 µl into 90 µl.** The lab's 10-fold series carries 10 µl of each tube into the next 90 µl, and the first tube is 10^-1: [Lab Calculations and Common Questions](/teaching/virus-isolation/faq).

## Mistakes to avoid

From the notebooks: 10 µl of phage into 100 µl of buffer is 1/11, not 1/10. An extra "original" tube before the 10^-1 tube shifts every plate one step, so every titer is off 10-fold. And each purification round starts again at 10^-1 from its new pick ([phage purification](/research/protocols/phage-isolation#phage-purification-picking-and-replating-plaques)).
