/**
 * What the home page's health fact says when its snapshot is fresh, as `check:browser` reads it.
 *
 * The fact is the evidence row's link text, `{passed}/{total} passing` (app/routes/home.tsx). The
 * case expected a bare `2/5` for as long as the word has been there, so it could never pass on any
 * build (found by job_b001eb9809fb). Kept here rather than inline so a test can prove it red on the
 * shapes it must refuse and green on the one it must accept.
 */

/**
 * The ratio a fresh verdict renders, or null for anything else: the `--` of the stale and missing
 * states, a bare ratio, or a count that claims more passing than exist.
 *
 * @param {string | null | undefined} text the health fact's trimmed text
 * @returns {{ passed: number, total: number } | null}
 */
export function freshHealthRatio(text) {
  const match = typeof text === "string" ? /^(\d+)\/(\d+) passing$/.exec(text) : null;
  if (!match) return null;
  const passed = Number(match[1]);
  const total = Number(match[2]);
  return total > 0 && passed <= total ? { passed, total } : null;
}

/**
 * Where the fact renders now: in the evidence row at the foot of the home page's main column, a
 * direct child of `#main`, no longer in the hero.
 */
export const HEALTH_FACT_SELECTOR = "#main > .evidence [data-health-age]";
