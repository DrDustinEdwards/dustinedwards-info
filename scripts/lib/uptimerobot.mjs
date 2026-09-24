/** Every value here was measured against the API: the v3 docs return no specification to a fetch. */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const API_BASE = "https://api.uptimerobot.com/v3";

/** Here, not in the writer: importing from the writer would create monitors as a side effect. */
export const MANIFEST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "uptime-monitors.json",
);

/** The gate asserts not-paused rather than up: a down monitor is one doing its job. */
export const PAUSED = "PAUSED";

/**
 * Never interpolates the key into a message; the API's error text echoes fields, not the token.
 *
 * @param {string} key
 * @param {string} path
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
 * The list endpoint is not a reliable read of status: it can report not-paused for a monitor just
 * switched off. Null for 404, a monitor that is gone rather than an error.
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
 * The keyword is the full opening fragment: the bare word appears in every health body, so it
 * would fail open. This couples to the endpoint's key order.
 *
 * @param {string} origin
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
        // No trailing slash: the API stores the origin without one, so a slash rewrites it every run.
        url: base,
        type: "HTTP",
        interval: 300,
        timeout: 30,
        // 3xx allowed here and not on health: the cutover puts a redirect in front of the home page.
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

/** A subset: comparing every field would go red the day UptimeRobot adds one. */
export const COMPARED_FIELDS = [
  "url",
  "type",
  "interval",
  "keywordType",
  "keywordValue",
  "keywordCaseType",
];

/**
 * Written as a string (the API refuses any other spelling) and read back as a number; both values
 * measured by writing each and reading it back.
 */
const READ_REPRESENTATION = {
  keywordCaseType: { CaseSensitive: 0, CaseInsensitive: 1 },
};

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {unknown}
 */
export function expectedReadValue(field, value) {
  const map = /** @type {Record<string, Record<string, unknown>>} */ (READ_REPRESENTATION)[field];
  if (!map) return value;
  // Unmapped falls through unchanged, not to undefined, so a new enum member shows as a mismatch.
  return String(value) in map ? map[String(value)] : value;
}

/**
 * @param {string} field
 * @param {unknown} live
 * @param {unknown} want
 */
export function fieldInStep(field, live, want) {
  return JSON.stringify(live) === JSON.stringify(expectedReadValue(field, want));
}
