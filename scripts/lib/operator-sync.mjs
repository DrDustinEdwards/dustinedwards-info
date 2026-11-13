// The two converge steps scripts/converge.mjs runs through the deployed Worker's operator API: sync_ask brings the
// Ask index into step and sync_media the media index. Each returns a miss rather than refusing,
// because every failure here happens after the deploy has landed.

import {
  ASK_POLL_INTERVAL_MS,
  ASK_POLL_WINDOW_MS,
  awaitAskConvergence,
} from "../../app/lib/health/ask-converge.mjs";
import { healthChecks } from "@dustinedwards/site-runtime/health-read";

/** @typedef {{ origin: string, token: string }} OperatorTarget the site and its operator token */

/**
 * Generous, but not the real limit: Node's fetch gives up after 300 s without response headers, whatever this
 * says. A tool must answer inside that, which is why sync_ask uploads in parallel (ASK_UPLOAD_CONCURRENCY).
 */
const OPERATOR_TIMEOUT_MS = 10 * 60_000;

/** One retry, this long after a call that never got an answer. */
const TRANSPORT_RETRY_MS = 5_000;

/**
 * Node's fetch says only "fetch failed" and keeps the reason in `cause` (ECONNRESET, a closed socket, DNS), so the
 * cause is named too: the 2026-11-11 sync_media miss said "fetch failed" and nothing more.
 * @param {unknown} error
 */
function transportFailure(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = /** @type {any} */ (error).cause;
  const why =
    cause instanceof Error
      ? (/** @type {{ code?: string }} */ (cause).code ?? cause.message)
      : cause
        ? String(cause)
        : "";
  return why ? `${error.message} (${why})` : error.message;
}

/**
 * Returns a miss rather than throwing: every failure here happens after the deploy has landed. A call that got no
 * answer at all is tried once more, because every tool here is idempotent and the 2026-11-11 sync_media miss never
 * reached the Worker; a timeout is not, since the Worker may still be working on the first call.
 * @param {string} tool
 * @param {OperatorTarget} target
 * @returns {Promise<{ report: any, miss: string }>}
 */
async function operatorSync(tool, { origin, token }) {
  /** @type {Response | null} */
  let response = null;
  /** @type {any} */
  let body = null;
  let miss = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    miss = "";
    try {
      response = await fetch(`${origin}/api/operator`, {
        method: "POST",
        headers: {
          // The token goes in a header on a request this process builds. It is
          // never an argv entry, which every process on the machine can read.
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ tool, args: {} }),
        // Bounded: a stalled POST after the deploy has landed would hang the converge job with the deploy unreported.
        signal: AbortSignal.timeout(OPERATOR_TIMEOUT_MS),
      });
      body = await response.json().catch(() => null);
      break;
    } catch (error) {
      miss = `the ${tool} call did not complete: ${transportFailure(error)}`;
      if (error instanceof Error && error.name === "TimeoutError") break;
      if (attempt === 1) {
        console.log(`  ${miss}; trying once more`);
        await new Promise((resolve) => setTimeout(resolve, TRANSPORT_RETRY_MS));
      }
    }
  }

  if (!miss && response && !response.ok) {
    // The token and the request are never echoed. A 401 here means the secret and the file disagree. The API's own
    // error is: a bare status hid "AiSearchError: You are being rate limited" behind "500" (2026-11-11).
    const said = body && typeof body.error === "string" ? `: ${body.error.slice(0, 300)}` : "";
    miss = `the operator API answered ${response.status} to ${tool}${said}`;
  }

  const report = body && typeof body === "object" ? (body.data ?? body) : null;
  if (!miss && (!report || typeof report.converged !== "boolean")) {
    miss = `the operator API answered ${tool} without a converged verdict, so nothing was proven`;
  }

  return { report, miss };
}

/**
 * The ask-index-drift row from /health. AI Search is eventually consistent, so drift is re-read
 * before it is a miss, and through health, which writes nothing; `sync_ask` would repair what it
 * measures.
 *
 * @param {string} origin
 * @returns {Promise<any>} the row, or null when health did not report one
 */
export async function readAskDrift(origin) {
  const res = await fetch(`${origin}/health`, {
    headers: { "user-agent": "deploy-converge", "cache-control": "no-cache" },
    signal: AbortSignal.timeout(30_000),
  });
  // Parsed regardless of status: health answers 503 when the database fails, and the body is still the answer.
  const health = await res.json().catch(() => null);
  return healthChecks(health).find((c) => c.name === "ask-index-drift") ?? null;
}

/**
 * sync_ask, then, when the write-back read has not converged, re-reads /health for the Ask
 * index to catch up on its own.
 *
 * @param {OperatorTarget} target
 * @returns {Promise<string>} the miss, or "" when the index converged
 */
export async function convergeAsk(target) {
  const { origin } = target;
  let askMiss = "";

  let askLateConverge = false;

  const { report, miss } = await operatorSync("sync_ask", target);
  askMiss = miss;

  // A named failure is a miss, not drift to wait out: those keys were never written, so the index
  // will not catch up on its own.
  if (!askMiss && Array.isArray(report.failed) && report.failed.length > 0) {
    askMiss =
      `the Ask upload failed for ${report.failed.length} key(s) after retries: ` +
      report.failed.map((/** @type {any} */ f) => `${f.key} (${f.error})`).join(", ") +
      `. Re-run sync_ask once the cause clears`;
  } else if (!askMiss && report.converged !== true) {
    const driftReading = () => readAskDrift(origin);

    const firstReading = `${report.expected} expected, ${report.present} present, drift ${report.drift}`;
    console.log(
      `  not converged on the write-back (${firstReading}). Re-reading /health for up ` +
        `to ${ASK_POLL_WINDOW_MS / 1000}s before calling it a miss.`,
    );

    const { converged, polls, latest } = await awaitAskConvergence({
      reading: driftReading,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      onPoll: ({ poll, reading }) => {
        if (!reading) console.log(`  poll ${poll}: health unreadable`);
        else if (!reading.ok)
          console.log(
            `  poll ${poll}: still behind (${reading.expected} expected, ${reading.present} present)`,
          );
      },
    });

    if (converged) {
      askLateConverge = true;
      console.log(
        `  CONVERGED after ${polls} poll(s), roughly ${polls * (ASK_POLL_INTERVAL_MS / 1000)}s. ` +
          `The write-back read was early, not wrong: nothing was re-uploaded during the ` +
          `window, so the index caught up on its own.`,
      );
    } else {
      const last = latest
        ? `${latest.expected} expected, ${latest.present} present`
        : `health was unreadable on every poll, last write-back reading: ${firstReading}`;
      askMiss =
        `the Ask index did not converge within ${ASK_POLL_WINDOW_MS / 1000}s (${last}), ` +
        `after uploading ${report.uploaded} and removing ${report.removed}`;
    }
  }

  if (askMiss) {
    console.log(`  MISSED: ${askMiss}`);
  } else if (askLateConverge) {
    console.log(
      `  converged inside the window: ${report.uploaded} uploaded, ${report.removed} removed, ` +
        `${report.cacheDropped} cached answer(s) dropped. The counts are deliberately not ` +
        `restated here; the write-back pair was stale and health reported the current one.`,
    );
  } else {
    console.log(
      `  converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.uploaded} uploaded, ${report.removed} removed, ` +
        `${report.cacheDropped} cached answer(s) dropped.`,
    );
  }
  return askMiss;
}

/**
 * sync_cv_pdf, which renders the CV PDF through the deployed Worker's Browser binding when the stored
 * object is not the one for D1's CV, then reads back. Runs BEFORE the media converge: a first render
 * adds a `derived/` key the media index must then count.
 *
 * @param {OperatorTarget} target
 * @returns {Promise<string>} the miss, or "" when the stored PDF is current
 */
export async function convergeCvPdf(target) {
  const { report, miss } = await operatorSync("sync_cv_pdf", target);
  let cvPdfMiss = miss;

  if (!cvPdfMiss && report.converged !== true) {
    cvPdfMiss =
      `the CV PDF did not converge: ${report.expected} expected, ${report.present} present ` +
      `after ${report.action}. Re-run sync_cv_pdf once the cause clears`;
  }

  if (cvPdfMiss) {
    console.log(`  MISSED: ${cvPdfMiss}`);
  } else {
    console.log(
      `  converged: ${report.action}, fingerprint ${report.fingerprint}` +
        (typeof report.bytes === "number" ? `, ${report.bytes} bytes` : "") +
        `.`,
    );
  }
  return cvPdfMiss;
}

/**
 * sync_media, which rebuilds the media index through its derivation and reports the reconciliation.
 *
 * @param {OperatorTarget} target
 * @returns {Promise<string>} the miss, or "" when the index reconciled
 */
export async function convergeMedia(target) {
  let mediaMiss = "";

  const { report, miss } = await operatorSync("sync_media", target);
  mediaMiss = miss;

  if (!mediaMiss && report.converged !== true) {
    const why = [
      report.missing?.length ? `${report.missing.length} missing` : "",
      report.extra?.length ? `${report.extra.length} extra` : "",
      report.failures?.length ? `${report.failures.length} failed to derive` : "",
    ]
      .filter(Boolean)
      .join(", ");
    mediaMiss =
      `the media index did not reconcile: ${report.expected} expected, ` +
      `${report.present} present${why ? ` (${why})` : ""}, after indexing ` +
      `${report.indexed} and removing ${report.removed}`;
  }

  if (mediaMiss) {
    console.log(`  MISSED: ${mediaMiss}`);
    for (const key of (report?.missing ?? []).slice(0, 10)) console.log(`    missing: ${key}`);
    for (const key of (report?.extra ?? []).slice(0, 10)) console.log(`    extra:   ${key}`);
    for (const failure of (report?.failures ?? []).slice(0, 10))
      console.log(`    failed:  ${failure}`);
  } else {
    console.log(
      `  converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.indexed} indexed, ${report.removed} removed.`,
    );
  }
  return mediaMiss;
}
