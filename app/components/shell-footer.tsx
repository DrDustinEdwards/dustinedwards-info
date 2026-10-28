import { familyFooterHtml } from "capsomer/behavior/family-footer";

import { PUBLISHED_PAGES } from "~/lib/published-pages.generated.mjs";

/**
 * The family footer every dustinedwards.info site closes with (capsomer/family-footer, Dustin, 2026-10-26),
 * here with this site's own paths, and the Accessibility link only while its page is published. Its links
 * are data in Capsomer; app/lib/footer.ts hands them to test/footer.test.mjs, which holds every internal
 * href against the routes and the rel="me" set against OWNER_PROFILES. The end year is computed at render:
 * an edge-cached page can show last year's for a few days after January 1, which Dustin accepted
 * (2026-09-27) over a year that is edited by hand.
 */
export function ShellFooter() {
  return (
    <footer className="site-shell-footer">
      <div className="cap-page" dangerouslySetInnerHTML={{ __html: familyFooterHtml({ site: "dustinedwards", origin: "", published: PUBLISHED_PAGES }) }} />
    </footer>
  );
}
