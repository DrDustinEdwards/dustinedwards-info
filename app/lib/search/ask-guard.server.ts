// Every generated answer bills Workers AI and the route is public. Nothing reaches the model until
// rate, cache and daily budget have passed, and budget sits AFTER the cache so a hit costs nothing.

import { pacedAllowance, secondsPerPacedUnit } from "~/lib/search/ask-pacing.mjs";

/** Per IP per minute: more than a reading human asks, far less than a loop wants. */
const ASK_RATE_LIMIT = 5;
export const ASK_RATE_LIMIT_PERIOD_SECONDS = 60;

/** A ceiling on the bill: a number a real reader never reaches and a scraper will. */
const DAILY_ANSWER_BUDGET = 200;

/** Without a burst the first question after UTC midnight is refused: the paced share is zero at 00:00:01. */
const ASK_BURST_ALLOWANCE = 25;

/** How long a cached answer stays valid. Also the ceiling on staleness. */
const ANSWER_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const ANSWER_CACHE_PREFIX = "ask:answer:";

/**
 * TTL cache, not compute-on-write: the expected set moves with the clock as scheduled posts go live.
 * KV refuses a TTL under 60 seconds; five minutes of an under-reported badge harms nobody.
 */
const DRIFT_CACHE_KEY = "ask:drift";

/** Stated here and repeated to the reader in the badge's own title text. */
export const DRIFT_CACHE_TTL_SECONDS = 300;

export interface CachedAnswer {
  answer: string;
  chunks: unknown[];
}

/** No stemming or stopword dropping: differently worded questions must not share an answer. */
function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?!.,;:]+$/g, "")
    .trim();
}

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

interface GuardVerdict {
  ok: boolean;
  retryAfter?: number;
  reason?: "rate" | "budget" | "unprotected";
}

/** Fails closed without the binding, so removing it disables Ask rather than unprotecting it. */
export async function checkAskRate(env: Env, ip: string): Promise<GuardVerdict> {
  if (!env.ASK_BUDGET) {
    return { ok: false, reason: "unprotected", retryAfter: ASK_RATE_LIMIT_PERIOD_SECONDS };
  }

  // Keyed by IP alone, not IP plus question: the point is to cap how often one caller can spend.
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`ip:${ip}`));
  const { ok } = await limiter.hit(ASK_RATE_LIMIT, ASK_RATE_LIMIT_PERIOD_SECONDS);
  if (!ok) {
    return { ok: false, reason: "rate", retryAfter: ASK_RATE_LIMIT_PERIOD_SECONDS };
  }
  return { ok: true };
}

/**
 * Only on a cache miss. Reserve-then-generate, so two concurrent requests cannot both pass on one read;
 * never refunded on failure, since under-counting would make the ceiling a suggestion.
 */
export async function reserveAskBudget(env: Env): Promise<GuardVerdict> {
  const budget = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName("global"));

  // Paced, so exhausting the ceiling denies Ask for minutes rather than until UTC midnight.
  const ceiling = pacedAllowance(DAILY_ANSWER_BUDGET, ASK_BURST_ALLOWANCE, new Date());
  const { ok } = await budget.consume(ceiling);
  if (!ok) {
    // Not seconds-until-midnight: under pacing that would be wrong by up to a day.
    return { ok: false, reason: "budget", retryAfter: secondsPerPacedUnit(DAILY_ANSWER_BUDGET) };
  }
  return { ok: true };
}

export async function readAskBudget(env: Env): Promise<{ day: string; count: number; limit: number }> {
  const budget = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName("global"));
  const { day, count } = await budget.peek();
  return { day, count, limit: DAILY_ANSWER_BUDGET };
}

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

/** For an entry whose citations are no longer public. A delete by name is consistent; list is not. */
export async function dropCachedAnswer(env: Env, key: string): Promise<void> {
  await env.APP_KV.delete(key);
}

export async function writeCachedAnswer(
  env: Env,
  key: string,
  value: CachedAnswer,
): Promise<void> {
  // An empty answer is a failed generation; caching it would serve the failure for a week.
  if (value.answer.trim().length === 0) return;
  await env.APP_KV.put(key, JSON.stringify(value), {
    expirationTtl: ANSWER_CACHE_TTL_SECONDS,
  });
}

/** Null, not zero, on a miss: zero means the index agrees, and a miss must not render a clean badge. */
export async function readCachedDrift(env: Env): Promise<number | null> {
  const cached = await env.APP_KV.get(DRIFT_CACHE_KEY, "json");
  if (!cached || typeof cached !== "object") return null;
  const value = (cached as { drift?: unknown }).drift;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

export async function writeCachedDrift(env: Env, drift: number): Promise<void> {
  await env.APP_KV.put(DRIFT_CACHE_KEY, JSON.stringify({ drift }), {
    expirationTtl: DRIFT_CACHE_TTL_SECONDS,
  });
}

/** A delete rather than a write: the caller knows the count is stale, not what it became. */
export async function dropCachedDrift(env: Env): Promise<void> {
  await env.APP_KV.delete(DRIFT_CACHE_KEY);
}

/**
 * Invalidated rather than keyed by generation, which would cost a second KV read on every request.
 * KV list is eventually consistent, so an answer written just before a sync can survive until its TTL.
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
