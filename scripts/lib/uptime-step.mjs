// How ship reads uptime-ensure. A ship on a GitHub runner, which holds no UptimeRobot key by
// design, is the one outcome that is a skip rather than a miss. It is recognised only by the exit
// code AND the line uptime-ensure prints for it, never by a failure that merely looks like one. A
// missing key on any other machine is a lost credential, and stays a miss.

/** uptime-ensure's exit code for a keyless GitHub-runner run, and for nothing else. */
export const KEY_ABSENT_EXIT = 3;

/** The line uptime-ensure prints with that exit code. */
export const KEY_ABSENT_LINE =
  "uptime-ensure: GitHub runner without UPTIMEROBOT_API_KEY; no monitor was read or written.";

/** What ship prints when the step is skipped: the real cause, what was not done, and when it will be. */
export const UPTIME_SKIP_NOTE =
  "this ship ran on a GitHub runner, which holds no UptimeRobot key by design, so the external " +
  "uptime monitors were NOT touched and keep pointing where they pointed before this deploy. " +
  "They are reconciled at the domain move, by hand in UptimeRobot or by a local `npm run ship` " +
  "on the operator machine, which holds the key";

/**
 * Whether a missing key is the expected state rather than a lost credential: only on GitHub
 * Actions, which sets GITHUB_ACTIONS=true on every runner.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function keylessRunIsExpected(env) {
  return env.GITHUB_ACTIONS === "true";
}

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
