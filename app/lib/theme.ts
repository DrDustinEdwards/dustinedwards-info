/**
 * Theme choice, and the one place that knows how it is stored.
 *
 * The choice is a COOKIE, not localStorage, and that is the whole anti-flash design: a cookie
 * arrives with the request, so the server writes the right `data-theme` into the first byte of HTML
 * and nothing is ever corrected.
 *
 * "system" is stored as a value but rendered as the ABSENCE of the attribute, so the CSS falls
 * through to `prefers-color-scheme`. A reader with no script and no cookie is on that same path
 * already.
 */

const THEME_COOKIE = "theme";

/** A year. The choice is a preference, not a session fact. */
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The RESOLVED states. Three, and that is not the number of buttons.
 *
 * "system" is what a reader who has chosen nothing is in: a real state, one of the three values the
 * Worker's cache key can carry, and NOT writable, because no control posts it and `/theme` refuses
 * it. This module is the one place that knows it was ever posted; everywhere else the site has two
 * themes and a default.
 */
export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * What `/theme` will ACCEPT. Two, and the shrink is the point.
 *
 * The control posts the theme it is switching TO, which is only ever light or
 * dark. A posted "system" would be a client asking for a state no button
 * offers, so it is refused rather than honoured: an endpoint that accepts a
 * value nothing sends is a surface with no caller and no test.
 */
export const WRITABLE_THEMES = ["light", "dark"] as const;

export type WritableTheme = (typeof WRITABLE_THEMES)[number];

export function isWritableTheme(value: unknown): value is WritableTheme {
  return typeof value === "string" && (WRITABLE_THEMES as readonly string[]).includes(value);
}

/**
 * Reads the stored choice off a request. Anything unrecognised, including a hand-edited cookie,
 * reads as "system" rather than throwing: a bad cookie should cost a reader the default theme,
 * never the page.
 *
 * A LEGACY `theme=system` COOKIE IS HONOURED, AND IT IS THE NO-COOKIE PATH. Both mean follow the
 * machine, so both converge on one cache entry and one document: `themeAttribute("system")` returns
 * `undefined`, so the attribute is absent for either reader, and no stylesheet carries a
 * `[data-theme="system"]` selector.
 */
export function themeFromRequest(request: Request): Theme {
  const header = request.headers.get("cookie");
  if (!header) return "system";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== THEME_COOKIE) continue;
    /*
     * `decodeURIComponent` THROWS on malformed input, and `workers/app.ts` calls this on every request
     * to build the cache key: unguarded, a hand-edited cookie is a 500 on every page for that reader
     * until they find and clear a cookie nothing tells them about.
     */
    let value;
    try {
      value = decodeURIComponent(rest.join("="));
    } catch {
      return "system";
    }
    /*
     * WRITABLE values are honoured as choices; everything else, `system` and junk alike, falls to the
     * default. Keyed on the WRITABLE set so "what may be stored" and "what may be posted" are one
     * question with one answer.
     */
    return isWritableTheme(value) ? value : "system";
  }
  return "system";
}

/**
 * The value for the `data-theme` attribute, or undefined to omit it.
 * Omitting is what hands the decision to prefers-color-scheme.
 */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

/**
 * The `<meta name="color-scheme">` content for a resolved choice.
 *
 * `data-theme` tells the STYLESHEET which palette to use and tells the BROWSER nothing, because the
 * browser cannot know what the attribute means until it has parsed the CSS that gives it meaning.
 * Until then the canvas it paints between documents is the default one, and the default is light.
 *
 * "light dark" IS NOT A DEFAULT, IT IS THE HONEST ANSWER FOR "system": that reader has not chosen,
 * so the document supports both, and a single value would assert a choice nobody made.
 */
export function colorSchemeMeta(theme: Theme): "light" | "dark" | "light dark" {
  return theme === "system" ? "light dark" : theme;
}

export function serializeThemeCookie(theme: Theme): string {
  // Path=/ so one choice covers the public plane and the admin plane. Lax is
  // enough: this is a display preference, and it must survive a normal
  // top-level navigation back to the site.
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}
