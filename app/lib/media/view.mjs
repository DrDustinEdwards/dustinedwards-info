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

import { folderFor, folderRank } from "./folders.mjs";

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
 * THE QUALITY LENSES, which are the questions somebody actually has.
 *
 * These replaced the role chips (Content / Generated / Brand / Icons) as the
 * primary row. Role is the SYSTEM'S classification and, once every section
 * carries a folder heading, it says the same thing twice. A lens says something
 * the headings cannot: which files nothing references, which are duplicates of
 * each other, which are missing alt text, which are big.
 *
 * `all` is the absence of a lens rather than a value, so it is not a member.
 */
export const LENSES = ["unattached", "duplicates", "no-alt", "large"];

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
  /*
   * FOLDER IS THE DEFAULT, and it is the design's spine rather than a
   * preference. A flat wall of tiles cannot say why a file exists; a section
   * heading with a note can, and the note is what stops somebody deleting nine
   * cohort photographs because a post-level tracker called them unreferenced.
   * Flat is still one click away for when you want the whole page at once.
   */
  group: "folder",
  sort: "added",
  dir: "desc",
  size: "m",
  role: "content",
  q: "",
  tag: "",
  /** A quality lens, or "" for all. See LENSES. */
  lens: "",
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
    lens: oneOf(params.get("lens"), LENSES, DEFAULTS.lens),
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
 * Buckets the rows of ONE PAGE under headings.
 *
 * **PAGE-LOCAL, ALWAYS, AND THAT IS A RULING RATHER THAN A LIMITATION.** A
 * group never spans a page boundary. Do not "fix" this.
 *
 * The two alternatives were both considered and both are worse:
 *
 *   FETCH THE WHOLE LIBRARY and group globally. Fine at 70 rows and wrong at
 *   700, and the page paginates precisely so it does not have to hold the
 *   corpus. Adopting it would trade a correct page for a page that is fast
 *   until it silently is not.
 *
 *   LET A GROUP SPAN PAGES. Page one ends inside "March" and page two opens
 *   with a second "March" heading. That reads as a bug to everybody who sees
 *   it, and it is indistinguishable from one.
 *
 * So the contract is small and honest: these are the rows on this page,
 * arranged. The heading counts describe the page, not the library, and the
 * component says so beside them.
 *
 * ORDER IS PRESERVED. The rows arrive already sorted by SQL, and grouping must
 * not resort them: it walks them once and appends to whichever bucket each one
 * belongs to, so within a group the reader's chosen sort still holds and the
 * groups themselves appear in the order their first row did.
 *
 * @template {{ key: string, uploaded?: string | null }} T
 * @param {T[]} rows already sorted
 * @param {string} group one of GROUPS
 * @returns {Array<{ label: string, note: string, rows: T[] }>} one entry when flat
 */
export function groupRows(rows, group) {
  if (group !== "folder" && group !== "month") return [{ label: "", note: "", rows }];

  /** @type {Map<string, T[]>} */
  const buckets = new Map();
  for (const row of rows) {
    const label = group === "folder" ? folderFor(row.key).prefix : monthOf(row.uploaded);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(row);
    else buckets.set(label, [row]);
  }

  const out = [...buckets.entries()].map(([label, bucketRows]) => {
    if (group !== "folder") return { label, note: "", rows: bucketRows };
    // THE NOTE TRAVELS WITH THE SECTION. It is the whole reason the grouping
    // exists, so it is part of the group rather than something the component
    // has to look up and might forget to render.
    const folder = folderFor(bucketRows[0].key);
    return { label: folder.title, note: folder.note, rows: bucketRows };
  });

  /*
   * FOLDER SECTIONS RENDER IN THE TABLE'S ORDER, not in first-row order.
   *
   * The table is written so the sections a reader most often wants come first,
   * and root files last. Month grouping keeps first-row order, because there
   * the SORT is the meaning and reordering would fight it.
   */
  if (group !== "folder") return out;
  return out.sort(
    (a, b) =>
      folderRank(folderFor(a.rows[0].key).prefix) - folderRank(folderFor(b.rows[0].key).prefix),
  );
}

/**
 * The folder a key lives in, as a bare prefix.
 *
 * SUPERSEDED for grouping by `folderFor`, which also carries the title and the
 * note. Kept because it is the honest answer to "what directory is this in",
 * which the tests still ask, and because `folderFor` falls back through it.
 *
 * A static asset's key IS a path, so it has a real directory. An uploaded key
 * is content-addressed and has none, which is a fact about the key rather than
 * a missing value, so it gets a name that says so instead of an empty heading.
 *
 * @param {string} key
 * @returns {string}
 */
export function folderOf(key) {
  const at = key.lastIndexOf("/");
  if (at <= 0) return "Uploads";
  return key.slice(0, at);
}

/**
 * The month something was uploaded, as a heading.
 *
 * UTC, so the heading does not move with the reader's timezone: a file uploaded
 * at 23:30 UTC must not appear under a different month for somebody in Sydney
 * than for somebody in Denver, because then two people describing the library
 * disagree.
 *
 * A static asset has no upload event and NULL is the honest value, so it gets
 * its own bucket rather than being folded into whatever month is nearest.
 *
 * @param {string | null | undefined} uploaded ISO 8601
 * @returns {string}
 */
export function monthOf(uploaded) {
  if (!uploaded) return "No upload date";
  const at = Date.parse(uploaded);
  if (Number.isNaN(at)) return "No upload date";
  const d = new Date(at);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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
