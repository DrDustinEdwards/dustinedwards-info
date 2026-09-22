import plateEnhanceUrl from "~/enhance/dist/plate.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

/**
 * A nonced module script tag pointing at the prebuilt bundle of `app/enhance/plate.ts`. The plate
 * and its row are complete without it; a reader with script off loses the linked highlight and
 * the leader intro, and nothing else.
 */
export function PlateEnhancements() {
  return <EnhancementScript src={plateEnhanceUrl} />;
}
