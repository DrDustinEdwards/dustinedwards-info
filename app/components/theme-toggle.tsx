import { useEffect } from "react";

import { THEMES, type Theme } from "~/lib/theme";

const LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/**
 * Three-state theme control: light, dark, system.
 *
 * It is a real form posting to /theme, so it works with scripting off: the
 * action writes the cookie and the next render carries the right attribute.
 * The enhancement below intercepts the submit and flips the attribute in place,
 * which removes the round trip but is not what makes the control work.
 *
 * Semantics are three buttons carrying aria-pressed rather than a role=radio
 * group. A real radiogroup owes the user arrow-key roving focus, which cannot
 * be delivered without script, and a control that announces itself as a
 * radiogroup and then does not behave like one is worse than one that never
 * claimed to be. Toggle buttons are honest with or without the script.
 */
export function ThemeToggle({ theme }: { theme: Theme }) {
  useEffect(() => {
    let cancelled = false;
    import("~/enhance/theme")
      .then((m) => {
        if (!cancelled) m.enhanceThemeToggle();
      })
      .catch(() => {
        // The form still posts. A failed enhancement costs a round trip.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <form
      method="post"
      action="/theme"
      className="theme-toggle"
      data-theme-toggle=""
      role="group"
      aria-label="Colour theme"
    >
      {THEMES.map((value) => (
        <button
          key={value}
          type="submit"
          name="theme"
          value={value}
          className="theme-option"
          aria-pressed={theme === value}
          title={`${LABELS[value]} theme`}
        >
          <ThemeIcon theme={value} />
          <span className="sr-only">{LABELS[value]} theme</span>
        </button>
      ))}
    </form>
  );
}

/**
 * Inline SVG rather than an icon package, per the repo's bundle-leanness rule.
 * Each is aria-hidden because the button already carries its name in text.
 */
function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
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

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
