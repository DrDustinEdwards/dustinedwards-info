// With AI_SEARCH unbound no Ask affordance renders and /search is pure D1: that off switch is a requirement.

import { invalidateAnswerCache } from "./ask-guard.server";
import { answerDelta, replayFrames, takeSseFrames } from "@dustinedwards/site-runtime/ai-ask";
import { ASK_INDEX_QUERY, askIndexExpected } from "./search.server";
import { withTimeout } from "@dustinedwards/site-runtime/time";
import { errorMessage, logEvent } from "@dustinedwards/site-runtime/log";
import {
  ASK_MAX_TOKENS,
  ASK_TIMEOUT_MS,
  answerLeaksPrompt,
  askMessages,
  citedSlugs,
  guardAsk,
} from "./ask-prompt.mjs";

export { answerLeaksPrompt, citedSlugs, guardAsk };

const ASK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/**
 * Two entries, the most the gateway log takes from AI Search; `ai-search`, `task` and `origin` are reserved. The keys
 * are site-runtime's (`anthropicRoute` in ./ai-gateway tags `{ app, feature }`), so one gateway filter finds a site's
 * calls whichever door they took.
 */
const ASK_GATEWAY_METADATA = { app: "dustinedwards", feature: "ask" };

/** Bounds the answer, not the corpus: past it, retrieval widens the net without widening the answer. */
const MAX_CHUNKS = 6;

/** A property check, not a try/catch: only a removed binding, not an erroring instance, should hide Ask. */
export function askAvailable(env: Env): boolean {
  return Boolean(env.AI_SEARCH);
}

/**
 * The raw upstream SSE is handed through untouched: the client already parses SSE. The binding takes no
 * signal, so a call that has not started answering by ASK_TIMEOUT_MS is abandoned here (guardAsk
 * bounds the rest). `max_tokens` is not in the binding's documented parameters; Cloudflare's own
 * ai-search-provider sends it there, and its docs say it reaches the model and truncates the answer, so the guard
 * reads each answer's finish_reason and a cut one is never cached (guardAsk).
 *
 * The gateway (checklist G1, C13): AI Search has no per-request gateway option and no route through site-runtime's
 * shared caller, which speaks Anthropic's Messages API. Every AI Search instance is connected to an AI Gateway, and
 * "query rewriting and response generation also run through your gateway"
 * (https://developers.cloudflare.com/ai-search/configuration/models/ai-gateway/); the instance's `ai_gateway_id`
 * names it (https://developers.cloudflare.com/ai-search/api/instances/workers-binding/). What a request can set is
 * `custom_metadata`, up to two entries on the gateway's log, so Ask's calls are told apart by app and feature.
 */
export async function askStream(env: Env, question: string): Promise<ReadableStream> {
  return withTimeout(
    env.AI_SEARCH.chatCompletions({
      // The last message is the retrieval query; decorating it costs the whole search.
      messages: askMessages(question),
      model: ASK_MODEL,
      stream: true,
      max_tokens: ASK_MAX_TOKENS,
      ai_search_options: {
        // Under `retrieval`, where the binding's AiSearchOptions type and the AI Search docs put it
        // (https://developers.cloudflare.com/ai-search/api/search/workers-binding/); at the top level it was
        // ignored and the default of 10 chunks applied.
        retrieval: { max_num_results: MAX_CHUNKS },
        custom_metadata: ASK_GATEWAY_METADATA,
      },
    }),
    ASK_TIMEOUT_MS,
    `AI Search did not answer within ${ASK_TIMEOUT_MS} ms`,
  );
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
      const taken = takeSseFrames(buffer);
      buffer = taken.rest;
      for (const { event, data } of taken.frames) {
        if (event === "chunks") {
          if (Array.isArray(data)) chunks = data;
          continue;
        }
        answer += answerDelta(data) ?? "";
      }
    }
  } catch {
    return null;
  }

  return answer.trim().length > 0 ? { answer, chunks } : null;
}

export function replayCachedAnswer(cached: { answer: string; chunks: unknown[] }): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of replayFrames(cached)) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

/*
 * The index. The instance's data source is this site's D1 (ASK_INDEX_QUERY in search.server.ts), so AI Search reads
 * the corpus itself on every sync: new rows are indexed, changed rows re-indexed, unchanged rows skipped, and a row the
 * query no longer returns (a draft, a post set back to draft, a renamed or deleted post) is removed once the whole
 * result has been read. Nothing is uploaded and nothing is pruned here. A sync runs on the instance's own schedule
 * (every 15 minutes), when a post or paper is published or withdrawn, when a scheduled post goes live (askIndexTick),
 * and on every deploy (sync_ask).
 *
 * The instance was created once through the API (type "d1", source this database, token_id the account's AI Search
 * service token, whose Index Engine permission holds D1 Read; template content_only, so only the title and content
 * are embedded; sync_interval 900; hybrid search with reranking; the public endpoint with MCP on and chat completions
 * off). A missing instance is never re-created here, because creating one needs that token.
 */

const QUERY_KEY = "ask:index:query";
/** The sync whose end drops the cached answers, which were written against the index before it. */
const JOB_KEY = "ask:index:job";
/** Set when a sync was asked for while an earlier one, which may have read D1 before the change, was running. */
const AGAIN_KEY = "ask:index:again";
const MARK_KEY = "ask:index:mark";

const INDEX_TEMPLATE = "content_only";

/** Sends ASK_INDEX_QUERY when the instance was last given another one; the change itself starts a sync. */
async function ensureQuery(env: Env): Promise<void> {
  if ((await env.APP_KV.get(QUERY_KEY)) === ASK_INDEX_QUERY) return;
  await env.AI_SEARCH.update({
    source_params: { d1: { query: ASK_INDEX_QUERY, template: INDEX_TEMPLATE } },
  });
  await env.APP_KV.put(QUERY_KEY, ASK_INDEX_QUERY);
  logEvent("ASK_INDEX_QUERY_SET", { message: "ASK_INDEX_QUERY_SET dustinedwards-ask" });
}

/** AI Search writes its times as "YYYY-MM-DD HH:MM:SS" in UTC. */
const jobTime = (at: string | undefined) => Date.parse(`${at?.replace(" ", "T")}Z`);

/**
 * Asks for a sync. A sync already running answers with itself, and it may have read D1 before this change, so then
 * the next tick asks again once it ends. Never throws: a publish must not fail because the index could not be asked.
 */
export async function startAskSync(
  env: Env,
  why: string,
): Promise<{ ok: true; job: AiSearchJobInfo; joined: boolean } | { ok: false; error: string }> {
  if (!askAvailable(env)) return { ok: false, error: "AI_SEARCH is not bound" };
  try {
    await ensureQuery(env);
    // Workers' clock moves only across I/O, so this is the moment before the sync is asked for.
    const asked = Math.floor(Date.now() / 1000) * 1000;
    const job = await env.AI_SEARCH.jobs.create({ description: why });
    const joined = !(jobTime(job.started_at) >= asked);
    await env.APP_KV.put(JOB_KEY, job.id);
    if (joined) await env.APP_KV.put(AGAIN_KEY, why);
    return { ok: true, job, joined };
  } catch (error) {
    console.error(JSON.stringify({ alert: "ask-sync-refused", why, detail: errorMessage(error) }));
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * After a write that changes what Ask may quote (a post or paper saved, published, withdrawn, renamed or deleted): a
 * sync, so the index follows D1 within a minute or two instead of at the next scheduled one. The write has landed,
 * so this never fails it; null means Ask is not configured, and a refusal is reported, never the same null.
 */
export async function askSyncAfterWrite(env: Env, why: string) {
  if (!askAvailable(env)) return null;
  const asked = await startAskSync(env, why);
  return asked.ok
    ? { ok: true as const, job: asked.job.id, joined: asked.joined }
    : {
        ok: false as const,
        message:
          `The write landed, but the Ask index could not be asked to sync: ${asked.error}. ` +
          `It catches up on its next scheduled sync, within 15 minutes.`,
      };
}

/** What would change the visible corpus with no write: a scheduled post or section going live. */
async function visibleMark(env: Env): Promise<string> {
  return String(await askIndexExpected(env));
}

/**
 * The cron's minute: when the sync this site last asked for has ended, the cached answers are dropped (they were
 * written against the index before it) and a sync asked for during it is asked for again; and a change in how many
 * rows the corpus has (a scheduled post going live) asks for one.
 */
export async function askIndexTick(env: Env): Promise<string> {
  if (!askAvailable(env)) return "AI_SEARCH is not bound";
  const notes: string[] = [];
  const pending = await env.APP_KV.get(JOB_KEY);
  if (pending) {
    const info = await env.AI_SEARCH.jobs.get(pending).info();
    if (info.ended_at) {
      await env.APP_KV.delete(JOB_KEY);
      notes.push(`sync ${pending} ended (${info.end_reason ?? "no reason given"})`);
      notes.push(`${await invalidateAnswerCache(env)} cached answer(s) dropped`);
      const again = await env.APP_KV.get(AGAIN_KEY);
      if (again) {
        await env.APP_KV.delete(AGAIN_KEY);
        const asked = await startAskSync(env, again);
        notes.push(asked.ok ? `sync ${asked.job.id} asked for again` : asked.error);
      }
    }
  }
  const mark = await visibleMark(env);
  if ((await env.APP_KV.get(MARK_KEY)) !== mark) {
    const asked = await startAskSync(env, "the visible corpus changed");
    if (asked.ok) await env.APP_KV.put(MARK_KEY, mark);
    notes.push(asked.ok ? `sync ${asked.job.id} asked for: ${mark} rows` : asked.error);
  }
  return notes.join("; ") || "nothing changed";
}

export interface AskIndexStatus {
  /** Rows ASK_INDEX_QUERY returns now. */
  expected: number;
  /** Items the index holds indexed. */
  present: number;
  /** Rows the index refused (a row too large, an empty one). */
  failed: number;
  /** Items queued or being indexed. */
  indexing: number;
  /** The newest sync, or null before the first. */
  lastSync: AiSearchJobInfo | null;
}

/** Both sides are counts: the index holds one item per row, and AI Search removes a row's item when the row goes. */
export async function askIndexStatus(env: Env): Promise<AskIndexStatus> {
  const [expected, stats, jobs] = await Promise.all([
    askIndexExpected(env),
    env.AI_SEARCH.stats(),
    env.AI_SEARCH.jobs.list({ per_page: 1 }),
  ]);
  return {
    expected,
    present: stats.completed ?? 0,
    failed: stats.error ?? 0,
    indexing: (stats.queued ?? 0) + (stats.running ?? 0),
    lastSync: jobs.result[0] ?? null,
  };
}

/**
 * A sync, waited on until it ends, then the index read back: sync_ask's answer on every deploy. A sync that was
 * already running may have read D1 before the deploy's writes, so once it ends one is asked for again. The wait is
 * bounded below the five minutes Node's fetch gives an operator call (scripts/lib/operator-sync.mjs).
 */
export async function syncAskAndWait(
  env: Env,
  why: string,
  { waitMs = 240_000, pollMs = 5_000 } = {},
): Promise<{ job: AiSearchJobInfo; ended: boolean; status: AskIndexStatus }> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    const asked = await startAskSync(env, why);
    if (!asked.ok) throw new Error(asked.error);
    let job = asked.job;
    while (!job.ended_at && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      job = await env.AI_SEARCH.jobs.get(job.id).info();
    }
    if (job.ended_at && asked.joined && Date.now() < deadline) {
      await env.APP_KV.delete(AGAIN_KEY);
      continue;
    }
    if (job.ended_at) {
      // The tick would drop them within the minute; a deploy's first reader should not get one in between.
      await env.APP_KV.delete(JOB_KEY);
      await invalidateAnswerCache(env);
    }
    return { job, ended: Boolean(job.ended_at), status: await askIndexStatus(env) };
  }
}
