---
title: "Draft D1 write probe"
slug: draft-d1-write-probe
description: "A throwaway draft used to measure whether a save through the operator API writes a row to D1 for a draft post. Deleted immediately after the measurement."
date: 2026-09-09
draft: true
tags: [fixture]
---

This post exists to answer one question: does a save through the operator API write a D1 row when the post is a draft. It is read once, measured, and deleted.

The measurement compares the row's source_blob_sha against the blob sha the commit produced, and then reads the content-drift health check to see whether the two sides agree.
