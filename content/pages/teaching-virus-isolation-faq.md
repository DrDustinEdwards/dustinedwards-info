---
path: /teaching/virus-isolation/faq
title: "Lab Calculations and Common Questions"
seo_title: "Phage Lab Calculations: pfu/ml, Spot Titer, Webbed Plates"
description: "Worked phage lab calculations from the Tarleton Virus Isolation Course: pfu/ml titers, spot titer dilutions, webbed plate volumes and lysate yields."
---

These are the calculations and questions that come up most in the [Virus Isolation Course](/teaching/virus-isolation), the first semester of the Tarleton SEA-PHAGES program. Each answer gives the formula, a worked example with real numbers from the course's lab notebooks, and a link to the step in the [Phage Isolation and Purification Protocol](/research/protocols/phage-isolation). Unless a question says otherwise, the host is *Microbacterium foliorum* in PYCa, plated with 250 µl of host culture.

## How do you calculate the titer of a phage lysate in pfu/ml?

    titer (pfu/ml) = plaques counted / µl plated x 1,000 µl/ml x dilution factor

The dilution factor is 10^n for a 10^-n dilution.

Worked example: 111 plaques on the plate that received 10 µl of the 10^-6 dilution.

1. Plaques per µl of that dilution: 111 / 10 µl = 11.1 pfu/µl.
2. Per ml: 11.1 x 1,000 = 11,100 pfu/ml, still of the 10^-6 dilution.
3. Undo the dilution: 11,100 x 10^6 = 1.11 x 10^10 pfu/ml.

Check the exponent: log10(plaques per µl) + 3 + n = 1.05 + 3 + 6, about 10, so the answer is in the 10^10 range. A titer never has a negative exponent.

More results from the notebooks, all from 10 µl plated:

| Plaques | Dilution | Titer |
| --- | --- | --- |
| 81 | 10^-3 | 8.1 x 10^6 pfu/ml |
| 40 | 10^-4 | 4 x 10^7 pfu/ml |
| 42 | 10^-6 | 4.2 x 10^9 pfu/ml |
| 10 | 10^-8 | 1.0 x 10^11 pfu/ml |
| 376 | undiluted | 3.76 x 10^4 pfu/ml |

Mistakes that recur in the notebooks: flipping the exponent sign (40 plaques at 10^-4 written as 4 x 10^-7 instead of 4 x 10^7), dividing by the wrong volume (376 plaques from 10 µl undiluted reported as 3.76 x 10^5 instead of 3.76 x 10^4), and reporting per µl instead of per ml. Count on a light box: one miscount gave a wrong titer and wrong web volumes.

Protocol: [titer arithmetic](/research/protocols/phage-isolation#titer-arithmetic).

## How do you calculate a spot titer, and how many dilutions do you need?

    titer (pfu/ml) = plaques in the spot / µl spotted x 1,000 µl/ml x dilution factor

Make a 10-fold series (10 µl into 90 µl phage buffer at each step) and spot the same small volume of each dilution into its own section. The lab spots 3 µl.

Worked example: 6 plaques in a 3 µl spot of the 10^-3 dilution.

6 / 3 µl = 2 pfu/µl; x 1,000 = 2,000; x 10^3 = 2 x 10^6 pfu/ml.

How far to dilute: far enough that the last spots show separate plaques you can count. For lysates the notebooks ran series from 10^-1 to 10^-8. When every plate to 10^-6 was still uncountable on a full plate titer, extending the series to 10^-12 gave counts of about 300 at 10^-7 and about 35 at 10^-9. Divide by the spot volume every time; spot titers computed without dividing by 3 µl were a recurring error.

Spots that run into each other are the usual failure. A 1 to 10 µl pipettor, bubble-free tubes, and letting spots soak in before moving the plate fixed it. Read at about 23 hours: spots had merged by 26 hours and dried out by 48.

Protocol: [spot titer](/research/protocols/phage-isolation#spot-titer).

## How much lysate do you put on a plate to get a webbed plate?

    µl of lysate per plate = pfu wanted per plate / titer (pfu/ml) x 1,000 µl/ml

Worked example: a lysate at 1.1 x 10^10 pfu/ml, aiming for about 11,100 pfu per plate.

11,100 / 1.1 x 10^10 x 1,000 = 1.1 x 10^-3 µl of lysate per plate.

That volume is too small to pipette, so it is made by dilution: 1 µl lysate in 999 µl buffer, then 7 µl of that into 63 µl buffer, and 10 µl of the second tube per plate. Six of seven plates webbed in 24 hours, and the pooled lysate titered 2.2 x 10^11 pfu/ml.

How many pfu a web needs depends on plaque size. On *M. smegmatis*, 1,000 to 4,000 pfu gave no web and 8,000 to 12,000 pfu webbed. For one *M. foliorum* phage, about 5,000 pfu gave few or no webs and about 20,000 pfu webbed. Targets of 280 to 1,500 pfu never webbed for *M. foliorum* phages.

Two errors to avoid: leaving out the x 1,000 µl/ml (the volume comes out 1,000-fold too small, and the plate shows a few plaques instead of a web), and moving the decimal the wrong way. Do not add more than 25 µl of lysate to 250 µl of host (10% of the cell volume), or the cells lyse.

Protocol: [how much lysate per webbed plate](/research/protocols/phage-isolation#how-much-lysate-per-webbed-plate).

## How many dilutions do you make to pour more webbed plates?

Use the dilution that already webbed. If the 10^-n plate of your full plate titer webbed, make n tenfold steps and plate that same dilution and volume on 6 to 8 plates. Make enough of the last tube: plates x µl per plate.

Worked example: the 10^-3 plate webbed. Dilute 10 µl of lysate to 10^-3 (three steps of 10 µl into 90 µl), then plate 10 µl of the 10^-3 tube on each of 6 plates. That uses 60 µl of the 100 µl tube. All 6 plates webbed at about 24 hours.

For a 10^-4 input, two steps save tubes: 1 µl lysate + 999 µl buffer (10^-3), then 7 µl of that + 63 µl buffer (10^-4). That makes 70 µl, enough for 7 plates at 10 µl.

When nothing has webbed yet, bracket: plate a 10-fold series across whole decades (for example 10^-3 to 10^-6), see which webs, and repeat it. The webbing dilution shifts between lysate batches (10^-2 on one lysate, 10^-4 on the next), so re-bracket each new lysate.

Protocol: [the bracketing shortcut](/research/protocols/phage-isolation#the-bracketing-shortcut).

## How do you make a 10-fold serial dilution?

    10 µl phage + 90 µl phage buffer = 1/10

Vortex, then take 10 µl of that tube into the next 90 µl, and so on. The first tube is 10^-1.

Errors from the notebooks: 10 µl phage into 100 µl buffer is 1/11, not 1/10. An extra "original" tube (10 µl lysate into 100 µl buffer) before the 10^-1 tube shifts every plate one step, so every titer is off 10-fold. Each purification round restarts at 10^-1 from the new pick; numbering a new round as if it continued the old series (10^-11 to 10^-14) led one group to plate 10^-10 and 10^-11 four times with nothing, when the dilution that webbed was 10^-2.

Protocol: [phage purification](/research/protocols/phage-isolation#phage-purification-picking-and-replating-plaques).

## How much lysate do you get from a flooded webbed plate?

About 5 to 7 ml per plate when each plate is flooded with 8 ml of phage buffer. The agar keeps the rest. The guide gives about 4 ml per plate.

    plates needed = ml of lysate wanted / 5 to 7 ml per plate

Worked examples from the notebooks: 4 plates gave about 27 ml after 5 hours on the bench (2.04 x 10^10 pfu/ml); 7 plates flooded 3 hours gave 40 ml (1.5 x 10^10 pfu/ml); 8 plates flooded 2 hours gave over 50 ml (6.0 x 10^9 pfu/ml).

The course needs about 10 ml for archiving plus 10 ml for DNA extraction. At 5 ml per plate that is 4 plates; the lab plans 6, because some plates do not web or yield less. Dry or aged plates return less (8 ml on one returned only 3.5 ml), and a flood that soaks in can be topped up with another 8 ml.

Protocol: [yields](/research/protocols/phage-isolation#yields).

## What counts as a high titer lysate?

The notebooks record 5 x 10^9 pfu/ml as the minimum titer for archiving a lysate, and one lysate was archived at about 10^7, far below it. High titer lysates in the notebooks mostly titered between 10^9 and 10^11 pfu/ml: 5.3 x 10^9, 6.0 x 10^9, 1.5 x 10^10, 2.04 x 10^10, 2.2 x 10^11 and 3.8 x 10^11. One *M. foliorum* phage stayed at 2.5 to 2.7 x 10^8 however its plates were flooded, which the notebook recorded as below the threshold.

To reach it, improve the web first. Flooding with 16 ml instead of 8 ml did not work (6.0 x 10^8 pfu/ml at best). Serial flooding, using one plate's lysate to flood a second webbed plate, took one lysate from 9.4 x 10^9 to 8.4 x 10^10 pfu/ml but did nothing for others.

Protocol: [webbed plates and the high titer lysate](/research/protocols/phage-isolation#webbed-plates-and-the-high-titer-lysate).

## How long do you incubate webbed plates?

About 24 hours, and pull them a little early rather than late. Plates left a little over 24 hours, or about 30 hours, cleared completely; about 22 hours worked. At 29 °C, 2 days blew the webs out and 1 day gave 6 of 6 webbed plates. Slow phages are the exception: one needed 48 to 72 hours to web. Watch the plates over the last few hours.

Protocol: [incubation of webbed plates](/research/protocols/phage-isolation#incubation-of-webbed-plates).

## What do turbid plaques mean?

A turbid (cloudy) plaque has bacteria still growing inside it; a clear plaque does not. A turbid plaque is still a phage and is purified like any other: in this lab, a single small, cloudy plaque that appeared on a direct-isolation plate after about 6 days went on to become a phage. What matters during purification is that all plaques on a plate look alike. A second plaque type appearing on dilution plates was, in one class, cross-contamination from another student's phage; pick each type separately.

Protocol: [turbid plaques and mixed morphologies](/research/protocols/phage-isolation#turbid-plaques-and-mixed-morphologies).

## What is the difference between direct and enriched isolation?

Direct isolation plates the filtered soil extract with host the same day, so it only finds phages that are already plentiful in the sample. Enriched isolation grows the filtered extract with host for several days first (the lab adds 250 µl host and shakes for 2 to 7 days), so a phage present in small numbers can multiply until it shows.

Expect many negatives with direct isolation. The notebooks record 7 of 8 samples negative before one positive, and about 10 direct platings negative in a row. A positive-control plate made with 10 µl of a known lysate tells a bad sample from bad technique.

Protocol: [direct vs enriched isolation](/research/protocols/phage-isolation#direct-vs-enriched-isolation).

## Why did my picked plaque give no plaques on the dilution plates?

Usually the pick missed the phage, or the pick tube was old. In the notebooks, three series in a row gave nothing when the tip went into the plaque at an angle; a pick straight down into the center of the plaque worked. Re-diluting a days-old pick tube failed where a fresh pick from the same plate worked. A single-plaque pick holds few phage, so plate 10^0 to 10^-4, not out to 10^-8.

Protocol: [phage purification](/research/protocols/phage-isolation#phage-purification-picking-and-replating-plaques).

## Why did the whole class's plates fail at once?

Suspect a shared stock before technique. In this lab, class-wide thin, speckled lawns with no plaques came from a dying host culture, and a buffer-only control plate with 20 plaques came from phage-contaminated phage buffer. Test the host with a host-only lawn (250 µl host plus 3 ml top agar, no phage), and run a buffer-only control plate with every dilution series.

Protocol: [troubleshooting](/research/protocols/phage-isolation#troubleshooting-failures-that-hit-the-whole-class).
