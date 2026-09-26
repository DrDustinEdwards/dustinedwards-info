// How ship reads uptime-ensure. An absent key is the one outcome that is a skip rather than a miss,
// and it is recognised only by the exit code AND the line uptime-ensure prints for it, never by a
// failure that merely looks like one.

/** uptime-ensure's exit code when UPTIMEROBOT_API_KEY is not in .dev.vars, and for nothing else. */
export const KEY_ABSENT_EXIT = 3;

/** The line uptime-ensure prints with that exit code. */
export const KEY_ABSENT_LINE = "uptime-ensure: UPTIMEROBOT_API_KEY is absent; no monitor was read or written.";

/** What ship prints when the step is skipped: what was not done, and when it will be. */
export const UPTIME_SKIP_NOTE =
  "UPTIMEROBOT_API_KEY is not on this machine (no .dev.vars, as on a GitHub deploy run), so the " +
  "external uptime monitors were NOT touched and keep pointing where they pointed before this " +
  "deploy. They are reconciled at the domain move, by hand in UptimeRobot or by a local " +
  "`npm run ship` on a machine that holds the key";

/**
 * @typedef {{ state: "applied", changes: number }
 *   | { state: "skipped", note: string }
 *   | { state: "missed", miss: string }} UptimeOutcome
 */

/**
 * @param {number} code uptime-ensure's exit code
 * @param {string} text its captured stdout and stderr
 * @returns {UptimeOutcome}
 */
export function uptimeStepOutcome(code, text) {
  if (code === KEY_ABSENT_EXIT && text.includes(KEY_ABSENT_LINE)) {
    return { state: "skipped", note: UPTIME_SKIP_NOTE };
  }
  if (code !== 0) {
    return {
      state: "missed",
      miss:
        "uptime-ensure did not complete, so the external monitors may still point at the " +
        "previous hostname or may not exist. The deploy stands and is healthy; what is " +
        "unproven is whether anything outside Cloudflare is watching it",
    };
  }
  /* The change count is read, never inferred from exit 0. */
  const applied = text.match(/(\d+) change\(s\) applied/);
  if (!applied) {
    return {
      state: "missed",
      miss:
        "uptime-ensure exited 0 without reporting a change count, so nothing proves it " +
        "reconciled the monitors",
    };
  }
  return { state: "applied", changes: Number(applied[1]) };
}
