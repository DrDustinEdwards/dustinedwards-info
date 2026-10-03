---
path: /teaching/virus-isolation/faq
title: "Lab Calculations and Common Questions"
seo_title: "Phage Lab Calculations: pfu/ml, Spot Titer, Webbed Plates"
description: "Worked phage lab calculations from the Tarleton Virus Isolation Course: pfu/ml titers, spot titer dilutions, webbed plate volumes and lysate yields."
---

These are the calculations and questions that come up most in the [Virus Isolation Course](/teaching/virus-isolation), the first semester of the Tarleton SEA-PHAGES program. The bench protocols are in the [SEA-PHAGES Phage Discovery Guide](https://discoveryguide.seaphages.org/); this page is the lab's own arithmetic and findings. Each answer gives the formula, a worked example with real numbers from the course's lab notebooks, and a link to the lab's notes in [Phage Isolation and Purification](/research/protocols/phage-isolation). Unless a question says otherwise, the host is *Microbacterium foliorum* in PYCa, plated with 250 µl of host culture.

To run these calculations on your own numbers, with every step shown, use the [phage lab calculators](/research/tools): [titer](/research/tools/titer), [serial dilution](/research/tools/dilution), [webbed plate](/research/tools/webbed-plate), [MOI](/research/tools/moi), [efficiency of plating](/research/tools/eop) and [lysate volume](/research/tools/lysate-volume).

## How do I calculate phage titer in pfu/ml?

Divide the plaques counted by the µl of that dilution plated, multiply by 1,000 µl/ml, then multiply by the dilution factor: 111 plaques from 10 µl of the 10^-6 dilution is 1.11 x 10^10 pfu/ml.

    titer (pfu/ml) = plaques counted / µl plated x 1,000 µl/ml x dilution factor

The dilution factor is 10^n for a 10^-n dilution.

Worked example: 111 plaques on the plate that received 10 µl of the 10^-6 dilution.

1. Plaques per µl of that dilution: 111 / 10 µl = 11.1 pfu/µl.
2. Per ml: 11.1 x 1,000 = 11,100 pfu/ml, still of the 10^-6 dilution.
3. Undo the dilution: 11,100 x 10^6 = 1.11 x 10^10 pfu/ml.

Check the exponent: log10(plaques per µl) + 3 + n = 1.05 + 3 + 6, about 10, so the answer is in the 10^10 range. A titer never has a negative exponent.

More worked results, all from 10 µl plated:

| Plaques | Dilution | Titer |
| --- | --- | --- |
| 81 | 10^-3 | 8.1 x 10^6 pfu/ml |
| 40 | 10^-4 | 4 x 10^7 pfu/ml |
| 42 | 10^-6 | 4.2 x 10^9 pfu/ml |
| 10 | 10^-8 | 1.0 x 10^11 pfu/ml |
| 376 | undiluted | 3.76 x 10^4 pfu/ml |

Common errors to avoid: 40 plaques at 10^-4 is 4 x 10^7, not 4 x 10^-7; 376 plaques from 10 µl undiluted is 3.76 x 10^4, not 3.76 x 10^5; and report per ml, not per µl. Count on a light box, since a miscount carries straight into the web volumes.

Protocol: [titer arithmetic](/research/protocols/phage-isolation#titer-arithmetic).

## How do I calculate phage titer from a spot titer, and how many dilutions do I spot?

Divide the plaques in one spot by the µl spotted, multiply by 1,000 µl/ml and by the dilution factor, and spot a tenfold series far enough that the last spots show separate plaques you can count, usually 10^-1 to 10^-8 for a lysate.

    titer (pfu/ml) = plaques in the spot / µl spotted x 1,000 µl/ml x dilution factor

The lab spots 3 µl of each tenfold dilution.

Worked example: 6 plaques in a 3 µl spot of the 10^-3 dilution.

6 / 3 µl = 2 pfu/µl; x 1,000 = 2,000; x 10^3 = 2 x 10^6 pfu/ml.

How far to dilute: for lysates the notebooks ran series from 10^-1 to 10^-8. When every plate to 10^-6 was still uncountable on a full plate titer, extending the series to 10^-12 gave counts of about 300 at 10^-7 and about 35 at 10^-9. Divide by the spot volume (3 µl) every time.

To keep spots from running together, use a 1 to 10 µl pipettor and bubble-free tubes, and let spots soak in before moving the plate. Read at about 23 hours; by 26 hours spots merge, and by 48 they dry out.

Protocol: [spot titer](/research/protocols/phage-isolation#spot-titer).

## How much phage lysate do I put on a plate to get a webbed plate?

Divide the pfu you want on the plate by the lysate's titer in pfu/ml and multiply by 1,000 µl/ml; on *M. smegmatis*, plates that received 8,000 to 12,000 pfu webbed.

    µl of lysate per plate = pfu wanted per plate / titer (pfu/ml) x 1,000 µl/ml

Worked example: a lysate at 1.1 x 10^10 pfu/ml, aiming for about 11,100 pfu per plate.

11,100 / 1.1 x 10^10 x 1,000 = 1.01 x 10^-3 µl of lysate per plate.

That volume is too small to pipette, so it is made by dilution: 1 µl lysate in 999 µl buffer, then 7 µl of that into 63 µl buffer, and 10 µl of the second tube per plate. Six of seven plates webbed in 24 hours, and the pooled lysate titered 2.2 x 10^11 pfu/ml.

How many pfu a web needs depends on plaque size. On *M. smegmatis*, 1,000 to 4,000 pfu gave no web and 8,000 to 12,000 pfu webbed. For one *M. foliorum* phage, about 5,000 pfu gave few or no webs and about 20,000 pfu webbed. For *M. foliorum* phages, targets of 1,500 pfu or less are usually too low to web.

Two errors to avoid: leaving out the x 1,000 µl/ml (the volume comes out 1,000-fold too small, and the plate shows a few plaques instead of a web), and moving the decimal the wrong way. Do not add more than 25 µl of lysate to 250 µl of host (10% of the cell volume), or the cells lyse.

Protocol: [how much lysate per webbed plate](/research/protocols/phage-isolation#how-much-lysate-per-webbed-plate).

## If you wanted to make more webbed plates with the lysate, what dilutions would you make?

Make the same dilution of the lysate that gave a webbed plate in your full plate titer, and plate that dilution and volume on 6 to 8 more plates. If the 10^-n plate webbed, that is n tenfold steps. Make enough of the last tube: plates x µl per plate.

Worked example: the 10^-3 plate webbed. Dilute 10 µl of lysate to 10^-3 (three steps of 10 µl into 90 µl), then plate 10 µl of the 10^-3 tube on each of 6 plates. That uses 60 µl of the 100 µl tube. All 6 plates webbed at about 24 hours.

For a 10^-4 input, two steps save tubes: 1 µl lysate + 999 µl buffer (10^-3), then 7 µl of that + 63 µl buffer (10^-4). That makes 70 µl, enough for 7 plates at 10 µl.

When nothing has webbed yet, bracket: plate a 10-fold series across whole decades (for example 10^-3 to 10^-6), see which webs, and repeat it. The webbing dilution shifts between lysate batches (10^-2 on one lysate, 10^-4 on the next), so re-bracket each new lysate.

Protocol: [the bracketing shortcut](/research/protocols/phage-isolation#the-bracketing-shortcut).

## How do I make a 10-fold serial dilution of a phage lysate?

Add 10 µl of phage lysate to 90 µl of phage buffer, mix, and carry 10 µl of that tube into the next 90 µl; each tube is one tenth of the one before.

    10 µl phage + 90 µl phage buffer = 1/10

The lab's series carries 10 µl of each tube into the next 90 µl, and the first tube is 10^-1.

Watch for: 10 µl phage into 100 µl buffer is 1/11, not 1/10. Do not add an extra "original" tube before the 10^-1 tube; it shifts every plate one step and every titer 10-fold. Each purification round restarts at 10^-1 from the new pick rather than continuing the previous series.

Protocol: [phage purification](/research/protocols/phage-isolation#phage-purification-picking-and-replating-plaques).

## If you flood a webbed plate with 8 ml of phage buffer, how much lysate will you get?

You collect about 5 to 7 ml of lysate from each webbed plate flooded with 8 ml of phage buffer; the agar keeps the rest. That is more than the Guide's estimate of about 4 ml per plate.

    plates needed = ml of lysate wanted / 5 to 7 ml per plate

Worked examples from the notebooks: 4 plates gave about 27 ml after 5 hours on the bench (2.04 x 10^10 pfu/ml); 7 plates flooded 3 hours gave 40 ml (1.5 x 10^10 pfu/ml); 8 plates flooded 2 hours gave over 50 ml (6.0 x 10^9 pfu/ml).

The course needs about 10 ml for archiving plus 10 ml for DNA extraction. At 5 ml per plate that is 4 plates; the lab plans 6, because some plates do not web or yield less. Dry or aged plates return less (8 ml on one returned only 3.5 ml), and a flood that soaks in can be topped up with another 8 ml.

Protocol: [yields](/research/protocols/phage-isolation#yields).

## What titer counts as a high titer phage lysate?

A high titer lysate is at least 5 x 10^9 pfu/ml, the threshold in the [SEA-PHAGES Phage Discovery Guide](https://discoveryguide.seaphages.org/) that the lab works to. High titer lysates in the notebooks mostly titered between 10^9 and 10^11 pfu/ml: 5.3 x 10^9, 6.0 x 10^9, 1.5 x 10^10, 2.04 x 10^10, 2.2 x 10^11 and 3.8 x 10^11.

To reach it, improve the web first; a bigger flood (16 ml instead of 8 ml) does not raise the titer. Serial flooding, using one plate's lysate to flood a second webbed plate, can raise it about 10-fold: one lysate went from 9.4 x 10^9 to 8.4 x 10^10 pfu/ml.

Protocol: [webbed plates and the high titer lysate](/research/protocols/phage-isolation#webbed-plates-and-the-high-titer-lysate).

## How long do I incubate webbed plates before flooding them?

Incubate webbed plates about 24 hours, and pull them a little early rather than late. Plates left about 30 hours can clear completely; about 22 hours works. At 29 °C, one day gave 6 of 6 webbed plates where two days over-cleared. Slow phages are the exception: one needed 48 to 72 hours to web. Watch the plates over the last few hours.

Protocol: [incubation of webbed plates](/research/protocols/phage-isolation#incubation-of-webbed-plates).

## What do turbid phage plaques mean?

A turbid (cloudy) plaque has bacteria still growing inside it; a clear plaque does not. A turbid plaque is still a phage and is purified like any other: in this lab, a single small, cloudy plaque that appeared on a direct-isolation plate after about 6 days went on to become a phage. What matters during purification is that all plaques on a plate look alike. A second plaque type on dilution plates can mean cross-contamination from another phage in the room; pick each type separately.

Protocol: [turbid plaques and mixed morphologies](/research/protocols/phage-isolation#turbid-plaques-and-mixed-morphologies).

## What is the difference between direct and enriched phage isolation?

Direct isolation plates the filtered soil extract with host the same day, so it only finds phages that are already plentiful in the sample. Enriched isolation grows the filtered extract with host for several days first (the lab adds 250 µl host and shakes for 2 to 7 days), so a phage present in small numbers can multiply until it shows.

Expect many negatives with direct isolation; a run of 7 or more negative samples before a positive is normal. A positive-control plate made with 10 µl of a known lysate tells a negative sample from a technique problem.

Protocol: [direct vs enriched isolation](/research/protocols/phage-isolation#direct-vs-enriched-isolation).

## Why did my picked phage plaque give no plaques on the dilution plates?

Usually the pick missed the phage, or the pick tube was old. Pick straight down into the center of the plaque, since an angled stab often misses, and use a fresh pick rather than a days-old pick tube. A single-plaque pick holds few phage, so plate 10^0 to 10^-4, not out to 10^-8.

Protocol: [phage purification](/research/protocols/phage-isolation#phage-purification-picking-and-replating-plaques).

## Why did the whole class's phage plates fail at once?

When every student's plates fail together, suspect a shared stock, such as the host culture or the phage buffer, before technique. Thin, speckled lawns with no plaques across the class point to a dying host culture, and plaques on a buffer-only control plate point to phage-contaminated phage buffer. Test the host with a host-only lawn (250 µl host plus 3 ml top agar, no phage), and run a buffer-only control plate with every dilution series.

Protocol: [troubleshooting](/research/protocols/phage-isolation#troubleshooting-when-every-groups-plates-fail-at-once).
