/**
 * /health's checks as the readers that act on them want them: ship's readiness, operator-sync's Ask re-read and
 * the colophon's snapshot. /health (site-runtime's healthResponse) gives each check a status, and a drift check
 * that fails carries "present of expected" as its detail; this turns that into `ok` and the two counts, so every
 * reader judges the same rows the same way. Which failing check maps to which repair is Capsid's ops_sites.operator
 * row for this site, read by its watcher (capsid src/site-watch.ts), not a table here.
 *
 * @typedef {{ name: string, status: "pass" | "warn" | "fail", ok: boolean, expected?: number, present?: number, waitedMs?: number }} HealthRow
 */

const COUNTS = /^(\d+) of (\d+)$/;

/**
 * Fails closed: a body that is not a /health answer has no rows, and a row with no status is not a pass.
 *
 * @param {unknown} body the parsed /health body
 * @returns {HealthRow[]}
 */
export function healthChecks(body) {
  const checks = /** @type {any} */ (body)?.checks;
  if (!Array.isArray(checks)) return [];
  return checks
    .filter((c) => c && typeof c === "object" && typeof c.name === "string")
    .map((c) => {
      const status = c.status === "pass" || c.status === "warn" || c.status === "fail" ? c.status : "fail";
      const counts = status !== "pass" && typeof c.detail === "string" ? COUNTS.exec(c.detail) : null;
      return {
        name: c.name,
        status,
        ok: status === "pass",
        ...(counts ? { present: Number(counts[1]), expected: Number(counts[2]) } : {}),
      };
    });
}
