---
path: /teaching/phage-bioinformatics
title: "Phage Bioinformatics Course"
seo_title: "SEA-PHAGES phage genome annotation with PHEONA"
description: "How Tarleton's SEA-PHAGES bioinformatics course (BIOL 4090) annotates a phage genome in PHEONA, step by step, following the Phage Genomics Guide."
---

The Phage Bioinformatics course is the second semester of the two-semester [Phage Discovery Program](/teaching/phage-discovery), Tarleton State University's part of SEA-PHAGES. It is taught as Special Topics (BIOL 4090).

In the first semester, the [Virus Isolation Course](/teaching/virus-isolation), students isolate a bacteriophage and extract its DNA. Unique DNA of high quality and quantity is sent to the Pittsburgh Bacteriophage Institute for next-generation whole genome sequencing. In the Phage Bioinformatics course, students annotate the whole genome of the sequenced phages: they find every gene, choose where each one starts and assign each a function from the evidence, and the finished annotation goes to GenBank.

## The guide the course follows

The course follows the SEA-PHAGES [Phage Genomics Guide](https://genomicsguide.seaphages.org/), which replaced the older SEA-PHAGES Bioinformatics Guide. It was first published in January 2025, and its June 2026 update removed the references to DNA Master and brought the sections on PHEONA and Starterator up to date (Phage Genomics Guide, change history). The guide describes annotation as a one-semester project that ends with the genome in GenBank. The steps below are an outline of that guide in the order a student meets them; the guide itself has the full instructions, and chapter numbers are given so each step can be found there.

## Step 1: Get the genome and gather information

Before any gene is called, the guide has students learn what is already known about their phage and its relatives (chapter 3):

1. **Download the sequence** as a FASTA file from the phage's page on [PhagesDB](https://phagesdb.org/). The guide takes the sequence from PhagesDB only.
2. **Run blastn** with the whole genome at PhagesDB and at NCBI, to see which sequenced phages are the closest relatives.
3. **Look at genome maps** in [Phamerator](https://phamerator.org/), which draws the phage beside others in its cluster and groups similar genes into phams.
4. **Read the PhagesDB gene list** for a draft of the functions already assigned to genes in the phage and its relatives.
5. **Read the cluster annotation reports** hosted on QUBES, and the cluster-specific annotation tips, which record what is known and what is tricky about annotating that cluster.

## Step 2: Auto-annotation in PHEONA

The annotation itself is done in PHEONA, the Phage Evidence Organization, Notation and Analysis tool (Phage Genomics Guide, section 4.1). PHEONA is a web-based phage genome annotation tool offered by the Howard Hughes Medical Institute at [pheona.org](https://pheona.org/) (see its [terms of use](https://pheona.org/about/terms)). In one place it brings together Glimmer, GeneMarkS, GeneMark hmm, six-frame translation, BLASTp at PhagesDB and NCBI, HHPred, CDD, DeepTMHMM and Starterator, along with phage comparison tools and export tools that produce PHEONA export files (.pef) and GenBank submission files. Students do not sign up on their own: they get their PHEONA logins from their SEA-PHAGES faculty, and the faculty load the class's phage into PHEONA from PhagesDB (chapter 4).

Once the phage is loaded, PHEONA runs the auto-annotation: Glimmer and GeneMarkS predict the protein-coding genes and Aragorn predicts tRNAs. The guide says these programs will usually get more than 90% of the genes right (section 5.2), so the rest of the course is about checking every call and fixing the ones that are wrong.

## Step 3: Three questions for every gene

The guide's twelve guiding principles set the ground rules (chapter 5); one example is that protein-coding genes are generally at least 120 bp (40 codons) long. For every gene, the student then answers three questions and records the evidence for each answer in the gene's notes in PHEONA.

### Is it a gene?

The evidence (chapter 6): whether Glimmer and GeneMark both call it, whether GeneMark shows coding potential across the open reading frame, its length, the gap or overlap with its neighbors, and whether it has homologs in other phages found by BLAST or seen in Phamerator.

### Where does it start?

The evidence (chapter 7): the starts Glimmer and GeneMark chose, the gap or overlap each possible start would leave with the upstream gene, the Starterator report for the gene's pham (which compares the start chosen in every related gene), where the coding potential begins, BLASTp alignments that show whether a start makes the protein match its homologs from the first amino acid, the ribosome binding site, and conserved protein domains.

### What does it do?

The evidence (chapter 8): BLASTp at PhagesDB and NCBI, HHPred and the Conserved Domain Database (CDD), and structure tools such as AlphaFold, Foldseek, the Protein Data Bank and ChimeraX. Synteny matters too: many phage genes sit in the same order across a cluster, so a gene's neighbors in Phamerator help confirm a function. The name given must come from the SEA-PHAGES Official Function List, and the guide asks for functions to be recorded exactly as written there. Many genes will have no known function; the guide notes that only about 27% of phage genome genes will be assigned one.

Chapter 9 of the guide covers the mechanics of recording all of this in PHEONA.

## Step 4: tRNAs and special cases

Some features need extra steps (chapter 10):

- **tRNAs.** The guide combines the results of two programs, Aragorn and tRNAscan-SE. Where their coordinates disagree, it prefers Aragorn's.
- **Frameshifts.** Some genes are made by a programmed translational frameshift, such as the tail assembly chaperone pair in many phages, and the guide explains how to annotate them.
- **Membrane proteins.** DeepTMHMM predicts transmembrane domains, the evidence for calling a gene product a membrane protein.
- **Other cases.** Gaps between genes, genes that wrap around the end of the genome, and introns and inteins each have their own section.

## Step 5: Classroom review and quality control

Before anything is submitted, the class and its instructors review the annotation together as institutional quality control (chapter 11). The guide's review chapter also covers the Phage Comparison Tool, for comparing the annotation with related phages.

## Step 6: Submit the annotation

The finished annotation is submitted to PhagesDB at [phagesdb.org/annotation](https://phagesdb.org/annotation/) and is due by May 1 (section 12.1). The submission is:

- a cover sheet, as a PDF;
- the author list, as a .csv file;
- the PHEONA export file (.pef), made after the institution locks the annotation in PHEONA;
- the annotation notes, kept in PHEONA's Notes field.

## Step 7: Review to Improve and GenBank

After the May 1 deadline, the SEA-PHAGES program reviews each submitted annotation for quality control, and the guide says this review is completed by September 1. The annotation then goes through Review to Improve (R2I), done in PHEONA, before it goes to GenBank, and it is the program, not the class, that submits the genome to GenBank (chapter 13).

A class can then write the genome up as a short genome announcement. The site has a classroom guide to [writing Microbiology Resource Announcements](/research/publications/10-25334-b5bs-f125/), and the lab's own notes on annotation problems that come up in class genomes are on the [Phage Discovery Program](/teaching/phage-discovery) page.

## After the course

After completing the Virus Isolation and Bioinformatics courses, students can continue research characterizing their phage discoveries. The phages are listed in the [phage table](/research/phages), and the wider program is described under [science education](/research/science-education).
