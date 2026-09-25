// What every verify-live section shares: the origin, the request helpers, the counter, and the text
// helpers for the served HTML.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createTally } from "../tally.mjs";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const ORIGIN = process.argv[2] ?? "https://dustinedwards.dustin-edwards.workers.dev";
export const SLUG = "where-should-a-blog-store-its-words";

/* Every request carries a deadline: undici's own is 300 s, so one hung response would stall the run
   for minutes before anything failed. Ask streams a model answer, so it gets longer. */
export const TIMEOUT_MS = 30_000;
export const ASK_TIMEOUT_MS = 90_000;

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export const tally = createTally({ separator: "\n      ", print: false });
export const { ok: check, failed: failures } = tally;

/**
 * One GET against the origin. `noCache` is on by default and off for a cache probe, where it would
 * make "not a HIT" pass vacuously. An image's body is not read.
 *
 * @param {string} path
 * @param {{ headers?: Record<string, string>, cookie?: string, accept?: string, noCache?: boolean }} [options]
 */
export async function fetchLive(path, { headers = {}, cookie, accept, noCache = true } = {}) {
  /** @type {Record<string, string>} */
  const sent = { "user-agent": UA };
  if (noCache) sent["cache-control"] = "no-cache";
  if (cookie) sent.cookie = cookie;
  if (accept) sent.accept = accept;
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: { ...sent, ...headers },
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = res.headers.get("content-type")?.includes("image/") ? "" : await res.text();
  return { res, text, status: res.status };
}

/** @param {string} path @param {Record<string,string>} [headers] */
export const get = (path, headers = {}) => fetchLive(path, { headers });

/** SSR splices HTML comments between adjacent text nodes. */
/** @param {string} s */
export const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

/**
 * React escapes `'` to `&#x27;`, so data-file prose needs decoding to match.
 *
 * @param {string} s
 */
export const unescape = (s) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Ampersand LAST, or a double-escaped entity decodes into the wrong thing.
    .replace(/&amp;/g, "&");

/** @param {string} s */
export const htmlTag = (s) => (s.match(/<html[^>]*>/) ?? [""])[0];
