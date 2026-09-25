import { redirect } from "react-router";

import { createAuth } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.logout";

export async function action({ request, context }: Route.ActionArgs) {
  const auth = createAuth(getEnv(context));
  const res = await auth.api.signOut({
    headers: request.headers,
    asResponse: true,
  });
  /* A failed sign-out leaves the session live, so it must not land on /login as if it worked. */
  if (!res.ok) {
    console.error("admin sign-out failed", res.status);
    return new Response(
      `Sign out failed: the auth server answered ${res.status}, so this session may still be active. Go back and try again.`,
      {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "private, no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      },
    );
  }
  const headers = new Headers(res.headers);
  headers.set("Location", "/login");
  return new Response(null, { status: 303, headers });
}

export async function loader() {
  throw redirect("/admin");
}
