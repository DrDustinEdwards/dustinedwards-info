/**
 * Spreading the Ask daily ceiling across the day, so exhausting it denies the
 * feature for minutes rather than for the rest of the day.
 *
 * ## THE FINDING, and the correction to it
 *
 * The 2026-08-22 audit, section 27: "`/search/ask` is a billed LLM endpoint on
 * an unauthenticated public route. Rate limited at 6/min per IP and capped at
 * 200 generations per day. A distributed caller could exhaust the daily cap for
 * $0 and deny the feature to everyone."
 *
 * The substance is right. **The number is not: `ASK_RATE_LIMIT` is 5, not 6**,
 * measured in `ask-guard.server.ts` on 2026-08-23. The daily cap of 200 is
 * correct.
 *
 * ## WHY PACING RATHER THAN THE OTHER REMEDIES
 *
 * The real defect is not the size of the cap, it is the SHAPE of the failure.
 * A flat ceiling is a cliff: a distributed caller with enough addresses spends
 * 200 units in a few minutes, every one of them inside the per-IP limit, and
 * Ask is then dead for every genuine reader until UTC midnight. The damage is
 * not the money, which is bounded either way. It is the twenty-three hours.
 *
 * Rejected, with reasons, since the brief asked for the choice to be argued:
 *
 * - **A lower daily cap** makes the cliff cheaper to reach, not harder. It
 *   improves the bill and worsens the denial, which is the wrong axis.
 * - **Requiring something cheap of the caller** (a token, a header, a proof of
 *   work) puts a cost on every honest reader to inconvenience an attacker who
 *   is already paying for addresses. It also breaks the no-JS story.
 * - **Accepting it** was defensible while nothing better was cheap. This is
 *   cheap: it is one pure function and no new binding, no new surface, no
 *   client change and no schema change.
 *
 * A CAPTCHA was ruled out by the brief and would have been ruled out anyway:
 * it is a third-party script on a site with zero third-party requests and an
 * enforced CSP.
 *
 * ## WHAT IT DOES NOT FIX, stated so nobody reads it as more than it is
 *
 * A caller who keeps spending continuously all day still holds the allowance at
 * its edge all day, and a reader arriving mid-attack is still refused. What
 * changes is that the denial ENDS when the attack does, instead of persisting
 * until midnight, and that a burst can no longer buy twenty-three hours of
 * outage for a few minutes of work. It also does not reduce the bill, which was
 * already bounded by the same 200.
 */

/**
 * Answers allowed to have been spent by `now`, today.
 *
 * A daily total of `dailyLimit` released evenly across the day, plus a fixed
 * `burst` available immediately so ordinary traffic never meets the pacing at
 * all.
 *
 * **The burst is what keeps this invisible to real readers.** Without it, the
 * first question of the day would be refused, because at 00:00:01 an evenly
 * paced allowance is zero. With it, a reader arriving at any hour finds at
 * least `burst` units of headroom above whatever has already been spent by that
 * point in the day.
 *
 * Never exceeds `dailyLimit`: the ceiling is still the ceiling, and this only
 * ever refuses EARLIER than the flat cap would, never later.
 *
 * @param {number} dailyLimit total answers permitted in a UTC day
 * @param {number} burst units available on top of the paced share
 * @param {Date} now
 * @returns {number} the ceiling to enforce at this instant
 */
export function pacedAllowance(dailyLimit, burst, now) {
  const SECONDS_PER_DAY = 86400;

  const elapsed =
    now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();

  // `floor`, not `ceil`: at the first second of the day the paced share must be
  // 0 so that the allowance is exactly `burst` and the burst is the whole of
  // the early-day headroom rather than burst plus a rounding unit.
  const paced = Math.floor((dailyLimit * elapsed) / SECONDS_PER_DAY);

  return Math.min(dailyLimit, paced + burst);
}

/**
 * How long until the paced allowance grows by one unit.
 *
 * This is the honest `Retry-After` under pacing, and it replaces
 * "seconds until UTC midnight". That value was correct for a flat cap, where
 * nothing changed until the day rolled over. It would now be a LIE by up to a
 * day: with pacing, budget frees up continuously, so telling a reader to come
 * back tomorrow would send them away from a feature that recovers in minutes.
 *
 * A stale `Retry-After` is the kind of wrong that nobody reports, because the
 * reader simply leaves.
 *
 * @param {number} dailyLimit
 * @returns {number} seconds, at least 1
 */
export function secondsPerPacedUnit(dailyLimit) {
  if (dailyLimit <= 0) return 86400;
  return Math.max(1, Math.round(86400 / dailyLimit));
}
