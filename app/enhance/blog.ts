import { enhance } from "@drdustinedwards/site-helpers/render/enhance";

// An island (devkit ./islands): each <template data-island="blog"> on the page calls this, and the first one runs it.
// The post's reading progress, contents tracking, code copy, footnote previews, lightbox, selection link and the
// click-to-play embeds are Prelum's (render-enhance.mjs), the one copy the sites share.
export default function start(): void {
  enhance();
}
