/**
 * Whether a session may merge a pull request itself (ruling 148, Dustin 2026-09-23): only when CI
 * concluded success on the PR's EXACT head, and never when the PR is labelled "visual", which marks a
 * change a visitor would see and waits for Dustin's yes. Pure, so test/merge-decision.test.mjs can hold
 * every refusal without a network.
 */

export const VISUAL_LABEL = "visual";

/**
 * @typedef {{ number: number, state: string, isDraft: boolean, baseRefName: string, headRefOid: string, labels: string[] }} PullRequest
 * @typedef {{ headSha: string, event: string, status: string, conclusion: string | null }} Run
 */

/**
 * @param {PullRequest} pr
 * @param {Run[]} runs the CI workflow's runs, any sha and any event
 * @returns {{ merge: true } | { merge: false, reason: string }}
 */
export function mergeDecision(pr, runs) {
  if (pr.state !== "OPEN") return { merge: false, reason: `#${pr.number} is ${pr.state.toLowerCase()}, not open` };
  if (pr.isDraft) return { merge: false, reason: `#${pr.number} is a draft` };
  if (pr.baseRefName !== "main") return { merge: false, reason: `#${pr.number} targets ${pr.baseRefName}, not main` };
  if (pr.labels.includes(VISUAL_LABEL)) {
    return {
      merge: false,
      reason: `#${pr.number} is labelled "${VISUAL_LABEL}": a change a visitor sees waits for Dustin's yes (ruling 148)`,
    };
  }
  // The PR's own CI, on the exact head the merge will land. A run on an earlier push says nothing about this one.
  const own = runs.filter((run) => run.headSha === pr.headRefOid && run.event === "pull_request");
  if (own.length === 0) return { merge: false, reason: `no CI run exists for the head ${pr.headRefOid.slice(0, 8)}` };
  if (own.some((run) => run.status !== "completed")) {
    return { merge: false, reason: `CI is still running on ${pr.headRefOid.slice(0, 8)}` };
  }
  const failed = own.filter((run) => run.conclusion !== "success");
  if (failed.length > 0) {
    return { merge: false, reason: `CI concluded ${failed.map((run) => run.conclusion).join(", ")} on ${pr.headRefOid.slice(0, 8)}` };
  }
  return { merge: true };
}
