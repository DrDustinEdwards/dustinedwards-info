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

import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import { runHealthChecks } from "~/lib/health/checks.server";
import { publicHealthBody } from "~/lib/health/verdicts.mjs";
import { writeHealthSnapshot } from "~/lib/health/snapshot.server";

import type { Route } from "./+types/api.health";

/**
 * The per-IP allowance, and the window it is measured over. The only copies.
 *
 * Deliberately NOT exported. Nothing outside this route needs the numbers, and
 * the refusal is asserted over the wire by verify-live rather than by a gate
 * reading them back, so exporting them would create a second reader with no
 * caller.
 */
const HEALTH_RATE_LIMIT = 20;
const HEALTH_RATE_PERIOD_SECONDS = 60;

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
function healthJson(body: unknown, status: number, extra: HeadersInit = {}): Response {
  /*
   * SEEDED FROM THE CONSTANT, then overlaid. The rate-limit refusal needs a
   * `Retry-After` that no other response wants, and the alternative shapes
   * both break the property above: a second `new Response` at the refusal site
   * is a second exit, and spreading the constant into an object literal at
   * each call site is the copy this helper exists to prevent.
   *
   * `Headers` rather than a spread so a caller cannot accidentally shadow
   * `Cache-Control` with a different case. Overlay order is deliberate: the
   * constant goes in first and `extra` may only ADD to it in practice, because
   * nothing passes a name the constant already declares.
   */
  const headers = new Headers(HEALTH_HEADERS);
  for (const [name, value] of new Headers(extra)) headers.set(name, value);
  return new Response(JSON.stringify(body), { status, headers });
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
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  /*
   * GATE 0, AND IT IS FIRST BECAUSE EVERYTHING BELOW IT COSTS.
   *
   * This endpoint runs five checks against D1, R2 and AI Search. MEASURED
   * 2026-08-26 over four samples: 0.98, 1.18, 1.18 and 2.01 seconds. It was
   * unauthenticated and unrated, which made it the most expensive thing an
   * anonymous caller could ask this site to do, by a wide margin, and it sat
   * next to `/api/csp-report`, an endpoint that only writes a log line and
   * carries THREE limits. The cheap path was guarded and the expensive one
   * was not.
   *
   * Same instrument as that route and as the operator path: one `AskBudget`
   * Durable Object instance, named `health:<ip>`. No new class, no migration.
   *
   * WHY 20 AND NOT 60. Every legitimate caller is far under it. The scheduled
   * workflow polls once every fifteen minutes; ship reads it once per deploy;
   * `check:browser` reads it twice per run; a person refreshing the page reads
   * it a handful of times. Twenty is roughly ten times the busiest of those
   * and it bounds one address to about twenty six seconds of backend work per
   * minute. `/api/csp-report` sits at sixty because its deliverable is the
   * report itself and eating one loses data; here the deliverable is a verdict
   * that is still true thirty seconds later.
   *
   * WITHOUT THE LIMITER THIS DOES NOT SERVE, the stance the Ask guards and the
   * operator path take. It costs nothing here and buys something extra: a
   * missing `ASK_BUDGET` is itself a broken deployment, and answering 503 is
   * exactly how this endpoint reports one, so the monitor alerts rather than
   * quietly losing its guard.
   */
  if (!env.ASK_BUDGET) {
    return healthJson(
      { ok: false, checks: [{ name: "rate-limiter-unavailable", ok: false }] },
      503,
    );
  }
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`health:${clientIp(request)}`));
  const { ok: withinRate } = await limiter.hit(HEALTH_RATE_LIMIT, HEALTH_RATE_PERIOD_SECONDS);
  if (!withinRate) {
    /*
     * THE SAME BODY SHAPE AS EVERY OTHER ANSWER, so the workflow's parse
     * succeeds and reports a named cause rather than falling into its "body
     * did not parse" branch. The status line is still the alert: a 429 is a
     * non-200 and `curl --fail` treats it as one, which is correct. A rate
     * limited monitor IS a condition worth a human seeing.
     */
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

    /*
     * THE SNAPSHOT, WRITTEN ON THE WAY OUT. It is a byproduct of a run that
     * happened anyway, never a reason to run.
     *
     * Written for BOTH verdicts, pass and fail. A snapshot that recorded only
     * healthy runs would let the home tile keep showing the last good answer
     * while the site was failing, which is the exact lie the tile's timestamp
     * exists to prevent.
     *
     * `body` rather than `run`, so what is stored is what was answered with.
     * The failure path below deliberately writes NOTHING: reaching it means
     * the run could not be assembled, so there is no verdict to record, and
     * the home tile ages into `stale` rather than being handed a fabricated
     * one. Grounds in `app/lib/health/snapshot.mjs`.
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
    // Same shape, so the workflow's parse succeeds and reports a named failure
    // rather than falling into its "body did not parse" branch, which would be
    // true but less useful.
    return healthJson({ ok: false, checks: [{ name: "health-run", ok: false }] }, 503);
  }
}
