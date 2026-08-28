/**
 * The RSS 2.0 item shape, in one place `node:test` can reach.
 *
 * `.mjs` and dependency-free for the reason `json-feed.mjs` is: the route
 * imports `~/db` and cannot be loaded by a unit test, and a feed's defects are
 * exactly the kind a unit test catches and a person never does. Nobody reads
 * their own RSS in an actual reader often enough to notice a broken image path.
 *
 * ## WHY `content:encoded` AND NOT `<description>`
 *
 * RSS 2.0 has no element of its own for full content. `<description>` is
 * allowed to carry HTML, and some feeds put the whole post there, but it is
 * also the element every reader shows in the LIST view: overwriting it with the
 * body replaces the summary with the first paragraph and a half of markup.
 *
 * `content:encoded` is from the RSS 1.0 content module,
 * `http://purl.org/rss/1.0/modules/content/`, and it is what every reader
 * implements for exactly this. So `<description>` keeps the summary and
 * `content:encoded` carries the post. That is the shape WordPress emits and the
 * shape readers expect, which is the practical definition of conformant here.
 *
 * ## WHY THE RENDERED HTML, WHEN THE JSON FEED CARRIES MARKDOWN
 *
 * A JSON Feed consumer is usually a program and JSON Feed 1.1 has
 * `content_text` for exactly the case where the source is the honest answer. An
 * RSS reader is a rendering surface: give it markdown and it shows a reader
 * asterisks and pipe tables. Same corpus, same predicate, same cap, different
 * representation, because the consumers are different.
 *
 * ## URLS ARE ABSOLUTISED, and that is not optional
 *
 * The stored HTML carries root-relative paths, `/media/...` and `/blog/...`,
 * because that is what a page needs. A feed item is read on someone else's
 * origin, where a root-relative path resolves against THEIR host and every
 * image is a 404. RSS has no reliable base-URL mechanism, so the paths are
 * rewritten.
 */

/**
 * XML text escaping. Applied to every interpolated value without exception.
 *
 * @param {unknown} value
 */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wraps content in CDATA, surviving a `]]>` inside it.
 *
 * A CDATA section ends at the first `]]>`, so content containing that sequence
 * would terminate the section early and spill the rest into the document as
 * markup. The standard repair is to close and reopen around it, which is
 * transparent to a parser: the two sections concatenate.
 *
 * Rare rather than impossible. A post about XML, or about this function, would
 * contain it in a code block.
 *
 * @param {string} content
 */
export function cdata(content) {
  return `<![CDATA[${String(content).replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

/**
 * Root-relative URLs in rendered HTML, made absolute against the site origin.
 *
 * SCOPED TO ATTRIBUTES, and only to values beginning with a single `/`. A value
 * beginning `//` is protocol-relative and already absolute; anything with a
 * scheme is left alone. `srcset` is handled because a responsive image's
 * candidate list is a comma-separated set of URLs and a reader that honours it
 * would fetch every one of them from its own host.
 *
 * WHAT THIS DOES NOT DO, stated rather than implied: it does not parse HTML.
 * A root-relative URL inside a `style` attribute, inside inline CSS, or inside
 * a data attribute some script reads is not rewritten. The corpus has none, the
 * public plane ships no framework script for a feed reader to run anyway, and
 * parsing the whole document to reach three attributes would put an HTML parser
 * on the feed path.
 *
 * @param {string} html
 * @param {string} origin no trailing slash
 */
export function absolutiseUrls(html, origin) {
  return String(html)
    .replace(/\b(href|src)="\/(?!\/)/g, `$1="${origin}/`)
    .replace(
      /\bsrcset="([^"]*)"/g,
      (_whole, list) =>
        `srcset="${String(list)
          .split(",")
          .map((candidate) => candidate.replace(/^(\s*)\/(?!\/)/, `$1${origin}/`))
          .join(",")}"`,
    );
}

/**
 * One `<item>`, as the lines that make it, indented for the channel.
 *
 * Returns a STRING rather than a structure, unlike `feedItem` next door, and
 * the difference is the format: JSON Feed's shape is the object, RSS's shape is
 * the markup. Asserting on anything else here would be asserting on a model of
 * the feed rather than on the feed.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   html: string | null,
 *   description: string | null,
 *   publishAt: unknown,
 *   tags: string[],
 * }} post one row of `listBlogPostsRendered`
 * @param {string} origin the site origin, no trailing slash
 */
export function rssItem(post, origin) {
  const url = `${origin}/blog/${post.slug}`;
  const published = post.publishAt
    ? new Date(/** @type {any} */ (post.publishAt)).toUTCString()
    : null;

  return [
    "    <item>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    post.description ? `      <description>${escapeXml(post.description)}</description>` : null,
    /*
     * The body, absolutised and wrapped. Omitted rather than emitted empty when
     * a row carries no rendered HTML: an empty `content:encoded` tells a reader
     * the post IS empty, where an absent one tells it to follow the link.
     */
    post.html
      ? `      <content:encoded>${cdata(absolutiseUrls(post.html, origin))}</content:encoded>`
      : null,
    published ? `      <pubDate>${published}</pubDate>` : null,
    ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
    "    </item>",
  ]
    .filter(Boolean)
    .join("\n");
}
