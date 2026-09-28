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
      ogTitle: record.ogTitle ?? null,
      ogDescription: record.ogDescription ?? null,
      related: record.related ?? [],
      backlinks: record.backlinks ?? [],
      changelog: record.changelog ?? null,
      furtherReading: record.furtherReading ?? [],
    },
  };
}

/**
 * @param {any} record
 */
function listingCard(record) {
  return {
    slug: record.slug,
    title: record.title,
    description: record.description ?? null,
    publishAt: record.publishAt ?? null,
    updatedAt: record.updatedAt ?? null,
    coverImage: record.cover?.src ?? null,
    coverAlt: record.cover?.alt ?? null,
    readingTimeMinutes: record.readingTimeMinutes ?? null,
    featured: Boolean(record.featured),
    series: record.series ?? null,
    part: record.part ?? null,
    tags: record.tags ?? [],
  };
}

/**
 * Tag and year lists are derived, not stubbed empty: the filter rows are a real part of the weight.
 *
 * @param {any[]} ordered
 * @param {number} perPage
 */
export function indexLoaderData(ordered, perPage) {
  const page = ordered.slice(0, perPage).map(listingCard);

  /** @type {Map<string, number>} */
  const tagTotals = new Map();
  for (const record of ordered) {
    for (const tag of record.tags ?? []) tagTotals.set(tag, (tagTotals.get(tag) ?? 0) + 1);
  }
  /** @type {Map<string, number>} */
  const yearTotals = new Map();
  for (const record of ordered) {
    if (!record.publishAt) continue;
    const year = String(new Date(record.publishAt).getUTCFullYear());
    yearTotals.set(year, (yearTotals.get(year) ?? 0) + 1);
  }

  const years = [...yearTotals.keys()].sort();
  return {
    posts: page,
    featured: null,
    tags: [...tagTotals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([slug, total]) => ({ slug, name: slug, total })),
    years: [...yearTotals.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, total]) => ({ year, total })),
    activeTag: null,
    activeYear: null,
    page: 1,
    pageCount: Math.max(1, Math.ceil(ordered.length / perPage)),
    total: ordered.length,
    span: {
      firstYear: years[0] ?? null,
      lastYear: years.at(-1) ?? null,
      minutes: ordered.reduce((n, p) => n + (p.readingTimeMinutes ?? 0), 0) || null,
    },
  };
}

/**
 * The sections other than Writing are empty: a fabricated paper or count would be a fabricated
 * string length on a measured page.
 *
 * @param {any[]} ordered
 * @param {number} cards
 */
export function homeLoaderData(ordered, cards) {
  return {
    posts: ordered.length,
    featured: ordered[0] ? listingCard(ordered[0]) : null,
    recent: ordered.slice(1, cards).map(listingCard),
    papers: [],
    paperCount: 0,
    discovery: { researchers: 0, cohorts: 0, since: 0 },
    podcast: null,
  };
}
