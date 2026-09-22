/**
 * Header enhancement: the menu's keyboard contract, and the mobile header's partial persistence.
 *
 * NOTHING HERE MAKES THE HEADER WORK. With this file absent the menu still opens and closes,
 * because it is a `<details>` and the browser owns that; the links still navigate; and the header
 * simply STAYS STATIC, never hiding and never returning. That is the named fallback, and it is the
 * whole of it: no behaviour below is the only way to reach anything.
 *
 * What it adds is what `<details>` does not give: Escape closes the menu, choosing a link closes
 * it, focus returns to the button that opened it, and on narrow widths the header gets out of the
 * way when a reader scrolls down and comes back when they scroll up.
 *
 * REDUCED MOTION IS NOT A SLOWER ANIMATION HERE, IT IS NO HIDING AT ALL. Ruling 126 says static
 * under reduced motion, so the scroll listener is never attached; a header that jumped away without
 * a transition would be worse than one that animated.
 */

/** The narrow-width behaviour is the only part with a width condition, and this is it. */
const MOBILE = "(max-width: 43.99rem)";

/** How far a reader must scroll up before the header comes back. Ruling 126: a few pixels. */
const RETURN_AFTER = 8;

/** Below this the page has not scrolled enough for hiding to mean anything. */
const HIDE_BELOW = 64;

function menu(): HTMLDetailsElement | null {
  return document.querySelector<HTMLDetailsElement>("[data-header-menu]");
}

/**
 * Closes the menu and puts focus back where it came from.
 *
 * FOCUS MOVES ONLY WHEN IT WAS INSIDE. Closing on a link click moves focus by navigating, and
 * pulling it back to the button on the way out would fight the navigation.
 */
function close(details: HTMLDetailsElement, restoreFocus: boolean) {
  if (!details.open) return;
  details.open = false;
  if (restoreFocus) details.querySelector("summary")?.focus();
}

function enhanceMenu() {
  const details = menu();
  if (!details) return;

  /*
   * ESCAPE, on the document rather than the panel: focus may legitimately sit on the summary, on a
   * link, or nowhere in particular after a pointer click, and all three should close.
   */
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!details.open) return;
    event.preventDefault();
    close(details, true);
  });

  /* Choosing a destination closes the menu behind you. Focus follows the navigation. */
  details.addEventListener("click", (event) => {
    const link = (event.target as Element | null)?.closest("a");
    if (link) close(details, false);
  });

  /*
   * A CLICK OUTSIDE CLOSES IT. Without this the panel stays open behind whatever the reader went
   * on to touch, which is the one state a `<details>` menu gets wrong on a phone.
   */
  document.addEventListener("click", (event) => {
    if (!details.open) return;
    if (event.target instanceof Node && details.contains(event.target)) return;
    close(details, false);
  });

  /*
   * THE HEADER NEVER HIDES WITH THE MENU OPEN. Sliding a panel off the top while somebody is
   * reading it is the defect this line exists to prevent, and it is cheaper to state here than to
   * unpick from the scroll handler.
   */
  details.addEventListener("toggle", () => {
    if (details.open) document.documentElement.removeAttribute("data-header-hidden");
  });
}

/**
 * Partial persistence, narrow widths only.
 *
 * The attribute goes on `<html>` rather than on the header, so the stylesheet owns every pixel of
 * what hiding LOOKS like and this file owns only when it is true. A transform written from here
 * would be a second owner of the header's geometry.
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

    /* Near the top, and with the menu open, the header is always present. */
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

    /* Coming back up, but only after enough movement to be a decision rather than a wobble. */
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

/*
 * THE TWO HALVES HAVE DIFFERENT CONDITIONS. The menu's keyboard contract is right at every width
 * and under every motion preference. Persistence is narrow-width, full-motion only, and when it
 * does not apply the attribute is never written, so the header stays exactly where the sheet puts
 * it.
 */
enhanceMenu();

if (
  window.matchMedia(MOBILE).matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  enhancePersistence();
}
