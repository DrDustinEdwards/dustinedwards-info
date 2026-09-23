import { SLUG_PATTERN } from "../content/slug.mjs";

/**
 * What a webmention's `source` and `target` are allowed to be.
 *
 * ## WHY THIS IS A PURE MODULE AND NOT THREE BLOCKS IN THE ROUTE
 *
 * The same reason `read-capped.mjs` is one: the route imports `~/lib/context`,
 * which node cannot resolve, so nothing outside workerd could reach these
 * predicates there. They are also the two of the endpoint's four bounds that
 * are decidable from a string, so they are the half worth holding on its own.
 *
 * ## THE TARGET ORIGIN IS PASSED IN, NEVER PINNED TO A CONSTANT
 *
 * `originVerdict` in `app/lib/origin.mjs` makes this argument at length and it
 * applies here unchanged: the site is pre-cutover, it answers on workers.dev
 * today and on the apex later, and a comparison pinned to one constant refuses
 * every real request from whichever host is not the constant, at the moment of
 * the cutover, when everything else is also moving.
 *
 * So the caller hands in the origins it will accept. The route hands in two:
 * `SITE_ORIGIN`, because that is the origin every canonical URL and every feed
 * link on this site emits and therefore the one a sender will have READ off a
 * page, and the request's own origin, because that is where the POST actually
 * arrived. They are the same string most of the time and they are not the same
 * string during a cutover.
 *
 * ## THE SLUG IS MATCHED AGAINST `SLUG_PATTERN`, IMPORTED
 *
 * Hard rule 6: one statement of what a slug is. A local regex here would be a
 * second one, and the failure would be silent in the permissive direction,
 * which is a lookup key going to D1 from a stranger's POST body.
 */

/** The one path shape a mention may target. */
const BLOG_PREFIX = "/blog/";

/**
 * Parse a `target` into the post slug it names, or null.
 *
 * Null covers every rejection with one value on purpose. The route answers the
 * same 400 text for an unparseable URL, a foreign origin, a path that is not a
 * post and a slug that is not a slug, because distinguishing them would let a
 * caller map this site's URL space by reading the refusals.
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

  /*
   * THE PATH IS COMPARED AFTER `new URL` HAS NORMALISED IT, which is what
   * makes `/blog/../blog/a-post` and `%2e%2e` uninteresting: the parser has
   * already resolved dot segments and decoded the path by the time this reads
   * it. What is left to check is the prefix and the shape of what follows.
   */
  if (!url.pathname.startsWith(BLOG_PREFIX)) return null;
  const rest = url.pathname.slice(BLOG_PREFIX.length);
  // A trailing slash is the same post; anything with a further segment is not.
  const slug = rest.endsWith("/") ? rest.slice(0, -1) : rest;
  if (!SLUG_PATTERN.test(slug)) return null;
  return slug;
}

/**
 * A hostname that is an IP LITERAL rather than a name.
 *
 * Both families. IPv6 reaches `URL.hostname` wrapped in brackets, which is the
 * only shape it can take there, so the bracket is the test rather than a
 * colon count. IPv4 is four dotted decimal parts; a shortened form such as
 * `http://2130706433/` is parsed by `URL` into `2130706433` and is caught by
 * the all-digits arm below rather than by the dotted one.
 *
 * @param {string} hostname
 */
function isIpLiteral(hostname) {
  if (hostname.startsWith("[")) return true;
  if (/^[0-9]+$/.test(hostname)) return true;
  return /^[0-9]{1,3}(?:\.[0-9]{1,3}){3}$/.test(hostname);
}

/**
 * A hostname that names the machine the Worker is running on.
 *
 * `localhost` and anything under it. RFC 6761 reserves the whole `.localhost`
 * tree for exactly this, and some resolvers honor it, so the subtree is
 * refused rather than the bare name alone.
 *
 * @param {string} hostname
 */
function isLoopbackName(hostname) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost");
}

/**
 * The reasons a `source` is refused. Exported so the route and its tests name
 * the same strings rather than two sets that agree today.
 */
export const SOURCE_REFUSALS = {
  unparseable: "source is not an absolute URL",
  protocol: "source must be http or https",
  selfOrigin: "source must be another site",
  ipLiteral: "source must name a host, not an IP address",
  loopback: "source must not be a loopback address",
  sameAsTarget: "source and target must differ",
};

/**
 * May this `source` be fetched?
 *
 * ## WHAT THESE REFUSALS ARE ACTUALLY FOR
 *
 * The verifier fetches the source. That makes this endpoint a way to ask this
 * Worker to make an outbound request to a URL a stranger chose, which is the
 * shape of a server-side request forgery. There is nothing on a loopback or a
 * private address that this Worker can reach and the internet cannot, so the
 * refusals below cost a legitimate sender nothing.
 *
 * **THIS IS NOT A COMPLETE SSRF DEFENCE AND DOES NOT CLAIM TO BE.** A name in
 * public DNS can resolve to a private address, and nothing decidable from the
 * string can see that. What bounds the remaining exposure is the runtime: a
 * Cloudflare Worker's `fetch` has no private network to reach into, there is
 * no metadata endpoint at 169.254.169.254 for it, and the verifier reads at
 * most 1 MB, keeps nothing but a name and 280 characters, and stores none of
 * it as markup. Stated rather than implied, so nobody later reads this list as
 * the whole argument.
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
 * Do these two URLs name the same document, ignoring a trailing slash?
 *
 * The comparison the verifier runs over every `a[href]` on the source page.
 * `/blog/a-post` and `/blog/a-post/` are the same post to this site and a
 * sender's template may emit either, so a strict string compare would report
 * `no-link` on a page that plainly carries the link.
 *
 * The fragment is dropped for the same reason: a link to `#comments` on the
 * post is a link to the post. The QUERY is NOT dropped, because a query is
 * capable of naming a different document and this site's own `/blog` index
 * uses one to filter.
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

/** The excerpt ceiling, in characters. One owner; the schema comment points here. */
export const EXCERPT_MAX_CHARS = 280;

/**
 * Collapse a run of source text into the stored excerpt.
 *
 * Whitespace collapsed, trimmed, cut to the ceiling. PLAIN TEXT BY
 * CONSTRUCTION: the caller hands in `textContent`, so there is no markup left
 * to strip and no sanitizer here that could be believed to be one.
 *
 * @param {string} text
 */
export function collapseExcerpt(text) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_MAX_CHARS ? flat.slice(0, EXCERPT_MAX_CHARS) : flat;
}

/**
 * The href a rendered mention may carry, or null.
 *
 * ## A RENDER-TIME CHECK ON A VALUE THAT WAS ALREADY CHECKED
 *
 * `sourceVerdict` refused a bad `source` on the way in and `readAuthor` kept an
 * `author_url` only if it parsed as absolute http(s). So every stored value
 * should already pass this. It is applied again at the point of RENDER anyway,
 * and the reason is hard rule 6's: validate where the value enters a context,
 * not where it entered the system. The row can outlive the code that wrote it,
 * a hand-written row skips both earlier checks entirely, and an `href` is the
 * one attribute on this page where being wrong is an executable defect rather
 * than a cosmetic one.
 *
 * **NULL IS A RENDERING DECISION, NOT AN ERROR.** The caller renders the name
 * as plain text with no anchor, which is the honest degradation: a mention
 * whose URLs cannot be trusted is still a mention somebody sent, and dropping
 * it entirely would hide moderated content from the reader while the admin page
 * kept showing it as approved.
 *
 * Returns the PARSER'S OWN OUTPUT rather than the input string. `URL` has
 * already decided what the value means by the time this can answer, so handing
 * back the original would render an attribute the check was never applied to.
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
