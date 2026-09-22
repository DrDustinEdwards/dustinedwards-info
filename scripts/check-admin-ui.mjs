/**
 * Gate over what the admin's forms submit: each page reduces to `METHOD action | intent |
 * field names`, so a control may move but must send what it sent before. Server imports are
 * stubbed; no server behavior, styling or layout is seen. Fails closed: a missing fixture is
 * an error, and every comparison is paired with a count.
 *
 *   npm run check:admin-ui
 *   npm run check:admin-ui -- --update    (rewrites the baseline, deliberately loud)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assertFloor } from "./lib/floor.mjs";
import { stripComments } from "./lib/strip-comments.mjs";

import { SLUG_ATTRIBUTE_PATTERN, SLUG_PATTERN } from "../app/lib/content/pipeline.mjs";
import { CONFIRM_FIELD } from "../app/lib/destructive.mjs";
// Asserted against the constants: a copy would be a second owner (hard rule 17).
import {
  FAILED_RETENTION_DAYS,
  REJECTED_RETENTION_DAYS,
} from "../app/lib/webmention/retention.mjs";
// Asserted against the constant, not a copy.
import { CACHE_SENTENCE } from "../app/lib/admin/origin-requests.mjs";
import { decide, readState } from "../app/lib/editor/publish-policy.mjs";
import {
  DEFAULTS as MEDIA_DEFAULTS,
  DISPLAY_AXES,
  GROUPS,
  SIZES,
  VIEWS,
} from "../app/lib/media/view.mjs";
import {
  DRAFT_BY_INTENT,
  PUBLISH_CONFIRMED_INTENT,
  draftForIntent,
  saveInPlaceIntent,
  stateOf,
  transitionsFor,
} from "../app/lib/editor/publish-transition.mjs";
import {
  bundleRoutes,
  importBundled,
  renderRoute,
  submissionKeys,
} from "./lib/route-render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(root, "scripts", "fixtures", "admin-ui-payloads.json");
const update = process.argv.includes("--update");

/* Read from the owner, never retyped. Dynamic: this tsconfig omits the app tree. */
const { CHECK_COPY: checkCopy } = await import("../app/lib/admin/check-copy.mjs");

let checks = 0;
let failures = 0;
/** @param {string} label */
function fail(label) {
  failures += 1;
  console.log(`\n  FAIL  ${label}`);
}
/** @param {string} label @param {boolean} ok @param {string} [detail] */
function assert(label, ok, detail = "") {
  checks += 1;
  if (!ok) fail(`${label}${detail ? `\n    ${detail}` : ""}`);
}

/* Loader states: one per shape that changes which controls render. */

const POSTS = [
  // Exactly one featured row, so an ignored flag fails.
  { slug: "live-one", title: "A live post", status: "published", state: "published", publishAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z", tags: ["cloudflare"], scheduledInDays: null, featured: true },
  // Pre-computed: the component may not read the clock.
  { slug: "soon", title: "A scheduled post", status: "published", state: "scheduled", publishAt: "2099-01-02T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z", tags: ["cloudflare", "d1"], scheduledInDays: 12, featured: false },
  { slug: "wip", title: "A draft post", status: "draft", state: "draft", publishAt: null, updatedAt: "2026-07-02T00:00:00.000Z", tags: [], scheduledInDays: null, featured: false },
];

/** One media object. */
const MEDIA_OBJECT = (over = {}) => ({
  key: "1234abcd5678ef90.png",
  url: "/media/1234abcd5678ef90.png",
  // The thumbnail url, so serving originals changes the src.
  thumb: "/media/1234abcd5678ef90.png?w=320",
  size: 51234,
  uploaded: "2026-08-01T10:00:00.000Z",
  alt: "",
  caption: "",
  width: 1200,
  height: 630,
  storage: "r2",
  kind: "image",
  role: "content",
  mime: "image/png",
  originalName: "a-picture.png",
  // Null placeholders are their own scenario.
  placeholder: "data:image/webp;base64,UklGRg==",
  deletable: true,
  viewable: true,
  citations: [],
  refCount: 0,
  /** Parsed by the loader. */
  tags: [],
  /** Byte-identical rows. */
  twinCount: 0,
  /* A fresh upload is `unattached`. */
  usage: "unattached",
  templateRefs: [],
  ...over,
});

/** The loader's non-object fields, in one helper. */
const MEDIA_SHELL = (over = {}) => ({
  picker: false,
  page: 1,
  hasMore: false,
  filter: "content",
  scanComplete: true,
  scanFailed: [],
  counts: [{ storage: "r2", kind: "image", n: 1 }],
  roleCounts: [{ role: "content", n: 1 }],
  /* `q` is echoed so the input, chips and pager carry it. */
  q: "",
  detail: null,
  uploaded: null,
  uploadError: null,
  /* Passed as an object, as the component receives it. */
  view: {
    view: "list",
    group: "folder",
    sort: "added",
    dir: "desc",
    size: "m",
    role: "content",
    q: "",
    tag: "",
    page: 1,
    trash: false,
    key: "",
    /* The confirmation modal is a URL parameter like the rest. */
    confirm: "",
  },
  modified: false,
  trashedCount: 0,
  tagCounts: [],
  lensCounts: { all: 1, unattached: 1, noAlt: 1, large: 0, duplicates: 0 },
  /* Input only: the wording is asserted against the route source. */
  usageNote:
    "Usage is asked three ways: what a post cites, what the artifact scan " +
    "finds, and what repository code references.",
  ...over,
});

/** The `?key=` view's loader shape. */
const MEDIA_DETAIL = (over = {}) => ({
  found: true,
  key: "1234abcd5678ef90.png",
  url: "/media/1234abcd5678ef90.png",
  thumb: "/media/1234abcd5678ef90.png?w=640",
  viewable: true,
  deletable: true,
  originalName: "a-picture.png",
  role: "content",
  storage: "r2",
  kind: "image",
  mime: "image/png",
  bytes: 51234,
  width: 1200,
  height: 630,
  alt: "",
  caption: "",
  uploadedAt: "2026-08-01T10:00:00.000Z",
  placeholder: "data:image/webp;base64,UklGRg==",
  refs: [],
  citations: [],
  scanComplete: true,
  tags: [],
  trashedAt: null,
  hash: "1234abcd5678ef90",
  twins: [],
  usage: "unattached",
  templateRefs: [],
  altSuggestion: "a picture",
  tagSuggestions: [],
  ...over,
});

/** Every filter empty. */
const NO_FILTERS = {
  filters: { q: "", status: "", tag: "" },
  filtered: false,
  total: POSTS.length,
  scheduledTotal: 1,
  tagOptions: ["cloudflare", "d1", "workers"],
};

/* A missing number is not a zero; the live pair differs only in `complete`. */
const READERSHIP_LIVE = {
  status: "live",
  fetchedAt: "2026-09-04T00:00:00.000Z",
  data: {
    windowDays: 7,
    // `wip` is absent from both live fixtures.
    byPath: { "/blog/live-one": 1234, "/blog/soon": 7 },
    pathsReturned: 2,
    complete: true,
  },
};

/** Same rows, cut short: the missing slug is unknown. */
const READERSHIP_TRUNCATED = {
  status: "live",
  fetchedAt: "2026-09-04T00:00:00.000Z",
  data: {
    windowDays: 7,
    byPath: { "/blog/live-one": 1234, "/blog/soon": 7 },
    pathsReturned: 900,
    complete: false,
  },
};

/** No token, so no number. */
const READERSHIP_ERROR = {
  status: "error",
  data: null,
  message:
    "No Analytics Engine read token is configured, so there is nothing to " +
    "query. Set ANALYTICS_READ_TOKEN as a Worker secret to turn this on.",
};

const ASK_CLEAN = { present: 93, expected: 93, missing: [], stale: [] };
const ASK_DRIFTED = { present: 90, expected: 93, missing: ["a", "b", "c"], stale: ["x"] };
const BUDGET = { count: 4, limit: 200, day: "2026-07-31" };

/** @param {Partial<Record<string, unknown>>} over */
/* The whole `PostFields` shape: an unsupplied loader field is untested. */
const fields = (over = {}) => ({
  title: "A post",
  slug: "a-post",
  description: "What it is about.",
  date: "2026-07-31",
  tags: ["cloudflare", "d1"],
  draft: true,
  publishAt: "",
  coverSrc: "",
  coverAlt: "",
  body: "# Heading\n\nProse.\n",
  firstPublished: "",
  featured: false,
  series: "",
  part: "",
  furtherReading: "",
  ogTitle: "",
  ogDescription: "",
  updated: "",
  ...over,
});

const HEAD = "abc1234def5678";

/* Hand-written (fixture independence); first six characters differ, as the list prints six. */
const TOKEN_TAIL = "0123456789012345678901234567890123456";
const PREVIEW_TOKENS = [`AbCdEf${TOKEN_TAIL}`, `ZyXwVu${TOKEN_TAIL}`];

/** Origin for absolute preview URLs. */
const PREVIEW_ORIGIN = "https://example.test";

const PREVIEW_LINKS = PREVIEW_TOKENS.map((token, i) => ({
  token,
  short: token.slice(0, 6),
  url: `${PREVIEW_ORIGIN}/preview/${token}`,
  createdAt: `2026-08-1${i + 2}T10:00:00.000Z`,
  expiresAt: `2026-08-${19 + i}T10:00:00.000Z`,
  createdBy: "dustin@example.test",
  note: "",
}));

/** The edit route's loader data. */
const editLoader = (over = {}) => ({
  fields: fields(),
  headSha: HEAD,
  slug: "a-post",
  saved: null,
  tagOptions: ["cloudflare", "d1", "workers"],
  // The component reads it.
  linkTargets: [
    { slug: "live-one", title: "A live post", state: "published" },
    { slug: "wip", title: "A draft post", state: "draft" },
  ],
  // Rendered, so a restore is proven to add no submission.
  revisions: [
    { sha: "1111111111111111111111111111111111111111", message: "Latest edit", author: "Dustin Edwards", date: "2026-08-01T10:00:00Z" },
    { sha: "2222222222222222222222222222222222222222", message: "An earlier edit", author: "Dustin Edwards", date: "2026-07-30T09:00:00Z" },
  ],
  everPublished: false,
  state: "draft",
  /* The section follows `state`, not the length. */
  previewLinks: [],
  ...over,
});

/* Hand-authored (fixture independence); `originRequests` differs from `rows`. */
const TRAFFIC_LIVE = {
  status: "live",
  fetchedAt: "2026-08-14T12:00:00.000Z",
  data: {
    windowDays: 7,
    totalOriginRequests: 940,
    pathsReturned: 23,
    rows: [
      { path: "/", originRequests: 412, rows: 412 },
      { path: "/blog", originRequests: 168, rows: 168 },
      { path: "/playground", originRequests: 96, rows: 48 },
      { path: "/colophon", originRequests: 41, rows: 41 },
    ],
  },
};

const TRAFFIC_EMPTY = {
  status: "live",
  fetchedAt: "2026-08-14T12:00:00.000Z",
  data: { windowDays: 7, totalOriginRequests: 0, pathsReturned: 0, rows: [] },
};

const TRAFFIC_ERROR = {
  status: "error",
  data: null,
  message:
    "No Analytics Engine read token is configured, so this panel has nothing to " +
    "query. Set ANALYTICS_READ_TOKEN as a Worker secret to turn it on.",
};

/* `detail` is the instrument's sentence, which the page must render, not compose. */
const HEALTH_OK = [
  { name: "ask-index-drift", ok: true, detail: "Ask index agrees with D1: 99 expected, 99 present." },
  { name: "media-index-drift", ok: true, detail: "Media index agrees with R2 and public/: 70 expected, 70 present." },
  { name: "media-backup-drift", ok: true, detail: "Every MEDIA object has a byte-identical twin: 1 objects, 1 twins, 0 missing." },
  { name: "content-drift", ok: true, detail: "D1 agrees with the repository: 12 post file(s), every blob sha matched by its row." },
  { name: "fts-equality", ok: true, detail: "FTS shadows agree: 122 docs, 122 identity, 122 prose." },
];

/** One failing, so per-check and page-wide verdicts differ. */
const HEALTH_ONE_FAILING = [
  HEALTH_OK[0],
  {
    name: "media-index-drift",
    ok: false,
    detail: "Media index disagrees with R2 and public/: 70 expected, 69 present.",
    counts: { expected: 70, present: 69 },
  },
  HEALTH_OK[2],
  HEALTH_OK[3],
  HEALTH_OK[4],
];

const STORES_CLEAN = {
  headSha: "abcdef1234567890abcdef1234567890abcdef12",
  artifactPosts: 12,
  d1Posts: 12,
  d1PubliclyVisible: 11,
  searchIndexDocs: 122,
  askConfigured: true,
  githubConfigured: true,
  divergences: { known: true, entries: [] },
};

/** D1 behind, one commit not applied. */
const STORES_BEHIND = {
  ...STORES_CLEAN,
  d1Posts: 11,
  divergences: {
    known: true,
    entries: [
      {
        slug: "a-post-that-did-not-land",
        commitSha: "9876543210fedcba9876543210fedcba98765432",
        error: "D1 write failed after the commit landed",
        at: "2026-08-25T00:00:00.000Z",
      },
    ],
  },
};

/** Dates are `Date` objects, as the loader hands them. */
const MENTIONS = [
  {
    id: 1,
    sourceUrl: "https://elsewhere.example/a-very-long-path-that-has-no-spaces-in-it-at-all/and-keeps-going",
    targetSlug: "a-post",
    status: "pending",
    authorName: "<script>alert(1)</script>",
    authorUrl: "https://elsewhere.example/about",
    excerpt: "I read this and it explains the shape well.",
    failureReason: null,
    receivedAt: new Date("2026-09-01T10:00:00.000Z"),
    verifiedAt: new Date("2026-09-01T10:00:05.000Z"),
    decidedAt: null,
  },
  {
    id: 2,
    sourceUrl: "https://another.example/post",
    targetSlug: "a-post",
    status: "failed",
    authorName: "another.example",
    authorUrl: null,
    excerpt: null,
    failureReason: "no-link",
    receivedAt: new Date("2026-08-20T10:00:00.000Z"),
    verifiedAt: new Date("2026-08-20T10:00:03.000Z"),
    decidedAt: null,
  },
  {
    id: 3,
    sourceUrl: "https://third.example/post",
    targetSlug: "a-second-post",
    status: "approved",
    authorName: "A Writer",
    authorUrl: "https://third.example/",
    excerpt: "A short quotation from the linking paragraph.",
    failureReason: null,
    receivedAt: new Date("2026-08-25T10:00:00.000Z"),
    verifiedAt: new Date("2026-08-25T10:00:02.000Z"),
    decidedAt: new Date("2026-08-26T09:00:00.000Z"),
  },
  {
    id: 4,
    sourceUrl: "https://spam.example/post",
    targetSlug: "a-post",
    status: "rejected",
    authorName: "spam.example",
    authorUrl: null,
    excerpt: "Buy things.",
    failureReason: null,
    receivedAt: new Date("2026-08-10T10:00:00.000Z"),
    verifiedAt: new Date("2026-08-10T10:00:01.000Z"),
    decidedAt: new Date("2026-08-11T09:00:00.000Z"),
  },
  {
    id: 5,
    sourceUrl: "https://slow.example/post",
    targetSlug: "a-post",
    status: "unverified",
    authorName: null,
    authorUrl: null,
    excerpt: null,
    failureReason: null,
    receivedAt: new Date("2026-09-04T10:00:00.000Z"),
    verifiedAt: null,
    decidedAt: null,
  },
];

/** @type {Array<{ name: string, entry: string, path: string, url: string, loaderData: unknown, actionData?: unknown, params?: Record<string,string>, props?: Record<string,unknown> }>} */
const STATES = [
  // Posts index.
  {
    name: "posts index, clean",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, ...NO_FILTERS },
  },
  {
    name: "posts index, readership live",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, readership: READERSHIP_LIVE, ...NO_FILTERS },
  },
  {
    name: "posts index, readership truncated",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, readership: READERSHIP_TRUNCATED, ...NO_FILTERS },
  },
  {
    name: "posts index, readership unavailable",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, readership: READERSHIP_ERROR, ...NO_FILTERS },
  },
  {
    name: "posts index, Ask drifted",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_DRIFTED, budget: BUDGET, ...NO_FILTERS },
  },
  {
    name: "posts index, Ask disabled",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: null, budget: null, ...NO_FILTERS },
  },
  {
    name: "posts index, empty corpus",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: {
      posts: [],
      ask: null,
      budget: null,
      ...NO_FILTERS,
      total: 0,
      scheduledTotal: 0,
      tagOptions: [],
    },
  },
  // An empty result is not an empty corpus.
  /*
   * `props` seeds selection, since a static render dispatches no events. Two selected, so
   * the count and plural are exercised.
   */
  /* The no-script half of the delete guards. */
  {
    name: "posts index, ask sync awaiting confirmation",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, ...NO_FILTERS },
    actionData: { confirmSyncAsk: 12 },
  },
  {
    name: "posts index, bulk delete awaiting confirmation",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, ...NO_FILTERS },
    actionData: {
      confirmDelete: { slugs: [POSTS[0].slug, POSTS[1].slug], count: 2, typed: "" },
      message: "Nothing was deleted. 2 post(s) are selected.",
    },
  },
  {
    name: "posts index, two selected",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, ...NO_FILTERS },
    props: { initialSelection: [POSTS[0].slug, POSTS[1].slug] },
  },
  /* Filtered, two visible, one selected: select-all must say shown. */
  {
    name: "posts index, filtered and selected",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts?status=published",
    loaderData: {
      posts: [POSTS[0], POSTS[1]],
      ask: ASK_CLEAN,
      budget: BUDGET,
      ...NO_FILTERS,
      filters: { q: "", status: "published", tag: "" },
      filtered: true,
    },
    props: { initialSelection: [POSTS[0].slug] },
  },
  {
    name: "posts index, filtered with matches",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts?q=live&status=published",
    loaderData: {
      posts: [POSTS[0]],
      ask: ASK_CLEAN,
      budget: BUDGET,
      ...NO_FILTERS,
      filters: { q: "live", status: "published", tag: "" },
      filtered: true,
    },
  },
  {
    name: "posts index, filtered with no matches",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts?q=nothing-matches-this&tag=d1",
    loaderData: {
      posts: [],
      ask: ASK_CLEAN,
      budget: BUDGET,
      ...NO_FILTERS,
      filters: { q: "nothing-matches-this", status: "", tag: "d1" },
      filtered: true,
    },
  },

  // Media library. Detail states own the per-asset mutations.
  {
    name: "media, unused object",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({ objects: [MEDIA_OBJECT()] }),
  },
  {
    name: "media, cited object",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({
          citations: [
            { type: "post", id: "a-post", title: "A post", form: "markdown-image", detail: "line 12" },
          ],
          refCount: 1,
        }),
      ],
    }),
  },
  {
    name: "media, reference scan failed",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    // Usage unknown: nothing is unused, every delete refused.
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      scanComplete: false,
      scanFailed: ["posts"],
    }),
  },
  {
    name: "media, empty bucket",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({ objects: [], counts: [], roleCounts: [] }),
  },
  {
    // A document has no thumbnail, so the tile shows a label.
    name: "media, document row",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({
          key: "/publications/a-paper.pdf",
          url: "/publications/a-paper.pdf",
          thumb: "/publications/a-paper.pdf",
          storage: "static",
          kind: "document",
          mime: "application/pdf",
          originalName: null,
          placeholder: null,
          width: null,
          height: null,
          deletable: false,
          viewable: false,
        }),
      ],
    }),
  },
  {
    // A static row: no delete offered.
    name: "media, static row",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      filter: "brand",
      objects: [
        MEDIA_OBJECT({
          key: "/dustin-edwards-logo.svg",
          url: "/dustin-edwards-logo.svg",
          // A static asset is its own url; never prefix /media/.
          thumb: "/dustin-edwards-logo.svg",
          storage: "static",
          role: "brand",
          mime: "image/svg+xml",
          originalName: null,
          // Images does not rasterize SVGs.
          placeholder: null,
          deletable: false,
        }),
      ],
      roleCounts: [{ role: "brand", n: 1 }],
    }),
  },
  /* A copy button submits nothing, so these need structural assertions. */
  {
    name: "media, document in the grid",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?view=grid",
    loaderData: MEDIA_SHELL({
      view: { ...MEDIA_SHELL().view, view: "grid" },
      objects: [
        MEDIA_OBJECT({
          key: "/publications/edwards-2024-phage-genomics.pdf",
          url: "/publications/edwards-2024-phage-genomics.pdf",
          thumb: "/publications/edwards-2024-phage-genomics.pdf",
          storage: "static",
          kind: "document",
          mime: "application/pdf",
          // Real shape: the title comes off the key.
          originalName: null,
          placeholder: null,
          width: null,
          height: null,
          size: 1468006,
          deletable: false,
          viewable: false,
        }),
      ],
    }),
  },
  {
    name: "media, grid with a selected tile",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?view=grid",
    loaderData: MEDIA_SHELL({
      view: { ...MEDIA_SHELL().view, view: "grid" },
      objects: [MEDIA_OBJECT()],
    }),
    // Seeded: no events are dispatched.
    props: { initialSelection: ["1234abcd5678ef90.png"] },
  },
  {
    name: "media, list sorted by size",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?sort=size&dir=desc",
    loaderData: MEDIA_SHELL({
      view: { ...MEDIA_SHELL().view, sort: "size", dir: "desc" },
      modified: true,
      objects: [MEDIA_OBJECT()],
    }),
  },
  {
    // Used by repository code, cited by no post.
    name: "media, placed by page code",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({
          key: "/phage-hunters/dustin-edwards-2019.webp",
          url: "/phage-hunters/dustin-edwards-2019.webp",
          thumb: "/phage-hunters/dustin-edwards-2019.webp",
          storage: "static",
          originalName: null,
          deletable: false,
          usage: "template",
          templateRefs: ["app/data/phage-hunters.ts"],
        }),
      ],
    }),
  },
  {
    name: "media, cited by a post",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({
          usage: "used",
          refCount: 1,
          citations: [
            { type: "post", id: "a-post", title: "A post", form: "markdown-image", detail: "line 12" },
          ],
        }),
      ],
    }),
  },
  {
    // Template-placed: the claim and its source file.
    name: "media, inspector on a template-placed file",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=/phage-hunters/dustin-edwards-2019.webp",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      view: { ...MEDIA_SHELL().view, key: "/phage-hunters/dustin-edwards-2019.webp" },
      detail: MEDIA_DETAIL({
        key: "/phage-hunters/dustin-edwards-2019.webp",
        url: "/phage-hunters/dustin-edwards-2019.webp",
        originalName: null,
        deletable: false,
        storage: "static",
        hash: null,
        usage: "template",
        templateRefs: ["app/data/phage-hunters.ts"],
        altSuggestion: "2019",
        tagSuggestions: ["phage hunters", "2019"],
      }),
    }),
  },
  {
    // Document copy labels differ here only.
    name: "media, inspector on a document",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=/publications/edwards-2024-phage-genomics.pdf",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      view: { ...MEDIA_SHELL().view, key: "/publications/edwards-2024-phage-genomics.pdf" },
      detail: MEDIA_DETAIL({
        key: "/publications/edwards-2024-phage-genomics.pdf",
        url: "/publications/edwards-2024-phage-genomics.pdf",
        originalName: null,
        mime: "application/pdf",
        kind: "document",
        viewable: false,
        deletable: false,
        storage: "static",
        width: null,
        height: null,
        hash: null,
        altSuggestion: "edwards 2024 phage genomics",
      }),
    }),
  },
  {
    // Removal proposed on a comparison.
    name: "media, inspector on a duplicate",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT({ twinCount: 1 })],
      view: { ...MEDIA_SHELL().view, key: "1234abcd5678ef90.png" },
      detail: MEDIA_DETAIL({
        twins: [{ key: "aabbccdd11223344.png", originalName: "headshot-final-v2.png" }],
      }),
    }),
  },
  {
    // Alt written: no suggestion offered.
    name: "media, inspector with alt already written",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT({ alt: "A plate of plaques" })],
      view: { ...MEDIA_SHELL().view, key: "1234abcd5678ef90.png" },
      detail: MEDIA_DETAIL({ alt: "A plate of plaques", tagSuggestions: ["talks"] }),
    }),
  },
  {
    /* Where precedence and any-flag disagree. */
    name: "media, large but attached",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?view=grid",
    loaderData: MEDIA_SHELL({
      view: { ...MEDIA_SHELL().view, view: "grid" },
      objects: [
        MEDIA_OBJECT({
          size: 2_000_000,
          alt: "A described picture",
          usage: "used",
          refCount: 1,
        }),
      ],
    }),
  },
  {
    // A narrowed lens states its boundary.
    name: "media, unattached lens with its note",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?lens=unattached",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      view: { ...MEDIA_SHELL().view, lens: "unattached" },
      modified: true,
    }),
  },
  {
    // The only empty state with an action.
    name: "media, library empty",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      objects: [],
      counts: [],
      roleCounts: [],
      lensCounts: { all: 0, unattached: 0, noAlt: 0, large: 0, duplicates: 0 },
    }),
  },
  {
    // Names the query back.
    name: "media, search matched nothing",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?q=zzzz",
    loaderData: MEDIA_SHELL({ objects: [], q: "zzzz" }),
  },
  {
    // Good news must not read as an error.
    name: "media, lens matched nothing",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?lens=duplicates",
    loaderData: MEDIA_SHELL({
      objects: [],
      view: { ...MEDIA_SHELL().view, lens: "duplicates" },
      modified: true,
    }),
  },
  {
    /* The destructive submit lives behind this state. */
    name: "media, empty trash confirmation",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?trash=1&confirm=empty-trash",
    loaderData: MEDIA_SHELL({
      objects: [],
      trashedCount: 3,
      view: { ...MEDIA_SHELL().view, trash: true, confirm: "empty-trash" },
      modified: true,
    }),
  },
  {
    /* Opens from client state, via a seam. */
    name: "media, bulk trash confirmation",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({ objects: [MEDIA_OBJECT()] }),
    props: { initialSelection: ["1234abcd5678ef90.png"], initialConfirmingTrash: true },
  },
  {
    /* The bar needs a selection. */
    name: "media, selection bar",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?view=grid",
    loaderData: MEDIA_SHELL({
      view: { ...MEDIA_SHELL().view, view: "grid" },
      objects: [MEDIA_OBJECT(), MEDIA_OBJECT({ key: "b.png", url: "/media/b.png" })],
    }),
    props: { initialSelection: ["1234abcd5678ef90.png", "b.png"] },
  },
  {
    // Clear exists only here.
    name: "media, search with results",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?q=picture",
    loaderData: MEDIA_SHELL({ q: "picture", objects: [MEDIA_OBJECT()], unusedCount: 1 }),
  },
  {
    // Offers widen or clear, not upload.
    name: "media, search with nothing found",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?q=zzzz",
    loaderData: MEDIA_SHELL({ q: "zzzz", objects: [] }),
  },
  {
    name: "media, rebuild awaiting confirmation",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({ objects: [MEDIA_OBJECT()] }),
    actionData: { confirmRebuild: 70 },
  },
  {
    name: "media, delete awaiting confirmation",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      detail: MEDIA_DETAIL({}),
    }),
    actionData: { confirmDelete: "1234abcd5678ef90.png" },
  },
  /* Both chip shapes: several tags, and exactly one. */
  {
    name: "media, detail with several tags",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      detail: MEDIA_DETAIL({ tags: ["roster", "photo", "2019"] }),
    }),
  },
  {
    name: "media, detail with one tag",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      detail: MEDIA_DETAIL({ tags: ["roster"] }),
    }),
  },
  {
    // Set-alt and delete appear here only.
    name: "media, detail open",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      detail: MEDIA_DETAIL({
        refs: [
          { sourceType: "post", sourceId: "a-post", form: "markdown-image", detail: "line 12" },
        ],
        citations: [
          { type: "post", id: "a-post", title: "A post", form: "markdown-image", detail: "line 12" },
        ],
      }),
    }),
  },
  {
    // No delete offered.
    name: "media, detail for a static row",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=/dustin-edwards-logo.svg",
    loaderData: MEDIA_SHELL({
      filter: "brand",
      objects: [],
      roleCounts: [{ role: "brand", n: 1 }],
      detail: MEDIA_DETAIL({
        key: "/dustin-edwards-logo.svg",
        url: "/dustin-edwards-logo.svg",
        thumb: "/dustin-edwards-logo.svg",
        storage: "static",
        role: "brand",
        mime: "image/svg+xml",
        originalName: null,
        placeholder: null,
        width: null,
        height: null,
        uploadedAt: null,
        deletable: false,
      }),
    }),
  },
  {
    // Must render a way back.
    name: "media, detail for a missing key",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=gone.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      detail: { found: false, key: "gone.png" },
    }),
  },
  {
    // The flash renders.
    name: "media, upload accepted",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?uploaded=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      uploaded: "1234abcd5678ef90.png",
    }),
  },
  {
    // Renders the loader's sentence.
    name: "media, upload refused",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?upload-error=too-large",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      uploadError: "That image is over the 10 MB limit.",
    }),
  },

  /* View modes: one tree, identical payload. */
  {
    name: "media, list view",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({ objects: [MEDIA_OBJECT()] }),
  },
  {
    // Flat renders no heading.
    name: "media, flat view",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?group=flat",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      view: { ...MEDIA_SHELL().view, group: "flat" },
      modified: true,
    }),
  },
  {
    name: "media, grid view",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?view=grid",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      view: { ...MEDIA_SHELL().view, view: "grid" },
      modified: true,
    }),
  },
  {
    name: "media, grouped and sorted",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?group=folder&sort=size&dir=asc&size=l",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      view: { ...MEDIA_SHELL().view, group: "folder", sort: "size", dir: "asc", size: "l" },
      // Reset exists only when modified.
      modified: true,
    }),
  },
  {
    name: "media, trash view",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?trash=1",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT({ key: "trashed.png", url: "/media/trashed.png" })],
      view: { ...MEDIA_SHELL().view, trash: true },
      modified: true,
      trashedCount: 1,
    }),
  },
  {
    // No empty-trash offer; explanation kept.
    name: "media, trash view empty",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?trash=1",
    loaderData: MEDIA_SHELL({
      objects: [],
      view: { ...MEDIA_SHELL().view, trash: true },
      modified: true,
      trashedCount: 0,
    }),
  },
  {
    name: "media, tag filter active",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?tag=roster",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT({ tags: ["roster"] })],
      view: { ...MEDIA_SHELL().view, tag: "roster" },
      modified: true,
      tagCounts: [
        { tag: "roster", n: 9 },
        { tag: "diagram", n: 2 },
      ],
    }),
  },
  {
    // A way out other than upload.
    name: "media, tag filter with no results",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?tag=nothing-here",
    loaderData: MEDIA_SHELL({
      objects: [],
      view: { ...MEDIA_SHELL().view, tag: "nothing-here" },
      modified: true,
      tagCounts: [{ tag: "roster", n: 9 }],
    }),
  },
  {
    // The only twin-removal copy.
    name: "media, detail with a twin",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT({ twinCount: 1 })],
      detail: MEDIA_DETAIL({
        twins: [{ key: "aaaabbbbccccdddd.png", originalName: "a-copy.png" }],
      }),
      view: { ...MEDIA_SHELL().view, key: "1234abcd5678ef90.png" },
      modified: true,
    }),
  },
  {
    // Restore, never Move to trash.
    name: "media, detail for a trashed row",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=1234abcd5678ef90.png&trash=1",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      detail: MEDIA_DETAIL({ trashedAt: "2026-08-15 12:00:00" }),
      view: { ...MEDIA_SHELL().view, trash: true, key: "1234abcd5678ef90.png" },
      modified: true,
      trashedCount: 1,
    }),
  },

  {
    // Two folders, so a per-row grouper fails.
    name: "media, grouped by folder",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?group=folder",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({ key: "/publications/a.pdf", url: "/publications/a.pdf", storage: "static", kind: "document", deletable: false }),
        MEDIA_OBJECT({ key: "/publications/b.pdf", url: "/publications/b.pdf", storage: "static", kind: "document", deletable: false }),
        // The roster photograph.
        MEDIA_OBJECT({ key: "/phage-hunters/2019/a.jpg", url: "/phage-hunters/2019/a.jpg", storage: "static", deletable: false }),
      ],
      view: { ...MEDIA_SHELL().view, group: "folder" },
      modified: true,
    }),
  },
  {
    // An undated row gets its own bucket.
    name: "media, grouped by month",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?group=month",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({ uploaded: "2026-03-02T10:00:00.000Z" }),
        MEDIA_OBJECT({ key: "second.png", url: "/media/second.png", uploaded: "2026-03-19T10:00:00.000Z" }),
        MEDIA_OBJECT({ key: "/dustin-edwards-logo.svg", url: "/dustin-edwards-logo.svg", storage: "static", uploaded: null, deletable: false }),
      ],
      view: { ...MEDIA_SHELL().view, group: "month" },
      modified: true,
    }),
  },
  {
    /* The only state issuing bulk intents; two for the plural. */
    name: "media, two selected",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?role=all",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT(),
        MEDIA_OBJECT({ key: "second.png", url: "/media/second.png" }),
      ],
      // `role=all` is unfiltered; the default is not.
      filter: "all",
      view: { ...MEDIA_SHELL().view, role: "all" },
      modified: true,
      tagCounts: [{ tag: "roster", n: 9 }],
    }),
    props: { initialSelection: ["1234abcd5678ef90.png", "second.png"] },
  },
  {
    // Select-all must say shown.
    name: "media, filtered and selected",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?tag=roster",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({ tags: ["roster"] }),
        MEDIA_OBJECT({ key: "second.png", url: "/media/second.png", tags: ["roster"] }),
      ],
      view: { ...MEDIA_SHELL().view, tag: "roster" },
      modified: true,
      tagCounts: [{ tag: "roster", n: 9 }],
    }),
    props: { initialSelection: ["1234abcd5678ef90.png"] },
  },

  // New post.
  {
    name: "new post, fresh",
    entry: "app/routes/admin.posts.new.tsx",
    path: "/admin/posts/new",
    url: "/admin/posts/new",
    loaderData: { headSha: HEAD, fields: fields({ title: "", slug: "", description: "", body: "", tags: [] }), tagOptions: ["cloudflare"] },
  },
  {
    name: "new post, gate refused the save",
    entry: "app/routes/admin.posts.new.tsx",
    path: "/admin/posts/new",
    url: "/admin/posts/new",
    loaderData: { headSha: HEAD, fields: fields(), tagOptions: ["cloudflare"] },
    actionData: {
      kind: "problem",
      fields: fields(),
      problem: { message: "description is required", field: "description" },
      headSha: HEAD,
    },
  },
  {
    name: "new post, saving unavailable",
    entry: "app/routes/admin.posts.new.tsx",
    path: "/admin/posts/new",
    url: "/admin/posts/new",
    loaderData: { headSha: "", fields: fields(), tagOptions: [] },
  },

  // Edit.
  {
    name: "edit, draft that never published",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader(),
  },
  {
    name: "edit, draft that published before",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({
      fields: fields({ draft: true, firstPublished: "2026-06-01" }),
      everPublished: true,
      state: "draft",
    }),
  },
  {
    name: "edit, delete awaiting confirmation",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({
      fields: fields({ draft: false, firstPublished: "2026-06-01" }),
      everPublished: true,
      state: "published",
    }),
    actionData: { kind: "confirm-delete", slug: "a-post" },
  },
  {
    /* A refused unconfirmed first publication. */
    name: "edit, first publication awaiting confirmation",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader(),
    actionData: {
      kind: "confirm-publish",
      fields: fields(),
      headSha: "abc1234def5678",
    },
  },
  {
    name: "edit, published",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({
      fields: fields({ draft: false, firstPublished: "2026-06-01" }),
      everPublished: true,
      state: "published",
    }),
  },
  {
    name: "edit, scheduled",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({
      fields: fields({ draft: false, publishAt: "2099-01-02T09:00:00.000Z", firstPublished: "2026-06-01" }),
      everPublished: true,
      state: "scheduled",
    }),
  },
  {
    name: "edit, with a cover set",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({
      fields: fields({ coverSrc: "/media/posts/2026/x.webp", coverAlt: "" }),
    }),
  },
  {
    /* Ticks the picker, so `frInternal` is submitted. */
    /* The negative for the unchecked box. */
    name: "edit, featured",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({ fields: fields({ featured: true }) }),
  },
  {
    name: "edit, with further reading set",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({
      fields: fields({
        furtherReading: JSON.stringify([
          { title: "An external piece", url: "https://example.com/x" },
          { title: "A live post", url: "/blog/live-one" },
        ]),
      }),
    }),
  },
  {
    name: "edit, save refused",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader(),
    actionData: {
      kind: "problem",
      fields: fields(),
      problem: { message: "main moved. Reload.", conflict: true },
      headSha: HEAD,
    },
  },
  {
    name: "edit, saving unavailable",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({ headSha: "" }),
  },

  /*
   * Preview links: none, two, and published (neither control). Two links prove the tuple is
   * shared, so a token leaking into the submission fails.
   */
  {
    name: "edit, draft with no preview links",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({ previewLinks: [] }),
  },
  {
    name: "edit, draft with two preview links",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({ previewLinks: PREVIEW_LINKS }),
  },
  {
    name: "edit, published offers no preview links",
    entry: "app/routes/admin.posts.$slug.edit.tsx",
    path: "/admin/posts/:slug/edit",
    url: "/admin/posts/a-post/edit",
    params: { slug: "a-post" },
    loaderData: editLoader({
      fields: fields({ draft: false, firstPublished: "2026-06-01" }),
      everPublished: true,
      state: "published",
      // Proves the section follows state, not emptiness.
      previewLinks: PREVIEW_LINKS,
    }),
  },

  // Origin requests. Error is the local state: no read token.
  {
    name: "origin requests, loaded",
    entry: "app/routes/admin.origin-requests.tsx",
    path: "/admin/origin-requests",
    url: "/admin/origin-requests",
    loaderData: { result: TRAFFIC_LIVE },
  },
  {
    name: "origin requests, empty",
    entry: "app/routes/admin.origin-requests.tsx",
    path: "/admin/origin-requests",
    url: "/admin/origin-requests",
    loaderData: { result: TRAFFIC_EMPTY },
  },
  {
    name: "origin requests, error",
    entry: "app/routes/admin.origin-requests.tsx",
    path: "/admin/origin-requests",
    url: "/admin/origin-requests",
    loaderData: { result: TRAFFIC_ERROR },
  },
  /*
   * Mentions. Destructive intents refuse in the action and render a second step for no-script
   * readers. Rows carry hostile input because the render is the boundary.
   */
  /* At `all`, so the escaping assertions see `MENTIONS[0]`. */
  {
    name: "mentions, populated queue",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=all",
    loaderData: { mentions: MENTIONS, expiring: { failed: 2, rejected: 1 }, status: "all" },
  },
  {
    name: "mentions, pending filter",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=pending",
    loaderData: { mentions: MENTIONS, expiring: { failed: 2, rejected: 1 }, status: "pending" },
  },
  /* Fails both ways: not filtering, or not explaining. */
  {
    name: "mentions, empty pending filter",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=pending",
    loaderData: {
      mentions: MENTIONS.filter((m) => m.status !== "pending"),
      expiring: { failed: 2, rejected: 1 },
      status: "pending",
    },
  },
  {
    name: "mentions, empty queue",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions",
    loaderData: { mentions: [], expiring: { failed: 0, rejected: 0 }, status: "all" },
  },
  /*
   * The hidden `intent` stays enabled, so the payload is unchanged; browser submission is not
   * modeled. The state exists for the label.
   */
  {
    name: "mentions, nothing expired",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=all",
    loaderData: { mentions: MENTIONS, expiring: { failed: 0, rejected: 0 }, status: "all" },
  },
  {
    name: "mentions, delete awaiting confirmation",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=all",
    loaderData: { mentions: MENTIONS, expiring: { failed: 2, rejected: 1 }, status: "all" },
    actionData: { confirmDelete: 1 },
  },
  {
    name: "mentions, sweep awaiting confirmation",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=all",
    loaderData: { mentions: MENTIONS, expiring: { failed: 2, rejected: 1 }, status: "all" },
    actionData: { confirmSweep: { failed: 2, rejected: 1 } },
  },
  /* Each box asserted against the other. */
  {
    name: "mentions, success notice",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=all",
    loaderData: { mentions: MENTIONS, expiring: { failed: 2, rejected: 1 }, status: "all" },
    actionData: { ok: true, message: "Mention approved." },
  },
  {
    name: "mentions, refusal",
    entry: "app/routes/admin.mentions.tsx",
    path: "/admin/mentions",
    url: "/admin/mentions?status=all",
    loaderData: { mentions: MENTIONS, expiring: { failed: 2, rejected: 1 }, status: "all" },
    actionData: { ok: false, message: "That mention id is not valid." },
  },
  {
    name: "overview, all healthy",
    entry: "app/routes/admin._index.tsx",
    path: "/admin",
    url: "/admin",
    loaderData: { checks: HEALTH_OK, failed: 0, stores: STORES_CLEAN },
  },
  {
    name: "overview, one check failing",
    entry: "app/routes/admin._index.tsx",
    path: "/admin",
    url: "/admin",
    loaderData: { checks: HEALTH_ONE_FAILING, failed: 1, stores: STORES_BEHIND },
  },
  {
    name: "tools, all secrets set",
    entry: "app/routes/admin.tools.tsx",
    path: "/admin/tools",
    url: "/admin/tools",
    loaderData: {
      secrets: [
        { name: "GITHUB_TOKEN", present: true },
        { name: "OPERATOR_TOKEN", present: true },
        { name: "SMOKE_TOKEN", present: true },
      ],
      /* Rows, so the demand list and the ENABLED sweep button are both rendered somewhere. */
      misses: [
        { query: "d1 backups", count: 7, firstSeen: 0, lastSeen: 0 },
        { query: "workers cache", count: 2, firstSeen: 0, lastSeen: 0 },
      ],
    },
  },
  {
    name: "tools, one secret missing",
    entry: "app/routes/admin.tools.tsx",
    path: "/admin/tools",
    url: "/admin/tools",
    loaderData: {
      secrets: [
        { name: "GITHUB_TOKEN", present: true },
        { name: "OPERATOR_TOKEN", present: false },
        { name: "SMOKE_TOKEN", present: true },
      ],
      /* Empty, so the empty state and the DISABLED sweep button are covered. */
      misses: [],
    },
  },
];

/* Checks. */

console.log("\ncheck:admin-ui\n");

/*
 * Section 1: the publish state machine. Buttons submit their transition id as `intent`.
 * Every rule is paired with its negative.
 */

const HOUR = 3600_000;
const NOW = Date.parse("2026-07-31T12:00:00.000Z");

/** @param {string} label @param {boolean} ok @param {string} [detail] */
const t = (label, ok, detail) => assert(`transition: ${label}`, ok, detail);

{
  // A draft that has never been public.
  const fresh = transitionsFor("draft", false);
  t("fresh draft leads with Publish", fresh[0].label === "Publish", fresh[0].label);
  t("fresh draft publish clears the draft flag", fresh[0].wantsDraft === false);
  t("fresh draft publish is ceremonial", fresh[0].ceremony === true);
  t("fresh draft can still be saved as a draft", fresh.some((x) => x.id === "save-draft" && x.wantsDraft === true));
  t("fresh draft offers no unpublish", !fresh.some((x) => x.id === "unpublish"));

  // A withdrawn draft.
  const back = transitionsFor("draft", true);
  t("withdrawn draft leads with Republish", back[0].label === "Republish", back[0].label);
  t("withdrawn draft republish clears the draft flag", back[0].wantsDraft === false);
  // A repeated ask becomes a habit.
  t("republishing is NOT ceremonial", back[0].ceremony === false);
  t("withdrawn draft can still be saved as a draft", back.some((x) => x.id === "save-draft" && x.wantsDraft === true));

  // Live.
  const live = transitionsFor("published", true);
  t("published leads with a plain save", live[0].id === "save" && live[0].wantsDraft === false);
  t("published never leads with a publish", live[0].id !== "publish" && live[0].id !== "republish");
  t("published offers unpublish", live.some((x) => x.id === "unpublish" && x.wantsDraft === true));
  t("unpublish is not the primary", live[0].id !== "unpublish");
  t("unpublish is marked as the consequential one", live.find((x) => x.id === "unpublish")?.danger === true);
  t("published is never ceremonial", live.every((x) => x.ceremony === false));

  // Scheduled is already draft:false.
  const soon = transitionsFor("scheduled", true);
  t(
    "scheduled matches published",
    JSON.stringify(soon) === JSON.stringify(live),
    `${JSON.stringify(soon.map((x) => x.id))} vs ${JSON.stringify(live.map((x) => x.id))}`,
  );

  // Exactly one primary.
  for (const [label, list] of /** @type {Array<[string, ReturnType<typeof transitionsFor>]>} */ ([
    ["fresh draft", fresh], ["withdrawn draft", back], ["published", live], ["scheduled", soon],
  ])) {
    t(`${label} offers at least two transitions`, list.length >= 2, `${list.length}`);
    t(`${label} labels every transition`, list.every((x) => x.label.trim().length > 0));
    t(`${label} has unique ids`, new Set(list.map((x) => x.id)).size === list.length);
    /* Each transition is a known intent with the same draft meaning. */
    for (const transition of list) {
      t(
        `${label} / ${transition.id} is an intent the server knows`,
        transition.id in DRAFT_BY_INTENT,
      );
      t(
        `${label} / ${transition.id} means the draft flag its table row claims`,
        draftForIntent(transition.id) === transition.wantsDraft,
        `${draftForIntent(transition.id)} vs ${transition.wantsDraft}`,
      );
    }
  }

  /* The confirmed publish means draft:false. */
  t("the confirmed publish is a known intent", PUBLISH_CONFIRMED_INTENT in DRAFT_BY_INTENT);
  t("the confirmed publish publishes", draftForIntent(PUBLISH_CONFIRMED_INTENT) === false);
  t(
    "the confirmed publish is NOT one of the table's transitions",
    ![...fresh, ...back, ...live, ...soon].some((x) => x.id === PUBLISH_CONFIRMED_INTENT),
  );

  /* Cmd+S has no submitter, so it names its intent; asserted on the flag it produces. */
  for (const [label, state, isDraft] of /** @type {Array<[string, "draft"|"scheduled"|"published", boolean]>} */ ([
    ["draft", "draft", true],
    ["published", "published", false],
    ["scheduled", "scheduled", false],
  ])) {
    t(
      `save-in-place on a ${label} keeps it ${isDraft ? "a draft" : "public"}`,
      draftForIntent(saveInPlaceIntent(state)) === isDraft,
      `${saveInPlaceIntent(state)} -> ${draftForIntent(saveInPlaceIntent(state))}`,
    );
    t(
      `save-in-place on a ${label} is never the ceremony`,
      saveInPlaceIntent(state) !== "publish" &&
        saveInPlaceIntent(state) !== PUBLISH_CONFIRMED_INTENT,
      saveInPlaceIntent(state),
    );
  }

  /* Fail closed: a leaked private post is unrecoverable, a refused save is not. */
  t("an unknown intent is a draft", draftForIntent("not-a-real-intent") === true);
  t("an absent intent is a draft", draftForIntent(null) === true);
  t("the empty string is a draft", draftForIntent("") === true);
}

/* `fieldsFromForm` reads the intent. Bundled alone: mixed entries shift esbuild's outbase. */

{
  const fmBundle = await bundleRoutes(["app/lib/editor/frontmatter.ts"]);
  const { fieldsFromForm } = /** @type {any} */ (await importBundled(fmBundle.files[0]));

  /** The request a submitter sends. */
  const draftSentBy = (/** @type {string | null} */ intent) => {
    const form = new FormData();
    for (const name of ["title", "slug", "body", "description", "date", "tags", "publishAt", "coverSrc", "coverAlt", "series", "part", "furtherReading", "ogTitle", "ogDescription", "updated", "firstPublished"]) {
      form.set(name, "");
    }
    if (intent !== null) form.set("intent", intent);
    return fieldsFromForm(form).draft;
  };

  // Every intent, through the real parser.
  let intentsChecked = 0;
  for (const [intent, wantsDraft] of Object.entries(DRAFT_BY_INTENT)) {
    intentsChecked += 1;
    t(
      `fieldsFromForm reads intent=${intent} as draft:${wantsDraft}`,
      draftSentBy(intent) === wantsDraft,
      `${draftSentBy(intent)}`,
    );
  }
  // An empty table passes the loop.
  t("the intent table was non-empty", intentsChecked >= 6, `${intentsChecked} intents`);

  /* A parser that also honors `draft` is a half-applied revert. */
  const withDraftField = (/** @type {string} */ intent) => {
    const form = new FormData();
    form.set("intent", intent);
    form.set("draft", "on");
    return fieldsFromForm(form).draft;
  };
  t(
    "a stray draft=on cannot un-publish a publish intent",
    withDraftField("publish") === false,
    `${withDraftField("publish")}`,
  );
  t(
    "a stray draft=on cannot un-publish a confirmed publish",
    withDraftField(PUBLISH_CONFIRMED_INTENT) === false,
  );
  // Without it a parser returning a constant passes.
  t(
    "the parser discriminates: publish and unpublish differ",
    draftSentBy("publish") !== draftSentBy("unpublish"),
    `publish -> ${draftSentBy("publish")}, unpublish -> ${draftSentBy("unpublish")}`,
  );
  t("an absent intent parses as a draft", draftSentBy(null) === true);

  await fmBundle.cleanup();
}

{
  // Agrees with publiclyVisible().
  t("a draft is a draft", stateOf({ draft: true, publishAt: "" }, NOW) === "draft");
  t(
    "a draft with a future date is STILL a draft",
    stateOf({ draft: true, publishAt: new Date(NOW + HOUR).toISOString() }, NOW) === "draft",
  );
  t("no publish_at means published", stateOf({ draft: false, publishAt: "" }, NOW) === "published");
  t(
    "a future publish_at is scheduled",
    stateOf({ draft: false, publishAt: new Date(NOW + HOUR).toISOString() }, NOW) === "scheduled",
  );
  t(
    "a past publish_at is published",
    stateOf({ draft: false, publishAt: new Date(NOW - HOUR).toISOString() }, NOW) === "published",
  );
  // `publish_at <= now` is live.
  t(
    "publish_at exactly now is published, not scheduled",
    stateOf({ draft: false, publishAt: new Date(NOW).toISOString() }, NOW) === "published",
  );
  t(
    "an unreadable publish_at does not hide a live post",
    stateOf({ draft: false, publishAt: "not a date" }, NOW) === "published",
  );
}

/* Section 1b: every transition is legal under the policy, and every outcome is reachable. */

/**
 * Markdown a save carries.
 * @param {boolean} draft
 * @param {string | null} firstPublished
 */
const raw = (draft, firstPublished) =>
  [
    "---",
    'title: "A post"',
    "slug: a-post",
    'description: "What it is about."',
    "date: 2026-07-31",
    "tags: [cloudflare]",
    `draft: ${draft ? "true" : "false"}`,
    ...(firstPublished ? [`first_published: ${firstPublished}`] : []),
    "---",
    "",
    "Prose.",
  ].join("\n");

{
  /** Every table state. */
  const SITUATIONS = /** @type {const} */ ([
    { label: "fresh draft", state: "draft", ever: false, priorDraft: true, priorFirst: null },
    { label: "withdrawn draft", state: "draft", ever: true, priorDraft: true, priorFirst: "2026-06-01" },
    { label: "published", state: "published", ever: true, priorDraft: false, priorFirst: "2026-06-01" },
    { label: "scheduled", state: "scheduled", ever: true, priorDraft: false, priorFirst: "2026-06-01" },
  ]);

  /** Claimed outcomes. */
  const CLAIMS = {
    publish: "published-first",
    republish: "republished",
    "save-draft": "saved",
    save: "saved",
    unpublish: "unpublished",
  };

  /** @type {Set<string>} */
  const reached = new Set();

  for (const situation of SITUATIONS) {
    const prior = raw(situation.priorDraft, situation.priorFirst);
    for (const transition of transitionsFor(situation.state, situation.ever)) {
      /* One varying condition: a literal `true` on the success path cannot fail (hard rule 10). */
      let result;
      /** @type {unknown} */
      let thrown = null;
      try {
        result = decide({
          actor: { kind: "admin" },
          incomingRaw: raw(transition.wantsDraft, situation.priorFirst),
          priorRaw: prior,
        });
      } catch (error) {
        thrown = error;
      }

      assert(
        `weld: ${situation.label} / ${transition.id} is legal under the policy`,
        thrown === null,
        thrown instanceof Error ? thrown.message : String(thrown),
      );
      if (thrown !== null || !result) continue;
      reached.add(result.outcome);

      const claimed = CLAIMS[/** @type {keyof typeof CLAIMS} */ (transition.id)];
      assert(
        `weld: ${situation.label} / ${transition.id} produces the outcome its label promises`,
        result.outcome === claimed,
        `label "${transition.label}" implies ${claimed}, policy says ${result.outcome}`,
      );

      // The committed draft flag is what was sent.
      assert(
        `weld: ${situation.label} / ${transition.id} lands the draft flag it sent`,
        readState(result.raw).draft === transition.wantsDraft,
      );
    }
  }

  // No orphan outcomes.
  const POLICY_OUTCOMES = ["saved", "published-first", "republished", "unpublished"];
  for (const outcome of POLICY_OUTCOMES) {
    assert(
      `weld: policy outcome "${outcome}" is reachable from the table`,
      reached.has(outcome),
      `reachable: ${[...reached].sort().join(", ")}`,
    );
  }
  // And none unmodelled.
  for (const outcome of reached) {
    assert(
      `weld: table outcome "${outcome}" is one the policy defines`,
      POLICY_OUTCOMES.includes(outcome),
    );
  }
  assert("weld: the two modules were actually exercised", reached.size === POLICY_OUTCOMES.length, `${reached.size} of ${POLICY_OUTCOMES.length}`);
}

/* Section 2: what the pages submit. */

const entries = [...new Set(STATES.map((s) => s.entry))];
const bundle = await bundleRoutes(entries);

/** @type {Map<string, { default: unknown }>} */
const modules = new Map();
for (let i = 0; i < entries.length; i += 1) {
  modules.set(entries[i], await importBundled(bundle.files[i]));
}

/** Markup per state. */
/** @type {Map<string, string>} */
const renderedHtml = new Map();

/** @type {Record<string, string[]>} */
const actual = {};
/** Raw markup per state. */
/** @type {Record<string, string>} */
const renders = {};
let rendered = 0;

for (const state of STATES) {
  const mod = modules.get(state.entry);
  if (!mod) {
    fail(`${state.name}: route module did not bundle`);
    continue;
  }
  let html = "";
  try {
    html = await renderRoute(mod, {
      path: state.path,
      url: state.url,
      loaderData: state.loaderData,
      actionData: state.actionData,
      params: state.params,
      props: state.props,
    });
  } catch (error) {
    fail(`${state.name}: render threw\n    ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }

  // An empty render would match a baseline generated from a broken render.
  assert(`${state.name} produced markup`, html.length > 400, `${html.length} chars`);
  rendered += 1;
  renders[state.name] = html;
  actual[state.name] = submissionKeys(html);
  renderedHtml.set(state.name, html);
}

await bundle.cleanup();

assert("every state rendered", rendered === STATES.length, `${rendered} of ${STATES.length}`);

if (update) {
  writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`, "utf8");
  console.log(`  BASELINE REWRITTEN  ${Object.keys(actual).length} state(s) -> scripts/fixtures/admin-ui-payloads.json`);
  console.log("  This is not a passing run. Review the diff in git before committing it.\n");
  process.exit(0);
}

// Fail closed.
if (!existsSync(FIXTURE)) {
  console.log("  FAIL  baseline fixture is missing: scripts/fixtures/admin-ui-payloads.json");
  console.log("        Generate it with: npm run check:admin-ui -- --update\n");
  process.exit(1);
}

/** @type {Record<string, string[]>} */
const expected = JSON.parse(readFileSync(FIXTURE, "utf8"));

assert(
  "baseline covers exactly the states rendered",
  JSON.stringify(Object.keys(expected).sort()) === JSON.stringify(Object.keys(actual).sort()),
  `baseline has ${Object.keys(expected).length}, render produced ${Object.keys(actual).length}`,
);

let submissionsCompared = 0;
for (const name of Object.keys(actual)) {
  const want = expected[name];
  const got = actual[name];
  checks += 1;
  if (!want) {
    fail(`${name}: no baseline entry`);
    continue;
  }
  submissionsCompared += got.length;
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    const added = got.filter((k) => !want.includes(k));
    const removed = want.filter((k) => !got.includes(k));
    fail(
      `${name}: the requests this page can submit changed` +
        (removed.length ? `\n    GONE:  ${removed.join("\n           ")}` : "") +
        (added.length ? `\n    NEW:   ${added.join("\n           ")}` : ""),
    );
  }
}

/*
 * Empty baselines equal a render with no forms. The floor is measured by running this gate,
 * never summed (hard rule 10).
 */
assert(
  "the comparison actually read submissions",
  submissionsCompared >= 421,
  `${submissionsCompared} compared, floor 421, measured 442`,
);

/* Floored because `--update` rewrites the baseline and cannot reach this copy. */
assert(
  "the harness rendered its full set of states",
  STATES.length >= 89,
  `${STATES.length} state(s), floor 89, measured 94`,
);

/* Section 3: editor structure, not interaction. */

/** @param {string} name @returns {string} */
const htmlFor = (name) => renders[name] ?? "";

/**
 * React's escaping, mirrored.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** @param {string} label @param {string} state @param {(html: string) => boolean} test */
function structural(label, state, test) {
  const html = htmlFor(state);
  assert(`structure: ${label}`, html.length > 0 && test(html), html ? "" : `no render for "${state}"`);
}

for (const state of [
  "edit, draft that never published",
  "edit, published",
  "new post, fresh",
]) {
  structural("three regions are present", state, (h) =>
    h.includes('class="editor-bar"') &&
    h.includes('class="editor-canvas"') &&
    h.includes('class="drawer"'),
  );
  structural("the drawer is a real dialog", state, (h) =>
    /<dialog[^>]*class="drawer"/.test(h),
  );
  structural("the drawer is named", state, (h) =>
    /<dialog[^>]*class="drawer"[^>]*aria-labelledby="drawer-title"/.test(h) &&
    h.includes('id="drawer-title"'),
  );
  structural("the settings button reports its state", state, (h) =>
    /aria-expanded="false"[^>]*aria-haspopup="dialog"|aria-haspopup="dialog"[^>]*aria-expanded="false"/.test(h),
  );
  // Present before it speaks.
  structural("the feedback slot is a live region and always present", state, (h) =>
    /class="editor-feedback-slot"[^>]*role="status"[^>]*aria-live="polite"/.test(h),
  );
  structural("the title is the canvas heading", state, (h) =>
    h.includes('class="editor-title"') && h.includes(`/${70}`),
  );
  structural("dirty state is rendered, not implied", state, (h) =>
    h.includes('class="editor-dirty"'),
  );
}

// The label matches the table.
for (const [stateName, post, ever] of /** @type {Array<[string, "draft"|"scheduled"|"published", boolean]>} */ ([
  ["edit, draft that never published", "draft", false],
  ["edit, draft that published before", "draft", true],
  ["edit, published", "published", true],
  ["edit, scheduled", "scheduled", true],
])) {
  const want = transitionsFor(post, ever)[0].label;
  structural(`primary button on "${stateName}" reads ${want}`, stateName, (h) =>
    new RegExp(`<button[^>]*class="btn"[^>]*>${want}</button>|<button[^>]*class="btn"[^>]*>${want}`).test(h),
  );
}


// Each button submits its own id.
for (const [stateName, post, ever] of /** @type {Array<[string, "draft"|"scheduled"|"published", boolean]>} */ ([
  ["edit, draft that never published", "draft", false],
  ["edit, draft that published before", "draft", true],
  ["edit, published", "published", true],
  ["edit, scheduled", "scheduled", true],
])) {
  for (const transition of transitionsFor(post, ever)) {
    structural(
      `"${stateName}" submits intent=${transition.id} for ${transition.label}`,
      stateName,
      (h) =>
        new RegExp(
          `<button[^>]*name="intent"[^>]*value="${transition.id}"|` +
            `<button[^>]*value="${transition.id}"[^>]*name="intent"`,
        ).test(h),
    );
  }
}

/* No `draft` field, or a half revert passes. */
for (const stateName of [
  "edit, draft that never published",
  "edit, draft that published before",
  "edit, published",
  "edit, scheduled",
  "new post, fresh",
]) {
  structural("no page carries a draft field any more", stateName, (h) =>
    !/<input[^>]*name="draft"/.test(h),
  );
}

// First publication sends the ask.
structural("first publication asks rather than publishes", "edit, draft that never published", (h) => {
  const button = /<button[^>]*class="btn"[^>]*>Publish<\/button>/.exec(h)?.[0] ?? "";
  return button.includes('type="submit"') && button.includes('value="publish"');
});
structural(
  "the primary on a fresh draft does NOT carry the confirmed intent",
  "edit, draft that never published",
  (h) => {
    const button = /<button[^>]*class="btn"[^>]*>Publish<\/button>/.exec(h)?.[0] ?? "";
    return button.length > 0 && !button.includes(PUBLISH_CONFIRMED_INTENT);
  },
);
// Counted, so absence cannot pass.
structural(
  "the confirmed intent is offered only inside the ceremony dialog",
  "edit, draft that never published",
  (h) => {
    const dialog = /<dialog[^>]*class="ceremony"[\s\S]*?<\/dialog>/.exec(h)?.[0] ?? "";
    const everywhere = h.split(`value="${PUBLISH_CONFIRMED_INTENT}"`).length - 1;
    const inside = dialog.split(`value="${PUBLISH_CONFIRMED_INTENT}"`).length - 1;
    return inside === 2 && everywhere === inside;
  },
);
structural("a republication IS a plain submit", "edit, draft that published before", (h) => {
  const button = /<button[^>]*class="btn"[^>]*>Republish<\/button>/.exec(h)?.[0] ?? "";
  return button.includes('type="submit"') && button.includes('value="republish"');
});
/* Its dialog's `save` would mean draft:false on a draft. */
structural("a withdrawn draft ships no ceremony dialog", "edit, draft that published before", (h) =>
  !/<dialog[^>]*class="ceremony"/.test(h),
);

/*
 * Subtracted, not extracted: both render the same button, and an end anchor would match a
 * neighbor.
 */
/** @param {string} h @returns {string} everything outside the ceremony dialog */
const withoutCeremonyDialog = (h) =>
  h.replace(/<dialog[^>]*class="ceremony"[\s\S]*?<\/dialog>/g, "");

structural(
  "the confirmation step renders outside the dialog",
  "edit, first publication awaiting confirmation",
  (h) => h.includes('class="editor-confirm-publish"'),
);
structural(
  "exactly one confirmed submit is reachable without script",
  "edit, first publication awaiting confirmation",
  (h) =>
    withoutCeremonyDialog(h).split(`value="${PUBLISH_CONFIRMED_INTENT}"`).length - 1 === 1,
);
/* Without it an unconditional step, a one-press publication, passes. */
structural(
  "no confirmed submit is reachable without script before the ask",
  "edit, draft that never published",
  (h) =>
    withoutCeremonyDialog(h).split(`value="${PUBLISH_CONFIRMED_INTENT}"`).length - 1 === 0,
);
structural(
  "the confirmation step says scheduling needs scripting",
  "edit, first publication awaiting confirmation",
  (h) => h.includes("which needs scripting"),
);

/* Counted: one featured row. */

structural("the featured row is marked", "posts index, clean", (h) =>
  (h.match(/class="posts-featured"/g) ?? []).length === 1,
);
structural("the mark is a word, not only a color", "posts index, clean", (h) =>
  /class="posts-featured">Featured</.test(h),
);
structural("an empty corpus marks nothing", "posts index, empty corpus", (h) =>
  !h.includes("posts-featured"),
);

/* The tuple set is distinct, so it cannot show which rows offer a control; counts do. */
structural("every row offers a duplicate", "posts index, clean", (h) =>
  (h.match(/value="duplicate"/g) ?? []).length === POSTS.length,
);
structural("unpublish is offered on the two public rows and no others", "posts index, clean", (h) =>
  (h.match(/value="unpublish"/g) ?? []).length ===
  POSTS.filter((post) => post.state === "published" || post.state === "scheduled").length,
);
/* The bare id matches the form and any button aimed at it. */
structural("the draft row is offered a duplicate and NOT an unpublish", "posts index, clean", (h) =>
  h.includes("row-duplicate-wip") && !h.includes("row-unpublish-wip"),
);
/* A broken `form=` silently submits the bulk selection form instead. */
structural("every row-action control pairs with the form it names", "posts index, clean", (h) => {
  const targets = [...h.matchAll(/form="(row-(?:duplicate|unpublish)-[a-z0-9-]+)"/g)].map((m) => m[1]);
  const ids = [...h.matchAll(/id="(row-(?:duplicate|unpublish)-[a-z0-9-]+)"/g)].map((m) => m[1]);
  // Scope first: an empty page satisfies every vacuously (hard rule 10).
  if (targets.length === 0 || ids.length === 0) return false;
  return (
    new Set(ids).size === ids.length &&
    targets.every((target) => ids.includes(target)) &&
    ids.every((id) => targets.includes(id))
  );
});
/* First publication is reserved to the editor, so no list row may send it. */
structural("the list offers no publication transition at all", "posts index, clean", (h) =>
  !/value="publish"/.test(h) &&
  !/value="republish"/.test(h) &&
  !/value="publish-confirmed"/.test(h),
);
structural("an empty corpus offers no row actions", "posts index, empty corpus", (h) =>
  !h.includes("posts-row-form") && !h.includes('value="duplicate"'),
);

/* Frontmatter controls. */

// A details opens without script.
structural("the metadata section is a details disclosure", "edit, published", (h) =>
  /<details[^>]*class="post-metadata"/.test(h),
);
structural("the metadata section is NOT inside the drawer dialog", "edit, published", (h) => {
  const dialog = /<dialog[^>]*class="drawer"[\s\S]*?<\/dialog>/.exec(h)?.[0] ?? "";
  return dialog.length > 0 && !dialog.includes('class="post-metadata"');
});

/* The hidden false renders first: `fieldsFromForm` takes the last value. */
structural("featured carries a hidden false", "edit, published", (h) =>
  /<input[^>]*type="hidden"[^>]*name="featured"[^>]*value="false"/.test(h),
);
structural("featured also renders a real checkbox", "edit, published", (h) =>
  /<input[^>]*type="checkbox"[^>]*name="featured"[^>]*value="true"/.test(h),
);
structural("the hidden false precedes the checkbox", "edit, published", (h) => {
  const hidden = h.search(/<input[^>]*type="hidden"[^>]*name="featured"/);
  const box = h.search(/<input[^>]*type="checkbox"[^>]*name="featured"/);
  return hidden !== -1 && box !== -1 && hidden < box;
});
// Reflects the stored value.
structural("an unfeatured post renders the box unchecked", "edit, published", (h) => {
  const box = /<input[^>]*type="checkbox"[^>]*name="featured"[^>]*>/.exec(h)?.[0] ?? "";
  return box.length > 0 && !box.includes("checked");
});
structural("a featured post renders the box checked", "edit, featured", (h) => {
  const box = /<input[^>]*type="checkbox"[^>]*name="featured"[^>]*>/.exec(h)?.[0] ?? "";
  return box.includes("checked");
});

/* Without the marker an empty list reads as never offered, and data is lost. */
structural("further reading carries its marker", "edit, published", (h) =>
  /<input[^>]*type="hidden"[^>]*name="frControl"/.test(h),
);
structural("further reading still carries the stored JSON", "edit, published", (h) =>
  /<input[^>]*type="hidden"[^>]*name="furtherReading"/.test(h),
);
// A spare row.
structural("an empty list still offers a row", "edit, published", (h) =>
  (h.match(/name="frUrl"/g) ?? []).length === 1,
);
// Existing links render as filled rows, plus the spare.
structural("an existing external link renders as a row", "edit, with further reading set", (h) =>
  h.includes('value="https://example.com/x"'),
);
structural("filled rows plus one spare", "edit, with further reading set", (h) =>
  (h.match(/name="frUrl"/g) ?? []).length === 2,
);
/* One field wide. */
structural("the picker ticks the post already linked", "edit, with further reading set", (h) => {
  const box = /<input[^>]*name="frInternal"[^>]*>/.exec(h)?.[0] ?? "";
  return box.includes("checked") && box.includes("live-one");
});
structural("the picker offers only published posts", "edit, published", (h) => {
  const boxes = h.match(/<input[^>]*name="frInternal"[^>]*>/g) ?? [];
  // Only published posts are offered.
  return boxes.length === 1 && boxes[0].includes("live-one") && !boxes[0].includes("wip");
});
structural("a post is not offered as its own further reading", "edit, published", (h) => {
  const boxes = h.match(/<input[^>]*name="frInternal"[^>]*>/g) ?? [];
  return boxes.every((box) => !box.includes('slug\\":\\"a-post'));
});

// Names its fallback.
structural("the OG title names its fallback", "edit, published", (h) =>
  h.includes("cards use the post title"),
);
structural("the OG description names its fallback", "edit, published", (h) =>
  h.includes("cards use the description"),
);

// Only a new post has a slug input.
/*
 * An HTML `pattern` anchors implicitly, so only the negative catches an anchored source.
 * `includes`, not a RegExp: the pattern is full of metacharacters.
 */
/** @param {string} h @returns {string} */
const slugInput = (h) => /<input[^>]*name="slug"[^>]*>/.exec(h)?.[0] ?? "";
structural(
  "the slug input carries the pattern derived from SLUG_ATTRIBUTE_PATTERN",
  "new post, fresh",
  (h) => slugInput(h).includes('pattern="' + SLUG_ATTRIBUTE_PATTERN + '"'),
);
structural(
  "the slug pattern ships UNANCHORED, because the attribute anchors itself",
  "new post, fresh",
  (h) => {
    const input = slugInput(h);
    // Scope first.
    return input.length > 0 && !input.includes('pattern="' + SLUG_PATTERN.source + '"');
  },
);
/* Text the baseline cannot see. */
structural(
  "a filtered select-all says SHOWN, never bare all",
  "posts index, filtered and selected",
  (h) => h.includes("Select all 2 shown"),
);
structural(
  "a filtered select-all carries no bare count label",
  "posts index, filtered and selected",
  (h) => !h.includes("Select all 2</span>"),
);
/* Unfiltered keeps the bare form. */
structural(
  "an unfiltered select-all says the plain count",
  "posts index, two selected",
  (h) => h.includes("Select all 3</span>") && !h.includes("Select all 3 shown"),
);

structural("new posts get a slug input", "new post, fresh", (h) => h.includes('id="field-slug"'));
structural("existing posts do not", "edit, published", (h) => !h.includes('id="field-slug"'));

/* View links are fieldless GETs, so hrefs are read. Needles derive from `PARAM_NAMES`. */

{
  const { DEFAULTS, PARAM_NAMES } = await import("../app/lib/media/view.mjs");

  /* Every parameter non-default. `view` is list because column headers render only there. */
  const FULL_VIEW = {
    view: "list",
    group: "folder",
    sort: "size",
    dir: "asc",
    size: "l",
    role: "brand",
    q: "logo",
    tag: "roster",
    page: 2,
    trash: false,
    key: "",
  };

  assert(
    "the evaporation needle set is derived, not hand-written",
    PARAM_NAMES.length >= 10 && PARAM_NAMES.every((n) => n in DEFAULTS),
    `${PARAM_NAMES.length} names. A hand-written list going stale against the real ` +
      `one is what both previous incidents actually were.`,
  );

  const state = {
    name: "media, every parameter set",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?view=list&group=folder&sort=size&dir=asc&size=l&role=brand&q=logo&tag=roster&page=2",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      q: "logo",
      filter: "brand",
      page: 2,
      hasMore: true,
      view: FULL_VIEW,
      modified: true,
      tagCounts: [{ tag: "roster", n: 9 }],
      roleCounts: [{ role: "brand", n: 6 }],
    }),
  };

  const mod = modules.get(state.entry);
  assert(
    "the media route bundled for the evaporation scan",
    Boolean(mod),
    "without it the scan would examine an empty string and pass",
  );
  let html = "";
  try {
    html = await renderRoute(/** @type {{ default: unknown }} */ (mod), {
      path: state.path,
      url: state.url,
      loaderData: state.loaderData,
    });
  } catch (error) {
    fail(`${state.name}: render threw\n    ${error instanceof Error ? error.message : String(error)}`);
  }

  /* The search form is cut out: it owns `q`, and its Clear link must drop it. */
  const outsideSearch = html.replace(/<form[^>]*role="search"[\s\S]*?<\/form>/g, "");
  const hrefs = [...outsideSearch.matchAll(/href="(\/admin\/media\?[^"]*)"/g)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );

  // Scope first.
  assert(
    "the evaporation scan found view links to examine",
    hrefs.length >= 26,
    `${hrefs.length} link(s) back to /admin/media, floor 26, measured 29 on 2026-08-24. A green result below would mean nothing.`,
  );

  /**
   * Droppable parameters.
   * @type {Record<string, string>}
   */
  const MAY_DROP = {
    // Pages differ per filter.
    page: "a filter change resets to page one",
    // An owner drops its default.
    view: "the view toggle owns it",
    group: "the Display popover owns it",
    sort: "the Display popover owns it",
    dir: "the Display popover owns it",
    size: "the Display popover owns it",
    role: "the role chips own it",
    tag: "the tag chips own it",
    trash: "the Trash lens owns it",
    key: "the inspector owns it, and closing it is an explicit empty",
    confirm:
      "the confirmation modal owns it. It is set by exactly one link, the " +
      "Empty trash trigger, which only renders in the trash view with rows in " +
      "it, and cleared by Cancel. No ordinary view link carries it, and one " +
      "that did would re-open a destructive confirmation on every navigation.",
  };

  /* No control owns `q`, so dropping it is always the bug. Others need one carrier each. */
  const withoutQ = hrefs.filter((h) => !new URLSearchParams(h.split("?")[1]).has("q"));
  assert(
    "every view link carries the search, which no control on this page owns",
    withoutQ.length === 0,
    `${withoutQ.length} link(s) dropped q:\n    ${withoutQ.slice(0, 6).join("\n    ")}`,
  );

  for (const name of PARAM_NAMES) {
    if (name === "q") continue;
    const carried = hrefs.filter((h) => new URLSearchParams(h.split("?")[1]).has(name));
    assert(
      `at least one view link carries ${name} (${MAY_DROP[name]})`,
      carried.length > 0 || name === "key" || name === "trash" || name === "confirm",
      `no link on the page carries ${name}, so it cannot survive any navigation`,
    );
  }
}

/* Media structure the baseline cannot see. */

/* The document card. */

structural(
  "a document tile renders a card, not an empty labeled box",
  "media, document in the grid",
  (h) => h.includes('class="media-doc"') && h.includes('class="media-doc-title"'),
);

/* Written out, not produced by `docTitle`: fixture independence. */
structural(
  "the document title is sentence-spaced words derived from the key",
  "media, document in the grid",
  (h) => h.includes(">edwards 2024 phage genomics<"),
);

/* No raw filename too. */
structural(
  "a document tile does not also print the slug or the extension as a title",
  "media, document in the grid",
  (h) =>
    !h.includes(">edwards-2024-phage-genomics.pdf<") &&
    !h.includes(">edwards 2024 phage genomics.pdf<"),
);

structural(
  "the extension is a label on the card",
  "media, document in the grid",
  (h) => /class="media-doc-ext"[^>]*>PDF</.test(h),
);

/* Hidden decoration. */
structural(
  "the ruled lines are hidden from anything that reads rather than looks",
  "media, document in the grid",
  (h) => /class="media-doc-rules" aria-hidden="true"|aria-hidden="true" class="media-doc-rules"/.test(h),
);

/* Nothing stores a page count, so none may be invented. */
structural(
  "no page count is invented, because nothing stores one",
  "media, document in the grid",
  (h) => !/\d+\s+pages?/i.test(h),
);

/* Scoped to the card: there is no stylesheet, so CSS-hidden text elsewhere still counts. */
structural("the document card does not repeat the size", "media, document in the grid", (h) => {
  const card = /<span class="media-doc">[\s\S]*?<\/span><\/span>/.exec(h)?.[0] ?? "";
  return card.includes("edwards 2024 phage genomics") && !card.includes("1.4 MB");
});

/* 2. Caption bar */

structural(
  "a selected tile grows a caption bar",
  "media, grid with a selected tile",
  (h) => h.includes('class="media-caption"'),
);

structural(
  "the caption carries the filename and the size and the dimensions",
  "media, grid with a selected tile",
  (h) =>
    /class="media-caption-name"[^>]*>a-picture\.png</.test(h) &&
    /class="media-caption-meta"[^>]*>50 kB · 1200×630</.test(h),
);

/* Without this, a bar drawn over every tile passes the assertion above. */
structural(
  "an unselected tile has no caption bar",
  "media, document in the grid",
  (h) => !h.includes('class="media-caption"'),
);

/*
 * One copy control per card, in both states. The payload baseline cannot see this:
 * `type="button"` is not a submission.
 */
for (const [state, note] of [
  ["media, grid with a selected tile", "the caption owns it"],
  ["media, unused object", "the body owns it"],
]) {
  structural(`exactly one copy control on the card (${note})`, state, (h) => {
    const cards = h.split('class="media-card"').slice(1);
    if (cards.length !== 1) return false;
    return (cards[0].match(/class="btn-ghost media-copy"/g) ?? []).length === 1;
  });
}

/* 3. List header and its URLs */

structural(
  "the list renders a header row",
  "media, list sorted by size",
  (h) => h.includes('class="media-list-head"'),
);

structural(
  "the grid renders no header row, because a grid has no columns",
  "media, grid with a selected tile",
  (h) => !h.includes('class="media-list-head"'),
);

/* No `dims` sort key: half the library has no dimensions. */
structural("Dims is not a link", "media, list sorted by size", (h) => {
  const head = /<div class="media-list-head"[\s\S]*?<\/div>/.exec(h)?.[0] ?? "";
  return (
    head.includes('class="media-col-head is-unsortable" data-align="end">Dims') &&
    !/<a[^>]*>Dims/.test(head)
  );
});

/* Counting both catches every column marked active as well as none. */
structural("exactly one column reports itself sorted", "media, list sorted by size", (h) => {
  const head = /<div class="media-list-head"[\s\S]*?<\/div>/.exec(h)?.[0] ?? "";
  const sorted = (head.match(/aria-sort="(ascending|descending)"/g) ?? []).length;
  const unsorted = (head.match(/aria-sort="none"/g) ?? []).length;
  return sorted === 1 && unsorted === 3;
});

structural("the sorted column is the one the view names", "media, list sorted by size", (h) => {
  const head = /<div class="media-list-head"[\s\S]*?<\/div>/.exec(h)?.[0] ?? "";
  return /aria-sort="descending"[^>]*>Size|data-sort="size"[^>]*aria-sort="descending"/.test(head);
});

/*
 * Header and popover sort links land on identical URLs, both read off the markup; never
 * build an expectation with `sortHref`, which would assert it equals itself. The active
 * column is exempt: its header reverses direction and the popover does not.
 */

{
  const { SORTS, readView } = await import("../app/lib/media/view.mjs");
  const html = htmlFor("media, list sorted by size");

  assert(
    "the sorted-list state rendered for the tuple comparison",
    html.length > 400,
    `${html.length} chars. A comparison over an empty string passes by examining nothing.`,
  );

  /** @param {string} block @returns {string[]} */
  const hrefsIn = (block) =>
    [...block.matchAll(/href="(\/admin\/media[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

  /* Via `readView`: `hrefWith` omits defaults, so the spelled sort is not the meant sort. */
  /** @param {string} href @returns {string} */
  const sortOf = (href) => readView(new URLSearchParams(href.split("?")[1] ?? "")).sort;
  /** @param {string} href @returns {string} */
  const dirOf = (href) => readView(new URLSearchParams(href.split("?")[1] ?? "")).dir;

  /* Nothing nests in the header, so the first `</div>` is its own. */
  const headBlock = /<div class="media-list-head"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
  /* Sort group only: Direction links resolve to the current key. */
  const sortNav = /<nav[^>]*aria-label="Sort"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";

  /* Never filter on `sort=` in the href: the default column links to a bare `/admin/media`. */
  const headHrefs = hrefsIn(headBlock);
  const popoverHrefs = hrefsIn(sortNav);

  // Scope first: an empty list passes every comparison below.
  assert(
    "the header block yielded sort links to compare",
    headHrefs.length === 4,
    `${headHrefs.length} found in the header, expected 4. A green result below would mean nothing.`,
  );
  assert(
    "the Display popover's Sort group yielded links to compare",
    popoverHrefs.length === SORTS.length,
    `${popoverHrefs.length} found, expected one per sort key (${SORTS.length}). ` +
      `The popover and the header must offer the same columns.`,
  );

  /** @param {string[]} list @returns {Record<string, string>} sort key -> href */
  const byKey = (list) => {
    /** @type {Record<string, string>} */
    const out = {};
    for (const href of list) out[sortOf(href)] = href;
    return out;
  };
  const head = byKey(headHrefs);
  const popover = byKey(popoverHrefs);

  const ACTIVE = "size"; // what the state is sorted by
  let compared = 0;
  for (const key of SORTS) {
    if (key === ACTIVE) continue;
    assert(
      `the ${key} header and the ${key} popover option are ONE url`,
      head[key] !== undefined && head[key] === popover[key],
      `header ${head[key] ?? "(missing)"}\n    popover ${popover[key] ?? "(missing)"}. ` +
        `Two builders for one destination is how q and role fell off their links.`,
    );
    compared += 1;
  }
  assert(
    "the tuple comparison examined every inactive column",
    compared === SORTS.length - 1 && compared >= 3,
    `${compared} compared of ${SORTS.length - 1} expected. A SORTS that shrank, or an ` +
      `ACTIVE that stopped naming a real key, would make this loop pass over nothing.`,
  );

  /* Asserted, or the exemption above lets every column stop toggling. */
  assert(
    "the active column's header reverses the direction",
    head[ACTIVE] !== undefined && dirOf(head[ACTIVE]) === "asc",
    `the view is size/desc, so pressing Size must ask for asc. Got ${head[ACTIVE] ?? "(missing)"}.`,
  );
  assert(
    "the active column's popover option does NOT reverse it",
    popover[ACTIVE] !== undefined && dirOf(popover[ACTIVE]) === "desc",
    `a popover option is a destination, not a toggle. Got ${popover[ACTIVE] ?? "(missing)"}.`,
  );
}

/* Three-state usage model: text the payload baseline cannot see. */

{
  const { USAGE_STATES, LENS_NOTES } = await import("../app/lib/media/usage.mjs");

  /* Derived from the module so the state list cannot drift. */
  assert(
    "the usage model declares exactly three states",
    Object.keys(USAGE_STATES).length === 3,
    `${Object.keys(USAGE_STATES).length} declared. The page renders one label per state.`,
  );
  assert(
    "every lens that narrows carries a note",
    Object.keys(LENS_NOTES).length >= 4,
    `${Object.keys(LENS_NOTES).length} note(s). A lens with no note makes a claim it does not bound.`,
  );
}

/* 1. Third state */

structural(
  "a file placed by page code reads as in template, not unattached",
  "media, placed by page code",
  (h) => h.includes(">in template<") && !h.includes(">unattached<"),
);
structural(
  "its dot is the template dot, not the unattached one",
  "media, placed by page code",
  (h) => /data-usage="template"/.test(h) && !/data-usage="unattached"/.test(h),
);
/* The negative, on a row with no reference, proves the assertion above discriminates. */
structural(
  "a file with no reference anywhere still reads as unattached",
  "media, unused object",
  (h) => h.includes(">unattached<") && !h.includes(">in template<"),
);
structural(
  "a cited file reads as used",
  "media, cited by a post",
  (h) => h.includes(">used<") && /data-usage="used"/.test(h),
);

/* 2. Inspector evidence */

structural(
  // The state, not the wording, so a true rephrasing passes.
  "the inspector states the usage claim",
  "media, inspector on a template-placed file",
  (h) => h.includes("Placed by page code"),
);
/* A claim names its source file. */
structural(
  "the inspector names the source file that places it",
  "media, inspector on a template-placed file",
  (h) => h.includes("app/data/phage-hunters.ts") && h.includes("references this address"),
);
/*
 * Never call an unattached file "unused": the scan cannot see constructed paths or
 * external links.
 */
structural(
  "the unattached note refuses to call the file unused",
  "media, detail open",
  (h) => h.includes("not the same as") && !/\bis unused\b/.test(h),
);
/* Renders on every listing. */
structural(
  "the standing usage note renders on the listing",
  "media, unused object",
  (h) => h.includes('class="media-usage-note"') && h.includes("repository code references"),
);
/*
 * Read at source, not through the fixture: the note is loader data, so a render only
 * echoes the gate's own copy.
 */
{
  const source = readFileSync(join(root, "app/routes/admin.media._index.tsx"), "utf8");
  const note = /usageNote:([\s\S]{0,700}?)\n  \};/.exec(source)?.[1] ?? "";
  assert(
    "the standing usage note was found in the route source",
    note.length > 80,
    `${note.length} chars matched. A zero-scope read makes both assertions below vacuous.`,
  );
  assert(
    "the standing usage note names all three checks",
    note.includes("a post cites") &&
      note.includes("artifact scan") &&
      note.includes("repository code references"),
    `it must name what it actually asked, or the reader cannot tell what an ` +
      `absence of evidence covers. Got: ${note.slice(0, 160)}`,
  );
  assert(
    "the standing usage note no longer claims route code is invisible",
    !note.includes("has no citation here") && !note.includes("only by route code"),
    `that sentence described a limitation the repository scan removed. It is ` +
      `false now and it sits next to a delete button.`,
  );
}

/*
 * No "unused" in the rendered tile meta. Scoped to that element so the prose explaining
 * the rule may still use the word.
 */

for (const state of [
  "media, unused object",
  "media, placed by page code",
  "media, cited by a post",
  "media, document in the grid",
]) {
  structural(`the tile meta never says unused (${state})`, state, (h) => {
    const metas = [...h.matchAll(/class="media-meta">([\s\S]*?)<\/p>/g)].map((m) =>
      m[1].replace(/<[^>]*>/g, ""),
    );
    // Scope first: zero meta lines would pass the absence by examining nothing.
    if (metas.length === 0) return false;
    return metas.every((t) => !/\bunused\b/.test(t));
  });
}

/* Element-bounded, like the negative: a lazy `[\s\S]*?` crosses `</p>` into later markup. */
/** @param {string} h @returns {string[]} */
const metaText = (h) =>
  [...h.matchAll(/class="media-meta">([\s\S]*?)<\/p>/g)].map((m) =>
    m[1].replace(/<[^>]*>/g, ""),
  );

for (const [state, label] of [
  ["media, unused object", "unattached"],
  ["media, placed by page code", "in template"],
  ["media, cited by a post", "used"],
]) {
  structural(`a tile meta names its usage state (${label})`, state, (h) => {
    const metas = metaText(h);
    return metas.length > 0 && metas.every((t) => t.includes(label));
  });
}

/* 3. Row flags and tile dot */

structural(
  "a row prints its flags",
  "media, unused object",
  (h) => /class="media-row-flags"[^>]*>no alt</.test(h),
);
/* Scoped: the no-alt lens hint says "no alt" on every page. */
structural(
  "a document row is never flagged for missing alt",
  "media, document row",
  (h) => {
    const flags = [...h.matchAll(/class="media-row-flags">([^<]*)</g)].map((m) => m[1]);
    return flags.every((f) => !f.includes("no alt"));
  },
);
structural(
  "a grid tile carries one corner flag, not three",
  "media, document in the grid",
  (h) => (h.match(/class="media-tile-flag"/g) ?? []).length === 1,
);
/*
 * A tile with nothing worth flagging has no dot. This is the state where `tileFlagFor`
 * and `flags.length > 0` disagree.
 */
structural(
  "a large but attached and described tile carries no dot at all",
  "media, large but attached",
  (h) => !h.includes('class="media-tile-flag"'),
);
/* Quiet tile, not a dropped flag. */
structural(
  "and the row still prints the flag as words",
  "media, large but attached",
  (h) => /class="media-row-flags"[^>]*>over 1 MB</.test(h),
);

/* 4. Lens notes, empty states */

structural(
  // Presence and escape only; phrasing is the writer's.
  "a narrowed lens renders its note, with a way out",
  "media, unattached lens with its note",
  (h) => h.includes('class="media-lens-note"') && h.includes("Show everything"),
);
structural(
  "the unnarrowed view carries no lens note",
  "media, unused object",
  (h) => !h.includes('class="media-lens-note"'),
);

/* Each is the right empty state. */
structural(
  "an empty library explains what the library is for",
  "media, library empty",
  (h) => h.includes('data-empty="library"') && h.includes("Upload the first file"),
);
structural(
  "a search miss names the query and says what was searched",
  "media, search matched nothing",
  // Echoing the query is the property.
  (h) => h.includes('data-empty="search"') && h.includes("zzzz"),
);
structural(
  "an empty lens reads as good news rather than as an error",
  "media, lens matched nothing",
  (h) => h.includes('data-empty="lens"'),
);
/* Mutually exclusive. */
structural(
  "a search miss is not also the library-empty state",
  "media, search matched nothing",
  (h) => !h.includes("Upload the first file"),
);

/* 5. Suggestions */

structural(
  "an empty alt field offers the filename as a suggestion",
  "media, inspector on a template-placed file",
  (h) => h.includes("Use suggested: 2019"),
);
/* Never suggest over written alt. */
structural(
  "a written alt field offers no suggestion",
  "media, inspector with alt already written",
  (h) => !h.includes("Use suggested:"),
);
structural(
  "tag suggestions are offered as chips",
  "media, inspector on a template-placed file",
  (h) => (h.match(/class="media-tag-suggestion"/g) ?? []).length === 2,
);
/* Documents take no alt. */
structural(
  "a document is offered no alt field",
  "media, inspector on a document",
  (h) => !h.includes('id="detail-alt"') && h.includes("A document takes no alt text"),
);

/* 6. Copy labels */

structural(
  "an image offers an HTML tag",
  "media, inspector on a duplicate",
  (h) => h.includes("HTML tag") && !h.includes("HTML link"),
);
structural(
  "a document offers an HTML link, and never an img tag",
  "media, inspector on a document",
  (h) => h.includes("HTML link") && !h.includes("HTML tag"),
);

/* 7. Duplicates */

structural(
  "a duplicate states that both addresses resolve to the same content",
  "media, inspector on a duplicate",
  (h) =>
    h.includes("Byte-identical to") &&
    h.includes("both addresses resolve to the same content"),
);
structural(
  "and the trash offer names which file it would remove",
  "media, inspector on a duplicate",
  (h) => h.includes("Keep this, trash headshot-final-v2.png"),
);

/* 8. Palette and shortcuts */

structural(
  "the search bar advertises the shortcut that now exists",
  "media, unused object",
  (h) => h.includes('class="media-search-kbd"'),
);
structural(
  "the shortcuts panel documents every binding",
  "media, unused object",
  (h) => {
    // Row count; the binding is asserted below.
    return (h.match(/class="media-shortcut"/g) ?? []).length >= 9;
  },
);
/* Panel rows equal MEDIA_SHORTCUTS. */
{
  const html = htmlFor("media, unused object");
  const source = readFileSync(join(root, "app/routes/admin.media._index.tsx"), "utf8");
  const declared = (source.match(/\{\s*keys: "/g) ?? []).length;
  const rendered = (html.match(/class="media-shortcut"/g) ?? []).length;
  assert(
    "every declared shortcut is rendered, and no extra one is",
    declared > 0 && declared === rendered,
    `${declared} declared in MEDIA_SHORTCUTS, ${rendered} rendered.`,
  );

  /*
   * Never advertise an unwired binding. Equal counts pass a fake row, so each row names its
   * expression and it must appear in an island.
   */
  const islands = ["media-palette", "media-keyboard"]
    .map((f) => readFileSync(join(root, `app/components/admin/${f}.tsx`), "utf8"))
    .join("\n");
  const evidence = [...source.matchAll(/evidence: (?:"([^"]+)"|'([^']+)')/g)].map(
    (m) => m[1] ?? m[2],
  );
  assert(
    "every shortcut names the expression that implements it",
    evidence.length === declared && declared >= 9,
    `${evidence.length} evidence token(s) for ${declared} declared shortcut(s). ` +
      `A row with no evidence is a row nothing can check.`,
  );
  const unwired = evidence.filter((token) => !islands.includes(token));
  assert(
    "every documented shortcut is implemented by one of the islands",
    unwired.length === 0,
    `these are advertised and not wired: ${unwired.join(", ")}. The page must not ` +
      `document a shortcut that does nothing; that is the ruling the Cmd+K badge ` +
      `waited a whole session for.`,
  );
}

/*
 * Loader wiring, by source grep: the harness cannot run a loader and states supply `usage`
 * as input, so a disconnected model renders identically.
 */
{
  const source = readFileSync(join(root, "app/routes/admin.media._index.tsx"), "utf8");

  assert(
    "the media loader imports the repository-reference artifact",
    /import templateRefs from "\.\.\/\.\.\/content\/generated\/template-refs\.json"/.test(source),
    "without it the third usage state has no evidence and every roster photograph " +
      "goes back to reading as unattached beside a delete button.",
  );
  assert(
    "row usage is computed from all three pieces of evidence",
    /usageStateOf\(\{[\s\S]{0,260}?templateRefs: \(TEMPLATE_REFS\[object\.key\] \?\? \[\]\)\.length/.test(source),
    "the loader must READ the artifact per row. A literal here disconnects the " +
      "model while every rendered byte stays identical, which is what a plant did.",
  );
  assert(
    "the inspector computes usage from the artifact too",
    /usageStateOf\(\{[\s\S]{0,260}?templateRefs: \(TEMPLATE_REFS\[row\.key\] \?\? \[\]\)\.length/.test(source),
    "the panel and the row must not disagree about one file.",
  );
  /* Listing and lens count share one key list. */
  assert(
    "the listing filters unattached against the repository keys",
    /templateKeys: TEMPLATE_REF_KEYS/.test(source),
    "without it the lens selects rows the chip does not count.",
  );
  assert(
    "the lens count uses the same key list as the listing",
    /mediaLensCounts\(env, TEMPLATE_REF_KEYS\)/.test(source),
    "a chip counting one predicate while the grid filters another is the exact " +
      "defect the Unused chip shipped with.",
  );
}

/* 8b. Cockpit */

/*
 * A view renders what the instrument reports (rule 17): print each check's own `detail`,
 * since a sentence rebuilt from its numbers drifts on the first rewording.
 */
for (const state of ["overview, all healthy", "overview, one check failing"]) {
  /* Names come from CHECK_COPY, never retyped here. */
  structural("every health check is named on the page", state, (h) =>
    Object.values(checkCopy).every((copy) => h.includes(escapeHtml(copy.name))),
  );
  /* The positive half passes on a page printing both names and ids. */
  structural("no instrument id reaches the operator's page", state, (h) =>
    !["ask-index-drift", "media-index-drift", "media-backup-drift", "content-drift", "fts-equality"].some(
      (name) => h.includes(name),
    ),
  );
  /* The counts stay the verdict's own. */
  structural("a failing check still reports the instrument's own numbers", state, (h) => {
    /** @type {Array<{ name: string, ok: boolean, detail: string, counts?: { expected: number, present: number } }>} */
    const checks = state === "overview, all healthy" ? HEALTH_OK : HEALTH_ONE_FAILING;
    return checks
      .filter((check) => !check.ok)
      .every((check) => {
        const counts = check.counts;
        return counts
          ? h.includes(String(counts.expected)) && h.includes(String(counts.present))
          : h.includes(escapeHtml(check.detail));
      });
  });
}

/* State by word, not hue. */
structural("a healthy run marks no card as failing", "overview, all healthy", (h) =>
  !h.includes("FAILING") && !/data-status="error"/.test(h),
);
/* The word survives forced-colors. */
structural("a failing check is marked failing, and only it", "overview, one check failing", (h) =>
  (h.match(/>failing</g) ?? []).length === 1 &&
  (h.match(/>passing</g) ?? []).length === 4,
);

/* No empty menus. */
structural("only a row with a repair carries a menu", "overview, one check failing", (h) =>
  (h.match(/class="row-menu"/g) ?? []).length === 1,
);
structural("a healthy overview offers no row menus at all", "overview, all healthy", (h) =>
  !h.includes('class="row-menu"'),
);

/* Figures are the ones handed in, not hard-coded. */
structural("the two figures are the ones sync_status reported", "overview, all healthy", (h) =>
  h.includes(">12<") && h.includes("11 of them public to readers"),
);
structural("the quieter counts survive under the disclosure", "overview, all healthy", (h) =>
  /<details class="admin-explain">[\s\S]*122[\s\S]*<\/details>/.test(h),
);

/* Amber: the ship sync repairs it. */
structural("D1 behind the artifact is flagged", "overview, one check failing", (h) =>
  /data-status="warn"/.test(h),
);

/* No permanently empty panel. */
structural("no divergence panel when the list is empty", "overview, all healthy", (h) =>
  !h.includes("Divergences"),
);
structural("a recorded divergence names its commit and its reason", "overview, one check failing", (h) =>
  h.includes("Changes the site did not pick up") &&
  h.includes("a-post-that-did-not-land") &&
  h.includes("9876543") &&
  h.includes("D1 write failed after the commit landed"),
);

/* Names, never values. */
structural("every ratified secret is listed by name", "tools, all secrets set", (h) =>
  h.includes("GITHUB_TOKEN") && h.includes("OPERATOR_TOKEN") && h.includes("SMOKE_TOKEN"),
);
structural("a complete deployment says so in one place", "tools, all secrets set", (h) =>
  h.includes("all 3 set") && !h.includes("NOT SET"),
);
structural("a missing secret is named and counted", "tools, one secret missing", (h) =>
  h.includes("1 of 3 missing") && h.includes("NOT SET"),
);

/* 9. No-script floor */

/* Enhancements are additive; the scriptless render is the proof. */
structural(
  "search is still a native GET form with no script",
  "media, unused object",
  (h) => /<form[^>]*method="get"[^>]*role="search"|<form[^>]*role="search"[^>]*method="get"/.test(h),
);
structural(
  "the palette renders nothing on the server",
  "media, unused object",
  (h) => !h.includes('class="media-palette"'),
);
structural(
  "the alt suggestion is a submit button, not a click handler",
  "media, inspector on a template-placed file",
  (h) => /<button[^>]*type="submit"[^>]*class="media-suggestion"|<button[^>]*class="media-suggestion"[^>]*type="submit"/.test(h),
);
structural(
  "the tag chips are submit buttons carrying the resulting list",
  "media, inspector on a template-placed file",
  (h) => /<button[^>]*type="submit"[^>]*class="media-tag-suggestion"/.test(h),
);

/* Drawer and modals, rendered with no script or stylesheet. */

/* 1. Drawer */

structural(
  "the inspector is a dialog with a scrim",
  "media, detail open",
  (h) =>
    /<section[^>]*class="media-detail"[^>]*role="dialog"|<section[^>]*role="dialog"[^>]*class="media-detail"/.test(h) &&
    h.includes('class="media-detail-scrim"'),
);
/* An anchor dismisses without script. */
structural(
  "the scrim is a real link, so clicking away works with no script",
  "media, detail open",
  (h) => /<a[^>]*class="media-detail-scrim"[^>]*href="|<a[^>]*href="[^"]*"[^>]*class="media-detail-scrim"/.test(h),
);
structural(
  "the drawer is labeled and modal",
  "media, detail open",
  (h) => /aria-modal="true"/.test(h) && /aria-label="Details for /.test(h),
);
structural(
  "no scrim and no dialog when nothing is open",
  "media, unused object",
  (h) => !h.includes("media-detail-scrim") && !h.includes('role="dialog"'),
);

/* 2. Confirmations */

/*
 * Delete sits behind a confirmation state: an `onSubmit` `prompt()` never runs without
 * script, so the form submitted straight through.
 */
structural(
  "the trash view no longer submits the delete directly",
  "media, trash view",
  (h) => !h.includes('value="empty-trash"'),
);
structural(
  "the confirmation carries the delete, as a real form",
  "media, empty trash confirmation",
  (h) =>
    h.includes('class="media-modal"') &&
    /<input[^>]*name="intent"[^>]*value="empty-trash"/.test(h),
);
/* Enabled in the server render: nothing enables it without script. The action is the check. */
structural(
  "the confirm button is reachable without script",
  "media, empty trash confirmation",
  (h) => {
    const btn = /<button[^>]*class="btn-danger"[^>]*>/.exec(h)?.[0] ?? "";
    return btn.length > 0 && !btn.includes("disabled");
  },
);
structural(
  "the typed count is a named field, so the server can check it",
  "media, empty trash confirmation",
  /* Built from CONFIRM_FIELD, not its literal, so a rename moves the needle with the code. */
  (h) => new RegExp("<input[^>]*name=\"" + CONFIRM_FIELD + "\"").test(h),
);
/* Cancel is a link. */
structural(
  "cancel is a link back to the same view",
  "media, empty trash confirmation",
  (h) => /<a[^>]*class="btn-ghost"[^>]*>Cancel<\/a>|<a[^>]*>Cancel<\/a>/.test(h),
);

/**
 * The modal's own form; tiles carry the same `key` fields (hard rule 10).
 * @param {string} h
 * @returns {string}
 */
const modalForm = (h) => /<div[^>]*class="media-modal"[\s\S]*?<\/div>\s*<\/div>/.exec(h)?.[0] ?? "";

structural(
  "the bulk confirmation carries the selection it will act on",
  "media, bulk trash confirmation",
  (h) => {
    const modal = modalForm(h);
    return (
      modal.length > 0 &&
      /<input[^>]*name="intent"[^>]*value="bulk-trash"/.test(modal) &&
      /<input[^>]*name="key"[^>]*value="1234abcd5678ef90.png"/.test(modal)
    );
  },
);
/* Trash is reversible, so no typed count. */
structural(
  "the bulk confirmation asks for no typed count",
  "media, bulk trash confirmation",
  (h) => modalForm(h).length > 0 && !modalForm(h).includes('name="' + CONFIRM_FIELD + '"'),
);

/* 3. Selection bar */

structural(
  "a selection renders the bar with its size total and its trash trigger",
  "media, selection bar",
  (h) =>
    h.includes('class="posts-bulk"') &&
    h.includes('class="posts-bulk-size"') &&
    h.includes("Move to trash") &&
    h.includes("Copy addresses"),
);
structural(
  "no selection, no bar",
  "media, unused object",
  (h) => !h.includes('class="posts-bulk"'),
);

/* 4. Tile chrome */

/* Hidden by CSS only; keyboard and scan need the markup. */
/*
 * Keep "its checkbox" in the label: the `check:invariants` raw-SQL scanner misreads regex
 * literals here and parses `AND checkbox IN` as a column.
 */
structural(
  "the tile keeps its name link and its checkbox in the markup",
  "media, unused object",
  (h) =>
    /class="media-card-body"/.test(h) &&
    /class="media-name"/.test(h) &&
    /class="media-check-label"/.test(h),
);

/* Grouping headings and select-all wording. */

structural(
  "grouping by folder renders one heading per folder, not one per row",
  "media, grouped by folder",
  (h) => {
    const headings = [...h.matchAll(/class="media-group-heading"/g)].length;
    return headings === 2;
  },
);
/* Titles, not raw prefixes. */
structural(
  "folder headings are TITLES from the table, not raw prefixes",
  "media, grouped by folder",
  (h) => h.includes("Publications") && !h.includes(">/publications<"),
);
structural(
  "the roster section carries the note that stops a wrong delete",
  "media, grouped by folder",
  (h) => h.includes("Placed by the roster page template"),
);
structural(
  "grouping by month buckets an undated row separately",
  "media, grouped by month",
  (h) => h.includes("March 2026") && h.includes("No upload date"),
);
/* Not a library total. */
structural(
  "a group heading counts THIS PAGE in words",
  "media, grouped by folder",
  (h) => h.includes("on this page"),
);
/* Flat has no heading. */
structural(
  "the flat view renders no group heading",
  "media, flat view",
  (h) => !h.includes("media-group-heading"),
);

structural(
  "a filtered select-all says SHOWN, never bare all",
  "media, filtered and selected",
  (h) => h.includes("Select all 2 shown"),
);
structural(
  "a filtered select-all carries no bare count label",
  "media, filtered and selected",
  (h) => !h.includes("Select all 2<"),
);
/* Unfiltered keeps the bare form. */
structural(
  "an unfiltered select-all says the plain count",
  "media, two selected",
  (h) => h.includes("Select all 2<") && !h.includes("Select all 2 shown"),
);

/*
 * Draft preview links. A printed token is a capability, invisible to the payload baseline.
 * Every absence below pairs with a positive proving its needle can match.
 */

const [PREVIEW_A, PREVIEW_B] = PREVIEW_TOKENS;

/* Revoke copy carries a measured bound; both directions. */
structural(
  "the revoke clause states the measured within-a-minute bound",
  "edit, draft with no preview links",
  (h) => h.includes("within a minute of you revoking it"),
);
structural(
  "the revoke clause no longer claims revocation is instant",
  "edit, draft with no preview links",
  (h) => !h.includes("the moment you revoke it"),
);
/* Publication is immediate; keep that clause. */
structural(
  "the publication clause still claims the moment, because that one is true",
  "edit, draft with no preview links",
  (h) => h.includes("the moment this post is published"),
);

structural(
  "a draft with no links still offers to create one",
  "edit, draft with no preview links",
  (h) => h.includes("Create a preview link"),
);
structural(
  "a draft with no links says so, rather than rendering an empty list",
  "edit, draft with no preview links",
  (h) => h.includes("No preview links for this draft."),
);
structural(
  "a draft with no links renders no revoke control",
  "edit, draft with no preview links",
  (h) => !h.includes("Revoke"),
);

structural(
  "the list prints the six-character truncation of each token",
  "edit, draft with two preview links",
  (h) => h.includes(`${PREVIEW_A.slice(0, 6)}...`) && h.includes(`${PREVIEW_B.slice(0, 6)}...`),
);
structural(
  "the list offers a revoke control once the links exist",
  "edit, draft with two preview links",
  (h) => h.includes("Revoke"),
);
/*
 * The absolute URL is never printed. The token appears once, as the revoke form's hidden
 * field, so the URL's absence is asserted.
 */
structural(
  "the absolute preview URL is never printed in the list",
  "edit, draft with two preview links",
  (h) => !h.includes(`${PREVIEW_ORIGIN}/preview/`),
);
// The needle can match.
assert(
  "preview URL needle: the fixture's own URL contains the pattern",
  PREVIEW_LINKS[0].url.includes(`${PREVIEW_ORIGIN}/preview/`),
  "the absence assertion above would be vacuous",
);

/* The ruling, both halves. */
structural(
  "a published post offers NEITHER preview-link intent",
  "edit, published offers no preview links",
  (h) => !h.includes("Create a preview link") && !h.includes("Revoke"),
);
structural(
  "a published post renders no preview-link section at all",
  "edit, published offers no preview links",
  (h) => !h.includes("Preview links") && !h.includes(PREVIEW_A),
);

/*
 * Copy law, asserted on rendered markup: source identifiers such as `TrafficRow` are never
 * seen by a reader. Labels claim, prose explains, so the explaining `<details>` is exempt.
 * Each needle is word-anchored and checked against a decoy.
 */

/**
 * Whether a menu item has this label. React reorders attributes.
 * @param {string} html @param {string} label
 */
function hasMenuItem(html, label) {
  const buttons = html.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return buttons.some(
    (button) =>
      button.includes('class="row-menu-item"') &&
      button.includes("data-menu-item") &&
      button.replace(/<[^>]*>/g, "").trim() === label,
  );
}

const FORBIDDEN_COPY = ["visits", "visitors", "traffic", "page views"];
const TRAFFIC_STATES = ["origin requests, loaded", "origin requests, empty", "origin requests, error"];

/** Markup minus the exempt element. */
const withoutCaption = (/** @type {string} */ h) =>
  h.replace(/<details class="admin-explain origin-explain">[\s\S]*?<\/details>/gi, " ");

/* The exemption is neither empty nor total. */
{
  const loaded = htmlFor("origin requests, loaded");
  const stripped = withoutCaption(loaded);
  assert(
    "copy law: the exemption removes the disclosure and not the page",
    /class="admin-explain origin-explain"/.test(loaded) &&
      !/class="admin-explain origin-explain"/.test(stripped) &&
      stripped.length > loaded.length * 0.5,
    `loaded state is ${loaded.length} bytes, ${stripped.length} after removing the ` +
      `disclosure. Either none was found, or the strip took most of the page ` +
      `with it and every absence check below examines nothing.`,
  );
}

for (const word of FORBIDDEN_COPY) {
  const pattern = new RegExp(`\\b${word}\\b`, "i");
  // Decoy first.
  assert(
    `copy law: the needle for "${word}" can match`,
    pattern.test(`a sample ${word} here`),
    "the pattern never matches anything, so every absence check using it is vacuous",
  );
  for (const state of TRAFFIC_STATES) {
    structural(
      `copy law: "${word}" never labels anything in ${state}`,
      state,
      (h) => !pattern.test(withoutCaption(h)),
    );
  }
}

/* Readership: `live` and `truncated` differ only in `complete`. */

const READERSHIP_STATES = [
  "posts index, readership live",
  "posts index, readership truncated",
  "posts index, readership unavailable",
];

/* Cached reads never reach the Worker. */
for (const state of READERSHIP_STATES) {
  structural("readership: the column claims only what was counted", state, (h) =>
    /<th[^>]*>Reads counted<\/th>/.test(h),
  );
}

structural(
  "readership: a live count renders, formatted",
  "posts index, readership live",
  (h) => h.includes("1,234"),
);

/* Complete and absent is zero. */
structural(
  "readership: absent from a COMPLETE result renders as zero",
  "posts index, readership live",
  (h) => /class="posts-readership-count">0</.test(h),
);

/* Absent from a truncated result is not zero; `byPath[path] ?? 0` fails here. */
structural(
  "readership: absent from a TRUNCATED result is NOT zero",
  "posts index, readership truncated",
  (h) => !/class="posts-readership-count">0</.test(h),
);
structural(
  "readership: a truncated result says why there is no number",
  "posts index, readership truncated",
  (h) => h.includes("Not zero.") && h.includes("posts-readership-absent"),
);

/* Identical cells mean `complete` is ignored. */
{
  const cells = (/** @type {string} */ h) =>
    (h.match(/<td class="posts-readership">[\s\S]*?<\/td>/g) ?? []).join("");
  const live = cells(htmlFor("posts index, readership live"));
  const cut = cells(htmlFor("posts index, readership truncated"));
  assert(
    "structure: readership: complete and truncated render differently",
    live.length > 0 && cut.length > 0 && live !== cut,
    `live cells ${live.length} bytes, truncated ${cut.length} bytes, identical: ` +
      `${live === cut}. One boolean separates these two states; if the markup is ` +
      `the same the component is not reading it.`,
  );
}

/* A reason, never a number. */
structural(
  "readership: an unavailable source gives every row a reason",
  "posts index, readership unavailable",
  (h) => (h.match(/class="posts-readership-absent"/g) ?? []).length === POSTS.length,
);
structural(
  "readership: an unavailable source renders no count at all",
  "posts index, readership unavailable",
  (h) => !/class="posts-readership-count"/.test(h),
);

/* One owner (rule 17). */
for (const state of READERSHIP_STATES) {
  structural("readership: the caveat is CACHE_SENTENCE verbatim", state, (h) =>
    h.includes(escapeHtml(CACHE_SENTENCE)) || h.includes(CACHE_SENTENCE),
  );
}

/* Both pages obey the copy law. */
for (const word of FORBIDDEN_COPY) {
  const pattern = new RegExp(`\\b${word}\\b`, "i");
  for (const state of READERSHIP_STATES) {
    structural(
      `copy law: "${word}" never labels anything in ${state}`,
      state,
      (h) => !pattern.test(withoutCaption(h)),
    );
  }
}
for (const state of READERSHIP_STATES) {
  structural(`copy law: ${state} names the count honestly`, state, (h) =>
    /reads counted/i.test(h),
  );
}

// The required half.
for (const state of TRAFFIC_STATES) {
  structural(`copy law: ${state} says origin requests`, state, (h) =>
    /origin requests/i.test(h),
  );
}

/* Three distinct pages. */
structural(
  "loaded state renders a row per path",
  "origin requests, loaded",
  (h) => h.includes("/playground") && h.includes("origin-bar"),
);
structural(
  "loaded state states the sampling-weighted definition",
  "origin requests, loaded",
  (h) => h.includes("sampling") && h.includes("sum of the sampling interval"),
);
structural(
  "loaded state rolls up the paths it does not show",
  "origin requests, loaded",
  (h) => h.includes("Top 4 of 23 paths"),
);
/* The empty state is a SENTENCE, not a dash. */
structural(
  "empty state is a real sentence",
  "origin requests, empty",
  (h) => h.includes("No origin requests recorded in this window."),
);
structural(
  "empty state renders no table",
  "origin requests, empty",
  (h) => !h.includes("<table"),
);
/* Errors are visible prose. */
structural(
  "error state renders the message as visible prose",
  "origin requests, error",
  (h) => h.includes("No Analytics Engine read token is configured"),
);
structural(
  "error state still renders the panel frame",
  "origin requests, error",
  (h) => h.includes("Origin requests") && h.includes("chip-error"),
);
structural(
  "error state renders no table and no empty state",
  "origin requests, error",
  (h) => !h.includes("<table") && !h.includes("empty-state"),
);

/* Answer present, placeholder gone. */
structural(
  "the caption answers whether a cached serve is counted",
  "origin requests, loaded",
  (h) => h.includes("Cached responses never reach the Worker"),
);
structural(
  "the stated-absence placeholder is gone from the caption",
  "origin requests, loaded",
  (h) => !h.includes("has not been measured yet"),
);

/* Mentions: stranger input, read back both ways. */

const MENTION_STATES = [
  "mentions, populated queue",
  "mentions, delete awaiting confirmation",
  "mentions, sweep awaiting confirmation",
];

for (const state of MENTION_STATES) {
  structural("a stranger's author name is ESCAPED, not stripped", state, (h) =>
    h.includes(escapeHtml("<script>alert(1)</script>")),
  );
  /* Escaped present is not live absent. */
  structural("no live script element reaches the markup", state, (h) =>
    !h.includes("<script>alert(1)</script>"),
  );
  /* A stranger's URL stays text. */
  structural("a stranger's source URL is not an anchor", state, (h) =>
    !/<a[^>]*href="https:\/\/elsewhere\.example/.test(h),
  );
  /* The post's own slug may link. */
  structural("the target slug links to its editor", state, (h) =>
    h.includes('href="/admin/posts/a-post/edit"'),
  );
  /* Quoted, not page prose. */
  structural("the excerpt is a blockquote", state, (h) =>
    h.includes('<blockquote class="mention-quote">'),
  );
}

/* Chips with counts. */
/** @type {Array<[string, number]>} */
const FILTER_CHIPS = [
  ["Pending", 1],
  ["Failed", 1],
  ["Approved", 1],
  ["Rejected", 1],
  ["All", 5],
];
for (const [label, count] of FILTER_CHIPS) {
  structural(`the ${label} filter is a chip carrying its count`, "mentions, populated queue", (h) =>
    new RegExp(
      `<a[^>]*href="/admin/mentions\\?status=${label.toLowerCase()}"[^>]*>${label} ` +
        `<span class="admin-chip-count">${count}</span></a>`,
    ).test(h),
  );
}

/* All includes `unverified`. */
structural(
  "the All count is every row in the fixture, so the chips account for all of them",
  "mentions, populated queue",
  (h) => h.includes('<span class="admin-chip-count">5</span>'),
);

/* One current chip. */
structural(
  "the current filter is the only one marked aria-current",
  "mentions, pending filter",
  (h) =>
    (h.match(/aria-current="page"/g) ?? []).length === 1 &&
    /<a[^>]*aria-current="page"[^>]*href="\/admin\/mentions\?status=pending"/.test(h),
);
structural(
  "the current filter carries the active class the stylesheet keys on",
  "mentions, pending filter",
  (h) => h.includes('class="admin-chip is-active"'),
);

/* No link: nothing to decide. */
structural(
  "unverified mentions are a chip on the filter row",
  "mentions, populated queue",
  (h) => /<span class="chip mention-unverified">\s*1 unverified\s*<\/span>/.test(h),
);
/* Absent, not zero. */
structural(
  "the unverified chip is absent when there are none",
  "mentions, empty queue",
  (h) => !h.includes("mention-unverified"),
);

/* Headings asserted gone. */
for (const heading of ["Pending", "Failed verification", "Approved", "Rejected"]) {
  structural(`the ${heading} group heading is gone`, "mentions, populated queue", (h) =>
    !h.includes(`>${heading}</h2>`),
  );
}

structural(
  "an empty filter says which filter is empty",
  "mentions, empty pending filter",
  (h) => h.includes("No pending mentions."),
);
structural(
  "an empty filter renders no empty-state box",
  "mentions, empty pending filter",
  (h) => !h.includes("empty-state"),
);
structural(
  "an empty filter shows no rows from the other statuses",
  "mentions, empty pending filter",
  (h) => !h.includes("mention-row"),
);
structural(
  "an empty table says so in words too",
  "mentions, empty queue",
  (h) => h.includes("No mentions yet.") && !h.includes("empty-state"),
);

/* Box matches outcome. */
structural(
  "a success renders in the notice box",
  "mentions, success notice",
  (h) => /<p class="editor-notice mention-feedback" role="status">Mention approved\.<\/p>/.test(h),
);
structural(
  "a success does NOT render in the error box",
  "mentions, success notice",
  (h) => !h.includes("panel-error"),
);
structural(
  "a refusal renders in the error box",
  "mentions, refusal",
  (h) => /<p class="panel-error mention-feedback" role="status">That mention id is not valid\.<\/p>/.test(h),
);
structural(
  "a refusal does NOT render in the notice box",
  "mentions, refusal",
  (h) => !h.includes("editor-notice"),
);

/* Weight is the class. */
structural(
  "Approve is the primary",
  "mentions, populated queue",
  (h) => /<button type="submit" class="btn">\s*Approve\s*<\/button>/.test(h),
);
structural(
  "Reject is the secondary",
  "mentions, populated queue",
  (h) => hasMenuItem(h, "Reject"),
);
structural(
  "Delete is the text weight",
  "mentions, populated queue",
  (h) => hasMenuItem(h, "Delete"),
);
/* No danger fill on rows. */
structural(
  "no row action is a danger fill",
  "mentions, populated queue",
  (h) => !h.includes("btn-danger"),
);

/*
 * Stated once, on the pending filter. A literal string, never a /g regex: `lastIndex`
 * carries between the `.test()` calls below.
 */
const PURGE_CLAUSE = "Approving appears on the post within seconds.";
const purgeCount = (/** @type {string} */ h) => h.split(PURGE_CLAUSE).length - 1;

structural(
  "the purge clause is stated once on the pending filter",
  "mentions, pending filter",
  (h) => purgeCount(h) === 1,
);
/* Above the queue. */
structural(
  "the purge clause sits above the queue, not inside it",
  "mentions, pending filter",
  (h) => {
    const clause = h.indexOf(PURGE_CLAUSE);
    const queue = h.indexOf("mention-queue");
    return clause !== -1 && queue !== -1 && clause < queue;
  },
);
/* Both negatives: not on every filter, not over an empty queue. */
structural(
  "the purge clause is absent on the all filter",
  "mentions, populated queue",
  (h) => purgeCount(h) === 0,
);
structural(
  "the purge clause is absent when the pending filter is empty",
  "mentions, empty pending filter",
  (h) => purgeCount(h) === 0,
);
structural(
  "the purge paragraph and its minute count are gone",
  "mentions, populated queue",
  (h) => !h.includes("Approving purges") && !h.includes("within 10 minutes"),
);

/* Windows come from the constants. */
structural(
  "the retention line names both windows, from the constants",
  "mentions, populated queue",
  (h) =>
    h.includes(
      `Failed mentions are removed after ${FAILED_RETENTION_DAYS} days, rejected after ` +
        `${REJECTED_RETENTION_DAYS} days.`,
    ),
);
structural(
  "the retention essay is gone",
  "mentions, populated queue",
  (h) => !h.includes("are never swept") && !h.includes("open-queue cap"),
);
/* The label carries the count. */
structural(
  "the sweep button is labeled with what it would remove",
  "mentions, populated queue",
  (h) => /<button type="submit" class="btn-secondary">Remove 3 expired<\/button>/.test(h),
);
structural(
  "with nothing expired the button is disabled and keeps its label",
  "mentions, nothing expired",
  (h) =>
    /<button type="submit" class="btn-secondary" disabled="">Remove 0 expired<\/button>/.test(h),
);

/* Asserted together: "verified is absent" alone passes a row with no stamps. */
structural(
  "the row stamps received, and drops verified",
  "mentions, populated queue",
  (h) => h.includes("received 2026-09-01T10:00:00Z") && !h.includes("verified 2026-09-01"),
);
structural(
  "a decided row stamps when it was decided",
  "mentions, populated queue",
  (h) => h.includes("received 2026-08-26T09:00:00Z") || h.includes("decided 2026-08-26T09:00:00Z"),
);
structural(
  "a failed row stamps its reason",
  "mentions, populated queue",
  (h) => h.includes(", reason no-link"),
);

/* Only a render shows a scriptless second step. */
structural(
  "the delete refusal renders a typed-confirmation field",
  "mentions, delete awaiting confirmation",
  (h) =>
    h.includes(`name="${CONFIRM_FIELD}"`) &&
    /Type\s*<strong>1<\/strong>\s*to confirm/.test(h),
);
structural(
  "the delete refusal carries the id back, so the second step names the same row",
  "mentions, delete awaiting confirmation",
  (h) => /<input[^>]*name="id"[^>]*value="1"/.test(h),
);
structural(
  "the sweep refusal states the quantity at stake",
  "mentions, sweep awaiting confirmation",
  (h) => h.includes("2 failed and 1 rejected mention(s)"),
);
structural(
  "the sweep refusal renders a typed-confirmation field",
  "mentions, sweep awaiting confirmation",
  (h) => h.includes(`name="${CONFIRM_FIELD}"`),
);
/* No field before it is asked for. */
structural(
  "no confirmation field is rendered before the action asks for one",
  "mentions, populated queue",
  (h) => !h.includes(`name="${CONFIRM_FIELD}"`),
);

console.log(`  ${STATES.length} state(s) rendered, ${submissionsCompared} submission(s) compared`);

/*
 * No-script fallback: the display axes stay real links. `shouldRevalidate` handles them on
 * the client, so a rotted anchor goes unseen. `hrefWith` omits defaults, so a default value
 * is an anchor to the bare URL.
 */

/*
 * Scoped to each axis nav: every link preserves the view state, so a page-wide search
 * passes a toggle that became a button (hard rule 10).
 */
/** @type {Record<string, { nav: string, values: string[] }>} */
const AXIS_CONTROL = {
  view: { nav: "Layout", values: VIEWS },
  group: { nav: "Group by", values: GROUPS },
  size: { nav: "Tile size", values: SIZES },
};

/**
 * The labeled `<nav>` markup, or "".
 * @param {string} html
 * @param {string} ariaLabel
 */
function navNamed(html, ariaLabel) {
  const open = html.indexOf(`aria-label="${ariaLabel}"`);
  if (open === -1) return "";
  const start = html.lastIndexOf("<nav", open);
  const end = html.indexOf("</nav>", open);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end);
}

/* SCOPED-BY: `navNamed`. */
const displayStates = [...renderedHtml.entries()].filter(
  ([, html]) => navNamed(html, "Layout").length > 0,
);

/* Scope non-empty: a renamed control would otherwise pass over zero states. */
assert(
  "the no-script section found states that render the display controls",
  displayStates.length >= 44,
  `only ${displayStates.length} rendered state(s) contain the layout toggle, floor 44, measured 48 on 2026-08-24`,
);

/** @param {string} html */
const hrefsOf = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

for (const axis of DISPLAY_AXES) {
  const control = AXIS_CONTROL[axis];
  checks += 1;
  if (!control) {
    fail(`no-script: ${axis} has no control group in this gate, so it is unasserted`);
    continue;
  }

  // Control first.
  const owning = displayStates
    .map(([name, html]) => [name, navNamed(html, control.nav)])
    .filter(([, nav]) => nav.length > 0);
  assert(
    `no-script: the ${axis} control renders a nav labeled "${control.nav}"`,
    owning.length > 0,
    `no rendered state contains <nav aria-label="${control.nav}">, so the ` +
      `control that owns ${axis} is gone and its options cannot be links.`,
  );

  for (const value of control.values) {
    const isDefault =
      /** @type {Record<string, unknown>} */ (MEDIA_DEFAULTS)[axis] === value;
    const hit = owning.some(([, nav]) =>
      hrefsOf(nav).some((href) =>
        isDefault
          ? href.startsWith("/admin/media") && !href.includes(`${axis}=`)
          : new RegExp(`[?&]${axis}=${value}(&|$)`).test(href),
      ),
    );
    assert(
      `no-script: ${axis}=${value} is reachable by an anchor`,
      hit,
      isDefault
        ? `no rendered anchor points at /admin/media without ${axis}=, which is ` +
            `how the default value is spelled. The control stopped being a link.`
        : `no rendered anchor carries ${axis}=${value}. With scripting off this ` +
            `control does nothing, so the client-side display switch has become ` +
            `a dependency rather than an enhancement.`,
    );
  }
}

/*
 * The server resolves display axes from the URL; if the client overlay is not a no-op
 * there, scriptless readers get the default layout.
 */
const gridStates = STATES.filter(
  (state) => typeof state.url === "string" && state.url.includes("view=grid"),
);
assert(
  "no-script: some rendered state requests the grid",
  gridStates.length > 0,
  "no state carries view=grid, so the server-side resolution is unasserted",
);
for (const state of gridStates) {
  const html = renderedHtml.get(state.name) ?? "";
  if (!html.includes("media-grid")) continue;
  assert(
    `no-script: ${state.name} server-renders data-view="grid"`,
    html.includes('data-view="grid"'),
    `the URL asked for the grid and the markup came back with the default ` +
      `layout, so the server no longer resolves view from the request URL.`,
  );
}

/*
 * Pending transitions. One static pass keeps `useNavigation` idle, so this proves only that
 * `data-pending` is conditional; a hardcoded mark would dim every page.
 */
let pendingStatesChecked = 0;
for (const [name, html] of renderedHtml) {
  if (!html.includes("data-pending")) continue;
  pendingStatesChecked += 1;
  fail(
    `${name}: renders data-pending while idle, so the results region is dimmed ` +
      `and inert on every load. The attribute must come from useNavigation.`,
  );
}
checks += 1;
assert(
  "pending: no state renders as pending while the router is idle",
  pendingStatesChecked === 0,
  `${pendingStatesChecked} state(s) carried data-pending in a static render`,
);

/* From the router, not local state. */
for (const routeFile of [
  "app/routes/admin.media._index.tsx",
  "app/routes/admin.posts._index.tsx",
]) {
  const src = readFileSync(join(root, routeFile), "utf8");
  // SCOPED-BY: the whole file, so any hand-rolled mark fails.
  const marks = src.includes("data-pending");
  assert(
    `pending: ${routeFile} drives data-pending from useNavigation`,
    // SCOPED-BY: the whole file.
    !marks || src.includes("useNavigation"),
    `the route sets data-pending without importing useNavigation, so the ` +
      `pending signal is hand-rolled state rather than the router's.`,
  );
}

/* Free text needs a GET form. */
assert(
  "no-script: the media search renders as a GET form naming its action",
  displayStates.some(([, html]) =>
    /<form[^>]*method="get"[^>]*action="\/admin\/media"/.test(html) ||
    /<form[^>]*action="\/admin\/media"[^>]*method="get"/.test(html),
  ),
  "no rendered state contains a GET form posting to /admin/media",
);

/* Ruling 54 */

/*
 * (1) Confirmation dialog. A disabled submitter sends no name or value, so the intent must
 * be a field for disable-until-match to work.
 */
const confirmState = renders["posts index, bulk delete awaiting confirmation"] ?? "";
const confirmDialog = confirmState.slice(
  confirmState.indexOf("<dialog"),
  confirmState.indexOf("</dialog>") + "</dialog>".length,
);

assert(
  "confirmation: the state renders a <dialog>, not a bare form",
  confirmDialog.startsWith("<dialog") && confirmDialog.endsWith("</dialog>"),
  `found ${confirmDialog.slice(0, 80) || "no dialog element"}`,
);

assert(
  "confirmation: the intent travels as a hidden field",
  /<input[^>]*type="hidden"[^>]*name="intent"[^>]*value="bulk-delete"/.test(confirmDialog),
  "no hidden intent input inside the dialog; a disabled submit button would " +
    "send no intent at all and the confirmation could never be disabled",
);

assert(
  "confirmation: the intent is NOT on the submit button",
  !/<button[^>]*name="intent"/.test(confirmDialog),
  "the submitter carries the intent, which is the shape that cannot be disabled",
);

assert(
  "confirmation: the typed field is required and named from the constant",
  new RegExp(`<input[^>]*name="${CONFIRM_FIELD}"[^>]*required`).test(confirmDialog) ||
    new RegExp(`<input[^>]*required[^>]*name="${CONFIRM_FIELD}"`).test(confirmDialog),
  `no required input named ${CONFIRM_FIELD} inside the dialog`,
);

/*
 * Inline and enabled on the server: a `<dialog>` without `open` or `data-inline` is hidden,
 * and nothing enables the button without script.
 */
assert(
  "confirmation: renders inline on the server, so no script still reaches it",
  /<dialog[^>]*data-inline=""/.test(confirmDialog),
  "the dialog has no data-inline attribute, so with no script it is display:none",
);

assert(
  "confirmation: the confirm button is ENABLED in the server render",
  !/<button[^>]*type="submit"[^>]*disabled/.test(confirmDialog),
  "a server-disabled button can never be enabled without script",
);

/* No effects run here; read the source. */
const confirmSource = stripComments(
  readFileSync(join(root, "app/components/admin/confirm-dialog.tsx"), "utf8"),
);
assert(
  "confirmation: the component opens it with showModal()",
  /showModal\(\)/.test(confirmSource),
  "no showModal() call; the dialog would never become modal or draw a scrim",
);
assert(
  "confirmation: the confirm button is disabled until the typed value matches",
  /disabled=\{hydrated && !satisfied\}/.test(confirmSource) &&
    /const satisfied = typed\.trim\(\) === requireTyped/.test(confirmSource),
  "the button's disabled state is not bound to an exact match of the typed value",
);
assert(
  "confirmation: the component focuses the typed field when it opens",
  /fieldRef\.current\?\.focus\(\)/.test(confirmSource),
  "nothing focuses the field, so the ceremony opens with focus nowhere useful",
);

/*
 * (2) Drawer opener at 375. No viewport here, so the markup and breakpoint are checked;
 * hiding the rail strands a narrow reader.
 */
const shellSource = stripComments(readFileSync(join(root, "app/routes/admin.tsx"), "utf8"));
const shellCss = stripComments(
  readFileSync(join(root, "app/styles/admin-shell.css"), "utf8"),
);
assert(
  "drawer: the shell renders the opener, naming the sidebar it controls",
  /className="admin-menu-button"/.test(shellSource) &&
    /aria-controls="admin-sidebar"/.test(shellSource),
  "no .admin-menu-button carrying aria-controls for the sidebar",
);
assert(
  "drawer: the stylesheet reveals the opener at the narrow breakpoint",
  /\.admin-menu-button\s*\{[^}]*display:\s*inline-flex/.test(shellCss),
  "nothing gives .admin-menu-button a display, so the opener never appears",
);
assert(
  "drawer: the narrow sidebar is a drawer, never display:none",
  !/\.admin-sidebar\s*\{[^}]*display:\s*none/.test(shellCss) &&
    /\.admin-sidebar\s*\{[^}]*z-index:\s*var\(--z-drawer\)/.test(shellCss),
  "the sidebar is hidden rather than moved off canvas at the narrow width",
);

/* (3) Status sentence agrees with the notice. */
/** The one status sentence a page opens with. @param {string} html */
function statusLine(html) {
  const m = html.match(/<p class="admin-page-status">([\s\S]*?)<\/p>/);
  return m ? m[1].replace(/<[^>]*>/g, "") : "";
}
/** @param {string} html */
function hasProblemNotice(html) {
  return /<section class="admin-notice" data-tone="(warning|error)"/.test(html);
}

/** @type {Array<[string, boolean]>} */
const STATUS_AGREEMENT = [
  ["overview, one check failing", true],
  ["overview, all healthy", false],
  ["posts index, Ask drifted", true],
  ["posts index, clean", false],
];
for (const [state, expectProblem] of STATUS_AGREEMENT) {
  const html = renders[state] ?? "";
  const line = statusLine(html);
  assert(
    `${state}: the page opens with one status sentence`,
    line.trim().length > 0,
    "no .admin-page-status paragraph rendered",
  );
  assert(
    `${state}: the notice and the status sentence agree`,
    hasProblemNotice(html) === expectProblem,
    `notice ${hasProblemNotice(html) ? "present" : "absent"}, expected ` +
      `${expectProblem ? "present" : "absent"}; sentence read "${line.trim().slice(0, 90)}"`,
  );
  /* No clean claim under a notice. */
  const claimsClean = /up to date|Everything agrees/i.test(line);
  assert(
    `${state}: the status sentence does not claim health under a notice`,
    !(expectProblem && claimsClean),
    `sentence read "${line.trim().slice(0, 120)}" while a notice was on the page`,
  );
}

/*
 * (4) No prose in any admin table: a `<caption>` is announced before every row. Runs over
 * every rendered state, so a new table is covered at once.
 */
for (const state of STATES) {
  const html = renders[state.name];
  if (!html) continue;
  const tables = html.match(/<table[\s\S]*?<\/table>/g) ?? [];
  if (tables.length === 0) continue;
  const offending = tables.filter((table) => /<p[\s>]/.test(table) || /<caption/.test(table));
  assert(
    `${state.entry}: no paragraph or caption inside a table (${state.name})`,
    offending.length === 0,
    `${offending.length} of ${tables.length} table(s) carry prose; an explanation ` +
      `belongs in a <details> under the table, where it is read once`,
  );
}

/*
 * (5) No 0.375rem in the sheets this pass owns. Comments are stripped first because the
 * rule's own explanation quotes the literal.
 */
const OWNED_SHEETS = ["app/styles/admin-shell.css", "app/styles/admin-posts.css"];
for (const sheet of OWNED_SHEETS) {
  const text = stripComments(readFileSync(join(root, sheet), "utf8"));
  const lines = text.split(/\r?\n/);
  /** @type {string[]} */
  const hits = [];
  lines.forEach((line, i) => {
    if (line.includes("0.375rem")) hits.push(`${sheet}:${i + 1}`);
  });
  assert(
    `${sheet}: no 0.375rem, only --r-control and --r-panel`,
    hits.length === 0,
    `off-scale value at ${hits.join(", ")}`,
  );
}
/* Scope non-empty: an unread file reports what a clean sweep reports. */
assert(
  "the 0.375rem scan read both owned stylesheets",
  OWNED_SHEETS.every(
    (sheet) => stripComments(readFileSync(join(root, sheet), "utf8")).length > 1000,
  ),
  "a stylesheet read empty, so its clean result means nothing",
);

/*
 * Executed-count floor: the total is the only witness to a block that stopped running.
 * Measured by running this gate, never summed; the slack absorbs a retired state.
 */
const MINIMUM_CHECKS = 682;
/* `assertFloor` prints the live count (hard rule 17). */
const floorBreach = assertFloor("check:admin-ui", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) fail(`this gate executed its assertions: ${floorBreach}`);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
