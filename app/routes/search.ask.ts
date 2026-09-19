/**
 * Ask mode's streaming endpoint. Search Layer 2.
 *
 * A RESOURCE ROUTE, deliberately: it has no default export, so it may return a raw Response.
 *
 * NOTHING ELSE ON THE SITE WAITS ON THIS. It is fetched by the Ask panel after classic results have
 * rendered, and only when the server said the binding exists. With scripting off nothing requests it.
 *
 * This is the only public endpoint on the site that costs money per request, so it is the only one
 * with guards in front of it, cheapest-first: refuse before spending, serve a cached answer before
 * generating, and only then reach the model.
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

/**
 * Whether every post a cached answer cites is still publicly visible. An answer with no resolvable
 * citations passes, since it cited nothing this site owns. An answer citing a post that is now a
 * draft, deleted or scheduled forward fails and MUST NOT BE REPLAYED.
 */
async function citationsStillPublic(env: Env, cached: CachedAnswer) {
  // `citedSlugs` is the one reading of the chunk shape, shared with the live
  // guard. This path and that one had two readings and only this one existed.
  const slugs = citedSlugs(cached.chunks);
  if (slugs.length === 0) return true;
  const visible = await publiclyVisibleSlugs(env, slugs);
  return slugs.every((slug) => visible.has(slug));
}

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

/**
 * GET IS REFUSED, EXPLICITLY. This endpoint spends money and per-IP budget, so it must not be
 * reachable by anything that follows a URL on its own initiative: a crawler, a prefetch, an
 * `<img src>` on any site, a preview unfurler. A GET that bills is a side-effecting GET, and the
 * method is the only part of that a third party cannot choose for us.
 *
 * 405 with `Allow` rather than 404: the endpoint exists, the method is wrong, and saying so is what
 * stops the next caller reinventing the GET.
 */
export function loader() {
  return new Response("Ask takes POST.", {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  /*
   * GATE 0, AND IT IS FIRST BECAUSE IT IS FREE. One header read, no env, no body, no binding.
   *
   * A foreign page cannot be allowed to spend the shared Ask budget using its own readers' browsers,
   * and the per-IP limiter cannot see that attack at all: a thousand readers of one hostile page are a
   * thousand addresses, each well inside its own allowance. Origin is the one field on a cross-site
   * POST the attacking page does not control.
   *
   * ABSENT Origin is ALLOWED: a client that sends none is spending its own address's allowance, which
   * is already bounded, and refusing it would break a no-script form without buying anything.
   */
  const origin = originVerdict(request.headers.get("origin"), request.url);
  if (!origin.ok) {
    return new Response(ASK_ORIGIN_REFUSAL, {
      status: 403,
      headers: { "cache-control": "no-store" },
    });
  }

  const env = getEnv(context);

  // 404 rather than 503. With the binding absent this endpoint does not exist, which is the same
  // story the rest of the site tells: Ask is absent, not broken. A 503 would imply something is meant
  // to be here and is down.
  if (!askAvailable(env)) {
    return new Response("Ask is not enabled.", { status: 404 });
  }

  /*
   * The question travels in a FORM-ENCODED BODY, which is what an ordinary `<form method="post">`
   * sends. Ask has no no-script form today, but reading the body this way means adding one later is
   * markup and nothing else.
   */
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

  // The edge-set client IP; one statement of the read and its fallback in
  // app/lib/client-ip.ts.
  const ip = clientIp(request);

  // Gate 1, per IP. In front of everything, including the cache: a cached answer is cheap but not
  // free. NOTHING PAST THIS LINE HAS TOUCHED WORKERS AI.
  const rate = await checkAskRate(env, ip);
  if (!rate.ok) {
    return refuse(rate.reason, rate.retryAfter);
  }

  const key = await questionKey(question);

  // Gate 2, the cache. A hit is one KV read, reaches no model, consumes no budget, and is replayed
  // in the same SSE shape so the client cannot tell a replay from a generation.
  //
  // A HIT MUST STILL PROVE ITS CITATIONS ARE PUBLIC. The cache is dropped on publish by a KV `list`,
  // which is eventually consistent, so an answer written moments before a post is unpublished can
  // survive the invalidation meant to remove it.
  //
  // Checked on REPLAY rather than at write time, because the corpus can change after the answer is
  // already in KV. One indexed D1 read buys the property that no unpublished post is citable.
  const cached = await readCachedAnswer(env, key);
  if (cached) {
    if (await citationsStillPublic(env, cached)) {
      return new Response(replayCachedAnswer(cached), { headers: streamHeaders("hit") });
    }
    // Stale against the corpus it cited. Drop it rather than serve it, and fall
    // through to a fresh generation, which will cite only what is public now.
    await dropCachedAnswer(env, key);
  }

  /*
   * Gate 3, the exact daily ceiling. Reserved here and nowhere else, because this is the last point
   * before the only line in the file that costs money.
   *
   * THERE IS DELIBERATELY NO SINGLE-FLIGHT. Concurrent misses of one question each reserve and each
   * generate, and the bound is what makes that acceptable: deduplicating does not lower the worst
   * case, since an attacker with N addresses spends the same N units asking N DIFFERENT questions.
   *
   * What it would recover is duplicated work in the benign case, for one generation's window, at the
   * cost of a Durable Object instance per distinct question and a follower that must block.
   */
  const budget = await reserveAskBudget(env);
  if (!budget.ok) {
    return refuse(budget.reason, budget.retryAfter);
  }

  try {
    /*
     * GUARD FIRST, THEN TEE, and the order is the whole point. The guard can replace a zero-chunk
     * generation with the no-answer text, and the cache has to accumulate what the READER saw. Teeing
     * first would store the model's original while showing the reader the substitution.
     */
    const upstream = await askStream(env, question);
    const { toReader, captured } = teeForCache(
      guardAnswerStream(upstream, (slugs) => publiclyVisibleSlugs(env, slugs)),
    );

    // After the reader has their bytes. Caching is bookkeeping and a reader
    // never waits for bookkeeping.
    getExecutionContext(context).waitUntil(
      (async () => {
        const answer = await captured;
        if (!answer) return;

        /*
         * TWO REFUSALS, and neither is the other's backstop.
         *
         * An answer with NO CHUNKS was not drawn from this site. The guard has already replaced it for the
         * reader, and caching the substitution would make "I could not find anything" the permanent answer
         * for a week, including after the post that answers it is published.
         *
         * An answer that ECHOES THE PROMPT is a successful injection. Not caching it is what keeps the blast
         * radius at the one request that performed it, rather than serving it from KV to everyone who asks
         * the same thing.
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
    // The instance being unreachable must not surface as a 500 on a page that already rendered its
    // real results. The client treats any non-200 as "Ask is unavailable" and removes the panel.
    console.error("ask stream failed", error);
    return new Response("Ask is unavailable.", { status: 502 });
  }
}
