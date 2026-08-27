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
     * THE HASH IS KEPT, since 2026-08-28, and it is validated by the same three
     * lines above that validate everything else.
     *
     * It was dropped, so the no-script toggle returned a reader to the TOP of
     * whatever they were reading. On a long post that is the worst possible
     * place to land: the reader was somewhere specific, asked for a colour, and
     * was sent back to the beginning. The scripted path never had this problem,
     * because it never navigates, so the cost fell entirely on the readers the
     * fallback exists for.
     *
     * NOTHING NEW HAS TO BE VALIDATED. The fragment is a component of the URL
     * this function has already proven is same-origin and not protocol-relative;
     * a fragment cannot change the destination host or path, which is what the
     * checks above are about. It is echoed rather than parsed, exactly as
     * `search` is.
     */
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
