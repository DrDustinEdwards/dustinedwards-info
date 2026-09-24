/**
 * `no-store` is load bearing: a health check served from cache is not a health check. Stated here
 * although workers/app.ts defaults it, because that default exists for forgotten headers.
 */

import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import { runHealthChecks } from "~/lib/health/checks.server";
import { publicHealthBody } from "~/lib/health/verdicts.mjs";
import { writeHealthSnapshot } from "~/lib/health/snapshot.server";

import type { Route } from "./+types/api.health";

const HEALTH_RATE_LIMIT = 20;
const HEALTH_RATE_PERIOD_SECONDS = 60;

/** A cacheable 503 would keep reporting a failure after the site recovered. */
const HEALTH_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function healthJson(body: unknown, status: number, extra: HeadersInit = {}): Response {
  /* `Headers` rather than a spread, so a caller cannot shadow `Cache-Control` with a different case. */
  const headers = new Headers(HEALTH_HEADERS);
  for (const [name, value] of new Headers(extra)) headers.set(name, value);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * The status code is the alert: `curl --fail` reads a 200 carrying `{"ok": false}` as health. The
 * body carries names and booleans only: details include row counts and an R2 key, and this is public.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  /*
   * First because everything below costs: five checks against D1, R2 and AI Search, unauthenticated.
   * Without the limiter this does not serve.
   */
  if (!env.ASK_BUDGET) {
    return healthJson(
      { ok: false, checks: [{ name: "rate-limiter-unavailable", ok: false }] },
      503,
    );
  }
  /*
   * A limiter that threw is not a limiter that said yes, so 503 rather than fail open. Neither name is
   * in `REPAIRABLE`, so a broken limiter alerts rather than firing a rebuild.
   */
  let withinRate: boolean;
  try {
    const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`health:${clientIp(request)}`));
    ({ ok: withinRate } = await limiter.hit(HEALTH_RATE_LIMIT, HEALTH_RATE_PERIOD_SECONDS));
  } catch (error) {
    // Logged by name: the wire body carries names only, so this line is the whole record of why.
    console.error(
      JSON.stringify({
        alert: "health-rate-limiter-threw",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return healthJson({ ok: false, checks: [{ name: "rate-limiter-failed", ok: false }] }, 503);
  }

  if (!withinRate) {
    return healthJson(
      { ok: false, checks: [{ name: "rate-limited", ok: false }] },
      429,
      { "Retry-After": String(HEALTH_RATE_PERIOD_SECONDS) },
    );
  }

  try {
    const run = await runHealthChecks(env);
    const body = publicHealthBody(run);

    if (!body.ok) {
      // `invocation_logs: false` drops the automatic per-request record, not custom logs, so the detail
      // the wire omits is still recoverable.
      console.error(
        JSON.stringify({
          alert: "health-check-failed",
          failed: run.failed.map((c) => c.name),
          detail: run.failed.map((c) => c.detail),
        }),
      );
    }

    /*
     * Written for both verdicts, or the home tile would keep showing the last good answer while the site
     * failed. The failure path writes nothing, so the tile ages into `stale`.
     */
    await writeHealthSnapshot(env, body, new Date().toISOString());

    return healthJson(body, body.ok ? 200 : 503);
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "health-run-threw",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return healthJson({ ok: false, checks: [{ name: "health-run", ok: false }] }, 503);
  }
}

/**
 * React Router's default 405 has no `Allow` header and a body that says the server broke. No rate
 * limit: metering costs more than the refusal. `Allow: GET` only, because the platform answers HEAD
 * by running the loader.
 */
export async function action() {
  return healthJson(
    { ok: false, checks: [{ name: "method-not-allowed", ok: false }] },
    405,
    { Allow: "GET" },
  );
}
