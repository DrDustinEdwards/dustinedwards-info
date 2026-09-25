// The sign-in door's busy state. The form works without this: it posts to the route action, which
// answers a 303 to Google, so all this adds is the label and the refusal of a second submit.

for (const form of document.querySelectorAll<HTMLFormElement>("form[data-sign-in]")) {
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  if (!button) continue;
  const idle = button.textContent;

  form.addEventListener("submit", (event) => {
    // aria-disabled, not disabled: disabling the focused button would drop focus to the body.
    if (button.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    button.setAttribute("aria-disabled", "true");
    button.textContent = "Redirecting...";
  });

  // Back from Google restores this page from the back/forward cache, busy label and all.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    button.removeAttribute("aria-disabled");
    button.textContent = idle;
  });
}
