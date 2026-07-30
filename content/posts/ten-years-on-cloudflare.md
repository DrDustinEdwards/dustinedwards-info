---
title: "Ten years on Cloudflare, so I rebuilt everything on it"
slug: ten-years-on-cloudflare
description: "A decade as a customer, one full rebuild as the proof: what the 2026 developer platform looks like from inside a working system, with measurements."
date: 2026-07-30
draft: false
tags: [cloudflare, workers, d1, platform, architecture]
first_published: 2026-07-30
---

Ten years ago I put my first domain behind Cloudflare for the same reason everyone did at the time. There was a real host somewhere, in my case a shared HostGator box running WordPress, and Cloudflare was the thing you put in front of it so the real host would survive being on the internet. DNS, caching, the orange cloud icon. I did not think of it as a place where software ran. I am not sure anyone did in 2016, because mostly it wasn't.

This year I rebuilt my personal site so that there is no host behind the cloud anymore. The application server, the database, the object storage, the search engine, the AI answer layer, and the publishing pipeline all run on Cloudflare's developer platform. The WordPress install still answers at my apex domain as I write this, waiting for a DNS cutover, which is a detail that will matter later in this post for an unexpected reason. Everything else already lives on the new stack.

This post is the survey I wanted to read before I started and could not find: an account of what the platform actually is in mid-2026, written from inside a system that uses most of it, with measurements instead of adjectives. Platform facts below were checked against Cloudflare's documentation and announcements on July 30, 2026, and the ones likely to rot carry their dates in the text. A platform survey is probably the fastest-aging genre in technical writing, and the only defense I know of is timestamping.

It is also the first post in a series. Most sections of this post compress a full article's worth of work, including the parts that went wrong, and the series keeps those parts because they are usually where the transferable knowledge is.

## What the platform is, structurally

The center of the developer platform is Workers. Your code runs in V8 isolates distributed across Cloudflare's network, which means no servers to size, no regions to choose, and cold starts small enough that I have never once thought about them, which was not my experience with container-based serverless. The programming model is a fetch handler: a request comes in, your function returns a response, and the platform handles where and how.

Around Workers sits a family of storage and compute primitives. D1 is a relational database, which is to say SQLite, replicated and managed. R2 is object storage with an S3-compatible API and no egress charges. KV is an eventually consistent key-value store built for read-heavy configuration. Durable Objects give you single-instance coordination points with their own storage, which turns out to be the answer to a category of problem I will get to below. Workers AI runs inference on Cloudflare's GPUs. AI Search, still in beta, is a managed retrieval product: you give it a corpus, it handles chunking, embedding, hybrid retrieval, and answer generation with citations.

The pitch is that these compose into complete applications with no infrastructure to operate. That pitch is broadly true, and this site is an existence proof. What the pitch omits is the texture: which primitives are mature, which are beta in ways that bite, and what the constraints cost in practice. The rest of this post is that texture.

## The numbers from one real system

Some measurements from this site's repository, to anchor the discussion in something concrete.

The Worker that serves every page is a 3.78 MB server asset. The largest single expense inside it is a complete markdown rendering pipeline, including syntax highlighting, which I run server-side because every public page of this site works with JavaScript disabled. That was a deliberate constraint, and holding it meant the client-side enhancement budget for the entire blog, progress bar, scroll-spy table of contents, copy buttons, footnote previews, lightbox, came to 1.59 kB gzipped. I did not believe that number when I first measured it, which was appropriate, because the first version of the measurement was wrong in a different direction: a misconfigured import had been shipping raw TypeScript as a static asset, and the 0.05 kB chunk size was the clue.

Site search answers from D1 in 6 milliseconds at the median over 25 measured runs, 15 at the 95th percentile, on a hand-built engine I will describe in a moment. The AI answer layer streams its first token in between 2.1 and 6.5 seconds warm, 7.4 cold. A publish is a single git commit that lands in the database and both search indexes within seconds of the commit returning.

The monthly cost of running all of this rounds to a few dollars. I want to be careful with that fact, because cost claims from personal-scale projects generalize badly, but the architectural version of the claim holds at any scale: nothing in this system required capacity planning, and there is no idle infrastructure anywhere in it.

## D1 is better than its reputation, with edges worth respecting

D1 spent its early life with a reputation for being a toy, and I think that reputation is now mostly stale. It is real SQLite, and real SQLite is a serious database with thirty years of behavior you can look up. For a content site, the practical consequence is that FTS5 full-text search comes with the database. I built this site's search directly on it: two FTS5 indexes over the same corpus, one unstemmed for names and identifiers, one Porter-stemmed for prose, merged with reciprocal rank fusion. The reason for two indexes is a genuine SQLite constraint that surprised me: the tokenizer is a property of the table, not of the query, so a corpus that needs both exact and stemmed matching needs two tables. I measured the difference on production data before accepting the cost. A search for one word form matched the identity index while its stem returned nothing from it, and the stemmed index caught both.

The result embarrassed my assumption that search means a search service. Six milliseconds, section-level results with deep links, zero external dependencies. At personal-site scale, and I suspect well beyond it, the database you already have is the fast path.

Then there are the edges. The one I most want other D1 users to know about: the platform's own export command fails outright on any database containing FTS5 virtual tables. It exits with an error and writes nothing. This is precisely the database that a search feature produces, so the backup path you would reach for in a recovery does not work on the system most likely to need it. The working approach is per-table export with schema coming from your migration files, and this site enforces that with a check script that derives the expected table list from the migrations directory, because a backup procedure that lives only in someone's memory is not a procedure. Two adjacent findings from the same investigation: counting rows in an external-content FTS5 table cannot detect index corruption, because the count reads through to the content table, so you have to count the docsize shadow table instead; and deleting directly from an FTS5 table corrupts its index in a way that only surfaces on a later write. I found all three of these before they cost me anything, which was luck as much as diligence, and writing them down here is the closest I can come to exporting the luck.

## Durable Objects, and a wrong assumption I can save you from

This site's AI answer layer is the only public endpoint that costs money per request, so it sits behind rate limiting, and building that rate limiting taught me the most transferable single fact in this post.

My first implementation used a Durable Object with its asynchronous storage API. A Durable Object is single-threaded, so I assumed a read-increment-write sequence was safe. Under a concurrent burst of fourteen requests against a ceiling of three, it admitted eight. The read and the write were separated by an await, and other requests interleaved in the gap. Single-threaded is not the same thing as transactional, and I had been treating the words as synonyms.

The platform's answer is the synchronous SQLite storage API inside Durable Objects, which is the reason the newer class registration exists. Rewritten on it, the same object under the same burst admitted exactly three. I also tested the platform's built-in rate-limiting binding on the way, and measured it doing what its documentation, read carefully, says it does: shedding sustained load with eventual consistency rather than counting. Across four runs of twelve concurrent requests against a limit of five, it admitted one, then two, then nine, then zero. For abuse damping that behavior is fine. For a budget guard it is not a counter, and the distinction only shows up under concurrent load, which leads to the last trap: my first test loop was sequential, each request awaiting completion, and it produced zero refusals against a limit that was working perfectly, because the polite loop walked across the rate window. I had written that exact trap into my own project notes days earlier for a different guard, and walked into it anyway.

## Constraints that shaped the architecture

Workers refuse to compile WebAssembly at runtime. This is a security decision, and I am not arguing with it, but it has consequences that only appear when a dependency assumes otherwise. My syntax highlighter's default regex engine turned out to be nondeterministic, which is fatal for a build system that byte-compares rendered output, and the deterministic alternative is an Oniguruma WASM build whose loader wants to compile bytes at runtime. The fix was an injected loader that statically instantiates the module for the Worker while Node keeps the byte import, at a cost of 0.44 MB. The same constraint ruled out server-side social-card rendering entirely: the rendering stack's WASM plus its 1.87 MB weight made no sense for a code path that runs only on saves, so card generation moved to build time, and a post published from the browser editor simply has no card until the next build. I chose a missing image over a broken one and documented the gap.

I list these not as complaints but because a survey that omits the constraints is an advertisement. Every platform has a shape, and the cost of a platform is learning where its shape and your assumptions disagree. Mine disagreed in the places above, the disagreements were all resolvable, and each one is now a check script or a documented rule rather than a memory.

## The AI layer, with enthusiasm and a budget

AI Search gave this site a streaming, cited answer mode over its own content in about a day of work, which is a remarkable sentence to be able to write. The retrieval is hybrid, keyword and vector fused, with a reranking pass, and I measured it against my classic engine on a shared query set rather than trusting either. Classic search found two results the AI retrieval missed, all exact-token queries. The AI retrieval found three the classic engine missed, all natural-language questions with no matching terms. Neither subsumes the other, which is the empirical argument for running both, and it took an afternoon of probing to establish instead of an opinion.

It is also a beta product with beta pricing, and I treated it accordingly. The answer endpoint sits behind three gates, cheapest first: a per-IP burst limit, a response cache, and a daily budget ceiling, so a cache hit costs nothing and worst-case daily spend is a number I chose. There is a standing note in the project's decision log to re-run the economics when the beta pricing ends. I mention the note because I think the habit matters more than the numbers: using a moving product is fine if the exposure is bounded and the re-evaluation is scheduled, and it is the scheduling that people skip.

## The web is renegotiating with its machines, at this layer

The strangest part of this rebuild is that the most consequential platform developments had nothing to do with hosting my pages. They are about who, or what, reads them.

This site treats AI agents as a first-class audience in both directions. Inbound, every post serves a markdown twin at a predictable URL, the search endpoint returns JSON to any client that asks for it via content negotiation, an llms.txt file maps the site, and the search engine is exposed over the Model Context Protocol so an assistant can query it conversationally. Outbound, and this still feels novel to write, the site is operated by an agent: there is an authenticated publishing API whose rules are enforced server-side, an MCP wrapper over it, and the AI assistant that helped build this system drafts and stages posts through it, including drafts of this very series. Exactly one act is reserved for me by a policy the agent cannot alter. The trust model behind that arrangement takes two full articles to describe properly, later in the series, including the one incident where a draft leaked to a public surface that nobody had wired into the visibility rules.

The economic half of the renegotiation is happening at the CDN layer, which for a fifth of the web means it is happening at Cloudflare. On July 1, 2026 the company announced that from September 15, its defaults will block AI training and agent crawlers on ad-supported pages for new customers, new sites, and free-tier accounts, while search crawlers remain allowed by default, and that its Pay Per Crawl marketplace is becoming a broader Pay Per Use model that pays publishers when content surfaces in an AI answer rather than only when a bot fetches a page. The company's stated numbers include that the majority of its traffic is now non-human and that more than half of AI crawl traffic re-fetches pages that have not changed. I have no settled opinion yet on how well the mechanics will work. I do think the direction is unambiguous, and I notice that my ten-year-old decision about where to put my DNS has quietly become a decision about my position in that negotiation. This site's own crawl and monetization settings get configured the day the DNS cutover lands, and that will be its own post once there is data rather than speculation in it.

## What the decade actually bought

Familiarity, mostly, compounding into leverage. The primitives are small enough to hold in your head. The billing has never once surprised me, which I have come to value more than any feature. The distance from an idea to code running worldwide is one command, and after ten years the command is reflex.

The honest summary of the rebuild is that a one-person site now runs what would have been a small team's roadmap five years ago: a gated content pipeline where git is the source of truth and the database serves, an edge-resident search engine, a hybrid AI answer layer with cost controls, and a publishing path that an AI agent can operate under enforced policy. The platform is most of the reason that was feasible in evenings and weekends. The rest of the series is the detail: what I built, what I measured, what broke, and what I would tell you to check before you trust any of it.

Every quantitative claim in this series is reproducible from the site's repository. That policy cost me more time than any feature described above, and it is the part of the project I am least willing to give up.
