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
  /*
   * No focus stops: lighting is a pointer's way of matching a plaque to its key entry, and the key
   * already pairs them in text. Twelve stops on things that are not controls cost a keyboard reader
   * more than the highlight gives. The attribute is only the stylesheet's pointer cue.
   */
  el.setAttribute("data-plate-live", "");
  // Hover is a mouse's preview; a touch lands as a click below, which pins instead.
  el.addEventListener("pointerenter", (e) => {
    if ((e as PointerEvent).pointerType === "mouse") light(id);
  });
  el.addEventListener("pointerleave", (e) => {
    if ((e as PointerEvent).pointerType === "mouse") light(pinned);
  });
  el.addEventListener("click", () => {
    pinned = pinned === id ? null : id;
    light(pinned);
  });
}

/*
 * `fill: "backwards"` on purpose: when the animation ends the line drops back to its base style, a
 * real style change that forces a repaint. A CSS animation holding its end state left the leaders
 * unpainted in Chrome.
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
