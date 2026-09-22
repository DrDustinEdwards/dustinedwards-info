import { readCapped } from "~/lib/read-capped.mjs";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";

import type { Route } from "./+types/api.csp-report";

/**
 * The CSP violation sink. Under enforcement a report means something was BLOCKED.
 *
 * **THIS IS A PUBLIC, UNAUTHENTICATED POST ENDPOINT.** It has to be: browsers send reports with no
 * credentials, and a report that needs a token is a report nobody sends. So it is written as a sink
 * that cannot be turned into anything useful, and the limits below are the whole of that argument.
 *
 * **It LOGS the report and deliberately does not write D1.** An unauthenticated endpoint that writes
 * rows is a storage-exhaustion primitive handed to the internet. Persisting reports is a ruling with
 * its own retention and privacy questions, not a quiet schema change.
 *
 * Three limits, cheapest first: METHOD, anything but POST is 405 and reads nothing; a BODY CAP
 * checked against `Content-Length` before the body is read; and a PER-IP RATE LIMIT on the existing
 * `AskBudget` Durable Object under `csp:<ip>`, no new class and no migration.
 *
 * **The limit is deliberately loose**, because the deliverable here is the report itself and a page
 * that trips ten rules sends ten. A limit that silently ate them would make the observation window
 * lie in the safe direction, which is the worst direction for this endpoint.
 *
 * **Without `ASK_BUDGET` the endpoint refuses**: an unprotected public write path does not serve.
 * Always 204 on success, because a browser does not read the body and an error status makes it
 * retry.
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

  /*
   * CONTENT-LENGTH IS A HINT FROM THE CLIENT, so it is used to refuse early and NEVER to permit. An
   * honest oversized header is rejected here without touching the body; a missing or lying one falls
   * through to `readCapped` below, which counts the bytes as they arrive.
   */
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
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

  // Keyed on the edge-set client IP rather than anything in the body, which
  // the client controls. One statement of the read: app/lib/client-ip.ts.
  const ip = clientIp(request);
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

  /*
   * READ THE STREAM AND STOP AT THE CAP. `request.text()` materializes the whole body before a
   * `.slice()` can shorten it, so a slice bounds what is LOGGED and never what is RECEIVED.
   * `readCapped` cancels the stream the moment the count crosses the limit, so a client that omits or
   * understates Content-Length gets the same treatment as one that declares it honestly.
   */
  const capped = await readCapped(request, MAX_BODY_BYTES);
  if (capped === null) {
    return new Response("Payload Too Large", {
      status: 413,
      headers: { "cache-control": "private, no-store" },
    });
  }
  const body = capped;

  // One line, prefixed so it can be filtered out of the log stream, and JSON-encoded so a body
  // containing newlines cannot forge additional lines past the [csp-report] prefix. The body stays
  // UNPARSED: both the legacy report-uri shape and the report-to batch shape land here, and a parser
  // that understood only one would silently drop the other.
  console.log(`[csp-report] ${JSON.stringify(body)}`);

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
