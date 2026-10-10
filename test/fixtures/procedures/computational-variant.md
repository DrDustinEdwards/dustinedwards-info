---
profile: computational
type: how-to
method: [annotation]
path: /software/how-tos/computational-variant
title: "Test Fixture: Count Reads, a Variant"
seo_title: "Test Fixture: Count Reads, a Variant"
description: "A generic test variant used by the procedure tests. It is the read count fixture copied with Duplicate, and is never published."
draft: true
version: "MISSING: A new variant; no version has been assigned yet."
forked_from:
  slug: computational-fixture
  version: "fixture-1"
updated: 2026-10-10
environment: "Any POSIX shell (bash 5) with grep on the PATH."
prerequisites:
  - "A FASTA file named reads.fasta in the working directory."
materials:
  - name: grep
    kind: software
    version: "GNU grep 3.11"
based_on:
  - citation: "GNU grep manual"
    url: https://www.gnu.org/software/grep/manual/
    for: the count option
expected_results: "The count is 3."
limitations: "A test fixture only."
references:
  - "GNU grep manual. [gnu.org](https://www.gnu.org/software/grep/manual/)"
---

This is a test fixture for a variant's lineage, not a method the site publishes.

## Count the reads

1. Count the header lines with @grep.
   ```bash
   grep -c '^>' reads.fasta
   ```
   ```output
   3
   ```
