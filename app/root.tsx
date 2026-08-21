import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { getNonce } from "~/lib/context";
import { themeAttribute, themeFromRequest } from "~/lib/theme";

import type { Route } from "./+types/root";
import "./app.css";

/**
 * Reads the theme cookie so the attribute is server-rendered.
 *
 * This is the entire flash-of-wrong-theme fix. There is no inline script and
 * nothing to correct after paint: the first byte of HTML already carries the
 * right attribute, or deliberately carries none so prefers-color-scheme
 * decides. Cookie parsing only, no binding and no I/O, so it costs nothing on
 * a route that does not care.
 */
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
   * NO FONT LINKS. Inter is self-hosted from /fonts/ since 2026-08-21; the
   * @font-face blocks are at the top of app.css, which the browser already has.
   * Removing these took away two external preconnects and one render-blocking
   * stylesheet, and let style-src and font-src both drop to 'self'.
   */
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

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
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
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
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
