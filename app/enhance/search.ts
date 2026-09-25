/**
 * Deliberately not the palette's combobox: these results are page content, and `role="option"`
 * would flatten each to its accessible name. ArrowDown from the input moves real focus into the
 * list; arrow keys anywhere else still scroll the page.
 */

const MIN_QUERY = 3;
const DEBOUNCE_MS = 200;

interface JsonHit {
  url: string;
  type: string;
  title: string;
  documentTitle: string | null;
  anchor: string | null;
  snippet: string;
}

interface JsonResponse {
  total?: number;
  results?: JsonHit[];
}

let sequence = 0;
let debounce: ReturnType<typeof setTimeout> | undefined;

function currentUrl(form: HTMLFormElement, query: string): string {
  const params = new URLSearchParams(new FormData(form) as unknown as string[][]);
  params.set("q", query);
  return `/search?${params.toString()}`;
}

function renderHit(hit: JsonHit): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "search-result";

  const head = document.createElement("div");
  head.className = "search-result-head";
  const kind = document.createElement("span");
  kind.className = "search-type";
  kind.dataset.type = hit.type;
  kind.textContent = hit.type;
  const heading = document.createElement("h2");
  heading.className = "search-result-title";
  const link = document.createElement("a");
  // Reduced to a path so the link matches the server's exactly and a same-origin check is the whole guard.
  const parsed = new URL(hit.url, location.origin);
  link.href = parsed.pathname + parsed.hash;
  link.textContent = hit.title;
  heading.appendChild(link);
  head.appendChild(kind);
  head.appendChild(heading);
  item.appendChild(head);

  if (hit.anchor && hit.documentTitle) {
    const context = document.createElement("p");
    context.className = "search-result-context";
    context.textContent = `in ${hit.documentTitle}`;
    item.appendChild(context);
  }

  const snippet = document.createElement("p");
  snippet.className = "search-snippet";
  // The one field written as HTML: the server escaped the text before substituting its <mark> markers.
  snippet.innerHTML = hit.snippet;
  item.appendChild(snippet);

  return item;
}

function links(list: HTMLOListElement): HTMLAnchorElement[] {
  return [...list.querySelectorAll<HTMLAnchorElement>(".search-result-title a")];
}

export function enhanceSearch(): void {
  const form = document.querySelector<HTMLFormElement>(".search-form");
  const input = document.querySelector<HTMLInputElement>("#q");
  const list = document.querySelector<HTMLOListElement>(".search-results");
  const count = document.querySelector<HTMLParagraphElement>(".search-count");
  if (!form || !input) return;

  let results: HTMLOListElement | null = list;

  function ensureList(): HTMLOListElement | null {
    if (results?.isConnected) return results;
    const body = document.querySelector(".search-body");
    if (!body) return null;
    const created = document.createElement("ol");
    created.className = "search-results";
    /* insertBefore, never .prepend(): the global Element here is HTMLRewriter's. */
    body.insertBefore(created, body.firstChild);
    results = created;
    return created;
  }

  async function run(query: string) {
    const mine = ++sequence;
    const url = currentUrl(form!, query);
    let data: JsonResponse;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = (await response.json()) as JsonResponse;
    } catch {
      // Said, not silent: the old results must not stand under a new query as if they answered it.
      if (mine !== sequence) return;
      if (results?.isConnected) results.textContent = "";
      if (count) count.textContent = "Live results are unavailable. Press Enter to search.";
      return;
    }
    if (mine !== sequence) return;

    const target = ensureList();
    if (!target) return;
    target.textContent = "";
    for (const hit of data.results ?? []) target.appendChild(renderHit(hit));
    // The server's "Nothing matched" answered the query the page opened with, not this one.
    if (target.childElementCount > 0) document.querySelector(".search-zero")?.remove();

    if (count) {
      const total = data.total ?? 0;
      count.textContent = total === 0 ? "No results" : `${total} result${total === 1 ? "" : "s"}`;
    }

    // Replaced, not pushed, so a reader who typed eight characters need not press Back eight times.
    history.replaceState(null, "", url);
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();
    clearTimeout(debounce);
    // Below the floor the server's list is not cleared: blanking it under a reader mid-word is worse.
    if (query.length < MIN_QUERY) return;
    debounce = setTimeout(() => void run(query), DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    const first = results?.isConnected ? links(results)[0] : undefined;
    if (!first) return;
    event.preventDefault();
    first.focus();
  });

  document.addEventListener("keydown", (event) => {
    const target = results;
    const active = document.activeElement;
    if (!target?.isConnected) return;
    if (!(active instanceof HTMLAnchorElement) || !target.contains(active)) return;

    const all = links(target);
    const index = all.indexOf(active);
    if (index === -1) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      all[Math.min(index + 1, all.length - 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) input!.focus();
      else all[index - 1]?.focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || input.value === "") return;
    event.preventDefault();
    input.value = "";
  });
}

enhanceSearch();
