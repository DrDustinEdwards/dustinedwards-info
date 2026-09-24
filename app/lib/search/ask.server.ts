/**
 * Ask mode: search Layer 2, over Cloudflare AI Search.
 *
 * CLASSIC SEARCH IS D1 AND ONLY D1: with `AI_SEARCH` unbound no Ask affordance renders and /search
 * is byte-identical to what it was before Layer 2. That off switch is a requirement, not a nicety.
 */

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
/*
 * The pure half, in plain JavaScript so `check:tests` can reach it, and RE-EXPORTED rather than
 * re-implemented: a second import path would be a second thing to keep in step.
 */
import {
  NO_ANSWER_TEXT,
  answerLeaksPrompt,
  askMessages,
  citedSlugs,
  guardAnswerStream,
  replayFrames,
} from "./ask-prompt.mjs";

export { NO_ANSWER_TEXT, answerLeaksPrompt, citedSlugs, guardAnswerStream };

/** Text-generation model for the answer. Named here so it is one edit to move. */
const ASK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * How many chunks the answer may draw on. THE BOUND IS THE ANSWER, NOT THE CORPUS: past it,
 * retrieval widens the net without widening the answer. No corpus figure here, per rule 17.
 */
const MAX_CHUNKS = 6;

/**
 * True when the AI Search binding is present, checked as a property rather than in a try/catch:
 * "the binding was removed" and "the instance errored" are different, and only the first should
 * silently remove the feature.
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
 * Streams an answer, handing the raw SSE upstream to the client untouched rather than parsing and
 * re-emitting: the Worker holds nothing in memory, and the client already parses SSE, so a second
 * envelope would buy nothing.
 */
export async function askStream(env: Env, question: string): Promise<ReadableStream> {
  return env.AI_SEARCH.chatCompletions({
    /*
     * COMPOSED IN `askMessages`, not here, because the last message is the retrieval query and a test
     * has to be able to see it. Decorating it costs the whole search.
     */
    messages: askMessages(question),
    model: ASK_MODEL,
    stream: true,
    ai_search_options: {
      max_num_results: MAX_CHUNKS,
    },
  });
}

/**
 * Splits the upstream in two, the second copy parsed inside `waitUntil`, so caching costs
 * time-to-first-token nothing. Null when the generation produced nothing, which must not be cached.
 */
export function teeForCache(upstream: ReadableStream): {
  toReader: ReadableStream;
  captured: Promise<{ answer: string; chunks: unknown[] } | null>;
} {
  const [toReader, toCache] = upstream.tee();
  return { toReader, captured: parseSseAnswer(toCache) };
}

/**
 * Same frame handling as the client, deliberately: if the two disagreed about what a frame means,
 * a cached replay would not match what the reader saw the first time.
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
 * Rebuilds a cached answer in the shape the model produces, so one parser and one rendering path
 * serve both. One delta rather than re-simulated typing, which would be theater.
 */
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
  /** Keys that did not land after their retries. Non-empty means the sync did NOT converge. */
  failed: Array<{ key: string; error: string }>;
  /** Cached answers dropped because the corpus they were drawn from moved. */
  cacheDropped: number;
}

/**
 * Every item, following pagination to the end. `items.list()` IS PAGED and a bare call returns the
 * first page only: a prune that cannot see an item cannot delete it, and reports success either way.
 */
async function listAllAskItems(env: Env, timings?: Timings) {
  /** @type {any[]} */
  const all: Awaited<ReturnType<typeof env.AI_SEARCH.items.list>>["result"] = [];
  // 50 is the API maximum.
  const perPage = 50;
  for (let page = 1; ; page += 1) {
    /*
     * ONE MARK PER PAGE, so round trips are COUNTED rather than inferred from the index size. Entries,
     * not a map: two pages produce two entries with one name, and collapsing by name reports one.
     */
    const listed = await timed(timings, "ask_list_page", () =>
      env.AI_SEARCH.items.list({ page, per_page: perPage }),
    );
    const batch = listed.result ?? [];
    all.push(...batch);
    const total = listed.result_info?.total_count;
    if (batch.length < perPage) break;
    if (typeof total === "number" && all.length >= total) break;
    // Backstop against a server that never shrinks a page.
    if (page > 200) break;
  }
  return all;
}

/**
 * The posts that may appear in the Ask index.
 *
 * THE AI INDEX IS A PUBLIC SURFACE, cited by slug, so this must agree with `publiclyVisible()`. THE
 * FILTER HAS TO HAPPEN AT UPLOAD TIME: AI Search has no per-item status a query can filter on, so
 * nothing unpublished may enter at all.
 *
 * @param posts
 */
function publishableForAsk<T extends { draft?: boolean; publishAt?: string | null }>(
  posts: readonly T[],
): T[] {
  /*
   * COMPOSED, NOT RESTATED: a hand-rolled copy agreed with `publiclyVisible()` by inspection and by
   * nothing else, which is the shape that leaked drafts into Ask.
   */
  const now = Date.now();
  return posts.filter((p) =>
    isPubliclyVisible({ status: statusForDraft(p.draft), publishAt: p.publishAt }, now),
  );
}

/** True when this one post is allowed in the index. */
function askPublishable(post: { draft?: boolean; publishAt?: string | null }): boolean {
  return publishableForAsk([post]).length === 1;
}

/**
 * Uploads every search record to built-in storage rather than through the crawler, which would
 * index the apex, still the legacy site, and would lose the heading granularity a citation
 * deep-links to. Upload is an UPSERT keyed by filename, so re-running is idempotent.
 */
export async function syncAskCorpus(env: Env): Promise<CorpusSyncResult> {
  /*
   * THE CORPUS COMES FROM D1, materialized by the same `records.mjs` both writers run and read back
   * with `visibilityClause` composed in the SQL, so drafts and future posts never enter the index.
   */
  const records = await askCorpusRecords(env);
  const keys: string[] = [];

  for (const record of records) {
    // Fail closed: a slug or anchor containing the separator would produce a key that resolves back to
    // the wrong URL, and a citation pointing at the wrong section is worse than no citation.
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

  /*
   * THE PAPERS, FROM THEIR TWINS RATHER THAN FROM `search_docs`: the record carries the abstract,
   * which is what keyword search should snippet, and the twin has the text Ask should retrieve over.
   * Uploading both would let the shorter sometimes win a question the longer answers.
   */
  const twins = await uploadPaperTwins(env);
  keys.push(...twins.keys);

  // The corpus just changed, so every cached answer was written against content that may no longer
  // be true. Dropping them at the moment of change is what stops a stale answer outliving the post.
  const dropped = await invalidateAnswerCache(env);
  // A delete rather than a write: this path knows the cached value is stale, not what it became.
  await dropCachedDrift(env);

  return {
    uploaded: keys.length - twins.failed.length,
    keys,
    failed: twins.failed,
    cacheDropped: dropped,
  };
}

/**
 * Every paper's Ask item key, FROM THE MODULE AND NOT FROM D1, on the visibility rule: composing
 * `visibilityClause` here would ask a visibility question about a corpus that has none, and reading
 * the module points the index at the repository, which is rule 18's direction.
 */
function paperItemKeys(): string[] {
  return PUBLICATIONS.map((paper) => keyForUrl(paperPath(doiSlug(paper.doi))));
}

/**
 * Uploads every paper's markdown twin, with retries, through `ask-twins.mjs`, which carries the
 * grounds: a key that still fails is RETURNED in `failed` rather than logged and dropped, and every
 * key stays in `keys` so the caller's prune never deletes the copy already indexed.
 *
 * FETCHED THROUGH `ASSETS` because a Worker cannot read a file it does not import, and the twins
 * are gitignored so the extracted text stays out of the bundle. The live-path rule's property comes with
 * it: what is indexed is the document the site actually serves at that URL.
 */
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

/**
 * Syncs ONE post's records and drops that post's stale items, which is sound rather than a shortcut
 * because section decomposition is a pure function of one post's markdown. The prune is scoped to
 * this post's keys, so a concurrent post is never touched.
 */
export async function syncAskPost(
  env: Env,
  post: Parameters<typeof recordsForPosts>[0][number],
): Promise<{ uploaded: number; removed: number; failed: string[] }> {
  // A draft uploads NOTHING and actively removes what this post already has: skipping the upload
  // alone would leave a withdrawn post answerable forever. The empty `live` set makes the prune below
  // do it, so there is one removal path rather than two.
  const records = askPublishable(post) ? recordsForPosts([post]) : [];
  const live = new Set<string>();

  /*
   * ONE FAILING RECORD USED TO ABANDON THE REST, and the caller catches by design, so a post's
   * records went missing with the failure nowhere to go. Each is isolated and retried ONCE.
   *
   * A FAILED KEY STILL JOINS `live`, WHICH LOOKS WRONG AND IS NOT: the prune deletes every key not in
   * it, so isolating the loop without this would DELETE the good copy already indexed. `live` means
   * "this key should exist", not "this key was just written".
   */
  const failed: string[] = [];

  for (const record of records) {
    if (record.url.includes(KEY_SEPARATOR)) {
      // NOT caught below: a correctness guard rather than a transient. The key would resolve to the wrong
      // URL and cite the wrong section, and retrying would produce the same wrong key.
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

  // Matched on the exact document key or the section prefix, never on a bare `startsWith(slug)`,
  // which would sweep up a longer slug that happens to begin with this one.
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
  // A delete rather than a write: this path knows the cached value is stale, not what it became.
  await dropCachedDrift(env);
  // `records.length` MINUS what did not land. It returned the record count unconditionally, which was
  // accurate only because a failure threw before reaching here.
  return { uploaded: records.length - failed.length, removed, failed };
}

export interface AskIndexStatus {
  expected: number;
  present: number;
  missing: string[];
  stale: string[];
}

/**
 * Compares what the index holds against what the corpus says it should hold, because the Ask sync
 * may fail without failing the save and the save then redirects. Both directions, as the backup
 * gate has it: an item the corpus does not know about is as much a defect as a missing record.
 */
export async function askIndexStatus(env: Env, timings?: Timings): Promise<AskIndexStatus> {
  /*
   * THE EXPECTED SET COMES FROM D1, not the repository artifact, which meant a GitHub fetch per admin
   * page load for one integer. `publishableForAsk` is still the UPLOADERS' filter and must stay in
   * step with the SQL predicate here; `check:policy` binds the two.
   */
  /*
   * CONCURRENT, because the two sides share nothing: a D1 read and a paged walk of AI Search, neither
   * reading what the other writes, and they were strictly serial.
   */
  const [expectedUrls, listed] = await Promise.all([
    askExpectedUrls(env),
    listAllAskItems(env, timings),
  ]);
  /*
   * THE PAPERS ARE PART OF WHAT THE INDEX SHOULD HOLD: without this the badge would report them
   * permanently stale and the repair button would delete them.
   */
  const expected = new Set([...expectedUrls.map((u) => keyForUrl(u)), ...paperItemKeys()]);
  const present = new Set(listed.map((item) => item.key));

  return {
    expected: expected.size,
    present: present.size,
    missing: [...expected].filter((k) => !present.has(k)).sort(),
    stale: [...present].filter((k) => !expected.has(k)).sort(),
  };
}

/**
 * The request-scoped, MEMOIZED reader for the drift status above.
 *
 * Two surfaces want the fact and a parent cannot read a child's loader data. Moving the computation
 * up was ruled out because the posts route's OWN loader data carries it, and moving it there would
 * have reshaped that route. The VALUE moves instead, on the context. A getter, so
 * a route that never asks never pays.
 */
export type AskStatusReader = () => Promise<AskIndexStatus | null>;

export const askStatusContext = createContext<AskStatusReader>();

/**
 * Builds that reader. Resolves to null rather than throwing: the AI index is an enhancement and
 * may not take an admin page down with it when it is unbound or unreachable.
 */
export function askStatusReader(env: Env, timings?: Timings): AskStatusReader {
  /** One in-flight promise per request, so concurrent callers share a listing. */
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
 * THE DRIFT COUNT FOR THE NAV BADGE, off the read path, because this pages the whole index and the
 * admin layout runs on every admin page load.
 *
 * ON A HIT THIS DOES NOT TOUCH AI SEARCH, structurally: one `return` sits between the KV read and
 * the first mention of the index. Keep it that way ON THE SOURCE: a timing-mark count has already
 * failed to see an unmarked read here.
 *
 * FAILURE IS NULL, NOT ZERO: zero claims the index agrees with the corpus, on no evidence, beside a
 * repair the operator would then not perform.
 *
 * THE LATE WRITE IS THE MECHANISM, NOT AN OPTIMISATION: a floating write lands only if the isolate
 * outlives the response, so a listing slower than the budget never populated the cache and the next
 * request missed for the same reason. `waitUntil` is the fix rather than a longer budget, any
 * budget having a listing slower than it, and the ExecutionContext is REQUIRED so a call site that
 * cannot supply it is a typecheck failure.
 *
 * THE COUNT ONLY: the page that owns the repair reads the full lists uncached.
 */
export async function askDriftCount(
  env: Env,
  ctx: ExecutionContext,
  timings?: Timings,
): Promise<number | null> {
  if (!askAvailable(env)) return null;

  const cached = await timed(timings, "drift_cache_read", () => readCachedDrift(env));
  // THE EARLY RETURN. Nothing below runs on a hit, and section 11 asserts no AI Search reference precedes it.
  if (cached !== null) return cached;

  // Rejection is folded into the value rather than caught at the race, so a failing listing and an
  // absent one reach the same null and the caller has one thing to handle.
  const listing = askIndexStatus(env, timings).catch((error) => {
    console.error("ask drift count failed", error);
    return null;
  });

  // The budget resolves to undefined rather than rejecting, so the race reads as "whichever arrives
  // first" rather than as error handling.
  const budget = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), DRIFT_BUDGET_MS);
  });

  const status = await Promise.race([listing, budget]);

  if (status === undefined) {
    /*
     * The budget won, so the listing is HANDED TO THE RUNTIME rather than left floating: `waitUntil` is
     * what makes the write land after the response. The `catch` stays, because `waitUntil` rejecting is
     * no better than a floating rejection and there is no number to cache either way.
     */
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

/**
 * How long a cache miss may hold the admin layout before it gives up. From the measurement rather
 * than taste: it admits all but the one pathological listing this change exists for.
 */
const DRIFT_BUDGET_MS = 1000;

/** Removes every item belonging to one post. Used when a post is deleted. */
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
  // A delete rather than a write: this path knows the cached value is stale, not what it became.
  await dropCachedDrift(env);
  return removed;
}

/**
 * Removes items that no longer correspond to a record: upload is an upsert, so a renamed or deleted
 * post leaves its old item answering forever. Both directions, as the backup gate has it.
 */
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
  // Removing items changes what the index holds, so the badge's cached number is stale. Only on an
  // ACTUAL removal: a prune that removed nothing changed nothing, and dropping the key anyway would
  // spend the next reader a listing.
  if (removed.length > 0) await dropCachedDrift(env);
  return removed;
}
