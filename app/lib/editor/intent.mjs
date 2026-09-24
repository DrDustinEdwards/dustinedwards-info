/**
 * Reading the `intent` field off an editor form submission.
 *
 * ## THERE IS NO DEFAULT, AND THAT IS THE POINT
 *
 * This used to be `String(form.get("intent") ?? "save")` inline in the action,
 * so a POST carrying no intent PERFORMED A WRITE: a commit to GitHub and a D1
 * sync, from a request that never said what it wanted. The no-substitution rule, on the
 * worst surface for it, because the substituted value was an ACTION rather than
 * a label. A missing label renders the wrong word; a missing action writes.
 *
 * Returning `null` rather than throwing keeps the decision at the call site,
 * where the editor can answer with a problem result that preserves the body the
 * author typed. A throw there would discard it.
 *
 * `form.get()` returns `File | string | null`. A non-string is refused rather
 * than coerced: `String(file)` yields "[object File]", which is not an intent
 * and would fall through to whatever the action does with an unknown one.
 *
 * @param {{ get(name: string): unknown }} form
 * @returns {string | null} the intent, or null if the submission named none
 */
export function readIntent(form) {
  const raw = form.get("intent");
  if (typeof raw !== "string") return null;
  return raw.length > 0 ? raw : null;
}
