/**
 * Gate over what the admin's forms SUBMIT.
 *
 * OBSERVATION BOUNDARY: reduces each page to the set of requests it can SUBMIT.
 * It renders components with stubbed loaders, so it sees no server behaviour, no
 * styling and no layout: a page that submits correctly and is unusable passes.
 * A component that CALLS a stubbed .server export throws here, because the stub
 * is a Proxy with no own keys.
 *
 *   npm run check:admin-ui
 *   npm run check:admin-ui -- --update    (rewrites the baseline, deliberately loud)
 *
 * The admin redesign is a UI-only change running under one hard rule: a control
 * may move anywhere, but pressing it must send exactly what it sent before.
 * Nothing else in the check family can see that. A typecheck cannot: the form
 * fields are strings in JSX. check:content cannot: no content changes. And no
 * gate can reach /admin over HTTP, because it is behind a real Google session.
 *
 * So this renders the three admin routes as components and reads their markup
 * back, reducing each page to the set of requests it can issue:
 *
 *     METHOD action | intent | comma-joined field names
 *
 * That tuple is what the server actually consumes. `handleEditorAction`
 * dispatches on `intent`, and `fieldsFromForm` reads a fixed set of keys, so
 * two different-looking pages with the same tuple set are the same API client.
 *
 * The baseline in scripts/fixtures/admin-ui-payloads.json was generated from
 * the editor as it stood BEFORE the Session 2 redesign, which is the whole
 * point: the fixture is the checkbox era's payload shape, and the gate passing
 * today means the redesign did not change it.
 *
 * FAILS CLOSED. A missing fixture is an error, not an empty pass, and every
 * comparison is paired with a count so "0 differences" can never quietly mean
 * "0 pages rendered".
 *
 * Pure: no database, no network, no session. It does bundle with esbuild, and
 * it stubs the routes' server-only imports rather than running them, so it
 * proves things about components and nothing about loaders or actions.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decide, readState } from "../app/lib/editor/publish-policy.mjs";
import { stateOf, transitionsFor } from "../app/lib/editor/publish-transition.mjs";
import {
  bundleRoutes,
  importBundled,
  renderRoute,
  submissionKeys,
} from "./lib/route-render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(root, "scripts", "fixtures", "admin-ui-payloads.json");
const update = process.argv.includes("--update");

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

/* -------------------------------------------------------------------------
 * The loader states each route is rendered in.
 *
 * These describe the SHAPES a loader can hand a component, not real data. A
 * state exists here when it changes which controls render: a drafted post and
 * a published one offer different transitions, a drifted Ask index adds an
 * alert that owns a repair, a conflict replaces the feedback slot.
 * ---------------------------------------------------------------------- */

const POSTS = [
  { slug: "live-one", title: "A live post", status: "published", state: "published", publishAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z", tags: ["cloudflare"], scheduledInDays: null },
  // `scheduledInDays` arrives PRE-COMPUTED, which is the contract the loader
  // owes: the component may not read the clock, so a fixture that made it
  // derive one from the date would be testing a rule the code must not follow.
  { slug: "soon", title: "A scheduled post", status: "published", state: "scheduled", publishAt: "2099-01-02T00:00:00.000Z", updatedAt: "2026-07-02T00:00:00.000Z", tags: ["cloudflare", "d1"], scheduledInDays: 12 },
  { slug: "wip", title: "A draft post", status: "draft", state: "draft", publishAt: null, updatedAt: "2026-07-02T00:00:00.000Z", tags: [], scheduledInDays: null },
];

/** One object in the media library, overridable per scenario. */
const MEDIA_OBJECT = (over = {}) => ({
  key: "1234abcd5678ef90.png",
  url: "/media/1234abcd5678ef90.png",
  // The THUMBNAIL url, carrying the transform width. The gate renders it, so a
  // regression that started serving originals into the grid would show here as
  // a changed src.
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
  // A row WITH an LQIP. The null-placeholder case is its own scenario below,
  // because it is 11 of the 70 real rows and renders a different tile.
  placeholder: "data:image/webp;base64,UklGRg==",
  deletable: true,
  viewable: true,
  citations: [],
  refCount: 0,
  ...over,
});

/**
 * The loader's non-object fields.
 *
 * One helper so a change to the loader's shape is one edit rather than five.
 * These went stale once already and it was not caught: Phase 3 replaced
 * `cursor`/`truncated`/`unannotated` with `page`/`hasMore`/`counts`, this gate
 * was not run in that session or the next, and every media scenario had been
 * failing with "Cannot read properties of undefined" ever since.
 */
const MEDIA_SHELL = (over = {}) => ({
  picker: false,
  page: 1,
  hasMore: false,
  filter: "content",
  scanComplete: true,
  scanFailed: [],
  counts: [{ storage: "r2", kind: "image", n: 1 }],
  roleCounts: [{ role: "content", n: 1 }],
  /* The v1 library's additions. `q` is echoed so the search input, the chips
   * and the pager all carry it; `unusedCount` is the chip's number, from the
   * same predicate the filter uses; `detail` is the `?key=` view, which is
   * where alt editing and delete moved to; `uploaded` and `uploadError` are the
   * flash the upload route redirects back with. */
  q: "",
  unusedCount: 0,
  detail: null,
  uploaded: null,
  uploadError: null,
  ...over,
});

/** The `?key=` view's loader shape, overridable per scenario. */
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
  ...over,
});

/** The unfiltered view: every filter empty, nothing narrowed. */
const NO_FILTERS = {
  filters: { q: "", status: "", tag: "" },
  filtered: false,
  total: POSTS.length,
  scheduledTotal: 1,
  tagOptions: ["cloudflare", "d1", "workers"],
};

const ASK_CLEAN = { present: 93, expected: 93, missing: [], stale: [] };
const ASK_DRIFTED = { present: 90, expected: 93, missing: ["a", "b", "c"], stale: ["x"] };
const BUDGET = { count: 4, limit: 200, day: "2026-07-31" };

/** @param {Partial<Record<string, unknown>>} over */
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
  ...over,
});

const HEAD = "abc1234def5678";

/** Everything the edit route's loader hands its component. */
const editLoader = (over = {}) => ({
  fields: fields(),
  headSha: HEAD,
  slug: "a-post",
  saved: null,
  tagOptions: ["cloudflare", "d1", "workers"],
  // The Cmd+K palette's corpus. It renders nothing until the palette opens, so
  // it changes no submission here; it is present because the component reads it
  // and a loader shape the gate does not supply is a loader shape it is not
  // actually testing.
  linkTargets: [
    { slug: "live-one", title: "A live post", state: "published" },
    { slug: "wip", title: "A draft post", state: "draft" },
  ],
  // The drawer's revision list, RENDERED rather than omitted, and that is the
  // point. Ruling 1 says a restore loads and never writes; the way this gate
  // can hold that rule is by rendering the control and observing that the
  // page's submission set does not grow. An empty list would have proved
  // nothing, because a control that is not rendered submits nothing either.
  revisions: [
    { sha: "1111111111111111111111111111111111111111", message: "Latest edit", author: "Dustin Edwards", date: "2026-08-01T10:00:00Z" },
    { sha: "2222222222222222222222222222222222222222", message: "An earlier edit", author: "Dustin Edwards", date: "2026-07-30T09:00:00Z" },
  ],
  everPublished: false,
  state: "draft",
  ...over,
});

/*
 * The origin-requests panel's three SourceResult shapes.
 *
 * Hand-authored rather than produced by the source module, per rule 10's
 * fixture-independence clause: a gate whose expected values come out of the
 * code under test is a mirror. `originRequests` differs from `rows` in the live
 * fixture on purpose, so the sampling-weighted path is the one exercised.
 */
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

/** @type {Array<{ name: string, entry: string, path: string, url: string, loaderData: unknown, actionData?: unknown, params?: Record<string,string>, props?: Record<string,unknown> }>} */
const STATES = [
  // ---- posts index --------------------------------------------------------
  {
    name: "posts index, clean",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, ...NO_FILTERS },
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
  // The two filtered views exist here because they change WHICH CONTROLS
  // RENDER, which is this gate's admission test: a filtered list gains a Clear
  // link, and a filtered list that matched nothing replaces the table with an
  // empty state carrying a second way out. An empty RESULT is not an empty
  // corpus and the two must not collapse into one scenario.
  /*
   * SELECTION IS A STATE, and until 2026-08-12 this gate could not reach it.
   *
   * The harness renders one static pass and dispatches no events, so the bulk
   * bar never mounted and the three bulk intents contributed NO payload: the
   * most destructive surface in the admin was outside the fixture entirely.
   * Session D shipped with that stated; this closes it.
   *
   * `props` seeds the route's own useState through route-render.mjs. The route
   * takes an optional prop with a production default, so nothing on the wire
   * can set it.
   *
   * TWO selected rather than one, deliberately: a single selection would render
   * "1 selected" and hide any plural or count-formatting defect, and the delete
   * confirmation reads the count.
   */
  {
    name: "posts index, two selected",
    entry: "app/routes/admin.posts._index.tsx",
    path: "/admin/posts",
    url: "/admin/posts",
    loaderData: { posts: POSTS, ask: ASK_CLEAN, budget: BUDGET, ...NO_FILTERS },
    props: { initialSelection: [POSTS[0].slug, POSTS[1].slug] },
  },
  /*
   * FILTERED **AND** SELECTED, the combination D.1 left uncovered and the
   * decisions log folded into this session.
   *
   * Two states existed separately: filtered-with-matches (no selection, so no
   * bulk bar) and two-selected (unfiltered, so the select-all label reads
   * "Select all 3" with no "shown"). Neither could see the ruled behaviour,
   * which only appears where both hold at once: the label must say SHOWN
   * whenever a filter is active, because select-all reaches only the rows on
   * screen and a bare "all" would claim the corpus.
   *
   * TWO posts visible and ONE selected, deliberately. Two so the count is not
   * the degenerate 1, and one selected so `allShown` is false, which is the
   * state where a reader is most likely to mistake the control's reach.
   *
   * No new harness seam: this reuses `initialSelection`, so the seam count
   * stays at ONE against the ruled ceiling of three.
   */
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

  // ---- media library ------------------------------------------------------
  //
  // The grid states render the same controls as each other now: the v1 redesign
  // moved alt editing and delete OUT of the tiles and into the `?key=` detail
  // view, so what a grid state proves is the search form, the upload form and
  // the maintenance menu, and what a DETAIL state proves is the two per-asset
  // mutations. Both matter: a regression that put a delete button back on
  // seventy tiles would change every grid state's payload set and fail here.
  //
  // A failed scan is still its own state, because it is what ruling 4 turns on.
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
    // Ruling 4's state: usage is unknown, so nothing is labelled unused and the
    // action refuses every delete.
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
    // A DOCUMENT: 31 of the 70 real rows. It has no thumbnail the Images
    // binding can produce, so the tile renders a label instead of an <img>
    // pointed at something that cannot exist.
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
    // A STATIC row: not deletable through the UI, so it renders the explanation
    // instead of the delete form. The refusal itself lives in the action and is
    // not what this proves; this proves the page stops OFFERING the control, so
    // a regression that put the button back would change this scenario's
    // payload set and fail here.
    name: "media, static row",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      filter: "brand",
      objects: [
        MEDIA_OBJECT({
          key: "/logo.svg",
          url: "/logo.svg",
          // A static asset is its OWN url. Prefixing /media/ produced
          // `/media//logo.svg` and 404'd every one of the 58 static rows.
          thumb: "/logo.svg",
          storage: "static",
          role: "brand",
          mime: "image/svg+xml",
          originalName: null,
          // EVERY SVG HAS A NULL PLACEHOLDER: the Images binding does not
          // rasterize vectors. 11 of the 70 real rows are in this state, so the
          // tile must degrade to a plain surface rather than a blank hole.
          placeholder: null,
          deletable: false,
        }),
      ],
      roleCounts: [{ role: "brand", n: 1 }],
    }),
  },
  {
    // SEARCH WITH RESULTS. `q` is echoed back, so the input renders its value,
    // the chips carry it and the pager carries it; the Clear link only exists
    // in this state.
    name: "media, search with results",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?q=picture",
    loaderData: MEDIA_SHELL({ q: "picture", objects: [MEDIA_OBJECT()], unusedCount: 1 }),
  },
  {
    // SEARCH THAT FOUND NOTHING. A different empty state from an empty bucket:
    // it offers to widen the group or clear the search rather than to upload.
    name: "media, search with nothing found",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?q=zzzz",
    loaderData: MEDIA_SHELL({ q: "zzzz", objects: [] }),
  },
  {
    // THE DETAIL VIEW, where set-alt and delete now live. Both mutations must
    // appear HERE and nowhere else, which is exactly what comparing this
    // scenario against the grid ones asserts.
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
    // A DETAIL for a STATIC row. It is not deletable through the UI, so the
    // page stops OFFERING the control and explains why instead. The action
    // refuses it regardless; this proves the offer is gone, so a regression
    // that put the button back changes this payload set.
    name: "media, detail for a static row",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=/logo.svg",
    loaderData: MEDIA_SHELL({
      filter: "brand",
      objects: [],
      roleCounts: [{ role: "brand", n: 1 }],
      detail: MEDIA_DETAIL({
        key: "/logo.svg",
        url: "/logo.svg",
        thumb: "/logo.svg",
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
    // A KEY THE INDEX DOES NOT HAVE, which is what a bookmarked detail link
    // becomes after the object is deleted. It must render a way back rather
    // than a blank panel or a crash.
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
    // UPLOAD ACCEPTED. The form itself renders in every state; this is the one
    // where the route's redirect has landed, so the flash and its link render.
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
    // UPLOAD REFUSED. The route redirects with a CODE and the loader turns it
    // into the sentence; the page renders whatever it was handed.
    name: "media, upload refused",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?upload-error=too-large",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      uploadError: "That image is over the 10 MB limit.",
    }),
  },

  // ---- new post -----------------------------------------------------------
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

  // ---- edit ---------------------------------------------------------------
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

  // ---- origin requests ----------------------------------------------------
  //
  // Three states, and the ERROR one is not hypothetical: the read token is
  // optional by contract and a development machine never carries it, so the
  // error is what this route renders locally every single time. It is covered
  // first for that reason rather than last.
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
];

/* ---------------------------------------------------------------------- */

console.log("\ncheck:admin-ui\n");

/* -------------------------------------------------------------------------
 * Section 1: the publish state machine, as a table rather than as pixels.
 *
 * Rendering cannot see what a button does when it is clicked, so the mapping
 * from post state to transition lives in a module and is asserted here, exactly
 * as check:policy asserts publish-policy.mjs. `wantsDraft` is the whole
 * contract with the server: true means the request carries `draft=on`, false
 * means it carries no `draft` key, and `fieldsFromForm` reads nothing else to
 * decide whether a post is public.
 *
 * Every rule is paired with its negative, because a table that only ever
 * asserts what SHOULD be there passes just as happily when everything is there.
 * ---------------------------------------------------------------------- */

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

  // A draft that was public once and was withdrawn.
  const back = transitionsFor("draft", true);
  t("withdrawn draft leads with Republish", back[0].label === "Republish", back[0].label);
  t("withdrawn draft republish clears the draft flag", back[0].wantsDraft === false);
  // The negative that matters: asking twice for a republication is not a
  // ceremony, it is a habit, and habits get clicked through.
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

  // Scheduled behaves as published: it is already draft:false.
  const soon = transitionsFor("scheduled", true);
  t(
    "scheduled matches published",
    JSON.stringify(soon) === JSON.stringify(live),
    `${JSON.stringify(soon.map((x) => x.id))} vs ${JSON.stringify(live.map((x) => x.id))}`,
  );

  // Exactly one primary, always, and every transition names itself.
  for (const [label, list] of /** @type {Array<[string, ReturnType<typeof transitionsFor>]>} */ ([
    ["fresh draft", fresh], ["withdrawn draft", back], ["published", live], ["scheduled", soon],
  ])) {
    t(`${label} offers at least two transitions`, list.length >= 2, `${list.length}`);
    t(`${label} labels every transition`, list.every((x) => x.label.trim().length > 0));
    t(`${label} has unique ids`, new Set(list.map((x) => x.id)).size === list.length);
  }
}

{
  // stateOf must agree with publiclyVisible(): draft is draft, a future
  // publish_at is scheduled, everything else is published.
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
  // The boundary, stated rather than left to chance: publiclyVisible() uses
  // `publish_at <= now`, so a post due exactly now is live, not scheduled.
  t(
    "publish_at exactly now is published, not scheduled",
    stateOf({ draft: false, publishAt: new Date(NOW).toISOString() }, NOW) === "published",
  );
  t(
    "an unreadable publish_at does not hide a live post",
    stateOf({ draft: false, publishAt: "not a date" }, NOW) === "published",
  );
}

/* -------------------------------------------------------------------------
 * Section 1b: the WELD between the transition table and the policy.
 *
 * publish-transition.mjs decides what the button says and what it sends.
 * publish-policy.mjs decides what the server then does with it. They are
 * separate modules on purpose (one is UI, before the fact; one is server, after
 * it) and they are driven by the same two facts, so they agree today. Nothing
 * structural stops them drifting apart tomorrow.
 *
 * This welds them, in both directions:
 *
 *   Forward.  Every transition in the table is LEGAL under the policy. Pressing
 *             it as the admin must not throw, and the outcome the policy
 *             computes must be the one the table's label promised.
 *   Backward. Every outcome the policy can produce is REACHABLE from some table
 *             state. An outcome no button can cause is either dead policy or a
 *             missing control, and both are worth failing over.
 *
 * The policy is driven through its real entry point with real frontmatter, not
 * a stub, so a change to how `decide` reads a file is caught here too.
 * ---------------------------------------------------------------------- */

/**
 * The markdown a save would carry for a given draft flag.
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
  /** Every state the table can be asked about, with the prior file it implies. */
  const SITUATIONS = /** @type {const} */ ([
    { label: "fresh draft", state: "draft", ever: false, priorDraft: true, priorFirst: null },
    { label: "withdrawn draft", state: "draft", ever: true, priorDraft: true, priorFirst: "2026-06-01" },
    { label: "published", state: "published", ever: true, priorDraft: false, priorFirst: "2026-06-01" },
    { label: "scheduled", state: "scheduled", ever: true, priorDraft: false, priorFirst: "2026-06-01" },
  ]);

  /** What the table's transition id claims the save will do. */
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
      /*
       * ONE assertion whose condition varies, not a pair of literals.
       *
       * This was `assert(label, false, …)` in the catch and
       * `assert(label, true)` on the success path. The success half COULD NOT
       * FAIL: reaching the line was the entire signal, and the literal made the
       * assertion count claim coverage it did not have.
       *
       * Found by check:assertions on the run immediately after its rule (a) was
       * fixed to span lines. It is the eighth instance of hard rule 10's class
       * in this repo and the FIRST found by a machine rather than by a person.
       */
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

      // The one fact the whole publish story rests on: draft-ness in the
      // committed file must be what the transition asked for.
      assert(
        `weld: ${situation.label} / ${transition.id} lands the draft flag it sent`,
        readState(result.raw).draft === transition.wantsDraft,
      );
    }
  }

  // Backward: no orphan outcomes in the policy.
  const POLICY_OUTCOMES = ["saved", "published-first", "republished", "unpublished"];
  for (const outcome of POLICY_OUTCOMES) {
    assert(
      `weld: policy outcome "${outcome}" is reachable from the table`,
      reached.has(outcome),
      `reachable: ${[...reached].sort().join(", ")}`,
    );
  }
  // And the reverse orphan check, so a table that grew a transition the policy
  // does not model shows up here rather than at runtime.
  for (const outcome of reached) {
    assert(
      `weld: table outcome "${outcome}" is one the policy defines`,
      POLICY_OUTCOMES.includes(outcome),
    );
  }
  assert("weld: the two modules were actually exercised", reached.size === POLICY_OUTCOMES.length, `${reached.size} of ${POLICY_OUTCOMES.length}`);
}

/* -------------------------------------------------------------------------
 * Section 2: what the rendered pages can submit.
 * ---------------------------------------------------------------------- */

const entries = [...new Set(STATES.map((s) => s.entry))];
const bundle = await bundleRoutes(entries);

/** @type {Map<string, { default: unknown }>} */
const modules = new Map();
for (let i = 0; i < entries.length; i += 1) {
  modules.set(entries[i], await importBundled(bundle.files[i]));
}

/** @type {Record<string, string[]>} */
const actual = {};
/** Raw markup per state, kept for the structural assertions in section 3. */
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

  // An assertion that can pass by reading nothing is not an assertion. A state
  // that rendered an empty string would otherwise report an empty submission
  // set and match a baseline that was also generated from a broken render.
  assert(`${state.name} produced markup`, html.length > 400, `${html.length} chars`);
  rendered += 1;
  renders[state.name] = html;
  actual[state.name] = submissionKeys(html);
}

await bundle.cleanup();

assert("every state rendered", rendered === STATES.length, `${rendered} of ${STATES.length}`);

if (update) {
  writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`, "utf8");
  console.log(`  BASELINE REWRITTEN  ${Object.keys(actual).length} state(s) -> scripts/fixtures/admin-ui-payloads.json`);
  console.log("  This is not a passing run. Review the diff in git before committing it.\n");
  process.exit(0);
}

// Fail closed. A gate whose expectation is missing must block and say so, never
// pass for want of anything to compare against.
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

// Same rule again, one level up: a baseline of empty arrays would compare equal
// to a render that found no forms at all.
assert("the comparison actually read submissions", submissionsCompared > 20, `${submissionsCompared} compared`);

/* -------------------------------------------------------------------------
 * Section 3: the editor's structure, from the same renders.
 *
 * Not interaction. A focus trap, Escape, Cmd+S and the draft buffer are all
 * browser behaviour and none of them can be observed here; that gap is real and
 * is stated rather than papered over. What CAN be asserted is that the elements
 * those behaviours depend on exist, are the right elements, and carry the
 * names and states assistive technology reads. A <dialog> that is not a
 * <dialog> has no trap to test in the first place.
 * ---------------------------------------------------------------------- */

/** @param {string} name @returns {string} */
const htmlFor = (name) => renders[name] ?? "";

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
  // The one guarantee the feedback slot has always carried: it is in the DOM
  // before it has anything to say, or a screen reader announces nothing.
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

// The primary button's LABEL must be the one the table names. This is the
// bridge between section 1 and the rendered page: the table can be right and
// the component can still show the wrong word.
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

// A never-published draft must not be able to publish in one click: the
// primary is type="button" and opens the ceremony instead of submitting.
structural("first publication is not a plain submit", "edit, draft that never published", (h) => {
  const button = /<button[^>]*class="btn"[^>]*>Publish/.exec(h)?.[0] ?? "";
  return button.includes('type="button"');
});
structural("a republication IS a plain submit", "edit, draft that published before", (h) => {
  const button = /<button[^>]*class="btn"[^>]*>Republish/.exec(h)?.[0] ?? "";
  return button.includes('type="submit"');
});

// The slug is editable in exactly one place.
/*
 * THE RULED SELECT-ALL LABEL, gated because the fixture structurally cannot
 * see it: the payload baseline records METHOD, intent and field NAMES, and this
 * is text. A ruled behaviour with no instrument is a behaviour that drifts.
 *
 * Both directions, because the positive alone would pass on a label that said
 * "Select all 2 shown all" or that had grown a second, bare copy elsewhere.
 * The negative names the exact bare form the ruling forbids, closed with the
 * element boundary so "Select all 2 shown" cannot satisfy it as a prefix.
 */
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
/* And the unfiltered case keeps the bare form, so the rule above is a
   DISTINCTION rather than a blanket rename. */
structural(
  "an unfiltered select-all says the plain count",
  "posts index, two selected",
  (h) => h.includes("Select all 3</span>") && !h.includes("Select all 3 shown"),
);

structural("new posts get a slug input", "new post, fresh", (h) => h.includes('id="field-slug"'));
structural("existing posts do not", "edit, published", (h) => !h.includes('id="field-slug"'));

/* -------------------------------------------------------------------------
 * The origin-requests panel: the copy law, asserted on the RENDERED PAGE.
 *
 * ASSERTED AGAINST MARKUP, NOT SOURCE, and the distinction is the whole point.
 * The module is named `traffic.server.ts`, the type is `TrafficRow` and the
 * stylesheet uses `.traffic-table`, so a grep for the forbidden word over the
 * source finds nine hits and every one of them is an identifier no reader ever
 * sees. The law is about what the page SAYS. Rendering the route and reading
 * the output is the only form of this check that means anything, and it is
 * strictly stronger: it would also catch the word arriving from a component
 * this route merely imports.
 *
 * The needles are word-anchored so "traffic" cannot be matched inside a longer
 * token, and each is validated against a decoy below so a typo in the pattern
 * cannot make the absence vacuous.
 * ---------------------------------------------------------------------- */

const FORBIDDEN_COPY = ["visits", "visitors", "traffic", "page views"];
const TRAFFIC_STATES = ["origin requests, loaded", "origin requests, empty", "origin requests, error"];

for (const word of FORBIDDEN_COPY) {
  const pattern = new RegExp(`\\b${word}\\b`, "i");
  // A NEEDLE THAT CANNOT MATCH PROVES NOTHING. Validated against a decoy first,
  // so the absence assertions below are known to be capable of failing.
  assert(
    `copy law: the needle for "${word}" can match`,
    pattern.test(`a sample ${word} here`),
    "the pattern never matches anything, so every absence check using it is vacuous",
  );
  for (const state of TRAFFIC_STATES) {
    structural(`copy law: "${word}" never appears in ${state}`, state, (h) => !pattern.test(h));
  }
}

// The required half. An absence check alone would pass on a blank page.
for (const state of TRAFFIC_STATES) {
  structural(`copy law: ${state} says origin requests`, state, (h) =>
    /origin requests/i.test(h),
  );
}

/* The three states are genuinely different pages, not one page three times. */
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
/* The error state is visible prose, and the rest of the panel survives it. */
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

/*
 * THE PENDING CAPTION SENTENCE IS A STATED ABSENCE.
 *
 * The caption owes a sentence about whether a cached serve is counted, and it
 * has to be measured by `npm run ae-probe` rather than reasoned. Until then the
 * placeholder is REQUIRED to be present, so the gap is visible in the product
 * and in this gate rather than being quietly forgotten.
 *
 * This assertion INVERTS on ship day: the deploy gate refuses the placeholder,
 * so the panel cannot go live still saying the question is unanswered. See
 * `scripts/check-head.mjs`.
 */
structural(
  "the unmeasured cache sentence is still declared as a stated absence",
  "origin requests, loaded",
  (h) => h.includes("has not been measured yet"),
);

console.log(`  ${STATES.length} state(s) rendered, ${submissionsCompared} submission(s) compared`);

/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate BUNDLES and RENDERS routes, so its failure mode is a whole state
 * dropping out: a route that stops bundling, a render that throws and is
 * caught, a STATES entry quietly removed. Those already fail individually, but
 * the total is the only witness to a structural block that stopped running over
 * states that all still render.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 199.
 * Never summed. It was 185 against a floor of 170 until the media library's v1
 * redesign added seven states, and the seven were counted by running the gate
 * rather than by adding up what they looked like they would contribute.
 *
 * Floored at 187, roughly 94 percent: the count moves in steps of a few per
 * state, and the three origin-requests states once added 34 at once, so the
 * slack has to absorb a state being added mid-session without hiding one being
 * lost.
 */
const MINIMUM_CHECKS = 187;
if (checks < MINIMUM_CHECKS) {
  fail(
    `this gate executed its assertions: only ${checks} ran, expected at least ` +
      `${MINIMUM_CHECKS}. A block was SKIPPED rather than failing. Measured: 199.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
