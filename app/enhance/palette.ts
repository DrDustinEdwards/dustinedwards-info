/**
 * Command palette. Site-wide, loaded as its own chunk, and pure enhancement.
 *
 * NOTHING ON THE SITE DEPENDS ON THIS FILE. The header ships an anchor to `/search`; this upgrades
 * it into a button that opens a dialog. If the chunk fails to load, parse or run, the anchor is
 * still an anchor.
 *
 * Built on the NATIVE <dialog> rather than a hand-rolled overlay, because `showModal()` already
 * provides the three things a hand-rolled one gets wrong: a real focus trap, Escape, and returning
 * focus to whatever opened it.
 *
 * The listbox follows the ARIA combobox pattern: FOCUS NEVER LEAVES THE INPUT. Arrow keys move
 * `aria-activedescendant`, which is a pointer and not focus. A palette that moves DOM focus to each
 * row breaks typing, which is the one thing the component exists to support.
 *
 * Results come from the Layer 0 JSON endpoint, so the palette and the server-rendered page cannot
 * disagree about what matches.
 */

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
/**
 * Whether this deployment has Ask. Set from the search response, never assumed.
 * Not named `status`: a module-level `status` collides with `window.status`.
 */
let askAvailable = false;
/** Cancels an in-flight answer when the palette closes or the query changes. */
let askHandle: { cancel(): void } | null = null;
let askTrigger: HTMLButtonElement | null = null;
let askContainer: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
let listbox: HTMLUListElement | null = null;
// Named statusLine, not status: `status` is a long-standing global on window,
// so a bare `let status` collides with it at type level.
let statusLine: HTMLParagraphElement | null = null;
/**
 * The palette's own "All results" escape hatch. A static `<a href="/search">` threw away whatever
 * had been typed, while Enter-with-no-hit in the same file already went to `/search?q=<typed>`. This
 * handle exists so the link can be kept in step with the input.
 */
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
    // A blocked or full localStorage is not an error worth surfacing. Recent
    // searches are a convenience and the palette works identically without them.
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
      <a href="/search">All results</a>
    </p>
  `;

  document.body.appendChild(dialog);
  input = dialog.querySelector(".palette-input");
  listbox = dialog.querySelector(".palette-listbox");
  statusLine = dialog.querySelector(".palette-status");

  askTrigger = dialog.querySelector(".palette-ask-trigger");
  askContainer = dialog.querySelector(".palette-ask-container");

  // Ask is a deliberate second action, never automatic. Results are already on screen when this is
  // pressed, and an answer that generated on every keystroke would bill Workers AI for typing.
  askTrigger?.addEventListener("click", () => void runAsk());

  dialog.querySelector(".palette-close")?.addEventListener("click", () => close());

  // Clicking the backdrop closes. The dialog element itself is the click target
  // for backdrop clicks, so this checks the target rather than using a wrapper.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  // Native Escape fires `cancel`; let it close, but reset first so the next open does not flash the
  // previous results. This listener is a backstop only: the reset also runs synchronously inside
  // `close()`, because the `close` event proved unreliable to depend on for a programmatic close.
  dialog.addEventListener("close", reset);

  input?.addEventListener("input", onInput);
  input?.addEventListener("keydown", onKeydown);
}

function optionId(i: number) {
  return `palette-option-${i}`;
}

function render() {
  if (!listbox || !input) return;
  // Belt and braces alongside the sequence bump in the close handler: never
  // paint into a dialog that is not open.
  if (dialog && !dialog.open) return;

  if (hits.length === 0) {
    listbox.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    return;
  }

  input.setAttribute("aria-expanded", "true");

  // Grouped by type, with the group label as a presentational row so the
  // listbox's children stay options as far as assistive technology is
  // concerned.
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

/** Updates selection without rebuilding the list, so hovering does not thrash. */
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
  // Recent searches are presentational buttons, not listbox options, so the combobox is NOT expanded
  // while they show. Set BEFORE the early return: a stale `aria-expanded="true"` over an empty listbox
  // tells a screen reader there are options to arrow through when there are none.
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
    // A slower earlier request must not overwrite a newer one.
    if (mine !== sequence) return;
    // Ask's presence is the server's answer, carried on the response the palette already makes.
    // Remove the binding and this goes false, so the affordance disappears with no second switch.
    askAvailable = data.askAvailable === true;
    hits = data.results ?? [];
    active = hits.length > 0 ? 0 : -1;
    if (statusLine) {
      statusLine.textContent =
        hits.length === 0 ? "No results" : `${data.total ?? hits.length} results`;
    }
    // Offered only once classic results have rendered, and only when the server says Ask exists.
    // Offered even on zero results, because a question the keyword index cannot match is exactly where
    // an answer might help.
    if (askTrigger) askTrigger.hidden = !askAvailable;
    render();
  } catch {
    if (mine !== sequence) return;
    hits = [];
    active = -1;
    // The palette is an enhancement over a page that still works, so a failed
    // fetch points at it rather than pretending nothing happened.
    if (statusLine) statusLine.textContent = "Search is unavailable. Press Enter for the full page.";
    render();
  }
}

/**
 * Streams an answer into the palette. The streaming client is a separate dynamic import, so the
 * palette chunk does not carry Ask's weight for readers who only ever search.
 */
async function runAsk() {
  if (!askContainer || !input) return;
  const question = input.value.trim();
  if (!question) return;
  askHandle?.cancel();
  if (askTrigger) askTrigger.hidden = true;
  const { ask } = await import("./ask");
  askHandle = ask(askContainer, question);
}

/** Clears any answer and hides the Ask row. Called on close and on retype. */
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
  /* "All results" keeps the query, exactly as Enter-with-no-hit already did.
     Bare /search is still correct when nothing has been typed. */
  if (allResultsLink) {
    allResultsLink.href = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
  }
  clearTimeout(debounce);
  // A new query makes any showing answer answer the wrong question.
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

/** Navigates to the active hit, or to the full results page. */
function open_() {
  if (!input) return;
  pushRecent(input.value);
  const hit = active >= 0 ? hits[active] : undefined;
  window.location.href = hit ? hit.url : `/search?q=${encodeURIComponent(input.value.trim())}`;
}

function onKeydown(event: KeyboardEvent) {
  // Escape is handled here rather than left to the dialog, and it must come before every other
  // branch. `<input type="search">` has a NATIVE Escape behavior: the first press clears the field
  // and stops there, so the keystroke never reaches the dialog and the palette stays open.
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }

  if (hits.length === 0 && event.key !== "Enter") return;

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    // preventDefault so the caret does not jump to the ends of the input while
    // the pointer moves through the list.
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
  // showModal, not show: only the modal form makes the rest of the page inert
  // and traps focus. Native behavior returns focus to the opener on close.
  dialog.showModal();
  if (input) {
    input.value = "";
    input.focus();
  }
  if (statusLine) statusLine.textContent = "";
  renderRecent();
}

/**
 * Drops every piece of open state. BUMPING THE SEQUENCE IS THE PART THAT IS NOT OPTIONAL: clearing
 * the DOM alone loses a race, because a fetch still in flight when the reader closes resolves
 * afterwards and repaints the listbox of a closed dialog, leaving stale options and
 * `aria-expanded="true"` behind it.
 */
function reset() {
  sequence += 1;
  hits = [];
  active = -1;
  clearTimeout(debounce);
  // Aborts an in-flight answer too. Without this a stream still running when the palette closes goes
  // on writing into a closed dialog, which is the same late-response trap the sequence number exists
  // for on the search side.
  resetAsk();
  if (listbox) listbox.innerHTML = "";
  if (statusLine) statusLine.textContent = "";
  if (input) {
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
}

function close() {
  // Reset BEFORE closing and synchronously, rather than trusting the dialog's
  // `close` event to arrive. See the listener in build().
  reset();
  dialog?.close();
}

/**
 * THE ONE THING THIS FILE BINDS, and it is not a shortcut.
 *
 * The gestures live in `theme.ts`, which is already on every page and a fraction of the size, and
 * it appends a script tag for this bundle the first time one fires. So the palette costs its bytes
 * when it is asked for and nothing before.
 *
 * THE GESTURE IS DELIBERATELY NOT RE-BOUND HERE. Two copies of the shortcut, one per module, would
 * both fire and the second would find the dialog already open. One binding makes that impossible
 * rather than guarded against.
 *
 * THE EVENT, NOT AN EXPORT: a dynamic `import()` is rewritten by vite into its preload helper, which
 * is a large fraction of what moving the palette off the page saved. A script element inserted by an
 * already-trusted script is allowed by `strict-dynamic` without a nonce.
 *
 * The trigger's own affordances stay where they were: the href is left in place, so with script
 * absent, broken or still in flight the element is a working link and middle-click still opens a tab.
 */
document.addEventListener("palette:open", () => openPalette());

// A module, so every binding above stays out of the global namespace.
export {};
