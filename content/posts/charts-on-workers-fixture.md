---
title: "Charts on Workers: the rate limiter that would not count"
slug: charts-on-workers-fixture
description: "A pipeline fixture carrying the chart directive's first real charts, drawn from the rate limiter measurements taken while building the Ask guards."
date: 2026-07-30
tags: [cloudflare, charts, durable-objects]
draft: true
---

This post is a fixture. It exists so the chart directive has real, recorded data
in the gated artifact, which is what lets `check:content` byte-compare chart
output like any other content. The prose is deliberately thin. The numbers are
not invented: every one was measured while building the guards on `/search/ask`.

## The GA rate limiting binding does not count

The first attempt at a per-IP burst limit used Cloudflare's GA `ratelimit`
binding, with a limit of five. Twelve concurrent requests were fired at it, four
times. A limiter honouring its own limit refuses seven of twelve every time.

:::chart{type=bar x=run y=refused title="Requests refused by the GA ratelimit binding" alt="Bar chart of four runs against a limit of five, twelve concurrent requests each. The binding refused 1, then 2, then 9, then 0 requests. A limiter honouring the limit would refuse 7 every time."}
```csv
run,refused
run 1,1
run 2,2
run 3,9
run 4,0
```
Four consecutive runs, twelve concurrent requests, limit of five. Cloudflare
documents the binding as permissive and eventually consistent; under sustained
load it sheds rather than counts.
:::

Run four refused nothing at all. That is the shape of the bug: the mechanism
reports success whether or not it did anything.

## Only the synchronous API holds the ceiling

Three mechanisms, each given a ceiling and a burst larger than it. The question
is how many requests each one actually let through.

:::chart{type=bar x=mechanism y=allowed,ceiling labels="Allowed,Ceiling" title="Requests allowed against the ceiling each mechanism was given" alt="Grouped bar chart comparing allowed requests against the ceiling for three mechanisms. The GA ratelimit binding allowed 11 against a limit of 5. A Durable Object using async storage allowed 8 against a ceiling of 3. A Durable Object using the synchronous SQLite API allowed exactly 3 against a ceiling of 3."}
```csv
mechanism,allowed,ceiling
GA ratelimit,11,5
async DO storage,8,3
sync SQLite DO,3,3
```
The middle bar is the interesting one. A read and a write spanning an `await`
inside a Durable Object is not atomic, so `storage.get` then `storage.put` let
eight requests through a ceiling of three. `sql.exec` has no `await`, which is
the whole reason the class is registered as `new_sqlite_classes`.
:::

The synchronous SQLite API is the only one of the three that landed on its
ceiling exactly. That is why both Ask counters are Durable Objects, and why the
choice is recorded as measured rather than preferred.


Parity marker: sweep two.

A [live javascript link](javascript:alert(1)) in prose.
