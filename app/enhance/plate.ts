/**
 * Plate I, linked to its key. Home page only, and pure enhancement (ruling 119): the plate and the
 * specimen row are complete server HTML, every label always drawn. This file adds:
 *   linked highlight   selecting a plaque (hover, tap, keyboard focus) lights it and its row
 *                      entry, and selecting a row entry lights its plaque; a stroke and weight
 *                      change in oxide, set in home.css, never a fill or a glow
 *   focus stops        each plaque and each row entry becomes focusable, with its name; added
 *                      here so a reader without script meets no stop that does nothing
 *   the hint line      "Select a plaque to find it in the key." is server-rendered hidden
 *   the leader intro   on first view the leaders draw out to their labels once, under 2.5s, and
 *                      never under reduced motion or on a later scroll
 * Nothing here writes to the network or to storage. Inventory: `content/enhancements.json`.
 */

const LIT = "is-lit";

const byId = new Map<string, Element[]>();
for (const el of document.querySelectorAll("[data-plaque]")) {
  const id = el.getAttribute("data-plaque") ?? "";
  byId.set(id, [...(byId.get(id) ?? []), el]);
}

/** A tap keeps its plaque lit until another tap, so a touch reader can look from one to the other. */
let pinned: string | null = null;

function light(id: string | null) {
  for (const [key, els] of byId) for (const el of els) el.classList.toggle(LIT, key === id);
}

for (const el of document.querySelectorAll<HTMLElement | SVGGElement>(".plate-plaque, .plate-key-entry")) {
  const id = el.getAttribute("data-plaque");
  if (!id) continue;
  el.setAttribute("tabindex", "0");
  if (el.classList.contains("plate-key-entry")) {
    const name = el.querySelector(".plate-key-name")?.textContent?.toLowerCase() ?? "";
    el.setAttribute("aria-label", `Key entry ${id}, ${name}`);
  }
  // Hover is a mouse's preview; a touch lands as a click below, which pins instead.
  el.addEventListener("pointerenter", (e) => {
    if ((e as PointerEvent).pointerType === "mouse") light(id);
  });
  el.addEventListener("pointerleave", (e) => {
    if ((e as PointerEvent).pointerType === "mouse") light(pinned);
  });
  el.addEventListener("focus", () => light(id));
  el.addEventListener("blur", () => light(pinned));
  el.addEventListener("click", () => {
    pinned = pinned === id ? null : id;
    light(pinned);
  });
}

const hint = document.querySelector<HTMLElement>(".plate-hint");
if (hint && byId.size > 0) hint.hidden = false;

/*
 * THE LEADER INTRO: on first view each leader draws out to its label, once, then the plate is
 * still. Script-driven and FILL "backwards" on purpose: when an animation ends the line drops back
 * to its plain base style, a real style change, so the finished line is always repainted. A CSS
 * animation that held its end state left the leaders unpainted in Chrome (measured 2026-09-22),
 * and a reader without script now simply gets the drawn plate.
 */
function drawLeaders(svg: Element) {
  svg.querySelectorAll(".plate-leader").forEach((leader, i) => {
    leader.querySelectorAll<SVGLineElement>("line").forEach((line, j) => {
      const len = String(Math.ceil(line.getTotalLength()));
      line.animate(
        [
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDasharray: len, strokeDashoffset: "0" },
        ],
        {
          duration: j === 0 ? 600 : 260,
          delay: i * 260 + (j === 0 ? 200 : 800),
          easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
          fill: "backwards",
        },
      );
    });
  });
}

const figure = document.querySelector(".home-plate");
const shown = figure && [...figure.querySelectorAll("svg.plate")].find((s) => s.getBoundingClientRect().width > 0);
if (shown && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const onScreen = (r: DOMRect) => r.top < window.innerHeight && r.bottom > 0;
  if (onScreen(shown.getBoundingClientRect())) {
    // Already in view: start now, before the next paint, so the drawn plate never flashes first.
    drawLeaders(shown);
  } else if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        drawLeaders(shown);
      },
      { threshold: 0.25 },
    );
    observer.observe(shown);
  }
}
