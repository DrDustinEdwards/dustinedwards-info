// Nothing reaches D1 that is not already committed. The gates run here because a commit made
// through the GitHub API never passes the local hooks.

import { imageSize } from "image-size";

import { mediaRefKey } from "~/lib/media-ref-key.mjs";
import { combinePurges, purgePost, purgePosts, type PurgeOutcome } from "~/lib/cache-purge.server";
import { recordsForPost } from "~/lib/search/records.mjs";
import { askAvailable, removeAskPost, syncAskPost } from "~/lib/search/ask.server";

import { postPath } from "~/lib/content/slug.mjs";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { dimensionsFromKey } from "~/lib/media/classify.mjs";
import { ASSET_MANIFEST_PATH } from "~/lib/media/manifest.mjs";
import {
  commitFiles,
  getHead,
  listDirectory,
  readFile,
  readBinaryFile,
  GitHubError,
} from "./github.server";
import { convergeWithRetry } from "./converge.mjs";
import { clearDivergence, recordDivergence } from "./divergence.server";
import { decide, decideDelete, PolicyError, type Actor } from "./publish-policy.mjs";
import { listPostCorpusForRelated, listPostLinkCorpus } from "~/db";
import { revokeAllPreviewLinks } from "~/lib/preview-links.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { statusForDraft } from "~/lib/search/visibility.mjs";

export { GitHubError, PolicyError };
export type { Actor };

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

/** Not an error: thrown rather than returned so a caller that forgets a flag cannot skip the ceremony. */
export class FirstPublishConfirmationRequired extends Error {
  constructor() {
    super("This post has never been public. The first publication needs confirming.");
    this.name = "FirstPublishConfirmationRequired";
  }
}

type PublishEnv = Env & { GITHUB_TOKEN?: string };

type AssetManifest = { placeholders?: Record<string, { sha: string; lqip: string }> };

/**
 * Must agree with scripts/lib/content.mjs, which builds from a clone: /media/* from the key, public/*
 * and its placeholder from the repo at the pinned ref, never this Worker's manifest from the last deploy.
 */
export function makeResolveImage(env: PublishEnv) {
  let manifest: Promise<AssetManifest> | null = null;
  const placeholders = async () => {
    // A missing or unparseable manifest refuses the save, as the build from a clone does: rendering
    // without placeholders would commit HTML that disagrees with the next build.
    manifest ??= readFile(env, ASSET_MANIFEST_PATH).then((file) => {
      if (!file) {
        throw new EditorError(
          `${ASSET_MANIFEST_PATH} is not in the repository, so no placeholder can be read.`,
        );
      }
      try {
        return JSON.parse(file.content) as AssetManifest;
      } catch (error) {
        throw new EditorError(
          `${ASSET_MANIFEST_PATH} did not parse: ` +
            `${errorMessage(error)}`,
        );
      }
    });
    return (await manifest).placeholders ?? {};
  };

  return async (src: string) => {
    if (!src.startsWith("/")) {
      throw new EditorError(`Image src "${src}" must be a site-absolute path.`);
    }

    if (src.startsWith("/media/")) {
      const dimensions = dimensionsFromKey(src);
      if (!dimensions) {
        throw new EditorError(
          `Image "${src}" carries no dimensions in its key. Uploaded images ` +
            `are keyed dustin-edwards-[<name>-]<hash>-<width>x<height>.<ext>; re-upload it to get a ` +
            `key the build can measure.`,
        );
      }
      return dimensions;
    }

    const bytes = await readBinaryFile(env, `public${src}`);
    if (!bytes) {
      throw new EditorError(
        `Image "${src}" is not in the repository at public${src}.`,
      );
    }

    const size = imageSize(bytes);
    if (!size.width || !size.height) {
      throw new EditorError(`Image "${src}" has no readable dimensions.`);
    }
    const placeholder = (await placeholders())[src]?.lqip;
    return { width: size.width, height: size.height, ...(placeholder ? { placeholder } : {}) };
  };
}

export async function validateAndRender(
  env: PublishEnv,
  slug: string,
  raw: string,
) {
  const { ContentError, findWideDashes, renderPost } = await loadPipeline();
  const dashes = findWideDashes(raw);
  const first = dashes[0];
  if (first) {
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

/** Only this post's list is written: relatedness is corpus-wide, so other rows wait for the bulk sync. */
async function relatedFor(env: PublishEnv, record: any) {
  const { withRelated } = await loadPipeline();
  const corpus = await listPostCorpusForRelated(env);
  const others = corpus
    .filter((p) => p.slug !== record.slug)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      tags: p.tags,
      draft: p.status === "draft",
      // ISO strings: string order over ISO timestamps is chronological order.
      publishAt: p.publishAt ? p.publishAt.toISOString() : "",
    }));
  // The saved post goes LAST, so its entry is at a position that cannot miss.
  const computed = withRelated([
    ...others,
    {
      slug: record.slug,
      title: record.title,
      description: record.description,
      tags: record.tags,
      draft: record.draft,
      publishAt: record.publishAt,
    },
  ]);
  return computed[computed.length - 1].related;
}

/** Only this post's list is written, as in relatedFor; the saved post goes LAST for the same reason. */
async function backlinksFor(env: PublishEnv, record: any) {
  const { withBacklinks } = await loadPipeline();
  const corpus = await listPostLinkCorpus(env);
  const others = corpus
    .filter((p) => p.slug !== record.slug)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      html: p.html ?? "",
      draft: p.status === "draft",
      // ISO strings: string order over ISO timestamps is chronological order.
      publishAt: p.publishAt ? p.publishAt.toISOString() : "",
    }));
  const computed = withBacklinks([
    ...others,
    {
      slug: record.slug,
      title: record.title,
      html: record.html,
      draft: record.draft,
      publishAt: record.publishAt,
    },
  ]);
  return computed[computed.length - 1].backlinks;
}

/**
 * The only writer of a rendered row. blobSha proves the rendered bytes are the committed bytes, so a
 * truncated fetch fails here by name.
 */
export async function renderAndWrite(
  env: PublishEnv,
  slug: string,
  raw: string,
  blobSha?: string | null,
) {
  // any: related and backlinks are attached below and the pipeline's inferred type lacks them.
  const record: any = await validateAndRender(env, slug, raw);

  if (blobSha && record.sourceBlobSha !== blobSha) {
    throw new EditorError(
      `the markdown rendered for "${slug}" is not the markdown the repository holds: ` +
        `the rendered bytes hash to ${record.sourceBlobSha}, the repository file is ` +
        `${blobSha}. The read was truncated or the file changed mid-flight; re-read ` +
        `the file and retry.`,
    );
  }

  record.related = await relatedFor(env, record);
  record.backlinks = await backlinksFor(env, record);
  await syncPostToD1(env, record);

  // Purges on a draft save too: an unpublish writes a draft row while changing every public listing.
  // A condition, if ever needed, must read the PREVIOUS status, never the incoming record. A failed purge
  // never fails the write, but it is returned: the public pages stay stale until the cache expires.
  const purged = await purgePosts(`renderAndWrite ${slug}`);

  return { record, purged };
}

export async function currentHead(env: PublishEnv) {
  return (await getHead(env)).commitSha;
}

/**
 * Renders twice by design: as the gate before the commit, and inside renderAndWrite after it, since
 * D1 is written only from a row that door produced.
 */
export async function savePost(
  env: PublishEnv,
  options: {
    slug: string;
    raw: string;
    expectedHeadSha?: string | null;
    isNew: boolean;
    /** Required: there is no safe default for an identity. */
    actor: Actor;
    /** Absent means this caller has no ceremony, so the check is === false, not falsiness. */
    firstPublishConfirmed?: boolean;
  },
) {
  const { actor } = options;

  // Read before rendering: it is the only authority on "ever published", and a refusal should not pay for a render.
  const existing = await readFile(env, postPath(options.slug));

  if (options.isNew && existing) {
    throw new EditorError(
      `A post with the slug "${options.slug}" already exists.`,
      { field: "slug" },
    );
  }

  // Throws PolicyError on an operator's first publish, and stamps first_published over what the caller sent.
  const decision = decide({
    actor,
    incomingRaw: options.raw,
    priorRaw: existing ? existing.content : null,
  });
  const raw = decision.raw;

  // After decide(), so a credential that may not publish at all is refused rather than asked to confirm.
  if (decision.outcome === "published-first" && options.firstPublishConfirmed === false) {
    throw new FirstPublishConfirmationRequired();
  }

  // The gate: rendered from the STAMPED markdown before the commit, and its result is discarded.
  const gated = await validateAndRender(env, options.slug, raw);

  const { commitSha, blobShas } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: commitMessage(actor, options.isNew ? "Add" : "Update", gated.title),
    changes: [{ path: postPath(options.slug), content: raw }],
  });

  // No compensating revert, ever: undoing the commit would destroy the source to repair a derived index.
  let record = gated;
  // False until a write lands: an unreached purge leaves the pages as stale as a failed one.
  let purged: PurgeOutcome = false;
  const converged = await convergeWithRetry({
    write: async () => {
      ({ record, purged } = await renderAndWrite(
        env,
        options.slug,
        raw,
        blobShas[postPath(options.slug)] ?? null,
      ));
    },
    recordDivergence: (facts) => recordDivergence(env, facts),
    slug: options.slug,
    commitSha,
  });

  // Clear a stale divergence, or the status surface keeps reporting a repaired fault. Never fails the save.
  try {
    await clearDivergence(env, options.slug);
  } catch (error) {
    console.error("failed to clear a divergence record after a successful save", error);
  }

  // Revoked AFTER the D1 sync: the read path checks status = 'draft', so revoking first opens a window.
  // A surviving token is inert, so a failure does not throw.
  let previewLinksRevoked: number | null = null;
  if (decision.published) {
    try {
      previewLinksRevoked = await revokeAllPreviewLinks(env, options.slug);
    } catch (error) {
      // null already means "not attempted", so a failure needs its own value.
      console.error("preview link revocation failed after publish", error);
      previewLinksRevoked = -1;
    }
  }

  // The Ask index must not fail a save: the commit has landed, and a failure here would split repo and D1.
  const askSync = await syncAskForPost(env, record);

  return {
    commitSha,
    record,
    askSync,
    /** False when the cache purge failed or was never reached, null when the runtime cannot purge. */
    purged,
    d1Retried: converged.retried,
    /** null: not attempted; -1: the attempt threw. */
    previewLinksRevoked,
    firstPublished: decision.firstPublished,
    published: decision.published,
    outcome: decision.outcome,
  };
}

function commitMessage(actor: Actor, verb: string, title: string) {
  const base = `${verb} post: ${title}`;
  return actor.kind === "operator" ? `${base} [operator:${actor.id}]` : base;
}

async function syncAskForPost(env: PublishEnv, record: { slug: string }) {
  if (!askAvailable(env)) return null;
  try {
    const result = await syncAskPost(env, record);
    if (result.failed.length > 0) {
      return {
        ok: false as const,
        message:
          `${result.failed.length} of ${result.failed.length + result.uploaded} Ask ` +
          `record(s) failed to upload after a retry: ${result.failed.join(", ")}. ` +
          `The post saved. Re-run the Ask sync from /admin/posts to finish indexing it.`,
      };
    }
    return { ok: true as const, ...result };
  } catch (error) {
    console.error("ask index sync failed after save", error);
    return { ok: false as const, message: errorMessage(error) };
  }
}

export async function deletePost(
  env: PublishEnv,
  options: { slug: string; expectedHeadSha?: string | null; actor: Actor },
) {
  const { actor } = options;

  // First statement: after the file read, two different errors would reveal which slugs exist.
  decideDelete({ actor });

  const existing = await readFile(env, postPath(options.slug));
  if (!existing) {
    throw new EditorError(`No post file exists for "${options.slug}".`);
  }

  const { commitSha } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: commitMessage(actor, "Remove", options.slug),
    changes: [{ path: postPath(options.slug), content: null }],
  });

  const { purged } = await deletePostFromD1(env, options.slug);

  return { commitSha, purged, askRemoval: await removeAskForPost(env, options.slug) };
}

/**
 * The Ask index cannot fail the delete, but a post still answerable through Ask is reported, not
 * swallowed. Null means Ask is not configured; a failure is `ok: false`, never the same null.
 */
async function removeAskForPost(env: PublishEnv, slug: string) {
  if (!askAvailable(env)) return null;
  try {
    return { ok: true as const, removed: await removeAskPost(env, slug) };
  } catch (error) {
    console.error("ask index removal failed after delete", error);
    return {
      ok: false as const,
      message:
        `The post was deleted but its Ask records were not removed, so Ask can still quote it: ` +
        `${errorMessage(error)}. Re-run the Ask sync to prune them.`,
    };
  }
}

/** One batch, so the row, its tags and the index move together. FTS is rebuilt, as the bulk sync does. */
export async function syncPostToD1(env: PublishEnv, record: any) {
  const db = env.DB;
  const publishAt = Math.floor(Date.parse(record.publishAt) / 1000);
  const status = statusForDraft(record.draft);

  const statements = [
    db
      .prepare(
        `INSERT INTO posts (slug, kind, title, body, html, description, status, publish_at,
           cover_image, cover_alt, reading_time_minutes, source_path, toc, featured, series, part,
           further_reading, og_title, og_description, related, source_blob_sha, render_hash,
           writing_status, assumed_audience, key_takeaways, changelog, backlinks,
           updated_at)
         VALUES (?1, 'post', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
           ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET
           kind = excluded.kind, title = excluded.title, body = excluded.body,
           html = excluded.html, description = excluded.description, status = excluded.status,
           publish_at = excluded.publish_at, cover_image = excluded.cover_image,
           cover_alt = excluded.cover_alt, reading_time_minutes = excluded.reading_time_minutes,
           source_path = excluded.source_path, toc = excluded.toc, featured = excluded.featured,
           series = excluded.series, part = excluded.part,
           further_reading = excluded.further_reading, og_title = excluded.og_title,
           og_description = excluded.og_description, related = excluded.related,
           source_blob_sha = excluded.source_blob_sha, render_hash = excluded.render_hash,
           writing_status = excluded.writing_status,
           assumed_audience = excluded.assumed_audience,
           key_takeaways = excluded.key_takeaways, changelog = excluded.changelog,
           backlinks = excluded.backlinks,
           updated_at = unixepoch()`,
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
        record.featured ? 1 : 0,
        record.series,
        record.part,
        JSON.stringify(record.furtherReading),
        record.ogTitle,
        record.ogDescription,
        JSON.stringify(record.related ?? []),
        record.sourceBlobSha ?? null,
        record.renderHash ?? null,
        // NULL, not an empty string, when absent: an empty value would read as the author saying something.
        record.writingStatus ?? null,
        record.assumedAudience ?? null,
        record.keyTakeaways ? JSON.stringify(record.keyTakeaways) : null,
        record.changelog ? JSON.stringify(record.changelog) : null,
        record.backlinks ? JSON.stringify(record.backlinks) : null,
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
    ...searchStatements(db, record),
    ...mediaRefStatements(db, record),
  ];

  await db.batch(statements);
}

/** Scoped to this slug, unlike the bulk sync, and in the post's batch so citations land with the save. */
function mediaRefStatements(db: D1Database, record: any) {
  const statements = [
    db.prepare(`DELETE FROM media_refs WHERE source_type = 'post' AND source_id = ?1`).bind(
      record.slug,
    ),
  ];
  const seen = new Set<string>();
  for (const ref of record.mediaRefs ?? []) {
    // mediaRefKey joins with NUL: any printable separator collides, since details carry spaces.
    const id = mediaRefKey({
      mediaKey: ref.key,
      form: ref.form,
      detail: ref.detail ?? null,
    });
    if (seen.has(id)) continue;
    seen.add(id);
    statements.push(
      db
        .prepare(
          `INSERT INTO media_refs (media_key, source_type, source_id, form, detail)
           VALUES (?1, 'post', ?2, ?3, ?4)`,
        )
        .bind(ref.key, record.slug, ref.form, ref.detail ?? null),
    );
  }
  return statements;
}

/** Incremental is safe here, unlike related: a post's sections depend only on its own markdown. */
function searchStatements(db: D1Database, record: any) {
  const records = recordsForPost(record);
  return [
    db.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(`post:${record.slug}`),
    ...records.map((r) =>
      db
        .prepare(
          `INSERT INTO search_docs (uid, url, type, title, body, tags, doc_tags, doc_uid,
             doc_title, doc_url, anchor, ordinal, status, publish_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
        )
        .bind(
          r.uid,
          r.url,
          r.type,
          r.title,
          r.body,
          r.tags,
          r.docTags,
          r.docUid,
          r.docTitle,
          r.docUrl,
          r.anchor,
          r.ordinal,
          r.status,
          r.publishAt ? Math.floor(Date.parse(r.publishAt) / 1000) : null,
        ),
    ),
    db.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    db.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
  ];
}

/** Tag rows stay, as in the bulk sync. Stale media_refs would block deleting the image forever. */
export async function deletePostFromD1(env: PublishEnv, slug: string) {
  // Purged BEFORE the delete: a purge landing after a slow delete could re-store the removed page.
  const purgedPage = await purgePost(slug, `deletePostFromD1 ${slug}`);
  const purgedListings = await purgePosts(`deletePostFromD1 ${slug}`);
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM post_tags WHERE post_id = (SELECT id FROM posts WHERE slug = ?1)`,
    ).bind(slug),
    env.DB.prepare(`DELETE FROM posts WHERE slug = ?1`).bind(slug),
    env.DB.prepare(`INSERT INTO posts_fts (posts_fts) VALUES ('rebuild')`),
    env.DB.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(`post:${slug}`),
    env.DB.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    env.DB.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
    env.DB.prepare(
      `DELETE FROM media_refs WHERE source_type = 'post' AND source_id = ?1`,
    ).bind(slug),
  ]);
  return { purged: combinePurges(purgedPage, purgedListings) };
}

/** Every row arrives through renderAndWrite, the same door a save uses, with the blob sha to prove its bytes. */
export async function regenerateAllFromRepo(env: PublishEnv) {
  const entries = await listDirectory(env, "content/posts");
  const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));

  // An empty listing is a broken read or a deleted directory; converging on it would delete every row.
  if (files.length === 0) {
    throw new EditorError(
      "content/posts listed no markdown files. An empty corpus is not a state " +
        "this site has ever had, so this refuses rather than deleting every row.",
    );
  }

  // Through deletePostFromD1, the one delete door: a bare row delete would leave the post in /search
  // and its media_refs blocking its images' deletion forever.
  const keep = files.map((f) => f.name.slice(0, -".md".length));
  const placeholders = keep.map((_, i) => `?${i + 1}`).join(", ");
  const orphans = await env.DB.prepare(
    `SELECT slug FROM posts WHERE source_path IS NOT NULL AND slug NOT IN (${placeholders})`,
  )
    .bind(...keep)
    .all<{ slug: string }>();
  let unpurged = 0;
  for (const { slug } of orphans.results ?? []) {
    if ((await deletePostFromD1(env, slug)).purged === false) unpurged += 1;
  }

  for (const entry of files) {
    const slug = entry.name.slice(0, -".md".length);
    const file = await readFile(env, entry.path);
    if (!file) {
      throw new EditorError(
        `"${entry.path}" vanished between the directory listing and the read. ` +
          `Main moved mid-rebuild; re-run the regenerate.`,
      );
    }
    if ((await renderAndWrite(env, slug, file.content, entry.sha)).purged === false) unpurged += 1;
  }

  return { synced: files.length, removed: orphans.results?.length ?? 0, unpurged };
}
