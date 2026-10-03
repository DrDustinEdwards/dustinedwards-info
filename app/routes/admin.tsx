import { Form, Link, Outlet, data, useLocation, useRouteLoaderData } from "react-router";
import { MessageProvider } from "capsomer/react/message";
import { Shell, type LinkProps, type ShellEntry } from "capsomer/react/shell";
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

function Icon({ d }: { d: string }) {
  return (
    <svg className="cap-shell-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONS = {
  overview: <Icon d="M2.5 7.5 8 3l5.5 4.5V13h-3.5V9.5H6V13H2.5z" />,
  posts: <Icon d="M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 8.5h4M6 11h4" />,
  mentions: <Icon d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />,
  media: <Icon d="M2.5 3.5h11v9h-11zM2.5 11l3.5-3.5 2.5 2.5 2-2 3 3M10.5 6.2h.01" />,
  tools: <Icon d="M2.5 4.5h6M11.5 4.5h2M2.5 8h2M7.5 8h6M2.5 11.5h6M11.5 11.5h2M10 3v3M5.5 6.5v3M10 10v3" />,
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
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  /* Optional: on the error boundary path the root loader never ran, and a made-up nonce is worse than none. */
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const { pathname } = useLocation();
  const at = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  const { counts, askDrift, askDriftMaxAgeSeconds } = loaderData;
  const nav: ShellEntry[] = [
    { id: "overview", label: "Overview", href: "/admin", icon: ICONS.overview, current: pathname === "/admin" },
    {
      id: "posts",
      label: "Posts",
      href: "/admin/posts",
      icon: ICONS.posts,
      current: at("/admin/posts"),
      count: counts.posts,
      countNote: countNote(counts.posts, askDrift, askDriftMaxAgeSeconds),
      tone: askDrift === null || askDrift > 0 ? "warn" : undefined,
    },
    {
      id: "media",
      label: "Media",
      href: "/admin/media",
      icon: ICONS.media,
      current: at("/admin/media"),
      count: counts.media,
      countNote: countNote(counts.media, 0, askDriftMaxAgeSeconds),
    },
    // No count: a pending mention is not worth a third query on every admin page.
    { id: "mentions", label: "Mentions", href: "/admin/mentions", icon: ICONS.mentions, current: at("/admin/mentions") },
    { id: "tools", label: "Tools", href: "/admin/tools", icon: ICONS.tools, current: at("/admin/tools") },
  ];
  const theme = rootData?.theme;

  return (
    <>
      <script nonce={rootData?.nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <Shell
        brand={
          <>
            <SiteLogoHeader className="admin-brand-mark" />
            {SITE.name}
          </>
        }
        brandHref="/admin"
        nav={nav}
        tabs={nav.slice(0, 4)}
        more={nav.slice(4)}
        renderLink={RouterLink}
        status={
          <span className="cap-muted" data-hide="phone">
            {loaderData.email}
          </span>
        }
        actions={
          <>
            <a className="cap-btn" href="/" aria-label="View site, leaves the admin" data-hide="phone">
              View site
            </a>
            <ThemeSwitch initial={theme === "light" || theme === "dark" ? theme : undefined} />
            {/*
             * An explicit label: the sentence is the description, so the button keeps a short name.
             */}
            <Form method="post" action="/admin/logout">
              <button
                type="submit"
                className="cap-btn"
                aria-label="Sign out"
                aria-describedby="admin-signout-hint"
              >
                Sign out
              </button>
              <span className="cap-sr-only" id="admin-signout-hint">
                Ends this session. You will need to sign in again through Cloudflare Access.
              </span>
            </Form>
          </>
        }
        prefKey="admin-rail"
      >
        <MessageProvider>
          <Outlet />
        </MessageProvider>
      </Shell>
    </>
  );
}
