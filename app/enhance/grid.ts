// An island (devkit ./islands): each <template data-island="grid"> on the page calls this, and the first one runs it.
// The layout grid, laid over the page on request: `?grid=1` in the address, or the G key (again to take it off). The
// grid is drawn by shell.css from the `data-grid` attribute on <html>; nothing else on the page changes.
let started = false;

/** A key typed into a field, or with a modifier held, belongs to the field or the browser, not to the grid. */
function isTyping(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export default function start(): void {
  if (started) return;
  started = true;
  const root = document.documentElement;
  if (new URLSearchParams(location.search).get("grid") === "1") root.setAttribute("data-grid", "");
  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "g" || event.repeat || isTyping(event)) return;
    root.toggleAttribute("data-grid");
  });
}
