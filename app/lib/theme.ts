/**
 * A cookie, not localStorage, so the server writes the right `data-theme` into the first byte and nothing flashes. The
 * cookie itself is Capsomer's theme-server; this adds the "system" the cache key needs.
 */

import { colorSchemeContent, readThemeCookie, type ThemeChoice } from "capsomer/theme-server";

// "system" is a cache-key value but not writable: no control posts it and `/theme` refuses it.
type Theme = ThemeChoice | "system";

// Anything unreadable reads as "system": a bad cookie should cost the default theme, never the page.
export function themeFromRequest(request: Request): Theme {
  return readThemeCookie(request) ?? "system";
}

// Omitted for "system", which hands the decision to prefers-color-scheme.
export function themeAttribute(theme: Theme): ThemeChoice | undefined {
  return theme === "system" ? undefined : theme;
}

/** The color-scheme meta: without it the canvas painted between documents is light. */
export function colorSchemeMeta(theme: Theme): "light" | "dark" | "light dark" {
  return colorSchemeContent(theme === "system" ? null : theme);
}
