import { data } from "react-router";

import {
  TaxonomyListing,
  listingHref,
  listingTrail,
  listingDescription,
  redirectPastLastPage,
} from "~/components/taxonomy-listing";
import { getBlogSeries, listSeriesPosts, nextScheduledPublishAt } from "~/db";
import { POSTS_PER_PAGE, readPage } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import {
  EDGE_CACHE_HEADER,
  SITE,
  siteHead,
  cacheTags,
  publicHtmlHeaders,
  scheduledEdgeCacheControl,
} from "~/lib/seo";
import { seriesPath } from "~/lib/series-path.mjs";
import type { Route } from "./+types/blog.series.$series";

import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/entry-list.css";

/**
 * Ordered by part, the one listing that is not newest first. 404 rather than an empty page, which
 * would be a soft 404 and leak a series only a draft carries.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = readPage(url.searchParams.get("page"));

  const series = await getBlogSeries(env, params.series);
  if (!series) throw data("Not found", { status: 404 });

  const [listing, nextPublishAt] = await Promise.all([
    listSeriesPosts(env, series.name, { page, perPage: POSTS_PER_PAGE }),
    nextScheduledPublishAt(env),
  ]);

  redirectPastLastPage(page, listing.pageCount, seriesPath(series.name));

  return data(
    { ...listing, series },
    { headers: { [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt) } },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return new Headers(
    publicHtmlHeaders(cacheTags(), loaderHeaders.get(EDGE_CACHE_HEADER) ?? undefined),
  );
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { series, page, posts, total } = loaderData;
  const path = listingHref(seriesPath(series.name), page);
  return siteHead({
    title: series.name,
    description: listingDescription(`in the series ${series.name}`, total, posts),
    path,
    pageType: "CollectionPage",
    trail: listingTrail(series.name, path),
  });
}

export default function BlogSeries({ loaderData }: Route.ComponentProps) {
  const { series, ...listing } = loaderData;
  return (
    <TaxonomyListing
      {...listing}
      base={seriesPath(series.name)}
      heading={series.name}
      dek={`A series in ${series.total} part${series.total === 1 ? "" : "s"}, in order.`}
    />
  );
}
