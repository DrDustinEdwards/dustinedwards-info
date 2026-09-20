/**
 * `/api/health`: confirms the `/api/*` plane is wired and the Worker is live.
 *
 * THE CACHE-CONTROL IS LOAD BEARING. Under hard rule 8 a 200 carrying neither `Cache-Control` nor
 * `Expires` is CACHED under RFC 9111 heuristic freshness, and A HEALTH CHECK THAT CAN BE SERVED
 * FROM CACHE IS NOT A HEALTH CHECK: it manufactures the reassuring silence a monitor exists to break.
 *
 * The transport's default in `workers/app.ts` applies here today and relying on it is still wrong:
 * it exists to make a FORGOTTEN header safe, so the next person to add a `headers` export would
 * remove the protection without knowing it was load bearing.
 *
 * `no-store` rather than `private, no-store`: `private` bounds WHO may store, `no-store` says nobody
 * may, and only the second is what this route needs.
 */

import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import { runHealthChecks } from "~/lib/health/checks.server";
import { publicHealthBody } from "~/lib/health/verdicts.mjs";
import { writeHealthSnapshot } from "~/lib/health/snapshot.server";

import type { Route } from "./+types/api.health";

/**
 * The per-IP allowance, and the window it is measured over. The only copies, and deliberately NOT
 * exported: nothing outside this route needs the numbers, and the refusal is asserted over the wire
 * by `verify-live` rather than by a gate reading them back.
 */
const HEALTH_RATE_LIMIT = 20;
const HEALTH_RATE_PERIOD_SECONDS = 60;

/**
 * The headers on EVERY health response, success and failure alike. A 503 that was cacheable would
 * be worse than a cacheable 200: it would keep reporting a failure after the site recovered, and the
 * workflow watching it would keep alerting.
 */
const HEALTH_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

/**
 * THE ONLY PLACE THIS ROUTE CONSTRUCTS A RESPONSE. That is the property `check:headers` asserts,
 * and it is asserted structurally rather than by looking for the header near each `new Response`,
 * because a window around an anchor reads its neighbour's compliance.
 */
function healthJson(body: unknown, status: number, extra: HeadersInit = {}): Response {
  /*
   * SEEDED FROM THE CONSTANT, then overlaid. The rate-limit refusal needs a `Retry-After` no other
   * response wants, and both alternatives break the property above: a second `new Response` is a
   * second exit, and spreading the constant at each call site is the copy this helper prevents.
   *
   * `Headers` rather than a spread, so a caller cannot accidentally shadow `Cache-Control` with a
   * different case.
   */
  const headers = new Headers(HEALTH_HEADERS);
  for (const [name, value] of new Headers(extra)) headers.set(name, value);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Runs every health check and answers 200 only if all of them passed.
 *
 * THE STATUS CODE IS THE ALERT: a 200 carrying `{"ok": false}` is read by `curl --fail` as health
 * and the mail is never sent. 503 rather than 500, because the site is serving and a stated
 * invariant is not holding.
 *
 * FAIL CLOSED. `runHealthChecks` already turns a throwing CHECK into a failing check, so reaching
 * the outer catch means the run could not be assembled, and an endpoint that cannot run its checks
 * reports unhealthy rather than nothing.
 *
 * The body carries names and booleans only: `publicHealthBody` drops every `detail`, because they
 * carry row counts and an R2 object key and this route is unauthenticated.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  /*
   * GATE 0, AND IT IS FIRST BECAUSE EVERYTHING BELOW IT COSTS. Five checks against D1, R2 and AI
   * Search, unauthenticated, which made this the most expensive thing an anonymous caller could ask of
   * the site. Same instrument as `/api/csp-report` and the operator path: one `AskBudget` instance
   * named `health:<ip>`.
   *
   * WHY THE ALLOWANCE IS LOW: the deliverable here is a verdict still true thirty seconds later, where
   * `/api/csp-report` sits higher because its deliverable is the report and eating one loses data.
   *
   * WITHOUT THE LIMITER THIS DOES NOT SERVE. A missing `ASK_BUDGET` is itself a broken deployment, and
   * answering 503 is how this endpoint reports one rather than quietly losing its guard.
   */
  if (!env.ASK_BUDGET) {
    return healthJson(
      { ok: false, checks: [{ name: "rate-limiter-unavailable", ok: false }] },
      503,
    );
  }
  /*
   * THE LIMITER CALL IS INSIDE A TRY: a Durable Object call is a network call and can fail.
   *
   * WHY 503 AND A NAMED CHECK rather than letting it through: a limiter that THREW is not a limiter
   * that said yes, and treating a failed guard as a pass is the fail-open shape.
   *
   * A SEPARATE NAME FROM `rate-limiter-unavailable`, because absent and BROKEN are different answers
   * and collapsing them costs the reader the triage.
   *
   * NEITHER NAME IS IN `REPAIRABLE`: `repairPlan` returns alert-only for an unknown class, so a broken
   * limiter wakes somebody instead of firing a rebuild.
   */
  let withinRate: boolean;
  try {
    const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`health:${clientIp(request)}`));
    ({ ok: withinRate } = await limiter.hit(HEALTH_RATE_LIMIT, HEALTH_RATE_PERIOD_SECONDS));
  } catch (error) {
    // LOGGED BY NAME. The wire body carries names and booleans only, so this console line is the
    // entire record of WHY the limiter failed.
    console.error(
      JSON.stringify({
        alert: "health-rate-limiter-threw",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return healthJson({ ok: false, checks: [{ name: "rate-limiter-failed", ok: false }] }, 503);
  }

  if (!withinRate) {
    /*
     * THE SAME BODY SHAPE AS EVERY OTHER ANSWER, so the workflow's parse reports a named cause rather
     * than falling into its "body did not parse" branch. The status line is still the alert: a rate
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
      // Logged as well as returned. `invocation_logs: false` drops the automatic per-request record and
      // does not touch custom logs, so the DETAIL the wire deliberately omits is still recoverable by the
      // operator.
      console.error(
        JSON.stringify({
          alert: "health-check-failed",
          failed: run.failed.map((c) => c.name),
          detail: run.failed.map((c) => c.detail),
        }),
      );
    }

    /*
     * THE SNAPSHOT, WRITTEN ON THE WAY OUT. It is a byproduct of a run that happened anyway, never a
     * reason to run.
     *
     * Written for BOTH verdicts. One that recorded only healthy runs would let the home tile keep
     * showing the last good answer while the site was failing, which is the lie its timestamp exists to
     * prevent. The failure path below deliberately writes NOTHING: reaching it means there is no verdict
     * to record, so the tile ages into `stale` rather than being handed a fabricated one.
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

/**
 * Every method that is not GET, answered as a METHOD error rather than a framework crash. React
 * Router's default here is a 405 whose body says the server broke, with no `Allow` header RFC 9110
 * requires and a shape that sends the health workflow into its "body did not parse" branch.
 *
 * THE SHAPE IS THE SAME ONE EVERY OTHER ANSWER HERE USES, through `healthJson` and therefore the
 * same `no-store`.
 *
 * NO RATE LIMIT, deliberately: this allocates one object and returns, so metering it would cost a
 * round trip to refuse a request cheaper than the refusal, and a broken limiter would turn a 405
 * into a 503.
 *
 * `Allow: GET` and not `GET, HEAD`: the platform answers HEAD by running the loader, so HEAD never
 * reaches here and advertising it would be a claim about someone else's behaviour.
 */
export async function action() {
  return healthJson(
    { ok: false, checks: [{ name: "method-not-allowed", ok: false }] },
    405,
    { Allow: "GET" },
  );
}
