/**
 * Reads ONE named value out of the gitignored `.dev.vars`.
 *
 * ## WHY THIS EXISTS AND WHY IT TAKES A NAME
 *
 * Two operator credentials are read by Node programs in `scripts/` rather than
 * by the Worker: the UptimeRobot key that `uptime-ensure` and `check:uptime`
 * use, and the Cloudflare token `check:config --remote` reads live cron
 * triggers with. Neither is a `wrangler secret`, because neither is read by
 * deployed code; both are machine-local operator credentials, which is exactly
 * what `.dev.vars` already is.
 *
 * **IT TAKES A NAME AND RETURNS ONE STRING. It never returns the file, never
 * returns a map, and never logs a value.** A loader that returned every key
 * would put credentials this caller has no business holding into its scope,
 * and the first time one of those got interpolated into an error message it
 * would be in a log. Portfolio rule: never read, display or log the contents
 * of an env file. Returning one requested value is the narrowest thing that
 * satisfies the callers.
 *
 * ## ABSENT IS A NAMED ANSWER, NOT AN EMPTY STRING
 *
 * Returns `null` when the file or the key is missing, and the CALLER decides
 * what that means. It matters that the two callers decide differently: a gate
 * fails closed and names the credential, while `uptime-ensure` refuses before
 * it touches the network. Returning `""` would let a caller send an empty
 * bearer token and read the API's 401 as a site problem.
 *
 * `.dev.vars` is dotenv-shaped: `NAME=value`, optionally quoted, `#` comments.
 * This parses the one line it was asked for rather than the whole file, so a
 * malformed line belonging to another key cannot break a caller that does not
 * read it.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The one path. Named once so two callers cannot come to disagree about it. */
export const DEV_VARS_PATH = join(root, ".dev.vars");

/**
 * @param {string} name the variable to read
 * @returns {string | null} its value, or null when the file or the key is absent
 */
export function readDevVar(name) {
  if (!existsSync(DEV_VARS_PATH)) return null;

  /*
   * ANCHORED TO THE LINE AND TO THE NAME. An unanchored needle would match
   * `MY_UPTIMEROBOT_API_KEY` and hand back the wrong credential, which is the
   * hard rule 10 anchoring discipline applied to a value rather than to a
   * count. `m` for multiline; the name is escaped because a caller could pass
   * anything.
   */
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = readFileSync(DEV_VARS_PATH, "utf8").match(
    new RegExp(`^[ \\t]*${escaped}[ \\t]*=[ \\t]*(.*)$`, "m"),
  );
  if (!match) return null;

  // Strip a trailing comment only when the value is unquoted, then one matching
  // pair of quotes, then whitespace. A `#` inside quotes is part of the value.
  let value = match[1].trim();
  const quoted = /^(["'])(.*)\1$/.exec(value);
  if (quoted) return quoted[2];
  value = value.replace(/\s+#.*$/, "").trim();
  return value.length > 0 ? value : null;
}
