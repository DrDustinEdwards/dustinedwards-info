import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Form, Link, NavLink, Outlet, data, redirect, useRouteLoaderData } from "react-router";

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
import { timed, timingsContext } from "~/lib/timing";
import { askDriftCount, askStatusContext, askStatusReader } from "~/lib/search/ask.server";
import type { Route } from "./+types/admin";
import type { loader as rootLoader } from "~/root";

/*
 * THE ADMIN PLANE'S CSS, and this import is what keeps it off the public plane.
 * This route is the layout every `/admin/*` child nests under, so importing here
 * covers the whole subtree exactly once. `/login` imports it too and is the one
 * other place that may.
 */
import "~/admin.css";

export function meta() {
  return [{ title: "Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * The admin plane HYDRATES, and this is the one flag that says so for the whole
 * /admin subtree: root renders `<Scripts>` only when a match carries it. The
 * public plane does not; this is rule 9's stated exemption.
 */
export const handle = { hydrate: true };

/**
 * One gate for the whole /admin subtree, before every child loader and action.
 *
 * TWO WAYS IN, AND ONLY ONE MAY WRITE. The human admin arrives with a Better Auth
 * session. A machine may instead present the read-only SMOKE bearer, which gets
 * GET and HEAD and is refused every other method here, before any child runs.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const env = getEnv(context);

    /*
     * Covers RESOURCE ROUTES, which the framework's document check never sees: a
     * route with no default export is not a document request. BEFORE the session
     * lookup, the cheapest-first order hard rule 19 states. AN ABSENT ORIGIN IS
     * ALLOWED.
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

    /*
     * READ rather than created: root's middleware makes one for every route and runs
     * first, so creating a second here would REPLACE the array root had already put in
     * the context and discard anything recorded before this point.
     */
    const timings = context.get(timingsContext).timings;
    const session = await getAdminSession(env, request, timings);
    if (session) {
      context.set(adminSessionContext, session);
      context.set(adminActorContext, { kind: "admin", email: session.user.email });
    } else {
      /*
       * THE SMOKE DOOR, only reachable with no admin session. A browser carries no
       * `Authorization` header, so `authenticateSmoke` returns `absent` without
       * reading the secret or touching the limiter.
       */
      const smoke = await authenticateSmoke(env, request);
      if (smoke.kind === "refused") {
        /*
         * A PRESENTED CREDENTIAL GETS AN ANSWER, not a login page: rejected, not
         * configured and rate limited need three different repairs, and a 302 to /login
         * names none of them.
         */
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

      /*
       * READ ONLY FOR THE WHOLE PLANE. AN ALLOWLIST, NOT A DENYLIST, the inversion
       * hard rule 19 is ordered for: a route answering PUT tomorrow is refused the day it
       * is written. Refused BEFORE `next()`.
       */
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

      /*
       * THE SAME EMAIL THE ADMIN SEES, a stated residue rather than an oversight: the
       * topbar's binding constraint at narrow widths IS this string, and a placeholder
       * would change the measurement the credential exists to take.
       */
      context.set(adminActorContext, { kind: "smoke", id: smoke.id, email: smoke.email });
    }
    // Lazy and memoized: this loader wants a drift COUNT and /admin/posts wants the
    // full status, so sharing the reader means one listing per request rather than
    // two, and a route that never asks never pays.
    context.set(askStatusContext, askStatusReader(env, timings));
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * This loader runs on EVERY admin request, which is why both of its calls are
   * named.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  /*
   * IN PARALLEL, because neither reads the other's result: the only reason for the
   * old ordering was where the lines happened to sit.
   */
  /*
   * THE BADGE READS A CACHED COUNT, NOT THE INDEX: `askDriftCount` returns from KV
   * and never touches AI Search. /admin/posts still calls the full reader uncached,
   * because the page that fixes drift must not act on a stale number.
   */
  const [drift, counts] = await Promise.all([
    /*
     * The ExecutionContext travels with the env because the miss path finishes its
     * cache write on `waitUntil`. Required rather than optional, so this call site
     * cannot quietly go back to a floating write.
     */
    timed(timings, "layout_ask_drift", () =>
      askDriftCount(getEnv(context), getExecutionContext(context), timings),
    ),
    timed(timings, "layout_nav_counts", () => adminNavCounts(getEnv(context))),
  ]);
  const payload = {
    email: context.get(adminActorContext).email,
    /**
     * Posts and Media are real rows in D1, so these two are real numbers. The nav
     * carries exactly the counts something has counted: a numeral in the sidebar is
     * read as a measurement.
     */
    counts,
    /**
     * ONE number, not the status object: the badge is a count and the repair lives on
     * /admin/posts. It counts drift in BOTH directions, since an item the corpus does
     * not know about is as much a defect as a record the index lacks.
     */
    /*
     * NULL BECOMES 0, which renders NO BADGE rather than a clean one: an unavailable
     * index and an index in agreement look the same to a reader, and the alternative
     * is a numeral asserting agreement nobody measured.
     */
    askDrift: drift ?? 0,
    /**
     * TIER 1.5 FORBIDS ADDING A CACHE TO HIDE A SLOW PATH WITHOUT SAYING SO, and a
     * source comment says it to the next engineer rather than to the operator looking
     * at the badge. So the number travels and the badge's own title states it.
     */
    askDriftMaxAgeSeconds: DRIFT_CACHE_TTL_SECONDS,
  };

  /*
   * THE LAYOUT'S OWN TOTAL, and it is what makes the other routes' arithmetic
   * close. The layout's marks ride on every admin response, its two big marks run in
   * PARALLEL and one NESTS inside the other, so summing them overcounts twice over.
   */
  timings?.push({ name: "layout_total", ms: performance.now() - loaderStart });

  return data(payload);
}

/**
 * localStorage per the ruling: a per-device preference, not server state and not
 * a cookie. That has one consequence, and it is the whole reason for the script
 * below: the server cannot know the state, so without help the shell would render
 * expanded and snap narrow after hydration.
 */
const SIDEBAR_KEY = "admin-sidebar";
const SIDEBAR_ATTR = "data-admin-sidebar";

/**
 * Sets the attribute BEFORE the sidebar is painted, so nothing is corrected
 * afterwards. A blocking inline script, which this site otherwise avoids.
 *
 * It lives in the ADMIN layout, not in root, so the public plane never carries it.
 * The markup does not branch, so hydration has nothing to disagree about.
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
  posts: (
    <>
      <path d="M4 5h16M4 10h16M4 15h11M4 20h7" />
    </>
  ),
  /** A speech bubble, which is what a mention from another site is. */
  mentions: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" />
    </>
  ),
  /** Ascending bars on a baseline, which is what the panel draws. */
  traffic: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-5M12 20v-9M17 20v-13" />
    </>
  ),
  /**
   * A picture: frame, horizon, sun. Not a pencil, which reads as compose, and that
   * is Posts' job.
   */
  media: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 4.5-4.5 3 3 3.5-3.5 5 5" />
    </>
  ),
  /** Sliders, not a pencil: a pencil reads as COMPOSE, which is what Posts does. */
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
  // `drift` is the ALARM, a fact about the post corpus with its repair on this
  // page. `count` is the neutral size of the section. Different claims, so they
  // render differently.
  { to: "/admin/posts", label: "Posts", icon: ICONS.posts, drift: true, count: "posts" },
  // After Posts and before Tools, because it is content the posts consume rather
  // than an admin control.
  { to: "/admin/media", label: "Media", icon: ICONS.media, count: "media" },
  // The label matches the panel heading exactly: this counts origin requests, and
  // anything shorter would put a claim in the sidebar that the page spends a caption
  // correcting.
  { to: "/admin/origin-requests", label: "Origin requests", icon: ICONS.traffic },
  // NO COUNT BADGE: a pending mention is not urgent enough to make every admin page
  // pay for a third query. The page itself is where the queue is read.
  { to: "/admin/mentions", label: "Mentions", icon: ICONS.mentions },
  { to: "/admin/tools", label: "Tools", icon: ICONS.tools },
];

/**
 * The accessible name for a nav item, count included as WORDS. A badge that is
 * only a numeral announces "Posts 3", which names no unit and reads as a position
 * as easily as a quantity, so the digits are decoration over this string and the
 * numeral itself is aria-hidden.
 */
/**
 * Where the CACHING IS STATED TO THE READER. A source comment says it to the next
 * engineer; this says it to the operator looking at the badge, who would otherwise
 * act on a number without knowing how old it can be.
 *
 * Only on the drifted branch: a badge showing nothing has nothing to qualify.
 */
function navName(
  label: string,
  drift: number,
  count: number | null,
  maxAgeSeconds: number,
) {
  const size = count === null ? "" : `, ${count} item${count === 1 ? "" : "s"}`;
  if (drift <= 0) return `${label}${size}`;
  const minutes = Math.round(maxAgeSeconds / 60);
  const age = minutes >= 1 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${maxAgeSeconds} seconds`;
  return (
    `${label}${size}, ${drift} Ask index item${drift === 1 ? "" : "s"} drifted. ` +
    `This count is up to ${age} old; open Posts for the current figure and the repair.`
  );
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

/**
 * Sign out, in the two places the topbar renders it.
 *
 * ONE STATEMENT OF THE FORM, because a copied `<Form>` is a second owner of the
 * logout route. A REAL FORM in both branches: `menu` changes presentation only,
 * so the folded control works with scripting off exactly as the wide one does.
 */
function SignOutForm({ menu = false }: { menu?: boolean }) {
  return (
    <Form method="post" action="/admin/logout">
      {/*
       * THE NAME IS "Sign out" IN BOTH VARIANTS, and it took an explicit label: the
       * hint is a CHILD of the button, so name-from-content swallowed it.
       * `aria-describedby` keeps the sentence as a DESCRIPTION, announced after the
       * name and skippable.
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
  /*
   * The CSP nonce, read OPTIONALLY: on the error boundary path the root loader
   * never ran, and a made-up fallback nonce would be worse than none.
   */
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  /**
   * Initialized `false` so the hydration render matches the server's, then
   * corrected in a LAYOUT effect, which runs before paint. The width never depended
   * on this, so what it keeps honest is `aria-expanded`.
   */
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    setCollapsed(document.documentElement.getAttribute(SIDEBAR_ATTR) === "collapsed");
  }, []);

  /**
   * It does NOT move focus: the button is the same node before and after, never
   * unmounted, so the browser keeps focus on it with nothing to restore.
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
      <script nonce={rootData?.nonce} dangerouslySetInnerHTML={{ __html: NO_FLASH }} />

      {/*
       * THE FULL-WIDTH HEADER, above both columns. Spanning both is what lets the mark
       * land at the same coordinates as the public header by construction rather than by
       * tuning.
       */}
      <header className="admin-topbar">
        {/*
         * The component is imported, never copied, so check:logo covers this instance
         * too. It links to /admin, the home of the plane you are on.
         */}
        <Link to="/admin" className="admin-brand">
          {/* Decorative: the link's accessible name is the wordmark beside it,
              so naming the mark too would say it twice. */}
          <SiteLogoHeader className="admin-brand-mark" />
          {/*
           * WRAPPED so it can truncate: a bare text node cannot carry `text-overflow`,
           * and the mark beside it still identifies the plane.
           */}
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
          {/*
           * `.muted` is the color and `.admin-topbar-email` is the box: the truncation
           * needs a selector that means THIS element.
           */}
          <span className="muted admin-topbar-email">{loaderData.email}</span>
          <SignOutForm />
          {/*
           * THE FOLD. Both branches are in the document and CSS picks one, the only
           * arrangement that works with no script. `display: none` takes the hidden branch
           * out of the accessibility tree too, so exactly one of each is ever exposed.
           */}
          <div className="admin-topbar-account">
            <OverflowMenu label="Account">
              {/*
               * The signed-in address, as INFORMATION: it is the one thing the wide bar shows
               * that is not a control, and knowing which account you are in is why it is there.
               */}
              <p className="admin-account-identity">{loaderData.email}</p>
              <SignOutForm menu />
            </OverflowMenu>
          </div>
        </div>
      </header>

      <aside className="admin-sidebar" id="admin-sidebar">
        {/*
         * The brand moved to the topbar, which spans both columns, so the mark sits at
         * the same coordinates on both planes.
         */}
        <nav className="admin-nav" aria-label="Admin sections">
          {NAV.map((item) => {
            const drift = item.drift ? loaderData.askDrift : 0;
            /*
             * `null` means this section HAS no count, which is not the same as a count of
             * zero and must not render as one.
             */
            const count = item.count
              ? loaderData.counts[item.count as keyof typeof loaderData.counts]
              : null;
            const name = navName(item.label, drift, count, loaderData.askDriftMaxAgeSeconds);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                /*
                 * The accessible name is on the element, always, so it survives the label being
                 * hidden in the rail. `title` is the sighted tooltip, redundant beside a visible
                 * label and native.
                 */
                aria-label={name}
                title={name}
              >
                <Glyph>{item.icon}</Glyph>
                <span className="admin-nav-label">{item.label}</span>
                {/*
                 * THE COUNT AND THE DRIFT BADGE ARE DIFFERENT CLAIMS, so they are different
                 * elements and both can be present: the count is how big the section is, the badge
                 * is an alarm. A count of ZERO still renders, unlike the badge.
                 */}
                {count !== null ? (
                  <span className="admin-nav-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
                {/*
                 * Zero renders NOTHING rather than a 0 badge: a permanent badge stops being a
                 * signal. aria-hidden, because the name above already says it in words.
                 */}
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
         * The foot is a ZONE, not two more sections: both items leave the list of places
         * you can be.
         */}
        <div className="admin-sidebar-foot">
          {/*
           * The accessible name says it in words, because an arrow leaving a box is not a
           * name.
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
           * The chevron points at what pressing it DOES: left to collapse, right to expand,
           * one glyph rotated by CSS so the markup does not branch. Its label is the VERB.
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
        {/* `id="main"` for root's unconditional skip link. */}
        <main className="admin-content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
