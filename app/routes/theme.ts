import { isTheme, serializeThemeCookie } from "~/lib/theme";

import type { Route } from "./+types/theme";

/**
 * The zero-JS half of the theme toggle: a form post that stores the choice and
 * sends the reader back where they were.
 *
 * Redirects to the Referer rather than to "/" so the control does not move the
 * reader off the page they were reading. The header is checked against this
 * origin before it is trusted, because an attacker-supplied Referer would
 * otherwise turn this into an open redirect.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const choice = form.get("theme");
  const theme = isTheme(choice) ? choice : "system";

  return new Response(null, {
    status: 303,
    headers: {
      "Set-Cookie": serializeThemeCookie(theme),
      Location: safeReturnTo(request),
    },
  });
}

/** A GET here means someone typed the URL. There is nothing to show. */
export function loader() {
  return new Response(null, { status: 303, headers: { Location: "/" } });
}

function safeReturnTo(request: Request): string {
  const referer = request.headers.get("referer");
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    if (url.origin !== new URL(request.url).origin) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
