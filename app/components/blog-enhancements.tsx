import blogEnhanceUrl from "~/enhance/dist/blog.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

/**
 * A nonced module script tag pointing at the prebuilt bundle of
 * `app/enhance/blog.ts`. THE BUNDLE MUST BE PREBUILT: `?url` serves the file
 * verbatim and does not compile, so pointed at the `.ts` source it serves raw
 * TypeScript.
 *
 * A reader with JavaScript disabled never runs the bundle and loses nothing but
 * decoration.
 */
export function BlogEnhancements() {
  return <EnhancementScript src={blogEnhanceUrl} />;
}
