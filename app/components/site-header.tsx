import { Link, NavLink } from "react-router";

import { SearchTrigger } from "~/components/search-trigger";
import { SITE } from "~/lib/seo";

/**
 * Public site header. Brand plus the one nav link the site currently earns.
 * It grows when there is a page to add, not in anticipation, so there is still
 * no disclosure widget and no mobile menu machinery.
 *
 * The search entry point is an ordinary link to /search. With scripting on it
 * is upgraded in place into a button that opens the command palette; with
 * scripting off it stays a link and search still works. Nothing in the header
 * depends on the palette existing.
 */
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        {SITE.name}
      </Link>
      <nav className="site-header-nav">
        <NavLink to="/blog">Blog</NavLink>
        <SearchTrigger />
      </nav>
    </header>
  );
}
