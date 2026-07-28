import { Link, NavLink } from "react-router";

import { SITE } from "~/lib/seo";

/**
 * Public site header. Brand plus the one nav link the site currently earns.
 * It grows when there is a page to add, not in anticipation, so there is still
 * no disclosure widget and no mobile menu machinery.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        {SITE.name}
      </Link>
      <nav className="site-header-nav">
        <NavLink to="/blog">Blog</NavLink>
      </nav>
    </header>
  );
}
