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

import { createContext } from "react-router";

import {
  dropCachedDrift,
  invalidateAnswerCache,
  readCachedDrift,
  writeCachedDrift,
} from "./ask-guard.server";
import { KEY_SEPARATOR, keyForUrl } from "./ask-keys.mjs";
import { isPubliclyVisible, statusForDraft } from "./visibility.mjs";
import { askCorpusRecords, askExpectedUrls } from "./search.server";
import { timed, type Timings } from "~/lib/timing";
import { recordsForPosts } from "./records.mjs";
/*
 * The pure half, in plain JavaScript so `check:tests` can reach it. Re-exported
 * rather than re-implemented: `search.ask.ts` imports the guard and the refusal
 * from this module, and a second import path would be a second thing to keep in
 * step. Grounds in ask-guard.mjs.
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
 * How many chunks the answer may draw on.
 *
 * ## RE-DERIVED 2026-08-28, and the old basis was a corpus size
 *
 * It read "the corpus is 7 records from one post", which was true when it was
 * written and had been false for a month: the index has grown by more than an
 * order of magnitude since, and nothing moved this value or noticed. A ceiling
 * justified by how much there is to retrieve has to be re-derived every time
 * anybody publishes, which is why it went stale.
 *
 * THE BOUND IS THE ANSWER, NOT THE CORPUS, and that is why it does not move.
 * The system prompt below asks for two or three sentences. An answer that
 * length cannot honestly synthesise more sources than this; past it, retrieval
 * widens the net without widening the answer, and the extra chunks only dilute
 * the ranking that chose the good ones. So the corpus growing does not raise
 * this, and shrinking would not lower it.
 *
 * No corpus figure appears here on purpose. This file owns this number and
 * nothing else, per rule 17: the index size is `sync_ask`'s to report and the
 * health check's to watch, and a copy here could only rot.
 */
const MAX_CHUNKS = 6;

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
 * Streams an answer. Returns the raw SSE stream from AI Search.
 *
 * The stream is handed to the client untouched rather than parsed and
 * re-emitted, so the Worker holds nothing in memory and time-to-first-token is
 * whatever AI Search delivers. The client already has to parse SSE to render
 * tokens as they arrive, so a second envelope would buy nothing.
 */
export async function askStream(env: Env, question: string): Promise<ReadableStream> {
  return env.AI_SEARCH.chatCompletions({
    /*
     * COMPOSED IN `askMessages`, not here, because the last message is the
     * retrieval query and a test has to be able to see it. Decorating it costs
     * the whole search: the grounds, and the measurement, are on that function.
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
  /** Cached answers dropped because the corpus they were drawn from moved. */
  cacheDropped: number;
}

/**
 * Every item in the index, following pagination to the end.
 *
 * `items.list()` is PAGED: it takes page and per_page and reports total_count,
 * and a bare call returns only the first page. Every caller here used a bare
 * call, which was invisible while the corpus was seven records and became a
 * correctness bug the moment it was not. Measured 2026-07-29: a prune reported
 * "removed 0" for a post whose items were real but sat on a later page, so a
 * draft stayed answerable through the public Ask endpoint after the code that
 * was supposed to remove it had run and reported success.
 *
 * A prune that cannot see an item cannot delete it, and it reports success
 * either way. That is the failure mode this exists to remove.
 */
async function listAllAskItems(env: Env, timings?: Timings) {
  /** @type {any[]} */
  const all: Awaited<ReturnType<typeof env.AI_SEARCH.items.list>>["result"] = [];
  // 50 is the API maximum. Measured: per_page 100 is rejected with
  // "Too big: expected number to be <=50".
  const perPage = 50;
  for (let page = 1; ; page += 1) {
    /*
     * ONE MARK PER PAGE, and the COUNT of them is the measurement.
     *
     * The pagination cost has only ever been inferred from the index size:
     * "81 items at 50 a page, so two round trips". That is arithmetic, not a
     * reading. Emitting a mark per iteration means the Server-Timing header
     * carries as many `ask_list_page` entries as there were round trips, each
     * with its own duration, so the page count is COUNTED and the cost is
     * attributed to a specific page rather than to the loop.
     *
     * Entries, not a map: two pages produce two entries with the same name, and
     * anything that collapses them by name reports one. That mistake was made
     * once already in this codebase's own measurement of artifact_load.
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
 * THE AI INDEX IS A PUBLIC SURFACE. `/search/ask` is unauthenticated and its
 * citations name the post they came from, so anything uploaded here is
 * readable by anyone who asks the right question. That makes this filter the
 * same kind of gate as `publiclyVisible()` on the D1 side, and it must agree
 * with it: a draft is excluded, and so is a post whose publish_at is still in
 * the future.
 *
 * This was missing, and it leaked. Five unpublished drafts staged through the
 * operator path on 2026-07-29 were uploaded unconditionally, and the public Ask
 * endpoint answered from one of them and cited it by slug. The classic index
 * was never affected: it filters at query time. Ask had no equivalent, because
 * AI Search has no per-item status the query can filter on, so the filter has
 * to happen at UPLOAD time. Nothing unpublished may enter the index at all.
 *
 * @param posts
 */
function publishableForAsk<T extends { draft?: boolean; publishAt?: string | null }>(
  posts: readonly T[],
): T[] {
  /*
   * COMPOSED, NOT RESTATED, since 2026-08-23. This used to be its own filter:
   * `draft === true` out, `publishAt > now` out. It agreed with
   * `publiclyVisible()` by inspection and by a grep in `check:policy`, and by
   * nothing else. A third hand-rolled copy of the visibility rule is the exact
   * shape that leaked five drafts into Ask on 2026-07-29.
   *
   * `statusForDraft` is the mapping between the artifact's boolean and the row's
   * string, so this asks the SAME predicate the D1 read path asks rather than
   * asking an equivalent question a different way.
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
export async function syncAskCorpus(env: Env): Promise<CorpusSyncResult> {
  /*
   * THE CORPUS COMES FROM D1, since the artifact arc. The records were
   * materialised into `search_docs` by the same records.mjs both writers run,
   * and `askCorpusRecords` reads them back with `visibilityClause` composed
   * in the SQL, so drafts and future posts never enter the index for the
   * same one-owner reason `publishableForAsk` protects the per-post path.
   */
  const records = await askCorpusRecords(env);
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
  // The drift number just changed too. A delete rather than a write, because
  // this path knows the cached value is stale and not what it became.
  await dropCachedDrift(env);

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
): Promise<{ uploaded: number; removed: number; failed: string[] }> {
  // A draft uploads NOTHING, and actively removes anything this post already
  // has in the index. Skipping the upload alone would be a silent leak on the
  // unpublish path: a post published, indexed, then withdrawn would stay
  // answerable forever. The empty `live` set makes the existing prune below do
  // the removal, so there is one removal path rather than two.
  const records = askPublishable(post) ? recordsForPosts([post]) : [];
  const live = new Set<string>();

  /*
   * **ONE FAILING RECORD USED TO ABANDON THE REST, AND THAT IS THE DEFECT THIS
   * LOOP IS SHAPED AROUND.**
   *
   * It was a plain `await` per record with no catch, so the first rejection
   * threw out of this function. MEASURED CONSEQUENCE: on 2026-07-31 the
   * Observable Plot post published with NINE records, the first upload failed,
   * and all nine were missing from the index for three weeks. The caller
   * catches by design (a save must not fail because an index write did), so
   * the failure had nowhere to go but the drift badge.
   *
   * **THE FAILURE CLASS IS TRANSIENT, and that is measured rather than
   * assumed.** Those same nine records uploaded without complaint when the
   * corpus sync was finally run three weeks later, so the records were always
   * uploadable and the original failure was a blip. This stack produces those:
   * `sync-content` hit "transient read failed, retrying once" twice in one week
   * against D1. A transient that costs nine records permanently is worth one
   * retry.
   *
   * So: each record is isolated, retried ONCE, and a record that still fails
   * does not stop the others.
   *
   * ## WHY A FAILED KEY STILL JOINS `live`, WHICH LOOKS WRONG AND IS NOT
   *
   * The prune below deletes every key this post owns that is NOT in `live`.
   * Isolating the loop without this line would turn a transient upload failure
   * into a DELETION of the perfectly good copy already in the index: the old
   * record would be pruned because the new one failed to land. The throw used
   * to prevent that by never reaching the prune at all.
   *
   * `live` means "this key should exist", not "this key was just written". A
   * failed key should exist, so it goes in, and whatever is already there
   * survives until a later sync replaces it.
   */
  const failed: string[] = [];

  for (const record of records) {
    if (record.url.includes(KEY_SEPARATOR)) {
      // NOT caught below. This is a correctness guard, not a transient: the key
      // would resolve back to the wrong URL and cite the wrong section. Retrying
      // it would produce the same wrong key, so it still throws.
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

  // Everything this post owns: `blog/<slug>.md` and `blog/<slug>__<anchor>.md`.
  // Matched on the exact document key or the section prefix, never on a bare
  // `startsWith(slug)`, which would also sweep up a longer slug that happens to
  // begin with this one.
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
  // The drift number just changed. A delete rather than a write, because this
  // path knows the cached value is stale and not what it became.
  await dropCachedDrift(env);
  // `records.length` MINUS what did not land. It used to return the record
  // count unconditionally, which was accurate only because a failure threw
  // before reaching here; with the loop isolated it would have reported nine
  // uploads on a run that achieved none.
  return { uploaded: records.length - failed.length, removed, failed };
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
export async function askIndexStatus(env: Env, timings?: Timings): Promise<AskIndexStatus> {
  /*
   * THE EXPECTED SET COMES FROM D1, NOT FROM THE REPOSITORY ARTIFACT.
   *
   * It used to be `recordsForPosts(publishableForAsk(posts))` over the corpus,
   * which meant a 600KB GitHub fetch on every admin page load to produce one
   * integer for a nav badge. `askExpectedUrls` reads the same records out of
   * `search_docs`, where `sync:content` materialised them from the same
   * `records.mjs`, and applies the same visibility rule through
   * `visibilityClause`. Grounds, the verification, and the behaviour change
   * are all stated at that function.
   *
   * `publishableForAsk` is still the filter the UPLOADERS use, and it must
   * stay in step with the SQL predicate here. `check:policy` binds the two.
   */
  /*
   * CONCURRENT, because the two sides of this comparison share nothing.
   *
   * The expected set is a D1 read and the listing is a paged walk of AI Search;
   * neither reads what the other writes, and they were strictly serial. This
   * function is 182ms at the median on /admin/posts and its `ask_list_page`
   * marks account for ~103ms of that, so the D1 half is most of the remainder
   * and it was pure waiting.
   *
   * It matters on BOTH consumers: /admin/posts calls this uncached on every
   * load, and the nav badge calls it on a drift-cache miss, which is the tail
   * the cache exists to hide.
   */
  const [expectedUrls, listed] = await Promise.all([
    askExpectedUrls(env),
    listAllAskItems(env, timings),
  ]);
  const expected = new Set(expectedUrls.map((u) => keyForUrl(u)));
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
 * Two surfaces want the same fact now: the alert on /admin/posts, which owns
 * the repair, and the count badge on the Posts nav item, which is rendered by
 * the admin LAYOUT on every admin page. A parent cannot read a child's loader
 * data, and moving the computation up to the layout was ruled out for a
 * concrete reason: check:admin-ui fabricates `ask` in the posts route's OWN
 * loader data, and the drift alert carries the `sync-ask` form, so relocating
 * it would have emptied that scenario and moved the gate's fixture.
 *
 * So the VALUE moves rather than the loader: the admin layout's middleware puts
 * this getter on the context, exactly as it already puts the verified session
 * there "so children read it without a second lookup", and both loaders call
 * it. On /admin/posts that is one listing per request instead of two, and the
 * posts route's loader data keeps the shape the gate asserts.
 *
 * It is a getter rather than an awaited value because middleware runs for the
 * whole /admin subtree. A route that never asks never pays.
 */
export type AskStatusReader = () => Promise<AskIndexStatus | null>;

export const askStatusContext = createContext<AskStatusReader>();

/**
 * Builds that reader. Resolves to null rather than throwing, on the same
 * grounds the posts loader already had: the AI index is an enhancement and it
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
 * THE DRIFT COUNT FOR THE NAV BADGE, off the read path.
 *
 * **THE CACHE IS THE POINT, AND IT IS HIDING A SLOW PATH, SO HERE IS THE SLOW
 * PATH.** `askIndexStatus` pages the whole AI Search index through
 * `listAllAskItems`. Measured on production 2026-08-19 across 12 direct
 * samples of `/admin.data`: median 208ms, MAXIMUM 2332ms, and the admin layout
 * runs on every admin page load, so that tail was reachable from any click in
 * the admin plane. Grounds for the TTL are at `DRIFT_CACHE_TTL_SECONDS`.
 *
 * ## ON A HIT THIS FUNCTION DOES NOT TOUCH AI SEARCH
 *
 * The early return below is the whole feature, and it is STRUCTURAL rather than
 * conditional: there is one `return` between the KV read and the first mention
 * of the index, so a hit cannot reach the listing. `check:invariants` section
 * 11 asserts that ordering on the source, deliberately not on a timing mark. A
 * mark count already proved unable to see an unmarked read in this codebase
 * (the second `artifact_load`, 2026-08-19), so an instrument-shaped assertion
 * here would be the same mistake with a different name.
 *
 * ## THE FAILURE MODE ON A MISS, CHOSEN RATHER THAN INHERITED
 *
 * A miss must never make the admin plane worse than a missing badge. Two things
 * follow.
 *
 * BOUNDED WAIT. The listing races a budget, and on expiry this returns null and
 * the page renders without a badge. 1000ms is taken from the measurement rather
 * than picked: it admits 11 of the 12 observed samples (168 to 970ms) and cuts
 * only the 2332ms outlier that motivated this change. So a miss costs about
 * what a miss costs, and the pathological case stops being the reader's problem.
 *
 * FAILURE IS NULL, NOT ZERO. An unbound binding, a rejected listing and an
 * expired budget all return null, and `admin.tsx` renders no badge for null.
 * Zero would be a claim that the index agrees with the corpus, made on no
 * evidence, next to a repair the operator would then not perform.
 *
 * **THE LATE WRITE IS NOW A PROMISE, AND THAT IS THIS WINDOW'S FIX. It was the
 * defect that made the cache self-perpetuating.** The paragraph here used to
 * say the late write "may not fire" and left it at that, calling it an
 * optimisation. It was not an optimisation, it was the mechanism, and treating
 * it as optional is what let the following loop run indefinitely:
 *
 *   1. a miss lists the index and the listing outruns the budget
 *   2. the budget wins, the response returns with no badge
 *   3. the write was floating, so it lands only if the isolate happens to
 *      outlive the response, and Workers may cancel pending work once a
 *      response is returned
 *   4. nothing was cached, so the NEXT request misses too, at step 1
 *
 * A slow listing therefore never populated the cache, and the TTL never got a
 * value to expire. MEASURED on production before the fix: 4 misses in 12
 * samples, at 1008, 436, 1009 and 507ms, and the only two that populated the
 * cache were the two that came in UNDER the budget. The cache filled by luck.
 *
 * `ctx.waitUntil` is the fix rather than a longer budget, because the budget is
 * not what is wrong: any budget has a listing slower than it, and raising the
 * number moves the line without removing the loop. `waitUntil` extends the
 * invocation's lifetime for exactly this, so the write lands whether or not the
 * response has already gone. The reader still waits at most `DRIFT_BUDGET_MS`,
 * which is the property the budget was there for.
 *
 * The ExecutionContext is a REQUIRED parameter and not an optional one, so a
 * call site that cannot supply it is a typecheck failure rather than a silent
 * return to the floating write. That is the same reasoning as the ordering
 * assertion above: structure, where structure is available.
 *
 * ## WHAT THIS IS NOT FOR
 *
 * The COUNT only. `/admin/posts` owns the repair and calls
 * `askStatusReader` for the full key lists, uncached, because a page whose job
 * is to fix drift must not act on a number up to five minutes old.
 */
export async function askDriftCount(
  env: Env,
  ctx: ExecutionContext,
  timings?: Timings,
): Promise<number | null> {
  if (!askAvailable(env)) return null;

  const cached = await timed(timings, "drift_cache_read", () => readCachedDrift(env));
  // THE EARLY RETURN. Nothing below this line runs on a hit, and section 11
  // asserts that no AI Search reference precedes it.
  if (cached !== null) return cached;

  // Rejection is folded into the value here rather than caught at the race, so
  // a failing listing and an absent one reach the same null and the caller has
  // one thing to handle instead of two.
  const listing = askIndexStatus(env, timings).catch((error) => {
    console.error("ask drift count failed", error);
    return null;
  });

  // The budget. Resolves to undefined rather than rejecting, so the race below
  // reads as "whichever arrives first" rather than as error handling.
  const budget = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), DRIFT_BUDGET_MS);
  });

  const status = await Promise.race([listing, budget]);

  if (status === undefined) {
    /*
     * The budget won. The listing is HANDED TO THE RUNTIME rather than left
     * floating: `waitUntil` is what makes the write land after the response,
     * and without it a listing slower than the budget could never populate the
     * cache, so the next request missed for the same reason and the cache
     * never filled. Grounds and the before measurement are on the doc comment.
     *
     * The `catch` stays. `waitUntil` rejecting is not better than a floating
     * rejection, and a failed listing here is the same non-event it is above:
     * there is no number to cache and the badge is already absent.
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
 * How long a cache miss may hold the admin layout before it gives up.
 *
 * From the measurement, not from taste: 11 of 12 observed listings finished
 * inside this and the one it cuts is the 2332ms sample this change exists for.
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
  // The drift number just changed. A delete rather than a write, because this
  // path knows the cached value is stale and not what it became.
  await dropCachedDrift(env);
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
  const listed = await listAllAskItems(env);
  for (const item of listed) {
    if (!live.has(item.key)) {
      await env.AI_SEARCH.items.delete(item.id);
      removed.push(item.key);
    }
  }
  // Removing items changes what the index holds, so the badge's cached number
  // is stale. This path invalidated NOTHING before the drift cache existed,
  // which was harmless while every read recomputed and is not once a value is
  // stored. Only on an actual removal: a prune that removed nothing changed
  // nothing, and dropping the key anyway would spend the next reader a listing.
  if (removed.length > 0) await dropCachedDrift(env);
  return removed;
}
