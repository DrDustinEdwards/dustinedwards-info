// The security headers this site sends, and the static files' `_headers` built from the same set
// (scripts/build-headers-file.mjs writes it). Package imports only, so the build script can load it.

import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";
import { buildSecurityHeaders, corpFor, headersFile } from "@dustinedwards/site-runtime/headers";
import { dustinedwardsInfo } from "@dustinedwards/site-runtime/sites";

/** The set this site sends: its registry entry (site-runtime ./sites) and Prelum's TDMRep header reserving training rights as /ai.txt says.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SECURITY_HEADERS = Object.freeze({
  ...buildSecurityHeaders({ site: dustinedwardsInfo }),
  ...TDM_RESERVATION_HEADERS,
});

/**
 * Build output named by its content hash (Vite's /assets/, devkit's /islands/ and their chunks), so a year is safe.
 * Stylesheets, scripts and fonts, which Carrel's sandboxed preview loads from an opaque origin: CORP as corpFor marks them.
 */
const BUILD_OUTPUT = Object.freeze({
  "Cache-Control": "public, max-age=31536000, immutable",
  "Cross-Origin-Resource-Policy": corpFor("text/css"),
});

/** Pictures at static paths that other origins load (the share card, and those a page or Carrel's preview draws). */
const SHARED_IMAGES = ["/diagrams/*", "/phage-hunters/*", "/dustin-edwards-og-image.png", "/dustin-edwards-logo.svg", "/dustin-edwards-logo-dark.svg"];

/** The static files' `_headers`: Workers Assets answers them before the Worker runs, so the set has to be written there. */
export const STATIC_HEADERS_FILE = headersFile(SECURITY_HEADERS, {
  // Content-Type with charset=utf-8 on the text files, which the asset server sends without one.
  charset: true,
  comment: [
    "Written by scripts/build-headers-file.mjs from workers/security-headers.mjs (npm run build). Do not edit.",
    "Only /assets/* and /islands/* are immutable: every other static file sits at a stable path and keeps the default revalidation.",
  ],
  paths: {
    "/assets/*": BUILD_OUTPUT,
    "/islands/*": BUILD_OUTPUT,
    ...Object.fromEntries(SHARED_IMAGES.map((path) => [path, { "Cross-Origin-Resource-Policy": corpFor("image/*") }])),
  },
});
