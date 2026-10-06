---
profile: protocol
path: /research/protocols/coi-primers
title: "COI primers: LCO1490 and HCO2198"
seo_title: "COI primers LCO1490/HCO2198: sequences and PCR conditions"
description: "LCO1490 and HCO2198 (Folmer) primer sequences for COI barcoding PCR of invertebrate mitochondrial DNA, with the cycling table, materials and product size."
method: [pcr]
target: ["COI (cytochrome c oxidase subunit I)"]
version: "MISSING: No version has been assigned (protocols.md: printed sheets carry a version id and date)."
updated: 2026-09-30
status: "MISSING: No source in the repo states a status for this protocol."
last_run: "MISSING: protocols.md: nothing is marked as run in the lab until someone has worked from the rendered page and dated it."
host_strain: not applicable
biosafety: "MISSING: Waiting on Dustin: the biosafety officer check (core.md). protocols.md: list the agent only (organism and strain, with its ATCC number); the agent for this protocol is his to name."
biosafety_level: "MISSING: Waiting on Dustin: he sets BSL-1 or BSL-2 for each protocol himself."
scale: "MISSING: The page does not record the reaction mix the lab used, so it states no reaction volume or number of reactions to scale by."
primers:
  - { primer: lco1490 }
  - { primer: hco2198 }
cycling:
  - program:
      - stage: initial denaturation
        temperature_c: 94
        time: 30 sec.
      - stage: 20 cycles
        cycles: 20
        steps:
          - { temperature_c: 94, time: 30 sec. }
          - temperature_c: "56 to 46"
            touchdown_step_c: "MISSING: Waiting on Dustin: touchdown steps (core.md). The page: the lab's written protocol gives no step size, and no published source settles one."
            time: 30 sec.
          - { temperature_c: 72, time: 1 min. }
      - stage: second block of 20 cycles
        cycles: 20
        steps:
          - { temperature_c: 94, time: 30 sec. }
          - { temperature_c: 46, time: 30 sec. }
          - { temperature_c: 72, time: 1 min. }
      - stage: extension
        temperature_c: 72
        time: 10 min.
      - stage: hold
        temperature_c: 10
        time: "∞"
based_on:
  - citation: "Folmer, O., Black, M., Hoeh, W., Lutz, R. and Vrijenhoek, R. (1994). DNA primers for amplification of mitochondrial cytochrome c oxidase subunit I from diverse metazoan invertebrates. Molecular Marine Biology and Biotechnology 3: 294-299."
    url: https://www.mbari.org/wp-content/uploads/2016/01/Folmer_94MMBB.pdf
    for: primer sequences
  - citation: "the lab's written protocol"
    for: cycling program
materials:
  - name: GoTaq Flexi DNA polymerase
    reagent: gotaq-flexi-dna-polymerase
    amount: "MISSING: The page says it does not record the reaction mix the lab used; the Folmer et al. (1994) mix it prints is for reference only."
  - name: NEB 100 bp ladder
    reagent: neb-100-bp-dna-ladder
    amount: "MISSING: The page does not state how much ladder is loaded beside the product."
equipment:
  - name: 1% agarose gel in TBE
expected_results: "Folmer et al. (1994) report the product as about 710 bp. In the lab's gels the product runs at about 708 bp beside a 100 bp ladder, with a band in the positive (mtDNA) lane and none in the negative lane."
limitations: "MISSING: The page states no limitations of the method; it records only that extension temperature is dependent on polymerase and that the lab's reaction mix and touchdown step size are not recorded."
references:
  - "Folmer, O., Black, M., Hoeh, W., Lutz, R. and Vrijenhoek, R. (1994). DNA primers for amplification of mitochondrial cytochrome c oxidase subunit I from diverse metazoan invertebrates. Molecular Marine Biology and Biotechnology 3: 294-299. [PDF](https://www.mbari.org/wp-content/uploads/2016/01/Folmer_94MMBB.pdf)"
---

This is the PCR protocol my lab uses to amplify the mitochondrial cytochrome c oxidase subunit I (COI) gene from metazoan invertebrates with the LCO1490 and HCO2198 primers, often called the Folmer primers. It gives the primer sequences, the PCR conditions and the materials for COI barcoding PCR.

## What the primers amplify

The primers amplify a region of the mitochondrial COI gene in metazoan invertebrates. Folmer et al. (1994) report the product as about 710 bp. In the lab's gels the product runs at about 708 bp beside a 100 bp ladder, with a band in the positive (mtDNA) lane and none in the negative lane.

The primers come from Folmer et al. (1994), who designed them to amplify this region of COI from a wide range of invertebrate phyla.

## Reaction mix

1. Set up the reaction with the mix recommended for your polymerase. The lab uses Promega GoTaq® Flexi DNA polymerase.

For reference, Folmer et al. (1994) published this 50 µL mix for Promega *Taq*: 1 µL template DNA, 4 U *Taq* polymerase, 5 µL 10x buffer, 5 µL MgCl2 (0.025 mol/L), 2.5 µL of each primer at 10 µmol/L, 5 µL dNTP mix as in Folmer, and 29 µL water.

## PCR conditions

This is the lab's cycling program. Folmer et al. (1994) used 35 cycles of one minute at 95 °C, one minute at 40 °C and one and a half minutes at 72 °C, followed by 72 °C for seven minutes.

Extension temperature is dependent on polymerase.

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 94 | 30 sec. |
| 20 cycles | 94 | 30 sec. |
|  | 56 to 46 (touchdown) | 30 sec. |
|  | 72 | 1 min. |
| 20 cycles | 94 | 30 sec. |
|  | 46 | 30 sec. |
|  | 72 | 1 min. |
| extension | 72 | 10 min. |
| hold | 10 | ∞ |

The first 20 cycles are a touchdown: the annealing temperature steps down from 56 to 46 °C over those cycles. The second block of 20 cycles anneals at 46 °C.

2. Run the product on the #1% agarose gel in TBE{} beside the 100 bp ladder and look for the band at 708 bp.
   > EXPECT: The product at 708 bp, next to the 100 bp ladder, in the positive (mtDNA) lane, with no band in the negative lane.

## In this lab

In this lab, COI has been run on insect DNA ahead of the Wolbachia 16S PCR, so that a sample with no Wolbachia band can be told apart from a sample with no amplifiable DNA.

## Related protocols

- [Pan-avian GAPDH PCR](/research/protocols/pan-avian-gapdh)
- [REV PCR primers](/research/protocols/rev-lpdv-primers)
- [All protocols](/research/protocols)
