// The grading half of check:web-vitals, kept pure so a unit test can pin it without a browser.
//
// THRESHOLDS are Google's "good" Core Web Vitals boundaries for LCP and CLS. INP cannot be
// measured in a lab, because it needs a real person's input; Total Blocking Time is Lighthouse's
// lab proxy for it, and 200ms is Lighthouse's own mobile TBT "good" boundary. The proxy is named
// as a proxy everywhere it is printed, so a TBT number is never read as an INP number.

/** @typedef {"ok" | "WARN" | "FAIL"} Grade */

/**
 * @typedef {object} Metric
 * @property {"lcp" | "cls" | "tbt"} key
 * @property {string} label
 * @property {number} threshold  Over this is WARN; over twice this is FAIL.
 * @property {(value: number) => string} format
 */

/** @type {readonly Metric[]} */
export const METRICS = Object.freeze([
  { key: "lcp", label: "LCP", threshold: 2500, format: (v) => `${(v / 1000).toFixed(2)}s` },
  { key: "cls", label: "CLS", threshold: 0.1, format: (v) => v.toFixed(3) },
  {
    key: "tbt",
    label: "TBT (lab proxy for INP)",
    threshold: 200,
    format: (v) => `${Math.round(v)}ms`,
  },
]);

/**
 * WARN strictly over the threshold, FAIL strictly over twice it. Exactly at a boundary is the
 * lower grade, matching the job's wording ("over 2.5s", "more than twice the threshold").
 *
 * @param {number} value
 * @param {number} threshold
 * @returns {Grade}
 */
export function grade(value, threshold) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`cannot grade ${value}: a metric must be a finite, non-negative number`);
  }
  if (value > threshold * 2) return "FAIL";
  if (value > threshold) return "WARN";
  return "ok";
}

/**
 * Median of the runs. An even count averages the middle two. An empty list throws: a page with
 * no measurement has no median, and reporting one would be reporting an unmeasured page.
 *
 * @param {number[]} values
 */
export function median(values) {
  if (values.length === 0) throw new Error("median of no runs");
  for (const v of values) {
    if (!Number.isFinite(v)) throw new Error(`median over a non-finite run value: ${v}`);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @param {Array<Record<"lcp" | "cls" | "tbt", number>>} runs
 * @returns {Array<{ metric: Metric, value: number, grade: Grade }>}
 */
export function gradeRuns(runs) {
  return METRICS.map((metric) => {
    const value = median(runs.map((run) => run[metric.key]));
    return { metric, value, grade: grade(value, metric.threshold) };
  });
}

/**
 * 0 when nothing FAILs, 1 on any FAIL, 2 when any page could not be measured. Unmeasured wins
 * over FAIL: a run that could not see a page must never read as a verdict about it.
 *
 * @param {Array<{ grades?: Array<{ grade: Grade }>, error?: unknown }>} pages
 */
export function exitCode(pages) {
  if (pages.some((page) => page.error !== undefined || !page.grades)) return 2;
  if (pages.some((page) => page.grades?.some((g) => g.grade === "FAIL"))) return 1;
  return 0;
}

/**
 * The first article link on /writing's HTML: a single path segment under /writing/, so tag,
 * feed and page links (which have a second segment or a known name) are never taken.
 *
 * @param {string} html
 * @returns {string | null}
 */
export function firstArticlePath(html) {
  const NOT_ARTICLES = new Set(["tags", "feed", "page", "rss.xml", "feed.xml", "atom.xml"]);
  for (const match of html.matchAll(/href="(\/writing\/([a-z0-9][a-z0-9-]*))\/?"/g)) {
    if (!NOT_ARTICLES.has(match[2])) return match[1];
  }
  return null;
}
