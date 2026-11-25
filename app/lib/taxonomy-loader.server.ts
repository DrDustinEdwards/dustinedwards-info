import { data } from "react-router";
import { parsePage } from "capsomer/react/pagination";

import { redirectPastLastPage } from "~/components/taxonomy-listing";
import { nextScheduledPublishAt } from "~/db";
import { POSTS_PER_PAGE } from "~/lib/blog-listing.mjs";
import type { getEnv } from "~/lib/context";
import {
  EDGE_CACHE_HEADER,
  cacheTags,
  publicHtmlHeaders,
  scheduledEdgeCacheControl,
} from "~/lib/seo";

/**
 * A tag or series page's loader: the taxonomy item is resolved before its list, because an empty list cannot tell "no
 * such item" from "every post unpublished", and a missing item is a 404, not an empty page that would be a soft 404 and
 * leak a name only a draft carries.
 */
export async function loadTaxonomyListing<Item, Listing extends { pageCount: number }>(
  env: ReturnType<typeof getEnv>,
  request: Request,
  find: () => Promise<Item | null>,
  list: (item: Item, paging: { page: number; perPage: number }) => Promise<Listing>,
  pathOf: (item: Item) => string,
) {
  const page = parsePage(new URL(request.url).searchParams.get("page"));
  const item = await find();
  if (!item) throw data("Not found", { status: 404 });
  const [listing, nextPublishAt] = await Promise.all([
    list(item, { page, perPage: POSTS_PER_PAGE }),
    nextScheduledPublishAt(env),
  ]);
  redirectPastLastPage(page, listing.pageCount, pathOf(item));
  const init = {
    headers: { [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt) },
  };
  return { item, listing, init };
}

/** A taxonomy page's headers. Not `HTML_VARY_ACCEPT`: these pages negotiate no twin representation on `Accept`. */
export function taxonomyHeaders({ loaderHeaders }: { loaderHeaders: Headers }) {
  return new Headers(
    publicHtmlHeaders(cacheTags(), loaderHeaders.get(EDGE_CACHE_HEADER) ?? undefined),
  );
}
