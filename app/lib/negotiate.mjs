// Plain .mjs so `node --test` can import it; the types are JSDoc under checkJs.

/**
 * @param {Request} request
 * @returns {Map<string, number>}
 */
export function acceptQValues(request) {
  /** @type {Map<string, number>} */
  const values = new Map();
  const accept = request.headers.get("accept");
  if (!accept) return values;

  for (const part of accept.split(",")) {
    const [range, ...params] = part.trim().split(";");
    const type = (range ?? "").trim().toLowerCase();
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

/** Wildcards count as votes for HTML, the default representation. */
const HTML_RANGES = ["text/html", "text/*", "*/*"];

/**
 * @param {Map<string, number>} values
 * @returns {number}
 */
function htmlWeight(values) {
  let html = -1;
  for (const range of HTML_RANGES) {
    html = Math.max(html, values.get(range) ?? -1);
  }
  return html;
}

/**
 * A tie goes to HTML, the safer default for a client that guessed.
 *
 * @param {Request} request @param {string} wanted
 * @returns {boolean}
 */
export function prefersType(request, wanted) {
  const values = acceptQValues(request);
  const target = values.get(wanted.toLowerCase()) ?? -1;
  return target > 0 && target > htmlWeight(values);
}

/**
 * `caches.default` ignores `Vary: Accept`, so a non-HTML request must bypass the
 * Worker's cache or it is served the stored HTML. Deliberately wider than the
 * routes that negotiate: being wide costs a miss, being narrow serves wrong bytes.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function negotiatesAwayFromHtml(request) {
  const values = acceptQValues(request);
  if (values.size === 0) return false;

  const html = htmlWeight(values);
  for (const [type, q] of values) {
    if (HTML_RANGES.includes(type)) continue;
    if (q > 0 && q > html) return true;
  }
  return false;
}
