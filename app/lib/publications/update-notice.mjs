/**
 * A retraction, correction or expression of concern against a paper.
 *
 * ## NOTHING IN THIS CORPUS CARRIES ONE, AND THAT IS WHY THIS EXISTS
 *
 * Ruling 63 asked for Crossref retraction status, and the pipeline went looking
 * for it. What came back, measured across all 34 Crossref DOIs on 2026-09-12:
 * no `update-to` and no `updated-by` on any record, no `relation` data of any
 * kind, and nothing retracted or corrected. So this is a path with no data
 * flowing through it today.
 *
 * A dark path is worth building anyway, and it is worth building NOW rather
 * than on the day it is needed. The day it is needed is the day a paper is
 * corrected, which is the worst possible day to be writing and reviewing the
 * code that says so: the site would be serving an abstract, a PDF and a
 * citation export for a paper the record says is wrong, and the repair would be
 * a rushed one. Building it cold means the only thing that day needs is a data
 * change.
 *
 * A path nothing exercises is a path that does not work, so `check:machine-readable`
 * asserts that no record carries a notice today, PAIRED with the count of
 * records it read, and `test/publication-update-notice.test.mjs` drives this
 * module with a real retracted DOI. The replay rule: the fixture is the proof, and
 * the fixture is deliberately not one of ours.
 *
 * ## THE FIELD CROSSREF ACTUALLY CARRIES IS `updated-by`
 *
 * Not `update-to`, which is the one a reader guesses at and which names the
 * relationship in the other direction: a retraction NOTICE carries `update-to`
 * pointing at the paper it retracts, and the PAPER carries `updated-by`
 * pointing at the notice. This site holds papers, so `updated-by` is the field,
 * and the DOI in a notice here is the notice's DOI rather than the paper's.
 *
 * ## THE VERSION CHAIN IS THE PREPRINT LINK, AND THAT IS THE WHOLE CHAIN
 *
 * Ruling 63 also asked for a version chain from Crossref relations. There are
 * none: the same sweep found zero `relation` entries across the corpus. What
 * exists is one curated `preprintDoi`, on one record, which the page already
 * links. `check:machine-readable` asserts it is exactly one, so a second arriving
 * is a decision somebody makes rather than a silent change.
 */

/** The kinds Crossref's `update-type` uses that a reader needs told about. */
export const UPDATE_TYPES = /** @type {const} */ ([
  "retraction",
  "correction",
  "expression-of-concern",
]);

/** What each kind is called in the sentence a reader sees. */
const LABEL = {
  retraction: "Retracted",
  correction: "Corrected",
  "expression-of-concern": "Expression of concern",
};

/**
 * @typedef {object} UpdateNotice
 * @property {string} type one of UPDATE_TYPES
 * @property {string} doi the NOTICE's DOI, not the paper's
 * @property {string | null} [date] YYYY-MM-DD, as deposited
 */

/**
 * Whether a value is a usable notice, and why not when it is not.
 *
 * Returns a REASON rather than a boolean, because the caller that needs this
 * most is the gate, and "this record's notice is malformed" is only actionable
 * if it says which part. A notice with a bad DOI would render a link to
 * `https://doi.org/undefined` on the most serious sentence this site can print.
 *
 * @param {unknown} value
 * @returns {string | null} null when the notice is usable
 */
export function updateNoticeProblem(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return "not an object";
  const notice = /** @type {Record<string, unknown>} */ (value);
  if (!UPDATE_TYPES.includes(/** @type {any} */ (notice.type))) {
    return `type ${JSON.stringify(notice.type)} is not one of ${UPDATE_TYPES.join(", ")}`;
  }
  /*
   * The DOI is checked for SHAPE, not for existence. A gate cannot ask
   * doi.org whether a notice is real without a network call, and the shape is
   * what stops an empty string or a URL being rendered as a bare DOI.
   */
  if (typeof notice.doi !== "string" || !/^10\.\d{4,9}\/\S+$/.test(notice.doi)) {
    return `doi ${JSON.stringify(notice.doi)} is not a DOI name`;
  }
  if (
    notice.date !== null &&
    notice.date !== undefined &&
    !(typeof notice.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(notice.date))
  ) {
    return `date ${JSON.stringify(notice.date)} is not YYYY-MM-DD`;
  }
  return null;
}

/**
 * The sentence a reader sees, and the link that backs it.
 *
 * ## IT SAYS WHAT HAPPENED AND SENDS THE READER TO THE NOTICE
 *
 * Not to the publisher's landing page for the paper, and not to a search. A
 * retraction is a claim about a scientific record, and the only honest citation
 * for it is the notice itself, which has its own DOI and its own authors.
 *
 * ## THE DATE IS PART OF THE SENTENCE WHEN THERE IS ONE
 *
 * "Retracted" with no date invites the reader to assume it happened recently.
 * The deposited date is a fact the registry carries, and rule 17's exception
 * for dated evidence is exactly this shape: a claim about the past, carrying
 * when.
 *
 * @param {UpdateNotice} notice
 * @returns {{ label: string, sentence: string, url: string }}
 */
export function updateNoticeText(notice) {
  const problem = updateNoticeProblem(notice);
  if (problem) {
    // Throws rather than rendering something. Every caller has already been
    // through the gate, so reaching this means the data changed underneath a
    // green build, and a half-rendered retraction notice is worse than a 500.
    throw new Error(`unusable update notice: ${problem}`);
  }
  const label = LABEL[/** @type {keyof typeof LABEL} */ (notice.type)];
  const when = notice.date ? ` on ${notice.date}` : "";
  return {
    label,
    sentence:
      notice.type === "expression-of-concern"
        ? `The publisher has issued an expression of concern about this paper${when}.`
        : `This paper was ${label.toLowerCase()}${when} by the publisher.`,
    url: `https://doi.org/${notice.doi}`,
  };
}
