/**
 * The /search page's own enhancement: results as you type, and keyboard navigation of them.
 *
 * NOTHING HERE PRODUCES AN ANSWER THE SERVER DID NOT. It re-requests the SAME URL the form would
 * have submitted, at `Accept: application/json`, which is the same query against the same index
 * the loader used. There is no second search, no client index and no model call: the affordance is
 * that the reader does not have to press Enter, not that they get different results.
 *
 * WITH SCRIPTING OFF NONE OF THIS RUNS and the page is what it was: a GET form whose response is
 * the answer. That is the floor, and every branch below is written so a failure returns to it
 * rather than leaving a half-updated list.
 *
 * THE KEYBOARD PATTERN IS NOT THE PALETTE'S, DELIBERATELY, and this is the one place this module
 * departs from the instruction that produced it. The palette is a combobox: it is a popup over a
 * page, focus stays in the input, and `aria-activedescendant` points at an option in a listbox.
 * That is correct there and wrong here. These results are the page's CONTENT, a list of headings,
 * links and snippets that a screen reader should read as a document and a crawler already does.
 * Giving them `role="option"` would flatten each result to its accessible name and throw the
 * snippet and the context line away, to buy a pattern whose purpose is managing focus inside a
 * popup that does not exist on this page.
 *
 * So: ArrowDown FROM THE INPUT moves real focus to the first result, arrows then move between
 * results, and Escape returns to the input and clears it. Arrow keys anywhere else still scroll
 * the page, because hijacking them globally is how a search page stops behaving like a page.
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

/** Monotonic, so a slow earlier response cannot overwrite a newer one. */
let sequence = 0;
let debounce: ReturnType<typeof setTimeout> | undefined;

/** The form's current state as the URL the server would have been asked for. */
function currentUrl(form: HTMLFormElement, query: string): string {
  /*
   * THE FORM'S OWN DATA, which is the definition of "the URL this form would have submitted".
   * Enumerating type, tag, year and sort by hand worked and was a second list to keep in step
   * with the route; a field added there would have been silently dropped from the live request
   * and the list would have quietly stopped matching its own filters.
   */
  const params = new URLSearchParams(new FormData(form) as unknown as string[][]);
  params.set("q", query);
  return `/search?${params.toString()}`;
}

/** The results a JSON hit renders as, matching what the route's `Result` component emits. */
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
  /*
   * The JSON carries absolute URLs and the page renders paths. Reduced to a path so the rendered
   * link matches the server's exactly, and so a same-origin check is the whole of the guard.
   */
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
  /*
   * THE SNIPPET IS THE ONE FIELD WRITTEN AS HTML, and it is the server's own escaped output: the
   * text was escaped before its <mark> markers were substituted in, which is the same value the
   * server-rendered page sets with dangerouslySetInnerHTML. Nothing else here goes near innerHTML.
   */
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

  /*
   * THE LIST MAY NOT EXIST YET. A reader who arrives at a bare /search has no results element to
   * replace, so one is created on the first response and put where the server would have put it.
   */
  let results: HTMLOListElement | null = list;

  function ensureList(): HTMLOListElement | null {
    if (results?.isConnected) return results;
    const body = document.querySelector(".search-body");
    if (!body) return null;
    const created = document.createElement("ol");
    created.className = "search-results";
    /* insertBefore, never .prepend(): these chunks typecheck with the Workers types in scope,
       where the global Element is HTMLRewriter's and its append takes a string or a Response.
       ask.ts records the same trap for appendChild. */
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
      if (!response.ok) return;
      data = (await response.json()) as JsonResponse;
    } catch {
      /* The server-rendered list is still on the page and still correct for its own URL. */
      return;
    }
    if (mine !== sequence) return;

    const target = ensureList();
    if (!target) return;
    target.textContent = "";
    for (const hit of data.results ?? []) target.appendChild(renderHit(hit));

    if (count) {
      const total = data.total ?? 0;
      count.textContent = total === 0 ? "No results" : `${total} result${total === 1 ? "" : "s"}`;
    }

    /*
     * THE URL IS THE STATE, so it is replaced rather than pushed: a reader typing eight characters
     * should not have to press Back eight times to leave the page. The address bar stays
     * shareable and reloadable, which is the whole point of updating it.
     */
    history.replaceState(null, "", url);
  }

  input.addEventListener("input", () => {
    const query = input.value.trim();
    clearTimeout(debounce);
    /*
     * BELOW THE FLOOR, NOTHING HAPPENS, and in particular the server's list is NOT cleared. Two
     * characters is a reader mid-word, and blanking the page under them is worse than a stale
     * list that is still a correct answer to the URL they are on.
     */
    if (query.length < MIN_QUERY) return;
    debounce = setTimeout(() => void run(query), DEBOUNCE_MS);
  });

  /* ArrowDown from the input enters the list. Every other key in the input is the reader's. */
  input.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    const first = results?.isConnected ? links(results)[0] : undefined;
    if (!first) return;
    event.preventDefault();
    first.focus();
  });

  /*
   * Arrows move between results and Escape returns to the input. Bound on the LIST rather than on
   * the document, so the page scrolls normally everywhere else.
   */
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
      /* Up from the first result returns to the field, which is where it came from. */
      if (index === 0) input!.focus();
      else all[index - 1]?.focus();
    }
  });

  /* ONE Escape owner, on the input, which is where focus returns to either way. */
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || input.value === "") return;
    event.preventDefault();
    input.value = "";
  });
}

enhanceSearch();
