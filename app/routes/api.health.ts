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

export function loader() {
  return healthJson({ ok: true }, 200);
}
