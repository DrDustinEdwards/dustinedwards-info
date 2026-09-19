import { createAuth } from "~/lib/auth.server";
import { authRateRefusal } from "~/lib/auth-rate.mjs";
import { checkAuthRate } from "~/lib/auth-rate.server";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/api.auth.$";

/**
 * Catch-all for Better Auth. Every `/api/auth/*` request is handed to the auth handler, AFTER the
 * rate limit.
 *
 * WHAT IT CAPS IS THE OUTBOUND CALL: every hit on the Google callback makes this Worker exchange a
 * token against Google before `signIn.before` can reject a non-admin address, so an unbounded
 * endpoint is an amplifier pointed at a third party using our OAuth client.
 *
 * BOTH EXPORTS ARE GUARDED, and that is not belt-and-braces: Better Auth routes by method as well as
 * path, so the callback arrives as a GET and reaches `loader` while the sign-in and sign-out POSTs
 * reach `action`. Guarding one would leave the other open, and the callback is the expensive half.
 */

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
