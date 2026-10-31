import { LOGOUT_HEADERS } from "@dustinedwards/site-runtime/headers";
import { redirect } from "react-router";

/**
 * Signing out of Access is its own endpoint on this host: it clears the Access cookie, which no code
 * here can do. Nothing else holds a session, so this sends the browser there, clearing what this origin
 * stored (Clear-Site-Data) on the way.
 */
export const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout";

export async function action() {
  return new Response(null, {
    status: 303,
    headers: { ...LOGOUT_HEADERS, Location: ACCESS_LOGOUT_PATH, "Cache-Control": "no-store" },
  });
}

export async function loader() {
  throw redirect("/admin");
}
