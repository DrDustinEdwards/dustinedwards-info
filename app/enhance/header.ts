import { enhance, type Suggest } from "capsomer/behavior/site-header";

import { isAbandonedTransition } from "~/lib/transition-abort.mjs";

// The header module is on every public page, so the one rejection the browser raises when it abandons a view
// transition under a reload or a second navigation is let go here (app/lib/transition-abort.mjs). Any other
// rejection still reaches the console and the page error report.
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  if (isAbandonedTransition(event.reason)) event.preventDefault();
});

type Hit = { url: string; type: string; title: string; documentTitle: string | null };

/** The header's live search: the site's own /search, asked for JSON, as Capsomer's matches. */
const suggest: Suggest = async (query, signal) => {
  const response = await fetch(`/search?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) return [];
  const { results = [] } = (await response.json()) as { results?: Hit[] };
  return results.map((hit) => ({
    url: hit.url.replace(/^https?:\/\/[^/]+/, ""),
    title: hit.title,
    kind: hit.type,
    detail: hit.documentTitle && hit.documentTitle !== hit.title ? hit.documentTitle : undefined,
  }));
};

/*
 * Capsomer's site header behavior (capsomer/behavior/site-header) on the markup site-header.tsx writes by
 * hand: each section's panel (hover opens at once, a click or a key holds it, Escape and a press outside close
 * it, arrow keys move through it, focus goes back to its button), each icon control's tip, and search. With no
 * script none of this runs and nothing is lost: the panels open by popovertarget and the search icon is a link.
 */
const header = document.querySelector<HTMLElement>("[data-site-header]");
if (header) {
  enhance(document, { suggest });

  /*
   * Capsomer sends focus to a panel's button whenever the panel closes with nothing focused, which is also how
   * a panel opened by hover closes when the pointer leaves. That left a focus ring on a button the mouse never
   * pressed. Focus that was nowhere before the close goes back to nowhere; focus inside the panel still returns
   * to its button. Capsomer's own toggle listener runs first, so this one undoes only that case.
   */
  for (const panel of header.querySelectorAll<HTMLElement>("[data-nav-panel]")) {
    let unfocused = false;
    panel.addEventListener("beforetoggle", (event) => {
      if ((event as ToggleEvent).newState === "closed") unfocused = !document.activeElement || document.activeElement === document.body;
    });
    panel.addEventListener("toggle", (event) => {
      if ((event as ToggleEvent).newState !== "closed" || !unfocused) return;
      const button = header.querySelector<HTMLElement>(`[aria-controls="${panel.id}"]`);
      if (button && document.activeElement === button) button.blur();
    });
  }
}
