import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every file under `dir`, depth first in directory order, as absolute paths. The order is the
 * directory's own, not sorted: callers that print or compare a list sort it themselves.
 *
 * @param {string} dir
 * @param {{ keep?: (name: string) => boolean, skipDir?: (name: string) => boolean }} [options]
 *   `keep` is asked of each file name, `skipDir` of each directory name before it is entered
 * @returns {string[]}
 */
export function walkFiles(dir, options = {}) {
  const { keep = () => true, skipDir = () => false } = options;
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDir(entry.name)) out.push(...walkFiles(full, options));
    } else if (keep(entry.name)) {
      out.push(full);
    }
  }
  return out;
}
