import { useState } from "react";
import { redirect } from "react-router";

import { SiteLogo } from "~/components/site-logo";
import { authClient } from "~/lib/auth-client";
import { authRateRefusal } from "~/lib/auth-rate.mjs";
import { checkAuthRate } from "~/lib/auth-rate.server";
import { createAuth, getAdminSession } from "~/lib/auth.server";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/login";

/*
 * THE ADMIN STYLESHEET, ON A PUBLIC ROUTE, DELIBERATELY. This page is
 * unauthenticated and therefore public, but it is the admin plane's door.
 *
 * TWO dependencies, both measured with postcss rather than assumed:
 * `.field-alarm`, which carries the sign-in error, and `.btn-brand:disabled`,
 * which is the button's disabled state. The alternative was moving two rules into
 * a public sheet, changing their cascade position for the admin plane to save
 * bytes on a page essentially one person loads.
 */
import "~/admin.css";

export function meta() {
  return [{ title: "Sign in" }, { name: "robots", content: "noindex" }];
}

/**
 * /login hydrates for its busy flag, and that is DECORATION: the door itself is
 * the plain form above it, a real no-script POST, which is what rule 9 requires of
 * a public route. Dropping this flag would cost the spinner, never the sign-in.
 */
export const handle = { hydrate: true };

/** Where a successful sign-in lands. One statement, used by both paths. */
const AFTER_SIGN_IN = "/admin";

// A signed-in admin has no business here; bounce to the cockpit.
export async function loader({ request, context }: Route.LoaderArgs) {
  if (await getAdminSession(getEnv(context), request)) throw redirect("/admin");
  return null;
}

/**
 * THE DOOR, WITHOUT SCRIPT. The only way in used to be a `type="button"` with an
 * `onClick`: with scripting off it rendered, it was enabled, and it did nothing.
 * The progressive-enhancement rule decides where the boundary sits, and the DOOR is on the public
 * plane.
 *
 * WHY THIS ACTION EXISTS instead of posting straight to Better Auth: that endpoint
 * answers 200 with a JSON body carrying the authorize URL, because it is written
 * for a fetch client that will navigate itself, so a plain form would render that
 * JSON as text. This action asks for the same URL and answers with a real 302.
 *
 * `form-action 'self'` is satisfied because the form's target is this origin; the
 * cross-origin hop afterwards is a REDIRECT, and redirects are not checked against
 * it. If a browser ever reinstates that check, the fix is to name the provider.
 *
 * THE RATE LIMIT IS APPLIED HERE TOO, and that is not belt-and-braces: this route
 * is not under `/api/auth/*`, so without it the form would be an unguarded way to
 * ask Better Auth to mint authorize URLs and set state cookies.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const ip = clientIp(request);
  if (!(await checkAuthRate(env, ip))) return authRateRefusal();

  const result = await createAuth(env).api.signInSocial({
    body: { provider: "google", callbackURL: AFTER_SIGN_IN },
    headers: request.headers,
    returnHeaders: true,
  });

  const url = result.response?.url;
  if (!url) {
    // No URL means Better Auth did not produce an authorize target. Saying so
    // beats a blank page, and there is nothing here worth leaking in detail.
    return { problem: "Sign-in is unavailable right now." };
  }

  /*
   * THE HEADERS MATTER AS MUCH AS THE URL. Better Auth sets the OAuth state cookie
   * on this response and the callback refuses without it, so returning the redirect
   * while dropping the Set-Cookie would produce a door that opens onto a failure
   * every time.
   */
  const headers = new Headers(result.headers);
  headers.set("Location", url);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 303, headers });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [busy, setBusy] = useState(false);
  // `id="main"` because root ALWAYS renders the skip link, on every route
  // including this one. Without a target here the first thing a keyboard reader hits
  // on the site's only door moved focus nowhere.
  return (
    <main className="gate" id="main">
      <div className="gate-card">
        {/* Decorative: the heading below already names the page. */}
        <SiteLogo className="gate-mark" />
        <h1>Admin sign in</h1>
        <p className="muted">Access is limited to the site owner.</p>
        {actionData?.problem ? (
          <p className="field-alarm" role="alert">
            {actionData.problem}
          </p>
        ) : null}
        {/*
         * A PLAIN form, deliberately not react-router's `<Form>`: the submission has to
         * end in a cross-origin redirect to the provider, and a native submission is what
         * follows one.
         */}
        <form method="post">
          <button
            type="submit"
            className="btn-brand"
            disabled={busy}
            onClick={(event) => {
              /*
               * THE ENHANCEMENT, layered on top rather than replacing anything. With script
               * the browser client goes straight to the provider; without script none of this
               * runs and the form above posts normally.
               */
              event.preventDefault();
              setBusy(true);
              void authClient.signIn.social({
                provider: "google",
                callbackURL: AFTER_SIGN_IN,
              });
            }}
          >
            {busy ? "Redirecting..." : "Continue with Google"}
          </button>
        </form>
      </div>
    </main>
  );
}
