import { useEffect, useState } from "react";

import { bands, nextTile } from "~/lib/media/tile-nav.mjs";

/** A key pressed in a field belongs to the field: the arrows move the caret and "/" is a character. */
export function isTypingTarget(target: EventTarget | null) {
  const tag = (target instanceof HTMLElement ? target.tagName : "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// Rows come from rendered geometry, not a column model: `bands()` in tile-nav.mjs says why.
export function MediaKeyboard() {
  const [active, setActive] = useState("");

  useEffect(() => {
    for (const el of document.querySelectorAll("[data-tile]")) {
      if (el.getAttribute("data-tile") === active) el.setAttribute("data-active-tile", "yes");
      else el.removeAttribute("data-active-tile");
    }
  }, [active]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const rows = bands(
        [...document.querySelectorAll("[data-tile]")].map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.getAttribute("data-tile") ?? "", top: r.top, left: r.left, width: r.width };
        }),
      );
      if (rows.length === 0) return;

      const move = (dir: "left" | "right" | "up" | "down") => {
        event.preventDefault();
        const next = nextTile(rows, active, dir);
        if (next !== null) setActive(next);
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
