// Remote takes the UUID: by name resolves through wrangler.jsonc, which a clean checkout bootstraps
// with a placeholder id. Local keeps the name, Miniflare having no UUID.

import { runWrangler, wranglerTail } from "./wrangler-run.mjs";

/** @typedef {(command: string) => { status: number | null, stdout: string, output?: string }} Run */

/**
 * Every database the account holds, or why the listing could not be read. `failure` is empty only
 * when `d1 list` exited 0 and its JSON parsed.
 *
 * @param {Run} [run]
 * @returns {{ databases: Array<{ uuid?: string, name?: string, created_at?: string }>, failure: string }}
 */
export function listD1Databases(run = runWrangler) {
  const listed = run("d1 list --json");
  if (listed.status !== 0) {
    return {
      databases: [],
      failure: ` (d1 list exited ${listed.status}: ${wranglerTail(listed.output ?? listed.stdout)})`,
    };
  }
  // On a CI runner wrangler prints a banner before its JSON, so parse from the first `[`.
  const start = listed.stdout.indexOf("[");
  if (start === -1) return { databases: [], failure: " (d1 list printed no JSON)" };
  try {
    return { databases: JSON.parse(listed.stdout.slice(start)), failure: "" };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return { databases: [], failure: ` (d1 list output did not parse: ${why})` };
  }
}

/** @type {Map<string, string>} */
const resolved = new Map();

/**
 * @param {string} dbName
 * @param {string} target
 * @param {Run} [run]
 * @returns {string} a UUID for a remote target, the name for a local one
 */
export function resolveD1Address(dbName, target, run = runWrangler) {
  if (target !== "--remote") return dbName;
  const memo = resolved.get(dbName);
  if (memo) return memo;

  const { databases, failure } = listD1Databases(run);
  const found = databases.find((d) => d.name === dbName);
  // Fails closed: falling back to the name would reintroduce the lookup failure wearing a passing lookup.
  if (typeof found?.uuid !== "string" || found.uuid.length === 0) {
    throw new Error(
      `could not resolve ${dbName} to a UUID from d1 list${failure}. ` +
        `Passing the NAME lets wrangler resolve it out of wrangler.jsonc, which a ` +
        `clean checkout bootstraps from the example with a placeholder id, so a ` +
        `--remote run addresses a database that does not exist.`,
    );
  }
  resolved.set(dbName, found.uuid);
  return found.uuid;
}
