import { rmSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { bundleRoutes, importBundled, renderRoute } from "../lib/route-render.mjs";
import { buildArtifact, revisedDate } from "../build-content.mjs";

import {
  POSTS_PER_PAGE,
  pageCount,
  splitFeatured,
  startHere,
} from "../../app/lib/blog-listing.mjs";
import { postPath } from "../../app/lib/content/pipeline.mjs";

const { mf2 } = await import("microformats-parser");

console.log("\n  microformats\n");

/** @type {string[]} */
const failures = [];
let checks = 0;

/**
 * @param {string} label
 * @param {boolean} passed
 * @param {string} [detail]
 */
function assert(label, passed, detail = "") {
  checks += 1;
  if (!passed) failures.push(detail ? `${label}: ${detail}` : label);
}

/**
 * A second, narrow read on purpose: asking the pipeline would make the assertion `x === x`.
 *
 * @param {string} slug
 * @returns {Promise<string>}
 */
async function frontmatterDate(slug) {
  const raw = await readFile(postPath(slug), "utf8");
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
 * @param {any} item
 * @param {string} name
 * @returns {string | undefined}
 */
function prop(item, name) {
  const value = item?.properties?.[name];
  return Array.isArray(value) && value.length > 0 ? value[0] : undefined;
}

/**
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

// Built here, not read off disk: the artifact is gitignored, and a stale one would certify a
// corpus nobody serves.
let artifact;
try {
  artifact = JSON.parse(await buildArtifact());
} catch (error) {
  console.error(
    `  FAIL  microformats: the corpus would not build, so there is nothing to ` +
      `render.\n\n  ${error instanceof Error ? error.message : String(error)}\n\n  ` +
      `If this names content/generated/stack.json, run npm run build:stack first; ` +
      `check:all builds it for the tier.\n`,
  );
  throw new Error("microformats: the corpus would not build", { cause: error });
}
const published = artifact.posts.filter((/** @type {any} */ p) => !p.draft);

assert(
  "the corpus has published posts to render",
  published.length > 0,
  `${artifact.posts.length} post(s) built, ${published.length} published. This gate ` +
    `asserts nothing over an empty scope, so an empty one is a failure rather than a pass.`,
);
if (failures.length > 0) {
  console.error(`  FAIL  microformats stopped before rendering:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  throw new Error("microformats: the corpus has no published posts");
}

// seo.ts gets its own bundle call: esbuild derives `outbase` from the entries' common parent, and
// mixing it with the routes moves every output under a subdirectory.
const routes = await bundleRoutes([
  "app/routes/blog.$slug.tsx",
  "app/routes/blog._index.tsx",
  "app/routes/home.tsx",
]);
// Registered at once, so an assertion that throws anywhere below cannot leave the bundles behind:
// a top-level try/finally would re-indent the whole gate. rmSync throws on a real failure.
const removeRoutes = () => rmSync(routes.outDir, { recursive: true, force: true });
process.once("exit", removeRoutes);
const identity = await bundleRoutes(["app/lib/seo.ts"]);
const removeIdentity = () => rmSync(identity.outDir, { recursive: true, force: true });
process.once("exit", removeIdentity);
const cleanup = async () => {
  process.off("exit", removeRoutes);
  process.off("exit", removeIdentity);
  await routes.cleanup();
  await identity.cleanup();
};
const [postModule, indexModule, homeModule] = await Promise.all(
  routes.files.map(importBundled),
);
const seo = await importBundled(identity.files[0]);

const SITE = /** @type {any} */ (seo).SITE;
const SITE_ORIGIN = /** @type {any} */ (seo).SITE_ORIGIN;
const OWNER_PROFILES = /** @type {string[]} */ ([...(/** @type {any} */ (seo).OWNER_PROFILES ?? [])]);

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
  console.error(`  FAIL  microformats stopped before rendering:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  throw new Error("microformats: the site identity module did not load");
}

const EXPECTED_AUTHOR_URL = `${SITE_ORIGIN}/`;

/**
 * @param {any} record
 */
function postLoaderData(record) {
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
      // With no revision date the sync writes `unixepoch()`, so the assertion is the pairing.
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

  // Exactly one: two h-entries publish competing answers and a consumer takes the first.
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

  // By length, not byte for byte, or the equality becomes an assertion about the parser.
  const content = /** @type {any} */ (entry.properties?.content?.[0]);
  const bodyHtml = typeof content === "object" ? (content?.html ?? "") : "";
  assert(
    `${slug}: e-content carries the article body`,
    bodyHtml.length > 0 && bodyHtml.length >= Math.floor((record.html?.length ?? 0) * 0.5),
    `e-content html is ${bodyHtml.length} bytes against a rendered body of ` +
      `${record.html?.length ?? 0}. The class belongs on the .prose element that ` +
      `receives post.html, not on a wrapper around it.`,
  );

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

  const showsUpdated = />\s*Updated\s*</.test(html) || /·\s*Updated/.test(html);
  const updated = prop(entry, "updated");
  assert(
    `${slug}: dt-updated is present exactly when the page shows a revision`,
    showsUpdated === (updated !== undefined),
    `the page ${showsUpdated ? "shows" : "does not show"} an updated date and the ` +
      `parse ${updated === undefined ? "found no" : "found a"} dt-updated ` +
      `(${JSON.stringify(updated)}).`,
  );
  // Runs on every post: a full clone resolves a commit date for every post and a shallow one none.
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

  // Annotating the mentions list would republish a stranger's text as this site's structured data.
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

// Printed, not asserted: which branch runs is a property of the clone rather than of the code.
console.log(
  `  dt-updated: ${updatedSeen} post(s) carried a revision, ${unrevisedSeen} did not, ` +
    `from revisedDate (frontmatter updated:, else the file's last commit). A shallow ` +
    `clone has no history for most files and answers null, which is the absent branch.`,
);

const ordered = [...published].sort(
  (/** @type {any} */ a, /** @type {any} */ b) =>
    new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime(),
);
const totalPages = pageCount(ordered.length);

/**
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
    // Over the whole corpus, not this page, which is what `listBlogPosts` answers.
    total: ordered.length,
    span: {
      firstYear: year(ordered.at(-1)?.publishAt),
      lastYear: year(ordered[0]?.publishAt),
      minutes:
        ordered.reduce((n, p) => n + (p.readingTimeMinutes ?? 0), 0) || null,
    },
    expectedEntries: split.posts.length + (split.featured ? 1 : 0),
  };
}

/**
 * @param {string | number | Date | null | undefined} value
 */
function year(value) {
  if (!value) return null;
  return String(new Date(value).getUTCFullYear());
}

let feedsParsed = 0;

// Page 1 alone can carry a featured post and the last alone can be short. A set, because a
// one-page corpus makes them the same page.
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
  assert(
    "/: the h-card claims no u-photo, because the site publishes none",
    cards[0].properties?.photo === undefined,
    `h-card photo is ${JSON.stringify(cards[0].properties?.photo)}. If the site now ` +
      `shows a photograph of Dustin, add u-photo deliberately and change this ` +
      `assertion in the same commit.`,
  );
}

const homeEntries = home.items.filter((/** @type {any} */ i) => i.type.includes("h-entry"));
// The null lead already failed above; it is left out here rather than read as `null.slug`.
const homeExpected = homeFeatured ? [homeFeatured, ...homeRecent] : homeRecent;
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

// An h-card on `<main>` would make every consumer read the posts as properties of a person.
assert(
  "/: the Start here entries are siblings of the h-card, not children of it",
  (cards[0]?.children ?? []).length === 0,
  `the h-card has ${(cards[0]?.children ?? []).length} child item(s). The class has ` +
    `moved onto an ancestor of the post list.`,
);

const FORBIDDEN_HOSTS = ["bsky.app", "bsky.social", "mastodon.social", "fed.brid.gy"];

assert(
  "the owner's profile list loaded",
  OWNER_PROFILES.length >= 3,
  `app/lib/seo.ts yielded ${OWNER_PROFILES.length} profile(s); the rel="me" comparison below ` +
    `would pass against an empty expectation.`,
);

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
  const me = [...(parsed.rels?.me ?? [])].sort();
  const expected = [...OWNER_PROFILES].sort();
  assert(
    `${label}: rel="me" is exactly the owner's profiles`,
    me.length === expected.length && me.every((href, i) => href === expected[i]),
    `rel="me" points at ${JSON.stringify(me)}; OWNER_PROFILES is ${JSON.stringify(expected)}. ` +
      `The footer's profile links carry rel="me" and nothing else on the page may.`,
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

for (const f of failures) console.log(`  FAIL  ${f}`);
console.log(
  `  ${checks} assertions: ${postsParsed} post page(s) as h-entry, ${feedsParsed} index ` +
    `page(s) as h-feed, the home h-card, and the rel="me" set on two rendered pages. ` +
    `${failures.length} failure(s).`,
);

export const outcome = { checks, failures: failures.length };
