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

/*
 * ONE SHEET, where the card needed two: `.post-card-series` lived only in blog-index-extras.css,
 * so importing blog-index.css alone left that element unstyled on this page and on no other, which
 * nothing in a payload gate could see because the weight was merely lower. The listing is one
 * object now, and an archive is the same object filtered.
 */
import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/entry-list.css";

/**
 * The archive for one tag.
 *
 * 404 RATHER THAN AN EMPTY PAGE. `getBlogTag` composes the same predicate the
 * chip list does, so a tag carried only by drafts does not exist here. Rendering an
 * empty archive would be a soft 404, and it would leak the existence of a tag only
 * a draft carries.
 *
 * THE LIST IS THE INDEX'S LIST, the same call `/blog?tag=` makes, so the archive
 * and the filtered view cannot disagree.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;

  /*
   * THE TAG IS RESOLVED BEFORE THE LIST IS READ: asking the list first would make
   * the 404 decision from a zero-length array, which cannot tell "no such tag" from
   * "every post using it was unpublished".
   */
  const tag = await getBlogTag(env, params.tag);
  if (!tag) throw data("Not found", { status: 404 });

  const listing = await listBlogPosts(env, {
    tag: tag.slug,
    page,
    perPage: POSTS_PER_PAGE,
  });

  /*
   * OUT OF RANGE REDIRECTS TO THE LAST REAL PAGE, which is `/blog`'s ruling and is
   * inherited rather than re-argued. 302, because the bound moves as posts are
   * published.
   */
  if (page > listing.pageCount) {
    const last = listing.pageCount > 1 ? `?page=${listing.pageCount}` : "";
    throw redirect(`${tagPath(tag.slug)}${last}`);
  }

  return data({ ...listing, tag });
}

export function headers() {
  /*
   * Through the helper that OWNS the pair, which is stricter than copying two
   * constants: the helper is the one owner, so this page cannot drift.
   *
   * NOT `HTML_VARY_ACCEPT`: the post page and the index negotiate a twin
   * representation on `Accept` and this page has none.
   */
  return new Headers(publicHtmlHeaders(cacheTags()));
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: `Not found | ${SITE.name}` }];
  }
  const { tag, page } = loaderData;
  /*
   * THE SAME BUILDER THE OTHER PAGES USE, so this page cannot ship the partial set
   * five pages shipped before it existed: all or none. The canonical carries
   * `?page=` when there is one, because page two is different posts.
   */
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
          {/* The same three counted facts the index carries, over this archive's own list. The
              count is the listing's, not `tag.total`: two owners for one number is one too many. */}
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

        {/*
         * A reader who filters to a subject is exactly the reader who wants only that subject in
         * their reader, and until these existed the only feed on offer was everything. Under the
         * list now rather than above it: it is what to do after reading, not before.
         */}
        <p className="list-feeds">
          Subscribe: <a href={`${tagPath(tag.slug)}/rss.xml`}>RSS</a>{" "}
          <a href={`${tagPath(tag.slug)}/feed.json`}>JSON</a>
        </p>
      </main>
      <ShellFooter />
    </>
  );
}
