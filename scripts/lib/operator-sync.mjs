// The converge steps scripts/converge.mjs runs through the deployed Worker's operator API: sync_ask has AI Search read
// the Ask corpus from D1 and waits for it, sync_cv_pdf brings the CV PDF into step and sync_media the media index. Each returns a miss rather than refusing,
// because every failure here happens after the deploy has landed.

/** @typedef {{ origin: string, token: string }} OperatorTarget the site and its operator token */

/**
 * Generous, but not the real limit: Node's fetch gives up after 300 s without response headers, whatever this
 * says. A tool must answer inside that, which is why sync_ask stops waiting on its sync at four minutes.
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
 * sync_ask, which asks AI Search to read the corpus from D1, waits for that sync to end and reads the index back.
 *
 * @param {OperatorTarget} target
 * @returns {Promise<string>} the miss, or "" when the index converged
 */
export async function convergeAsk(target) {
  const { report, miss } = await operatorSync("sync_ask", target);
  let askMiss = miss;

  if (!askMiss && report.converged !== true) {
    askMiss = report.ended
      ? `the Ask index did not converge after sync ${report.job}: ${report.expected} expected, ` +
        `${report.present} present, ${report.refused} refused. A refused row is named in that job's ` +
        `logs (AI Search, dustinedwards-ask, Jobs)`
      : `sync ${report.job} had not ended when sync_ask stopped waiting (${report.expected} expected, ` +
        `${report.present} present, ${report.indexing} indexing). It goes on, and /health reports the result`;
  }

  if (askMiss) {
    console.log(`  MISSED: ${askMiss}`);
  } else {
    console.log(
      `  converged after sync ${report.job}: ${report.expected} expected, ${report.present} present.`,
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
