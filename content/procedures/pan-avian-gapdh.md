---
profile: protocol
path: /research/protocols/pan-avian-gapdh
title: "Pan-avian GAPDH PCR"
seo_title: "Pan-avian GAPDH primers: avian GAPDH PCR control"
description: "Pan-avian GAPDH primer sequences and PCR conditions, used as a control that a bird DNA extraction holds amplifiable avian DNA."
method: [pcr]
organism: [avian]
target: [GAPDH]
version: "MISSING: No version has been assigned (protocols.md: printed sheets carry a version id and date)."
updated: 2026-09-30
status: "MISSING: No source in the repo states a status for this protocol."
last_run: "MISSING: protocols.md: nothing is marked as run in the lab until someone has worked from the rendered page and dated it."
host_strain: not applicable
biosafety: "MISSING: Waiting on Dustin: the biosafety officer check (core.md). protocols.md: list the agent only (organism and strain, with its ATCC number); the agent for this protocol is his to name."
biosafety_level: "MISSING: Waiting on Dustin: he sets BSL-1 or BSL-2 for each protocol himself."
scale: { count: 1, unit: reaction }
based_on:
  - citation: "Olias et al. 2014"
    url: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4057121/
    for: primer sequences
  - citation: "Stewart et al. 2019, J Wildl Dis 55(3)"
    doi: 10.7589/2018-08-187
    for: reaction mix and cycling (cycling in the supplement)
  - citation: "Cox et al. 2022"
    doi: 10.7589/JWD-D-22-00023
    for: same cycling
materials:
  - name: nuclease-free water
    display: Nuclease-free water
    amount: 5.5 µL
    per: reaction
  - name: OneTaq Hot Start 2X Master Mix
    display: One*Taq* Hot Start 2X Master Mix (New England Biolabs)
    amount: 12.5 µL
    per: reaction
    note: "[NEB One*Taq*® Hot Start 2X Master Mix](https://www.neb.com/products/m0484-onetaq-hot-start-2x-master-mix-with-standard-buffer)"
  - name: forward primer
    display: Forward primer (10 µM stock)
    stock: [10 µM]
    amount: 1 µL
    per: reaction
  - name: reverse primer
    display: Reverse primer (10 µM stock)
    stock: [10 µM]
    amount: 1 µL
    per: reaction
  - name: eluted DNA
    display: Eluted DNA
    amount: 5 µL
    per: reaction
equipment:
  - NEB 100 bp ladder
  - 2% agarose gel in TBE
primers:
  - { primer: gapdh-forward }
  - { primer: gapdh-reverse }
cycling:
  - program:
      - { stage: initial denaturation, temperature_c: 95, time: 10 min. }
      - stage: 40 cycles
        cycles: 40
        steps:
          - { temperature_c: 95, time: 30 sec. }
          - { temperature_c: 58, time: 60 sec. }
          - { temperature_c: 68, time: 30 sec. }
      - { stage: extension, temperature_c: 68, time: 5 min. }
      - { stage: hold, temperature_c: 10, time: "∞" }
expected_results: "A band at the product size computed under Primers, beside the 100 bp ladder. In the lab's gels the product runs at that size, with DNA from DF-1 cells as the positive control and no band in the negative lane."
limitations: "Extension temperature is dependent on polymerase: the lab runs the extension at 68 °C for the One*Taq* mix, where Olias et al. 2014 used 72 °C."
references:
  - "Olias et al. 2014. [PMC4057121](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4057121/)"
  - "Stewart et al. 2019, *J Wildl Dis* 55(3). [doi:10.7589/2018-08-187](https://doi.org/10.7589/2018-08-187). On this site: [Stewart et al. 2019](/research/publications/10-7589-2018-08-187/)."
  - "Cox et al. 2022. [doi:10.7589/JWD-D-22-00023](https://doi.org/10.7589/JWD-D-22-00023). On this site: [Cox et al. 2022](/research/publications/10-7589-jwd-d-22-00023/)."
---

This is the PCR protocol my lab uses to amplify pan-avian GAPDH (glyceraldehyde-3-phosphate dehydrogenase). It serves as a control for avian DNA: a GAPDH band shows that a bird DNA extraction holds DNA that will amplify, so a negative result in a virus PCR such as the [REV PCR](/research/protocols/rev-lpdv-primers) can be trusted.

## Where the primers come from

The primers are from [Olias et al. 2014](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4057121/) (PMC4057121). The protocol on this page is the one published in [Stewart et al. 2019, J Wildl Dis 55(3)](/research/publications/10-7589-2018-08-187/), with the cycling in that paper's supplement; [Cox et al. 2022](/research/publications/10-7589-jwd-d-22-00023/) used the same cycling.

## Product size

The product size is computed under Primers, from where the primers bind the chicken genome. In the lab's gels the product runs at that size beside a 100 bp ladder, with DNA from DF-1 cells as the positive control and no band in the negative lane.

## Materials

- [NEB One*Taq*® Hot Start 2X Master Mix](https://www.neb.com/products/m0484-onetaq-hot-start-2x-master-mix-with-standard-buffer)
- [NEB 100 bp ladder](https://www.neb.com/products/n3231-100-bp-dna-ladder)
- 2% agarose gel in TBE

## Reaction mix

From Stewart et al. 2019, for each 25 µL reaction:

| Component | Volume |
| --- | --- |
| Nuclease-free water | 5.5 µL |
| One*Taq* Hot Start 2X Master Mix (New England Biolabs) | 12.5 µL |
| Forward primer (10 µM stock) | 1 µL |
| Reverse primer (10 µM stock) | 1 µL |
| Eluted DNA | 5 µL |

1. Set up each 25 µL reaction as in the table: @nuclease-free water|Nuclease-free water{5.5%µL}, @OneTaq Hot Start 2X Master Mix|One*Taq* Hot Start 2X Master Mix{12.5%µL} (New England Biolabs), @forward primer|Forward primer (10 µM stock){1%µL}, @reverse primer|Reverse primer (10 µM stock){1%µL} and @eluted DNA|Eluted DNA{5%µL}.

## PCR conditions

Extension temperature is dependent on polymerase. The lab runs the extension at 68 °C for the One*Taq* mix, where Olias et al. 2014 used 72 °C.

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 10 min. |
| 40 cycles | 95 | 30 sec. |
|  | 58 | 60 sec. |
|  | 68 | 30 sec. |
| extension | 68 | 5 min. |
| hold | 10 | ∞ |

2. Run the cycling program in the table above.
3. Run the product on the #2% agarose gel in TBE{} beside the #NEB 100 bp ladder{} and look for the band at the product size listed under Primers.
   > EXPECT: A band at the product size listed under Primers in the positive control (DNA from DF-1 cells) and no band in the negative lane.

## Related pages

- [REV PCR primers](/research/protocols/rev-lpdv-primers)
- [REV and LPDV research](/research/retroviruses/avian)
- [COI primers](/research/protocols/coi-primers)
