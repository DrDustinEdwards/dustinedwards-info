/**
 * The only public endpoint that costs money per request, so guards run cheapest first: refuse,
 * then a cached answer, then the model.
 */

import {
  answerLeaksPrompt,
  askAvailable,
  askStream,
  citedSlugs,
  guardAnswerStream,
  replayCachedAnswer,
  teeForCache,
} from "~/lib/search/ask.server";
import {
  ASK_RATE_LIMIT_PERIOD_SECONDS,
  type CachedAnswer,
  checkAskRate,
  dropCachedAnswer,
  questionKey,
  readCachedAnswer,
  reserveAskBudget,
  writeCachedAnswer,
} from "~/lib/search/ask-guard.server";
import { ASK_ORIGIN_REFUSAL, originVerdict } from "~/lib/origin.mjs";
import { publiclyVisibleSlugs } from "~/db";
import { clientIp } from "~/lib/client-ip";
import { getEnv, getExecutionContext } from "~/lib/context";
import type { Route } from "./+types/search.ask";

/** Long enough for a real question, short enough that the model is not a toy. */
const MAX_QUESTION_LENGTH = 500;

/** An answer citing a post that is now a draft, deleted or scheduled forward must not be replayed. */
async function citationsStillPublic(env: Env, cached: CachedAnswer) {
  const slugs = citedSlugs(cached.chunks);
  if (slugs.length === 0) return true;
  const visible = await publiclyVisibleSlugs(env, slugs);
  return slugs.every((slug) => visible.has(slug));
}

function streamHeaders(cacheStatus: "hit" | "miss"): HeadersInit {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    // Edge caching would serve one reader's answer to another; the answer cache is ours, in KV.
    "cache-control": "no-store",
    // Nginx-style buffering proxies would otherwise defeat the streaming.
    "x-accel-buffering": "no",
    "x-ask-cache": cacheStatus,
  };
}

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

/**
 * GET is refused: a crawler, prefetch, `<img src>` or unfurler would bill it. 405 with `Allow`, not
 * 404, so the next caller does not reinvent the GET.
 */
export function loader() {
  return new Response("Ask takes POST.", {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  /*
   * First because it is free. A hostile page's thousand readers are a thousand IPs, each inside its
   * allowance; Origin is the field that page cannot control. An absent Origin is allowed: that client
   * spends its own bounded allowance.
   */
  const origin = originVerdict(request.headers.get("origin"), request.url);
  if (!origin.ok) {
    return new Response(ASK_ORIGIN_REFUSAL, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  const env = getEnv(context);

  // 404, not 503: with the binding absent Ask does not exist, rather than being down.
  if (!askAvailable(env)) {
    return new Response("Ask is not enabled.", { status: 404 });
  }

  const body = await request.formData();
  const question = String(body.get("q") ?? "").trim();

  if (!question) {
    return new Response("Missing q.", { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return new Response(`Question longer than ${MAX_QUESTION_LENGTH} characters.`, {
      status: 400,
    });
  }

  const ip = clientIp(request);

  // Gate 1, in front of the cache too: a cached answer is cheap, not free.
  const rate = await checkAskRate(env, ip);
  if (!rate.ok) {
    return refuse(rate.reason, rate.retryAfter);
  }

  const key = await questionKey(question);

  // A hit must still prove its citations are public: invalidation by KV `list` is eventually
  // consistent, so an answer can outlive an unpublish.
  const cached = await readCachedAnswer(env, key);
  if (cached) {
    if (await citationsStillPublic(env, cached)) {
      return new Response(replayCachedAnswer(cached), { headers: streamHeaders("hit") });
    }
    await dropCachedAnswer(env, key);
  }

  /*
   * Reserved here, the last point before the only line that costs money. No single-flight: an
   * attacker with N addresses spends N units with N different questions anyway.
   */
  const budget = await reserveAskBudget(env);
  if (!budget.ok) {
    return refuse(budget.reason, budget.retryAfter);
  }

  try {
    /* Guard first, then tee: the cache must store what the reader saw, including the guard's substitution. */
    const upstream = await askStream(env, question);
    const { toReader, captured } = teeForCache(
      guardAnswerStream(upstream, (slugs) => publiclyVisibleSlugs(env, slugs)),
    );

    getExecutionContext(context).waitUntil(
      (async () => {
        const answer = await captured;
        if (!answer) return;

        /*
         * A no-chunk answer is not cached, or "nothing found" would stick for a week after the answering post
         * publishes. A prompt echo is a successful injection; not caching it keeps it to one request.
         */
        if (answer.chunks.length === 0) return;
        if (answerLeaksPrompt(answer.answer)) {
          console.error("ask: refused to cache an answer that echoed the prompt");
          return;
        }
        await writeCachedAnswer(env, key, answer);
      })(),
    );

    return new Response(toReader, { headers: streamHeaders("miss") });
  } catch (error) {
    // The client treats any non-200 as "Ask is unavailable"; a 500 here would land on a page with real results.
    console.error("ask stream failed", error);
    return new Response("Ask is unavailable.", { status: 502 });
  }
}
