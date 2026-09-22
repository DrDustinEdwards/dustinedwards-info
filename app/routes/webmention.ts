import { countOpenWebmentions, receiveWebmention, webmentionTarget } from "~/db";
import { clientIp } from "~/lib/client-ip";
import { getEnv, getExecutionContext } from "~/lib/context";
import { readCapped } from "~/lib/read-capped.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { sourceVerdict, targetSlug } from "~/lib/webmention/urls.mjs";
import { verifyWebmention } from "~/lib/webmention/verify.server";

import type { Route } from "./+types/webmention";

/**
 * The webmention receiver.
 *
 * THE SECOND PUBLIC, UNAUTHENTICATED POST ENDPOINT ON THIS SITE, and the first that writes a row. It
 * has to be public: a webmention is sent by another site's server with no credential to offer.
 * `api.csp-report.ts` refuses to write rows because an unauthenticated endpoint that writes them is
 * a storage-exhaustion primitive handed to the internet. This one cannot log instead, because the
 * deliverable IS the stored mention, so the argument is answered rather than avoided.
 *
 * FOUR BOUNDS, AND THEY ARE THE WHOLE ANSWER:
 *
 * 1. Per-IP rate, on the existing `AskBudget` object under a `wm:<ip>` instance.
 * 2. The target must already be a publicly visible post here, read through the DB chokepoint.
 * 3. One row per (source, target), a unique index, so a re-send UPDATES and repetition costs nothing.
 * 4. A global cap on open rows, answered 503. This is the bound that does not depend on the other
 *    three being right, and it is what makes the storage claim a fact rather than an argument.
 *
 * WITHOUT `ASK_BUDGET` THIS DOES NOT SERVE, the stance every metered path here takes.
 *
 * IT RENDERS NOTHING. An accepted mention reaches `unverified`, then `pending` if the source really
 * links here, and stops; approval is a human action.
 *
 * IT STORES NO IP ADDRESS. The limiter's counter expires with its window, and the row carries only
 * what the sender's own page says.
 */

/**
 * Bytes. Two short URLs in a form encoding. A real webmention is well under
 * 500 bytes and 4 KB is generous for a sender that percent-encodes heavily.
 */
const MAX_BODY_BYTES = 4 * 1024;

const RATE_LIMIT = 20;
const RATE_PERIOD_SECONDS = 60;

/**
 * The ceiling on `unverified` plus `pending` rows. The fourth bound.
 *
 * WHY IT IS SMALL: a higher number buys a real sender nothing on a personal site and only raises the
 * storage an attacker who defeats bounds 1 to 3 can take. The refusal is RECOVERABLE by the action
 * that was needed anyway, which is the admin moderating the queue.
 *
 * A 503 rather than a 429, because the condition is about this site's state rather than the caller's
 * rate, and a well-behaved sender retrying later is the right response.
 */
const OPEN_QUEUE_CAP = 500;

/** Every refusal and the success both carry it. A queue answer is never shared. */
const NO_STORE = "private, no-store";

/**
 * WHAT A REFUSED SENDER IS TOLD, and it is deliberately one string for four different target
 * problems. Especially the draft: a distinct message would turn this endpoint into an oracle for
 * unpublished slugs, which is hard rule 1's leak arriving through a 400 instead of through a page.
 */
const BAD_TARGET = "target must be a published post on this site";

const BAD_FORM = "send application/x-www-form-urlencoded with source and target";

/**
 * The origins this site answers on, for both the target and the source checks. TWO RATHER THAN
 * ONE: the site is pre-cutover, so pinning to a constant would refuse every real request from
 * whichever host is not the constant at exactly the moment of the move. `app/lib/origin.mjs` makes
 * the argument at length.
 */
function siteOrigins(request: Request): string[] {
  try {
    return [...new Set([SITE_ORIGIN, new URL(request.url).origin])];
  } catch {
    // An unparseable request URL cannot widen the set, so it does not.
    return [SITE_ORIGIN];
  }
}

/** Every response from this route. One construction site, like the health route. */
function answer(body: string, status: number, extra: HeadersInit = {}): Response {
  const headers = new Headers({
    "content-type": "text/plain; charset=utf-8",
    "cache-control": NO_STORE,
  });
  for (const [name, value] of new Headers(extra)) headers.set(name, value);
  return new Response(body, { status, headers });
}

export async function action({ request, context }: Route.ActionArgs) {
  // 1. Method. Reads nothing.
  if (request.method !== "POST") {
    return answer("Method Not Allowed", 405, { allow: "POST" });
  }

  /*
   * CONTENT-LENGTH IS A HINT FROM THE CLIENT, so it refuses early and never permits. An honest
   * oversized header is rejected without touching the body; a missing or lying one falls through to
   * `readCapped`, which counts the bytes as they arrive.
   */
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return answer("Payload Too Large", 413);
  }

  const env = getEnv(context);
  if (!env.ASK_BUDGET) {
    // Not configured means not open, rather than open and unmetered.
    return answer("Webmentions unavailable", 503);
  }

  /*
   * THE RATE LIMIT PRECEDES THE BODY READ. Every check below it costs something: a materialized
   * body, a form parse, a D1 read. The limiter costs one Durable Object call and is the only thing
   * here that bounds how often the rest can be reached, which is hard rule 19's chain applied to this
   * route: each stage refuses before the next spends anything.
   *
   * Keyed on the edge-set client IP rather than anything in the body, which the caller controls.
   */
  const ip = clientIp(request);
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`wm:${ip}`));
  const { ok: withinRate } = await limiter.hit(RATE_LIMIT, RATE_PERIOD_SECONDS);
  if (!withinRate) {
    return answer("Too Many Requests", 429, { "retry-after": String(RATE_PERIOD_SECONDS) });
  }

  /*
   * THE FORM ENCODING, checked on the HEADER before the body is read, because it is free there. The
   * protocol specifies this one encoding, so accepting JSON as well would be inventing a dialect
   * nobody sends and giving the parser a second shape to be wrong about.
   */
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

  /*
   * 5. THE TARGET, and the second bound. Shape first, because it is decidable
   * from the string and a D1 read is not free; then the row, because a slug
   * that parses is not a post.
   */
  const origins = siteOrigins(request);
  const slug = targetSlug(target, origins);
  if (slug === null) {
    return answer(BAD_TARGET, 400);
  }

  // 6. The source. Refused before anything is written, so a URL this Worker
  // will not fetch never becomes a row it has to sweep.
  const verdict = sourceVerdict(source, target, origins);
  if (!verdict.ok) {
    return answer(verdict.reason, 400);
  }

  /*
   * THE VISIBILITY READ, AFTER the source check on purpose. Both are refusals; only this one costs a
   * query, and a caller sending garbage sources should not be able to make this site read D1 for each
   * one. A draft, a scheduled post and a slug that names nothing are one answer.
   */
  if (!(await webmentionTarget(env, slug))) {
    return answer(BAD_TARGET, 400);
  }

  /*
   * THE GLOBAL CAP, the fourth bound, read immediately before the write it guards. It is a count and
   * not a reservation, so two requests arriving together can both pass at the boundary. That is
   * accepted and stated rather than papered over: the failure is one row past a cap chosen with an
   * order of magnitude of headroom, and the alternative is a second Durable Object.
   */
  const open = await countOpenWebmentions(env);
  if (open >= OPEN_QUEUE_CAP) {
    console.log(
      `[webmention] refused at the open-queue cap: ${open} of ${OPEN_QUEUE_CAP} ` +
        `unverified or pending. Moderate /admin/mentions to reopen the endpoint.`,
    );
    return answer("Webmention queue is full, please retry later", 503);
  }

  // 8. The row, as `unverified`. Nothing about this is a claim yet.
  const id = await receiveWebmention(env, { sourceUrl: source, targetSlug: slug });

  /*
   * VERIFICATION AFTER THE ANSWER. The sender gets 202 immediately, which is what the protocol asks
   * for and what keeps a slow source off the critical path. `waitUntil` rather than a queue, which
   * would be new infrastructure for a load of zero. What a cut-short `waitUntil` leaves behind is on
   * `verifyWebmention`.
   */
  getExecutionContext(context).waitUntil(verifyWebmention(env, id, source, target));

  return answer("Accepted. It will be verified and reviewed before it appears.", 202);
}

/**
 * A GET says what this is rather than 404ing, so anyone who finds the endpoint knows what they are
 * looking at. It reveals nothing: the text is true of every webmention receiver on the internet.
 */
export function loader() {
  return answer(
    "Webmention endpoint. POST source and target as application/x-www-form-urlencoded.",
    200,
  );
}
