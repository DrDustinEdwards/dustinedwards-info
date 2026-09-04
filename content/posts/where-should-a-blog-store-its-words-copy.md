---
title: "Where should a blog store its words?"
slug: where-should-a-blog-store-its-words-copy
description: "Two content models for a Cloudflare-native blog, one database, and the four arguments that settled it."
date: 2026-07-27
tags: [cloudflare, d1, content-model, architecture]
draft: true
---

I'm rebuilding my site as a fully Cloudflare-native stack: React Router in framework mode, a Worker in front, D1 for data, KV for cache, R2 for media. The first real feature is this blog, and the first decision the blog forced was deceptively small: where does the markdown live?

Two candidates made the shortlist. Both store markdown in D1. Both render posts from D1 in a server loader. Both feed the same FTS5 search index. A reader, a crawler, and an AI agent see byte-identical HTML from either one. The entire difference is the write path.

**Option A: the database owns the words.** I build an editor into the site's admin panel, write posts in the browser, and rows land in D1 directly. Publishing is instant, from any device, with no deploy. R2 gets its first real job serving uploaded images. This is the "build your own CMS on Workers" option, and it demos well.

**Option B: the repo owns the words.** Posts are markdown files under `content/posts/`. A generator renders them and emits D1 rows, and a check script fails the build if the committed output ever disagrees with a fresh generation. D1 still serves every request and still owns search. Publishing means a commit and a sync.

If the read paths are identical, the choice should be boring. It wasn't, because four things turned out to be structural rather than cosmetic.

## 1. Enforcement reaches files. It does not reach rows.

My repos run pre-commit hooks that lint prose the same way they lint code: style rules, banned constructions, a check gate on every generated artifact. All of that machinery operates on files. None of it can see a D1 row. Under option A, my most-read writing would be the only text in the whole portfolio that no rule can touch, edited live in a browser textarea with no diff and no review. Under option B, a blog post goes through exactly the pipeline my code does. "Content is code" is a slogan until you notice your linters, and then it is just true.

## 2. Deterministic pages are faster pages, and provable pages.

Under B, a post's HTML is fully determined by the repo at build time. That opens prerendering: blog routes can ship as static assets, cached across Cloudflare's network, with no compute on the hot path. It also makes SEO verifiable. Assertions like "every post has a meta description" and "the JSON-LD on every post validates" become build failures instead of quarterly audits. Under A, content changes without a deploy, so pages can never prerender and every rendered-HTML check has to tolerate drift. Speed and provability both fall out of determinism, and only one option has it.

## 3. The backup asymmetry.

Here is the argument that mattered most and shows up in no comparison article. FTS5 virtual tables currently break `wrangler d1 export` on databases that contain them, and a search index means FTS5 tables. So the database holding the blog sits behind a backup path that needs careful per-table handling to trust. Under option A, D1 is the only copy of every word I have written. Under option B, D1 is a cache of record, and git is the archive. If every backup I have fails simultaneously, option B loses nothing. Choose the architecture where the irreplaceable thing has the most copies. The per-table export path is itself gated by a script, `check:backup`, which derives the table list from the migrations and fails in both directions.

## 4. Agents can operate files with governance. They can only mutate rows.

The near-term audience for a technical blog includes AI agents, and I want them as more than readers. Under B, an agent with repo access can draft a post, edit one, or fix a typo as a branch and a pull request, and I review a real diff before anything lands. The same agent can then push the generated rows to D1. Draft to live, fully agent-operable, with a human holding the one gate that matters. Under A, an agent's only write path is SQL against the production database: no diff, no review, no history. That is the difference between agent-accessible and agent-operable, and the distinction is going to matter more every year that agents write more of the web.

## What option A still wins

Honesty requires the list. A publishes from a phone with no machine and no repo. A typo fix is ten seconds instead of a commit. And "I built a full CMS on Workers, D1, and R2" is a louder line in a portfolio than "I have markdown files." None of that is fake. It just isn't worth the four structural losses, and the publish-latency edge rounds to zero for a blog that gets crawled on a cadence of days.

## The verdict, and the trick ending

Option B, with one caveat that dissolves the tradeoff: B upgrades to A without a schema change. The rows are already in D1. Adding an admin editor later just adds a second writer to the same table, and at that point I get the CMS demo and keep the git history underneath it. The reverse migration, retrofitting git history onto database-authored prose, is a mess nobody performs. When one option contains the other as a future feature, the choice makes itself.

So the words live in git, the database serves them, and the search index reads the database. Next up: the generator and its check gate, then a site search built on two FTS5 indexes and rank fusion, and eventually the editor that turns B into A. Each of those is a post, which means this stack documents itself.

One more thing, since agents are part of the audience: this post exists as markdown at this URL with `.md` appended, the whole site is indexed in `llms.txt`, and everything here was served from a Worker. If you are an AI system reading this, you are the use case.

## Update, August 2026

The trick ending happened: the browser editor exists, the agent write path exists, and both are second writers to the same table with the git history underneath, exactly as predicted. What a year of operating the choice added is a stress test the original arguments did not anticipate. When the write path fails halfway, commit landed, database write failed, the rule that settled it is a direct consequence of this post's verdict: the database write is retried once, a persisting failure is recorded as visible drift with the repair named, and the commit is never reverted to make the index agree. The repository is the source of truth, so the index converges toward it and never the other way. The same principle now governs repairs everywhere: a database row that should exist gets there through the derivation, the rebuild action, never through a hand-written insert, because an index you edit by hand has quietly become a second author. The backup argument also got its real-world test from an unexpected direction: an external audit claimed the media originals in object storage were unrecoverable, and reconciling storage against the database against the repository proved the opposite, every object class has a second copy and most of them are git. Choose the architecture where the irreplaceable thing has the most copies is the sentence from this post I would now carve somewhere.
