import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteLoaderData,
} from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { getNonce } from "~/lib/context";
import { SITE, SITE_ORIGIN } from "~/lib/seo";
import { themeAttribute, themeFromRequest } from "~/lib/theme";
import { timingsContext, wantsTiming, type Timings } from "~/lib/timing";

import type { Route } from "./+types/root";
import "./app.css";

/*
 * THE COMPONENT SHEETS, IN CASCADE ORDER. Grounds at the bottom of app.css.
 *
 * These were nine `@import` statements at the end of app.css until 2026-08-27.
 * CSS requires `@import` before every other rule and drops a late one; they had
 * been surviving on Tailwind's processor hoisting them, so removing Tailwind
 * took all nine sheets off the site while the build stayed green. Here they are
 * ordinary module imports, collected into the same root stylesheet in this
 * order, which is where they already sat in the cascade.
 *
 * THE ORDER IS LOAD-BEARING and is the order they were cut out of the original
 * 9,269-line app.css. Do not sort this list.
 */
import "./styles/public-chrome.css";
import "./styles/page-shell.css";
import "./styles/chrome-nav.css";
import "./styles/skip-link.css";
import "./styles/motion-print.css";
import "./styles/search-trigger.css";

/*
 * THE HASHED URL OF THE NORMAL FACE, so the preload below names the same bytes
 * app.css asks for. Imported rather than written out: the filename carries a
 * content hash, which is the whole reason self-hosting these could be made
 * immutable, and a hand-written path would be a second statement of it that
 * goes stale the day the font is replaced. Rule 17.
 */
import interNormalUrl from "./fonts/inter-latin-normal.woff2?url";

/**
 * Reads the theme cookie so the attribute is server-rendered.
 *
 * This is the entire flash-of-wrong-theme fix. There is no inline script and
 * nothing to correct after paint: the first byte of HTML already carries the
 * right attribute, or deliberately carries none so prefers-color-scheme
 * decides. Cookie parsing only, no binding and no I/O, so it costs nothing on
 * a route that does not care.
 */
/**
 * THE TIMING COLLECTOR, created ONCE per request, for every route on the site.
 *
 * `?timing=1` opts in and nothing else does. A request that did not ask carries
 * `undefined` all the way down, every `timed` call degrades to a plain call,
 * and no header is emitted, so the uninstrumented response is byte-identical to
 * what shipped before any of this existed.
 *
 * ## WHY IT MOVED HERE, 2026-08-27
 *
 * It was created in TWO places and reached a third of the site. `admin.tsx`
 * made one for the admin subtree, `blog._index.tsx` made a LOCAL one for
 * itself, and every other public route could call `timed` all it liked into an
 * `undefined` collector that nothing ever created. `/`, a post and `/search`
 * answered `?timing=1` with no header at all, which reads as "this route is
 * instant" rather than "this route is not instrumented".
 *
 * Root matches every route, so one middleware here covers the public plane and
 * the admin plane together, and `workers/app.ts` stamps the header from the
 * same array after the handler returns, which is the one point where it is
 * complete. `admin.tsx` no longer creates its own: a child that replaced this
 * array would silently discard whatever a parent had already recorded.
 *
 * MIDDLEWARE, NOT THE LOADER, and that is load-bearing rather than stylistic.
 * A loader runs alongside its siblings, so a collector created in one is not
 * visible to another; middleware runs BEFORE the whole matched tree.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const timings: Timings | undefined = wantsTiming(new URL(request.url)) ? [] : undefined;
    context.set(timingsContext, { timings });
    return next();
  },
];

export function loader({ request, context }: Route.LoaderArgs) {
  // The nonce is generated in `workers/app.ts` BEFORE the render and put in the
  // request context, because the same value has to appear in the CSP header and
  // on every script in this document. Carried through the loader because
  // `Layout` cannot reach the request context directly.
  return { theme: themeFromRequest(request), nonce: getNonce(context) };
}

export const links: Route.LinksFunction = () => [
  // Icons and the manifest live here rather than in the document head because
  // `links` from every matched route are merged, so these ride on every page.
  // `meta` is NOT merged, which is why the default social card is a constant in
  // seo.ts that each public route names for itself.
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
  /*
   * FEED AUTODISCOVERY, ON EVERY PAGE since 2026-08-27.
   *
   * These two lived on `/blog` alone, so a reader who arrived on a post, which
   * is where most readers arrive, saw a site with no feed. `links` from every
   * matched route are merged, which is exactly why the icons and the manifest
   * are here, and a feed is the same kind of fact about the site rather than
   * about the page.
   *
   * The `type` on the JSON one stays `application/feed+json` even though the
   * response now travels as `application/json` for compression: a reader scans
   * autodiscovery links for the FEED types, so this is what the resource is,
   * and the content-type is how it gets there. Grounds on the route.
   */
  {
    tagName: "link",
    rel: "alternate",
    type: "application/rss+xml",
    title: `${SITE.name} blog`,
    href: `${SITE_ORIGIN}/blog/rss.xml`,
  },
  {
    tagName: "link",
    rel: "alternate",
    type: "application/feed+json",
    title: `${SITE.name} blog`,
    href: `${SITE_ORIGIN}/blog/feed.json`,
  },
  /*
   * NO FONT LINKS, EXCEPT THIS PRELOAD. Inter is self-hosted since 2026-08-21;
   * the @font-face blocks are at the top of app.css. Removing the old links
   * took away two external preconnects and one render-blocking stylesheet, and
   * let style-src and font-src both drop to 'self'. None of that changes.
   *
   * ## WHY ONE LINK COMES BACK
   *
   * A font inside a stylesheet is discovered LATE: the browser has to fetch
   * app.css, parse it, match the rule, and only then start the download.
   * MEASURED cold on the throttled profile the audits used: the normal face is
   * 72,920 bytes of a 91 KB page, the largest single resource on every route,
   * and it spent 512 to 786 ms in flight after the stylesheet had already
   * arrived. The preload moves the request to the first byte of the document.
   *
   * ## THE NORMAL FACE ONLY
   *
   * The italic is 79,716 bytes and is needed by a page only if that page
   * renders italic latin text. Its `unicode-range` already makes the browser
   * fetch it on demand, and preloading it would download eighty kilobytes on
   * every route to serve the few that use it. A preload that is not used within
   * a few seconds is worse than no preload: the browser warns, and the bytes
   * competed with the ones that were needed.
   *
   * ## `crossorigin` IS MANDATORY AND IS NOT ABOUT CORS HERE
   *
   * Fonts are fetched in anonymous CORS mode whatever their origin, so a
   * preload without the attribute is a DIFFERENT request from the one the font
   * loader will make, and the browser fetches the file twice. Same-origin does
   * not exempt it.
   */
  {
    rel: "preload",
    href: interNormalUrl,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Layout also renders the error boundary, where the root loader may not have
  // run, so this reads the optional route data rather than useLoaderData. No
  // data means no attribute, which is the system path and always safe.
  const data = useRouteLoaderData<typeof loader>("root");
  const theme = data ? themeAttribute(data.theme) : undefined;
  /*
   * No data means the root loader did not run, which is the error-boundary
   * path, and there is then nothing to stamp FROM HERE.
   *
   * **"Revisit before switching to enforcing" is now DISCHARGED, by a commit
   * that was not about this.** It said an un-nonced error page cost a violation
   * report and nothing else, which was true under Report-Only and would have
   * become "error pages never hydrate" on 2026-08-17.
   *
   * It did not, because `<Scripts>` FALLS BACK to the framework context:
   * react-router 8.3.0, `lib/dom/ssr/components.js`, verbatim
   * `if (scriptProps.nonce == null && contextNonce)`, and `ScrollRestoration`
   * does the same. `entry.server.tsx` fills that context from
   * `<ServerRouter nonce>`, reading `getNonce(loadContext)` DIRECTLY rather than
   * through loader data, so it has a value whether or not the root loader ran.
   * That prop was added on 2026-08-07 to fix react-router's two streaming
   * scripts, and it covered this path as a side effect nobody recorded.
   *
   * So `undefined` here is still the honest value and is still deliberately not
   * given a fallback: a made-up nonce would satisfy the markup while matching
   * nothing in the header. It is simply no longer the LAST word on what gets
   * stamped.
   */
  const nonce = data?.nonce;

  /*
   * HYDRATION IS OPT-IN BY ROUTE, since 2026-08-26.
   *
   * A route that needs React in the browser exports `handle = { hydrate:
   * true }`; today that is the admin layout (covering every admin child) and
   * /login. No public reading route does, so a public page ships NO framework
   * script and no modulepreloads: its only script tags are the nonced
   * enhancement bundles, which is rule 4's public payload and rule 9's
   * standing ruling (works without script, fast with it) with the "with it"
   * carried by the bundles alone. This is React Router's documented shape:
   * the framework docs state `<Scripts>` may simply be omitted for a
   * traditional no-JS app, and matches expose `handle` exactly for decisions
   * like this one.
   *
   * The ERROR-BOUNDARY path has whatever matches existed when the error threw
   * and hydrates only if one of them had opted in: an admin error page keeps
   * its scripts, a public error page stays script-free, and a root-level
   * error (no handle anywhere) renders the boundary below with no framework
   * script, which is fine because it is plain markup.
   *
   * `check:page-payload` pins both halves: the opt-in set is exactly
   * {admin.tsx, login.tsx}, and <Scripts> renders only behind this guard.
   */
  const matches = useMatches();
  const hydrates = matches.some(
    (match) => (match.handle as { hydrate?: boolean } | undefined)?.hydrate === true,
  );

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/*
          THEME-COLOUR, BOTH THEMES, and it is here rather than in a `meta`
          export for a mechanical reason: `links` are merged across matched
          routes and `meta` is NOT, so a root-level meta export would be
          replaced wholesale by every route that exports one. Rendered into the
          head directly, beside charSet and viewport, which are here for the
          same reason.

          The two values are the light and dark `--bg` tokens. They are written
          out rather than read from a var(), because this attribute is consumed
          by the browser chrome and the OS, neither of which resolves a custom
          property. That makes them a second copy of a token, which rule 17 does
          not like, so `check:contrast` asserts they still match the palette.

          Media-scoped rather than a single value: a bare theme-color paints the
          address bar one colour in both themes, which is exactly the seam a
          dark reader sees.
        */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#faf7f2" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a1614" />
        <Meta />
        {/*
          THE NONCE ON THESE LINKS IS NOT REMOVABLE FOR 23 BYTES, measured
          2026-08-27.

          `<Links>` takes a nonce from the framework context and has no opt-out:
          `nonce == null && contextNonce` is the only branch. That context value
          comes from `<ServerRouter nonce>` in entry.server.tsx, which exists to
          nonce react-router's two STREAMING scripts, including on the
          error-boundary path where the root loader never ran. So the attribute
          on nine `<link>` elements is a side effect of a mechanism that is
          load-bearing elsewhere.

          What it costs, measured on `/blog`: 405 bytes raw and 23 bytes brotli,
          because the same nonce string repeats and compresses to nothing. The
          nonce is inert on a `<link>` under `style-src 'self'`. Trading the
          streaming scripts' nonce for 23 bytes is the wrong way round.
        */}
        <Links />
      </head>
      <body>
        {/* Keyboard and screen-reader users skip the header on every page. */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        {/* React Router propagates the nonce from here to the scripts it
            generates. The two ld+json blocks are deliberately NOT nonced: see
            `contentSecurityPolicy` in workers/app.ts, unknown 2. */}
        {hydrates ? (
          <>
            <ScrollRestoration nonce={nonce} />
            <Scripts nonce={nonce} />
          </>
        ) : null}
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  /*
   * A 404 IS STILL THE SITE, and this page was not.
   *
   * It rendered four leftover Tailwind utility classes, `pt-16 p-4 container
   * mx-auto`, which this repo does not use anywhere else, with no header, no
   * footer, and no `id="main"`. So the most likely page a stranger reaches by a
   * broken link had no navigation off it, no identity, and a skip link pointing
   * at nothing, because root emits `href="#main"` on every route.
   *
   * SiteHeader is SAFE HERE and that is not an assumption: it reads the root
   * loader through `useRouteLoaderData` and already handles the loader never
   * having run, with `data?.theme ?? "system"` carrying a written justification
   * naming the error-boundary path specifically. The comment predicted this use
   * before it existed.
   *
   * The stack block keeps its own class rather than borrowing `.prose pre`,
   * because it is DEV-ONLY output and styling it as prose would put a reader's
   * eye on it as content. It stays scrollable so a long stack cannot widen the
   * page, which is the same overflow class the header just had.
   */
  return (
    <>
      <SiteHeader />
      <main className="page" id="main">
        <div className="page-inner">
          <h1>{message}</h1>
          <p className="muted">{details}</p>
          {stack && (
            <pre className="error-stack">
              <code>{stack}</code>
            </pre>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
