import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { publicHtmlHeaders } from "~/lib/seo";

// /software is one of the markdown pages (app/lib/content-pages.mjs). Its own module only so the route
// has an id beside the research/* splat.
export { default, loader, meta } from "./content-page";

export function headers() {
  return new Headers(publicHtmlHeaders(CONTENT_PAGE_HTML_TAGS));
}
