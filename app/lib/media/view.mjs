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

/**
 * THE DIRECTION EACH SORT KEY MEANS WHEN YOU FIRST ASK FOR IT.
 *
 * A sort key is not direction-neutral. "Largest" descending is what the words
 * say; "Largest" ascending is the smallest files under a label promising the
 * opposite, and that is what the page shipped: the Sort group set `sort` alone
 * and left whatever `dir` happened to be in the URL. Choosing Largest while
 * ascending gave you the smallest file first, from a control labelled Largest.
 *
 * So a sort choice carries its direction, and BOTH controls that make one read
 * it from here. That is the whole reason this is a table rather than two
 * literals: the Display popover and the list header must produce the SAME URL
 * for the same column, and the only way to guarantee that is to give them one
 * source for the pair. `check:admin-ui` asserts the two URLs are identical, per
 * key, over the rendered markup.
 *
 * The values are the mockup's own, verified in its source (`sortOpts` and the
 * `column(key, label, align, dir)` calls): name ascending, usage ascending,
 * size descending, added descending. Alphabetical wants A first; a quantity
 * wants the big end first, because the question is always "what is biggest" and
 * never "what is smallest".
 *
 * @type {Record<string, string>}
 */
export const SORT_DEFAULT_DIR = {
  added: "desc",
  name: "asc",
  size: "desc",
  usage: "asc",
};

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

/** Confirmations that have a URL of their own. See DEFAULTS.confirm. */
export const CONFIRMS = ["empty-trash"];

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
  /**
   * WHICH CONFIRMATION IS OPEN, or "" for none.
   *
   * A URL rather than client state, for the one thing `prompt()` could never
   * do: work with scripting off. The empty-trash control used an `onSubmit`
   * handler calling `prompt()`, so with no script the handler never ran and the
   * form submitted STRAIGHT THROUGH, deleting every trashed object with no
   * confirmation at all. The ceremony was script-only while the destruction
   * was not.
   *
   * As a URL the modal is server-rendered, cancel is a link and confirm is a
   * real submit, so the ladder holds identically either way.
   */
  confirm: "",
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
    confirm: oneOf(params.get("confirm"), CONFIRMS, DEFAULTS.confirm),
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
  const d = utcDate(uploaded);
  if (!d) return "No upload date";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * THE ONE UTC PARSE, and the one place an unusable value is decided.
 *
 * `monthOf` and `formatAdded` each carried this three-line sequence verbatim.
 * Two copies of a parse is two answers to "is this timestamp usable", and they
 * are read on the SAME SCREEN: the month heading and the Added cell under it.
 * The failure that shape produces is not a crash, it is a row filed under
 * "No upload date" while its own Added cell prints a date, or the reverse.
 *
 * The callers still choose their own words for the unusable case, because they
 * genuinely differ: a heading says the date is missing, a cell says where the
 * file came from instead. What they no longer disagree about is WHEN it is
 * missing.
 *
 * NO CLOCK IS READ here or in either caller.
 *
 * @param {string | null | undefined} uploaded ISO 8601
 * @returns {Date | null} null when absent or unparseable
 */
function utcDate(uploaded) {
  if (!uploaded) return null;
  const at = Date.parse(uploaded);
  return Number.isNaN(at) ? null : new Date(at);
}

/**
 * Month names, and the ONLY list of them in this module.
 *
 * `MONTH_ABBR` sat below as a second hand-written list of the same twelve
 * facts. It is now derived, which is legal precisely because English month
 * abbreviations ARE the first three letters of the name for all twelve, with no
 * exception: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec. That is checked
 * rather than assumed, in `test/media-view-dates.test.mjs`.
 *
 * Two lists could disagree; one list and a slice cannot.
 */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The Added column's short form. DERIVED, never a second list. */
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));

/* -------------------------------------------------------------------------
 * HOW ONE ROW READS, moved here from `app/routes/admin.media._index.tsx` on
 * 2026-08-24 with their comments. Bodies are unchanged; the TypeScript
 * annotations became JSDoc because this module is JavaScript.
 *
 * They sit beside `folderOf` and `monthOf` because they are the same kind of
 * fact: a pure function from a row to the string the page shows for it. In
 * the route they were reachable only by that route, which is how a second
 * copy gets written the next time a page needs one.
 *
 * `displayName`'s docblock had drifted onto `folderPrefix` in the route, so
 * the two functions arrive here with the comments that describe them.
 * ---------------------------------------------------------------------- */

/**
 * The Added column, as a date a person reads.
 *
 * UTC, for the same reason the month HEADINGS are UTC: a file uploaded at 23:30
 * UTC must not show one date here and a different month in the heading directly
 * above it. The two would disagree on the same screen.
 *
 * NO CLOCK IS READ. This formats a string the loader supplied; it never asks
 * what today is, which is the rule the scheduled-post fixture exists to hold.
 *
 * A static asset has no upload event, and NULL is the honest value, so it says
 * where the file comes from instead of borrowing a date from somewhere.
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
 * The Dims column, and an EM DASH IS NOT AVAILABLE, so an unmeasured row says
 * so in a character that is allowed here.
 *
 * A document has no pixel dimensions and never will; a vector may have none
 * recorded. Both are "not measured" rather than zero, and printing 0x0 would be
 * a claim.
 *
 * @param {number | null | undefined} width
 * @param {number | null | undefined} height
 * @returns {string}
 */
export function formatDims(width, height) {
  return width && height ? `${width}×${height}` : "not measured";
}

/**
 * The directory a key sits in, with its trailing slash, for the list row.
 *
 * The COUNTERPART to `displayName` dropping it. A content-addressed key has no
 * directory, and saying "Uploads" here would invent a folder that does not
 * exist in the key; the empty string is the honest answer and the cell simply
 * carries nothing. `folderOf` is not reused because it substitutes that word
 * deliberately, for a HEADING, where a bucket does need a name.
 *
 * @param {string} key
 * @returns {string}
 */
export function folderPrefix(key) {
  const at = key.lastIndexOf("/");
  return at > 0 ? `${key.slice(0, at)}/` : "";
}

/**
 * THE LAST SEGMENT, because a directory is the part these names SHARE.
 *
 * Measured on the rendered page: a tile showed `/phage-hunters/2024-cohort-gro`
 * with the rest cut off. The nine roster photos share every character of that
 * prefix and differ only at the end, so nine tiles rendered as nine copies of
 * one string while the distinguishing half was the half thrown away.
 *
 * Dropping the directory rather than de-emphasising it, because a de-emphasised
 * prefix still spends horizontal space on the segment that fails to tell these
 * rows apart, and at 109px of room there is none to spend. The full key stays a
 * hover away in the `title` and a click away in the detail view, which is also
 * the no-script route to the address.
 *
 * A content-addressed key has no directory, so this returns it unchanged. What
 * remains is still too long for the tile, which `middleTruncate` below handles.
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
 * TRUNCATION FROM THE MIDDLE, because both ends carry meaning and the tail
 * carries more of it.
 *
 * Measured in a browser, and NO line clamp fixes this. Two lines at 13px cut a
 * 39-character roster name; three lines at 12px still cut a 58-character
 * document name. The cut always lands on the end, which is exactly where these
 * names differ: `...session-01` against `...session-02`, `...paper-1` against
 * `...paper-2`.
 *
 * So the middle goes and both ends stay, with the tail given the larger share.
 *
 * THE CAP IS 13 BECAUSE THE NAME GETS 109px, and every number here was read off
 * a rendered page rather than estimated. The tile is 153px, the body pads 8 each
 * side, the icon takes 22 and the gap 4, which leaves 109 for the name. At the
 * page's own font that holds 13 characters: cap 14 measured 110px and clipped 7
 * of 24 tiles by one pixel, cap 16 measured 125, cap 20 measured 144 to 156, and
 * cap 22 measured 158 to 169. That progression is also why the control beside it
 * is a glyph rather than the word Copy: the word cost 41px and left the name 104,
 * so the browser ellipsised the END again and undid this function in the same
 * commit that added it.
 *
 * Character-based rather than pixel-based, for the same reason the social card's
 * title cap is: this renders on a server that cannot measure a font, and the CSS
 * ellipsis stays on as the backstop for a name that is short in characters and
 * wide in pixels.
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
 * THE URL A SORT CHOICE PRODUCES, and there is exactly one of them per key.
 *
 * Both the Display popover's Sort group and the list view's column headers call
 * this, which is what makes "clicking Size and choosing Largest land on the same
 * page" true by construction rather than by two implementations agreeing.
 *
 * TOGGLING IS THE ONE ASYMMETRY, and it belongs to the column that is already
 * sorted. Pressing the active column reverses it, which is what every table in
 * the world does and what the mockup does; pressing any other column asks for
 * that column at ITS default direction. So the popover and a header differ only
 * on the key the reader is already sorted by, and that difference is the
 * toggle, not a drift between two link builders.
 *
 * Back to page one, always. Page 3 of a name sort is not page 3 of a size sort,
 * and landing there would show a reader rows they did not ask for under a
 * heading they did.
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
 * A DOCUMENT'S TITLE, from its key, because a filename is not a title.
 *
 * `edwards-2024-phage-genomics.pdf` and `edwards-2023-cluster-analysis.pdf` are
 * the same string to a reader scanning a grid: the extension is noise on a card
 * that already says PDF, and the hyphens are a slug's punctuation rather than
 * anything a person wrote. Dropping both leaves the words, which is the part
 * that distinguishes one paper from another.
 *
 * NOT CAPITALISED, and that is the mockup's own choice rather than an omission.
 * Its `titleize` strips the extension, swaps hyphens for spaces and stops. Title
 * casing a filename means guessing which words are proper nouns, and it would
 * render `edwards 2024 phage genomics` as `Edwards 2024 Phage Genomics`, which
 * asserts an authorship the key does not carry. The words as typed are honest.
 *
 * The directory is already gone by the time this is called: the caller passes
 * the last segment, because the folder heading above the card says the folder.
 *
 * @param {string} base a filename, no directory
 * @returns {string}
 */
export function docTitle(base) {
  return base.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
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

/**
 * THE DISPLAY AXES: the ones that change how the fetched page is PRESENTED and
 * never which rows it contains.
 *
 * `view` picks list or grid over one markup tree, `size` is a CSS class hook on
 * the grid, and `group` buckets rows already in hand. None of the three reaches
 * SQL, which `check:media-display-axes` asserts by reading `listMediaPage`.
 *
 * Standing ruling, 2026-08-16: anything that does not change which data comes
 * back must not touch the server at all. These three are the whole set on this
 * page. `sort` and `dir` are NOT here and must not be added: the page paginates,
 * so reordering changes which 24 rows page one holds.
 */
export const DISPLAY_AXES = ["view", "group", "size"];

/**
 * The display axes as the URL currently spells them.
 *
 * The component overlays this on the loader's view so a display change renders
 * from the CLIENT URL with no revalidation. On the server the two are the same
 * object by construction, because both read the same request URL, so the
 * overlay is a no-op in the no-script render.
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
 * True when two URLs for this page differ ONLY in display axes.
 *
 * Used by the route's `shouldRevalidate` to skip the loader entirely. Identical
 * URLs return FALSE, not true: a revalidation after an action arrives with the
 * same URL on both sides, and answering "only display changed" there would skip
 * the refetch that makes the write visible.
 *
 * @param {URL} currentUrl
 * @param {URL} nextUrl
 * @returns {boolean}
 */
export function onlyDisplayChanged(currentUrl, nextUrl) {
  if (currentUrl.pathname !== nextUrl.pathname) return false;

  const a = currentUrl.searchParams;
  const b = nextUrl.searchParams;

  // Every axis that is NOT a display axis has to match exactly. Read through
  // `readView` rather than comparing raw strings so that two spellings of the
  // same state (`?view=list` and the bare URL, since defaults are omitted) are
  // not mistaken for a difference.
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
