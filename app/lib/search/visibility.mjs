/**
 * THE ONE JAVASCRIPT OWNER OF "is this post publicly visible".
 *
 * ## Why this exists, and what it cost not to have it
 *
 * The rule lives in three places, by necessity in two of them:
 *
 *   Drizzle  `publiclyVisible()`   app/db/index.ts
 *   SQL      `visibilityClause()`  app/lib/search/search.server.ts
 *   Ask      the upload filter     app/lib/search/ask.server.ts
 *
 * The first two are two LANGUAGES expressing one rule, and they cannot share an
 * implementation: one builds a Drizzle expression tree, the other a SQL string.
 * `check:invariants` binds them to each other, which is the right instrument for
 * a pair that must agree but cannot be one function.
 *
 * **The Ask filter was a third, hand-rolled copy, and it was held only by a
 * grep.** That is the exact class that leaked: on 2026-07-29 five unpublished
 * drafts staged through the operator path were uploaded to Ask unconditionally,
 * and the public endpoint answered from one and cited it by slug. The classic
 * index was never affected because it filters at QUERY time; Ask has no
 * per-item status to filter on, so the filter has to happen at UPLOAD time, and
 * anything unpublished that gets in is public until someone notices.
 *
 * So Ask now composes this module instead of restating the rule. A change to
 * what "publicly visible" means cannot miss Ask any more, because Ask does not
 * have its own answer to change.
 *
 * ## WHAT THIS DELIBERATELY DOES NOT TOUCH
 *
 * **The FTS build.** `search_docs` includes drafts on purpose and the two FTS
 * indexes are built from all of it; `check:invariants` section 8 carries that as
 * a NAMED exemption with its reason. Filtering there would manufacture drift
 * between the content table and its own shadows on every rebuild. Visibility on
 * the classic search path is applied at query time by `visibilityClause`, which
 * is why that path never leaked.
 *
 * @see app/db/index.ts publiclyVisible
 * @see app/lib/search/search.server.ts visibilityClause
 * @see test/visibility.test.mjs
 */

/**
 * The one spelling of the published state.
 *
 * A literal `"published"` in three files is three chances to typo a string that
 * fails OPEN: `status = 'publshed'` matches nothing, which reads as "no posts
 * are visible" on a read path and as "nothing is excluded" on a filter.
 */
export const PUBLISHED_STATUS = "published";

/**
 * The status a post with this `draft` flag carries in the database.
 *
 * The editor writes `record.draft ? "draft" : "published"`, so the artifact's
 * boolean and the row's string are the SAME FACT in two shapes. This is the
 * mapping, stated once, so the Ask filter can ask the shared predicate rather
 * than reimplementing the rule against the other shape.
 *
 * @param {boolean | undefined} draft
 * @returns {string}
 */
export function statusForDraft(draft) {
  return draft === true ? "draft" : PUBLISHED_STATUS;
}

/**
 * Is a post with these facts visible to the public right now?
 *
 * TWO FACTS, and both are required, which is the whole rule:
 *
 *   1. its status is published, and
 *   2. it has no publish date, or that date has passed.
 *
 * `publishAt` absent or null means "publish immediately", not "never": the
 * Drizzle form is `isNull(publishAt) OR publishAt <= now`, and reading a missing
 * date as a reason to EXCLUDE would hide every post that never set one.
 *
 * An unparseable date is treated as NOT YET VISIBLE. That is the fail-closed
 * direction: a date this cannot read is a date this cannot prove has passed,
 * and on the Ask upload path the cost of being wrong the other way is a draft
 * answering a public question.
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
