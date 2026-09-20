/**
 * Gate: the microformats2 annotations on the public plane, parsed rather than grepped.
 *
 *   npm run check:microformats
 *
 * BOUNDARY: it RENDERS THE THREE PUBLIC ROUTE COMPONENTS in Node and parses the result, so it
 * sees markup and nothing else, and hard rule 7 is why it is not folded into `check:content`.
 * Its expected values come from a separate read of the markdown, which is hard rule 10.
 */

import { readFile } from "node:fs/promises";

import { assertFloor } from "./lib/floor.mjs";
import { bundleRoutes, importBundled, renderRoute } from "./lib/route-render.mjs";
import { buildArtifact, revisedDate } from "./build-content.mjs";

import {
  POSTS_PER_PAGE,
  pageCount,
  splitFeatured,
  startHere,
} from "../app/lib/blog-listing.mjs";
import { postPath } from "../app/lib/content/pipeline.mjs";

const { mf2 } = await import("microformats-parser");

/** @type {string[]} */
const failures = [];
let checks = 0;

/**
 * `assert(label, ok, detail)`, deliberately not the other two shapes here: a call copied out of a
 * gate using `ok(label, condition)` is a ReferenceError rather than a silent pass. Hard rule 10.
 *
 * @param {string} label
 * @param {boolean} passed
 * @param {string} [detail]
 */
function assert(label, passed, detail = "") {
  checks += 1;
  if (!passed) failures.push(detail ? `${label}: ${detail}` : label);
}

/**
 * A SECOND, NARROW READ ON PURPOSE: asking the pipeline would make the assertion `x === x`.
 * Bounded to the frontmatter block, and the path comes from `postPath()`, hard rule 6.
 *
 * @param {string} slug
 * @returns {Promise<string>} an ISO instant
 */
async function frontmatterDate(slug) {
  const raw = await readFile(postPath(slug), "utf8");
  // CRLF-tolerant. Two plants in this repo have already failed for want of it.
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?$/m.exec(raw);
  if (!fence) throw new Error(`${slug}.md has no frontmatter block`);
  const line = /^date:[ \t]*(.+?)[ \t]*$/m.exec(fence[1]);
  if (!line) throw new Error(`${slug}.md frontmatter carries no date: field`);
  const parsed = new Date(line[1].replace(/^["']|["']$/g, ""));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${slug}.md frontmatter date "${line[1]}" is not a date`);
  }
  return parsed.toISOString();
}

/**
 * The one property reader, so every section spells a lookup the same way.
 * @param {any} item
 * @param {string} name
 * @returns {string | undefined}
 */
function prop(item, name) {
  const value = item?.properties?.[name];
  return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
}

/** Every h-* item in a parse, flattened, so a count cannot miss a nested one.
 * @param {any[]} items
 * @returns {any[]}
 */
function flatten(items) {
  /** @type {any[]} */
  const out = [];
  const walk = (/** @type {any[]} */ list) => {
    for (const item of list ?? []) {
      out.push(item);
      walk(item.children);
      for (const values of Object.values(item.properties ?? {})) {
        walk(/** @type {any[]} */ (values).filter((v) => v && typeof v === "object" && v.type));
      }
    }
  };
  walk(items);
  return out;
}

// The corpus, and the scope proof

/*
 * BUILT HERE, not read off disk: the artifact is a gitignored local product, and a stale one
 * would certify a corpus nobody serves. The missing-file failure is NAMED, not an ENOENT.
 */
let artifact;
try {
  artifact = JSON.parse(await buildArtifact());
} catch (error) {
  console.error(
    `check:microformats FAILED: the corpus would not build, so there is nothing to ` +
      `render.\n\n  ${error instanceof Error ? error.message : String(error)}\n\n  ` +
      `If this names content/generated/stack.json, run npm run build:stack first; ` +
      `check:all builds it for the tier.\n`,
  );
  process.exit(1);
}
const published = artifact.posts.filter((/** @type {any} */ p) => !p.draft);

/*
 * SCOPE PROVEN NON-EMPTY FIRST: a sweep over zero posts reports what a clean sweep reports,
 * which is hard rule 10's first discipline.
 */
assert(
  "the corpus has published posts to render",
  published.length > 0,
  `${artifact.posts.length} post(s) built, ${published.length} published. This gate ` +
    `asserts nothing over an empty scope, so an empty one is a failure rather than a pass.`,
);
if (failures.length > 0) {
  console.error(`check:microformats FAILED before rendering:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

/*
 * `app/lib/seo.ts` RIDES THROUGH THE SAME BUNDLER, so expectation and subject share ONE source.
 * IN ITS OWN BUNDLE CALL, because esbuild derives `outbase` from the entry points' common
 * parent, and mixing it with the routes moves every output under a subdirectory.
 */
const routes = await bundleRoutes([
  "app/routes/blog.$slug.tsx",
  "app/routes/blog._index.tsx",
  "app/routes/home.tsx",
]);
const identity = await bundleRoutes(["app/lib/seo.ts"]);
const cleanup = async () => {
  await routes.cleanup();
  await identity.cleanup();
};
const [postModule, indexModule, homeModule] = await Promise.all(
  routes.files.map(importBundled),
);
const seo = await importBundled(identity.files[0]);

const SITE = /** @type {any} */ (seo).SITE;
const SITE_ORIGIN = /** @type {any} */ (seo).SITE_ORIGIN;

assert(
  "the site identity module loaded",
  typeof SITE?.name === "string" && typeof SITE_ORIGIN === "string",
  `app/lib/seo.ts yielded SITE=${JSON.stringify(SITE)} and ` +
    `SITE_ORIGIN=${JSON.stringify(SITE_ORIGIN)}. Every expected author name and ` +
    `canonical origin below would be undefined, and undefined compares equal to a ` +
    `missing property, so the whole gate would pass by reading nothing.`,
);
if (failures.length > 0) {
  await cleanup();
  console.error(`check:microformats FAILED before rendering:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

const EXPECTED_AUTHOR_URL = `${SITE_ORIGIN}/`;

/**
 * The loader payload one post page renders from, in the shape `blogPostView`
 * produces. Fed from the BUILT record, which is what production feeds it after
 * a sync, so the component sees the values it really sees.
 *
 * @param {any} record
 */
function postLoaderData(record) {
  return {
    toc: record.toc ?? [],
    seriesParts: [],
    /* NO MENTIONS: that block carries no microformats class and its text is a stranger's. */
    mentions: [],
    post: {
      slug: record.slug,
      title: record.title,
      description: record.description ?? null,
      html: record.html ?? "",
      publishAt: record.publishAt ?? null,
      /*
       * THE SAME SOURCE THE SYNC USES. This was the FRONTMATTER field, which no post carries, so the
       * gate was asserting a property it had arranged never to see. ONE HONEST DIFFERENCE, a bug in
       * neither place: with no revision date the sync writes `unixepoch()`, so the assertion is the
       * PAIRING and holds either way.
       */
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
      /*
       * The two lists the artifact now carries beside `related`. Spelled out rather than left
       * undefined: this fixture is a deliberate SECOND statement of the projection, so a field the
       * component reads and this object omits is a crash here and a silent hole in the assertion.
       */
      backlinks: record.backlinks ?? [],
      changelog: record.changelog ?? null,
      furtherReading: record.furtherReading ?? [],
    },
  };
}

// 1. Every published post page is one complete h-entry

let postsParsed = 0;
let updatedSeen = 0;
let unrevisedSeen = 0;

for (const record of published) {
  const slug = record.slug;
  const canonical = `${SITE_ORIGIN}/blog/${slug}`;

  const html = await renderRoute(postModule, {
    path: "/blog/:slug",
    url: `/blog/${slug}`,
    loaderData: postLoaderData(record),
    params: { slug },
  });
  const parsed = mf2(html, { baseUrl: canonical });
  const entries = parsed.items.filter((/** @type {any} */ i) => i.type.includes("h-entry"));

  /*
   * EXACTLY ONE, not at least one: two h-entries publish competing answers and a consumer takes
   * the first.
   */
  assert(
    `${slug}: exactly one top-level h-entry`,
    entries.length === 1,
    `parsed ${entries.length}. The post page must present itself as one entry.`,
  );
  if (entries.length !== 1) continue;
  postsParsed += 1;

  const entry = entries[0];

  assert(
    `${slug}: p-name is the post title`,
    prop(entry, "name") === record.title,
    `h-entry name is ${JSON.stringify(prop(entry, "name"))}, the post's title is ` +
      `${JSON.stringify(record.title)}. The class belongs on the <h1>.`,
  );

  assert(
    `${slug}: u-url is the canonical URL`,
    prop(entry, "url") === canonical,
    `h-entry url is ${JSON.stringify(prop(entry, "url"))}, expected ${canonical}. ` +
      `The class belongs on the Permalink anchor, which already holds that value.`,
  );

  /*
   * e-content IS ASSERTED AS THE BODY: a class on an empty wrapper still satisfies "has content".
   * By length rather than byte for byte, or the equality is an assertion about the parser.
   */
  const content = /** @type {any} */ (entry.properties?.content?.[0]);
  const bodyHtml = typeof content === "object" ? (content?.html ?? "") : "";
  assert(
    `${slug}: e-content carries the article body`,
    bodyHtml.length > 0 && bodyHtml.length >= Math.floor((record.html?.length ?? 0) * 0.5),
    `e-content html is ${bodyHtml.length} bytes against a rendered body of ` +
      `${record.html?.length ?? 0}. The class belongs on the .prose element that ` +
      `receives post.html, not on a wrapper around it.`,
  );

  /*
   * THE FRONTMATTER COMPARISON. The expected value comes from the markdown
   * file; the actual comes from the rendered attribute. See the header.
   */
  const expected = await frontmatterDate(slug);
  assert(
    `${slug}: dt-published equals the frontmatter date`,
    prop(entry, "published") === expected,
    `the page publishes ${JSON.stringify(prop(entry, "published"))} and ` +
      `${postPath(slug)} says ${expected}.`,
  );

  const author = /** @type {any} */ (entry.properties?.author?.[0]);
  const isCard = typeof author === "object" && Boolean(author?.type?.includes("h-card"));
  assert(
    `${slug}: p-author is an h-card`,
    isCard,
    `author parsed as ${JSON.stringify(author)}. It must be a nested h-card, not a ` +
      `bare string, or a consumer gets a name with no identity behind it.`,
  );
  if (isCard) {
    assert(
      `${slug}: the author h-card carries p-name`,
      prop(author, "name") === SITE.name,
      `author name is ${JSON.stringify(prop(author, "name"))}, expected ${SITE.name}.`,
    );
    assert(
      `${slug}: the author h-card u-url points at the home page`,
      prop(author, "url") === EXPECTED_AUTHOR_URL,
      `author url is ${JSON.stringify(prop(author, "url"))}, expected ${EXPECTED_AUTHOR_URL}.`,
    );
  }

  /*
   * dt-updated IS CONDITIONAL AND THE GATE IS CONDITIONAL WITH IT, both ways: what is asserted is
   * the pairing, a page showing "Updated" with no `dt-updated` and the reverse.
   */
  const showsUpdated = />\s*Updated\s*</.test(html) || /·\s*Updated/.test(html);
  const updated = prop(entry, "updated");
  assert(
    `${slug}: dt-updated is present exactly when the page shows a revision`,
    showsUpdated === (updated !== undefined),
    `the page ${showsUpdated ? "shows" : "does not show"} an updated date and the ` +
      `parse ${updated === undefined ? "found no" : "found a"} dt-updated ` +
      `(${JSON.stringify(updated)}).`,
  );
  /*
   * THE VALUE ASSERTION RUNS ON EVERY POST: conditioning it made the count depend on the CHECKOUT,
   * a full clone resolving a commit date for every post and a shallow one none. The expectation is
   * derived from what the PAGE rendered, which leaves hard rule 17's one owner of the threshold
   * where it belongs, with the route.
   */
  if (updated === undefined) unrevisedSeen += 1;
  else updatedSeen += 1;
  const expectedUpdated = showsUpdated ? revisedDate(record)?.toISOString() : undefined;
  assert(
    `${slug}: dt-updated is the revision date the sync would write, or absent`,
    updated === expectedUpdated,
    `dt-updated parsed as ${JSON.stringify(updated)}; the page ` +
      `${showsUpdated ? "shows" : "shows no"} revision and revisedDate says ` +
      `${JSON.stringify(revisedDate(record)?.toISOString())}.`,
  );

  /*
   * NOTHING ELSE ON THE PAGE IS A MICROFORMAT: annotating the mentions list would republish a
   * stranger's text as this site's structured data.
   */
  const all = flatten(parsed.items);
  assert(
    `${slug}: the page publishes exactly one h-entry and one h-card`,
    all.length === 2,
    `parsed ${all.length} microformat item(s): ` +
      `${all.map((/** @type {any} */ i) => i.type.join("+")).join(", ")}. A mention or a ` +
      `related card has picked up an annotation it must not have.`,
  );
}

assert(
  "every published post rendered and parsed",
  postsParsed === published.length,
  `${postsParsed} of ${published.length} parsed to a single h-entry.`,
);

/*
 * BOTH dt-updated BRANCHES, COUNTED AND PRINTED, and neither fabricated. Not asserted against a
 * fixed split, because which branch runs is a property of the clone rather than of the code.
 */
console.log(
  `  dt-updated: ${updatedSeen} post(s) carried a revision, ${unrevisedSeen} did not, ` +
    `from revisedDate (frontmatter updated:, else the file's last commit). A shallow ` +
    `clone has no history for most files and answers null, which is the absent branch.`,
);

// 2. The blog index is one h-feed, holding the page it rendered

const ordered = [...published].sort(
  (/** @type {any} */ a, /** @type {any} */ b) =>
    new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime(),
);
const totalPages = pageCount(ordered.length);

/**
 * Built THROUGH the route's own paging helpers rather than by slicing to a literal, which is
 * hard rule 10's measure-floors-through-the-pipeline: a page size change moves both together.
 *
 * @param {number} page
 */
function indexLoaderData(page) {
  const slice = ordered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
  const split = splitFeatured(slice, page === 1);
  return {
    posts: split.posts,
    featured: split.featured,
    tags: [],
    years: [],
    activeTag: null,
    activeYear: null,
    page,
    pageCount: totalPages,
    /** The number of entries the page will render, which is what section 2 asserts. */
    expectedEntries: split.posts.length + (split.featured ? 1 : 0),
  };
}

let feedsParsed = 0;

/*
 * BOTH ENDS OF THE PAGINATION: page 1 is the only one that can carry a featured post and the
 * last the only one not the page size. A SET, because a one-page corpus makes them the same page.
 */
const INDEX_PAGES = new Set([1, totalPages]);
for (const page of INDEX_PAGES) {
  const payload = indexLoaderData(page);
  const url = page === 1 ? "/blog" : `/blog?page=${page}`;
  const html = await renderRoute(indexModule, {
    path: "/blog",
    url,
    loaderData: payload,
  });
  const parsed = mf2(html, { baseUrl: `${SITE_ORIGIN}${url}` });
  const feeds = parsed.items.filter((/** @type {any} */ i) => i.type.includes("h-feed"));

  assert(
    `/blog page ${page}: exactly one h-feed`,
    feeds.length === 1,
    `parsed ${feeds.length}. The index is one feed, and two would make a reader ` +
      `choose which of them is the blog.`,
  );
  if (feeds.length !== 1) continue;
  feedsParsed += 1;

  const feed = feeds[0];
  const feedName = prop(feed, "name");
  assert(
    `/blog page ${page}: the feed carries p-name`,
    typeof feedName === "string" && feedName.length > 0,
    `feed name parsed as ${JSON.stringify(feedName)}. Without the class on ` +
      `the <h1> a parser implies nothing here, because the feed has nested children.`,
  );

  const children = (feed.children ?? []).filter((/** @type {any} */ c) =>
    c.type.includes("h-entry"),
  );

  /*
   * THE COUNT IS THE LOADER'S: /blog paginates, so "the index carries every published post" could
   * only pass while the corpus stayed under the page size. The promise is about what it SHOWS.
   */
  assert(
    `/blog page ${page}: the feed holds every entry the page rendered`,
    children.length === payload.expectedEntries,
    `the feed has ${children.length} h-entry child(ren) and the loader paged ` +
      `${payload.expectedEntries} post(s) (${payload.posts.length} in the list, ` +
      `${payload.featured ? "1 featured" : "no featured post"}). A featured post that ` +
      `is split out of the list and left out of the feed is invisible to a consumer ` +
      `and visible to a reader.`,
  );

  const expectedSlugs = [
    ...(payload.featured ? [payload.featured.slug] : []),
    ...payload.posts.map((/** @type {any} */ p) => p.slug),
  ];
  for (const slug of expectedSlugs) {
    const record = ordered.find((/** @type {any} */ p) => p.slug === slug);
    const wanted = `${SITE_ORIGIN}/blog/${slug}`;
    const child = children.find((/** @type {any} */ c) => prop(c, "url") === wanted);
    assert(
      `/blog page ${page}: ${slug} is an entry in the feed`,
      Boolean(child),
      `no h-entry in the feed carries u-url ${wanted}.`,
    );
    if (!child) continue;

    assert(
      `/blog page ${page}: ${slug} carries p-name`,
      prop(child, "name") === record.title,
      `entry name is ${JSON.stringify(prop(child, "name"))}, expected ` +
        `${JSON.stringify(record.title)}.`,
    );
    assert(
      `/blog page ${page}: ${slug} carries dt-published from the frontmatter`,
      prop(child, "published") === (await frontmatterDate(slug)),
      `entry published is ${JSON.stringify(prop(child, "published"))}, ` +
        `${postPath(slug)} says ${await frontmatterDate(slug)}.`,
    );
    /* p-summary IS PAIRED WITH THE DESCRIPTION both ways, or the class falls off every card unseen. */
    assert(
      `/blog page ${page}: ${slug} carries p-summary exactly when it has a description`,
      (prop(child, "summary") !== undefined) === Boolean(record.description),
      `entry summary is ${JSON.stringify(prop(child, "summary"))} and the post's ` +
        `description is ${JSON.stringify(record.description)}.`,
    );
    if (record.description) {
      assert(
        `/blog page ${page}: ${slug} p-summary is the description`,
        prop(child, "summary") === record.description,
        `entry summary is ${JSON.stringify(prop(child, "summary"))}.`,
      );
    }

    /*
     * A LISTING ENTRY CARRIES NO e-content: a consumer finding content on a card has a description
     * labelled as the article.
     */
    assert(
      `/blog page ${page}: ${slug} publishes no e-content`,
      child.properties?.content === undefined,
      `the card parsed an e-content of ${JSON.stringify(child.properties?.content)}. A ` +
        `listing entry is a summary; the body lives at its u-url.`,
    );
  }
}

assert(
  "both ends of the index pagination parsed",
  feedsParsed === INDEX_PAGES.size,
  `${feedsParsed} of ${INDEX_PAGES.size} index page(s) parsed to one h-feed.`,
);

// 3. The home page carries the site author's h-card

/*
 * THE HOME FIXTURE IS DERIVED, NOT SUPPLIED: it was a third statement of which post leads the
 * front page, written by the gate checking it, asserting a section production never rendered.
 */
const homeFeaturedRows = ordered.filter((/** @type {any} */ p) => p.featured);
const homeOtherRows = ordered.filter((/** @type {any} */ p) => !p.featured);
const { featured: homeFeatured, recent: homeRecent } = startHere(
  homeFeaturedRows,
  homeOtherRows,
);

assert(
  "the home Start here section has a lead to render",
  homeFeatured !== null,
  `startHere returned no lead from ${homeFeaturedRows.length} featured and ` +
    `${homeOtherRows.length} other published post(s). The section is behind ` +
    `{featured ? ... : null}, so a null lead renders nothing and every assertion ` +
    `below would pass over an empty page.`,
);
const homeHtml = await renderRoute(homeModule, {
  path: "/",
  url: "/",
  loaderData: {
    gates: 0,
    posts: ordered.length,
    featured: homeFeatured,
    recent: homeRecent,
    /* `missing` is the state with no numbers in it, so the tile renders its
       dash and this gate asserts nothing about a health verdict. */
    health: { state: "missing", total: 0, failed: 0, ageSeconds: 0, readAt: "" },
  },
});
const home = mf2(homeHtml, { baseUrl: `${SITE_ORIGIN}/` });
const cards = home.items.filter((/** @type {any} */ i) => i.type.includes("h-card"));

assert(
  "/: exactly one h-card",
  cards.length === 1,
  `parsed ${cards.length}. The home page identifies one person.`,
);
if (cards.length === 1) {
  assert(
    "/: the h-card p-name is the site author",
    prop(cards[0], "name") === SITE.name,
    `h-card name is ${JSON.stringify(prop(cards[0], "name"))}, expected ${SITE.name}.`,
  );
  assert(
    "/: the h-card u-url is the home page",
    prop(cards[0], "url") === EXPECTED_AUTHOR_URL,
    `h-card url is ${JSON.stringify(prop(cards[0], "url"))}, expected ` +
      `${EXPECTED_AUTHOR_URL}.`,
  );
  /*
   * NO u-photo, ASSERTED: the site publishes no photograph, so a card claiming one is the
   * substituted value hard rule 13 names, wearing an h-card. It INVERTS the day a photo lands.
   */
  assert(
    "/: the h-card claims no u-photo, because the site publishes none",
    cards[0].properties?.photo === undefined,
    `h-card photo is ${JSON.stringify(cards[0].properties?.photo)}. If the site now ` +
      `shows a photograph of Dustin, add u-photo deliberately and change this ` +
      `assertion in the same commit.`,
  );
}

const homeEntries = home.items.filter((/** @type {any} */ i) => i.type.includes("h-entry"));
const homeExpected = [homeFeatured, ...homeRecent];
assert(
  "/: the Start here list is h-entries, one per card",
  homeEntries.length === homeExpected.length,
  `parsed ${homeEntries.length} h-entry item(s) against ${homeExpected.length} card(s). ` +
    `That list does not use PostCard, so its classes are written by hand and this is ` +
    `the assertion that stops the two surfaces drifting.`,
);
for (const record of homeExpected) {
  const wanted = `${SITE_ORIGIN}/blog/${record.slug}`;
  const entry = homeEntries.find((/** @type {any} */ e) => prop(e, "url") === wanted);
  assert(
    `/: ${record.slug} is an h-entry in the Start here list`,
    Boolean(entry),
    `no h-entry carries u-url ${wanted}.`,
  );
  if (!entry) continue;
  assert(
    `/: ${record.slug} carries p-name`,
    prop(entry, "name") === record.title,
    `entry name is ${JSON.stringify(prop(entry, "name"))}.`,
  );
  assert(
    `/: ${record.slug} carries dt-published from the frontmatter`,
    prop(entry, "published") === (await frontmatterDate(record.slug)),
    `entry published is ${JSON.stringify(prop(entry, "published"))}, ` +
      `${postPath(record.slug)} says ${await frontmatterDate(record.slug)}.`,
  );
}

/*
 * THE h-card MUST NOT SWALLOW THE ENTRIES: on `<main>` every consumer reads three posts as
 * properties of a person.
 */
assert(
  "/: the Start here entries are siblings of the h-card, not children of it",
  (cards[0]?.children ?? []).length === 0,
  `the h-card has ${(cards[0]?.children ?? []).length} child item(s). The class has ` +
    `moved onto an ancestor of the post list.`,
);

// 4. No rel="me", no social links. Ruling 50.

/*
 * ASSERTED ON THE RENDERED PAGES: the parser's view of every rel catches one however it was
 * written. The social arm is a NAMED LIST, the site linking out constantly.
 */
const FORBIDDEN_HOSTS = ["bsky.app", "bsky.social", "mastodon.social", "fed.brid.gy"];

for (const [label, html] of /** @type {Array<[string, string]>} */ ([
  ["/", homeHtml],
  [
    "/blog/" + published[0].slug,
    await renderRoute(postModule, {
      path: "/blog/:slug",
      url: `/blog/${published[0].slug}`,
      loaderData: postLoaderData(published[0]),
      params: { slug: published[0].slug },
    }),
  ],
])) {
  const parsed = mf2(html, { baseUrl: SITE_ORIGIN });
  assert(
    `${label}: publishes no rel="me"`,
    parsed.rels?.me === undefined,
    `rel="me" points at ${JSON.stringify(parsed.rels?.me)}. Ruling 50 as amended: no ` +
      `rel="me" and no social links on this site; social presence lives with germomics.`,
  );
  for (const host of FORBIDDEN_HOSTS) {
    assert(
      `${label}: links to no ${host}`,
      !html.includes(host),
      `the rendered page carries a ${host} URL. Ruling 50: no Mastodon, no Bluesky, ever.`,
    );
  }
}

await cleanup();

// Report

/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE. It moves with the corpus size
 * and steps DOWN when a post is unpublished, and it does NOT move with the checkout, which is
 * load bearing for CI. WHAT THE TIGHTNESS COSTS: unpublishing breaches it, and the repair is a
 * re-measured floor in the same commit.
 */
const MINIMUM_CHECKS = 226;
const floorBreach = assertFloor(
  "check:microformats",
  "checks",
  checks,
  MINIMUM_CHECKS,
  `Sections are a per-post loop, so a skipped render is a silently smaller sweep.`,
);
if (floorBreach) failures.push(floorBreach);

if (failures.length > 0) {
  console.error(`check:microformats FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `check:microformats ok. ${checks} assertions: ${postsParsed} post page(s) as h-entry, ` +
    `${feedsParsed} index page(s) as h-feed, the home h-card, and ruling 50 on two ` +
    `rendered pages. 0 failures.`,
);
