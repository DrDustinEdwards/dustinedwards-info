import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

/**
 * THE DRAWER'S KEYBOARD CONTRACT: Escape closes it, Tab stays inside it, and
 * focus goes back to the tile that opened it.
 *
 * THE PANEL ITSELF NEEDS NO SCRIPT: it is server-rendered whenever `?key=` is
 * present, the scrim is a real link, and every control is a form. This component
 * adds the three things a modal surface owes that HTML cannot express.
 *
 * FOCUS RETURN IS DERIVED, not stored. Opening this drawer IS a navigation, so a
 * remembered `activeElement` may be a different node; the drawer knows which key
 * it shows and every tile carries `data-tile`. That also works when the drawer was
 * opened from the URL, where there is no trigger to remember.
 */
export function MediaDrawer({
  activeKey,
  closeHref,
}: {
  /** The key the drawer is showing, which is also how its trigger is found. */
  activeKey: string;
  /** Where closing goes. Built by `hrefWith`, so it carries the whole view. */
  closeHref: string;
}) {
  const navigate = useNavigate();
  const panel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    panel.current = document.querySelector(".media-detail");
    const el = panel.current;
    if (!el) return;

    /** Everything focusable and actually visible inside the drawer. */
    const stops = () =>
      [
        ...el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ].filter((n) => n.offsetParent !== null || getComputedStyle(n).position === "fixed");

    /*
     * FOCUS MOVES IN ON OPEN, and to the panel rather than its first control:
     * focusing Close makes a screen reader announce "Close" as the whole of what just
     * happened, where the panel carries the dialog role and its label.
     */
    const previous = document.activeElement as HTMLElement | null;
    el.focus({ preventScroll: true });

    const close = () => {
      navigate(closeHref, { preventScrollReset: true });
      // Deferred twice: once for React to commit, once for layout to settle, because a
      // tile inside a scroller is not focusable until it has a box.
      window.setTimeout(() => {
        const tile = document.querySelector<HTMLElement>(
          `[data-tile="${CSS.escape(activeKey)}"] a.media-thumb-link`,
        );
        if (tile) {
          tile.focus({ preventScroll: false });
          return;
        }
        // The tile may not be on this page: the drawer is reachable by URL and the row it
        // names can be on any page or none. Falling back to the previously focused element
        // beats collapsing focus to `<body>`.
        if (previous && previous.isConnected && previous !== document.body) previous.focus();
      }, 0);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // STOP HERE. Escape inside the drawer means close the drawer, and nothing else
        // may also act on it, or one press would close the drawer AND clear the selection
        // behind it.
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const list = stops();
      const first = list[0];
      const last = list[list.length - 1];
      // The values are guarded rather than the length. Same early return on an
      // empty list, and it is what tells the compiler these two are elements.
      if (!first || !last) return;
      const active = document.activeElement;
      // Wrapping in both directions, plus the case where focus has escaped the
      // drawer entirely, which is what happens after a form control unmounts.
      if (!el.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    el.addEventListener("keydown", onKey);
    // Escape has to work when focus is anywhere, including on the scrim, so the
    // window listener is the one that catches it outside the panel.
    const onWindowKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !el.contains(document.activeElement)) close();
    };
    window.addEventListener("keydown", onWindowKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onWindowKey);
    };
  }, [activeKey, closeHref, navigate]);

  return null;
}
