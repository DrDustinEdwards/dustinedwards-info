/**
 * The media library's view state: what it is, and how it TRAVELS.
 *
 * PURE and `.mjs`, and the second half of that sentence is the whole point.
 * **THE EVAPORATING PARAMETER HAS BEEN PAID FOR TWICE IN THIS REPO**, once when
 * `q` fell off the pagination links and once when `role` fell off the chips.
 * Both times the page looked right, one click was wrong, and no gate could see
 * it because a missing query parameter is not a payload difference: the tuple
 * `GET /admin/media` is identical whether the link carries eight parameters or
 * one.
 *
 * So the parameters are not read ad hoc in the loader and rebuilt ad hoc in the
 * component. They are parsed ONCE into a state object, and every link on the
 * page is built by `hrefWith`, which starts from that whole state and overrides
 * one field. A link that drops a parameter now has to be written by NOT using
 * the only function that builds links, which is a visible thing to do rather
 * than an invisible omission.
 *
 * `check:admin-ui` gains an assertion over the rendered markup that every
 * pagination link and every chip carries the full set, which is the instrument
 * the two previous incidents did not have.
 */

/** Grid or list. LIST is the default; see `DEFAULTS`. */
export const VIEWS = ["list", "grid"];

/** How rows are bucketed. `flat` is no grouping. */
export const GROUPS = ["flat", "folder", "month"];

/** Sort keys. `usage` is the citation count, which is why it is not `refs`. */
export const SORTS = ["added", "name", "size", "usage"];

/** Sort direction. */
export const DIRS = ["desc", "asc"];

/** Tile size, applied as a class and never as an inline style. */
export const SIZES = ["s", "m", "l"];

/**
 * The defaults, which are also what `Reset to defaults` links back to.
 *
 * **LIST, NOT GRID, and that is a measurement rather than a taste.** 31 of the
 * 70 rows are PDFs and 58 are static assets; a document has no thumbnail the
 * Images binding can produce, so a grid renders it as a labelled empty box. A
 * PDF in an image-shaped container is the wrong container, and the majority of
 * this library is not images. Grid stays one click away for the case where the
 * pictures are the point.
 */
export const DEFAULTS = {
  view: "list",
  group: "flat",
  sort: "added",
  dir: "desc",
  size: "m",
  role: "content",
  q: "",
  tag: "",
  page: 1,
  trash: false,
  /**
   * The inspector's key, and it belongs in the state rather than beside it.
   *
   * It is a page parameter like any other, so it has to travel like any other:
   * an inspector that closed itself every time the reader changed a sort would
   * be the same evaporation bug wearing different clothes. Closing it is
   * `hrefWith(view, { key: "" })`, which is explicit.
   */
  key: "",
};

/**
 * Every parameter name this page owns, in link order.
 *
 * DERIVED FROM `DEFAULTS`, never typed twice. The bug this module exists to
 * prevent is a parameter that exists in one list and not another, so there is
 * one list.
 */
export const PARAM_NAMES = Object.keys(DEFAULTS);

/** @param {unknown} value @param {string[]} allowed @param {string} fallback */
function oneOf(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

/**
 * Reads the view state out of a URLSearchParams-like object.
 *
 * TOTAL, and every unrecognised value falls back to its default rather than
 * erroring. A hand-edited URL should show a library, not a stack trace, which
 * is the stance the existing `role` parser already takes.
 *
 * @param {{ get(name: string): string | null }} params
 * @returns {typeof DEFAULTS}
 */
export function readView(params) {
  const page = Number(params.get("page") ?? "1");
  return {
    view: oneOf(params.get("view"), VIEWS, DEFAULTS.view),
    group: oneOf(params.get("group"), GROUPS, DEFAULTS.group),
    sort: oneOf(params.get("sort"), SORTS, DEFAULTS.sort),
    dir: oneOf(params.get("dir"), DIRS, DEFAULTS.dir),
    size: oneOf(params.get("size"), SIZES, DEFAULTS.size),
    // `all` is how a reader asks for every role; an ABSENT role is the default,
    // which is `content`. That distinction is load-bearing and predates this
    // module, so it is preserved exactly rather than tidied.
    role: typeof params.get("role") === "string" && params.get("role") !== ""
      ? /** @type {string} */ (params.get("role"))
      : DEFAULTS.role,
    q: (params.get("q") ?? "").trim(),
    tag: (params.get("tag") ?? "").trim().toLowerCase(),
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    trash: params.get("trash") === "1",
    // NOT trimmed or lowercased: a media key is an exact string, 58 of them are
    // paths, and normalising one would make a bookmarked inspector link miss.
    key: params.get("key") ?? "",
  };
}

/**
 * A URL for this page carrying the WHOLE state, with `overrides` applied.
 *
 * **THIS IS THE ONLY WAY A LINK ON THIS PAGE SHOULD BE BUILT.** Starting from
 * the full state and overriding one field is what makes dropping a parameter an
 * act rather than an omission.
 *
 * Defaults are OMITTED from the emitted query, which is not an optimisation. It
 * keeps the bare `/admin/media` URL meaningful as "the default view", so
 * `Reset to defaults` can be a link to it, and it keeps a shared URL readable.
 * A parameter equal to its default is not carried because it does not need to
 * be: `readView` will produce the same state without it.
 *
 * @param {typeof DEFAULTS} state
 * @param {Partial<typeof DEFAULTS>} [overrides]
 * @param {string} [base]
 * @returns {string}
 */
export function hrefWith(state, overrides = {}, base = "/admin/media") {
  const next = { ...state, ...overrides };
  const search = new URLSearchParams();
  for (const name of PARAM_NAMES) {
    const value = /** @type {any} */ (next)[name];
    const fallback = /** @type {any} */ (DEFAULTS)[name];
    if (value === fallback) continue;
    if (name === "trash") {
      if (value) search.set("trash", "1");
      continue;
    }
    if (name === "page") {
      if (Number(value) > 1) search.set("page", String(value));
      continue;
    }
    if (value === "" || value === null || value === undefined) continue;
    search.set(name, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Whether the state differs from the defaults, so `Reset to defaults` can hide
 * when there is nothing to reset.
 *
 * `page` is deliberately EXCLUDED. Being on page three is navigation, not a
 * setting, and offering to reset it alongside the display preferences would
 * make the control mean two things.
 *
 * @param {typeof DEFAULTS} state
 * @returns {boolean}
 */
export function isModified(state) {
  return PARAM_NAMES.filter((n) => n !== "page").some(
    (n) => /** @type {any} */ (state)[n] !== /** @type {any} */ (DEFAULTS)[n],
  );
}

/**
 * The one-line summary the Display control shows when closed.
 *
 * The mockup's own reasoning, kept: group, sort and tile size are SETTINGS
 * rather than navigation, so they sit behind one control instead of competing
 * with the filters. A control that hides three values has to say what they are.
 *
 * @param {typeof DEFAULTS} state
 * @returns {string}
 */
export function displaySummary(state) {
  const group = { flat: "Flat", folder: "Folder", month: "Month" }[state.group];
  const sort = { added: "Newest", name: "A to Z", size: "Largest", usage: "Usage" }[state.sort];
  return [group, sort, state.size.toUpperCase()].join(" · ");
}
