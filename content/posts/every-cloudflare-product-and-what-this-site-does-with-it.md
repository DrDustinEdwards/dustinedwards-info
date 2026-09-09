---
title: "Ten years on Cloudflare, and what I would use again"
slug: every-cloudflare-product-and-what-this-site-does-with-it
description: "Every Cloudflare developer product as of September 2026 in one table: what Workers, D1, KV, R2, Queues, Durable Objects, AI Search and the rest actually do, and which ones a complete site runs on, where, and why. With the refusals and the constraints, dated."
date: 2026-09-08
draft: true
featured: true
tags: [cloudflare, workers, d1, platform, architecture]
---

There is no server behind this site. Ten years ago I put my first domain behind Cloudflare the way everyone did then: a shared HostGator box ran the real site and Cloudflare was the DNS, the cache, and the orange cloud in front of it. It was not a place where software ran, and in 2016 it mostly wasn't. This year I rebuilt so that the cloud is the whole thing. The pages, the database, the uploads, the search, the AI answers, the alert mail, and the publishing pipeline all run on Cloudflare products, and nothing else is in the stack.

So this is the post I wanted when I started: every developer product Cloudflare sells as of September 8, 2026, what each one does in plain words, and whether this site uses it, where, and why or why not. The refusals are in the table with everything else. A survey that only lists what worked is an advertisement.

## Which products this site runs on

Used means a binding or a configured feature that production depends on today. Not used means considered and passed over; the reason is in the product's own entry below. The numbers are dated because every one of them moves.

| Product | What it does | This site | Where |
|---|---|---|---|
| Workers | Runs your code on Cloudflare's network | Used | Everything: two Workers, the site and a watchdog |
| Static Assets | Serves files from a Worker with no invocation | Used | `public/`, through the `ASSETS` binding |
| Workers Cache | Caches a Worker's responses at the edge | Used | The renderer entrypoint; the gateway is deliberately uncached |
| D1 | SQLite database, managed | Used | Posts, tags, search index, media index |
| KV | Fast key-value store, eventually consistent | Used | Login sessions, the Ask answer cache, watchdog state |
| R2 | Object storage, no egress fees | Used | Three buckets: uploads, social cards, a mirror of uploads |
| Queues | Message queue between Workers | Used | R2 upload events feeding the media index |
| Durable Objects | A single-instance object with its own storage | Used | The rate limiter and daily budget for Ask |
| Analytics Engine | Time-series data you write from a Worker | Used | Per-page traffic counts, no cookies, no IPs |
| Images | Resize and convert images on request | Used | Every thumbnail and content width |
| AI Search | Retrieval and cited answers over your content | Used | The Ask endpoint, above classic search |
| Email Service | Send email from a Worker | Used | The watchdog's alert mail |
| Email Routing | Receive mail on your domain and forward it | Used | Inbound mail on the domain |
| Workers Observability | Logs and traces for Workers | Used, logs only | Traces are off on purpose (see the entry) |
| Cron Triggers | Run a Worker on a schedule | Used | The watchdog, every 15 minutes |
| Workers AI | Run AI models on Cloudflare GPUs | Indirect | Only through AI Search; no direct binding |
| Rate Limiting binding | A built-in per-key rate limiter | Refused | Measured: it sheds load, it does not count |
| Vectorize | Vector database for embeddings | Refused | Two FTS5 indexes answer this corpus |
| Pages | Hosting for static and framework sites | Not used | Workers with static assets does the same job |
| Workers Builds | Build and deploy from a git push | Not used | Deploys go through a gated ship script |
| Hyperdrive | Connection pooling to an external Postgres or MySQL | Not used | There is no external database |
| Workflows | Durable multi-step jobs with retries | Not used | Nothing here runs long enough |
| Containers | Run any container next to a Worker | Not used | Nothing needs a runtime beyond V8 |
| Sandboxes | Isolated code execution for agents | Not used | Agents write through an API, not by running code |
| Browser Run | Headless browser as a service | Not used | Charts and diagrams render at build time |
| Workers Agents SDK | Framework for stateful AI agents | Not used | The agent surface is an MCP server on plain Workers |
| AI Gateway | Proxy and observability for model calls | Not used | Ask's one model call is metered by a Durable Object |
| Stream | Video hosting and playback | Not used | No video |
| RealtimeKit | Live audio and video | Not used | No live features |
| Pipelines | Streaming ingestion into R2 | Not used | Analytics Engine covers the one stream |
| Data Platform | Catalog and query data in R2 | Not used | Nothing to catalog |
| Artifacts | Git-native versioned storage | Not used | GitHub is the repository |
| Secrets Store | Account-level secret storage | Not used | Nine `wrangler secret` values, gated |
| Turnstile | Bot check without a captcha | Not yet | Planned for the newsletter form |
| Web Analytics | Client-side analytics beacon | Refused | Blocked by this site's CSP, and not needed |
| Zaraz | Third-party tag loading at the edge | Not used | There are no third-party tags |
| Access | Login in front of an application | Not used | The admin plane uses Better Auth |
| Cache Reserve | Persistent cache for static content | Not yet | Needs the zone; waits for DNS cutover |
| Workers for Platforms | Run customers' Workers inside yours | Not used | One customer |

## What each one does, in the words I would use to a colleague

### Workers

A Worker is a function that receives a request and returns a response, running in a V8 isolate on Cloudflare's network in whichever city is closest to the reader. No server to size, no region to choose, cold starts small enough that I have never thought about them. Everything else on this list is something a Worker can be given a binding to.

This site is two Workers. The first serves every page and holds the entire markdown rendering pipeline, syntax highlighting included, because every public page works with JavaScript disabled. Its upload measured 8.4 MiB on 2026-09-08 (2.1 MiB gzipped; 3.78 MB when the first version of this post published on 2026-07-30). The second is a watchdog that reads the site's health endpoint every fifteen minutes through a service binding and repairs what it can. The client-side enhancement budget for the whole blog, progress bar, table of contents, copy buttons, footnote previews, lightbox, comes to about three kilobytes gzipped; the public plane ships no framework script at all.

### Static Assets

A Worker can serve a directory of files directly from the edge with no code running, through a binding with exactly one method, `fetch()`. That method is the whole interface: a Worker can serve any path it is given and discover none of them, which is why this site's media index reads a committed manifest of what is in `public/` instead of asking the binding.

### Workers Cache

Cloudflare can store a Worker's responses at the edge and answer repeat requests without running the code. This site turns it on for the renderer and off for the gateway that sits in front of it. The gateway does three things that must never be skipped, the HTTPS redirect, the theme cookie read, and the traffic count, and a cached gateway would skip all three. Every response without an explicit `Cache-Control` defaults to `private, no-store`, because the platform would otherwise cache a logged-in admin page for two hours under standard heuristics and serve it to anyone. That default is the one line of configuration I would tell every Workers user to check first.

### D1

A relational database, which is to say SQLite, replicated and managed by Cloudflare. D1 spent its early life with a reputation for being a toy and that reputation is stale. It is real SQLite, and real SQLite ships FTS5 full-text search with the database. This site's search is two FTS5 indexes over the same corpus, one unstemmed for names and identifiers and one Porter-stemmed for prose, merged with reciprocal rank fusion. Measured 2026-08-28 against production: median 64 ms warm, 145 ms cold, for the database query alone. The schema and the fusion method are in [the search article](/blog/site-search-fts5-rank-fusion).

D1 also holds the media index, and that is a capability decision rather than a scale one: R2 lists objects in key order and promises nothing else, so "sort by date, filter unused, count by type" each need a query, and a database is where queries live.

The constraint every D1 user should know: the platform's export command fails outright on any database containing FTS5 tables. The working per-table procedure is documented in the search article, and as of 2026-09-08 a weekly job restores that export into a scratch database and compares it against production, because a backup that has never been restored is a hope. That drill found three bugs in the documented restore path on its first run.

### KV

A key-value store that reads fast anywhere in the world and accepts that a write takes a moment to be seen everywhere. Right for configuration and caches, wrong for counters. This site keeps login sessions in it, the watchdog's alert state, and the Ask answer cache, keyed by a hash of the normalised question. The cache sits in front of the daily spending ceiling rather than behind it, so a repeated question reaches no model and costs nothing.

### R2

Object storage with an S3-compatible API and no charge to read the data back out. This site runs three buckets, split on lifecycle rather than on what the admin UI calls them. Uploads are content-addressed: the key is a hash of the bytes, which was decided on security rather than tidiness, because the old key was guessable from a slug the sitemap publishes. Social cards are derived and regenerable, so they get their own bucket that may be emptied. The third bucket is a mirror of uploads that no code path on this site can delete from; a gate fails the build if one appears, and the health endpoint compares every object against its twin.

### Queues

A message queue: one Worker puts a message on it, another consumes it, with retries and a dead-letter queue for permanent failures. This site's media index is written this way. An upload writes only to R2; R2 emits an event; the consumer derives the database row from the object as it is now, never from what the message claimed. That is what makes replay and out-of-order delivery converge, and it is why the Worker never does a dual write.

### Durable Objects

A single instance of a JavaScript class, addressed by name, with its own storage. Only one copy exists anywhere in the world, so it is the platform's answer to coordination. This site uses one for the two guards in front of Ask, the only public endpoint that costs money per request: a per-IP burst limit and a site-wide daily ceiling.

Building it taught me the one fact from this whole rebuild I repeat most often: single-threaded is not transactional. A Durable Object using the asynchronous storage API admitted eight requests through a ceiling of three, because a read and a write separated by an `await` are not atomic. The synchronous SQLite storage API is the fix; the same object rewritten on it admitted exactly three. The measurements are in [the AI answer layer article](/blog/ai-answer-layer-ask-mode).

### Analytics Engine

A write-only time-series store you append to from a Worker and query later with SQL. This site writes one row per HTML response: path, referrer host, country, and a coarse mobile flag. No cookie, no IP address, no identifier of any kind, so nothing joins two requests together. It is here because the alternative, Cloudflare's own Web Analytics beacon, is a third-party script, and this site's Content Security Policy would have to be loosened to admit it.

### Images

Resize, crop and convert images on request, from an original you keep in R2. This site derives every thumbnail and every content width from one uploaded original through the binding, and the results are cached by the Workers Cache above. The binding rather than the URL syntax, and that is forced: the URL interface answers 404 on a workers.dev hostname because it needs a customer zone. A detail that stops mattering at DNS cutover.

### AI Search

You give it a corpus; it handles chunking, embedding, hybrid retrieval, reranking, and answer generation with citations. This site's Ask mode is built on it, above classic search rather than instead of it, because the two fail on opposite inputs. Measured on a shared query set: classic search found two results the AI retrieval missed, all exact tokens, and the AI retrieval found three the classic engine missed, all natural-language questions. Neither subsumes the other. It is a metered product, so it sits behind the Durable Object above and a daily ceiling I chose.

### Email Service

Send email from a Worker through a binding, from an address on a domain you have onboarded. The watchdog uses it to mail me once when the site goes unhealthy and once when it recovers, with the state kept in KV so a bad afternoon sends one message rather than twelve. Sending to a verified destination address is free.

### Email Routing

Receive mail on your domain and forward it wherever you like. Inbound mail for dustinedwards.info lands here and forwards to my mailbox. Both halves of the email story share one set of SPF and DKIM records that Cloudflare manages, and DMARC on the domain is set to reject.

### Workers Observability

Logs and traces from your Workers, kept in the dashboard and exportable elsewhere. This site keeps logs on and traces off, and the off is a ruling rather than a default. A trace span carries the full request URL, and this site puts a capability token in the path of every draft preview link, so exporting traces would ship preview access to a third party. Invocation logs are off for a related reason: they recorded the reader's IP and session cookie for seven days with no field-level redaction available.

### Cron Triggers

Run a Worker on a schedule. The watchdog runs every fifteen minutes. The site Worker has no cron, and the empty array in its config is the statement: an hourly trigger that nothing handled sat on the platform for fifteen days in August, throwing 24 times a day, invisible to a gate that only read files. The gate now reads the platform too.

### Workers AI

Run open models on Cloudflare's GPUs from a Worker. This site never calls it directly; AI Search does the model work for Ask on its own. If Ask ever needs a model the retrieval product does not offer, this is where it would come from.

### Rate Limiting binding, refused

A built-in per-key limiter you declare in config. Measured on 2026-07-30 with a limit of five per sixty seconds and twelve concurrent requests: it refused one, then two, then nine, then zero across four runs. Its documentation says it sheds sustained load with eventual consistency, and that is true; it does not count, and a limiter guarding a budget has to count. The Durable Object replaced it.

### Vectorize, refused

A vector database for embeddings, the usual foundation for semantic search. Rank fusion over two FTS5 indexes answers this corpus in about fifteen lines with no vectors, and zero-result searches are the cheapest signal this site has for what to write next. That is the only evidence that would reopen the question.

### Pages and Workers Builds, not used

Pages hosts static and framework sites with a build on every push; Workers Builds does the same for Workers. Workers with static assets now does everything Pages did for this site, and Cloudflare's own direction has been to fold Pages into Workers. Deploys here go through a ship script that refuses unless the working tree is clean, CI is green for that exact commit, and every offline gate passes; a build on push would skip all of that.

### Hyperdrive, Workflows, Containers, Sandboxes, Browser Run, not used

Hyperdrive pools connections to a Postgres or MySQL you already run somewhere; there is no such database here. Workflows runs multi-step jobs that survive failures and can wait for a human; nothing here runs longer than a request. Containers runs any Docker image next to a Worker; nothing here needs a runtime beyond V8. Sandboxes gives an agent an isolated place to execute code; this site's agents write through an API with policy enforced server-side, and never run code. Browser Run is a headless browser you can drive from a Worker; charts and diagrams here render to SVG at build time, on purpose, so the page carries no work.

### Agents SDK and AI Gateway, not used

The Agents SDK is a framework for long-lived stateful agents on Durable Objects. This site's agent surface is the other direction: an MCP server that lets an outside agent read and write posts, with exactly one act, first publication, reserved to me in code. AI Gateway proxies model calls for logging, caching and cost control; Ask makes one model call per uncached question and a Durable Object already meters it.

### Stream, RealtimeKit, Pipelines, Data Platform, Artifacts, not used

Video hosting, live audio and video, streaming ingestion, data catalogs, and git-native storage. A text site with a media library of a few dozen images has no use for any of them, and I would rather say so than pad the used column.

### Secrets Store, Access, Zaraz, Web Analytics, Workers for Platforms

Secrets Store centralises secrets across Workers; this site's nine secrets live in `wrangler secret` and a gate asserts every one is set and none is in git. Access puts a login page in front of any application; the admin plane runs its own login on Better Auth because the policy it enforces lives in the application, not in front of it. Zaraz loads third-party tags at the edge; there are none. Web Analytics is the beacon the Analytics Engine entry above explains. Workers for Platforms runs other people's Workers inside yours; I have one customer.

### Turnstile and Cache Reserve, not yet

Turnstile is Cloudflare's bot check without a puzzle; it goes in front of the newsletter form when the newsletter exists. Cache Reserve keeps static content in a persistent cache; it needs a zone, and this site is still served from a workers.dev hostname while the old WordPress install answers at the apex. Both wait for DNS cutover.

## Where the platform pushed back

Workers refuse to compile WebAssembly at runtime. A security decision, and it ruled out server-side social-card rendering and complicated the fix for the strangest bug of the build: a syntax highlighter that produced different bytes for the same input across runs. The deterministic engine and the loader arrangement that satisfies both Node and the Worker are in [the content pipeline article](/blog/content-is-code-building-the-blog).

D1's export fails on FTS5 tables, as above. The rate limiting binding does not count, as above. A Durable Object's async storage is not transactional, as above. Each of these is now a check script or a documented rule rather than a memory, which is the only form a platform lesson is worth keeping in.

## Who reads this site, and what Cloudflare is doing about it

This site treats AI agents as an audience in both directions. Inbound, every post serves a markdown twin at a predictable URL, an llms.txt file maps the site, the search endpoint answers in JSON to any client that asks, and the search engine is exposed over the Model Context Protocol. Outbound, the site is operated by agents: an authenticated publishing API whose rules are enforced server-side, an MCP layer over it, and the assistants that helped build this system draft and edit posts through it, including this one. One act is reserved for me by a policy they cannot alter. The trust model, the incident that shaped it, and the protocol server are in [the agent write access article](/blog/letting-an-agent-publish), [the API versus MCP article](/blog/one-door-two-doorbells), and [the MCP server article](/blog/the-doorbell-gets-built).

The economic half is happening at the CDN layer, which for a fifth of the web means it is happening at Cloudflare: managed robots.txt with machine-readable content signals, default blocking of AI training crawlers for new zones, and a pay-per-use marketplace for content that surfaces in AI answers. This site's own crawl settings get configured the day the DNS cutover lands, and that will be its own post once there is data in it.

## What I would use again

All fourteen. The primitives are small enough to hold in your head. The billing has never surprised me, which I value more than any feature. A one-person site now runs what would have been a small team's roadmap five years ago: a gated content pipeline where git is the source of truth, an edge-resident search engine, a hybrid AI answer layer with cost controls, external monitoring, restore drills, and a publishing path an agent can operate under enforced policy. Twenty-four products were considered and passed over for the reasons above, and every number here carries the date it was measured because every one of them will move.

The series, in reading order: [the color palette built and verified with code](/blog/a-color-palette-that-can-prove-itself), [the git-backed content pipeline](/blog/content-is-code-building-the-blog), [the reading experience in a couple of kilobytes of JavaScript](/blog/bells-and-whistles-zero-js), [FTS5 search on D1](/blog/site-search-fts5-rank-fusion), [the AI answer layer](/blog/ai-answer-layer-ask-mode), [API versus MCP](/blog/one-door-two-doorbells), [the agent trust model](/blog/letting-an-agent-publish), and [the MCP server build](/blog/the-doorbell-gets-built). Every quantitative claim in the series is reproducible from the site's repository.
