/**
 * A fixture decides how big a rendered page is, so a fabricated one measures the fabrication:
 * every field is read from the content artifact or a data file the site ships.
 */

/**
 * @param {any} record
 * @param {(record: any) => Date | null} revisedDate
 */
export function postLoaderData(record, revisedDate) {
  // Defaulted to "", a record without its body measured and parsed an empty page and passed.
  if (typeof record?.html !== "string" || record.html.length === 0) {
    throw new Error(`postLoaderData: ${record?.slug ?? "a record"} carries no rendered html`);
  }
  return {
    toc: record.toc ?? [],
    seriesParts: [],
    mentions: [],
    post: {
      slug: record.slug,
      title: record.title,
      description: record.description ?? null,
      html: record.html,
      publishAt: record.publishAt ?? null,
      updatedAt: revisedDate(record),
      coverImage: record.cover?.src ?? null,
      coverAlt: record.cover?.alt ?? null,
      ogImage: null,
      readingTimeMinutes: record.readingTimeMinutes ?? null,
      tags: record.tags ?? [],
      previous: null,
      next: null,
      series: record.series ?? null,
      part: record.part ?? null,
      // As blog-view.ts postAuthors reads the row: the front matter's names, else the site's owner.
      authors: record.authors ?? ["Dustin Edwards"],
      ogTitle: record.ogTitle ?? null,
      ogDescription: record.ogDescription ?? null,
      related: record.related ?? [],
      backlinks: record.backlinks ?? [],
      changelog: record.changelog ?? null,
      furtherReading: record.furtherReading ?? [],
    },
  };
}
