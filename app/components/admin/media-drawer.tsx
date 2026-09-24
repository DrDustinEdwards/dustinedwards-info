import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

// Focus return is derived from `data-tile`, not a stored activeElement: opening is a navigation, so
// the stored node may be gone, and a drawer opened from the URL has no trigger at all.
export function MediaDrawer({
  activeKey,
  closeHref,
}: {
  activeKey: string;
  closeHref: string;
}) {
  const navigate = useNavigate();
  const panel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    panel.current = document.querySelector(".media-detail");
    const el = panel.current;
    if (!el) return;

    const stops = () =>
      [
        ...el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ].filter((n) => n.offsetParent !== null || getComputedStyle(n).position === "fixed");

    // Focus the panel, not Close: focusing Close makes a screen reader announce "Close" as the whole event.
    const previous = document.activeElement as HTMLElement | null;
    el.focus({ preventScroll: true });

    const close = () => {
      navigate(closeHref, { preventScrollReset: true });
      // Deferred: a tile inside a scroller is not focusable until it has a box.
      window.setTimeout(() => {
        const tile = document.querySelector<HTMLElement>(
          `[data-tile="${CSS.escape(activeKey)}"] a.media-thumb-link`,
        );
        if (tile) {
          tile.focus({ preventScroll: false });
          return;
        }
        if (previous && previous.isConnected && previous !== document.body) previous.focus();
      }, 0);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // Stop here, or one Escape would close the drawer AND clear the selection behind it.
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const list = stops();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      // Focus escapes the drawer entirely when a form control unmounts.
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
