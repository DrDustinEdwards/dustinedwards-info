import { controller } from "capsomer/behaviour/system-map";

/*
 * The family of systems at /systems (Capsomer's system map), one page. The server rendered the whole
 * map, the list of the same data and every system's facts, so with script off the drawing is one named
 * picture and everything else is open. This makes the drawing the control: one tab stop with the arrow
 * keys between neighbours, choosing draws a system's lines, choosing Capsid again goes inside it, and the
 * Plain map view. Choosing also shows that system's facts below the map (data-chosen, which systems.css
 * reads) and keeps it in the address as ?system=<id> with history.replaceState: no navigation, no new
 * page, and a shared link opens with that system chosen, which the server names in data-chosen.
 */
const PARAM = "system";

for (const root of document.querySelectorAll<HTMLElement>("[data-cap='system-map']")) {
  if (root.hasAttribute("data-cap-ready")) continue;
  root.setAttribute("data-cap-ready", "");
  const map = controller(root, root.dataset.openLabel ?? "Open");
  const tiles = [...root.querySelectorAll<SVGGElement>(".cap-system-map-tile[data-id]")];
  const onMap = (id: string | null | undefined): id is string => !!id && tiles.some((t) => t.dataset.id === id);
  const facts = document.querySelector<HTMLElement>("[data-systems-facts]");

  /** The system the map shows chosen, as its controller left it. */
  const current = () => tiles.find((t) => t.getAttribute("aria-pressed") === "true")?.dataset.id ?? null;
  /** Shows one system's facts, or none, and writes the choice into the address without navigating. */
  const show = (id: string | null) => {
    for (const section of facts?.querySelectorAll<HTMLElement>(".systems-facts[data-system]") ?? []) section.toggleAttribute("data-chosen", section.dataset.system === id);
    const url = new URL(location.href);
    if (id) url.searchParams.set(PARAM, id);
    else url.searchParams.delete(PARAM);
    if (url.href !== location.href) history.replaceState(history.state, "", url);
  };
  /** The one tab stop moves to a system, so Tab enters the map where the page is. */
  const rove = (id: string) => {
    for (const tile of tiles) tile.setAttribute("tabindex", tile.dataset.id === id ? "0" : "-1");
  };

  root.addEventListener("cap:system-map-select", (e) => show((e as CustomEvent<{ id: string }>).detail.id));
  // Escape clears a choice without an event; this runs after the controller's own key handler.
  root.addEventListener("keydown", () => show(current()));

  // A connection in the facts chooses that system in place; a modified click still opens the address.
  facts?.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = (e.target as Element).closest<HTMLAnchorElement>("a[data-choose]")?.dataset.choose;
    if (!onMap(id)) return;
    e.preventDefault();
    map.leave();
    map.select(id);
    rove(id);
    // The link pressed is now hidden, so focus goes to the system it named, where the keys work.
    tiles.find((t) => t.dataset.id === id)?.focus({ preventScroll: true });
  });

  const fromServer = root.parentElement?.dataset.chosen;
  const asked = fromServer ?? new URL(location.href).searchParams.get(PARAM);
  if (onMap(asked)) {
    map.select(asked);
    rove(asked);
  } else {
    // An address naming no system on the map loses the name.
    show(null);
  }
}
