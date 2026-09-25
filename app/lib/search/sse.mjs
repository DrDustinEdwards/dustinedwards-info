// Server-sent-event frame reading for the Ask stream, shared by the reader's enhancement, the answer
// cache and the draft guard, so all three read one frame the same way. No imports: the enhancement
// bundle carries it.

/**
 * One frame's event name and its data lines joined, each line with its `data:` prefix removed.
 *
 * @param {string} frame one frame, without its blank-line terminator
 * @returns {{ event: string, data: string }}
 */
export function frameFields(frame) {
  let event = "";
  /** @type {string[]} */
  const dataLines = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  return { event, data: dataLines.join("\n") };
}

/**
 * Takes the complete frames off the front of a buffer, leaving the unfinished tail as `rest`. A
 * frame with no data, the `[DONE]` sentinel, or data that is not JSON carries nothing to show and
 * is left out.
 *
 * @param {string} buffer everything decoded and not yet consumed
 * @returns {{ frames: Array<{ event: string, data: unknown }>, rest: string }}
 */
export function takeSseFrames(buffer) {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  /** @type {Array<{ event: string, data: unknown }>} */
  const frames = [];
  for (const part of parts) {
    const { event, data } = frameFields(part);
    if (!data || data === "[DONE]") continue;
    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    frames.push({ event, data: parsed });
  }
  return { frames, rest };
}

/**
 * The text a completion frame adds to the answer, or undefined for a frame that adds none.
 *
 * @param {unknown} data a parsed frame's data
 * @returns {string | undefined}
 */
export function answerDelta(data) {
  const delta = /** @type {{ choices?: Array<{ delta?: { content?: unknown } }> } | null} */ (data)
    ?.choices?.[0]?.delta?.content;
  return typeof delta === "string" ? delta : undefined;
}
