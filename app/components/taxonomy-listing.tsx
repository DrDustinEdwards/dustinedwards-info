import { Link, redirect } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
import { PostRow, Pager } from "~/components/post-row";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { listingFacts } from "~/lib/blog-listing.mjs";
import { jsonLd } from "~/lib/json-ld.mjs";
import { SITE_ORIGIN, breadcrumbJsonLd } from "~/lib/seo";

/** A taxonomy page's URL for page `n`: the bare path for the first page, `?page=n` after it. */
export function listingHref(base: string, n: number) {
  return n > 1 ? `${base}?page=${n}` : base;
}

/** Out of range redirects to the last real page, so the URL never claims a page that does not exist. */
export function redirectPastLastPage(page: number, pageCount: number, base: string) {
  if (page > pageCount) throw redirect(listingHref(base, pageCount));
}

type ListingPost = Parameters<typeof PostRow>[0]["post"];

/** The tag and series pages: one listing of posts under a name, with a pager and its own feeds. */
export function TaxonomyListing({
  base,
  name,
  heading,
  dek,
  posts,
  page,
  pageCount,
  total,
  span,
}: {
  /** The page's path, which its feeds hang off. */
  base: string;
  /** The breadcrumb's last step. */
  name: string;
  heading: string;
  /** The sentence under the heading; an "All posts" link follows it. */
  dek: React.ReactNode;
  posts: ListingPost[];
  page: number;
  pageCount: number;
  total: number;
  span: Parameters<typeof listingFacts>[1];
}) {
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
                [name, base],
              ]),
            ),
          }}
        />

        <header className="list-head">
          <h1 className="list-label">{heading}</h1>
          <p className="list-dek">
            {dek} <Link to="/blog">All posts</Link>
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

        <Pager page={page} pageCount={pageCount} hrefFor={(n) => listingHref(base, n)} />

        <p className="list-feeds">
          Subscribe: <a href={`${base}/rss.xml`}>RSS</a> <a href={`${base}/feed.json`}>JSON</a>
        </p>
      </main>
      <ShellFooter />
    </>
  );
}
