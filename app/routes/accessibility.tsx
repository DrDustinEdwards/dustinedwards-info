import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { publicHtmlHeaders } from "~/lib/seo";

// /accessibility is one of the markdown pages (app/lib/content-pages.mjs, content/pages/accessibility.md), so
// Carrel edits and publishes it like any page; while its file says `draft: true` it answers 404 to a reader.
// Its own module only so the route has an id beside the splats.
export { default, loader, meta } from "./content-page";

export function headers() {
  return new Headers(publicHtmlHeaders(CONTENT_PAGE_HTML_TAGS));
}
