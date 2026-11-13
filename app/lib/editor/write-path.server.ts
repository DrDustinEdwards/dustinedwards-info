// The one place a content save decides whether it commits. Every content kind's save (posts, procedures,
// and the kinds Carrel writes through the site API) calls this, so "an unchanged save does nothing"
// is one rule and not one copy per kind.

import { blobGuard, commitFiles, getHead } from "~/lib/source/store.server";
import type { Actor } from "./publish-policy.mjs";

/** What a save answers when its file is byte-identical to the committed one. */
export const UNCHANGED_NOTE =
  "The file is identical to the stored one, so nothing was written. commitSha is the current head.";

export type WriteDecision =
  /** Identical file and D1 already holds its row: nothing to do. */
  | { action: "noop"; commitSha: string }
  /** Identical file, but D1's row is missing or stale: no commit, the caller repairs the row. */
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
 * @param path, message the one file a changed save commits, and its commit message
 * @param expectedHeadSha, expectedBlobSha the versions the caller loaded; a commit is refused when either moved
 */
export async function commitUnlessUnchanged(
  env: Parameters<typeof getHead>[0],
  options: {
    existing: { content: string } | null;
    raw: string;
    rowIsCurrent: () => Promise<boolean>;
    path: string;
    message: string;
    expectedHeadSha?: string | null;
    expectedBlobSha?: string | null;
  },
): Promise<WriteDecision> {
  const { existing, raw, path } = options;
  if (existing !== null && existing.content === raw) {
    const commitSha = (await getHead(env)).commitSha;
    return (await options.rowIsCurrent())
      ? { action: "noop", commitSha }
      : { action: "repair", commitSha, blobShas: {} };
  }
  const { commitSha, blobShas } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    expectedBlobs: blobGuard(path, options.expectedBlobSha),
    message: options.message,
    changes: [{ path, content: raw }],
  });
  return { action: "commit", commitSha, blobShas };
}

/**
 * The commit-message suffix naming who saved: an operator's id, or Carrel's change id, which joins the commit to
 * Carrel's authorship record. Empty for the admin.
 */
export function actorTag(actor: Actor): string {
  if (actor.kind === "operator") return ` [operator:${actor.id}]`;
  if (actor.kind === "carrel") return ` [carrel:${actor.changeId}]`;
  return "";
}

/**
 * Throws when the store kept other bytes than the ones compiled: the commit stands, but a row derived from the
 * compiled bytes would not match the stored source, so the caller writes none.
 *
 * @param what the saved thing, as the error names it ("The phage \"t4\"")
 * @param repair what rebuilds the row from the stored source
 */
export function assertStoredBytes(
  written: Exclude<WriteDecision, { action: "noop" }>,
  path: string,
  compiledSha: string,
  what: string,
  repair = "the content sync",
): void {
  const stored = written.blobShas[path];
  if (stored && stored !== compiledSha) {
    throw new Error(
      `${what} WAS saved as revision ${written.commitSha}, but the stored bytes (${stored}) are not ` +
        `the bytes compiled (${compiledSha}), so its row was not updated. Run ${repair} to ` +
        `rebuild the row from the stored source.`,
    );
  }
}
