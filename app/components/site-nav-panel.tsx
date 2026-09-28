import { Link } from "react-router";

import type { Menu, MenuLink, NavIcon } from "~/lib/nav";

/*
 * The one mega menu panel. Research, Teaching, Software and About are its contents (app/lib/nav.ts). It
 * is a native popover, so its chevron opens it with no script, it sits in the top layer above the
 * pinned bar, and Escape and an outside click close it. app/enhance/header.ts adds hover, pinning and
 * focus return, and on phones expands it in place inside the Menu instead.
 *
 * The group labels are paragraphs naming their lists, not headings: the panel is in every page's
 * markup ahead of its h1, and headings there would open every page's outline with "Research areas".
 */

// The design's line icons: a 24 grid drawn at 20px, 1.5 stroke, round caps and joins, in currentColor.
const ICON_PATHS: Record<NavIcon, React.ReactNode> = {
  retroviruses: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 5.5v-2M12 18.5v2M5.5 12h-2M18.5 12h2M7.4 7.4 6 6M16.6 16.6 18 18M7.4 16.6 6 18M16.6 7.4 18 6" />
      <path d="M10 9h4l-1.2 6h-1.6z" />
    </>
  ),
  bacteriophages: (
    <>
      <path d="M12 2.5l3.5 2v4l-3.5 2-3.5-2v-4z" />
      <path d="M11 10.5h2v6h-2z" />
      <path d="M8.5 16.5h7" />
      <path d="M9.5 16.5 7.5 19l-1 2.5M14.5 16.5l2 2.5 1 2.5" />
    </>
  ),
  "science-education": (
    <>
      <path d="M12 6.5c-1.8-1.3-4.5-2-8-2v13c3.5 0 6.2.7 8 2 1.8-1.3 4.5-2 8-2v-13c-3.5 0-6.2.7-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  recipes: (
    <>
      <path d="M3.5 20.5l5-5" />
      <path d="M8.5 15.5c-1.2-3.8 1.4-9.3 5.2-11 3.3-1.1 6.2 1.8 5.1 5.1-1.7 3.8-7.2 6.4-10.3 5.9" />
      <path d="M8.5 15.5c1.3-3 4-6.5 7-8.6" />
      <path d="M8.5 15.5c3-1.3 6.5-4 8.6-7" />
    </>
  ),
  travel: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-1.9 4.1L9 15l1.9-4.1z" />
      <path d="M12 3.5V5M12 19v1.5M3.5 12H5M19 12h1.5" />
    </>
  ),
  games: (
    <>
      <path d="M7.5 7.5h9a4 4 0 0 1 4 4.3l-.4 4.1a2.2 2.2 0 0 1-3.8 1.2L14.8 15.5H9.2l-1.5 1.6a2.2 2.2 0 0 1-3.8-1.2l-.4-4.1a4 4 0 0 1 4-4.3z" />
      <path d="M8 10v3M6.5 11.5h3" />
      <circle cx="15.5" cy="10.8" r=".7" />
      <circle cx="17.3" cy="12.6" r=".7" />
    </>
  ),
  flying: (
    <path d="M12 2.5c.8 0 1.4 1 1.4 2.4v4.4l7.1 4.3v1.9l-7.1-2.1v4.1l2 1.5v1.5L12 19.8l-3.4.7V19l2-1.5v-4.1L3.5 15.5v-1.9l7.1-4.3V4.9c0-1.4.6-2.4 1.4-2.4z" />
  ),
  scuba: (
    <>
      <path d="M4.5 9.5A2.5 2.5 0 0 1 7 7h10a2.5 2.5 0 0 1 2.5 2.5v3.3a3.2 3.2 0 0 1-3.2 3.2h-1.6c-.9 0-1.7-.5-2.1-1.3L12 13.2l-.6 1.5c-.4.8-1.2 1.3-2.1 1.3H7.7a3.2 3.2 0 0 1-3.2-3.2z" />
      <path d="M12 7v4" />
      <path d="M4.5 10.5H2.5M19.5 10.5h2" />
    </>
  ),
  art: (
    <>
      <path d="M20.3 3.7a1.6 1.6 0 0 0-2.3 0l-7 7 2.3 2.3 7-7a1.6 1.6 0 0 0 0-2.3z" />
      <path d="M11 10.7c-2.2-.3-4 1.2-4.2 3.3-.2 1.9-1 3.3-3.3 4 1.6 1.7 3.7 2.5 5.9 2.3 2.8-.3 4.4-2.5 3.9-5.3" />
    </>
  ),
};

function Icon({ name }: { name: NavIcon }) {
  return (
    <svg
      className="site-nav-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/** `aria-current` only on the link's own page: a menu link is one page, never a section. */
function current(link: MenuLink, pathname: string) {
  return link.to === pathname ? ("page" as const) : undefined;
}

/**
 * An icon row carries its description inside the link, as drawn, because the whole row is the
 * target; a text link keeps it outside, so the link's name is only its label.
 */
function PanelLink({ link, pathname }: { link: MenuLink; pathname: string }) {
  if (link.icon) {
    return (
      <li>
        <Link to={link.to} className="site-nav-link" data-icon="" aria-current={current(link, pathname)}>
          <Icon name={link.icon} />
          <span className="site-nav-link-text">
            <span className="site-nav-label">{link.label}</span>
            {link.description ? <span className="site-nav-desc">{link.description}</span> : null}
          </span>
        </Link>
      </li>
    );
  }
  return (
    <li>
      <Link to={link.to} className="site-nav-link" aria-current={current(link, pathname)}>
        <span className="site-nav-label">{link.label}</span>
      </Link>
      {link.aside ? <span className="site-nav-aside">{link.aside}</span> : null}
      {link.description ? <span className="site-nav-desc">{link.description}</span> : null}
    </li>
  );
}

export function SiteNavPanel({ id, menu, pathname }: { id: string; menu: Menu; pathname: string }) {
  return (
    <div className="site-nav-panel" id={id} popover="auto" data-nav-panel="">
      <div className="site-nav-panel-head">
        <Link to={menu.head.to} className="site-nav-panel-title" aria-current={current(menu.head, pathname)}>
          {menu.head.label}
        </Link>
        {menu.head.description ? <span className="site-nav-desc">{menu.head.description}</span> : null}
        {menu.beside?.map((link) => (
          <Link key={link.to} to={link.to} className="site-nav-link" aria-current={current(link, pathname)}>
            <span className="site-nav-label">{link.label}</span>
          </Link>
        ))}
      </div>
      <div className="site-nav-columns">
        {menu.columns.map((column, c) => (
          <div key={c} className="site-nav-column" data-wide={column.wide ? "" : undefined}>
            {column.label ? (
              <p className="site-nav-column-label" id={`${id}-${c}`}>
                {column.label}
              </p>
            ) : null}
            {column.sections.map((section, s) => (
              <div key={s} className="site-nav-section">
                {section.label ? (
                  <p className="site-nav-section-label" id={`${id}-${c}-${s}`}>
                    {section.label}
                  </p>
                ) : null}
                <ul
                  className="site-nav-links"
                  aria-labelledby={
                    section.label ? `${id}-${c}-${s}` : column.label ? `${id}-${c}` : undefined
                  }
                >
                  {section.links.map((link) => (
                    <PanelLink key={link.to} link={link} pathname={pathname} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
