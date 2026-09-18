/**
 * Reads ONE named value out of the gitignored `.dev.vars`.
 *
 * BOUNDARY: **IT TAKES A NAME AND RETURNS ONE STRING. It never returns the file, never returns a
 * map, and never logs a value.** Absent is a named answer rather than an empty string: it returns
 * null and the CALLER decides what that means, and the two callers decide differently.
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
   * ANCHORED TO THE LINE AND TO THE NAME: an unanchored needle would match a longer variable whose
   * name ends with this one and hand back the wrong credential, which is hard rule 10's anchoring
   * discipline applied to a value rather than to a count. The name is escaped, a caller being able
   * to pass anything.
   */
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = readFileSync(DEV_VARS_PATH, "utf8").match(
    new RegExp(`^[ \\t]*${escaped}[ \\t]*=[ \\t]*(.*)$`, "m"),
  );
  if (!match) return null;

  // Strip a trailing comment only when the value is unquoted, then one matching pair of quotes, then
  // whitespace. A `#` inside quotes is part of the value.
  let value = match[1].trim();
  const quoted = /^(["'])(.*)\1$/.exec(value);
  if (quoted) return quoted[2];
  value = value.replace(/\s+#.*$/, "").trim();
  return value.length > 0 ? value : null;
}
