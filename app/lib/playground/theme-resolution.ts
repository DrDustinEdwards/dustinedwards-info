import { COOKIE_CAP } from "~/lib/playground/limits";
import { colorSchemeMeta, themeAttribute, themeFromRequest } from "~/lib/theme";

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

/** The theme demo's share of the playground loader: the real resolver, over a request built from the box. */
export function themeResolutionDemo(params: URLSearchParams) {
  /* Presence, not truthiness: an empty cookie header is a real case, the reader who has chosen nothing. */
  const cookieAsked = params.has("cookie");
  const cookieRaw = params.get("cookie") ?? "";
  const cookie = cookieRaw.slice(0, COOKIE_CAP);
  let themeResult = null;
  let themeError: string | null = null;

  if (cookieAsked) {
    if (cookieRaw.length > COOKIE_CAP) {
      themeError = `That header is ${cookieRaw.length} characters. The cap is ${COOKIE_CAP}, so it was cut.`;
    }
    if (!PRINTABLE_ASCII.test(cookie)) {
      themeError =
        "A Cookie header carries printable characters only. That string holds a " +
        "control character, which no browser can send and which would make the " +
        "request itself refuse to be built, so nothing was resolved.";
    } else {
      /* No cookie header at all when the input is empty, which differs from an empty one. */
      const request = new Request(
        "https://example.invalid/",
        cookie ? { headers: { cookie } } : undefined,
      );
      const theme = themeFromRequest(request);
      themeResult = {
        cookie,
        theme,
        attribute: themeAttribute(theme) ?? null,
        colorScheme: colorSchemeMeta(theme),
      };
    }
  }

  return { themeResult, themeError, cookieAsked, cookieRaw: cookie };
}
