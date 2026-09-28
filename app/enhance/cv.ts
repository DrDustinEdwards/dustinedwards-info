import { copyText } from "~/lib/clipboard";
import { renderCvCharts } from "~/lib/cv/render-charts";
import {
  activeCount,
  facetCounts,
  foldText,
  formatDollars,
  groupEntries,
  headline,
  isFiltered,
  matches,
  parseState,
  stateToSearch,
  summaryText,
  type CvState,
  type Facts,
} from "~/lib/cv/view.mjs";

/*
 * The CV, live. The server already rendered every entry, the counts, the charts and the form for the
 * URL's filters (app/routes/cv.tsx), so with script off the page is complete and the form is a plain
 * GET. This runs the same functions (app/lib/cv/view.mjs, app/lib/cv/render-charts.ts) on every input
 * instead of a round trip, and writes the state to the URL, so a copied address opens the same view.
 */

function must(root: Document | HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`cv: the page has no ${selector}; app/routes/cv.tsx and this module disagree.`);
  return found;
}

const root = must(document, "[data-cv]");
const formElement = must(root, "form[data-cv-form]");
if (!(formElement instanceof HTMLFormElement)) throw new Error("cv: [data-cv-form] is not a form.");
const form: HTMLFormElement = formElement;
const results = must(root, "[data-cv-results]");
const summary = must(root, "[data-cv-summary]");
const copied = must(root, "[data-cv-copied]");
const timelineHost = must(root, "[data-cv-timeline]");
const clear = must(root, "[data-cv-clear]");
const PATH = form.getAttribute("action") ?? location.pathname;

const items = new Map<string, HTMLLIElement>();
for (const li of root.querySelectorAll<HTMLLIElement>("li[data-cv-entry]")) items.set(li.id, li);

/** The group notes (talk totals, the mentoring rule) travel with their group when the sort changes. */
const notes = new Map<string, Element>();
for (const note of root.querySelectorAll(".cv-group-note")) {
  const key = note.closest("[data-cv-group]")?.getAttribute("data-cv-group");
  if (key) notes.set(key, note);
}

function numberOr(value: string | undefined, fallback: number | null) {
  return value === undefined || value === "" ? fallback : Number(value);
}

const facts: Facts[] = [...items.values()]
  .map((li) => {
    const d = li.dataset;
    const end = d.end;
    return {
      id: li.id,
      type: d.type as Facts["type"],
      section: d.section ?? null,
      areas: (d.areas ?? "").split(" ").filter(Boolean) as Facts["areas"],
      role: (d.role ?? null) as Facts["role"],
      year: numberOr(d.year, null),
      endYear: end === "present" ? ("present" as const) : numberOr(end, null),
      students: numberOr(d.students, null),
      cohort: d.cohort !== undefined,
      amount: numberOr(d.amount, null),
      order: Number(d.order),
      search: foldText(li.textContent ?? ""),
    };
  })
  .sort((a, b) => a.order - b.order);

function readState(): CvState {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) params.append(key, String(value));
  return parseState(params);
}

let currentSort = readState().sort;

function el(tag: string, className: string, attrs: Record<string, string> = {}) {
  const node = document.createElement(tag);
  node.className = className;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** Moves the existing entries into the new grouping; nothing is re-rendered, so open details stay open. */
function regroup(sort: CvState["sort"]) {
  const fragment = document.createDocumentFragment();
  for (const group of groupEntries(facts, sort)) {
    const section = el("section", "cv-group", { "data-cv-group": group.key });
    const title = el("h2", "cv-group-title");
    title.appendChild(document.createTextNode(`${group.heading} `));
    title.appendChild(el("span", "cv-group-count", { "data-cv-group-count": "" }));
    section.appendChild(title);
    const note = notes.get(group.key);
    if (note) section.appendChild(note);
    for (const part of group.parts) {
      const wrap = el("div", "cv-part", { "data-cv-part": part.key });
      if (part.heading) {
        const h3 = el("h3", "cv-part-title");
        h3.textContent = part.heading;
        wrap.appendChild(h3);
      }
      const list = el("ol", "cv-list");
      for (const id of part.ids) {
        const li = items.get(id);
        if (!li) throw new Error(`cv: grouping named an entry the page does not have: ${id}`);
        list.appendChild(li);
      }
      wrap.appendChild(list);
      section.appendChild(wrap);
    }
    fragment.appendChild(section);
  }
  results.replaceChildren(fragment);
  currentSort = sort;
}

function setText(selector: string, text: string) {
  for (const node of root.querySelectorAll(selector)) node.textContent = text;
}

function drawCharts(state: CvState) {
  const width = timelineHost.clientWidth;
  const charts = renderCvCharts(document, facts, state, PATH, { width: width > 0 ? width : undefined });
  timelineHost.innerHTML = charts.timeline;
  for (const name of ["papers", "grants", "students"] as const) {
    const host = root.querySelector(`[data-cv-spark="${name}"]`);
    if (host) host.innerHTML = charts[name];
  }
}

let announceTimer = 0;

function apply(state: CvState, options: { announceNow?: boolean } = {}) {
  if (state.sort !== currentSort) regroup(state.sort);

  const shown: Facts[] = [];
  for (const f of facts) {
    const visible = matches(f, state);
    const li = items.get(f.id);
    if (li) li.hidden = !visible;
    if (visible) shown.push(f);
  }

  for (const part of results.querySelectorAll<HTMLElement>("[data-cv-part]")) {
    part.hidden = !part.querySelector("li[data-cv-entry]:not([hidden])");
  }
  for (const group of results.querySelectorAll<HTMLElement>("[data-cv-group]")) {
    const n = group.querySelectorAll("li[data-cv-entry]:not([hidden])").length;
    group.hidden = n === 0;
    const count = group.querySelector("[data-cv-group-count]");
    if (count) count.textContent = String(n);
  }

  const counts = headline(shown);
  setText('[data-cv-count="papers"]', String(counts.papers));
  setText('[data-cv-count="grants"]', String(counts.grants));
  setText('[data-cv-count="students"]', String(counts.students));
  setText('[data-cv-count="dollars"]', `${formatDollars(counts.dollars)} awarded`);

  const facets = facetCounts(facts, state);
  for (const node of root.querySelectorAll<HTMLElement>("[data-cv-facet]")) {
    const [kind, id] = (node.dataset.cvFacet ?? "").split(":");
    const table = kind === "type" ? facets.types : kind === "area" ? facets.areas : facets.roles;
    const n = table[id ?? ""] ?? 0;
    if (node instanceof HTMLOptionElement) node.textContent = `${node.dataset.label ?? id} (${n})`;
    else node.textContent = String(n);
  }

  drawCharts(state);
  clear.hidden = !isFiltered(state);
  const on = activeCount(state);
  setText("[data-cv-active]", on > 0 ? `(${on} on)` : "");

  /* A status region re-read on every keystroke would talk over the reader; it settles first. */
  window.clearTimeout(announceTimer);
  const say = () => {
    summary.textContent = summaryText(shown.length, facts.length);
  };
  if (options.announceNow) say();
  else announceTimer = window.setTimeout(say, 450);

  const url = `${PATH}${stateToSearch(state)}${location.hash}`;
  window.history.replaceState(window.history.state, "", url);
}

/* Instant filtering, so the Apply button is only for script off. */
for (const button of form.querySelectorAll<HTMLElement>("[data-cv-apply]")) button.hidden = true;
form.addEventListener("submit", (event) => {
  event.preventDefault();
  apply(readState(), { announceNow: true });
});

let typing = 0;
form.addEventListener("input", (event) => {
  const target = event.target;
  window.clearTimeout(typing);
  if (target instanceof HTMLInputElement && target.type === "search") {
    typing = window.setTimeout(() => apply(readState()), 120);
  } else {
    apply(readState());
  }
});

clear.addEventListener("click", (event) => {
  event.preventDefault();
  form.reset();
  for (const input of form.querySelectorAll<HTMLInputElement>("input[type=checkbox]")) input.checked = false;
  for (const select of form.querySelectorAll("select")) {
    select.value = select.name === "sort" ? currentSort : "";
  }
  const search = form.querySelector<HTMLInputElement>("input[type=search]");
  if (search) search.value = "";
  apply(readState(), { announceNow: true });
});

function setYears(from: number | null, to: number | null) {
  const fromSelect = form.elements.namedItem("from");
  const toSelect = form.elements.namedItem("to");
  if (!(fromSelect instanceof HTMLSelectElement) || !(toSelect instanceof HTMLSelectElement)) {
    throw new Error("cv: the form has no year selects.");
  }
  fromSelect.value = from === null ? "" : String(from);
  toSelect.value = to === null ? "" : String(to);
}

/* A bar is a link to that year's URL; here it filters in place and keeps focus on the same bar. */
timelineHost.addEventListener("click", (event) => {
  const link = (event.target as Element | null)?.closest("a[data-cv-year]");
  if (!link) return;
  event.preventDefault();
  const year = Number(link.getAttribute("data-cv-year"));
  const state = readState();
  const only = state.from === year && state.to === year;
  setYears(only ? null : year, only ? null : year);
  apply(readState(), { announceNow: true });
  timelineHost.querySelector<SVGAElement>(`a[data-cv-year="${year}"]`)?.focus();
});

/* Copying a citation: the plain one is on the page, BibTeX and RIS come from the paper's export route. */
async function citationText(button: HTMLElement): Promise<string> {
  const kind = button.dataset.cvCopy;
  const id = button.dataset.cvFor ?? "";
  if (kind === "plain") return (document.getElementById(`${id}-cite`)?.textContent ?? "").trim();
  const inline = document.getElementById(`${id}-${kind}`);
  if (inline instanceof HTMLTemplateElement) return (inline.content.textContent ?? "").trim();
  const src = button.dataset.cvSrc;
  if (!src) throw new Error(`cv: no ${kind} source for ${id}.`);
  const response = await fetch(src);
  if (!response.ok) throw new Error(`cv: ${src} answered ${response.status}.`);
  return (await response.text()).trim();
}

const COPY_NAMES: Record<string, string> = { plain: "Citation", bibtex: "BibTeX", ris: "RIS" };

for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-cv-copy]")) {
  button.hidden = false;
  button.addEventListener("click", () => {
    const name = COPY_NAMES[button.dataset.cvCopy ?? ""] ?? "Text";
    copied.textContent = "";
    citationText(button)
      .then((text) => copyText(text))
      .then(() => {
        copied.textContent = `${name} copied.`;
        button.dataset.copied = "";
        window.setTimeout(() => delete button.dataset.copied, 1600);
      })
      .catch((error: unknown) => {
        copied.textContent = `${name} was not copied. The file links beside the button download it.`;
        throw error;
      });
  });
}

for (const button of root.querySelectorAll<HTMLButtonElement>("[data-cv-print]")) {
  button.hidden = false;
  button.addEventListener("click", () => window.print());
}

/*
 * On a phone the filters fold behind their summary, open only when a filter is on; wider, they are
 * always open and the summary is not shown. Script off, they stay open everywhere.
 */
const more = root.querySelector("details[data-cv-more]");
if (more instanceof HTMLDetailsElement) {
  const narrow = window.matchMedia("(max-width: 40rem)");
  const fit = () => {
    more.open = !narrow.matches || activeCount(readState()) > 0;
  };
  narrow.addEventListener("change", fit);
  fit();
}

/* Redrawn at the container's width so the axis type is drawn at size, then on resize. */
let resizing = 0;
let drawnWidth = 0;
const redraw = () => {
  const width = timelineHost.clientWidth;
  if (width === 0 || Math.abs(width - drawnWidth) < 8) return;
  drawnWidth = width;
  drawCharts(readState());
};
new ResizeObserver(() => {
  window.clearTimeout(resizing);
  resizing = window.setTimeout(redraw, 120);
}).observe(timelineHost);
redraw();

root.dataset.cvEnhanced = "";
