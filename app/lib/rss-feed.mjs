/**
 * `<description>` keeps the summary because readers show it in the LIST view; the post goes in
 * `content:encoded`. URLs are absolutised because a feed item is read on someone else's origin,
 * where a root-relative path resolves against THEIR host.
 */

/**
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
 * A CDATA section ends at the first `]]>`, so it is closed and reopened around one; the two
 * sections concatenate transparently.
 *
 * @param {string} content
 */
export function cdata(content) {
  return `<![CDATA[${String(content).replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

/**
 * Not an HTML parser: only `href`, `src` and `srcset` values beginning with a single `/` are
 * rewritten. A `//` value is protocol-relative and already absolute.
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
 * A feed reader has no `katex.css`, so KaTeX's two trees (clipped MathML and positioned HTML)
 * would both show, garbled. The TeX comes from KaTeX's own annotation, taken still XML-escaped,
 * because unescaping would put a stray `<` into the reader's document.
 *
 * Counting spans is sound because nothing KaTeX nests inside an expression can close a span it
 * did not open. An expression with no closing tag or no annotation is left alone.
 *
 * @param {string} html
 */
export function mathToTex(html) {
  const source = String(html);
  let out = "";
  let cursor = 0;

  for (;;) {
    // `katex-display` WRAPS the `katex` span, so matching the inner one first would leave the
    // outer wrapper behind, empty, around a `$$`.
    const display = source.indexOf('<span class="katex-display">', cursor);
    const inline = source.indexOf('<span class="katex">', cursor);
    if (display === -1 && inline === -1) break;
    const start =
      display === -1 ? inline : inline === -1 ? display : Math.min(display, inline);
    const isDisplay = start === display;

    const end = spanEnd(source, start);
    if (end === -1) break;

    const region = source.slice(start, end);
    const annotation = region.match(
      /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/,
    );
    // An empty annotation is left alone too, rather than emitting a bare pair of dollar signs.
    if (!annotation || !annotation[1]) {
      out += source.slice(cursor, end);
      cursor = end;
      continue;
    }

    const tex = annotation[1].trim();
    const delimiter = isDisplay ? "$$" : "$";
    out += source.slice(cursor, start) + delimiter + tex + delimiter;
    cursor = end;
  }

  return out + source.slice(cursor);
}

/**
 * -1 when the depth never returns to zero.
 *
 * @param {string} source @param {number} start index of the opening `<span`
 */
function spanEnd(source, start) {
  const OPEN = "<span";
  const CLOSE = "</span>";
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const open = source.indexOf(OPEN, i);
    const close = source.indexOf(CLOSE, i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth += 1;
      i = open + OPEN.length;
      continue;
    }
    depth -= 1;
    i = close + CLOSE.length;
    if (depth === 0) return i;
  }
  return -1;
}

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
 * }} feed
 * @returns {string}
 */
export function rssDocument(feed) {
  const items = feed.posts.map((post) => rssItem(post, feed.origin)).join("\n");
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
