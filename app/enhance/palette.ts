import { attach, buildMenu, type Attached, type Command } from "capsomer/behavior/command-menu";
import { isImeEnter } from "capsomer/behavior/shortcuts";

// An island (devkit ./islands): each <template data-island="palette"> on the page calls this, and the first one runs it.
// The palette is Capsomer's command menu (components/command-menu): its dialog, combobox and listbox, with the site's
// search as its live results (`search`), the reader's recent searches as its commands, and Ask AI under the list.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;

  const RECENT_KEY = "search:recent";
  const RECENT_LIMIT = 5;
  /** Shorter queries are not sent: the index matches nothing useful on one letter. */
  const MIN_QUERY = 2;

  interface Hit {
    url: string;
    type: string;
    title: string;
    documentTitle: string;
    anchor: string | null;
  }

  let menu: { dialog: HTMLDialogElement; attached: Attached } | null = null;
  let input: HTMLInputElement | null = null;
  let askAvailable = false;
  let askHandle: { cancel(): void } | null = null;
  let askLoading = false;
  let askTrigger: HTMLButtonElement | null = null;
  let askContainer: HTMLDivElement | null = null;
  let askStatus: HTMLParagraphElement | null = null;

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

  function go(url: string, query: string) {
    pushRecent(query);
    location.assign(url);
  }

  /** Always last, so Enter with no live result still goes somewhere: the full results page. */
  function allResults(query: string, hint?: string): Command {
    return {
      id: "all-results",
      group: "Search",
      label: `All results for “${query}”`,
      hint,
      run: () => go(`/search?q=${encodeURIComponent(query)}`, query),
    };
  }

  /** The live results: the site's own search, as JSON (routes/search.tsx). */
  async function search(query: string, signal: AbortSignal): Promise<Command[]> {
    if (query.length < MIN_QUERY) return [allResults(query)];
    let data: { results?: Hit[]; askAvailable?: boolean };
    try {
      const response = await fetch(`/search?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      data = (await response.json()) as typeof data;
    } catch (error) {
      if (signal.aborted) throw error;
      askAvailable = false;
      return [allResults(query, "live results are unavailable")];
    }
    askAvailable = data.askAvailable === true;
    // Offered even on zero results: a question the keyword index cannot match is where an answer helps.
    if (askTrigger && !askHandle) askTrigger.hidden = !askAvailable;
    const found = (data.results ?? []).map((hit, i): Command => ({
      id: `result-${i}`,
      group: hit.type,
      label: hit.title,
      hint: hit.anchor && hit.documentTitle !== hit.title ? `in ${hit.documentTitle}` : undefined,
      // The JSON carries absolute URLs (SITE_ORIGIN); a same-origin path keeps a preview host on the preview.
      run: () => go(hit.url.replace(/^https?:\/\/[^/]+/, ""), query),
    }));
    return [...found, allResults(query)];
  }

  /** A separate dynamic import, so the palette chunk does not carry Ask's weight for readers who only search. */
  async function runAsk() {
    if (!askContainer || !input) return;
    const question = input.value.trim();
    if (!question) return;
    // The trigger stays visible while the chunk loads, so a second click must not start a second billed answer.
    if (askLoading) return;
    askHandle?.cancel();
    let ask: typeof import("./ask").ask;
    askLoading = true;
    try {
      ({ ask } = await import("./ask"));
    } catch {
      // The chunk failed to load: the trigger stays so the reader can retry, and the status says so.
      if (askStatus) askStatus.textContent = "Ask AI could not load. Try again.";
      return;
    } finally {
      askLoading = false;
    }
    if (askStatus) askStatus.textContent = "";
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
    askAvailable = false;
    if (askContainer) {
      askContainer.textContent = "";
      askContainer.hidden = true;
    }
    if (askTrigger) askTrigger.hidden = true;
    if (askStatus) askStatus.textContent = "";
  }

  /** Ask AI under the list: a deliberate second action, since an answer on every keystroke would bill Workers AI for typing. */
  function buildAsk(): HTMLDivElement {
    const box = document.createElement("div");
    box.className = "palette-ask";
    askTrigger = document.createElement("button");
    askTrigger.type = "button";
    askTrigger.className = "cap-btn";
    askTrigger.dataset.variant = "quiet";
    askTrigger.dataset.size = "sm";
    askTrigger.textContent = "Ask AI about this";
    askTrigger.hidden = true;
    askTrigger.addEventListener("click", () => void runAsk());
    askStatus = document.createElement("p");
    askStatus.className = "palette-ask-status";
    askStatus.setAttribute("role", "status");
    askContainer = document.createElement("div");
    askContainer.className = "palette-ask-container";
    askContainer.hidden = true;
    // appendChild, never append(): with the Workers types in scope append() takes HTMLRewriter content (ask.ts).
    box.appendChild(askTrigger);
    box.appendChild(askStatus);
    box.appendChild(askContainer);
    return box;
  }

  /**
   * Built afresh on each opening, so the recent searches are the current ones. A recent search reopens the
   * palette with that query, after the close has handed focus back.
   */
  function openPalette(query = "") {
    if (menu?.dialog.open) return;
    menu?.attached.detach();
    menu?.dialog.remove();
    resetAsk();

    const commands: Command[] = readRecent().map((recent, i) => ({
      id: `recent-${i}`,
      group: "Recent",
      label: recent,
      run: () => setTimeout(() => openPalette(recent)),
    }));
    const dialog = buildMenu(commands, {
      label: "Search this site",
      placeholder: "Search, or try tag:cloudflare",
    });
    dialog.setAttribute("aria-label", "Search this site");
    dialog.querySelector("[role='listbox']")?.setAttribute("aria-label", "Search results");
    const foot = dialog.querySelector(".cap-cmd-foot");
    dialog.insertBefore(buildAsk(), foot);
    document.body.appendChild(dialog);

    const byId = new Map(commands.map((c) => [c.id, c]));
    const attached = attach(
      dialog,
      (option, found) => (found ?? byId.get(option.dataset.capCommand ?? ""))?.run(),
      { search },
    );
    input = dialog.querySelector<HTMLInputElement>("[role='combobox']");
    input?.addEventListener("input", resetAsk);
    // Enter before the live results arrive (no active option yet) opens the full results page, so a typed query
    // is never thrown away.
    input?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.defaultPrevented || isImeEnter(event) || !input) return;
      if (input.hasAttribute("aria-activedescendant")) return;
      const typed = input.value.trim();
      if (!typed) return;
      event.preventDefault();
      go(`/search?q=${encodeURIComponent(typed)}`, typed);
    });
    dialog.addEventListener("close", resetAsk);
    menu = { dialog, attached };
    attached.open(query);
  }

  /**
   * The gestures are bound once, in `theme.ts`, which loads this bundle on first use. A second binding
   * here would fire too and find the dialog already open.
   */
  document.addEventListener("palette:open", () => openPalette());
}
