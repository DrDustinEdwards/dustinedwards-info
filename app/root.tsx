import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "react-router";

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
export function loader({ request }: Route.LoaderArgs) {
  return { theme: themeFromRequest(request) };
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // Layout also renders the error boundary, where the root loader may not have
  // run, so this reads the optional route data rather than useLoaderData. No
  // data means no attribute, which is the system path and always safe.
  const data = useRouteLoaderData<typeof loader>("root");
  const theme = data ? themeAttribute(data.theme) : undefined;

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
        <ScrollRestoration />
        <Scripts />
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

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
