// Paced rather than a flat cap: a flat cap is a cliff a distributed caller spends in minutes, denying
// Ask until UTC midnight. Paced, the denial ends when the abuse does. The bill is bounded either way.

/**
 * Never above dailyLimit, so this only ever refuses earlier than the flat cap would.
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

  // floor, not ceil: at 00:00:00 the allowance must be exactly burst.
  const paced = Math.floor((dailyLimit * elapsed) / SECONDS_PER_DAY);

  return Math.min(dailyLimit, paced + burst);
}

/**
 * The honest Retry-After under pacing; seconds-until-midnight would send readers away for a day.
 *
 * @param {number} dailyLimit
 * @returns {number} seconds, at least 1
 */
export function secondsPerPacedUnit(dailyLimit) {
  if (dailyLimit <= 0) return 86400;
  return Math.max(1, Math.round(86400 / dailyLimit));
}
