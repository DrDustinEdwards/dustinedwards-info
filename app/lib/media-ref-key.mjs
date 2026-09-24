/**
 * NUL cannot occur in any part, so the join is unambiguous; a printable `|`
 * would collide ("a|b","c" vs "a","b|c") and silently drop a ref. Keep it an
 * escape: a literal NUL makes the file binary to git and invisible in editors.
 *
 * @param {{ mediaKey: string, form: string, detail: string | null }} ref
 * @returns {string}
 */
export function mediaRefKey(ref) {
  return `${ref.mediaKey}\u0000${ref.form}\u0000${ref.detail ?? ""}`;
}
