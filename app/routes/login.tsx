import { useState } from "react";
import { redirect } from "react-router";

import { SiteLogo } from "~/components/site-logo";
import { authClient } from "~/lib/auth-client";
import { getAdminSession } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in" }, { name: "robots", content: "noindex" }];
}

// A signed-in admin has no business here; bounce to the cockpit.
export async function loader({ request, context }: Route.LoaderArgs) {
  if (await getAdminSession(getEnv(context), request)) throw redirect("/admin");
  return null;
}

export default function Login() {
  const [busy, setBusy] = useState(false);
  return (
    <main className="gate">
      <div className="gate-card">
        {/* Decorative: the heading below already names the page. */}
        <SiteLogo className="gate-mark" />
        <h1>Admin sign in</h1>
        <p className="muted">Access is limited to the site owner.</p>
        <button
          type="button"
          className="btn-brand"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void authClient.signIn.social({
              provider: "google",
              callbackURL: "/admin",
            });
          }}
        >
          {busy ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}
