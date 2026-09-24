/*
 * Absent Origin is allowed: only non-browser clients omit it, and they spend their
 * own IP's allowance; a hostile page cannot omit it. The string "null" (sandboxed
 * iframe, opaque origin) is refused, unlike a missing header.
 */

/**
 * Compared against the request's own origin, not `SITE_ORIGIN`, so it keeps
 * working on both workers.dev and the apex across the cutover.
 *
 * @param {string | null | undefined} origin the `Origin` header, verbatim
 * @param {string} requestUrl the request's own URL
 * @returns {{ ok: boolean, reason: string }}
 */
export function originVerdict(origin, requestUrl) {
  if (origin === null || origin === undefined || origin === "") {
    return { ok: true, reason: "absent" };
  }

  let self;
  try {
    self = new URL(requestUrl).origin;
  } catch {
    return { ok: false, reason: "unparseable-request-url" };
  }

  if (origin === self) return { ok: true, reason: "same-origin" };
  return { ok: false, reason: "cross-origin" };
}

export const ASK_ORIGIN_REFUSAL = "Ask does not take cross-origin requests.";

// Deliberately says nothing about what the route does or why it refused.
export const ORIGIN_REFUSAL = "Cross-origin requests are not accepted.";
