import { labelForUrl, urlForKey } from "../lib/search/ask-keys.mjs";
import { splitFollowUp } from "../lib/search/follow-up.mjs";
import { CUT_EVENT, answerDelta, takeSseFrames } from "@dustinedwards/site-runtime/ai-ask";
import { buildAnswer, type AnswerSource } from "capsomer/behavior/ai-answer";

const CHUNKS_EVENT = "chunks";

interface AskHandle {
  cancel(): void;
  /** Settles when the stream has been read to its end, or has failed and said so. */
  done: Promise<void>;
}

/**
 * The `chunks` event's payload as sources, deduplicated by URL. Same key-to-URL mapping as the
 * upload path, so a citation cannot disagree with what was indexed.
 */
function citationsFromChunks(parsed: unknown): AnswerSource[] {
  const chunks: Array<{ item?: { key?: string } }> = Array.isArray(parsed) ? parsed : [];
  const seen = new Set<string>();
  const out: AnswerSource[] = [];
  for (const chunk of chunks) {
    const url = urlForKey(chunk?.item?.key ?? "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      href: url,
      title: labelForUrl(url),
      kind: url.includes("#") ? "section" : undefined,
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

/** Streams the answer to `question` into Capsomer's AI answer panel, in `container`. */
export function ask(container: HTMLElement, question: string): AskHandle {
  const controller = new AbortController();
  container.textContent = "";
  container.hidden = false;

  const panel = buildAnswer();
  // appendChild, never append(): with the Workers types in scope append() takes HTMLRewriter content.
  container.appendChild(panel.el);

  let answer = "";

  function onAnswer(parsed: unknown) {
    const delta = answerDelta(parsed);
    if (delta === undefined || delta.length === 0) return;
    answer += delta;
    // Split on every frame so the raw "NEXT:" marker never shows in the prose mid-stream.
    const parts = splitFollowUp(answer);
    panel.write(parts.answer);
    if (parts.followUp)
      panel.setFollowUp(parts.followUp, `/search?q=${encodeURIComponent(parts.followUp)}`);
  }

  const done = (async () => {
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
      if (!controller.signal.aborted) panel.fail("Ask is unavailable.");
      return;
    }

    if (!response.ok || !response.body) {
      panel.fail("Ask is unavailable.");
      return;
    }

    try {
      await readFrames(response.body, (eventName, parsed) => {
        if (eventName === CHUNKS_EVENT) panel.setSources(citationsFromChunks(parsed));
        else if (eventName === CUT_EVENT) panel.markCut();
        else onAnswer(parsed);
      });
    } catch {
      if (!controller.signal.aborted) panel.fail("Ask stopped early.");
      return;
    }

    if (answer.trim().length === 0) panel.fail("No answer for that one.");
    else panel.finish();
  })();

  /*
   * A trigger hidden on click drops focus to <body> (WCAG 2.4.3); focus is caught here, on the answer
   * it asked for. Focus the caller still holds on something visible is left where it is.
   */
  const held = document.activeElement;
  if (
    !held ||
    held === document.body ||
    (held instanceof HTMLElement && held.closest("[hidden]"))
  ) {
    panel.el.focus();
  }

  return {
    done,
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
    const question = () => (mount.dataset.askQuestion ?? "").trim();
    if (!question()) continue;
    trigger.hidden = false;
    // Read at the click, not at binding: the live search rewrites the question as the reader retypes.
    trigger.addEventListener("click", () => {
      trigger.hidden = true;
      ask(container, question());
    });
  }
}

// An island (devkit ./islands): each <template data-island="ask"> on the page calls this, and the first one runs it.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  mountAskTriggers();
}
