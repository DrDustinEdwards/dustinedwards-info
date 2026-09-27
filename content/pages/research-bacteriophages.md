---
path: /research/bacteriophages
title: "Bacteriophage research"
seo_title: "Bacteriophage research: phage genomics and discovery"
description: "Bacteriophage research at Tarleton State: discovery of Microbacterium and Mycobacterium phages, phage genomics, genome announcements and phage structure."
---

My lab's bacteriophage research centers on phages isolated from soil by undergraduates in the SEA-PHAGES program at Tarleton State University. Students find new phages, purify them, sequence their genomes and annotate them, and the finished genomes are published as genome announcements with the students as authors. This page covers that work in three parts: discovery, phage genomics and phage structure. It is for students, for instructors running similar courses and for anyone looking for the papers.

## Overview

Bacteriophages are viruses that infect bacteria. They are the most numerous biological entities known, and most of them have never been sampled. Because nearly every phage a student isolates from soil is new, phage discovery is research with a real chance of finding something unknown, which is why it works as a course.

The lab has isolated phages on two hosts, both harmless soil actinobacteria:

- *Mycobacterium smegmatis* (strain mc2 155), a fast-growing relative of the bacterium that causes tuberculosis. The lab used this host in 2017.
- *Microbacterium foliorum* (NRRL B-24224), used from 2018 on. Its phages are called microbacteriophages.

The questions are the ones every new phage raises: how its genome is organized, which known phages it is related to (its cluster), what its genes do, and what the particle looks like. The lab has isolated 80 phages from 2017 through 2025: 19 on *Mycobacterium smegmatis* mc2 155 (all in 2017) and 59 on *Microbacterium foliorum*, with 2 that have no host on record. Every phage is listed in the [phage table](/research/phages).

Phage research also has a clinical side. A survey of 196 US healthcare providers found that 49 percent knew about phage therapy for resistant bacterial infections and 56 percent would consider using it ([phage therapy survey](/research/publications/10-3390-ijerph22071139/)).

## Discovery

Each phage starts as a soil or environmental sample. Students extract the sample, plate it with the host bacterium, pick plaques, purify the phage through several rounds, make a high-titer lysate, image the particles and extract the DNA. The course that runs this work, and the education research around it, are on the [science education](/research/science-education) page. The full workflow, with what the lab has learned beyond the official SEA-PHAGES guide, is in the [phage discovery guide](/teaching/phage-discovery).

## Phage genomics

### Sequencing and annotation

Selected phages are screened by restriction digest, and those with new banding patterns have their genomes sequenced. Students then annotate the genome: they call each gene's start and end, assign a function where the evidence supports one, and check for tRNA genes. Every phage is reported to [PhagesDB](https://phagesdb.org/), the SEA-PHAGES database.

In this lab, annotation follows the SEA-PHAGES tools:

1. A Starterator report for each gene's start site.
2. Gene-by-gene evidence in PECAAN: GeneMarkS coding potential, HHpred, PhagesDB BLAST, NCBI BLAST, transmembrane prediction and Phamerator comparisons against phages in the same cluster.
3. For each gene, a function (NKF, no known function, when the evidence disagrees), a start-site code, a coding-capacity call and a synteny note on how the gene is conserved among its neighbors in the cluster.
4. A tRNA search with tRNAScan-SE.
5. Export of the annotation from PECAAN into DNA Master, where the draft genome file is saved.
6. An instructor review pass, which re-checks the evidence and settles start sites.

Annotation tips from the lab's notebooks:

- **The tail assembly chaperone frameshift.** Many phages make the tail assembly chaperone pair through a programmed -1 translational frameshift, which auto-annotation misses. Compare with a related phage whose gene pair is in the same phams, confirm the frameshift and find the slip site with the Six Frame Translation tool. Not every cluster has one.
- **Genes the auto-annotation missed or got wrong.** A primase split across two reading frames, or a short gene the gene callers skipped, can be added by hand using relatives in the same pham and Six Frame Translation. An orpham called in the wrong direction may need to be deleted.
- **Surprising HHpred hits.** A gene annotated as a RecB-like exonuclease that also hits Cas4 in HHpred is worth a second look. Top HHpred hits can also change over weeks as databases update, so record them when you run them.

### Clusters

Phages are grouped into clusters by shared genome sequence, and a new phage's cluster is the first thing that places it among known phages. The lab's published phages include cluster A1 and cluster O mycobacteriophages and microbacteriophages related to clusters EB and EE.

### Genome announcements

Each finished genome is published in *Microbiology Resource Announcements*, with the students who annotated it as authors. The [Writing Microbiology Resource Announcements](/research/publications/10-25334-b5bs-f125/) teaching resource covers how to write one, and [Understanding Restriction Enzyme Digests](/research/publications/10-25334-8cxe-6883/) covers the digest screen that comes before sequencing.

| Phage | Host | Genome | Paper |
| --- | --- | --- | --- |
| Godfather | *Microbacterium foliorum* | 17,452 bp, 24 genes; over 99% identity with cluster EE phages | [2025](/research/publications/10-1128-mra-00888-24/) |
| MrAaronian | *Arthrobacter globiformis* | 54,509 bp, 87 genes; cluster AW | [2023](/research/publications/10-1128-mra-00778-23/) |
| Fizzles | *Microbacterium foliorum* | 62,078 bp, 104 genes; over 83.6% identity with Squash and Nike | [2022](/research/publications/10-1128-mra-01077-21/) |
| Loca | *Microbacterium foliorum* | 17,475 bp, 25 genes; over 96% identity with Quaker and Livingwater | [2022](/research/publications/10-1128-mra-00783-22/) |
| IndyLu | *Microbacterium foliorum* | 41,958 bp, 71 genes, 1 tRNA; related to cluster EB | [2021](/research/publications/10-1128-mra-01079-21/) |
| Joy99 | *Mycobacterium* | 59,837 bp, 97 genes, 1 tRNA | [2021](/research/publications/10-1128-mra-00556-21/) |
| Tripl3t and Zeuska | *Mycobacterium smegmatis* | 53,565 bp and 53,598 bp | [2021](/research/publications/10-1128-mra-00558-21/) |
| Finny | *Microbacterium foliorum* | 40,313 bp, circularly permuted, 63 genes | [2019](/research/publications/10-1128-mra-01039-19/) |
| Ryadel | *Mycobacterium smegmatis* | 72,658 bp, 132 genes; cluster O | [2019](/research/publications/10-1128-mra-01594-18/) |
| Arlo | *Mycobacterium smegmatis* | 52,960 bp, 96 genes; cluster A1 | [2018](/research/publications/10-1128-mra-01242-18/) |

Godfather, Fizzles, Loca and IndyLu came from samples collected in Erath County, Texas, Finny from Comal County, Texas, and Arlo from Erath County. Joy99, Tripl3t and Zeuska were isolated elsewhere and annotated by students at Bluff Dale High School and Tolar High School in community engagement with Tarleton State University. MrAaronian was isolated in Dutchess County, New York.

## Phage structure

Ryadel is a cluster O mycobacteriophage with an unusual prolate (elongated) capsid. Its genome announcement reports that the genome carries 31 copies of a 17-bp sequence with dyad symmetry, a feature conserved among cluster O phages ([Ryadel genome](/research/publications/10-1128-mra-01594-18/)).

Two manuscripts from this structure work are submitted and not yet published: one on the cryo-electron microscopy (cryo-EM) structure of Ryadel, and one on the phage [Rira](/research/phages#rira).

Student projects also compare the predicted structure of single gene products. In this lab, a LysM-like endolysin was modeled in Phyre2 alongside a reference LysM peptidoglycan-binding domain structure and a bacterial homolog found by BLASTp, with the shared domain identified in InterPro.

## Methods

The bench and analysis methods behind this work are on the protocol pages:

- [Phage discovery guide](/teaching/phage-discovery): the whole workflow from sample to annotated genome.
- [Phage isolation protocol](/research/protocols/phage-isolation): direct and enriched isolation, purification, titers and lysates.
- [Phage DNA extraction](/research/protocols/phage-dna-extraction): preparing genomic DNA for digests and sequencing.
- [All protocols](/research/protocols).

The full list of papers is on the [publications](/research/publications) page.
