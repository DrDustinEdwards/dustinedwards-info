/**
 * A cookie, not localStorage, so the server writes the right `data-theme` into the first byte and
 * nothing flashes.
 */

const THEME_COOKIE = "theme";

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// "system" is a cache-key value but not writable: no control posts it and `/theme` refuses it.
export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export const WRITABLE_THEMES = ["light", "dark"] as const;

export type WritableTheme = (typeof WRITABLE_THEMES)[number];

export function isWritableTheme(value: unknown): value is WritableTheme {
  return typeof value === "string" && (WRITABLE_THEMES as readonly string[]).includes(value);
}

// Anything unrecognised reads as "system": a bad cookie should cost the default theme, never the page.
export function themeFromRequest(request: Request): Theme {
  const header = request.headers.get("cookie");
  if (!header) return "system";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== THEME_COOKIE) continue;
    // `decodeURIComponent` throws, and this builds the cache key on every request: unguarded, a
    // bad cookie is a 500 on every page.
    let value;
    try {
      value = decodeURIComponent(rest.join("="));
    } catch {
      return "system";
    }
    return isWritableTheme(value) ? value : "system";
  }
  return "system";
}

// Omitted for "system", which hands the decision to prefers-color-scheme.
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

/**
 * `data-theme` means nothing to the browser until the CSS parses, so without this meta the canvas
 * painted between documents is light.
 */
export function colorSchemeMeta(theme: Theme): "light" | "dark" | "light dark" {
  return theme === "system" ? "light dark" : theme;
}

export function serializeThemeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}
