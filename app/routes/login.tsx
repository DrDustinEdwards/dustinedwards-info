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
 * The admin stylesheet on a public route, deliberately: this page is the admin plane's door and
 * needs `.field-alarm` and `.btn-brand:disabled` from it.
 */
import "~/admin.css";
import { errorMessage } from "~/lib/error-message.mjs";

export function meta() {
  return [{ title: "Sign in" }, { name: "robots", content: "noindex" }];
}

/** Hydrates only for the busy flag; the door itself is the plain no-script form. */
export const handle = { hydrate: true };

const AFTER_SIGN_IN = "/admin";

export async function loader({ request, context }: Route.LoaderArgs) {
  if (await getAdminSession(getEnv(context), request)) throw redirect("/admin");
  return null;
}

/**
 * Not a direct post to Better Auth: it answers 200 with JSON carrying the authorize URL, which a plain
 * form would render as text, so this answers a real 302. `form-action 'self'` holds because the
 * cross-origin hop is a redirect. Rate limited here too: this route is not under `/api/auth/*`.
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
    console.error("sign-in: Better Auth returned no authorize URL", result.response);
    return { problem: "Sign-in is unavailable right now." };
  }

  /* Forward the headers: Better Auth sets the OAuth state cookie here and the callback refuses without it. */
  const headers = new Headers(result.headers);
  headers.set("Location", url);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 303, headers });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const [busy, setBusy] = useState(false);
  const [clientProblem, setClientProblem] = useState<string | null>(null);
  const problem = clientProblem ?? actionData?.problem;
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
        {/* A plain form, not `<Form>`: the submission ends in a cross-origin redirect, which a native submission follows. */}
        <form method="post">
          <button
            type="submit"
            className="btn-brand"
            /* aria-disabled, not disabled: a disabled button drops the focus that pressed it, and
               the reader loses their place just as the page says why sign-in failed. */
            aria-disabled={busy}
            onClick={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setClientProblem(null);
              /* On success the page navigates away; anything else must free the button and say why. */
              const failed = (detail: string) => {
                setBusy(false);
                setClientProblem(`Sign-in could not start: ${detail}`);
              };
              try {
                const { error } = await authClient.signIn.social({
                  provider: "google",
                  callbackURL: AFTER_SIGN_IN,
                });
                if (error) failed(error.message ?? error.statusText ?? `HTTP ${error.status}`);
              } catch (error) {
                failed(errorMessage(error));
              }
            }}
          >
            {busy ? "Redirecting..." : "Continue with Google"}
          </button>
        </form>
      </div>
    </main>
  );
}
