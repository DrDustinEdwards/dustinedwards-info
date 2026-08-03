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
    const varies = response.headers.get("vary") ?? "";
    if (request.headers.has("cookie") && /(^|,)\s*cookie\s*(,|$)/i.test(varies)) {
      response.headers.set("cache-control", UNCACHED);
    }

    if (!response.headers.has("cache-control")) {
      try {
        response.headers.set("cache-control", UNCACHED);
      } catch {
        // `Response.redirect()` and friends return immutable headers, so the
        // set above throws rather than being quietly ignored. Rebuilding is the
        // only way to add the header, and it stays on this branch rather than
        // becoming the general path: routing every response through a new one
        // is pointless work on the routes that stream.
        const headers = new Headers(response.headers);
        headers.set("cache-control", UNCACHED);
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      }
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
