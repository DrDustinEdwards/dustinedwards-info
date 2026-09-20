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
 * ## FAILS CLOSED when the limiter binding is absent
 *
 * Same stance as `checkAskRate` and `authenticateOperator`, and for the same
 * reason: a guard that silently passes because it could not run is the failure
 * this project has been caught by three times. Removing the Durable Object from
 * `wrangler.jsonc` therefore DISABLES sign-in rather than un-protecting it.
 *
 * That is a real cost and it is the right one. The alternative is that the one
 * configuration mistake nobody would notice is the one that removes the guard,
 * and an admin who cannot sign in notices immediately.
 *
 * ## ONE INSTANCE PER IP, under its own key prefix
 *
 * `auth:` rather than the `ip:` that Ask uses, so the two limits are separate
 * counters. Sharing the prefix would let a burst of questions from a reader's
 * network consume the sign-in allowance for that address, which is a coupling
 * nobody would predict from either file.
 */
export async function checkAuthRate(env: Env, ip: string): Promise<boolean> {
  if (!env.ASK_BUDGET) return false;

  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`auth:${ip}`));
  const { ok } = await limiter.hit(AUTH_RATE_LIMIT, AUTH_RATE_PERIOD_SECONDS);
  return ok;
}
