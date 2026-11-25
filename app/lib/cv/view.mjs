/**
 * What the CV page shows for a filter state: the state's URL form, which entries match, how they are
 * grouped, the headline counts and the chart inputs. One module for both sides: the route computes the
 * first render from the query string (so a shared URL and a scripts-off reader get the same page), and
 * app/enhance/cv.ts recomputes it on every input. It never imports the data, so the enhancement bundle
 * carries none of it; each side hands in `Facts`.
 */

import { listParam, yearParam } from "capsomer/behavior/catalog";

/** @typedef {import("./types.ts").CvType} CvType */
/** @typedef {import("./types.ts").CvArea} CvArea */
/** @typedef {import("./types.ts").CvRole} CvRole */

/**
 * @typedef {object} Facts what filtering, grouping and counting read from an entry
 * @property {string} id
 * @property {CvType} type
 * @property {boolean} paper counts as a paper: a publication the site has a record for (isShowcase), so the CV's count is the home page's
 * @property {string | null} section
 * @property {CvArea[]} areas
 * @property {CvRole | null} role
 * @property {number | null} year
 * @property {number | "present" | null} endYear
 * @property {number | null} students
 * @property {boolean} cohort
 * @property {number | null} amount
 * @property {number} order position in the source, the tiebreak everywhere
 * @property {string} search folded text
 */

/**
 * @typedef {object} CvState
 * @property {CvType[]} types empty means every type
 * @property {CvArea[]} areas empty means every area
 * @property {number | null} from
 * @property {number | null} to
 * @property {CvRole | null} role
 * @property {string} q
 * @property {"type" | "newest" | "oldest"} sort
 */

/** Traditional CV order, which is also the "by type" sort. */
export const TYPES = /** @type {const} */ ([
  ["appointment", "Appointment", "Appointments"],
  ["education", "Education", "Education"],
  ["publication", "Publication", "Publications"],
  ["grant", "Grant", "Grants"],
  ["award", "Award", "Fellowships and awards"],
  ["talk", "Invited talk", "Invited talks"],
  ["course", "Course", "Courses taught"],
  ["mentoring", "Mentoring", "Students mentored"],
  ["service", "Service", "Service"],
  ["development", "Professional development", "Professional development"],
]);

export const AREAS = /** @type {const} */ ([
  ["retroviruses", "Retroviruses"],
  ["bacteriophages", "Bacteriophages"],
  ["science-education", "Science education"],
  ["ai", "AI"],
]);

export const ROLES = /** @type {const} */ ([
  ["first-author", "First author"],
  ["senior-author", "Senior author"],
  ["co-author", "Co-author"],
  ["recipient", "Recipient"],
  ["speaker", "Speaker"],
  ["instructor", "Instructor"],
  ["mentor", "Mentor"],
  ["chair", "Chair"],
  ["organizer", "Organizer"],
  ["member", "Member"],
  ["editor", "Editor"],
  ["reviewer", "Reviewer"],
  ["judge", "Judge"],
  ["advisor", "Advisor"],
  ["volunteer", "Volunteer"],
  ["consultant", "Consultant"],
  ["participant", "Participant"],
]);

export const SORTS = /** @type {const} */ ([
  ["type", "Section"],
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
]);

/** The timeline figure's id, which Enarratio's `enarratio:select` events carry as `chartId`. */
export const TIMELINE_ID = "cv-timeline";

/** The types the timeline stacks, in stacking order; app/styles/cv.css colors the series in this order. */
export const CHART_SERIES = /** @type {const} */ ([
  ["publication", "Publications"],
  ["grant", "Grants"],
  ["talk", "Invited talks"],
  ["award", "Awards"],
]);

const TYPE_IDS = new Set(TYPES.map(([id]) => /** @type {string} */ (id)));
const AREA_IDS = new Set(AREAS.map(([id]) => /** @type {string} */ (id)));
const ROLE_IDS = new Set(ROLES.map(([id]) => /** @type {string} */ (id)));
const SORT_IDS = new Set(SORTS.map(([id]) => /** @type {string} */ (id)));

/** @param {CvType} type */
export function typeLabel(type, plural = false) {
  const row = TYPES.find(([id]) => id === type);
  if (!row) throw new Error(`cv: unknown type ${type}`);
  return plural ? row[2] : row[1];
}

/** @param {string} area */
export function areaLabel(area) {
  return AREAS.find(([id]) => id === area)?.[1] ?? area;
}

/** @param {string} role */
export function roleLabel(role) {
  return ROLES.find(([id]) => id === role)?.[1] ?? role;
}

/**
 * Lowercased with diacritics removed, so "Galvão" matches "galvao".
 *
 * @param {string} text
 */
export function foldText(text) {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whole dollars print without cents; the CV's cents are kept where it has them.
 *
 * @param {number} amount
 */
export function formatDollars(amount) {
  const cents = Math.round(amount * 100) % 100 !== 0;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** @returns {CvState} */
function defaultState() {
  return { types: [], areas: [], from: null, to: null, role: null, q: "", sort: "type" };
}

/**
 * @param {URLSearchParams} params
 * @returns {CvState}
 */
export function parseState(params) {
  const state = defaultState();
  state.types = /** @type {CvType[]} */ (listParam(params, "type", TYPE_IDS));
  state.areas = /** @type {CvArea[]} */ (listParam(params, "area", AREA_IDS));
  state.from = yearParam(params.get("from"));
  state.to = yearParam(params.get("to"));
  if (state.from !== null && state.to !== null && state.from > state.to) {
    [state.from, state.to] = [state.to, state.from];
  }
  const role = params.get("role") ?? "";
  state.role = ROLE_IDS.has(role) ? /** @type {CvRole} */ (role) : null;
  state.q = (params.get("q") ?? "").trim().slice(0, 100);
  const sort = params.get("sort") ?? "";
  state.sort = SORT_IDS.has(sort) ? /** @type {CvState["sort"]} */ (sort) : "type";
  return state;
}

/**
 * The canonical query string for a state: only what differs from the default, lists in their
 * vocabulary's order, so one filter has one URL. Repeated keys, as the scripts-off form submits them.
 *
 * @param {CvState} state
 */
export function stateToSearch(state) {
  const params = new URLSearchParams();
  for (const [id] of TYPES) if (state.types.includes(id)) params.append("type", id);
  for (const [id] of AREAS) if (state.areas.includes(id)) params.append("area", id);
  if (state.from !== null) params.set("from", String(state.from));
  if (state.to !== null) params.set("to", String(state.to));
  if (state.role) params.set("role", state.role);
  if (state.q) params.set("q", state.q);
  if (state.sort !== "type") params.set("sort", state.sort);
  const out = params.toString();
  return out ? `?${out}` : "";
}

/** @param {CvState} state */
export function isFiltered(state) {
  return (
    state.types.length > 0 ||
    state.areas.length > 0 ||
    state.from !== null ||
    state.to !== null ||
    state.role !== null ||
    state.q !== ""
  );
}

/**
 * An entry's span: an ongoing one runs forever, and an undated one has no span and matches no range.
 *
 * @param {Facts} f
 * @returns {[number, number] | null}
 */
function spanOf(f) {
  if (f.year === null) return null;
  const end = f.endYear === "present" ? Number.POSITIVE_INFINITY : (f.endYear ?? f.year);
  return [f.year, end];
}

/**
 * @param {Facts} f
 * @param {CvState} state
 * @param {{ ignoreYears?: boolean }} [options] the charts show every year and mark the range instead
 */
export function matches(f, state, options = {}) {
  if (state.types.length > 0 && !state.types.includes(f.type)) return false;
  if (state.areas.length > 0 && !f.areas.some((a) => state.areas.includes(a))) return false;
  if (state.role && f.role !== state.role) return false;
  if (!options.ignoreYears && (state.from !== null || state.to !== null)) {
    const span = spanOf(f);
    if (!span) return false;
    if (state.from !== null && span[1] < state.from) return false;
    if (state.to !== null && span[0] > state.to) return false;
  }
  if (state.q) {
    for (const word of foldText(state.q).split(" ")) {
      if (word && !f.search.includes(word)) return false;
    }
  }
  return true;
}

/**
 * @typedef {object} Group
 * @property {string} key
 * @property {string} heading
 * @property {{ key: string, heading: string | null, ids: string[] }[]} parts
 */

/**
 * How the entries sit on the page. By section: the CV's order, each type's subsections in the order
 * they first appear, newest first inside each. By date: one group per year, undated last.
 *
 * @param {Facts[]} facts every entry, matching or not: a hidden entry keeps its place
 * @param {CvState["sort"]} sort
 * @returns {Group[]}
 */
export function groupEntries(facts, sort) {
  const byYearDesc = (/** @type {Facts} */ a, /** @type {Facts} */ b) =>
    (b.year ?? -Infinity) - (a.year ?? -Infinity) || a.order - b.order;

  if (sort === "type") {
    /** @type {Group[]} */
    const groups = [];
    for (const [type, , plural] of TYPES) {
      const members = facts.filter((f) => f.type === type);
      if (members.length === 0) continue;
      /** @type {Map<string, Facts[]>} */
      const parts = new Map();
      for (const f of [...members].sort((a, b) => a.order - b.order)) {
        const key = f.section ?? "";
        if (!parts.has(key)) parts.set(key, []);
        parts.get(key)?.push(f);
      }
      groups.push({
        key: `type-${type}`,
        heading: plural,
        parts: [...parts].map(([section, list]) => ({
          key: `type-${type}-${section ? section.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "all"}`,
          heading: section || null,
          ids: [...list].sort(byYearDesc).map((f) => f.id),
        })),
      });
    }
    return groups;
  }

  const typeRank = new Map(TYPES.map(([id], i) => [/** @type {string} */ (id), i]));
  const years = [...new Set(facts.map((f) => f.year))].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return sort === "newest" ? b - a : a - b;
  });
  return years.map((year) => ({
    key: `year-${year ?? "undated"}`,
    heading: year === null ? "Undated" : String(year),
    parts: [
      {
        key: `year-${year ?? "undated"}-all`,
        heading: null,
        ids: facts
          .filter((f) => f.year === year)
          .sort(
            (a, b) =>
              (typeRank.get(a.type) ?? 0) - (typeRank.get(b.type) ?? 0) || a.order - b.order,
          )
          .map((f) => f.id),
      },
    ],
  }));
}

/**
 * @param {Facts[]} shown
 */
export function headline(shown) {
  let papers = 0;
  let grants = 0;
  let dollars = 0;
  let students = 0;
  for (const f of shown) {
    if (f.paper) papers += 1;
    if (f.type === "grant") {
      grants += 1;
      dollars += f.amount ?? 0;
    }
    if (f.type === "mentoring") students += f.students ?? 0;
  }
  return {
    papers,
    grants,
    dollars: Math.round(dollars * 100) / 100,
    students,
    entries: shown.length,
  };
}

/**
 * Inclusive, ascending.
 *
 * @param {number} from
 * @param {number} to
 */
export function range(from, to) {
  const out = [];
  for (let y = from; y <= to; y += 1) out.push(y);
  return out;
}

/**
 * The query a year's bar links to with script off: that year alone, or every year when it already is.
 *
 * @param {CvState} state
 * @param {number} year
 */
export function yearHref(state, year) {
  const only = state.from === year && state.to === year;
  return stateToSearch({ ...state, from: only ? null : year, to: only ? null : year });
}

/**
 * @param {number} shown
 * @param {number} total
 */
export function summaryText(shown, total) {
  if (shown === total) return `Showing all ${total} entries`;
  if (shown === 0) return `No entries match. ${total} entries in all`;
  return `Showing ${shown} of ${total} entries`;
}

/**
 * How many entries each filter option would show, given every other filter: the number beside a
 * checkbox is what ticking it adds, the way a faceted search counts.
 *
 * @param {Facts[]} all
 * @param {CvState} state
 */
export function facetCounts(all, state) {
  /** @type {Record<string, number>} */
  const types = {};
  /** @type {Record<string, number>} */
  const areas = {};
  /** @type {Record<string, number>} */
  const roles = {};
  const noTypes = { ...state, types: [] };
  const noAreas = { ...state, areas: [] };
  const noRole = { ...state, role: null };
  for (const f of all) {
    if (matches(f, noTypes)) types[f.type] = (types[f.type] ?? 0) + 1;
    if (matches(f, noAreas)) for (const a of f.areas) areas[a] = (areas[a] ?? 0) + 1;
    if (f.role && matches(f, noRole)) roles[f.role] = (roles[f.role] ?? 0) + 1;
  }
  return { types, areas, roles };
}

/**
 * @param {Facts[]} all
 */
export function yearOptions(all) {
  const years = all.map((f) => f.year).filter((y) => y !== null);
  return range(Math.min(...years), Math.max(...years));
}

/**
 * How many filters are on, for the collapsed filter panel's label: each ticked type and area, the year
 * range, the role and the search.
 *
 * @param {CvState} state
 */
export function activeCount(state) {
  return (
    state.types.length +
    state.areas.length +
    (state.from !== null || state.to !== null ? 1 : 0) +
    (state.role ? 1 : 0) +
    (state.q ? 1 : 0)
  );
}
