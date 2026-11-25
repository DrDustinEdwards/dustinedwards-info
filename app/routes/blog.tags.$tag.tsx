import { data } from "react-router";

import {
  TaxonomyListing,
  listingHref,
  listingTrail,
  listingDescription,
} from "~/components/taxonomy-listing";
import { getBlogTag, listBlogPosts } from "~/db";
import { getEnv } from "~/lib/context";
import { SITE, siteHead } from "~/lib/seo";
import { loadTaxonomyListing, taxonomyHeaders } from "~/lib/taxonomy-loader.server";
import { tagPath } from "~/lib/tag-path.mjs";
import type { Route } from "./+types/blog.tags.$tag";

import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/entry-list.css";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const { item, listing, init } = await loadTaxonomyListing(
    env,
    request,
    () => getBlogTag(env, params.tag),
    (tag, paging) => listBlogPosts(env, { tag: tag.slug, ...paging }),
    (tag) => tagPath(tag.slug),
  );
  return data({ ...listing, tag: item }, init);
}

export { taxonomyHeaders as headers };

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { tag, page, posts, total } = loaderData;
  const path = listingHref(tagPath(tag.slug), page);
  return siteHead({
    title: `Posts tagged ${tag.name}`,
    description: listingDescription(`tagged ${tag.name}`, total, posts),
    path,
    pageType: "CollectionPage",
    trail: listingTrail(`Tagged ${tag.name}`, path),
  });
}

export default function BlogTag({ loaderData }: Route.ComponentProps) {
  const { tag, ...listing } = loaderData;
  return <TaxonomyListing {...listing} base={tagPath(tag.slug)} heading={`Tagged ${tag.name}`} />;
}
