import { useState } from "react";
import { redirect } from "react-router";

import { SiteLogo } from "~/components/site-logo";
import { authClient } from "~/lib/auth-client";
import { authRateRefusal } from "~/lib/auth-rate.mjs";
import { checkAuthRate } from "~/lib/auth-rate.server";
import { createAuth, getAdminSession } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in" }, { name: "robots", content: "noindex" }];
}

/** Where a successful sign-in lands. One statement, used by both paths. */
const AFTER_SIGN_IN = "/admin";

// A signed-in admin has no business here; bounce to the cockpit.
export async function loader({ request, context }: Route.LoaderArgs) {
  if (await getAdminSession(getEnv(context), request)) throw redirect("/admin");
  return null;
}

/**
 * THE DOOR, WITHOUT SCRIPT.
 *
 * ## What this closes
 *
 * The only way in used to be a `type="button"` with an `onClick` that called
 * the Better Auth browser client. With scripting off it rendered, it was
 * enabled, and it did nothing at all: the site's single door was JS-only while
 * README declared that every public page works with scripting disabled. Hard
 * rule 9 decides where the boundary sits, and the admin plane behind this page
 * may require script; the DOOR is on the public plane, so it may not.
 *
 * ## Why this action exists instead of posting straight to Better Auth
 *
 * `POST /api/auth/sign-in/social` answers `200` with a JSON body carrying the
 * authorize URL, because it is written for a fetch client that will navigate
 * itself. Pointed at by a plain `<form>`, a browser would render that JSON as
 * text. Verified in the installed package rather than assumed: the endpoint's
 * own schema declares a JSON response, and `better-call` has no
 * redirect-on-form-submission path.
 *
 * So the form posts HERE, this action asks the same Better Auth server API for
 * the same URL, and answers with a real 302. `form-action 'self'` is satisfied
 * because the form's target is this origin; the cross-origin hop afterwards is
 * a REDIRECT, and redirects are not checked against `form-action` (Chrome
 * shipped that check and reverted it in 78 because it broke exactly this OAuth
 * shape). If a browser ever reinstates it the symptom is a blocked navigation
 * from this page, and the fix is to name the provider in `form-action`.
 *
 * ## The rate limit is applied here too, and that is not belt-and-braces
 *
 * `/api/auth/*` is guarded on both verbs, but this route is not under that
 * path, so without this line the form would be an unguarded way to ask Better
 * Auth to mint authorize URLs and set state cookies. Same limiter, same key
 * prefix, so the two doors share one budget rather than each getting their own.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
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
   * THE HEADERS MATTER AS MUCH AS THE URL. Better Auth sets the OAuth state
   * cookie on this response, and the callback refuses without it. Returning the
   * redirect while dropping the Set-Cookie would produce a door that opens onto
   * a failure every time, which is worse than one that does nothing.
   */
  const headers = new Headers(result.headers);
  headers.set("Location", url);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 303, headers });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [busy, setBusy] = useState(false);
  // `id="main"` because root ALWAYS renders `<a class="skip-link" href="#main">`,
  // on every route including this one. Without a target here the first thing a
  // keyboard reader hits on the site's only door moved focus nowhere.
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
          A PLAIN form, deliberately not react-router's <Form>. The submission
          has to end in a cross-origin redirect to the provider, and a native
          navigation follows that without the client router having to decide
          what a 303 to another site means.
        */}
        <form method="post">
          <button
            type="submit"
            className="btn-brand"
            disabled={busy}
            onClick={(event) => {
              /*
               * THE ENHANCEMENT, layered on top rather than replacing anything.
               * With script the browser client goes straight to the provider,
               * which saves this route a round trip and gives the operator a
               * state to look at. Without script none of this runs and the form
               * above posts normally.
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
