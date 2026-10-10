---
profile: computational
type: tutorial
method: [annotation]
path: /software/how-tos/tutorial-fixture
title: "Test Fixture: Your First FASTA File"
seo_title: "Test Fixture: Your First FASTA File"
description: "A generic test tutorial used by the procedure tests and screenshots. It writes a FASTA file and counts its reads, and is never published."
draft: true
version: "fixture-1"
updated: 2026-10-10
time:
  total: 20 minutes
questions:
  - "What is in a FASTA file?"
  - "How do I count the reads in one?"
objectives:
  - "Write a small FASTA file from the command line."
  - "Count its reads by counting header lines."
key_points:
  - "Every FASTA record starts with a header line that begins with `>`."
  - "Counting header lines counts records."
explanation:
  - title: "The FASTA format"
    url: https://en.wikipedia.org/wiki/FASTA_format
environment: "A terminal: bash on Linux or macOS, or PowerShell 7 on Windows."
prerequisites:
  - "A terminal you can type commands into."
materials:
  - name: shell
    display: "bash or PowerShell"
    kind: software
    version: "bash 5 or PowerShell 7"
  - name: reads
    display: reads.fasta
    kind: data
    note: "A three-read test file, written in step 1."
based_on:
  - citation: "The Carpentries lesson template"
    url: https://carpentries.github.io/workbench/
    for: the questions, objectives, challenges and key points
expected_results: "The count is 3."
limitations: "A test fixture only."
references:
  - "Pearson WR, Lipman DJ (1988). Improved tools for biological sequence comparison. *PNAS* 85(8), 2444-2448. [doi:10.1073/pnas.85.8.2444](https://doi.org/10.1073/pnas.85.8.2444)"
---

This is a test fixture for the tutorial format, not a lesson the site publishes. It writes a small FASTA file
and counts the reads in it.

## Count the reads

1. Write the test @reads file in your @shell.
   ```bash platform=linux
   printf '>r1\nACGTAC\n>r2\nGGGCCC\n>r3\nTTTAAA\n' > reads.fasta
   ```
   ```output
   ```
   ```bash platform=macos
   printf '>r1\nACGTAC\n>r2\nGGGCCC\n>r3\nTTTAAA\n' > reads.fasta
   ```
   ```output
   ```
   ```powershell platform=windows
   ">r1`nACGTAC`n>r2`nGGGCCC`n>r3`nTTTAAA" | Set-Content reads.fasta
   ```
   ```output
   ```
2. Count the header lines.
   ```bash platform=linux
   grep -c '^>' reads.fasta
   ```
   ```output
   3
   ```
   ```bash platform=macos
   grep -c '^>' reads.fasta
   ```
   ```output
   3
   ```
   ```powershell platform=windows
   (Select-String -Pattern '^>' -Path reads.fasta).Count
   ```
   ```output
   3
   ```
   > WHY: Every FASTA record starts with one line beginning with >.
   > CHALLENGE: Add a fourth read to the file, then count again. What do you expect?
   > SOLUTION: The count is 4: the new record brings one more header line.
