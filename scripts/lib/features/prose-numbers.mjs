// The one-owner rule over prose: a sentence in the feature list or the projects roster carries no
// number a gate does not own.

/**
 * Letter-digit tokens (D1, FTS5) are names, removed before the digit scan.
 *
 * @param {string} text
 */
const withoutIdentifiers = (text) =>
  text
    .replace(/\b[A-Za-z]+[0-9][A-Za-z0-9]*\b/g, " ")
    .replace(/\b[0-9]+[A-Za-z][A-Za-z0-9]*\b/g, " ");

/** @param {import("./shared.mjs").FeaturesContext} ctx */
export function checkFeatureProse({ ok, features }) {
  console.log("\n  the one-owner rule: the prose carries no number a gate does not own");

  /** Bare digits prose may carry: protocol constants only, which cannot go stale. */
  const PROTOCOL_CONSTANTS = new Map([
    ["403", "HTTP status: the first-publish refusal names it"],
    ["404", "HTTP status: the URL transform interface answers with it"],
    ["429", "HTTP status: the Ask refusal names it"],
    ["1042", "Cloudflare error code returned alongside that 404"],
  ]);

  const PROSE_FIELDS = ["component", "name", "what"];


  const REMOVED_VOCABULARY = [
    "committed artifact",
    "byte-comparison gate",
    "byte-compared",
    "regenerated artifact",
    "single commit carrying both",
  ];

  let sentencesScanned = 0;
  /** @type {string[]} */
  const numbered = [];
  /** @type {string[]} */
  const removedWords = [];

  for (const feature of features) {
    const label = `${feature.component} / ${feature.name}`;
    for (const field of PROSE_FIELDS) {
      const text = String(feature[field] ?? "");
      if (!text) continue;
      sentencesScanned += 1;

      for (const run of withoutIdentifiers(text).match(/[0-9]+/g) ?? []) {
        if (PROTOCOL_CONSTANTS.has(run)) continue;
        numbered.push(`${label} (${field}): "${run}"`);
      }

      const lower = text.toLowerCase();
      for (const phrase of REMOVED_VOCABULARY) {
        if (lower.includes(phrase)) {
          removedWords.push(`${label} (${field}): "${phrase}"`);
        }
      }
    }
  }

  /* Floored under the measured field count. */
  ok(
    "the prose scan had fields to read",
    sentencesScanned >= 90,
    `scanned ${sentencesScanned} field(s), floor 90, measured 114 on 2026-08-28. ` +
      `A zero-scope scan reports a clean sweep of nothing.`,
  );

  /* Proves the predicate can fire, since the real data may be clean. */
  ok(
    "the digit scan can fire: a bare measurement survives the stripper",
    (withoutIdentifiers("rendered 200 times").match(/[0-9]+/g) ?? []).length === 1,
    "the identifier stripper is eating bare numbers, so nothing can ever fail here",
  );
  ok(
    "the digit scan does not fire on an identifier",
    (withoutIdentifiers("D1 and R2 and FTS5").match(/[0-9]+/g) ?? []).length === 0,
    "a product name is being read as a measurement, which makes the rule unusable",
  );

  ok(
    "no feature sentence carries a number the gate does not own",
    numbered.length === 0,
    `${numbered.join("; ")}. The one-owner rule: a measured value lives in the gate that ` +
      `measures it, or nowhere. Point at the gate instead of restating its value.`,
  );

  ok(
    "no feature sentence uses the vocabulary of the removed content machinery",
    removedWords.length === 0,
    `${removedWords.join("; ")}. That machinery left git on 2026-08-26. Git holds ` +
      `markdown only, D1 holds the only rendered copy, and a save commits one file.`,
  );
}

/**
 * @param {import("./shared.mjs").FeaturesContext["ok"]} ok
 * @param {any[]} projects
 */
export function checkRosterProse(ok, projects) {
  const PROJECT_PROSE_FIELDS = ["oneLiner", "description"];
  let projectFieldsScanned = 0;
  /** @type {string[]} */
  const projectNumbers = [];

  for (const project of projects) {
    const id = project.slug ?? "(no slug)";
    const texts = [
      ...PROJECT_PROSE_FIELDS.map((field) => [field, String(project[field] ?? "")]),
      ...(project.notable ?? []).map((/** @type {string} */ point, /** @type {number} */ i) => [
        `notable[${i}]`,
        String(point),
      ]),
    ];
    for (const [field, text] of texts) {
      if (!text) continue;
      projectFieldsScanned += 1;
      for (const run of withoutIdentifiers(text).match(/[0-9]+/g) ?? []) {
        projectNumbers.push(`${id} (${field}): "${run}"`);
      }
    }
  }

  /* Floored under measured; notable sentences move the count. */
  ok(
    "the roster prose scan had fields to read",
    projectFieldsScanned >= 14,
    `scanned ${projectFieldsScanned} field(s), floor 14, measured 23 on 2026-08-30. ` +
      `Two per project is the floor even with every notable list removed; below ` +
      `that the roster itself did not parse and this reports a clean sweep of nothing.`,
  );
  ok(
    "no roster sentence carries a number outside the metric channel",
    projectNumbers.length === 0,
    `${projectNumbers.join("; ")}. The one-owner rule: this page has exactly one place ` +
      `for a number, the metric, and it carries a date or a derivation beside it.`,
  );
}
