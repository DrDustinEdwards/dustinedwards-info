# Site search and Ask

Moved from Capsid (`dustinedwards/search-architecture.md`) on 2026-10-13 and trimmed to what still holds. The code is in `app/lib/search/`.

## The layers

- **Layer 0, `/search`.** Server rendered, a GET form that works without script, facet chips as links, counts from the same query that produced the list. `noindex, follow`, so it is absent from the sitemap.
- **Layer 1, JSON.** The same URL returns JSON on `Accept: application/json` with `Vary: Accept`. Negotiation runs in the route's middleware, never the loader: a document route's loader cannot return a raw Response.
- **Layer 1, palette.** A site-wide command palette (`app/enhance/palette.ts`) on native `<dialog>.showModal()`, opened from the header icon, `/` or Cmd-K. Without script the icon is a plain link to `/search`.
- **Layer 2, Ask.** A streamed AI answer with citations that deep-link to heading anchors, shown above the classic results and never blocking them. `search.server.ts` does not import `ask.server.ts`. The answer is written with `textContent`, never as HTML.

## Records

Records are section-grained: one post yields a document record plus one per heading, so a hit deep-links to the heading that answers it. Pages are indexed the same way; each paper is one record. Derivation is `app/lib/search/records.mjs`, and every writer calls it.

## Two indexes, fused by rank

FTS5 tokenizers are per table, and porter stemming is right for prose and wrong for names. So `search_identity` (`unicode61 remove_diacritics 2`, no stemming: title and tags) and `search_prose` (porter: body), both over a derived `search_docs`. Measured: in identity, `edward` does not match "Edwards"; in prose, `index` matches "indexing".

Fusion is reciprocal rank fusion at k=60 (`RRF_K` in `query.mjs`), never score-based, because BM25 scores from two tokenizers are not comparable. `search_docs` has no triggers: it is rewritten wholesale and both indexes rebuilt.

A query with filters but no text (a bare year, `tag:x`) takes the browse path: the same filter SQL, date ordered, document records only, snippet without `<mark>`. A bare four-digit year inside the corpus range becomes a date filter.

## D1 facts, measured

- `wrangler d1 export` fails on databases with FTS5 virtual tables. Backups are per table (`--no-schema --table`), never the FTS tables; `check:backup` derives the list from `drizzle/`.
- `COUNT(*)` on an external-content FTS5 table reads through to the content table and cannot show drift. Count the `*_docsize` tables.
- Never `DELETE FROM` an external-content FTS table (`SQLITE_CORRUPT_VTAB`). Repair with `('rebuild')`.
- No interactive transactions on D1; bulk loads are a generated SQL file applied with `wrangler d1 execute --file`.
- `snippet()` does not escape, so markers are Capsomer's control characters (`MARK_OPEN`, `MARK_CLOSE`); a hit's snippet stays that text, the page marks it with Capsomer's `Snippet` and the JSON answer with `snippetHtml`, which escapes every run.
- FTS5 synonyms need a C tokenizer, which D1 cannot load. Query-side expansion is the only route.

## Ask

An AI Search instance (`dustinedwards-ask`) whose data source is the site's own D1 (the D1 data source, beta since 2026-11-12: https://developers.cloudflare.com/ai-search/configuration/data-source/d1/). AI Search runs `ASK_INDEX_QUERY` (`app/lib/search/search.server.ts`) itself on each sync and indexes each returned row as one item: one row per published post section from `search_docs`, then each published paper's markdown twin from `publications.markdown`, in parts of 50,000 characters because a rendered row may take 64 KiB. Created hybrid with reranking; it fuses by RRF and stems with porter, like the classic layer. No credential is needed at runtime.

A row's id is its URL, and AI Search puts it on every chunk as `row_id`, so a citation is the row id (`ask-citations.mjs`, for both the client and the server's leak check): a post or a section cites itself, and every part of a paper (`<page>#part-2` and on) cites the paper's page. Ask holds posts and papers only. Never read `item.key`: a key is a sanitized prefix plus a hash for any id holding `/` or `#`.

The two layers fail on opposite inputs: single tokens naming a heading return no AI chunks under the 0.4 score threshold, and long questions return no classic rows under AND matching. Neither subsumes the other, which is why classic stays first.

### Guards

`/search/ask` is the only public endpoint that bills per request. POST only (GET is 405). Gates, cheapest first: foreign Origin refused; per-IP burst of 5 per 60 s; KV answer cache keyed by SHA-256 of the normalized question (7 days); a site-wide daily ceiling of 200 paced across the UTC day with a burst of 25; then the model. The ceiling sits after the cache, so a hit spends nothing. Refusals are 429 with `Retry-After`. `x-ask-cache: hit|miss` is on every response.

Counters are a Durable Object on the synchronous SQLite API (`ASK_BUDGET`, now the whole site's limiter through `app/lib/rate-limit.mjs` and site-runtime's `rate-limit`). Measured: the GA `ratelimit` binding let through far more than its limit, and an async-storage DO let 8 of 14 through a ceiling of 3; synchronous SQLite held at 3 of 14. Removing `durable_objects` disables Ask (503) rather than leaving it unprotected. Verify a limiter with a concurrent burst: a sequential loop can straddle the window and show zero refusals.

### Sync and the draft rule

AI Search reads the corpus itself: on each sync it indexes new rows, re-indexes changed ones, skips unchanged ones, and removes a row's item once the query no longer returns it (a draft, a post set back to draft, a rename, a delete). Nothing is uploaded or pruned by the site. A sync runs every 15 minutes on the instance's schedule, when a post or paper is saved, deleted or renamed (`askSyncAfterWrite`, which cannot fail the write), when the number of visible rows changes, which is a scheduled post going live (the per-minute `ask-index` cron job, `askIndexTick`), and on every deploy (`sync_ask`, which waits for the sync to end and reads the index back). A sync that was already running answers a request with itself and may have read D1 before the change, so one is asked for again when it ends. Cached answers are dropped when a sync the site asked for ends, since they were written against the index before it.

AI Search cannot filter by status at query time, so drafts are excluded by the query: its posts take the shared `visibilityClause` on the database's own clock (`unixepoch()`, since the query binds nothing). `check:ask-guards` reads that composition and `test/worker/visibility.test.ts` runs the query on a database holding a draft and a scheduled post. The query may not hold a semicolon, two hyphens, slash-star, `ORDER BY`, `LIMIT` or `replace()`, even in a literal. The tick sends a changed query to the instance, which starts a sync.

`ask-index-drift` on /health compares the rows the query returns with the items indexed (`stats().completed`) and fails on any row the index refused; a refused row is named in the AI Search job's logs.

## Machine endpoints

`llms.txt` is served from the D1 `settings` row with `content/llms.txt` as the source; edit the file, never the row.

## Palette traps

`<input type="search">` eats the first Escape; a fetch resolving after close must not repaint (sequence number); the dialog `close` event has been seen not to fire, so reset runs in `close()`; no module-level variable named `status`; `plainText` must keep intra-word underscores.

## Privacy

No IP, session or fingerprint. Zero-result queries are stored (`zero_result_queries`, 90 days) only after a filter refuses anything shaped like an address, a phone number or a name (CLAUDE.md).
