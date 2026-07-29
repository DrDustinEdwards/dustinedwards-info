---
title: "Site search in six milliseconds: two FTS5 indexes, rank fusion, and a bug found in production"
slug: site-search-fts5-rank-fusion
description: "Section-grained records, why tokenizers forced two indexes, reciprocal rank fusion over raw bm25, a flagship feature that returned zero for its own designed input, and what FTS5 does to your backups."
date: 2026-07-28
draft: true
tags: [cloudflare, d1, fts5, search, sqlite]
---

This site's search answers in single-digit milliseconds from a database at the edge, works with JavaScript disabled, returns JSON to anyone who asks with an Accept header, and was built by hand on SQLite's FTS5 rather than on a search service. This article is the design, the measurements that justified each choice, one bug that reached production, and one finding about backups that anyone running FTS5 on D1 needs to know.

## One record shape, section-grained

Everything searchable reduces to one record: id, url, type, title, body, date. The decision with the most leverage was granularity. A search that returns documents sends the reader to a page and wishes them luck; a search that returns sections sends them to the paragraph. Posts here already carry heading anchors, so the indexer emits one document record plus one record per heading, each section deep-linking to its anchor. On the day it shipped, the corpus was one post and seven records, which sounds like a toy until you notice the property that matters: the architecture is the same at seven records and at seven thousand, and section granularity is what made fusion, snippets, and ranking observable at all instead of correct-and-unexercised.

Dedup happens at query time: when a document and its own sections both match, the best section presents under the document's title, because one post must not fill a results page with itself.

## Why two indexes: tokenizers are table-level

The citable finding: FTS5 tokenizers are a property of the table, not the query, so a corpus needing both stemmed and unstemmed matching needs two tables. Prose wants stemming ("indexing" should match "index"); identity does not (a search for "edward" should not fuzzily match "Edwards", and "edwards" must match it exactly). The measurement that justified the split, run against production data: "enforcement" matches the identity index and "enforce" returns zero from it, while the porter-stemmed prose index matches both. One table cannot do that.

So there are two: `search_identity` (unicode61 with diacritic folding, no stemming, over titles and tags) and `search_prose` (porter, over bodies). Neither carries triggers; the derived `search_docs` table is rewritten wholesale and both indexes rebuilt, because the corpus is regenerated as a set, and per-row triggers are the right tool for the single-row editor path on the original posts table, not for bulk derivation.

## Fusion: never raw bm25

Two indexes produce two rankings, and merging them by raw bm25 score is wrong in a way that is easy to ship: bm25 scores are not comparable across tables with different tokenizers and different document lengths, and bm25 famously over-rewards very short rows, which section records are. The shipped merge is reciprocal rank fusion at k=60: each result contributes 1/(k+rank) from each list, scores are positional rather than absolute, and the constant damps the top-rank advantage. The gate `check:search` holds 48 assertions over the parser, the fusion, and dispatch, every rule with a paired negative, because ranking code without negative tests is folklore.

In front of the indexes sits a small query parser: a bare year becomes a date filter rather than the literal string, `tag:` and `type:` narrow, quoted phrases pass through. The year rule is the highest-value line in it, and the gate proves it by breaking it: planting `8080` as a non-year correctly fails three assertions.

## The bug that reached production

The citable failure: every filter-only query returned zero results on the live site. A bare year, a bare tag chip, a `?tag=` with no text: all empty. The parser was right the whole time; it turned the year into a date filter and left no text, so there was nothing to hand FTS5, and the search function short-circuited to empty. The architecture's highest-value rule returned nothing for its own designed input, and the rendered facet chips were standing invitations to run exactly the queries that failed.

The fix is structural, not a patch: a query carrying filters but no text takes a browse path, the same filter SQL over the derived table, ordered by date, document records only, since "what is tagged d1" is a listing question and returning seven sections of one post would be the self-filling results page again. The dispatch predicate lives in the pure query module so the gate can assert it, and the visibility predicate that hides drafts and future-dated posts was verified on the browse path by planting exactly that failure.

The general lesson costs one sentence: a search feature has two entry modes, locate and browse, and testing only the one with a text box ships half a feature.

## The interface, which is where search usually dies

The zero-JS baseline is a server-rendered GET form: deep-linkable URLs, labeled results, highlighted snippets, why-matched labels, facet chips as links, and a zero state that suggests nearest tags and recent posts instead of dead-ending. The same URL returns JSON under content negotiation with Vary: Accept, which makes the search itself an agent affordance documented in llms.txt.

The command palette on top is the ARIA combobox pattern implemented as specified: input keeps focus, aria-activedescendant tracks the highlighted row, arrows move the pointer rather than focus, focus is trapped while open and restored on close. Two implementation findings worth stealing: an input of type search swallows the first Escape natively to clear itself, so the palette would not close until that was handled, and a fetch resolving after close repainted the closed dialog, leaving aria-expanded true over stale options, which is the kind of state bug that only appears when you test the unhappy ordering. The palette is its own lazily loaded chunk, 6,060 bytes raw, 2,316 gzipped.

Measured on local D1 over 25 runs: p50 6 ms, p95 15 ms. The number is the argument for building on FTS5 at all: at personal-site scale, hand-built search on the database you already have is not a compromise, it is the fast path.

## What FTS5 does to your backups

The finding that outranks everything else here for anyone on D1: `wrangler d1 export` fails outright on databases containing FTS5 virtual tables, exiting with "cannot export databases with Virtual Tables (fts5)" and writing nothing. This was measured before the search migration was applied, precisely because the migration adds FTS tables. The working path is per-table export with `--no-schema --table`, never touching the FTS tables or their shadow tables, and it is now enforced by a gate, `check:backup`, that derives the expected table list from the migrations directory and fails in both directions; on its first run it found a real gap, an internal metadata table nobody had listed.

Two related habits earned their place the hard way. Verify FTS row counts by querying the docsize shadow table, never COUNT(*), because counting an external-content FTS5 table reads through to the content table and will happily report a fully populated index that matches nothing. And expect `check:backup` to be red by construction between a migration being committed and applied; that is the gate describing the pre-migration state, not a fault.

## Disclosures

The latency figures are local D1 measurements on a seven-record corpus; they establish the floor, not the curve, and will be remeasured as the corpus grows. The export failure is as of the cited wrangler version and is the kind of platform behavior that may be fixed after publication; the per-table gate stays regardless, because backups that depend on a bug staying fixed are not backups. And the two-index design is justified for a corpus wanting both stemmed and identity matching; a site with only prose could defensibly run one table, and nothing here argues otherwise.
