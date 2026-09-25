// The static security headers in workers/app.ts, held to the ratified set in both directions, and
// the cache-control default and edge policy both exits stamp.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { blockFrom } from "../source-body.mjs";
import { headerConstant } from "../header-constants.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

/**
 * Transcribed by hand, never read from the source, so the two can disagree.
 * @type {Record<string, string>}
 */
const RATIFIED = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), display-capture=()",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Resource-Policy": "cross-origin",
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
  const securityHeaders = headerConstant(code, "SECURITY_HEADERS");
  ok(
    "workers/app.ts declares a SECURITY_HEADERS constant",
    Boolean(securityHeaders),
    "not found after stripping comments. Without it nothing below examines anything.",
  );
  const declared = securityHeaders ?? {};

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
      `the ratified set includes it and workers/app.ts does not`,
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
      `workers/app.ts declares it and the ratification does not. Add it here in the same commit, or remove it.`,
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
    "plain same-origin would break Better Auth's Google flow if it uses a popup, " +
      "which was deliberately not verified. allow-popups is correct either way.",
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
    "applyDocumentHeaders is called on BOTH exits (mutable and the immutable rebuild)",
    applications >= 3,
    `found ${applications} occurrence(s) including the definition; expected the definition ` +
      `plus one call per exit. A redirect that misses it ships with no security headers.`,
  );
  ok(
    "the immutable rebuild exists and stamps a fresh Headers copy",
    /new\s+Headers\s*\(\s*response\.headers\s*\)/.test(code) &&
      /new\s+Response\s*\(\s*response\.body/.test(code),
    "the Response.redirect() path must be rebuilt, not silently skipped",
  );

  /* Guards an auth bypass: with no Cache-Control an /admin render is stored under heuristic freshness
     under a cookieless key. Both exits. */

  console.log("\n  cache-control default");

  const RATIFIED_UNCACHED = "private, no-store";

  const uncached = code.match(/const\s+UNCACHED\s*=\s*"([^"]*)"\s*;/);
  ok(
    "workers/app.ts declares an UNCACHED constant",
    Boolean(uncached),
    "not found after stripping comments. Without it nothing below examines anything.",
  );
  ok(
    `the uncached default is exactly "${RATIFIED_UNCACHED}"`,
    uncached !== null && uncached[1] === RATIFIED_UNCACHED,
    `source has ${JSON.stringify(uncached ? uncached[1] : null)}. ` +
      `\`private\` alone satisfies Cloudflare's edge; \`no-store\` is what makes ` +
      `intermediaries and the browser treat it the same way.`,
  );

  /* In the helper both exits call, which the assertion on applyDocumentHeaders above counts. */
  const guards = [
    ...documentHeaders.matchAll(/if\s*\(\s*!\s*(?:\w+\.)?headers\.has\(\s*"cache-control"\s*\)\s*\)/g),
  ];
  ok(
    "the no-Cache-Control default is applied in applyDocumentHeaders, so on BOTH exits",
    guards.length >= 1,
    `found ${guards.length} guard(s) in the helper both exits call. A redirect that misses it ` +
      `is stored in a shared cache, and /admin returns 302.`,
  );

  let guardsSettingUncached = 0;
  for (const guard of guards) {
    /* The guard's own consequent: a braced block, or the one statement it governs. */
    const rest = documentHeaders.slice((guard.index ?? 0) + guard[0].length);
    const after = /^\s*\{/.test(rest) ? blockFrom(rest, 0) : rest.slice(0, rest.indexOf(";") + 1);
    if (/headers\.set\(\s*"cache-control"\s*,\s*UNCACHED\s*\)/.test(after)) guardsSettingUncached += 1;
  }
  ok(
    "every one of those guards sets UNCACHED",
    guards.length > 0 && guardsSettingUncached === guards.length,
    `${guardsSettingUncached} of ${guards.length} guards set it`,
  );

  /*
   * `s-maxage` implies `proxy-revalidate`, and Cloudflare then refuses to serve stale. So the edge policy
   * is in `Cloudflare-CDN-Cache-Control`, and neither string may carry a directive that switches SWR off.
   */

  console.log("\n  edge policy");

  {
    const seoCode = stripComments(readFileSync(join(root, "app", "lib", "seo.ts"), "utf8"));
    const shared = seoCode.match(/export\s+const\s+SHARED_CACHE_CONTROL\s*=\s*"([^"]*)"\s*;/);
    const edgeTemplate = seoCode.match(/const\s+edgeCacheControl\s*=\s*\([^)]*\)\s*=>\s*`([^`]*)`/);
    const edgeHeader = seoCode.match(/export\s+const\s+EDGE_CACHE_HEADER\s*=\s*"([^"]*)"\s*;/);
    const SWR_KILLERS = /\b(?:s-maxage|must-revalidate|proxy-revalidate|no-cache)\b/i;
    ok(
      "seo.ts declares the shared string, the edge template and the edge header",
      Boolean(shared && edgeTemplate && edgeHeader),
      `found shared=${Boolean(shared)} template=${Boolean(edgeTemplate)} header=${Boolean(edgeHeader)}`,
    );
    ok(
      "the shared string carries nothing that disables stale-while-revalidate",
      shared !== null && !SWR_KILLERS.test(shared[1]),
      `SHARED_CACHE_CONTROL is ${JSON.stringify(shared?.[1])}. Each of s-maxage, must-revalidate, ` +
        `proxy-revalidate and no-cache makes Cloudflare block on a render instead of serving stale.`,
    );
    ok(
      "the edge policy is stale-while-revalidate and nothing that disables it",
      edgeTemplate !== null &&
        /stale-while-revalidate=/.test(edgeTemplate[1]) &&
        /\bmax-age=/.test(edgeTemplate[1]) &&
        !SWR_KILLERS.test(edgeTemplate[1]),
      `edge template is ${JSON.stringify(edgeTemplate?.[1])}`,
    );
    ok(
      "the edge header is the Cloudflare-only one, which the browser never sees",
      edgeHeader !== null && edgeHeader[1].toLowerCase() === "cloudflare-cdn-cache-control",
      `EDGE_CACHE_HEADER is ${JSON.stringify(edgeHeader?.[1])}. CDN-Cache-Control passes downstream; ` +
        `Cache-Control would reach the browser and defeat every purge.`,
    );
    const stamps = [...documentHeaders.matchAll(/\bapplyEdgePolicy\(\s*headers\s*\)/g)];
    ok(
      "the Renderer stamps the edge policy on BOTH exits, through applyDocumentHeaders",
      stamps.length >= 1,
      `found ${stamps.length} call(s). A shared response that misses it carries no edge policy and ` +
        `falls back to Cache-Control, which is max-age=0.`,
    );
    const body = code.match(/function\s+applyEdgePolicy\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
    ok(
      "the stamp removes an edge header from anything not marked shared",
      body !== null &&
        /!==\s*SHARED_CACHE_CONTROL/.test(body[1]) &&
        /headers\.delete\(\s*EDGE_CACHE_HEADER\s*\)/.test(body[1]),
      "the edge header OUTRANKS Cache-Control at Cloudflare, so one left on a private response " +
        "makes it storable under a cookieless key",
    );
  }

  return { declared, applications };
}
