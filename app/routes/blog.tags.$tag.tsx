import { data } from "react-router";

import {
  TaxonomyListing,
  listingHref,
  redirectPastLastPage,
} from "~/components/taxonomy-listing";
import { getBlogTag, listBlogPosts, nextScheduledPublishAt } from "~/db";
import { POSTS_PER_PAGE, readPage } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import {
  EDGE_CACHE_HEADER,
  SITE,
  pageMeta,
  cacheTags,
  publicHtmlHeaders,
  scheduledEdgeCacheControl,
} from "~/lib/seo";
import { tagPath } from "~/lib/tag-path.mjs";
import type { Route } from "./+types/blog.tags.$tag";

import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/entry-list.css";

/** 404 rather than an empty page, which would be a soft 404 and leak a tag only drafts carry. */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = readPage(url.searchParams.get("page"));

  /* Resolved before the list: an empty list cannot tell "no such tag" from "every post unpublished". */
  const tag = await getBlogTag(env, params.tag);
  if (!tag) throw data("Not found", { status: 404 });

  const [listing, nextPublishAt] = await Promise.all([
    listBlogPosts(env, { tag: tag.slug, page, perPage: POSTS_PER_PAGE }),
    nextScheduledPublishAt(env),
  ]);

  redirectPastLastPage(page, listing.pageCount, tagPath(tag.slug));

  return data(
    { ...listing, tag },
    { headers: { [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt) } },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  /* Not `HTML_VARY_ACCEPT`: this page negotiates no twin representation on `Accept`. */
  return new Headers(
    publicHtmlHeaders(cacheTags(), loaderHeaders.get(EDGE_CACHE_HEADER) ?? undefined),
  );
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { tag, page } = loaderData;
  const path = listingHref(tagPath(tag.slug), page);
  return pageMeta({
    title: `Posts tagged ${tag.name} | ${SITE.name}`,
    description: `Every post on ${SITE.name}'s blog tagged ${tag.name}.`,
    path,
  });
}

export default function BlogTag({ loaderData }: Route.ComponentProps) {
  const { tag, ...listing } = loaderData;
  return (
    <TaxonomyListing
      {...listing}
      base={tagPath(tag.slug)}
      name={tag.name}
      heading={`Tagged ${tag.name}`}
      dek={`Every post on this blog tagged ${tag.name}.`}
    />
  );
}
