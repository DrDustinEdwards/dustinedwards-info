// Raw D1 rather than drizzle: bm25(), snippet() and MATCH have no drizzle surface. Nothing here
// awaits a third party, so the AI layer cannot slow or break classic search.

import {
  RRF_K,
  fuse,
  hasFilters,
  parseQuery,
  toMatchExpression,
} from "./query.mjs";
import { applySort, parseSort, type SearchSort } from "./sort.mjs";
import { PUBLISHED_STATUS } from "./visibility.mjs";
import { clampWords } from "~/lib/content/og-card-text.mjs";
import { escapeXml } from "~/lib/rss-feed.mjs";

type ParsedQuery = ReturnType<typeof parseQuery>;

/** Facet counts are computed over the fused set, so this bounds facet accuracy too. */
const CANDIDATE_LIMIT = 100;

const IDENTITY_WEIGHTS = { title: 10.0, tags: 4.0 };

/**
 * snippet() does not escape, so it splices control-character markers that the corpus cannot contain;
 * the snippet is escaped first and the markers become <mark> after. Built at runtime so no control
 * byte is ever written into this file.
 */
const MARK_START = String.fromCharCode(1);
const MARK_END = String.fromCharCode(2);
const MARK_START_SQL = "char(1)";
const MARK_END_SQL = "char(2)";

/** "filter" is not an index match: it labels a browse-path record, where there was no text to match. */
export type MatchReason = "title" | "tag" | "body" | "filter";

export interface SearchHit {
  uid: string;
  url: string;
  type: string;
  title: string;
  docTitle: string;
  docUrl: string;
  anchor: string | null;
  tags: string[];
  publishAt: number | null;
  /** Escaped HTML with <mark> around matched terms. Safe to render. */
  snippet: string;
  why: MatchReason[];
  score: number;
}

interface SearchFacets {
  types: Array<{ value: string; count: number }>;
  tags: Array<{ value: string; count: number }>;
  years: Array<{ value: number; count: number }>;
}

/** No score field: bm25 across differently tokenized indexes is not comparable, so it never leaves SQL. */
interface SearchExplainRow {
  uid: string;
  title: string;
  /** Records are section-grained, so a row's own title is often a bare heading. */
  docTitle: string;
  url: string;
  identityRank: number | null;
  proseRank: number | null;
  identityContribution: number | null;
  proseContribution: number | null;
  score: number;
}

export interface SearchExplain {
  k: number;
  layers: string[];
  identityCount: number;
  proseCount: number;
  rows: SearchExplainRow[];
}

export interface SearchResult {
  parsed: ParsedQuery;
  hits: SearchHit[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacets;
  /** True when a list hit CANDIDATE_LIMIT, so counts are a floor not a total. */
  truncated: boolean;
  tookMs: number;
  explain?: SearchExplain;
}

interface RawRow {
  uid: string;
  url: string;
  type: string;
  title: string;
  doc_title: string;
  doc_url: string;
  anchor: string | null;
  doc_tags: string;
  publish_at: number | null;
  snippet: string;
}

function renderSnippet(raw: string): string {
  return escapeXml(raw)
    .split(MARK_START)
    .join("<mark>")
    .split(MARK_END)
    .join("</mark>");
}

/** The pipe-delimited `doc_tags` column as a list. */
function splitDocTags(docTags: string): string[] {
  return docTags.split("|").filter(Boolean);
}

/** One index row as a result; the caller decides the snippet, the reasons and the rank. */
function toHit(row: RawRow, snippet: string, why: MatchReason[], score: number): SearchHit {
  return {
    uid: row.uid,
    url: row.url,
    type: row.type,
    title: row.title,
    docTitle: row.doc_title,
    docUrl: row.doc_url,
    anchor: row.anchor,
    tags: splitDocTags(row.doc_tags),
    publishAt: row.publish_at,
    snippet,
    why,
    score,
  };
}

/**
 * The SQL twin of publiclyVisible() in app/db/client.ts: they cannot be one function, so
 * test/visibility-invariants.test.mjs asserts they admit the same rows.
 */
export function visibilityClause(alias = "d"): string {
  const q = alias ? `${alias}.` : "";
  return `${q}status = '${PUBLISHED_STATUS}' AND (${q}publish_at IS NULL OR ${q}publish_at <= ?)`;
}

/** Named, not a bare "": an empty literal between SQL literals misleads the raw-SQL scans. DO NOT INLINE. */
const NO_ALIAS = "";

interface FilterSql {
  clause: string;
  params: unknown[];
}

function buildFilters(parsed: ParsedQuery, nowSeconds: number): FilterSql {
  const clauses: string[] = [visibilityClause()];
  const params: unknown[] = [nowSeconds];

  if (parsed.types.length > 0) {
    clauses.push(`d.type IN (${parsed.types.map(() => "?").join(", ")})`);
    params.push(...parsed.types);
  }

  // Every tag must be present, so tag:a tag:b narrows rather than widens.
  for (const tag of parsed.tags) {
    clauses.push(`instr(d.doc_tags, ?) > 0`);
    params.push(`|${tag}|`);
  }

  if (parsed.year !== null) {
    const start = Math.floor(Date.UTC(parsed.year, 0, 1) / 1000);
    const end = Math.floor(Date.UTC(parsed.year + 1, 0, 1) / 1000);
    clauses.push(`d.publish_at >= ? AND d.publish_at < ?`);
    params.push(start, end);
  }

  return { clause: clauses.join(" AND "), params };
}

async function runIndex(
  db: D1Database,
  table: "search_identity" | "search_prose",
  snippetColumn: number,
  order: string,
  match: string,
  filters: FilterSql,
): Promise<RawRow[]> {
  const sql = `
    SELECT d.uid, d.url, d.type, d.title, d.doc_title, d.doc_url, d.anchor,
           d.doc_tags, d.publish_at,
           snippet(${table}, ${snippetColumn}, ${MARK_START_SQL}, ${MARK_END_SQL}, '…', 14) AS snippet
    FROM ${table}
    JOIN search_docs d ON d.id = ${table}.rowid
    WHERE ${table} MATCH ?
      AND ${filters.clause}
    ORDER BY ${order}
    LIMIT ${CANDIDATE_LIMIT}
  `;
  const result = await db
    .prepare(sql)
    .bind(match, ...filters.params)
    .all<RawRow>();
  return result.results ?? [];
}

/**
 * Document records only: returning each section separately would present the corpus as a multiple of
 * its size. Date-ordered, since with no relevance signal recency is the only defensible order.
 */
async function runBrowse(db: D1Database, filters: FilterSql): Promise<RawRow[]> {
  const sql = `
    SELECT d.uid, d.url, d.type, d.title, d.doc_title, d.doc_url, d.anchor,
           d.doc_tags, d.publish_at,
           substr(d.body, 1, 240) AS snippet
    FROM search_docs d
    WHERE d.anchor IS NULL
      AND ${filters.clause}
    ORDER BY d.publish_at DESC, d.id DESC
    LIMIT ${CANDIDATE_LIMIT}
  `;
  const result = await db.prepare(sql).bind(...filters.params).all<RawRow>();
  return result.results ?? [];
}

/** Computed in app code: fts5 reports that a row matched, not which column carried it. */
function whyMatched(row: RawRow, parsed: ParsedQuery, inProse: boolean): MatchReason[] {
  const needles = [...parsed.terms, ...parsed.phrases].map((t) => t.toLowerCase());
  const why: MatchReason[] = [];
  const title = row.title.toLowerCase();
  const tags = row.doc_tags.toLowerCase();

  if (needles.some((n) => title.includes(n))) why.push("title");
  if (needles.some((n) => tags.includes(n))) why.push("tag");
  if (inProse) why.push("body");
  // An identity-index match can be stemmed or diacritic-folded, which substring testing does not see.
  if (why.length === 0) why.push(inProse ? "body" : "title");
  return why;
}

interface SearchOptions {
  q: string;
  type?: string | null;
  tag?: string | null;
  year?: string | null;
  page?: number;
  pageSize?: number;
  prefix?: boolean;
  now?: Date;
  /** Read off what fuse() recorded, so the playground demo and real search cannot disagree. */
  explain?: boolean;
  /**
   * Re-sorts the FUSED list, never the SQL: sorting in SQL would change the candidate set per sort, so
   * pages would disagree. The browse path ignores it.
   */
  sort?: SearchSort;
}

export async function search(env: Env, options: SearchOptions): Promise<SearchResult> {
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const sort: SearchSort = options.sort ?? "relevance";
  const now = options.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);

  // ?tag=d1 and a typed tag:d1 merge into one parse, so facet links can be plain hrefs.
  const parsed = parseQuery(options.q ?? "");
  if (options.type) parsed.types.push(options.type.toLowerCase());
  if (options.tag) parsed.tags.push(options.tag.toLowerCase());
  if (options.year && /^\d{4}$/.test(options.year)) parsed.year = Number(options.year);

  const empty: SearchResult = {
    parsed,
    hits: [],
    total: 0,
    page,
    pageSize,
    facets: { types: [], tags: [], years: [] },
    truncated: false,
    tookMs: 0,
  };

  const match = toMatchExpression(parsed, options.prefix ?? false);
  if (!match && !hasFilters(parsed)) return empty;

  const filters = buildFilters(parsed, nowSeconds);
  const started = Date.now();

  if (!match) {
    const rows = await runBrowse(env.DB, filters);
    const browseTook = Date.now() - started;
    const browseHits: SearchHit[] = rows.map((item, index) =>
      // Rank is the date order this came back in, not a relevance score.
      toHit(item, renderSnippet(clampWords(item.snippet, 200)), ["filter"], rows.length - index),
    );
    return {
      parsed,
      hits: browseHits.slice((page - 1) * pageSize, page * pageSize),
      total: browseHits.length,
      page,
      pageSize,
      facets: buildFacets(browseHits),
      truncated: rows.length >= CANDIDATE_LIMIT,
      tookMs: browseTook,
    };
  }

  const [identityRows, proseRows] = await Promise.all([
    runIndex(
      env.DB,
      "search_identity",
      0,
      `bm25(search_identity, ${IDENTITY_WEIGHTS.title}, ${IDENTITY_WEIGHTS.tags}) ASC`,
      match,
      filters,
    ),
    runIndex(env.DB, "search_prose", 0, `bm25(search_prose) ASC`, match, filters),
  ]);

  const tookMs = Date.now() - started;
  const truncated =
    identityRows.length >= CANDIDATE_LIMIT || proseRows.length >= CANDIDATE_LIMIT;

  const proseUids = new Set(proseRows.map((r) => r.uid));
  const fused = fuse<RawRow & { uid: string }>([identityRows, proseRows]);

  const fusedHits: SearchHit[] = fused.map(({ item, score }) =>
    toHit(
      item,
      // The prose snippet has sentences; the identity one is just the title, already shown.
      renderSnippet(
        (proseUids.has(item.uid)
          ? proseRows.find((r) => r.uid === item.uid)?.snippet
          : item.snippet) ?? item.snippet,
      ),
      whyMatched(item, parsed, proseUids.has(item.uid)),
      score,
    ),
  );

  const hits = applySort(fusedHits, sort);

  return {
    parsed,
    hits: hits.slice((page - 1) * pageSize, page * pageSize),
    total: hits.length,
    page,
    pageSize,
    facets: buildFacets(hits),
    truncated,
    tookMs,
    ...(options.explain
      ? {
          explain: {
            k: RRF_K,
            layers: ["search_identity", "search_prose"],
            identityCount: identityRows.length,
            proseCount: proseRows.length,
            rows: fused.map(({ item, score, sources, ranks, contributions }) => {
              const at = (list: number) => sources.indexOf(list);
              const i = at(0);
              const p = at(1);
              const rank = (n: number) => (n === -1 ? null : (ranks[n] ?? null));
              const contribution = (n: number) =>
                n === -1 ? null : (contributions[n] ?? null);
              return {
                uid: item.uid,
                title: item.title,
                docTitle: item.doc_title,
                url: item.url,
                identityRank: rank(i),
                proseRank: rank(p),
                identityContribution: contribution(i),
                proseContribution: contribution(p),
                score,
              };
            }),
          },
        }
      : {}),
  };
}

/** Over the whole match set, not the page. If truncated, the caller must present these as a floor. */
function buildFacets(hits: SearchHit[]): SearchFacets {
  const types = new Map<string, number>();
  const tags = new Map<string, number>();
  const years = new Map<number, number>();

  for (const hit of hits) {
    types.set(hit.type, (types.get(hit.type) ?? 0) + 1);
    for (const tag of hit.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    if (hit.publishAt !== null) {
      const year = new Date(hit.publishAt * 1000).getUTCFullYear();
      years.set(year, (years.get(year) ?? 0) + 1);
    }
  }

  return {
    types: [...types].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    tags: [...tags].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    years: [...years].map(([value, count]) => ({ value, count })).sort((a, b) => b.value - a.value),
  };
}

export async function askCorpusRecords(
  env: Env,
  now = new Date(),
): Promise<Array<{ url: string; title: string; body: string }>> {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const rows = await env.DB.prepare(
    // CONCATENATED, not interpolated, for the reason stated at NO_ALIAS.
    `SELECT url, title, body FROM search_docs WHERE type = 'post' AND ` +
      visibilityClause(NO_ALIAS),
  )
    .bind(nowSeconds)
    .all<{ url: string; title: string; body: string }>();
  return rows.results ?? [];
}

export async function askExpectedUrls(env: Env, now = new Date()): Promise<string[]> {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const rows = await env.DB.prepare(
    // Concatenated, not interpolated (see NO_ALIAS). Posts only: pages are never uploaded to Ask.
    `SELECT url FROM search_docs WHERE type = 'post' AND ` + visibilityClause(NO_ALIAS),
  )
    .bind(nowSeconds)
    .all<{ url: string }>();
  return (rows.results ?? []).map((r) => r.url);
}

export async function zeroState(env: Env, parsed: ParsedQuery, now = new Date()) {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const needles = [...parsed.terms, ...parsed.phrases].map((t) => t.toLowerCase());

  const tagRows = await env.DB.prepare(
    // Concatenated, not interpolated: a ${...} truncates the literal the raw-SQL scans can see.
    `SELECT DISTINCT doc_tags FROM search_docs WHERE doc_tags <> '' AND ` +
      visibilityClause(NO_ALIAS),
  )
    .bind(nowSeconds)
    .all<{ doc_tags: string }>();

  const allTags = new Set<string>();
  for (const row of tagRows.results ?? []) {
    for (const tag of splitDocTags(row.doc_tags)) allTags.add(tag);
  }

  // Prefix or substring, not edit distance: on a handful of tags, fuzzy matching surfaces confident nonsense.
  const nearest = [...allTags]
    .filter((tag) => needles.some((n) => n.length >= 2 && (tag.includes(n) || n.includes(tag))))
    .sort()
    .slice(0, 6);

  const recent = await env.DB.prepare(
    `SELECT uid, url, title, publish_at FROM search_docs ` +
      `WHERE anchor IS NULL AND type = 'post' AND ` +
      visibilityClause(NO_ALIAS) +
      ` ORDER BY publish_at DESC LIMIT 5`,
  )
    .bind(nowSeconds)
    .all<{ uid: string; url: string; title: string; publish_at: number | null }>();

  return {
    nearestTags: nearest,
    recentPosts: (recent.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      publishAt: r.publish_at,
    })),
  };
}

export { parseSort };
