---
title: "SQLite FTS5 Search on Cloudflare D1: 6 ms with Rank Fusion"
slug: site-search-fts5-rank-fusion
description: "How to build site search on Cloudflare D1 with SQLite FTS5: two indexes for stemmed and exact matching, reciprocal rank fusion in place of raw bm25, section-level records, a browse path for filter-only queries, and the D1 export problem every FTS5 user has."
date: 2026-07-28
tags: [cloudflare, d1, fts5, search, sqlite]
draft: false
first_published: 2026-07-30
---

This article describes how to build full-text site search directly on Cloudflare D1 using SQLite's [FTS5 extension](https://sqlite.org/fts5.html), with no external search service. The implementation this describes runs in production on this site and answers queries in 6 milliseconds at the median, 15 at the 95th percentile, measured over 25 runs against local D1. The article covers the schema, the reason one index is not enough, the ranking method, the query dispatch that a naive design gets wrong, the interface work, and one operational finding about backups that I consider mandatory knowledge for anyone putting FTS5 on D1.

Prerequisites: a D1 database, familiarity with SQL and SQLite migrations, and content you can decompose into records. The design generalizes to any corpus; the examples are a blog whose content pipeline is described in [the previous article in this series](/blog/content-is-code-building-the-blog).

## Step 1: one record shape, at section granularity

Reduce everything searchable to a single record shape. Mine is: id, url, type, title, body, date. The consequential decision is granularity. A search that indexes whole documents sends the reader to a page and leaves the finding to them; a search that indexes sections sends them to the paragraph. If your content has heading anchors, emit one record per document plus one record per heading, each section record carrying a URL that deep-links to its anchor.

Two practical notes on granularity. First, it is what makes ranking observable during development: with document-level records and a small corpus, almost any query returns almost everything, and you cannot tell whether your ranking works. Section records give the ranker real decisions to make from the first day. Second, it requires query-time deduplication: when a document and its own sections both match, present the best section under the document's title, because one document should not fill a results page with itself.

## Step 2: two indexes, because tokenizers are table-level

Here is the FTS5 fact that determines the schema, and it surprised me: the tokenizer is a property of the table, not of the query. You cannot ask one index for stemmed matching on some queries and exact matching on others. A corpus that needs both, and most do, needs two tables.

The need for both is easy to demonstrate on real data. Prose wants stemming: a search for "indexing" should match a sentence containing "index." Names and identifiers want the opposite: a search for "edwards" must match "Edwards" exactly, and a search for a partial name should not fuzzily match through a stemmer. On my production corpus, the term "enforcement" matched the exact-token index while its stem "enforce" returned zero rows from it, and the Porter-stemmed index matched both forms. One table cannot produce both behaviors.

The schema, as migration SQL:

```sql
CREATE VIRTUAL TABLE search_identity USING fts5(
  title, tags,
  content='search_docs', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE VIRTUAL TABLE search_prose USING fts5(
  title, body,
  content='search_docs', content_rowid='rowid',
  tokenize='porter unicode61'
);
```

Both are external-content tables over one `search_docs` source table, so the text is stored once. On rebuilds, I rewrite `search_docs` wholesale and rebuild both indexes with the FTS5 `rebuild` command, because my corpus is regenerated as a set; per-row triggers are the right tool only for a path that edits single rows.

## Step 3: merge with reciprocal rank fusion, not raw bm25

Two indexes produce two ranked lists, and the tempting merge, interleaving by raw bm25 score, is wrong in a way that ships quietly. Bm25 scores are not comparable across tables with different tokenizers and different average document lengths, and bm25 systematically over-rewards very short rows, which section records are. You will not notice in testing; you will notice when a two-line section outranks the document that answers the query.

The standard remedy is reciprocal rank fusion, introduced by Cormack, Clarke, and Buettcher in 2009: ignore the scores entirely and combine by position. Each result contributes `1 / (k + rank)` from each list it appears in, summed. The constant k damps the advantage of top ranks; the original paper's value of 60 works well and I did not tune it. In TypeScript:

```ts
function fuse(lists: string[][], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, i) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return scores;
}
```

Positional fusion has a second benefit beyond correctness: it makes the merge testable with small fixtures, because the expected output depends only on orderings you construct, not on opaque score values.

## Step 4: dispatch on query shape, or ship half a feature

In front of the indexes, put a small parser: quoted phrases pass through, `tag:` and `type:` prefixes become filters, and a bare four-digit year becomes a date filter rather than a literal search term. That last rule is high-value and produced the one bug in this system that reached production, which I will describe as a warning because the design error is general.

Every filter-only query returned zero results on the live site. A bare year, a click on a tag chip, any query that was all filter and no text: empty. The parser was working correctly; it converted the year to a date filter and left the text empty, and the search function, having no text to hand FTS5, short-circuited to no results. The interface made it worse by rendering tag chips that were standing invitations to run exactly the queries that failed.

The structural fix is recognizing that search has two entry modes. A query with text is a locate operation and goes to the indexes. A query with filters and no text is a browse operation and goes to ordinary filtered SQL over the source table, ordered by date, returning document records only, since "show me everything tagged d1" is a listing question. Put the dispatch predicate in a pure function so it can be unit-tested, and test the browse path's visibility rules (drafts and future-dated content excluded) as deliberately as the search path's. The general statement: if you test only the entry mode with a text box, you have shipped half a feature.

## Step 5: the interface, where site search usually dies

The baseline is a server-rendered GET form: deep-linkable result URLs, highlighted snippets from FTS5's snippet function, visible labels for why a result matched, facet chips as plain links, and a zero-results state that suggests nearest tags and recent posts instead of dead-ending. Because it is a GET endpoint, adding `Vary: Accept` and returning JSON under content negotiation makes the same URL a machine-readable API at no extra cost, which matters more each year as AI agents become a real audience.

A command palette can layer on top. If you build one, implement the ARIA combobox pattern as specified rather than approximately: focus stays in the input, `aria-activedescendant` tracks the highlighted option, arrow keys move the highlight rather than focus. Two implementation findings from doing this that will save you time. An input with `type="search"` swallows the first Escape keypress natively to clear its own value, so your close handler fires on the second press unless you account for it. And an in-flight fetch that resolves after the palette closes will repaint a closed dialog, leaving `aria-expanded="true"` over stale options; cancel or discard responses that arrive after close. Both bugs only appear when you test the unhappy orderings, which is the reason to test the unhappy orderings.

## wrangler d1 export fails on FTS5: the working backup procedure

The most important operational finding in this article: `wrangler d1 export` fails outright on any database containing FTS5 virtual tables. It exits with the error `D1 Export error: cannot export databases with Virtual Tables (fts5)` and writes nothing. This means the moment you apply the search migration, the platform's default backup path stops working for your database, and the natural time to discover that is during a recovery, which is the worst time. I measured it before applying the migration, on purpose, and I would recommend the same order to anyone.

The working procedure is per-table export, with schema coming from your migration files rather than the dump:

```bash
npx wrangler d1 export mydb --remote --no-schema \
  --table posts --output export-posts.sql
```

Export each real table this way and never the FTS tables or their `_config`, `_data`, `_docsize`, and `_idx` shadow tables; a restore is migrations first, then per-table data. Then encode the table list in a check script that derives it from your migrations directory and fails when the two disagree in either direction, because a backup procedure that exists only in memory is not a procedure. Mine found a real omission on its first run.

Two adjacent facts from the same investigation, both counterintuitive. Verifying an external-content FTS5 index with `COUNT(*)` cannot detect corruption or emptiness, because the count reads through to the content table and reports its row count regardless of index state; count the `_docsize` shadow table instead. And running `DELETE FROM` directly against an FTS5 table corrupts the index in a way that surfaces only on a later write, with the repair being the FTS5 `rebuild` command. Neither behavior is a D1 defect; both are documented SQLite semantics that become sharp when the database is remote and the tooling is young.

## Results and limitations

On this hardware and corpus: median 6 ms, 95th percentile 15 ms, over 25 runs against local D1, with the production numbers in the same range. The latency figures establish a floor rather than a curve; the corpus was small when measured, and I will re-measure as it grows. The two-index design is justified by a corpus that needs both stemmed and identity matching; a site with only prose could defensibly run one Porter-stemmed table and skip the fusion. The export failure is as measured on the wrangler version current at writing and may be fixed later; the per-table procedure and its check remain worthwhile regardless, because a backup that depends on a bug staying fixed is not a backup. And the general claim I would defend beyond this stack: at personal-site scale and probably well past it, hand-built search on the relational database you already operate is not the compromise option. Measured against the alternative of introducing and paying for a search service, it was the fast path in both senses.

This is the fifth post in [the series](/blog/ten-years-on-cloudflare), following [the reading experience article](/blog/bells-and-whistles-zero-js); the next one adds [the layer above this one](/blog/ai-answer-layer-ask-mode): a retrieval-augmented answer mode, and the cost controls a public AI endpoint requires.
