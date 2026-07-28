/**
 * The editor's write path, end to end.
 *
 *   browser -> action -> gates -> GitHub commit -> generate -> D1
 *
 * The order matters and is the ruling of 2026-07-28: files are the source of
 * truth, so nothing reaches D1 that is not already committed. If GitHub is
 * unreachable the save fails whole and both the repository and the database are
 * left exactly as they were.
 *
 * The gates run here, server side, because a commit created through the GitHub
 * API never touches the local PreToolUse hooks. Without these checks the claim
 * that all prose passes the same gates would be false for everything written in
 * the editor.
 */

import { imageSize } from "image-size";

import {
  ContentError,
  findWideDashes,
  renderPost,
} from "~/lib/content/pipeline.mjs";
// Side-effect import: installs the Worker WASM loader before anything renders.
import "~/lib/content/wasm.server";
import { SITE_ORIGIN } from "~/lib/seo";
import { commitFiles, getHead, readFile, GitHubError } from "./github.server";

export { GitHubError };

const ARTIFACT_PATH = "content/generated/posts.json";
const postPath = (slug: string) => `content/posts/${slug}.md`;

/** A save rejected by a gate. `field` and `line` are for pointing at the cause. */
export class EditorError extends Error {
  field?: string;
  line?: number;

  constructor(message: string, options: { field?: string; line?: number } = {}) {
    super(message);
    this.name = "EditorError";
    this.field = options.field;
    this.line = options.line;
  }
}

type PublishEnv = Env & { GITHUB_TOKEN?: string };

/**
 * Measures an image the editor referenced.
 *
 * `/media/*` is read straight from the R2 binding, because an image uploaded a
 * moment ago is in the bucket but may not be reachable over the public origin
 * yet. Anything else is a committed asset under `public/`, fetched from the
 * canonical origin.
 */
function makeResolveImage(env: PublishEnv) {
  return async (src: string) => {
    if (!src.startsWith("/")) {
      throw new EditorError(`Image src "${src}" must be a site-absolute path.`);
    }

    let bytes: Uint8Array;
    if (src.startsWith("/media/")) {
      const object = await env.MEDIA.get(src.slice("/media/".length));
      if (!object) {
        throw new EditorError(`Image "${src}" is not in the media bucket.`);
      }
      bytes = new Uint8Array(await object.arrayBuffer());
    } else {
      const response = await fetch(`${SITE_ORIGIN}${src}`);
      if (!response.ok) {
        throw new EditorError(
          `Image "${src}" could not be fetched (${response.status}).`,
        );
      }
      bytes = new Uint8Array(await response.arrayBuffer());
    }

    const size = imageSize(bytes);
    if (!size.width || !size.height) {
      throw new EditorError(`Image "${src}" has no readable dimensions.`);
    }
    return { width: size.width, height: size.height };
  };
}

/**
 * Runs both gates against submitted markdown and renders it.
 *
 * Frontmatter validation and the wide-dash check happen before anything is
 * written anywhere. A rejection names the field or the line.
 */
export async function validateAndRender(
  env: PublishEnv,
  slug: string,
  raw: string,
) {
  const dashes = findWideDashes(raw);
  if (dashes.length > 0) {
    const first = dashes[0];
    throw new EditorError(
      `Wide dash ${first.char} on line ${first.line}, column ${first.column}. ` +
        `House style uses commas, periods, parentheses or colons. Context: "${first.excerpt}"` +
        (dashes.length > 1 ? ` (${dashes.length - 1} more)` : ""),
      { line: first.line },
    );
  }

  try {
    return await renderPost({
      file: postPath(slug),
      raw,
      expectedSlug: slug,
      resolveImage: makeResolveImage(env),
    });
  } catch (error) {
    if (error instanceof ContentError) {
      throw new EditorError(error.message.replace(`${postPath(slug)}: `, ""));
    }
    throw error;
  }
}

/** Serializes the artifact exactly as scripts/build-content.mjs does. */
function serializeArtifact(posts: unknown[]) {
  return `${JSON.stringify({ posts }, null, 2)}\n`;
}

/**
 * Reads the committed artifact and returns its posts, so a save can splice one
 * entry without re-rendering every other post.
 */
async function loadArtifact(env: PublishEnv) {
  const file = await readFile(env, ARTIFACT_PATH);
  if (!file) return [] as any[];
  try {
    return (JSON.parse(file.content).posts ?? []) as any[];
  } catch {
    throw new EditorError(
      `${ARTIFACT_PATH} in the repository is not valid JSON, so it cannot be updated safely.`,
    );
  }
}

function sortBySlug(posts: any[]) {
  return posts
    .slice()
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/** The head commit, recorded when the editor loads and echoed back on save. */
export async function currentHead(env: PublishEnv) {
  return (await getHead(env)).commitSha;
}

/**
 * Saves a post: gates, commit, then D1.
 *
 * Both the markdown and the regenerated artifact go in one commit, so the check
 * gate is never left red by an editor save.
 */
export async function savePost(
  env: PublishEnv,
  options: {
    slug: string;
    raw: string;
    expectedHeadSha?: string | null;
    isNew: boolean;
  },
) {
  const record = await validateAndRender(env, options.slug, options.raw);

  if (options.isNew) {
    const existing = await readFile(env, postPath(options.slug));
    if (existing) {
      throw new EditorError(
        `A post with the slug "${options.slug}" already exists.`,
        { field: "slug" },
      );
    }
  }

  const posts = await loadArtifact(env);
  const next = sortBySlug([
    ...posts.filter((p) => p.slug !== options.slug),
    record,
  ]);

  const { commitSha } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: `${options.isNew ? "Add" : "Update"} post: ${record.title}`,
    changes: [
      { path: postPath(options.slug), content: options.raw },
      { path: ARTIFACT_PATH, content: serializeArtifact(next) },
    ],
  });

  // Only now, with the commit landed, does the database change.
  await syncPostToD1(env, record);

  return { commitSha, record };
}

/** Deletes a post: the file, the artifact entry, and the rows, in that order. */
export async function deletePost(
  env: PublishEnv,
  options: { slug: string; expectedHeadSha?: string | null },
) {
  const existing = await readFile(env, postPath(options.slug));
  if (!existing) {
    throw new EditorError(`No post file exists for "${options.slug}".`);
  }

  const posts = await loadArtifact(env);
  const next = sortBySlug(posts.filter((p) => p.slug !== options.slug));

  const { commitSha } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: `Remove post: ${options.slug}`,
    changes: [
      { path: postPath(options.slug), content: null },
      { path: ARTIFACT_PATH, content: serializeArtifact(next) },
    ],
  });

  await deletePostFromD1(env, options.slug);

  return { commitSha };
}

/**
 * Writes one rendered post into D1 and rebuilds the search index.
 *
 * Uses batch() so the row, its tags and the index move together. The FTS index
 * is rebuilt rather than left to the per-row triggers, matching what
 * scripts/sync-content.mjs does for the same reason.
 */
export async function syncPostToD1(env: PublishEnv, record: any) {
  const db = env.DB;
  const publishAt = Math.floor(Date.parse(record.publishAt) / 1000);
  const status = record.draft ? "draft" : "published";

  const statements = [
    db
      .prepare(
        `INSERT INTO posts (slug, kind, title, body, html, description, status, publish_at,
           cover_image, cover_alt, reading_time_minutes, source_path, toc, updated_at)
         VALUES (?1, 'post', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET
           kind = excluded.kind, title = excluded.title, body = excluded.body,
           html = excluded.html, description = excluded.description, status = excluded.status,
           publish_at = excluded.publish_at, cover_image = excluded.cover_image,
           cover_alt = excluded.cover_alt, reading_time_minutes = excluded.reading_time_minutes,
           source_path = excluded.source_path, toc = excluded.toc, updated_at = unixepoch()`,
      )
      .bind(
        record.slug,
        record.title,
        record.markdown,
        record.html,
        record.description,
        status,
        publishAt,
        record.cover ? record.cover.src : null,
        record.cover ? record.cover.alt : null,
        record.readingTimeMinutes,
        record.sourcePath,
        JSON.stringify(record.toc),
      ),
    ...record.tags.map((tag: string) =>
      db
        .prepare(`INSERT OR IGNORE INTO tags (slug, name) VALUES (?1, ?1)`)
        .bind(tag),
    ),
    db
      .prepare(
        `DELETE FROM post_tags WHERE post_id = (SELECT id FROM posts WHERE slug = ?1)`,
      )
      .bind(record.slug),
    ...record.tags.map((tag: string) =>
      db
        .prepare(
          `INSERT INTO post_tags (post_id, tag_id)
           SELECT p.id, t.id FROM posts p, tags t WHERE p.slug = ?1 AND t.slug = ?2`,
        )
        .bind(record.slug, tag),
    ),
    db.prepare(`INSERT INTO posts_fts (posts_fts) VALUES ('rebuild')`),
  ];

  await db.batch(statements);
}

/** Removes a post's rows. Tag rows stay, matching the bulk sync's behaviour. */
export async function deletePostFromD1(env: PublishEnv, slug: string) {
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM post_tags WHERE post_id = (SELECT id FROM posts WHERE slug = ?1)`,
    ).bind(slug),
    env.DB.prepare(`DELETE FROM posts WHERE slug = ?1`).bind(slug),
    env.DB.prepare(`INSERT INTO posts_fts (posts_fts) VALUES ('rebuild')`),
  ]);
}

/**
 * Re-syncs every post in the committed artifact into D1.
 *
 * The recovery path for drift between commits made from a clone and commits
 * made in the editor. It reads the artifact rather than re-rendering, so it
 * republishes exactly what the gate last approved.
 */
export async function regenerateAllFromArtifact(env: PublishEnv) {
  const posts = await loadArtifact(env);

  const keep = posts.map((p) => p.slug);
  if (keep.length > 0) {
    const placeholders = keep.map((_, i) => `?${i + 1}`).join(", ");
    await env.DB.prepare(
      `DELETE FROM posts WHERE source_path IS NOT NULL AND slug NOT IN (${placeholders})`,
    )
      .bind(...keep)
      .run();
  } else {
    await env.DB.prepare(
      `DELETE FROM posts WHERE source_path IS NOT NULL`,
    ).run();
  }

  for (const post of posts) {
    await syncPostToD1(env, post);
  }

  return { synced: posts.length };
}
