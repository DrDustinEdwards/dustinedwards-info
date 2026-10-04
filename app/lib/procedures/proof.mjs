// Proof of use (docs/PROCEDURES.md): the papers that used a protocol's method and the phages it produced, as the
// procedure's file states them. Stored and never inferred: a protocol with no `proof_of_use` shows nothing. The file
// holds slugs only (a paper's publication slug, a phage's key); the words and addresses are read from the publication and
// phage rows when the page is drawn, so a corrected title reaches every protocol that cites the paper.

/** A publication slug and a phage key, as the files that hold them spell them. */
export const PAPER_SLUG = /^[0-9a-z][0-9a-z-]*$/;
export const PHAGE_KEY = /^[a-z][a-z0-9]*$/;

/**
 * The errors in a `proof_of_use` value, or none.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function proofErrors(value) {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["proof_of_use must be a mapping with `papers` (publication slugs) and/or `phages` (phage keys)"];
  }
  const errors = [];
  const record = /** @type {Record<string, unknown>} */ (value);
  for (const key of Object.keys(record)) {
    if (key !== "papers" && key !== "phages") errors.push(`proof_of_use has no field "${key}"; it has papers and phages`);
  }
  for (const [key, pattern] of /** @type {const} */ ([["papers", PAPER_SLUG], ["phages", PHAGE_KEY]])) {
    const list = record[key];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.length === 0) errors.push(`proof_of_use.${key} must be a non-empty list`);
    else {
      for (const item of list) {
        if (typeof item !== "string" || !pattern.test(item)) errors.push(`proof_of_use.${key} has ${JSON.stringify(item)}, which is not a ${key === "papers" ? "publication slug" : "phage key (lower case letters and digits)"}`);
      }
      if (new Set(list).size !== list.length) errors.push(`proof_of_use.${key} names one entry twice`);
    }
  }
  if (record.papers === undefined && record.phages === undefined) errors.push("proof_of_use is empty: leave it out until there is something to state");
  return errors;
}

/**
 * The stored proof as the record carries it: slugs only, or null.
 *
 * @param {unknown} value
 * @returns {{ papers: string[], phages: string[] } | null}
 */
export function proofFromFile(value) {
  if (!value || typeof value !== "object") return null;
  const record = /** @type {{ papers?: string[], phages?: string[] }} */ (value);
  const papers = record.papers ?? [];
  const phages = record.phages ?? [];
  return papers.length + phages.length > 0 ? { papers, phages } : null;
}

/**
 * The proof with its words and addresses, from the rows the page reads. A slug the rows do not hold is kept as its
 * slug, unlinked, so a stale reference is visible on the page instead of dropped; check:protocols refuses it before it
 * ships.
 *
 * @param {{ papers: string[], phages: string[] } | null} proof
 * @param {{ papers: ReadonlyMap<string, { title: string, year: number }>, phages: ReadonlyMap<string, string> }} rows
 */
export function resolveProof(proof, rows) {
  if (!proof) return null;
  return {
    papers: proof.papers.map((slug) => {
      const paper = rows.papers.get(slug);
      return { slug, title: paper?.title ?? slug, year: paper?.year ?? null, href: paper ? `/research/publications/${slug}/` : null };
    }),
    phages: proof.phages.map((key) => {
      const name = rows.phages.get(key);
      return { key, name: name ?? key, href: name ? `/research/phages#${key}` : null };
    }),
  };
}

/**
 * The twin's section, with absolute links.
 *
 * @param {ReturnType<typeof resolveProof>} proof
 * @param {string} origin
 */
export function proofMarkdown(proof, origin) {
  if (!proof) return "";
  const link = (/** @type {string} */ text, /** @type {string | null} */ href) => (href ? `[${text}](${origin}${href})` : text);
  return [
    "## Proof of use",
    ...(proof.papers.length > 0
      ? ["", "Papers that used this method:", "", ...proof.papers.map((p) => `- ${link(p.title, p.href)}${p.year ? ` (${p.year})` : ""}`)]
      : []),
    ...(proof.phages.length > 0
      ? ["", "Phages it produced:", "", ...proof.phages.map((p) => `- ${link(p.name, p.href)}`)]
      : []),
  ].join("\n");
}
