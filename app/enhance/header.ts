import { enhance } from "capsomer/behavior/site-header";

import { suggest } from "../lib/search-suggest";
import { isAbandonedTransition } from "../lib/transition-abort.mjs";

// An island (devkit ./islands): each <template data-island="header"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  // The header module is on every public page, so the one rejection the browser raises when it abandons a view
  // transition under a reload or a second navigation is let go here (app/lib/transition-abort.mjs). Any other
  // rejection still reaches the console and the page error report.
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    if (isAbandonedTransition(event.reason)) event.preventDefault();
  });

  /*
   * Capsomer's site header behavior (capsomer/behavior/site-header) on the markup its SiteHeader writes with no
   * hydration (site-header.tsx): each section's panel (hover opens at once, a click or a key holds it, Escape
   * and a press outside close it, arrow keys move through it, focus goes back to its button), each icon
   * control's tip, and search. With no script none of this runs and nothing is lost: the panels open by
   * popovertarget and the search icon is a link.
   */
  if (document.querySelector('[data-cap="site-header"]')) enhance(document, { suggest });
}
