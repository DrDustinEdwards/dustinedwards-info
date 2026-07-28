/**
 * Ask mode's client. Search Layer 2, and the top of the enhancement stack.
 *
 * Loaded by dynamic import, only on surfaces that already rendered classic
 * results, and only when the server said the binding exists. With scripting off
 * none of this runs and /search is exactly what it was before Layer 2.
 *
 * It renders into a container the caller owns rather than creating its own
 * placement, so /search and the palette can both use it without this module
 * knowing about either.
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
      response = await fetch(`/search/ask?q=${encodeURIComponent(question)}`, {
        signal: controller.signal,
        headers: { accept: "text/event-stream" },
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
