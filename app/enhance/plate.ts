// An island (devkit ./islands): each <template data-island="plate"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
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
   * Each leader grows from its start point with `transform: scale()`, which looks like the line being
   * drawn and, unlike a stroke-dashoffset draw, runs on the compositor (Chrome composites transform
   * and opacity on SVG elements). The plain `transform` property, not `scale`: Chrome does not
   * composite the individual transform properties on SVG. The origin is the line's own start, in the
   * drawing's coordinates; the stroke stays its width while the line grows.
   */
  function drawLeaders(svg: Element) {
    svg.querySelectorAll(".plate-leader").forEach((leader, i) => {
      leader.querySelectorAll<SVGLineElement>("line").forEach((line, j) => {
        line.style.transformBox = "view-box";
        line.style.transformOrigin = `${line.getAttribute("x1")}px ${line.getAttribute("y1")}px`;
        line.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
          duration: j === 0 ? 600 : 260,
          delay: i * 260 + (j === 0 ? 200 : 800),
          easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
          fill: "backwards",
        });
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
}
