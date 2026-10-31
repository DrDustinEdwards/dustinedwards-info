// The content's source, in D1 (drizzle/0032_source_files.sql): one row per file, keyed by its repository path, and
// every version it has had. Every kind's save reads and writes through here, so the path rules, the blob-sha
// versions and the conflict guards are the ones the repository-backed saves had. Static files under public/ ship
// with the deploy, so they are read from the assets binding, never from D1.

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { IDENTITY } from "~/lib/identity.generated.mjs";
import assetManifest from "../../../content/generated/assets.json";

export class SourceError extends Error {
  status: number;
  conflict: boolean;

  constructor(message: string, status: number, conflict = false) {
    super(message);
    this.name = "SourceError";
    this.status = status;
    this.conflict = conflict;
  }
}

type SourceEnv = Pick<Env, "DB">;
type AssetsEnv = Pick<Env, "ASSETS">;

/** A revision id, as text: the newest source_revisions row, so any write moves it. "0" before the first. */
export async function getHead(env: SourceEnv) {
  const row = await env.DB.prepare(`SELECT COALESCE(MAX(id), 0) AS id FROM source_revisions`).first<{ id: number }>();
  return { commitSha: String(row?.id ?? 0) };
}

const REVISION_ID = /^\d+$/;
const BLOB_SHA = /^[0-9a-f]{40}$/;

/**
 * A file now, or at a version: a revision id (the file as that revision left it) or a blob sha (the newest revision
 * holding those bytes). Null when the file is absent there, so a caller can tell "absent" from "failed".
 */
export async function readFile(env: SourceEnv, path: string, at?: string) {
  if (at === undefined) {
    return env.DB.prepare(`SELECT content, sha FROM source_files WHERE path = ?1`)
      .bind(path)
      .first<{ content: string; sha: string }>();
  }
  const row = REVISION_ID.test(at)
    ? await env.DB.prepare(
        `SELECT content, sha FROM source_revisions WHERE path = ?1 AND id <= ?2 ORDER BY id DESC LIMIT 1`,
      )
        .bind(path, Number(at))
        .first<{ content: string | null; sha: string | null }>()
    : BLOB_SHA.test(at)
      ? await env.DB.prepare(
          `SELECT content, sha FROM source_revisions WHERE path = ?1 AND sha = ?2 ORDER BY id DESC LIMIT 1`,
        )
          .bind(path, at)
          .first<{ content: string | null; sha: string | null }>()
      : null;
  return row?.content != null && row.sha ? { content: row.content, sha: row.sha } : null;
}

/** The files directly in a directory (not below it), as the repository listing answered: name, path, sha, size. */
export async function listDirectory(env: SourceEnv, dir: string) {
  const prefix = `${dir.replace(/\/$/, "")}/`;
  const rows = await env.DB.prepare(
    `SELECT path, sha, length(CAST(content AS BLOB)) AS size FROM source_files
     WHERE substr(path, 1, ?2) = ?1 AND instr(substr(path, ?2 + 1), '/') = 0 ORDER BY path`,
  )
    .bind(prefix, prefix.length)
    .all<{ path: string; sha: string; size: number }>();
  return (rows.results ?? []).map((r) => ({
    name: r.path.slice(prefix.length),
    path: r.path,
    sha: r.sha,
    type: "file",
    size: r.size,
  }));
}

/** The posts: each `content/posts/*.md` file, with the slug its name carries. */
export async function listPostFiles(env: SourceEnv) {
  const entries = await listDirectory(env, "content/posts");
  return entries
    .filter((e) => e.name.endsWith(".md"))
    .map((e) => ({ ...e, slug: e.name.slice(0, -".md".length) }));
}

/** A static file of this deploy, by its repository path (`public/...`): the response, or null when none is served. */
async function fetchAsset(env: AssetsEnv, path: string) {
  if (!path.startsWith("public/")) return null;
  const response = await env.ASSETS.fetch(new Request(`https://assets.invalid/${encodeURI(path.slice("public/".length))}`));
  if (response.status === 404) return null;
  if (!response.ok) throw new SourceError(`The static file ${path} answered ${response.status}.`, response.status);
  return response;
}

/** Raw bytes of a static file the deploy serves, or null. */
export async function readBinaryFile(env: AssetsEnv, path: string) {
  const response = await fetchAsset(env, path);
  return response ? new Uint8Array(await response.arrayBuffer()) : null;
}

/** A static file's size by its site path, or null when the deploy serves none. The PDFs and roster photographs. */
export async function publicFileEntry(env: AssetsEnv, sitePath: string) {
  const response = await fetchAsset(env, `public${sitePath}`);
  if (!response) return null;
  const size = Number(response.headers.get("content-length") ?? (await response.arrayBuffer()).byteLength);
  return { size };
}

/** The image placeholders the deploy was built with (content/generated/assets.json). */
export function assetPlaceholders(): Record<string, { sha: string; lqip: string }> {
  return (assetManifest as { placeholders?: Record<string, { sha: string; lqip: string }> }).placeholders ?? {};
}

type FileChange = { path: string; content: string } | { path: string; content: null };

/**
 * `commitFiles`' expectedBlobs for one file, or undefined when the caller named no version. Carrel's version of
 * a file-backed item is its blob sha, so a save is refused only when THAT file changed.
 */
export function blobGuard(path: string, expectedBlobSha: string | null | undefined) {
  return expectedBlobSha === undefined ? undefined : { [path]: expectedBlobSha };
}

/** Who made a write, from the tag every writer's message carries. */
function authorOf(message: string) {
  return /\[carrel:/.test(message) ? "carrel" : /\[operator:/.test(message) ? "operator" : "admin";
}

/**
 * Writes files and their revisions as one D1 batch. expectedHeadSha refuses the write when any file changed since
 * it was read; expectedBlobs (per path, the blob sha the caller loaded, or null for "must not exist") refuses it
 * only when that file did. Both are checked first for a clean message, and again inside the batch, so a write
 * that lands in between still cannot be overwritten: the guard row fails its CHECK and nothing is written.
 */
export async function commitFiles(
  env: SourceEnv,
  options: {
    changes: FileChange[];
    message: string;
    expectedHeadSha?: string | null;
    expectedBlobs?: Record<string, string | null>;
  },
) {
  const head = (await getHead(env)).commitSha;
  if (options.expectedHeadSha && options.expectedHeadSha !== head) {
    throw new SourceError(
      `The content changed since this was opened (it is now at revision ${head}, you loaded ` +
        `${options.expectedHeadSha}). Reload and reapply your edit.`,
      409,
      true,
    );
  }
  const expected = Object.entries(options.expectedBlobs ?? {});
  for (const [path, sha] of expected) {
    const current = (await readFile(env, path))?.sha ?? null;
    if (current !== sha) {
      throw new SourceError(
        `${path} changed since it was opened (it is now ${current ? current.slice(0, 7) : "absent"}, ` +
          `you loaded ${sha ? sha.slice(0, 7) : "none"}). Reload and reapply your edit.`,
        409,
        true,
      );
    }
  }

  const blobShas: Record<string, string | null> = {};
  for (const change of options.changes) {
    blobShas[change.path] = change.content === null ? null : await gitBlobSha(change.content);
  }

  const db = env.DB;
  const author = authorOf(options.message);
  const statements = [
    ...(options.expectedHeadSha
      ? [db.prepare(`INSERT INTO source_guard (ok) SELECT COALESCE(MAX(id), 0) = ?1 FROM source_revisions`).bind(Number(head))]
      : []),
    ...expected.map(([path, sha]) =>
      db.prepare(`INSERT INTO source_guard (ok) VALUES ((SELECT sha FROM source_files WHERE path = ?1) IS ?2)`).bind(path, sha),
    ),
    ...options.changes.flatMap((change) => [
      db.prepare(`INSERT INTO source_revisions (path, content, sha, message, author) VALUES (?1, ?2, ?3, ?4, ?5)`).bind(
        change.path,
        change.content,
        blobShas[change.path],
        options.message,
        author,
      ),
      change.content === null
        ? db.prepare(`DELETE FROM source_files WHERE path = ?1`).bind(change.path)
        : db
            .prepare(
              `INSERT INTO source_files (path, content, sha, revision, updated_at) VALUES (?1, ?2, ?3, last_insert_rowid(), unixepoch())
               ON CONFLICT (path) DO UPDATE SET content = excluded.content, sha = excluded.sha,
                 revision = excluded.revision, updated_at = excluded.updated_at`,
            )
            .bind(change.path, change.content, blobShas[change.path]),
    ]),
    db.prepare(`DELETE FROM source_guard`),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    if (/CHECK constraint failed/i.test(String(error))) {
      throw new SourceError("The content changed while this was being saved. Reload and reapply your edit.", 409, true);
    }
    throw error;
  }
  return { commitSha: (await getHead(env)).commitSha, blobShas };
}

type PostCommit = { sha: string; message: string; author: string; date: string };

/** A file's revisions, newest first. `sha` is the revision's blob sha, which readFile takes. */
async function listCommitsForPath(env: SourceEnv, path: string, limit = 20): Promise<PostCommit[]> {
  const rows = await env.DB.prepare(
    `SELECT sha, message, author, created_at FROM source_revisions
     WHERE path = ?1 AND sha IS NOT NULL ORDER BY id DESC LIMIT ?2`,
  )
    .bind(path, limit)
    .all<{ sha: string; message: string; author: string; created_at: number }>();
  return (rows.results ?? []).map((r) => ({
    sha: r.sha,
    message: r.message.split("\n")[0] ?? "",
    author: r.author,
    date: new Date(r.created_at * 1000).toISOString(),
  }));
}

/**
 * Carrel's revision list for one file: null when the file (or the id's owner) is absent. Each revision is the whole
 * file, so it holds every field. It names the person: every door that writes here (the admin's Access session, the
 * operator token, Carrel's key) is the site owner's, so the stored `author` names the door, which the message's
 * `[carrel:<change id>]` already carries. Carrel's actor (site-api 0.19.0) will name the person behind its key.
 */
export async function fileRevisions(env: SourceEnv, path: string | null) {
  if (!path || !(await readFile(env, path))) return null;
  const commits = await listCommitsForPath(env, path, 50);
  return commits.map((c) => ({
    version: c.sha,
    at: c.date,
    author: IDENTITY.name,
    authors: [IDENTITY.name],
    message: c.message.slice(0, 2000),
  }));
}

/** One file as it stood at a version, for Carrel: null for an absent path or an unknown version. */
export async function fileRevisionSource(env: SourceEnv, path: string | null, version: string) {
  if (!path) return null;
  return (await readFile(env, path, version))?.content ?? null;
}

