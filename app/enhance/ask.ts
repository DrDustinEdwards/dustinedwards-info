import { labelForUrl, urlForKey } from "~/lib/search/ask-keys.mjs";
import { splitFollowUp } from "~/lib/search/follow-up.mjs";
import { answerDelta, takeSseFrames } from "~/lib/search/sse.mjs";

const CHUNKS_EVENT = "chunks";

interface AskCitation {
  url: string;
  title: string;
  isSection: boolean;
}

interface AskHandle {
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
 * `appendChild`, never `.append()`: with the Workers types in scope the global `Element` is
 * HTMLRewriter's, whose `append` rejects DOM nodes at compile time.
 */
function attach(parent: HTMLElement, ...children: HTMLElement[]): void {
  for (const child of children) parent.appendChild(child);
}

/**
 * The `chunks` event's payload as citations, deduplicated by URL. Same key-to-URL mapping as the
 * upload path, so a citation cannot disagree with what was indexed.
 */
function citationsFromChunks(parsed: unknown): AskCitation[] {
  const chunks: Array<{ item?: { key?: string } }> = Array.isArray(parsed)
    ? parsed
    : [];
  const seen = new Set<string>();
  const out: AskCitation[] = [];
  for (const chunk of chunks) {
    const url = urlForKey(chunk?.item?.key ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      title: labelForUrl(url),
      isSection: url.includes("#"),
    });
  }
  return out;
}

/** Reads the stream to its end, handing each complete SSE frame to `onFrame`; a read error throws. */
async function readFrames(
  stream: ReadableStream<Uint8Array>,
  onFrame: (eventName: string | undefined, parsed: unknown) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const taken = takeSseFrames(buffer);
    buffer = taken.rest;

    for (const { event: eventName, data: parsed } of taken.frames) onFrame(eventName, parsed);
  }
}

/** Every DOM write goes through textContent: generated text is never rendered as HTML. */
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
  body.setAttribute("aria-busy", "true");

  /*
   * The body is not live: rewritten on every token, it would be announced over and over. This region
   * exists before anything is written to it, and speaks once, the whole answer or the failure.
   */
  const announcer = el("p", "sr-only");
  announcer.setAttribute("aria-live", "polite");

  // Not "Thinking...": the request is retrieval over this site's chunks, and an ellipsis reads as stalling.
  const status = el("p", "ask-status", "Looking it up.");
  const sources = el("ul", "ask-sources");
  sources.hidden = true;

  // Hidden until there is one: the model is asked for a follow-up, not required to give one.
  const followUp = el("p", "ask-followup");
  followUp.hidden = true;

  attach(panel, header, status, body, sources, followUp, announcer);
  attach(container, panel);

  let answer = "";
  let citations: AskCitation[] = [];

  function renderCitations() {
    if (citations.length === 0) return;
    sources.textContent = "";
    const heading = el("li", "ask-sources-heading", "Sources");
    attach(sources, heading);
    /*
     * Same-origin paths only: a URL that is not one did not come from the corpus, and is dropped
     * rather than shown unlinked.
     */
    let index = 0;
    for (const citation of citations) {
      if (!citation.url.startsWith("/") || citation.url.startsWith("//")) continue;
      index += 1;
      const item = el("li");
      const link = el("a");
      link.href = citation.url;
      attach(link, el("span", "ask-source-index", `${index}. `), el("span", undefined, citation.title));
      attach(item, link);
      if (citation.isSection) {
        attach(item, el("span", "ask-source-kind", " section"));
      }
      attach(sources, item);
    }
    if (index === 0) {
      sources.hidden = true;
      return;
    }
    sources.hidden = false;
  }

  function fail(message: string) {
    status.textContent = message;
    status.hidden = false;
    body.removeAttribute("aria-busy");
    announcer.textContent = message;
  }

  function onChunks(parsed: unknown) {
    citations = citationsFromChunks(parsed);
    renderCitations();
  }

  let firstToken = true;

  function onAnswer(parsed: unknown) {
    const delta = answerDelta(parsed);
    if (delta === undefined || delta.length === 0) return;
    if (firstToken) {
      status.hidden = true;
      firstToken = false;
    }
    answer += delta;
    // Split on every frame so the raw "NEXT:" marker never shows in the prose mid-stream.
    const parts = splitFollowUp(answer);
    body.textContent = parts.answer;
    if (parts.followUp) {
      followUp.textContent = "";
      const link = el("a");
      link.href = `/search?q=${encodeURIComponent(parts.followUp)}`;
      link.textContent = parts.followUp;
      attach(followUp, link);
      followUp.hidden = false;
    }
  }

  (async () => {
    let response: Response;
    try {
      // POST because the endpoint bills: a GET would be spendable by crawlers, prefetch or a foreign `<img src>`.
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

    try {
      await readFrames(response.body, (eventName, parsed) => {
        if (eventName === CHUNKS_EVENT) onChunks(parsed);
        else onAnswer(parsed);
      });
    } catch {
      if (!controller.signal.aborted) fail("Ask stopped early.");
      return;
    }

    body.removeAttribute("aria-busy");
    if (answer.trim().length === 0) fail("No answer for that one.");
    else announcer.textContent = `AI answer: ${splitFollowUp(answer).answer}`;
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
 * Guarded on the DOM, not module state, because both bundles run this module on `/search` and two
 * listeners would stream two billed answers per click.
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
      trigger.hidden = true;
      ask(container, question);
    });
  }
}

mountAskTriggers();
