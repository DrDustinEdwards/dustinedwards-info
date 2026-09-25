import { useEffect, useState } from "react";

const TOAST_EVENT = "media-toast";

// A custom event, not context: a provider would put the toast in the server render, where it has nothing to say.
export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

// Always in the DOM once mounted: a live region inserted when it gets content is often not announced.
export function MediaToast() {
  const [message, setMessage] = useState("");

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

// Rows come from rendered geometry, not a column model: the browser decides the column count, and a
// second layout engine would disagree with it at the widths nobody tested.
export function MediaKeyboard() {
  const [active, setActive] = useState("");

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
      // Never inside a field, where the arrow keys move the caret.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const rows = bands();
      const flat = rows.flatMap((b) => b.items.map((i) => i.id));
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
        const row = rows[ri];
        const current = row?.items[ci];
        if (!row || !current) return;
        if (dir === "left" || dir === "right") {
          const next = row.items[ci + (dir === "right" ? 1 : -1)];
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
        // Order matters: the drawer and modals stop Escape first, so one press closes only the thing on top.
        setActive("");
        for (const d of document.querySelectorAll("details[open]")) {
          (d as HTMLDetailsElement).open = false;
        }
        // Unchecks the real boxes: the grid owns the selection.
        for (const box of document.querySelectorAll(
          '.media-card input[type="checkbox"]:checked',
        )) {
          (box as HTMLInputElement).click();
        }
      } else if (event.key === "x" && active) {
        // The real checkbox: the bulk form reads those, so a parallel model would select rows it never submits.
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
