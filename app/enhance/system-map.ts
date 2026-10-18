import { controller } from "capsomer/behaviour/system-map";

/*
 * The family of systems at /systems (Capsomer's system map), one page. The server rendered the whole map, a chosen
 * system's inside (scripts/lib/system-layout.mjs; the rest are fetched below), the list of the same data and every
 * system's facts, so with script off the drawing is one named picture and everything else is open. This makes the drawing the control: one tab
 * stop with the arrow keys between neighbours, and ONE tap on any system zooms into its circle (Dustin,
 * 2026-10-18: "it's not intuitive to click twice"): its parts inside, the systems it connects to round the rim,
 * each wire from the part that uses it. A system on the rim is a tap to zoom there. "Back to all systems", Escape
 * or a tap outside the circle returns to the map.
 *
 * Capsomer draws an inside for the core alone and its controller enters only the core, so the site does the rest
 * here: it shows the system's layer and writes the detail line itself. Capsomer's controller takes the first inside
 * layer on the page as the core's; where that is the core's (a ?system= address naming the core), the site calls
 * Capsomer's own enter for it, which plays the core's flows. Zooming also shows that system's facts below the map
 * (data-chosen, which systems.css reads) and keeps it in the address as ?system=<id> with history.replaceState: no
 * navigation, no new page, and a shared link opens zoomed in, which the server draws.
 */
const PARAM = "system";
const BACK = "Back to all systems";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Every system's circle but one the server sent, fetched from the asset it names
 * (scripts/lib/system-insides-plugin.mjs) and added to the stage. The page carries none at rest and a ?system=
 * page's own, for its load time. A failed fetch adds nothing: those systems
 * are then chosen as Capsomer chooses them, with their lines and their facts.
 */
async function addInsides(root: HTMLElement) {
  const stage = root.querySelector<HTMLElement>("[data-cap-part='stage']");
  const url = root.dataset.insides;
  if (!stage || !url) return;
  let all: Record<string, string> = {};
  try {
    const res = await fetch(url);
    if (res.ok) all = (await res.json()) as Record<string, string>;
  } catch {
    return;
  }
  const have = new Set([...stage.querySelectorAll<SVGSVGElement>("[data-layer='inside'][data-system]")].map((l) => l.dataset.system));
  for (const [id, svg] of Object.entries(all)) {
    if (have.has(id)) continue;
    const t = document.createElement("template");
    t.innerHTML = svg;
    const layer = t.content.firstElementChild;
    if (layer) stage.appendChild(layer);
  }
  root.setAttribute("data-insides-ready", "");
}

for (const root of document.querySelectorAll<HTMLElement>("[data-cap='system-map']")) {
  if (root.hasAttribute("data-cap-ready")) continue;
  start(root);
}

/** The map, made the control. */
function start(root: HTMLElement) {
  root.setAttribute("data-cap-ready", "");
  // The server may have drawn a system zoomed in (?system=); it is zoomed again below, with no movement, since
  // the attributes it sets are the ones already there.
  const fromServer = root.parentElement?.dataset.chosen;

  const map = controller(root, root.dataset.openLabel ?? "Open");
  const stage = root.querySelector<HTMLElement>("[data-cap-part='stage']");
  const detail = root.querySelector<HTMLElement>("[data-cap-part='detail']");
  // The way back sits with the views, beside Capsid and Plain map, shown while a system is zoomed into.
  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "cap-btn";
  backButton.dataset.systemsBack = "";
  backButton.textContent = BACK;
  backButton.hidden = true;
  root.querySelector<HTMLElement>("[data-cap-part='views']")?.appendChild(backButton);
  const tiles = [...root.querySelectorAll<SVGGElement>(".cap-system-map-tile[data-id]")];
  const layers = new Map<string, SVGSVGElement>();
  const findLayers = () => {
    for (const l of root.querySelectorAll<SVGSVGElement>("[data-layer='inside'][data-system]")) layers.set(l.dataset.system ?? "", l);
  };
  findLayers();
  // The other circles come once the page has loaded and gone quiet, off its first paint's path; a tap before then
  // waits for them.
  let loading: Promise<void> | null = null;
  const load = () => (loading ??= addInsides(root).then(findLayers));
  const later = () => ("requestIdleCallback" in window ? requestIdleCallback(() => void load(), { timeout: 2000 }) : setTimeout(() => void load(), 200));
  if (document.readyState === "complete") later();
  else addEventListener("load", later, { once: true });
  const coreId = tiles.find((t) => t.hasAttribute("data-core"))?.dataset.id;
  // Capsomer's controller takes the first inside layer as the core's: the server puts the core's first.
  const coreIsCapsomers = !!coreId && root.querySelector<SVGSVGElement>("[data-layer='inside']")?.dataset.system === coreId;
  const shell = root.querySelector<SVGSVGElement>("[data-layer='core']")?.viewBox.baseVal;
  const onMap = (id: string | null | undefined): id is string => !!id && tiles.some((t) => t.dataset.id === id);
  const facts = document.querySelector<HTMLElement>("[data-systems-facts]");
  const listed = (id: string, part: string) => root.querySelector(`.cap-system-map-list li[data-id="${CSS.escape(id)}"] .cap-system-map-item-${part}`)?.textContent ?? "";

  let zoomed: string | null = null;
  /** The system last asked for, which a tap before the circles are in zooms into once they are. */
  let waiting: string | null = null;
  // Capsomer's leave chooses the core again, which would zoom back into it: that choice is the controller's, not the reader's.
  let quiet = false;

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
  const capsomerEntered = () => coreIsCapsomers && zoomed === coreId && root.hasAttribute("data-entered");
  const leaveCapsomer = () => {
    quiet = true;
    map.leave();
    quiet = false;
  };

  /** What the circle holds, in words, for the detail line and for a screen reader. */
  const describe = (id: string, layer: SVGSVGElement) => {
    const names = (sel: string) => [...layer.querySelectorAll(sel)].map((b) => [...b.querySelectorAll(".cap-system-map-box-name, .systems-rim-name")].map((t) => t.textContent).join("")).filter(Boolean);
    const parts = names(".cap-system-map-box:not([data-external])");
    const outside = names(".cap-system-map-box[data-external]");
    const systems = names(".systems-rim");
    const name = listed(id, "name") || id;
    const label = `${name}: ${parts.length ? `${parts.join(", ")} inside.` : "no parts drawn."}${outside.length ? ` Outside it: ${outside.join(", ")}.` : ""}${systems.length ? ` Connects to ${systems.join(", ")}.` : ""}`;
    const counts = parts.length ? `${parts.length} ${parts.length === 1 ? "part" : "parts"} inside${outside.length ? `, ${outside.length} outside` : ""}` : layer.querySelector(".systems-inside-text") ? "" : "No parts drawn";
    const linked = systems.length ? `Tap ${systems.length === 1 ? "the system" : "a system"} on the rim to go there` : "";
    return { name, label, text: [counts, linked].filter(Boolean).join(". ") };
  };

  /** Capsomer's detail line for the core, in the site's words: the system's name and what its circle holds. */
  const relabel = () => {
    if (!zoomed || root.dataset.flow) return;
    const strong = detail?.querySelector(".cap-system-map-detail-name");
    const name = listed(zoomed, "name");
    if (strong && name && strong.textContent !== name) strong.textContent = name;
    const text = detail?.querySelector(".cap-system-map-detail-text");
    if (text && text.textContent !== about) text.textContent = about;
  };
  /** The detail line's words for the system zoomed into. */
  let about = "";
  if (detail) new MutationObserver(relabel).observe(detail, { childList: true });

  const zoom = (id: string, focus: boolean) => {
    const layer = layers.get(id);
    waiting = id;
    if (!layer && !root.hasAttribute("data-insides-ready")) {
      // Zoomed once its circle is in, unless the reader has chosen something else, or gone back, by then.
      void load().then(() => {
        if (waiting === id && layers.has(id)) zoom(id, focus);
      });
      return;
    }
    if (!layer || zoomed === id) return;
    if (capsomerEntered()) {
      // Capsomer's leave chooses the core; the system asked for is chosen again.
      leaveCapsomer();
      quiet = true;
      map.select(id);
      quiet = false;
    }
    zoomed = id;
    // The circle grows out of the system's own capsomer.
    const tile = tiles.find((t) => t.dataset.id === id);
    if (tile && shell) layer.style.transformOrigin = `${(((Number(tile.dataset.x) - shell.x) / shell.width) * 100).toFixed(1)}% ${(((Number(tile.dataset.y) - shell.y) / shell.height) * 100).toFixed(1)}%`;
    for (const [key, l] of layers) {
      const on = key === id;
      l.toggleAttribute("data-shown", on);
      if (!on) {
        l.setAttribute("aria-hidden", "true");
        l.removeAttribute("role");
        l.removeAttribute("aria-label");
      }
    }
    root.dataset.zoom = id;
    backButton.hidden = false;
    const { name, label, text } = describe(id, layer);
    const said = listed(id, "text").replace(/\.$/, "");
    about = `${[said, text].filter(Boolean).join(". ")}${said || text ? "." : ""}`;
    if (id === coreId && coreIsCapsomers) {
      map.enter();
      relabel();
    } else {
      root.setAttribute("data-entered", "");
      if (detail) detail.innerHTML = `<strong class="cap-system-map-detail-name">${esc(name)}</strong><span class="cap-system-map-detail-text">${esc(about)}</span>`;
    }
    layer.removeAttribute("aria-hidden");
    layer.setAttribute("role", "img");
    layer.setAttribute("aria-label", label);
    show(id);
    if (focus) {
      // In the next frame, as is the scroll: focus lays the page out, and the tap's own handler stays short.
      requestAnimationFrame(() => {
        if (zoomed !== id) return;
        backButton.focus({ preventScroll: true });
        // The circle in view, with the detail line above it where they fit together.
        const top = detail?.getBoundingClientRect().top ?? 0;
        const bottom = stage?.getBoundingClientRect().bottom ?? 0;
        const by = bottom > innerHeight - 8 ? Math.min(top - 8, bottom - innerHeight + 8) : top < 0 ? top - 8 : 0;
        if (by) scrollBy({ top: by, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
    }
  };

  const back = () => {
    waiting = null;
    const was = zoomed;
    if (!was) return;
    if (capsomerEntered()) leaveCapsomer();
    zoomed = null;
    backButton.hidden = true;
    root.removeAttribute("data-entered");
    delete root.dataset.zoom;
    for (const l of layers.values()) {
      l.removeAttribute("data-shown");
      l.setAttribute("aria-hidden", "true");
      l.removeAttribute("role");
      l.removeAttribute("aria-label");
    }
    map.select(null);
    show(null);
    rove(was);
    requestAnimationFrame(() => {
      if (!zoomed) tiles.find((t) => t.dataset.id === was)?.focus({ preventScroll: true });
    });
  };

  // Choosing a system, by a tap, Enter or Space on its capsomer, zooms into it.
  root.addEventListener("cap:system-map-select", (e) => {
    if (quiet) return;
    zoom((e as CustomEvent<{ id: string }>).detail.id, true);
  });

  // Before Capsomer's own handlers: the way back, a system on the rim, and a tap outside the circle.
  root.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element;
      if (!zoomed) return;
      const stop = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      if (target.closest("[data-systems-back], [data-cap-part='leave']")) {
        stop();
        back();
        return;
      }
      const goto = target.closest<SVGGElement>(".systems-rim[data-goto]")?.dataset.goto;
      if (onMap(goto)) {
        stop();
        rove(goto);
        map.select(goto);
        return;
      }
      if (stage?.contains(target) && !target.closest(".cap-system-map-box")) {
        const layer = layers.get(zoomed);
        const circle = layer?.querySelector<SVGCircleElement>(".cap-system-map-boundary");
        const m = circle?.getScreenCTM();
        if (!circle || !m || !(e instanceof MouseEvent)) return;
        const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        if (Math.hypot(at.x - circle.cx.baseVal.value, at.y - circle.cy.baseVal.value) > circle.r.baseVal.value) {
          stop();
          back();
        }
      }
    },
    { capture: true },
  );

  // Escape returns to the map from anywhere on the page; while a flow plays, Capsomer's Escape stops it first.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || !zoomed || root.dataset.flow) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      back();
    },
    { capture: true },
  );

  const asked = fromServer ?? new URL(location.href).searchParams.get(PARAM);
  if (onMap(asked)) {
    rove(asked);
    quiet = true;
    map.select(asked);
    quiet = false;
    zoom(asked, false);
  } else {
    // An address naming no system on the map loses the name.
    show(null);
  }
}
