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

/**
 * The RESOLVED states. Three, and that is not the number of buttons.
 *
 * "system" is what a reader who has chosen nothing is in. It is still a real
 * state, still what `colorSchemeMeta` answers `light dark` for, and still one
 * of the three values the Worker's cache key can carry. What it stopped being
 * on 2026-08-29 is WRITABLE: no control posts it, and `/theme` refuses it.
 *
 * THIS MODULE IS THE ONE PLACE THAT KNOWS "system" WAS EVER POSTED. The
 * addendum of 2026-08-29 asked for exactly that, and the grep in the commit
 * body is the proof. Everywhere else the site has two themes and a default.
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
 * Reads the stored choice off a request. Anything unrecognised, including a
 * hand-edited cookie, reads as "system" rather than throwing: a bad cookie
 * should cost a reader the default theme, never the page.
 *
 * ## A LEGACY `theme=system` COOKIE IS HONOURED, AND IT IS THE NO-COOKIE PATH
 *
 * The three-button control could write `system`, so cookies carrying it exist
 * in readers' browsers and will for a year, which is the cookie's max-age. It
 * still means what it always meant: follow the machine. That is identical to
 * having no cookie at all, so this returns the same value for both and the two
 * readers converge on one cache entry and one document.
 *
 * **NORMALIZING CHANGES NOTHING A READER RECEIVES, and that was checked rather
 * than assumed before collapsing them.** `themeAttribute("system")` returns
 * `undefined`, so the attribute is ABSENT for a legacy-system reader exactly as
 * it is for a first-time one; there is no `[data-theme="system"]` selector in
 * any stylesheet, and the system case is written `:root:not([data-theme])`
 * wherever it appears. So the two documents were already byte-identical and
 * already shared a key. What this comment adds is the guarantee, in the one
 * place that can give it, rather than a coincidence three files had to keep.
 */
export function themeFromRequest(request: Request): Theme {
  const header = request.headers.get("cookie");
  if (!header) return "system";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== THEME_COOKIE) continue;
    /*
     * ## `decodeURIComponent` THROWS ON MALFORMED INPUT, and this used to be
     * unguarded. FOUND BY test/worker/routes.test.ts ON 2026-08-29.
     *
     * `theme=%%%bogus` raises `URIError: URI malformed`. Nothing this site
     * writes can produce that, because `serializeThemeCookie` only ever emits
     * `light` or `dark`, but a cookie is client state: it can be hand-edited,
     * truncated by a proxy, or corrupted in storage.
     *
     * What made it worth fixing rather than noting is WHERE it lands.
     * `workers/app.ts` calls this on EVERY request, before the render, to build
     * the cache key. An exception there is not a wrong theme, it is a 500 on
     * every page for that reader, on every visit, until they find and clear a
     * cookie nothing tells them about.
     *
     * The docblock above has always promised the opposite: a bad cookie costs a
     * reader the default theme, never the page. It is true now.
     */
    let value;
    try {
      value = decodeURIComponent(rest.join("="));
    } catch {
      return "system";
    }
    /*
     * WRITABLE values are honoured as choices; everything else, `system` and
     * junk alike, falls to the default. Keyed on the WRITABLE set rather than
     * on `isTheme` so that "what may be stored" and "what may be posted" are
     * the same question with one answer.
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
