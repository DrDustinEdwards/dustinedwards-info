import { getEnv } from "~/lib/context";

import type { Route } from "./+types/api.csp-report";

/**
 * The CSP violation sink. Phase B, Report-Only.
 *
 * **THIS IS A PUBLIC, UNAUTHENTICATED POST ENDPOINT.** It has to be: browsers
 * send violation reports with no credentials, and a report that needs a token
 * is a report nobody sends. So it is written as a sink that cannot be turned
 * into anything useful by an attacker, and the three limits below are the whole
 * of that argument.
 *
 * ## What it does with a report: LOGS IT
 *
 * Deliberately not D1. An unauthenticated endpoint that writes rows is a
 * storage-exhaustion primitive handed to the internet, and the observation
 * window this exists for is measured in days. `console.log` reaches Workers
 * observability and `wrangler tail`, which is where these are meant to be read.
 * If reports ever need to persist, that is a ruling with its own retention and
 * privacy questions, not a quiet schema change.
 *
 * ## Three limits, cheapest first, same ordering principle as the Ask guards
 *
 * 1. **Method.** Anything but POST is 405 and reads nothing.
 * 2. **Body cap, 8 KB.** Checked against `Content-Length` BEFORE the body is
 *    read, so an oversized report costs no memory. A real CSP report is a few
 *    hundred bytes; 8 KB is generous for the `report-to` batching format, which
 *    can carry several reports in one array.
 * 3. **Per-IP rate limit, 60 per 60 seconds**, on the existing `AskBudget`
 *    Durable Object under a `csp:<ip>` instance name. NO new class and no
 *    migration, exactly as the operator path reuses it under `op:<id>`.
 *
 * **Why 60 and not something tighter.** The deliverable here is the violation
 * report itself, and a page that trips ten rules sends ten reports; a limit
 * that silently ate them would make the observation window lie in the safe
 * direction, which is the worst direction for this particular endpoint. 60 is
 * enough for any real page and still bounds a flood.
 *
 * **Without `ASK_BUDGET` the endpoint refuses**, the same stance the Ask guards
 * and the operator path take: an unprotected public write path does not serve.
 *
 * Always answers 204 on the success path. A browser does not read the body and
 * an error status would only make it retry.
 */

/** Bytes. A real report is a few hundred; the batch format is still small. */
const MAX_BODY_BYTES = 8 * 1024;

const RATE_LIMIT = 60;
const RATE_PERIOD_SECONDS = 60;

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { allow: "POST", "cache-control": "private, no-store" },
    });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return new Response("Payload Too Large", {
      status: 413,
      headers: { "cache-control": "private, no-store" },
    });
  }

  const env = getEnv(context);
  if (!env.ASK_BUDGET) {
    // Not configured means not open, rather than open and unmetered.
    return new Response("Reporting unavailable", {
      status: 503,
      headers: { "cache-control": "private, no-store" },
    });
  }

  // `CF-Connecting-IP` is set by the edge and cannot be spoofed by the client,
  // which is why it is the key rather than anything in the body.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`csp:${ip}`));
  const { ok } = await limiter.hit(RATE_LIMIT, RATE_PERIOD_SECONDS);
  if (!ok) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        "retry-after": String(RATE_PERIOD_SECONDS),
        "cache-control": "private, no-store",
      },
    });
  }

  // Read AFTER the cap and the limiter, so a refused request never costs a read.
  let body = "";
  try {
    body = (await request.text()).slice(0, MAX_BODY_BYTES);
  } catch {
    body = "(unreadable)";
  }

  // One line, prefixed so it can be filtered out of the log stream. The report
  // is logged VERBATIM rather than parsed: both the legacy `report-uri` shape
  // and the `report-to` batch shape land here, and a parser that understood
  // only one would silently drop the other.
  console.log(`[csp-report] ${body}`);

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "private, no-store" },
  });
}

/**
 * A GET says what this is rather than 404ing, so anyone who finds it in a
 * header knows what they are looking at. It reveals nothing.
 */
export function loader() {
  return new Response("CSP violation report sink. POST only.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
  });
}
