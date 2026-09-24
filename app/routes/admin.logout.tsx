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
  const headers = new Headers(res.headers);
  headers.set("Location", "/login");
  return new Response(null, { status: 303, headers });
}

export async function loader() {
  throw redirect("/admin");
}
