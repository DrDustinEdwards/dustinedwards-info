/**
 * @param {string | null | undefined} text
 * @returns {{ passed: number, total: number } | null}
 */
export function freshHealthRatio(text) {
  const match = typeof text === "string" ? /^(\d+)\/(\d+) passing$/.exec(text) : null;
  if (!match) return null;
  const passed = Number(match[1]);
  const total = Number(match[2]);
  return total > 0 && passed <= total ? { passed, total } : null;
}

export const HEALTH_FACT_SELECTOR = "#main > .evidence [data-health-age]";
