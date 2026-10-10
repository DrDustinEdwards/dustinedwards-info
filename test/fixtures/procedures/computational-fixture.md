---
profile: computational
method: [annotation]
path: /software/how-tos/computational-fixture
title: "Test Fixture: Count Reads in a FASTA File"
seo_title: "Test Fixture: Count Reads in a FASTA File"
description: "A generic test procedure used by the procedure tests and screenshots. It counts reads in a FASTA file and is never published."
draft: true
version: "fixture-1"
updated: 2026-09-30
environment: "Any POSIX shell (bash 5) with coreutils, grep and seqkit on the PATH."
prerequisites:
  - "seqkit installed, for example from Bioconda."
  - "A FASTA file named reads.fasta in the working directory."
materials:
  - name: seqkit
    kind: software
    version: "2.8.2"
  - name: grep
    kind: software
    version: "GNU grep 3.11"
  - name: reads
    display: reads.fasta
    kind: data
    note: "A three-read test file, written in step 1."
  - name: counts
    display: counts.tsv
    kind: file
based_on:
  - citation: "seqkit documentation, seqkit stats"
    url: https://bioinf.shenwei.me/seqkit/usage/
    for: the stats command and its columns
troubleshooting:
  - id: zero-reads
    step: "2"
    problem: "The count is 0."
    reason: "The file has Windows line endings or no header lines."
    solution: "Check the first line starts with >, and convert line endings with dos2unix."
expected_results: "Both counts agree: 3 reads, 18 bases in all."
limitations: "A test fixture only. grep counts header lines, so it cannot tell a truncated record from a whole one."
references:
  - "Shen W, Le S, Li Y, Hu F (2016). SeqKit: a cross-platform and ultrafast toolkit for FASTA/Q file manipulation. *PLOS ONE* 11(10), e0163962. [doi:10.1371/journal.pone.0163962](https://doi.org/10.1371/journal.pone.0163962)"
---

This is a test fixture for the procedure format, not a method the site publishes. It counts the reads in
a small FASTA file two ways and checks that the counts agree.

## Count the reads

1. Write the test @reads file.
   ```bash
   printf '>r1\nACGTAC\n>r2\nGGGCCC\n>r3\nTTTAAA\n' > reads.fasta
   ```
   ```output
   ```
2. Count the header lines with @grep.
   ```bash
   grep -c '^>' reads.fasta
   ```
   ```output
   3
   ```
   > WHY: **Why count headers?** Every FASTA record starts with one line beginning with >.
   > TROUBLESHOOTING: zero-reads
3. Summarize the file with @seqkit and write @counts.
   ```bash
   seqkit stats -T reads.fasta > counts.tsv
   cut -f4,5 counts.tsv
   ```
   ```output
   num_seqs	sum_len
   3	18
   ```
   > CRITICAL: Pass -T, so the table is tab-separated and cut reads the right columns.
   > EXPECT: num_seqs matches the count from step 2.
