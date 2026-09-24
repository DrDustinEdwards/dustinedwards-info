import { AUTH_RATE_LIMIT, AUTH_RATE_PERIOD_SECONDS } from "~/lib/auth-rate.mjs";

/**
 * Fails closed without the binding: a disabled sign-in is noticed at once, a
 * silently passing guard never is. Keyed `auth:` rather than Ask's `ip:` so a
 * burst of questions cannot consume an address's sign-in allowance.
 */
export async function checkAuthRate(env: Env, ip: string): Promise<boolean> {
  if (!env.ASK_BUDGET) return false;

  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`auth:${ip}`));
  const { ok } = await limiter.hit(AUTH_RATE_LIMIT, AUTH_RATE_PERIOD_SECONDS);
  return ok;
}
