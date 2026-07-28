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

import { invalidateAnswerCache } from "./ask-guard.server";
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

/**
 * Splits the upstream stream in two: one to the reader, one to an accumulator.
 *
 * The reader gets bytes as they arrive, unchanged, so caching costs
 * time-to-first-token nothing. The second copy is parsed after the response has
 * already been sent, inside `waitUntil`, and what it accumulates is what gets
 * cached.
 *
 * Returns the stream to hand to the reader plus a promise of the parsed answer.
 * The promise resolves to null when the generation produced nothing, which must
 * not be cached.
 */
export function teeForCache(upstream: ReadableStream): {
  toReader: ReadableStream;
  captured: Promise<{ answer: string; chunks: unknown[] } | null>;
} {
  const [toReader, toCache] = upstream.tee();
  return { toReader, captured: parseSseAnswer(toCache) };
}

/**
 * Reads a full SSE completion into the pieces the cache needs.
 *
 * Same frame handling as the client, deliberately: if the two disagreed about
 * what a frame means, a cached replay would not match what the reader saw the
 * first time.
 */
async function parseSseAnswer(
  stream: ReadableStream,
): Promise<{ answer: string; chunks: unknown[] } | null> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let chunks: unknown[] = [];

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
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
        if (!data || data === "[DONE]") continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (eventName === "chunks") {
          if (Array.isArray(parsed)) chunks = parsed;
          continue;
        }
        const delta = (parsed as { choices?: Array<{ delta?: { content?: string } }> })
          ?.choices?.[0]?.delta?.content;
        if (typeof delta === "string") answer += delta;
      }
    }
  } catch {
    return null;
  }

  return answer.trim().length > 0 ? { answer, chunks } : null;
}

/**
 * Rebuilds a cached answer as the same SSE shape the model produces.
 *
 * The client cannot tell a replay from a generation, which is the point: one
 * parser, one rendering path, and no second code path that could drift. The
 * whole answer arrives as a single delta rather than re-simulating typing,
 * because pretending to think for two seconds over a cached string would be
 * theatre.
 */
export function replayCachedAnswer(cached: {
  answer: string;
  chunks: unknown[];
}): ReadableStream {
  const encoder = new TextEncoder();
  const frames = [
    `event: chunks\ndata: ${JSON.stringify(cached.chunks)}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: cached.answer } }] })}\n\n`,
    `data: [DONE]\n\n`,
  ];
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

export interface CorpusSyncResult {
  uploaded: number;
  keys: string[];
  /** Cached answers dropped because the corpus they were drawn from moved. */
  cacheDropped: number;
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

  // The corpus just changed, so every cached answer was written against content
  // that may no longer be true. Dropping them here is what stops a stale answer
  // outliving the post it was drawn from. It happens on publish, which is the
  // moment the change occurs, rather than being checked on every read forever.
  const dropped = await invalidateAnswerCache(env);

  return { uploaded: keys.length, keys, cacheDropped: dropped };
}

/**
 * Syncs ONE post's records into the index, and drops that post's stale items.
 *
 * This is what the editor's save path calls, and it is why Ask does not rot as
 * the blog grows. A full corpus sync on every save is correct at seven records
 * and absurd at seven hundred: it would re-upload every section of every post
 * because one post changed. Section decomposition is a pure function of a
 * single post's markdown, which is exactly the property the section-grained
 * ruling records, so the incremental path is sound rather than a shortcut.
 *
 * Scoped prune: a save that removes or renames a heading leaves an item behind
 * that still answers questions about a section the post no longer has. Only
 * keys belonging to THIS post are considered, so a concurrent post is never
 * touched.
 */
export async function syncAskPost(
  env: Env,
  post: Parameters<typeof recordsForPosts>[0][number],
): Promise<{ uploaded: number; removed: number }> {
  const records = recordsForPosts([post]);
  const live = new Set<string>();

  for (const record of records) {
    if (record.url.includes(KEY_SEPARATOR)) {
      throw new Error(
        `record url contains the key separator "${KEY_SEPARATOR}" and cannot be ` +
          `uploaded safely: ${record.url}`,
      );
    }
    const key = keyForUrl(record.url);
    await env.AI_SEARCH.items.upload(key, `# ${record.title}\n\n${record.body}\n`);
    live.add(key);
  }

  // Everything this post owns: `blog/<slug>.md` and `blog/<slug>__<anchor>.md`.
  // Matched on the exact document key or the section prefix, never on a bare
  // `startsWith(slug)`, which would also sweep up a longer slug that happens to
  // begin with this one.
  const documentKey = keyForUrl(post.url ?? `/blog/${post.slug}`);
  const sectionPrefix = `${documentKey.replace(/\.md$/, "")}${KEY_SEPARATOR}`;
  let removed = 0;
  const listed = await env.AI_SEARCH.items.list();
  for (const item of listed.result ?? []) {
    const ours = item.key === documentKey || item.key.startsWith(sectionPrefix);
    if (ours && !live.has(item.key)) {
      await env.AI_SEARCH.items.delete(item.id);
      removed += 1;
    }
  }

  await invalidateAnswerCache(env);
  return { uploaded: records.length, removed };
}

export interface AskIndexStatus {
  expected: number;
  present: number;
  missing: string[];
  stale: string[];
}

/**
 * Compares what the index holds against what the corpus says it should hold.
 *
 * This exists because the editor's Ask sync is deliberately allowed to fail
 * without failing the save, and the save then redirects, so a failure has
 * nowhere to be reported. Rather than build flash-message machinery to carry a
 * warning that would be read once, drift is made permanently visible on
 * /admin/posts. Silent drift in an index nobody looks at is how Ask would rot.
 *
 * Fails in BOTH directions, the same rule the backup gate follows: an item the
 * corpus does not know about is as much a defect as a record the index lacks.
 */
export async function askIndexStatus(
  env: Env,
  posts: Parameters<typeof recordsForPosts>[0],
): Promise<AskIndexStatus> {
  const expected = new Set(recordsForPosts(posts).map((r) => keyForUrl(r.url)));
  const listed = await env.AI_SEARCH.items.list();
  const present = new Set((listed.result ?? []).map((item) => item.key));

  return {
    expected: expected.size,
    present: present.size,
    missing: [...expected].filter((k) => !present.has(k)).sort(),
    stale: [...present].filter((k) => !expected.has(k)).sort(),
  };
}

/** Removes every item belonging to one post. Used when a post is deleted. */
export async function removeAskPost(env: Env, slug: string): Promise<number> {
  const documentKey = `blog/${slug}.md`;
  const sectionPrefix = `blog/${slug}${KEY_SEPARATOR}`;
  let removed = 0;
  const listed = await env.AI_SEARCH.items.list();
  for (const item of listed.result ?? []) {
    if (item.key === documentKey || item.key.startsWith(sectionPrefix)) {
      await env.AI_SEARCH.items.delete(item.id);
      removed += 1;
    }
  }
  await invalidateAnswerCache(env);
  return removed;
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
