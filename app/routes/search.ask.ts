/**
 * Ask mode's streaming endpoint. Search Layer 2.
 *
 * A RESOURCE ROUTE, deliberately: it has no default export, so it is allowed to
 * return a raw Response. A document route's loader cannot, which is the same
 * constraint that put /search's JSON negotiation in middleware.
 *
 * NOTHING ELSE ON THE SITE WAITS ON THIS. It is fetched by the Ask panel after
 * classic results have already rendered, and it is only fetched at all when the
 * server said the binding exists. With scripting off nothing requests it.
 *
 * This is the only public endpoint on the site that costs money per request, so
 * it is also the only one with guards in front of it. Order matters and is
 * cheapest-first: refuse before spending, serve a cached answer before
 * generating, and only then reach the model. See ask-guard.server.ts.
 */

import { askAvailable, askStream, replayCachedAnswer, teeForCache } from "~/lib/search/ask.server";
import {
  ASK_RATE_LIMIT_PERIOD_SECONDS,
  checkAskRate,
  questionKey,
  readCachedAnswer,
  reserveAskBudget,
  writeCachedAnswer,
} from "~/lib/search/ask-guard.server";
import { getEnv, getExecutionContext } from "~/lib/context";
import type { Route } from "./+types/search.ask";

/** Long enough for a real question, short enough that the model is not a toy. */
const MAX_QUESTION_LENGTH = 500;

/** Streaming headers. Never cached at the edge: an answer is per request. */
function streamHeaders(cacheStatus: "hit" | "miss"): HeadersInit {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    // Edge caching would serve one reader's answer to another. The answer cache
    // is ours, in KV, keyed by the question rather than by the URL.
    "cache-control": "no-store",
    // Nginx-style buffering proxies would otherwise defeat the streaming.
    "x-accel-buffering": "no",
    // Observable from outside, which is what makes the cache testable by attack
    // rather than by reading the code.
    "x-ask-cache": cacheStatus,
  };
}

/** A refusal that costs no AI call. 503 only when the guards are missing. */
function refuse(reason: string | undefined, retryAfter: number | undefined): Response {
  const body =
    reason === "budget"
      ? "Ask has answered its budget of questions for today. Classic search is unaffected."
      : reason === "unprotected"
        ? "Ask is unavailable."
        : "Too many questions. Try again shortly.";
  return new Response(body, {
    status: reason === "unprotected" ? 503 : 429,
    headers: {
      "retry-after": String(retryAfter ?? ASK_RATE_LIMIT_PERIOD_SECONDS),
      "cache-control": "no-store",
    },
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  // 404 rather than 503. With the binding absent this endpoint does not exist,
  // which is the same story the rest of the site tells: Ask is absent, not
  // broken. A 503 would imply something is meant to be here and is down.
  if (!askAvailable(env)) {
    return new Response("Ask is not enabled.", { status: 404 });
  }

  const url = new URL(request.url);
  const question = (url.searchParams.get("q") ?? "").trim();

  if (!question) {
    return new Response("Missing q.", { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return new Response(`Question longer than ${MAX_QUESTION_LENGTH} characters.`, {
      status: 400,
    });
  }

  // `cf-connecting-ip` is set by Cloudflare on every request that reaches a
  // Worker and cannot be spoofed by the client. The fallback keys every
  // unknown-origin request together, which is strict rather than lax: it means
  // they share one bucket instead of each getting their own.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

  // Gate 1, per IP. In front of everything, including the cache: a cached
  // answer is cheap but not free, and hammering for cached answers is still
  // abuse. NOTHING past this line has touched Workers AI.
  const rate = await checkAskRate(env, ip);
  if (!rate.ok) {
    return refuse(rate.reason, rate.retryAfter);
  }

  const key = await questionKey(question);

  // Gate 2, the cache. A hit is one KV read. It does not reach the model and
  // does not consume budget, and it is replayed in the same SSE shape so the
  // client cannot tell a replay from a generation.
  const cached = await readCachedAnswer(env, key);
  if (cached) {
    return new Response(replayCachedAnswer(cached), { headers: streamHeaders("hit") });
  }

  // Gate 3, the exact daily ceiling. Reserved here and nowhere else, because
  // this is the last point before the only line in the file that costs money.
  const budget = await reserveAskBudget(env);
  if (!budget.ok) {
    return refuse(budget.reason, budget.retryAfter);
  }

  try {
    const upstream = await askStream(env, question);
    const { toReader, captured } = teeForCache(upstream);

    // After the reader has their bytes. Caching is bookkeeping and a reader
    // never waits for bookkeeping.
    getExecutionContext(context).waitUntil(
      (async () => {
        const answer = await captured;
        if (answer) await writeCachedAnswer(env, key, answer);
      })(),
    );

    return new Response(toReader, { headers: streamHeaders("miss") });
  } catch (error) {
    // The instance being unreachable must not surface as a 500 on a page that
    // already rendered its real results. The client treats any non-200 as
    // "Ask is unavailable" and removes the panel.
    console.error("ask stream failed", error);
    return new Response("Ask is unavailable.", { status: 502 });
  }
}
