---
profile: protocol
path: /research/protocols/rev-lpdv-primers
title: "REV and LPDV PCR primers"
seo_title: "REV and LPDV PCR primers: LTR, pol and p31/CA"
description: "PCR primers for reticuloendotheliosis virus (REV) LTR and pol and for LPDV p31/CA: sequences, reaction mix, cycling tables and product sizes."
version: "MISSING: No version has been assigned (protocols.md: printed sheets carry a version id and date)."
updated: 2026-09-30
status: "MISSING: No source in the repo states a status for this protocol."
last_run: "MISSING: protocols.md: nothing is marked as run in the lab until someone has worked from the rendered page and dated it."
host_strain: not applicable
biosafety: "MISSING: Waiting on Dustin: the biosafety officer check (core.md). protocols.md: list the agent only (organism and strain, with its ATCC number); the agent for this protocol is his to name."
scale: { count: 1, unit: reaction }
based_on:
  - citation: "Stewart et al. 2019, J Wildl Dis 55(3)"
    doi: 10.7589/2018-08-187
    for: REV primer sets, reaction mix and REV cycling (cycling in the supplement)
  - citation: "Cox et al. 2022, J Wildl Dis 58(4)"
    doi: 10.7589/JWD-D-22-00023
    for: REV 3′ LTR cycling (same as Stewart et al. 2019) and LPDV cycling (in the supplement)
  - citation: "Allison et al. 2014, Virology 450-451:2-12"
    doi: 10.1016/j.virol.2013.11.037
    for: LPDV primer sequences
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
    note: "Cox et al. 2022 used primers at 200-400 nM final concentration."
  - name: reverse primer
    display: Reverse primer (10 µM stock)
    stock: [10 µM]
    amount: 1 µL
    per: reaction
    note: "Cox et al. 2022 used primers at 200-400 nM final concentration."
  - name: eluted DNA
    display: Eluted DNA
    amount: 5 µL
    per: reaction
    note: "Cox et al. 2022 used the same master mix in 25 µL reactions with 2 µL of eluted DNA."
equipment:
  - NEB 100 bp ladder
  - 2% agarose gel in TBE
primers:
  - { set: PCR REV 3′ LTR 8000-8297, direction: forward, sequence: CATACTGGAGCCAATGGTT }
  - { set: PCR REV 3′ LTR 8000-8297, direction: reverse, sequence: AATGTTGTACCGAAGTACT }
  - { set: PCR REV pol 2500-3075, direction: forward, sequence: CAAATAATAGATTTTCTAGTAGATACGGGA }
  - { set: PCR REV pol 2500-3075, direction: reverse, sequence: AGTGGACGGGTCTCAGGA }
  - { set: PCR REV pol 4777-5575, direction: forward, sequence: CGAGAAGTAGCTATACGTCCTTTG }
  - { set: PCR REV pol 4777-5575, direction: reverse, sequence: ACATCGTGCCCGGAGC }
  - { set: PCR LPDV p31/CA, direction: forward, sequence: ATGAGGACTTGTTAGATTGGTTAC }
  - { set: PCR LPDV p31/CA, direction: reverse, sequence: TGATGGCGTCAGGGCTATTTG }
cycling:
  - set: PCR REV 3′ LTR 8000-8297
    program:
      - { stage: initial denaturation, temperature_c: 95, time: 5 min. }
      - stage: 35 cycles
        cycles: 35
        steps:
          - { temperature_c: 95, time: 30 sec. }
          - { temperature_c: 47, time: 45 sec. }
          - { temperature_c: 68, time: 60 sec. + 1 sec. per cycle }
      - { stage: extension, temperature_c: 68, time: 10 min. }
      - { stage: hold, temperature_c: 10, time: "∞" }
  - set: PCR REV pol 2500-3075
    program:
      - { stage: initial denaturation, temperature_c: 95, time: 10 min. }
      - stage: 15 cycles
        cycles: 15
        steps:
          - { temperature_c: 95, time: 30 sec. }
          - { temperature_c: "60 to 50", touchdown_step_c: "MISSING: Waiting on Dustin: touchdown steps (core.md). The page: the published protocol (Stewart et al. 2019) gives no step size.", time: 45 sec. }
          - { temperature_c: 68, time: 120 sec. }
      - stage: 20 cycles
        cycles: 20
        steps:
          - { temperature_c: 95, time: 30 sec. }
          - { temperature_c: 50, time: 60 sec. }
          - { temperature_c: 68, time: 120 sec. }
      - { stage: extension, temperature_c: 68, time: 9 min. }
      - { stage: hold, temperature_c: 10, time: "∞" }
  - set: PCR REV pol 4777-5575
    program:
      - { stage: initial denaturation, temperature_c: 95, time: 10 min. }
      - stage: 15 cycles
        cycles: 15
        steps:
          - { temperature_c: 95, time: 30 sec. }
          - { temperature_c: "60 to 50", touchdown_step_c: "MISSING: Waiting on Dustin: touchdown steps (core.md). The page: same cycling as pol 2500-3075, with no published step size.", time: 45 sec. }
          - { temperature_c: 68, time: 120 sec. }
      - stage: 20 cycles
        cycles: 20
        steps:
          - { temperature_c: 95, time: 30 sec. }
          - { temperature_c: 50, time: 60 sec. }
          - { temperature_c: 68, time: 120 sec. }
      - { stage: extension, temperature_c: 68, time: 9 min. }
      - { stage: hold, temperature_c: 10, time: "∞" }
  - set: PCR LPDV p31/CA
    program:
      - { stage: initial denaturation, temperature_c: 95, time: 3 min. }
      - stage: 34 cycles
        cycles: 34
        steps:
          - { temperature_c: 95, time: 30 sec. }
          - { temperature_c: 54, time: 30 sec. }
          - { temperature_c: 68, time: 60 sec. }
      - { stage: extension, temperature_c: 68, time: 10 min. }
      - { stage: hold, temperature_c: 10, time: "∞" }
expected_results: "PCR REV 3′ LTR 8000-8297: 282 bp computed on DQ387450; 297 bp read from the gel. PCR REV pol 2500-3075: 574 bp computed on DQ387450; 575 bp read from the gel. PCR REV pol 4777-5575: 801 bp computed on DQ387450; 798 bp read from the gel. PCR LPDV p31/CA: 458 bp on U09568, positions 1041-1498, computed by placing both primers on the sequence. On the original pages each gel showed a band in the REV-positive lane and none in the negative lane, beside a 100 bp ladder."
limitations: "A gel reading is an estimate, and field strains can differ from DQ387450, so the computed and gel sizes need not agree exactly. The touchdown in the two *pol* sets steps down from 60 to 50 °C over 15 cycles, and the published protocol gives no step size. Extension temperature is dependent on polymerase: the 68 °C extensions are for the One*Taq* mix."
references:
  - "Stewart et al. 2019, *J Wildl Dis* 55(3). [doi:10.7589/2018-08-187](https://doi.org/10.7589/2018-08-187). On this site: [Stewart et al. 2019](/research/publications/10-7589-2018-08-187/)."
  - "Cox et al. 2022, *J Wildl Dis* 58(4). [doi:10.7589/JWD-D-22-00023](https://doi.org/10.7589/JWD-D-22-00023). On this site: [Cox et al. 2022](/research/publications/10-7589-jwd-d-22-00023/)."
  - "Allison et al. 2014, *Virology* 450-451:2-12. [doi:10.1016/j.virol.2013.11.037](https://doi.org/10.1016/j.virol.2013.11.037)"
  - "GenBank [DQ387450](https://www.ncbi.nlm.nih.gov/nuccore/DQ387450) (REV strain APC-566, 8,286 nt) and [U09568](https://www.ncbi.nlm.nih.gov/nuccore/U09568) (the Israeli prototype strain of LPDV)."
---

These are the PCR protocols my lab used to detect reticuloendotheliosis virus (REV) and lymphoproliferative disease virus (LPDV) in avian DNA, part of the [REV and LPDV research](/research/retroviruses/avian) on avian retroviruses. There are three REV primer sets, one in the 3′ LTR (long terminal repeat) and two in the *pol* gene, and one LPDV primer set in the p31/CA region. For a control that confirms a sample holds amplifiable bird DNA, see the [pan-avian GAPDH PCR](/research/protocols/pan-avian-gapdh).

The REV and GAPDH protocols are the ones published in [Stewart et al. 2019, J Wildl Dis 55(3)](/research/publications/10-7589-2018-08-187/), with the cycling in that paper's supplement. [Cox et al. 2022, J Wildl Dis 58(4)](/research/publications/10-7589-jwd-d-22-00023/) used the same REV 3′ LTR and GAPDH cycling and added the LPDV set; its cycling is in that paper's supplement.

## Where the REV amplicons sit on the genome

The original pages each showed a map of the REV provirus: LTRs at both ends, the primer binding site near the 5′ LTR, then *gag* (MA, R, CA, NC), *pol* (protease, reverse transcriptase, integrase) and *env* (SU, TM), on a scale of about 8 kb. The three amplicons sit as follows:

| Primer set | Region | Product on DQ387450 (computed) | Position on DQ387450 | Product (from the gel) |
| --- | --- | --- | --- | --- |
| PCR REV 3′ LTR 8000-8297 | LTR | 282 bp | 8000-8280, and 258-538 in the 5′ LTR | 297 bp |
| PCR REV pol 2500-3075 | *pol*: protease and reverse transcriptase | 574 bp | 2492-3065 | 575 bp |
| PCR REV pol 4777-5575 | *pol*: reverse transcriptase and integrase | 801 bp | 4766-5566 | 798 bp |

The computed sizes come from the published primer sequences placed on GenBank [DQ387450](https://www.ncbi.nlm.nih.gov/nuccore/DQ387450) (REV strain APC-566, 8,286 nt), the reference Stewart et al. 2019 compared their sequences against. The code that places them is tested, and it measures each product from one primer's 5′ end to the other's. Against DQ387450:

- **3′ LTR set:** the forward primer has one base (a G) that the reference lacks, and the reverse primer one mismatch, so the product is one base longer than the 281 bases it spans. An LTR sits at each end of the provirus, so the same product can come from either one.
- **pol 2500-3075:** both primers match exactly.
- **pol 4777-5575:** the reverse primer has one mismatch.

The set names are the lab's rounded labels, not exact genome coordinates; "8297" in the LTR set's name is a label only, since the genome is 8,286 nt long. The gel sizes are read from the gel images on the original pages, beside a 100 bp ladder; each gel showed a band in the REV-positive lane and none in the negative lane. A gel reading is an estimate, and field strains can differ from DQ387450, so the two columns need not agree exactly.

## Materials

- [NEB One*Taq*® Hot Start 2X Master Mix](https://www.neb.com/products/m0484-onetaq-hot-start-2x-master-mix-with-standard-buffer)
- [NEB 100 bp ladder](https://www.neb.com/products/n3231-100-bp-dna-ladder)
- 2% agarose gel in TBE

Extension temperature is dependent on polymerase. The 68 °C extensions below are for the One*Taq* mix.

## Reaction mix

From Stewart et al. 2019, for each 25 µL reaction:

| Component | Volume |
| --- | --- |
| Nuclease-free water | 5.5 µL |
| One*Taq* Hot Start 2X Master Mix (New England Biolabs) | 12.5 µL |
| Forward primer (10 µM stock) | 1 µL |
| Reverse primer (10 µM stock) | 1 µL |
| Eluted DNA | 5 µL |

Cox et al. 2022 used the same master mix in 25 µL reactions with 2 µL of eluted DNA and primers at 200-400 nM final concentration.

1. Set up each 25 µL reaction as in the table: @nuclease-free water|Nuclease-free water{5.5%µL}, @OneTaq Hot Start 2X Master Mix|One*Taq* Hot Start 2X Master Mix{12.5%µL} (New England Biolabs), @forward primer|Forward primer (10 µM stock){1%µL}, @reverse primer|Reverse primer (10 µM stock){1%µL} and @eluted DNA|Eluted DNA{5%µL}.
2. Run the cycling program for the primer set, as in its table below.
3. Run the product on the #2% agarose gel in TBE{} beside the #NEB 100 bp ladder{}.
   > EXPECT: A band at the set's product size: see [where the REV amplicons sit on the genome](#where-the-rev-amplicons-sit-on-the-genome) and, for LPDV, [PCR LPDV p31/CA](#pcr-lpdv-p31ca). On the original pages each gel showed a band in the REV-positive lane and none in the negative lane.

## PCR REV 3′ LTR 8000-8297

Amplifies a region of the REV 3′ LTR. Product: 282 bp computed on DQ387450; 297 bp read from the gel.

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `CATACTGGAGCCAATGGTT` |
| Reverse | `AATGTTGTACCGAAGTACT` |

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 5 min. |
| 35 cycles | 95 | 30 sec. |
|  | 47 | 45 sec. |
|  | 68 | 60 sec. + 1 sec. per cycle |
| extension | 68 | 10 min. |
| hold | 10 | ∞ |

The extension in each cycle is 68 °C, 60 s + 1 s per cycle: it starts at 60 s and grows by 1 s each cycle. This is the program in the supplements to Stewart et al. 2019 and Cox et al. 2022.

## PCR REV pol 2500-3075 (protease and reverse transcriptase)

Amplifies REV *pol* segment 2500-3075 (protease and reverse transcriptase). Product: 574 bp computed on DQ387450; 575 bp read from the gel.

The old site titled this set "PCR REV pol 2500-3750". The "3750" was an error: Stewart et al. 2019 give the segment as 2500-3075 in the main text and in the supplement, and the protocol text, genome map and gel on the old page agreed.

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `CAAATAATAGATTTTCTAGTAGATACGGGA` |
| Reverse | `AGTGGACGGGTCTCAGGA` |

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 10 min. |
| 15 cycles | 95 | 30 sec. |
|  | 60 to 50 (touchdown) | 45 sec. |
|  | 68 | 120 sec. |
| 20 cycles | 95 | 30 sec. |
|  | 50 | 60 sec. |
|  | 68 | 120 sec. |
| extension | 68 | 9 min. |
| hold | 10 | ∞ |

The first 15 cycles are a touchdown: the annealing temperature steps down from 60 to 50 °C over those cycles. Stewart et al. 2019 describe the program as a "touchdown PCR cycle (Barbosa et al. 2007)" and print the annealing as 60-50 °C in the supplement. The published protocol gives no step size. The next 20 cycles anneal at 50 °C.

## PCR REV pol 4777-5575 (reverse transcriptase and integrase)

Amplifies REV *pol* segment 4777-5575 (reverse transcriptase and integrase). Product: 801 bp computed on DQ387450; 798 bp read from the gel.

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `CGAGAAGTAGCTATACGTCCTTTG` |
| Reverse | `ACATCGTGCCCGGAGC` |

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 10 min. |
| 15 cycles | 95 | 30 sec. |
|  | 60 to 50 (touchdown) | 45 sec. |
|  | 68 | 120 sec. |
| 20 cycles | 95 | 30 sec. |
|  | 50 | 60 sec. |
|  | 68 | 120 sec. |
| extension | 68 | 9 min. |
| hold | 10 | ∞ |

The cycling is the same as for pol 2500-3075, as in the Stewart et al. 2019 supplement, including the touchdown from 60 to 50 °C over the first 15 cycles with no published step size.

## PCR LPDV p31/CA

Amplifies part of the LPDV gag polyprotein (partial p31/capsid). The primers are from [Allison et al. 2014, Virology 450-451:2-12](https://doi.org/10.1016/j.virol.2013.11.037), designed on the Israeli prototype strain of LPDV (GenBank [U09568](https://www.ncbi.nlm.nih.gov/nuccore/U09568)). The cycling is from Cox et al. 2022 and its supplement. Use the reaction mix above.

| Primer | Sequence (5′ to 3′) | Length |
| --- | --- | --- |
| Forward | `ATGAGGACTTGTTAGATTGGTTAC` | 24 nt |
| Reverse | `TGATGGCGTCAGGGCTATTTG` | 21 nt |

Product: 458 bp on U09568, positions 1041-1498, computed by placing both primers on the sequence (each matches exactly). The 413 nt between the primers is the partial p31/partial CA fragment Allison et al. 2014 analyzed.

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 3 min. |
| 34 cycles | 95 | 30 sec. |
|  | 54 | 30 sec. |
|  | 68 | 60 sec. |
| extension | 68 | 10 min. |
| hold | 10 | ∞ |

## Related pages

- [REV and LPDV research](/research/retroviruses/avian)
- [Pan-avian GAPDH PCR](/research/protocols/pan-avian-gapdh)
- [COI primers](/research/protocols/coi-primers)
- [Publications](/research/publications)
