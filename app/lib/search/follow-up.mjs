/**
 * The follow-up question's marker and splitter, in a module the CLIENT may import.
 *
 * WHY THIS IS NOT IN `ask-prompt.mjs`, which is where it started and where it looks like it
 * belongs: that module holds `SYSTEM_PROMPT`, and `app/enhance/ask.ts` is a client bundle. The
 * splitter was imported from there for one build, and the built `ask.js` carried the system prompt
 * text into every reader's browser, MEASURED by grepping the artifact rather than reasoned about.
 * Tree-shaking did not remove it.
 *
 * That is worse than page weight. `answerLeaksPrompt` exists to catch the MODEL repeating its
 * instructions; publishing those instructions in a static asset makes the guard moot. So the two
 * sentences both sides need live here, with no prompt in reach, and `ask-prompt.mjs` imports the
 * marker from this file rather than restating it.
 *
 * @see test/ask-follow-up.test.mjs
 */

/**
 * The marker the follow-up question is prefixed with.
 *
 * A MARKER RATHER THAN "the last line", because an answer's last line is ordinarily part of the
 * answer. Splitting on position would silently eat a sentence whenever the model emitted no
 * follow-up, which is the failure that matters: the reader loses content and nothing reports it.
 * A prefix that is absent simply means no follow-up.
 *
 * Upper case and colon-terminated so it cannot collide with ordinary prose.
 */
export const FOLLOW_UP_MARKER = "NEXT:";

/**
 * Split a raw answer into the prose and the follow-up question.
 *
 * ABSENT IS THE NORMAL CASE and returns the answer unchanged with a null question. The model is
 * ASKED for a follow-up and is not required to produce one; every answer cached before this
 * shipped carries none; and a refusal should not grow one.
 *
 * THE MARKER MUST START A LINE. A mid-sentence "NEXT:" is prose, and treating it as the split
 * point would truncate the answer at it.
 *
 * SEARCHED FROM THE END, because the follow-up is asked for last and a model that mentions the
 * marker earlier has still put the real one on the final line.
 *
 * @param {string} raw
 * @returns {{ answer: string, followUp: string | null }}
 */
export function splitFollowUp(raw) {
  const lines = raw.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    /* Indexed access is `string | undefined` under noUncheckedIndexedAccess. The loop bound makes
       it a string; the fallback satisfies the checker without widening the behaviour. */
    const line = (lines[i] ?? "").trim();
    if (!line.startsWith(FOLLOW_UP_MARKER)) continue;
    const question = line.slice(FOLLOW_UP_MARKER.length).trim();
    /* A marker with nothing after it is not a question; drop the line and keep the answer. */
    const answer = lines.slice(0, i).join("\n").trimEnd();
    return { answer, followUp: question.length > 0 ? question : null };
  }
  return { answer: raw, followUp: null };
}
