import { env } from "cloudflare:test";

import { gitBlobSha } from "~/lib/content/hashes.mjs";

/* The content's source as a case starts: rows in D1's source_files (drizzle/0032), written through the same tables
 * the store reads, and the static files under public/ as the deploy's assets binding would serve them. A case's
 * writes land in D1, so it reads them back with `source` and `versionOf`; `restore` empties both. */

export type SourceStub = {
  /** The static files this deploy serves, by repository path (`public/...`). Change it to plant or remove one. */
  assets: Map<string, string>;
  restore: () => Promise<void>;
};

const bindings = env as typeof env & { ASSETS?: Fetcher };

export async function putSource(path: string, content: string, message = "Seed") {
  const sha = await gitBlobSha(content);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO source_revisions (path, content, sha, message, author) VALUES (?1, ?2, ?3, ?4, 'admin')`).bind(
      path,
      content,
      sha,
      message,
    ),
    env.DB.prepare(
      `INSERT INTO source_files (path, content, sha, revision) VALUES (?1, ?2, ?3, last_insert_rowid())
       ON CONFLICT (path) DO UPDATE SET content = excluded.content, sha = excluded.sha, revision = excluded.revision`,
    ).bind(path, content, sha),
  ]);
}

export async function removeSource(path: string) {
  await env.DB.prepare(`DELETE FROM source_files WHERE path = ?1`).bind(path).run();
}

/** A file's content now, or undefined when D1 holds none. */
export async function source(path: string): Promise<string | undefined> {
  const row = await env.DB.prepare(`SELECT content FROM source_files WHERE path = ?1`).bind(path).first<{ content: string }>();
  return row?.content;
}

/** A file's version (its blob sha) now. */
export async function versionOf(path: string): Promise<string> {
  const content = await source(path);
  if (content === undefined) throw new Error(`no source for ${path}`);
  return gitBlobSha(content);
}

/** The writes a case made after its seed, oldest first: one row per file written. */
export async function writes() {
  const rows = await env.DB.prepare(`SELECT path, content, message, author FROM source_revisions WHERE message != 'Seed' ORDER BY id`).all<{
    path: string;
    content: string | null;
    message: string;
    author: string;
  }>();
  return rows.results ?? [];
}

export async function stubSources(seed: Record<string, string> = {}): Promise<SourceStub> {
  const assets = new Map<string, string>();
  for (const [path, content] of Object.entries(seed)) {
    if (path.startsWith("public/")) assets.set(path, content);
    else await putSource(path, content);
  }
  const previous = bindings.ASSETS;
  bindings.ASSETS = {
    async fetch(input: RequestInfo | URL) {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body = assets.get(`public${decodeURI(url.pathname)}`);
      return body === undefined ? new Response("Not found", { status: 404 }) : new Response(body);
    },
    connect() {
      throw new Error("the assets stub does not connect");
    },
  } as unknown as Fetcher;
  return {
    assets,
    async restore() {
      bindings.ASSETS = previous;
      await env.DB.batch([env.DB.prepare(`DELETE FROM source_files`), env.DB.prepare(`DELETE FROM source_revisions`)]);
    },
  };
}
