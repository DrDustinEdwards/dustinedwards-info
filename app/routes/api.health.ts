/**
 * `/api/health`: confirms the `/api/*` plane is wired and the Worker is live.
 *
 * ## WHY THIS FILE HAS A CACHE-CONTROL AND DID NOT
 *
 * It returned `Response.json({ ok: true })` with no `Cache-Control` at all.
 * Under hard rule 8 that is not "uncached", it is CACHED: Workers Cache sits in
 * front of this Worker, `cache.enabled` is on in `wrangler.jsonc`, and
 * Cloudflare applies RFC 9111 heuristic freshness to a 200 carrying neither
 * `Cache-Control` nor `Expires`, which stores it for two hours.
 *
 * So the endpoint could answer "healthy" from a cache entry written up to two
 * hours earlier, and it would answer that identically whether the Worker was
 * fine or on fire. **A health check that can be served from cache is not a
 * health check**, and it is worse than none: it manufactures the reassuring
 * silence that a monitor exists to break.
 *
 * The transport's own default in `workers/app.ts` would NOT have saved this.
 * That default is `if (!headers.has("cache-control"))`, so it does apply here
 * today. Relying on it is still wrong for this route: the default exists to
 * make a FORGOTTEN header safe, and a route whose correctness depends on the
 * header is a route that must state it, or the next person who adds a
 * `headers` export to it removes the protection without knowing it was load
 * bearing. `check:headers` asserts this file's own declaration for that reason.
 *
 * `no-store` rather than the repo's usual `private, no-store`: `private` bounds
 * WHO may store, `no-store` says nobody may, and only the second is what this
 * route needs. Stated as one value so the gate compares one string.
 */

import { getEnv } from "~/lib/context";
import { runHealthChecks } from "~/lib/health/checks.server";
import { publicHealthBody } from "~/lib/health/verdicts.mjs";

import type { Route } from "./+types/api.health";

/**
 * The headers on EVERY health response, success and failure alike.
 *
 * One constant, one application site. A 503 that was cacheable would be worse
 * than a cacheable 200: it would keep reporting a failure after the site
 * recovered, and the workflow watching it would keep alerting.
 */
const HEALTH_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

/**
 * THE ONLY PLACE THIS ROUTE CONSTRUCTS A RESPONSE.
 *
 * That is the property `check:headers` asserts, and it is asserted structurally
 * rather than by looking for the header near each `new Response`. A window
 * around an anchor reads its neighbour's compliance, which this repo has
 * already been bitten by; "exactly one construction, and it is inside this
 * helper" cannot be satisfied by a neighbour.
 */
function healthJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: HEALTH_HEADERS });
}

/**
 * Runs every health check and answers 200 only if all of them passed.
 *
 * ## THE STATUS CODE IS THE ALERT
 *
 * `.github/workflows/health.yml` polls this and fails its run on any non-200,
 * and a failed scheduled run is what emails the repository owner. So anything
 * this endpoint wants a human to know it must say in the STATUS LINE. A 200
 * carrying `{"ok": false}` is read by `curl --fail` as health and the alert is
 * never sent. That is why the body is not the contract and the code is.
 *
 * 503 rather than 500: the site is serving, a stated invariant is not holding.
 *
 * ## FAIL CLOSED, and the outer catch is the point
 *
 * `runHealthChecks` already turns a throwing or hanging CHECK into a failing
 * check, each under its own timeout, so one wedged binding cannot hang this
 * response or silence the other two. Reaching the catch below therefore means
 * the run itself could not be assembled. An endpoint that cannot run its checks
 * reports unhealthy; it does not report nothing, and it does not report health.
 *
 * The body carries names and booleans only. Every `detail` string is dropped by
 * `publicHealthBody`, because they carry row counts and an R2 object key and
 * this route is unauthenticated. The why lives in Workers Logs.
 */
export async function loader({ context }: Route.LoaderArgs) {
  try {
    const run = await runHealthChecks(getEnv(context));
    const body = publicHealthBody(run);

    if (!body.ok) {
      // Logged as well as returned. Workers Logs keeps custom logs for 7 days
      // with observability enabled, and `invocation_logs: false` does not touch
      // them: that setting drops the automatic per-request record, which is a
      // privacy decision, not this. So the DETAIL the wire deliberately omits
      // is still recoverable by the operator.
      console.error(
        JSON.stringify({
          alert: "health-check-failed",
          failed: run.failed.map((c) => c.name),
          detail: run.failed.map((c) => c.detail),
        }),
      );
    }

    return healthJson(body, body.ok ? 200 : 503);
  } catch (error) {
    console.error(
      JSON.stringify({
        alert: "health-run-threw",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    // Same shape, so the workflow's parse succeeds and reports a named failure
    // rather than falling into its "body did not parse" branch, which would be
    // true but less useful.
    return healthJson({ ok: false, checks: [{ name: "health-run", ok: false }] }, 503);
  }
}
