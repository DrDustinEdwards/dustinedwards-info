/** The posts list's filter parameters: read by its loader, written by its links and its form. */
export const FILTER_KEYS = { q: "q", status: "status", tag: "tag" } as const;

/** `status` is validated, so `?status=banana` degrades to no filter rather than an empty-looking corpus. */
export function readFilters(params: URLSearchParams) {
  const status = (params.get(FILTER_KEYS.status) ?? "").trim();
  return {
    q: (params.get(FILTER_KEYS.q) ?? "").trim(),
    status: status === "published" || status === "scheduled" || status === "draft" ? status : "",
    tag: (params.get(FILTER_KEYS.tag) ?? "").trim(),
  };
}

/** The posts list under these filters, the unset ones left out. */
export function postsHref(filters: { q: string; status: string; tag: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set(FILTER_KEYS.q, filters.q);
  if (filters.status) params.set(FILTER_KEYS.status, filters.status);
  if (filters.tag) params.set(FILTER_KEYS.tag, filters.tag);
  const query = params.toString();
  return query ? `/admin/posts?${query}` : "/admin/posts";
}
