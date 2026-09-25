// Secrets: returns one value by name, never the file or a map, and never logs a value.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const DEV_VARS_PATH = join(root, ".dev.vars");

/**
 * @param {string} name
 * @returns {string | null} its value, or null when the file or the key is absent
 */
export function readDevVar(name) {
  if (!existsSync(DEV_VARS_PATH)) return null;

  // Anchored to line start: unanchored, a longer name ending in this one would return the wrong credential.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = readFileSync(DEV_VARS_PATH, "utf8").match(
    new RegExp(`^[ \\t]*${escaped}[ \\t]*=[ \\t]*(.*)$`, "m"),
  );
  if (!match) return null;

  // A `#` inside quotes is part of the value, so trailing comments are stripped only when unquoted.
  let value = match[1].trim();
  const quoted = /^(["'])(.*)\1$/.exec(value);
  if (quoted) return quoted[2];
  value = value.replace(/\s+#.*$/, "").trim();
  return value.length > 0 ? value : null;
}
