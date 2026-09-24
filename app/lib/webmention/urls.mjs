import { SLUG_PATTERN } from "../content/slug.mjs";

// Pure so node:test can reach it (the route imports `~/lib/context`). Allowed origins are passed in, never
// a constant: the site answers on two hosts across the cutover. The slug uses the imported `SLUG_PATTERN`;
// a local regex would fail silently in the permissive direction.

const BLOG_PREFIX = "/blog/";

/**
 * Null for every rejection: distinct refusals would let a caller map this site's URL space.
 *
 * @param {string} target the `target` field, verbatim
 * @param {readonly string[]} allowedOrigins origins this site answers on
 * @returns {string | null} the post slug, or null
 */
export function targetSlug(target, allowedOrigins) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!allowedOrigins.includes(url.origin)) return null;

  // `new URL` has already resolved dot segments and decoded the path, so only prefix and shape remain.
  if (!url.pathname.startsWith(BLOG_PREFIX)) return null;
  const rest = url.pathname.slice(BLOG_PREFIX.length);
  // A trailing slash is the same post; anything with a further segment is not.
  const slug = rest.endsWith("/") ? rest.slice(0, -1) : rest;
  if (!SLUG_PATTERN.test(slug)) return null;
  return slug;
}

/**
 * IPv6 reaches `hostname` bracketed. `http://2130706433/` stays all digits, so the digits arm catches it.
 *
 * @param {string} hostname
 */
function isIpLiteral(hostname) {
  if (hostname.startsWith("[")) return true;
  if (/^[0-9]+$/.test(hostname)) return true;
  return /^[0-9]{1,3}(?:\.[0-9]{1,3}){3}$/.test(hostname);
}

/**
 * RFC 6761 reserves the whole `.localhost` tree, and some resolvers honor it.
 *
 * @param {string} hostname
 */
function isLoopbackName(hostname) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost");
}

export const SOURCE_REFUSALS = {
  unparseable: "source is not an absolute URL",
  protocol: "source must be http or https",
  selfOrigin: "source must be another site",
  ipLiteral: "source must name a host, not an IP address",
  loopback: "source must not be a loopback address",
  sameAsTarget: "source and target must differ",
};

/**
 * The verifier fetches the source, so these refusals bound SSRF. NOT a complete defence: public DNS can
 * resolve to a private address. The runtime bounds the rest: a Worker's `fetch` has no private network
 * or metadata endpoint, and the verifier reads at most 1 MB and stores no markup.
 *
 * @param {string} source the `source` field, verbatim
 * @param {string} target the `target` field, verbatim
 * @param {readonly string[]} allowedOrigins origins this site answers on
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function sourceVerdict(source, target, allowedOrigins) {
  let url;
  try {
    url = new URL(source);
  } catch {
    return { ok: false, reason: SOURCE_REFUSALS.unparseable };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: SOURCE_REFUSALS.protocol };
  }
  if (allowedOrigins.includes(url.origin)) {
    return { ok: false, reason: SOURCE_REFUSALS.selfOrigin };
  }
  if (isLoopbackName(url.hostname)) {
    return { ok: false, reason: SOURCE_REFUSALS.loopback };
  }
  if (isIpLiteral(url.hostname)) {
    return { ok: false, reason: SOURCE_REFUSALS.ipLiteral };
  }
  if (source === target) {
    return { ok: false, reason: SOURCE_REFUSALS.sameAsTarget };
  }
  return { ok: true };
}

/**
 * A trailing slash and the fragment are ignored; the QUERY is not, because a query can name a different
 * document (the `/blog` index filters with one).
 *
 * @param {string} href an absolute URL, already resolved against the source
 * @param {string} target the target URL
 */
export function sameDocument(href, target) {
  let a;
  let b;
  try {
    a = new URL(href);
    b = new URL(target);
  } catch {
    return false;
  }
  const strip = (/** @type {URL} */ u) =>
    `${u.origin}${u.pathname.endsWith("/") ? u.pathname.slice(0, -1) : u.pathname}${u.search}`;
  return strip(a) === strip(b);
}

// One owner; the schema comment points here.
export const EXCERPT_MAX_CHARS = 280;

/**
 * Plain text by construction: the caller passes `textContent`. This is not a sanitizer.
 *
 * @param {string} text
 */
export function collapseExcerpt(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_MAX_CHARS ? flat.slice(0, EXCERPT_MAX_CHARS) : flat;
}

/**
 * Checked again at RENDER: a row can outlive the code that wrote it or be hand-written, and a wrong `href`
 * is executable. Null means render the name without a link. Returns the parser's output, not the input.
 *
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function safeHttpHref(value) {
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.href;
}
