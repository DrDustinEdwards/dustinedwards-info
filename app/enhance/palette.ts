/**
 * Command palette. Site-wide, loaded as its own chunk, and pure enhancement.
 *
 * Nothing on the site depends on this file. The header ships an anchor to
 * /search; this upgrades it into a button that opens a dialog. If the chunk
 * fails to load, fails to parse, or throws on the first line, the anchor is
 * still an anchor and /search still works with no script at all.
 *
 * Built on the NATIVE <dialog> element rather than a hand-rolled overlay,
 * because showModal() already provides the three things a hand-rolled one gets
 * wrong: a real focus trap, Escape to dismiss, and returning focus to whatever
 * opened it. Re-implementing those in application code is how inaccessible
 * modals happen.
 *
 * The listbox follows the ARIA combobox pattern: FOCUS NEVER LEAVES THE INPUT.
 * Arrow keys move `aria-activedescendant`, which is a pointer, not focus. A
 * palette that moves DOM focus to each row breaks typing, which is the one
 * thing the component exists to support.
 *
 * Results come from the Layer 0 JSON endpoint, so the palette and the
 * server-rendered page cannot disagree about what matches.
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

  // Ask is a deliberate second action, never automatic. Results are already on
  // screen when this is pressed, and an answer that generates on every
  // keystroke would bill Workers AI for typing.
  askTrigger?.addEventListener("click", () => void runAsk());

  dialog.querySelector(".palette-close")?.addEventListener("click", () => close());

  // Clicking the backdrop closes. The dialog element itself is the click target
  // for backdrop clicks, so this checks the target rather than using a wrapper.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  // Native Escape fires `cancel`. Let it close, but reset state first so the
  // next open does not flash the previous results.
  // Backstop for any close this code did not initiate. The reset also runs
  // synchronously inside close(), because the `close` event proved unreliable
  // to depend on: it was observed not firing at all for a programmatic
  // dialog.close() on 2026-07-28, so a reset that only lived here would
  // silently never run.
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
  // Recent searches are presentational buttons, not listbox options, so the
  // combobox is NOT expanded while they are showing. Set before the early
  // return: leaving a stale aria-expanded="true" over an empty listbox tells a
  // screen reader there are options to arrow through when there are none.
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
    // Ask's presence is the server's answer, carried on the response the
    // palette already makes. Remove the binding and this goes false, so the
    // affordance disappears without a second switch to remember.
    askAvailable = data.askAvailable === true;
    hits = data.results ?? [];
    active = hits.length > 0 ? 0 : -1;
    if (statusLine) {
      statusLine.textContent =
        hits.length === 0 ? "No results" : `${data.total ?? hits.length} results`;
    }
    // Offered only once classic results have rendered, and only when the server
    // says Ask exists. Offered even on zero results, because a question the
    // keyword index cannot match is exactly where an answer might help.
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
 * Streams an answer into the palette.
 *
 * The streaming client is a separate dynamic import, so the palette chunk does
 * not carry Ask's weight for readers who only ever search. Loaded on the first
 * press and cached by the browser after that.
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
  // Escape is handled here rather than left to the dialog, and it must come
  // before every other branch.
  //
  // `<input type="search">` has a NATIVE Escape behaviour: the first press
  // clears the field and stops there, so the keystroke never reaches the
  // dialog and the palette stays open. A reader pressing Escape once and
  // watching nothing close reasonably concludes the thing is broken. Measured
  // in Chrome 2026-07-28.
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
  // and traps focus. Native behaviour returns focus to the opener on close.
  dialog.showModal();
  if (input) {
    input.value = "";
    input.focus();
  }
  if (statusLine) statusLine.textContent = "";
  renderRecent();
}

/**
 * Drops every piece of open state.
 *
 * Bumping the sequence is the part that is not optional. Clearing the DOM alone
 * loses a race: a fetch still in flight when the reader closes the palette
 * resolves afterwards and repaints the listbox of a closed dialog, leaving
 * stale options and aria-expanded="true" behind it. Observed 2026-07-28, with
 * the response outliving the close by a few hundred milliseconds.
 */
function reset() {
  sequence += 1;
  hits = [];
  active = -1;
  clearTimeout(debounce);
  // Aborts an in-flight answer too. Without this a fetch still streaming when
  // the palette closes goes on writing into a closed dialog, which is the same
  // late-response trap the sequence number exists for on the search side.
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
 * Upgrades the header link into a palette trigger.
 *
 * The href is left in place. If script later fails, the element is still a
 * working link to /search, and middle-click and "open in new tab" keep working
 * because it is still an anchor.
 */
function upgradeTriggers() {
  // The hint lives inside the trigger, but it is found from the document rather
  // than from inside the anchor, so this keeps working wherever it is placed.
  // It ships `hidden`: pressing "/" does nothing until the listeners below are
  // attached, so the shortcut is not advertised before it exists.
  for (const hint of document.querySelectorAll<HTMLElement>("[data-search-hint]")) {
    hint.hidden = false;
  }

  for (const trigger of document.querySelectorAll<HTMLElement>("[data-search-trigger]")) {
    trigger.dataset.shortcutHint = "shown";
    trigger.addEventListener("click", (event) => {
      // Let a modified click do what the browser would do with a link.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openPalette();
    });
  }
}

/** True when a keystroke belongs to whatever the reader is typing in. */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

document.addEventListener("keydown", (event) => {
  const meta = event.metaKey || event.ctrlKey;
  if (meta && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openPalette();
    return;
  }
  // A bare slash opens search, but never while someone is typing into a field,
  // where a slash is just a slash.
  if (event.key === "/" && !meta && !event.altKey && !isTyping(event.target)) {
    event.preventDefault();
    openPalette();
  }
});

upgradeTriggers();

// This file is a module: the dynamic import in SearchTrigger requires it, and
// module scope keeps every binding above out of the global namespace.
export {};
