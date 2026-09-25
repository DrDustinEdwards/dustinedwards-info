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

// Module imports, not @import in app.css, which CSS drops after any rule.
// The order is the cascade: do not sort.
import "./styles/public-chrome.css";
import "./styles/page-shell.css";
import "./styles/chrome-nav.css";
import "./styles/skip-link.css";
import "./styles/motion-print.css";
import "./styles/search-trigger.css";
// Last: shell.css must win where it and page-shell.css touch the same thing.
import "./styles/shell.css";

import interNormalUrl from "./fonts/inter-latin-normal.woff2?url";
// `?url`, not a bare import, which would fold the math bytes into the stylesheet every page links.
import katexCssUrl from "./styles/katex.generated.css?url";

// Middleware, not the loader: loaders run alongside each other, so a collector made in one is
// invisible to another.
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const timings: Timings | undefined = wantsTiming(new URL(request.url)) ? [] : undefined;
    context.set(timingsContext, { timings });
    return next();
  },
];

export function loader({ request, context }: Route.LoaderArgs) {
  // The nonce is carried through the loader because `Layout` cannot reach the request context.
  return { theme: themeFromRequest(request), nonce: getNonce(context) };
}

/**
 * Only on the error path: an unmatched URL matches no route but this one, so without it the 404 page
 * has no title (WCAG 2.4.2). A matched route's own `meta` wins, so its not-found title stands.
 */
export function meta({ error }: Route.MetaArgs) {
  if (!error) return [];
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return [{ title: `${notFound ? "Page not found" : "Error"} | ${SITE.name}` }];
}

export const links: Route.LinksFunction = () => [
  // `links` from every matched route are merged and `meta` is NOT, so these ride on every page.
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "icon", href: "/dustin-edwards-favicon.svg", type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: "/dustin-edwards-apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
  // feed+json although served as application/json: readers scan autodiscovery for the feed types.
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
  // `crossorigin` is mandatory: fonts are fetched in anonymous CORS mode whatever their origin, so a
  // preload without it is a different request and the file is fetched twice.
  {
    rel: "preload",
    href: interNormalUrl,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Layout also renders the error boundary, where the root loader may not have run.
  const data = useRouteLoaderData<typeof loader>("root");
  const theme = data ? themeAttribute(data.theme) : undefined;
  // No fallback: a made-up nonce would satisfy the markup while matching nothing in the header.
  const nonce = data?.nonce;

  // Hydration is opt-in by route (`handle = { hydrate: true }`); check:page-payload pins the set.
  const matches = useMatches();
  const hydrates = matches.some(
    (match) => (match.handle as { hydrate?: boolean } | undefined)?.hydrate === true,
  );

  // Not React's `precedence` hoisting: it lifts the sheet above the color-scheme meta, which must
  // arrive before the first stylesheet request. check:page-payload reconciles these route ids.
  const postData = useRouteLoaderData("routes/blog.$slug") as { hasMath?: boolean } | undefined;
  const previewData = useRouteLoaderData("routes/preview.$token") as
    | { hasMath?: boolean }
    | undefined;
  // Unconditional in the editor: hasMath describes what was SAVED, not what the author is typing.
  const editorWantsMath = matches.some(
    (match) => (match.handle as { math?: boolean } | undefined)?.math === true,
  );
  const linksMath =
    postData?.hasMath === true || previewData?.hasMath === true || editorWantsMath;

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        {/* Before any stylesheet: data-theme means nothing to the browser until the CSS is parsed. */}
        <meta name="color-scheme" content={colorSchemeMeta(data?.theme ?? "system")} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Literal hexes: browser chrome does not resolve a custom property. check:contrast
            asserts they match the palette. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4efe6" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1c1916" />
        <Meta />
        {/* <Links> takes a nonce from the framework context and has no opt-out. */}
        <Links />
        {/* After <Links /> so a site rule wins over the upstream katex rule. No `precedence`: React
            would lift the element above the color-scheme meta. */}
        {linksMath ? <link rel="stylesheet" href={katexCssUrl} /> : null}
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        {/* The two ld+json blocks are deliberately NOT nonced: see `contentSecurityPolicy` in
            workers/csp.mjs. */}
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

  // SiteHeader is safe here: it reads no loader data, so nothing is missing on the error path.
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
