---
title: "An AI answer layer that has to earn its keep"
slug: ai-answer-layer-ask-mode
description: "Hybrid retrieval over classic search, a complementarity measurement, three cost gates including a rate limiter that did not count, and an index that syncs itself on save."
date: 2026-07-28
tags: [cloudflare, ai-search, workers-ai, durable-objects, search]
draft: false
first_published: 2026-07-30
---

The previous article built this site's classic search: two FTS5 indexes, rank fusion, six milliseconds. This one adds the AI layer on top, and the design constraint that governed it: the AI layer is an enhancement that must be removable without a trace, must never block the classic path, and must pay for its own risks, because it is the only public endpoint on this site that bills money per request. Every number here was measured on the live system.

## The layering, and its proof

Ask mode streams a cited answer above classic results. It runs on Cloudflare's AI Search with hybrid retrieval, BM25 and vector search fused, plus a cross-encoder reranking pass. The classic results render first and never wait on any AI call; if the binding is absent or the instance unreachable, the Ask affordance disappears and search is untouched.

That removability claim was tested by doing it: the binding was deleted, the ask route returned 404, and the classic search payload was byte-identical to before the AI layer existed. "Byte-identical without it" is the standard I would hold any enhancement layer to, and it is checkable in a way that "gracefully degrades" never is.

## The measurement that justifies having both layers

The citable finding: on the same corpus and a shared query set, classic keyword search found two results the AI retrieval missed, and AI retrieval found three that classic missed. Neither subsumes the other. Exact-token queries like "verdict, enforcement" hit the identity index and returned nothing from semantic retrieval, which sat below the instance's 0.4 score threshold for short tokens; natural-language questions like "how do enforcement hooks reach files but not rows?" returned nothing from FTS5, which had no matching terms, and were answered correctly by the AI layer with a citation to the right section anchor.

This is the empirical version of an argument usually made by vendors: hybrid systems are defended with benchmarks you cannot inspect, and here the complementarity table is three rows measured on content you can read. It is also the reason the classic layer can never be replaced by the AI one on this site: they fail on opposite inputs.

## Feeding the index without a crawler

The corpus went in through built-in storage, uploaded markdown, rather than the web crawler, for two reasons that generalize. The crawler indexes a domain onboarded to the account, and this site's apex still resolves to a legacy installation pending DNS cutover, so a crawl would have faithfully indexed the wrong site. And uploaded section records preserve the heading anchors that citations deep-link to; all seven keys round-trip to anchors that exist on the live page, verified by asking questions and following the citations.

Staleness is the failure mode of every RAG system, so the sync is not a cron job hoping for the best: an editor save uploads that post's own section records and drops every cached answer, incrementally, because section decomposition is a pure function of one post's markdown. Lag is seconds. The sync deliberately cannot fail the save, and because a save redirects, the admin list shows index drift in both directions plus the day's budget, with a one-button repair. Verified end to end by editing the live post, asking a question whose answer depends on the new sentence, and receiving the correct answer with the citation still anchored to the right section.

One operational fact worth stating because it is invisible from the docs: no credential is needed at runtime. The API token exists only for the control-plane create call; the serving path runs entirely on the binding, and the secret list proves it.

## Three gates in front of the only endpoint that bills

The ask route is public, unauthenticated, and pays for a language-model generation per uncached call. Three gates sit in front of it, cheapest first, and the ordering is load-bearing: a per-IP burst limit, then an answer cache, then a daily ceiling, so a cache hit consumes no budget. Refusals are 429 with Retry-After and cost no AI call. Every response carries an x-ask-cache header, which makes the cache testable from outside; the same question twice returns byte-identical bytes with a hit marker.

The gate implementation produced the most broadly useful table in this whole series. Configured to allow five requests in sixty seconds and attacked with twelve concurrent requests, the platform's GA rate-limiting binding let through one, then two, then nine, then zero across four runs; it is documented as permissive and eventually consistent, and it is: it sheds sustained load, it does not count. A Durable Object using asynchronous storage reads and writes allowed eight requests through a ceiling of three, because a read and a write spanning an await inside a Durable Object are not atomic; single-threaded is not the same as transactional. The same Durable Object rewritten on the synchronous SQLite API allowed exactly three of fourteen through the ceiling and exactly five of fourteen per IP.

The citable unit: a Durable Object is not automatically a correct counter. Correctness came from sql.exec being synchronous, which is the entire reason the class is registered with new_sqlite_classes. A fixed window still admits up to double across a boundary, measured at ten of twelve, which is ordinary and accepted.

One harness confession belongs next to that table, because it produced a confident false negative: a sequential attack loop is not a burst. Twelve requests each awaiting a full generation span more than the sixty-second window, so the limiter correctly never fired and the test reported the guard dead. The guard was fine; the attack was polite.

## The agent story

Search on this site is now usable at three levels, all documented in llms.txt: as a URL anyone can construct, as JSON under content negotiation on the same URL, and as an MCP server exposed by the AI Search instance, verified externally with no account authentication before it was advertised, so an AI agent can query this site conversationally through a standard protocol. The removability rule applies here too: the MCP level is the instance's feature, and turning it off changes nothing underneath.

## Costs, stated plainly

Retrieval on AI Search is free during its open beta, with pricing promised on thirty days notice; generation bills on Workers AI per uncached answer today. The daily ceiling caps worst-case spend at a number chosen deliberately, the cache converts repeat questions into free reads, and the standing entry in the decisions log requires a cost review when beta pricing lands. Time to first token, measured warm: 2.1, 3.1, and 6.5 seconds across runs, 7.4 cold, with sources rendering before the answer starts so the wait is honest. The Ask client chunk is 2.5 kB raw.

## Disclosures

The complementarity measurement is a seven-record corpus and a small query set: strong enough to prove neither layer subsumes the other, far too small to estimate rates, and it will be rerun as the corpus grows. The retrieval threshold behavior around short exact tokens is a property of this instance's configuration, not a universal constant. The rate-limiter table reflects one platform binding at one point in a beta; the durable finding is the atomicity mechanism, not any vendor's current default. And the pricing paragraph is true as of publication and is exactly the kind of claim this site's editorial rules require re-verifying on the day it ships.
