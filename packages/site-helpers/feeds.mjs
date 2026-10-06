import { absolutiseUrls, cdata, escapeXml, mathToTex } from "./xml.mjs";

/*
 * RSS 2.0, Atom 1.0 and JSON Feed 1.1 from the same post rows. `<description>` keeps the summary because readers show it in the
 * LIST view; the post goes in `content:encoded`. URLs are absolutised because a feed item is read on someone else's origin.
 * `itemPath` is where a post lives under the origin ("/writing" by default), the one thing the sites disagree on.
 */

const DEFAULT_ITEM_PATH = "/writing";

/**
 * @param {{
 *   slug: string,
 *   title: string,
 *   html: string | null,
 *   description: string | null,
 *   publishAt: unknown,
 *   tags: string[],
 * }} post one row of `listBlogPostsRendered`
 * @param {string} origin the site origin, no trailing slash
 * @param {string} [itemPath]
 */
export function rssItem(post, origin, itemPath = DEFAULT_ITEM_PATH) {
  const url = `${origin}${itemPath}/${post.slug}`;
  const published = post.publishAt
    ? new Date(/** @type {any} */ (post.publishAt)).toUTCString()
    : null;

  return [
    "    <item>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    post.description ? `      <description>${escapeXml(post.description)}</description>` : null,
    // Omitted rather than empty: an empty `content:encoded` tells a reader the post IS empty.
    post.html
      ? `      <content:encoded>${cdata(absolutiseUrls(mathToTex(post.html), origin))}</content:encoded>`
      : null,
    published ? `      <pubDate>${published}</pubDate>` : null,
    ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
    "    </item>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {{
 *   title: string,
 *   link: string,
 *   description: string,
 *   selfUrl: string,
 *   posts: Array<Parameters<typeof rssItem>[0]>,
 *   origin: string,
 *   itemPath?: string,
 * }} feed
 * @returns {string}
 */
export function rssDocument(feed) {
  const items = feed.posts.map((post) => rssItem(post, feed.origin, feed.itemPath)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>en-us</language>
    <atom:link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

/**
 * The body is CDATA rather than escaped inline: double-escaping is how a feed
 * ends up showing tags as text. No rendered HTML means no `<content>` at all,
 * since an empty one asserts the post is empty.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   html: string | null,
 *   description: string | null,
 *   publishAt: unknown,
 *   updatedAt: unknown,
 *   tags: string[],
 * }} post
 * @param {string} origin
 * @param {string} [itemPath]
 * @returns {string}
 */
export function atomEntry(post, origin, itemPath = DEFAULT_ITEM_PATH) {
  const url = `${origin}${itemPath}/${post.slug}`;
  const published = post.publishAt ? new Date(/** @type {any} */ (post.publishAt)) : null;
  const updated = post.updatedAt ? new Date(/** @type {any} */ (post.updatedAt)) : published;

  return [
    "    <entry>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link href="${escapeXml(url)}" rel="alternate" type="text/html" />`,
    `      <id>${escapeXml(url)}</id>`,
    // An entry with no `updated` is invalid Atom, hence the epoch fallback.
    `      <updated>${(updated ?? new Date(0)).toISOString()}</updated>`,
    published ? `      <published>${published.toISOString()}</published>` : null,
    post.description ? `      <summary>${escapeXml(post.description)}</summary>` : null,
    post.html
      ? `      <content type="html">${cdata(absolutiseUrls(mathToTex(post.html), origin))}</content>`
      : null,
    ...post.tags.map((tag) => `      <category term="${escapeXml(tag)}" />`),
    "    </entry>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   alternateUrl: string,
 *   selfUrl: string,
 *   authorName: string,
 *   posts: Array<Parameters<typeof atomEntry>[0]>,
 *   origin: string,
 *   itemPath?: string,
 * }} feed
 * @returns {string}
 */
export function atomDocument(feed) {
  const entries = feed.posts.map((post) => atomEntry(post, feed.origin, feed.itemPath)).join("\n");
  // Derived from the rows rather than a clock, so two renders of the same corpus
  // are byte-identical and the edge can cache them. An empty feed gets the epoch,
  // which validates where an empty `<updated>` does not.
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

/**
 * Undefined-valued keys are how an optional field is omitted (JSON.stringify
 * drops them), so a direct consumer must judge presence by value, not by `in`.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   body: string,
 *   description: string | null,
 *   publishAt: unknown,
 *   updatedAt: unknown,
 *   coverImage: string | null,
 *   tags: string[],
 * }} post one row of `listBlogPostsFullText`
 * @param {string} origin the site origin, no trailing slash
 * @param {string} [itemPath]
 */
export function feedItem(post, origin, itemPath = DEFAULT_ITEM_PATH) {
  return {
    id: `${origin}${itemPath}/${post.slug}`,
    url: `${origin}${itemPath}/${post.slug}`,
    title: post.title,
    // JSON Feed 1.1 requires content_html or content_text on every item.
    content_text: post.body,
    summary: post.description ?? undefined,
    date_published: post.publishAt
      ? new Date(/** @type {any} */ (post.publishAt)).toISOString()
      : undefined,
    date_modified: post.updatedAt
      ? new Date(/** @type {any} */ (post.updatedAt)).toISOString()
      : undefined,
    tags: post.tags.length > 0 ? post.tags : undefined,
    image: post.coverImage ? `${origin}${post.coverImage}` : undefined,
  };
}

/**
 * @param {{
 *   title: string,
 *   homePageUrl: string,
 *   feedUrl: string,
 *   description: string,
 *   authorName: string,
 *   posts: Array<Parameters<typeof feedItem>[0]>,
 *   origin: string,
 *   itemPath?: string,
 * }} feed
 */
export function jsonFeedDocument(feed) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: feed.title,
    home_page_url: feed.homePageUrl,
    feed_url: feed.feedUrl,
    description: feed.description,
    language: "en-US",
    authors: [{ name: feed.authorName, url: feed.origin }],
    items: feed.posts.map((post) => feedItem(post, feed.origin, feed.itemPath)),
  };
}
