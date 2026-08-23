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

import { pacedAllowance, secondsPerPacedUnit } from "~/lib/search/ask-pacing.mjs";

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

/**
 * Answers available immediately, on top of the day's paced share.
 *
 * Twenty-five, and the number is chosen so that PACING IS INVISIBLE TO REAL
 * READERS. Observed demand on this site is a handful of questions a day, so a
 * genuine reader arriving at any hour finds headroom well above anything they
 * or the other readers that hour will use. Without a burst the first question
 * after UTC midnight would be refused, because an evenly paced share is zero at
 * 00:00:01, which would be a worse bug than the one being fixed.
 *
 * It is also the size of the outage a burst can still buy: an attacker can take
 * these 25 at any moment, and then moves at the paced rate. That is the trade,
 * and 25 answers is a cheap one.
 */
const ASK_BURST_ALLOWANCE = 25;

/** How long a cached answer stays valid. Also the ceiling on staleness. */
const ANSWER_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const ANSWER_CACHE_PREFIX = "ask:answer:";

/**
 * THE DRIFT BADGE'S CACHE. One integer, one key, no prefix scan.
 *
 * **THIS IS A CACHE ADDED TO HIDE A SLOW PATH, AND TIER 1.5 REQUIRES SAYING SO
 * RATHER THAN NOT DOING IT.** So: it is hiding `listAllAskItems`, which pages
 * the AI Search index 50 at a time and was measured on production 2026-08-19
 * from 12 direct samples of `/admin.data` at a median of 208ms and a MAXIMUM OF
 * 2332ms. The layout runs on every admin page load, so that tail was reachable
 * from any click anywhere in the admin plane.
 *
 * The fix is removing the call from the read path, not making it cheaper. Both
 * pages cost about 72ms each, so dropping page 2 would buy 72ms and leave the
 * tail exactly where it was: the cost is per-call variance of 46 to 2055ms, not
 * round-trip count.
 *
 * ## WHY 300 SECONDS, and not a round number chosen for looking tidy
 *
 * Three constraints, and the measurement picks the value between them.
 *
 * FLOOR: KV refuses a TTL under 60 seconds, so 60 is the shortest expressible.
 *
 * THE COST SIDE: at 208ms median the call is affordable occasionally and
 * unaffordable per page load. An admin session is a burst of navigation, so
 * what matters is calls per session rather than per request. At 300s a ten
 * minute working session pays the listing about twice however many pages are
 * opened, and can meet the 2332ms tail at most twice rather than on any click.
 * At 60s the same session pays it ten times and meets the tail ten times over,
 * which is most of the problem still present.
 *
 * THE FRESHNESS SIDE, and this is the constraint that set the value rather than
 * the cost. `askExpectedUrls` composes `visibilityClause`, so the expected set
 * is a function of THE CLOCK: a scheduled post whose `publish_at` passes
 * becomes expected and `missing` grows with no write anywhere. TTL expiry is
 * what recomputes on the clock's schedule, and 300s bounds how long the badge
 * can under-report that. Five minutes of an under-reported badge on a page that
 * is not the repair page is not a defect anyone can be harmed by; an hour would
 * start to be.
 *
 * That clock dependency is also exactly why this is a TTL cache and not
 * compute-on-write, which was the agreed plan until the measurement produced
 * this reasoning: a number recomputed only on `savePost` and `sync-ask` would
 * under-report a scheduled post's arrival until the next unrelated save.
 * Dormant today, since no published post record is future-dated, and armed the
 * moment one is scheduled.
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

  /*
   * THE CEILING IS PACED, since 2026-08-23, and the Durable Object is unchanged.
   *
   * `consume` takes the ceiling as an argument, so the policy can live in a
   * pure function that `check:tests` can reach while the object stays a
   * synchronous counter with no clock policy of its own. That split is the
   * reason this needed no migration and no new binding.
   *
   * What it fixes is the SHAPE of the failure rather than the size of the bill.
   * A flat 200 is a cliff: a distributed caller spends it in minutes, every
   * request inside the per-IP limit, and Ask is dead for real readers until UTC
   * midnight. Paced, the same 200 is released across the day, so the denial
   * ends when the abuse does. Full reasoning, and what this does NOT fix, are
   * on `pacedAllowance`.
   */
  const ceiling = pacedAllowance(DAILY_ANSWER_BUDGET, ASK_BURST_ALLOWANCE, new Date());
  const { ok } = await budget.consume(ceiling);
  if (!ok) {
    /*
     * `secondsPerPacedUnit`, NOT `secondsUntilUtcMidnight`. That value was
     * correct under a flat cap, where nothing changed until the day rolled
     * over. Under pacing it would be wrong by up to a day and would send a
     * reader away from a feature that recovers in minutes.
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
 * Removes one cached answer.
 *
 * The targeted counterpart to `invalidateAnswerCache`, for finding B010: the
 * replay path finds an entry whose citations are no longer public and deletes
 * exactly that entry. A KV `delete` by name is strongly consistent, unlike the
 * `list` the bulk invalidation walks, so this is not subject to the lag that
 * produced the stale entry in the first place.
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
 * The cached drift count, or null when there is none to serve.
 *
 * NULL, NOT ZERO, and the distinction is the whole reason this returns a union.
 * Zero is a real and common answer meaning "the index agrees with the corpus",
 * and a miss that returned zero would render a clean badge on no evidence.
 * Anything unparseable is also a miss: a hand-edited key or a value written by
 * an older shape must not become a number by coercion.
 */
export async function readCachedDrift(env: Env): Promise<number | null> {
  const cached = await env.APP_KV.get(DRIFT_CACHE_KEY, "json");
  if (!cached || typeof cached !== "object") return null;
  const value = (cached as { drift?: unknown }).drift;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

/**
 * Stores the drift count for `DRIFT_CACHE_TTL_SECONDS`.
 *
 * An OBJECT rather than a bare number, so a later field can be added without
 * the stored shape being ambiguous between versions, which is the same reason
 * `CachedAnswer` is an object holding one string.
 */
export async function writeCachedDrift(env: Env, drift: number): Promise<void> {
  await env.APP_KV.put(DRIFT_CACHE_KEY, JSON.stringify({ drift }), {
    expirationTtl: DRIFT_CACHE_TTL_SECONDS,
  });
}

/**
 * Drops the cached drift count.
 *
 * Called by the paths that KNOW the number just changed, so the badge does not
 * spend up to the TTL disagreeing with an action the operator just took. A
 * delete rather than a write, because those paths know the number is stale and
 * do not necessarily know what it became.
 */
export async function dropCachedDrift(env: Env): Promise<void> {
  await env.APP_KV.delete(DRIFT_CACHE_KEY);
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
