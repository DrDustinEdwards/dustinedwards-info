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
 */
export function feedItem(post, origin) {
  return {
    id: `${origin}/blog/${post.slug}`,
    url: `${origin}/blog/${post.slug}`,
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
