import { enhance } from "@drdustinedwards/site-helpers/render/enhance";
import { enhance as enhanceLightbox } from "capsomer/behavior/lightbox";

// An island (devkit ./islands): each <template data-island="blog"> on the page calls this, and the first one runs it.
// The post's reading progress, contents tracking, code copy, footnote previews, selection link and the
// click-to-play embeds are Prelum's (render-enhance.mjs), the one copy the sites share.
export default function start(): void {
  enhance();
  // Post images open in Capsomer's lightbox; the article marks itself data-cap="lightbox".
  enhanceLightbox();
}
