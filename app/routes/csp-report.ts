import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import { limitHit } from "~/lib/rate-limit.mjs";

import type { Route } from "./+types/csp-report";

/**
 * The CSP violation sink the policy names: the family's one receiver (site-runtime's csp-report).
 * A public, unauthenticated POST, since browsers send reports without credentials. It answers every
 * POST 204 (an error status makes browsers retry), reads at most 16 KB, logs at most 10 violations as
 * trimmed JSON lines (origin and path only; no address, user agent or cookie) and never writes D1,
 * which would hand the internet a storage-exhaustion primitive. Anything but POST and OPTIONS is 405.
 * The security set is applied by workers/app.ts, as on every response.
 */

/** Loose, because a page tripping ten rules sends ten. */
const RATE_LIMIT = 60;
const RATE_PERIOD_SECONDS = 60;

function receive(request: Request, context: Route.ActionArgs["context"]) {
  const env = getEnv(context);
  return receiveCspReport(request, {
    // Keyed on the edge-set client IP, not the body, which the client controls. A missing or
    // unavailable counter drops the report (still 204): this site's limiter refuses when it cannot count.
    allow: async (r) =>
      Boolean(env.ASK_BUDGET) &&
      (await limitHit(env, `csp:${clientIp(r)}`, RATE_LIMIT, RATE_PERIOD_SECONDS)).status === "ok",
  });
}

export function action({ request, context }: Route.ActionArgs) {
  return receive(request, context);
}

export function loader({ request, context }: Route.LoaderArgs) {
  return receive(request, context);
}
