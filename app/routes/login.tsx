import { redirect } from "react-router";

import { authClient } from "~/lib/auth-client";
import { createAuth } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await createAuth(getEnv(context)).api.getSession({
    headers: request.headers,
  });
  if (session) throw redirect("/admin");
  return null;
}

export default function Login() {
  return (
    <main className="gate">
      <div className="gate-card">
        <h1>Admin sign in</h1>
        <p className="muted">Access is limited to the site owner.</p>
        <button
          type="button"
          className="btn-brand"
          onClick={() =>
            authClient.signIn.social({
              provider: "google",
              callbackURL: "/admin",
            })
          }
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}
