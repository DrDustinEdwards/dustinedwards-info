import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Whether the module at `url` is the script node was started with. Comparing argv[1] with
 * import.meta.url as strings misses when the two differ only in a junction, a symlink or the case
 * of a drive letter, and a writer whose guard misses exits 0 having written nothing.
 *
 * @param {string} url the caller's import.meta.url
 * @param {string | undefined} [entry] the started script, process.argv[1] by default
 * @returns {boolean}
 */
export function isMain(url, entry = process.argv[1]) {
  if (!entry) return false;
  const canonical = (/** @type {string} */ file) => {
    const real = realpathSync.native(file);
    return process.platform === "win32" ? real.toLowerCase() : real;
  };
  return canonical(entry) === canonical(fileURLToPath(url));
}
