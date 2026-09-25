// The two converge steps ship runs through the deployed Worker's operator API: sync_ask brings the
// Ask index into step and sync_media the media index. Each returns a miss rather than refusing,
// because every failure here happens after the deploy has landed.

import {
  ASK_POLL_INTERVAL_MS,
  ASK_POLL_WINDOW_MS,
  awaitAskConvergence,
} from "./ask-converge.mjs";

/** @typedef {{ origin: string, token: string }} OperatorTarget the site and its operator token */

/** Generous: sync_ask uploads every changed document with retries inside one request. */
const OPERATOR_TIMEOUT_MS = 10 * 60_000;

/**
 * Returns a miss rather than throwing: every failure here happens after the deploy has landed.
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
      // Bounded: a stalled POST after the deploy has landed would hang ship with the deploy unreported.
      signal: AbortSignal.timeout(OPERATOR_TIMEOUT_MS),
    });
    body = await response.json().catch(() => null);
  } catch (error) {
    miss = `the ${tool} call did not complete: ${error instanceof Error ? error.message : String(error)}`;
  }

  if (!miss && response && !response.ok) {
    // The token and the request are never echoed. A 401 here means the secret and the file disagree.
    miss = `the operator API answered ${response.status} to ${tool}`;
  }

  const report = body && typeof body === "object" ? (body.data ?? body) : null;
  if (!miss && (!report || typeof report.converged !== "boolean")) {
    miss = `the operator API answered ${tool} without a converged verdict, so nothing was proven`;
  }

  return { report, miss };
}

/**
 * sync_ask, then, when the write-back read has not converged, re-reads /api/health for the Ask
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
    /*
     * AI Search is eventually consistent, so drift is re-read before it is a miss, via `/api/health`,
     * which writes nothing; `sync_ask` would repair what it measures.
     */
    const driftReading = async () => {
      const res = await fetch(`${origin}/api/health`, {
        headers: { "user-agent": "ship", "cache-control": "no-cache" },
        signal: AbortSignal.timeout(30_000),
      });
      // Parsed regardless of status: health answers 503 when ANY check fails,
      // including ones this loop is not asking about, and the body is still
      // the answer.
      const health = await res.json().catch(() => null);
      return health?.checks?.find((/** @type {any} */ c) => c?.name === "ask-index-drift") ?? null;
    };

    const firstReading =
      `${report.expected} expected, ${report.present} present, drift ${report.drift}`;
    console.log(
      `  not converged on the write-back (${firstReading}). Re-reading /api/health for up ` +
        `to ${ASK_POLL_WINDOW_MS / 1000}s before calling it a miss.`,
    );

    const { converged, polls, latest } = await awaitAskConvergence({
      reading: driftReading,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      onPoll: ({ poll, reading }) => {
        if (!reading) console.log(`  poll ${poll}: health unreadable`);
        else if (!reading.ok)
          console.log(`  poll ${poll}: still behind (${reading.expected} expected, ${reading.present} present)`);
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
    for (const failure of (report?.failures ?? []).slice(0, 10)) console.log(`    failed:  ${failure}`);
  } else {
    console.log(
      `  converged: ${report.expected} expected, ${report.present} present, ` +
        `${report.indexed} indexed, ${report.removed} removed.`,
    );
  }
  return mediaMiss;
}
