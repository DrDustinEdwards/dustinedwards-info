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
  /** Parsed by the loader, so the component never sees the delimited form. */
  tags: [],
  /** Rows carrying identical bytes. Exact content identity only. */
  twinCount: 0,
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
  detail: null,
  uploaded: null,
  uploadError: null,
  /* ---- media v6 --------------------------------------------------------
   * The whole view state, echoed by the loader so the component can build
   * every link from it. Handed over as an OBJECT rather than spread, because
   * that is what the component receives and what makes `hrefWith(view, ...)`
   * the natural call. */
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
  },
  modified: false,
  trashedCount: 0,
  tagCounts: [],
  lensCounts: { all: 1, unattached: 1, noAlt: 1, large: 0, duplicates: 0 },
  usageNote:
    "Usage counts what the renderer emitted for a post. An asset referenced " +
    "only by route code, like the roster photos, has no citation here and is " +
    "not therefore unused.",
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
  tags: [],
  trashedAt: null,
  hash: "1234abcd5678ef90",
  twins: [],
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

/*
 * TWO PREVIEW LINKS, hand-authored. Feature G.
 *
 * The tokens are 43 base64url characters, which is what `mintToken` produces,
 * and they are WRITTEN OUT rather than minted here. Rule 10's fixture
 * independence: a gate whose expected values come from the code under test is a
 * mirror, and a randomly minted token would also make the payload baseline
 * non-deterministic.
 *
 * Their first six characters DIFFER, deliberately. The list prints six and the
 * whole point of printing six is telling two links apart; a pair sharing a
 * prefix would pass a truncation assertion while proving nothing about it.
 */
const TOKEN_TAIL = "0123456789012345678901234567890123456";
const PREVIEW_TOKENS = [`AbCdEf${TOKEN_TAIL}`, `ZyXwVu${TOKEN_TAIL}`];

/** The origin the loader builds absolute preview URLs against. */
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
  /*
   * Live preview links. EMPTY by default, which is the state a draft is in
   * until somebody makes one, and the state a published post is permanently in
   * because the publish path revoked them.
   *
   * The loader supplies this and the component decides the section from
   * `state`, not from the array's length: an empty array on a draft still
   * renders the section, with the create control and a sentence saying there
   * are none. Only a non-draft loses the section entirely.
   */
  previewLinks: [],
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
  /* ---- media v6 session 4 -------------------------------------------------
   *
   * Three states the redesign added, each because it changes what RENDERS.
   *
   * A DOCUMENT IN THE GRID is not the same state as a document in a row: the
   * list gives a PDF a 44px extension chip, and the grid gives it a card with a
   * title, a suggestion of text and a size. 31 of the 70 real rows are here.
   *
   * A SELECTED TILE grows a caption bar carrying the name, the size and the
   * copy control, and the body's copy control goes so the card has exactly one.
   * That swap is invisible to the payload baseline, because a copy button is
   * `type="button"` and submits nothing, so it needs a structural assertion.
   *
   * A SORTED LIST is the state the column headers exist for: one heading is
   * active and carries an arrow, four are not, and one is not a link at all.
   * ---------------------------------------------------------------------- */
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
          // NULL, which is the real shape: a static PDF has no originalName, so
          // the title has to come off the KEY. A fixture that supplied a tidy
          // name here would test a path the corpus never takes.
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
    // The harness seam, per admin queue ruling 8. One static render dispatches
    // no events, so without a seeded selection the caption bar never mounts and
    // the state would assert the absence of something that cannot appear.
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

  /* ---- media v6: the new structure ---------------------------------------
   *
   * Each of these renders a DIFFERENT CONTROL SET, which is this gate's
   * admission test. A view mode changes a data attribute and no submissions, so
   * the two layout states are here to prove exactly that: one markup tree, two
   * layouts, payload identical. If a future refactor split the list into its
   * own JSX branch, one of the two would drift and the fixture would say so.
   * ---------------------------------------------------------------------- */
  {
    name: "media, list view",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({ objects: [MEDIA_OBJECT()] }),
  },
  {
    // FLAT, which is now the non-default. It renders no heading at all, which
    // is what makes a heading a signal when grouping is on.
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
      // The Reset link exists ONLY when something is modified, which is what
      // makes this a state rather than a variant of the default one.
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
    // A trash view with NOTHING in it. Empty trash must not be offered, and the
    // explanation must still appear: an author arriving at an empty bin still
    // needs to know what putting something in it would do.
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
    // A tag that matched nothing. A different empty state from an empty bucket
    // and from an empty search, and it must offer a way out that is not
    // "upload something".
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
    // TWINS PRESENT. The only state that offers to remove something on the
    // strength of a comparison, so it is the only one where that copy renders.
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
    // A TRASHED row open in the inspector. It offers Restore and must NOT offer
    // Move to trash, which is the pair this fixture pins.
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

  /* ---- media v6 session 3: grouping and bulk tagging ---------------------- */
  {
    // GROUPED BY FOLDER. Two rows in one folder and one in another, so a
    // grouper that emitted one bucket per ROW would render three headings and
    // this state would fail rather than merely look odd.
    name: "media, grouped by folder",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?group=folder",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({ key: "/publications/a.pdf", url: "/publications/a.pdf", storage: "static", kind: "document", deletable: false }),
        MEDIA_OBJECT({ key: "/publications/b.pdf", url: "/publications/b.pdf", storage: "static", kind: "document", deletable: false }),
        // The roster photograph, which is the row whose NOTE is the whole
        // reason this grouping exists.
        MEDIA_OBJECT({ key: "/phage-hunters/2019/a.jpg", url: "/phage-hunters/2019/a.jpg", storage: "static", deletable: false }),
      ],
      view: { ...MEDIA_SHELL().view, group: "folder" },
      modified: true,
    }),
  },
  {
    // GROUPED BY MONTH, including a row with NO upload date, which gets its own
    // bucket rather than being folded into the nearest month.
    name: "media, grouped by month",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?group=month",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({ uploaded: "2026-03-02T10:00:00.000Z" }),
        MEDIA_OBJECT({ key: "second.png", url: "/media/second.png", uploaded: "2026-03-19T10:00:00.000Z" }),
        MEDIA_OBJECT({ key: "/logo.svg", url: "/logo.svg", storage: "static", uploaded: null, deletable: false }),
      ],
      view: { ...MEDIA_SHELL().view, group: "month" },
      modified: true,
    }),
  },
  {
    /*
     * TWO SELECTED, which is the only state that can issue the bulk intents.
     *
     * Seeded through `initialSelection`, the optional prop with a production
     * default, per queue ruling 8. The harness renders one static pass and
     * dispatches no events, so without this seam the bulk bar never mounts and
     * the two bulk intents contribute NO payload, which is exactly how the
     * posts index left its most destructive surface outside the fixture for a
     * session.
     *
     * TWO rather than one: a single selection renders "1 selected" and hides
     * any plural or count-formatting defect.
     */
    name: "media, two selected",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?role=all",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT(),
        MEDIA_OBJECT({ key: "second.png", url: "/media/second.png" }),
      ],
      // role=all is what makes this genuinely UNFILTERED. The default view is
      // filtered to content, so the bare select-all label only ever appears
      // here, which is the distinction the two assertions below pin.
      filter: "all",
      view: { ...MEDIA_SHELL().view, role: "all" },
      modified: true,
      tagCounts: [{ tag: "roster", n: 9 }],
    }),
    props: { initialSelection: ["1234abcd5678ef90.png", "second.png"] },
  },
  {
    // FILTERED AND SELECTED. The select-all label must say SHOWN whenever a
    // filter is active, because it only ever reaches the rows on screen. Same
    // ruled wording the posts index carries, asserted structurally below.
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

  /* ---- draft preview links (feature G) ------------------------------------
   *
   * THREE states, and they are three because the feature has exactly three
   * shapes and each renders a different control set:
   *
   *   a draft with NO links      the create control and a sentence
   *   a draft WITH links         the create control plus one revoke per link
   *   a published post           NEITHER control, which is the ruling
   *
   * The middle one carries TWO links rather than one. One link would render a
   * revoke control and prove the tuple exists; two also proves the tuple is the
   * SAME for both, which is the property the per-link form design was chosen
   * for. If the token ever leaked into the submission set, two links would
   * produce two tuples and this state would fail while a one-link state passed.
   *
   * The published state duplicates "edit, published" in loader shape and is kept
   * separate on purpose: that state exists to prove the publish transitions, and
   * folding a second claim into it would mean a failure there could be either.
   * ---------------------------------------------------------------------- */
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
      // The loader would hand back [] for a published post regardless. Handing
      // it the TWO links instead is the stronger fixture: it proves the section
      // is gated on state and not on emptiness, so a future edit that started
      // rendering the list whenever it is non-empty fails here.
      previewLinks: PREVIEW_LINKS,
    }),
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
 * MEDIA v6: THE PARAMETER THAT MUST NOT EVAPORATE.
 *
 * **THIS IS THE INSTRUMENT THE TWO PREVIOUS INCIDENTS DID NOT HAVE.** `q` fell
 * off the pagination links once and `role` fell off the chips once. Neither was
 * visible to this gate, and that is structural rather than an oversight: the
 * payload baseline records METHOD, action and field names, and every one of
 * these links is a `GET` with no fields at all. `GET /admin/media` is the tuple
 * whether the href carries ten parameters or one.
 *
 * So this reads the rendered HREFS instead. It takes a state where every
 * parameter is set, renders the page, and asserts that each internal link back
 * to this page carries the whole set. A link built by hand, outside `hrefWith`,
 * fails here by name.
 *
 * The needle set is DERIVED from the module's own PARAM_NAMES rather than typed
 * again, because a hand-written list of parameters going stale against the real
 * one is precisely what both incidents were.
 * ---------------------------------------------------------------------- */

{
  const { DEFAULTS, PARAM_NAMES } = await import("../app/lib/media/view.mjs");

  /*
   * Every parameter non-default, so every one MUST appear in every link.
   *
   * **`view` IS "list" AND THAT IS LOAD BEARING, not a default left alone.**
   * It was "grid", and the column headers introduced in session 4 render only
   * in the list, so the newest link builder on the page was the one link
   * builder this scan could not see. A header that dropped `q` would have been
   * the third instance of the exact bug this block exists for, passing green.
   * The grid loses nothing by not being the scanned view: its tile links are
   * the same links the list draws, and the view toggle emits both either way.
   */
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

  /*
   * Every href pointing back at this page, which is the set that has to carry
   * the state. External links and the upload endpoint are not view links.
   *
   * THE SEARCH FORM IS CUT OUT FIRST, and that is a real exemption rather than
   * a convenience: the form OWNS `q`, so the Clear control inside it is the one
   * link on the page whose whole job is to drop it. Scanning it would make the
   * assertion below forbid the only correct way to clear a search.
   *
   * Found when the clear control started working: before this design pass the
   * Clear link was built from the role chip helper and CARRIED q, so pressing
   * Clear did not clear. The assertion caught the fix, which is the right way
   * round.
   */
  const outsideSearch = html.replace(/<form[^>]*role="search"[\s\S]*?<\/form>/g, "");
  const hrefs = [...outsideSearch.matchAll(/href="(\/admin\/media\?[^"]*)"/g)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );

  // NON-EMPTY SCOPE FIRST. Zero links found would make every assertion below
  // pass by examining nothing, which is this repo's most-repeated defect class.
  assert(
    "the evaporation scan found view links to examine",
    hrefs.length >= 8,
    `${hrefs.length} link(s) back to /admin/media. A green result below would mean nothing.`,
  );

  /**
   * Parameters a link is ALLOWED to drop, with the reason.
   *
   * @type {Record<string, string>}
   */
  const MAY_DROP = {
    // A chip goes back to page one, deliberately: page 3 of one filter is not
    // page 3 of another. So `page` may be absent from any link.
    page: "a filter change resets to page one",
    // The parameter each control OWNS is the one it changes, and changing it to
    // the default legitimately removes it from the query.
    view: "the view toggle owns it",
    group: "the Display popover owns it",
    sort: "the Display popover owns it",
    dir: "the Display popover owns it",
    size: "the Display popover owns it",
    role: "the role chips own it",
    tag: "the tag chips own it",
    trash: "the Trash lens owns it",
    key: "the inspector owns it, and closing it is an explicit empty",
  };

  /*
   * THE ASSERTION, and it is deliberately about `q` above all.
   *
   * `q` is the one parameter NO control on this page owns: nothing here is a
   * "clear the search" link except the explicit one, so a link that drops it is
   * always the bug. The other parameters each have exactly one owner and are
   * checked as a set instead: at least one link must carry each, which catches
   * a parameter that vanished from the page entirely.
   */
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
      carried.length > 0 || name === "key" || name === "trash",
      `no link on the page carries ${name}, so it cannot survive any navigation`,
    );
  }
}

/* -------------------------------------------------------------------------
 * MEDIA v6 session 4: the document card, the caption bar, and the table.
 *
 * NONE OF THIS IS VISIBLE TO THE PAYLOAD BASELINE, and that is why it is here
 * rather than left to the fixture. The baseline records `METHOD action | intent
 * | field names`. A document card is text, a caption bar is text, a column
 * heading is a `GET` link with no fields, and the copy control is a
 * `type="button"` that submits nothing at all. Every one of the four things
 * this session shipped could be deleted outright without moving a single tuple
 * in `admin-ui.json`.
 * ---------------------------------------------------------------------- */

/* ---- 1. THE DOCUMENT CARD ---------------------------------------------- */

structural(
  "a document tile renders a card, not an empty labelled box",
  "media, document in the grid",
  (h) => h.includes('class="media-doc"') && h.includes('class="media-doc-title"'),
);

/*
 * THE TITLE IS THE WORDS, and this is the assertion the whole item turns on.
 * The fixture's key is `/publications/edwards-2024-phage-genomics.pdf`, so the
 * expected string is written out HERE rather than produced by calling
 * `docTitle`, per rule 10's fixture-independence clause: a gate whose expected
 * value comes out of the code under test is a mirror.
 */
structural(
  "the document title is sentence-spaced words derived from the key",
  "media, document in the grid",
  (h) => h.includes(">edwards 2024 phage genomics<"),
);

/* BOTH DIRECTIONS. The positive above passes on a card that ALSO printed the
   raw filename somewhere, which is exactly the duplication this design removed:
   `edwards 2024 phage genomics` over `edw...omics.pdf` is the same file twice,
   one of them in the elided form. */
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

/*
 * THE RULED LINES ARE DECORATION AND ARE MARKED AS SUCH. Three empty spans
 * suggesting text is exactly the kind of thing that reads as three blank list
 * items to a screen reader if nobody hides it.
 */
structural(
  "the ruled lines are hidden from anything that reads rather than looks",
  "media, document in the grid",
  (h) => /class="media-doc-rules" aria-hidden="true"|aria-hidden="true" class="media-doc-rules"/.test(h),
);

/*
 * THE PAGE COUNT IS NOT FAKED, and this is the honest half of item 1.
 *
 * The mockup's document card ends with "24 pages". Nothing in this system
 * stores a page count: `media` carries bytes, mime, width and height, and width
 * and height are null for every PDF. The card carries the SIZE instead, and
 * this asserts both halves: the size is there, and no page count was invented
 * to fill the space. A future column can turn this around; until then a gate
 * saying so is what stops somebody adding a plausible number.
 */
structural(
  "the document card's foot carries the stored size",
  "media, document in the grid",
  (h) => /class="media-doc-foot"[^>]*>1\.4 MB</.test(h),
);
structural(
  "no page count is invented, because nothing stores one",
  "media, document in the grid",
  (h) => !/\d+\s+pages?/i.test(h),
);

/* ---- 2. THE CAPTION BAR ------------------------------------------------- */

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

/*
 * AN UNSELECTED GRID HAS NO CAPTION. Without this the assertion above passes on
 * a page that draws the bar over all seventy tiles, which is a different design
 * and not the one that was approved.
 */
structural(
  "an unselected tile has no caption bar",
  "media, document in the grid",
  (h) => !h.includes('class="media-caption"'),
);

/*
 * EXACTLY ONE COPY CONTROL PER CARD, in both states.
 *
 * The caption carries the copy button, and the body's copy button is not
 * rendered when it does. Two controls with the same accessible name on one card
 * is read twice by a screen reader and chosen between for no reason by a
 * pointer. The payload baseline cannot see this at all: `type="button"` is not
 * a submission, so a tile with two copy buttons and a tile with one produce
 * byte-identical tuples.
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

/* ---- 3. THE LIST HEADER, AND THE URLS IT PRODUCES ----------------------- */

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

/*
 * DIMS IS A LABEL RATHER THAN A DEAD LINK, both directions. There is no `dims`
 * sort key: half the library has no dimensions, so every document and every SVG
 * would pile up at one end of that order. A disabled-looking anchor would still
 * be focusable and still navigate.
 */
structural("Dims is not a link", "media, list sorted by size", (h) => {
  const head = /<div class="media-list-head"[\s\S]*?<\/div>/.exec(h)?.[0] ?? "";
  return (
    head.includes('class="media-col-head is-unsortable" data-align="end">Dims') &&
    !/<a[^>]*>Dims/.test(head)
  );
});

/*
 * EXACTLY ONE ACTIVE COLUMN, and it is the one the view is sorted by.
 *
 * The state sorts by size, so Size carries `aria-sort="descending"` and the
 * other three carry `none`. Counting BOTH is what makes this fail on a
 * regression that marked every column active as easily as one that marked none.
 */
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

/* -------------------------------------------------------------------------
 * THE SORT-LINK TUPLES, and this is the assertion the item was specified on.
 *
 * "Header sorts are GET links producing the same URLs the Display popover
 * already produces, so clicking a header and choosing from the popover must
 * land on identical URLs."
 *
 * READ OFF THE RENDERED MARKUP, both sides, and compared as STRINGS. Nothing
 * here recomputes an expected href: the property is that the page's two sort
 * controls agree with EACH OTHER, so both sides of the comparison have to come
 * out of the page. Calling `sortHref` to produce an expectation would assert
 * that the function equals itself.
 *
 * The active column is exempt and named: a header press on the column you are
 * already sorted by REVERSES it, which every table does and which the popover
 * deliberately does not, so those two hrefs are supposed to differ. Asserting
 * they matched would forbid the toggle.
 * ---------------------------------------------------------------------- */

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

  /** @param {string} href the sort key the url RESOLVES to, defaults included */
  const sortOf = (href) => readView(new URLSearchParams(href.split("?")[1] ?? "")).sort;
  const dirOf = (href) => readView(new URLSearchParams(href.split("?")[1] ?? "")).dir;

  /* The header's children are spans and anchors and nothing nests inside it, so
     the first `</div>` is its own. */
  const headBlock = /<div class="media-list-head"[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
  /* The popover's SORT group only. The Direction group next to it also emits
     links back to this page, and they resolve to the CURRENT sort key, so
     scanning the whole panel would put a direction link in the name column's
     slot and compare two unrelated controls. */
  const sortNav = /<nav[^>]*aria-label="Sort"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";

  /*
   * NOT FILTERED ON `sort=` APPEARING IN THE QUERY STRING, and the first draft
   * of this was. That draft cost a red run and was worth it: `hrefWith` OMITS a
   * parameter equal to its default, so the Added column at the default
   * direction produces a BARE `/admin/media` carrying neither token. The filter
   * dropped exactly one column, reported it as MISSING FROM THE HEADER rather
   * than as filtered out of the scan, and would have gone on hiding it. Every
   * anchor in this block is a column heading; there is nothing to filter.
   */
  const headHrefs = hrefsIn(headBlock);
  const popoverHrefs = hrefsIn(sortNav);

  // SCOPE FIRST, BOTH SIDES. Either block failing to match its regex would make
  // every comparison below pass over an empty list, which is this repo's most
  // repeated defect class and the reason rule 10 exists.
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

  /** key -> href, for each side. */
  const byKey = (list) => {
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

  /*
   * THE TOGGLE, asserted rather than assumed. The active column's header must
   * REVERSE the direction; the popover's option for the same column must not.
   * Without this the exemption above is a hole somebody could drive the whole
   * header through by making every column non-toggling.
   */
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

/* -------------------------------------------------------------------------
 * MEDIA v6 session 3: grouping headings and the ruled select-all wording.
 *
 * The payload fixture cannot see either. Headings are text, and the select-all
 * label is text; both are ruled behaviour, and a ruled behaviour with no
 * instrument drifts.
 * ---------------------------------------------------------------------- */

structural(
  "grouping by folder renders one heading per folder, not one per row",
  "media, grouped by folder",
  (h) => {
    const headings = [...h.matchAll(/class="media-group-heading"/g)].length;
    return headings === 2;
  },
);
/*
 * THE HEADING IS A TITLE AND THE NOTE IS THE POINT.
 *
 * It used to assert the raw prefix appeared. That was the shipped page's
 * behaviour and it was the thing Dustin's verdict was about: a heading reading
 * `/phage-hunters` explains nothing, and "Cohort photographs, placed by the
 * roster page template" explains everything. So the assertion moved with the
 * design rather than being deleted.
 */
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
/*
 * THE COUNT IS PAGE-LOCAL AND SAYS SO. This is the assertion that stops the
 * over-promise coming back: a heading count that read as a library total would
 * be the same defect session 2 shipped and this session was called to close.
 */
structural(
  "a group heading counts THIS PAGE in words",
  "media, grouped by folder",
  (h) => h.includes("on this page"),
);
/* Flat renders NO heading at all, which is what makes the heading a signal. */
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
/* And the unfiltered case keeps the bare form, so the rule above is a
   DISTINCTION rather than a blanket rename. */
structural(
  "an unfiltered select-all says the plain count",
  "media, two selected",
  (h) => h.includes("Select all 2<") && !h.includes("Select all 2 shown"),
);

/* -------------------------------------------------------------------------
 * Draft preview links: the two rulings the payload fixture cannot see.
 *
 * The baseline records METHOD, intent and field NAMES. It can see that a
 * published post issues neither request, because that is a payload difference.
 * It CANNOT see that the list prints six characters rather than the whole
 * token, because that is text, and a token is a capability: printing it is the
 * difference between a list you can screen-share and one you cannot.
 *
 * Every absence assertion below is PAIRED with the positive that proves its
 * needle can match, on a state where the thing is present. An absence check
 * whose needle is a typo passes on every page ever rendered.
 * ---------------------------------------------------------------------- */

const [PREVIEW_A, PREVIEW_B] = PREVIEW_TOKENS;

/*
 * THE REVOCATION SENTENCE, gated because it carries a MEASURED BOUND.
 *
 * The payload fixture records METHOD, intent and field names, so it cannot see
 * copy at all. This sentence is not decoration: it tells the author how long a
 * revoked link keeps working, and the number in it was measured on production
 * 2026-08-15 rather than chosen. A ruled behaviour with no instrument drifts,
 * and the specific drift to fear here is somebody tightening the prose back to
 * "the moment you revoke it" because it reads better.
 *
 * BOTH DIRECTIONS. The positive alone passes on a page that says both things;
 * the negative alone passes on a page that says neither. The forbidden phrase
 * is the exact wording that shipped and was measurably false.
 */
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
/* Publication IS immediate, because the read path re-asks D1, so that clause
   must survive the correction rather than being softened alongside it. */
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
 * THE CAPABILITY IS NOT PRINTED. The absolute URL appears in the markup only
 * on the response that minted it, which is an actionData state and not this
 * one; here it lives in the copy control's handler and nowhere a reader or a
 * screen recording can see it.
 *
 * The token itself IS in the markup, once, as the revoke form's hidden field.
 * That is unavoidable: revoking has to name what it revokes. So this asserts
 * the absence of the URL, which is the thing somebody could paste, rather than
 * the absence of the token, which would be a false claim.
 */
structural(
  "the absolute preview URL is never printed in the list",
  "edit, draft with two preview links",
  (h) => !h.includes(`${PREVIEW_ORIGIN}/preview/`),
);
// The needle validated against the state where it MUST match, so the absence
// above is known to be capable of failing.
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
 * THE CACHE SENTENCE, AND THE DAY THIS ASSERTION INVERTED.
 *
 * It read "the unmeasured cache sentence is still declared as a stated
 * absence" and required the placeholder to be PRESENT, so the gap was visible
 * in the product and here rather than quietly forgotten. `scripts/ship.mjs`
 * refused to deploy while it was there, which made ship day loud.
 *
 * `npm run ae-probe` ran on 2026-08-14 and the sentence is now measured, so
 * the assertion turns over: the answer must be present and the placeholder's
 * wording must be gone. BOTH halves, because either alone is satisfiable by a
 * page that says nothing at all.
 */
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
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-15 by RUNNING it: 285.
 * Never summed. It was 185 against a floor of 170 until the media library's v1
 * redesign added seven states, and the seven were counted by running the gate
 * rather than by adding up what they looked like they would contribute. The
 * cache sentence inverting from one assertion into two took it to 200, floored
 * at 187. Feature G's three preview-link states and their structural
 * assertions took it to 215, measured the same way.
 *
 * BEFORE and AFTER, both run rather than reasoned:
 *
 *   before  200 checks, 34 state(s), 111 submission(s)   floor 187
 *   after   215 checks, 37 state(s), 128 submission(s)   floor 202
 *   then    218 checks, 37 state(s), 128 submission(s)   floor 204
 *   v6      249 checks, 46 state(s), 169 submission(s)   floor 234
 *   v6.3    280 checks, 50 state(s), 204 submission(s)   floor 263
 *   v6.4    285 checks, 51 state(s), 208 submission(s)   floor 267
 *   v6.5    270 checks, 51 state(s), 208 submission(s)   (deduplicated)
 *   v6.5    302 checks, 54 state(s), 221 submission(s)   floor 283
 *
 * **v6.5 IS TWO MOVEMENTS AND THE FIRST ONE IS DOWNWARD, WHICH IS THE POINT.**
 *
 * The evaporation section existed TWICE in this file, 155 lines duplicated
 * verbatim, confirmed byte-identical by hashing both ranges before either was
 * touched. It rendered the same state twice and applied the same 15 assertions
 * twice, so 15 of the 285 could not fail independently: if the first copy
 * passed, the second was guaranteed to. That is rule 10's own class, "a pass
 * count is not coverage", sitting inside the gate that enforces it, and it had
 * inflated the floor by 15 for two sessions. Removing it read 270.
 *
 * Then session 4 added the document card, the caption bar and the column
 * headers: three states and 32 assertions, taking it to 302. Floored at 283,
 * which is 94 percent.
 *
 * **SUBMISSIONS MOVED 208 TO 221 AND ALL OF IT IS THE THREE NEW STATES.** Not
 * one existing state's tuple changed, and that is the evidence that a redesign
 * this size was presentational: the copy control moved between two parents and
 * is conditionally not rendered, the tile grew a caption, and the list grew a
 * header row of links, and none of it is a submission. The 13 added are the
 * upload form, the wrapping bulk form and rebuild on each new state, plus the
 * two bulk intents on the one state that seeds a selection.
 *
 * v6.4 is the design pass: folder grouping as the default with its notes, the
 * quality lenses replacing the role chips, and one wide search bar. Submissions
 * moved because the search form now carries EVERY view parameter as a hidden
 * field rather than just `role`, which is the evaporation rule applied to a
 * form instead of a link.
 *
 * The v6.3 line is grouping, bulk tagging and the selection surface. The
 * submission jump is real payload: every media state gained the wrapping bulk
 * form, and the two seeded-selection states gained bulk-add-tag and
 * bulk-remove-tag, which are the intents the harness seam exists to reach.
 *
 * The v6 line is the media page rebuilt to the mockup's structure: nine new
 * states plus the evaporation section. Submissions moved 128 to 169 because the
 * page genuinely gained intents (set-tags, trash, restore, empty-trash), which
 * is the one kind of payload growth this baseline exists to record loudly.
 *
 * The third line is the revocation-sentence assertions. **STATES AND
 * SUBMISSIONS DID NOT MOVE, and that is the correct result rather than a
 * suspicious one:** the payload baseline records METHOD, intent and field
 * names, and a corrected sentence changes none of them. A copy change that DID
 * move the submission count would mean the copy was carried in a form field.
 *
 * Floored at 202, roughly 94 percent: the count moves in steps of a few per
 * state, and the three origin-requests states once added 34 at once, so the
 * slack has to absorb a state being added mid-session without hiding one being
 * lost.
 */
const MINIMUM_CHECKS = 283;
if (checks < MINIMUM_CHECKS) {
  fail(
    // The measurement is stated in the message as well as in the comment above,
    // and it went STALE here first: plant (d) raised the floor to 202, fired
    // correctly, and printed "Measured: 200" while the docblock said 215. A
    // number a failure prints is an instrument, and this one was reporting the
    // previous session's reading to whoever the gate stops.
    `this gate executed its assertions: only ${checks} ran, expected at least ` +
      `${MINIMUM_CHECKS}. A block was SKIPPED rather than failing. Measured: 302.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
