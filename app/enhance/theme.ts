// No "apply the stored theme on load" step: the server already wrote the attribute, so a script
// that re-applied it could only agree, or race.

import { enhance as enhanceThemeForm } from "capsomer/behavior/theme-switch";

// An island (devkit ./islands): each <template data-island="theme"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  // Capsomer's theme form (site-header.tsx): a press switches at once, writes the cookie the server reads, and
  // remembers the choice for the admin plane.
  enhanceThemeForm();

  /** The palette island listens for this once it has started. */
  const PALETTE_OPEN = "palette:open";
  /** Asks /site.js to start islands added since the page loaded (app/site.ts). */
  const ISLANDS_START = "islands:start";
  /** A palette that has not started by then failed to load (startIslands reports why on the console). */
  const PALETTE_WAIT_MS = 5000;

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
    if (!requested) {
      requested = true;
      trigger?.setAttribute("aria-busy", "true");

      /*
       * Stylesheets are awaited because the bundle calls `showModal` as soon as it runs. A failed
       * stylesheet resolves: an unstyled dialog is better than none.
       */
      const pending: Promise<unknown>[] = [];
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

      // The palette is an island like any other, started by /site.js (app/site.ts) once its marker is in the
      // page; not an import() here, which Vite would wrap in a preload helper every page would then fetch. Its
      // start adds the PALETTE_OPEN listener, and startIslands marks the element ready after it.
      const marker = document.createElement("template");
      marker.dataset.island = "palette";
      document.body.appendChild(marker);
      pending.push(
        new Promise((resolve, reject) => {
          const watch = new MutationObserver(() => {
            if (marker.dataset.islandReady === undefined) return;
            watch.disconnect();
            resolve(null);
          });
          watch.observe(marker, { attributes: true });
          setTimeout(() => reject(new Error("the palette island did not start")), PALETTE_WAIT_MS);
        }),
      );
      document.dispatchEvent(new Event(ISLANDS_START));

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
}
