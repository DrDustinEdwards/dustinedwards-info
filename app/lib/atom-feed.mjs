import { absolutiseUrls, cdata, escapeXml, mathToTex } from "./rss-feed.mjs";

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
 * }} feed
 * @returns {string}
 */
export function atomDocument(feed) {
  const entries = feed.posts.map((post) => atomEntry(post, feed.origin)).join("\n");
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
