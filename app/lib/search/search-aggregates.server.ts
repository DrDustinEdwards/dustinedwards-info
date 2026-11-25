import { RRF_K, type fuse } from "@drdustinedwards/site-helpers/search";
import { SEARCH_BASES, baseOfUrl } from "~/kb/search-bases.mjs";
import type { RawRow, SearchExplain, SearchFacets, SearchHit } from "./search-types";

/** Each fused row's rank and RRF contribution in each layer, for `?explain`. */
export function explainFor(
  fused: ReturnType<typeof fuse<RawRow>>,
  identityRows: RawRow[],
  proseRows: RawRow[],
): SearchExplain {
  return {
    k: RRF_K,
    layers: ["search_identity", "search_prose"],
    identityCount: identityRows.length,
    proseCount: proseRows.length,
    rows: fused.map(({ item, score, sources, ranks, contributions }) => {
      const at = (list: number) => sources.indexOf(list);
      const i = at(0);
      const p = at(1);
      const rank = (n: number) => (n === -1 ? null : (ranks[n] ?? null));
      const contribution = (n: number) => (n === -1 ? null : (contributions[n] ?? null));
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
  };
}

/** Over the whole match set, not the page. If truncated, the caller must present these as a floor. */
export function buildFacets(hits: SearchHit[]): SearchFacets {
  const types = new Map<string, number>();
  const bases = new Map<string, number>();
  const tags = new Map<string, number>();
  const years = new Map<number, number>();

  for (const hit of hits) {
    types.set(hit.type, (types.get(hit.type) ?? 0) + 1);
    const base = baseOfUrl(hit.docUrl);
    if (base) bases.set(base, (bases.get(base) ?? 0) + 1);
    for (const tag of hit.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    if (hit.publishAt !== null) {
      const year = new Date(hit.publishAt * 1000).getUTCFullYear();
      years.set(year, (years.get(year) ?? 0) + 1);
    }
  }

  return {
    types: [...types].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    // In the bases' own order, not by count, so the list reads the same from one search to the next.
    bases: SEARCH_BASES.filter((b) => bases.has(b.id)).map((b) => ({
      value: b.id,
      label: b.label,
      count: bases.get(b.id) ?? 0,
    })),
    tags: [...tags].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
    years: [...years].map(([value, count]) => ({ value, count })).sort((a, b) => b.value - a.value),
  };
}
