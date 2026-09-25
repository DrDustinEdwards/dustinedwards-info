// The https upgrade in the gateway, ahead of the loopback, and the public HTML routes' one shared
// headers() with its cache tag.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sharedCacheHtmlRoutes } from "../route-source.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

/** @param {string} code workers/app.ts with its comments stripped */
export function run(code) {
  console.log("");
  console.log("  plaintext requests are upgraded before anything else runs");

  {
    /*
     * Measured on the wire: plain http returned the full page, and a warmed path came back a HIT carrying
     * the same nonce. So the redirect must sit in the gateway, before the loopback and anything cached.
     */
    const appCode = code;
    const gatewayAt = appCode.search(/export\s+default\s*\{/);
    ok("the Worker exports a default gateway", gatewayAt !== -1, "nothing below examines anything");
    const fetchBody = gatewayAt === -1 ? "" : appCode.slice(gatewayAt);
    ok("the gateway body is non-empty", fetchBody.length > 200, `${fetchBody.length} chars`);

    const redirectAt = fetchBody.indexOf("httpsRedirectTarget(");
    const loopbackAt = fetchBody.indexOf("ctx.exports.Renderer");
    ok(
      "the gateway takes an https redirect decision",
      redirectAt !== -1,
      "plaintext would reach the renderer and be answered 200, which is what was measured live",
    );
    ok(
      "THE UPGRADE RUNS BEFORE THE LOOPBACK, so plaintext never reaches a cache lookup",
      redirectAt !== -1 && loopbackAt !== -1 && redirectAt < loopbackAt,
      "a redirect decided after the response exists is not a redirect, and one decided after " +
        "the loopback could be answered from a cache entry the scheme is not part of",
    );
    /*
     * AND THE RENDERER DOES NOT REDIRECT, or the assertion above is satisfied by a copy that runs
     * on a miss only.
     */
    const rendererAt = appCode.search(/export\s+class\s+Renderer\b/);
    const rendererBody =
      rendererAt === -1 || gatewayAt === -1 ? "" : appCode.slice(rendererAt, gatewayAt);
    ok(
      "the Renderer body was located",
      rendererBody.length > 200,
      `${rendererBody.length} chars between the class and the default export`,
    );
    ok(
      "the https upgrade lives in the gateway ONLY",
      !rendererBody.includes("httpsRedirectTarget("),
      "the renderer runs on a cache miss only, so an upgrade decided there is skipped on a hit",
    );

    /* The redirect's own caching is a safety property: the scheme is NOT in the cache key. */
    /* The decision answers through redirectTo, whose body is the response every redirect gets. */
    const decision = redirectAt === -1 ? "" : fetchBody.slice(redirectAt, redirectAt + 200);
    const redirectBlock = appCode.match(/function\s+redirectTo\s*\([\s\S]*?\n\}/)?.[0] ?? "";
    ok(
      "the redirect block was located",
      /redirectTo\(\s*request\s*,\s*secure\s*\)/.test(decision) && redirectBlock.includes("Location"),
      "the assertion below would examine the wrong bytes",
    );
    ok(
      "THE REDIRECT IS no-store, so it cannot be cached under a scheme-blind key",
      /no-store/.test(redirectBlock),
      "the cache-header rule: with no Cache-Control it is CACHED, and a cached redirect loops HTTPS readers",
    );
    ok(
      "the redirect predicate is imported rather than restated",
      /from\s+"~\/lib\/https-redirect\.mjs"/.test(appCode),
      "a second copy of the loopback exemption is how local development breaks",
    );
  }

  /* A public page exporting no headers() falls through to the uncached default with no visible symptom. */

  console.log("");
  console.log("  public HTML routes share one headers()");

  {
    const PUBLIC_HTML = [
      "home.tsx",
      "about.tsx",
      "colophon.tsx",
      "phage-discovery.tsx",
      "playground.tsx",
      "playground.ui.tsx",
      "projects.tsx",
      /*
       * The publication index: its QUERY STRING is part of the key rather than a reason to refuse,
       * since the chips and the sort are GET parameters and nothing on it is reader-specific.
       */
      "publications.tsx",
      "publications.$slug.tsx",
      "privacy.tsx",
      "blog.tags.$tag.tsx",
      "blog.series.$series.tsx",
      // /blog is here rather than with the negotiating routes: no twin representation, and with the
      // theme in the cache key it has no reason for a Vary at all.
      "blog._index.tsx",
    ];

    /*
     * THE ACCEPT-NEGOTIATING PAIR, on the string rather than the helper: the only Vary left on this
     * site is one naming a real second representation.
     */
    const ACCEPT_NEGOTIATED = ["blog.$slug.tsx", "search.tsx"];
    for (const name of ACCEPT_NEGOTIATED) {
      const routePath = join(root, "app", "routes", name);
      const routeCode = existsSync(routePath) ? stripComments(readFileSync(routePath, "utf8")) : "";
      ok(
        name + " is shared-cacheable with its own Vary",
        routeCode.includes("SHARED_CACHE_CONTROL") && /Vary|HTML_VARY/.test(routeCode),
        "this route is counted in the shared-cache nonce exposure; if it stops being " +
          "shared-cacheable the exposure narrows and the narration in workers/app.ts must follow",
      );
    }

    /* Every shared-cacheable route also sets a cache tag, or a stored response stays wrong silently. */
    const TAG_NEEDLE = /publicHtmlHeaders\s*\(|"Cache-Tag"|cacheTags\s*\(/;
    const untagged = [];
    let taggedSeen = 0;
    for (const name of [...PUBLIC_HTML, ...ACCEPT_NEGOTIATED]) {
      const routePath = join(root, "app", "routes", name);
      if (!existsSync(routePath)) continue;
      const routeCode = stripComments(readFileSync(routePath, "utf8"));
      if (!routeCode.includes("SHARED_CACHE_CONTROL") && !routeCode.includes("publicHtmlHeaders")) {
        continue;
      }
      if (TAG_NEEDLE.test(routeCode)) taggedSeen += 1;
      else untagged.push(name);
    }

    ok(
      "the cache-tag walk examined the shared-cacheable routes",
      taggedSeen >= 10,
      `${taggedSeen} route(s) carried a tag, floor 10, measured 11. A zero-scope walk ` +
        `agrees with anything.`,
    );
    ok(
      "every shared-cacheable route also sets a Cache-Tag",
      untagged.length === 0,
      `${untagged.join(", ")} declare SHARED_CACHE_CONTROL and set no Cache-Tag. A ` +
        `response that can be stored and cannot be purged stays wrong until s-maxage ` +
        `expires, and neither the write nor the purge reports anything, because a purge ` +
        `for a tag nothing carries succeeds by doing nothing.`,
    );

    /* Comments stripped, because one route names the constant while explaining why it refuses it. */
    {
      const listed = new Set([...PUBLIC_HTML, ...ACCEPT_NEGOTIATED]);
      const found = sharedCacheHtmlRoutes();
      const unlisted = found.filter((f) => !listed.has(f));
      ok(
        "every shared-cached HTML route is named in one of the two lists",
        unlisted.length === 0,
        `unlisted: ${unlisted.join(", ")}. A new shared-cached page widens the shared-cache ` +
          `nonce exposure described in workers/app.ts, so it joins a list here`,
      );
      const missing = [...listed].filter((f) => !found.includes(f));
      ok(
        "every listed route still references the shared string",
        missing.length === 0,
        `listed but not found: ${missing.join(", ")}. A stale name here is an assertion ` +
          `above examining a file that no longer does this`,
      );
    }

    for (const name of PUBLIC_HTML) {
      const routePath = join(root, "app", "routes", name);
      ok(
        name + " exists",
        existsSync(routePath),
        "the route was renamed or removed, so the assertions below examine nothing",
      );
      if (!existsSync(routePath)) continue;

      const routeCode = stripComments(readFileSync(routePath, "utf8"));
      ok(
        name + " exports headers()",
        /export function headers/.test(routeCode),
        "with no headers() export it falls through to the uncached default, which is what left /projects the only public page never edge-cached",
      );
      ok(
        name + " returns the shared publicHtmlHeaders()",
        /publicHtmlHeaders/.test(routeCode),
        "a hand-written pair here is how the Vary line gets dropped: the shared string without Vary: Cookie serves one reader theme to another",
      );
    }
  }
}
