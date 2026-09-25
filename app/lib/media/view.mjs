// Every link on this page is built by `hrefWith` from the WHOLE state: no gate can see a dropped query
// parameter, so dropping one has to be a visible act rather than an omission.

import { folderFor, folderRank } from "./folders.mjs";

export const VIEWS = ["list", "grid"];

export const GROUPS = ["flat", "folder", "month"];

export const SORTS = ["added", "name", "size", "usage"];

export const DIRS = ["desc", "asc"];

/**
 * A sort key carries its direction: "Largest" ascending would list the smallest. The Display popover and
 * the list header both read this, so they produce the same URL for the same column.
 *
 * @type {Record<string, string>}
 */
const SORT_DEFAULT_DIR = {
  added: "desc",
  name: "asc",
  size: "desc",
  usage: "asc",
};

export const SIZES = ["s", "m", "l"];

// `all` is the absence of a lens, so it is not a member.
const LENSES = ["unattached", "duplicates", "no-alt", "large"];

const CONFIRMS = ["empty-trash"];

// LIST by default: most rows are PDFs, which a grid renders as empty boxes.
export const DEFAULTS = {
  view: "list",
  // Folder by default: the section note is what says why a file exists.
  group: "folder",
  sort: "added",
  dir: "desc",
  size: "m",
  role: "content",
  q: "",
  tag: "",
  lens: "",
  page: 1,
  trash: false,
  // In the state, so an open inspector survives a sort change.
  key: "",
  // A URL, not `prompt()`, so the confirmation works with scripting off. With no script a `prompt()`
  // handler never runs and the form deletes straight through.
  confirm: "",
};

export const PARAM_NAMES = Object.keys(DEFAULTS);

/** @param {unknown} value @param {string[]} allowed @param {string} fallback */
function oneOf(value, allowed, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}


/**
 * Total: an unrecognised value falls back to its default, so a hand-edited URL still shows a library.
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
    // `all` asks for every role; an ABSENT role means the default, `content`.
    role: typeof params.get("role") === "string" && params.get("role") !== ""
      ? /** @type {string} */ (params.get("role"))
      : DEFAULTS.role,
    q: (params.get("q") ?? "").trim(),
    tag: (params.get("tag") ?? "").trim().toLowerCase(),
    lens: oneOf(params.get("lens"), LENSES, DEFAULTS.lens),
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    trash: params.get("trash") === "1",
    // Not trimmed or lowercased: a key is an exact string, and many are paths.
    key: params.get("key") ?? "",
    confirm: oneOf(params.get("confirm"), CONFIRMS, DEFAULTS.confirm),
  };
}

/**
 * The only way a link on this page should be built. Defaults are omitted, so the bare URL is the
 * default view and `Reset to defaults` can link to it.
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
 * `page` is excluded: it is navigation, not a setting.
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
 * PAGE-LOCAL, always: a group never spans a page boundary. Do not "fix" this; fetching the whole
 * library or repeating a heading across pages are both worse. The SQL order is preserved.
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
    // The note travels with the section, so the component cannot forget to render it.
    const folder = folderFor(bucketRows[0]?.key ?? "");
    return { label: folder.title, note: folder.note, rows: bucketRows };
  });

  // Folder sections follow the table's order; month grouping keeps first-row order, since there the
  // sort is the meaning.
  if (group !== "folder") return out;
  return out.sort(
    (a, b) =>
      folderRank(folderFor(a.rows[0]?.key ?? "").prefix) -
      folderRank(folderFor(b.rows[0]?.key ?? "").prefix),
  );
}

/**
 * @param {string} key
 * @returns {string}
 */
export function folderOf(key) {
  const at = key.lastIndexOf("/");
  if (at <= 0) return "Uploads";
  return key.slice(0, at);
}

/**
 * UTC, so a heading does not move with the reader's timezone.
 *
 * @param {string | null | undefined} uploaded ISO 8601
 * @returns {string}
 */
export function monthOf(uploaded) {
  const d = utcDate(uploaded);
  if (!d) return "No upload date";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The one parse, so the month heading and the Added cell under it cannot disagree about a date.
 *
 * @param {string | null | undefined} uploaded ISO 8601
 * @returns {Date | null} null when absent or unparseable
 */
function utcDate(uploaded) {
  if (!uploaded) return null;
  const at = Date.parse(uploaded);
  return Number.isNaN(at) ? null : new Date(at);
}

// Abbreviations are derived: all twelve are the first three letters (test/media-view-dates.test.mjs).
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));

/**
 * UTC, matching the month heading above it. Reads no clock.
 *
 * @param {string | null | undefined} uploaded ISO 8601
 * @returns {string}
 */
export function formatAdded(uploaded) {
  const d = utcDate(uploaded);
  if (!d) return "in repo";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * No em dash allowed here, so an unmeasured row says so in words; 0x0 would be a claim.
 *
 * @param {number | null | undefined} width
 * @param {number | null | undefined} height
 * @returns {string}
 */
export function formatDims(width, height) {
  return width && height ? `${width}×${height}` : "not measured";
}

/**
 * Empty for a content-addressed key: unlike `folderOf`, which names a heading, it invents no folder.
 *
 * @param {string} key
 * @returns {string}
 */
export function folderPrefix(key) {
  const at = key.lastIndexOf("/");
  return at > 0 ? `${key.slice(0, at)}/` : "";
}

/**
 * The last segment: the roster photos share their directory and differ only at the end.
 *
 * @param {{ originalName: string | null, key: string }} object
 * @returns {string}
 */
export function displayName(object) {
  if (object.originalName) return object.originalName;
  const last = object.key.split("/").pop();
  return last && last.length > 0 ? last : object.key;
}

/**
 * From the middle: these names differ at the end (`...session-01`, `...session-02`). The cap is 13
 * because the name gets 109px on a 153px tile (measured; 14 clipped by a pixel). Characters, not
 * pixels, because the server cannot measure a font; the CSS ellipsis is the backstop.
 *
 * @param {string} name
 * @param {number} [max]
 * @param {number} [tail]
 * @returns {string}
 */
export function middleTruncate(name, max = 13, tail = 9) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - tail - 1)}…${name.slice(-tail)}`;
}

/**
 * Shared by the Display popover and the column headers so both produce one URL. Only the active column
 * toggles. Always back to page one: page 3 of one sort is not page 3 of another.
 *
 * @param {typeof DEFAULTS} state
 * @param {string} key one of SORTS
 * @param {{ toggle?: boolean }} [options] toggle when the key is already active
 * @returns {string}
 */
export function sortHref(state, key, options = {}) {
  const active = state.sort === key;
  const dir =
    options.toggle && active
      ? state.dir === "asc"
        ? "desc"
        : "asc"
      : SORT_DEFAULT_DIR[key] ?? DEFAULTS.dir;
  return hrefWith(state, { sort: key, dir, page: 1 });
}

/**
 * Not capitalised: title-casing a filename means guessing which words are proper nouns.
 *
 * @param {string} base a filename, no directory
 * @returns {string}
 */
export function docTitle(base) {
  return base.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
}

/**
 * @param {typeof DEFAULTS} state
 * @returns {string}
 */
export function displaySummary(state) {
  const group = { flat: "Flat", folder: "Folder", month: "Month" }[state.group];
  const sort = { added: "Newest", name: "A to Z", size: "Largest", usage: "Usage" }[state.sort];
  return [group, sort, state.size.toUpperCase()].join(" · ");
}

// These never reach SQL, so a change skips the server (test/media-display-axes.test.mjs). `sort` and
// `dir` must NOT be added: the page paginates, so reordering changes which rows page one holds.
const DISPLAY_AXES = ["view", "group", "size"];

/**
 * Overlaid on the loader's view so a display change renders from the client URL with no revalidation.
 *
 * @param {{ get(name: string): string | null }} params
 * @returns {{ view: string, group: string, size: string }}
 */
export function readDisplayAxes(params) {
  return {
    view: oneOf(params.get("view"), VIEWS, DEFAULTS.view),
    group: oneOf(params.get("group"), GROUPS, DEFAULTS.group),
    size: oneOf(params.get("size"), SIZES, DEFAULTS.size),
  };
}

/**
 * Identical URLs return FALSE: a post-action revalidation has the same URL on both sides, and skipping
 * it would hide the write.
 *
 * @param {URL} currentUrl
 * @param {URL} nextUrl
 * @returns {boolean}
 */
export function onlyDisplayChanged(currentUrl, nextUrl) {
  if (currentUrl.pathname !== nextUrl.pathname) return false;

  const a = currentUrl.searchParams;
  const b = nextUrl.searchParams;

  // Compared through `readView` so `?view=list` and the bare URL count as the same state.
  const from = readView(a);
  const to = readView(b);
  const names = /** @type {(keyof typeof from)[]} */ (PARAM_NAMES);
  for (const name of names) {
    if (DISPLAY_AXES.includes(name)) continue;
    if (from[name] !== to[name]) return false;
  }

  return /** @type {(keyof typeof from)[]} */ (DISPLAY_AXES).some(
    (name) => from[name] !== to[name],
  );
}
