import { canonicalLink } from "~/lib/markdown-twin";
import { featuresMarkdown, FEATURES_PATH } from "~/lib/features.mjs";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN, publicHtmlHeaders } from "~/lib/seo";

/** The markdown twin of /features, drawn from the same list as the page, so an agent reads every card a person does. */
export function loader() {
  return new Response(featuresMarkdown(SITE_ORIGIN), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": SHARED_CACHE_CONTROL,
      // The pages' own tag, so one purge reaches every page and twin.
      "cache-tag": publicHtmlHeaders()["Cache-Tag"],
      "x-robots-tag": "noindex",
      link: canonicalLink(FEATURES_PATH),
    },
  });
}
