import { ORIGIN_REFUSAL, originVerdict } from "~/lib/origin.mjs";
import { safeReturnTo } from "~/lib/return-to.mjs";
import { isWritableTheme, serializeThemeCookie } from "~/lib/theme";

import type { Route } from "./+types/theme";

/** The Referer is checked against this origin before it is trusted, or this is an open redirect. */
export async function action({ request }: Route.ActionArgs) {
  /* An absent Origin is allowed: the no-script form post carries none. The literal "null" is refused. */
  const verdict = originVerdict(request.headers.get("origin"), request.url);
  if (!verdict.ok) {
    return new Response(ORIGIN_REFUSAL, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  const form = await request.formData();
  const choice = form.get("theme");

  /*
   * Only writable themes: substituting a default turns a malformed request into a silent theme
   * change. `no-store`: a cacheable refusal is a refusal served to somebody else.
   */
  if (!isWritableTheme(choice)) {
    return new Response("Theme must be light or dark.\n", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      "Set-Cookie": serializeThemeCookie(choice),
      Location: safeReturnTo(request),
    },
  });
}

export function loader() {
  return new Response(null, { status: 303, headers: { Location: "/" } });
}
