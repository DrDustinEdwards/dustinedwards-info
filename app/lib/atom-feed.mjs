/**
 * Atom 1.0, from the same rendered rows RSS reads.
 *
 * `.mjs` and dependency-free for the reason `rss-feed.mjs` is: `node:test` can
 * reach it, and the escaping it needs is already exported there rather than
 * reimplemented here. One XML escaper on the site, not two.
 *
 * ## WHY A SECOND DIALECT AT ALL
 *
 * RSS stays the ADVERTISED feed, and root's `links` are unchanged. Atom exists
 * because a handful of readers and most feed-validating tooling prefer it, and
 * because the cost is this file: the query, the visibility predicate, the cap
 * and the row shape are all the ones RSS already uses, so the two cannot carry
 * different posts. Nothing chooses between them at runtime.
 *
 * ## WHAT ATOM REQUIRES THAT RSS DOES NOT
 *
 * Three things, and each is a real constraint rather than a formality:
 *
 *   1. `<id>` must be a permanent, unique IRI. The post URL is used, which is
 *      the same value RSS puts in `guid isPermaLink="true"`.
 *   2. `<updated>` is REQUIRED on the feed and on every entry, and it is
 *      RFC 3339, not RFC 822. `toISOString()` is already RFC 3339.
 *   3. The feed itself needs an `<updated>`, which is the newest entry's. An
 *      empty feed has no such value, so it falls back to the epoch rather than
 *      emitting an invalid empty element: a validator rejects the latter and
 *      accepts the former, and an empty feed is a real state (a tag whose posts
 *      were all unpublished between two crawls).
 */

import { absolutiseUrls, cdata, escapeXml } from "./rss-feed.mjs";

/**
 * One `<entry>`.
 *
 * The body is `type="html"` in a CDATA section rather than escaped inline, the
 * same representation `content:encoded` gets in RSS and for the same reason:
 * the rendered HTML is the post, and double-escaping it is how a feed ends up
 * showing tags as text.
 *
 * A row with no rendered HTML emits NO content element, exactly as RSS omits
 * `content:encoded`. An empty `<content>` asserts the post is empty; an absent
 * one tells the reader to follow the link.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   html: string | null,
 *   description: string | null,
 *   publishAt: unknown,
 *   updatedAt: unknown,
 *   tags: string[],
 * }} post one row of `listBlogPostsRendered`
 * @param {string} origin the site origin, no trailing slash
 * @returns {string}
 */
export function atomEntry(post, origin) {
  const url = `${origin}/blog/${post.slug}`;
  const published = post.publishAt ? new Date(/** @type {any} */ (post.publishAt)) : null;
  const updated = post.updatedAt ? new Date(/** @type {any} */ (post.updatedAt)) : published;

  return [
    "    <entry>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link href="${escapeXml(url)}" rel="alternate" type="text/html" />`,
    `      <id>${escapeXml(url)}</id>`,
    // Required by the spec. Falls back to publication, and then to the epoch,
    // because an entry with no `updated` is invalid rather than merely thin.
    `      <updated>${(updated ?? new Date(0)).toISOString()}</updated>`,
    published ? `      <published>${published.toISOString()}</published>` : null,
    post.description ? `      <summary>${escapeXml(post.description)}</summary>` : null,
    post.html
      ? `      <content type="html">${cdata(absolutiseUrls(post.html, origin))}</content>`
      : null,
    ...post.tags.map((tag) => `      <category term="${escapeXml(tag)}" />`),
    "    </entry>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The whole Atom document.
 *
 * `selfUrl` and `alternateUrl` are both required and both passed in, for the
 * reason `rssDocument` states: they are the fields that genuinely differ per
 * feed, and deriving them here would be this module guessing at a route's
 * address.
 *
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   alternateUrl: string,
 *   selfUrl: string,
 *   authorName: string,
 *   posts: Array<Parameters<typeof atomEntry>[0]>,
 *   origin: string,
 * }} feed
 * @returns {string}
 */
export function atomDocument(feed) {
  const entries = feed.posts.map((post) => atomEntry(post, feed.origin)).join("\n");
  /*
   * The feed's own `updated` is the NEWEST entry's, which is the first row
   * because every caller orders by `publishAt` descending. Reading it off the
   * list rather than taking a clock keeps the document a pure function of its
   * rows, so two renders of the same corpus are byte-identical and the edge can
   * cache one of them.
   */
  const newest = feed.posts
    .map((post) => post.updatedAt ?? post.publishAt)
    .filter(Boolean)
    .map((value) => new Date(/** @type {any} */ (value)).getTime())
    .reduce((a, b) => Math.max(a, b), 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(feed.title)}</title>
  <subtitle>${escapeXml(feed.subtitle)}</subtitle>
  <link href="${escapeXml(feed.alternateUrl)}" rel="alternate" type="text/html" />
  <link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/atom+xml" />
  <id>${escapeXml(feed.alternateUrl)}</id>
  <updated>${new Date(newest).toISOString()}</updated>
  <author><name>${escapeXml(feed.authorName)}</name><uri>${escapeXml(feed.origin)}</uri></author>
${entries}
</feed>
`;
}
