import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  NavLink,
  Outlet,
  data,
  redirect,
  useRouteLoaderData,
} from "react-router";

import { OverflowMenu } from "~/components/admin/overflow-menu";
import { SiteLogoHeader } from "~/components/site-logo";
import { SITE } from "~/lib/seo";
import { adminNavCounts } from "~/db";
import { adminActorContext, adminSessionContext, getAdminSession } from "~/lib/auth.server";
import { authenticateSmoke } from "~/lib/smoke.server";
import { SMOKE_READ_ONLY_POLICY } from "~/lib/editor/publish-policy.mjs";
import { getEnv, getExecutionContext } from "~/lib/context";
import { DRIFT_CACHE_TTL_SECONDS } from "~/lib/search/ask-guard.server";
import { ORIGIN_REFUSAL, originVerdict } from "~/lib/origin.mjs";
import { timed, timedLoader, timingsContext } from "~/lib/timing";
import {
  askAvailable,
  askDriftCount,
  askStatusContext,
  askStatusReader,
} from "~/lib/search/ask.server";
import type { Route } from "./+types/admin";
import type { loader as rootLoader } from "~/root";

/*
 * This import keeps admin CSS off the public plane: every /admin/* child nests under this layout.
 * `/login` is the one other place that may import it.
 */
import "~/admin.css";

export function meta() {
  return [{ title: "Admin" }, { name: "robots", content: "noindex" }];
}

/** Root renders `<Scripts>` only when a match carries this flag. */
export const handle = { hydrate: true };

/**
 * Two ways in, only one may write: a Better Auth session, or the read-only smoke bearer, which
 * gets GET and HEAD and is refused every other method before any child runs.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const env = getEnv(context);

    /*
     * Covers resource routes, which the framework's document check never sees. Before the session
     * lookup, cheapest first. An absent Origin is allowed.
     */
    if (request.method !== "GET" && request.method !== "HEAD") {
      const verdict = originVerdict(request.headers.get("origin"), request.url);
      if (!verdict.ok) {
        return new Response(ORIGIN_REFUSAL, {
          status: 403,
          headers: { "cache-control": "no-store" },
        });
      }
    }

    /* Read, not created: root's middleware made one first, and a second would discard its marks. */
    const timings = context.get(timingsContext).timings;
    const session = await getAdminSession(env, request, timings);
    if (session) {
      context.set(adminSessionContext, session);
      context.set(adminActorContext, { kind: "admin", email: session.user.email });
    } else {
      /* A browser sends no `Authorization` header, so `authenticateSmoke` returns `absent` untouched. */
      const smoke = await authenticateSmoke(env, request);
      if (smoke.kind === "refused") {
        /* A presented credential gets an answer, not a login page: each failure needs a different repair. */
        throw new Response(smoke.error, {
          status: smoke.status,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "private, no-store",
            "x-robots-tag": "noindex, nofollow",
            ...(smoke.retryAfter ? { "retry-after": String(smoke.retryAfter) } : {}),
          },
        });
      }
      if (smoke.kind !== "ok") throw redirect("/login");

      /* An allowlist, not a denylist: a route answering PUT tomorrow is refused the day it is written. */
      if (request.method !== "GET" && request.method !== "HEAD") {
        throw new Response(
          `Refused (${SMOKE_READ_ONLY_POLICY}): the smoke credential is READ ONLY. ` +
            `${request.method} is not available to it on any admin route. ` +
            `It may render pages and it may not change anything.`,
          {
            status: 403,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "private, no-store",
              "x-robots-tag": "noindex, nofollow",
            },
          },
        );
      }

      /* The real email, not a placeholder: it is the topbar's binding width constraint, which this measures. */
      context.set(adminActorContext, { kind: "smoke", id: smoke.id, email: smoke.email });
    }
    // Lazy and memoized: one listing per request, and a route that never asks never pays.
    context.set(askStatusContext, askStatusReader(env, timings));
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    /*
     * The badge reads a cached count from KV, never AI Search. /admin/posts calls the reader uncached,
     * because the page that fixes drift must not act on a stale number.
     */
    const [drift, counts] = await Promise.all([
      /* The ExecutionContext travels because the miss path finishes its cache write on `waitUntil`. */
      timed(timings, "layout_ask_drift", () =>
        askDriftCount(getEnv(context), getExecutionContext(context), timings),
      ),
      timed(timings, "layout_nav_counts", () => adminNavCounts(getEnv(context))),
    ]);
    const payload = {
      email: context.get(adminActorContext).email,
      counts,
      /* Null only when Ask is on and the count failed or ran out of time: unknown, never a clean 0. */
      askDrift: askAvailable(getEnv(context)) ? drift : 0,
      askDriftMaxAgeSeconds: DRIFT_CACHE_TTL_SECONDS,
    };

    return data(payload);
    // The layout's own total: its marks run in parallel and one nests, so summing them overcounts.
  }, "layout_total");
}

/** localStorage, a per-device preference: the server cannot know it, hence the blocking script below. */
const SIDEBAR_KEY = "admin-sidebar";
const SIDEBAR_ATTR = "data-admin-sidebar";

/**
 * Sets the attribute before the sidebar paints, so nothing snaps after hydration. In the admin
 * layout, not root, so the public plane never carries it.
 */
const NO_FLASH = `try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_KEY)})==="collapsed"){document.documentElement.setAttribute(${JSON.stringify(SIDEBAR_ATTR)},"collapsed")}}catch(e){}`;

const ICONS = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  posts: (
    <>
      <path d="M4 5h16M4 10h16M4 15h11M4 20h7" />
    </>
  ),
  mentions: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />
    </>
  ),
  traffic: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-5M12 20v-9M17 20v-13" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 4.5-4.5 3 3 3.5-3.5 5 5" />
    </>
  ),
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
  { to: "/admin/posts", label: "Posts", icon: ICONS.posts, drift: true, count: "posts" },
  { to: "/admin/media", label: "Media", icon: ICONS.media, count: "media" },
  { to: "/admin/origin-requests", label: "Origin requests", icon: ICONS.traffic },
  // No count badge: a pending mention is not worth a third query on every admin page.
  { to: "/admin/mentions", label: "Mentions", icon: ICONS.mentions },
  { to: "/admin/tools", label: "Tools", icon: ICONS.tools },
];

/** Count included as words: a bare numeral announces "Posts 3", which names no unit. */
function navName(
  label: string,
  drift: number | null,
  count: number | null,
  maxAgeSeconds: number,
) {
  const size = count === null ? "" : `, ${count} item${count === 1 ? "" : "s"}`;
  if (drift === null) {
    return `${label}${size}, Ask index drift unknown: the check failed or ran out of time. Open Posts to check it.`;
  }
  if (drift <= 0) return `${label}${size}`;
  const minutes = Math.round(maxAgeSeconds / 60);
  const age = minutes >= 1 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${maxAgeSeconds} seconds`;
  return (
    `${label}${size}, ${drift} Ask index item${drift === 1 ? "" : "s"} drifted. ` +
    `This count is up to ${age} old; open Posts for the current figure and the repair.`
  );
}

function Glyph({
  children,
  className,
  strokeWidth = "1.75",
}: {
  children: React.ReactNode;
  /** Added to `admin-nav-icon`, never in place of it. */
  className?: string;
  strokeWidth?: string;
}) {
  return (
    <svg
      className={className ? `admin-nav-icon ${className}` : "admin-nav-icon"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function SignOutForm({ menu = false }: { menu?: boolean }) {
  return (
    <Form method="post" action="/admin/logout">
      {/*
       * An explicit label: the hint is a child of the button, so name-from-content swallowed it.
       * `aria-describedby` keeps the sentence as a description.
       */}
      <button
        type="submit"
        {...(menu
          ? {
              "data-menu-item": "",
              className: "overflow-menu-item",
              "aria-label": "Sign out",
              "aria-describedby": "admin-signout-hint",
            }
          : { className: "admin-signout" })}
      >
        {menu ? null : (
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
        )}
        Sign out
        {menu ? (
          <span className="overflow-menu-item-hint" id="admin-signout-hint">
            Ends this session. You will need to sign in again with Google.
          </span>
        ) : null}
      </button>
    </Form>
  );
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  /* Optional: on the error boundary path the root loader never ran, and a made-up nonce is worse than none. */
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  /** Initialized `false` to match the server, then corrected in a layout effect before paint. */
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    setCollapsed(document.documentElement.getAttribute(SIDEBAR_ATTR) === "collapsed");
  }, []);

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

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  /* Picking a section in the mobile drawer closes it and puts focus on the page it opens, not a hidden link. */
  const pickSection = useCallback(() => {
    if (!drawerOpen) return;
    setDrawerOpen(false);
    mainRef.current?.focus();
  }, [drawerOpen]);

  return (
    <div className="admin" data-drawer={drawerOpen ? "open" : undefined}>
      {/* Before the sidebar, so the attribute is set before it is painted. */}
      <script nonce={rootData?.nonce} dangerouslySetInnerHTML={{ __html: NO_FLASH }} />

      <header className="admin-topbar">
        <Link to="/admin" className="admin-brand">
          <SiteLogoHeader className="admin-brand-mark" />
          {/* Wrapped: a bare text node cannot carry `text-overflow`. */}
          <span className="admin-brand-name">{SITE.name}</span>
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
          <span className="muted admin-topbar-email">{loaderData.email}</span>
          <SignOutForm />
          {/*
           * Both branches are in the document and CSS picks one, so it works without script;
           * `display: none` also takes the hidden branch out of the accessibility tree.
           */}
          <div className="admin-topbar-account">
            <OverflowMenu label="Account">
              <p className="admin-account-identity">{loaderData.email}</p>
              <SignOutForm menu />
            </OverflowMenu>
          </div>
        </div>
      </header>

      <aside className="admin-sidebar" id="admin-sidebar">
        <nav className="admin-nav" aria-label="Admin sections">
          {NAV.map((item) => {
            const drift: number | null = item.drift ? loaderData.askDrift : 0;
            /* `null` means this section has no count, which must not render as zero. */
            const count = item.count
              ? loaderData.counts[item.count as keyof typeof loaderData.counts]
              : null;
            const name = navName(item.label, drift, count, loaderData.askDriftMaxAgeSeconds);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-label={name}
                title={name}
                onClick={pickSection}
              >
                <Glyph>{item.icon}</Glyph>
                <span className="admin-nav-label">{item.label}</span>
                {count !== null ? (
                  <span className="admin-nav-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
                {drift === null || drift > 0 ? (
                  <span className="admin-nav-badge" aria-hidden="true">
                    {drift ?? "?"}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-sidebar-foot">
          <a
            className="admin-view-site"
            href="/"
            aria-label="View site, leaves the admin"
            title="View site, leaves the admin"
          >
            <Glyph>
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </Glyph>
            <span className="admin-nav-label">View site</span>
          </a>

          <button
            type="button"
            className="admin-sidebar-toggle"
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggle}
          >
            <Glyph className="admin-sidebar-chevron" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </Glyph>
            <span className="admin-nav-label">Collapse</span>
          </button>
        </div>
      </aside>

      <div
        className="admin-drawer-backdrop"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <div className="admin-main">
        <main className="admin-content" id="main" ref={mainRef} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
