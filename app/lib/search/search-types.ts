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
  /** Text with Capsomer's MARK_OPEN and MARK_CLOSE around each matched term; never markup (Snippet or snippetHtml draws it). */
  snippet: string;
  why: MatchReason[];
  score: number;
}

export interface SearchFacets {
  types: Array<{ value: string; count: number }>;
  /** The knowledge bases the hits belong to (app/kb/search-bases.mjs), each with its words. */
  bases: Array<{ value: string; label: string; count: number }>;
  tags: Array<{ value: string; count: number }>;
  years: Array<{ value: number; count: number }>;
}

/** No score field: bm25 across differently tokenized indexes is not comparable, so it never leaves SQL. */
export interface SearchExplainRow {
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

export interface RawRow {
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
