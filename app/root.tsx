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

import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { getNonce } from "~/lib/context";
import { SITE, SITE_ORIGIN } from "~/lib/seo";
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "~/lib/theme";
import { timingsContext, wantsTiming, type Timings } from "~/lib/timing";

import type { Route } from "./+types/root";
import "./app.css";

/*
 * THE COMPONENT SHEETS, IN CASCADE ORDER. They were nine `@import` statements
 * in app.css, and CSS requires `@import` before every other rule and drops a late
 * one, so here they are ordinary module imports.
 *
 * THE ORDER IS LOAD-BEARING and is the order they were cut out of the original
 * app.css. Do not sort this list.
 */
import "./styles/public-chrome.css";
import "./styles/page-shell.css";
import "./styles/chrome-nav.css";
import "./styles/skip-link.css";
import "./styles/motion-print.css";
import "./styles/search-trigger.css";
/*
 * LAST, and it no longer contains a header. The position is kept because the
 * order of this list is load-bearing and shell.css still needs to win where it and
 * page-shell.css touch the same thing.
 */
import "./styles/shell.css";

/*
 * Imported rather than written out: the filename carries a content hash, and a
 * hand-written path would be a second statement of it that goes stale the day the
 * font is replaced. Rule 17.
 */
import interNormalUrl from "./fonts/inter-latin-normal.woff2?url";
/*
 * `?url` IS WHAT MAKES IT CONDITIONAL. A bare import would fold these bytes into
 * root's own stylesheet, which every page links; `?url` emits a standalone
 * content-hashed asset a document can decide at render time to ask for.
 */
import katexCssUrl from "./styles/katex.generated.css?url";

/**
 * Reads the theme cookie so the attribute is server-rendered. This is the entire
 * flash-of-wrong-theme fix: there is no inline script and nothing to correct after
 * paint. Cookie parsing only, no binding and no I/O.
 */
/**
 * THE TIMING COLLECTOR, created ONCE per request, for every route on the site.
 *
 * `?timing=1` opts in and nothing else does, so an uninstrumented response is
 * byte-identical to what shipped before this existed.
 *
 * MIDDLEWARE, NOT THE LOADER, and that is load-bearing: a loader runs alongside
 * its siblings, so a collector created in one is not visible to another.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const timings: Timings | undefined = wantsTiming(new URL(request.url)) ? [] : undefined;
    context.set(timingsContext, { timings });
    return next();
  },
];

export function loader({ request, context }: Route.LoaderArgs) {
  // The nonce is generated in `workers/app.ts` BEFORE the render, because the same
  // value has to appear in the CSP header and on every script. Carried through the
  // loader because `Layout` cannot reach the request context.
  return { theme: themeFromRequest(request), nonce: getNonce(context) };
}

export const links: Route.LinksFunction = () => [
  // `links` from every matched route are merged and `meta` is NOT, which is why
  // these ride on every page and why the default social card is a constant each
  // public route names for itself.
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "icon", href: "/dustin-edwards-favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/dustin-edwards-apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
  /*
   * The `type` on the JSON one stays `application/feed+json` even though the
   * response travels as `application/json`: a reader scans autodiscovery links for
   * the FEED types, so this is what the resource is.
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
   * THE NORMAL FACE ONLY. The italic's `unicode-range` already makes the browser
   * fetch it on demand, and a preload not used within a few seconds is worse than
   * none.
   *
   * `crossorigin` IS MANDATORY AND IS NOT ABOUT CORS HERE: fonts are fetched in
   * anonymous CORS mode whatever their origin, so a preload without it is a
   * DIFFERENT request and the file is fetched twice.
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
  // Layout also renders the error boundary, where the root loader may not have run,
  // so this reads the optional route data. No data means no attribute, which is the
  // system path and always safe.
  const data = useRouteLoaderData<typeof loader>("root");
  const theme = data ? themeAttribute(data.theme) : undefined;
  /*
   * `undefined` is the honest value and is deliberately not given a fallback: a
   * made-up nonce would satisfy the markup while matching nothing in the header.
   */
  const nonce = data?.nonce;

  /*
   * HYDRATION IS OPT-IN BY ROUTE. A route that needs React in the browser exports
   * `handle = { hydrate: true }`; no public reading route does, so a public page
   * ships NO framework script and its only script tags are the nonced enhancement
   * bundles.
   *
   * `check:page-payload` pins the opt-in set and that `<Scripts>` renders only
   * behind this guard.
   */
  const matches = useMatches();
  const hydrates = matches.some(
    (match) => (match.handle as { hydrate?: boolean } | undefined)?.hydrate === true,
  );

  /*
   * LINKED ONLY BY A PAGE THAT HAS MATH. A CSS import would put the math bytes and
   * a twenty-face font set on every post to serve the one that needs them, which is
   * hard rule 4's question answered the wrong way.
   *
   * NOT React's stylesheet hoisting, which was tried: a `precedence`-managed sheet
   * is lifted to the TOP of `<head>`, above the colour-scheme meta, and that signal
   * is load-bearing exactly because it arrives BEFORE the first stylesheet request.
   *
   * THE ID LIST IS A MIRROR, and `check:page-payload` reconciles it in both
   * directions.
   */
  const postData = useRouteLoaderData("routes/blog.$slug") as { hasMath?: boolean } | undefined;
  const previewData = useRouteLoaderData("routes/preview.$token") as
    | { hasMath?: boolean }
    | undefined;
  /*
   * Unconditional, because the condition would be wrong: the flag is a property of
   * what has been SAVED and an author is typing something that has not been. A real
   * cost taken on purpose, in the plane rule 4 exempts.
   */
  const editorWantsMath = matches.some(
    (match) => (match.handle as { math?: boolean } | undefined)?.math === true,
  );
  const linksMath =
    postData?.hasMath === true || previewData?.hasMath === true || editorWantsMath;

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        {/*
         * COLOUR SCHEME, BEFORE ANY STYLESHEET, and the position is the point. This is
         * the only thing telling the BROWSER, as opposed to the stylesheet, which palette
         * the page is: `data-theme` means nothing until the CSS reading it has been
         * parsed.
         *
         * `check:browser` asserts that relation and deliberately does not assert an
         * index, which would be pinning React's internals.
         */}
        <meta name="color-scheme" content={colorSchemeMeta(data?.theme ?? "system")} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/*
         * Here rather than in a `meta` export because `meta` is NOT merged across
         * matched routes. The two values are written out rather than read from a var(),
         * because browser chrome does not resolve a custom property, so `check:contrast`
         * asserts they still match the palette.
         */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4efe6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1c1916" />
        <Meta />
        {/*
         * `<Links>` takes a nonce from the framework context and has no opt-out. That
         * context exists to nonce react-router's two STREAMING scripts, including on the
         * error-boundary path, so the attribute here is a side effect of a mechanism that
         * is load-bearing elsewhere.
         */}
        <Links />
        {/*
         * AFTER `<Links />`, so the math rules land last and a site rule wins over the
         * upstream katex rule it overrides. No `precedence`: that attribute makes React
         * lift the element above the colour-scheme meta.
         */}
        {linksMath ? <link rel="stylesheet" href={katexCssUrl} /> : null}
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
  /*
   * All four strings are deliberate rather than scaffold. Nothing renders them on a
   * healthy site, so the only reader who sees them is one whose page has just
   * failed, which is the worst moment to sound like a starter kit.
   */
  let message = "Something broke.";
  let details = "The page failed to render.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "This page is not here."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  /*
   * A 404 IS STILL THE SITE. This page had no header, no footer and no `id="main"`,
   * so the most likely page a stranger reaches by a broken link had no navigation off
   * it and a skip link pointing at nothing.
   *
   * SiteHeader is SAFE HERE and that is not an assumption: it reads the root loader
   * NOT AT ALL, so there is no loader value for the error-boundary path to be
   * missing.
   */
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
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
      <ShellFooter />
    </>
  );
}
