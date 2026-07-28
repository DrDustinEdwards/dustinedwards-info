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
 */

import { askAvailable, askStream } from "~/lib/search/ask.server";
import { getEnv } from "~/lib/context";
import type { Route } from "./+types/search.ask";

/** Long enough for a real question, short enough that the model is not a toy. */
const MAX_QUESTION_LENGTH = 500;

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

  try {
    const stream = await askStream(env, question);
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        // An answer is generated per request and bills Workers AI per call.
        // Caching it at the edge would serve one reader's answer to another.
        "cache-control": "no-store",
        // Nginx-style buffering proxies would otherwise defeat the streaming.
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    // The instance being unreachable must not surface as a 500 on a page that
    // already rendered its real results. The client treats any non-200 as
    // "Ask is unavailable" and removes the panel.
    console.error("ask stream failed", error);
    return new Response("Ask is unavailable.", { status: 502 });
  }
}
