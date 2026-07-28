/**
 * Ask mode: search Layer 2, over Cloudflare AI Search.
 *
 * THE RULE THIS FILE EXISTS UNDER. Classic search is D1 and only D1. Nothing
 * here is imported by `search.server.ts`, no classic query awaits anything in
 * this module, and the zero-JS path never reaches it. If `AI_SEARCH` is not
 * bound, `askAvailable()` is false, no Ask affordance is rendered, and /search
 * is byte-identical to what it was before Layer 2 existed. That property is the
 * off switch the cost-review ruling in decisions.md depends on, so it is a
 * requirement rather than a nicety.
 *
 * The corpus is the SAME section-grained records the D1 index uses, derived by
 * the same `records.mjs`. There is one record derivation for the whole site,
 * exactly as there is one markdown renderer.
 */

import { KEY_SEPARATOR, keyForUrl, labelForUrl, urlForKey } from "./ask-keys.mjs";
import { recordsForPosts } from "./records.mjs";

/** @see app/lib/search/records.mjs */
type SearchRecord = ReturnType<typeof recordsForPosts>[number];

/** Text-generation model for the answer. Named here so it is one edit to move. */
const ASK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * How many chunks the answer may draw on.
 *
 * The corpus is 7 records from one post, so a high number would retrieve the
 * entire site for every question and make every answer look equally confident.
 */
const MAX_CHUNKS = 6;

const SYSTEM_PROMPT = [
  "You answer questions about Dustin Edwards's personal site using only the",
  "provided context. If the context does not contain the answer, say so plainly",
  "and do not guess. Be brief: two or three sentences unless asked for more.",
  "Do not use em dashes. Do not open with a restatement of the question.",
].join(" ");

/**
 * True when the AI Search binding is present.
 *
 * Checked as a property on env rather than in a try/catch, because "the
 * binding was removed" and "the instance errored" are different situations and
 * only the first one should silently remove the feature.
 */
export function askAvailable(env: Env): boolean {
  return Boolean(env.AI_SEARCH);
}

export interface AskCitation {
  url: string;
  title: string;
  /** True when the citation lands on a heading rather than the post itself. */
  isSection: boolean;
  score: number;
}

/**
 * Turns the `chunks` event payload into citations.
 *
 * Deduplicated by URL and capped, because several chunks of one section are one
 * citation to a reader. Chunks whose key does not resolve are dropped rather
 * than rendered, per `urlForKey`.
 */
export function citationsFromChunks(
  chunks: Array<{ text?: string; score?: number; item?: { key?: string } }>,
): AskCitation[] {
  const byUrl = new Map<string, AskCitation>();
  for (const chunk of chunks) {
    const key = chunk.item?.key;
    if (!key) continue;
    const url = urlForKey(key);
    if (!url) continue;
    const existing = byUrl.get(url);
    const score = chunk.score ?? 0;
    if (existing) {
      if (score > existing.score) existing.score = score;
      continue;
    }
    byUrl.set(url, {
      url,
      title: labelForUrl(url),
      isSection: url.includes("#"),
      score,
    });
  }
  return [...byUrl.values()].sort((a, b) => b.score - a.score);
}

/**
 * Streams an answer. Returns the raw SSE stream from AI Search.
 *
 * The stream is handed to the client untouched rather than parsed and
 * re-emitted, so the Worker holds nothing in memory and time-to-first-token is
 * whatever AI Search delivers. The client already has to parse SSE to render
 * tokens as they arrive, so a second envelope would buy nothing.
 */
export async function askStream(env: Env, question: string): Promise<ReadableStream> {
  return env.AI_SEARCH.chatCompletions({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ],
    model: ASK_MODEL,
    stream: true,
    ai_search_options: {
      max_num_results: MAX_CHUNKS,
    },
  });
}

export interface CorpusSyncResult {
  uploaded: number;
  keys: string[];
}

/**
 * Uploads every search record to built-in storage.
 *
 * WHY BUILT-IN STORAGE RATHER THAN THE CRAWLER. The crawler only indexes a
 * domain onboarded to this Cloudflare account, and the apex still resolves to
 * the legacy WordPress site, so a crawl would index the wrong site entirely.
 * It would also index whole pages, losing the heading granularity that lets a
 * citation deep-link to the section that answered the question. Built-in
 * storage indexes immediately; external sources run on a 6 hour schedule and
 * pause after 31 days without a query.
 *
 * Upload is an UPSERT keyed by filename, so re-running is idempotent and a
 * retitled section replaces itself rather than accumulating.
 */
export async function syncAskCorpus(
  env: Env,
  posts: Parameters<typeof recordsForPosts>[0],
): Promise<CorpusSyncResult> {
  const records = recordsForPosts(posts);
  const keys: string[] = [];

  for (const record of records) {
    // Fail closed. A slug or anchor containing the separator would produce a
    // key that resolves back to the wrong URL, and a citation pointing at the
    // wrong section is a worse failure than no citation at all.
    if (record.url.includes(KEY_SEPARATOR)) {
      throw new Error(
        `record url contains the key separator "${KEY_SEPARATOR}" and cannot be ` +
          `uploaded safely: ${record.url}`,
      );
    }
    const key = keyForUrl(record.url);
    // The heading is included in the uploaded text. The body alone loses what
    // the section is about, and the retrieval model reads this as prose.
    const content = `# ${record.title}\n\n${record.body}\n`;
    await env.AI_SEARCH.items.upload(key, content);
    keys.push(key);
  }

  return { uploaded: keys.length, keys };
}

/**
 * Removes items that no longer correspond to a record.
 *
 * Upload is an upsert, so a renamed or deleted post leaves its old item behind
 * and it stays answerable forever. Same shape as the both-directions rule the
 * backup gate follows: what is present and should not be is as much a defect as
 * what is missing.
 */
export async function pruneAskCorpus(env: Env, liveKeys: string[]): Promise<string[]> {
  const live = new Set(liveKeys);
  const removed: string[] = [];
  const listed = await env.AI_SEARCH.items.list();
  for (const item of listed.result ?? []) {
    if (!live.has(item.key)) {
      await env.AI_SEARCH.items.delete(item.id);
      removed.push(item.key);
    }
  }
  return removed;
}
