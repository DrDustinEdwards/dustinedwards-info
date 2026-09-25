import { data } from "react-router";

import {
  TaxonomyListing,
  listingHref,
  redirectPastLastPage,
} from "~/components/taxonomy-listing";
import { getBlogSeries, listSeriesPosts } from "~/db";
import { POSTS_PER_PAGE, readPage } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { SITE, pageMeta, cacheTags, publicHtmlHeaders } from "~/lib/seo";
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

  const listing = await listSeriesPosts(env, series.name, { page, perPage: POSTS_PER_PAGE });

  redirectPastLastPage(page, listing.pageCount, seriesPath(series.name));

  return data({ ...listing, series });
}

export function headers() {
  return new Headers(publicHtmlHeaders(cacheTags()));
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { series, page } = loaderData;
  const path = listingHref(seriesPath(series.name), page);
  return pageMeta({
    title: `${series.name} | ${SITE.name}`,
    description: `Every part of ${series.name}, a series on ${SITE.name}'s blog.`,
    path,
  });
}

export default function BlogSeries({ loaderData }: Route.ComponentProps) {
  const { series, ...listing } = loaderData;
  return (
    <TaxonomyListing
      {...listing}
      base={seriesPath(series.name)}
      name={series.name}
      heading={series.name}
      dek={`A series in ${series.total} part${series.total === 1 ? "" : "s"}, in order.`}
    />
  );
}
