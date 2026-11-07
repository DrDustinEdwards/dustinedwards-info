// An island (devkit ./islands): each <template data-island="features"> on the page calls this, and the first one runs it.
// A press on a program's chip moves the one active choice: the wrapper's data-feature-filter, which the page's CSS reads to
// hide the other programs' cards, each chip's aria-pressed, the sections left empty, and the line a screen reader hears.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  const root = document.querySelector<HTMLElement>(".features");
  if (!root) return;
  const chips = [...root.querySelectorAll<HTMLButtonElement>(".cap-chip[data-value]")];
  const cards = [...root.querySelectorAll<HTMLElement>(".features-card")];
  const sections = [...root.querySelectorAll<HTMLElement>("[data-section]")];
  const status = root.querySelector<HTMLElement>(".features-status");

  const choose = (value: string): void => {
    root.dataset.featureFilter = value;
    for (const chip of chips)
      chip.setAttribute("aria-pressed", String(chip.dataset.value === value));
    let shown = 0;
    for (const card of cards) {
      const show = value === "all" || card.dataset.program === value;
      card.hidden = !show;
      if (show) shown += 1;
    }
    for (const section of sections) {
      section.hidden = !section.querySelector(".features-card:not([hidden])");
    }
    if (status) {
      const name = chips
        .find((chip) => chip.dataset.value === value)
        ?.firstChild?.textContent?.trim();
      status.textContent =
        value === "all"
          ? `Showing all ${cards.length} features`
          : `Showing ${shown} of ${cards.length} features: ${name ?? value}`;
    }
  };

  for (const chip of chips)
    chip.addEventListener("click", () => choose(chip.dataset.value ?? "all"));
}
