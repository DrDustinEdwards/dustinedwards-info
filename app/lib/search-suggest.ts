import type { Suggest } from "capsomer/behavior/site-header";

type Hit = { url: string; type: string; title: string; documentTitle: string | null };

/** The header's live search: the site's own /search, asked for JSON, as Capsomer's matches. */
export const suggest: Suggest = async (query, signal) => {
  const response = await fetch(`/search?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) return [];
  const { results = [] } = (await response.json()) as { results?: Hit[] };
  return results.map((hit) => ({
    url: hit.url.replace(/^https?:\/\/[^/]+/, ""),
    title: hit.title,
    kind: hit.type,
    detail: hit.documentTitle && hit.documentTitle !== hit.title ? hit.documentTitle : undefined,
  }));
};
