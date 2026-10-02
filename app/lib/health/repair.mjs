// Repairs only when EVERY failing check is a known drift class: an unknown one blocks all repair, since
// a compound failure may share a root cause. No token still fails the run: alert-only, never silence.

import { awaitAskConvergence } from "./ask-converge.mjs";

/** Only idempotent repairs through the operator API, since this runs unattended. Map order is repair order. */
export const REPAIRABLE = /** @type {const} */ ({
  // Content first: sync_ask reads search_docs, which sync_posts, sync_procedures, sync_dictionary,
  // sync_pages and sync_publications rewrite, so the reverse uploads a stale corpus.
  "content-drift": "sync_posts",
  "procedures-drift": "sync_procedures",
  // Before the pages: an entry write refreshes the page row it opens, and a page compile reads the entry from D1.
  "dictionary-drift": "sync_dictionary",
  // Beside the dictionary: the roster is drawn into the program page and the home page, which a page compile or a
  // purge may re-open, so it converges before the pages do. It writes no search record.
  "roster-drift": "sync_roster",
  // Before the pages as well: the phage page is compiled from the phage rows, so a page compile reads them from D1,
  // and a phage write refreshes the page row it is drawn into.
  "phage-drift": "sync_phages",
  "pages-drift": "sync_pages",
  "publications-drift": "sync_publications",
  // Reads nothing the Ask upload reads; listed with the file-derived stores.
  "llms-drift": "sync_llms",
  "cv-drift": "sync_cv",
  // After sync_cv, which it follows: the PDF is drawn from the rows sync_cv converges. It reads nothing the Ask
  // upload reads.
  "cv-pdf-drift": "sync_cv_pdf",
  "ask-index-drift": "sync_ask",
  "media-index-drift": "sync_media",
  // Order-independent. backup_media only copies and has no delete branch, which is why it may fire unattended.
  "media-backup-drift": "backup_media",
});

/**
 * @param {unknown} failingNames names of checks reporting ok:false
 * @param {{ hasToken: boolean }} options
 * @returns {{
 *   repair: string[],
 *   unknown: string[],
 *   alertOnly: boolean,
 *   reason: string,
 * }}
 */
export function repairPlan(failingNames, { hasToken }) {
  const names = Array.isArray(failingNames)
    ? failingNames.filter((n) => typeof n === "string" && n.length > 0)
    : [];

  if (names.length === 0) {
    return {
      repair: [],
      unknown: [],
      alertOnly: true,
      reason:
        "no failing check was named, so there is nothing to repair. A run that reports " +
        "unhealthy without naming a check is a fault in the endpoint, not a drift.",
    };
  }

  const unknown = names.filter((n) => !(n in REPAIRABLE));

  if (unknown.length > 0) {
    return {
      repair: [],
      unknown,
      alertOnly: true,
      reason:
        `no self-repair: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not a ` +
        `known drift class. Repair is not attempted for the recognized classes either, ` +
        `because a compound failure may share a root cause.`,
    };
  }

  if (!hasToken) {
    return {
      repair: [],
      unknown: [],
      alertOnly: true,
      reason:
        "no self-repair: OPERATOR_TOKEN is not set on this watcher, so the repair door " +
        "cannot be opened. The GitHub half takes it as a repository secret " +
        "(`gh secret set OPERATOR_TOKEN`); the watchdog Worker takes it as a wrangler " +
        "secret (`wrangler secret put OPERATOR_TOKEN -c wrangler.watchdog.jsonc`). " +
        "Alerting only.",
    };
  }

  // Ordered by the map and deduplicated, so one tool is never called twice and run logs compare.
  const tools = Object.keys(REPAIRABLE)
    .filter((name) => names.includes(name))
    .map((name) => REPAIRABLE[/** @type {keyof typeof REPAIRABLE} */ (name)]);

  return {
    repair: [...new Set(tools)],
    unknown: [],
    alertOnly: false,
    reason: `self-repair: ${names.join(", ")} -> ${[...new Set(tools)].join(", ")}`,
  };
}

/**
 * An unreadable body yields no names, so repairPlan alerts rather than writes. ok === false, not !ok,
 * so a check missing the field is not counted as failing.
 *
 * @param {unknown} body
 * @returns {string[]}
 */
export function failingCheckNames(body) {
  const checks = /** @type {any} */ (body)?.checks;
  if (!Array.isArray(checks)) return [];
  return checks
    .filter((c) => c && typeof c === "object" && c.ok === false && typeof c.name === "string")
    .map((c) => c.name);
}

// The recheck is in the action list: a repair's own 200 proves one index, the recheck proves the
// endpoint agrees, and a step living only in the caller is a step no test can name.

/**
 * @typedef {{ type: "repair", tool: string }} RepairAction
 * @typedef {{ type: "recheck" }} RecheckAction
 * @typedef {{ type: "notify", reason: string }} NotifyAction
 * @typedef {RepairAction | RecheckAction | NotifyAction} WatchdogAction
 */

/**
 * @typedef {{ status: number, body: unknown, error?: string }} HealthReading
 */

/**
 * A 200 whose body says `ok: true`; anything else, a 503 included, is unhealthy.
 *
 * @param {HealthReading | null | undefined} reading
 * @returns {boolean}
 */
function isHealthyReading(reading) {
  const body = reading?.body;
  return (
    Number(reading?.status) === 200 &&
    !!body &&
    typeof body === "object" &&
    /** @type {any} */ (body).ok === true
  );
}

/**
 * Anything but a healthy 200 takes the same path: a 503 is how this endpoint reports a failing check.
 *
 * @param {HealthReading} reading
 * @param {{ hasToken: boolean }} options
 * @returns {WatchdogAction[]}
 */
export function watchdogActions(reading, { hasToken }) {
  const status = Number(reading?.status);
  const body = reading?.body;

  if (isHealthyReading(reading)) return [];

  // A transport failure is reported with its cause: a timeout and a 1042 are different pages, and
  // without the cause the mail says "no failing check was named" about a fetch that never happened.
  if (status === 0) {
    const cause = typeof reading?.error === "string" && reading.error ? reading.error : "";
    return [
      {
        type: "notify",
        reason:
          `the health endpoint could not be reached at all${cause ? `: ${cause}` : `, and the ` +
            `reading carried no cause, which is itself a defect in the reader`}. Nothing was ` +
          `repaired, because a reading that never happened names no drift.`,
      },
    ];
  }

  const plan = repairPlan(failingCheckNames(body), { hasToken });

  if (plan.alertOnly) return [{ type: "notify", reason: plan.reason }];

  return [
    ...plan.repair.map((tool) => /** @type {RepairAction} */ ({ type: "repair", tool })),
    { type: "recheck" },
  ];
}

/**
 * A failed repair and a still-failing recheck are both reported, not just the first.
 *
 * @param {{ misses: string[], recheck: HealthReading | null }} outcome
 * @returns {WatchdogAction[]}
 */
export function watchdogOutcome({ misses, recheck }) {
  const failed = Array.isArray(misses) ? misses.filter((m) => typeof m === "string" && m) : [];

  const reasons = [];
  if (failed.length > 0) reasons.push(`self-repair FAILED: ${failed.join("; ")}. The drift stands.`);

  if (recheck === null || recheck === undefined) {
    reasons.push("the re-check did not complete, so the repair proved nothing.");
  } else {
    const stillFailing = failingWithCounts(recheck.body);
    if (!isHealthyReading(recheck)) {
      reasons.push(
        `self-repair ran and the endpoint is STILL unhealthy (HTTP ${recheck.status}` +
          `${stillFailing.length ? `, failing: ${stillFailing.join(", ")}` : ""}).`,
      );
    }
  }

  return reasons.length > 0 ? [{ type: "notify", reason: reasons.join(" ") }] : [];
}

/**
 * Each failing check by name, with the counts the public body carries for a failing drift check.
 *
 * @param {unknown} body
 * @returns {string[]}
 */
function failingWithCounts(body) {
  const checks = /** @type {any} */ (body)?.checks;
  if (!Array.isArray(checks)) return [];
  return checks
    .filter((c) => c && typeof c === "object" && c.ok === false && typeof c.name === "string")
    .map((c) =>
      typeof c.expected === "number" && typeof c.present === "number"
        ? `${c.name} (expected ${c.expected}, present ${c.present})`
        : c.name,
    );
}

/**
 * After the watchdog's own sync_ask, the Ask index can list short for up to about a minute: it is
 * eventually consistent, and a full re-upload is followed by a short count (157 then 155 in deploy
 * run 36274700184). So a re-check still failing only on that is re-read on ship's cadence and window
 * (awaitAskConvergence) before it can alert. The last full reading is returned, so another failing
 * check, or a count that never arrives, still alerts with its counts.
 *
 * @param {{
 *   recheck: HealthReading | null,
 *   attempted: string[],
 *   reread: () => Promise<HealthReading>,
 *   sleep: (ms: number) => Promise<unknown>,
 *   now?: () => number,
 * }} options
 * @returns {Promise<{ reading: HealthReading | null, polls: number }>}
 */
export async function settleAskRecheck({ recheck, attempted, reread, sleep, now }) {
  if (!recheck || !attempted.includes("sync_ask")) return { reading: recheck, polls: 0 };
  if (!failingCheckNames(recheck.body).includes("ask-index-drift")) return { reading: recheck, polls: 0 };

  let latest = recheck;
  const { polls } = await awaitAskConvergence({
    reading: async () => {
      const reading = await reread();
      // A reading that never arrived names no drift, so the last real one stands.
      if (Number(reading?.status) === 0) return null;
      latest = reading;
      const checks = /** @type {any} */ (reading.body)?.checks;
      return Array.isArray(checks) ? (checks.find((c) => c?.name === "ask-index-drift") ?? null) : null;
    },
    sleep,
    now,
  });
  return { reading: latest, polls };
}

/**
 * Reports the operator API's own error and detail, since a bare status discards the diagnosis. A 422
 * is unrepairable: resending the same corpus cannot correct it; usually the repo is ahead of the deploy.
 *
 * @param {string} tool the operator tool that was called
 * @param {number} status the HTTP status it answered
 * @param {unknown} payload the parsed response body, or null
 * @returns {{ miss: string, unrepairable: boolean }}
 */
export function refusalMiss(tool, status, payload) {
  const body = payload && typeof payload === "object" ? /** @type {any} */ (payload) : null;
  const said = typeof body?.error === "string" ? body.error.trim() : "";
  const field = typeof body?.detail?.field === "string" && body.detail.field ? body.detail.field : "";
  const line = typeof body?.detail?.line === "number" ? body.detail.line : null;

  return {
    miss:
      `${tool} answered ${status}` +
      (said ? `: ${said}` : "") +
      (field ? ` [field ${field}]` : "") +
      (line === null ? "" : ` [line ${line}]`),
    unrepairable: status === 422,
  };
}
