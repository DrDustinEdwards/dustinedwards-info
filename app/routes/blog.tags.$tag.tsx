import { Link, data, redirect } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
import { PostRow, Pager } from "~/components/post-row";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { getBlogTag, listBlogPosts } from "~/db";
import { POSTS_PER_PAGE, listingFacts } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { jsonLd } from "~/lib/json-ld.mjs";
import {
  SITE,
  SITE_ORIGIN,
  breadcrumbJsonLd,
  pageMeta,
  cacheTags,
  publicHtmlHeaders,
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
  const page = Number(url.searchParams.get("page")) || 1;

  /* Resolved before the list: an empty list cannot tell "no such tag" from "every post unpublished". */
  const tag = await getBlogTag(env, params.tag);
  if (!tag) throw data("Not found", { status: 404 });

  const listing = await listBlogPosts(env, {
    tag: tag.slug,
    page,
    perPage: POSTS_PER_PAGE,
  });

  if (page > listing.pageCount) {
    const last = listing.pageCount > 1 ? `?page=${listing.pageCount}` : "";
    throw redirect(`${tagPath(tag.slug)}${last}`);
  }

  return data({ ...listing, tag });
}

export function headers() {
  /* Not `HTML_VARY_ACCEPT`: this page negotiates no twin representation on `Accept`. */
  return new Headers(publicHtmlHeaders(cacheTags()));
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { tag, page } = loaderData;
  const path = page > 1 ? `${tagPath(tag.slug)}?page=${page}` : tagPath(tag.slug);
  return pageMeta({
    title: `Posts tagged ${tag.name} | ${SITE.name}`,
    description: `Every post on ${SITE.name}'s blog tagged ${tag.name}.`,
    path,
  });
}

export default function BlogTag({ loaderData }: Route.ComponentProps) {
  const { posts, tag, page, pageCount, total, span } = loaderData;
  const hrefFor = (n: number) =>
    n > 1 ? `${tagPath(tag.slug)}?page=${n}` : tagPath(tag.slug);

  return (
    <>
      <SiteHeader />
      <main className="tracks list-tracks" id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbJsonLd(SITE_ORIGIN, [
                ["Home", "/"],
                ["Blog", "/blog"],
                [tag.name, tagPath(tag.slug)],
              ]),
            ),
          }}
        />

        <header className="list-head">
          <h1 className="list-label">Tagged {tag.name}</h1>
          <p className="list-dek">
            Every post on this blog tagged {tag.name}. <Link to="/blog">All posts</Link>
          </p>
          <EvidenceRow facts={listingFacts(total, span)} />
        </header>

        {posts.length === 0 ? (
          <p className="list-empty">No posts here yet.</p>
        ) : (
          <ul className="entry-list">
            {posts.map((post) => (
              <PostRow key={post.slug} post={post} />
            ))}
          </ul>
        )}

        <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} />

        <p className="list-feeds">
          Subscribe: <a href={`${tagPath(tag.slug)}/rss.xml`}>RSS</a>{" "}
          <a href={`${tagPath(tag.slug)}/feed.json`}>JSON</a>
        </p>
      </main>
      <ShellFooter />
    </>
  );
}
