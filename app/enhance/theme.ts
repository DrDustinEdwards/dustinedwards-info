/**
 * Theme toggle enhancement, and the door the search palette comes through.
 *
 * EVERYTHING HERE REMOVES A ROUND TRIP AND NOTHING HERE MAKES THE CONTROL WORK: with this file
 * absent the form posts to `/theme` and the server renders the chosen theme. Both paths end at the
 * same cookie.
 *
 * There is deliberately no "apply the stored theme on load" step: the server already wrote the
 * attribute, so a script that re-applied it could only agree, or race.
 *
 * WHY THE PALETTE LOADER LIVES HERE: the shortcut needs only a keydown listener on load, and this is
 * the smallest genuinely site-wide module. Putting it here costs one document nothing; a second
 * site-wide bundle costs every document.
 */

import { serializeThemeCookie, isWritableTheme, type WritableTheme } from "~/lib/theme";

function enhanceThemeToggle() {
  // Loaded by a script tag whose module executes once per document, so there is no re-run to guard
  // against: without hydration every navigation is a fresh document. Listening on the document keeps
  // the handler working wherever the toggle is placed.
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
     * THE WRITABLE SET, which is exactly what `/theme` accepts. One predicate for both, so the
     * enhancement cannot apply a value its own fallback would reject.
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
 * A custom event rather than a dynamic `import()`, because vite rewrites every `import()` into its
 * preload helper, which is a large fraction of this bundle in order to manage a preload graph that
 * does not exist: build-enhance emits one self-contained chunk per module.
 *
 * A script element inserted by a script that is already trusted is allowed by `script-src
 * 'strict-dynamic'` with no nonce, which is why this needs no access to the request nonce.
 */
const PALETTE_OPEN = "palette:open";

/** Set when the bundle has been asked for, so a second gesture adds no tag. */
let requested = false;

/**
 * Opens the palette, fetching it first if this is the first gesture.
 *
 * FAILURE FALLS BACK TO THE PAGE, NEVER TO NOTHING. The caller has already prevented the anchor's
 * default, so a load error would leave a reader who clicked with no response at all. `/search` is
 * the same destination the anchor carries.
 *
 * The first gesture dispatches from the script's own `load`, because the listener on the other side
 * does not exist until the module has executed.
 */
function openPalette() {
  const trigger = document.querySelector<HTMLElement>("[data-palette]");
  // The URL is hashed by the app build, so it cannot be written down here: the `?url` import in
  // `search-trigger.tsx` is the one statement of it. No attribute means no palette, rather than a
  // broken one.
  const url = trigger?.dataset.palette;
  if (!url) {
    location.assign("/search");
    return;
  }

  if (!requested) {
    requested = true;

    /*
     * THE DIALOG'S STYLESHEETS TRAVEL WITH ITS BUNDLE, and they are awaited. The palette's CSS exists
     * for markup that does not exist until somebody searches, so it comes down here from
     * `data-palette-css` rather than on every document.
     *
     * AWAITED, because the bundle calls `showModal` the moment it runs and a stylesheet still in flight
     * at that point is an unstyled modal on screen.
     *
     * A FAILED STYLESHEET RESOLVES rather than rejecting: an unstyled dialog is bad and no dialog is
     * worse, so only the SCRIPT failing is treated as failure.
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
 * `isTyping` WENT WITH THE BARE SLASH. Cmd/Ctrl-K needs no such guard, and a helper kept past its
 * only caller is dead code that reads as load-bearing.
 */

/**
 * Binds the two ways into search and makes the shortcut discoverable.
 *
 * THE HINT IS TOLD HERE AND NOWHERE ELSE, which is the promise it has always made: nothing
 * advertises the shortcut until the shortcut works, so a reader whose script did not run is never
 * told about a key that would do nothing for them. The two surfaces are `title` for a pointer and
 * the `aria-describedby` region for a screen reader, and both are set from here.
 */
/**
 * THE CHORD, SPELLED FOR THE PLATFORM, AND THE ONLY PLACE IT IS SPELLED. A chord spelled in two
 * places stops agreeing the day one is edited, and the half that rots is the one nobody can see.
 *
 * `userAgentData.platform` first because `navigator.platform` is deprecated, then the old property,
 * then the userAgent string. Getting this wrong costs a reader the wrong modifier NAME, not a broken
 * control: the listener takes meta OR ctrl either way, which is why the detection may be best-effort
 * here and may not be in the handler.
 */
function shortcutChord(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /mac/i.test(platform) ? "Command-K" : "Control-K";
}

function enhanceSearchTrigger() {
  const chord = shortcutChord();

  /*
   * THE TEXT IS WRITTEN BEFORE THE UNHIDE, not after. Unhiding first would open a window, however
   * short, in which the stale server placeholder is the announced description.
   */
  for (const hint of document.querySelectorAll<HTMLElement>("[data-search-hint]")) {
    hint.textContent = `Press ${chord} to search`;
    hint.hidden = false;
  }

  for (const trigger of document.querySelectorAll<HTMLElement>("[data-search-trigger]")) {
    /*
     * THE TOOLTIP IS SET HERE RATHER THAN SERVER-RENDERED: a `title` the server wrote would promise a
     * shortcut to a reader who has no script to answer it.
     */
    trigger.title = `Search (${chord})`;
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
     * THE BARE SLASH IS GONE. It collides with find-in-page, which is a browser affordance readers
     * already own. Cmd/Ctrl-K stays: it collides with nothing a browser binds, and it is not advertised
     * to a reader who has no script to answer it.
     */
  });
}

function apply(choice: WritableTheme, form: HTMLFormElement) {
  const root = document.documentElement;

  /*
   * A FLIP, so the attribute is always written. Returning to the default is not a submission and
   * needs no line here: a reader clears the cookie and the next render omits the attribute
   * server-side, which is where the default has always been applied.
   */
  root.setAttribute("data-theme", choice);

  document.cookie = serializeThemeCookie(choice);

  /*
   * THE CONTROL REDRAWS ITSELF FROM THE ATTRIBUTE, so there is nothing here. Both buttons are in the
   * DOM and the sheet displays whichever matches `data-theme`; swapping an icon or a label from here
   * would be a second owner of a decision the cascade already makes.
   *
   * FOCUS HAS TO MOVE, THOUGH, and that is not cosmetic. The button just activated is the one the
   * cascade hides, and `display: none` on the focused element drops focus to `<body>`. So focus moves
   * to the button that replaced it, but ONLY when the hidden one actually held focus: a pointer click
   * leaves focus wherever the browser put it, and stealing it there would be its own defect.
   */
  const active = document.activeElement;
  if (active instanceof HTMLElement && form.contains(active) && active.offsetParent === null) {
    const shown = [...form.querySelectorAll<HTMLElement>("button[value]")].find(
      (button) => button.offsetParent !== null,
    );
    shown?.focus();
  }
}
