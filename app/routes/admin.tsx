import { redirect } from "react-router";

import { authClient } from "~/lib/auth-client";
import { createAuth } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin";

export function meta() {
  return [{ title: "Admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await createAuth(getEnv(context)).api.getSession({
    headers: request.headers,
  });
  if (!session) throw redirect("/login");
  return { email: session.user.email };
}

export default function Admin({ loaderData }: Route.ComponentProps) {
  return (
    <main className="gate">
      <div className="gate-card">
        <h1>Dashboard</h1>
        <p className="muted">Signed in as {loaderData.email}</p>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            authClient.signOut().then(() => {
              window.location.href = "/login";
            })
          }
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
