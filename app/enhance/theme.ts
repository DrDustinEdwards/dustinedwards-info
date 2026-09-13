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

import { serializeThemeCookie, isWritableTheme, type WritableTheme } from "~/lib/theme";

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
    /*
     * THE WRITABLE SET, which is exactly what `/theme` accepts. One predicate
     * for both, so the enhancement cannot apply a value its own fallback would
     * reject: the two halves of the control agree about what a legal
     * submission is because they ask the same function.
     */
    if (!isWritableTheme(choice)) return;

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

/*
 * `isTyping` WENT WITH THE BARE SLASH. It existed so a slash typed into a
 * field stayed a slash, and Cmd/Ctrl-K needs no such guard: it collides with
 * nothing a reader types. A helper kept past its only caller is dead code that
 * reads as load-bearing.
 */

/**
 * Binds the two ways into search and makes the shortcut discoverable.
 *
 * THE HINT IS TOLD HERE AND NOWHERE ELSE, and that is the same promise it has
 * always made: nothing advertises the shortcut until the shortcut works. It
 * used to wait for the palette bundle, because that bundle held the listener;
 * the listener is attached by the line below, so the hint becomes true earlier
 * rather than later, and a reader whose script did not run is still never told
 * about a key that would do nothing for them.
 *
 * WHAT CHANGED 2026-08-29 IS THE SURFACE, NOT THE CONTRACT. It was a visible
 * `<kbd>/</kbd>` inside the control, removed on Dustin's aesthetic ruling. The
 * two surfaces that replace it cost no pixels: `title`, which a pointer user
 * gets on hover, and the `aria-describedby` region, which a screen reader
 * announces after the control's name. Both are set from here, so both inherit
 * the honesty contract for free.
 */
function enhanceSearchTrigger() {
  for (const hint of document.querySelectorAll<HTMLElement>("[data-search-hint]")) {
    hint.hidden = false;
  }

  for (const trigger of document.querySelectorAll<HTMLElement>("[data-search-trigger]")) {
    /*
     * THE TOOLTIP IS SET HERE RATHER THAN SERVER-RENDERED, for the reason the
     * description is hidden until now: a `title` the server wrote would promise
     * a shortcut to a reader who has no script to answer it.
     */
    trigger.title = "Search";
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
    /*
     * THE BARE SLASH IS GONE, ruled against in the Part A review and accepted.
     * It collides with find-in-page, which is a browser affordance readers
     * already own, and it was borrowed from application UIs rather than earned
     * by anything this site does. Cmd/Ctrl-K stays: it is the palette
     * convention, it collides with nothing a browser binds, and it is not
     * advertised to a reader who has no script to answer it.
     */
  });
}

function apply(choice: WritableTheme, form: HTMLFormElement) {
  const root = document.documentElement;

  /*
   * A FLIP, so the attribute is always written. This carried a branch that
   * removed it instead, for a submission the control no longer makes; it was
   * unreachable code on the one path it existed for and still cost every reader
   * its bytes.
   *
   * Returning to the default is not a submission and needs no line here: a
   * reader clears the cookie in their browser and the next render omits the
   * attribute server-side, which is where the default has always been applied.
   */
  root.setAttribute("data-theme", choice);

  document.cookie = serializeThemeCookie(choice);

  /*
   * ## THE CONTROL REDRAWS ITSELF FROM THE ATTRIBUTE, so there is nothing here
   *
   * This used to rewrite `aria-pressed` across three buttons. The single
   * control has no pressed state and no label to rewrite: both buttons are in
   * the DOM, `chrome-nav.css` displays whichever matches `data-theme`, and the
   * line above is the only thing that has to change for the right one to
   * appear. Swapping an icon or a label from here would be a second owner of a
   * decision the cascade already makes.
   *
   * ## FOCUS HAS TO MOVE, THOUGH, and that is not cosmetic
   *
   * The button that was just activated is the one the cascade hides, and
   * `display: none` on the focused element drops focus to `<body>`. A keyboard
   * reader would flip the theme and lose their place in the header, which is a
   * worse outcome than the round trip this enhancement exists to avoid.
   *
   * So focus moves to the button that replaced it, but ONLY when the hidden one
   * actually held focus. A pointer click leaves focus wherever the browser put
   * it, and stealing it in that case would be its own defect.
   */
  const active = document.activeElement;
  if (active instanceof HTMLElement && form.contains(active) && active.offsetParent === null) {
    const shown = [...form.querySelectorAll<HTMLElement>("button[value]")].find(
      (button) => button.offsetParent !== null,
    );
    shown?.focus();
  }
}
