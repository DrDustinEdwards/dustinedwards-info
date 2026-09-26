const MOBILE = "(max-width: 43.99rem)";

const RETURN_AFTER = 8;

const HIDE_BELOW = 64;

function menu(): HTMLDetailsElement | null {
  return document.querySelector<HTMLDetailsElement>("[data-header-menu]");
}

// Focus moves only when requested: after a link click, pulling it back would fight the navigation.
function close(details: HTMLDetailsElement, restoreFocus: boolean) {
  if (!details.open) return;
  details.open = false;
  if (restoreFocus) details.querySelector("summary")?.focus();
}

function enhanceMenu() {
  const details = menu();
  if (!details) return;

  // On the document: after a pointer click focus may be on the summary, a link, or nowhere.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!details.open) return;
    event.preventDefault();
    close(details, true);
  });

  details.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest("a");
    if (link) close(details, false);
  });

  document.addEventListener("click", (event) => {
    if (!details.open) return;
    if (event.target instanceof Node && details.contains(event.target)) return;
    close(details, false);
  });

  /*
   * Tabbing out closes the panel, or it stays open over the next things focus lands on (WCAG 2.4.11).
   * Only when focus went somewhere: a null relatedTarget is the window losing focus, not the reader
   * leaving the menu.
   */
  details.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (!details.open || !(next instanceof Node) || details.contains(next)) return;
    close(details, false);
  });

  details.addEventListener("toggle", () => {
    if (details.open) document.documentElement.removeAttribute("data-header-hidden");
  });
}

/**
 * The attribute goes on `<html>` so the stylesheet owns what hiding looks like; a transform written
 * from here would be a second owner of the header's geometry.
 */
function enhancePersistence() {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  if (!header) return;

  const root = document.documentElement;
  let last = window.scrollY;
  let ticking = false;

  const settle = () => {
    ticking = false;
    const y = window.scrollY;
    const open = menu()?.open ?? false;

    if (y <= HIDE_BELOW || open) {
      root.removeAttribute("data-header-hidden");
      last = y;
      return;
    }

    if (y > last) {
      root.setAttribute("data-header-hidden", "");
      last = y;
      return;
    }

    if (last - y >= RETURN_AFTER) {
      root.removeAttribute("data-header-hidden");
      last = y;
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(settle);
    },
    { passive: true },
  );
}

enhanceMenu();

// Reduced motion gets no hiding at all, not a slower one: a jump without a transition is worse.
if (
  window.matchMedia(MOBILE).matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  enhancePersistence();
}
