import {
  columnValues,
  countText,
  DEFAULT_SORT,
  filterRows,
  SORT_COLUMNS,
  sortRows,
  type PhageRow,
  type SortDirection,
  type SortKey,
} from "~/lib/phage-table.mjs";

/*
 * The phage table on /research/phages, sortable and filterable. The server already rendered the whole
 * table from markdown, every phage and every link, so with script off it is complete and reads in
 * the page's own order. This reads the rows back out of that table, turns the sortable headers into
 * buttons carrying aria-sort, adds a labelled search box and two selects above it, and says the count
 * through a status region. Nothing animates, so there is nothing for reduced motion to stop.
 */

const HEADERS = SORT_COLUMNS.map(([, label]) => label);

function findTable(): HTMLTableElement {
  for (const table of document.querySelectorAll<HTMLTableElement>(".prose .table-scroll > table")) {
    const labels = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
    if (HEADERS.every((label, index) => labels[index] === label)) return table;
  }
  throw new Error("phages: the page has no table headed Phage, Year, Host, County; the markdown and this module disagree.");
}

const table = findTable();
const body = table.tBodies[0];
const wrapper = table.parentElement;
if (!body || !wrapper) throw new Error("phages: the phage table has no body or no scroll wrapper.");
const tbody: HTMLTableSectionElement = body;

const trs = new Map<number, HTMLTableRowElement>();
const rows: PhageRow[] = [...tbody.rows].map((tr, order) => {
  const cell = (index: number) => tr.cells[index]?.textContent?.trim() ?? "";
  const year = Number.parseInt(cell(1), 10);
  trs.set(order, tr);
  return { name: cell(0), year: Number.isFinite(year) ? year : null, host: cell(2), county: cell(3), order };
});

let sort: { key: SortKey; direction: SortDirection } = { ...DEFAULT_SORT };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = "") {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text) node.textContent = text;
  return node;
}

/* The controls: a search box and two selects, each with a visible label, and the status region. */
const controls = el("div", { class: "phage-table-controls" });
const search = el("input", { type: "search", id: "phage-table-q", autocomplete: "off", spellcheck: "false" });
const hostSelect = el("select", { id: "phage-table-host" });
const countySelect = el("select", { id: "phage-table-county" });

function field(id: string, label: string, control: HTMLElement) {
  const wrap = el("div", { class: "phage-tool-field" });
  wrap.append(el("label", { for: id }, label), control);
  return wrap;
}

function fillSelect(select: HTMLSelectElement, anyLabel: string, values: string[]) {
  select.append(el("option", { value: "" }, anyLabel));
  for (const value of values) select.append(el("option", { value }, value));
}

fillSelect(hostSelect, "Any host", columnValues(rows, "host"));
fillSelect(countySelect, "Any county", columnValues(rows, "county"));

const status = el("p", { class: "phage-table-status", role: "status" });
controls.append(
  field("phage-table-q", "Find a phage", search),
  field("phage-table-host", "Host", hostSelect),
  field("phage-table-county", "County", countySelect),
);

/* The sortable headers become buttons; aria-sort sits on the header cell, where it is announced. */
const headerCells = [...table.querySelectorAll<HTMLTableCellElement>("thead th")];
const buttons = new Map<SortKey, HTMLButtonElement>();
SORT_COLUMNS.forEach(([key, label], index) => {
  const th = headerCells[index];
  if (!th) throw new Error(`phages: the table has no header for ${label}.`);
  const button = el("button", { type: "button", class: "phage-table-sort" });
  button.append(document.createTextNode(label), el("span", { class: "phage-table-sort-mark", "aria-hidden": "true" }));
  button.addEventListener("click", () => {
    const direction: SortDirection =
      sort.key === key && sort.direction === "ascending" ? "descending" : "ascending";
    sort = { key, direction };
    render(`Sorted by ${label.toLowerCase()}, ${direction}. `);
  });
  th.replaceChildren(button);
  buttons.set(key, button);
});

function paintHeaders() {
  SORT_COLUMNS.forEach(([key], index) => {
    const th = headerCells[index];
    if (!th) return;
    if (key === sort.key) th.setAttribute("aria-sort", sort.direction);
    else th.removeAttribute("aria-sort");
    const mark = buttons.get(key)?.querySelector(".phage-table-sort-mark");
    if (mark) mark.textContent = key === sort.key ? (sort.direction === "ascending" ? "↑" : "↓") : "↕";
  });
}

let announceTimer = 0;

/** Reorders and hides the existing rows; nothing is re-rendered, so every link stays as served. */
function render(prefix = "", announceNow = true) {
  const shown = new Set(
    filterRows(rows, { q: search.value, host: hostSelect.value, county: countySelect.value }).map((row) => row.order),
  );
  const fragment = document.createDocumentFragment();
  for (const row of sortRows(rows, sort.key, sort.direction)) {
    const tr = trs.get(row.order);
    if (!tr) throw new Error(`phages: lost the row for ${row.name}.`);
    tr.hidden = !shown.has(row.order);
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
  paintHeaders();

  // Typing is announced once it pauses, so a screen reader is not read a count per keystroke.
  window.clearTimeout(announceTimer);
  const text = `${prefix}${countText(shown.size, rows.length)}`;
  if (announceNow) status.textContent = text;
  else announceTimer = window.setTimeout(() => (status.textContent = text), 500);
}

search.addEventListener("input", () => render("", false));
hostSelect.addEventListener("change", () => render());
countySelect.addEventListener("change", () => render());

// The first count is in place before the region joins the page, so it is not announced on load.
render();
wrapper.before(controls, status);
