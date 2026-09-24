import plateEnhanceUrl from "~/enhance/dist/plate.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

export function PlateEnhancements() {
  return <EnhancementScript src={plateEnhanceUrl} />;
}
