---
path: /research/protocols/phage-isolation
title: "Phage Isolation and Purification Protocol"
seo_title: "Phage Isolation and Purification Protocol, Spot Titer"
description: "Bacteriophage isolation from soil in the Tarleton SEA-PHAGES lab: direct vs enriched isolation, purification, spot titer, webbed plates, high titer lysate."
---

This is the phage isolation and purification protocol as it is run in the Tarleton State University SEA-PHAGES lab, where undergraduates isolate bacteriophages from soil and water in the first semester of the [Phage Discovery program](/teaching/phage-discovery), in the [Virus Isolation Course](/teaching/virus-isolation). It follows the SEA-PHAGES Phage Discovery Guide, which remains the reference for every step, and adds what the guide does not say: the settings this lab actually uses, worked numbers, and the troubleshooting recorded in several years of student lab notebooks. It covers the isolation and purification of viruses from an environmental sample from start to finish: direct vs enriched isolation, plaque purification, turbid plaques, the spot titer, the full plate titer and webbed plates, and making a high titer phage lysate. The arithmetic (pfu/ml, web volumes, dilutions) is worked through question by question in [Lab Calculations and Common Questions](/teaching/virus-isolation/faq).

## Phage isolation and purification: overview

The work runs in three stages, which the course follows in order:

1. **Phage isolation.** Collect an environmental sample, extract it into liquid media, filter it, and plate the filtrate with host bacteria, either directly (direct isolation) or after growing any phage present with the host for several days (enriched isolation). A clear spot or plaque in the bacterial lawn is a candidate phage.
2. **Phage purification and amplification.** Pick a single plaque, dilute it, and replate it, round after round, until every plaque on the plate looks the same. Then titer the phage and grow it on webbed plates to make a phage lysate, first a low-volume lysate and then a high-volume, high-titer lysate.
3. **Phage DNA and morphology.** Extract DNA from the high-titer lysate, run restriction digests, prepare samples for electron microscopy, and archive the sample. DNA extraction is on the [phage DNA extraction](/research/protocols/phage-dna-extraction) page; the rest is in the guide.

The guide protocols this page follows, by the guide's own numbering:

| Step | Phage Discovery Guide protocol |
| --- | --- |
| Aseptic technique | [Protocol 2.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/2-1-protocol) |
| Collecting environmental samples | [Protocol 5.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-1-protocol) |
| Direct isolation | Protocol 5.2 |
| Plaque assay | [Protocol 5.3](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-3-protocol) |
| Picking a plaque | Protocol 5.4 |
| Enriched isolation | [Protocol 5.5](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-5-protocol) |
| Spot test | [Protocol 5.6](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-6-protocol) |
| Plaque assay for purification | [Protocol 6.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-1-protocol) |
| Serial dilutions | [Protocol 6.2](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-2-protocol) |
| Collecting plate lysates | [Protocol 6.3](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-3-protocol) |
| Spot titer | Protocol 6.4 |
| Full plate titer | [Protocol 6.5](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-5-protocol) |
| Making webbed plates | [Protocol 7.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/7-1-protocol) |
| Actinobacteriophage database | [Protocol 7.2](https://seaphagesphagediscoveryguide.helpdocsonline.com/7-2-protocol) |
| Archiving samples | [Protocol 7.3](https://seaphagesphagediscoveryguide.helpdocsonline.com/7-3-protocol) |

## Hosts and safety

The lab runs at Biosafety Level 2 (BSL-2), both the teaching lab and the research lab, even though the bacterial hosts are Risk Group 1 organisms: *Mycobacterium smegmatis* mc2 155 and *Microbacterium foliorum*. The guide has a host page for each ([*M. smegmatis*](https://seaphagesphagediscoveryguide.helpdocsonline.com/4-1-msmegmatis), [*M. foliorum*](https://seaphagesphagediscoveryguide.helpdocsonline.com/4-1-mfoliorum)).

Which host, by year, as the notebooks record it:

| Years | Host | Media | Plate incubation |
| --- | --- | --- | --- |
| 2017 | *Mycobacterium smegmatis* | Enrichment Broth | 37 °C (one notebook 38 °C); 48 h for plaque assays and titers, 24 h for webbed plates |
| 2018 to 2019 | *Microbacterium foliorum* | PYCa | 23 to 30 °C, 24 to 48 h |
| 2021 to 2025 | *Microbacterium foliorum* | PYCa liquid media, PYCa plates and PYCa top agar | 29 °C (range logged 28.5 to 29.8 °C), 24 to 48 h |

One 2022 notebook used *Mycobacterium fortuitum*, a host the guide has no page for. Everything below that gives a temperature or time is for *M. foliorum* in PYCa unless it says *M. smegmatis*.

Basic rules in this lab: culture plates and tubes go in secondary containment bins; no biological material leaves the lab; glass culture tubes go in the red sharps container and nothing else does; all other disposables that touched a culture (plates, tubes, syringes, filters, pipettes and tips) go in autoclave bags. Contaminated PPE goes in the autoclave bags too.

**Bench prep every session.** Spray CiDecon (made at 1:128) and wipe dry, then 70% ethanol and wipe dry, then light a Bunsen or butane burner and work under the flame.

## Materials

The lists below are what the lab uses. Recipes and amounts per plate are in the guide.

- Host culture: *M. foliorum* (or *M. smegmatis*), 250 µl per plate.
- PYCa liquid media, PYCa agar plates, PYCa top agar held molten in a 55 °C bath.
- Phage buffer.
- 15 ml and 50 ml conical tubes; microcentrifuge tubes.
- 0.22 µm syringe filters and syringes; 0.22 µm tube-top vacuum filter units for pooling several plates.
- Shaking incubator (220 to 250 rpm) and a plate incubator (29 °C for *M. foliorum*).
- Centrifuge for 15 ml and 50 ml tubes, and a microcentrifuge.
- Micropipettors, including a 1 to 10 µl pipettor for spot titers.
- Parafilm, a marker, and a light box for counting plaques.

**Batch marking.** The lab marks host culture batches and plate batches with colored stripes (black, red, blue), so that when plates fail, the bad batch can be found.

## Plating with top agar (the plaque assay)

Every step that follows ends with the same plating step, so its settings come first.

1. Take bottom agar plates out of the 4 °C refrigerator early and let them reach room temperature on the bench. They can be pre-warmed in the 29 °C incubator while the dilutions are made (about 7 to 10 minutes).
2. Break up any clumps in the host culture before adding phage (see the tips below).
3. Add phage (filtrate, pick dilution or lysate dilution) to 250 µl host. For direct isolation, 500 µl of filtrate is delivered as 5 x 100 µl with a p200, or with a 5 ml pipette.
4. Let phage and host adsorb. The lab uses 8 minutes for a plaque assay, and 20 minutes with the tube swirled in a figure 8 for webbed plates on *M. foliorum*.
5. Take the top agar out of the 55 °C bath only at the moment of pouring, swirl the bottle, add it to the tube, and pour onto the plate. Tilt the plate at once to spread it.
6. Leave the plate flat and undisturbed until the top agar sets: at least 15 to 20 minutes, and 30 to 40 minutes is safer. Only then invert it.
7. Incubate inverted: 29 °C for 24 to 48 hours for *M. foliorum*, 37 °C for *M. smegmatis*.
8. Read the plate, then parafilm it and refrigerate it.

### Tips from the lab

- **Clumped host.** Plates stay negative when the host culture is not homogeneous. Break clumps before the phage goes in, by swirling the tube in a figure 8, dragging it across a rack grate or the bench, and a quick vortex. Doing this after the phage is added was suspected of disrupting attachment. Gentle tapping to mix phage and host gives well-defined plaques.
- **Small phage volumes.** When only 2 µl of phage goes into 250 µl host, put the drop on the tube wall and tilt the tube so it reaches the cells, then swirl and tap. A missed drop was the suspected cause of failed low-volume webbed plates.
- **Cold plates.** Plates poured straight from the refrigerator gave condensation and drips on the lawn, condensate between the agar layers, irregular top agar, and top agar that slid off onto the lid or crumbled when inverted. Warm plates on the bench first. Warming a plate in the incubator for too long gave bubbles and a poor surface in one notebook. Plates poured the same morning also failed to hold top agar until they had sat out.
- **Top agar that will not set.** This was the most common plating loss in the notebooks. Causes recorded: top agar drawn lumpy or unswirled, top agar that cooled from sitting out (lumpy or bumpy lawns), top agar that set early near the bottom of the jar, top agar re-melted in the microwave (about 45 seconds) and not mixed, adding the top agar too fast, and plates moved, taped together, rocked or inverted before setting (lawns that slid, rippled or came out abnormal). What worked:
  - Swirl or shake the top agar bottle before every draw.
  - Plate in batches of about 3, and return the bottle to the 55 °C bath between batches.
  - Wait 20 to 30 minutes before moving plates, and tape plates together only after they have set.
  - If plates stay liquid after 20 to 25 minutes or overnight, pour the top agar alone into an empty plate. If it stays liquid, replace the batch.
- **Wrong plates.** Nutrient agar or other non-PYCa plates used by mistake gave no growth at all.
- **Parafilm and incubation.** Isolation plates wrapped in parafilm before incubation gave no lawn, twice. Parafilm plates after reading, not before incubating (the one exception is webbed plates at 37 °C, below).
- **Watery plates.** Plates carrying lid condensation that were incubated upright instead of inverted grew abnormal lawns. Let the top agar set fully so the plate can be inverted.
- **Scheduling.** The class meets on fixed days, so plates are pulled after 24 to 48 hours, parafilmed and held at 4 °C to pause growth, and read or picked days later. A plate pushed to the back of the refrigerator froze.

## Direct vs enriched isolation

Direct isolation plates the extract the same day and needs phage to be plentiful in the sample. Enriched isolation grows the extract with host for several days first, so it takes longer but can detect a phage present in small numbers. In this lab, many direct platings come up negative (see below), so enrichment is the second route for a sample.

## Direct phage isolation

Direct isolation plates the filtered soil extract with host straight away, without letting phages multiply first. It finds phages that are already abundant in the sample. Guide Protocol 5.2.

As run in this lab:

1. Put the soil in a 15 ml conical tube and cover it with PYCa liquid media. The volumes logged were soil under 2 to 3 ml of media, 7 ml soil plus 3 to 4 ml broth, or 5 ml soil with media to 7 ml above the soil.
2. Shake 1 to 2 hours at 220 to 250 rpm (29 °C).
3. Let the soil settle 5 to 20 minutes, or spin the tube at 2,000 x g for 10 minutes.
4. Draw off the liquid and push it through a 0.22 µm syringe filter.
5. Plate 500 µl of filtrate with 250 µl host (see plating, above).
6. Incubate and check the plate for days, not hours (see the tips).

### Tips and troubleshooting

- **Shake long enough.** One run shaken about 250 rpm for only 1 hour gave no plaques on all three samples. The repeat, shaken 4 hours, gave the positive plate. The guide suggests 2 to 3 hours.
- **Enough media.** Dry soil soaks up 2 to 3 ml of media during the shake and leaves nothing to draw off. About 7 ml of soil with 2 ml of broth left no recoverable liquid after a spin; 3 to 4 ml of broth over 7 to 8.5 ml of soil was needed. The fix for a dry tube is to add more media (about 3 ml more) and shake again (25 minutes more worked), or, in a 50 ml conical, add 8 ml more broth before filtering.
- **Enough filtrate.** Soil covered by only 2 to 3 ml of media gave as little as about 200 µl of filtrate. Seven such 200 µl platings were all negative before a sample giving 0.5 to 1 ml of filtrate was positive. When a sample gave only 0.3 ml, the 15 ml tube was spun again at 2,000 rpm, a second filter used, and 300 µl plated.
- **Muddy, clay or viscous extracts.** Thick, grainy or clay soils clog the 0.22 µm filter. What worked:
  - Chill the tube at 4 °C for a few hours after shaking, then spin 10 minutes before drawing about 2 ml to filter.
  - Spin the 15 ml tube at 2,000 rpm for 10 minutes, twice if needed.
  - Split the settled liquid into 1 ml aliquots and microcentrifuge them (2 minutes at 2,000 rpm, or 10 minutes at maximum speed after adding 2 ml phage buffer), then filter the cleared liquid.
  - Pre-wet a fresh filter with phage buffer before pushing the rest through, and swap filters when one clogs.
  - Do not force a clogged filter. One burst and the sample was lost.
  - A silty lake-bed sample that would not settle after three 10-minute spins was cleared by adding more broth, spinning again, and microcentrifuging about 0.5 ml aliquots for 5 minutes. That supernatant was plated without filtering.
- **Holding filtrate.** The guide says filtrate keeps no longer than 24 hours. In this lab, filtrate held at 4 °C for 2 to 7 days still gave a plaque (a sample held 5 days, plated after a 2-hour host and phage pre-adsorption instead of 10 minutes). Plate fresh filtrate when you can.
- **Slow plaques.** Direct-isolation plaques on *M. foliorum* can be slow. Plates showed nothing at 15 to 18 hours and a small plaque only after several days. One plate had nothing at 17 hours and a single small, cloudy plaque at about 6 days, and that plaque went on to become a phage. Keep negative plates and recheck them daily for up to 5 or 6 days before discarding.
- **Expect negatives.** Notebooks record 7 of 8 samples negative before one positive, 8 of 9 negative, and about 10 direct platings negative in a row. To tell a bad sample from bad technique, run a positive-control plaque assay with 10 µl of a known lysate. In one group that plate cleared in 24 hours, which showed the technique was sound, and the group went out for new samples.

## Enriched phage isolation

Enriched isolation grows the sample extract together with host bacteria for several days first, so that a phage present in small numbers can multiply to a detectable level. Guide Protocol 5.5.

As run in this lab for *M. foliorum*:

1. Put 10 ml of soil in a conical tube and add 25 ml PYCa to the 35 ml mark.
2. Vortex 1 minute, then shake at 250 rpm and 29 °C for 2 hours.
3. Spin at 3,110 rpm for 10 minutes and pass the supernatant through a 0.22 µm filter.
4. Add 250 µl host (not 0.5 ml) to the filtrate.
5. Cap the tube a quarter turn, tape it, and keep it upright.
6. Shake at 220 to 250 rpm and 27 to 29.5 °C. Notebooks record 2 to 7 days; the guide's range is 2 to 5 days.
7. Pull an aliquot, microcentrifuge it, filter the supernatant through 0.22 µm, and spot test it (below). One notebook pulled an aliquot at day 2 for a spot test and left the rest going to day 5.5 as a backup.

### Water samples

A river-water enrichment gave the lab a positive spot: 45 ml water plus 5 ml 10X media, shaken at 180 rpm and 26 °C for about 2 hours, spun 10 minutes at 9,607 rpm and filtered, then 2.7 ml more 10X media and 250 µl host added and incubated about 6 days. A smaller version (9 ml water plus 1 ml 10X media) was negative.

### Tips and troubleshooting

- **Always filter the enrichment.** Skipping the 0.22 µm filtration of a day-5 enrichment (1.4 ml microfuged 1 minute, supernatant still light brown) gave a heavily contaminated plate. Refiltering the leftover supernatant gave a clean plate with many plaques.
- **Filters.** A 20 ml enrichment extract needed 5 to 6 syringe filters, about one per 5 ml.
- **A positive enrichment that clears the plate.** Plating 10 µl of a positive enrichment cleared the whole *M. foliorum* lawn. Flooding that cleared plate with 8 ml phage buffer, filtering, and plating 10^-1 to 10^-5 of the filtrate gave isolated plaques to start purification.
- **False plaques.** Apparent "plaques" on an enrichment plate turned out to be bacterial growth. Look closely before picking.

## Spot test

A spot test checks a sample for phage by dropping small volumes onto a lawn instead of mixing them into it. Guide Protocol 5.6.

1. Pour a lawn of 250 µl host in top agar and let it set completely.
2. Mark sections on the bottom of the plate.
3. Spot 5 to 10 µl of each sample into its own section, with a phage-buffer spot as the negative control.
4. Let the spots soak in before moving the plate, then incubate inverted and read at 24 hours.

A single picked plaque from direct isolation can be confirmed the same way before starting dilutions: split the plate in two, spot 10 µl of the pick (in 100 µl buffer) on one half and 10 µl phage buffer on the other, absorb 20 minutes, and read at 24 hours.

### Tips and troubleshooting

The guide does not cover spots that run, which was the main spot-test failure in this lab.

- **Let the lawn set.** Let the lawn set 30 minutes before spotting.
- **Let the spots soak in.** 10 µl spots left only 30 minutes before incubation did not soak in and ran together. Absorbing 4 to 5 hours before moving the plate kept them separate and gave readable plaques. Other notebooks fixed smeared spots with 30 to 45 minutes instead of 20.
- **Smaller spots.** Spotting 5 µl instead of 10 µl helped, though spots still ran in one notebook even at 5 µl.
- **Do not bump the plate.** Spots ran or dripped into neighboring sections when the plate was moved or bumped too soon. Check that the incubator shelf is level.
- **Fresh top agar** was one of the fixes tried when spots kept running.
- **Hold negatives.** A negative spot test was held 2 extra days before discarding, for slow phages.

## Phage purification: picking and replating plaques

A single plaque is picked, diluted and replated, and this is repeated until the plate shows only one plaque morphology. Guide Protocols 5.4, 6.1 and 6.2.

1. Pick a single, well-isolated plaque with a pipette tip into phage buffer (the lab picks into 90 µl or 100 µl). This is the 10^0 tube.
2. Make a 10-fold dilution series: 10 µl into 90 µl phage buffer at each step, vortexing between tubes.
3. Plate 10 µl of each dilution with 250 µl host.
4. Incubate, then pick a single plaque from a plate with well-separated plaques and repeat.
5. When all plaques look the same across rounds, the phage is purified. The last purification plate is the starting point for the lysate.

### Tips and troubleshooting

- **The dilution range for a fresh pick is low.** For a single-plaque pick, plate 10^0 to 10^-4, not out to 10^-8. One purification round failed twice (no plaques from 10^-3 to 10^-8, then from 10^-2 to 10^-7) when re-diluting a pick tube that was days old. A fresh pick from the earlier 10^-3 plate gave plaques at 10^-2 to 10^-4, and plating 10^0 to 10^-2 of a fresh pick gave the first webbed plate, at 10^0.
- **Use a fresh pick.** Re-diluting a days-old pick tube failed where a fresh pick worked. Reusing the previous day's dilutions without vortexing also failed.
- **How to pick.** Three consecutive second-round series gave no plaques when the p200 tip entered the plaque at an angle. Inserting the tip straight down from directly above, into the center of the plaque, gave plaques. When a pick gives nothing, the stab probably missed the phage: pick again, from a different plaque on the same plate if needed.
- **Restart the numbering each round.** Each purification round starts again at 10^-1 from the new pick. Numbering a new round as if it continued the last (10^-7 to 10^-10, then 10^-11 to 10^-14) led one group to plate 10^-10 and 10^-11 four times with no plaques, when the dilution that webbed was actually 10^-2.
- **Make true 10-fold steps.** 100 µl buffer plus 10 µl phage is an 11-fold step, not 10-fold; 90 µl of phage in place of 10 µl is also wrong. Putting 10 µl of lysate into 100 µl buffer as an extra "original" tube before the 10^-1 tube shifts every dilution by about 10-fold, so every plate is labeled one step too dilute.
- **Picking from a contaminated plate.** Pick into 90 µl phage buffer, then push the pick through a 0.22 µm syringe filter pre-wetted with phage buffer (so the membrane does not hold back the sample) into the 10^0 tube, and start the dilution series from that filtrate. A plaque picked well away from a contaminated patch can still purify cleanly. Repeated contamination on dilution plates ended in one group when they started over from a freshly picked plaque.
- **Do not over-incubate.** Purification plates left too long ("cooked") all looked the same and gave nothing to pick. On the other hand, 29 °C for 48 hours, and up to 5 days for one dilution round, was needed for some slow phages.

### Turbid plaques and mixed morphologies

A turbid (cloudy) plaque still has bacteria growing inside it, where a clear plaque has none. A turbid plaque is still a phage: one direct-isolation plate showed a single small, cloudy plaque at about 6 days, and it went on to become a phage. Purify it like any other plaque. What matters during purification is that every plaque on the plate looks the same. A second plaque morphology on dilution plates was, in one class, cross-contamination from another student's phage. Pick each morphology separately, and re-flood an earlier clean webbed plate for new lysate.

## Titering a phage lysate: spot titer and full plate titer

The titer is the number of plaque-forming units (pfu) per ml of lysate. It is needed to decide how much lysate to put on a webbed plate. A spot titer gives a quick estimate from one plate; a full plate titer is more accurate. Guide Protocols 6.4 and 6.5.

### Titer arithmetic

    titer (pfu/ml) = plaques counted / µl plated x 1,000 µl/ml x dilution factor

The dilution factor is 10^n for a 10^-n dilution. The result always has a positive exponent. A check: the exponent of the answer should equal log10(plaques per µl) + 3 + n.

Worked examples from the notebooks:

| Plaques | Volume plated | Dilution | Titer |
| --- | --- | --- | --- |
| 81 | 10 µl | 10^-3 | 8.1 x 10^6 pfu/ml |
| 103 | 10 µl | 10^-3 | 1.03 x 10^7 pfu/ml |
| 144 | 10 µl | 10^-3 | 1.44 x 10^7 pfu/ml |
| 40 | 10 µl | 10^-4 | 4 x 10^7 pfu/ml |
| 23 | 10 µl | 10^-6 | 2.3 x 10^9 pfu/ml |
| 42 | 10 µl | 10^-6 | 4.2 x 10^9 pfu/ml |
| 111 | 10 µl | 10^-6 | 1.1 x 10^10 pfu/ml |
| 10 | 10 µl | 10^-8 | 1.0 x 10^11 pfu/ml |
| 376 | 10 µl | undiluted | 3.76 x 10^4 pfu/ml |
| 6 | 3 µl (spot) | 10^-3 | 2 x 10^6 pfu/ml |

Errors that recur in the notebooks, and that the guide does not warn about:

- **Exponent sign flipped.** 40 plaques in 10 µl of 10^-4 was written 4 x 10^-7 pfu/ml; it is 4 x 10^7. 42 plaques in 10 µl of 10^-6 was written 4.2 x 10^-8; it is 4.2 x 10^9. 169 plaques at 10^-2 was written 1.69 x 10^-5. A negative exponent on a titer is always wrong, and it carries into a wrong webbed-plate volume.
- **Wrong volume.** 376 plaques from 10 µl undiluted was reported as 3.76 x 10^5 pfu/ml; it is 3.76 x 10^4. For spot titers, divide by the spot volume (3 µl) every time. Report per ml, not per µl.
- **Wrong exponent arithmetic.** 74 plaques in 10 µl at 10^-5 was written 7.4 x 10^11; it is 7.4 x 10^8.
- **One lysate, one titer.** Different titers reported for each dilution plate of the same lysate mean a counting or dilution error. Implausible values (such as 28.7 x 10^11) should be rechecked.
- **Count on a light box.** A miscount gave a wrong titer and wrong web volumes; recounting on the light box gave the correct 7.4 x 10^7 pfu/ml.

### Spot titer

1. Make a 10-fold dilution series of the lysate in phage buffer.
2. Pour a lawn and let it set completely.
3. Spot a small, fixed volume (the lab uses 3 µl) of each dilution into its own marked section.
4. Let the spots soak in, incubate, and count the plaques in the most dilute spot that has countable, separate plaques.

Tips and troubleshooting (the guide does not cover the pipetting fix):

- **Pipettor.** 3 µl spots from a p20 or p200 spread into each other and ran past their sections. Switching to a 1 to 10 µl pipettor, vortexing and checking each tube for bubbles, and spreading the dilution series across 3 lawns gave countable spots (8 plaques at 10^-9).
- **Carrying the plate.** Three spot titers failed because the spots ran together when the plate was carried to the incubator. Lengthening absorption from 30 minutes to 1 hour did not rescue it; switching to a full plate titer did.
- **Incubation time.** Spot titer plates left about 48 hours dried and cracked with no readable spots, and at 26 hours spots had merged. About 23 hours (or checking every 6 hours) gave readable 10-fold drops. Check at 12 to 24 hours, and do not leave a spot titer in the incubator over a weekend.
- **White particles.** White particulate at the bottom of every dilution tube meant a contaminated lysate. Re-filtering the lysate through a fresh 0.22 µm filter into a new sterile 15 ml conical fixed it. A filter that probably "popped" during the harvest was handled the same way.

### Full plate titer

1. Make a 10-fold dilution series of the lysate: 10 µl into 90 µl phage buffer, from 10^-1 out to 10^-7 or further.
2. Plate 10 µl of each dilution with 250 µl host.
3. Incubate and count a plate with a countable number of separate plaques. Note which dilution gave a webbed plate (see below): that is the shortcut to the high-titer lysate.

Tips and troubleshooting:

- **Extend the series.** When every plate to 10^-6 was uncountable, extending the series to 10^-12 gave counts of about 300 at 10^-7 and about 35 at 10^-9.
- **Confluent lysis is not contamination.** Heavy lysis on the low-dilution plates (10^-1 to 10^-3) was repeatedly logged as contamination and the titer redone three times. The plates were probably fine: a later titer counted 15 plaques at 10^-7 (1.5 x 10^10 pfu/ml). Check cleared or rough-looking low-dilution plates for confluent lysis before discarding them.
- **Slow phages.** Slow-growing, tiny-plaque phages showed little at 24 hours and became countable only after 2 to 3 days. One full plate titer read 23, 10 and 2 plaques at 10^-4, 10^-5 and 10^-6 at 1 day 23 hours, then 40 at 10^-4 a day later; another phage read best at 3 to 4 days. One *M. foliorum* lysate titer took 5 days to develop and was checked daily.
- **Unreadable plates.** When top agar did not set or did not stick to the bottom agar, spot titers and full plate titers were unreadable. The lab fell back on the spot titer estimate to move on.
- **Positive control.** Before abandoning a lysate that gave no plaques from 10^-1 to 10^-8, plate it undiluted as a positive control.

## Webbed plates and the high titer lysate

A webbed plate has so many plaques that they almost touch, leaving a thin web of bacteria between them. Flooding webbed plates with phage buffer gives a phage lysate. The lab first makes a low-volume lysate (LVL) from the last purification plate, then a high-volume, high-titer lysate (HVL, or HTL) from several webbed plates. Guide Protocols 6.3 and 7.1.

The workflow in 2025:

1. Flood the webbed plate from the last purification round to make a low-volume lysate (about 5 ml).
2. Run a dilution series from the LVL and plate it to find the dilution that webs.
3. Pour 5 to 10 replicate plates at that dilution and volume.
4. Flood them, pool them through one 0.22 µm filter into a 50 ml conical, and titer the pool. That is the HVL.

Web copies failed when they were made from the wrong starting sample instead of the LVL.

### How much lysate per webbed plate

The calculation is:

    µl of lysate per plate = pfu wanted per plate / titer (pfu/ml) x 1,000 µl/ml

A worked example that succeeded: 111 plaques on the 10^-6 plate (10 µl) is a titer of 1.1 x 10^10 pfu/ml. A target of about 11,100 pfu needs 1.1 x 10^-3 µl of lysate per plate. That was made as 1 µl lysate in 999 µl buffer, then 7 µl of that into 63 µl buffer, plating 10 µl per plate. Six of seven plates webbed in 24 hours, and the pooled HVL titered 2.2 x 10^11 pfu/ml.

The pfu a plate needs to web depends on plaque size, and notebooks show the guessed numbers were often too low:

- On *M. smegmatis* at 37 °C, 1,000 to 4,000 pfu gave no web and 8,000 to 12,000 pfu webbed (20 to 30 µl of the 10^-3 dilution of a 4 x 10^8 lysate). Ten µl of the 10^-2 dilution of a 7.4 x 10^7 lysate (about 7,400 pfu) on 8 plates webbed in 24 hours and gave an HVL of 5.3 x 10^9.
- For an *M. foliorum* phage (lysate 2.5 x 10^8 pfu/ml), about 5,000 pfu gave no webs or 2 of 6; about 20,000 pfu (8 µl of 10^-2) webbed.
- For *M. foliorum* phages, targets of 280 pfu (a quadrant count of 70 x 4), 500, 1,000 and 1,500 pfu gave no web.
- Targets written into notebooks ranged from 1.5 x 10^3 pfu for small plaques to 12,000 or 10^5 pfu for medium plaques.

Errors to avoid:

- **Leaving out the x 1,000 µl/ml conversion** makes the phage volume 1,000-fold too small: the plate shows a few small plaques instead of a web.
- **Moving the decimal the wrong way** (plating 10^-8 when it should be 10^-6).
- **A flipped exponent in the titer** carries straight into the web volume.

### The bracketing shortcut

When the calculation kept failing, what worked was bracketing:

1. Plate a 10-fold series of the lysate across whole decades (for example 10^-1 to 10^-4, or 10^-3 to 10^-6), or bracket 10-fold either side of the calculated volume.
2. See which dilution webbed.
3. Plate 6 to 8 replicates of exactly that dilution and volume.

The full plate titer does the first two steps already: the dilution that webbed on the titer is the one to repeat. Examples:

- From a 3.0 x 10^9 lysate the target was 6,000 pfu, or 2.0 x 10^-3 µl. Plating 4 µl of 10^-4, 2 µl and 1 µl of 10^-3, and 1 µl of 10^-2 (plus a negative control) showed that 1 µl of 10^-2 webbed. Five more of that plate gave 32.5 ml.
- From a 4.8 x 10^9 lysate the target was 3.125 x 10^-3 µl per plate, bracketed as 3 plates each at 10^-4, 10^-5 and 10^-6. Two of the 10^-4 plates webbed.
- A 10^-1 and 10^-2 plate cleared, 10^-3 webbed at 29 hours, and four 10^-3 plates gave the HVL.
- From a 1.22 x 10^8 lysate, 10 µl of 10^-3 on 5 plates all webbed and gave about 37 ml at 1.8 x 10^9.
- From a 1.44 x 10^7 lysate and a 1,500 pfu target (0.104 µl), 1 to 11 µl of the 10^-1 and 10^-2 dilutions were bracketed on 8 plates; 2 to 3 µl of 10^-1 webbed. From the resulting lysate, 3 µl of a 10^-3 dilution gave clean webs on 8 plates.
- Volumes other than 10 µl (6 and 12 µl, for example) can be used to bracket more finely. With small plaques, one group bracketed 15 plates, 5 at each of 3 volumes.
- When the 10^-1 plate was overgrown and the 10^-2 plate too sparse, an intermediate 1:5 dilution of the 10^-1 tube gave a web. A full 1:5 dilution series (40 µl into 160 µl buffer) failed, while the undiluted plaque pick (10 µl into 90 µl buffer) webbed.

**Re-bracket every new lysate.** The dilution that webs shifts between lysate batches: 10^-2 on one lysate, 10^-4 on the next. A low-volume lysate that cleared 10^-1 to 10^-3 webbed at 10^-4. Re-titer and re-bracket each lysate before plating a web batch.

**Volume limit.** Do not add more lysate than 10% of the cell volume, that is no more than 25 µl onto 250 µl host, or the cells lyse. When a calculation called for 30 µl, 25 µl was plated instead.

### Incubation of webbed plates

The guide does not warn how fast a webbed plate goes past the web.

- **Pull at 24 hours or a little under.** Plates left a little over 24 hours, or about 30 hours, cleared completely and were useless. About 22 hours worked; watch the plates over the last 3 hours. Webbed plates at 29 °C over-cleared after 2 days; repeating with 1 day gave 6 of 6 webbed plates. Plates left 5 days were completely lysed and contaminated. An *M. smegmatis* plate left about 45 hours instead of 24 webbed on only one side.
- **But slow phages need longer.** A slow *M. foliorum* phage failed to web three times at 48 hours with 2 µl undiluted lysate; 10 µl undiluted webbed only after about 72 hours, and 20 µl webbed in 48 hours. Webbed plates on *M. foliorum* can take significantly longer than expected (5 days in one notebook). A slow web was helped by a day at room temperature before going back into the incubator, and plates left on the bench overnight kept webbing more slowly.
- **Batch to batch.** A scale-up of 10 µl of the 10^-3 dilution on 6 plates all webbed at about 24 hours; a repeat batch of 7 plates was not webbed at 24 hours and needed a second overnight.
- **Web density.** A calculated input that cleared the whole lawn was fixed by dropping to 10 µl of 10^-4, then 5 µl of 10^-4 (17.5 ml lysate). A 10^-2 input that was too thin was fixed by plating undiluted low-volume lysate on 6 plates for only 24 hours. Ten plates at 10^-1 of the low-volume lysate also worked.
- **At 37 °C.** Webbing plates at 37 °C dried out and grew white fuzzy contamination over 2 days. Parafilming the plates shut and moving them to a different incubator fixed it.
- **Top agar.** Inverting before the top agar set cost one team 3 of 6 web plates.

## Collecting the phage lysate: flooding webbed plates

1. Flood each webbed plate with 8 ml phage buffer.
2. Let it soak: 2 to 6 hours at room temperature, or parafilmed at 4 °C overnight to 2 days.
3. Draw the lysate off each plate and pass it through a 0.22 µm filter. For several plates, a tube-top vacuum filter straight into a 50 ml conical is fastest.
4. Pool, label, and titer the lysate.

### Yields

The guide gives about 4 ml per plate. Flooding each plate with 8 ml, this lab recovers more, typically 5 to 7 ml per plate:

| Plates | Lysate recovered |
| --- | --- |
| 1 | 4 to 7.5 ml |
| 3 | 10 to 25 ml |
| 4 | 20 to 30 ml |
| 6 | 16 to 40 ml |
| 7 | 40 ml (1.5 x 10^10 pfu/ml, 3 h flood) |
| 8 | 40 to over 50 ml (6.0 x 10^9 pfu/ml, 2 h flood) |

Four plates gave about 27 ml after 5 hours on the bench and about 30 ml after 19 hours at 4 °C (2.04 x 10^10 pfu/ml). The lab makes the high-volume lysate from 4 to 8 webbed plates, not 2 to 3. Plan about 6 webbed plates to cover 10 ml for archiving plus 10 ml for [DNA extraction](/research/protocols/phage-dna-extraction).

### Tips and troubleshooting

- **Buffer soaks in.** Dry or aged webbed plates absorb buffer: 8 ml on such a plate returned only 3.5 ml. When a flood soaked into the agar, a second 8 ml was added, and one group raised the flood to 10 ml. Wetter plates give more.
- **Holding webbed plates.** Webbed plates can be parafilmed and held at 4 °C for 24 hours or a weekend before flooding. A webbed plate held 10 days at 4 °C still flooded to about 5 ml of usable lysate. Flood times from 3 to 4 hours at room temperature to 24 hours, a weekend or 5 days at 4 °C all gave usable lysate.
- **Clogged filters.** Contaminated webbed plates clog a 0.22 µm filter after about 3 plates. Hold the remaining flooded plates at 4 °C overnight and finish with a fresh filter the next day (one run needed about 3 syringe filters plus one vacuum unit for 4 plates). When a vacuum unit clogs partway, draw the rest off the funnel with a 5 ml syringe and finish through a 0.22 µm syringe filter. One syringe filter can be reused across plates by detaching it between draws.
- **Contaminated plates, clean lysate.** Bacterial growth on webbed plates was removed by the 0.22 µm filtration and the lysate was usable. A filtered lysate that itself grew contaminants on two titer attempts was abandoned, and new webs were made from the earlier low-volume lysate. A contaminated HTL stock was rescued by re-filtering through 0.22 µm, though the volume fell to under 5 ml.
- **Low-volume lysate from a plate that did not web.** Flooding the plate with the most plaques with 8 ml overnight at 4 °C (about 13 hours) gave 4.75 ml but a very low titer. First lysates in the notebooks ranged from 2 to 5.5 ml.
- **Low titer and clogged filters.** Six webbed plates flooded with 8 ml each for about 4.5 hours gave only 8.1 x 10^6 to 1.03 x 10^7 pfu/ml, and the filter repeatedly clogged. Flooding half the plates 2 hours, moving each lysate onto an unflooded webbed plate overnight at 4 °C, and collecting unfiltered did not raise the titer.

### Serial flooding to raise the titer

The guide does not describe this. Several notebooks tried concentrating a lysate by using the liquid from one flooded webbed plate to flood a second, unflooded webbed plate. Results were mixed:

- One plate's filtered lysate (5 ml) topped up with 3 ml phage buffer, used to flood a second plate for 2 hours, then a third, took an LVL of 9.4 x 10^9 to an HVL of 8.4 x 10^10 pfu/ml.
- 6 ml buffer on 4 webbed plates for 2 hours at room temperature, moved onto 4 more webbed plates for 2 hours, gave about 10 ml at 2.6 x 10^9 pfu/ml. Repeated 3 onto 3, it gave 9.5 ml at 4.2 x 10^10.
- One plate flooded with 4.5 to 5.5 ml of existing lysate plus 2.5 to 3.5 ml buffer: one notebook reached 1.05 x 10^11 pfu/ml, another only 3.6 x 10^8.
- For one *M. foliorum* phage, titers stayed at 2.5 to 2.7 x 10^8 however the plates were re-flooded.
- 8 ml on 3 plates for 3 hours, moved onto 3 more and left in the refrigerator over a weekend, gave a very cloudy lysate that barely filtered (about 1 ml) at 1.38 x 10^6.
- Flooding sparse webbed plates with 16 ml instead of 8 ml gave only 6.0 x 10^8, 2.5 x 10^7 and 2.0 x 10^6 pfu/ml. A double-volume flood does not make a high-titer lysate.

In these notebooks, serial flooding gave anything from about a 10-fold gain in titer to none at all.

## Storage

- In the notebooks, lysates, filtrates and plates waiting to be read or flooded are held at 4 °C. Archiving is the guide's Protocol 7.3.
- The [SEA-PHAGES Phage Discovery Guide](https://discoveryguide.seaphages.org/) defines a high-titer lysate as at least 5 x 10^9 pfu/ml (Protocols 6.4 and 6.5), and that is the titer to reach before extracting DNA or archiving. One lysate in the notebooks was archived at about 10^7 pfu/ml, far below it, so titer the high titer lysate before archiving.
- A high-volume lysate is split: about 10 ml for archiving and about 10 ml for [phage DNA extraction](/research/protocols/phage-dna-extraction).
- Read plates are parafilmed and refrigerated. Keep plates away from the back of the refrigerator, where one froze.
- Each new phage is entered in the Actinobacteriophage Database, [PhagesDB](https://phagesdb.org/) (guide Protocol 7.2).

## Troubleshooting: failures that hit the whole class

Some failures are not technique but a shared stock. If every group's plates look wrong at once, suspect the shared reagents first.

- **Dying host culture.** Class-wide speckled, thin lawns and no plaques were traced to a dying *M. foliorum* working culture. For about 10 days in another semester every plate in the class failed; a spot test with a fresh host culture showed the working culture was dying. The fix was a new culture, fresh phage buffer, and a new dilution series from the low-volume lysate. When a full plate titer shows no lawn at all, test the host before blaming the phage: plate a host-only lawn (250 µl host plus 3 ml top agar, no phage), or a control of top agar plus freshly made host beside the old culture.
- **Contaminated phage buffer.** A buffer-only negative-control plate grew 20 plaques (3 on a repeat), from phage-contaminated phage buffer. The first symptom was serial-dilution counts that did not fall 10-fold. The fix was a dedicated buffer-only control plate, discarding the buffer, and remaking dilutions and plates from a fresh sterile bottle. Contamination that kept coming back on spot titers after new plates and new top agar, with clearing inside the phage-buffer control square, was fixed only by fresh phage buffer.
- **Contaminated media or top agar.** A contaminated PYCa liquid media or top agar batch was replaced with a fresh batch. Plates were also contaminated from within the plate sleeve. Contaminated host culture batches gave no lawn and were remade.
- **Pipette tips.** Tips taken out of their paper wrappers ahead of use contaminated serial-dilution plates (whitish or brownish-white turbidity). Shared, non-designated tips in a shared lab caused scattered contamination across spot-titer sections.
- **Other suspects** named in the notebooks: an unlit burner, a different sleeve of agar plates, and the top agar. Yellow areas on a spot plate were put down to host or phage cross-contamination during transfer.
- **A lab-wide event.** In October 2018 a contamination event (white turbidity and spots, a foul odor, resistance to lysis) hit many students' plates, and titers succeeded only after the source was found and eliminated.

Related pages: [the Virus Isolation Course](/teaching/virus-isolation), [Lab Calculations and Common Questions](/teaching/virus-isolation/faq), [phage discovery at Tarleton](/teaching/phage-discovery), [the phages we have found](/research/phages), [phage DNA extraction](/research/protocols/phage-dna-extraction), and [teaching](/teaching).
