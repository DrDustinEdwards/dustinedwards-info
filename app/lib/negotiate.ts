/**
 * Accept-header negotiation, shared by every route that has more than one
 * representation.
 *
 * Extracted from markdown-twin.ts when /search gained a JSON representation.
 * There is one q-value parser on purpose: a second one would drift, and the
 * failure mode is silent, since a browser that starts receiving JSON still
 * renders something.
 */

/**
 * The q-value a client gave each media range, highest wins on repeats.
 *
 * A missing q defaults to 1, per RFC 9110. Parameters other than q are ignored.
 */
export function acceptQValues(request: Request): Map<string, number> {
  const values = new Map<string, number>();
  const accept = request.headers.get("accept");
  if (!accept) return values;

  for (const part of accept.split(",")) {
    const [range, ...params] = part.trim().split(";");
    const type = range.trim().toLowerCase();
    if (!type) continue;

    let q = 1;
    for (const param of params) {
      const [key, value] = param.trim().split("=");
      if (key?.trim().toLowerCase() === "q") {
        const parsed = Number.parseFloat(value ?? "");
        if (!Number.isNaN(parsed)) q = parsed;
      }
    }

    values.set(type, Math.max(values.get(type) ?? -1, q));
  }

  return values;
}

/**
 * Media ranges that mean "a browser, or a client with no opinion".
 *
 * `*_/_*` and `text/*` are what something sends when it does not care, and HTML
 * is the default representation, so they count as votes for HTML rather than
 * as votes for whatever else is on offer.
 */
const HTML_RANGES = ["text/html", "text/*", "*/*"];

/**
 * True when the client asked for `wanted` in preference to HTML.
 *
 * Compares q-values rather than substring-matching the header. A browser sends
 * `text/html,application/xhtml+xml,...` and must keep getting HTML; an agent
 * sending `Accept: application/json` must get JSON. A client that lists both at
 * equal weight gets HTML, because that is the older behaviour and the safer
 * default for anything that guessed.
 */
export function prefersType(request: Request, wanted: string): boolean {
  const values = acceptQValues(request);
  const target = values.get(wanted.toLowerCase()) ?? -1;
  let html = -1;
  for (const range of HTML_RANGES) {
    html = Math.max(html, values.get(range) ?? -1);
  }
  return target > 0 && target > html;
}
