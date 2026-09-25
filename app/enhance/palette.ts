// ARIA combobox: focus never leaves the input, and arrows move `aria-activedescendant`. Moving DOM
// focus to each row would break typing.

const RECENT_KEY = "search:recent";
const RECENT_LIMIT = 5;
const DEBOUNCE_MS = 140;
const MIN_QUERY = 2;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

interface Hit {
  url: string;
  type: string;
  title: string;
  documentTitle: string;
  anchor: string | null;
  snippet: string;
  matchedOn: string[];
}

let dialog: HTMLDialogElement | null = null;
/** Not named `status`: a module-level `status` collides with `window.status`. */
let askAvailable = false;
let askHandle: { cancel(): void } | null = null;
let askTrigger: HTMLButtonElement | null = null;
let askContainer: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
let listbox: HTMLUListElement | null = null;
let statusLine: HTMLParagraphElement | null = null;
let allResultsLink: HTMLAnchorElement | null = null;
let hits: Hit[] = [];
let active = -1;
let sequence = 0;
let debounce: ReturnType<typeof setTimeout> | undefined;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // A blocked or full localStorage is fine: recent searches are a convenience.
    return [];
  }
}

function pushRecent(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  try {
    const next = [trimmed, ...readRecent().filter((q) => q !== trimmed)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Ignored, as above.
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function build() {
  dialog = document.createElement("dialog");
  dialog.className = "palette";
  dialog.setAttribute("aria-label", "Search this site");
  if (reduceMotion.matches) dialog.dataset.reduceMotion = "";

  dialog.innerHTML = `
    <form class="palette-form" method="dialog" role="search">
      <input
        type="search"
        class="palette-input"
        placeholder="Search, or try tag:cloudflare"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        role="combobox"
        aria-expanded="false"
        aria-controls="palette-listbox"
        aria-autocomplete="list"
        aria-label="Search this site"
      />
      <button type="button" class="palette-close" aria-label="Close search">Esc</button>
    </form>
    <p class="palette-status" role="status" aria-live="polite"></p>
    <ul id="palette-listbox" class="palette-listbox" role="listbox" aria-label="Search results"></ul>
    <div class="palette-ask">
      <button type="button" class="palette-ask-trigger" hidden>Ask AI about this</button>
      <div class="palette-ask-container" hidden></div>
    </div>
    <p class="palette-footer">
      <span><kbd>up</kbd><kbd>down</kbd> to move</span>
      <span><kbd>Enter</kbd> to open</span>
      <a href="/search" class="palette-all-results">All results</a>
    </p>
  `;

  document.body.appendChild(dialog);
  input = dialog.querySelector(".palette-input");
  listbox = dialog.querySelector(".palette-listbox");
  statusLine = dialog.querySelector(".palette-status");
  allResultsLink = dialog.querySelector(".palette-all-results");

  askTrigger = dialog.querySelector(".palette-ask-trigger");
  askContainer = dialog.querySelector(".palette-ask-container");

  // A deliberate second action: an answer generated on every keystroke would bill Workers AI for typing.
  askTrigger?.addEventListener("click", () => void runAsk());

  dialog.querySelector(".palette-close")?.addEventListener("click", () => close());

  // The dialog element itself is the click target for backdrop clicks.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  // A backstop only: `close()` also resets synchronously, because the `close` event proved unreliable
  // for a programmatic close.
  dialog.addEventListener("close", reset);

  input?.addEventListener("input", onInput);
  input?.addEventListener("keydown", onKeydown);
}

function optionId(i: number) {
  return `palette-option-${i}`;
}

function render() {
  if (!listbox || !input) return;
  if (dialog && !dialog.open) return;

  if (hits.length === 0) {
    listbox.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    return;
  }

  input.setAttribute("aria-expanded", "true");

  // Group labels are presentational rows, so the listbox's children stay options to assistive technology.
  const groups = new Map<string, Array<{ hit: Hit; index: number }>>();
  hits.forEach((hit, index) => {
    const list = groups.get(hit.type) ?? [];
    list.push({ hit, index });
    groups.set(hit.type, list);
  });

  let html = "";
  for (const [type, entries] of groups) {
    html += `<li class="palette-group" role="presentation">${escapeHtml(type)}</li>`;
    for (const { hit, index } of entries) {
      const context =
        hit.anchor && hit.documentTitle !== hit.title
          ? `<span class="palette-context">in ${escapeHtml(hit.documentTitle)}</span>`
          : "";
      html += `
        <li
          id="${optionId(index)}"
          class="palette-option"
          role="option"
          aria-selected="${index === active}"
          data-index="${index}"
        >
          <span class="palette-title">${escapeHtml(hit.title)}</span>
          ${context}
          <span class="palette-snippet">${hit.snippet}</span>
          <span class="palette-why">${escapeHtml(hit.matchedOn.join(", "))}</span>
        </li>`;
    }
  }
  listbox.innerHTML = html;

  if (active >= 0) {
    input.setAttribute("aria-activedescendant", optionId(active));
    listbox
      .querySelector(`#${CSS.escape(optionId(active))}`)
      ?.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }

  for (const option of listbox.querySelectorAll<HTMLLIElement>(".palette-option")) {
    option.addEventListener("mouseenter", () => {
      active = Number(option.dataset.index ?? -1);
      syncSelection();
    });
    option.addEventListener("click", () => {
      active = Number(option.dataset.index ?? -1);
      open_();
    });
  }
}

function syncSelection() {
  if (!listbox || !input) return;
  for (const option of listbox.querySelectorAll<HTMLLIElement>(".palette-option")) {
    option.setAttribute("aria-selected", String(Number(option.dataset.index) === active));
  }
  if (active >= 0) input.setAttribute("aria-activedescendant", optionId(active));
  else input.removeAttribute("aria-activedescendant");
}

function renderRecent() {
  if (!listbox || !input) return;
  // Recent searches are not options, so the combobox is not expanded. Set before the early return: a
  // stale `aria-expanded="true"` over an empty listbox promises options that are not there.
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");

  const recent = readRecent();
  if (recent.length === 0) {
    listbox.innerHTML = "";
    if (statusLine) statusLine.textContent = "";
    return;
  }
  listbox.innerHTML =
    `<li class="palette-group" role="presentation">Recent</li>` +
    recent
      .map(
        (query) =>
          `<li class="palette-recent" role="presentation"><button type="button" data-recent="${escapeHtml(
            query,
          )}">${escapeHtml(query)}</button></li>`,
      )
      .join("");
  for (const button of listbox.querySelectorAll<HTMLButtonElement>("[data-recent]")) {
    button.addEventListener("click", () => {
      if (!input) return;
      input.value = button.dataset.recent ?? "";
      onInput();
      input.focus();
    });
  }
}

async function run(query: string) {
  const mine = ++sequence;
  try {
    const response = await fetch(`/search?q=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as {
      results?: Hit[];
      total?: number;
      askAvailable?: boolean;
    };
    if (mine !== sequence) return;
    askAvailable = data.askAvailable === true;
    hits = data.results ?? [];
    active = hits.length > 0 ? 0 : -1;
    if (statusLine) {
      statusLine.textContent =
        hits.length === 0 ? "No results" : `${data.total ?? hits.length} results`;
    }
    // Offered even on zero results: a question the keyword index cannot match is where an answer helps.
    if (askTrigger) askTrigger.hidden = !askAvailable;
    render();
  } catch {
    if (mine !== sequence) return;
    hits = [];
    active = -1;
    if (statusLine) statusLine.textContent = "Search is unavailable. Press Enter for the full page.";
    render();
  }
}

/** A separate dynamic import, so the palette chunk does not carry Ask's weight for readers who only search. */
async function runAsk() {
  if (!askContainer || !input) return;
  const question = input.value.trim();
  if (!question) return;
  askHandle?.cancel();
  let ask: typeof import("./ask").ask;
  try {
    ({ ask } = await import("./ask"));
  } catch {
    // The chunk failed to load: the trigger stays so the reader can retry, and the status says so.
    if (statusLine) statusLine.textContent = "Ask AI could not load. Try again.";
    return;
  }
  askHandle = ask(askContainer, question);
  /*
   * The trigger hides only once focus is on the answer panel: hiding it while focused drops focus to
   * <body>, which inside a modal dialog leaves the reader nowhere (WCAG 2.4.3).
   */
  askContainer.querySelector<HTMLElement>(".ask-panel")?.focus();
  if (askTrigger) askTrigger.hidden = true;
}

function resetAsk() {
  askHandle?.cancel();
  askHandle = null;
  if (askContainer) {
    askContainer.textContent = "";
    askContainer.hidden = true;
  }
  if (askTrigger) askTrigger.hidden = true;
}

function onInput() {
  if (!input) return;
  const query = input.value.trim();
  if (allResultsLink) {
    allResultsLink.href = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
  }
  clearTimeout(debounce);
  resetAsk();

  if (query.length < MIN_QUERY) {
    sequence += 1;
    hits = [];
    active = -1;
    renderRecent();
    return;
  }

  if (statusLine) statusLine.textContent = "Searching";
  debounce = setTimeout(() => void run(query), DEBOUNCE_MS);
}

function open_() {
  if (!input) return;
  pushRecent(input.value);
  const hit = active >= 0 ? hits[active] : undefined;
  window.location.href = hit ? hit.url : `/search?q=${encodeURIComponent(input.value.trim())}`;
}

function onKeydown(event: KeyboardEvent) {
  // Escape first: `<input type="search">` natively clears the field on Escape and stops there, so the
  // keystroke never reaches the dialog.
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }

  if (hits.length === 0 && event.key !== "Enter") return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (hits.length === 0) return;
    const delta = event.key === "ArrowDown" ? 1 : -1;
    active = (active + delta + hits.length) % hits.length;
    syncSelection();
    listbox
      ?.querySelector(`#${CSS.escape(optionId(active))}`)
      ?.scrollIntoView({ block: "nearest", behavior: reduceMotion.matches ? "auto" : "smooth" });
    return;
  }

  if (event.key === "Home" || event.key === "End") {
    if (hits.length === 0) return;
    event.preventDefault();
    active = event.key === "Home" ? 0 : hits.length - 1;
    syncSelection();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    open_();
  }
}

function openPalette() {
  if (!dialog) build();
  if (!dialog || dialog.open) return;
  dialog.showModal();
  if (input) {
    input.value = "";
    input.focus();
  }
  // The cleared field must not leave the link carrying the last session's query.
  if (allResultsLink) allResultsLink.href = "/search";
  if (statusLine) statusLine.textContent = "";
  renderRecent();
}

/**
 * Bumping the sequence is not optional: a fetch still in flight at close would otherwise resolve
 * afterwards and repaint the listbox of a closed dialog.
 */
function reset() {
  sequence += 1;
  hits = [];
  active = -1;
  clearTimeout(debounce);
  resetAsk();
  if (listbox) listbox.innerHTML = "";
  if (statusLine) statusLine.textContent = "";
  if (input) {
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
}

function close() {
  reset();
  dialog?.close();
}

/**
 * The gestures are bound once, in `theme.ts`, which loads this bundle on first use. A second binding
 * here would fire too and find the dialog already open.
 */
document.addEventListener("palette:open", () => openPalette());

// A module, so every binding above stays out of the global namespace.
export {};
