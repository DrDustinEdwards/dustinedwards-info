/**
 * THE RESOLVER SEAM. Shape 2 of media-module-architecture.md.
 *
 * The media core asks "who cites this key?" and content types answer. This is
 * the ONLY part that varies per content type, which is why it is the only
 * pluggable part: everything else about an object is true regardless of what
 * links to it.
 *
 * **What adding a second content type costs, stated so the seam can be judged
 * rather than trusted.** To add albums:
 *
 *   1. write `resolvers/albums.server.ts` exporting one `ReferenceResolver`
 *   2. add one line to `RESOLVERS` below
 *
 * That is the whole list. The core does not change, the media page does not
 * change, the delete action does not change, and the refusal message does not
 * change, because every one of them is written against `MediaCitation` and
 * never against posts. If a future type needed more than those two steps, the
 * seam would be wrong and should be fixed rather than worked around.
 *
 * Ruling 1: resolvers return STRUCTURED results, never booleans. A boolean
 * would have to be widened at every call site the first time a refusal needed
 * to say which post and which reference form; a structure never does.
 */

/** Where a citation came from, in a form a refusal can name. */
export type MediaCitation = {
  /** The registered content type, e.g. "post". */
  type: string;
  /** Stable id within that type, e.g. a slug. */
  id: string;
  /** Human label for a message. */
  title: string;
  /** Which syntax cited it. */
  form: "markdown-image" | "figure-directive" | "frontmatter-cover" | "link" | "html" | "other";
  /** Enough location detail to find it, e.g. "line 42". */
  detail: string;
};

/**
 * Answers, for a batch of keys.
 *
 * Batched rather than per key, because every resolver so far reads one corpus
 * and then scans it, and a per-key signature would make that one read per key.
 */
export type ReferenceResolver = (
  env: Env,
  keys: string[],
) => Promise<Map<string, MediaCitation[]>>;

import { postsResolver } from "./resolvers/posts.server";

/**
 * The registry. One line per content type.
 *
 * A plain array rather than a runtime `register()` call, deliberately: the set
 * of content types on this site is known at build time, and a mutable registry
 * would introduce an ordering problem (which module imported first) in exchange
 * for a flexibility nothing needs.
 */
const RESOLVERS: Array<{ name: string; resolve: ReferenceResolver }> = [
  { name: "posts", resolve: postsResolver },
];

export type ResolutionResult = {
  citations: Map<string, MediaCitation[]>;
  /**
   * True when EVERY resolver answered. False means at least one threw, and a
   * delete must refuse rather than proceed.
   */
  complete: boolean;
  /** Names of resolvers that failed, for the message. */
  failed: string[];
};

/**
 * Asks every registered content type who cites these keys.
 *
 * **Failure is reported, never swallowed, because ruling 4 makes delete fail
 * closed.** A resolver that throws leaves us unable to say an object is unused,
 * and "we could not check" must not render as "nothing cites it". So the result
 * carries `complete`, the delete action refuses when it is false, and the media
 * page says the usage column is unreliable rather than quietly showing
 * "unused" for everything.
 */
export async function resolveCitations(
  env: Env,
  keys: string[],
): Promise<ResolutionResult> {
  const citations = new Map<string, MediaCitation[]>(keys.map((key) => [key, []]));
  const failed: string[] = [];

  const answers = await Promise.all(
    RESOLVERS.map(async (resolver) => {
      try {
        return { name: resolver.name, map: await resolver.resolve(env, keys) };
      } catch (error) {
        console.error(`media resolver ${resolver.name} failed`, error);
        failed.push(resolver.name);
        return null;
      }
    }),
  );

  for (const answer of answers) {
    if (!answer) continue;
    for (const [key, found] of answer.map) {
      const list = citations.get(key);
      if (list) list.push(...found);
    }
  }

  return { citations, complete: failed.length === 0, failed };
}
