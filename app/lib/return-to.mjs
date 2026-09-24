/**
 * The `Referer` is attacker-supplied, so it is proven same-origin before the toggle redirects to it.
 *
 * @param {Request} request
 * @returns {string}
 */
export function safeReturnTo(request) {
  const referer = request.headers.get("referer");
  if (!referer) return "/";
  try {
    const url = new URL(referer);
    if (url.origin !== new URL(request.url).origin) return "/";
    // `new URL("https://site//evil.com")` has pathname `//evil.com`, and `Location: //evil.com`
    // is protocol-relative, resolving against another HOST. The origin check does not catch it.
    if (url.pathname.startsWith("//")) return "/";
    // `Referer` never carries a fragment (RFC 9110), so `url.hash` is empty for browser requests;
    // it is echoed for callers that pass a URL from elsewhere.
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
