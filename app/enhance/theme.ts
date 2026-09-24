// No "apply the stored theme on load" step: the server already wrote the attribute, so a script
// that re-applied it could only agree, or race.

import { serializeThemeCookie, isWritableTheme, type WritableTheme } from "~/lib/theme";

function enhanceThemeToggle() {
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("[data-theme-toggle]")) return;

    const submitter = (event as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;

    const choice = submitter.value;
    if (!isWritableTheme(choice)) return;

    event.preventDefault();
    apply(choice, form);
  });
}

enhanceThemeToggle();
enhanceSearchTrigger();

/**
 * A custom event rather than `import()`, because vite wraps every `import()` in a preload helper that
 * would be a large share of this bundle. `strict-dynamic` allows the inserted script with no nonce.
 */
const PALETTE_OPEN = "palette:open";

let requested = false;

/**
 * The caller has already prevented the anchor's default, so a load failure must fall back to
 * `/search`, never to nothing.
 */
function openPalette() {
  const trigger = document.querySelector<HTMLElement>("[data-palette]");
  // The URL is hashed by the app build; the `?url` import in `search-trigger.tsx` is its one statement.
  const url = trigger?.dataset.palette;
  if (!url) {
    location.assign("/search");
    return;
  }

  if (!requested) {
    requested = true;

    /*
     * Stylesheets are awaited because the bundle calls `showModal` as soon as it runs. A failed
     * stylesheet resolves: an unstyled dialog is better than none.
     */
    const pending = [];
    for (const href of (trigger?.dataset.paletteCss ?? "").split(",").filter(Boolean)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      pending.push(
        new Promise((resolve) => {
          link.addEventListener("load", () => resolve(null));
          link.addEventListener("error", () => resolve(null));
        }),
      );
      document.head.appendChild(link);
    }

    const script = document.createElement("script");
    script.type = "module";
    script.src = url;
    pending.push(
      new Promise((resolve, reject) => {
        script.addEventListener("load", () => resolve(null));
        script.addEventListener("error", () => reject(new Error("palette bundle")));
      }),
    );
    document.head.appendChild(script);

    void Promise.all(pending).then(
      () => document.dispatchEvent(new Event(PALETTE_OPEN)),
      () => location.assign("/search"),
    );
    return;
  }

  document.dispatchEvent(new Event(PALETTE_OPEN));
}

/**
 * The hint is set only from script, so a reader whose script did not run is never told about a key
 * that would do nothing. Platform detection is best-effort: the handler accepts meta or ctrl either way.
 */
function shortcutChord(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /mac/i.test(platform) ? "Command-K" : "Control-K";
}

function enhanceSearchTrigger() {
  const chord = shortcutChord();

  // Text before unhide, so the stale server placeholder is never the announced description.
  for (const hint of document.querySelectorAll<HTMLElement>("[data-search-hint]")) {
    hint.textContent = `Press ${chord} to search`;
    hint.hidden = false;
  }

  for (const trigger of document.querySelectorAll<HTMLElement>("[data-search-trigger]")) {
    trigger.title = `Search (${chord})`;
    trigger.dataset.shortcutHint = "shown";
    trigger.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openPalette();
    });
  }

  document.addEventListener("keydown", (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openPalette();
      return;
    }
    // Deliberately no bare-slash shortcut: it collides with find-in-page.
  });
}

function apply(choice: WritableTheme, form: HTMLFormElement) {
  const root = document.documentElement;

  root.setAttribute("data-theme", choice);

  document.cookie = serializeThemeCookie(choice);

  /*
   * Activating a button hides it via the cascade, and `display: none` drops focus to `<body>`, so move
   * focus to its twin, only when the hidden one held it. `preventScroll` because Chrome scrolls a
   * focused sticky-header descendant toward its un-stuck position.
   */
  const active = document.activeElement;
  if (active instanceof HTMLElement && form.contains(active) && active.offsetParent === null) {
    const shown = [...form.querySelectorAll<HTMLElement>("button[value]")].find(
      (button) => button.offsetParent !== null,
    );
    shown?.focus({ preventScroll: true });
  }
}
