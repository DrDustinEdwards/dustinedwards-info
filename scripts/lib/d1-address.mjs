/**
 * How a script ADDRESSES the site database, which is not always its name.
 *
 * ## THE DEFECT, measured in CI on 2026-09-08
 *
 * `wrangler d1 <cmd> <name>` resolves the name through the `d1_databases` entry
 * in `wrangler.jsonc` and uses THAT ENTRY'S `database_id`. `wrangler.jsonc` is
 * gitignored, so a clean checkout bootstraps it from `wrangler.jsonc.example`,
 * whose `database_id` is the placeholder `00000000-0000-0000-0000-000000000000`.
 * A `--remote` run there addresses a database that does not exist and dies as
 * 7404 (`check:restore`, run 34301357787).
 *
 * It fails ON A RUNNER AND ONLY THERE, which is the worst shape a defect can
 * have: every local run resolves correctly because the real config is present,
 * so the surface looks fine until CI touches it. `check:backup` carried the
 * identical defect and had simply never run in CI, so it was latent rather than
 * absent, and the queued item that produced this module asked for a gate before
 * a third victim was found by a red run.
 *
 * ## `--local` KEEPS THE NAME, AND THAT IS NOT AN EXCEPTION TO THE RULE
 *
 * Miniflare keys its state by the config's `database_id`, and there is no
 * account-side UUID to resolve. Asking the account for one would be answering a
 * question about a different database. So the rule is not "never use the name",
 * it is "never let wrangler resolve the name for a REMOTE operation".
 *
 * ## FAILS CLOSED
 *
 * A lookup that cannot produce a UUID throws. Falling back to the name would
 * substitute a different value for the one asked for, which is hard rule 13's
 * shape, and would reintroduce the 7404 wearing a passing lookup.
 *
 * @see scripts/check-d1-address.mjs, which refuses the by-name spelling
 */

import { spawnSync } from "node:child_process";

/**
 * The default lookup. Self-contained on purpose.
 *
 * The first draft took the caller's own wrangler runner, on the grounds that
 * every script has one. Nine call sites across five scripts and four different
 * runner shapes said otherwise: threading a runner through each would be nine
 * bespoke wirings of one fact, and two of the call sites are inside a
 * `retryRead` callback where there is no runner in scope at all.
 *
 * `run` remains an accepted argument, because `check:backup` and
 * `check:restore` already have runners that carry their own cwd and buffer
 * settings, and taking theirs is cheaper than proving this one matches.
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
 * MEMOISED PER PROCESS, per database.
 *
 * `sync-content.mjs` addresses the database five times in one run and
 * `check:media` twice. An account lookup per call site would be five network
 * round trips to answer one unchanging question, on the script that runs at
 * the end of every ship. The answer cannot change mid-run: a database does not
 * get a new UUID while a script is talking to it.
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
   * THE JSON STARTS AT THE FIRST `[`, not at byte zero. Wrangler prints an
   * update banner and a colour-coded header before its JSON on a runner, and
   * `JSON.parse` on the whole stream fails there and only there. Slicing from
   * the bracket is what the two existing copies of this already did.
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
