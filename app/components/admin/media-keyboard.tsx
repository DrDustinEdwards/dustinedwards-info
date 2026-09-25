import { useCallback } from "react";

import { bands, nextTile } from "~/lib/media/tile-nav.mjs";

/** A key pressed in a field belongs to the field: the arrows move the caret and "/" is a character. */
export function isTypingTarget(target: EventTarget | null) {
  const tag = (target instanceof HTMLElement ? target.tagName : "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** The tile's tab stop in the grid: the thumbnail link, which carries the file's name. */
export function tileLink(key: string) {
  return document.querySelector<HTMLElement>(
    `.media-grid[data-view="grid"] [data-tile="${CSS.escape(key)}"] a.media-thumb-link`,
  );
}

/**
 * The grid's keys, on the grid alone: they act only while focus is on a tile, so a key pressed on a
 * button, a link or the inspector belongs to that control (WCAG 2.1.4). Focus is real and roves:
 * one tile's controls are in the tab order, the arrows move focus to another tile, and the page
 * renders that tile as the tab stop. Enter is the link's own. Rows come from rendered geometry, not a
 * column model: `bands()` in tile-nav.mjs says why.
 */
export function useGridKeyboard({
  setActive,
  setSelected,
}: {
  setActive: (key: string) => void;
  setSelected: (keys: string[]) => void;
}) {
  // Focus arriving on a tile by any route (Tab, a click, the inspector closing) makes it the stop.
  const onFocus = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const key = (event.target as HTMLElement).closest("[data-tile]")?.getAttribute("data-tile");
      if (key) setActive(key);
    },
    [setActive],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tile = (event.target as HTMLElement).closest("[data-tile]");
      const here = tile?.getAttribute("data-tile");
      if (!tile || !here) return;

      const move = (dir: "left" | "right" | "up" | "down") => {
        event.preventDefault();
        const rows = bands(
          [...document.querySelectorAll('.media-grid[data-view="grid"] [data-tile]')].map((el) => {
            const r = el.getBoundingClientRect();
            return { id: el.getAttribute("data-tile") ?? "", top: r.top, left: r.left, width: r.width };
          }),
        );
        const next = nextTile(rows, here, dir);
        if (next === null) return;
        setActive(next);
        tileLink(next)?.focus();
      };

      if (event.key === "ArrowRight") move("right");
      else if (event.key === "ArrowLeft") move("left");
      else if (event.key === "ArrowDown") move("down");
      else if (event.key === "ArrowUp") move("up");
      else if (event.key === "Escape") {
        // Through state: the grid owns the selection, and the boxes render from it.
        event.preventDefault();
        setSelected([]);
      } else if (event.key === "x") {
        // The real checkbox: the bulk form reads those, so a parallel model would select rows it never submits.
        event.preventDefault();
        const box = tile.querySelector("input[type=checkbox]");
        if (box instanceof HTMLInputElement) box.click();
      } else if (event.key === "c") {
        event.preventDefault();
        const button = tile.querySelector(".media-copy");
        if (button instanceof HTMLButtonElement) button.click();
      }
    },
    [setActive, setSelected],
  );

  return { onFocus, onKeyDown };
}
