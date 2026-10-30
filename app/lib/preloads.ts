import { preloads } from "@dustinedwards/site-runtime/preload";

import uiFontUrl from "capsomer/fonts/schibsted-grotesk-latin-wght-normal.woff2?url";

/**
 * Every page's preloads, declared once: root.tsx's `links` and the `Link` header workers/app.ts adds to HTML
 * responses, which Cloudflare Early Hints sends ahead as a 103. Capsomer's UI face (capsomer/fonts.css), which every
 * page draws; site-runtime adds the `crossorigin` a font preload needs, or the file is fetched twice.
 */
export const PRELOADS = preloads([{ href: uiFontUrl, as: "font", type: "font/woff2" }]);
