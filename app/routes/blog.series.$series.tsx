import { data } from "react-router";

import {
  TaxonomyListing,
  listingHref,
  listingTrail,
  listingDescription,
} from "~/components/taxonomy-listing";
import { getBlogSeries, listSeriesPosts } from "~/db";
import { getEnv } from "~/lib/context";
import { SITE, siteHead } from "~/lib/seo";
import { loadTaxonomyListing, taxonomyHeaders } from "~/lib/taxonomy-loader.server";
import { seriesPath } from "~/lib/series-path.mjs";
import type { Route } from "./+types/blog.series.$series";

import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/entry-list.css";

/** Ordered by part, the one listing that is not newest first. */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const { item, listing, init } = await loadTaxonomyListing(
    env,
    request,
    () => getBlogSeries(env, params.series),
    (series, paging) => listSeriesPosts(env, series.name, paging),
    (series) => seriesPath(series.name),
  );
  return data({ ...listing, series: item }, init);
}

export { taxonomyHeaders as headers };

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
  return <TaxonomyListing {...listing} base={seriesPath(series.name)} heading={series.name} />;
}
