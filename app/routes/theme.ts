import { ORIGIN_REFUSAL, originVerdict } from "~/lib/origin.mjs";
import { safeReturnTo } from "~/lib/return-to.mjs";
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
  /*
   * ORIGIN FIRST, before the body is even read.
   *
   * A POST here sets a cookie, so it is a mutating route and takes the same
   * predicate `/search/ask` and the admin plane take. Measured 2026-08-27: a
   * POST carrying `Origin: https://evil.example` set the theme cookie.
   *
   * AN ABSENT ORIGIN IS STILL ALLOWED, and that is the whole reason this
   * predicate exists rather than a same-origin comparison written inline: this
   * form is the NO-SCRIPT half of the theme toggle, a scriptless form post
   * carries no `Origin`, and refusing it would break the fallback hard rule 9
   * requires. The literal string "null" is a different thing and is refused;
   * grounds on the predicate.
   */
  const verdict = originVerdict(request.headers.get("origin"), request.url);
  if (!verdict.ok) {
    return new Response(ORIGIN_REFUSAL, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

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
