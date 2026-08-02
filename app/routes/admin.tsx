import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Form, Link, NavLink, Outlet, redirect } from "react-router";

import { SiteLogoHeader } from "~/components/site-logo";
import { SITE } from "~/lib/seo";
import { adminSessionContext, getAdminSession } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import { loadArtifact } from "~/lib/editor/publish.server";
import { askStatusContext, askStatusReader } from "~/lib/search/ask.server";
import type { Route } from "./+types/admin";

export function meta() {
  return [{ title: "Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * One gate for the whole /admin subtree. Runs before every child loader and
 * action; anyone without the single-admin session is 302'd to the login
 * screen. The verified session is stashed on the context so children read it
 * without a second lookup.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const env = getEnv(context);
    const session = await getAdminSession(env, request);
    if (!session) throw redirect("/login");
    context.set(adminSessionContext, session);
    // Lazy and memoized: this layout's loader wants a drift COUNT for the nav
    // badge and /admin/posts wants the full status for its alert. Sharing the
    // reader means one listing per request rather than two, and a route that
    // never asks for it never pays for it.
    context.set(
      askStatusContext,
      askStatusReader(env, () => loadArtifact(env)),
    );
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const ask = await context.get(askStatusContext)();
  return {
    email: context.get(adminSessionContext).user.email,
    /**
     * ONE number, not the status object. The badge is a count and the repair
     * lives on /admin/posts, so shipping the key lists to every admin page
     * would be payload the shell has no use for.
     *
     * Drift counts in BOTH directions, exactly as the alert reports it: an item
     * the corpus does not know about is as much a defect as a record the index
     * lacks.
     */
    askDrift: ask ? ask.missing.length + ask.stale.length : 0,
  };
}

/**
 * Where the collapsed state lives, and the attribute the stylesheet reads.
 *
 * localStorage per the ruling: not server state and not a cookie, because the
 * rail is a per-device preference rather than a fact about the account. That
 * choice has one consequence and it is the whole reason for the script below:
 * the server cannot know the state, so without help the shell would render
 * expanded and snap narrow after hydration.
 */
const SIDEBAR_KEY = "admin-sidebar";
const SIDEBAR_ATTR = "data-admin-sidebar";

/**
 * Sets the attribute BEFORE the sidebar is painted.
 *
 * The stylesheet keys the rail's width off an attribute on the document
 * element, so the width is decided by the time the first pixel lands and
 * nothing is corrected afterwards. It is a blocking inline script, which this
 * site otherwise avoids: the theme toggle reaches the same no-flash result with
 * a cookie read in the root loader, and that option is ruled out here.
 *
 * It lives in the ADMIN layout, not in root, so the public plane never carries
 * it. It is also why the React tree renders identically in both states: the
 * markup does not branch, so there is nothing for hydration to disagree about.
 */
const NO_FLASH = `try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_KEY)})==="collapsed"){document.documentElement.setAttribute(${JSON.stringify(SIDEBAR_ATTR)},"collapsed")}}catch(e){}`;

/**
 * The house Glyph idiom: 24x24, currentColor stroke, aria-hidden. Each one
 * draws what its section holds rather than an abstract mark.
 */
const ICONS = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  sites: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </>
  ),
  content: (
    <>
      <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M15 4v5h5" />
      <path d="M8 13h8M8 17h5" />
    </>
  ),
  posts: (
    <>
      <path d="M4 5h16M4 10h16M4 15h11M4 20h7" />
    </>
  ),
  /**
   * A picture: frame, horizon, sun.
   *
   * Chosen against the five already here rather than in isolation. Overview is
   * rectangles, Sites a globe, Content a document, Posts stacked lines, Tools
   * sliders, so a framed image collides with none of them at rail size. Not a
   * pencil and not a stack of photos: the pencil reads as compose, which is
   * Posts' job, and a stack reads as "copies" rather than "the library".
   */
  media: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 4.5-4.5 3 3 3.5-3.5 5 5" />
    </>
  ),
  /**
   * Sliders, not the pencil this used to draw.
   *
   * A pencil reads as COMPOSE, which is what Posts does, so two adjacent items
   * were claiming the same job and the one that actually writes was not the one
   * holding the pen. Sliders say "settings and switches", which is what Tools
   * holds.
   */
  tools: (
    <>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
} as const;

const NAV = [
  { to: "/admin", label: "Overview", end: true, icon: ICONS.overview },
  { to: "/admin/sites", label: "Sites", icon: ICONS.sites },
  { to: "/admin/content", label: "Content", icon: ICONS.content },
  // The only item that carries a count. Drift is a fact about the post corpus,
  // and Posts is where the repair lives.
  { to: "/admin/posts", label: "Posts", icon: ICONS.posts, drift: true },
  // After Posts and before Tools, because it is content the posts consume
  // rather than an admin control. Until now /admin/media existed and loaded but
  // NOTHING linked to it: the sidebar had five items, none of them Media, and
  // no item even marked itself active while the page was open, so the library
  // was reachable only by typing the URL.
  { to: "/admin/media", label: "Media", icon: ICONS.media },
  { to: "/admin/tools", label: "Tools", icon: ICONS.tools },
];

/**
 * The accessible name for a nav item, count included as WORDS.
 *
 * A badge that is only a numeral announces "Posts 3", which names no unit and
 * reads as a position as easily as a quantity. The digits are decoration over
 * this string, so the numeral itself is aria-hidden and this is what is
 * actually announced. It doubles as the `title`, which is how the count keeps a
 * text equivalent for a SIGHTED reader in the collapsed rail, where the badge
 * has room for the number but not for what the number counts.
 */
function navName(label: string, drift: number) {
  if (drift <= 0) return label;
  return `${label}, ${drift} Ask index item${drift === 1 ? "" : "s"} drifted`;
}

/** 24x24 stroked glyph, the same shape the rest of the admin uses. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="admin-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  /**
   * Mirrors the attribute the inline script already set.
   *
   * Initialised to `false` so the hydration render matches the server's, then
   * corrected in a LAYOUT effect, which runs before the browser paints. The
   * width never depended on this (the stylesheet reads the attribute), so what
   * this actually keeps honest is `aria-expanded`.
   */
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    setCollapsed(document.documentElement.getAttribute(SIDEBAR_ATTR) === "collapsed");
  }, []);

  /**
   * The toggle. It writes the attribute and the store, and it does NOT move
   * focus: the button is the same node before and after, never unmounted, so
   * the browser keeps focus on it across the transition with nothing to
   * restore.
   */
  const toggle = useCallback(() => {
    setCollapsed((was) => {
      const next = !was;
      const root = document.documentElement;
      if (next) root.setAttribute(SIDEBAR_ATTR, "collapsed");
      else root.removeAttribute(SIDEBAR_ATTR);
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded");
      } catch {
        // Storage disabled. The choice still applies for this page.
      }
      return next;
    });
  }, []);

  /** The narrow-viewport drawer's escape hatches, and the focus it owes back. */
  const closeDrawer = useCallback((restoreFocus: boolean) => {
    setDrawerOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  return (
    <div className="admin" data-drawer={drawerOpen ? "open" : undefined}>
      {/* Before the sidebar, so the attribute is set before it is painted. */}
      <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />

      {/*
        THE FULL-WIDTH HEADER, above both columns.

        It used to live inside .admin-main, which put it in the right-hand
        column and made the mark's position a function of the sidebar's width.
        Spanning both columns is what lets the mark land at the same
        coordinates as the public header by construction rather than by tuning.
      */}
      <header className="admin-topbar">
        {/*
          The identity block, at the public header's treatment. The component is
          imported, never copied, so check:logo covers this instance too.

          It links to /admin, the home of the plane you are on, mirroring the
          public mark's link to / rather than copying its destination. Crossing
          planes is what View site in the sidebar foot is for.
        */}
        <Link to="/admin" className="admin-brand">
          {/* Decorative: the link's accessible name is the wordmark beside it,
              so naming the mark too would say it twice. */}
          <SiteLogoHeader className="admin-brand-mark" />
          {SITE.name}
        </Link>
        <span className="admin-topbar-scope">Private plane</span>

        <div className="admin-topbar-user">
          <button
            ref={menuButtonRef}
            type="button"
            className="admin-menu-button"
            aria-expanded={drawerOpen}
            aria-controls="admin-sidebar"
            aria-label="Admin sections"
            onClick={() => setDrawerOpen(true)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="muted">{loaderData.email}</span>
          <Form method="post" action="/admin/logout">
            <button type="submit" className="admin-signout">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Sign out
            </button>
          </Form>
        </div>
      </header>

      <aside className="admin-sidebar" id="admin-sidebar">
        {/* The brand moved to the topbar, which spans both columns now, so the
            mark sits at the same coordinates on both planes. The rail's top
            gains the space it used to occupy. */}
        <nav className="admin-nav" aria-label="Admin sections">
          {NAV.map((item) => {
            const drift = item.drift ? loaderData.askDrift : 0;
            const name = navName(item.label, drift);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                /*
                  The accessible name is on the element, always, so it survives
                  the label being hidden in the rail. `title` is the sighted
                  tooltip the ruling asks for; it is redundant beside a visible
                  label and native, which is the trade taken rather than a
                  custom tooltip that would have to reimplement dismissal.
                */
                aria-label={name}
                title={name}
              >
                <Glyph>{item.icon}</Glyph>
                <span className="admin-nav-label">{item.label}</span>
                {/* Zero renders NOTHING, rather than a 0 badge: a count of
                    nothing is not news, and a permanent badge stops being a
                    signal. aria-hidden because the name above already says it
                    in words. */}
                {drift > 0 ? (
                  <span className="admin-nav-badge" aria-hidden="true">
                    {drift}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        {/*
          The foot is a ZONE, not two more sections. Both items leave the list
          of places you can be: one crosses to the public plane, the other
          changes the rail itself. A hairline above the group says that, and is
          why they take the nav item's shape without joining the nav's list.
        */}
        <div className="admin-sidebar-foot">
          {/*
            The nav item treatment, per the polish ruling, so it stops reading
            as a footnote under the sections. The glyph carries the signal that
            this leaves the plane; the accessible name says it in words, because
            an arrow leaving a box is not a name.
          */}
          <a
            className="admin-view-site"
            href="/"
            aria-label="View site, leaves the admin"
            title="View site, leaves the admin"
          >
            <svg
              className="admin-nav-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
            <span className="admin-nav-label">View site</span>
          </a>

          {/*
            Persistent, never hover-only, and the chevron points at what
            pressing it DOES: left to collapse, right to expand. One glyph
            rotated by CSS off the same attribute, so the markup does not branch
            and the node is never replaced.

            It takes the standard item shape rather than centring itself: as a
            lone centred glyph it lined up with nothing above it and read as a
            decoration on the rail's floor rather than a control. Its label is
            the VERB, so expanded it reads "Collapse" beside the arrow and the
            rail hides the word exactly as it hides every other one.
          */}
          <button
            ref={toggleRef}
            type="button"
            className="admin-sidebar-toggle"
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggle}
          >
            <svg
              className="admin-nav-icon admin-sidebar-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            {/* The verb, never "Expand": in the state where the word is
                visible, the action available is collapsing. */}
            <span className="admin-nav-label">Collapse</span>
          </button>
        </div>
      </aside>

      {/* Narrow viewports only. Closes the drawer and hands focus back. */}
      <div
        className="admin-drawer-backdrop"
        onClick={() => closeDrawer(true)}
        aria-hidden="true"
      />

      <div className="admin-main">
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
