/**
 * How a script ADDRESSES the site database, which is not always its name: a remote operation takes
 * the account-side UUID, because the by-name spelling resolves through a config a clean checkout
 * bootstraps with a placeholder.
 *
 * BOUNDARY: `--local` keeps the NAME deliberately, Miniflare having no account-side UUID to
 * resolve, and a lookup that cannot produce one THROWS rather than falling back, which would be
 * hard rule 13's substituted value wearing a passing lookup.
 *
 * @see scripts/check-d1-address.mjs, which refuses the by-name spelling
 */

import { spawnSync } from "node:child_process";

/**
 * The default lookup, self-contained on purpose: threading the caller's runner through every call
 * site would be nine bespoke wirings of one fact, and two of them are inside a callback with no
 * runner in scope. `run` remains an argument, because two gates already have runners carrying
 * their own cwd and buffer settings.
 *
 * @param {string} command
 */
function defaultRun(command) {
  const r = spawnSync(`npx wrangler ${command}`, {
    encoding: "utf8",
    shell: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status, stdout: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/**
 * MEMOISED PER PROCESS, per database: one script addresses the database five times in a run, and
 * an account lookup per call site would be five round trips to answer one unchanging question. The
 * answer cannot change mid-run, a database not getting a new UUID while a script talks to it.
 *
 * @type {Map<string, string>}
 */
const resolved = new Map();

/**
 * The account-side UUID for a database, or the name when the target is local.
 *
 * @param {string} dbName the database name, as `wrangler.jsonc` spells it
 * @param {string} target `--remote` or `--local`
 * @param {(command: string) => { status: number | null, stdout: string }} [run]
 * @returns {string} a UUID for a remote target, the name for a local one
 */
export function resolveD1Address(dbName, target, run = defaultRun) {
  if (target !== "--remote") return dbName;
  const memo = resolved.get(dbName);
  if (memo) return memo;

  const listed = run("d1 list --json");
  /*
   * THE JSON STARTS AT THE FIRST `[`, not at byte zero: wrangler prints a banner and a header
   * before its JSON on a runner, and parsing the whole stream fails there and only there.
   */
  const start = listed.status === 0 ? listed.stdout.indexOf("[") : -1;
  /** @type {Array<{ uuid?: string, name?: string }>} */
  let databases = [];
  if (start !== -1) {
    try {
      databases = JSON.parse(listed.stdout.slice(start));
    } catch {
      databases = [];
    }
  }

  const found = databases.find((d) => d.name === dbName);
  if (typeof found?.uuid !== "string" || found.uuid.length === 0) {
    throw new Error(
      `could not resolve ${dbName} to a UUID from d1 list` +
        `${listed.status === 0 ? "" : ` (d1 list exited ${listed.status})`}. ` +
        `Passing the NAME lets wrangler resolve it out of wrangler.jsonc, which a ` +
        `clean checkout bootstraps from the example with a placeholder id, so a ` +
        `--remote run addresses a database that does not exist.`,
    );
  }
  resolved.set(dbName, found.uuid);
  return found.uuid;
}
