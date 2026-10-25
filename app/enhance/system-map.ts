import { enhance } from "capsomer/behavior/system-map";

/*
 * The family of systems at /systems (Capsomer's system map with circles), one page. The server rendered the whole
 * map, a chosen system's circle (the rest Capsomer's script fetches once the page has loaded), the list of the same
 * data and every system's facts, so with script off the drawing is one named picture and everything else is open.
 * Capsomer makes the drawing the control: one tap on any system zooms into its circle (Dustin, 2026-10-18: "it's
 * not intuitive to click twice"), a system on the rim zooms there, and Back to all systems, Escape or a tap outside
 * the circle returns. This shows the system zoomed into's facts below the map (data-chosen, which systems.css
 * reads) and keeps it in the address as ?system=<id> with history.replaceState: no navigation, no new page, and a
 * shared link opens zoomed in, which the server draws.
 */
const PARAM = "system";

/** Shows one system's facts, or none, and writes the choice into the address without navigating. */
function show(id: string | null) {
  for (const section of document.querySelectorAll<HTMLElement>("[data-systems-facts] .systems-facts[data-system]")) section.toggleAttribute("data-chosen", section.dataset.system === id);
  const url = new URL(location.href);
  if (id) url.searchParams.set(PARAM, id);
  else url.searchParams.delete(PARAM);
  if (url.href !== location.href) history.replaceState(history.state, "", url);
}

for (const root of document.querySelectorAll<HTMLElement>("[data-cap='system-map']")) {
  root.addEventListener("cap:system-map-enter", (e) => show((e as CustomEvent<{ id: string }>).detail.id));
  root.addEventListener("cap:system-map-leave", () => show(null));
  // An address naming no system on the map loses the name; one naming a system is drawn zoomed into it.
  if (!root.dataset.zoom) show(null);
}
enhance();
