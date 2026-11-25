/** Finds every "MISSING: <why>" gap in a parsed procedure and refuses a bare MISSING. */

import { GAP } from "./gap.mjs";

/**
 * @param {Record<string, unknown>} item
 * @param {number} index
 */
function label(item, index) {
  for (const key of ["id", "name", "set", "citation", "for"]) {
    if (typeof item[key] === "string" && item[key]) return /** @type {string} */ (item[key]);
  }
  return String(index);
}

/** What an item in a list is called in words: its name, stage or set, else its id. @param {Record<string, unknown>} item */
function itemName(item) {
  for (const key of ["name", "stage", "set", "id", "citation", "for"]) {
    if (typeof item[key] === "string" && item[key]) return /** @type {string} */ (item[key]);
  }
  return null;
}

/**
 * Every recorded gap under `value`, by path, with `where`: the same place in words, below the top-level field, so the
 * admin can say "TES buffer: storage" for solutions[tes-buffer].storage (app/kb/gap-labels.mjs). An unnamed item is its
 * place in its list ("step 2"), left out when it is the list's only item.
 *
 * @param {unknown} value
 * @param {string} path
 * @param {Array<{ field: string, reason: string, where?: string[] }>} gaps
 * @param {string[]} errors
 * @param {string[]} [where]
 * @param {string} [key] the key the value sits under
 */
export function collectGaps(value, path, gaps, errors, where = [], key = "") {
  if (typeof value === "string") {
    const m = GAP.exec(value);
    if (m)
      gaps.push({
        field: path,
        reason: (m[1] ?? "").trim(),
        ...(where.length > 0 ? { where } : {}),
      });
    else if (/^MISSING\b/.test(value))
      errors.push(`${path} is "${value}": write MISSING: and the reason it is missing`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      const object =
        item && typeof item === "object" ? /** @type {Record<string, unknown>} */ (item) : null;
      const name = object ? itemName(object) : null;
      const words = name
        ? [...where, name]
        : value.length > 1
          ? [...where, `${key.replace(/s$/, "")} ${i + 1}`]
          : where;
      collectGaps(item, `${path}[${object ? label(object, i) : i}]`, gaps, errors, words, key);
    });
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      // A list or a group under a key is named by its items; a value is named by its key.
      const leaf = path && !(v && typeof v === "object");
      collectGaps(
        v,
        path ? `${path}.${k}` : k,
        gaps,
        errors,
        leaf ? [...where, k.replace(/_c$/, " (°C)").replaceAll("_", " ")] : where,
        k,
      );
    }
  }
}
