import { escapeXml, isoDay } from "./xml.mjs";

/**
 * @typedef {object} SitemapEntry
 * @property {string} loc absolute URL
 * @property {Date | number | string | null} [lastmod]
 * @property {string} [changefreq]
 * @property {number} [priority] 0 to 1
 */

/**
 * @typedef {object} SitemapOptions
 * @property {"compact" | "expanded"} [layout] compact is one line per url; expanded is one element per line
 * @property {"day" | "datetime"} [lastmodFormat] `2026-07-01` or `2026-07-01T12:00:00.000Z`
 * @property {boolean} [trailingNewline]
 */

/**
 * Sitemaps differ between the sites only in layout, lastmod precision and the trailing newline, so those are options and every
 * default is this site's own. `loc` is escaped: a URL with `&` in its query would otherwise end the document.
 *
 * @param {SitemapEntry[]} entries
 * @param {SitemapOptions} [options]
 * @returns {string}
 */
export function sitemapDocument(entries, options = {}) {
  const { layout = "compact", lastmodFormat = "day", trailingNewline = true } = options;
  const lastmodOf = (/** @type {SitemapEntry} */ entry) => {
    if (entry.lastmod === null || entry.lastmod === undefined) return null;
    return lastmodFormat === "day" ? isoDay(entry.lastmod) : datetime(entry.lastmod);
  };

  const rows = entries.map((entry) => {
    const lastmod = lastmodOf(entry);
    if (layout === "compact") {
      return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
    }
    return [
      "  <url>",
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>` : null,
      entry.priority === undefined ? null : `    <priority>${entry.priority.toFixed(1)}</priority>`,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join("\n")}
</urlset>${trailingNewline ? "\n" : ""}`;
}

/** @param {Date | number | string} value */
function datetime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
