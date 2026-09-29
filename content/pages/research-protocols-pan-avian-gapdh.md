---
path: /research/protocols/pan-avian-gapdh
title: "Pan-avian GAPDH PCR"
seo_title: "Pan-avian GAPDH primers: avian GAPDH PCR control"
description: "Pan-avian GAPDH primer sequences and PCR conditions, used as a control that a bird DNA extraction holds amplifiable avian DNA. Product: 534 bp."
protocol:
  steps: ["#primer-sequences", "#reaction-mix", "#pcr-conditions"]
  reagents:
    - { name: Nuclease-free water, amount: 5.5 µL, per: 25 µL }
    - { name: OneTaq Hot Start 2X Master Mix (New England Biolabs), amount: 12.5 µL, per: 25 µL }
    - { name: Forward primer, amount: 1 µL, stock: 10 µM, per: 25 µL }
    - { name: Reverse primer, amount: 1 µL, stock: 10 µM, per: 25 µL }
    - { name: Eluted DNA, amount: 5 µL, per: 25 µL }
  timings:
    - stage: initial denaturation
      temperature_c: 95
      time: 10 min.
    - stage: 40 cycles
      cycles: 40
      steps:
        - { temperature_c: 95, time: 30 sec. }
        - { temperature_c: 58, time: 60 sec. }
        - { temperature_c: 68, time: 30 sec. }
    - stage: extension
      temperature_c: 68
      time: 5 min.
    - stage: hold
      temperature_c: 10
      time: "∞"
  primers:
    - { direction: forward, sequence: GTGGTGCTAAGCGTGTTATCATC }
    - { direction: reverse, sequence: GGCAGCACCTCTGCCATC }
  equipment:
    - NEB 100 bp ladder
    - 2% agarose gel in TBE
  host_strain: not applicable
  source:
    - citation: "Olias et al. 2014"
      url: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4057121/
      for: primer sequences
    - citation: "Stewart et al. 2019, J Wildl Dis 55(3)"
      doi: 10.7589/2018-08-187
      for: reaction mix and cycling (cycling in the supplement)
    - citation: "Cox et al. 2022"
      doi: 10.7589/JWD-D-22-00023
      for: same cycling
  biosafety: MISSING
  status: MISSING
  version: MISSING
  last_run: MISSING
---

This is the PCR protocol my lab uses to amplify pan-avian GAPDH (glyceraldehyde-3-phosphate dehydrogenase). It serves as a control for avian DNA: a GAPDH band shows that a bird DNA extraction holds DNA that will amplify, so a negative result in a virus PCR such as the [REV PCR](/research/protocols/rev-lpdv-primers) can be trusted.

## Primer sequences

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `GTGGTGCTAAGCGTGTTATCATC` |
| Reverse | `GGCAGCACCTCTGCCATC` |

The primers are from [Olias et al. 2014](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4057121/) (PMC4057121). The protocol on this page is the one published in [Stewart et al. 2019, J Wildl Dis 55(3)](/research/publications/10-7589-2018-08-187/), with the cycling in that paper's supplement; [Cox et al. 2022](/research/publications/10-7589-jwd-d-22-00023/) used the same cycling.

## Product size

Olias et al. 2014 give the genomic product as 534 bp. The gel shown on the original version of this page marked the product at 534 bp, next to a 100 bp ladder. The positive lane was DNA from DF-1 cells; the negative lane had no band.

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

Run the product on the 2% agarose gel in TBE beside the 100 bp ladder and look for the band at 534 bp.

## Related pages

- [REV PCR primers](/research/protocols/rev-lpdv-primers)
- [REV and LPDV research](/research/retroviruses/avian)
- [COI primers](/research/protocols/coi-primers)
