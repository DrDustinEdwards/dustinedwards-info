import blogEnhanceUrl from "~/enhance/dist/blog.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

// The bundle must be prebuilt: `?url` serves the file verbatim, so pointed at
// the `.ts` source it would serve raw TypeScript.
export function BlogEnhancements() {
  return <EnhancementScript src={blogEnhanceUrl} />;
}
