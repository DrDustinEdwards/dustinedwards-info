import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Form, NavLink, Outlet, redirect } from "react-router";

import { SiteLogoHeader } from "~/components/site-logo";
import { adminSessionContext, getAdminSession } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
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
    const session = await getAdminSession(getEnv(context), request);
    if (!session) throw redirect("/login");
    context.set(adminSessionContext, session);
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  return { email: context.get(adminSessionContext).user.email };
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
  tools: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.9 9.9a2.1 2.1 0 0 1-3-3z" />
      <path d="M17.5 3.5 20.5 6.5" />
    </>
  ),
} as const;

const NAV = [
  { to: "/admin", label: "Overview", end: true, icon: ICONS.overview },
  { to: "/admin/sites", label: "Sites", icon: ICONS.sites },
  { to: "/admin/content", label: "Content", icon: ICONS.content },
  { to: "/admin/posts", label: "Posts", icon: ICONS.posts },
  { to: "/admin/tools", label: "Tools", icon: ICONS.tools },
];

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

      <aside className="admin-sidebar" id="admin-sidebar">
        {/*
          The site mark, imported rather than copied. It is the same component
          the public header renders, so the two planes cannot drift and
          check:logo covers both. It stays visible in either state and is the
          rail's top anchor when collapsed.
        */}
        <NavLink to="/admin" end className="admin-brand" aria-label="Cockpit, admin home">
          <SiteLogoHeader className="admin-brand-mark" />
          <span className="admin-brand-word">Cockpit</span>
        </NavLink>

        <nav className="admin-nav" aria-label="Admin sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              /*
                The accessible name is on the element, always, so it survives
                the label being hidden in the rail. `title` is the sighted
                tooltip the ruling asks for; it is redundant beside a visible
                label and native, which is the trade taken rather than a custom
                tooltip that would have to reimplement dismissal.
              */
              aria-label={item.label}
              title={item.label}
            >
              <Glyph>{item.icon}</Glyph>
              <span className="admin-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <a className="admin-view-site" href="/" title="View site">
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
              className="admin-sidebar-chevron"
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
        <header className="admin-topbar">
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
          <span className="admin-topbar-scope">Private plane</span>
          <div className="admin-topbar-user">
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
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
