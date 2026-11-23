/** A recorded gap: the marker and the reason, never the marker alone. */
export const GAP = /^MISSING:\s*(\S.*)$/s;

/** @param {unknown} value @returns {value is string} */
export function isGap(value) {
  return typeof value === "string" && GAP.test(value);
}

/** An id within a registry kind: lower-case letters, digits and hyphens, so it is a file name and a URL segment as written; a protocol names an item by it. */
export const REGISTRY_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;
