import { Link } from "react-router";

import { SITE } from "~/lib/seo";

/**
 * Public site header. Brand only for now: the three content routes it linked
 * to were removed, and the nav grows again when the blog lands. Plain links,
 * so no disclosure or mobile menu machinery.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        {SITE.name}
      </Link>
    </header>
  );
}
