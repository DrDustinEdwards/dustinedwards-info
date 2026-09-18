/**
 * The UptimeRobot v3 contract, in one place, shared by the writer and the gate.
 *
 * BOUNDARY: every value here was MEASURED against the API rather than read off a description of
 * it, the v3 documentation returning no specification to a fetch, so this is fixture independence
 * applied to a third party and it ages the day the API does.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** One base URL. */
export const API_BASE = "https://api.uptimerobot.com/v3";

/**
 * Where the monitor ids are recorded. IT LIVES HERE because both consumers need it and the writer
 * is a PROGRAM: importing a constant out of it would create monitors as a side effect of checking
 * them. Beside its two consumers, on the precedent that a manifest sits with what it describes.
 */
export const MANIFEST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "uptime-monitors.json",
);

/**
 * THE GATE ASSERTS NOT-PAUSED RATHER THAN UP: a DOWN monitor is one doing its job, so a gate
 * demanding UP would go red for the site being down. What this owns is whether the instrument
 * exists, is switched on, and is pointed at the right host.
 */
export const PAUSED = "PAUSED";

/**
 * One authenticated call. NEVER INTERPOLATES THE KEY INTO A MESSAGE: the status and the API's own
 * error text are reported, and that text echoes the offending FIELDS, never the bearer token.
 *
 * @param {string} key
 * @param {string} path path under the v3 base, leading slash
 * @param {{ method?: string, body?: unknown }} [options]
 * @returns {Promise<{ ok: boolean, status: number, body: any, text: string }>}
 */
export async function call(key, path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* Left null. The caller reports `text`, which is the API's own message. */
  }
  return { ok: response.ok, status: response.status, body: parsed, text };
}

/**
 * PAGINATES RATHER THAN TAKING THE FIRST PAGE: reading one page would call a monitor missing the
 * day the account grows past the page size, and would let the writer create a duplicate on every
 * run. The loop is bounded so a server that never stops advancing cannot spin.
 *
 * @param {string} key
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function listMonitors(key) {
  const all = [];
  const pageSize = 50;
  for (let offset = 0, page = 0; page < 20; page += 1, offset += pageSize) {
    const res = await call(key, `/monitors?limit=${pageSize}&offset=${offset}`);
    if (!res.ok) {
      throw new Error(`UptimeRobot GET /monitors answered ${res.status}: ${res.text.slice(0, 300)}`);
    }
    const rows = Array.isArray(res.body?.data) ? res.body.data : [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
  return all;
}

/**
 * THE LIST ENDPOINT IS NOT A RELIABLE READ OF A MONITOR'S STATUS: immediately after a resume the
 * addressed read and the list answered DIFFERENTLY and did not converge monotonically. **THE
 * DANGEROUS DIRECTION IS THE REASON THIS EXISTS**: the list reports NOT PAUSED for a monitor
 * somebody has just switched off, and a monitoring gate whose failure mode is a false green is
 * worse than no gate. Returns `null` for 404, a monitor that is GONE rather than an error.
 *
 * @param {string} key
 * @param {number|string} id
 * @returns {Promise<Record<string, any> | null>}
 */
export async function getMonitor(key, id) {
  const res = await call(key, `/monitors/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`UptimeRobot GET /monitors/${id} answered ${res.status}: ${res.text.slice(0, 300)}`);
  }
  return res.body;
}

/**
 * The monitor shapes this repo asks for, derived from one origin. **`SITE_ORIGIN` IS THE ONE
 * OWNER OF THE HOST**, which is why ship calls the writer. THE KEYWORD IS THE FULL OPENING
 * FRAGMENT, AND THE BARE WORD WOULD HAVE FAILED OPEN: the health endpoint answers the same body
 * shape for every verdict, so the word appears in every response it can produce. Only the leading
 * fragment discriminates, which is a real coupling to key order and is stated rather than left to
 * be discovered. AND IT IS NOT THE ONLY SIGNAL: the accepted status codes exclude the failing one.
 *
 * @param {string} origin SITE_ORIGIN, no trailing slash
 * @returns {Array<{ path: string, key: string, shape: Record<string, unknown> }>}
 */
export function desiredMonitors(origin) {
  const base = origin.replace(/\/+$/, "");
  return [
    {
      key: "home",
      path: "/",
      shape: {
        friendlyName: "dustinedwards.info home page",
        /*
         * NO TRAILING SLASH, an idempotency fix rather than a preference: the account stored the origin
         * without one, so every run would have written a monitor that needed nothing.
         */
        url: base,
        type: "HTTP",
        interval: 300,
        timeout: 30,
        /*
         * 3xx IS ALLOWED HERE AND NOT ON HEALTH: the home page is what a reader types and the cutover
         * puts a redirect in front of it. The health endpoint has no reason to redirect ever.
         */
        successHttpResponseCodes: ["2xx", "3xx"],
      },
    },
    {
      key: "health",
      path: "/api/health",
      shape: {
        friendlyName: "dustinedwards.info /api/health",
        url: `${base}/api/health`,
        type: "KEYWORD",
        interval: 300,
        timeout: 30,
        keywordType: "ALERT_NOT_EXISTS",
        keywordValue: '{"ok":true',
        keywordCaseType: "CaseSensitive",
        successHttpResponseCodes: ["2xx"],
      },
    },
  ];
}

/**
 * A SUBSET, DELIBERATELY: comparing all of the API's fields would redden the day UptimeRobot adds
 * one, which teaches everybody to ignore it. These decide whether the monitor watches the right
 * thing in the right way.
 */
export const COMPARED_FIELDS = [
  "url",
  "type",
  "interval",
  "keywordType",
  "keywordValue",
  "keywordCaseType",
];

/**
 * Fields the API ACCEPTS in one representation and RETURNS in another, caught by running the thing
 * twice: one field is written as a string the API refuses any other spelling of and read back as a
 * number, so the comparison reports drift on a correct monitor forever. The writer would update on
 * every run and the gate would be PERMANENTLY RED. BOTH VALUES WERE MEASURED, NOT INFERRED FROM
 * THE FIRST, by writing each and reading it back.
 */
const READ_REPRESENTATION = {
  keywordCaseType: { CaseSensitive: 0, CaseInsensitive: 1 },
};

/**
 * What the API will RETURN for a field this repo asked to be `value`. ONE FUNCTION, BOTH
 * CONSUMERS: if the writer and the gate disagreed about what "in step" means, one would be wrong
 * on every run. Hard rule 17.
 *
 * @param {string} field
 * @param {unknown} value the value this repo writes
 * @returns {unknown} the value the API is expected to return
 */
export function expectedReadValue(field, value) {
  const map = /** @type {Record<string, Record<string, unknown>>} */ (READ_REPRESENTATION)[field];
  if (!map) return value;
  // A value with no mapping falls through UNCHANGED rather than to undefined: a new enum member
  // should surface as a mismatch naming both sides, which is hard rule 13.
  return String(value) in map ? map[String(value)] : value;
}

/**
 * Whether a live monitor's field already says what this repo asked for.
 *
 * @param {string} field
 * @param {unknown} live the value the API returned
 * @param {unknown} want the value this repo writes
 */
export function fieldInStep(field, live, want) {
  return JSON.stringify(live) === JSON.stringify(expectedReadValue(field, want));
}
