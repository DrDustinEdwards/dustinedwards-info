// No record carries a notice today; the path is built cold so a correction needs only a data change,
// and a test drives it with a real retracted DOI. The paper carries updated-by (the notice carries
// update-to), so the DOI here is the notice's.

export const UPDATE_TYPES = /** @type {const} */ ([
  "retraction",
  "correction",
  "expression-of-concern",
]);

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
 * A reason, not a boolean, so the gate can say which part of a notice is malformed.
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
  // Shape only: checking existence would put a network call in a gate.
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
 * Links to the notice's own DOI, the only honest citation for it. The deposited date is in the sentence
 * so an undated retraction is not read as recent.
 *
 * @param {UpdateNotice} notice
 * @returns {{ label: string, sentence: string, url: string }}
 */
export function updateNoticeText(notice) {
  const problem = updateNoticeProblem(notice);
  if (problem) {
    // Every caller passed the gate, so data changed under a green build; a 500 beats a half-rendered notice.
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
