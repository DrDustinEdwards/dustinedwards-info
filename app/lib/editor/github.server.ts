/**
 * The GitHub half of the editor's write path. Every editor save is one commit on `main` carrying
 * exactly ONE file, the markdown; git holds markdown only and D1 holds the only rendered copy.
 *
 * The Git Data API commit shape STAYS even so, because it carries the `expectedHeadSha` conflict
 * guard and the Contents API write path has no such check-then-update seam.
 *
 * The token is a Worker secret, never sent to the client and never logged.
 */

import { contentsCapMessage } from "./contents-cap.mjs";

const API = "https://api.github.com";
const OWNER = "DrDustinEdwards";
const REPO = "dustinedwards-info";
const BRANCH = "main";

/** Raised when GitHub refuses a write. Carries a status for the caller to map. */
export class GitHubError extends Error {
  status: number;
  conflict: boolean;

  constructor(message: string, status: number, conflict = false) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.conflict = conflict;
  }
}

/** The Worker env plus the editor token, which wrangler types does not know about. */
type GhEnv = Env & { GITHUB_TOKEN?: string };

function token(env: GhEnv) {
  const value = env.GITHUB_TOKEN;
  if (!value) {
    throw new GitHubError(
      "GITHUB_TOKEN is not configured on this Worker, so the editor cannot commit.",
      500,
    );
  }
  return value;
}

async function gh<T>(
  env: GhEnv,
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token(env)}`,
      "content-type": "application/json",
      // GitHub rejects requests without one.
      "user-agent": "dustinedwards-info-editor",
      "x-github-api-version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { message?: string };
      detail = body.message ? `: ${body.message}` : "";
    } catch {
      detail = "";
    }
    throw new GitHubError(
      `GitHub ${init.method ?? "GET"} ${path} failed with ${response.status}${detail}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/** The commit `main` currently points at, and the tree it carries. */
export async function getHead(env: GhEnv) {
  const ref = await gh<{ object: { sha: string } }>(
    env,
    `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`,
  );
  const commit = await gh<{ tree: { sha: string } }>(
    env,
    `/repos/${OWNER}/${REPO}/git/commits/${ref.object.sha}`,
  );
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
}

/**
 * Reads a file at a given ref. Returns null for 404 so a caller can tell "absent" from "failed",
 * which is the difference between creating a post and an outage.
 *
 * GUARDED AGAINST THE 1 MB CONTENTS CAP: the JSON media type returns a file over 1 MB with `size`
 * set and no base64 content, which decodes to an empty string rather than to the transport failure
 * it is. The decision lives in `contentsCapMessage` (contents-cap.mjs) so `node:test` can drive it.
 */
export async function readFile(env: GhEnv, path: string, ref = BRANCH) {
  try {
    const file = await gh<{
      content: string;
      encoding: string;
      sha: string;
      size: number;
    }>(env, `/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${ref}`);
    const capped = contentsCapMessage(file, path);
    if (capped) {
      throw new GitHubError(capped, 422);
    }
    const content =
      file.encoding === "base64"
        ? new TextDecoder().decode(
            Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) =>
              c.charCodeAt(0),
            ),
          )
        : file.content;
    return { content, sha: file.sha };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Lists one directory of the repository at a ref. The Contents API returns every entry with its git
 * blob sha in ONE call, and blob shas are content-addressed, so this answers which markdown files
 * exist and what bytes they hold without fetching any of them.
 *
 * NOT RECURSIVE, deliberately: `content/posts/` is flat by construction (`postPath` states the one
 * shape a post path can take), and the directory form caps at 1000 entries, stated here rather than
 * discovered at post 1001.
 */
export async function listDirectory(env: GhEnv, path: string, ref = BRANCH) {
  const entries = await gh<
    Array<{ name: string; path: string; sha: string; type: string; size: number }>
  >(env, `/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${ref}`);

  if (!Array.isArray(entries)) {
    // A file path answers with an object. Refuse rather than iterate its keys.
    throw new GitHubError(`"${path}" is not a directory at ${ref}.`, 422);
  }
  if (entries.length >= 1000) {
    throw new GitHubError(
      `"${path}" returned ${entries.length} entries, at the Contents API's ` +
        `1000-entry directory cap; the listing may be truncated. Move the ` +
        `rebuild to the Trees API before trusting it again.`,
      422,
    );
  }
  return entries;
}

/**
 * Reads a file at a given ref as RAW BYTES. `readFile` decodes to text, which is right for markdown
 * and destroys an image: `TextDecoder` replaces every invalid UTF-8 sequence, so a PNG comes back a
 * different length than it went in and nothing can measure it.
 *
 * Reading the repo at the pinned ref measures what the REPOSITORY says, which is the bytes a clone
 * would build from, rather than the deployed asset.
 *
 * The Contents API caps at 1 MB per file; the empty-content case is reported rather than measured,
 * so an oversized asset fails the save instead of silently losing its dimensions.
 */
export async function readBinaryFile(env: GhEnv, path: string, ref = BRANCH) {
  try {
    const file = await gh<{ content: string; encoding: string; size: number }>(
      env,
      `/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${ref}`,
    );
    if (file.encoding !== "base64" || file.content.length === 0) {
      throw new GitHubError(
        `"${path}" is ${file.size} bytes and did not come back as base64 ` +
          `content; the Contents API caps at 1 MB.`,
        422,
      );
    }
    return Uint8Array.from(atob(file.content.replace(/\n/g, "")), (c) =>
      c.charCodeAt(0),
    );
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

export type FileChange =
  /** Write or overwrite a file. */
  | { path: string; content: string }
  /** Remove a file from the tree. */
  | { path: string; content: null };

/**
 * Lands every change as one commit on main.
 *
 * `expectedHeadSha` is the conflict gate: the caller records the head commit when it loads the
 * editor and passes it back on save, and if main has moved the update is refused rather than
 * replayed on top of work nobody looked at. Checked up front so the failure is a clean message
 * rather than a rejected push after blobs exist.
 */
export async function commitFiles(
  env: GhEnv,
  options: {
    changes: FileChange[];
    message: string;
    expectedHeadSha?: string | null;
  },
) {
  const head = await getHead(env);

  if (options.expectedHeadSha && options.expectedHeadSha !== head.commitSha) {
    throw new GitHubError(
      `The repository changed since this post was opened (main is now ${head.commitSha.slice(0, 7)}, ` +
        `you loaded ${options.expectedHeadSha.slice(0, 7)}). Reload and reapply your edit.`,
      409,
      true,
    );
  }

  // A tree entry with sha: null deletes the path. Blobs are created first so
  // the tree references content that already exists.
  const tree = await Promise.all(
    options.changes.map(async (change) => {
      if (change.content === null) {
        return { path: change.path, mode: "100644", type: "blob", sha: null };
      }
      const blob = await gh<{ sha: string }>(
        env,
        `/repos/${OWNER}/${REPO}/git/blobs`,
        {
          method: "POST",
          body: JSON.stringify({ content: change.content, encoding: "utf-8" }),
        },
      );
      return { path: change.path, mode: "100644", type: "blob", sha: blob.sha };
    }),
  );

  const newTree = await gh<{ sha: string }>(
    env,
    `/repos/${OWNER}/${REPO}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({ base_tree: head.treeSha, tree }),
    },
  );

  const commit = await gh<{ sha: string }>(
    env,
    `/repos/${OWNER}/${REPO}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: options.message,
        tree: newTree.sha,
        parents: [head.commitSha],
      }),
    },
  );

  await gh(env, `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    // Never force. A rejected update here means main moved between the check
    // above and this call, and losing that race must not cost someone a commit.
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  /*
   * The per-path blob shas, read off the tree entries GitHub just created.
   * Content-addressed, so each equals `gitBlobSha()` of the same bytes; the
   * save path hands the markdown's sha to `renderAndWrite`, which asserts the
   * bytes it rendered are the bytes this commit landed. A deleted path
   * reports null.
   */
  const blobShas: Record<string, string | null> = {};
  for (const entry of tree) blobShas[entry.path] = entry.sha;

  return { commitSha: commit.sha, blobShas };
}

export type PostCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

/**
 * The commits that touched one path, newest first.
 *
 * Read only. Version history is a window onto history git already holds, so
 * nothing here writes, and a restore goes back through the ordinary atomic save
 * path rather than manipulating refs.
 */
export async function listCommitsForPath(
  env: GhEnv,
  path: string,
  limit = 20,
): Promise<PostCommit[]> {
  const commits = await gh<
    Array<{
      sha: string;
      commit: { message: string; author: { name: string; date: string } };
    }>
  >(
    env,
    `/repos/${OWNER}/${REPO}/commits?path=${encodeURIComponent(path)}` +
      `&sha=${BRANCH}&per_page=${limit}`,
  );

  return commits.map((entry) => ({
    sha: entry.sha,
    // `split` always yields a first element; the fallback is unreachable and
    // an empty subject line is what an empty commit message deserves.
    message: entry.commit.message.split("\n")[0] ?? "",
    author: entry.commit.author.name,
    date: entry.commit.author.date,
  }));
}

/**
 * The unified diff for one path at one commit.
 *
 * GitHub returns the patch per file on the commit object, so this asks for the
 * commit and picks out the file rather than fetching two blobs and diffing them
 * here. A commit that added the file has no `previous_filename` and still
 * carries a patch.
 */
export async function getCommitPatch(env: GhEnv, sha: string, path: string) {
  const commit = await gh<{
    files?: Array<{ filename: string; patch?: string; status: string }>;
  }>(env, `/repos/${OWNER}/${REPO}/commits/${sha}`);

  const file = commit.files?.find((entry) => entry.filename === path);
  return file ? { patch: file.patch ?? null, status: file.status } : null;
}
