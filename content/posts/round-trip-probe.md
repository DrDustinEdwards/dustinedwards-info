---
title: "Round trip probe, edited"
slug: round-trip-probe
description: "Throwaway post created to verify the editor write path end to end."
date: 2026-07-28
tags: [testing, cloudflare]
draft: false
---

## First section

This post exists only to verify the editor write path end to end. It is created, edited and deleted by an automated round trip.

It exercises a fenced code block so shiki has something to highlight:

```ts
export const probe: number = 1;
```

### A nested heading

And a table, so remark-gfm is exercised too.

| Check | Expected |
| ----- | -------- |
| commit | one, atomic |
| rows | synced after |
