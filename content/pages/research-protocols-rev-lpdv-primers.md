---
path: /research/protocols/rev-lpdv-primers
title: "REV and LPDV PCR primers"
seo_title: "REV and LPDV PCR primers: LTR, pol and p31/CA"
description: "PCR primers for reticuloendotheliosis virus (REV) LTR and pol and for LPDV p31/CA: sequences, reaction mix, cycling tables and product sizes."
---

These are the PCR protocols my lab used to detect reticuloendotheliosis virus (REV) and lymphoproliferative disease virus (LPDV) in avian DNA, part of the [REV and LPDV research](/research/retroviruses/avian) on avian retroviruses. There are three REV primer sets, one in the 3′ LTR (long terminal repeat) and two in the *pol* gene, and one LPDV primer set in the p31/CA region. For a control that confirms a sample holds amplifiable bird DNA, see the [pan-avian GAPDH PCR](/research/protocols/pan-avian-gapdh).

The REV and GAPDH protocols are the ones published in [Stewart et al. 2019, J Wildl Dis 55(3)](/research/publications/10-7589-2018-08-187/), with the cycling in that paper's supplement. [Cox et al. 2022, J Wildl Dis 58(4)](/research/publications/10-7589-jwd-d-22-00023/) used the same REV 3′ LTR and GAPDH cycling and added the LPDV set; its cycling is in that paper's supplement.

## Where the REV amplicons sit on the genome

The original pages each showed a map of the REV provirus: LTRs at both ends, the primer binding site near the 5′ LTR, then *gag* (MA, R, CA, NC), *pol* (protease, reverse transcriptase, integrase) and *env* (SU, TM), on a scale of about 8 kb. The three amplicons sit as follows:

| Primer set | Region | Product size (from the gel) |
| --- | --- | --- |
| PCR REV 3′ LTR 8000-8297 | 3′ LTR | 297 bp |
| PCR REV pol 2500-3075 | *pol*: protease and reverse transcriptase | 575 bp |
| PCR REV pol 4777-5575 | *pol*: reverse transcriptase and integrase | 798 bp |

The set names are the lab's rounded labels for the regions each set amplifies, not exact genome coordinates. The REV reference genome (GenBank [DQ387450](https://www.ncbi.nlm.nih.gov/nuccore/DQ387450)) is 8,286 nt long, so "8297" in the LTR set's name is a label only. Stewart et al. 2019 give the two *pol* segments as 2500-3075 and 4777-5575.

Product sizes are read from the gel images on the original pages, not calculated from a sequence. Each gel showed a band in the REV-positive lane and none in the negative lane, beside a 100 bp ladder.

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

## PCR REV 3′ LTR 8000-8297

Amplifies a region of the REV 3′ LTR. Product: 297 bp, read from the gel.

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

Amplifies REV *pol* segment 2500-3075 (protease and reverse transcriptase). Product: 575 bp, read from the gel.

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

Amplifies REV *pol* segment 4777-5575 (reverse transcriptase and integrase). Product: 798 bp, read from the gel.

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

Amplifies the p31/CA region of LPDV. The protocol is from Cox et al. 2022 and its supplement, which took the primers from Allison et al. 2014. Use the reaction mix above. This page gives no product size for this set, because no gel or source for one has been checked here.

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `ATGAGGACTTGTTAGATTGGTTAC` |
| Reverse | `TGATGGCGTCAGGGCTTTTG` |

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
