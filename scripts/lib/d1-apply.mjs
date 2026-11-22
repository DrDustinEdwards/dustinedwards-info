// The one way scripts write a statement file to D1. Local: wrangler's `--file` into Miniflare. Remote: D1's query
// API, the file's statements sent as one batch. Never wrangler's `--remote --file`: that is D1's import API, and while
// an import runs the database answers every other query with "Currently processing a long-running import."
//
// A batch is one SQL transaction (D1 docs, Workers Binding API, `batch()`; the REST query endpoint runs a `batch`
// body the same way), so a file still lands whole or not at all, as the import did, and the site's own queries queue
// behind it for the moment it takes instead of failing. D1's per-statement cap (100 KB) applies inside a batch, which
// is why callers pass their SQL through split-statements.mjs first.

import { readFile } from "node:fs/promises";

import { errorMessage } from "@dustinedwards/site-runtime/log";

import { runWrangler } from "./wrangler-run.mjs";
import { splitStatements } from "./split-statements.mjs";

const API = "https://api.cloudflare.com/client/v4";

/** A remote batch is one request; this bounds it, as runWrangler bounds wrangler. */
const REMOTE_TIMEOUT_MS = 5 * 60_000;

/**
 * Applies `file` to the database at `address` (the name for `--local`, the UUID resolveD1Address gives for
 * `--remote`). Answers runWrangler's shape: status 0 on success, `output` carrying the error otherwise.
 *
 * @param {{ address: string, target: string, file: string, env?: Record<string, string | undefined>, fetchImpl?: typeof fetch }} options
 * @returns {Promise<{ status: number, stdout: string, output: string }>}
 */
export async function applySqlFile({
  address,
  target,
  file,
  env = process.env,
  fetchImpl = fetch,
}) {
  if (target !== "--remote")
    return runWrangler(`d1 execute ${address} ${target} --file "${file}" --yes`);

  const token = env.CLOUDFLARE_API_TOKEN;
  const account = env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) {
    return failed(
      "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set for a remote write: it goes through D1's " +
        "query API, because wrangler's `--remote --file` is an import, which refuses the live site's queries while it runs.",
    );
  }

  const statements = splitStatements(await readFile(file, "utf8"));
  if (statements.length === 0) return { status: 0, stdout: "", output: "" };

  try {
    const response = await fetchImpl(`${API}/accounts/${account}/d1/database/${address}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ batch: statements.map((sql) => ({ sql })) }),
      signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
    });
    const text = await response.text();
    /** @type {{ success?: boolean, errors?: Array<{ message?: string }>, result?: Array<{ success?: boolean }> } | null} */
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON: reported with the status below.
    }
    const allApplied =
      response.ok &&
      body?.success === true &&
      Array.isArray(body.result) &&
      body.result.every((r) => r.success !== false);
    if (!allApplied) {
      const why = body?.errors?.map((e) => e.message).join("; ") || text.slice(0, 400) || "no body";
      return failed(
        `D1 query API answered ${response.status} for ${statements.length} statement(s): ${why}`,
      );
    }
    const summary = `applied ${statements.length} statement(s) to remote D1 as one batch`;
    return { status: 0, stdout: summary, output: summary };
  } catch (error) {
    return failed(`D1 query API request failed: ${errorMessage(error)}`);
  }
}

/** @param {string} why */
function failed(why) {
  return { status: 1, stdout: "", output: why };
}
