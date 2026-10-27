import { Link } from "react-router";

import type { Menu, MenuLink, MenuRow, NavIcon } from "~/lib/nav";

/*
 * The structured panel (app/lib/nav.ts): one shape for all five sections, top to bottom a header band, a
 * row of three tiles, a band with grouped rows on the left and one spotlight on the right, and three quick
 * links. It is the site's own contents of a Capsomer site-header panel (site-header.md, "the site's own
 * panel"): a manual popover its button opens with no script (popovertarget), in the top layer above the
 * sticky header. app/enhance/header.ts hands it to Capsomer's behavior, which adds hover, light dismiss,
 * Escape, arrow keys and focus return. On a phone the section links are in the header's sheet instead.
 *
 * Everything in it is a plain list of links: no menu roles, which would promise arrow-key menus it does
 * not have (W3C disclosure navigation). The lists are named with aria-label, not headings: the panel is
 * in every page's markup ahead of its h1, and headings there would open every page's outline with them.
 */

// The design's line icons (most from the structured panels mock): a 24 grid drawn at 18px, 1.7 stroke, round caps and joins, in currentColor.
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
  recipes: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z" />,
  research: (
    <>
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" />
      <path d="M7 15h10" />
    </>
  ),
  teaching: (
    <>
      <path d="M2 9l10-5 10 5-10 5z" />
      <path d="M6 11v5c3 2 9 2 12 0v-5" />
    </>
  ),
  software: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" />,
  writing: <path d="M4 20l4-1 11-11-3-3L5 16z" />,
  about: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  publications: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5" />
    </>
  ),
  collections: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  methods: (
    <>
      <path d="M6 3h12M8 3v14a4 4 0 0 0 8 0V3" />
      <path d="M8 11h8" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.7 9.6a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.1 1-1.1 1.8M12 16.8v.1" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  tools: <path d="M14 6a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3z" />,
  series: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  tag: (
    <>
      <path d="M3 3h8l10 10-8 8L3 11z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  colophon: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  rss: <path d="M5 19a1 1 0 1 0 0-.1M5 11a8 8 0 0 1 8 8M5 4a15 15 0 0 1 15 15" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5" />,
  users: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  map: (
    <>
      <path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  explorer: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15 9l-1.9 4.1L9 15l1.9-4.1z" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h7" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M12 11v6M9 14l3 3 3-3" />
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
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
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

/** The system map, small, as the mock draws it: a hub and its systems, in the panel's own colors. Decorative. */
function MapDrawing() {
  return (
    <svg className="site-nav-map" width="120" height="84" viewBox="0 0 120 84" aria-hidden="true" focusable="false">
      <circle cx="60" cy="42" r="34" className="site-nav-map-ring" strokeDasharray="3 3" />
      <g className="site-nav-map-lines" strokeWidth="1.2">
        <line x1="60" y1="42" x2="34" y2="26" />
        <line x1="60" y1="42" x2="86" y2="26" />
        <line x1="60" y1="42" x2="38" y2="62" />
        <line x1="60" y1="42" x2="84" y2="62" />
        <line x1="86" y1="26" x2="110" y2="10" />
      </g>
      <rect x="49" y="35" width="22" height="14" rx="4" className="site-nav-map-hub" />
      <g className="site-nav-map-nodes">
        <rect x="25" y="20" width="18" height="12" rx="3" />
        <rect x="77" y="20" width="18" height="12" rx="3" />
        <rect x="29" y="56" width="18" height="12" rx="6" />
        <rect x="75" y="56" width="18" height="12" rx="6" />
        <rect x="102" y="4" width="16" height="12" rx="3" />
      </g>
    </svg>
  );
}

export function SiteNavPanel({
  id,
  label,
  menu,
  pathname,
}: {
  id: string;
  label: string;
  menu: Menu;
  pathname: string;
}) {
  const { spotlight } = menu;
  return (
    <div
      className="cap-site-header-panel site-nav-panel"
      id={id}
      popover="manual"
      role="group"
      aria-label={label}
      data-nav-panel=""
    >
      <div className="site-nav-band">
        <span className="site-nav-badge" aria-hidden="true">
          {menu.badge ? <b>{menu.badge}</b> : <Icon name={menu.icon} />}
        </span>
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
            {spotlight.icon ? (
              <span className="site-nav-badge" aria-hidden="true">
                <Icon name={spotlight.icon} />
              </span>
            ) : null}
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
