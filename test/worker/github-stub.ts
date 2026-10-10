import { stubGitHub as stubRepository, type GitHubStub } from "@dustinedwards/devkit/github";

/* The fake lives in devkit (`@dustinedwards/devkit/github`): an unknown host or route throws, blob
 * shas are real, and a tree applies only when the ref moves. This file only names the repository
 * it stands in for, once, so the cases keep calling `stubGitHub(seed)`. */

export { versionOf, type GitHubStub } from "@dustinedwards/devkit/github";

export function stubGitHub(seed: Record<string, string> = {}): GitHubStub {
  return stubRepository({ owner: "DrDustinEdwards", repo: "dustinedwards-info", files: seed });
}
