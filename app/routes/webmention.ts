import {
  countOpenWebmentions,
  receiveWebmention,
  recordWebmentionVerdict,
  webmentionTarget,
} from "~/db";
import { clientIp } from "~/lib/client-ip";
import { getEnv, getExecutionContext } from "~/lib/context";
import { readCapped } from "~/lib/read-capped.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { sourceVerdict, targetSlug } from "~/lib/webmention/urls.mjs";

import type { Route } from "./+types/webmention";

/**
 * Public by necessity, and it writes rows, so four bounds: a per-IP rate, a publicly visible target,
 * one row per (source, target), and a global cap on open rows. It stores no IP address.
 */

/** Bytes. A real webmention is well under 500; 4 KB allows heavy percent-encoding. */
const MAX_BODY_BYTES = 4 * 1024;

const RATE_LIMIT = 20;
const RATE_PERIOD_SECONDS = 60;

/**
 * Small: a higher cap buys a real sender nothing and raises what an attacker can store. 503, not
 * 429: the condition is this site's state, not the caller's rate.
 */
const OPEN_QUEUE_CAP = 500;

const NO_STORE = "private, no-store";

/** One string for every target problem: a distinct message for a draft would be an oracle for unpublished slugs. */
const BAD_TARGET = "target must be a published post on this site";

const BAD_FORM = "send application/x-www-form-urlencoded with source and target";

/** Two origins, not one: pre-cutover, pinning a constant would refuse the other host at the moment of the move. */
function siteOrigins(request: Request): string[] {
  try {
    return [...new Set([SITE_ORIGIN, new URL(request.url).origin])];
  } catch {
    return [SITE_ORIGIN];
  }
}

function answer(body: string, status: number, extra: HeadersInit = {}): Response {
  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    "cache-control": NO_STORE,
  });
  for (const [name, value] of new Headers(extra)) headers.set(name, value);
  return new Response(body, { status, headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return answer("Method Not Allowed", 405, { allow: "POST" });
  }

  /* Content-Length is a client hint: used to refuse early, never to permit. */
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return answer("Payload Too Large", 413);
  }

  const env = getEnv(context);
  if (!env.ASK_BUDGET) {
    return answer("Webmentions unavailable", 503);
  }

  /* The rate limit precedes the body read: every check below it costs something. */
  const ip = clientIp(request);
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`wm:${ip}`));
  const { ok: withinRate } = await limiter.hit(RATE_LIMIT, RATE_PERIOD_SECONDS);
  if (!withinRate) {
    return answer("Too Many Requests", 429, { "retry-after": String(RATE_PERIOD_SECONDS) });
  }

  /* Checked on the header, where it is free. The protocol specifies only this encoding. */
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return answer(BAD_FORM, 400);
  }

  const body = await readCapped(request, MAX_BODY_BYTES);
  if (body === null) {
    return answer("Payload Too Large", 413);
  }

  const fields = new URLSearchParams(body);
  const source = fields.get("source") ?? "";
  const target = fields.get("target") ?? "";
  if (!source || !target) {
    return answer(BAD_FORM, 400);
  }

  const origins = siteOrigins(request);
  const slug = targetSlug(target, origins);
  if (slug === null) {
    return answer(BAD_TARGET, 400);
  }

  // Refused before anything is written, so a URL this Worker will not fetch never becomes a row.
  const verdict = sourceVerdict(source, target, origins);
  if (!verdict.ok) {
    return answer(verdict.reason, 400);
  }

  /* After the source check: only this costs a query, so garbage sources cannot make this site read D1. */
  if (!(await webmentionTarget(env, slug))) {
    return answer(BAD_TARGET, 400);
  }

  /* A count, not a reservation: two concurrent requests can both pass at the boundary, one row past the cap. */
  const open = await countOpenWebmentions(env);
  if (open >= OPEN_QUEUE_CAP) {
    console.log(
      `[webmention] refused at the open-queue cap: ${open} of ${OPEN_QUEUE_CAP} ` +
        `unverified or pending. Moderate /admin/mentions to reopen the endpoint.`,
    );
    return answer("Webmention queue is full, please retry later", 503);
  }

  const id = await receiveWebmention(env, { sourceUrl: source, targetSlug: slug });

  /*
   * 202 first, verification in `waitUntil`. Imported here, not at the top: linkedom has no place in
   * the chunk every cold isolate evaluates.
   */
  getExecutionContext(context).waitUntil(
    import("~/lib/webmention/verify.server")
      .then(({ verifyWebmention }) => verifyWebmention(env, id, source, target))
      /* `verifyWebmention` never throws, so this is the chunk failing to load: the row is failed, not left counting toward the cap. */
      .catch(async (error: unknown) => {
        console.error(
          JSON.stringify({
            alert: "webmention-verify-load-failed",
            id,
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
        await recordWebmentionVerdict(env, id, { status: "failed", failureReason: "fetch-error" });
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            alert: "webmention-verdict-write-failed",
            id,
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      }),
  );

  return answer("Accepted. It will be verified and reviewed before it appears.", 202);
}

export function loader() {
  return answer(
    "Webmention endpoint. POST source and target as application/x-www-form-urlencoded.",
    200,
  );
}
