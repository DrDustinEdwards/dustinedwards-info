/**
 * Theme choice, and the one place that knows how it is stored.
 *
 * The choice is a COOKIE, not localStorage, and that is the whole anti-flash
 * design. localStorage is unreadable on the server, so a site that stores the
 * theme there has to paint once and correct itself, which is the flash. A
 * cookie arrives with the request, so the server writes the right `data-theme`
 * into the very first byte of HTML and nothing is ever corrected.
 *
 * "system" is stored as a value but rendered as the ABSENCE of the attribute,
 * so the CSS falls through to `prefers-color-scheme`. A reader with no script
 * and no cookie is on that same path already, which is why the zero-JS story
 * costs nothing: it is not a fallback, it is the default branch.
 */

export const THEME_COOKIE = "theme";

/** A year. The choice is a preference, not a session fact. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Reads the stored choice off a request. Anything unrecognised, including a
 * hand-edited cookie, reads as "system" rather than throwing: a bad cookie
 * should cost a reader the default theme, never the page.
 */
export function themeFromRequest(request: Request): Theme {
  const header = request.headers.get("cookie");
  if (!header) return "system";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== THEME_COOKIE) continue;
    const value = decodeURIComponent(rest.join("="));
    return isTheme(value) ? value : "system";
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

export function serializeThemeCookie(theme: Theme): string {
  // Path=/ so one choice covers the public plane and the admin plane. Lax is
  // enough: this is a display preference, and it must survive a normal
  // top-level navigation back to the site.
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}
