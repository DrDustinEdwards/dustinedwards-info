---
path: /teaching/central-dogma
title: "Central Dogma Tutorials"
seo_title: "Central dogma tutorial: transcription and translation"
description: "A central dogma of molecular biology tutorial: DNA replication, transcription and translation, the genetic code, reading frames and a worked example."
---

In these Central Dogma Tutorials, you will learn the molecular biology processes that carry genetic information from DNA to mRNA to protein. The tutorial is written for undergraduates in introductory biology, genetics or the SEA-PHAGES courses. It covers DNA replication, transcription and translation, then works one short DNA sequence all the way to a protein, codon by codon, and ends with practice problems and answers. An interactive version will be added at this same address later.

## What is the central dogma?

The central dogma of molecular biology describes the usual flow of genetic information in a cell:

1. **Replication:** DNA is copied into DNA, so each daughter cell gets a full set of genes.
2. **Transcription:** a gene's DNA is copied into RNA. When the gene codes for a protein, that RNA is messenger RNA (mRNA).
3. **Translation:** a ribosome reads the mRNA three bases at a time and builds the protein those codons specify.

Information moves from nucleic acid to protein and not back: a protein's amino acid sequence is never copied into DNA or RNA. There are well-known extensions to the simple picture. Retroviruses, for example, use reverse transcriptase to copy their RNA genome into DNA, and many genes are transcribed into RNAs that are never translated (transfer RNA, ribosomal RNA and many regulatory RNAs).

## DNA and RNA: the parts you need

DNA and RNA are chains of nucleotides. Each nucleotide has a sugar, a phosphate and a base. Four things matter most for this tutorial.

- **Bases.** DNA uses adenine (A), guanine (G), cytosine (C) and thymine (T). RNA uses A, G, C and uracil (U) in place of T. DNA's sugar is deoxyribose; RNA's is ribose.
- **Base pairing.** A pairs with T in DNA (or with U in RNA), and G pairs with C. Two strands that pair this way are complementary.
- **Direction.** Each strand has a 5' end and a 3' end, named for the carbons of the sugar. The two strands of a DNA double helix run in opposite directions (they are antiparallel), so one runs 5' to 3' and its partner runs 3' to 5'.
- **Synthesis runs 5' to 3'.** Every polymerase in this tutorial adds new nucleotides only to the 3' end of a growing chain. New DNA and new RNA are always made 5' to 3', and the template strand is read 3' to 5'.

By convention, a single sequence is written 5' to 3', left to right, unless it is labeled otherwise.

## DNA replication

DNA replication is semiconservative: the two strands of the parent molecule separate, each serves as a template, and each daughter molecule has one old strand and one new strand.

The main steps and enzymes:

1. **Initiation.** Replication begins at an origin of replication. Bacterial chromosomes usually have a single origin; eukaryotic chromosomes have many.
2. **Unwinding.** Helicase separates the two strands and opens a replication fork. Single-strand binding proteins keep the separated strands apart, and topoisomerase relieves the twisting that builds up ahead of the fork.
3. **Priming.** DNA polymerase cannot start a strand from nothing. Primase lays down a short RNA primer, and DNA polymerase extends from the primer's 3' end.
4. **Elongation.** DNA polymerase reads the template 3' to 5' and adds complementary nucleotides to the new strand 5' to 3'. It also proofreads, removing most wrongly paired bases as it goes.
5. **Leading and lagging strands.** Because the strands are antiparallel and synthesis only runs 5' to 3', one new strand (the leading strand) is made continuously toward the fork. The other (the lagging strand) is made in short pieces, called Okazaki fragments, in the direction away from the fork.
6. **Finishing.** The RNA primers are removed and replaced with DNA, and DNA ligase seals the gaps between fragments.

## Transcription: DNA to RNA

Transcription copies the information in a gene into RNA. It is carried out by RNA polymerase, which, unlike DNA polymerase, does not need a primer.

### Template and coding strands

Only one strand of a gene is copied.

- The **template strand** (also called the antisense or noncoding strand) is the strand RNA polymerase reads. The RNA is complementary to it.
- The **coding strand** (also called the sense or nontemplate strand) is the other strand. The RNA has the same sequence as the coding strand, written 5' to 3', with U in place of T.

This is why gene sequences in databases are given as the coding strand: you can read the mRNA, and so the codons, directly from it. Either strand of a chromosome can be the template, and different genes use different strands.

### Promoters and the three stages

1. **Initiation.** RNA polymerase binds a promoter, a DNA sequence just upstream of the gene that marks where transcription starts and which strand is the template. In bacteria, a sigma factor that is part of the polymerase recognizes promoter elements about 10 and 35 base pairs upstream of the start site (the -10 and -35 elements). In eukaryotes, RNA polymerase II transcribes protein-coding genes and needs general transcription factors to bind the promoter; many eukaryotic promoters contain a TATA box.
2. **Elongation.** The polymerase unwinds a short stretch of DNA, reads the template strand 3' to 5' and builds RNA 5' to 3', pairing A with U, T with A, G with C and C with G.
3. **Termination.** At the end of the gene, a terminator sequence causes the polymerase to release the RNA and the DNA.

### mRNA processing in eukaryotes

In eukaryotes, the first transcript (pre-mRNA) is processed in the nucleus before it goes to the cytoplasm to be translated:

- **5' cap.** A modified guanine nucleotide (a 7-methylguanosine cap) is added to the 5' end. It protects the mRNA and helps the ribosome find it.
- **Poly-A tail.** A string of adenine nucleotides is added to the 3' end. It also protects the mRNA and helps export it and translate it.
- **Splicing.** Introns (intervening sequences) are cut out by the spliceosome, and exons are joined. Alternative splicing, joining different combinations of exons, lets one gene make more than one protein.

**Bacteria differ.** Bacteria have no nucleus, so transcription and translation happen in the same compartment, and ribosomes can begin translating an mRNA while it is still being transcribed. Bacterial mRNAs do not get a 5' cap or a eukaryote-style poly-A tail, and bacterial protein-coding genes rarely contain introns. Several bacterial genes are often transcribed together into one mRNA (an operon), and each gene on it is translated separately. Bacteriophages, which infect bacteria, use their host's transcription and translation machinery, so phage genes follow the bacterial rules.

## The genetic code

The genetic code is the set of rules that turns an mRNA sequence into an amino acid sequence.

- **Codons.** mRNA is read in groups of three bases called codons. With four bases, there are 4 x 4 x 4 = 64 codons.
- **Redundancy.** 61 codons specify the 20 standard amino acids and 3 are stop codons, so most amino acids have more than one codon. Leucine, serine and arginine each have six; methionine and tryptophan have one each.
- **Start codon.** AUG codes for methionine and is the usual start codon. In bacteria, GUG and UUG are also used as start codons, less often; a start codon at the beginning of a gene is read as methionine (formylmethionine in bacteria).
- **Stop codons.** UAA, UAG and UGA do not code for an amino acid. They end translation.
- **Near universal.** The same code is used by almost all organisms, with a small number of known variations (for example, in mitochondria).

### The standard genetic code

Find the first base in the left column, the second base across the top and the third base in the right column.

| First base | Second: U | Second: C | Second: A | Second: G | Third base |
|---|---|---|---|---|---|
| U | UUU Phe | UCU Ser | UAU Tyr | UGU Cys | U |
| U | UUC Phe | UCC Ser | UAC Tyr | UGC Cys | C |
| U | UUA Leu | UCA Ser | UAA Stop | UGA Stop | A |
| U | UUG Leu | UCG Ser | UAG Stop | UGG Trp | G |
| C | CUU Leu | CCU Pro | CAU His | CGU Arg | U |
| C | CUC Leu | CCC Pro | CAC His | CGC Arg | C |
| C | CUA Leu | CCA Pro | CAA Gln | CGA Arg | A |
| C | CUG Leu | CCG Pro | CAG Gln | CGG Arg | G |
| A | AUU Ile | ACU Thr | AAU Asn | AGU Ser | U |
| A | AUC Ile | ACC Thr | AAC Asn | AGC Ser | C |
| A | AUA Ile | ACA Thr | AAA Lys | AGA Arg | A |
| A | AUG Met (start) | ACG Thr | AAG Lys | AGG Arg | G |
| G | GUU Val | GCU Ala | GAU Asp | GGU Gly | U |
| G | GUC Val | GCC Ala | GAC Asp | GGC Gly | C |
| G | GUA Val | GCA Ala | GAA Glu | GGA Gly | A |
| G | GUG Val | GCG Ala | GAG Glu | GGG Gly | G |

### Reading frames

Because codons have no punctuation between them, the same sequence can be read in three different ways depending on which base you start from. Each way is a reading frame. For example, the sequence AUGGCAAAG read from the first base gives AUG GCA AAG (Met, Ala, Lys); from the second base, UGG CAA (Trp, Gln); from the third, GGC AAA (Gly, Lys).

A double-stranded DNA molecule has six possible reading frames: three on each strand. The correct frame for a gene is set by its start codon. An **open reading frame (ORF)** is a stretch that begins with a start codon and runs, codon by codon, to a stop codon in the same frame without being interrupted by another stop.

## Translation: RNA to protein

### tRNA

Transfer RNA (tRNA) molecules are the adapters between codons and amino acids. Each tRNA carries a specific amino acid on its 3' end and has a three-base **anticodon** that pairs with a codon on the mRNA, antiparallel and complementary. The codon 5'-UGG-3' (Trp), for example, pairs with the anticodon 3'-ACC-5', which is written 5'-CCA-3'. Enzymes called aminoacyl-tRNA synthetases attach the right amino acid to each tRNA; this step is what actually applies the genetic code. Many tRNAs can read more than one codon because pairing at the third codon position is looser than at the first two (wobble pairing).

### Ribosomes

The ribosome is made of ribosomal RNA (rRNA) and proteins, in a small subunit and a large subunit. Bacterial ribosomes are 70S (30S and 50S subunits); eukaryotic cytoplasmic ribosomes are 80S (40S and 60S). The ribosome has three tRNA sites: the A site (where a new aminoacyl-tRNA arrives), the P site (which holds the tRNA carrying the growing chain) and the E site (from which empty tRNAs exit).

### The three stages

1. **Initiation.** The small subunit binds the mRNA and finds the start codon. In bacteria, it pairs with a ribosome binding site (the Shine-Dalgarno sequence) a few bases upstream of the start codon. In eukaryotes, it usually binds at the 5' cap and scans along the mRNA to the first suitable AUG. The initiator tRNA carrying methionine pairs with the start codon, and the large subunit joins.
2. **Elongation.** A tRNA whose anticodon matches the codon in the A site enters. The ribosome forms a peptide bond between the growing chain and the new amino acid, then moves one codon (three bases) along the mRNA, 5' to 3'. The protein grows from its amino (N) terminus to its carboxyl (C) terminus.
3. **Termination.** When a stop codon reaches the A site, no tRNA pairs with it. A release factor binds instead, the finished polypeptide is released and the ribosome comes apart.

## Worked example: from DNA to protein, step by step

Here is a short stretch of a gene, with both strands shown. The top strand is the coding strand.

```
coding strand     5'-CCGAATGGCAAAGTGGGATTTCCGTTAAGC-3'
template strand   3'-GGCTTACCGTTTCACCCTAAAGGCAATTCG-5'
```

### Step 1: transcribe

RNA polymerase reads the template strand 3' to 5' and builds the mRNA 5' to 3', pairing each template base with its complement (A with U, T with A, G with C, C with G). The result has the same sequence as the coding strand, with U in place of T:

```
mRNA              5'-CCGAAUGGCAAAGUGGGAUUUCCGUUAAGC-3'
```

If you start from the template strand, a quick check is that every base in the mRNA pairs with the template base directly below it in the diagram above.

### Step 2: find the start codon

Read the mRNA 5' to 3' and look for the first AUG. The first four bases (CCGA) come before it; they are part of the untranslated region at the 5' end of the mRNA. AUG begins at base 5, and it sets the reading frame.

### Step 3: read codons until a stop

From the AUG, split the mRNA into codons and look up each one in the code table:

| Codon | mRNA codon | Amino acid |
|---|---|---|
| 1 | AUG | Met (M), start |
| 2 | GCA | Ala (A) |
| 3 | AAG | Lys (K) |
| 4 | UGG | Trp (W) |
| 5 | GAU | Asp (D) |
| 6 | UUC | Phe (F) |
| 7 | CGU | Arg (R) |
| 8 | UAA | Stop |

The two bases after the stop codon (GC) are in the 3' untranslated region and are not translated.

### Step 4: write the protein

The protein, from its N terminus to its C terminus, is:

Met-Ala-Lys-Trp-Asp-Phe-Arg (in one-letter code, MAKWDFR)

The ORF is 24 bases long including the stop codon, and it encodes 7 amino acids: 21 coding bases divided by 3.

### Step 5: check the other frames

Reading the same mRNA from the first base (CCG AAU GGC ...) or the third base (GAA UGG CAA ...) gives different amino acids and never reaches a stop codon within this sequence, and neither frame contains an AUG. The AUG sets the frame, and the frame decides the protein. This is exactly the problem gene annotators solve on a much larger scale.

## From tutorial to lab: finding genes in phage genomes

In the SEA-PHAGES program, students isolate a bacteriophage, sequence its genome and then annotate it: they decide where each gene starts and stops. That work is the central dogma applied in reverse. An annotator looks at a genome sequence and asks which open reading frames a ribosome would actually translate. In practice, that means:

- scanning all six reading frames, since phage genes lie on both strands;
- finding stop codons, which fix where each gene ends, and choosing among the possible start codons (ATG, GTG or TTG in the coding-strand DNA) upstream of it;
- using evidence such as a ribosome binding site just upstream of the start, gene-prediction programs and similarity to genes already known in other phages to pick the most likely start.

Phage genomes are packed tightly, so genes often sit end to end or overlap by a few bases, and choosing the right start codon is the hardest and most discussed part of each gene call. The second-semester course, [Phage Bioinformatics](/teaching/phage-bioinformatics), teaches this process on the genomes students isolated in [Virus Isolation](/teaching/virus-isolation). The phages found so far are listed under [phages](/research/phages).

## Practice problems

### Problem 1: transcribe and translate

The template strand of a short gene is:

```
template strand   3'-TACAAACCTGGTGTCACT-5'
```

Write the mRNA and the protein it encodes.

### Problem 2: what does each mutation do?

Using the worked example above (coding strand 5'-CCGAATGGCAAAGTGGGATTTCCGTTAAGC-3'), give the effect on the protein of each change to the coding strand:

1. The TGG codon (codon 4) changes to TGA.
2. The GCA codon (codon 2) changes to GCG.
3. The AAG codon (codon 3) changes to GAG.
4. The first A of the AAG codon (codon 3) is deleted.

### Problem 3: find the open reading frame

Find the open reading frame on this coding-strand sequence, and give the protein it encodes:

```
5'-TTACGCATGCCTGAAAGGTGAC-3'
```

### Problem 4: anticodons

What anticodon, written 5' to 3', pairs with the codon 5'-GCA-3'? Which amino acid does that tRNA carry?

### Problem 5: reading frames

How many reading frames does a double-stranded DNA molecule have, and why do annotators of phage genomes need to check all of them?

## Answers

**Problem 1.** The mRNA is complementary to the template and runs 5' to 3': 5'-AUGUUUGGACCACAGUGA-3'. Split into codons from the AUG: AUG UUU GGA CCA CAG UGA. The protein is Met-Phe-Gly-Pro-Gln (MFGPQ), and UGA is the stop codon.

**Problem 2.**

1. UGG (Trp) becomes UGA, a stop codon. This is a **nonsense** mutation: the protein is cut short to Met-Ala-Lys.
2. GCA and GCG both code for Ala. This is a **silent** (synonymous) mutation: the protein is unchanged.
3. AAG (Lys) becomes GAG (Glu). This is a **missense** mutation: the protein becomes Met-Ala-Glu-Trp-Asp-Phe-Arg.
4. Deleting one base is a **frameshift**. The mRNA now reads AUG GCA AGU GGG AUU UCC GUU AAG C, which gives Met-Ala-Ser-Gly-Ile-Ser-Val-Lys. Every codon after the deletion is misread, and the original UAA stop is no longer in frame, so no stop codon appears within this sequence.

**Problem 3.** The mRNA is 5'-UUACGCAUGCCUGAAAGGUGAC-3'. The first AUG starts at base 7. From there: AUG CCU GAA AGG UGA, which is Met-Pro-Glu-Arg followed by the stop codon UGA. The protein is Met-Pro-Glu-Arg (MPER). (The complementary strand also contains an AUG, but it reaches the end of this short sequence without a stop codon, so it is not a complete ORF here.)

**Problem 4.** The anticodon pairs antiparallel with the codon: codon 5'-GCA-3' pairs with anticodon 3'-CGU-5', written 5'-UGC-3'. GCA codes for alanine, so the tRNA carries alanine.

**Problem 5.** Six: three on each strand, because a sequence can be read starting at its first, second or third base, and genes can lie on either strand. Phage genes are found on both strands, so annotators check all six frames when they look for start codons, stop codons and open reading frames.
