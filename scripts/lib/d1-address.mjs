// Remote takes the UUID: by name resolves through wrangler.jsonc, which a clean checkout bootstraps
// with a placeholder id. Local keeps the name, Miniflare having no UUID.

import { spawnSync } from "node:child_process";

/**
 * @param {string} command
 */
function defaultRun(command) {
  const r = spawnSync(`npx wrangler ${command}`, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  // stdout alone is the JSON: stderr appended after it (a deprecation warning, an update notice) made
  // the text from the first `[` unparseable. A failed spawn is surfaced rather than read as no output.
  if (r.error) throw new Error(`npx wrangler ${command} could not run: ${r.error.message}`);
  if (r.status !== 0 && r.stderr) console.error(r.stderr.trim());
  return { status: r.status, stdout: r.stdout ?? "" };
}

/** @type {Map<string, string>} */
const resolved = new Map();

/**
 * @param {string} dbName
 * @param {string} target
 * @param {(command: string) => { status: number | null, stdout: string }} [run]
 * @returns {string} a UUID for a remote target, the name for a local one
 */
export function resolveD1Address(dbName, target, run = defaultRun) {
  if (target !== "--remote") return dbName;
  const memo = resolved.get(dbName);
  if (memo) return memo;

  const listed = run("d1 list --json");
  // On a CI runner wrangler prints a banner before its JSON, so parse from the first `[`.
  const start = listed.status === 0 ? listed.stdout.indexOf("[") : -1;
  /** @type {Array<{ uuid?: string, name?: string }>} */
  let databases = [];
  /** @type {string} Carried into the refusal below, so an unparseable list is named as such. */
  let parseError = "";
  if (start !== -1) {
    try {
      databases = JSON.parse(listed.stdout.slice(start));
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      parseError = ` (d1 list output did not parse: ${why})`;
    }
  }

  const found = databases.find((d) => d.name === dbName);
  if (typeof found?.uuid !== "string" || found.uuid.length === 0) {
    throw new Error(
      `could not resolve ${dbName} to a UUID from d1 list` +
        `${listed.status === 0 ? "" : ` (d1 list exited ${listed.status})`}${parseError}. ` +
        `Passing the NAME lets wrangler resolve it out of wrangler.jsonc, which a ` +
        `clean checkout bootstraps from the example with a placeholder id, so a ` +
        `--remote run addresses a database that does not exist.`,
    );
  }
  resolved.set(dbName, found.uuid);
  return found.uuid;
}
