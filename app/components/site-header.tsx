import { Link, NavLink, useRouteLoaderData } from "react-router";

import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { ThemeToggle } from "~/components/theme-toggle";
import { SITE } from "~/lib/seo";

import type { loader as rootLoader } from "~/root";

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
  const data = useRouteLoaderData<typeof rootLoader>("root");

  return (
    <header className="site-header">
      <Link to="/" className="site-header-brand">
        {/* Decorative: the link's accessible name is the wordmark beside it, so
            naming the mark too would make a screen reader say it twice. Inline
            so the purple follows the theme token; see site-logo.tsx. */}
        <SiteLogoHeader className="site-header-mark" />
        {SITE.name}
      </Link>
      <nav className="site-header-nav">
        <NavLink to="/blog">Blog</NavLink>
        <SearchTrigger />
        <ThemeToggle theme={data?.theme ?? "system"} />
      </nav>
    </header>
  );
}
