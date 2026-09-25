/**
 * One use of a fixed-window limit keyed by `key`, counted exactly by the ASK_BUDGET namespace, which
 * is the whole site's limiter. "unavailable" without the binding, so every caller can fail closed:
 * a guard that passes silently when its counter is gone is never noticed.
 *
 * @param {Env} env
 * @param {string} key
 * @param {number} limit
 * @param {number} windowSeconds
 * @returns {Promise<"ok" | "limited" | "unavailable">}
 */
export async function limitHit(env, key, limit, windowSeconds) {
  if (!env.ASK_BUDGET) return "unavailable";
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(key));
  const { ok } = await limiter.hit(limit, windowSeconds);
  return ok ? "ok" : "limited";
}
