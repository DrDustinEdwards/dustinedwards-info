// The one place a content save decides whether it commits. Every content kind's save (posts, procedures,
// and the kinds Carrel writes through the site API) calls this, so "an unchanged save does nothing"
// is one rule and not one copy per kind.

import type { PurgeOutcome } from "~/lib/cache-purge.server";
import { convergeWithRetry } from "~/lib/editor/converge.mjs";
import type { Actor } from "~/lib/editor/publish-policy.mjs";
import { blobGuard, commitFiles, getHead } from "~/lib/source/store.server";

/** What a save answers when its file is byte-identical to the committed one. */
export const UNCHANGED_NOTE =
  "The file is identical to the stored one, so nothing was written. commitSha is the current head.";

type Committed = Awaited<ReturnType<typeof commitFiles>>;

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

/**
 * A commit message with who made it: the change id joins a commit to Carrel's authorship record, and an operator's
 * id names the operator (store.server's authorOf reads the tag back).
 */
export function taggedMessage(actor: Actor, message: string) {
  if (actor.kind === "operator") return `${message} [operator:${actor.id}]`;
  if (actor.kind === "carrel") return `${message} [carrel:${actor.changeId}]`;
  return message;
}

/**
 * The write half of every one-file content save, after it has validated and passed the policy: commit unless
 * unchanged, check the stored bytes are the bytes compiled, then write the derived rows and purge
 * (convergeWithRetry). A "noop" returns before any write; otherwise the answer carries the purge outcome.
 * The commit is never reverted when a derived write fails: the error names the commit and the repair.
 */
export async function commitAndConverge(
  env: Parameters<typeof commitFiles>[0],
  options: {
    actor: Actor;
    /** The file's path in the repository. */
    file: string;
    existing: { content: string } | null;
    raw: string;
    /** The git blob sha of the bytes compiled. */
    sourceBlobSha: string;
    expectedHeadSha?: string | null;
    /** The blob sha of this file as the caller loaded it; undefined means no check. */
    expectedBlobSha?: string | null;
    /** The commit message, before the actor's tag. */
    message: string;
    rowIsCurrent: () => Promise<boolean>;
    /** The derived writes and the purge; retried once. */
    write: () => Promise<PurgeOutcome>;
    /** The name convergeWithRetry's error gives the file. */
    slug: string;
    /** How the stored-bytes error names the file ("The page \"about\""), what was not updated, and its repair. */
    mismatch: { subject: string; target: string; repair?: string; checked?: string };
  },
): Promise<
  | { action: "noop"; commitSha: string }
  | { action: "commit" | "repair"; commitSha: string; purged: PurgeOutcome }
> {
  const { file, sourceBlobSha } = options;
  // After the gate, so a file that fails validation is still refused even when it is unchanged.
  const written = await commitUnlessUnchanged(env, {
    existing: options.existing,
    raw: options.raw,
    rowIsCurrent: options.rowIsCurrent,
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        expectedBlobs: blobGuard(file, options.expectedBlobSha),
        message: taggedMessage(options.actor, options.message),
        changes: [{ path: file, content: options.raw }],
      }),
  });
  if (written.action === "noop") return written;
  const { commitSha } = written;
  const stored = written.blobShas[file];
  if (stored && stored !== sourceBlobSha) {
    const {
      subject,
      target,
      repair = "Run the content sync to rebuild the row from the stored source.",
      checked = "compiled",
    } = options.mismatch;
    throw new Error(
      `${subject} WAS saved as revision ${commitSha}, but the stored bytes (${stored}) are not ` +
        `the bytes ${checked} (${sourceBlobSha}), so ${target} was not updated. ${repair}`,
    );
  }

  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      purged = await options.write();
    },
    // Nothing kept in KV for these kinds: the thrown error names the commit and the repair, and the next ship's
    // sync converges the row from the repository anyway.
    recordDivergence: async () => undefined,
    slug: options.slug,
    commitSha,
  });
  return { action: written.action, commitSha, purged };
}
