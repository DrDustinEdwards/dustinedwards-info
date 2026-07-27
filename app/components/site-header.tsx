import { Link, NavLink } from "react-router";

import { SITE } from "~/lib/seo";

/**
 * Public site header. Plain links, so no disclosure or mobile menu machinery:
 * the nav wraps on narrow viewports. NavLink marks the current page for
 * assistive tech via aria-current.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        {SITE.name}
      </Link>
      <nav aria-label="Primary">
        <NavLink to="/research" className="site-header-link">
          Research
        </NavLink>
        <NavLink to="/publications" className="site-header-link">
          Publications
        </NavLink>
        <NavLink to="/phage-hunters" className="site-header-link">
          Phage Hunters
        </NavLink>
      </nav>
    </header>
  );
}
