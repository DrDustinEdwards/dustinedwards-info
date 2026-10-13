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
- `snippet()` does not escape, so markers are control characters, the snippet is HTML-escaped, then markers become `<mark>`.
- FTS5 synonyms need a C tokenizer, which D1 cannot load. Query-side expansion is the only route.

## Ask

AI Search with built-in storage and uploaded markdown, not the crawler, so citations reach heading anchors and indexing is immediate. Created hybrid with reranking; it fuses by RRF and stems with porter, like the classic layer. No credential is needed at runtime.

`ask-keys.mjs` owns the key-to-URL mapping for both uploader and client: `writing/<slug>.md`, `writing/<slug>__<anchor>.md`, `research/publications/<slug>.md`. Ask holds posts and papers only. The separator is a double underscore, and an upload fails closed if a URL contains one.

The two layers fail on opposite inputs: single tokens naming a heading return no AI chunks under the 0.4 score threshold, and long questions return no classic rows under AND matching. Neither subsumes the other, which is why classic stays first.

### Guards

`/search/ask` is the only public endpoint that bills per request. POST only (GET is 405). Gates, cheapest first: foreign Origin refused; per-IP burst of 5 per 60 s; KV answer cache keyed by SHA-256 of the normalized question (7 days); a site-wide daily ceiling of 200 paced across the UTC day with a burst of 25; then the model. The ceiling sits after the cache, so a hit spends nothing. Refusals are 429 with `Retry-After`. `x-ask-cache: hit|miss` is on every response.

Counters are a Durable Object on the synchronous SQLite API (`ASK_BUDGET`, now the whole site's limiter through `app/lib/rate-limit.mjs` and site-runtime's `rate-limit`). Measured: the GA `ratelimit` binding let through far more than its limit, and an async-storage DO let 8 of 14 through a ceiling of 3; synchronous SQLite held at 3 of 14. Removing `durable_objects` disables Ask (503) rather than leaving it unprotected. Verify a limiter with a concurrent burst: a sequential loop can straddle the window and show zero refusals.

### Sync and the draft rule

Every save uploads that post's section records and drops cached answers; the sync cannot fail the save. Ship converges Ask last and the watchdog repairs drift, so direct commits do not leave Ask stale. AI Search cannot filter by status at query time, so drafts are excluded at upload: `publishableForAsk()` must agree with `publiclyVisible()`, and a draft actively removes anything it already has. `items.list()` is paged (max 50); `listAllAskItems()` is the only listing path. Test with a phrase unique to a draft.

## Machine endpoints

`llms.txt` is served from the D1 `settings` row with `content/llms.txt` as the source; edit the file, never the row.

## Palette traps

`<input type="search">` eats the first Escape; a fetch resolving after close must not repaint (sequence number); the dialog `close` event has been seen not to fire, so reset runs in `close()`; no module-level variable named `status`; `plainText` must keep intra-word underscores.

## Privacy

No IP, session or fingerprint. Zero-result queries are stored (`zero_result_queries`, 90 days) only after a filter refuses anything shaped like an address, a phone number or a name (ruling 4).
