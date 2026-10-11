import { controller } from "capsomer/behaviour/system-map";

/*
 * The family of systems at /systems (Capsomer's system map). The server rendered the whole map
 * and the list of the same data, so with script off the drawing is one named picture and the
 * list is open. This makes the drawing the control: one tab stop with the arrow keys between
 * neighbours, choosing draws a system's lines, choosing Capsid again goes inside it, and the
 * Plain map view. On /systems/<id> the page names its system in data-chosen, and it starts chosen.
 */
for (const root of document.querySelectorAll<HTMLElement>("[data-cap='system-map']")) {
  if (root.hasAttribute("data-cap-ready")) continue;
  root.setAttribute("data-cap-ready", "");
  const map = controller(root, root.dataset.openLabel ?? "Open");
  const chosen = root.parentElement?.dataset.chosen;
  if (!chosen) continue;
  map.select(chosen);
  // The one tab stop moves to the chosen system, so Tab enters the map where the page is.
  for (const tile of root.querySelectorAll<SVGGElement>(".cap-system-map-tile[data-id]")) tile.setAttribute("tabindex", tile.dataset.id === chosen ? "0" : "-1");
}
