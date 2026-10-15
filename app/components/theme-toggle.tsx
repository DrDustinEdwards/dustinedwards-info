import { Enhance } from "~/components/enhance";

/**
 * Capsomer's tip for a header icon control (site-header.md, "Controls"): it repeats the control's name, so it
 * adds no description, and app/enhance/header.ts shows it on hover and keyboard focus. Hidden with no script.
 */
export function HeaderTip({ text, keys }: { text: string; keys?: string[] }) {
  return (
    <span
      className="cap-site-header-tip cap-popover"
      data-variant="tooltip"
      data-side="bottom"
      data-offset="6"
      popover="manual"
      role="tooltip"
      aria-hidden="true"
    >
      <span className="cap-site-header-tip-text">{text}</span>
      {keys ? (
        <span className="cap-keys">
          {keys.map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The header's one theme icon button (theme-switch.md, "The button form"): a moon while the page is light and
 * a sun while it is dark, its name saying what a press does. Two buttons ship and CSS shows one, because with
 * no cookie the server cannot know the theme in effect, and each is a real submit to /theme, so it works with
 * no script and the server writes the right `data-theme` into the next page's first byte. No `aria-pressed`:
 * it performs an action rather than toggling a state.
 */
export function ThemeToggle() {
  // No theme prop: a second input could disagree with `<html data-theme>`.
  return (
    <>
      <form method="post" action="/theme" className="theme-toggle" data-theme-toggle="">
        <button
          type="submit"
          name="theme"
          value="dark"
          className="cap-site-header-icon theme-option"
          data-when="light"
          aria-label="Switch to dark theme"
        >
          <MoonIcon />
          <HeaderTip text="Switch to dark theme" />
        </button>
        <button
          type="submit"
          name="theme"
          value="light"
          className="cap-site-header-icon theme-option"
          data-when="dark"
          aria-label="Switch to light theme"
        >
          <SunIcon />
          <HeaderTip text="Switch to light theme" />
        </button>
      </form>
      <Enhance module="theme" />
    </>
  );
}

// The header's icon family: a 24 box drawn at 18px with a 1.6 stroke (site-header.css sets the size and stroke).
const ICON = {
  viewBox: "0 0 24 24",
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
