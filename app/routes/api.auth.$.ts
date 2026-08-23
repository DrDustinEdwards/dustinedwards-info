import { createAuth } from "~/lib/auth.server";
import { authRateRefusal } from "~/lib/auth-rate.mjs";
import { checkAuthRate } from "~/lib/auth-rate.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/api.auth.$";

/**
 * Catch-all for Better Auth. Every `/api/auth/*` request is handed to the auth
 * handler, AFTER the rate limit.
 *
 * The limit was absent until 2026-08-23 and the audit was right about it. What
 * it caps is the outbound call: every hit on the Google callback makes this
 * Worker perform a token exchange against Google before `signIn.before` can
 * reject a non-admin address, so an unbounded endpoint is an amplifier pointed
 * at a third party using our OAuth client. Numbers and reasoning are in
 * `auth-rate.mjs`.
 *
 * BOTH EXPORTS ARE GUARDED, and that is not belt-and-braces. Better Auth routes
 * by method as well as path: the Google callback arrives as a GET and reaches
 * `loader`, while `sign-in/social` and `sign-out` are POSTs and reach `action`.
 * Guarding one would leave the other open, and the callback is the expensive
 * half.
 */

/**
 * `cf-connecting-ip` is set by the Cloudflare edge on every request that
 * reaches a Worker and cannot be spoofed by the client. Absent only off the
 * edge, where `unknown` funnels every such caller into one shared counter,
 * which is the safe direction.
 */
function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  if (!(await checkAuthRate(env, clientIp(request)))) return authRateRefusal();
  return createAuth(env).handler(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  if (!(await checkAuthRate(env, clientIp(request)))) return authRateRefusal();
  return createAuth(env).handler(request);
}
