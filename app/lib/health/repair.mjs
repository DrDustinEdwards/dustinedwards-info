/**
 * WHETHER A FAILING HEALTH RUN MAY REPAIR ITSELF, AND WITH WHAT.
 *
 * The decision half of the self-repair BOTH watchers perform. Ruled 2026-08-24
 * under the AUTOMATE directive: an alert whose only remedy is a human running
 * the repair the machine could have run is a chore, and chores are defects.
 * What is NOT automated is the decision about what to do when something
 * unrecognised breaks; that still reaches a person.
 *
 * ## WHY THIS IS A MODULE AND NOT SHELL
 *
 * The GitHub half is bash inside YAML. Nothing in this repo can test that: it
 * runs on a schedule, on GitHub's runner, only when something is already
 * broken. A decision that fires an authenticated write against production and
 * that decides whether a human is woken must be exercisable by `check:tests`,
 * so the decision lives here and the callers do the I/O.
 *
 * ## WHY IT LIVES IN `app/lib/health/` AND NOT IN `scripts/`
 *
 * MOVED HERE 2026-08-29, when the watchdog Worker became the second caller. It
 * was `scripts/lib/health-repair.mjs`, which was the right home while the only
 * caller was a Node script. A deployed Worker importing out of `scripts/` is
 * the wrong direction, and the alternative was a second copy of `REPAIRABLE`,
 * which is rule 17's exact defect in the one table that decides whether an
 * unattended write fires.
 *
 * `app/lib/health/` is where the pure halves of this subsystem already live:
 * `verdicts.mjs` and `snapshot.mjs` are dependency-free `.mjs` for the same
 * reason, and `scripts/check-browser.mjs` already imports one of them. So this
 * is the established shared layer rather than a new one.
 *
 * DEPENDENCY-FREE, and that is load bearing rather than tidy: it is imported by
 * a Worker bundle, by a Node script and by `node:test`, and nothing here may
 * assume a runtime. It NEVER fetches.
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
 * @see workers/watchdog.ts
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
  /*
   * CONTENT FIRST, and the map order is the repair order (see the dedup note
   * in repairPlan). The Ask corpus is read out of `search_docs`, which
   * `sync_posts` rewrites for every drifted post, so when content drift and
   * ask drift fail together the content repair must land before the Ask
   * upload reads the store it feeds from. The reverse order would upload the
   * stale corpus and then fix it, leaving Ask one interval behind for
   * nothing.
   */
  "content-drift": "sync_posts",
  "ask-index-drift": "sync_ask",
  "media-index-drift": "sync_media",
  /*
   * LAST, and order-independent unlike the three above. `sync_media` rebuilds a
   * D1 projection from R2 and never touches an object; this copies bytes and
   * never touches a row. Neither can feed the other, so the position carries no
   * argument and is simply the order they were added in.
   *
   * ADDED 2026-09-01 with the mirror (decisions-vol-13.md). It is the only
   * repair in this table that CANNOT LOSE ANYTHING: `backup_media` copies
   * MEDIA to MEDIA_BACKUP and has no delete branch, in either bucket. That is
   * the whole argument for letting it fire unattended, and it is why the
   * check it repairs may self-repair where `media-unbacked` could not: that one
   * announced a policy that had expired, and no write could have answered it.
   */
  "media-backup-drift": "backup_media",
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
      /*
       * BOTH HOLDERS ARE NAMED, since the watchdog became the second caller.
       * This string is the whole of what a reader gets when self-repair is off,
       * and it used to name only the repository secret, which would have sent
       * somebody to fix GitHub while the Worker was the one that could not act.
       */
      reason:
        "no self-repair: OPERATOR_TOKEN is not set on this watcher, so the repair door " +
        "cannot be opened. The GitHub half takes it as a repository secret " +
        "(`gh secret set OPERATOR_TOKEN`); the watchdog Worker takes it as a wrangler " +
        "secret (`wrangler secret put OPERATOR_TOKEN -c wrangler.watchdog.jsonc`). " +
        "Alerting only.",
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

/*
 * ===========================================================================
 * THE WATCHDOG'S ACTION LIST
 * ===========================================================================
 *
 * Added 2026-08-29 with `workers/watchdog.ts`. The half above answers "may this
 * repair itself, and with what". This half answers "what does a firing DO", in
 * order, and it exists as data rather than as control flow in the Worker for
 * one reason: a Cron Trigger fires unattended, off a schedule, and the only
 * time its code matters is when the site is already broken. That is the same
 * argument that made `repairPlan` a module, applied to the step the caller
 * would otherwise have kept for itself.
 *
 * THE RECHECK IS IN THE LIST, and that is the point of the shape. A repair that
 * is believed because its own call returned 200 has proved one index; the
 * recheck is what proves the ENDPOINT agrees, and it is the step most likely to
 * be quietly dropped by someone simplifying the Worker. A step that lives only
 * in the caller is a step no test can name.
 *
 * NOTHING HERE FETCHES. Both functions take a verdict and return actions.
 */

/**
 * @typedef {{ type: "repair", tool: string }} RepairAction
 * @typedef {{ type: "recheck" }} RecheckAction
 * @typedef {{ type: "notify", reason: string }} NotifyAction
 * @typedef {RepairAction | RecheckAction | NotifyAction} WatchdogAction
 */

/**
 * One reading of `/api/health`.
 *
 * `error` is the TRANSPORT failure's message, present only when the fetch
 * itself did not complete, which is also the only case `status` is 0. It is
 * optional rather than nullable because a reading that reached the endpoint
 * has no cause to carry, and `undefined` says that more plainly than a null.
 *
 * @typedef {{ status: number, body: unknown, error?: string }} HealthReading
 */

/**
 * What a watchdog firing should DO about one reading of `/api/health`.
 *
 * HEALTHY IS AN EMPTY LIST, not a "done" action. A firing that found nothing
 * wrong has nothing to do, and saying so with zero actions means the caller's
 * loop is the same loop in every case rather than a switch with a no-op arm.
 * The liveness the poll proves is written by the health call itself, before
 * this is ever consulted.
 *
 * ANYTHING THAT IS NOT A HEALTHY 200 GOES DOWN THE SAME PATH, including a
 * non-200. That mirrors `health.yml`, and for its reason: a 503 IS how this
 * endpoint reports a failing check, so branching on the status alone would skip
 * the repair for exactly the responses it exists for. A body naming no failing
 * check reaches `repairPlan`, which refuses to repair on an empty list and
 * returns alert-only, so a genuine outage still wakes somebody.
 *
 * @param {HealthReading} reading
 * @param {{ hasToken: boolean }} options
 * @returns {WatchdogAction[]}
 */
export function watchdogActions(reading, { hasToken }) {
  const status = Number(reading?.status);
  const body = reading?.body;
  const healthy =
    status === 200 && !!body && typeof body === "object" && /** @type {any} */ (body).ok === true;

  if (healthy) return [];

  /*
   * **A TRANSPORT FAILURE IS REPORTED WITH ITS CAUSE, not as a silent zero.**
   *
   * Measured in the pre-cutover audit 2026-09-11 (P2-07): `readHealth` caught
   * every transport error as `catch { return { status: 0, body: null } }`, so
   * DNS failure, a timeout, and Cloudflare 1042 all arrived here identical.
   * The reading then named no failing check, `repairPlan` correctly refused
   * to repair, and the mail that woke somebody at 2am said "no failing check
   * was named" about a fetch that never happened.
   *
   * Those are different pages. A timeout says the site is slow or wedged; a
   * 1042 says this Worker's binding is pointed somewhere it may not go, which
   * is a deploy problem and not a site problem. The repair path one function
   * down has kept `error.message` since it was written, which is what made
   * the omission here visible as an inconsistency rather than a decision.
   *
   * BEFORE `repairPlan`, because there is nothing to plan: a reading with no
   * body names no check, and the transport cause is strictly more information
   * than the empty-list reason would give. It is still alert-only, and for the
   * same reason `repairPlan` would have been.
   */
  if (status === 0) {
    const cause = typeof reading?.error === "string" && reading.error ? reading.error : "";
    return [
      {
        type: "notify",
        reason:
          `the health endpoint could not be reached at all${cause ? `: ${cause}` : `, and the ` +
            `reading carried no cause, which is itself a defect in the reader`}. Nothing was ` +
          `repaired, because a reading that never happened names no drift.`,
      },
    ];
  }

  const plan = repairPlan(failingCheckNames(body), { hasToken });

  if (plan.alertOnly) return [{ type: "notify", reason: plan.reason }];

  return [
    ...plan.repair.map((tool) => /** @type {RepairAction} */ ({ type: "repair", tool })),
    { type: "recheck" },
  ];
}

/**
 * What to do once the repairs and the recheck have actually run.
 *
 * Split from `watchdogActions` rather than folded into it because the two are
 * decided at different times against different evidence: the first reads one
 * health body, this reads what the writes returned. Folding them would mean one
 * function that has to be called twice with a flag, which is the shape that
 * makes a test ambiguous about which arm it exercised.
 *
 * A MISS AND A STILL-FAILING RECHECK ARE BOTH NOTIFY, and both reasons are
 * reported rather than the first, on the N-1-of-N rule: a run that named only
 * the failed repair would send somebody to re-run it and never mention that the
 * endpoint is still unhealthy for a different reason.
 *
 * @param {{ misses: string[], recheck: HealthReading | null }} outcome
 * @returns {WatchdogAction[]}
 */
export function watchdogOutcome({ misses, recheck }) {
  const failed = Array.isArray(misses) ? misses.filter((m) => typeof m === "string" && m) : [];

  const reasons = [];
  if (failed.length > 0) reasons.push(`self-repair FAILED: ${failed.join("; ")}. The drift stands.`);

  if (recheck === null || recheck === undefined) {
    reasons.push("the re-check did not complete, so the repair proved nothing.");
  } else {
    const stillFailing = failingCheckNames(recheck.body);
    const ok =
      Number(recheck.status) === 200 &&
      !!recheck.body &&
      typeof recheck.body === "object" &&
      /** @type {any} */ (recheck.body).ok === true;
    if (!ok) {
      reasons.push(
        `self-repair ran and the endpoint is STILL unhealthy (HTTP ${recheck.status}` +
          `${stillFailing.length ? `, failing: ${stillFailing.join(", ")}` : ""}).`,
      );
    }
  }

  return reasons.length > 0 ? [{ type: "notify", reason: reasons.join(" ") }] : [];
}

/**
 * HOW A NON-OK OPERATOR RESPONSE IS REPORTED, for every repair caller.
 *
 * Lives here, in the decision module, because there are TWO callers and they
 * had already drifted into holding one copy each of this logic:
 * `scripts/health-repair.mjs` for the scheduled workflow and
 * `workers/watchdog.ts` for the on-platform cron. Both threw the server's
 * explanation away, so fixing one and not the other would have left the more
 * important half (the watchdog polls every fifteen minutes) still reporting a
 * bare status code. One owner per fact, and a third caller inherits both
 * behaviours by construction.
 *
 * ## THE SERVER'S OWN SENTENCE
 *
 * The operator API sends `{ ok, error, detail }` on a refusal, where `error` is
 * the gate's message and `detail` carries the field and line
 * (`app/routes/api.operator.ts`). Reporting only the status discards the entire
 * diagnosis. Measured 2026-09-09: a run printed `sync_posts answered 422` for a
 * failure whose cause was an unknown `:swatch` directive on a named line, and
 * recovering that meant reading the pipeline by hand.
 *
 * ## WHY 422 IS UNREPAIRABLE RATHER THAN JUST FAILED
 *
 * A 422 is an `EditorError`, which the API defines as "nothing happened,
 * correct the request and retry". An unattended repair cannot correct anything:
 * it sends the same corpus on every poll. The usual cause is the repository
 * being AHEAD of the deployed build, where the content is valid and the
 * renderer running in production is older than it. The repair for that is a
 * deploy, so a caller that keeps retrying is a monitor arguing with a gate that
 * is right, on a fifteen minute cadence, until somebody stops reading it.
 *
 * @param {string} tool the operator tool that was called
 * @param {number} status the HTTP status it answered
 * @param {unknown} payload the parsed response body, or null
 * @returns {{ miss: string, unrepairable: boolean }}
 */
export function refusalMiss(tool, status, payload) {
  const body = payload && typeof payload === "object" ? /** @type {any} */ (payload) : null;
  const said = typeof body?.error === "string" ? body.error.trim() : "";
  const field = typeof body?.detail?.field === "string" && body.detail.field ? body.detail.field : "";
  const line = typeof body?.detail?.line === "number" ? body.detail.line : null;

  return {
    miss:
      `${tool} answered ${status}` +
      (said ? `: ${said}` : "") +
      (field ? ` [field ${field}]` : "") +
      (line === null ? "" : ` [line ${line}]`),
    unrepairable: status === 422,
  };
}
