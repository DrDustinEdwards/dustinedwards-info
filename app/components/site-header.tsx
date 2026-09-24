import { Link, NavLink } from "react-router";

import { Enhance } from "~/components/enhance";
import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { SiteSpeculation } from "~/components/site-speculation";
import { ThemeToggle } from "~/components/theme-toggle";
import { NAV } from "~/lib/nav";
import { SITE } from "~/lib/seo";


/**
 * The narrow-width threshold is a property of the current label widths: re-measure it after a
 * label changes, never reason it out. Roster's label and path deliberately disagree: the path is
 * the indexed legacy URL. No `prefetch="intent"`: it needs React handlers and this plane does not
 * hydrate, so hover prefetch comes from `SiteSpeculation`.
 */
export function SiteHeader() {
  return (
    <header className="site-header" data-site-header="">
      <Link to="/" className="site-header-brand">
        {/* Decorative: the wordmark beside it is the link's name, so naming the mark would read twice. */}
        <SiteLogoHeader className="site-header-mark" />
        {SITE.name}
      </Link>
      {/* Named: two unlabelled nav landmarks are indistinguishable to a screen reader. */}
      <nav className="site-header-nav" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      {/* Outside the nav, so the destinations can drop to their own line while these stay by the wordmark. */}
      <div className="site-header-tools">
        <SearchTrigger />
        <ThemeToggle />
        {/* A `<details>`, so it opens without script. Rendered at every width and hidden by CSS,
            because the server cannot know the viewport. */}
        <details className="site-header-menu" data-header-menu="">
          <summary className="site-header-menu-button">Menu</summary>
          {/* Not a duplicate landmark: `display: none` takes one of the two navs out of the
              accessibility tree at any width, so label them the same. */}
          <nav className="site-header-menu-panel" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </details>
      </div>
      {/* Here rather than in root's Layout, so it never reaches the admin plane. */}
      <SiteSpeculation />
      {/* Absent, the menu still opens and the header stays static; see app/enhance/header.ts. */}
      <Enhance module="header" />
    </header>
  );
}
