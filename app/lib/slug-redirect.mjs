/**
 * PERMANENT REDIRECTS FOR RENAMED POSTS, DECIDED BEFORE ANY DATABASE READ.
 *
 * Ruling 47, 2026-09-09. Ten posts were retitled and nine were reslugged. Every
 * old slug had a public URL, so every old slug keeps answering: not because an
 * inbound link was found (none was, and the ruling says so), but because the
 * URLs were already published and a published URL is a promise.
 *
 * ## WHY IT IS IN THE GATEWAY AND NOT IN THE ROUTE
 *
 * `blog.$slug.tsx` answers an unknown slug with a 404 thrown out of its loader,
 * and the loader runs AFTER `getBlogPost` has queried D1. Putting the redirect
 * there would spend a database read to discover a rename this file already
 * knows about, on a request that is never going to render a post. It would also
 * put the decision behind the cache loopback, where a stored 404 for an old
 * slug would outlive the fix.
 *
 * So it sits beside the HTTPS redirect at the front of the gateway, which is
 * cache disabled and therefore runs on every request. Same slot, same reason:
 * a decision that does not depend on the response cannot be allowed to depend
 * on a cache.
 *
 * ## BOTH REPRESENTATIONS, and the twin is not an afterthought
 *
 * `/blog/<slug>` and `/blog/<slug>.md` are two URLs for one post, and the
 * markdown twin is the one an agent or a feed reader is most likely to hold,
 * because `llms.txt` advertises it by name. A redirect that moved the HTML and
 * left the twin 404ing would break exactly the readers this site went to the
 * trouble of serving markdown for.
 *
 * ## WHY IT NEVER CONSULTS THE CORPUS
 *
 * The map is a pure function from an old slug to a new one, and this module
 * cannot tell whether the target exists. That is deliberate: the gateway has no
 * database and giving it one to validate a redirect would put a D1 read in
 * front of every request on the site to serve nine of them. The target's
 * existence is a BUILD-TIME property, and `check:urls` owns it: it asserts that
 * every target names a published post, and that no post claims a slug that is
 * also a source here. A redirect to a 404 is therefore a red gate, not a live
 * defect.
 *
 * ## THE MAP IS AN ARGUMENT, NOT AN IMPORT, AND THAT IS AN ENVIRONMENT SPLIT
 *
 * This file is `.mjs` and is imported BOTH by the Worker, through vite, and by
 * `node --test` directly. Those two disagree about JSON: a bare JSON import is
 * what every other app module uses (`colophon.tsx` reads `stack.json` that
 * way) because this repo's tsc `module` setting REJECTS the `with { type:
 * "json" }` attribute, and Node ESM REQUIRES that same attribute. There is no
 * spelling of a JSON import that satisfies both, so this module imports
 * nothing and takes the map as an argument. `workers/app.ts` does the import,
 * which is the same split `makeResolveImage` already lives on.
 *
 * It also makes the predicate testable against a map the test wrote, rather
 * than only against the nine live entries, which is what lets the traversal and
 * inherited-key cases below be exercised at all.
 *
 * ## `no-store`, for the reason on the HTTPS redirect
 *
 * The cache-header rule: a response with no `Cache-Control` is CACHED under heuristic
 * freshness. These redirects are permanent and would be safe to cache, but they
 * are issued from the gateway, which is cache disabled, so a stored copy would
 * be a surprise rather than a saving. The header is stated rather than left to
 * a default, so the property does not depend on which entrypoint somebody later
 * moves this to.
 *
 * @see content/redirects.json
 * @see workers/app.ts
 * @see test/slug-redirect.test.mjs
 */

/** The one place the blog path prefix is spelled for this module. */
const BLOG_PREFIX = "/blog/";

/** The markdown twin's suffix, which is part of the path and not an extension. */
const MARKDOWN_SUFFIX = ".md";

/**
 * Where this request should be sent instead, or null if this module has no
 * opinion about it.
 *
 * Returns a PATH, not a URL, and the caller resolves it against the request.
 * A redirect built from the request's own origin cannot be talked into naming
 * another host, which is the property `return-to.mjs` had to earn the hard way.
 *
 * @param {string} pathname the request's pathname, already decoded by URL
 * @param {Record<string, string>} map old slug to new slug
 * @returns {string | null}
 */
export function postRedirectTarget(pathname, map) {
  if (typeof pathname !== "string") return null;
  if (!map || typeof map !== "object") return null;
  if (!pathname.startsWith(BLOG_PREFIX)) return null;

  const rest = pathname.slice(BLOG_PREFIX.length);
  /*
   * A SLASH IN THE REMAINDER MEANS THIS IS NOT A POST URL. `/blog/tags/x` and
   * `/blog/series/x` live under the same prefix, and a map lookup on
   * "tags/x" would miss anyway; refusing early says why rather than relying on
   * the miss, and stops a future entry with a slash in it from matching a
   * different route's URL.
   */
  if (rest.includes("/")) return null;

  const markdown = rest.endsWith(MARKDOWN_SUFFIX);
  const slug = markdown ? rest.slice(0, -MARKDOWN_SUFFIX.length) : rest;

  /*
   * OWN PROPERTY ONLY. The map is a plain object, so `"constructor"` and
   * `"toString"` are inherited keys whose values are truthy, and a bare lookup
   * would answer a redirect for `/blog/constructor` pointing at the source of
   * `Object`. Not a hypothetical: it is the ordinary shape of using an object
   * as a map, and the fix is one call.
   */
  if (!Object.hasOwn(map, slug)) return null;

  const target = map[slug];
  if (typeof target !== "string" || target.length === 0) return null;
  return `${BLOG_PREFIX}${target}${markdown ? MARKDOWN_SUFFIX : ""}`;
}

/**
 * 301 for GET and HEAD, 308 for everything else.
 *
 * The same split as the HTTPS redirect, and for a weaker version of the same
 * reason: nothing POSTs to a post URL today, so the distinction cannot bite
 * here. It is kept identical anyway, because two redirect helpers in one Worker
 * answering the same question differently is how the next reader learns the
 * wrong rule.
 *
 * @param {string} method
 * @returns {number}
 */
export function postRedirectStatus(method) {
  const m = String(method ?? "").toUpperCase();
  return m === "GET" || m === "HEAD" ? 301 : 308;
}
