// Not in ask-prompt.mjs: the client imports this, and importing from there shipped the system prompt
// in the client bundle (tree-shaking did not remove it), which would make answerLeaksPrompt moot.

/** A marker, not "the last line": splitting on position would eat a sentence when no follow-up came. */
export const FOLLOW_UP_MARKER = "NEXT:";

/**
 * The marker must start a line (mid-sentence it is prose), and is searched from the end, since the
 * follow-up is asked for last.
 *
 * @param {string} raw
 * @returns {{ answer: string, followUp: string | null }}
 */
export function splitFollowUp(raw) {
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    /* The ?? "" only satisfies noUncheckedIndexedAccess. */
    const line = (lines[i] ?? "").trim();
    if (!line.startsWith(FOLLOW_UP_MARKER)) continue;
    const question = line.slice(FOLLOW_UP_MARKER.length).trim();
    const answer = lines.slice(0, i).join("\n").trimEnd();
    return { answer, followUp: question.length > 0 ? question : null };
  }
  return { answer: raw, followUp: null };
}
