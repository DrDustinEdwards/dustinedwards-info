// The Git Data API commit shape stays because it carries the expectedHeadSha conflict guard, which
// the Contents API write path has no seam for.

import { base64ToBytes } from "../bytes.mjs";
import { contentsCapMessage } from "./contents-cap.mjs";

const API = "https://api.github.com";
const OWNER = "DrDustinEdwards";
const REPO = "dustinedwards-info";
const BRANCH = "main";

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

/** GITHUB_TOKEN is a secret, which wrangler types does not know about. */
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

/** Null on 404, so a caller can tell "absent" (create a post) from "failed" (an outage). */
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
        ? new TextDecoder().decode(base64ToBytes(file.content))
        : file.content;
    return { content, sha: file.sha };
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

/** Not recursive: content/posts/ is flat. The directory form caps at 1000 entries, hence the guard. */
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

/** The repository's posts: each `content/posts/*.md` file, with the slug its name carries. */
export async function listPostFiles(env: GhEnv) {
  const entries = await listDirectory(env, "content/posts");
  return entries
    .filter((e) => e.type === "file" && e.name.endsWith(".md"))
    .map((e) => ({ ...e, slug: e.name.slice(0, -".md".length) }));
}

/** Raw bytes: readFile's TextDecoder replaces invalid UTF-8, so an image would come back a different length. */
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
    return base64ToBytes(file.content);
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

type FileChange =
  | { path: string; content: string }
  | { path: string; content: null };

/**
 * expectedHeadSha is the conflict gate: if main moved since the editor loaded, the save is refused,
 * checked up front so it fails with a clean message before any blob exists.
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

  // A tree entry with sha: null deletes the path.
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
    // Never force: a rejection means main moved since the check, and losing that race must not cost a commit.
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  // Content-addressed, so each equals gitBlobSha() of the same bytes; renderAndWrite relies on that.
  const blobShas: Record<string, string | null> = {};
  for (const entry of tree) blobShas[entry.path] = entry.sha;

  return { commitSha: commit.sha, blobShas };
}

type PostCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

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
    message: entry.commit.message.split("\n")[0] ?? "",
    author: entry.commit.author.name,
    date: entry.commit.author.date,
  }));
}

export async function getCommitPatch(env: GhEnv, sha: string, path: string) {
  const commit = await gh<{
    files?: Array<{ filename: string; patch?: string; status: string }>;
  }>(env, `/repos/${OWNER}/${REPO}/commits/${sha}`);

  const file = commit.files?.find((entry) => entry.filename === path);
  return file ? { patch: file.patch ?? null, status: file.status } : null;
}
