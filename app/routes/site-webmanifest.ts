import { webManifest } from "@drdustinedwards/site-helpers/icons";

import { SITE } from "~/lib/seo";

export function loader() {
  const manifest = webManifest({ name: SITE.name, shortName: "DE", themeColor: "#4F2D7F", backgroundColor: "#4F2D7F" });
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=86400" },
  });
}
