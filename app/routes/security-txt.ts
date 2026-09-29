import { securityTxt } from "~/lib/security-txt.mjs";
import { SITE_ORIGIN } from "~/lib/seo";

export function loader() {
  return new Response(securityTxt(SITE_ORIGIN), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
