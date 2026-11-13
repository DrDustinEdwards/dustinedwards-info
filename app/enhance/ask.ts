import { labelForUrl, urlForKey } from "../lib/search/ask-keys.mjs";
import { splitFollowUp } from "../lib/search/follow-up.mjs";
import { CUT_EVENT, answerDelta } from "@dustinedwards/site-runtime/ai-ask";
import {
  ask as askPanel,
  enhance,
  postQuestion,
  type AskHandle,
  type AskOptions,
  type AskRead,
  type AskSource,
} from "capsomer/behavior/ask-panel";
import { jsonData, type SseEvent } from "capsomer/behavior/sse";

const CHUNKS_EVENT = "chunks";

/**
 * The `chunks` event's payload as sources. Same key-to-URL mapping as the upload path, so a citation
 * cannot disagree with what was indexed; the panel drops repeats.
 */
function citationsFromChunks(parsed: unknown): AskSource[] {
  const chunks: Array<{ item?: { key?: string } }> = Array.isArray(parsed) ? parsed : [];
  const out: AskSource[] = [];
  for (const chunk of chunks) {
    const url = urlForKey(chunk?.item?.key ?? "");
    if (url)
      out.push({ url, title: labelForUrl(url), kind: url.includes("#") ? "section" : undefined });
  }
  return out;
}

function read(e: SseEvent): AskRead {
  if (e.event === CHUNKS_EVENT) return { sources: citationsFromChunks(jsonData(e)) };
  if (e.event === CUT_EVENT) return { cut: true };
  return { delta: answerDelta(jsonData(e)) };
}

// POST, because the endpoint bills: a GET would be spendable by crawlers, prefetch or a foreign `<img src>`.
const request = postQuestion("/search/ask");

const options: Omit<AskOptions, "request"> = {
  read,
  split: (answer) => {
    const parts = splitFollowUp(answer);
    return { answer: parts.answer, followUp: parts.followUp ?? undefined };
  },
  followUpHref: (q) => `/search?q=${encodeURIComponent(q)}`,
};

/** Streams the answer to `question` into Capsomer's Ask panel, in `container` (the palette's answer area). */
export function ask(container: HTMLElement, question: string): AskHandle {
  return askPanel(container, { ...options, request: (signal) => request(question, signal) });
}

// An island (devkit ./islands): each <template data-island="ask"> on the page calls this, and the first one runs it.
// The panel's enhance() is guarded on the DOM, so both bundles on /search never stream two billed answers per click.
let started = false;

export default function start(): void {
  if (started) return;
  started = true;
  enhance(document, { ...options, request });
}
