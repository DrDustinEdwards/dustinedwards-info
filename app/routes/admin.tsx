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
import { timed, timingsContext } from "~/lib/timing";
import { askDriftCount, askStatusContext, askStatusReader } from "~/lib/search/ask.server";
import type { Route } from "./+types/admin";
import type { loader as rootLoader } from "~/root";

/*
 * THE ADMIN PLANE'S CSS, and this import is what keeps it off the public plane.
 *
 * `app/app.css` used to import all sixteen stylesheets, so every reader of the
 * home page downloaded the media library and the post editor: 109,318 built
 * bytes, 62% of them admin. This route is the layout every `/admin/*` child
 * nests under, so importing here covers the whole subtree exactly once. Vite
 * emits a separate chunk and React Router links it only on matched routes.
 *
 * `/login` imports it too and is the one other place that may; see app/admin.css.
 */
import "~/admin.css";

export function meta() {
  return [{ title: "Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * The admin plane HYDRATES, and this is the one flag that says so for the
 * whole /admin subtree: root's Layout renders <Scripts> only when a match
 * carries it, and a layout match covers every child. The public plane stopped
 * hydrating 2026-08-26; the admin plane is rule 9's stated exemption and its
 * cockpit is real client UI (editor, media library, bulk actions).
 */
export const handle = { hydrate: true };

/**
 * One gate for the whole /admin subtree. Runs before every child loader and
 * action; anyone without the single-admin session is 302'd to the login
 * screen. The verified session is stashed on the context so children read it
 * without a second lookup.
 *
 * **TWO WAYS IN SINCE 2026-08-24, and only one of them may write.** The human
 * admin arrives with a Better Auth session and is unchanged. A machine may
 * instead present the read-only SMOKE bearer token, which gets GET and HEAD and
 * is refused every other method here, before any child runs. That refusal is
 * the enforcement point for the whole plane's action surface, because route
 * actions do not consult a policy module; the capability table covers the
 * publish path and this covers the rest. Grounds: `app/lib/smoke.server.ts`.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const env = getEnv(context);
    /*
     * INSTRUMENTATION, READ RATHER THAN CREATED, since 2026-08-27.
     *
     * This middleware used to make its own collector. Root's middleware makes
     * one for every route on the site now, and root runs first, so creating a
     * second here would REPLACE the array root had already put in the context
     * and discard anything recorded before this point. Reading it keeps one
     * owner and keeps the auth gate's marks in the same list as everything
     * else, which is the whole reason this was the one cost worth measuring:
     * no child loader can see it.
     */
    const timings = context.get(timingsContext).timings;
    const session = await getAdminSession(env, request, timings);
    if (session) {
      context.set(adminSessionContext, session);
      context.set(adminActorContext, { kind: "admin", email: session.user.email });
    } else {
      /*
       * THE SMOKE DOOR, and it is only reachable with no admin session.
       *
       * Ordered this way so the human path is untouched: a browser request
       * carries no `Authorization` header, `authenticateSmoke` returns `absent`
       * without reading the secret or touching the limiter, and the redirect
       * below is the same redirect as before this existed.
       */
      const smoke = await authenticateSmoke(env, request);
      if (smoke.kind === "refused") {
        /*
         * A PRESENTED CREDENTIAL GETS AN ANSWER, not a login page. Whoever set
         * SMOKE_TOKEN in CI is entitled to know whether it was rejected, not
         * configured, or rate limited, because those need three different
         * repairs and a 302 to /login names none of them.
         *
         * `no-store` and `noindex` on the same grounds as the operator API: it
         * is an authenticated surface behind a secret.
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
       * READ ONLY, AND THIS IS WHERE IT IS ENFORCED FOR THE WHOLE PLANE.
       *
       * The capability table in `publish-policy.mjs` refuses the smoke actor
       * from `decide()` and `decideDelete()`, which covers the publish path. It
       * does NOT cover the eleven media intents, the tag writes, the trash, the
       * rebuild, or any action added tomorrow: those are route actions that
       * never consult a policy module. So the method itself is the gate, at the
       * one place every `/admin/*` action must pass through.
       *
       * **A METHOD ALLOWLIST, NOT A DENYLIST.** GET and HEAD are named and
       * everything else is refused, so a route that starts answering PUT or
       * DELETE tomorrow is refused on the day it is written rather than on the
       * day someone remembers to add it here. That inversion is the whole
       * point: hard rule 19's chain is ordered for the same reason, and this
       * repo's recorded failure shape is a fix landing in N-1 of N sites.
       *
       * Refused BEFORE `next()`, so no child loader, action, or middleware runs
       * and nothing has read a row by the time the refusal is written.
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
       * THE SAME EMAIL THE ADMIN SEES, and it is the stated residue rather than
       * an oversight. The topbar's binding constraint at narrow widths IS this
       * string; a placeholder here would silently change the measurement the
       * whole credential exists to take. Grounds on the `smoke` capability row.
       */
      context.set(adminActorContext, { kind: "smoke", id: smoke.id, email: smoke.email });
    }
    // Lazy and memoized: this layout's loader wants a drift COUNT for the nav
    // badge and /admin/posts wants the full status for its alert. Sharing the
    // reader means one listing per request rather than two, and a route that
    // never asks for it never pays for it.
    //
    // The per-request ARTIFACT reader that used to be installed beside it is
    // gone with the committed artifact itself: the citation scan reads
    // `posts.body` out of D1 now, so there is no 600KB GitHub round trip left
    // to deduplicate.
    context.set(askStatusContext, askStatusReader(env, timings));
    return next();
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  /*
   * THE LAYOUT LOADER RUNS ON EVERY ADMIN REQUEST, and until now nothing in it
   * was measured. A trivial admin route costs ~1150ms against 233ms for a
   * public one, and `auth_getsession` accounts for 57ms of that gap; the rest
   * is these two calls and neither had a name.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  /*
   * IN PARALLEL, because they were strictly serial and share nothing.
   *
   * `ask` was awaited on its own line and `counts` was awaited inside the
   * returned object literal, and an object literal evaluates its properties in
   * order. So the D1 nav-count query did not start until the Ask drift check
   * had finished, and the drift check is the slow one. Neither reads the
   * other's result; the only reason for the ordering was where the lines
   * happened to sit.
   */
  /*
   * THE BADGE READS A CACHED COUNT, NOT THE INDEX.
   *
   * `askDriftCount` returns from KV on a hit and never touches AI Search.
   * That is the fix: the listing's cost is per-call variance of 46 to 2055ms,
   * measured, so removing the call from the read path is the only thing that
   * moves the tail. Making it cheaper does not: both pages of the pagination
   * cost about 72ms and dropping one leaves the tail where it was.
   *
   * The layout wants ONE INTEGER. `/admin/posts` still calls the full reader
   * on `askStatusContext` for its repair alert, uncached, because the page
   * that fixes drift must not act on a number up to five minutes old. The
   * reader stays on the context for exactly that caller.
   */
  const [drift, counts] = await Promise.all([
    /*
     * The ExecutionContext travels with the env because the miss path finishes
     * its cache write on `waitUntil`. It is required rather than optional so
     * this call site cannot quietly go back to a floating write.
     */
    timed(timings, "layout_ask_drift", () =>
      askDriftCount(getEnv(context), getExecutionContext(context), timings),
    ),
    timed(timings, "layout_nav_counts", () => adminNavCounts(getEnv(context))),
  ]);
  const payload = {
    email: context.get(adminActorContext).email,
    /**
     * THE NAV COUNTS, and there are TWO of them rather than the mockup's four.
     *
     * The mockup badged four: Sites, Content, Posts and Media. Two of those
     * sections no longer exist. Both were stubs that could only ever have
     * badged the length of a hardcoded array, and a numeral in the sidebar is
     * read as a measurement, so they were deleted rather than finished.
     *
     * Posts and Media are real rows in D1, so these two are real numbers. The
     * nav carries exactly the counts something has counted.
     */
    counts,
    /**
     * ONE number, not the status object. The badge is a count and the repair
     * lives on /admin/posts, so shipping the key lists to every admin page
     * would be payload the shell has no use for.
     *
     * Drift counts in BOTH directions, exactly as the alert reports it: an item
     * the corpus does not know about is as much a defect as a record the index
     * lacks.
     */
    /*
     * NULL BECOMES 0, which renders NO BADGE rather than a clean one.
     *
     * `navName` treats 0 as "nothing to report" and omits the count entirely,
     * so an unavailable index and an index in agreement look the same to a
     * reader. That was already true before the cache and is the honest
     * rendering of "no evidence": the alternative is a numeral asserting
     * agreement nobody measured.
     */
    askDrift: drift ?? 0,
    /**
     * How stale that number may be, in seconds, for the reader.
     *
     * TIER 1.5 FORBIDS ADDING A CACHE TO HIDE A SLOW PATH WITHOUT SAYING SO,
     * and a comment in the source says it to the next engineer, not to the
     * operator looking at the badge. So the number travels to the UI and the
     * badge's own title states it. The repair lives on /admin/posts, which
     * computes fresh.
     */
    askDriftMaxAgeSeconds: DRIFT_CACHE_TTL_SECONDS,
  };

  /*
   * THE LAYOUT'S OWN TOTAL, and it is what makes the other routes' arithmetic
   * close.
   *
   * The layout's marks ride along on EVERY admin response, because `timings`
   * is one array shared through context. So a breakdown of `/admin/posts.data`
   * that adds up the marks it can see was adding LAYOUT time to ROUTE time and
   * calling the total attributed. Worse, the layout's two big marks run in
   * PARALLEL and `drift_cache_read` NESTS inside `layout_ask_drift`, so summing
   * them overcounts twice over.
   *
   * MEASURED 2026-08-21 against production: summing the layout marks on
   * /admin.data gave 313ms against a 283ms TTFB, which is arithmetic claiming
   * more time than the request took. With this mark, every admin route reads
   * as `layout_total` + its own `loader_total` + whatever is left, and the
   * leftover is the response path rather than a rounding error.
   */
  timings?.push({ name: "layout_total", ms: performance.now() - loaderStart });

  return data(payload);
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
  posts: (
    <>
      <path d="M4 5h16M4 10h16M4 15h11M4 20h7" />
    </>
  ),
  /**
   * Ascending bars on a baseline, which is what the panel draws.
   *
   * Chosen against the six already here: Content is a document, Posts is a
   * stack of lines, Sites is a globe, Media is a picture and Tools is a slider
   * row. A bar chart shares no silhouette with any of them at 20px.
   */
  traffic: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-5M12 20v-9M17 20v-13" />
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
  // `drift` is the ALARM, and it is a fact about the post corpus with its
  // repair on this page. `count` is the neutral size of the section. They are
  // different claims and they render differently; see `navName` below.
  { to: "/admin/posts", label: "Posts", icon: ICONS.posts, drift: true, count: "posts" },
  // After Posts and before Tools, because it is content the posts consume
  // rather than an admin control. Until now /admin/media existed and loaded but
  // NOTHING linked to it: the sidebar had five items, none of them Media, and
  // no item even marked itself active while the page was open, so the library
  // was reachable only by typing the URL.
  { to: "/admin/media", label: "Media", icon: ICONS.media, count: "media" },
  // Reading rather than editing, so it sits after the content items and before
  // the controls. The label matches the panel heading exactly: this counts
  // origin requests, and calling the nav item anything shorter would put a
  // claim in the sidebar that the page spends a caption correcting.
  { to: "/admin/origin-requests", label: "Origin requests", icon: ICONS.traffic },
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
/**
 * The nav item's accessible name, and where the CACHING IS STATED TO THE READER.
 *
 * Tier 1.5 forbids adding a cache to hide a slow path without saying so. A
 * source comment says it to the next engineer; this says it to the operator
 * looking at the badge, which is the person who would otherwise act on a number
 * without knowing how old it can be.
 *
 * Only on the drifted branch, deliberately. A badge showing nothing has nothing
 * to qualify, and appending an age to every nav item would be noise on five
 * links that carry no cached value at all.
 *
 * The wording names the authority as well as the age, because "up to 5 minutes
 * old" invites the question this sentence should already answer: the repair
 * page recomputes, so that is where to go and what to trust.
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
 * Sign out, in the two places the topbar renders it: the wide bar, and the
 * overflow menu it folds into below 640px.
 *
 * ONE STATEMENT OF THE FORM, because both sites are the same action and the
 * responsive fold is the only reason there are two. A copied `<Form>` is a
 * second owner of the logout route and of the fact that this must be a POST;
 * the two would drift on the day one of them gained a confirmation or a
 * redirect target.
 *
 * A REAL FORM in both branches, deliberately. `menu` changes the presentation
 * and nothing else: it is still `method="post"` to the same action, so the
 * folded control works with scripting off exactly as the wide one does, which
 * is what rule 9 requires of a door on a page a reader can reach.
 */
function SignOutForm({ menu = false }: { menu?: boolean }) {
  return (
    <Form method="post" action="/admin/logout">
      {/*
        THE NAME IS "Sign out" IN BOTH VARIANTS, and it took an explicit label
        to make that true. The hint below is a CHILD of the button, so name-from-
        content swallowed it: measured 2026-08-26 by check:browser, the folded
        button's accessible name was "Sign outEnds this session. You will need to
        sign in again with Google." A submit control named with a whole sentence
        is a defect on its own, and it also broke the property the fold exists to
        have, which is that the menu holds the SAME control the bar does rather
        than a second one that has drifted.

        `aria-describedby` keeps the sentence, as a DESCRIPTION, which is what it
        always was: announced after the name, after a pause, and skippable. No
        pixel moves, because the span stays exactly where the design put it.
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
   * The CSP nonce, from the root loader through useRouteLoaderData, the same
   * channel Layout and BlogSpeculation use. Read OPTIONALLY for the reason they
   * do: on the error boundary path the root loader never ran, and a made-up
   * fallback nonce would be worse than none.
   *
   * The inline script below was UN-NONCED until 2026-08-11, found by the
   * external audit. workers/app.ts said the shared-cache nonce lifetime was THE
   * ONLY thing blocking CSP enforcement; this was a second blocker, sitting on
   * an admin page that a Report-Only window walking public routes would never
   * have reported.
   */
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
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
      <script nonce={rootData?.nonce} dangerouslySetInnerHTML={{ __html: NO_FLASH }} />

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
          {/* WRAPPED so it can truncate. A bare text node cannot carry
              `text-overflow`, and below 576px the wordmark is the widest thing
              in the bar that is safe to give up: the mark beside it still
              identifies the plane and the link keeps its accessible name. */}
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
          {/* `.muted` is the colour and `.admin-topbar-email` is the box. Split
              because the truncation below needs a selector that means THIS
              element, and `.muted` is used all over the admin plane. */}
          <span className="muted admin-topbar-email">{loaderData.email}</span>
          <SignOutForm />
          {/*
            THE FOLD, below 640px. Grounds: decisions vol 8, 2026-08-25.

            The wide bar above and this menu below are BOTH in the document and
            CSS picks one, which is the only arrangement that works with no
            script: a JS-measured breakpoint would leave a scriptless reader
            with whichever branch the server guessed. `display: none` takes the
            hidden branch out of the accessibility tree too, so exactly one
            email and one Sign out are ever exposed.

            The menu is the EXISTING OverflowMenu, not a new pattern, and the
            sign-out inside it is a real `<Form method="post">` submit button,
            so rule 9 holds on the folded side as well: the menu opens with no
            script because it is a `<details>`, and the button posts with no
            script because it is a form.
          */}
          <div className="admin-topbar-account">
            <OverflowMenu label="Account">
              {/* The signed-in address, as INFORMATION. It is the one thing the
                  wide bar shows that is not a control, so it stays visible
                  rather than being dropped: knowing which account you are in is
                  the reason it was ever in the bar. */}
              <p className="admin-account-identity">{loaderData.email}</p>
              <SignOutForm menu />
            </OverflowMenu>
          </div>
        </div>
      </header>

      <aside className="admin-sidebar" id="admin-sidebar">
        {/* The brand moved to the topbar, which spans both columns now, so the
            mark sits at the same coordinates on both planes. The rail's top
            gains the space it used to occupy. */}
        <nav className="admin-nav" aria-label="Admin sections">
          {NAV.map((item) => {
            const drift = item.drift ? loaderData.askDrift : 0;
            /* `null` means this section HAS no count, which is not the same as
               a count of zero and must not render as one. Sites and Content are
               stubs; see the loader. */
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
                {/*
                  THE COUNT AND THE DRIFT BADGE ARE DIFFERENT CLAIMS, so they
                  are different elements and they can both be present.

                  The count is how big the section is: quiet, plain, always
                  true. The badge is an alarm that something needs repairing,
                  and it keeps the warning fill it has always had. Collapsing
                  them into one numeral was the alternative and it is worse in
                  both directions: styling the count like an alarm cries wolf on
                  every page, and hiding the count whenever drift appeared would
                  remove a fact exactly when somebody is looking at the section.

                  A count of ZERO still renders, unlike the badge. "0" is a real
                  and useful answer to "how many posts are there"; a badge of
                  zero is an alarm about nothing.
                */}
                {count !== null ? (
                  <span className="admin-nav-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
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
        {/* id="main" for root's unconditional skip link. The admin plane had
            the same dead hash as /login and the error boundary; found by
            check:invariants section 12 rather than by the audit. */}
        <main className="admin-content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
