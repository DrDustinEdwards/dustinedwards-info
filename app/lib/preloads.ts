import { preloads } from "@dustinedwards/site-runtime/preload";

import monoFontUrl from "capsomer/fonts/martian-mono-latin-wght-normal.woff2?url";
import uiFontUrl from "capsomer/fonts/schibsted-grotesk-latin-wght-normal.woff2?url";
import textFontUrl from "~/fonts/source-serif-4-latin-core-normal.woff2?url";

/**
 * Every page's preloads, declared once: root.tsx's `links` and the `Link` header workers/app.ts adds to HTML
 * responses, which Cloudflare Early Hints sends ahead as a 103. The three faces the public pages draw (the CV alone has no Source Serif): Capsomer's UI and
 * mono faces (capsomer/fonts.css) and the body text's Source Serif (app.css, its Latin core). Each is otherwise found
 * only once its stylesheet has loaded, a second round trip on the page's critical path (PageSpeed, 2026-10-30).
 * site-runtime adds the `crossorigin` a font preload needs, or the file is fetched twice.
 */
export const PRELOADS = preloads(
  [uiFontUrl, textFontUrl, monoFontUrl].map((href) => ({ href, as: "font" as const, type: "font/woff2" })),
);
