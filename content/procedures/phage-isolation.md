---
profile: protocol
path: /research/protocols/phage-isolation
title: "Phage Isolation and Purification Protocol"
seo_title: "Phage Isolation and Purification Protocol, Spot Titer"
description: "Tarleton SEA-PHAGES lab variants of the Phage Discovery Guide: direct vs enriched isolation, purification, spot titer, webbed plates, high titer lysate."
method: [plating, culture]
organism: [smegmatis, foliorum]
course: [phage-discovery, virus-isolation]
start_here: 1
version: "MISSING: No version has been assigned (protocols.md: printed sheets carry a version id and date)."
updated: 2026-09-30
status: "MISSING: No source in the repo states a status for this protocol."
last_run: "MISSING: protocols.md: nothing is marked as run in the lab until someone has worked from the rendered page and dated it."
host_strain:
  - strain: smegmatis
  - strain: foliorum
biosafety: "MISSING: Waiting on Dustin: the biosafety officer check (core.md). protocols.md: list the agent only (organism and strain, with its ATCC number); the agent for this protocol is his to name. The host strains the page uses are the lab registry's, named under Host strain."
biosafety_level: "MISSING: Waiting on Dustin: he sets BSL-1 or BSL-2 for each protocol himself."
scale: "MISSING: The page records the lab's variants of several Guide protocols, each at its own scale (per plate, per soil sample, per batch of webbed plates), and states no single batch size to scale by."
primers: not applicable
based_on:
  - citation: "SEA-PHAGES Phage Discovery Guide, July 2025 edition"
    url: https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf
    for: the protocols themselves, which this page does not reproduce
  - citation: "student lab notebooks of the Tarleton SEA-PHAGES lab, 2017 to 2025"
    for: the lab's variants, settings and troubleshooting
materials:
  - name: host culture
    amount: 250 µl
    per: plate
  - name: filtrate
    group: Direct isolation
    amount: 500 µl
    note: "Delivered as 5 x 100 µl with a p200, or with a 5 ml pipette."
  - name: soil
    group: Enriched isolation
    amount: 10 ml
  - name: PYCa
    reagent: pyca
    group: Enriched isolation
    amount: 25 ml
    note: "25 ml PYCa to the 35 ml mark, vortex 1 minute."
  - name: host added to the filtrate
    group: Enriched isolation
    amount: 250 µl
  - name: phage buffer for a plaque pick
    reagent: phage-buffer
    display: phage buffer
    group: Purification
    amount: 90 µl or 100 µl
  - name: phage buffer for flooding
    reagent: phage-buffer
    display: phage buffer
    group: Flooding
    amount: 8 ml
    per: plate
equipment:
  - 55 °C water bath for molten top agar
  - plate incubator at 29 °C for M. foliorum
  - shaking incubator at 220 to 250 rpm
  - 0.22 µm tube-top vacuum filter units
  - 1 to 10 µl pipettor for spot titers
  - light box for counting plaques
troubleshooting:
  - id: wrong-starting-sample
    step: "2 to 3"
    problem: "Web copies do not web."
    reason: "They were made from a sample other than the LVL."
    solution: "Make the web copies from the LVL, as in steps 2 and 3."
expected_results: "Flooding each plate with 8 ml, this lab recovers typically 5 to 7 ml of lysate per plate, and it makes the high-volume lysate from 4 to 8 webbed plates. The Guide's high-titer lysate is at least 5 x 10^9 pfu/ml."
limitations: "This page does not reproduce the Guide's protocols; it records where the lab runs a step differently and what it has learned. Direct platings are often negative, and the dilution that webs shifts between lysate batches, so each lysate is re-titered and re-bracketed before plating a web batch. Serial flooding raises the titer by anywhere from about 10-fold to not at all."
references:
  - "SEA-PHAGES. [Phage Discovery Guide](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf), July 2025 edition. Online at [discoveryguide.seaphages.org](https://discoveryguide.seaphages.org/)."
---

The protocol for phage isolation and purification is the SEA-PHAGES [Phage Discovery Guide](https://discoveryguide.seaphages.org/), current edition July 2025 ([PDF](https://seaphages.org/media/docs/Phage_Discovery_Guide_July_2025.pdf)). This page does not reproduce it. It records where the Tarleton State University SEA-PHAGES lab runs a step differently from that edition, and what the lab has learned running it with students from 2017 to 2025, in the first semester of the [Phage Discovery program](/teaching/phage-discovery) and the [Virus Isolation Course](/teaching/virus-isolation): the settings used, worked numbers, and troubleshooting for direct vs enriched isolation, plaque purification, turbid plaques, the spot titer, the full plate titer, webbed plates and the high titer lysate. The arithmetic (pfu/ml, web volumes, dilutions) is worked through question by question in [Lab Calculations and Common Questions](/teaching/virus-isolation/faq), and the [phage lab calculators](/research/tools) do it on your own numbers: [titer](/research/tools/titer), [serial dilution](/research/tools/dilution), [webbed plate](/research/tools/webbed-plate), [lysate volume](/research/tools/lysate-volume), [MOI](/research/tools/moi) and [efficiency of plating](/research/tools/eop).

## Phage isolation and purification: the Guide protocols

Follow these protocols in the Guide for the steps themselves. The links below go to the Guide's earlier web edition, which still resolves and keeps the same protocol numbers as the July 2025 edition; the current edition is at [discoveryguide.seaphages.org](https://discoveryguide.seaphages.org/).

| Step | Phage Discovery Guide protocol |
| --- | --- |
| Aseptic technique | [Protocol 2.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/2-1-protocol) |
| Collecting environmental samples | [Protocol 5.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-1-protocol) |
| Direct isolation | [Protocol 5.2](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-2-protocol) |
| Plaque assay | [Protocol 5.3](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-3-protocol) |
| Picking a plaque | [Protocol 5.4](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-4-protocol) |
| Enriched isolation | [Protocol 5.5](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-5-protocol) |
| Spot test | [Protocol 5.6](https://seaphagesphagediscoveryguide.helpdocsonline.com/5-6-protocol) |
| Plaque assay for purification | [Protocol 6.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-1-protocol) |
| Serial dilutions | [Protocol 6.2](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-2-protocol) |
| Collecting plate lysates | [Protocol 6.3](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-3-protocol) |
| Spot titer | [Protocol 6.4](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-4-protocol) |
| Full plate titer | [Protocol 6.5](https://seaphagesphagediscoveryguide.helpdocsonline.com/6-5-protocol) |
| Making webbed plates | [Protocol 7.1](https://seaphagesphagediscoveryguide.helpdocsonline.com/7-1-protocol) |
| Actinobacteriophage database | [Protocol 7.2](https://seaphagesphagediscoveryguide.helpdocsonline.com/7-2-protocol) |
| Archiving samples | [Protocol 7.3](https://seaphagesphagediscoveryguide.helpdocsonline.com/7-3-protocol) |

DNA extraction is on the [phage DNA extraction](/research/protocols/phage-dna-extraction) page.

## Host strains

The two host strains are named under Host strain at the top of the page. Each links to its lab registry record, which has its culture collection number and the Guide's page for it.

Which host, by year:

| Years | Host | Media | Plate incubation |
| --- | --- | --- | --- |
| 2017 | *M. smegmatis* | Enrichment Broth | 37 °C; 48 h for plaque assays and titers, 24 h for webbed plates |
| 2018 to 2019 | *M. foliorum* | PYCa | 23 to 30 °C, 24 to 48 h |
| 2021 to 2025 | *M. foliorum* | PYCa liquid media, PYCa plates and PYCa top agar | 29 °C, 24 to 48 h |

Everything below that gives a temperature or time is for *M. foliorum* in PYCa unless it says *M. smegmatis*.

## What the lab uses

Most supplies are the Guide's. These are the lab's own choices:

- Host culture: 250 µl per plate; top agar held molten in a 55 °C bath; a plate incubator at 29 °C for *M. foliorum* and a shaking incubator at 220 to 250 rpm.
- 0.22 µm tube-top vacuum filter units for pooling several webbed plates into a 50 ml conical.
- A 1 to 10 µl pipettor for spot titers, and a light box for counting plaques.
- **Batch marking.** The lab marks host culture batches and plate batches with colored stripes (black, red, blue), so any problem can be traced to its batch.

## Plating with top agar (the plaque assay)

Plating is the Guide's plaque assay (Protocol 5.3). The lab's settings:

- Bottom agar plates come out of the 4 °C refrigerator early to reach room temperature, or are pre-warmed in the 29 °C incubator while the dilutions are made (about 7 to 10 minutes).
- For direct isolation, 500 µl of filtrate is delivered as 5 x 100 µl with a p200, or with a 5 ml pipette.
- Phage and host adsorb for 8 minutes for a plaque assay. For webbed plates on *M. foliorum* the lab uses 20 minutes with the tube swirled in a figure 8, longer than the Guide's 5 to 10 minutes.
- Top agar comes out of the 55 °C bath only at the moment of pouring, swirled first.
- Plates sit flat until the top agar sets: at least 15 to 20 minutes, and 30 to 40 minutes is safer. Only then are they inverted.
- Incubation: 29 °C for 24 to 48 hours for *M. foliorum*, 37 °C for *M. smegmatis*. Read plates are parafilmed and refrigerated.

### Tips from the lab

- **Even host.** The host culture must be homogeneous. Break clumps before the phage goes in, by swirling the tube in a figure 8, dragging it across a rack grate or the bench, and a quick vortex; do this before adding the phage, not after. Gentle tapping to mix phage and host gives well-defined plaques.
- **Small phage volumes.** When only 2 µl of phage goes into 250 µl host, put the drop on the tube wall and tilt the tube so it reaches the cells, then swirl and tap.
- **Warm plates.** Plates poured straight from the refrigerator collect condensation, and the top agar can slide or crumble. Warm plates on the bench first, but not for long in the incubator, which leaves bubbles and a poor surface. Freshly poured bottom agar also needs time to sit out before it holds top agar.
- **Top agar that sets.** Top agar that will not set is the most common plating problem. Its causes: top agar drawn lumpy or unswirled, cooled from sitting out, set early near the bottom of the jar, re-melted in the microwave and not mixed, or added too fast, and plates moved, taped together, rocked or inverted before setting. What works:
  - Swirl or shake the top agar bottle before every draw.
  - Plate in batches of about 3, and return the bottle to the 55 °C bath between batches.
  - Wait 20 to 30 minutes before moving plates, and tape plates together only after they have set.
  - If plates stay liquid after 20 to 25 minutes or overnight, pour the top agar alone into an empty plate. If it stays liquid, replace the batch.
- **The right plates.** Use PYCa plates for *M. foliorum*; nutrient agar and other media give no growth.
- **Parafilm and incubation.** Do not parafilm isolation plates before incubation; it prevents a lawn. Parafilm plates after reading (the one exception is webbed plates at 37 °C, below).
- **Invert set plates.** Once the top agar has set, invert the plates; plates incubated upright collect lid condensation on the lawn.
- **Scheduling.** The class meets on fixed days, so plates are pulled after 24 to 48 hours, parafilmed and held at 4 °C to pause growth, and read or picked days later. Keep plates away from the back of the refrigerator, where they can freeze.

## Direct vs enriched isolation

Both routes are the Guide's (Protocols 5.2 and 5.5). Direct platings are often negative (see below), so enrichment is the second route for a sample.

## Direct phage isolation

Tarleton's variant of Guide Protocol 5.2. What differs from the July 2025 edition:

- **Media volume.** The Guide covers the soil with 2 to 3 ml of media. The lab uses more, 3 to 4 ml of broth over 7 ml of soil, or 5 ml of soil with media to 7 ml above the soil, because 2 to 3 ml often leaves too little to filter (below).
- **Shaking time.** The Guide shakes 1 to 2 hours at 250 rpm; the lab shakes at 220 to 250 rpm and 29 °C, for up to 4 hours (below).
- **Filtrate storage.** The Guide says filtrate cannot be stored longer than 24 hours at 4 °C. The lab has plated older filtrate successfully (below), though fresh filtrate is still preferred.
- **Checking the plate.** The lab keeps negative plates for 5 to 6 days (below).

### Tips and troubleshooting

- **Shake long enough.** A 1-hour shake can be too short: 4 hours has given positive plates where 1 hour gave none.
- **Enough media.** Dry soil soaks up 2 to 3 ml of media during the shake and leaves nothing to draw off. Use 3 to 4 ml of broth over 7 to 8.5 ml of soil. For a dry tube, add about 3 ml more media and shake again (25 minutes is enough), or, in a 50 ml conical, add 8 ml more broth before filtering.
- **Enough filtrate.** Aim for 0.5 to 1 ml of filtrate; samples that give only about 200 µl seldom turn up phage. When a sample gives only 0.3 ml, spin the 15 ml tube again at 2,000 rpm, use a second filter, and plate 300 µl.
- **Muddy, clay or viscous extracts.** Thick, grainy or clay soils clog the 0.22 µm filter. What works:
  - Chill the tube at 4 °C for a few hours after shaking, then spin 10 minutes before drawing about 2 ml to filter.
  - Spin the 15 ml tube at 2,000 rpm for 10 minutes, twice if needed.
  - Split the settled liquid into 1 ml aliquots and microcentrifuge them (2 minutes at 2,000 rpm, or 10 minutes at maximum speed after adding 2 ml phage buffer), then filter the cleared liquid.
  - Pre-wet a fresh filter with phage buffer before pushing the rest through, and swap filters when one clogs.
  - Do not force a clogged filter: it can burst and lose the sample.
  - A silty lake-bed sample that will not settle after three 10-minute spins can be cleared by adding more broth, spinning again, and microcentrifuging about 0.5 ml aliquots for 5 minutes, then plating that supernatant without filtering.
- **Holding filtrate.** In this lab, filtrate held at 4 °C for 2 to 7 days still gave a plaque (a sample held 5 days, plated after a 2-hour host and phage pre-adsorption instead of 10 minutes). Plate fresh filtrate when you can.
- **Slow plaques.** Direct-isolation plaques on *M. foliorum* can be slow. A plate can show nothing at 15 to 18 hours and a small plaque only after several days: one plate had a single small, cloudy plaque at about 6 days, and that plaque went on to become a phage. Keep negative plates and recheck them daily for up to 5 or 6 days before discarding.
- **Expect negatives.** Most samples are negative, and a run of 7 or more negative samples before a positive is normal. To tell a negative sample from a technique problem, run a positive-control plaque assay with 10 µl of a known lysate. If it clears in 24 hours, the technique is sound, and the next step is new samples.

## Enriched phage isolation

Tarleton's variant of Guide Protocol 5.5, for *M. foliorum*. What differs from the July 2025 edition:

| Step | Guide | This lab |
| --- | --- | --- |
| Soil | to the 15 ml mark of a 50 ml conical | 10 ml |
| Media | to the 35 ml mark, vortex | 25 ml PYCa to the 35 ml mark, vortex 1 minute |
| Extraction shake | about 250 rpm, 1 to 2 hours | 250 rpm at 29 °C, 2 hours |
| Spin | 2,000 x g, 10 minutes | 3,110 rpm, 10 minutes |
| Host added to the filtrate | 0.5 ml | 250 µl |
| Enrichment | 220 rpm, 2 to 5 days | 220 to 250 rpm at 27 to 29.5 °C, 2 to 7 days |

The tube is capped a quarter turn and taped upright, as in the Guide. An aliquot is microcentrifuged, filtered through 0.22 µm, and spot tested. An aliquot can be pulled at day 2 for a spot test while the rest continues to day 5 as a backup.

### Water samples

A river-water enrichment gave the lab a positive spot: 45 ml water plus 5 ml 10X media, shaken at 180 rpm and 26 °C for about 2 hours, spun 10 minutes at 9,607 rpm and filtered, then 2.7 ml more 10X media and 250 µl host added and incubated about 6 days. Use the full 50 ml volume; a 10 ml version (9 ml water plus 1 ml 10X media) was negative.

### Tips and troubleshooting

- **Always filter the enrichment.** Filter every enrichment aliquot through 0.22 µm before plating; an unfiltered aliquot gives a contaminated plate, and refiltering the supernatant gives a clean plate.
- **Filters.** A 20 ml enrichment extract needs 5 to 6 syringe filters, about one per 5 ml.
- **A positive enrichment that clears the plate.** Plating 10 µl of a strong positive enrichment can clear the whole *M. foliorum* lawn. Flooding that cleared plate with 8 ml phage buffer, filtering, and plating 10^-1 to 10^-5 of the filtrate gives isolated plaques to start purification.
- **False plaques.** Bacterial growth on an enrichment plate can look like plaques. Look closely before picking.

## Spot test

The spot test is Guide Protocol 5.6. The lab adds one use of it: a single picked plaque from direct isolation is confirmed before starting dilutions by splitting a plate in two, spotting 10 µl of the pick (in 100 µl buffer) on one half and 10 µl phage buffer on the other, absorbing 20 minutes, and reading at 24 hours.

### Tips and troubleshooting

Running spots are the main spot-test problem.

- **Let the lawn set.** The lab lets the lawn set 30 minutes before spotting (the Guide says 20 minutes or until solid).
- **Let the spots soak in.** 10 µl spots need time to soak in before the plate moves: 30 to 45 minutes before incubation, and up to 4 to 5 hours if the plate must be carried, keeps them separate and readable.
- **Smaller spots.** Spotting 5 µl instead of the Guide's 10 µl helps.
- **Do not bump the plate.** Spots run into neighboring sections if the plate is moved or bumped too soon. Check that the incubator shelf is level.
- **Fresh top agar** also helps when spots keep running.
- **Hold negatives.** Hold a negative spot test 2 extra days before discarding, for slow phages.

## Phage purification: picking and replating plaques

Purification is Guide Protocols 5.4, 6.1 and 6.2: pick a single plaque, dilute it, replate it, and repeat until every plaque looks the same. The lab picks into 90 µl or 100 µl of phage buffer and plates 10 µl of each dilution with 250 µl host. The findings below are the lab's.

### Tips and troubleshooting

- **The dilution range for a fresh pick is low.** For a single-plaque pick, plate 10^0 to 10^-4, not out to 10^-8. A fresh pick plated at 10^0 to 10^-2 is often enough to give the first webbed plate, at 10^0.
- **Use a fresh pick.** A days-old pick tube, or the previous day's dilutions, often gives no plaques. Pick fresh, and vortex dilutions before plating.
- **How to pick.** Insert the tip straight down from directly above, into the center of the plaque; an angled stab often misses the phage. When a pick gives nothing, pick again, from a different plaque on the same plate if needed.
- **Restart the numbering each round.** Each purification round starts again at 10^-1 from the new pick; do not continue the numbering from the last round.
- **Make true 10-fold steps.** Use 10 µl into 90 µl for a 10-fold step: 10 µl into 100 µl is 11-fold. Do not add an extra "original" tube before the 10^-1 tube, which shifts every label by one step.
- **Picking from a contaminated plate.** Pick into 90 µl phage buffer, then push the pick through a 0.22 µm syringe filter pre-wetted with phage buffer (so the membrane does not hold back the sample) into the 10^0 tube, and start the dilution series from that filtrate. A plaque picked well away from a contaminated patch can still purify cleanly. If contamination keeps returning, start over from a freshly picked plaque.
- **Do not over-incubate.** Purification plates left too long all look the same and give nothing to pick. Some slow phages still need 48 hours at 29 °C, and up to 5 days for a dilution round.

### Turbid plaques and mixed morphologies

A turbid plaque is still a phage: one direct-isolation plate showed a single small, cloudy plaque at about 6 days, and it went on to become a phage. The lab purifies it like any other plaque; what matters is that every plaque on the plate looks the same. A second plaque morphology on dilution plates can mean cross-contamination from another phage in the room. Pick each morphology separately, and re-flood an earlier clean webbed plate for new lysate.

## Titering a phage lysate: spot titer and full plate titer

The spot titer and full plate titer are Guide Protocols 6.4 and 6.5, and the titer formula is the Guide's. What follows are the lab's worked numbers and the common arithmetic errors to avoid.

### Titer arithmetic

    titer (pfu/ml) = plaques counted / µl plated x 1,000 µl/ml x dilution factor

The dilution factor is 10^n for a 10^-n dilution. The result always has a positive exponent. A check: the exponent of the answer should equal log10(plaques per µl) + 3 + n.

Worked examples:

| Plaques | Volume plated | Dilution | Titer |
| --- | --- | --- | --- |
| 81 | 10 µl | 10^-3 | 8.1 x 10^6 pfu/ml |
| 103 | 10 µl | 10^-3 | 1.03 x 10^7 pfu/ml |
| 144 | 10 µl | 10^-3 | 1.44 x 10^7 pfu/ml |
| 40 | 10 µl | 10^-4 | 4 x 10^7 pfu/ml |
| 23 | 10 µl | 10^-6 | 2.3 x 10^9 pfu/ml |
| 42 | 10 µl | 10^-6 | 4.2 x 10^9 pfu/ml |
| 111 | 10 µl | 10^-6 | 1.11 x 10^10 pfu/ml |
| 10 | 10 µl | 10^-8 | 1.0 x 10^11 pfu/ml |
| 376 | 10 µl | undiluted | 3.76 x 10^4 pfu/ml |
| 6 | 3 µl (spot) | 10^-3 | 2 x 10^6 pfu/ml |

Common errors to avoid:

- **Exponent sign.** 40 plaques in 10 µl of 10^-4 is 4 x 10^7 pfu/ml, not 4 x 10^-7; 42 plaques in 10 µl of 10^-6 is 4.2 x 10^9, not 4.2 x 10^-8. A negative exponent on a titer is always wrong, and it carries into a wrong webbed-plate volume.
- **Volume.** 376 plaques from 10 µl undiluted is 3.76 x 10^4 pfu/ml, not 3.76 x 10^5. For spot titers, divide by the spot volume (3 µl) every time. Report per ml, not per µl.
- **Exponent arithmetic.** 74 plaques in 10 µl at 10^-5 is 7.4 x 10^8, not 7.4 x 10^11.
- **One lysate, one titer.** Different titers for each dilution plate of the same lysate mean a counting or dilution error. Recheck implausible values (such as 28.7 x 10^11).
- **Count on a light box.** Miscounts carry straight into wrong web volumes.

### Spot titer

The lab runs the Guide's spot titer (Protocol 6.4, 3 µl spots) with these findings:

- **Pipettor.** Use a 1 to 10 µl pipettor for 3 µl spots; spots from a p20 or p200 spread into each other. Vortex and check each tube for bubbles, and spread the dilution series across 3 lawns for countable spots.
- **Carrying the plate.** Spots run together if the plate is carried before they soak in. If that keeps happening, use a full plate titer instead.
- **Incubation time.** The Guide incubates 24 to 48 hours. Read spot titers at about 23 hours, checking from 12 hours on: by 48 hours plates dry and crack and spots merge. Do not leave a spot titer in the incubator over a weekend.
- **White particles.** White particulate at the bottom of every dilution tube means a contaminated lysate. Re-filter the lysate through a fresh 0.22 µm filter into a new sterile 15 ml conical.

### Full plate titer

The lab runs the Guide's full plate titer (Protocol 6.5), plating 10 µl of each dilution with 250 µl host, and notes which dilution gave a webbed plate: that is the shortcut to the high-titer lysate (see [the bracketing shortcut](#the-bracketing-shortcut)).

Tips and troubleshooting:

- **Extend the series.** When every plate to 10^-6 is uncountable, extend the series to 10^-12; one lysate counted about 300 at 10^-7 and about 35 at 10^-9.
- **Confluent lysis is not contamination.** Heavy lysis on the low-dilution plates (10^-1 to 10^-3) is confluent lysis. Check cleared or rough-looking low-dilution plates before discarding them; the countable plates are further down the series.
- **Slow phages.** Slow-growing, tiny-plaque phages show little at 24 hours and become countable after 2 to 3 days. One full plate titer read 23, 10 and 2 plaques at 10^-4, 10^-5 and 10^-6 at 1 day 23 hours, then 40 at 10^-4 a day later; another phage read best at 3 to 4 days. One *M. foliorum* lysate titer took 5 days to develop and was checked daily.
- **Unreadable plates.** If the top agar does not set, the plates cannot be read; the spot titer estimate can stand in to move on.
- **Positive control.** Before abandoning a lysate that gives no plaques from 10^-1 to 10^-8, plate it undiluted as a positive control.

## Webbed plates and the high titer lysate

Webbed plates and plate lysates are Guide Protocols 7.1 and 6.3. Tarleton's variant differs from the July 2025 edition in scale and in how the web dilution is found. The Guide estimates the plaques needed from plate and plaque area and makes 2 to 3 webbed plates for 8 to 10 ml of lysate. The lab first makes a low-volume lysate (LVL) from the last purification plate, then a high-volume, high-titer lysate (HVL, or HTL) from more plates, and finds the web dilution by bracketing.

The workflow as run in 2025:

1. Flood the webbed plate from the last purification round to make a low-volume lysate (about 5 ml).
2. Run a dilution series from the LVL and plate it to find the dilution that webs.
   > TROUBLESHOOTING: wrong-starting-sample
   > CALC: dilution
3. Pour 5 to 10 replicate plates at that dilution and volume.
   > CALC: webbed-plate
4. Flood them, pool them through one 0.22 µm filter into a 50 ml conical, and titer the pool. That is the HVL.
   > CALC: titer

### How much lysate per webbed plate

The calculation is:

    µl of lysate per plate = pfu wanted per plate / titer (pfu/ml) x 1,000 µl/ml

A worked example: 111 plaques on the 10^-6 plate (10 µl) is a titer of 1.11 x 10^10 pfu/ml. A target of about 11,100 pfu needs 1 x 10^-3 µl of lysate per plate. That was made as 1 µl lysate in 999 µl buffer, then 7 µl of that into 63 µl buffer, plating 10 µl per plate. Six of seven plates webbed in 24 hours, and the pooled HVL titered 2.2 x 10^11 pfu/ml.

The pfu a plate needs to web depends on plaque size, and is often higher than expected:

- On *M. smegmatis* at 37 °C, 8,000 to 12,000 pfu webbed (20 to 30 µl of the 10^-3 dilution of a 4 x 10^8 lysate), where 1,000 to 4,000 pfu did not. Ten µl of the 10^-2 dilution of a 7.4 x 10^7 lysate (about 7,400 pfu) on 8 plates webbed in 24 hours and gave an HVL of 5.3 x 10^9.
- For an *M. foliorum* phage (lysate 2.5 x 10^8 pfu/ml), about 20,000 pfu (8 µl of 10^-2) webbed, where about 5,000 pfu webbed few or no plates.
- For *M. foliorum* phages, targets of 1,500 pfu or less are usually too low to web.
- Targets range from 1.5 x 10^3 pfu for small plaques to 12,000 or 10^5 pfu for medium plaques.

Errors to avoid:

- **Leaving out the x 1,000 µl/ml conversion** makes the phage volume 1,000-fold too small: the plate shows a few small plaques instead of a web.
- **Moving the decimal the wrong way** (plating 10^-8 when it should be 10^-6).
- **A flipped exponent in the titer** carries straight into the web volume.

### The bracketing shortcut

Bracketing finds the web dilution directly:

1. Plate a 10-fold series of the lysate across whole decades (for example 10^-1 to 10^-4, or 10^-3 to 10^-6), or bracket 10-fold either side of the calculated volume.
2. See which dilution webbed.
3. Plate 6 to 8 replicates of exactly that dilution and volume.

The full plate titer does the first two steps already: the dilution that webbed on the titer is the one to repeat. Examples:

- From a 3.0 x 10^9 lysate the target was 6,000 pfu, or 2.0 x 10^-3 µl. Plating 4 µl of 10^-4, 2 µl and 1 µl of 10^-3, and 1 µl of 10^-2 (plus a negative control) showed that 1 µl of 10^-2 webbed. Five more of that plate gave 32.5 ml.
- From a 4.8 x 10^9 lysate the target was 3.125 x 10^-3 µl per plate, bracketed as 3 plates each at 10^-4, 10^-5 and 10^-6. Two of the 10^-4 plates webbed.
- A 10^-1 and 10^-2 plate cleared, 10^-3 webbed at 29 hours, and four 10^-3 plates gave the HVL.
- From a 1.22 x 10^8 lysate, 10 µl of 10^-3 on 5 plates all webbed and gave about 37 ml at 1.8 x 10^9.
- From a 1.44 x 10^7 lysate and a 1,500 pfu target (0.104 µl), 1 to 11 µl of the 10^-1 and 10^-2 dilutions were bracketed on 8 plates; 2 to 3 µl of 10^-1 webbed. From the resulting lysate, 3 µl of a 10^-3 dilution gave clean webs on 8 plates.
- Volumes other than 10 µl (6 and 12 µl, for example) can be used to bracket more finely. With small plaques, 15 plates, 5 at each of 3 volumes, bracket well.
- When the 10^-1 plate is overgrown and the 10^-2 plate too sparse, an intermediate 1:5 dilution of the 10^-1 tube gives a web.

**Re-bracket every new lysate.** The dilution that webs shifts between lysate batches: 10^-2 on one lysate, 10^-4 on the next. A low-volume lysate that cleared 10^-1 to 10^-3 webbed at 10^-4. Re-titer and re-bracket each lysate before plating a web batch.

**Volume limit.** The lab adds no more lysate than 10% of the cell volume, that is no more than 25 µl onto 250 µl host, or the cells lyse. When a calculation calls for 30 µl, plate 25 µl instead.

### Incubation of webbed plates

The Guide allows a webbed plate an additional 24 hours after the web is first seen. On *M. foliorum* at 29 °C, webbed plates can pass the web within that time:

- **Pull at about 22 to 24 hours.** Plates left about 30 hours can clear completely. Watch the plates over the last 3 hours; one day at 29 °C gave 6 of 6 webbed plates where two days over-clear. On *M. smegmatis*, pull at 24 hours.
- **But slow phages need longer.** A slow *M. foliorum* phage may need 48 to 72 hours and more input: 10 µl of undiluted lysate webbed at about 72 hours, and 20 µl in 48 hours. Webbed plates on *M. foliorum* can take up to 5 days. A slow web is helped by a day at room temperature before going back into the incubator.
- **Batch to batch.** One scale-up of 10 µl of the 10^-3 dilution on 6 plates all webbed at about 24 hours; a repeat batch of 7 plates needed a second overnight.
- **Web density.** If the calculated input clears the whole lawn, drop to 10 µl of 10^-4, then 5 µl of 10^-4 (one run gave 17.5 ml of lysate this way). If a 10^-2 input is too thin, plate undiluted low-volume lysate on 6 plates for only 24 hours; ten plates at 10^-1 of the low-volume lysate also work.
- **At 37 °C.** Webbing plates at 37 °C can dry out over 2 days; parafilm them shut.
- **Top agar.** Let the top agar set fully before inverting web plates.

## Collecting the phage lysate: flooding webbed plates

Flooding is Guide Protocol 6.3, with 8 ml phage buffer per plate as in the Guide. The lab's variant: the soak runs 2 to 6 hours at room temperature, or parafilmed at 4 °C overnight to 2 days (the Guide gives 2 to 4 hours, or 12 to 14 hours at 4 °C), and several plates are pooled through a tube-top vacuum filter straight into a 50 ml conical.

### Yields

The Guide gives about 4 ml per plate. Flooding each plate with 8 ml, this lab recovers more, typically 5 to 7 ml per plate:

| Plates | Lysate recovered |
| --- | --- |
| 1 | 4 to 7.5 ml |
| 3 | 10 to 25 ml |
| 4 | 20 to 30 ml |
| 6 | 16 to 40 ml |
| 7 | 40 ml (1.5 x 10^10 pfu/ml, 3 h flood) |
| 8 | 40 to over 50 ml (6.0 x 10^9 pfu/ml, 2 h flood) |

Four plates gave about 27 ml after 5 hours on the bench and about 30 ml after 19 hours at 4 °C (2.04 x 10^10 pfu/ml). The lab makes the high-volume lysate from 4 to 8 webbed plates, not the Guide's 2 to 3. Plan about 6 webbed plates to cover 10 ml for archiving plus 10 ml for [DNA extraction](/research/protocols/phage-dna-extraction).

### Tips and troubleshooting

- **Buffer soaks in.** Dry or aged webbed plates absorb buffer: 8 ml on such a plate can return only 3.5 ml. When a flood soaks into the agar, add a second 8 ml, or flood with 10 ml. Wetter plates give more.
- **Holding webbed plates.** Webbed plates can be parafilmed and held at 4 °C for 24 hours or a weekend before flooding. A webbed plate held 10 days at 4 °C still flooded to about 5 ml of usable lysate. Flood times from 3 to 4 hours at room temperature to 24 hours, a weekend or 5 days at 4 °C all give usable lysate.
- **Clogged filters.** Webbed plates with bacterial growth clog a 0.22 µm filter after about 3 plates. Hold the remaining flooded plates at 4 °C overnight and finish with a fresh filter the next day. When a vacuum unit clogs partway, draw the rest off the funnel with a 5 ml syringe and finish through a 0.22 µm syringe filter. One syringe filter can be reused across plates by detaching it between draws.
- **Clean lysate from overgrown plates.** The 0.22 µm filtration removes bacterial growth on webbed plates, and the lysate is usable. If a filtered lysate grows contaminants in a titer, re-filter it through 0.22 µm, or make new webs from the earlier low-volume lysate.
- **Low-volume lysate from a plate that did not web.** Flooding the plate with the most plaques with 8 ml overnight at 4 °C gives about 4.75 ml at a low titer, enough to start webbed plates. First lysates run 2 to 5.5 ml.

### Serial flooding to raise the titer

This is not a Guide protocol. A lysate can be concentrated by using the liquid from one flooded webbed plate to flood a second, unflooded webbed plate:

- One plate's filtered lysate (5 ml) topped up with 3 ml phage buffer, used to flood a second plate for 2 hours, then a third, took an LVL of 9.4 x 10^9 to an HVL of 8.4 x 10^10 pfu/ml.
- 6 ml buffer on 4 webbed plates for 2 hours at room temperature, moved onto 4 more webbed plates for 2 hours, gave about 10 ml at 2.6 x 10^9 pfu/ml. Repeated 3 onto 3, it gave 9.5 ml at 4.2 x 10^10.

The gain varies from about 10-fold to none, and a double-volume flood (16 ml instead of 8 ml) does not raise the titer, so serial flooding is no substitute for well-webbed plates.

## Storage

Archiving is Guide Protocol 7.3, and entering a phage in [PhagesDB](https://phagesdb.org/) is Protocol 7.2. The Guide's high-titer lysate is at least 5 x 10^9 pfu/ml.

- Lysates, filtrates and plates waiting to be read or flooded are held at 4 °C.
- Titer the high titer lysate before archiving, to confirm it meets the Guide's high titer.
- A high-volume lysate is split: about 10 ml for archiving and about 10 ml for [phage DNA extraction](/research/protocols/phage-dna-extraction).
- Keep plates away from the back of the refrigerator, where they can freeze.

## Troubleshooting: when every group's plates fail at once

When every group's plates look wrong at the same time, the cause is usually a shared stock, not technique. Check the shared reagents first.

- **Host culture.** Speckled, thin lawns and no plaques across the class point to a dying host working culture. Test it: plate a host-only lawn (250 µl host plus 3 ml top agar, no phage), or a fresh host culture beside the old one. The fix is a new culture, fresh phage buffer, and a new dilution series from the low-volume lysate.
- **Phage buffer.** Plaques on a buffer-only control plate, or dilution counts that do not fall 10-fold, mean phage-contaminated phage buffer. Discard it and remake dilutions and plates from a fresh sterile bottle. Keep a buffer-only control plate in every run.
- **Media and top agar.** Replace a contaminated PYCa or top agar batch with a fresh one, and remake contaminated host culture batches.
- **Pipette tips.** Keep tips in their wrappers until use, and give each group its own tips.

Related pages: [the Virus Isolation Course](/teaching/virus-isolation), [Lab Calculations and Common Questions](/teaching/virus-isolation/faq), [phage discovery at Tarleton](/teaching/phage-discovery), [the phages we have found](/research/phages), [phage DNA extraction](/research/protocols/phage-dna-extraction), and [teaching](/teaching).
