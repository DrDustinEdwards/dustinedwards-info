import { data, redirect } from "react-router";

import { Enhance } from "~/components/enhance";
import { SiteLogo } from "~/components/site-logo";
import { AUTH_RATE_PERIOD_SECONDS } from "~/lib/auth-rate.mjs";
import { checkAuthRate } from "~/lib/auth-rate.server";
import { createAuth, getAdminSession } from "~/lib/auth.server";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/login";

/*
 * The admin stylesheet on a public route, deliberately: this page is the admin plane's door and
 * needs `.field-alarm` and `.btn-brand[aria-disabled="true"]` from it.
 */
import "~/admin.css";
import { errorMessage } from "~/lib/error-message.mjs";

export function meta() {
  return [{ title: "Sign in" }, { name: "robots", content: "noindex" }];
}

const AFTER_SIGN_IN = "/admin";

const NO_STORE = { "cache-control": "private, no-store" };

export async function loader({ request, context }: Route.LoaderArgs) {
  if (await getAdminSession(getEnv(context), request)) throw redirect("/admin");
  return null;
}

/**
 * Not a direct post to Better Auth: it answers 200 with JSON carrying the authorize URL, which a plain
 * form would render as text, so this answers a real 302. `form-action 'self'` holds because the
 * cross-origin hop is a redirect. Rate limited here too: this route is not under `/api/auth/*`.
 * The page does not hydrate, so every failure comes back as `problem` on a rendered page.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const ip = clientIp(request);
  if (!(await checkAuthRate(env, ip))) {
    return data(
      { problem: "Too many sign-in attempts. Try again in a few minutes." },
      { status: 429, headers: { ...NO_STORE, "retry-after": String(AUTH_RATE_PERIOD_SECONDS) } },
    );
  }

  let result;
  try {
    result = await createAuth(env).api.signInSocial({
      body: { provider: "google", callbackURL: AFTER_SIGN_IN },
      headers: request.headers,
      returnHeaders: true,
    });
  } catch (error) {
    console.error("sign-in: Better Auth refused to start the Google flow", error);
    return data(
      { problem: `Sign-in could not start: ${errorMessage(error)}` },
      { status: 502, headers: NO_STORE },
    );
  }

  const url = result.response?.url;
  if (!url) {
    console.error("sign-in: Better Auth returned no authorize URL", result.response);
    return data({ problem: "Sign-in is unavailable right now." }, { status: 502, headers: NO_STORE });
  }

  /* Forward the headers: Better Auth sets the OAuth state cookie here and the callback refuses without it. */
  const headers = new Headers(result.headers);
  headers.set("Location", url);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 303, headers });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const problem = actionData?.problem;
  // `id="main"`: root always renders the skip link, on this route too.
  return (
    <main className="gate" id="main">
      <div className="gate-card">
        <SiteLogo className="gate-mark" />
        <h1>Admin sign in</h1>
        <p className="muted">Access is limited to the site owner.</p>
        {problem ? (
          <p className="field-alarm" role="alert">
            {problem}
          </p>
        ) : null}
        {/* A plain form and no hydration: the submission ends in a cross-origin redirect, which a
            native submission follows. app/enhance/login.ts adds only the busy label. */}
        <form method="post" data-sign-in="">
          <button type="submit" className="btn-brand">
            Continue with Google
          </button>
        </form>
      </div>
      <Enhance module="login" />
    </main>
  );
}
