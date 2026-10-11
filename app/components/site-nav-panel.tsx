import { Link } from "react-router";

import type { Menu, MenuLink, MenuRow, NavIcon } from "~/lib/nav";

/*
 * The structured panel (app/lib/nav.ts): one shape for all five sections, top to bottom a header band, a
 * row of three tiles, a band with grouped rows on the left and one spotlight on the right, and three quick
 * links. It is a native popover, so its button opens it with no script, it sits in the top layer above the
 * pinned bar, and Escape and an outside click close it. app/enhance/header.ts adds hover, pinning and focus
 * return, and on phones expands it in place inside the Menu drawer instead.
 *
 * Everything in it is a plain list of links: no menu roles, which would promise arrow-key menus it does
 * not have (W3C disclosure navigation). The lists are named with aria-label, not headings: the panel is
 * in every page's markup ahead of its h1, and headings there would open every page's outline with them.
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
  research: (
    <>
      <path d="M9 3h6M10 3v6.2l-5 8.9A2 2 0 0 0 6.8 21h10.4a2 2 0 0 0 1.8-2.9l-5-8.9V3" />
      <path d="M7.6 15h8.8" />
    </>
  ),
  teaching: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.8V16c0 1.2 2.5 2.5 5.5 2.5s5.5-1.3 5.5-2.5v-4.2M21.5 9.5V15" />
    </>
  ),
  software: <path d="M8.5 7l-5 5 5 5M15.5 7l5 5-5 5M13.5 5l-3 14" />,
  writing: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  publications: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M9.5 12h6M9.5 15.5h6" />
    </>
  ),
  collections: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  methods: <path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1 1-1.1 1.8M12 16.8v.1" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  tools: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  series: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  tag: (
    <>
      <path d="M3.5 12.5v-8h8l9 9-8 8z" />
      <circle cx="8" cy="9" r="1" />
    </>
  ),
  colophon: <path d="M5 5h14M12 5v14M9 19h6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  rss: (
    <>
      <path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8" />
      <circle cx="6" cy="18" r="1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  mail: <path d="M3.5 6h17v12h-17zM3.5 7l8.5 6.5L20.5 7" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16.5 14.5c2.4 0 4 1.3 4.5 4" />
    </>
  ),
  map: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <circle cx="9" cy="18" r="2.2" />
      <path d="M8 6.5l8 1M7 8l1.5 8M16.5 10l-6 6.5" />
    </>
  ),
  explorer: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-1.9 4.1L9 15l1.9-4.1z" />
    </>
  ),
  card: (
    <>
      <path d="M3.5 6.5h17v11h-17zM3.5 10.5h17M7 15h3" />
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

/** `aria-current` only on the link's own page: a panel link is one page, never a section. */
function current(to: string, pathname: string) {
  return to === pathname ? ("page" as const) : undefined;
}

/** A tile: icon and label, with a description line when it has one. The CV's PDF is a second link beneath. */
function Tile({ link, pathname }: { link: MenuLink; pathname: string }) {
  return (
    <li className="site-nav-tile-item">
      <Link to={link.to} className="site-nav-tile" aria-current={current(link.to, pathname)}>
        {link.icon ? <Icon name={link.icon} /> : null}
        <span className="site-nav-tile-text">
          <span className="site-nav-tile-label">{link.label}</span>
          {link.description ? <span className="site-nav-desc">{link.description}</span> : null}
        </span>
      </Link>
      {link.also ? (
        <Link to={link.also.to} className="site-nav-tile-also">
          {link.also.label}
        </Link>
      ) : null}
    </li>
  );
}

/** A row's links on one line, a middot between them (drawn by CSS, so the markup is only the list). */
function RowLinks({ links, pathname }: { links: MenuLink[]; pathname: string }) {
  return (
    <ul className="site-nav-inline">
      {links.map((link) => (
        <li key={link.to}>
          <Link to={link.to} className="site-nav-link" aria-current={current(link.to, pathname)}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Row({ row, pathname }: { row: MenuRow; pathname: string }) {
  return (
    <li className="site-nav-row">
      <Icon name={row.icon} />
      <div className="site-nav-row-text">
        {row.to ? (
          <Link to={row.to} className="site-nav-row-title" aria-current={current(row.to, pathname)}>
            {row.title}
          </Link>
        ) : (
          <span className="site-nav-row-title" data-plain="">
            {row.title}
          </span>
        )}
        {row.note ? <span className="site-nav-desc">{row.note}</span> : null}
        {row.links && row.links.length > 0 ? <RowLinks links={row.links} pathname={pathname} /> : null}
      </div>
    </li>
  );
}

/** The system map, small: five nodes joined by lines, drawn in the panel's own colors. Decorative. */
function MapDrawing() {
  return (
    <svg
      className="site-nav-map"
      viewBox="0 0 120 56"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 14l30 10M52 24l34-12M52 24l-14 24M52 24l50 18M86 12l16 30" />
      <circle cx="22" cy="14" r="5" />
      <circle cx="52" cy="24" r="7" className="site-nav-map-hub" />
      <circle cx="86" cy="12" r="5" />
      <circle cx="38" cy="48" r="5" />
      <circle cx="102" cy="42" r="5" />
    </svg>
  );
}

export function SiteNavPanel({ id, menu, pathname }: { id: string; menu: Menu; pathname: string }) {
  const { spotlight } = menu;
  return (
    <div className="site-nav-panel" id={id} popover="auto" data-nav-panel="">
      <div className="site-nav-band">
        <Icon name={menu.icon} />
        <p className="site-nav-band-title">{menu.heading}</p>
        <p className="site-nav-band-line">{menu.blurb}</p>
      </div>
      {menu.tiles.length > 0 ? (
        <ul className="site-nav-tiles" aria-label={`${menu.heading} highlights`}>
          {menu.tiles.map((tile) => (
            <Tile key={tile.to} link={tile} pathname={pathname} />
          ))}
        </ul>
      ) : null}
      <div className="site-nav-body" data-spotlight={spotlight ? spotlight.kind : undefined}>
        {menu.rows.length > 0 ? (
          <ul className="site-nav-rows" aria-label={`More in ${menu.heading}`}>
            {menu.rows.map((row) => (
              <Row key={row.title} row={row} pathname={pathname} />
            ))}
          </ul>
        ) : null}
        {spotlight ? (
          <Link to={spotlight.to} className="site-nav-spot" aria-current={current(spotlight.to, pathname)}>
            <span className="site-nav-spot-eyebrow">{spotlight.eyebrow}</span>
            {spotlight.kind === "map" ? <MapDrawing /> : null}
            <span className="site-nav-spot-title">{spotlight.title}</span>
            {spotlight.body ? <span className="site-nav-spot-body">{spotlight.body}</span> : null}
          </Link>
        ) : null}
      </div>
      <ul className="site-nav-foot" aria-label={`${menu.heading} quick links`}>
        {menu.footer.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="site-nav-foot-link" aria-current={current(link.to, pathname)}>
              {link.icon ? <Icon name={link.icon} /> : null}
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
