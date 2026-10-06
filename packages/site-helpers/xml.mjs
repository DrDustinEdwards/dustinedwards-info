/**
 * The XML and feed-text helpers that were written again in about eight repositories, once, in the form of the best of them
 * (dustinedwards-info's rss-feed.mjs). Pure, no dependencies, Web-standard only: it runs unchanged in a Worker and in Node.
 */

/**
 * All five entities. Attribute values and element text both take this one, since it is safe in either.
 *
 * @param {unknown} value
 * @returns {string}
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
 * Element text only: `&`, `<` and `>`. What a site that never puts a quote into a value (a URL, a category) wrote for
 * itself; `escapeXml` is safe wherever this is, and the two differ only on `"` and `'`.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXmlText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * A CDATA section ends at the first `]]>`, so it is closed and reopened around one; the two sections concatenate
 * transparently. A hand-written `<![CDATA[${text}]]>` loses the rest of the text, and the document, at that point.
 *
 * @param {unknown} content
 * @returns {string}
 */
export function cdata(content) {
  return `<![CDATA[${String(content).replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

/**
 * An RFC 822 date, which RSS `<pubDate>` requires, from a Date, an epoch in milliseconds, or the two string forms the sites
 * store: ISO 8601 (`2026-06-21T09:30:00Z`) and SQLite's `2026-06-21 09:30:00`, read as UTC. A value that is not a date reads
 * as the epoch, as germomics always has, so an item is never undated by accident.
 *
 * @param {Date | number | string | null | undefined} value
 * @returns {string}
 */
export function rfc822(value) {
  return toDate(value).toUTCString();
}

/**
 * The calendar day of a date as `YYYY-MM-DD` (a sitemap `<lastmod>`), or null when there is none.
 *
 * @param {Date | number | string | null | undefined} value
 * @returns {string | null}
 */
export function isoDay(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(value, null);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/**
 * @param {Date | number | string | null | undefined} value
 * @param {Date | null} [fallback] what an unreadable value becomes; the epoch by default
 * @returns {Date}
 */
function toDate(value, fallback = new Date(0)) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? (fallback ?? new Date(NaN)) : value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && value !== "") {
    const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback ?? new Date(NaN);
}

/**
 * Not an HTML parser: only `href`, `src` and `srcset` values beginning with a single `/` are rewritten. A `//` value is
 * protocol-relative and already absolute. A feed item is read on someone else's origin, where a root-relative path resolves
 * against THEIR host.
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
 * For a site whose markdown renders math with KaTeX. A feed reader has no `katex.css`, so KaTeX's two trees (clipped MathML
 * and positioned HTML) would both show, garbled. The TeX comes from KaTeX's own annotation, taken still XML-escaped, because
 * unescaping would put a stray `<` into the reader's document.
 *
 * Counting spans is sound because nothing KaTeX nests inside an expression can close a span it did not open. An expression
 * with no closing tag or no annotation is left alone.
 *
 * @param {string} html
 */
export function mathToTex(html) {
  const source = String(html);
  let out = "";
  let cursor = 0;

  for (;;) {
    // `katex-display` WRAPS the `katex` span, so matching the inner one first would leave the outer wrapper behind, empty,
    // around a `$$`.
    const display = source.indexOf('<span class="katex-display">', cursor);
    const inline = source.indexOf('<span class="katex">', cursor);
    if (display === -1 && inline === -1) break;
    const start = display === -1 ? inline : inline === -1 ? display : Math.min(display, inline);
    const isDisplay = start === display;

    const end = spanEnd(source, start);
    if (end === -1) break;

    const region = source.slice(start, end);
    const annotation = region.match(/<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/);
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
