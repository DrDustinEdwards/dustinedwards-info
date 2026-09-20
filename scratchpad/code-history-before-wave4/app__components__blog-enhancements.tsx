import blogEnhanceUrl from "~/enhance/dist/blog.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

/**
 * Loads the blog reading enhancements, client side only.
 *
 * A nonced module script tag pointing at the prebuilt bundle of
 * app/enhance/blog.ts. It used to be a React effect running a dynamic import,
 * which required the page to hydrate; the public plane stopped hydrating
 * (2026-08-26), so the bundle is built ahead of time by build-enhance.mjs and
 * the `?url` import serves it verbatim. That verbatim copy is exactly why the
 * bundle must be prebuilt: `?url` does not compile, so pointed at the .ts
 * source it serves raw TypeScript (measured 2026-07-28, re-gated by
 * check:page-payload's syntax pass).
 *
 * A reader with JavaScript disabled never runs the bundle and loses nothing
 * but decoration.
 */
export function BlogEnhancements() {
  return <EnhancementScript src={blogEnhanceUrl} />;
}
