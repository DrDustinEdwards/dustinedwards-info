// Ask has no per-item status, so it must filter at UPLOAD time and composes this rather than restating
// the rule. The FTS build includes drafts on purpose; classic search filters at query time.

import { PUBLISHED_STATUS } from "@drdustinedwards/site-helpers/search";

/**
 * @param {boolean | undefined} draft
 * @returns {string}
 */
export function statusForDraft(draft) {
  return draft === true ? "draft" : PUBLISHED_STATUS;
}
