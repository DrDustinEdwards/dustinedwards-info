/**
 * Cost guards for Ask mode.
 *
 * `/search/ask` is public, unauthenticated, and every answer that reaches the model bills Workers
 * AI. Retrieval is free in the AI Search beta; GENERATION IS NOT. There is no zone WAF to lean on,
 * because the site is still on workers.dev.
 *
 * Three gates, cheapest first, and NOTHING reaches the model until all three have passed:
 *
 * 1. Per-IP burst limit, an exact count in a Durable Object instance per IP.
 * 2. Answer cache, KV. Makes a repeated question a read instead of a bill.
 * 3. Daily ceiling, an exact count in one Durable Object. The spend cap.
 *
 * Gates 1 and 3 are Durable Objects rather than the `ratelimit` binding or a KV counter, and
 * `workers/ask-budget.ts` carries the measurements that ruled both of those out.
 *
 * THE ORDERING MATTERS AS MUCH AS THE MECHANISMS: a cache hit must not consume budget, so gate 3
 * sits AFTER the cache, not with gate 1.
 */

import { pacedAllowance, secondsPerPacedUnit } from "~/lib/search/ask-pacing.mjs";

/**
 * Requests per IP per minute. More than a reading human asks and far less than a loop wants,
 * counted exactly in a Durable Object instance per IP. `workers/ask-budget.ts` carries the
 * measurements that ruled out the `ratelimit` binding for this job.
 */
export const ASK_RATE_LIMIT = 5;
export const ASK_RATE_LIMIT_PERIOD_SECONDS = 60;

/**
 * Site-wide answers per day before Ask stops answering anyone. A ceiling on the bill, not a
 * fairness mechanism: deliberately a number a real reader will never reach and a scraper will.
 */
const DAILY_ANSWER_BUDGET = 200;

/**
 * Answers available immediately, on top of the day's paced share, chosen so PACING IS INVISIBLE
 * TO REAL READERS. Without a burst the first question after UTC midnight would be refused, because
 * an evenly paced share is zero at 00:00:01.
 *
 * It is also the size of the outage a burst can buy: an attacker can take these at any moment and
 * then moves at the paced rate. That is the trade.
 */
const ASK_BURST_ALLOWANCE = 25;

/** How long a cached answer stays valid. Also the ceiling on staleness. */
const ANSWER_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const ANSWER_CACHE_PREFIX = "ask:answer:";

/**
 * THE DRIFT BADGE'S CACHE. One integer, one key, no prefix scan.
 *
 * THIS IS A CACHE ADDED TO HIDE A SLOW PATH, AND SAYING SO IS THE CONDITION FOR ADDING IT. What it
 * hides is `listAllAskItems`, which pages the AI Search index and whose cost is per-call variance
 * rather than round-trip count, so the fix is removing the call from the read path.
 *
 * THE FRESHNESS SIDE SET THE VALUE, not the cost. `askExpectedUrls` composes `visibilityClause`, so
 * the expected set is a function of THE CLOCK: a scheduled post whose `publish_at` passes becomes
 * expected and `missing` grows with no write anywhere. TTL expiry is what recomputes on the clock's
 * schedule, and the TTL bounds how long the badge can under-report that.
 *
 * WHY THIS VALUE AND NOT 60 OR 3600: KV refuses a TTL under 60 seconds, so 60 is the shortest
 * expressible, and the ceiling is harm. Five minutes of an under-reported badge on a page that is
 * not the repair page harms nobody; an hour would start to.
 *
 * That clock dependency is also why this is a TTL cache and not compute-on-write: a number
 * recomputed only on save would under-report a scheduled post until the next unrelated save.
 */
const DRIFT_CACHE_KEY = "ask:drift";

/** Stated here and repeated to the reader in the badge's own title text. */
export const DRIFT_CACHE_TTL_SECONDS = 300;

export interface CachedAnswer {
  /** The full generated text, exactly as it was streamed the first time. */
  answer: string;
  /** The raw `chunks` event payload, so citations replay identically. */
  chunks: unknown[];
}

/**
 * Collapses questions that differ only in shape, so one question is not two cache entries and two
 * bills. Deliberately does NOT stem, reorder or drop stopwords: two questions that differ in wording
 * are different questions, and answering one with the other's answer would be a quiet correctness
 * bug rather than a saving.
 */
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?!.,;:]+$/g, "")
    .trim();
}

/** SHA-256 of the normalized question, hex. Stable across deployments. */
export async function questionKey(question: string): Promise<string> {
  const normalized = normalizeQuestion(question);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${ANSWER_CACHE_PREFIX}${hex}`;
}

export interface GuardVerdict {
  ok: boolean;
  /** Seconds a client should wait. Sent as Retry-After. */
  retryAfter?: number;
  /** Which layer refused, for the response body and for logs. */
  reason?: "rate" | "budget" | "unprotected";
}

/**
 * The per-IP burst limit. Runs before anything else, including the cache: a cache hit is cheap but
 * not free, and letting one caller hammer the endpoint for cached answers still burns the site's
 * resources.
 *
 * FAILS CLOSED when the limiter binding is absent. An unprotected metered endpoint must not serve,
 * so removing `ratelimits` from wrangler.jsonc DISABLES Ask rather than un-protecting it.
 */
export async function checkAskRate(env: Env, ip: string): Promise<GuardVerdict> {
  if (!env.ASK_BUDGET) {
    return { ok: false, reason: "unprotected", retryAfter: ASK_RATE_LIMIT_PERIOD_SECONDS };
  }

  // One Durable Object instance per IP, so counting is exact per caller and the instances shard.
  // Keyed by IP alone, not by IP plus question: the point is to cap how often one caller can spend.
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`ip:${ip}`));
  const { ok } = await limiter.hit(ASK_RATE_LIMIT, ASK_RATE_LIMIT_PERIOD_SECONDS);
  if (!ok) {
    return { ok: false, reason: "rate", retryAfter: ASK_RATE_LIMIT_PERIOD_SECONDS };
  }
  return { ok: true };
}

/**
 * Reserves one answer against the daily ceiling.
 *
 * Called ONLY on a cache miss, immediately before the model is reached, because a cache hit costs
 * nothing and must not consume budget. Reserve-then-generate rather than generate-then-count: two
 * requests that both read the same spend and both proceed is the race a ceiling must not have, so
 * the reservation and the decision are one operation inside the object that owns the number.
 *
 * A reservation is not refunded if generation fails. Over-counting a failure makes the ceiling
 * slightly strict; under-counting would make it a suggestion.
 */
export async function reserveAskBudget(env: Env): Promise<GuardVerdict> {
  const budget = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName("global"));

  /*
   * THE CEILING IS PACED, and the Durable Object is unchanged. `consume` takes the ceiling as an
   * argument, so the policy lives in a pure function `check:tests` can reach while the object stays a
   * counter with no clock policy of its own.
   *
   * What it fixes is the SHAPE of the failure rather than the size of the bill: a flat cap is a cliff
   * a distributed caller spends in minutes, and Ask is then dead for real readers until UTC midnight.
   * Paced, the denial ends when the abuse does. Full reasoning is on `pacedAllowance`.
   */
  const ceiling = pacedAllowance(DAILY_ANSWER_BUDGET, ASK_BURST_ALLOWANCE, new Date());
  const { ok } = await budget.consume(ceiling);
  if (!ok) {
    /*
     * `secondsPerPacedUnit`, NOT `secondsUntilUtcMidnight`. Under pacing that value would be wrong by
     * up to a day and would send a reader away from a feature that recovers in minutes.
     */
    return { ok: false, reason: "budget", retryAfter: secondsPerPacedUnit(DAILY_ANSWER_BUDGET) };
  }
  return { ok: true };
}

/** Today's spend, for the admin panel. Does not consume. */
export async function readAskBudget(env: Env): Promise<{ day: string; count: number; limit: number }> {
  const budget = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName("global"));
  const { day, count } = await budget.peek();
  return { day, count, limit: DAILY_ANSWER_BUDGET };
}

/**
 * Clears today's spend. Admin only, and recovery rather than routine: a ceiling with no way to
 * lift it turns a bad day into a bad week, and a guard has to be testable from a known state.
 */
export async function resetAskBudget(env: Env): Promise<void> {
  const budget = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName("global"));
  await budget.reset();
}

export async function readCachedAnswer(
  env: Env,
  key: string,
): Promise<CachedAnswer | null> {
  const cached = await env.APP_KV.get(key, "json");
  if (!cached || typeof cached !== "object") return null;
  const value = cached as Partial<CachedAnswer>;
  if (typeof value.answer !== "string" || !Array.isArray(value.chunks)) return null;
  return { answer: value.answer, chunks: value.chunks };
}

/**
 * Removes one cached answer: the targeted counterpart to `invalidateAnswerCache`, for an entry
 * whose citations are no longer public. A KV `delete` by name is strongly consistent, unlike the
 * `list` the bulk invalidation walks.
 */
export async function dropCachedAnswer(env: Env, key: string): Promise<void> {
  await env.APP_KV.delete(key);
}

export async function writeCachedAnswer(
  env: Env,
  key: string,
  value: CachedAnswer,
): Promise<void> {
  // An empty answer is a failed generation, not a result. Caching it would
  // serve the failure to everyone who asks the same thing for a week.
  if (value.answer.trim().length === 0) return;
  await env.APP_KV.put(key, JSON.stringify(value), {
    expirationTtl: ANSWER_CACHE_TTL_SECONDS,
  });
}

/**
 * The cached drift count, or null when there is none to serve. NULL, NOT ZERO: zero is a real
 * answer meaning the index agrees with the corpus, and a miss that returned zero would render a
 * clean badge on no evidence. Anything unparseable is also a miss, so a hand-edited key cannot
 * become a number by coercion.
 */
export async function readCachedDrift(env: Env): Promise<number | null> {
  const cached = await env.APP_KV.get(DRIFT_CACHE_KEY, "json");
  if (!cached || typeof cached !== "object") return null;
  const value = (cached as { drift?: unknown }).drift;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * Stores the drift count. An OBJECT rather than a bare number, so a later field can be added
 * without the stored shape being ambiguous between versions.
 */
export async function writeCachedDrift(env: Env, drift: number): Promise<void> {
  await env.APP_KV.put(DRIFT_CACHE_KEY, JSON.stringify({ drift }), {
    expirationTtl: DRIFT_CACHE_TTL_SECONDS,
  });
}

/**
 * Drops the cached drift count. Called by the paths that KNOW the number just changed, so the
 * badge does not spend the TTL disagreeing with an action the operator just took. A delete rather
 * than a write, because those paths know it is stale and not necessarily what it became.
 */
export async function dropCachedDrift(env: Env): Promise<void> {
  await env.APP_KV.delete(DRIFT_CACHE_KEY);
}

/**
 * Drops every cached answer, when the corpus changes.
 *
 * THIS IS WHY THE CACHE IS INVALIDATED RATHER THAN KEYED THROUGH A GENERATION NUMBER: a generation
 * in the key would cost a second KV read on every request forever, to handle an event that happens
 * when a post is published.
 *
 * KV list is eventually consistent, so an answer written moments before a sync can survive it. The
 * TTL is the backstop and the window is bounded by it, recorded rather than engineered away.
 */
export async function invalidateAnswerCache(env: Env): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;
  for (;;) {
    const page = await env.APP_KV.list({ prefix: ANSWER_CACHE_PREFIX, cursor });
    for (const key of page.keys) {
      await env.APP_KV.delete(key.name);
      deleted += 1;
    }
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return deleted;
}
