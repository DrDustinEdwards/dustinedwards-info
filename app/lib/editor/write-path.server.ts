// The one place a content save decides whether it commits. Every content kind's save (posts, procedures,
// and the kinds Carrel writes through the site API) calls this, so "an unchanged save does nothing"
// is one rule and not one copy per kind.

import { commitFiles, getHead } from "./github.server";

/** What a save answers when its file is byte-identical to the committed one. */
export const UNCHANGED_NOTE =
  "The file is identical to the committed one, so nothing was committed or rewritten. commitSha is the current head.";

type Committed = Awaited<ReturnType<typeof commitFiles>>;

export type WriteDecision =
  /** Identical file and D1 already holds its row: nothing to do. */
  | { action: "noop"; commitSha: string }
  /** Identical file, but D1's row is missing or stale: no commit, the caller repairs the row (hard rule 18). */
  | { action: "repair"; commitSha: string; blobShas: Record<string, string | null> }
  /** A changed file: committed. */
  | { action: "commit"; commitSha: string; blobShas: Record<string, string | null> };

/**
 * A file byte-identical to the committed one is never committed (the commit would be empty and still start
 * CI and a deploy). If D1 already holds this file's row the save stops there; if not, the caller rewrites
 * the row from the file without a commit.
 *
 * @param existing the committed file, or null when the path is new
 * @param rowIsCurrent whether D1's row was derived from exactly these bytes; read only for an identical file
 * @param commit the commit to make for a changed file
 */
export async function commitUnlessUnchanged(
  env: Parameters<typeof getHead>[0],
  options: {
    existing: { content: string } | null;
    raw: string;
    rowIsCurrent: () => Promise<boolean>;
    commit: () => Promise<Committed>;
  },
): Promise<WriteDecision> {
  const { existing, raw } = options;
  if (existing !== null && existing.content === raw) {
    const commitSha = (await getHead(env)).commitSha;
    return (await options.rowIsCurrent())
      ? { action: "noop", commitSha }
      : { action: "repair", commitSha, blobShas: {} };
  }
  const { commitSha, blobShas } = await options.commit();
  return { action: "commit", commitSha, blobShas };
}
