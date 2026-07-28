/**
 * Cost guards for Ask mode.
 *
 * `/search/ask` is public, unauthenticated, and every answer that reaches the
 * model bills Workers AI. Retrieval is free in the AI Search beta; GENERATION
 * IS NOT. So the endpoint needs to be cheap to use honestly and expensive to
 * abuse, and it needs that without a zone WAF, because the site is still on
 * workers.dev and workers.dev has no zone to attach rules to.
 *
 * Three gates, cheapest first, and NOTHING reaches the model until all three
 * have passed:
 *
 * 1. **Per-IP burst limit**, an exact count in a Durable Object instance per
 *    IP. Stops one caller monopolising the endpoint.
 * 2. **Answer cache**, KV. Makes a repeated question a read instead of a bill.
 * 3. **Daily ceiling**, an exact count in one Durable Object. The spend cap.
 *
 * Gates 1 and 3 are Durable Objects rather than the `ratelimit` binding or a KV
 * counter, and that is a measured decision rather than a preference. Both of
 * the cheaper mechanisms were built first and both leaked: the binding refused
 * 1, then 2, then 9, then 0 of twelve concurrent requests against a limit of
 * five, and a KV counter is worse still because concurrent read-modify-writes
 * all read the same stale value. The measurements and the reasoning live in
 * `workers/ask-budget.ts`, next to the code they justify.
 *
 * The ordering matters as much as the mechanisms. A cache hit must not consume
 * budget, so gate 3 sits AFTER the cache, not with gate 1.
 */

/**
 * Requests per IP per minute.
 *
 * Five questions a minute is more than a reading human asks and far less than a
 * loop wants. Counted exactly, in a Durable Object instance per IP: see
 * `workers/ask-budget.ts` for the four measurements that ruled out the
 * `ratelimit` binding for this job.
 */
export const ASK_RATE_LIMIT = 5;
export const ASK_RATE_LIMIT_PERIOD_SECONDS = 60;

/**
 * Site-wide answers per day before Ask stops answering anyone.
 *
 * A ceiling on the bill, not a fairness mechanism. Deliberately a number a real
 * reader will never reach and a distributed scraper will.
 */
const DAILY_ANSWER_BUDGET = 200;

/** How long a cached answer stays valid. Also the ceiling on staleness. */
const ANSWER_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const ANSWER_CACHE_PREFIX = "ask:answer:";

export interface CachedAnswer {
  /** The full generated text, exactly as it was streamed the first time. */
  answer: string;
  /** The raw `chunks` event payload, so citations replay identically. */
  chunks: unknown[];
}

/**
 * Collapses questions that differ only in shape.
 *
 * "What is the backup asymmetry?" and "what is the backup asymmetry" are one
 * question and must not be two cache entries and two bills. Deliberately does
 * NOT stem, reorder or drop stopwords: two questions that differ in wording are
 * different questions, and answering one with the other's answer would be a
 * quiet correctness bug rather than a saving.
 */
export function normalizeQuestion(question: string): string {
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
 * The per-IP burst limit. Runs before anything else, including the cache.
 *
 * A cache hit is cheap but not free, and letting one caller hammer the endpoint
 * for cached answers is still a way to burn the site's resources. So this gate
 * is in front of everything.
 *
 * FAILS CLOSED when the limiter binding is absent. An unprotected metered
 * endpoint must not serve: a guard that silently passes because it could not
 * run is the exact failure mode this project has been caught by three times.
 * Removing `ratelimits` from wrangler.jsonc therefore DISABLES Ask rather than
 * un-protecting it, which is a different thing from removing `ai_search`, and
 * deliberately so.
 */
export async function checkAskRate(env: Env, ip: string): Promise<GuardVerdict> {
  if (!env.ASK_BUDGET) {
    return { ok: false, reason: "unprotected", retryAfter: ASK_RATE_LIMIT_PERIOD_SECONDS };
  }

  // One Durable Object instance per IP, so counting is exact per caller and the
  // instances shard naturally instead of funnelling through one object.
  // Keyed by IP alone, not by IP plus question: the point is to cap how often
  // one caller can spend, whatever they are asking.
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
 * Called ONLY on a cache miss, immediately before the model is reached, because
 * a cache hit costs nothing and must not consume budget. Reserve-then-generate
 * rather than generate-then-count: two concurrent requests that both read
 * "199 spent" and both proceed is exactly the race a ceiling must not have, and
 * the only way to avoid it is for the reservation and the decision to be one
 * operation inside the object that owns the number.
 *
 * A reservation is not refunded if generation then fails. Over-counting a
 * failure makes the ceiling slightly strict; under-counting would make it a
 * suggestion.
 */
export async function reserveAskBudget(env: Env): Promise<GuardVerdict> {
  const budget = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName("global"));
  const { ok } = await budget.consume(DAILY_ANSWER_BUDGET);
  if (!ok) {
    return { ok: false, reason: "budget", retryAfter: secondsUntilUtcMidnight() };
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
 * Clears today's spend. Admin only.
 *
 * Recovery, not routine: it exists because a ceiling with no way to lift it is
 * a ceiling that turns a bad day into a bad week, and because a guard has to be
 * testable from a known state to be provable at all.
 */
export async function resetAskBudget(env: Env): Promise<void> {
  const budget = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName("global"));
  await budget.reset();
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((midnight - now.getTime()) / 1000));
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
 * Drops every cached answer.
 *
 * Called when the corpus changes. **This is why the cache is invalidated rather
 * than keyed through a generation number**: a generation in the key would cost
 * a second KV read on every request forever, to handle an event that happens
 * when a post is published. Deleting on publish puts the cost where the change
 * is.
 *
 * KV list is eventually consistent, so an answer written moments before a sync
 * can survive it. The TTL is the backstop, and the staleness window is bounded
 * by how long a stale answer can outlive its content: at worst until the next
 * sync, at absolute worst the TTL. Recorded rather than engineered away,
 * because the corpus changes when Dustin publishes and not otherwise.
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
