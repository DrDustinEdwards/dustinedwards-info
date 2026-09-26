/*
 * Where an enhancement may be loaded from. Its own module, because enhance-loader.mjs's text is not
 * tree-shaken, and app/enhance/theme.ts, which every public page loads, needs only this. The loader
 * and the palette trigger both hold a resolved, normalized URL to `origin + ENHANCE_URL_PREFIX`;
 * test/enhance-loader.test.mjs runs both rules over the same cases.
 */

/** Where the app build emits the bundles (scripts/lib/enhance-bundle.mjs), under Vite's base `/`. */
export const ENHANCE_URL_PREFIX = "/assets/";
