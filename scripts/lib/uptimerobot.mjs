/**
 * The UptimeRobot v3 contract, in one place, shared by the writer and the gate.
 *
 * `scripts/uptime-ensure.mjs` creates and updates monitors; `check:uptime`
 * reads them back and refuses. Both need the same base URL, the same auth
 * header, the same monitor SHAPES and the same idea of what "paused" is, and a
 * second copy of any of those is the drift rule 17 exists about.
 *
 * ## EVERY VALUE BELOW WAS MEASURED, NOT READ OFF A BLOG POST
 *
 * The v3 documentation page is a client-side application and returns no
 * endpoint specification to a fetch; `/v3/openapi.json`, `/v3/swagger.json`
 * and `/v3/docs/openapi.json` all answer 404. So the contract was taken from
 * the API itself on 2026-09-07, by sending deliberately invalid requests and
 * reading the validation errors back. That is the fixture-independence rule
 * applied to a third party: the expectations here come from the service, not
 * from a description of it.
 *
 * What the API said, verbatim where it matters:
 *
 * - `POST /v3/monitors` requires `friendlyName` (string, <= 250), `url`
 *   (string, <= 10000, "Invalid URL for this monitor type"), `type`, `interval`
 *   ("must not be less than 15") and `timeout` (0 to 60).
 * - `type must be one of the following values: HTTP,KEYWORD,PING,PORT,`
 *   `HEARTBEAT,DNS,API,UDP,VISUAL_COMPARISON`. **A keyword monitor is its own
 *   TYPE**, not an HTTP monitor carrying a keyword.
 * - `keywordType must be one of the following values: ALERT_EXISTS,`
 *   `ALERT_NOT_EXISTS`, and `keywordCaseType must be one of the following`
 *   `values: CaseSensitive,CaseInsensitive`.
 * - Update is `PATCH /v3/monitors/{id}`. `PUT` answers 404.
 * - **`status` is not writable through PATCH**: it answers 400 `property`
 *   `status should not exist`. Pausing is `POST /v3/monitors/{id}/pause` (201)
 *   and resuming is `POST /v3/monitors/{id}/start` (201). `/resume` answers
 *   404, which is worth writing down because it is the obvious guess.
 * - Observed `status` values: `UP`, `PAUSED`, and `STARTED` immediately after
 *   a resume and before the first check lands.
 *
 * ## THE RATE LIMIT IS REAL AND IT IS SMALL
 *
 * The published allowance on the free plan is 10 requests per minute. The
 * writer spends at most four in a run (one list, one contact read, two
 * writes) and the gate spends one. Neither loops, and nothing here retries in
 * a tight loop, because a monitoring integration that gets itself throttled is
 * a monitoring integration that reports nothing.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** One base URL. */
export const API_BASE = "https://api.uptimerobot.com/v3";

/**
 * Where the monitor ids are recorded.
 *
 * IT LIVES HERE RATHER THAN IN `uptime-ensure.mjs` because both the writer and
 * the gate need it, and `uptime-ensure.mjs` is a PROGRAM: importing a constant
 * out of it would run it, so the gate would create monitors as a side effect of
 * checking them.
 *
 * Beside its two consumers rather than in `content/`, which holds things the
 * SITE reads. This is infrastructure state, on the `drizzle/manifest.json`
 * precedent: a manifest sits with the thing it describes.
 */
export const MANIFEST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "uptime-monitors.json",
);

/**
 * The status that means "this monitor is switched off".
 *
 * THE GATE ASSERTS NOT-PAUSED RATHER THAN UP, and the difference is the whole
 * point. `UP`, `DOWN` and `STARTED` are all a WORKING monitor: a `DOWN`
 * monitor is one doing its job and reporting an outage, and a gate that
 * demanded `UP` would go red for the site being down, which is the monitor's
 * job to say and not the gate's. What this gate owns is whether the instrument
 * exists, is switched on, and is pointed at the right host.
 */
export const PAUSED = "PAUSED";

/**
 * One authenticated call.
 *
 * NEVER INTERPOLATES THE KEY INTO A MESSAGE. On a failure the status and the
 * response body are reported, and the body is the API's own error text, which
 * echoes the offending FIELDS and never the bearer token.
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
 * Every monitor on the account.
 *
 * PAGINATES RATHER THAN TAKING THE FIRST PAGE. A gate that read one page and
 * concluded a monitor was missing would fail for the wrong reason the day the
 * account grows past the page size, and one that concluded a DUPLICATE was
 * absent would let `uptime-ensure` create a second copy on every run. The loop
 * is bounded so a server that never stops advancing cannot spin.
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
 * One monitor, read by id.
 *
 * ## THE LIST ENDPOINT IS NOT A RELIABLE READ OF A MONITOR'S STATUS
 *
 * MEASURED 2026-09-07, and it changed this gate's design. Immediately after
 * resuming a monitor, `GET /monitors/{id}` answered `STARTED` while
 * `GET /monitors` answered `PAUSED` for the same monitor at the same moment.
 * Polled every 15 seconds, the two views converged after about 30 seconds, and
 * they did not converge monotonically: at t+16s the list said `UP` while the
 * addressed read still said `STARTED`. They are two independently updated
 * views, not one view with a delay.
 *
 * **THE DANGEROUS DIRECTION IS THE REASON THIS EXISTS.** A gate reading the
 * list would report a stale status for tens of seconds after a change, which
 * includes reporting NOT PAUSED for a monitor somebody has just switched off.
 * A monitoring gate whose failure mode is a false green is worse than no gate.
 *
 * So `check:uptime` reads every monitor by id. It costs one request per
 * monitor instead of one in total, which is two against a published allowance
 * of ten per minute.
 *
 * Returns `null` for 404, which is a monitor that is GONE rather than an
 * error: the caller reports it by name.
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
 * The monitor shapes this repo asks for, derived from one origin.
 *
 * **`SITE_ORIGIN` IS THE ONE OWNER OF THE HOST** (rule 17). The cutover
 * changes that constant and these two URLs follow, which is the whole reason
 * ship calls the writer rather than somebody editing a dashboard field twice.
 *
 * ## THE KEYWORD IS `{"ok":true` AND `"ok"` WOULD HAVE FAILED OPEN
 *
 * `/api/health` answers the SAME BODY SHAPE for every verdict:
 * `{"ok":false,"checks":[...]}` on a failure. So the string `ok` appears in
 * every response this endpoint can produce, healthy or not, and a monitor
 * keyed on it is green while the site is failing. `"ok":true` is no better,
 * because a per-check entry reads `{"name":"fts-equality","ok":true}` and
 * appears inside the array even when the top-level verdict is false.
 *
 * The leading `{"ok":true` is the only string that discriminates, because
 * `publicHealthBody` builds the object with `ok` first and `JSON.stringify`
 * preserves insertion order. That is a real coupling to that function and it
 * is stated here rather than left to be discovered.
 *
 * **AND IT IS NOT THE ONLY SIGNAL.** `successHttpResponseCodes` is `["2xx"]`
 * on the health monitor, so the 503 that route answers for a failing check is
 * a failure on the status line alone. Two independent mechanisms have to both
 * miss for a real failure to read as healthy.
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
         * NO TRAILING SLASH, and that is an idempotency fix rather than a
         * preference. The `--dry-run` on 2026-09-07 reported `WOULD UPDATE
         * home fields: url` against a monitor that was already correct,
         * because the account stored `https://host` and this asked for
         * `https://host/`. Left alone, every run would have PATCHed a monitor
         * that needed nothing, which is the opposite of what "idempotent"
         * means. `SITE_ORIGIN` carries no trailing slash, so using it as-is
         * makes the two strings equal without normalizing anything.
         */
        url: base,
        type: "HTTP",
        interval: 300,
        timeout: 30,
        /*
         * 3xx IS ALLOWED HERE AND NOT ON HEALTH. The home page is the URL a
         * reader types, and the cutover puts a redirect in front of it; a
         * monitor that reddened on a legitimate redirect would be retired for
         * crying wolf. `/api/health` has no reason to redirect ever, so a 3xx
         * there is a defect and is treated as one.
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
 * The fields the gate and the writer both compare.
 *
 * A SUBSET, DELIBERATELY. The API returns roughly forty fields, most of them
 * defaults this repo has no opinion about (`sslBrand`, `gracePeriod`,
 * `regionalData`). Comparing all of them would make the gate red on the day
 * UptimeRobot adds a field, which teaches everybody to ignore it. These are
 * the ones that decide whether the monitor is watching the right thing in the
 * right way.
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
 * Fields the API ACCEPTS in one representation and RETURNS in another.
 *
 * ## THE DEFECT THIS EXISTS FOR, caught by running the thing twice
 *
 * `keywordCaseType` is written as the string `CaseSensitive` (the API refuses
 * anything else: "keywordCaseType must be one of the following values:
 * CaseSensitive,CaseInsensitive") and READ BACK as the number `0`. So a
 * comparison of what-was-asked-for against what-is-stored reports drift on a
 * monitor that is exactly right, forever.
 *
 * That is not cosmetic in either consumer. `uptime-ensure` would PATCH on
 * every single run, which is the precise opposite of idempotent and was caught
 * on the second run rather than reasoned about. `check:uptime` would be
 * PERMANENTLY RED on a correct monitor, and a gate that is always red is a
 * gate everybody learns to ignore.
 *
 * ## BOTH VALUES WERE MEASURED, NOT INFERRED FROM THE FIRST
 *
 * On 2026-09-07, by PATCHing the live monitor to each value and reading it
 * back: `CaseSensitive` stores `0`, `CaseInsensitive` stores `1`, and the
 * monitor was restored to `CaseSensitive` afterwards. Writing `1` here on the
 * strength of having seen `0` would have been a guess in a table whose whole
 * job is to be right.
 *
 * Every other compared field round-trips identically, verified in the same
 * read: `type`, `url`, `interval`, `keywordType` and `keywordValue` all come
 * back exactly as sent.
 */
const READ_REPRESENTATION = {
  keywordCaseType: { CaseSensitive: 0, CaseInsensitive: 1 },
};

/**
 * What the API will RETURN for a field this repo asked to be `value`.
 *
 * ONE FUNCTION, BOTH CONSUMERS. The writer decides whether to PATCH and the
 * gate decides whether to fail, and if those two disagreed about what "in
 * step" means then one of them would be wrong on every run. Hard rule 17.
 *
 * @param {string} field
 * @param {unknown} value the value this repo writes
 * @returns {unknown} the value the API is expected to return
 */
export function expectedReadValue(field, value) {
  const map = /** @type {Record<string, Record<string, unknown>>} */ (READ_REPRESENTATION)[field];
  if (!map) return value;
  // A value with no mapping falls through UNCHANGED rather than to undefined:
  // a new enum member should surface as a visible mismatch naming both sides,
  // not as a comparison against nothing. Hard rule 13.
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
