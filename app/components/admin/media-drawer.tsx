import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

/**
 * Where focus goes when the inspector closes: the tile it was opened for, found by `data-tile`
 * rather than a stored node, because opening is a navigation and a drawer opened from the URL has
 * no trigger at all. The grid's tab stop is the thumbnail and the list's is the name.
 */
function focusTile(key: string) {
  if (document.activeElement && document.activeElement !== document.body) return;
  const tile = document.querySelector(`[data-tile="${CSS.escape(key)}"]`);
  const grid = tile?.closest("[data-view]")?.getAttribute("data-view") === "grid";
  const target =
    tile?.querySelector<HTMLElement>(grid ? "a.media-thumb-link" : "a.media-name") ??
    document.getElementById("main");
  target?.focus({ preventScroll: false });
}

/**
 * Drives the inspector's native `<dialog>`: modal once hydrated, so the page behind is inert and
 * the browser owns the focus trap. Returns whether it has hydrated; until then the server render
 * shows the dialog inline through `data-inline`, and its own links open and close it without script.
 */
export function useInspectorDialog(
  ref: React.RefObject<HTMLDialogElement | null>,
  activeKey: string,
  closeHref: string,
) {
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const keyRef = useRef(activeKey);

  useEffect(() => {
    keyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    setHydrated(true);
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();
    // The panel, not Close: focusing Close makes a screen reader announce "Close" as the whole event.
    el.focus({ preventScroll: true });
    // Closing unmounts the dialog and drops focus on the body. Deferred: a tile inside a scroller is
    // not focusable until it has a box.
    return () => {
      window.setTimeout(() => focusTile(keyRef.current), 0);
    };
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => navigate(closeHref, { preventScrollReset: true });
    // Escape leaves by the URL, as the Close link does: a natively closed dialog would leave ?key= behind.
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    // A click outside the panel's box landed on the backdrop, which stands in for the scrim link.
    const onClick = (event: MouseEvent) => {
      if (event.target !== el) return;
      const r = el.getBoundingClientRect();
      const inside =
        event.clientX >= r.left &&
        event.clientX <= r.right &&
        event.clientY >= r.top &&
        event.clientY <= r.bottom;
      if (!inside) close();
    };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("click", onClick);
    };
  }, [ref, closeHref, navigate]);

  return hydrated;
}
