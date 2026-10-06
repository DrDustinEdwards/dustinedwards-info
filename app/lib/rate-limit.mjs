import { limit } from "@drdustinedwards/rate-limit";

/**
 * One use of a fixed-window limit keyed by `key`, counted exactly by the ASK_BUDGET namespace, which
 * is the whole site's limiter. This site refuses when the counter is unavailable, on every call: a
 * guard that passes silently when its counter is gone is never noticed. The verdict carries the time
 * left in the window (`retryAfterSeconds`), which is what a refusal sends as Retry-After.
 *
 * @param {Env} env
 * @param {string} key
 * @param {number} maxHits
 * @param {number} windowSeconds
 * @returns {ReturnType<typeof limit>}
 */
export function limitHit(env, key, maxHits, windowSeconds) {
  return limit(env.ASK_BUDGET, key, [{ limit: maxHits, windowSeconds }], { onUnavailable: "refuse" });
}
