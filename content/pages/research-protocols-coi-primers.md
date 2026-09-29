---
path: /research/protocols/coi-primers
title: "COI primers: LCO1490 and HCO2198"
seo_title: "COI primers LCO1490/HCO2198: sequences and PCR conditions"
description: "LCO1490 and HCO2198 (Folmer) primer sequences for COI barcoding PCR of invertebrate mitochondrial DNA, with the cycling table, materials and product size."
protocol:
  steps: ["#primer-sequences", "#pcr-conditions"]
  reagents: MISSING
  timings:
    - stage: initial denaturation
      temperature_c: 94
      time: 30 sec.
    - stage: 20 cycles
      cycles: 20
      steps:
        - { temperature_c: 94, time: 30 sec. }
        - { temperature_c: "56 to 46", touchdown_step_c: MISSING, time: 30 sec. }
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
  primers:
    - { name: LCO1490, direction: forward, sequence: GGTCAACAAATCATAAAGATATTGG }
    - { name: HCO2198, direction: reverse, sequence: TAAACTTCAGGGTGACCAAAAAATCA }
  equipment:
    - NEB 100 bp ladder
    - 1% agarose gel in TBE
  host_strain: not applicable
  source:
    - citation: "Folmer, O., Black, M., Hoeh, W., Lutz, R. and Vrijenhoek, R. (1994). DNA primers for amplification of mitochondrial cytochrome c oxidase subunit I from diverse metazoan invertebrates. Molecular Marine Biology and Biotechnology 3: 294-299."
      url: https://www.mbari.org/wp-content/uploads/2016/01/Folmer_94MMBB.pdf
      for: primer sequences
    - citation: "the lab's written protocol"
      for: cycling program
  biosafety: MISSING
  status: MISSING
  version: MISSING
  last_run: MISSING
---

This is the PCR protocol my lab uses to amplify the mitochondrial cytochrome c oxidase subunit I (COI) gene from metazoan invertebrates with the LCO1490 and HCO2198 primers, often called the Folmer primers. It gives the primer sequences, the PCR conditions and the materials for COI barcoding PCR.

## What the primers amplify

The primers amplify a region of the mitochondrial COI gene in metazoan invertebrates. Folmer et al. (1994) report the product as about 710 bp. The gel shown on the original version of this page marked the product at 708 bp, next to a 100 bp ladder, in the positive (mtDNA) lane, with no band in the negative lane; that figure is read from the gel.

The primers come from Folmer et al. (1994), who designed them to amplify this region of COI from a wide range of invertebrate phyla.

## Primer sequences

| Primer | Direction | Sequence (5′ to 3′) |
| --- | --- | --- |
| LCO1490 | Forward | `GGTCAACAAATCATAAAGATATTGG` |
| HCO2198 | Reverse | `TAAACTTCAGGGTGACCAAAAAATCA` |

## Materials

- [Promega GoTaq® Flexi DNA polymerase](https://www.promega.com/products/pcr/endpoint-pcr/gotaq-flexi-dna-polymerase/?catNum=M8296)
- [NEB 100 bp ladder](https://www.neb.com/products/n3231-100-bp-dna-ladder)
- 1% agarose gel in TBE

## Reaction mix

Use your polymerase's recommended reaction mix. This page does not record the mix the lab used.

For reference, Folmer et al. (1994) published this 50 µL mix for Promega *Taq*: 1 µL template DNA, 4 U *Taq* polymerase, 5 µL 10x buffer, 5 µL MgCl2 (0.025 mol/L), 2.5 µL of each primer at 10 µmol/L, 5 µL dNTP mix as in Folmer, and 29 µL water.

## PCR conditions

This cycling program is the lab's, not Folmer's. Folmer et al. (1994) used 35 cycles of one minute at 95 °C, one minute at 40 °C and one and a half minutes at 72 °C, followed by 72 °C for seven minutes.

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

The first 20 cycles are a touchdown: the annealing temperature steps down from 56 to 46 °C over those cycles. The lab's written protocol gives no step size, and no published source settles one, so none is stated here. The second block of 20 cycles anneals at 46 °C.

Run the product on the 1% agarose gel in TBE beside the 100 bp ladder and look for the band at 708 bp.

## In this lab

In this lab, COI has been run on insect DNA ahead of the Wolbachia 16S PCR, so that a sample with no Wolbachia band can be told apart from a sample with no amplifiable DNA.

## Reference

Folmer, O., Black, M., Hoeh, W., Lutz, R. and Vrijenhoek, R. (1994). DNA primers for amplification of mitochondrial cytochrome c oxidase subunit I from diverse metazoan invertebrates. Molecular Marine Biology and Biotechnology 3: 294-299. [PDF](https://www.mbari.org/wp-content/uploads/2016/01/Folmer_94MMBB.pdf)

## Related protocols

- [Pan-avian GAPDH PCR](/research/protocols/pan-avian-gapdh)
- [REV PCR primers](/research/protocols/rev-lpdv-primers)
- [All protocols](/research/protocols)
