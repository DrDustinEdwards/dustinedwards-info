// With AI_SEARCH unbound no Ask affordance renders and /search is pure D1: that off switch is a requirement.

import { createContext } from "react-router";

import {
  dropCachedDrift,
  invalidateAnswerCache,
  readCachedDrift,
  writeCachedDrift,
} from "./ask-guard.server";
import { KEY_SEPARATOR, keyForUrl } from "./ask-keys.mjs";
import { uploadTwins } from "./ask-twins.mjs";
import { isPubliclyVisible, statusForDraft } from "./visibility.mjs";
import { askCorpusRecords, askExpectedUrls } from "./search.server";
import { PUBLICATIONS } from "~/data/publications";
import {
  doiSlug,
  paperMarkdownPath,
  paperPath,
} from "~/lib/publications/paths.mjs";
import { timed, type Timings } from "~/lib/timing";
import { recordsForPosts } from "./records.mjs";
import {
  NO_ANSWER_TEXT,
  answerLeaksPrompt,
  askMessages,
  citedSlugs,
  guardAnswerStream,
  replayFrames,
} from "./ask-prompt.mjs";

export { NO_ANSWER_TEXT, answerLeaksPrompt, citedSlugs, guardAnswerStream };

const ASK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** Bounds the answer, not the corpus: past it, retrieval widens the net without widening the answer. */
const MAX_CHUNKS = 6;

/** A property check, not a try/catch: only a removed binding, not an erroring instance, should hide Ask. */
export function askAvailable(env: Env): boolean {
  return Boolean(env.AI_SEARCH);
}

export interface AskCitation {
  url: string;
  title: string;
  isSection: boolean;
  score: number;
}

/** The raw upstream SSE is handed through untouched: the client already parses SSE. */
export async function askStream(env: Env, question: string): Promise<ReadableStream> {
  return env.AI_SEARCH.chatCompletions({
    // The last message is the retrieval query; decorating it costs the whole search.
    messages: askMessages(question),
    model: ASK_MODEL,
    stream: true,
    ai_search_options: {
      max_num_results: MAX_CHUNKS,
    },
  });
}

/** The cache copy is parsed inside waitUntil, so caching costs time-to-first-token nothing. */
export function teeForCache(upstream: ReadableStream): {
  toReader: ReadableStream;
  captured: Promise<{ answer: string; chunks: unknown[] } | null>;
} {
  const [toReader, toCache] = upstream.tee();
  return { toReader, captured: parseSseAnswer(toCache) };
}

/** Same frame handling as the client, or a cached replay would not match what the reader first saw. */
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

export function replayCachedAnswer(cached: {
  answer: string;
  chunks: unknown[];
}): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of replayFrames(cached)) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

export interface CorpusSyncResult {
  uploaded: number;
  keys: string[];
  /** Non-empty means the sync did NOT converge. */
  failed: Array<{ key: string; error: string }>;
  cacheDropped: number;
}

/** items.list() is paged: a bare call returns only the first page, and a prune cannot delete what it cannot see. */
async function listAllAskItems(env: Env, timings?: Timings) {
  const all: Awaited<ReturnType<typeof env.AI_SEARCH.items.list>>["result"] = [];
  // 50 is the API maximum.
  const perPage = 50;
  for (let page = 1; ; page += 1) {
    // One mark per page, so round trips are counted rather than inferred from the index size.
    const listed = await timed(timings, "ask_list_page", () =>
      env.AI_SEARCH.items.list({ page, per_page: perPage }),
    );
    const batch = listed.result ?? [];
    all.push(...batch);
    const total = listed.result_info?.total_count;
    if (batch.length < perPage) break;
    if (typeof total === "number" && all.length >= total) break;
    // Backstop against a server that never shrinks a page. Thrown, not a break: a truncated listing
    // would make every unlisted item look absent to the prune and the drift count.
    if (page > 200) {
      throw new Error(
        `AI Search listing did not end after ${page} pages of ${perPage} (${all.length} items); ` +
          `refusing to act on a listing that may be truncated.`,
      );
    }
  }
  return all;
}

/** AI Search has no per-item status to filter on, so nothing unpublished may be uploaded at all. */
function publishableForAsk<T extends { draft?: boolean; publishAt?: string | null }>(
  posts: readonly T[],
): T[] {
  const now = Date.now();
  return posts.filter((p) =>
    isPubliclyVisible({ status: statusForDraft(p.draft), publishAt: p.publishAt }, now),
  );
}

function askPublishable(post: { draft?: boolean; publishAt?: string | null }): boolean {
  return publishableForAsk([post]).length === 1;
}

/** Uploaded rather than crawled: the crawler would index the apex (the legacy site) and lose heading granularity. */
export async function syncAskCorpus(env: Env): Promise<CorpusSyncResult> {
  // From D1 with visibilityClause composed in the SQL, so drafts and future posts never enter the index.
  const records = await askCorpusRecords(env);
  const keys: string[] = [];

  for (const record of records) {
    // Fail closed: a url containing the separator would produce a key that resolves to the wrong URL.
    if (record.url.includes(KEY_SEPARATOR)) {
      throw new Error(
        `record url contains the key separator "${KEY_SEPARATOR}" and cannot be ` +
          `uploaded safely: ${record.url}`,
      );
    }
    const key = keyForUrl(record.url);
    // The heading is included in the uploaded text: the body alone loses what the section is about.
    const content = `# ${record.title}\n\n${record.body}\n`;
    await env.AI_SEARCH.items.upload(key, content);
    keys.push(key);
  }

  // Papers from their twins, not search_docs: uploading both would let the shorter win questions the longer answers.
  const twins = await uploadPaperTwins(env);
  keys.push(...twins.keys);

  // The corpus changed, so cached answers may now be untrue.
  const dropped = await invalidateAnswerCache(env);
  await dropCachedDrift(env);

  return {
    uploaded: keys.length - twins.failed.length,
    keys,
    failed: twins.failed,
    cacheDropped: dropped,
  };
}

/** From the module, not D1: papers have no visibility state to ask about. */
function paperItemKeys(): string[] {
  return PUBLICATIONS.map((paper) => keyForUrl(paperPath(doiSlug(paper.doi))));
}

/** Fetched through ASSETS: the twins are gitignored and not imported, so this indexes what the site serves. */
async function uploadPaperTwins(env: Env) {
  const twins = PUBLICATIONS.map((paper) => {
    const slug = doiSlug(paper.doi);
    return { key: keyForUrl(paperPath(slug)), path: paperMarkdownPath(slug) };
  });
  return uploadTwins(twins, {
    fetchText: async (path: string) => {
      const response = await env.ASSETS.fetch(new Request(new URL(path, "https://assets.invalid")));
      if (!response.ok) throw new Error(`twin ${path} answered ${response.status}`);
      return response.text();
    },
    upload: (key: string, body: string) => env.AI_SEARCH.items.upload(key, body),
  });
}

/** Scoped to this post's keys, which is sound because sections are a pure function of one post's markdown. */
export async function syncAskPost(
  env: Env,
  post: Parameters<typeof recordsForPosts>[0][number],
): Promise<{ uploaded: number; removed: number; failed: string[] }> {
  // A draft uploads nothing, and the empty live set makes the prune below remove what it had.
  const records = askPublishable(post) ? recordsForPosts([post]) : [];
  const live = new Set<string>();

  // A failed key still joins live: the prune deletes every key not in it, which would delete the indexed copy.
  const failed: string[] = [];

  for (const record of records) {
    if (record.url.includes(KEY_SEPARATOR)) {
      // Not caught below: retrying would produce the same wrong key.
      throw new Error(
        `record url contains the key separator "${KEY_SEPARATOR}" and cannot be ` +
          `uploaded safely: ${record.url}`,
      );
    }
    const key = keyForUrl(record.url);
    const body = `# ${record.title}\n\n${record.body}\n`;
    try {
      await env.AI_SEARCH.items.upload(key, body);
    } catch {
      try {
        await env.AI_SEARCH.items.upload(key, body);
      } catch (error) {
        console.error("ask upload failed twice", key, error);
        failed.push(key);
      }
    }
    live.add(key);
  }

  // Exact key or section prefix, never startsWith(slug), which would sweep up a longer slug.
  const documentKey = keyForUrl(post.url ?? `/blog/${post.slug}`);
  const sectionPrefix = `${documentKey.replace(/\.md$/, "")}${KEY_SEPARATOR}`;
  let removed = 0;
  const listed = await listAllAskItems(env);
  for (const item of listed) {
    const ours = item.key === documentKey || item.key.startsWith(sectionPrefix);
    if (ours && !live.has(item.key)) {
      await env.AI_SEARCH.items.delete(item.id);
      removed += 1;
    }
  }

  await invalidateAnswerCache(env);
  await dropCachedDrift(env);
  return { uploaded: records.length - failed.length, removed, failed };
}

export interface AskIndexStatus {
  expected: number;
  present: number;
  missing: string[];
  stale: string[];
}

/** Both directions: an item the corpus does not know is as much a defect as a missing one. */
export async function askIndexStatus(env: Env, timings?: Timings): Promise<AskIndexStatus> {
  // publishableForAsk must stay in step with the SQL predicate here; check:policy binds the two.
  const [expectedUrls, listed] = await Promise.all([
    askExpectedUrls(env),
    listAllAskItems(env, timings),
  ]);
  // Without the papers, the badge would report them stale and the repair button would delete them.
  const expected = new Set([...expectedUrls.map((u) => keyForUrl(u)), ...paperItemKeys()]);
  const present = new Set(listed.map((item) => item.key));

  return {
    expected: expected.size,
    present: present.size,
    missing: [...expected].filter((k) => !present.has(k)).sort(),
    stale: [...present].filter((k) => !expected.has(k)).sort(),
  };
}

/** On the context because a parent cannot read a child's loader data; a getter, so a route that never asks never pays. */
export type AskStatusReader = () => Promise<AskIndexStatus | null>;

export const askStatusContext = createContext<AskStatusReader>();

/** Null rather than throwing: an enhancement must not take an admin page down. */
export function askStatusReader(env: Env, timings?: Timings): AskStatusReader {
  let pending: Promise<AskIndexStatus | null> | undefined;
  return () => {
    pending ??= (async () => {
      if (!askAvailable(env)) return null;
      try {
        return await askIndexStatus(env, timings);
      } catch (error) {
        console.error("ask index status failed", error);
        return null;
      }
    })();
    return pending;
  };
}

/**
 * On a hit nothing touches AI Search: keep the early return before any index use. Null, not zero, on
 * failure. A late listing is handed to waitUntil, since a floating write never lands after the response.
 */
export async function askDriftCount(
  env: Env,
  ctx: ExecutionContext,
  timings?: Timings,
): Promise<number | null> {
  if (!askAvailable(env)) return null;

  const cached = await timed(timings, "drift_cache_read", () => readCachedDrift(env));
  if (cached !== null) return cached;

  const listing = askIndexStatus(env, timings).catch((error) => {
    console.error("ask drift count failed", error);
    return null;
  });

  const budget = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), DRIFT_BUDGET_MS);
  });

  const status = await Promise.race([listing, budget]);

  if (status === undefined) {
    // The catch stays: a rejecting waitUntil is no better than a floating rejection.
    ctx.waitUntil(
      listing
        .then((late) =>
          late ? writeCachedDrift(env, late.missing.length + late.stale.length) : null,
        )
        .catch(() => {}),
    );
    return null;
  }

  if (!status) return null;

  const drift = status.missing.length + status.stale.length;
  await writeCachedDrift(env, drift);
  return drift;
}

/** Measured: admits all but the one pathological listing this budget exists for. */
const DRIFT_BUDGET_MS = 1000;

export async function removeAskPost(env: Env, slug: string): Promise<number> {
  const documentKey = `blog/${slug}.md`;
  const sectionPrefix = `blog/${slug}${KEY_SEPARATOR}`;
  let removed = 0;
  const listed = await listAllAskItems(env);
  for (const item of listed) {
    if (item.key === documentKey || item.key.startsWith(sectionPrefix)) {
      await env.AI_SEARCH.items.delete(item.id);
      removed += 1;
    }
  }
  await invalidateAnswerCache(env);
  await dropCachedDrift(env);
  return removed;
}

/** Upload is an upsert, so a renamed or deleted post leaves its old item answering forever. */
export async function pruneAskCorpus(env: Env, liveKeys: string[]): Promise<string[]> {
  const live = new Set(liveKeys);
  const removed: string[] = [];
  const listed = await listAllAskItems(env);
  for (const item of listed) {
    if (!live.has(item.key)) {
      await env.AI_SEARCH.items.delete(item.id);
      removed.push(item.key);
    }
  }
  // Only on an actual removal; dropping the key otherwise would cost the next reader a listing.
  if (removed.length > 0) await dropCachedDrift(env);
  return removed;
}
