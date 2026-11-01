import { redirect } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { EvidenceRow } from "~/components/evidence-row";
import { PostRow, Pager } from "~/components/post-row";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { listingFacts } from "~/lib/blog-listing.mjs";
import { SITE, type Trail } from "~/lib/seo";

/** A taxonomy page's URL for page `n`: the bare path for the first page, `?page=n` after it. */
export function listingHref(base: string, n: number) {
  return n > 1 ? `${base}?page=${n}` : base;
}

/** A listing's description from its own posts: how many, and the titles on the page. */
export function listingDescription(what: string, total: number, posts: Array<{ title: string }>) {
  const count = `${total} post${total === 1 ? "" : "s"} on ${SITE.name}'s blog ${what}`;
  return posts.length > 0 ? `${count}: ${posts.map((post) => post.title).join("; ")}.` : `${count}.`;
}

/** Out of range redirects to the last real page, so the URL never claims a page that does not exist. */
export function redirectPastLastPage(page: number, pageCount: number, base: string) {
  if (page > pageCount) throw redirect(listingHref(base, pageCount));
}

/** A tag or series page's trail, for its visible breadcrumb and its head's BreadcrumbList alike, so the two agree. */
export function listingTrail(heading: string, base: string): Trail {
  return [
    ["Writing", "/writing"],
    [heading, base],
  ];
}

type ListingPost = Parameters<typeof PostRow>[0]["post"];

/** The tag and series pages: one listing of posts under a name, with a pager and its own feeds. */
export function TaxonomyListing({
  base,
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
  heading: string;
  /** The sentence under the heading. The trail above the heading leads back to all posts. */
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
      <main className="cap-page tracks list-tracks" id="main" tabIndex={-1}>
        <header className="list-head">
          <Breadcrumb trail={listingTrail(heading, base)} />
          <h1 className="list-label cap-layout-grid">{heading}</h1>
          <p className="list-dek">{dek}</p>
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
