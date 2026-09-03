import { Link, data, redirect } from "react-router";

import { PostCard, Pagination } from "~/components/post-card";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { getBlogTag, listBlogPosts } from "~/db";
import { POSTS_PER_PAGE } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { jsonLd } from "~/lib/json-ld.mjs";
import {
  SITE,
  SITE_ORIGIN,
  breadcrumbJsonLd,
  pageMeta,
  publicHtmlHeaders,
} from "~/lib/seo";
import { tagPath } from "~/lib/tag-path.mjs";
import type { Route } from "./+types/blog.tags.$tag";

/*
 * BOTH SHEETS THE SHARED CARD NEEDS, not just the obvious one.
 *
 * `PostCard` renders `.post-card-series`, which is defined ONLY in
 * blog-index-extras.css. Importing blog-index.css alone left that element
 * unstyled on this page and on no other, which is the failure mode of sharing a
 * component without sharing what it is styled by: the markup is identical, the
 * page is not, and nothing in a payload gate can see it because the weight was
 * merely lower.
 */
import "~/styles/blog-index.css";
import "~/styles/blog-index-extras.css";

/**
 * The archive for one tag.
 *
 * Tags have been in the model, the `tags` table, the chips and the JSON-LD
 * since the blog shipped, and there was no PAGE for one: the only address a tag
 * had was `/blog?tag=<slug>`, a filtered view of the index whose canonical
 * pointed at itself and which no sitemap listed. So the site knew about its own
 * taxonomy and offered a crawler no way in.
 *
 * ## 404 RATHER THAN AN EMPTY PAGE
 *
 * `getBlogTag` composes the same `isBlogPost()` the chip list does, so a tag
 * carried only by drafts or by future-dated posts does not exist here. That is
 * a real case and not a hypothetical: a draft is how a tag first appears.
 * Rendering an empty archive for one would be a soft 404, a 200 with no
 * content, which is the shape search engines penalise hardest, and it would
 * also leak the existence of a tag only a draft carries.
 *
 * ## THE LIST IS THE INDEX'S LIST
 *
 * `listBlogPosts` with a tag, the same call `/blog?tag=` makes, so the archive
 * and the filtered view cannot disagree about which posts carry a tag or about
 * how they are ordered. The cards are `PostCard`, the same component, for the
 * same reason.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;

  /*
   * THE TAG IS RESOLVED BEFORE THE LIST IS READ, and the order matters: a tag
   * nothing public carries must 404 rather than render an empty archive, and
   * asking the list first would make that decision from a zero-length array,
   * which cannot tell "no such tag" from "every post using it was unpublished".
   */
  const tag = await getBlogTag(env, params.tag);
  if (!tag) throw data("Not found", { status: 404 });

  const listing = await listBlogPosts(env, {
    tag: tag.slug,
    page,
    perPage: POSTS_PER_PAGE,
  });

  /*
   * OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE, which is `/blog`'s ruling and
   * is inherited rather than re-argued. The reader lands on a page that exists,
   * at the URL naming it, and a crawler follows one hop instead of indexing an
   * empty list under an honest-looking "Page 99 of 3". 302, because the bound
   * moves as posts are published.
   */
  if (page > listing.pageCount) {
    const last = listing.pageCount > 1 ? `?page=${listing.pageCount}` : "";
    throw redirect(`${tagPath(tag.slug)}${last}`);
  }

  return data({ ...listing, tag });
}

export function headers() {
  /*
   * `/blog`'s HEADERS, THROUGH THE HELPER THAT OWNS THEM.
   *
   * `publicHtmlHeaders()` returns exactly the pair `/blog` sets,
   * `SHARED_CACHE_CONTROL` with `HTML_VARY`, and calling it is stricter than
   * copying the two constants: the helper is the one owner, so this page cannot
   * drift from the others if the pair ever changes.
   *
   * `/blog` itself writes them out rather than calling this, because it also
   * forwards a `Server-Timing` header off its loader. This page has no such
   * header to carry, so it takes the helper.
   *
   * NOT `HTML_VARY_ACCEPT`, which the post page and the index use: those
   * negotiate a twin representation on `Accept` and this page has none.
   * `workers/app.ts` downgrades all of it to private for any request carrying a
   * cookie, so the only variant ever stored is the themeless one.
   */
  return new Headers(publicHtmlHeaders());
}

export function meta({ loaderData, params }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { tag, page } = loaderData;
  /*
   * THE SAME BUILDER THE OTHER PAGES USE. `pageMeta` owns the complete social
   * and canonical set, so this page cannot ship the partial one five pages
   * shipped before it existed: canonical, og:title, og:description, og:url,
   * og:type, og:image, twitter:card and twitter:image, all or none.
   *
   * The canonical carries `?page=` when there is one, for the reason `/blog`'s
   * does: page two is different posts, and declaring page one as its canonical
   * asks a crawler to drop content it does not share.
   */
  const path = page > 1 ? `${tagPath(tag.slug)}?page=${page}` : tagPath(tag.slug);
  return pageMeta({
    title: `Posts tagged ${tag.name} | ${SITE.name}`,
    description: `Every post on ${SITE.name}'s blog tagged ${tag.name}.`,
    path,
  });
}

export default function BlogTag({ loaderData }: Route.ComponentProps) {
  const { posts, tag, page, pageCount } = loaderData;
  const hrefFor = (n: number) =>
    n > 1 ? `${tagPath(tag.slug)}?page=${n}` : tagPath(tag.slug);

  return (
    <>
      <SiteHeader />
      <main className="page" id="main">
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

        <header className="page-head">
          <h1>Posts tagged {tag.name}</h1>
          <p className="muted">
            {tag.total} post{tag.total === 1 ? "" : "s"}.{" "}
            <Link to="/blog">All posts</Link>
          </p>
        </header>

        {/*
          THE FEEDS FOR THIS TAG, as plain links. A reader who filters to a
          subject is exactly the reader who wants only that subject in their
          reader, and until these existed the only feed on offer was everything.
        */}
        <p className="muted">
          Subscribe: <a href={`${tagPath(tag.slug)}/rss.xml`}>RSS</a>{" "}
          <a href={`${tagPath(tag.slug)}/feed.json`}>JSON</a>
        </p>

        {posts.length === 0 ? (
          <p className="muted">No posts here yet.</p>
        ) : (
          <ul className="post-list">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </ul>
        )}

        <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
      </main>
      <SiteFooter />
    </>
  );
}
