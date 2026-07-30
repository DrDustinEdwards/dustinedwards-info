---
title: "Cloudflare AI Search: Building a Cited RAG Answer Layer"
slug: ai-answer-layer-ask-mode
description: "How to add a retrieval-augmented answer mode to a site with Cloudflare AI Search: uploaded storage versus the crawler, save-time index sync, three cost gates in front of a paying endpoint, and the Durable Objects atomicity measurement behind them."
date: 2026-07-28
tags: [cloudflare, ai-search, workers-ai, durable-objects, search]
draft: false
first_published: 2026-07-30
---

This article describes how to add a retrieval-augmented generation (RAG) answer mode to a site using Cloudflare AI Search: a public endpoint that streams a cited answer synthesized from your own content. The previous article in this series covered the classic keyword engine underneath; this one covers the AI layer on top, and it is organized around the three requirements I set before building, because they are the requirements I would recommend to anyone adding a similar layer. The AI mode must never block or degrade the classic path. It must be removable without a trace. And because it is the one public endpoint that costs money per request, it must sit behind cost controls whose behavior is measured rather than assumed.

Prerequisites: a Workers project, content decomposable into records with stable anchors, and the willingness to probe a beta product before trusting it.

## Step 1: layer it so removal is provable

Render classic results first and never await any AI call on their path. Gate the AI feature's visibility on the presence of its binding, so that removing the binding removes the affordance rather than breaking it. Then verify removability the only way that counts: remove it. I deleted the binding, confirmed the answer route returned 404, and confirmed the classic search response was byte-identical to its pre-AI form. "Byte-identical without it" is a checkable standard; "degrades gracefully" is not, and I would hold any enhancement layer to the first.

The same discipline pays during incidents: if the beta product misbehaves or the pricing changes unfavorably, the exit is one configuration change, and knowing that changes how much risk you can accept everywhere else.

## Step 2: measure whether you need both layers, rather than assuming

The common assumption is that semantic retrieval subsumes keyword search. Test it on your own corpus before believing it in either direction. My procedure: a shared query set run against both layers, scoring which results each found that the other missed. The outcome on this corpus: the classic FTS5 engine found two results the AI retrieval missed, both exact-token queries, where the semantic layer's similarity scores fell below the instance's relevance threshold for short literal tokens. The AI retrieval found three the classic engine missed, all natural-language questions phrased in words the documents never use, which keyword matching cannot bridge. Neither subsumes the other; they fail on opposite inputs.

That measurement is the justification for running both layers, and it took an afternoon. I mention the effort because the alternative, adopting a vendor's benchmark or a blog post's intuition, costs less and is worth what it costs. Complementarity is a property of your corpus and your users' query styles, not of the technology.

## Step 3: feed the index with uploads, not the crawler, if your anchors matter

AI Search offers two ingestion paths: a web crawler over a domain, or direct upload into managed storage. I used uploads, for two reasons that generalize. First, correctness of scope: the crawler crawls the domain as DNS resolves it, and this site's apex still pointed at a legacy installation awaiting cutover, so a crawl would have faithfully indexed the wrong site. Check what your domain actually serves before pointing a crawler at it. Second, citation quality: uploading the same section-grained records the classic engine uses, keyed to heading anchors, means every citation in a generated answer deep-links to a section that exists. I verified this by asking questions and following every citation to its anchor.

Staleness is the standing failure mode of any RAG system, and I would treat the sync design as first-class rather than a cron job added later. Here, a content save uploads that post's own section records and invalidates cached answers, incrementally, which is possible because section decomposition is a pure function of one post's source. Lag is seconds. Two design rules attached: the sync must not be able to fail the save (index freshness is worth less than write reliability), and the admin should display index counts against source counts with a one-button repair, because a drift you can see is a maintenance task and a drift you cannot see is a slowly wrong product.

One operational fact that is invisible in the documentation and worth stating: no credential is needed at runtime. The API token exists only for the control-plane call that creates the instance; the serving path runs entirely on the Worker binding. Your secret inventory should reflect that, and mine does: the creation token is deletable.

## Step 4: three cost gates, ordered cheapest first

A public, unauthenticated endpoint that performs a model generation per request is an open invitation to spend your money. Put three gates in front of it, in this order, so that each request hits the cheapest applicable control: a per-IP burst limit, then an answer cache keyed on the normalized question, then a daily budget ceiling. The ordering means a cache hit costs no budget and a rate-limited request costs no AI call. Return refusals as 429 with a Retry-After header. And make the cache observable from outside: every response here carries a header naming hit or miss, which converts "is the cache working" from a dashboard question into a curl command, and the same question asked twice returns byte-identical bytes with the hit marker.

The implementation of those gates produced the most transferable measurements in this article, so I will report them as the test sequence I would now recommend to anyone.

## Step 5: measure your rate limiter, because two natural implementations do not count

Configure a limit, then attack it with genuinely concurrent requests and count what gets through. Three implementations, same test shape, very different results.

Cloudflare's built-in rate-limiting binding, configured to allow five requests per sixty seconds and attacked with twelve concurrent requests, admitted one, then two, then nine, then zero across four runs. This is consistent with its documentation, which describes it as permissive and eventually consistent: it sheds sustained load. It does not count, and for a budget guard you need a counter.

A Durable Object using the asynchronous storage API, with a read-increment-write sequence, admitted eight requests through a ceiling of three. The reason is the finding I most want to pass along: a Durable Object is single-threaded, but a read and a write separated by an await are not atomic, because other requests interleave at the await point. Single-threaded and transactional are different properties, and the difference only appears under concurrent load.

The same Durable Object rewritten on the synchronous SQLite storage API, where the read-modify-write happens with no await between, admitted exactly three of fourteen through the ceiling and exactly five of fourteen per IP. The synchronous API is the reason the newer SQLite-backed class registration exists, and this use case is the argument for it. A fixed window still admits up to double the limit across a window boundary, which I measured at ten of twelve and accepted as ordinary; a sliding window costs more bookkeeping and was not warranted here.

One warning about the test harness itself, because it produced a confident false negative before it produced data: a sequential loop is not a burst. Thirty-six requests, each awaiting completion, produced zero refusals against a working limit of thirty per minute, because the polite loop walked across the window boundary. The limiter looked dead and was fine. Attack with real concurrency (`Promise.all`, not a for-await loop), or your test measures your patience rather than your guard.

## Step 6: expose the layer to machines as well as people

Once the endpoint exists, three levels of machine access come nearly free, and I would ship all three. The search URL itself, constructible by anyone. JSON from the same URL under content negotiation. And the Model Context Protocol endpoint that the AI Search instance can expose, which lets an AI assistant query the site conversationally through a standard protocol; verify it from an external client before advertising it. Document all three in llms.txt. The removability rule from step 1 applies at every level: each is a presentation of the same engine, and turning any off changes nothing underneath.

## Costs, stated plainly, and limitations

At the time of writing, retrieval on AI Search is free during its open beta with pricing promised on notice, and answer generation bills through Workers AI per uncached request. The daily ceiling makes worst-case spend a number I chose; the cache converts repeated questions into free reads; and there is a dated entry in the project's decision log requiring a cost re-evaluation when beta pricing lands. I would generalize that habit: using a beta product is reasonable when the exposure is bounded and the re-evaluation is scheduled, and it is the scheduling that tends to be skipped.

Measured latency, for expectation-setting: time to first token between 2.1 and 6.5 seconds warm and 7.4 cold, with retrieved sources rendered before the answer begins so the wait is visibly progress. The complementarity measurement in step 2 was run on a small corpus and query set; it is strong enough to establish that neither layer subsumes the other here and far too small to estimate rates, and it should be re-run as any corpus grows. The retrieval threshold behavior around short exact tokens is a property of this instance's configuration rather than a universal constant. And the rate limiter table reflects one platform's bindings at one point in time; the durable finding is the atomicity mechanism, which is not vendor-specific at all.

The next two articles in this series move from reading to writing: what happens when an AI agent is given write access to this site, and the protocol layer built on top of that access.
