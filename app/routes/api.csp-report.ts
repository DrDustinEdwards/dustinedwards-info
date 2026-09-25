import { readCapped } from "~/lib/read-capped.mjs";
import { clientIp } from "~/lib/client-ip";
import { getEnv } from "~/lib/context";

import type { Route } from "./+types/api.csp-report";

/**
 * A public, unauthenticated POST sink: browsers send reports without credentials. It logs and
 * never writes D1, which would hand the internet a storage-exhaustion primitive. The limit is
 * loose because a page tripping ten rules sends ten. Always 204: an error status makes browsers retry.
 */

/** Bytes. A real report is a few hundred. */
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

  /* Content-Length is a client hint: used to refuse early, never to permit. */
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return new Response("Payload Too Large", {
      status: 413,
      headers: { "cache-control": "private, no-store" },
    });
  }

  const env = getEnv(context);
  if (!env.ASK_BUDGET) {
    return new Response("Reporting unavailable", {
      status: 503,
      headers: { "cache-control": "private, no-store" },
    });
  }

  // Keyed on the edge-set client IP, not the body, which the client controls.
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

  /* `request.text()` materializes the whole body before a slice, so `readCapped` stops the stream at the cap. */
  let capped: string | null;
  try {
    capped = await readCapped(request, MAX_BODY_BYTES);
  } catch (error) {
    // Logged and still 204, the rule above: a 500 here would make the browser send the report again.
    console.error(
      `[csp-report] body unreadable: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "private, no-store" },
    });
  }
  if (capped === null) {
    return new Response("Payload Too Large", {
      status: 413,
      headers: { "cache-control": "private, no-store" },
    });
  }
  const body = capped;

  // JSON-encoded so a body with newlines cannot forge log lines. Unparsed: both the report-uri and
  // report-to shapes land here.
  console.log(`[csp-report] ${JSON.stringify(body)}`);

  return new Response(null, {
    status: 204,
    headers: { "cache-control": "private, no-store" },
  });
}

export function loader() {
  return new Response("CSP violation report sink. POST only.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
  });
}
