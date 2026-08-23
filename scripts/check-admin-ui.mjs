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

import { CONFIRM_FIELD } from "../app/lib/destructive.mjs";
import { decide, readState } from "../app/lib/editor/publish-policy.mjs";
import {
  DEFAULTS as MEDIA_DEFAULTS,
  DISPLAY_AXES,
  GROUPS,
  SIZES,
  VIEWS,
} from "../app/lib/media/view.mjs";
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
  /*
   * THE THIRD USAGE STATE and its evidence, decided by the loader from
   * `media_refs`, the artifact scan and `template-refs.json`. `unattached` is
   * the default because it is the state a fresh upload is in; the roster case is
   * its own scenario below, and it is the one the state exists for.
   */
  usage: "unattached",
  templateRefs: [],
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
    /* The confirmation modal is a URL parameter like the rest. */
    confirm: "",
  },
  modified: false,
  trashedCount: 0,
  tagCounts: [],
  lensCounts: { all: 1, unattached: 1, noAlt: 1, large: 0, duplicates: 0 },
  /* INPUT, not an expectation: the loader owns this sentence and the component
     echoes it. It carried the pre-scan wording ("an asset referenced only by
     route code has no citation here") until the repository scan made that false,
     and the component went on rendering it because a fixture is a copy. The
     WORDING is asserted against the route source below, where it actually
     lives; this only has to be a note so the paragraph renders at all. */
  usageNote:
    "Usage is asked three ways: what a post cites, what the artifact scan " +
    "finds, and what repository code references.",
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
  /* Same three the row carries, plus the two the inspector alone shows. These
     went missing for exactly one run and the gate said so by THROWING on
     `templateRefs.length`, which is the failure a shared fixture helper exists
     to make loud rather than silent. */
  usage: "unattached",
  templateRefs: [],
  altSuggestion: "a picture",
  tagSuggestions: [],
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
  /*
   * THE THREE CONFIRMATION STEPS, which are the no-script half of the delete
   * guards. The action refuses an unconfirmed destructive POST and returns what
   * it would have destroyed; these states render that return.
   *
   * They exist because the guards' whole failure mode is being reachable only
   * with script. A confirmation step that never rendered would leave the
   * refusal a dead end, and nothing else here would notice: the submission
   * baseline only sees forms that are on the page.
   */
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
  /* ---- media v6 session 5: the usage model and everything it feeds --------
   *
   * Nine states, each because it changes what RENDERS and none of them visible
   * to the payload baseline on its own. The usage states are the point: the page
   * could express two of them and the third was the one the roster photographs
   * needed.
   * ---------------------------------------------------------------------- */
  {
    // THE CASE THE THIRD STATE EXISTS FOR. Referenced by repository code, cited
    // by no post. Before this it rendered identically to a genuine orphan.
    name: "media, placed by page code",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({
      objects: [
        MEDIA_OBJECT({
          key: "/phage-hunters/2019.webp",
          url: "/phage-hunters/2019.webp",
          thumb: "/phage-hunters/2019.webp",
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
    // THE INSPECTOR ON A TEMPLATE-PLACED FILE: the claim, its boundary, and the
    // source file that is the evidence for it.
    name: "media, inspector on a template-placed file",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?key=/phage-hunters/2019.webp",
    loaderData: MEDIA_SHELL({
      objects: [MEDIA_OBJECT()],
      view: { ...MEDIA_SHELL().view, key: "/phage-hunters/2019.webp" },
      detail: MEDIA_DETAIL({
        key: "/phage-hunters/2019.webp",
        url: "/phage-hunters/2019.webp",
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
    // A DOCUMENT IN THE INSPECTOR. The copy labels change here and nowhere else:
    // an <img> tag pointed at a PDF is a broken page.
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
    // THE DUPLICATE SURFACE: the byte-identical sentence and the named trash
    // offer. This is the one place the page proposes removing something on the
    // strength of a comparison, so the copy is what makes it safe to accept.
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
    // AN IMAGE WITH ALT ALREADY WRITTEN. The suggestion must NOT be offered
    // here: a suggestion beside somebody's sentence invites overwriting it with
    // a filename. This is the negative half of the suggestion assertion.
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
    /*
     * A LARGE FILE THAT IS CITED, DESCRIBED AND UNIQUE. The flag list is
     * non-empty ("over 1 MB") and the tile precedence selects NOTHING, which is
     * the only shape where "one dot by precedence" and "a dot whenever any flag
     * exists" disagree. A plant proved the previous assertion could not tell
     * them apart.
     */
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
    // A NARROWED LENS, which owes the reader the boundary of its own claim.
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
    // THE LIBRARY IS EMPTY. The only empty state that gets a heading and an
    // action, because it is the only one where the reader has nothing to undo.
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
    // A SEARCH MISS, which is a different thing from an empty library and needs
    // a different next step. It names the query back and says what was searched.
    name: "media, search matched nothing",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media?q=zzzz",
    loaderData: MEDIA_SHELL({ objects: [], q: "zzzz" }),
  },
  {
    // A LENS THAT FOUND NOTHING, which is GOOD NEWS and reads as an error unless
    // it says so.
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
  /* ---- media v6 session 6: the drawer, the modals, the revealed chrome ----
   *
   * Four states for four surfaces that a static render can otherwise not see,
   * two of them destructive.
   * ---------------------------------------------------------------------- */
  {
    /*
     * THE EMPTY-TRASH CONFIRMATION, which is now a URL rather than a
     * `prompt()`. The destructive submission moved BEHIND this state: the trash
     * view itself no longer carries `intent=empty-trash`, which is the payload
     * change this state accounts for and the gate reported as GONE.
     */
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
    /*
     * THE BULK-TRASH CONFIRMATION, reached only through the third harness seam
     * because it opens from client state. It hides many files in one press, so
     * it belongs in the fixture more than almost anything else here.
     */
    name: "media, bulk trash confirmation",
    entry: "app/routes/admin.media._index.tsx",
    path: "/admin/media",
    url: "/admin/media",
    loaderData: MEDIA_SHELL({ objects: [MEDIA_OBJECT()] }),
    props: { initialSelection: ["1234abcd5678ef90.png"], initialConfirmingTrash: true },
  },
  {
    /*
     * A SELECTION, for the floating bar. It carries the bulk intents, the size
     * total and the trash trigger, and the bar does not exist without one.
     */
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
  /*
   * TAGS ON THE DETAIL, both branches, because until 2026-08-17 no state
   * carried any and the whole chip region rendered in NO state. A blank
   * submit clearing every tag was invisible here for that reason.
   *
   * Two states, because the chip has two shapes: with several tags a chip
   * carries the remaining list and a separate Clear all appears, and at
   * exactly one tag the chip itself becomes the clear, since an empty `tags`
   * value no longer means clear.
   */
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

/** Rendered markup per state, kept for the no-script fallback section. */
/** @type {Map<string, string>} */
const renderedHtml = new Map();

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
    confirm:
      "the confirmation modal owns it. It is set by exactly one link, the " +
      "Empty trash trigger, which only renders in the trash view with rows in " +
      "it, and cleared by Cancel. No ordinary view link carries it, and one " +
      "that did would re-open a destructive confirmation on every navigation.",
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
      carried.length > 0 || name === "key" || name === "trash" || name === "confirm",
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
  "no page count is invented, because nothing stores one",
  "media, document in the grid",
  (h) => !/\d+\s+pages?/i.test(h),
);

/*
 * THE CARD DOES NOT REPEAT THE TILE'S OWN META LINE.
 *
 * The card carried a size along its bottom for one render, in the slot the
 * mockup fills with a page count, and the tile's meta line prints the size too,
 * so `1.4 MB` appeared twice inside sixty pixels and read as a bug on a
 * screenshot. The mockup has no such problem because its tile has NO BODY: the
 * card is the whole tile. This one has always had a body.
 *
 * **SCOPED TO THE CARD, and the first draft was not, which cost a red run
 * worth keeping.** It counted the string across the whole tile and expected
 * one, and found three: the list's Size column and its Dims column are in the
 * markup on every render by the one-tree rule and hidden by CSS in the grid.
 * Counting rendered TEXT to prove something about LAYOUT is a category error
 * this gate is especially prone to, because it renders with no stylesheet at
 * all and cannot see `display: none`. The property is about the card, so the
 * assertion reads the card.
 *
 * Paired with a scope check, because a `.media-doc` regex that stopped matching
 * would make the absence below pass over an empty string.
 */
structural("the document card does not repeat the size", "media, document in the grid", (h) => {
  const card = /<span class="media-doc">[\s\S]*?<\/span><\/span>/.exec(h)?.[0] ?? "";
  return card.includes("edwards 2024 phage genomics") && !card.includes("1.4 MB");
});

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

  /*
   * RESOLVED THROUGH `readView`, never read off the query string.
   *
   * `hrefWith` OMITS a parameter equal to its default, so the sort a link MEANS
   * and the sort it SPELLS are different questions, and the loader answers the
   * first one. Asking the second is how the header filter above went wrong.
   */
  /** @param {string} href @returns {string} */
  const sortOf = (href) => readView(new URLSearchParams(href.split("?")[1] ?? "")).sort;
  /** @param {string} href @returns {string} */
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
 * MEDIA v6 session 5: THE THREE-STATE USAGE MODEL and everything it feeds.
 *
 * **NONE OF THIS IS VISIBLE TO THE PAYLOAD BASELINE.** Three usage states, four
 * lens notes, three empty states, a suggestion, a duplicate sentence and a set
 * of copy labels are all TEXT, and the baseline records `METHOD action | intent
 * | field names`. The whole model could be reverted to the old binary without
 * moving a single tuple.
 *
 * The assertions below are therefore about SENTENCES, and about the one thing
 * that makes a sentence dangerous: a page can say "unattached" truthfully and
 * "unused" falsely with the same layout.
 * ---------------------------------------------------------------------- */

{
  const { USAGE_STATES, LENS_NOTES } = await import("../app/lib/media/usage.mjs");

  /*
   * THE MODEL AND THE RENDER AGREE ON THE VOCABULARY.
   *
   * Derived from the module rather than typed here, for the reason the
   * evaporation needles are derived from PARAM_NAMES: a hand-written list of
   * states going stale against the real one is exactly how a fourth state would
   * ship undocumented, or a retired one keep an assertion alive.
   */
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

/* ---- 1. THE THIRD STATE, ON EVERY SURFACE ------------------------------- */

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
/* THE NEGATIVE, on a row that genuinely has no reference, so the assertion
   above is known to discriminate rather than to match every row. */
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

/* ---- 2. THE INSPECTOR NAMES ITS EVIDENCE -------------------------------- */

structural(
  // NARROWED 2026-08-21. "Placed by page code" is the usage STATE and is a
  // fact: it has to agree with the data-usage="template" assertion below.
  // "Found by scanning the repository" was the boundary sentence's WORDING, and
  // pinning wording makes an equally true rephrasing a build failure.
  "the inspector states the usage claim",
  "media, inspector on a template-placed file",
  (h) => h.includes("Placed by page code"),
);
/*
 * AND IT NAMES THE FILE. A claim with no evidence behind it is the thing the old
 * two-state model had: it said "nothing cites this" and could not say what it
 * had looked at.
 */
structural(
  "the inspector names the source file that places it",
  "media, inspector on a template-placed file",
  (h) => h.includes("app/data/phage-hunters.ts") && h.includes("references this address"),
);
/*
 * THE SENTENCE THE WHOLE FEATURE EXISTS TO STOP. An unattached file must never
 * be described as unused, because the scan cannot see a constructed path and an
 * external site can link anything. Asserted as an ABSENCE, with the positive
 * above proving the panel renders at all.
 */
structural(
  "the unattached note refuses to call the file unused",
  "media, detail open",
  (h) => h.includes("not the same as") && !/\bis unused\b/.test(h),
);
/* The paragraph RENDERS on every listing, so a reader who never opens the
   inspector still gets a caveat. */
structural(
  "the standing usage note renders on the listing",
  "media, unused object",
  (h) => h.includes('class="media-usage-note"') && h.includes("repository code references"),
);
/*
 * AND ITS WORDING IS ASSERTED AT SOURCE, not through the fixture.
 *
 * The note is loader data, so the fixture supplies one and the component echoes
 * it: asserting the words through a render would be asserting that the gate's
 * own copy says what the gate expects. The shipped sentence lives in the route,
 * so that is where it is read from.
 *
 * **THE OLD SENTENCE WAS TRUE UNTIL THIS COMMIT AND IS NOW FALSE.** It said an
 * asset referenced only by route code "has no citation here", which was the
 * honest confession of a two-state tracker. The scan sees route code now, so the
 * absence half of this assertion is what stops the confession being restored by
 * a future edit that has forgotten the scan exists.
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

/* -------------------------------------------------------------------------
 * THE FORBIDDEN WORD, guarded on the RENDERED PAGE.
 *
 * The usage ruling says this page may never call a file "unused": the
 * repository scan cannot see a path the code builds at runtime, and nothing
 * here can see an external site linking a file. "unattached" is an absence of
 * evidence and says so; "unused" is a claim about the world that no check here
 * can support.
 *
 * The standing usage-note sentence has been guarded at source since the note
 * was rewritten. **THE TILE META LINE WAS NOT, and it kept the word for two
 * windows**: `cited ? " used" : " unused"` was written when the page had two
 * states, survived the three-state model landing, and rendered
 * `content 189 kB, unused` on the same nine roster photographs the list view
 * beneath it called "in template". Found by looking at a screenshot, not by any
 * gate.
 *
 * ASSERTED OVER MARKUP rather than over source, because the defect was a
 * rendered string. Scoped to the tile's meta element so the word remains legal
 * in the prose that EXPLAINS why it is illegal, which is the trap a bare
 * page-wide search would fall into.
 * ---------------------------------------------------------------------- */

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
    // SCOPE FIRST: zero meta lines would make the absence below pass by
    // examining nothing, which is this repo's most repeated defect class.
    if (metas.length === 0) return false;
    return metas.every((t) => !/\bunused\b/.test(t));
  });
}

/*
 * AND THE POSITIVE, so the absence above cannot pass on a tile that stopped
 * printing usage at all. A plant proved it could: deleting the label left the
 * gate green.
 *
 * **THROUGH THE SAME EXTRACTION AS THE NEGATIVE, and the first draft was not.**
 * It matched `class="media-meta">[\s\S]*?unattached[\s\S]*?</p>`, and a
 * non-greedy run of `[\s\S]` happily crosses `</p>` to reach the word in the
 * list view's usage cell further down the document, then finds some later
 * closing tag. The assertion passed on a meta line that said nothing at all.
 * An element-bounded read is the only way to assert about one element.
 */
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

/* ---- 3. PER-ROW FLAGS AND THE TILE DOT ---------------------------------- */

structural(
  "a row prints its flags",
  "media, unused object",
  (h) => /class="media-row-flags"[^>]*>no alt</.test(h),
);
/*
 * SCOPED TO THE FLAGS ELEMENT, and the first draft was not.
 *
 * `!h.includes("no alt")` over the whole page matched the no-alt LENS CHIP's own
 * hint, "Images with no alt text written yet", which is present on every render
 * and says nothing about this row. The assertion failed on correct markup, which
 * is the right direction to be wrong in but is still a broken instrument: it
 * would have gone on failing whatever the row did.
 */
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
 * **AND A TILE WITH NOTHING WORTH FLAGGING CARRIES NO DOT.**
 *
 * The assertion above cannot fail on its own and a plant proved it. Replacing
 * `tileFlagFor` with `flags.length > 0` left it green, because on that fixture
 * both expressions render exactly one dot: the document is over 1 MB, so the
 * flag list is non-empty AND the precedence picks a member.
 *
 * The two only disagree where the flag list is non-empty and the PRECEDENCE
 * selects nothing: a large file that is cited by a post, has alt text and has no
 * twin. `flagsFor` returns ["large"], `tileFlagFor` returns null, and a tile
 * should be quiet. This is that state.
 */
structural(
  "a large but attached and described tile carries no dot at all",
  "media, large but attached",
  (h) => !h.includes('class="media-tile-flag"'),
);
/* And the flag itself is still REACHABLE on that same row, in the list, so the
   assertion above is about the tile being quiet rather than about the flag
   having been dropped everywhere. */
structural(
  "and the row still prints the flag as words",
  "media, large but attached",
  (h) => /class="media-row-flags"[^>]*>over 1 MB</.test(h),
);

/* ---- 4. LENS NOTES AND EMPTY STATES ------------------------------------- */

structural(
  // NARROWED 2026-08-21 to the note's PRESENCE and its escape control. The
  // sentence inside it was pinned word for word, which is the class tier 4.1
  // named. That the note exists at all, and that it offers a way out, are the
  // properties worth holding; its exact phrasing is the writer's.
  "a narrowed lens renders its note, with a way out",
  "media, unattached lens with its note",
  (h) => h.includes('class="media-lens-note"') && h.includes("Show everything"),
);
structural(
  "the unnarrowed view carries no lens note",
  "media, unused object",
  (h) => !h.includes('class="media-lens-note"'),
);

/* THE THREE EMPTY STATES, each asserted to be the RIGHT one. A single assertion
   that "an empty state rendered" would pass on any of the three appearing in
   all three situations, which is the defect this replaces. */
structural(
  "an empty library explains what the library is for",
  "media, library empty",
  // NARROWED 2026-08-21: the state attribute and the call to action are facts.
  // "Nothing here yet" was the headline's wording.
  (h) => h.includes('data-empty="library"') && h.includes("Upload the first file"),
);
structural(
  "a search miss names the query and says what was searched",
  "media, search matched nothing",
  // NARROWED 2026-08-21: echoing the QUERY back is the property, since a miss
  // that does not say what was searched for is the defect. The list of searched
  // FIELDS was prose and is also a claim that ages: adding a searched field
  // would mean editing this gate rather than the page.
  (h) => h.includes('data-empty="search"') && h.includes("zzzz"),
);
structural(
  "an empty lens reads as good news rather than as an error",
  "media, lens matched nothing",
  // NARROWED 2026-08-21 to the state attribute. Telling the three empty states
  // apart is what the data-empty values do, and the mutual-exclusion assertions
  // directly below are what make that binding load-bearing.
  (h) => h.includes('data-empty="lens"'),
);
/* AND THEY ARE MUTUALLY EXCLUSIVE. Without this, one state rendering in all
   three situations would satisfy all three assertions above. */
structural(
  "a search miss is not also the library-empty state",
  "media, search matched nothing",
  (h) => !h.includes("Upload the first file"),
);

/* ---- 5. SUGGESTIONS, OFFERED AND NOT APPLIED ---------------------------- */

structural(
  "an empty alt field offers the filename as a suggestion",
  "media, inspector on a template-placed file",
  (h) => h.includes("Use suggested: 2019"),
);
/* THE NEGATIVE, and it is the one that matters: a suggestion beside text
   somebody already wrote is an invitation to overwrite their sentence. */
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
/* A DOCUMENT TAKES NO ALT TEXT, so the field is not offered at all. It was on
   all 70 rows, which invents an obligation on the 31 that cannot discharge it. */
structural(
  "a document is offered no alt field",
  "media, inspector on a document",
  (h) => !h.includes('id="detail-alt"') && h.includes("A document takes no alt text"),
);

/* ---- 6. COPY LABELS THAT ADAPT ------------------------------------------ */

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

/* ---- 7. THE DUPLICATE SURFACE ------------------------------------------- */

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

/* ---- 8. THE PALETTE, THE SHORTCUTS AND THE Cmd+K BADGE ------------------ */

/*
 * THE RULING THIS SATISFIES: an absent shortcut must not be advertised. The
 * badge was held back for a whole session with that reason written down, so
 * asserting it now is asserting that the binding it advertises exists.
 */
structural(
  "the search bar advertises the shortcut that now exists",
  "media, unused object",
  (h) => h.includes('class="media-search-kbd"'),
);
structural(
  "the shortcuts panel documents every binding",
  "media, unused object",
  (h) => {
    // NARROWED 2026-08-21 to the row COUNT, which is what "documents every
    // binding" means. The two descriptions were prose samples of nine rows and
    // proved nothing the count does not. The real coverage is the assertion
    // below binding the rendered count to MEDIA_SHORTCUTS in both directions.
    return (h.match(/class="media-shortcut"/g) ?? []).length >= 9;
  },
);
/*
 * THE SHORTCUTS PANEL AND THE SHORTCUT TABLE NAME THE SAME SET, so a binding
 * cannot be documented without existing or exist without being documented. The
 * count is read out of the RENDERED markup and compared against the module's own
 * table length, neither of them typed here.
 */
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
   * **AND EVERY DOCUMENTED SHORTCUT IS ACTUALLY WIRED.**
   *
   * The assertion above is a tautology on its own and a plant proved it: adding
   * a fake row ("ctrl D, delete everything instantly") increments BOTH counts,
   * so they stayed equal and the gate stayed green. It can only ever catch the
   * panel failing to render, which is not the rule.
   *
   * The rule is that this page must not advertise a binding nobody wired, which
   * is why the Cmd+K badge was withheld for a session with that reason written
   * down. So each row names the expression that implements it and this greps the
   * two islands for it. A fake row has no expression to name.
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

/* -------------------------------------------------------------------------
 * THE LOADER WIRING, ASSERTED AT SOURCE, because this harness cannot run a
 * loader and says so in its own header.
 *
 * A plant proved the gap: replacing the loader's `templateRefs` lookup with a
 * literal `0` left every assertion green. The states supply `usage` as fixture
 * INPUT, so the component renders whatever it is given and the model can be
 * disconnected without a single rendered byte changing. That is the harness
 * boundary working exactly as documented, and it means the wiring needs a
 * different instrument.
 *
 * These are source greps, which is a weaker instrument than a render and is the
 * strongest one available here. They assert the three joins exist: the artifact
 * is imported, the row usage is computed from it, and BOTH readers of the
 * unattached predicate are handed the same key list.
 * ---------------------------------------------------------------------- */
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
  /*
   * BOTH READERS OF THE PREDICATE GET THE SAME LIST. The listing and the lens
   * count are separate queries, and the Unused chip already shipped once with a
   * count from one predicate and a filter from another.
   */
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

/* ---- 9. THE NO-SCRIPT FLOOR --------------------------------------------- */

/*
 * **EVERY ENHANCEMENT IS ADDITIVE, ASSERTED RATHER THAN CLAIMED.**
 *
 * The palette, the toast and the keyboard navigator all need script, which is
 * accepted for this page. What is NOT accepted is any of them becoming the only
 * way to do something. The harness renders with no script at all, which makes it
 * the right instrument for exactly this: whatever it can see is what a reader
 * with scripting off gets.
 *
 * So the search form must still be a real GET form, and the suggestion and tag
 * chips must still be real submit buttons rather than click handlers.
 */
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

/* -------------------------------------------------------------------------
 * MEDIA v6 session 6: THE DRAWER, THE MODALS, AND THE NO-SCRIPT FLOOR UNDER
 * BOTH.
 *
 * The whole point of these surfaces is that they overlay the page, and an
 * overlay is exactly the shape that becomes unreachable or undismissable if one
 * piece is missing. The harness renders with NO script and NO stylesheet, which
 * makes it the right instrument for the half that must not depend on either:
 * the markup, the roles, and whether a control is a real link or a handler.
 * ---------------------------------------------------------------------- */

/* ---- 1. THE DRAWER ------------------------------------------------------ */

structural(
  "the inspector is a dialog with a scrim",
  "media, detail open",
  (h) =>
    /<section[^>]*class="media-detail"[^>]*role="dialog"|<section[^>]*role="dialog"[^>]*class="media-detail"/.test(h) &&
    h.includes('class="media-detail-scrim"'),
);
/*
 * THE SCRIM IS A LINK, not a div with a handler, which is the difference
 * between a drawer you can dismiss with no script and one you cannot. Asserted
 * as an ANCHOR carrying an href, because a div would render identically here in
 * every way except the one that matters.
 */
structural(
  "the scrim is a real link, so clicking away works with no script",
  "media, detail open",
  (h) => /<a[^>]*class="media-detail-scrim"[^>]*href="|<a[^>]*href="[^"]*"[^>]*class="media-detail-scrim"/.test(h),
);
structural(
  "the drawer is labelled and modal",
  "media, detail open",
  (h) => /aria-modal="true"/.test(h) && /aria-label="Details for /.test(h),
);
structural(
  "no scrim and no dialog when nothing is open",
  "media, unused object",
  (h) => !h.includes("media-detail-scrim") && !h.includes('role="dialog"'),
);

/* ---- 2. THE CONFIRMATIONS ----------------------------------------------- */

/*
 * **THE DESTRUCTIVE SUBMISSION MOVED BEHIND A CONFIRMATION, and this pair is
 * what proves it moved rather than vanished.**
 *
 * `prompt()` ran from an `onSubmit` handler, so with scripting off the handler
 * never ran and the form submitted straight through: every trashed object
 * deleted with no confirmation at all. The trash view therefore must NOT carry
 * the intent any more, and the confirmation state MUST.
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
/*
 * AND THE BUTTON IS ENABLED IN THE SERVER RENDER. This looks backwards and is
 * the load-bearing half of the no-script path: rendering it disabled would
 * leave a reader without script unable to ever enable it, because nothing runs
 * to observe what they typed. The ACTION is the gate; the disabled state is
 * earlier feedback once hydrated.
 */
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
  /*
   * THE NEEDLE IS BUILT FROM CONFIRM_FIELD, not from the literal it happens to
   * equal. The rendered attribute really is the literal, so a hardcoded needle
   * WORKS today; what it cannot survive is a rename. Renaming the constant
   * moves the component and the server together and leaves this assertion
   * looking for a name nothing emits, which passes vacuously in the negative
   * assertion below and fails confusingly here. Derived, a rename moves all
   * three at once.
   */
  (h) => new RegExp("<input[^>]*name=\"" + CONFIRM_FIELD + "\"").test(h),
);
/* Cancel is a link, for the same reason the scrim is. */
structural(
  "cancel is a link back to the same view",
  "media, empty trash confirmation",
  (h) => /<a[^>]*class="btn-ghost"[^>]*>Cancel<\/a>|<a[^>]*>Cancel<\/a>/.test(h),
);

/**
 * The MODAL'S OWN form, extracted before anything is asserted about it.
 *
 * The first draft of the assertion below searched the whole page for
 * `name="key" value="..."`, and every tile in the grid renders a form carrying
 * exactly that: a plant that dropped the modal's hidden keys entirely left this
 * green, because the needle was still on the page somewhere else. Only the
 * payload baseline caught it, which is a different assertion doing this one's
 * job. Unanchored needle, hard rule 10, and the fourth of that class here.
 *
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
/*
 * AND IT ASKS NO COUNT. The ladder is unchanged: trashing is reversible and
 * touches neither R2 nor a public URL, so the type-the-count ceremony is spent
 * only where the action cannot be undone. A confirmation that asked for a count
 * here would be ceremony people learn to click through, which is what makes the
 * one on empty-trash stop working.
 */
structural(
  "the bulk confirmation asks for no typed count",
  "media, bulk trash confirmation",
  (h) => modalForm(h).length > 0 && !modalForm(h).includes('name="' + CONFIRM_FIELD + '"'),
);

/* ---- 3. THE FLOATING SELECTION BAR -------------------------------------- */

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

/* ---- 4. THE TILE CHROME IS IN THE MARKUP AT REST ------------------------ */

/*
 * The name and the checkbox are HIDDEN BY CSS until hover, focus or selection,
 * and hiding them in the markup instead would be a different and worse thing: a
 * keyboard reader would have nothing to tab to and the evaporation scan would
 * lose the tile links. The harness renders with no stylesheet, so what it sees
 * is exactly what must still be present.
 */
/*
 * THE LABEL BELOW SAYS "its checkbox" RATHER THAN "checkbox", and that is not
 * style. `check:invariants` scans string literals for raw SQL, and its scanner
 * does not understand REGEX literals: `/<form[^>]*role="search"...` desyncs its
 * quote matching at stripped index 46569 of this very file, so everything after
 * it is read as one enormous phantom string. Inside that phantom, its bare
 * column extraction reads `AND <word> IN` as a WHERE clause, and the phrase
 * "name link and checkbox in the markup" made `checkbox` a column name that
 * exists in no table. Measured: one failure, 105 checks, from prose.
 *
 * Rewording is the small half. The real defect is the scanner, which can also
 * SWALLOW genuine SQL inside a phantom and check nothing: it consumed 3308
 * characters here. That belongs in the gate backlog, not in a rename.
 */
structural(
  "the tile keeps its name link and its checkbox in the markup",
  "media, unused object",
  (h) =>
    /class="media-card-body"/.test(h) &&
    /class="media-name"/.test(h) &&
    /class="media-check-label"/.test(h),
);

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
 *
 * ## THE CAPTION IS EXEMPT, SINCE 2026-08-21, AND THE AUDIT WAS RIGHT
 *
 * Tier 4.1 ruled this block out entirely, on the grounds that it "rejected the
 * sentence written to explain the metric it polices". That happened and is
 * recorded in `app/lib/admin/origin-requests.mjs`: the first draft of
 * CACHE_SENTENCE said "real traffic is therefore higher" and this gate refused
 * it.
 *
 * DELETING THE BLOCK IS THE WRONG REPAIR, because the defect is not the rule, it
 * is the SCOPE. A word ban cannot tell "this panel counts visits" from "this
 * number is not visits", and those two sentences live in different parts of the
 * page. Labels CLAIM. Prose EXPLAINS.
 *
 * So the ban now runs against the markup with `<caption>` removed. Every label
 * surface stays covered: the panel heading, the column headers, the chips, the
 * rows and the empty and error states. The caption, which is the one element
 * whose job is to say what the number is and is not, is free to name the thing
 * it is contrasting against.
 *
 * The positive half below is unchanged and is what actually guarantees the
 * honest label: every state must SAY "origin requests".
 * ---------------------------------------------------------------------- */

const FORBIDDEN_COPY = ["visits", "visitors", "traffic", "page views"];
const TRAFFIC_STATES = ["origin requests, loaded", "origin requests, empty", "origin requests, error"];

/** The rendered markup minus the one element allowed to name what this is not. */
const withoutCaption = (/** @type {string} */ h) =>
  h.replace(/<caption[\s\S]*?<\/caption>/gi, " ");

/*
 * THE EXEMPTION IS ITSELF ASSERTED. A `<caption>` regex that matched nothing
 * would leave the ban exactly as wide as before and this narrowing would be a
 * comment describing a change that did not happen; one that matched too much
 * would exempt the whole panel and every absence check below would pass by
 * examining an empty string.
 */
{
  const loaded = htmlFor("origin requests, loaded");
  const stripped = withoutCaption(loaded);
  assert(
    "copy law: the caption exemption removes a caption and not the page",
    /<caption/i.test(loaded) &&
      !/<caption/i.test(stripped) &&
      stripped.length > loaded.length * 0.5,
    `loaded state is ${loaded.length} bytes, ${stripped.length} after removing the ` +
      `caption. Either no caption was found, or the strip took most of the page ` +
      `with it and every absence check below examines nothing.`,
  );
}

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
    structural(
      `copy law: "${word}" never labels anything in ${state}`,
      state,
      (h) => !pattern.test(withoutCaption(h)),
    );
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
 *   v6.6    370 checks, 65 state(s), 280 submission(s)   floor 347
 *
 * **THE LAST 11 CHECKS AND THE 65TH STATE ARE WHAT SIX SILENT PLANTS BOUGHT.**
 * Twenty-two plants ran against this session's work and six left the suite
 * green, each naming a real hole: the shortcut cross-check was a tautology (a
 * fake row increments both sides of the count it compared); the one-dot-per-tile
 * assertion could not distinguish precedence from `flags.length > 0`, because on
 * its fixture both render one dot; and the loader wiring is invisible to a
 * harness that supplies loader data as input. The first two are now real
 * assertions, and the third is a set of source greps, which is a weaker
 * instrument and the strongest one available inside this boundary.
 *
 * **v6.6 IS THE USAGE MODEL AND EVERYTHING IT FEEDS.** Ten states and 57
 * assertions: three usage states on four surfaces, per-row flags, the tile dot,
 * four lens notes, three empty states, the two suggestion controls, the adaptive
 * copy labels, the duplicate sentence, the shortcuts panel and the no-script
 * floor. Almost none of it is visible to the payload baseline, which is why the
 * assertion count moved five times as far as the submission count.
 *
 * **THE 59 NEW SUBMISSIONS ARE 55 FROM THE TEN NEW STATES AND FOUR REAL ONES.**
 * The four are the alt-suggestion button appearing on each existing inspector
 * state, and they are a genuine payload addition: a second control that writes
 * through the SAME `set-alt` intent, carrying its value on the button. Nothing
 * was removed and no existing tuple changed, which is the evidence that the rest
 * of this session was presentation over a model that already worked.
 *
 * THREE DEFECTS THIS GATE FOUND, none of which any other instrument could see:
 * the loader gained three fields and the shared fixture did not, so four detail
 * states threw on `templateRefs.length`; the adaptive copy LABELS were computed,
 * passed in and rendered nowhere, because `CopyButton` is glyph-only by design
 * and nobody had asked it to show a word; and the standing usage note still told
 * the reader that an asset referenced only by route code "has no citation here",
 * which the repository scan had just made false.
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
 * Floored at 374 against 398 measured through this gate's own pipeline, roughly
 * 94 percent: the count moves in steps of a few per state, and the three
 * origin-requests states once added 34 at once, so the slack has to absorb a
 * state being added mid-session without hiding one being lost.
 *
 * Raised from 347 when the drawer, the two confirmations and the floating
 * selection bar landed with three new states behind them. A floor left at the
 * old measurement is a floor that has stopped being able to notice anything.
 */
/* ------------------------------------------------------------------ *
 * NO-SCRIPT FALLBACK: the display axes are REAL LINKS carrying their
 * parameter.
 * ------------------------------------------------------------------ *
 *
 * Standing ruling, 2026-08-16: every control stays a real link or form that
 * works with scripting off, and nothing is built the slow way to preserve that.
 * `view`, `size` and `group` are handled on the CLIENT by the route's
 * `shouldRevalidate`, which is exactly the arrangement where the fallback rots
 * silently: the scripted path keeps working while the anchor behind it decays
 * into a button, and nobody notices until somebody arrives without script.
 *
 * So the anchor is asserted, from RENDERED MARKUP rather than from source. The
 * vocabularies are IMPORTED from view.mjs, never restated, so adding a fourth
 * tile size is covered here the moment it is declared.
 *
 * Defaults are omitted from emitted hrefs by `hrefWith`, deliberately, so the
 * default value is asserted as an anchor to the BARE url and every other value
 * as an anchor carrying `axis=value`. Asserting `view=list` would fail against
 * correct markup.
 */

/*
 * Each axis is owned by ONE control group, and the assertion is scoped to it.
 *
 * The first version of this section searched every href on the page and was
 * satisfied by any link that happened to carry the axis. A plant that turned
 * the layout toggle into a `<button>` passed it cleanly, because on a state
 * whose URL already has `view=grid` every OTHER link carries `view=grid` too:
 * `hrefWith` preserves the whole state by design. That is hard rule 10's
 * "count matches, not containers" in its most literal form.
 *
 * Both control groups render a `<nav aria-label>`, so the label is the seam.
 */
/** @type {Record<string, { nav: string, values: string[] }>} */
const AXIS_CONTROL = {
  view: { nav: "Layout", values: VIEWS },
  group: { nav: "Group by", values: GROUPS },
  size: { nav: "Tile size", values: SIZES },
};

/**
 * The markup of the `<nav>` carrying this aria-label, or "" when absent.
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

/*
 * SCOPED-BY: `navNamed` delimits to the <nav aria-label="Layout"> ELEMENT, so
 * this is a match on the layout control itself and not on the string appearing
 * anywhere in the document (a class name in an inline style block, say).
 */
const displayStates = [...renderedHtml.entries()].filter(
  ([, html]) => navNamed(html, "Layout").length > 0,
);

/*
 * SCOPE NON-EMPTINESS. Every assertion below reads this list, so a rename of
 * the toggle class would otherwise turn the whole section into 0 findings over
 * 0 states and still pass.
 */
assert(
  "the no-script section found states that render the display controls",
  displayStates.length >= 3,
  `only ${displayStates.length} rendered state(s) contain the layout toggle`,
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

  // The owning control has to EXIST before its options can be asserted.
  const owning = displayStates
    .map(([name, html]) => [name, navNamed(html, control.nav)])
    .filter(([, nav]) => nav.length > 0);
  assert(
    `no-script: the ${axis} control renders a nav labelled "${control.nav}"`,
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
 * THE SERVER STILL RESOLVES THE DISPLAY AXES FROM THE URL.
 *
 * The component reads these three from `useSearchParams()` so a client-side
 * flip re-renders without the loader. On the server both sides read the same
 * request URL, so the overlay must be a NO-OP there. If it ever is not, the
 * scripted path keeps working and the no-script path silently renders the
 * default layout for everybody, which is the exact failure this whole section
 * exists to catch. Asserted from the markup the grid actually emits.
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

/* ------------------------------------------------------------------ *
 * PENDING TRANSITIONS: router-driven, and OFF when nothing is in flight.
 * ------------------------------------------------------------------ *
 *
 * A data-changing control on this plane costs a round trip plus a D1 query,
 * MEASURED at 1629ms median on production, so the results region carries
 * `data-pending` and `aria-busy` while `useNavigation` reports a load.
 *
 * WHAT THIS HARNESS CAN SEE: it renders ONE static pass, so `useNavigation`
 * is always idle here and a genuine in-flight state cannot be produced. What
 * it can prove is the half that actually rots, and the half a reader would
 * suffer: that the mark is CONDITIONAL. A hardcoded `data-pending` dims the
 * grid and swallows every pointer event forever, on every state, and no test
 * that only checks "the attribute exists" would notice.
 *
 * The complement, that the attribute APPEARS while loading, is not observable
 * offline. It is carried by the router's own `navigation.state` and is stated
 * here as a boundary rather than left to look covered.
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

/*
 * AND IT COMES FROM THE ROUTER, not from a hand-rolled timer or a useState
 * somebody flips on click. That is the "do not build a spinner system" half.
 */
for (const routeFile of [
  "app/routes/admin.media._index.tsx",
  "app/routes/admin.posts._index.tsx",
]) {
  const src = readFileSync(join(root, routeFile), "utf8");
  // The subject is a MODULE, not a rendered document, so the question is
  // file-level by construction: does this module anywhere set data-pending
  // without anywhere importing useNavigation. Delimiting to one element would
  // let a second, hand-rolled pending mark elsewhere in the file pass unseen.
  // SCOPED-BY: the whole source file, deliberately, per the note above.
  const marks = src.includes("data-pending");
  assert(
    `pending: ${routeFile} drives data-pending from useNavigation`,
    // SCOPED-BY: the whole source file, for the reason given above the match.
    !marks || src.includes("useNavigation"),
    `the route sets data-pending without importing useNavigation, so the ` +
      `pending signal is hand-rolled state rather than the router's.`,
  );
}

/*
 * AND THE SEARCH FORM IS STILL A FORM. It is the one control on this page that
 * carries free text, so it cannot degrade to a link, and a GET form is the only
 * shape that submits without script.
 */
assert(
  "no-script: the media search renders as a GET form naming its action",
  displayStates.some(([, html]) =>
    /<form[^>]*method="get"[^>]*action="\/admin\/media"/.test(html) ||
    /<form[^>]*action="\/admin\/media"[^>]*method="get"/.test(html),
  ),
  "no rendered state contains a GET form posting to /admin/media",
);

/*
 * FLOOR RAISED 405 -> 412 by the three delete-confirmation states.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 438,
 * from 68 rendered states. Never summed. Slack of 15 absorbs a state being
 * retired; dropping the whole no-script section is 20 assertions and still
 * fails. The message below prints the same number as this comment, which is
 * the discipline the previous note was written to enforce.
 */
const MINIMUM_CHECKS = 412;
if (checks < MINIMUM_CHECKS) {
  fail(
    // The measurement is stated in the message as well as in the comment above,
    // and it went STALE here first: plant (d) raised the floor to 202, fired
    // correctly, and printed "Measured: 200" while the docblock said 215. A
    // number a failure prints is an instrument, and this one was reporting the
    // previous session's reading to whoever the gate stops.
    `this gate executed its assertions: only ${checks} ran, expected at least ` +
      `${MINIMUM_CHECKS}. A block was SKIPPED rather than failing. Measured: 438.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
