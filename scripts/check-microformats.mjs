/**
 * Gate: the microformats2 annotations on the public plane, parsed rather than
 * grepped.
 *
 *   npm run check:microformats
 *
 * Item I, ruling 50 as amended: microformats2 only. No `rel="me"`, no social
 * links; social presence lives with germomics. Section 5 holds that half.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It RENDERS THE THREE PUBLIC ROUTE COMPONENTS in Node, through
 * `scripts/lib/route-render.mjs`, the same door `check:admin-ui` uses, and
 * parses the result with `microformats-parser`. So it sees markup and nothing
 * else: no loader, no action, no D1, no network, no CSS, no Worker.
 *
 * What that means in practice, stated so nobody reads a pass here as more than
 * it is. A post whose ROW carries a wrong date renders a wrong date and passes
 * section 1's format assertions; what section 1 actually catches is the route
 * disagreeing with the MARKDOWN, because the expected value is read from the
 * markdown file and the component is fed the pipeline's rendering of the same
 * file. A page that 500s in production still parses here. Enhancement asset
 * URLs are stubbed (see `URL_ASSET`), so nothing about a script `src` is
 * assertable through this harness.
 *
 * ## WHY NOT `check:content`, WHICH IS WHERE THE PROMPT PUT IT
 *
 * That gate's own header states it "never renders a page in a Worker", and its
 * five subjects are the corpus render and four committed artifacts. The
 * microformats classes are in `blog.$slug.tsx`, `blog._index.tsx`,
 * `home.tsx` and `post-card.tsx`, which check:content does not read. Widening
 * it would have meant deleting a boundary note in order to make the file's own
 * description of itself false, which is the failure hard rule 7 names.
 *
 * ## WHY A REAL PARSER AND NOT A REGEX
 *
 * A regex over `class="h-entry"` asserts that a STRING is present. The property
 * that matters is what a CONSUMER READS, and those are not the same claim:
 * `p-name` on a `<div>` wrapping the whole page, `u-url` on an element with no
 * `href`, a `dt-published` on a `<time>` with no `datetime`, an h-card nested
 * one level too deep so it becomes a child rather than an `author` property.
 * Every one of those passes a string search and gives a reader nothing.
 *
 * `microformats-parser` is an exact-pinned devDependency. It does not ship: the
 * Worker never parses its own pages, and `build:stack` reads `dependencies`
 * only, so it does not reach the colophon either.
 *
 * The webmention receiver's own reader was the other candidate and could not
 * do the job. `readAuthor` in `app/lib/webmention/verify.server.ts` is linkedom
 * plus three `querySelector` calls for `.h-card`, `.p-name` and `.u-url`; it
 * has no notion of h-entry, e-content, dt-published, h-feed or p-summary, and
 * it imports `~/db`, so a Node gate cannot load it at all. Measured 2026-09-10.
 *
 * ## FIXTURE INDEPENDENCE
 *
 * Hard rule 10: a gate's expected values are never produced by the process it
 * checks. `dt-published` is compared against the `date:` line read straight out
 * of `content/posts/<slug>.md` by `frontmatterDate` below, which is a
 * deliberately separate read from the pipeline's. The component is fed the
 * PIPELINE's `publishAt`. So the chain under test is markdown to pipeline to
 * component to attribute, and a defect anywhere along it reds by slug.
 *
 * ## FAILS CLOSED
 *
 * A corpus with no published posts, a route that renders nothing, a parse that
 * finds no items: each is a failure with a name, never an empty pass. Every
 * section pairs its assertions with a count, and the whole gate carries an
 * executed-count floor measured by running.
 */

import { readFile } from "node:fs/promises";

import { assertFloor } from "./lib/floor.mjs";
import { bundleRoutes, importBundled, renderRoute } from "./lib/route-render.mjs";
import { buildArtifact } from "./build-content.mjs";

import { POSTS_PER_PAGE, pageCount, splitFeatured } from "../app/lib/blog-listing.mjs";
import { postPath } from "../app/lib/content/pipeline.mjs";

const { mf2 } = await import("microformats-parser");

/** @type {string[]} */
const failures = [];
let checks = 0;

/**
 * The reporter. `assert(label, ok, detail)` argument order, which is one of the
 * three shapes in this repo and is deliberately not the other two: a call
 * copied out of a gate using `ok(label, condition, detail)` is a ReferenceError
 * here rather than a silent pass. Hard rule 10, ninth class.
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
 * The `date:` line from a post's frontmatter, as an ISO instant.
 *
 * A SECOND, NARROW READ ON PURPOSE. The pipeline parses frontmatter with
 * gray-matter and produces `publishAt`; if this gate asked the pipeline for the
 * expected value it would be comparing the pipeline against itself and the
 * whole assertion would be `x === x`. So this reads the file's own bytes and
 * takes the first `date:` inside the opening `---` block.
 *
 * The scope is bounded to the frontmatter block rather than the whole file so a
 * `date:` written in prose cannot be mistaken for the field, and the needle is
 * anchored to the start of a line for the same reason.
 *
 * THE PATH COMES FROM `postPath()`, not from a join here. Hard rule 6 says the
 * `content/posts/<slug>.md` shape is stated once by that export, and the first
 * version of this file stated it four more times. `check:invariants` section
 * 15b caught all four on the first tier run, which is the gate doing exactly
 * what it exists for to a gate that had just been written.
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

// --- The corpus, and the scope proof --------------------------------------

/*
 * BUILT HERE, not read off disk. `content/generated/posts.json` is a gitignored
 * local product and a stale one would have this gate certify a corpus nobody is
 * serving. `buildArtifact()` returns the SERIALISED artifact, which is the
 * shape the file has, so it is parsed back rather than used as an object.
 *
 * It reads `content/generated/stack.json`, which `build:stack` writes, so a
 * fresh checkout that has not built reaches this line with the file absent.
 * The failure is named rather than thrown as ENOENT, because "no such file"
 * about a generated path sends the reader looking for a missing source.
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
 * SCOPE PROVEN NON-EMPTY BEFORE ANYTHING IS ASSERTED. A sweep over zero posts
 * reports exactly what a clean sweep reports, and this gate's whole first
 * section is a per-post loop. Hard rule 10, first discipline.
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
 * `app/lib/seo.ts` RIDES THROUGH THE SAME BUNDLER as the routes, and that is
 * not a convenience. It is TypeScript, so Node cannot import it directly, and
 * the alternatives were both worse: restating `SITE.name` and `SITE_ORIGIN`
 * here would make this gate a second owner of the site's identity (hard rule
 * 17), and reading them out of a rendered page would mean comparing the page
 * against itself.
 *
 * So the expectation and the subject share ONE source, deliberately. The
 * assertion below is "the h-card names the site's author", not "the h-card
 * says a particular string": if `SITE.name` changes, the card must follow it,
 * and that is the property worth holding.
 *
 * IN ITS OWN BUNDLE CALL, and that is not tidiness. esbuild derives `outbase`
 * from the common parent of its entry points, so mixing `app/lib/seo.ts` in
 * with the three `app/routes/*` entries moves the outbase up to `app/` and
 * every output lands under `routes/` and `lib/` instead of flat. The helper
 * maps outputs by basename, so the first import then fails with
 * ERR_MODULE_NOT_FOUND on a path that looks correct. `check:admin-ui` carries
 * the same note at its own single-entry bundle; this is the second victim.
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
    /*
     * NO MENTIONS. The mentions block carries no microformats class and is the
     * one region of the page whose text is a stranger's, so feeding it here
     * would put third-party-shaped fixtures into a gate about first-party
     * markup. `check:invariants` and the worker tests own that section.
     */
    mentions: [],
    post: {
      slug: record.slug,
      title: record.title,
      description: record.description ?? null,
      html: record.html ?? "",
      publishAt: record.publishAt ?? null,
      updatedAt: record.updated ?? null,
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
      furtherReading: record.furtherReading ?? [],
    },
  };
}

// --- 1. Every published post page is one complete h-entry -----------------

let postsParsed = 0;
let updatedSeen = 0;

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
   * EXACTLY ONE, not at least one. A page that grew a second h-entry (a related
   * card annotated by mistake, a mention marked up as an entry) publishes two
   * competing answers to "what is this page", and a consumer takes the first.
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
   * e-content IS ASSERTED AS THE BODY, not merely as present. `content` parses
   * to `{ value, html }`, and the html half is what a consumer republishes, so
   * a class landed on an empty wrapper would still satisfy "has content".
   * Compared against the rendered body's own length rather than byte-for-byte:
   * the parser normalises whitespace and resolves relative URLs inside the
   * fragment, so equality would be an assertion about the parser.
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
   * dt-updated IS CONDITIONAL AND THE GATE IS CONDITIONAL WITH IT, in both
   * directions. The route shows an updated date only when the revision is
   * further from publication than its own threshold, so requiring the property
   * everywhere would be an unfailable-in-reverse assertion: it would demand
   * markup for a fact most posts do not have. What IS asserted is the pairing.
   * A post whose page shows "Updated" and carries no `dt-updated` is a defect,
   * and so is a `dt-updated` on a page that shows no revision.
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
  if (updated !== undefined) {
    updatedSeen += 1;
    assert(
      `${slug}: dt-updated equals the row's updated timestamp`,
      updated === new Date(record.updated).toISOString(),
      `dt-updated is ${JSON.stringify(updated)}, the record says ` +
        `${JSON.stringify(record.updated)}.`,
    );
  }

  /*
   * NOTHING ELSE ON THE PAGE IS A MICROFORMAT. The mentions list is full of
   * author names, source links and timestamps that LOOK like h-entry material,
   * and annotating them would republish a stranger's text as this site's
   * structured data. So the whole-page item count is pinned: one h-entry, one
   * nested h-card, nothing more.
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

// --- 1b. dt-updated, exercised rather than assumed -----------------------

/*
 * MEASURED FIRST, THEN BUILT: `updatedSeen` is 0 of 11 against the real corpus,
 * because no post carries an `updated:` field in its frontmatter. So every
 * assertion above about `dt-updated` runs on its ABSENT branch, and the
 * property could be spelled wrong, bound to the wrong column or missing
 * entirely and section 1 would sweep clean. Hard rule 10's first class, in the
 * shape it usually arrives in: a condition that cannot currently be true.
 *
 * The repair is a rendered control rather than a fixture post. This renders a
 * REAL published post twice with a fabricated `updatedAt` and asserts the
 * threshold from both sides. It fabricates one field of loader data, which is
 * what the whole harness does anyway, and it puts nothing into the corpus.
 *
 * BOTH SIDES, because one is not a test. A component that emitted `dt-updated`
 * unconditionally would pass the "far" case alone, and one that never emitted
 * it would pass the "near" case alone.
 */
const REVISION_CONTROL_DAYS = 30;
const controlRecord = published[0];
const controlPublished = new Date(controlRecord.publishAt);

for (const [label, offsetMs, expectPresent] of /** @type {Array<[string, number, boolean]>} */ ([
  ["far past the threshold", REVISION_CONTROL_DAYS * 24 * 60 * 60 * 1000, true],
  // An hour is inside the route's one-day threshold, so it is a sync and not a revision.
  ["inside the threshold", 60 * 60 * 1000, false],
])) {
  const updatedAt = new Date(controlPublished.getTime() + offsetMs).toISOString();
  const base = postLoaderData(controlRecord);
  const html = await renderRoute(postModule, {
    path: "/blog/:slug",
    url: `/blog/${controlRecord.slug}`,
    loaderData: { ...base, post: { ...base.post, updatedAt } },
    params: { slug: controlRecord.slug },
  });
  const entry = mf2(html, { baseUrl: `${SITE_ORIGIN}/blog/${controlRecord.slug}` }).items.find(
    (/** @type {any} */ i) => i.type.includes("h-entry"),
  );
  const seen = prop(entry, "updated");

  assert(
    `dt-updated control, ${label}: the property is ${expectPresent ? "present" : "absent"}`,
    (seen !== undefined) === expectPresent,
    `rendering ${controlRecord.slug} with updatedAt ${updatedAt} against a publishAt ` +
      `of ${controlRecord.publishAt} parsed dt-updated as ${JSON.stringify(seen)}. The ` +
      `route shows a revision only past REVISED_THRESHOLD_MS, and the class must ` +
      `follow the label in both directions.`,
  );
  if (expectPresent) {
    updatedSeen += 1;
    assert(
      `dt-updated control, ${label}: the value is the revision timestamp`,
      seen === updatedAt,
      `dt-updated is ${JSON.stringify(seen)}, expected ${updatedAt}. A class bound to ` +
        `publishAt rather than updatedAt would render a plausible date here.`,
    );
  }
}

/*
 * THE COUNT IS PRINTED so a reader can see which branch ran. It is not asserted
 * against the corpus, because a corpus with no revised post is a legitimate
 * state; what makes the absence safe is 1b above, not this line.
 */
console.log(
  `  dt-updated exercised ${updatedSeen} time(s): ` +
    `${published.length} published post(s) carry no updated: frontmatter, so the ` +
    `control in section 1b is what proves the property works.`,
);

// --- 2. The blog index is one h-feed, holding the page it rendered --------

const ordered = [...published].sort(
  (/** @type {any} */ a, /** @type {any} */ b) =>
    new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime(),
);
const totalPages = pageCount(ordered.length);

/**
 * The index's loader payload for one page, built THROUGH the route's own paging
 * helpers rather than by slicing to a literal.
 *
 * Hard rule 10: measure floors through the gate's own pipeline. The count this
 * section asserts is derived from `POSTS_PER_PAGE` and `splitFeatured`, the two
 * functions the loader itself calls, so a change to the page size moves the
 * expectation and the page together and this gate keeps meaning what it said.
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
 * BOTH ENDS OF THE PAGINATION, and the first page is not enough on its own.
 * Page 1 is the only page that can carry a featured post, and the last page is
 * the only one whose length is not the page size. A gate that read page 1 alone
 * would pass a route that rendered ten entries no matter what it was asked for.
 *
 * A SET, because a corpus that fits on one page makes those two the same page
 * and rendering it twice would double this section's count without doubling
 * what it knows. The final assertion compares against `INDEX_PAGES.size` for
 * the same reason: the floor has to be what was actually asked for.
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
   * THE COUNT IS THE LOADER'S, NOT A LITERAL AND NOT THE CORPUS SIZE.
   *
   * The prompt asked for "the published count", and that is refuted by this
   * page: /blog paginates at POSTS_PER_PAGE and the corpus is larger, so the
   * index has never carried every published post and an assertion that it does
   * could only pass while the corpus stayed under the page size. What the page
   * genuinely promises is that every post it SHOWS is in its feed, featured
   * post included, and that is what this compares.
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
    /*
     * p-summary IS PAIRED WITH THE DESCRIPTION, in both directions. A card
     * renders the description only when the post has one, so requiring the
     * property unconditionally would demand markup for absent data, and
     * accepting its absence unconditionally would let the class fall off every
     * card without a single red.
     */
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
     * A LISTING ENTRY CARRIES NO e-content, and this is the assertion that
     * keeps a summary honest. A consumer that finds content on a card has been
     * handed a description labelled as the article.
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

// --- 3. The home page carries the site author's h-card --------------------

const homeFeatured = ordered.find((/** @type {any} */ p) => p.featured) ?? ordered[0];
const homeRecent = ordered.filter((/** @type {any} */ p) => p.slug !== homeFeatured.slug).slice(0, 2);
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
   * NO u-photo, ASSERTED. The site publishes no photograph of Dustin: the
   * Person JSON-LD beside this card carries no image and the page renders none.
   * A card claiming one would be pointing a consumer at something that does not
   * exist, which is hard rule 13's substituted value wearing an h-card.
   *
   * This assertion INVERTS the day a photo lands, which is correct: adding one
   * should be a deliberate edit here, not a silent inheritance.
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
 * THE h-card MUST NOT SWALLOW THE ENTRIES. The card is on `.home-intro` and the
 * Start here list is a sibling, so the entries parse at the top level. If the
 * class ever moved up to `<main>` the entries would become the card's children
 * and every consumer would read three posts as properties of a person.
 */
assert(
  "/: the Start here entries are siblings of the h-card, not children of it",
  (cards[0]?.children ?? []).length === 0,
  `the h-card has ${(cards[0]?.children ?? []).length} child item(s). The class has ` +
    `moved onto an ancestor of the post list.`,
);

// --- 4. No rel="me", no social links. Ruling 50. --------------------------

/*
 * ASSERTED ON THE RENDERED PAGES, not by grepping the source, because the
 * subject is what a consumer reads. `rel-urls` and `rels` are the parser's own
 * view of every rel on the document, so a `rel="me"` reaches this check however
 * it was written: a literal in JSX, a value composed at render time, or one
 * arriving through a component this gate does not know the name of.
 *
 * The social-network arm is the ruling's other half. It is a NAMED LIST rather
 * than a general "no outbound links" rule, because the site links out
 * constantly and always has; what ruling 50 forbids is these networks.
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

// --- Report ---------------------------------------------------------------

/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR.
 *
 * MEASURED BY RUNNING THIS GATE, never summed: 214 on 2026-09-10 over 11
 * published posts, two index pages, the home page and the two revision
 * controls. The count is a function of the corpus size (roughly nine per post
 * in section 1, four per card in section 2, and a fixed tail), so it moves when
 * a post is published and it steps DOWN when one is unpublished.
 *
 * The first number written here was 210, from an earlier run, and it was stale
 * by four before the file was saved. Re-measure by RUNNING, never by arithmetic
 * on the old number.
 *
 * FLOORED AT 205, AND `check:floors` CHOSE THAT NUMBER, not taste. The first
 * value written here was 190, a gap of 24 against a tolerance of 11, and the
 * floors gate refused it by name: 24 assertions could have stopped running and
 * this floor would still have passed. 205 leaves a gap of 9.
 *
 * WHAT THAT TIGHTNESS COSTS, stated rather than discovered later: unpublishing
 * a post removes roughly thirteen assertions from this sweep and would breach
 * this floor. That is the repo-wide trade `check:floors` imposes, and the
 * repair is the same as everywhere else, a re-measured floor in the same commit
 * as the corpus change. Publishing a post only ever moves the count up.
 */
const MINIMUM_CHECKS = 205;
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
