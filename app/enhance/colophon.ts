import { enhance as enhanceField } from "capsomer/behavior/field";

// An island (devkit ./islands): each <template data-island="colophon"> on the page calls this, and the first one runs it.
// The server sends the whole page. This adds two things: the side index marks the section being read (aria-current), and the
// feature chips, which appear only here, show one group of features at a time.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  spy();
  filter();
  kinds();
  finders();
  // Each filter box's Clear button (Capsomer's search field).
  enhanceField();
}

function spy(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".page-contents a[href^='#']")];
  const marks = links
    .map((link) => ({ link, heading: document.getElementById(link.hash.slice(1)) }))
    .filter((m): m is { link: HTMLAnchorElement; heading: HTMLElement } => m.heading !== null);
  if (marks.length === 0 || !("IntersectionObserver" in window)) return;
  const visible = new Set<HTMLElement>();
  const mark = (): void => {
    const current = marks.find((m) => visible.has(m.heading)) ?? null;
    if (!current) return;
    for (const m of marks) {
      if (m === current) m.link.setAttribute("aria-current", "location");
      else m.link.removeAttribute("aria-current");
    }
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
        else visible.delete(entry.target as HTMLElement);
      }
      mark();
    },
    { rootMargin: "-80px 0px -60% 0px" },
  );
  for (const m of marks) observer.observe(m.heading);
}

function filter(): void {
  const chipBar = document.querySelector<HTMLElement>(".colophon-chips");
  if (!chipBar) return;
  const chips = [...chipBar.querySelectorAll<HTMLButtonElement>(".cap-chip[data-value]")];
  const cards = [...document.querySelectorAll<HTMLElement>(".colophon-features > li")];
  const status = document.querySelector<HTMLElement>(".colophon-status");
  chipBar.hidden = false;
  const choose = (value: string): void => {
    let shown = 0;
    for (const chip of chips)
      chip.setAttribute("aria-pressed", String(chip.dataset.value === value));
    for (const card of cards) {
      const show = value === "all" || card.dataset.group === value;
      card.hidden = !show;
      if (show) shown += 1;
    }
    if (status)
      status.textContent =
        value === "all"
          ? `Showing all ${cards.length} entries`
          : `Showing ${shown} of ${cards.length} entries: ${value}`;
  };
  for (const chip of chips)
    chip.addEventListener("click", () => choose(chip.dataset.value ?? "all"));
  /* One group on screen to begin with; All is a press away, and the HTML holds every card either way. */
  const firstGroup = chips.find((chip) => chip.dataset.value !== "all")?.dataset.value;
  if (firstGroup) choose(firstGroup);
}

function kinds(): void {
  const bar = document.querySelector<HTMLElement>(".colophon-kinds");
  if (!bar) return;
  const chips = [...bar.querySelectorAll<HTMLButtonElement>(".cap-chip[data-value]")];
  const rows = [...document.querySelectorAll<HTMLElement>("tr[data-kind]")];
  bar.hidden = false;
  for (const chip of chips)
    chip.addEventListener("click", () => {
      const value = chip.dataset.value ?? "all";
      for (const other of chips) other.setAttribute("aria-pressed", String(other === chip));
      for (const row of rows) row.hidden = value !== "all" && row.dataset.kind !== value;
    });
}

function finders(): void {
  const status = document.querySelector<HTMLElement>(".colophon-status");
  for (const input of document.querySelectorAll<HTMLInputElement>("[data-find]")) {
    const list = document.querySelector<HTMLElement>(`[data-list="${input.dataset.find}"]`);
    if (!list) continue;
    const items = [...list.querySelectorAll<HTMLElement>("li")];
    input.closest<HTMLElement>("[data-find-field]")!.hidden = false;
    input.addEventListener("input", () => {
      const query = input.value.trim().toLowerCase();
      let shown = 0;
      for (const item of items) {
        const show = !query || (item.textContent ?? "").toLowerCase().includes(query);
        item.hidden = !show;
        if (show) shown += 1;
      }
      if (status) status.textContent = `${shown} of ${items.length} shown`;
    });
  }
}
