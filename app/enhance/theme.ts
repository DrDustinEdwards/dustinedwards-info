/**
 * Theme toggle enhancement.
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
 */

import { serializeThemeCookie, isTheme } from "~/lib/theme";

let wired = false;

export function enhanceThemeToggle() {
  // The header mounts once per document, but a client navigation can re-run the
  // effect. Listening on the document once keeps that from stacking handlers.
  if (wired) return;
  wired = true;

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
