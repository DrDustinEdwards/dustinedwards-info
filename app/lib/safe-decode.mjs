/** decodeURIComponent that keeps a malformed escape as written instead of throwing. */
export function safeDecode(/** @type {string} */ value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
