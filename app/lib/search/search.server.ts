/**
 * Site search over the two fts5 indexes.
 *
 * Runs the identity index and the prose index as two separate ranked lists and
 * fuses them by reciprocal rank. Raw D1 rather than drizzle, because bm25(),
 * snippet() and MATCH have no drizzle surface and hand-written SQL is what the
 * editor's publish path already uses.
 *
 * NOTHING HERE AWAITS A THIRD PARTY. Classic search is D1 and only D1, so it
 * cannot be slowed or broken by the AI layer sitting above it.
 */

import {
  fuse,
  hasFilters,
  parseQuery,
  toMatchExpression,
} from "./query.mjs";

/** @see app/lib/search/query.mjs */
type ParsedQuery = ReturnType<typeof parseQuery>;

/**
 * How many rows each index contributes before fusion.
 *
 * Fusion needs enough of each list for rank to mean something, and facet counts
 * are computed over the fused set, so this also bounds facet accuracy. When a
 * result set is truncated the response says so rather than quietly presenting a
 * partial count as a total.
 */
const CANDIDATE_LIMIT = 100;

/** Column weights for the identity index: a title hit beats a tag hit. */
const IDENTITY_WEIGHTS = { title: 10.0, tags: 4.0 };

/**
 * Snippet markers.
 *
 * snippet() splices these into text it does not escape, so writing `<mark>`
 * directly would mean rendering unescaped content as HTML. Every indexed string
 * is ours, but "ours" includes a post that legitimately discusses `<script>` or
 * shows HTML in a code block, and that text reaches the index as prose. Control
 * characters cannot occur in the corpus, so the snippet is escaped first and
 * the markers are swapped for real tags afterwards.
 */
// Built at runtime so no control byte is ever written into this source file,
// where it would be invisible in a diff and unguessable in a grep.
const MARK_START = String.fromCharCode(1);
const MARK_END = String.fromCharCode(2);
/** The same two characters as SQL expressions, so no control byte is written
 * into a query string. */
const MARK_START_SQL = "char(1)";
const MARK_END_SQL = "char(2)";

/**
 * `filter` is not an index match. It is the label for a record returned by the
 * browse path, where the query carried filters but no text to match on.
 */
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
  /** Why this result is here, in the order title, tag, body. */
  why: MatchReason[];
  score: number;
}

export interface SearchFacets {
  types: Array<{ value: string; count: number }>;
  tags: Array<{ value: string; count: number }>;
  years: Array<{ value: number; count: number }>;
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
  /** Wall-clock milliseconds spent in D1. */
  tookMs: number;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapes first, then turns the control markers into real <mark> elements. */
function renderSnippet(raw: string): string {
  return escapeHtml(raw)
    .split(MARK_START)
    .join("<mark>")
    .split(MARK_END)
    .join("</mark>");
}

function parseTags(docTags: string): string[] {
  return docTags.split("|").filter(Boolean);
}

/** Cuts at a word boundary so the browse snippet does not end mid-word. */
function truncateWords(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

/**
 * The visibility predicate, and the SQL twin of publiclyVisible() in
 * app/db/index.ts. Both must stay in step: a scheduled post that is hidden on
 * the blog index and findable in search would be a leak.
 */
function visibilityClause(): string {
  return `d.status = 'published' AND (d.publish_at IS NULL OR d.publish_at <= ?)`;
}

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
 * The browse path: filters with nothing to match on.
 *
 * `tag:cloudflare`, a bare `2026`, and a facet chip clicked from an empty box
 * all parse correctly into filters and leave no text behind, so there is no
 * MATCH expression to give fts5. Routing those to the index returns nothing,
 * which makes the parser's best rule look like a bug to the one reader who used
 * it. The filters are already SQL, so this runs them directly over search_docs.
 *
 * DOCUMENT RECORDS ONLY. Section records exist so that a text query can land on
 * the heading that answers it; a filter has no such heading in mind, and
 * returning all seven records of one post as seven results for `2026` would
 * present the corpus as seven times its real size.
 *
 * Ordered by date, because with no relevance signal recency is the only
 * defensible ordering, and a bare year or tag reads as browsing rather than
 * searching.
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

/**
 * Works out why a record matched, for the label shown on the result.
 *
 * Computed in app code from the parsed terms rather than asked of fts5, which
 * reports that a row matched but not which column carried it. Cheap, and it is
 * the same question a reader is asking when they wonder why a result is there.
 */
function whyMatched(row: RawRow, parsed: ParsedQuery, inProse: boolean): MatchReason[] {
  const needles = [...parsed.terms, ...parsed.phrases].map((t) => t.toLowerCase());
  const why: MatchReason[] = [];
  const title = row.title.toLowerCase();
  const tags = row.doc_tags.toLowerCase();

  if (needles.some((n) => title.includes(n))) why.push("title");
  if (needles.some((n) => tags.includes(n))) why.push("tag");
  if (inProse) why.push("body");
  // A record can be fused in from the identity index on a stemmed or diacritic
  // folded match that plain substring testing does not see. Saying nothing is
  // worse than saying where it came from.
  if (why.length === 0) why.push(inProse ? "body" : "title");
  return why;
}

export interface SearchOptions {
  q: string;
  type?: string | null;
  tag?: string | null;
  year?: string | null;
  page?: number;
  pageSize?: number;
  /** Prefix-match the last term. Used by the palette while typing. */
  prefix?: boolean;
  now?: Date;
}

export async function search(env: Env, options: SearchOptions): Promise<SearchResult> {
  const pageSize = options.pageSize ?? 10;
  const page = Math.max(1, options.page ?? 1);
  const now = options.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);

  // Parameters and operators are merged into one parse, so ?tag=d1 and a typed
  // `tag:d1` are the same thing downstream and the facet links can be plain
  // hrefs rather than a second filter language.
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
  // Nothing to match AND nothing to filter by is a genuinely empty query.
  if (!match && !hasFilters(parsed)) return empty;

  const filters = buildFilters(parsed, nowSeconds);
  const started = Date.now();

  if (!match) {
    const rows = await runBrowse(env.DB, filters);
    const browseTook = Date.now() - started;
    const browseHits: SearchHit[] = rows.map((item, index) => ({
      uid: item.uid,
      url: item.url,
      type: item.type,
      title: item.title,
      docTitle: item.doc_title,
      docUrl: item.doc_url,
      anchor: item.anchor,
      tags: parseTags(item.doc_tags),
      publishAt: item.publish_at,
      // No MATCH ran, so there is nothing to highlight. The snippet is the head
      // of the body, escaped, with no <mark> in it. Marking anything here would
      // claim a match that was never made.
      snippet: renderSnippet(truncateWords(item.snippet, 200)),
      why: ["filter"],
      // Rank is the date order this came back in, not a relevance score.
      score: rows.length - index,
    }));
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

  // Both indexes are queried concurrently. They are independent reads and
  // waiting for one before starting the other would double the latency of the
  // only part of search that touches the database.
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

  const hits: SearchHit[] = fused.map(({ item, score }) => ({
    uid: item.uid,
    url: item.url,
    type: item.type,
    title: item.title,
    docTitle: item.doc_title,
    docUrl: item.doc_url,
    anchor: item.anchor,
    tags: parseTags(item.doc_tags),
    publishAt: item.publish_at,
    // Prefer the prose snippet: it is the one with sentences in it. The identity
    // snippet is a title, which the result already shows on its own line.
    snippet: renderSnippet(
      (proseUids.has(item.uid)
        ? proseRows.find((r) => r.uid === item.uid)?.snippet
        : item.snippet) ?? item.snippet,
    ),
    why: whyMatched(item, parsed, proseUids.has(item.uid)),
    score,
  }));

  return {
    parsed,
    hits: hits.slice((page - 1) * pageSize, page * pageSize),
    total: hits.length,
    page,
    pageSize,
    facets: buildFacets(hits),
    truncated,
    tookMs,
  };
}

/**
 * Facet counts over the whole match set, not the current page.
 *
 * A count that only ever promises what a click would actually return. Computed
 * in app code over the fused set rather than as extra aggregate queries,
 * because the fused set is already in memory and a personal site's match sets
 * are small. If `truncated` is true the caller must present these as a floor.
 */
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

/**
 * What to offer when a query returns nothing.
 *
 * A zero state that only says "no results" is a dead end. These are the two
 * cheapest useful things the database can offer: tags that look like what was
 * typed, and the most recent posts.
 */
export async function zeroState(env: Env, parsed: ParsedQuery, now = new Date()) {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const needles = [...parsed.terms, ...parsed.phrases].map((t) => t.toLowerCase());

  const tagRows = await env.DB.prepare(
    `SELECT DISTINCT doc_tags FROM search_docs
     WHERE doc_tags <> '' AND status = 'published'
       AND (publish_at IS NULL OR publish_at <= ?)`,
  )
    .bind(nowSeconds)
    .all<{ doc_tags: string }>();

  const allTags = new Set<string>();
  for (const row of tagRows.results ?? []) {
    for (const tag of parseTags(row.doc_tags)) allTags.add(tag);
  }

  // "Nearest" is a shared-prefix or substring test, deliberately not a fuzzy
  // distance. On a corpus with a handful of tags, edit distance would surface
  // confident nonsense; a substring match either finds something honest or
  // finds nothing and says so.
  const nearest = [...allTags]
    .filter((tag) => needles.some((n) => n.length >= 2 && (tag.includes(n) || n.includes(tag))))
    .sort()
    .slice(0, 6);

  const recent = await env.DB.prepare(
    `SELECT uid, url, title, publish_at FROM search_docs
     WHERE anchor IS NULL AND type = 'post' AND status = 'published'
       AND (publish_at IS NULL OR publish_at <= ?)
     ORDER BY publish_at DESC LIMIT 5`,
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
