// The static security headers in workers/app.ts, held to the ratified set in both directions, and
// the Renderer's last step, site-runtime's settleCacheHeaders.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { blockFrom } from "../source-body.mjs";
import { declaredSecurityHeaders } from "../header-constants.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

/**
 * Transcribed by hand, never read from the source, so the two can disagree.
 * @type {Record<string, string>}
 */
const RATIFIED = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "deny",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
  // The two OSHP recommends and this site had not sent: the shared standard supplies them.
  "X-DNS-Prefetch-Control": "off",
  "X-Permitted-Cross-Domain-Policies": "none",
  // TDMRep's training-rights reservation, the family bot policy Dustin set on 2026-10-25 (Prelum 0.8.0).
  "tdm-reservation": "1",
};

/**
 * The body of applyDocumentHeaders, the one helper both exits call.
 *
 * @param {string} code workers/app.ts with its comments stripped
 */
export function documentHeadersOf(code) {
  return code.match(/function\s+applyDocumentHeaders\s*\([\s\S]*?\n\}/)?.[0] ?? "";
}

/**
 * Returns the declared set and the applyDocumentHeaders occurrences, for the closing summary.
 *
 * @param {string} code workers/app.ts with its comments stripped
 */
export function run(code) {
  // The set is built by the shared package from OSHP's values and this site's deviations (workers/security-headers.mjs), and
  // imported here, so it is the set the Worker applies. app.ts must take it from that module and not declare its own.
  const declared = declaredSecurityHeaders();
  ok(
    "workers/app.ts applies the SECURITY_HEADERS built in workers/security-headers.mjs",
    /import\s*\{\s*SECURITY_HEADERS\s*\}\s*from\s*"\.\/security-headers\.mjs"/.test(code) && !/const\s+SECURITY_HEADERS\b/.test(code),
    "app.ts does not import SECURITY_HEADERS from ./security-headers.mjs, or declares a set of its own beside it",
  );

  ok(
    "the constant is not empty",
    Object.keys(declared).length > 0,
    "SECURITY_HEADERS parsed to zero entries, so every value assertion would pass vacuously",
  );
  ok(
    `the constant declares all ${Object.keys(RATIFIED).length} ratified headers`,
    Object.keys(declared).length === Object.keys(RATIFIED).length,
    `declares ${Object.keys(declared).length}: ${Object.keys(declared).join(", ") || "(none)"}`,
  );

  for (const [name, expected] of Object.entries(RATIFIED)) {
    ok(
      `${name} is declared`,
      name in declared,
      `the ratified set includes it and workers/security-headers.mjs does not build it`,
    );
    if (name in declared) {
      ok(
        `${name} carries its ratified value`,
        declared[name] === expected,
        `expected ${JSON.stringify(expected)}, source has ${JSON.stringify(declared[name])}`,
      );
      ok(
        `${name} has a non-empty value`,
        declared[name].trim().length > 0,
        "an empty value is a header that does nothing while looking present",
      );
    }
  }

  for (const name of Object.keys(declared)) {
    ok(
      `${name} is a ratified header`,
      name in RATIFIED,
      `workers/security-headers.mjs builds it and the ratification does not. Add it here in the same commit, or remove it.`,
    );
  }

  /* Named individually, because these two are what a future session is most likely to "fix". */
  ok(
    "Cross-Origin-Resource-Policy is cross-origin, not same-origin",
    declared["Cross-Origin-Resource-Policy"] === "cross-origin",
    "same-origin would block social platforms fetching og:image from /media/og/*. " +
      "The failure is off-site, silent, and invisible from this repo.",
  );
  ok(
    "Cross-Origin-Opener-Policy allows popups",
    declared["Cross-Origin-Opener-Policy"] === "same-origin-allow-popups",
    "plain same-origin would sever the opener of any cross-origin popup a sign-in or " +
      "embed opens. allow-popups keeps that working and is the ratified value.",
  );

  /*
   * Declaring the set and applying it differ: app.ts has two exits, and one helper call means
   * redirects ship bare. Both exits call applyDocumentHeaders, which applies the set.
   */
  const documentHeaders = documentHeadersOf(code);
  const applications = [...code.matchAll(/applyDocumentHeaders\s*\(/g)].length;
  ok(
    "applySecurityHeaders is defined",
    /function\s+applySecurityHeaders\s*\(/.test(code),
    "the constant is declared but nothing applies it",
  );
  ok(
    "applyDocumentHeaders applies the security set",
    /applySecurityHeaders\s*\(/.test(documentHeaders),
    "the helper both exits call does not call applySecurityHeaders, so neither exit ships the set",
  );
  ok(
    "applyDocumentHeaders is called by the Renderer",
    applications >= 2,
    `found ${applications} occurrence(s) including the definition. A response that misses it ships with no security headers.`,
  );
  ok(
    "the Renderer renders through timedRender, which hands back mutable headers",
    /timedRender\s*\(/.test(code) && /from\s+"@dustinedwards\/site-runtime\/server-timing"/.test(code),
    "without it a Response.redirect() from a route has immutable headers, and applyDocumentHeaders throws on it",
  );

  /* Guards an auth bypass: with no Cache-Control an /admin render is stored under heuristic freshness under a
     cookieless key, and an edge header left on a private or non-200 response makes it storable. site-runtime's
     settleCacheHeaders does both, so it must run last in the Renderer. */

  console.log("\n  cache-control default and edge policy");

  const rendererAt = code.search(/export\s+class\s+Renderer\b/);
  const renderer = rendererAt === -1 ? "" : blockFrom(code, rendererAt);
  ok(
    "settleCacheHeaders comes from site-runtime ./edge-cache",
    /import\s*\{[^}]*\bsettleCacheHeaders\b[^}]*\}\s*from\s*"@dustinedwards\/site-runtime\/edge-cache"/.test(code),
    "a local copy is how the status and Set-Cookie checks went missing",
  );
  ok(
    "THE RENDERER RETURNS settleCacheHeaders(...) AS ITS LAST STEP",
    /return\s+settleCacheHeaders\(\s*\w+\s*\)\s*;\s*\}\s*\}\s*$/.test(renderer.trim()),
    "anything returned around it can leave a private response, or a 404 under a shared route, storable",
  );
  ok(
    "settleCacheHeaders is not given the request",
    !/settleCacheHeaders\(\s*\w+\s*,/.test(renderer),
    "the theme cookie reaches the Renderer, so with the request no themed page would ever be stored",
  );
  ok(
    "the Renderer stamps the default edge lifetime only on a response marked shared",
    /===\s*SHARED_CACHE_CONTROL\s*&&\s*!\s*headers\.has\(\s*EDGE_CACHE_HEADER\s*\)/.test(documentHeadersOf(code)),
    "the edge header OUTRANKS Cache-Control at Cloudflare, so one stamped on a private response makes it storable",
  );
  {
    const seoCode = stripComments(readFileSync(join(root, "app", "lib", "seo.ts"), "utf8"));
    ok(
      "seo.ts takes the shared string and the edge header from site-runtime, declaring neither",
      /export\s*\{[^}]*\bEDGE_CACHE_HEADER\b[^}]*\bSHARED_CACHE_CONTROL\b[^}]*\}/.test(seoCode) &&
        !/const\s+(?:SHARED_CACHE_CONTROL|EDGE_CACHE_HEADER)\s*=/.test(seoCode),
      "a second spelling of either string is one a stored page can disagree with",
    );
  }

  return { declared, applications };
}
