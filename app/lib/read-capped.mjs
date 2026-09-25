import { errorMessage } from "./error-message.mjs";

/**
 * Counts chunks as they arrive. The client's declared length must never permit: it can be absent
 * or understated, and `request.text()` materializes the whole body before any slice runs. A stream
 * that errors mid-read THROWS: no string is a safe stand-in, because every caller parses what it gets.
 *
 * @param {{ body: ReadableStream<Uint8Array> | null }} source Anything with a body stream.
 * @param {number} max Hard ceiling in bytes.
 * @returns {Promise<string | null>} The decoded body, or null when over the cap.
 */
export async function readCapped(source, max) {
  if (!source.body) return "";
  const reader = source.body.getReader();
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
        // NULL rather than a truncated string, so the caller answers 413 instead of logging a
        // fragment of a body we should not have taken.
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch (error) {
    throw new Error(
      `the body stream failed after ${total} bytes: ` +
        `${errorMessage(error)}`,
      { cause: error },
    );
  }
  const joined = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}
