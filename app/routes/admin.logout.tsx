import { redirect } from "react-router";

import { createAuth } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/admin.logout";

/**
 * A request Access let through carries its token header, and signing out of Access is its own
 * endpoint on this host: it clears the Access cookie, which no code here can do. Presence is enough
 * for this branch, because all it does is send the browser to that logout.
 */
export const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.headers.has("cf-access-jwt-assertion")) {
    return new Response(null, {
      status: 303,
      headers: { Location: ACCESS_LOGOUT_PATH, "Cache-Control": "no-store" },
    });
  }
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
