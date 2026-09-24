/**
 * No default: a submission with no intent must never become a write. A File is refused, not
 * coerced, since String(file) is "[object File]".
 * @param {{ get(name: string): unknown }} form
 * @returns {string | null} the intent, or null if the submission named none
 */
export function readIntent(form) {
  const raw = form.get("intent");
  if (typeof raw !== "string") return null;
  return raw.length > 0 ? raw : null;
}
