/**
 * Aggregate citation statistics, computed from per-paper counts.
 *
 * Derived, never stored. Nothing on the site consumes these yet, and the
 * publications page deliberately renders no site-wide total: Google Scholar
 * reports 339 and OpenAlex reports 257, both are true, and publishing a
 * competing total would need a footnote to be honest.
 *
 * Scholar clusters versions of a work and indexes citing sources that DOI
 * based indexes do not (theses, slides, non-indexed venues), so it should
 * always read higher. If an OpenAlex derived total ever exceeds it, something
 * is double counting, most likely a preprint merged into its published record.
 */

/** Google Scholar's reported total, the upper bound this data must stay under. */
export const SCHOLAR_REPORTED_TOTAL = 339;

export function totalCitations(counts: number[]): number {
  return counts.reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
}

/** Largest h such that h papers have at least h citations each. */
export function hIndex(counts: number[]): number {
  const sorted = [...counts].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

export type CitationStats = {
  total: number;
  hIndex: number;
  papersWithCounts: number;
};

/**
 * Throws when the total exceeds Scholar's figure, which would mean the same
 * citations are being counted twice rather than that the record grew.
 */
export function citationStats(counts: number[]): CitationStats {
  const total = totalCitations(counts);
  if (total > SCHOLAR_REPORTED_TOTAL) {
    throw new Error(
      `Computed citation total ${total} exceeds the Scholar figure of ` +
        `${SCHOLAR_REPORTED_TOTAL}. Scholar indexes strictly more sources, so ` +
        `this indicates double counting rather than growth.`,
    );
  }
  return {
    total,
    hIndex: hIndex(counts),
    papersWithCounts: counts.filter((n) => n > 0).length,
  };
}
