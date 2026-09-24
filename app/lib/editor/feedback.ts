// Success crosses the post/redirect/get in the URL; a failure cannot, because the redirect would
// discard the typed body. The URL is editable, so everything parsed from it is untrusted.

import type { SaveOutcome } from "./publish-policy.mjs";

export type EditorFeedback =
  | { state: "saved"; sha: string }
  | { state: "published-first"; sha: string; at: string; slug: string }
  | { state: "republished"; sha: string; slug: string }
  | { state: "unpublished"; sha: string; slug: string }
  | { state: "failed"; message: string; conflict: boolean; field?: string; line?: number };

const OUTCOMES: readonly SaveOutcome[] = [
  "saved",
  "published-first",
  "republished",
  "unpublished",
];

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

export function savedRedirectPath(result: {
  slug: string;
  outcome: SaveOutcome;
  commitSha: string;
  firstPublished: string | null;
}) {
  const params = new URLSearchParams({
    saved: result.outcome,
    sha: shortSha(result.commitSha),
  });
  if (result.outcome === "published-first" && result.firstPublished) {
    params.set("at", result.firstPublished);
  }
  return `/admin/posts/${result.slug}/edit?${params}`;
}

export function feedbackFromSearch(
  search: URLSearchParams,
  slug: string,
): EditorFeedback | null {
  const outcome = search.get("saved");
  const sha = search.get("sha") ?? "";
  if (!outcome || !(OUTCOMES as readonly string[]).includes(outcome)) return null;
  if (!/^[0-9a-f]{7,40}$/.test(sha)) return null;

  switch (outcome as SaveOutcome) {
    case "published-first": {
      const at = search.get("at") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(at)) return { state: "saved", sha };
      return { state: "published-first", sha, at, slug };
    }
    case "republished":
      return { state: "republished", sha, slug };
    case "unpublished":
      return { state: "unpublished", sha, slug };
    default:
      return { state: "saved", sha };
  }
}
