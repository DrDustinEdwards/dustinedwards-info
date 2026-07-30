---
title: "Ten years on Cloudflare, so I rebuilt everything on it"
slug: ten-years-on-cloudflare
description: "A decade as a customer, one full rebuild as the proof: what the 2026 developer platform is actually like from inside a working system, with the numbers."
date: 2026-07-30
tags: [cloudflare, workers, d1, platform, architecture]
draft: false
first_published: 2026-07-30
---

Ten years ago I put my first domain behind Cloudflare and thought of it the way everyone did then: the orange cloud, the thing in front of your real host that absorbed abuse and cached your images. The real host was the point; Cloudflare was weather-proofing. This year I rebuilt my site so that there is no real host behind the cloud. The application, the database, the file storage, the search engine, the AI layer, and the publishing pipeline all run on Cloudflare's developer platform, and this post is the survey I wish I had read before starting: what the platform actually is in mid-2026, measured from inside a working system rather than summarized from a pricing page. Platform claims below were verified against Cloudflare's documentation and announcements as of July 30, 2026, and the dated ones say so, because a platform survey is the fastest-rotting genre on the technical internet.

This is also the first post in a series. Each section here has a full article behind it, with the failures kept in, because the failures are where the knowledge is.

## The shape of the thing

The platform's center is Workers: JavaScript and WebAssembly running in V8 isolates across Cloudflare's network, no servers, no regions to pick, cold starts measured in milliseconds. Around it sits a family of primitives: D1 for relational data (SQLite at the edge), R2 for object storage (S3-shaped, no egress fees), KV for key-value reads, Durable Objects for coordination and state, Workers AI for inference, and AI Search for retrieval-augmented answering. The pitch is that these compose into full applications. The honest question is what that composition costs, and the only way to answer it is to build something real and publish the numbers.

So the numbers, from this site's repository. The Worker serving every page of this site is a 3.78 MB server asset, of which the largest deliberate expense is a full markdown rendering pipeline including syntax highlighting, carried server-side so that every page works with JavaScript disabled. The blog's entire client-side enhancement budget is 1.59 kB of gzipped JavaScript. Site search answers from D1 in 6 milliseconds at the median, measured over 25 runs. The AI answer layer streams its first token in 2 to 6.5 seconds warm. A publish is one atomic git commit that lands in the database and both search indexes within seconds. None of those numbers required capacity planning, and the monthly bill for all of it rounds to pocket change, which is its own kind of architectural fact.

## What surprised me, in both directions

D1 is better than its reputation and stranger than its documentation. It is real SQLite, which means FTS5 full-text search comes free, and a hand-built search engine on it embarrasses the assumption that you need a search service: two FTS5 indexes with rank fusion, section-grained results, single-digit milliseconds. It also means SQLite's sharp edges come along. The one that matters operationally: the platform's own database export command fails outright on any database containing FTS5 virtual tables, which is exactly the database a search feature produces. The working backup path is per-table export, and this site enforces it with a check that derives the table list from the migrations. If you run FTS5 on D1, test your backup path today, not during a recovery.

Durable Objects deliver something subtle that took a failed test to appreciate: a single-threaded object is not automatically a correct counter. A read and a write spanning an await are not atomic, and my first rate limiter admitted eight requests through a ceiling of three. The synchronous SQLite storage API is the fix and the reason it exists. The general lesson generalizes well beyond Cloudflare: single-threaded is not transactional.

Workers refuse runtime WebAssembly compilation, a security posture with real consequences: libraries that compile WASM on the fly need static instantiation instead, which cost this site 0.44 MB to make its syntax highlighter deterministic, and ruled out server-side social-card rendering entirely, which moved to build time. The platform's constraints are legible once measured, but they are constraints, and a survey that omits them is marketing.

AI Search, the retrieval product, is genuinely useful and genuinely beta. It gave this site a cited, streaming answer layer over its own content in a day, with hybrid retrieval and reranking that measurably found results classic keyword search missed, while classic search found results it missed, three to two on a shared query set, which is the empirical case for running both. It is also a moving product with beta pricing, so this site's answer layer sits behind three cost gates and a standing note to re-verify the economics when pricing lands. Enthusiasm and exposure limits are not in tension; they are the same discipline.

## The part nobody had a name for two years ago

The most interesting platform shift of this rebuild had nothing to do with hosting. It is that the web now has two audiences, humans and AI agents, and Cloudflare has positioned itself at exactly that boundary, in both directions.

Inbound, this site treats agents as first-class readers: every post serves a markdown twin, search returns JSON to anyone who negotiates for it, llms.txt maps the site, and the search engine itself is exposed over the Model Context Protocol so an assistant can query it conversationally. Outbound, this site is operated by an agent: an authenticated publishing API with one human-reserved act, wrapped in an MCP server, through which the AI that helped build this site drafts and stages these very articles. The trust model that makes that sane gets two full articles later in the series.

And economically, the boundary is where the money question now lives. Cloudflare announced on July 1, 2026 that starting September 15, its defaults will block AI training and agent crawlers on ad-supported pages for new customers, new sites, and free-tier accounts, while search crawlers stay allowed, and its Pay Per Crawl marketplace is evolving into Pay Per Use, which pays publishers when content actually surfaces in an AI answer rather than merely when it is fetched. The company's stated motivation includes a blunt measurement: by mid-2026, the majority of traffic is non-human, and more than half of AI crawl traffic re-fetches pages that have not changed. Whatever one thinks of the specific mechanics, the direction is unambiguous: the open web is renegotiating its terms with the machines that read it, and the negotiation is happening at the CDN layer, which is to say, here. This site's own crawl policy decision is queued for the day its DNS lands on the new stack, and it will get its own article, with numbers, when there are numbers.

## What a decade of customer loyalty bought, honestly

The rebuild was not friction-free, and the series keeps the receipts: a nondeterministic syntax highlighter that fought the content pipeline, a deploy command that silently ships stale builds if invoked wrong, an export that breaks on the feature you just shipped, propagation windows that impersonate failed deploys, and a platform rate-limiting binding that is documented as eventually consistent and measured as not a counter. None of that is disqualifying; all of it is the difference between a platform as pitched and a platform as operated, and the second one is the only one worth writing about.

What the decade actually bought is simpler than loyalty: familiarity compounding into leverage. The primitives are small enough to hold in your head, the pricing is boring in the best way, and the distance from idea to deployed-worldwide is a single command. A one-person site now runs an architecture, gated content pipeline, edge database, hybrid search, AI answering, agent-operable publishing, that would have been a team's roadmap five years ago, and the platform is why.

## The series

What follows, in order: a color palette built like an engineering artifact, with proofs. The content pipeline where git remembers and the database serves. The reading experience under a zero-JavaScript law. Classic search in six milliseconds. The AI answer layer that has to earn its keep. What an API is, what MCP is, and why policy lives in only one of them. Letting an agent publish, and the one thing it may not do. And the MCP server that contains no policy, built the week the protocol went stable.

Every quantitative claim in the series is reproducible from the site's repository. That is not a flourish; it is the editorial policy, and it is the reason the series took longer to write than the system took to build.
