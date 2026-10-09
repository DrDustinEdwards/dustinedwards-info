import { useEffect } from "react";
import { Form, Link, Outlet, data, isRouteErrorResponse, useLocation, useRouteLoaderData } from "react-router";
import { Empty } from "capsomer/react/empty";
import { MessageProvider } from "capsomer/react/message";
import { AdminShell, type AdminEntry, type LinkProps } from "capsomer/react/admin-shell";
import { ThemeSwitch } from "capsomer/react/theme-switch";

import { SiteLogoHeader } from "~/components/site-logo";
import { SITE, SITE_ORIGIN } from "~/lib/seo";
import { adminNavCounts } from "~/db";
import { accessIdentity } from "~/lib/access.server";
import { adminActorContext, adminSessionContext } from "~/lib/admin-actor.server";
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
 * Sign-in is Cloudflare Access, in front of this layout, so no public route needs it.
 */
import "@fontsource/schibsted-grotesk/400.css";
import "@fontsource/schibsted-grotesk/500.css";
import "@fontsource/schibsted-grotesk/600.css";
import "@fontsource/schibsted-grotesk/800.css";
import "@fontsource/martian-mono/400.css";
import "@fontsource-variable/source-serif-4/index.css";
import "@fontsource-variable/source-serif-4/wght-italic.css";
import "~/admin.css";

export function meta() {
  return [{ title: "Admin" }, { name: "robots", content: "noindex" }];
}

/** Root renders `<Scripts>` only when a match carries this flag. */
export const handle = { hydrate: true };

/**
 * Two ways in, only the first may write: a person Cloudflare Access admitted (a verified signed
 * token, never the mere presence of a header), or the read-only smoke bearer, which gets GET and HEAD
 * and is refused every other method before any child runs.
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
    const access = await timed(timings, "auth_access", () => accessIdentity(env, request));
    if (access.kind === "refused") {
      /* A presented token that fails is an answer, like a refused smoke bearer: it is not a login page. */
      throw new Response(`Refused: the Cloudflare Access token did not verify (${access.reason}).`, {
        status: 401,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "private, no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      });
    }
    if (access.kind === "human") {
      context.set(adminSessionContext, { user: { email: access.email } });
      context.set(adminActorContext, { kind: "admin", email: access.email });
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
      if (smoke.kind !== "ok") {
        /* Access vouches for a person only on the apex's /admin; a request that reached here without it
           (workers.dev, a preview, or Access misconfigured) is told where the door is, never signed in. */
        throw new Response(`Admin signs in at ${SITE_ORIGIN}/admin, through Cloudflare Access.`, {
          status: 403,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "private, no-store",
            "x-robots-tag": "noindex, nofollow",
          },
        });
      }

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

/**
 * Capsomer's own one-liner (theme-switch.md), run before first paint so a remembered theme never
 * flashes the other one. The admin's nonce is what lets the policy run it.
 */
const THEME_SCRIPT =
  'try{var t=localStorage.getItem("cap-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}';

/* The shell's own family: a 24 box, a 1.6 stroke, drawn in currentColor (admin-shell.md, "Icons"). */
function Icon({ d }: { d: string }) {
  return (
    <svg className="cap-admin-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  overview: <Icon d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  posts: <Icon d="M6 3h8l5 5v13H6zM14 3v5h5M9 13h6M9 17h6" />,
  mentions: <Icon d="M4 5h16v11H11l-5 4v-4H4z" />,
  media: <Icon d="M3 5h18v14H3zM3 17l6-6 4 4 3-3 5 5M16.5 9.5h.01" />,
  tools: <Icon d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h10M18 17h2M16 5v4M9 10v4M16 15v4" />,
};

/** Count included as words: a bare numeral announces "Posts 3", which names no unit. */
function countNote(count: number | null, drift: number | null, maxAgeSeconds: number) {
  const size = count === null ? "" : count === 1 ? "item" : "items";
  if (drift === null) {
    return `${size}, Ask index drift unknown: the check failed or ran out of time. Open Posts to check it.`;
  }
  if (drift <= 0) return size;
  const minutes = Math.round(maxAgeSeconds / 60);
  const age = minutes >= 1 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${maxAgeSeconds} seconds`;
  return (
    `${size}, ${drift} Ask index item${drift === 1 ? "" : "s"} drifted. ` +
    `This count is up to ${age} old; open Posts for the current figure and the repair.`
  );
}

function RouterLink({ href, children, ...rest }: LinkProps) {
  // A link out of the admin is a document navigation: the public pages bring their own stylesheets, which
  // would otherwise be loaded beside Capsomer's.
  return (
    <Link to={href} reloadDocument={!href.startsWith("/admin")} {...rest}>
      {children}
    </Link>
  );
}

const SIGN_OUT_FORM = "admin-signout-form";

/** "Dustin Edwards" -> "DE": the avatar's letters, from the site's own name. */
const INITIALS = SITE.name
  .split(/\s+/)
  .map((word) => word[0])
  .filter(Boolean)
  .slice(0, 2)
  .join("")
  .toUpperCase();

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  /* Optional: on the error boundary path the root loader never ran, and a made-up nonce is worse than none. */
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const { pathname } = useLocation();
  const at = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  const { counts, askDrift, askDriftMaxAgeSeconds } = loaderData;
  const nav: AdminEntry[] = [
    { id: "overview", label: "Overview", href: "/admin", icon: ICONS.overview, current: pathname === "/admin" },
    {
      id: "posts",
      label: "Posts",
      href: "/admin/posts",
      group: "Content",
      icon: ICONS.posts,
      current: at("/admin/posts"),
      count: counts.posts ?? undefined,
      countNote: countNote(counts.posts, askDrift, askDriftMaxAgeSeconds),
      tone: askDrift === null || askDrift > 0 ? "warn" : undefined,
    },
    {
      id: "media",
      label: "Media",
      href: "/admin/media",
      group: "Content",
      icon: ICONS.media,
      current: at("/admin/media"),
      count: counts.media ?? undefined,
      countNote: countNote(counts.media, 0, askDriftMaxAgeSeconds),
    },
    // No count: a pending mention is not worth a third query on every admin page.
    {
      id: "mentions",
      label: "Mentions",
      href: "/admin/mentions",
      group: "Content",
      icon: ICONS.mentions,
      current: at("/admin/mentions"),
    },
    { id: "tools", label: "Tools", href: "/admin/tools", group: "Site", icon: ICONS.tools, current: at("/admin/tools") },
  ];
  const theme = rootData?.theme;

  /* The shell names `[` in the collapse control's tip and leaves binding it to the app. It presses that
     control, so the choice is remembered by the shell's own preference. Never while someone types. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "[" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable], .cm-editor")) return;
      document.querySelector<HTMLButtonElement>('[data-cap-part="menu-toggle"]')?.click();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <script nonce={rootData?.nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <AdminShell
        title="Site admin"
        mark={<SiteLogoHeader className="admin-brand-mark" />}
        apps={[{ id: "site", label: "Site admin", href: "/admin", mono: "D", current: true }]}
        nav={nav}
        tabs={nav.slice(0, 4)}
        more={nav.slice(4)}
        renderLink={RouterLink}
        account={{
          name: SITE.name,
          initials: INITIALS,
          role: "Admin",
          email: loaderData.email,
          appLinks: [{ label: "View site", href: "/" }],
          // Access owns the session: the logout route sends the browser to Access's own endpoint, which a
          // fetch cannot follow into a navigation, so a real form post (reloadDocument) does it.
          onSignOut: () => (document.getElementById(SIGN_OUT_FORM) as HTMLFormElement | null)?.requestSubmit(),
        }}
        status={<span className="cap-muted">Signed in as {loaderData.email}</span>}
        actions={<ThemeSwitch initial={theme === "light" || theme === "dark" ? theme : undefined} />}
        prefKey="admin-rail"
      >
        <MessageProvider>
          {/* The shell leaves the page frame to the app: padding, width and the gap between blocks are Capsomer's. */}
          <div className="cap-admin-page">
            <Outlet />
          </div>
        </MessageProvider>
      </AdminShell>
      <Form id={SIGN_OUT_FORM} method="post" action="/admin/logout" reloadDocument hidden />
    </>
  );
}

/*
 * The admin's own error page, in Capsomer: root's error page is the public site's and, with the public CSS
 * no longer loaded here, would show unstyled. It keeps the admin's link back to the Overview.
 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const known = isRouteErrorResponse(error);
  const title = known ? `${error.status} ${error.statusText}` : "Something went wrong";
  return (
    <main className="app-page">
      <Empty
        kind="failed"
        title={title}
        action={
          <a className="cap-btn" href="/admin">
            Go to the Overview
          </a>
        }
      >
        {known && typeof error.data === "string" ? error.data : "Nothing you wrote is lost."}
      </Empty>
    </main>
  );
}
