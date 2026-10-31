import { useEffect } from "react";
import { Form, Outlet, data, isRouteErrorResponse, useLocation, useRouteLoaderData } from "react-router";
import { Empty } from "capsomer/react/empty";
import { MessageProvider } from "capsomer/react/message";
import { AdminShell, FIRST_PAGE, type AdminEntry } from "capsomer/react/admin-shell";

import { Icon, THEME_SCRIPT, shellLink } from "~/components/admin/shell-parts";
import { suggest } from "~/lib/search-suggest";
import { SITE, SITE_ORIGIN } from "~/lib/seo";
import { adminNavCounts } from "~/db";
import { accessIdentity, logRefusal, refusal } from "~/lib/access.server";
import { adminActorContext } from "~/lib/admin-actor.server";
import { authenticateSmoke } from "~/lib/smoke.server";
import { SMOKE_READ_ONLY_POLICY } from "~/lib/editor/publish-policy.mjs";
import { getEnv, getExecutionContext } from "~/lib/context";
import { DRIFT_CACHE_TTL_SECONDS } from "~/lib/search/ask-guard.server";
import { isolationVerdict, originRefusal, refuseCrossSite } from "@dustinedwards/site-runtime/origin";
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
import "capsomer/fonts.css";
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
    const refused = refuseCrossSite(request);
    if (refused) {
      logRefusal(request, "admin", "cross-site", refused.status);
      return refused;
    }
    /* Resource isolation: another site may link to an admin page and nothing more, never load one as a subresource. */
    if (!isolationVerdict(request).ok) {
      const isolated = originRefusal();
      logRefusal(request, "admin", "cross-site-load", isolated.status);
      return isolated;
    }

    /* Read, not created: root's middleware made one first, and a second would discard its marks. */
    const timings = context.get(timingsContext).timings;
    const access = await timed(timings, "auth_access", () => accessIdentity(env, request));
    if (access.kind === "refused") {
      /* A presented token that fails is an answer, like a refused smoke bearer: it is not a login page.
         A verified person off ADMIN_EMAILS is a 403: Access let them in, this site does not. */
      const notAdmin = access.reason === "not-admin";
      throw refusal(
        request,
        "admin",
        access.reason,
        notAdmin ? 403 : 401,
        notAdmin ? "Refused: this account is not an administrator of this site." : `Refused: the Cloudflare Access token did not verify (${access.reason}).`,
      );
    }
    if (access.kind === "human") {
      context.set(adminActorContext, { kind: "admin", email: access.email });
    } else {
      /* A browser sends no `Authorization` header, so `authenticateSmoke` returns `absent` untouched. */
      const smoke = await authenticateSmoke(env, request);
      if (smoke.kind === "refused") {
        /* A presented credential gets an answer, not a login page: each failure needs a different repair. */
        if (smoke.status === 401) logRefusal(request, "admin", "smoke-token", 401);
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
        throw refusal(request, "admin", "no-access-token", 403, `Admin signs in at ${SITE_ORIGIN}/admin, through Cloudflare Access.`);
      }

      /* An allowlist, not a denylist: a route answering PUT tomorrow is refused the day it is written. */
      if (request.method !== "GET" && request.method !== "HEAD") {
        throw refusal(
          request,
          "admin",
          "smoke-read-only",
          403,
          `Refused (${SMOKE_READ_ONLY_POLICY}): the smoke credential is READ ONLY. ` +
            `${request.method} is not available to it on any admin route. ` +
            `It may render pages and it may not change anything.`,
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
     * The badge reads a cached count from KV, never AI Search. /admin/tools calls the reader uncached,
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

const ICONS = {
  overview: <Icon d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  mentions: <Icon d="M4 5h16v11H11l-5 4v-4H4z" />,
  media: <Icon d="M3 5h18v14H3zM3 17l6-6 4 4 3-3 5 5M16.5 9.5h.01" />,
  kb: <Icon d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />,
  tools: <Icon d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h10M18 17h2M16 5v4M9 10v4M16 15v4" />,
};

/** Count included as words: a bare numeral announces "Posts 3", which names no unit. */
function countNote(count: number | null, drift: number | null, maxAgeSeconds: number) {
  const size = count === null ? "" : count === 1 ? "item" : "items";
  const lead = size ? `${size}, ` : "";
  if (drift === null) {
    return `${lead}Ask index drift unknown: the check failed or ran out of time. Open Tools to check it.`;
  }
  if (drift <= 0) return size;
  const minutes = Math.round(maxAgeSeconds / 60);
  const age = minutes >= 1 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${maxAgeSeconds} seconds`;
  return (
    `${lead}${drift} Ask index item${drift === 1 ? "" : "s"} drifted. ` +
    `This count is up to ${age} old; open Tools for the current figure and the repair.`
  );
}


const RouterLink = shellLink("/admin");

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
    { id: "overview", label: FIRST_PAGE, href: "/admin", icon: ICONS.overview, current: pathname === "/admin" },
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
    // No count: the tabs on the page count each base, and the rail needs no second read of the table.
    {
      id: "kb",
      label: "Knowledge Base",
      href: "/admin/kb",
      group: "Content",
      icon: ICONS.kb,
      current: at("/admin/kb"),
    },
    // Carries the answer index drift: the repair is on this page.
    {
      id: "tools",
      label: "Tools",
      href: "/admin/tools",
      group: "Site",
      icon: ICONS.tools,
      current: at("/admin/tools"),
      countNote: countNote(null, askDrift, askDriftMaxAgeSeconds) || undefined,
      tone: askDrift === null || askDrift > 0 ? "warn" : undefined,
    },
  ];
  /* The tab title is "<page> · dustinedwards.info": the menu entry the reader is in names the page. */
  const page = nav.find((entry) => entry.current)?.label;

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
        app="info"
        letterhead
        search={{ action: "/search", label: "Search dustinedwards.info", suggest }}
        page={page}
        nav={nav}
        tabs={nav.slice(0, 5)}
        renderLink={RouterLink}
        viewSite="/"
        account={{
          name: SITE.name,
          initials: INITIALS,
          role: "Admin",
          email: loaderData.email,
          // Access owns the session: the logout route sends the browser to Access's own endpoint, which a
          // fetch cannot follow into a navigation, so a real form post (reloadDocument) does it.
          onSignOut: () => (document.getElementById(SIGN_OUT_FORM) as HTMLFormElement | null)?.requestSubmit(),
        }}
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
