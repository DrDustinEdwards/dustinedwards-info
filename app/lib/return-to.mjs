/**
 * Where the no-script theme toggle sends a reader back to.
 *
 * ## PLAIN JAVASCRIPT, so `check:tests` can reach it
 *
 * It was private to `app/routes/theme.ts`, which is TypeScript, so the one
 * function on the site whose whole job is refusing a hostile `Referer` was the
 * one nothing could test. Same move and the same reason as `origin.mjs`,
 * `negotiate.mjs` and `json-ld.mjs`.
 *
 * ## WHAT IT IS FOR
 *
 * The toggle redirects to the `Referer` rather than to `/`, so the control does
 * not move the reader off the page they were reading. An attacker-supplied
 * `Referer` would otherwise make this an open redirect, so the header is proven
 * same-origin before it is trusted, and a path that could resolve against
 * another host is refused.
 */

/**
 * @param {Request} request
 * @returns {string}
 */
export function safeReturnTo(request) {
  const referer = request.headers.get("referer");
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    if (url.origin !== new URL(request.url).origin) return "/";
    /*
     * A PATH BEGINNING `//` IS REJECTED. `new URL("https://site//evil.com")`
     * has pathname `//evil.com`, and `Location: //evil.com` is a
     * protocol-relative URL the browser resolves against another HOST. The
     * origin check above does not catch it, because the origin really is ours.
     *
     * UNREACHABLE AS WRITTEN, and measured rather than assumed on 2026-08-11.
     * An attacker needs a same-origin 200 page whose pathname starts `//` and
     * which renders the theme form. Probed against the live site: `//` and
     * `///` return 200 and both resolve to the index, while `//blog`,
     * `//search`, `//colophon` and `//example.com` all return 404, and a 404
     * renders the error boundary, which carries no theme toggle. The only
     * reachable value is `//` itself, which names no host.
     *
     * Hardened anyway. "Safe because the router happens to 404" is an accident,
     * and one line makes it structural.
     */
    if (url.pathname.startsWith("//")) return "/";
    /*
     * THE HASH IS ECHOED, and MEASUREMENT SAYS IT IS NEVER THERE.
     *
     * Added 2026-08-28 to stop the no-script toggle returning a reader to the
     * TOP of whatever they were reading. That reasoning was right about the
     * cost and wrong about the cure, and the correction is measured rather than
     * argued: check:browser drove a real form post in real Chrome with script
     * disabled on 2026-08-29, and the fragment was gone.
     *
     * **`Referer` NEVER CARRIES A FRAGMENT.** RFC 9110 requires it stripped, so
     * `url.hash` here is the empty string on every request a browser makes. The
     * branch is unreachable on the path it was written for.
     *
     * NO SERVER-SIDE FIX EXISTS, which is why this is documented rather than
     * repaired. A fragment is never transmitted to an origin by anything: not
     * in the Referer, not in the request line, not in a form post. `/theme`
     * cannot learn it and therefore cannot redirect to it.
     *
     * The promise is still kept for readers who can be kept it: the SCRIPTED
     * path holds position by never navigating at all.
     *
     * The echo STAYS. It costs nothing, it is validated by the same three lines
     * above that validate everything else, and a caller that one day passes a
     * URL from somewhere other than a `Referer` gets correct behaviour rather
     * than a silently truncated one. What is removed is the CLAIM that it does
     * something for the no-script reader today.
     */
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
