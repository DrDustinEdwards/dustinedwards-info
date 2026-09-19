/**
 * The Durable Object half of the `/api/auth/*` rate limit.
 *
 * Constants, reasoning and the refusal are in `auth-rate.mjs`, which is pure so
 * `check:tests` can reach them. This file is the binding call and nothing else,
 * the same split `build-assets.mjs` and `check-media.mjs` use.
 */

import { AUTH_RATE_LIMIT, AUTH_RATE_PERIOD_SECONDS } from "~/lib/auth-rate.mjs";

/**
 * True when this request may proceed to Better Auth.
 *
 * **FAILS CLOSED when the limiter binding is absent**, as `checkAskRate` and `authenticateOperator`
 * do. Removing the Durable Object therefore DISABLES sign-in rather than un-protecting it, and that
 * is the right cost: an admin who cannot sign in notices immediately, where a guard that silently
 * passed would not be noticed at all.
 *
 * **ONE INSTANCE PER IP, under `auth:` rather than the `ip:` that Ask uses.** Sharing the prefix
 * would let a burst of questions from a reader's network consume the sign-in allowance for that
 * address, a coupling nobody would predict from either file.
 */
export async function checkAuthRate(env: Env, ip: string): Promise<boolean> {
  if (!env.ASK_BUDGET) return false;

  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`auth:${ip}`));
  const { ok } = await limiter.hit(AUTH_RATE_LIMIT, AUTH_RATE_PERIOD_SECONDS);
  return ok;
}
