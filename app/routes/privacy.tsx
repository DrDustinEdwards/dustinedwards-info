import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { publicHtmlHeaders } from "~/lib/seo";

// /privacy is one of the markdown pages (app/lib/content-pages.mjs, content/pages/privacy.md), so Carrel
// edits and publishes it like any page. Its own module only so the route has an id beside the splats.
// headers() is written out, not re-exported, because check:headers reads each public route's own source
// for the shared builder.
export { default, loader, meta } from "./content-page";

export function headers() {
  return new Headers(publicHtmlHeaders(CONTENT_PAGE_HTML_TAGS));
}
