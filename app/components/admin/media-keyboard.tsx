import { useEffect, useState } from "react";

/**
 * TOASTS AND GRID KEYBOARD NAVIGATION: the two page-level enhancements. Both
 * need script and both are accepted as needing it. Neither is the only way to do
 * anything: every action a shortcut reaches has a visible control, and every toast
 * reports something the page also shows.
 */

/** The event any component fires to say something. One channel, one listener. */
const TOAST_EVENT = "media-toast";

/**
 * A CUSTOM EVENT rather than context, deliberately: the alternative is a provider
 * wrapping the page and a hook in every component that might speak, which would put
 * the toast in the server render where it has nothing to say. If no toast is
 * mounted, nothing happens and nothing breaks.
 */
export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

/**
 * THE TOAST, which exists because a copy that succeeds silently looks broken.
 *
 * `role="status"` with `aria-live="polite"`, because the copy button's own
 * acknowledgment is a `::after` on a data attribute, which a screen reader never
 * sees.
 *
 * IT IS ALWAYS IN THE DOM once mounted, empty until it has something to say: a
 * live region inserted at the moment it gets content is frequently not announced.
 */
export function MediaToast({ initialMessage = "" }: { initialMessage?: string }) {
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    let timer = 0;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setMessage(detail);
      window.clearTimeout(timer);
      // Long enough to read a filename, short enough not to sit over the grid.
      timer = window.setTimeout(() => setMessage(""), 2600);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <p className="media-toast" role="status" aria-live="polite" data-showing={message ? "yes" : undefined}>
      {message}
    </p>
  );
}

/**
 * READING THE RENDERED GEOMETRY rather than a layout model. The column count is
 * decided by the browser from the container width, and computing it here would be a
 * second layout engine that disagrees with the real one at exactly the widths
 * nobody tested.
 *
 * So down means "the tile nearest my horizontal center, one visual row lower",
 * measured from `getBoundingClientRect`, which keeps working when the grid
 * reflows and when the last row is short.
 *
 * DEGRADES TO NOTHING: every tile is a link and a checkbox already.
 */
export function MediaKeyboard({ initialActive = "" }: { initialActive?: string }) {
  const [active, setActive] = useState(initialActive);

  /*
   * Marked in the DOM rather than by re-rendering the grid, which is what keeps
   * this island from owning the grid's state.
   */
  useEffect(() => {
    for (const el of document.querySelectorAll("[data-tile]")) {
      if (el.getAttribute("data-tile") === active) el.setAttribute("data-active-tile", "yes");
      else el.removeAttribute("data-active-tile");
    }
  }, [active]);

  useEffect(() => {
    /** Visual rows, from the rendered boxes. Tiles within 6px share a row. */
    const bands = () => {
      const out: Array<{ top: number; items: Array<{ id: string; mid: number }> }> = [];
      for (const el of document.querySelectorAll("[data-tile]")) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const id = el.getAttribute("data-tile") ?? "";
        const entry = { id, mid: r.left + r.width / 2 };
        const band = out.find((b) => Math.abs(b.top - r.top) < 6);
        if (band) band.items.push(entry);
        else out.push({ top: r.top, items: [entry] });
      }
      out.sort((a, b) => a.top - b.top);
      for (const b of out) b.items.sort((x, y) => x.mid - y.mid);
      return out;
    };

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = (target?.tagName ?? "").toUpperCase();
      // NEVER inside a field. Arrow keys move a caret there, and stealing them
      // would break typing in order to speed up finding.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const rows = bands();
      const flat = rows.flatMap((b) => b.items.map((i) => i.id));
      // The first id is guarded rather than the length: the same early return on an
      // empty grid, and it is what makes the two `setActive` calls below pass a string
      // rather than a possibly-absent one.
      const firstId = flat[0];
      if (firstId === undefined) return;

      const move = (dir: "left" | "right" | "up" | "down") => {
        event.preventDefault();
        if (!active) {
          setActive(firstId);
          return;
        }
        let ri = -1;
        let ci = -1;
        rows.forEach((b, i) =>
          b.items.forEach((it, j) => {
            if (it.id === active) {
              ri = i;
              ci = j;
            }
          }),
        );
        if (ri < 0) {
          setActive(firstId);
          return;
        }
        // Both are guarded rather than asserted: the indices came from walking `rows`,
        // so these returns are unreachable, and an unreachable return substitutes nothing
        // while a non-null assertion would hide a real regression.
        const row = rows[ri];
        const current = row?.items[ci];
        if (!row || !current) return;
        if (dir === "left" || dir === "right") {
          const next = row.items[ci + (dir === "right" ? 1 : -1)];
          // Falling off the end of a row continues into the next one, which is
          // what reading order means and what a flat index gives for free.
          if (next) setActive(next.id);
          else {
            const k = flat.indexOf(active) + (dir === "right" ? 1 : -1);
            const wrapped = flat[k];
            if (wrapped) setActive(wrapped);
          }
          return;
        }
        const band = rows[ri + (dir === "down" ? 1 : -1)];
        if (!band) return;
        const mid = current.mid;
        let best = band.items[0];
        if (!best) return;
        let bestD = Infinity;
        for (const it of band.items) {
          const d = Math.abs(it.mid - mid);
          if (d < bestD) {
            bestD = d;
            best = it;
          }
        }
        setActive(best.id);
      };

      const tile = () => document.querySelector(`[data-tile="${CSS.escape(active)}"]`);

      if (event.key === "ArrowRight") move("right");
      else if (event.key === "ArrowLeft") move("left");
      else if (event.key === "ArrowDown") move("down");
      else if (event.key === "ArrowUp") move("up");
      else if (event.key === "Escape") {
        /*
         * ESCAPE CLEARS EVERYTHING THIS PAGE CAN HAVE OPEN, which is what the key means
         * everywhere else. ORDER MATTERS: the drawer and the modals stop this event before
         * it reaches here, so one press closes the thing ON TOP rather than everything at
         * once.
         */
        setActive("");
        // Every `<details>` popover: Display, and the shortcuts panel.
        for (const d of document.querySelectorAll("details[open]")) {
          (d as HTMLDetailsElement).open = false;
        }
        // The selection, by unchecking the real boxes rather than keeping a second copy
        // of it here. The grid owns the selection; this asks.
        for (const box of document.querySelectorAll(
          '.media-card input[type="checkbox"]:checked',
        )) {
          (box as HTMLInputElement).click();
        }
      } else if (event.key === "x" && active) {
        // THE REAL CHECKBOX, clicked. Not a parallel selection model: the bulk form reads
        // those checkboxes, so anything else would select rows the submission does not
        // carry.
        event.preventDefault();
        const box = tile()?.querySelector("input[type=checkbox]");
        if (box instanceof HTMLInputElement) box.click();
      } else if (event.key === "c" && active) {
        event.preventDefault();
        const button = tile()?.querySelector(".media-copy");
        if (button instanceof HTMLButtonElement) button.click();
      } else if (event.key === "Enter" && active) {
        event.preventDefault();
        const link = tile()?.querySelector("a.media-thumb-link");
        if (link instanceof HTMLAnchorElement) link.click();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return null;
}
