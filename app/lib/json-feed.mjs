/**
 * The JSON Feed item shape, in one place `node:test` can reach.
 *
 * `.mjs` and dependency-free for the reason `upload-contract.mjs` is: the
 * route imports `~/db` and cannot be loaded by a unit test, and the defect
 * this module exists to hold down was exactly the kind a unit test catches.
 * The route's comment promised `content_text` while the item map emitted
 * neither `content_text` nor `content_html`, which JSON Feed 1.1 requires one
 * of on every item. Nothing rendered both the comment and the wire at once,
 * so the feed was out of spec under a sentence saying otherwise.
 *
 * Undefined-valued keys are how an optional field is omitted: the route
 * serializes with JSON.stringify, which drops them. A consumer of this
 * function's return value directly (a test) must judge presence by value,
 * not by `in`.
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
 */
export function feedItem(post, origin) {
  return {
    id: `${origin}/blog/${post.slug}`,
    url: `${origin}/blog/${post.slug}`,
    title: post.title,
    // The markdown source, as the .md twin serves it. JSON Feed 1.1 requires
    // content_html or content_text on every item; this is the half that is
    // true of what this site stores, and it is the same bytes an agent gets
    // from /blog/<slug>.md.
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
 * THE WHOLE JSON Feed 1.1 DOCUMENT.
 *
 * Same reasoning as `rssDocument`: `feedItem` was shared and the envelope was
 * not, so a second feed would have copied the version URL, the language, the
 * authors array and the description. The `version` member is what every reader
 * identifies this document by, and it is the member a copy would most quietly
 * get wrong.
 *
 * @param {{
 *   title: string,
 *   homePageUrl: string,
 *   feedUrl: string,
 *   description: string,
 *   authorName: string,
 *   posts: Array<Parameters<typeof feedItem>[0]>,
 *   origin: string,
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
    items: feed.posts.map((post) => feedItem(post, feed.origin)),
  };
}
