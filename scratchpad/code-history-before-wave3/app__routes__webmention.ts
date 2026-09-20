import { countOpenWebmentions, receiveWebmention, webmentionTarget } from "~/db";
import { clientIp } from "~/lib/client-ip";
import { getEnv, getExecutionContext } from "~/lib/context";
import { readCapped } from "~/lib/read-capped.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { sourceVerdict, targetSlug } from "~/lib/webmention/urls.mjs";
import { verifyWebmention } from "~/lib/webmention/verify.server";

import type { Route } from "./+types/webmention";

/**
 * The webmention receiver. Item H1.
 *
 * **THIS IS THE SECOND PUBLIC, UNAUTHENTICATED POST ENDPOINT ON THIS SITE, and
 * the first one that writes a row.** It has to be public: a webmention is sent
 * by another site's server with no credential to offer, and an endpoint that
 * needs a token is an endpoint nobody sends to.
 *
 * ## THE ARGUMENT IT HAS TO ANSWER
 *
 * `app/routes/api.csp-report.ts` refuses to write rows and says why: "an
 * unauthenticated endpoint that writes rows is a storage-exhaustion primitive
 * handed to the internet". That is correct and it is the reason that endpoint
 * logs instead. This one cannot log instead, because the deliverable IS the
 * stored mention, so the argument has to be answered rather than avoided.
 *
 * ## FOUR BOUNDS, AND THEY ARE THE WHOLE ANSWER
 *
 * 1. **Per-IP rate, 20 per 60 seconds**, on the existing `AskBudget` Durable
 *    Object under a `wm:<ip>` instance name. No new class and no migration,
 *    exactly as the CSP sink, the operator path, the smoke credential and
 *    `/api/health` reuse it. This bounds the RATE.
 * 2. **The target must already be a publicly visible post here.** Not a URL
 *    shape, not a slug that parses: a row that `publiclyVisible()` admits,
 *    read through `webmentionTarget` in the DB chokepoint. So the set of
 *    accepted targets is the published corpus, which is a number this site
 *    controls entirely.
 * 3. **One row per (source, target)**, a unique index, and a re-sent mention
 *    UPDATES rather than inserting. So repetition costs nothing: the table's
 *    size is the corpus times the number of distinct pages that link to it,
 *    not a function of how many times anybody presses send.
 * 4. **A global cap on open rows.** At or above `OPEN_QUEUE_CAP` mentions in
 *    `unverified` or `pending`, this answers 503 and logs one line. This is the
 *    bound that does not depend on the other three being right, and it is the
 *    one that makes the storage claim a fact rather than an argument: the table
 *    cannot pass the cap plus whatever the admin has already approved.
 *
 * Together those are a bounded table filled at a bounded rate from a bounded
 * set of targets. Bound 4 alone would be enough to refuse the exhaustion; the
 * other three are what keep the endpoint USEFUL while it is refusing, which is
 * the property a cap on its own does not have.
 *
 * **Without `ASK_BUDGET` this does not serve.** The stance the Ask guards, the
 * CSP sink, `/api/health` and the operator path all take: an unprotected public
 * write path does not serve unmetered, it does not serve.
 *
 * ## WHAT IT DOES NOT DO
 *
 * It does not render anything. An accepted mention reaches `unverified`, then
 * `pending` if the source really links here, and stops. Approval is a human
 * action in `/admin/mentions`, and even an approved row has no public effect in
 * H1: rendering under the post, cache invalidation on approve, and advertising
 * this endpoint are all H2. A mention cannot reach a reader from this commit.
 *
 * It stores NO IP ADDRESS. The rate limiter's counter is keyed on one and
 * expires with its window; the row carries the sender's published URL, a name
 * from their h-card, and a sentence of their own prose. `/privacy` says exactly
 * that.
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
 * **WHY 500 AND NOT SOMETHING LARGER.** This is a personal site with a corpus
 * in the low dozens. Five hundred unmoderated mentions is already far past what
 * one person will ever work through in a sitting, so a higher number would not
 * buy a real sender anything; it would only raise the amount of storage an
 * attacker who defeats bounds 1 through 3 can take. And the refusal is
 * RECOVERABLE by the one action that was needed anyway: the admin moderating
 * the queue drops the count below the cap.
 *
 * A 503 rather than a 429, because the condition is about this site's state
 * rather than about the caller's rate, and a well-behaved sender retrying later
 * is exactly the right response to it.
 */
const OPEN_QUEUE_CAP = 500;

/** Every refusal and the success both carry it. A queue answer is never shared. */
const NO_STORE = "private, no-store";

/**
 * WHAT A REFUSED SENDER IS TOLD, and it is deliberately one string for four
 * different target problems.
 *
 * An unparseable URL, a foreign origin, a path that is not a post, a slug that
 * is not a slug, and a slug that names a DRAFT all answer with this. Especially
 * the draft: a distinct message would turn this endpoint into an oracle for
 * unpublished slugs, which is hard rule 1's leak arriving through a 400 instead
 * of through a page.
 */
const BAD_TARGET = "target must be a published post on this site";

const BAD_FORM = "send application/x-www-form-urlencoded with source and target";

/**
 * The origins this site answers on, for both the target and the source checks.
 *
 * TWO RATHER THAN ONE, and `app/lib/origin.mjs` makes the argument at length:
 * the site is pre-cutover, `SITE_ORIGIN` is workers.dev today and the apex
 * later, and pinning to a constant refuses every real request from whichever
 * host is not the constant at exactly the moment of the move. `SITE_ORIGIN` is
 * the origin a sender READ off a canonical link; the request's own origin is
 * where their POST arrived.
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
   * 2. CONTENT-LENGTH IS A HINT FROM THE CLIENT, so it refuses early and never
   * permits. An honest oversized header is rejected without touching the body;
   * a missing or lying one falls through to `readCapped` below, which counts
   * the bytes as they arrive. The grounds are `app/lib/read-capped.mjs`, which
   * records the three ways the old Content-Length-only cap failed.
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
   * 3. THE RATE LIMIT PRECEDES THE BODY READ, which is a change of order from
   * the letters this was specified in and is deliberate. Every check below it
   * costs something: a materialised body, a form parse, a D1 read. The
   * limiter's decision costs one Durable Object call and is the only thing here
   * that bounds how often the rest can be reached at all, so it goes first
   * among the things that can refuse a well-formed request. Same ordering
   * principle as hard rule 19's chain: each stage refuses before the next
   * spends anything.
   *
   * Keyed on the edge-set client IP rather than anything in the body, which the
   * caller controls. One statement of the read: `app/lib/client-ip.ts`.
   */
  const ip = clientIp(request);
  const limiter = env.ASK_BUDGET.get(env.ASK_BUDGET.idFromName(`wm:${ip}`));
  const { ok: withinRate } = await limiter.hit(RATE_LIMIT, RATE_PERIOD_SECONDS);
  if (!withinRate) {
    return answer("Too Many Requests", 429, { "retry-after": String(RATE_PERIOD_SECONDS) });
  }

  /*
   * 4. THE FORM ENCODING, checked on the HEADER before the body is read,
   * because it is free there. The webmention protocol specifies this one
   * encoding, so accepting JSON as well would be inventing a dialect nobody
   * sends and giving the parser a second shape to be wrong about.
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
   * THE VISIBILITY READ, and it is AFTER the source check on purpose. Both are
   * refusals; only this one costs a query, and a caller sending garbage sources
   * should not be able to make this site read D1 for each one.
   *
   * A draft, a scheduled post and a slug that names nothing are one answer,
   * `BAD_TARGET`, for the reason stated on that constant.
   */
  if (!(await webmentionTarget(env, slug))) {
    return answer(BAD_TARGET, 400);
  }

  /*
   * 7. THE GLOBAL CAP, the fourth bound, read immediately before the write it
   * guards. It is a count and not a reservation, so two requests arriving
   * together can both pass at the boundary; that is accepted and stated rather
   * than papered over, because the failure it would cause is one row past a cap
   * chosen with an order of magnitude of headroom, and the alternative is a
   * second Durable Object to make a queue length transactional.
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
   * 9. VERIFICATION AFTER THE ANSWER. The sender gets 202 immediately, which is
   * what the protocol asks for and what keeps a slow source off the critical
   * path. `waitUntil` rather than a queue: ruled 2026-09-04, a queue would be
   * new infrastructure for a load of zero. What a cut-short `waitUntil` leaves
   * behind, and why that is the safe direction, is on `verifyWebmention`.
   */
  getExecutionContext(context).waitUntil(verifyWebmention(env, id, source, target));

  return answer("Accepted. It will be verified and reviewed before it appears.", 202);
}

/**
 * A GET says what this is rather than 404ing, so anyone who finds the endpoint
 * knows what they are looking at. It reveals nothing: the text below is true of
 * every webmention receiver on the internet.
 *
 * The same shape as the CSP sink's loader, deliberately. Both are public POST
 * endpoints somebody may arrive at by hand.
 */
export function loader() {
  return answer(
    "Webmention endpoint. POST source and target as application/x-www-form-urlencoded.",
    200,
  );
}
