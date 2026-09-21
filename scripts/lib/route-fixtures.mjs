/**
 * Loader payloads for rendering public routes offline, built from the REPOSITORY'S OWN CORPUS.
 *
 * BOUNDARY: these are inputs, never measurements. A fixture decides how big a rendered page is, so
 * a fabricated one measures the fabrication: every field here is read from the content artifact or
 * from a data file the site itself ships, and nothing is invented to make a page render.
 *
 * WHY A ROUTE NEEDS ONE AT ALL. `route-render.mjs` stubs server-only modules at resolve time, so a
 * route component can be rendered in Node but its loader cannot be run: the stub answers every
 * name with a no-op and a named import from it binds undefined. A route whose loader reaches a
 * `.server` module therefore has no offline payload at all, which is why `check:page-payload`
 * measures twelve routes and names the three it cannot.
 *
 * THE SECOND STATEMENT, NAMED. `check-microformats.mjs` carries its own `postLoaderData` and its
 * own index fixture, and its comment says out loud that it is "a deliberate SECOND statement of
 * the projection". This is the third, and the duplication is real rather than clever: that gate
 * and this one were being changed by two different open pull requests when this file was written,
 * and an extraction across both would have made the conflict worse than the copy. What keeps them
 * honest in the meantime is that neither fixture can go quietly wrong: a field the component reads
 * and a fixture omits is a crash in the gate that owns it, not a silent hole. Merging the two is a
 * small follow-up once both land.
 */

/**
 * The loader payload one post page renders from, in the shape `blogPostView` produces.
 *
 * @param {any} record a built post record
 * @param {(record: any) => Date | null} revisedDate the sync's own revision rule
 */
export function postLoaderData(record, revisedDate) {
  return {
    toc: record.toc ?? [],
    seriesParts: [],
    mentions: [],
    post: {
      slug: record.slug,
      title: record.title,
      description: record.description ?? null,
      html: record.html ?? "",
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
 * One post as the listings project it, which is `postCard` in app/db plus its tags.
 *
 * @param {any} record
 */
export function listingCard(record) {
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
 * The index's payload for page one of the real corpus, tag and year filters listed but none
 * active, which is the page a reader arriving at /blog is served.
 *
 * THE TAG AND YEAR LISTS ARE DERIVED FROM THE POSTS, not stubbed empty: the filter rows are a
 * per-tag element each and 26 of them is a real part of what this page weighs.
 *
 * @param {any[]} ordered published records, newest first
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
 * The home page's payload. `health` is the `missing` state, which is the one state carrying no
 * numbers: a fabricated ratio would be a fabricated string length on a measured page.
 *
 * @param {any[]} ordered published records, newest first
 * @param {number} cards how many the Start here section shows, lead included
 */
export function homeLoaderData(ordered, cards) {
  return {
    gates: 0,
    posts: ordered.length,
    featured: ordered[0] ? listingCard(ordered[0]) : null,
    recent: ordered.slice(1, cards).map(listingCard),
    health: { state: "missing", total: 0, failed: 0, ageSeconds: 0, readAt: "" },
  };
}
