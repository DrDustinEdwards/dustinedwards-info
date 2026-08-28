/**
 * Theme toggle enhancement, and the door the search palette comes through.
 *
 * Everything here removes a round trip and nothing here makes the control work:
 * with this file absent the form posts to /theme, the action sets the cookie
 * and the server renders the chosen theme. That is the zero-JS path and it is
 * the same path the enhancement writes to, because both end at the same cookie.
 *
 * There is deliberately no "apply the stored theme on load" step. The server
 * already wrote the attribute from the cookie, so a script that re-applied it
 * could only ever agree, or race. The flash this file does not have is the one
 * it never creates.
 *
 * ## WHY THE PALETTE LOADER LIVES HERE, of all places
 *
 * Two bundles used to be on every document: this one and the search palette.
 * The palette is by far the larger of the two and it exists to answer one
 * gesture, so almost every reader downloaded a search dialog, parsed it, and
 * navigated away without ever opening it. What the shortcut actually needs on
 * page load is a keydown listener, which is a few lines.
 *
 * So the few lines are here, in the module that is on every page anyway, and
 * the dialog arrives on the first gesture. This file is the smallest thing on
 * the site that is genuinely site-wide, which is the whole reason it was
 * chosen: adding the loader to it costs one document nothing extra, while
 * adding a second site-wide bundle costs every document.
 */

import { serializeThemeCookie, isTheme } from "~/lib/theme";

function enhanceThemeToggle() {
  // Loaded by a script tag whose module executes once per document, so there
  // is no re-run to guard against: without hydration every navigation is a
  // fresh document. Listening on the document rather than the form keeps the
  // handler working wherever the toggle is placed.
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches("[data-theme-toggle]")) return;

    // `submitter` names the button that was pressed, which is where the value
    // lives. Without it a multi-submit form cannot tell which one was clicked.
    const submitter = (event as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement)) return;

    const choice = submitter.value;
    if (!isTheme(choice)) return;

    event.preventDefault();
    apply(choice, form);
  });
}

enhanceThemeToggle();
enhanceSearchTrigger();

/**
 * The event `app/enhance/palette.ts` listens for. One spelling, two files.
 *
 * A custom event rather than a module export, and the reason is a
 * measurement rather than a preference. The direct shape is a dynamic
 * `import()` of the bundle and a call to what it exports; vite rewrites every
 * `import()` into a call to its own `__vitePreload` helper, which MEASURED
 * 2026-08-27 added roughly 2.3 KB to this 714-byte bundle in order to manage a
 * preload graph that does not exist here, since build-enhance emits one
 * self-contained chunk per module. That is a large fraction of what taking the
 * palette off every page saved in the first place.
 *
 * A script element inserted by a script that is already trusted is allowed by
 * `script-src 'strict-dynamic'` with no nonce, which is why this needs no
 * access to the request nonce that `EnhancementScript` has and this file does
 * not.
 */
const PALETTE_OPEN = "palette:open";

/** Set when the bundle has been asked for, so a second gesture adds no tag. */
let requested = false;

/**
 * Opens the palette, fetching it first if this is the first gesture.
 *
 * FAILURE FALLS BACK TO THE PAGE, never to nothing. The caller has already
 * prevented the anchor's default, so a load error would otherwise leave a
 * reader who clicked with no response at all. `/search` is the same
 * destination the anchor carries, so a reader on a broken connection gets the
 * server-rendered search page, which is rule 9's fallback rather than a
 * consolation.
 *
 * The first gesture dispatches from the script's own `load`, because the
 * listener on the other side does not exist until the module has executed.
 * Every later gesture dispatches immediately.
 */
function openPalette() {
  const trigger = document.querySelector<HTMLElement>("[data-palette]");
  // The URL is hashed by the app build, so it cannot be written down here: the
  // `?url` import in search-trigger.tsx is the one statement of it and it
  // arrives on the element this file upgrades. No attribute means no palette,
  // rather than a broken one.
  const url = trigger?.dataset.palette;
  if (!url) {
    location.assign("/search");
    return;
  }

  if (!requested) {
    requested = true;

    /*
     * THE DIALOG'S STYLESHEETS TRAVEL WITH ITS BUNDLE, and they are awaited.
     *
     * The palette's CSS is 861 bytes brotli and the Ask panel inside it another
     * 402, on every document, for markup that does not exist until somebody
     * searches. It comes down here instead, from `data-palette-css`, which the
     * trigger carries as `?url` imports so the hashed names stay the build's
     * business.
     *
     * AWAITED, because the alternative is a visible flash: the bundle builds
     * the dialog and calls showModal the moment it runs, and a stylesheet still
     * in flight at that point means an unstyled modal on screen. Waiting costs
     * nothing a reader can see, since the two fetches are parallel with the
     * script's own.
     *
     * A FAILED STYLESHEET RESOLVES rather than rejecting. An unstyled dialog is
     * a bad dialog and no dialog at all is worse, so only the SCRIPT failing is
     * treated as failure.
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

/** True when a keystroke belongs to whatever the reader is typing in. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Binds the two ways into search and unhides the shortcut hint.
 *
 * THE HINT IS UNHIDDEN HERE, and that is the same promise it always made:
 * `hidden` until the shortcut actually works. It used to wait for the palette
 * bundle, because the palette bundle held the listener. The listener is now
 * attached by the line below, so the hint becomes true earlier rather than
 * later, and it is still never shown to a reader whose script did not run.
 */
function enhanceSearchTrigger() {
  for (const hint of document.querySelectorAll<HTMLElement>("[data-search-hint]")) {
    hint.hidden = false;
  }

  for (const trigger of document.querySelectorAll<HTMLElement>("[data-search-trigger]")) {
    trigger.dataset.shortcutHint = "shown";
    trigger.addEventListener("click", (event) => {
      // Let a modified click do what the browser would do with a link.
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
    // A bare slash opens search, but never while someone is typing into a
    // field, where a slash is just a slash.
    if (event.key === "/" && !meta && !event.altKey && !isTyping(event.target)) {
      event.preventDefault();
      openPalette();
    }
  });
}

function apply(choice: "light" | "dark" | "system", form: HTMLFormElement) {
  const root = document.documentElement;

  // "system" is the absence of the attribute, which hands the decision back to
  // the prefers-color-scheme block. Setting data-theme="system" would match
  // neither theme selector and leave the page on the light defaults.
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }

  document.cookie = serializeThemeCookie(choice);

  for (const button of form.querySelectorAll("button[value]")) {
    button.setAttribute("aria-pressed", String(button.getAttribute("value") === choice));
  }
}
