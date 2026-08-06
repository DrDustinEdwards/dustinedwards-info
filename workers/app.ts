import { createRequestHandler, RouterContextProvider } from "react-router";

import { cloudflareContext } from "~/lib/context";
import { handleMediaEvents } from "./media-events";

// Re-exported so the runtime can find the class its binding names. The Ask
// spend ceiling lives in a Durable Object rather than KV because it has to be
// exact; the measurement that settled it is in the file.
export { AskBudget } from "./ask-budget";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

/**
 * What a response gets when it never said what it wanted.
 *
 * `cache.enabled` in wrangler.jsonc puts Workers Cache in FRONT of this Worker,
 * and it was turned on for one reason: Images binding responses are not cached
 * by Cloudflare, so every `/media/<key>?w=` was paying a full decode and
 * re-encode. But the switch is top level, not per binding, and it governs every
 * response this Worker returns.
 *
 * The trap is that omitting Cache-Control is NOT opting out. Cloudflare applies
 * RFC 9111 heuristic freshness to a response carrying no Cache-Control and no
 * Expires, which caches a 200 for two hours and a 404 for three minutes. The
 * cache key is the path, the entrypoint and the Worker version; COOKIES ARE NOT
 * IN IT. Only three routes on this site export `headers`, so without this the
 * first authenticated /admin render would be stored and then served to anyone
 * who asked for that path for the next two hours. That is an auth bypass, not a
 * performance regression.
 *
 * So the default is the refusal, and a route opts IN by setting the header
 * itself. Fail closed, in one place: a route added later is uncached until
 * somebody decides otherwise, which is the same stance `publiclyVisible()` and
 * the Ask guards take. `private` alone would satisfy Cloudflare's edge;
 * `no-store` is added so intermediaries and the browser treat it the same way.
 */
const UNCACHED = "private, no-store";

/**
 * Security headers, on EVERY response. Ratified 2026-08-06 (Phase A).
 *
 * Same shape and the same reason as `UNCACHED`: one constant, applied on the
 * way out, so a route added later is covered without anyone remembering. A
 * per-route opt-in would mean the next route ships bare, which is exactly how
 * the site ended up sending none of these at all.
 *
 * **PHASE A IS THE STATIC SET ONLY.** There is deliberately no
 * Content-Security-Policy here. A useful CSP needs a per-response nonce, which
 * has to exist BEFORE the render so `<Scripts nonce>` can stamp it, so it
 * cannot be a pure exit-path header the way these are. That is Phase B, its own
 * ruling and its own commit, and it starts in Report-Only.
 *
 * Three of these look tightenable and are not. The reasoning is not recoverable
 * from the values, so it is written here rather than left for someone to
 * rediscover by breaking something:
 *
 * - **`Cross-Origin-Resource-Policy: cross-origin`, NOT `same-origin`.**
 *   `same-origin` would block social platforms from fetching `og:image` out of
 *   `/media/og/*`, and link previews would silently stop working. The failure
 *   is off-site and invisible from here, which is the worst combination. This
 *   is the one header where the restrictive value is the WRONG value.
 *
 * - **`Cross-Origin-Opener-Policy: same-origin-allow-popups`. KEPT ON PURPOSE.
 *   Do not tighten to `same-origin`.** Ruled 2026-08-06, after the question was
 *   settled rather than while it was open.
 *
 *   Better Auth's Google flow is the only cross-origin window interaction on
 *   the site, and it is a TOP-LEVEL REDIRECT, not a popup: `redirectPlugin` in
 *   `better-auth/dist/client/fetch-plugins.mjs` sets `window.location.href`,
 *   there is NO `window.open` anywhere in the client package, and `/login`
 *   renders a `<button type="button">` whose onClick calls `signIn.social`.
 *   Established by reading the SHIPPED CLIENT CODE, not by executing sign-in,
 *   which needs credentials.
 *
 *   So `same-origin` would work today, and it is still not what we want. The
 *   permissive notch is insurance against DEPENDENCY DRIFT: Better Auth can
 *   move to a popup on a version bump with nobody re-reading `redirectPlugin`,
 *   and the failure mode would be a silent sign-in break on the one door into
 *   the private plane. Tightening buys nothing measured here and costs that.
 *
 *   **This is a settled question, not an open one.** The earlier note here said
 *   the flow was unverified; that was true when it was written and is false
 *   now. Reopening it needs new evidence about the flow, not a fresh reading of
 *   the same code.
 *
 * - **No `includeSubDomains`, no `preload` on HSTS.** This is a `workers.dev`
 *   subdomain whose parent domain we do not own, and asserting a policy for it
 *   is not ours to make. Revisit for the apex at DNS cutover.
 *
 * - **`X-Frame-Options: DENY` is a LEGACY MIRROR of `frame-ancestors`,** which
 *   does not exist until Phase B ships a CSP. Delete this line only when Phase
 *   B is enforcing, never before, or the site spends that window framable.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

/** @param headers the response headers to stamp, mutable or a fresh copy */
function applySecurityHeaders(headers: Headers) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    const response = await requestHandler(request, context);

    // THE COOKIELESS-ONLY RULE.
    //
    // A route that sets `Vary: Cookie` is declaring that its body depends on the
    // Cookie header and that it wants to be shared-cached. `Vary` alone is not
    // enough to make that safe here, and the reason is measured rather than
    // assumed: an ABSENT Cookie header is not treated as its own variant, so a
    // cookieless request matches whatever variant is already stored. With
    // `theme=dark` warming the entry first, every first-time visitor was served
    // a dark document. Present-but-different cookie values DO separate; absent
    // does not. Full matrix in Capsid `dustinedwards/workers-cache-vary.md`.
    //
    // So the response to any request that CARRIES a cookie is downgraded and
    // never stored. The only variant that can ever exist is the cookieless one,
    // which is correct for exactly the readers who match it, and the broken
    // direction is never exercised. That makes the order-dependence structurally
    // impossible instead of avoided by luck.
    //
    // Keyed on the PRESENCE of any cookie, not on a theme cookie. If it looked
    // for `theme=` specifically, a request carrying only a Better Auth session
    // cookie would count as cookieless and its response would be stored as the
    // shared variant, leaking anything session-dependent to everyone. Presence
    // is the fail-closed reading.
    //
    // Scoped by the response's own `Vary`, so it touches only routes that opted
    // in. The feeds and the markdown twins stay publicly cached for every reader
    // because they do not vary on Cookie and do not carry the header.
    /*
     * ALL response-level policy, in ONE place with ONE immutable fallback.
     *
     * `Response.redirect()` and friends return immutable headers, so a `set`
     * throws rather than being quietly ignored, and rebuilding is the only way
     * to stamp them. Rebuilding stays on the catch branch rather than becoming
     * the general path: routing every response through a new one is pointless
     * work on the routes that stream.
     *
     * **The cookieless downgrade moved INSIDE this block**, and that is not
     * tidying. It used to run unguarded above, so on an immutable response it
     * would throw and take the whole request with it, and the security headers
     * below would never be reached. A security header set that can be skipped
     * by an exception on the line before it is not applied to every response,
     * which is the one property this block exists to have. Both halves now
     * share the fallback: whatever throws, the rebuild applies everything.
     *
     * `/admin` returning 302 is the live case, and it carries no `Vary`, so it
     * reaches only the cache-control default. It is asserted in verify-live
     * anyway, because it is a DIFFERENT code branch from a 200.
     */
    const varies = response.headers.get("vary") ?? "";
    const downgradeForCookie =
      request.headers.has("cookie") && /(^|,)\s*cookie\s*(,|$)/i.test(varies);

    try {
      if (downgradeForCookie) response.headers.set("cache-control", UNCACHED);
      applySecurityHeaders(response.headers);
      if (!response.headers.has("cache-control")) {
        response.headers.set("cache-control", UNCACHED);
      }
    } catch {
      const headers = new Headers(response.headers);
      if (downgradeForCookie) headers.set("cache-control", UNCACHED);
      applySecurityHeaders(headers);
      if (!headers.has("cache-control")) headers.set("cache-control", UNCACHED);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  },

  /**
   * R2 event notifications from `dustinedwards-media`, deriving the D1 index.
   *
   * Separate from `fetch` on purpose: no HTTP request ever triggers this, and no
   * reader ever waits on it. The grounds and the idempotency argument are in
   * `media-events.ts`.
   */
  async queue(batch, env) {
    await handleMediaEvents(batch, env);
  },
} satisfies ExportedHandler<Env>;
