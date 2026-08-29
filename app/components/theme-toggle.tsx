import themeEnhanceUrl from "~/enhance/dist/theme.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

/**
 * ONE theme button, ordered by Dustin on aesthetics 2026-08-29.
 *
 * The site has two themes and a default. This control switches between the two.
 * The default is what a reader gets until they touch it, and `app/lib/theme.ts`
 * is where that resolution lives and is explained; nothing here needs to know
 * how it is spelled.
 *
 * There is deliberately no control for returning to the default. Clearing the
 * cookie does it, and that is undocumented on purpose: a recovery rather than a
 * feature, and a second control to reach it is exactly the chrome this ruling
 * removes.
 *
 * ## WHY TWO BUTTONS SHIP AND ONE IS EVER SEEN
 *
 * The control must name the theme it will switch TO, and with no cookie the
 * server cannot know what the reader is currently seeing: the preference lives
 * on their machine and arrives in no header this site reads. Asking for it
 * would mean `Accept-CH` and a `Vary` the Worker's cache key cannot carry,
 * which is the trap `media.$.ts` records at length.
 *
 * So both buttons are rendered and CSS displays exactly one. With an explicit
 * choice the `data-theme` attribute on `<html>` picks it; with no choice
 * `prefers-color-scheme` does. A reader always sees a single button, it always
 * posts the correct value, and none of it needs script.
 *
 * That also makes the SCRIPTED path trivial: `theme.ts` sets or removes
 * `data-theme` and the control follows by cascade alone. No icon swapping, no
 * label rewriting, no second copy of the SVG in a bundle.
 *
 * ## THE ICON IS THE THEME IN EFFECT, THE NAME IS THE ACTION
 *
 * A sun means "you are in light", and its label is "Switch to dark theme".
 * Those pull in opposite directions on purpose: the icon is state, which is
 * what a glance wants, and the accessible name is the outcome, which is what a
 * screen reader user needs before activating anything.
 *
 * No `aria-pressed`. This is not a control with an on and an off; it performs
 * an action and the label says which. `aria-pressed` on a button whose meaning
 * flips underneath it is the kind of half-true semantics the three-button
 * version deliberately avoided by not calling itself a radiogroup.
 *
 * It is a real form posting to /theme, so it works with scripting off: the
 * action writes the cookie and the next render carries the right attribute. The
 * enhancement intercepts the submit and flips the attribute in place, which
 * removes the round trip but is not what makes the control work.
 */
export function ThemeToggle() {
  /*
   * IT TAKES NO PROPS SINCE 2026-08-29, and that is the design rather than an
   * omission. Both buttons are always rendered and the cascade chooses, so the
   * server's resolved theme reaches this control through `<html data-theme>`
   * alone. A `theme` prop would be a second input that could disagree with the
   * attribute, which is exactly how a control ends up showing one thing and
   * posting another.
   */
  return (
    <>
      <form
        method="post"
        action="/theme"
        className="theme-toggle"
        data-theme-toggle=""
      >
        <button
          type="submit"
          name="theme"
          value="dark"
          className="theme-option"
          data-when="light"
          aria-label="Switch to dark theme"
          title="Switch to dark theme"
        >
          <SunIcon />
        </button>
        <button
          type="submit"
          name="theme"
          value="light"
          className="theme-option"
          data-when="dark"
          aria-label="Switch to light theme"
          title="Switch to light theme"
        >
          <MoonIcon />
        </button>
      </form>
      <EnhancementScript src={themeEnhanceUrl} />
    </>
  );
}

/**
 * Inline SVG rather than an icon package, per the repo's bundle-leanness rule.
 * Both are aria-hidden because the button already carries its name.
 */
const ICON = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** Shown while the LIGHT theme is in effect. */
function SunIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Shown while the DARK theme is in effect. */
function MoonIcon() {
  return (
    <svg {...ICON}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
