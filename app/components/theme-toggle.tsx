import themeEnhanceUrl from "~/enhance/dist/theme.js?url";

import { EnhancementScript } from "~/components/enhancement-script";

/**
 * Both buttons ship and CSS shows one: with no cookie the server cannot know the theme in effect.
 * The icon shows the current theme and the name the action, on purpose. No `aria-pressed`: it
 * performs an action rather than toggling a state.
 */
export function ThemeToggle() {
  // No theme prop: a second input could disagree with `<html data-theme>`.
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

function SunIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...ICON}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
