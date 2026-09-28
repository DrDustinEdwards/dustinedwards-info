import { publicHtmlHeaders } from "~/lib/seo";

// /cv is one of the markdown pages (app/lib/content-pages.mjs), built from Dustin's current CV. Its own
// module only so the route has an id of its own. headers() is written out, not re-exported, because
// check:headers reads each public route's own source for the shared builder.
export { default, loader, meta } from "./content-page";

export function headers() {
  return new Headers(publicHtmlHeaders());
}
