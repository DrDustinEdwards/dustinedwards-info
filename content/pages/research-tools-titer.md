---
path: /research/tools/titer
title: "Phage Titer Calculator"
seo_title: "Phage Titer Calculator: pfu/ml and Spot Titers"
description: "Calculate a phage lysate's titer in pfu/ml from a plaque count, the volume plated and the dilution, for a full plate or spot titer, with every step shown."
---

The titer of a phage lysate is the number of plaque-forming units (pfu) in each ml. It comes from counting the plaques on a plate, or in a spot, that received a known volume of a known dilution.

## Formula

    titer (pfu/ml) = plaques counted / µl plated x 1,000 µl/ml x dilution factor

The dilution factor is 10^n for a 10^-n dilution, and 1 for undiluted lysate. A spot titer uses the same formula with the volume of the spot. To check the answer, its exponent is about log10(plaques per µl) + 3 + n; a titer never has a negative exponent.

## Worked example: full plate titer

From the lab's notebooks: 111 plaques on the plate that received 10 µl of the 10^-6 dilution.

1. Plaques per µl: 111 / 10 µl = 11.1 pfu/µl.
2. Per ml: 11.1 x 1,000 = 11,100 pfu/ml in the 10^-6 dilution.
3. Undo the dilution: 11,100 x 10^6 = 1.11 x 10^10 pfu/ml.
4. Check the exponent: log10(11.1) + 3 + 6 = 1.05 + 3 + 6 = 10.05, so the titer is in the 10^10 range.

The titer is 1.11 x 10^10 pfu/ml.

## Worked example: spot titer

From the lab's notebooks: 6 plaques in a 3 µl spot of the 10^-3 dilution.

1. Plaques per µl: 6 / 3 µl = 2 pfu/µl.
2. Per ml: 2 x 1,000 = 2,000 pfu/ml in the 10^-3 dilution.
3. Undo the dilution: 2,000 x 10^3 = 2 x 10^6 pfu/ml.
4. Check the exponent: log10(2) + 3 + 3 = 0.30 + 3 + 3 = 6.30, so the titer is in the 10^6 range.

The titer is 2 x 10^6 pfu/ml. A 10 µl spot is worked the same way, dividing by 10 µl.

## Where the numbers come from

- **10 µl plated.** The lab's full plate titer plates 10 µl of each dilution with 250 µl of host: [full plate titer](/research/protocols/phage-isolation#full-plate-titer).
- **3 µl spots.** The lab runs the Phage Discovery Guide's spot titer with 3 µl spots: [spot titer](/research/protocols/phage-isolation#spot-titer).
- **The worked examples** are from the lab's notebooks, as given in [Lab Calculations and Common Questions](/teaching/virus-isolation/faq), which lists more of them.

## Mistakes the steps catch

The notebooks show the same slips again and again: flipping the sign of the exponent (4 x 10^-7 written for 4 x 10^7), dividing by the wrong volume (376 plaques from 10 µl undiluted is 3.76 x 10^4 pfu/ml, not 3.76 x 10^5), leaving a spot titer undivided by the spot volume, and reporting pfu per µl instead of per ml. Each of these shows up in one of the steps above.

For three or more plate counts, with trimmed means and confidence intervals, use Stephen Abedon's [Titering and EOP Calculator](https://titering.phage.org/). The other calculators here are the [serial dilution planner](/research/tools/dilution) and the [webbed plate calculator](/research/tools/webbed-plate).
