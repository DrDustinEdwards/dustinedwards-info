/**
 * WHETHER A FAILING HEALTH RUN MAY REPAIR ITSELF, AND WITH WHAT.
 *
 * The decision half of the self-repair the scheduled workflow performs. Ruled
 * 2026-08-24 under the AUTOMATE directive: an alert whose only remedy is a
 * human running the repair the machine could have run is a chore, and chores
 * are defects. What is NOT automated is the decision about what to do when
 * something unrecognised breaks; that still reaches a person.
 *
 * ## WHY THIS IS A MODULE AND NOT SHELL
 *
 * The workflow is bash inside YAML. Nothing in this repo can test that: it runs
 * on a schedule, on GitHub's runner, only when something is already broken. A
 * decision that fires an operator write and that decides whether a human is
 * woken must be exercisable by `check:tests`, so the decision lives here and
 * the workflow does the I/O.
 *
 * ## THE RULE, AND ITS TWO REFUSALS
 *
 * Repair runs only when EVERY failing check is a known drift class. The two
 * refusals are deliberate and neither is a fallback:
 *
 *   1. **An unknown class means no repair at all**, including for any drift
 *      classes failing alongside it. A compound failure may share a root cause,
 *      and firing a full corpus rebuild into a system that is broken in a way
 *      nobody has classified is how an incident becomes a bigger one. The run
 *      fails and a person reads it.
 *   2. **No token means no repair**, and the run STILL FAILS. Degrading to
 *      alert-only is correct; degrading to silence is not. A missing secret is
 *      a configuration problem, and a monitor that quietly stopped being able
 *      to act is exactly the shape of failure this repo keeps writing down.
 *
 * ## AND A THIRD THING THAT IS NOT A REFUSAL
 *
 * A run with NO failing checks never reaches here. `ok: false` with an empty
 * failing list is a contradiction in the endpoint, and this returns no repair
 * for it rather than inventing one: repairing on the basis of an empty list is
 * a write with no reason.
 *
 * The workflow that calls this is `.github/workflows/health.yml`; it is named
 * here in prose rather than with `@see`, because TypeScript's JSDoc parser
 * reads a leading dot as the start of a qualified name and refuses the tag.
 *
 * @see scripts/health-repair.mjs
 * @see test/health-repair.test.mjs
 */

/**
 * The classes this system can repair by itself, and the operation that does it.
 *
 * Both repairs go THROUGH THE FRONT DOOR: they are the same operator API
 * operations `ship` calls, which are the same derivations the admin buttons
 * call. Rule 18, and it is why the value here is a tool name rather than
 * anything that writes. Nothing in this path can construct a row.
 *
 * A class is added here only when its repair is idempotent and derives its own
 * verdict, because this runs unattended and nobody reads the result unless it
 * fails.
 */
export const REPAIRABLE = /** @type {const} */ ({
  "ask-index-drift": "sync_ask",
  "media-index-drift": "sync_media",
});

/**
 * What to do about a set of failing check names.
 *
 * @param {unknown} failingNames names of checks reporting ok:false
 * @param {{ hasToken: boolean }} options
 * @returns {{
 *   repair: string[],
 *   unknown: string[],
 *   alertOnly: boolean,
 *   reason: string,
 * }}
 */
export function repairPlan(failingNames, { hasToken }) {
  const names = Array.isArray(failingNames)
    ? failingNames.filter((n) => typeof n === "string" && n.length > 0)
    : [];

  if (names.length === 0) {
    return {
      repair: [],
      unknown: [],
      alertOnly: true,
      reason:
        "no failing check was named, so there is nothing to repair. A run that reports " +
        "unhealthy without naming a check is a fault in the endpoint, not a drift.",
    };
  }

  const unknown = names.filter((n) => !(n in REPAIRABLE));

  if (unknown.length > 0) {
    return {
      repair: [],
      unknown,
      alertOnly: true,
      reason:
        `no self-repair: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not a ` +
        `known drift class. Repair is not attempted for the recognised classes either, ` +
        `because a compound failure may share a root cause.`,
    };
  }

  if (!hasToken) {
    return {
      repair: [],
      unknown: [],
      alertOnly: true,
      reason:
        "no self-repair: OPERATOR_TOKEN is not set on this workflow, so the repair door " +
        "cannot be opened. Set it with `gh secret set OPERATOR_TOKEN`. Alerting only.",
    };
  }

  /*
   * DEDUPLICATED AND ORDERED BY THE MAP, not by the order the endpoint happened
   * to list its checks. Two failing classes that map to the same tool must not
   * call it twice, and a stable order makes the run log comparable between
   * incidents.
   */
  const tools = Object.keys(REPAIRABLE)
    .filter((name) => names.includes(name))
    .map((name) => REPAIRABLE[/** @type {keyof typeof REPAIRABLE} */ (name)]);

  return {
    repair: [...new Set(tools)],
    unknown: [],
    alertOnly: false,
    reason: `self-repair: ${names.join(", ")} -> ${[...new Set(tools)].join(", ")}`,
  };
}

/**
 * Reads the failing check names out of a health body.
 *
 * TOLERANT OF SHAPE, STRICT ABOUT MEANING. A body that does not parse into
 * checks yields an empty list, which `repairPlan` turns into alert-only rather
 * than into a repair: an unreadable body is a reason to wake somebody, never a
 * reason to write.
 *
 * `ok === false` rather than `!ok`, so a check missing the field entirely is
 * NOT counted as failing. A missing field is an unreadable body, handled above.
 *
 * @param {unknown} body
 * @returns {string[]}
 */
export function failingCheckNames(body) {
  const checks = /** @type {any} */ (body)?.checks;
  if (!Array.isArray(checks)) return [];
  return checks
    .filter((c) => c && typeof c === "object" && c.ok === false && typeof c.name === "string")
    .map((c) => c.name);
}
