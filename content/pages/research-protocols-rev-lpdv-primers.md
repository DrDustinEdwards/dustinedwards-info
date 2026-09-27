---
path: /research/protocols/rev-lpdv-primers
title: "REV PCR primers"
seo_title: "REV PCR primers: reticuloendotheliosis virus LTR and pol"
description: "Reticuloendotheliosis virus (REV) PCR primers for the 3′ LTR (8000-8297) and pol (2500-3075, 4777-5575): sequences, cycling tables, product sizes."
---

These are the PCR protocols my lab used to detect reticuloendotheliosis virus (REV) in avian DNA, part of the [REV and LPDV research](/research/retroviruses) on avian retroviruses. There are three primer sets, each named for the REV nucleotide positions it amplifies: one in the 3′ LTR (long terminal repeat) and two in the *pol* gene. All three sets target REV. For a control that confirms a sample holds amplifiable bird DNA, see the [pan-avian GAPDH PCR](/research/protocols/pan-avian-gapdh).

## Where the amplicons sit on the REV genome

The original pages each showed a map of the REV provirus: LTRs at both ends, the primer binding site near the 5′ LTR, then *gag* (MA, R, CA, NC), *pol* (protease, reverse transcriptase, integrase) and *env* (SU, TM), on a scale of about 8 kb. The three amplicons sit as follows:

| Primer set | Region | Positions | Product size |
| --- | --- | --- | --- |
| PCR REV 3′ LTR 8000-8297 | 3′ LTR | 8000-8297 | 297 bp |
| PCR REV pol 2500-3075 | *pol*: protease and reverse transcriptase | 2500-3075 | 575 bp |
| PCR REV pol 4777-5575 | *pol*: reverse transcriptase and integrase | 4777-5575 | 798 bp |

Product sizes are the sizes marked on the gel images on the original pages. Each gel showed a band in the REV-positive lane and none in the negative lane, beside a 100 bp ladder.

## Materials (all three sets)

- [NEB One*Taq*® Hot Start 2X Master Mix](https://www.neb.com/products/m0484-onetaq-hot-start-2x-master-mix-with-standard-buffer)
- [NEB 100 bp ladder](https://www.neb.com/products/n3231-100-bp-dna-ladder)
- 2% agarose gel in TBE

Extension temperature is dependent on polymerase.

## PCR REV 3′ LTR 8000-8297

For PCR amplification of REV nucleotides 8000 to 8297 at the 3′ LTR. Product: 297 bp.

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `CATACTGGAGCCAATGGTT` |
| Reverse | `AATGTTGTACCGAAGTACT` |

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 5 min. |
| 35 cycles | 95 | 30 sec. |
|  | 47 | 45 sec. |
|  | 68 | 60 sec. + 1_sec./cycle |
| extension | 68 | 10 min. |
| hold | 10 | ∞ |

## PCR REV pol 2500-3075 (protease and reverse transcriptase)

This set was listed on the old site as "PCR REV pol 2500-3750". The protocol text, the genome map and the gel on that page all give positions 2500 to 3075, and the gel marks a 575 bp product, so this page uses 2500-3075.

For PCR amplification of REV nucleotides 2500 to 3075 at the *pol* gene (protease and reverse transcriptase). Product: 575 bp.

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `CAAATAATAGATTTTCTAGTAGATACGGGA` |
| Reverse | `AGTGGACGGGTCTCAGGA` |

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 10 min. |
| 15 cycles | 95 | 30 sec. |
|  | 60◺50 | 45 sec. |
|  | 68 | 120 sec. |
| 20 cycles | 95 | 30 sec. |
|  | 50 | 60 sec. |
|  | 68 | 120 sec. |
| extension | 68 | 9 min. |
| hold | 10 | ∞ |

The annealing value 60◺50 for the first 15 cycles is kept as the original protocol wrote it. The second block of 20 cycles anneals at 50 °C.

## PCR REV pol 4777-5575 (reverse transcriptase and integrase)

For PCR amplification of REV nucleotides 4777 to 5575 at the *pol* gene (reverse transcriptase and integrase). Product: 798 bp.

| Primer | Sequence (5′ to 3′) |
| --- | --- |
| Forward | `CGAGAAGTAGCTATACGTCCTTTG` |
| Reverse | `ACATCGTGCCCGGAGC` |

| Step | Temperature (°C) | Time |
| --- | --- | --- |
| initial denaturation | 95 | 10 min. |
| 15 cycles | 95 | 30 sec. |
|  | 60◺50 | 45 sec. |
|  | 68 | 120 sec. |
| 20 cycles | 95 | 30 sec. |
|  | 50 | 60 sec. |
|  | 68 | 120 sec. |
| extension | 68 | 9 min. |
| hold | 10 | ∞ |

The cycling is the same as for pol 2500-3075, including the 60◺50 annealing value in the first 15 cycles.

## Related pages

- [REV and LPDV research](/research/retroviruses)
- [Pan-avian GAPDH PCR](/research/protocols/pan-avian-gapdh)
- [COI primers](/research/protocols/coi-primers)
- [Publications](/research/publications)
