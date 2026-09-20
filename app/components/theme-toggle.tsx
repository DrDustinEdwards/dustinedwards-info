import themeEnhanceUrl from "~/enhance/dist/theme.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

/**
 * ONE theme button. It switches between the two themes; the default is what a
 * reader gets until they touch it.
 *
 * WHY TWO BUTTONS SHIP AND ONE IS EVER SEEN: the control must name the theme it
 * will switch TO, and with no cookie the server cannot know what the reader is
 * seeing. So both are rendered and CSS displays exactly one, picked by
 * `data-theme` or by `prefers-color-scheme`. None of it needs script, and the
 * scripted path is then trivial: set or remove the attribute and the control
 * follows by cascade.
 *
 * THE ICON IS THE THEME IN EFFECT, THE NAME IS THE ACTION. They pull in opposite
 * directions on purpose: the icon is state, the accessible name is the outcome.
 *
 * No `aria-pressed`: this is not a control with an on and an off, it performs an
 * action and the label says which.
 */
export function ThemeToggle() {
  /*
   * IT TAKES NO PROPS, and that is the design: the resolved theme reaches this
   * control through `<html data-theme>` alone. A `theme` prop would be a second
   * input that could disagree with the attribute, which is how a control ends up
   * showing one thing and posting another.
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
