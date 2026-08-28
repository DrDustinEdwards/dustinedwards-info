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

const THEME_COOKIE = "theme";

/** A year. The choice is a preference, not a session fact. */
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

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

/**
 * The `<meta name="color-scheme">` content for a resolved choice.
 *
 * ## WHAT IT IS FOR, measured 2026-08-27
 *
 * `data-theme` tells the STYLESHEET which palette to use. It tells the BROWSER
 * nothing, because the browser cannot know what that attribute means until it
 * has parsed the CSS that gives it meaning. Until then the canvas it paints
 * between and beneath documents is the default one, and the default is light.
 *
 * That is a white frame, and it was measured rather than reasoned about: real
 * Chrome 151, screen capture at about 45 frames a second, a header click from
 * `/` to `/blog` with `theme=dark` and `prefers-color-scheme: light`. The
 * viewport read 253 of 255 for one composited frame between two pages that
 * read 61. With this meta injected into the same bytes and nothing else
 * changed, the same navigation never left the dark range.
 *
 * THE READER THIS AFFECTS is the one whose CHOICE disagrees with their MACHINE:
 * dark site on a light-mode computer. With the two in agreement the browser
 * guesses right by accident and there is no flash at all, which is why holding
 * them equal hid this completely.
 *
 * ## "light dark" IS NOT A DEFAULT, IT IS THE HONEST ANSWER FOR "system"
 *
 * A reader on "system" has not chosen, so the document supports both and the
 * browser should use the machine's preference. Writing a single value there
 * would be asserting a choice nobody made, and would put the flash back for
 * whichever half of those readers guessed wrong.
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
