/**
 * Ask mode's client. Search Layer 2, and the top of the enhancement stack.
 *
 * Loaded two ways, both only on surfaces that already rendered classic
 * results: /search renders a nonced script tag for this module's own bundle,
 * and the palette bundle carries an inlined copy (build-enhance.mjs inlines
 * its lazy import, because a bundle may not import). With scripting off none
 * of this runs and /search is exactly what it was before Layer 2.
 *
 * It renders into a container the caller owns rather than creating its own
 * placement, so /search and the palette can both use it without this module
 * knowing about either. The mount binding at the bottom is the /search half:
 * the server renders the Ask button HIDDEN (an inert control that looks live
 * is worse than no control), and this unhides and binds it. The binding is
 * DOM-guarded because on /search both bundles execute this module's body, and
 * two listeners would stream two billed answers per click.
 */

import { labelForUrl, urlForKey } from "~/lib/search/ask-keys.mjs";

/** Matches the SSE `chunks` event that arrives before the completion deltas. */
const CHUNKS_EVENT = "chunks";

export interface AskCitation {
  url: string;
  title: string;
  isSection: boolean;
}

export interface AskHandle {
  /** Aborts an in-flight answer and clears the panel. */
  cancel(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Appends children.
 *
 * `appendChild`, never `.append()`. Client chunks in this repo are type-checked
 * with the Workers types in scope, where the global `Element` is HTMLRewriter's
 * and its `append` takes a string or a Response. The DOM spread form therefore
 * fails to compile with an error that talks about `ReadableStream`, which is
 * baffling until you know why. The palette chunk uses `appendChild` for the
 * same reason.
 */
function attach(parent: HTMLElement, ...children: HTMLElement[]): void {
  for (const child of children) parent.appendChild(child);
}

/**
 * Streams an answer into `container`.
 *
 * Every DOM write goes through textContent. The model's output is never
 * rendered as HTML: it is generated text, and the one thing we know about
 * generated text is that we did not write it.
 */
export function ask(container: HTMLElement, question: string): AskHandle {
  const controller = new AbortController();
  container.textContent = "";
  container.hidden = false;

  const panel = el("div", "ask-panel");
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "AI answer");

  const header = el("div", "ask-header");
  const badge = el("span", "ask-badge", "AI generated");
  const note = el("span", "ask-note", "May be wrong. Check the sources.");
  attach(header, badge, note);

  const body = el("p", "ask-body");
  // Screen readers announce the answer as it fills in rather than after.
  body.setAttribute("aria-live", "polite");
  body.setAttribute("aria-busy", "true");

  const status = el("p", "ask-status", "Thinking...");
  const sources = el("ul", "ask-sources");
  sources.hidden = true;

  attach(panel, header, status, body, sources);
  attach(container, panel);

  let answer = "";
  let citations: AskCitation[] = [];

  function renderCitations() {
    if (citations.length === 0) return;
    sources.textContent = "";
    const heading = el("li", "ask-sources-heading", "Sources");
    attach(sources, heading);
    for (const citation of citations) {
      const item = el("li");
      const link = el("a");
      link.href = citation.url;
      link.textContent = citation.title;
      attach(item, link);
      if (citation.isSection) {
        attach(item, el("span", "ask-source-kind", " section"));
      }
      attach(sources, item);
    }
    sources.hidden = false;
  }

  function fail(message: string) {
    // Ask failing must never look like search failing. The panel says so in
    // one line and the classic results above it are untouched.
    status.textContent = message;
    status.hidden = false;
    body.removeAttribute("aria-busy");
  }

  (async () => {
    let response: Response;
    try {
      // POST, because the endpoint bills. A GET that spends per-IP budget and
      // a daily generation is reachable by anything that follows a URL on its
      // own: a crawler, a prefetch, an `<img src>` on somebody else's page.
      response = await fetch("/search/ask", {
        method: "POST",
        signal: controller.signal,
        headers: {
          accept: "text/event-stream",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ q: question }),
      });
    } catch {
      if (!controller.signal.aborted) fail("Ask is unavailable.");
      return;
    }

    if (!response.ok || !response.body) {
      fail("Ask is unavailable.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let firstToken = true;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line. Anything after the last
        // separator is a partial frame and stays in the buffer.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          let eventName = "";
          const dataLines: string[] = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          const data = dataLines.join("\n");
          if (!data) continue;
          if (data === "[DONE]") continue;

          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

          // The sources arrive BEFORE the first token, so a reader can see what
          // the answer is grounded in while it is still being written.
          if (eventName === CHUNKS_EVENT) {
            const chunks: Array<{ item?: { key?: string } }> = Array.isArray(parsed)
              ? parsed
              : [];
            const seen = new Set<string>();
            citations = [];
            for (const chunk of chunks) {
              // The chunk carries item.key and nothing else about origin. The
              // key to URL mapping is the one in ask-keys.mjs that the upload
              // path also uses, so a citation cannot disagree with what was
              // indexed. An unrecognised key yields null and is dropped.
              const url = urlForKey(chunk?.item?.key ?? "");
              if (!url || seen.has(url)) continue;
              seen.add(url);
              citations.push({
                url,
                title: labelForUrl(url),
                isSection: url.includes("#"),
              });
            }
            renderCitations();
            continue;
          }

          const delta = (parsed as { choices?: Array<{ delta?: { content?: string } }> })
            ?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            if (firstToken) {
              status.hidden = true;
              firstToken = false;
            }
            answer += delta;
            body.textContent = answer;
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) fail("Ask stopped early.");
      return;
    }

    body.removeAttribute("aria-busy");
    if (answer.trim().length === 0) fail("No answer for that one.");
  })();

  return {
    cancel() {
      controller.abort();
      container.textContent = "";
      container.hidden = true;
    },
  };
}

/**
 * Binds the server-rendered Ask affordance on /search.
 *
 * The server renders the button only when the binding exists AND the query is
 * a real question (search.tsx owns that rule), so an empty question here means
 * markup this module does not own; the button stays hidden rather than being
 * wired to do nothing. The guard is on the DOM, not module state, because the
 * palette bundle carries an inlined copy of this module and both copies run on
 * /search; the discipline is decorateCodeBlock's, ask the element itself.
 */
function mountAskTriggers() {
  for (const mount of document.querySelectorAll<HTMLElement>("[data-ask-mount]")) {
    const trigger = mount.querySelector<HTMLButtonElement>("[data-ask-trigger]");
    const container = mount.querySelector<HTMLElement>("[data-ask-container]");
    if (!trigger || !container) continue;
    if (trigger.dataset.askBound) continue;
    trigger.dataset.askBound = "true";
    const question = (mount.dataset.askQuestion ?? "").trim();
    if (!question) continue;
    trigger.hidden = false;
    trigger.addEventListener("click", () => {
      // Hidden rather than disabled while streaming: matching what the old
      // React island did, the control disappears once the answer is running.
      trigger.hidden = true;
      ask(container, question);
    });
  }
}

mountAskTriggers();
