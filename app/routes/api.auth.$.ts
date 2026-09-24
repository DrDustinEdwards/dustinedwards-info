import { createAuth } from "~/lib/auth.server";
import { authRateRefusal } from "~/lib/auth-rate.mjs";
import { checkAuthRate } from "~/lib/auth-rate.server";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/api.auth.$";

/**
 * Rate limited because each Google callback makes this Worker exchange a token before a non-admin
 * is rejected. Both exports are guarded: the callback arrives as a GET (`loader`), sign-in and
 * sign-out as POSTs (`action`).
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
