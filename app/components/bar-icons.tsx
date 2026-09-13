/**
 * The three bar icons, inline SVG.
 *
 * INLINE, never an icon font and never a sprite: an icon font fails to a
 * rectangle of tofu, and inline SVG has no failure mode and no extra request.
 * Hard rule 4 asks for inline SVG over an icon library and this is four paths.
 *
 * ICON-ONLY IS PERMITTED HERE, and only here. Step 6a forbids icon-only
 * controls across the system; RULED 2026-09-13 that the three universally
 * understood marks are the exception, because a magnifying glass, a hamburger
 * and a sun/moon are read correctly without a label by readers who have never
 * seen this site. Every one still carries a real accessible name: an
 * `aria-label` on the control and a visually hidden label inside it.
 *
 * `stroke="currentColor"` means an icon is never given a colour of its own, so
 * it participates in every hover and focus state of the control it sits in and
 * cannot fall out of sync with it.
 *
 * 20px at stroke 1.5 is lucide's design size, which is why --icon-size and
 * --icon-stroke carry exactly those values.
 */
const BASE = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  className: "icon",
};

/** lucide: menu. The hamburger. */
export function MenuIcon() {
  return (
    <svg {...BASE}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** lucide: search. */
export function SearchIcon() {
  return (
    <svg {...BASE}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** lucide: sun. Shown while the LIGHT theme is in effect, so it offers dark. */
export function SunIcon() {
  return (
    <svg {...BASE}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** lucide: moon. Shown while the DARK theme is in effect, so it offers light. */
export function MoonIcon() {
  return (
    <svg {...BASE}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
