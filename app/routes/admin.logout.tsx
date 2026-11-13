import { LOGOUT_HEADERS } from "@dustinedwards/site-runtime/headers";
import { redirect } from "react-router";
import { ACCESS_LOGOUT } from "capsomer/react/admin-shell";

/**
 * Signing out of Access is its own endpoint on this host: it clears the Access cookie, which no code
 * here can do. Nothing else holds a session, so this sends the browser there, clearing what this origin
 * stored (Clear-Site-Data) on the way. The address is Capsomer's ACCESS_LOGOUT.
 */
export async function action() {
  return new Response(null, {
    status: 303,
    headers: { ...LOGOUT_HEADERS, Location: ACCESS_LOGOUT, "Cache-Control": "no-store" },
  });
}

export async function loader() {
  throw redirect("/admin");
}
