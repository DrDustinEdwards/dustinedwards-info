import { AUTH_RATE_LIMIT, AUTH_RATE_PERIOD_SECONDS } from "~/lib/auth-rate.mjs";
import { limitHit } from "~/lib/rate-limit.mjs";

/**
 * Fails closed without the binding: a disabled sign-in is noticed at once, a
 * silently passing guard never is. Keyed `auth:` rather than Ask's `ip:` so a
 * burst of questions cannot consume an address's sign-in allowance.
 */
export async function checkAuthRate(env: Env, ip: string): Promise<boolean> {
  return (await limitHit(env, `auth:${ip}`, AUTH_RATE_LIMIT, AUTH_RATE_PERIOD_SECONDS)) === "ok";
}
