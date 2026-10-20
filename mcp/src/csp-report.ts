/**
 * The CSP violation sink the policies in security-headers.ts name. A public, unauthenticated POST
 * (browsers send reports without credentials) that logs and stores nothing, the same shape as the
 * site's /api/csp-report. It reaches no binding but the rate limiter and nothing on the operator
 * API, so it is no second route to the app.
 *
 * Always 204 to a browser's POST, even when limited or unreadable: an error status makes browsers
 * send the report again.
 */

import { checkRateLimit, type RateLimitEnv } from "./rate-limit";

/** Bytes. A real report is a few hundred. */
const MAX_BODY_BYTES = 8 * 1024;
/** Loose, because a page tripping ten rules sends ten reports. */
const REPORTS_PER_MINUTE = 60;

const done = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function handleCspReport(request: Request, env: Partial<RateLimitEnv>): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("CSP violation report sink. POST only.", {
      status: 405,
      headers: { allow: "POST", "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  // Content-Length is a client hint: used to refuse early, never to permit.
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return done();

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const limit = await checkRateLimit(env, `csp:${ip}`, REPORTS_PER_MINUTE);
  if (!limit.allowed) return done();

  const body = await readCapped(request, MAX_BODY_BYTES).catch(() => null);
  // JSON-encoded so a body with newlines cannot forge log lines. Unparsed: the report-uri and
  // report-to shapes both land here.
  if (body !== null) console.log(JSON.stringify({ event: "csp-report", report: body }));
  return done();
}

/** The body as text, or null past the cap; stops reading the stream at the cap. */
async function readCapped(request: Request, cap: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) break;
    size += value.byteLength;
    if (size > cap) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}
