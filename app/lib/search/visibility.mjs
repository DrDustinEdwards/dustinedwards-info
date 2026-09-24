// Ask has no per-item status, so it must filter at UPLOAD time and composes this rather than restating
// the rule. The FTS build includes drafts on purpose; classic search filters at query time.

/** One spelling: a typo in a status literal fails OPEN on a filter. */
export const PUBLISHED_STATUS = "published";

/**
 * @param {boolean | undefined} draft
 * @returns {string}
 */
export function statusForDraft(draft) {
  return draft === true ? "draft" : PUBLISHED_STATUS;
}

/**
 * A missing publishAt means publish immediately, not never. An unparseable one is NOT visible: fail
 * closed, since the other way a draft answers a public question on Ask.
 *
 * @param {{ status?: string, publishAt?: string | Date | number | null }} post
 * @param {number} nowMs
 * @returns {boolean}
 */
export function isPubliclyVisible(post, nowMs = Date.now()) {
  if (post.status !== PUBLISHED_STATUS) return false;

  const at = post.publishAt;
  if (at === null || at === undefined || at === "") return true;

  const when = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
  if (Number.isNaN(when)) return false;

  return when <= nowMs;
}
