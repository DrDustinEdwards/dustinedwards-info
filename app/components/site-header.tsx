import { Link, useLocation } from "react-router";

import { Enhance } from "~/components/enhance";
import { SearchTrigger } from "~/components/search-trigger";
import { SiteLogoHeader } from "~/components/site-logo";
import { SiteNavPanel } from "~/components/site-nav-panel";
import { SiteSpeculation } from "~/components/site-speculation";
import { ThemeToggle } from "~/components/theme-toggle";
import { NAV, type NavItem } from "~/lib/nav";
import { SITE } from "~/lib/seo";

const NAV_ID = "site-nav";

/**
 * A destination, and for a menu the chevron and panel beside it. The word is always a link to the
 * hub; the chevron is a disclosure button, never a menuitem, because everything it shows is a link.
 * `popoverTarget` opens the panel with no script, and the browser maps it to an expanded state;
 * header.ts then writes `aria-expanded` and keeps it true to the panel.
 */
function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  // Only the hub's own page is `aria-current`; below it the word is marked as the section, so a post
  // page's Writing is bold and underlined without claiming to be the post.
  const here = pathname === item.to;
  const word = (
    <Link
      to={item.to}
      className="site-nav-word"
      aria-current={here ? "page" : undefined}
      data-section={here || pathname.startsWith(`${item.to}/`) ? "" : undefined}
    >
      {item.label}
    </Link>
  );
  if (!item.menu) return <li className="site-nav-item">{word}</li>;

  const panel = `${NAV_ID}-${item.menu.id}`;
  return (
    <li className="site-nav-item" data-nav-menu="">
      {word}
      <button
        type="button"
        className="site-nav-chevron"
        popoverTarget={panel}
        aria-controls={panel}
        aria-label={`Show ${item.label} links`}
        data-nav-chevron=""
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <SiteNavPanel id={panel} menu={item.menu} pathname={pathname} />
    </li>
  );
}

/**
 * ONE nav in the markup at every width: a popover the phone Menu button opens, so the Menu opens with
 * no script, and from the breakpoint in chrome-nav.css the same element laid out inline and never
 * opened. That breakpoint is a property of the current label widths: re-measure it after a label
 * changes, never reason it out. No `prefetch="intent"`: it needs React handlers and this plane does
 * not hydrate, so hover prefetch comes from `SiteSpeculation`.
 */
export function SiteHeader() {
  const { pathname } = useLocation();
  return (
    <header className="site-header" data-site-header="">
      <Link to="/" className="site-header-brand">
        {/* Decorative: the wordmark beside it is the link's name, so naming the mark would read twice. */}
        <SiteLogoHeader className="site-header-mark" />
        {SITE.name}
      </Link>
      {/* Named, so the landmark reads as the site's own navigation. */}
      <nav className="site-header-nav" id={NAV_ID} aria-label="Main" popover="auto" data-site-nav="">
        <ul className="site-nav-list">
          {NAV.map((item) => (
            <NavEntry key={item.to} item={item} pathname={pathname} />
          ))}
        </ul>
      </nav>
      {/* Outside the nav, so on a phone these stay by the wordmark while the destinations hang below. */}
      <div className="site-header-tools">
        <SearchTrigger />
        <ThemeToggle />
        {/* Rendered at every width and hidden by CSS on wide screens, because the server cannot know
            the viewport. As the popover's invoker, the open nav follows it in the focus order. */}
        <button
          type="button"
          className="site-header-menu-button"
          popoverTarget={NAV_ID}
          aria-controls={NAV_ID}
          data-header-menu=""
        >
          Menu
        </button>
      </div>
      {/* The veil under an open card (chrome-nav.css). A pointer target only, so hidden from the
          accessibility tree: a keyboard closes the card with Escape. A click on it lands here, never
          on the page beneath, and closes the card. */}
      <div className="site-nav-veil" aria-hidden="true" data-nav-veil="" />
      {/* Here rather than in root's Layout, so it never reaches the admin plane. */}
      <SiteSpeculation />
      {/* Absent, the Menu and every panel still open and close, and the header stays static; see
          app/enhance/header.ts. */}
      <Enhance module="header" />
    </header>
  );
}
