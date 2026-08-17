/**
 * Read a request body, giving up as soon as it exceeds a byte ceiling.
 *
 * ## Why this is a module rather than three lines in the route
 *
 * It guards a PUBLIC, UNAUTHENTICATED POST endpoint, and the route it guards
 * imports `~/lib/context`, which node cannot resolve, so nothing in `test/`
 * could reach it there. A pure function is the only part of a handler a test
 * can hold, which is the same reason `confirmationSatisfied` was extracted.
 *
 * ## The defect it replaces
 *
 * `/api/csp-report` capped its body with
 * `Number(request.headers.get("content-length") ?? "0") > MAX`, then read with
 * `(await request.text()).slice(0, MAX)`. Three things were wrong at once:
 *
 *   1. a request with NO Content-Length became 0 and passed the check
 *   2. a request UNDERSTATING its length passed it too
 *   3. `request.text()` materialises the whole body before `.slice()` runs, so
 *      the slice bounded what was LOGGED and never what was received
 *
 * The comment above it said the cap preceded the read. It did not.
 *
 * **THE CLIENT'S CLAIM ABOUT SIZE MUST NOT PARTICIPATE IN THE DECISION.** A
 * declared length is useful only for refusing early, never for permitting. This
 * counts the chunks as they arrive.
 */

/**
 * @param {Request} request The incoming request.
 * @param {number} max Hard ceiling in bytes.
 * @returns {Promise<string | null>} The decoded body, or null when over the cap.
 */
export async function readCapped(request, max) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  /** @type {Uint8Array[]} */
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > max) {
        /*
         * Stop pulling. The sender may still be writing, and that is the point:
         * an unauthenticated caller must not be able to make us hold an
         * arbitrary body in memory by lying about its length.
         *
         * NULL rather than a truncated string, so the caller answers 413.
         * Truncating would log a fragment of a body we should not have taken.
         */
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return "(unreadable)";
  }
  const joined = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
