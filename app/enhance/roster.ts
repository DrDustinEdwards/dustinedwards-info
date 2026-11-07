import { enhance } from "@drdustinedwards/site-helpers/render/enhance";

// An island (devkit ./islands): each <template data-island="roster"> on the page calls this. The roster's cohort photos
// open full size in Prelum's lightbox (render-enhance.mjs), scoped to the roster so the rest of the page is left alone.
export default function start(): void {
  enhance({ root: ".phage-roster" });
}
