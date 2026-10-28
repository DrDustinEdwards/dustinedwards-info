// No "apply the stored theme on load" step: the server already wrote the attribute, so a script
// that re-applied it could only agree, or race.

import { ENHANCE_URL_PREFIX } from "~/lib/enhance-url.mjs";
import { enhance as enhanceThemeForm } from "capsomer/behavior/theme-switch";

// Capsomer's theme form (site-header.tsx): a press switches at once, writes the cookie the server reads, and
// remembers the choice for the admin plane.
enhanceThemeForm();

/**
 * A custom event rather than `import()`, because vite wraps every `import()` in a preload helper that
 * would be a large share of this bundle. 'self' allows the inserted script with no nonce.
 */
const PALETTE_OPEN = "palette:open";

let requested = false;

/**
 * The caller has already prevented the anchor's default, so a refusal or a load failure must fall
 * back to `/search`, never to nothing, and says why in the console first.
 */
function toSearch(reason: unknown) {
  console.error("palette:", reason);
  location.assign("/search");
}

function openPalette() {
  const trigger = document.querySelector<HTMLElement>("[data-palette]");
  // The URL is hashed by the app build; the `?url` imports in `site-header.tsx` are its one statement.
  // Held to the loader's rule, because 'self' trusts whatever the loader inserts from this origin. The
  // element resolves and normalizes the URL, so `..` is gone before the check reads it, and the
  // origin is followed by the prefix's own `/`, so a longer host cannot match. Inline rather than a
  // shared function: every public page loads this bundle, and its budget has no room for one.
  const raw = trigger?.dataset.palette;
  const script = document.createElement("script");
  if (raw) script.src = raw;
  if (!script.src.startsWith(location.origin + ENHANCE_URL_PREFIX)) {
    toSearch(raw);
    return;
  }

  if (!requested) {
    requested = true;
    trigger?.setAttribute("aria-busy", "true");

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

    script.type = "module";
    pending.push(
      new Promise((resolve, reject) => {
        script.addEventListener("load", () => resolve(null));
        script.addEventListener("error", reject);
      }),
    );
    document.head.appendChild(script);

    void Promise.all(pending).then(
      () => {
        trigger?.removeAttribute("aria-busy");
        document.dispatchEvent(new Event(PALETTE_OPEN));
      },
      (reason) => {
        trigger?.removeAttribute("aria-busy");
        toSearch(reason);
      },
    );
    return;
  }

  document.dispatchEvent(new Event(PALETTE_OPEN));
}

// Command-K or Control-K opens the palette. The header's search icon is Capsomer's (app/enhance/header.ts) and
// does not open it.
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openPalette();
  }
});
