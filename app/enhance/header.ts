import { enhance } from "capsomer/behaviour/site-header";
import { applyTheme } from "capsomer/behaviour/theme-switch";

import { isAbandonedTransition } from "~/lib/transition-abort.mjs";

// The header module is on every public page, so the one rejection the browser raises when it abandons a view
// transition under a reload or a second navigation is let go here (app/lib/transition-abort.mjs). Any other
// rejection still reaches the console and the page error report.
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  if (isAbandonedTransition(event.reason)) event.preventDefault();
});

/*
 * Capsomer's site header behaviour (capsomer/behaviour/site-header) on the markup site-header.tsx writes by
 * hand: each section's panel (hover opens at once, a click or a key holds it, Escape and a press outside close
 * it, arrow keys move through it, focus goes back to its button), each icon control's tip, and the phone's
 * Menu button and sheet. With no script none of this runs and nothing is lost: the panels open by
 * popovertarget and the sheet by invoker commands.
 */
const header = document.querySelector<HTMLElement>("[data-site-header]");
if (header) {
  /*
   * Capsomer drops a control's aria-describedby when it wires the control's tip, because its tip only repeats
   * the name. The search link's description is not its tip but the shortcut hint (theme.ts), so it is kept.
   */
  const described = Array.from(
    header.querySelectorAll<HTMLElement>("[aria-describedby]"),
    (element) => [element, element.getAttribute("aria-describedby") ?? ""] as const,
  );
  enhance();
  for (const [element, ids] of described) element.setAttribute("aria-describedby", ids);

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

  // The sheet is the behaviour's now; the invoker commands were its no-script path.
  for (const element of header.querySelectorAll("[commandfor]")) {
    element.removeAttribute("command");
    element.removeAttribute("commandfor");
  }
}

/*
 * The public theme is a cookie the server reads (app/lib/theme.ts, enhance/theme.ts). Capsomer's theme switch
 * remembers the same choice in this browser for the admin plane, whose shell reads it before first paint, so
 * a choice made on the public site is the admin's too.
 */
document.addEventListener("submit", (event) => {
  const form = event.target;
  const submitter = (event as SubmitEvent).submitter;
  if (!(form instanceof HTMLFormElement) || !form.matches("[data-theme-toggle]")) return;
  if (!(submitter instanceof HTMLButtonElement)) return;
  if (submitter.value === "light" || submitter.value === "dark") applyTheme(submitter.value);
});
