import { preloads } from "@dustinedwards/site-runtime/preload";

import monoFontUrl from "capsomer/fonts/martian-mono-latin-wght-normal.woff2?url";
import uiFontUrl from "capsomer/fonts/schibsted-grotesk-latin-wght-normal.woff2?url";
import textFontUrl from "~/fonts/source-serif-4-latin-core-normal.woff2?url";

const font = (href: string) => ({ href, as: "font" as const, type: "font/woff2" });

/**
 * Every page's preloads, declared once: root.tsx's `links` and the `Link` header workers/app.ts adds to HTML
 * responses, which Cloudflare Early Hints sends ahead as a 103. Capsomer's UI face (capsomer/fonts.css), which every
 * page draws; site-runtime adds the `crossorigin` a font preload needs, or the file is fetched twice.
 */
export const PRELOADS = preloads([font(uiFontUrl)]);

/**
 * The home page's other two faces, Source Serif (app.css, its Latin core) and Capsomer's mono, which it draws above
 * the fold; otherwise each is found only once its stylesheet has loaded (PageSpeed, 2026-10-30). Home only: preloaded
 * on every page they slowed /systems, which draws neither, from 2.0s to 2.5s LCP (check:systems-map, mobile profile).
 */
export const HOME_PRELOADS = preloads([font(textFontUrl), font(monoFontUrl)]);
