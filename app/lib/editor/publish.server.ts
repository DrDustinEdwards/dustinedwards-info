// No rendered row is written from a source that is not already stored. The gates run here because a save is
// the only door into the source: no hook or CI run sees it first.

import { imageSize } from "image-size";
import { purgePosts, type PurgeOutcome } from "~/lib/cache-purge.server";
import { askSyncAfterWrite } from "~/lib/search/ask.server";
import { postPath } from "~/lib/content/slug.mjs";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { dimensionsFromKey } from "~/lib/media/classify.mjs";
import {
  commitFiles,
  getHead,
  listPostFiles,
  readFile,
  readBinaryFile,
  assetPlaceholders,
  SourceError,
  blobGuard,
} from "~/lib/source/store.server";
import { convergeWithRetry } from "./converge.mjs";
import { clearDivergence, recordDivergence } from "./divergence.server";
import { decide, decideDelete, PolicyError, type Actor } from "./publish-policy.mjs";
import { commitUnlessUnchanged, taggedMessage } from "./write-path.server";
import { listPostCorpusForRelated, listPostLinkCorpus } from "~/db";
import { errorMessage } from "@dustinedwards/site-runtime/log";
import {
  deletePostFromD1,
  syncPostToD1,
  type PostRecord,
  type PublishEnv,
} from "./post-rows.server";
import { refreshNeighborsAfterSave } from "./neighbors.server";

export { SourceError, PolicyError };
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

/**
 * Must agree with scripts/lib/content.mjs, which builds from the checkout: /media/* from the key, public/* and its
 * placeholder from the files this deploy serves and the manifest it was built with.
 */
export function makeResolveImage(env: PublishEnv) {
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
      throw new EditorError(`Image "${src}" is not a static file of this deploy (public${src}).`);
    }

    const size = imageSize(bytes);
    if (!size.width || !size.height) {
      throw new EditorError(`Image "${src}" has no readable dimensions.`);
    }
    const placeholder = assetPlaceholders()[src]?.lqip;
    return { width: size.width, height: size.height, ...(placeholder ? { placeholder } : {}) };
  };
}

export async function validateAndRender(env: PublishEnv, slug: string, raw: string) {
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
      readChartData: async (key: string) => (await env.MEDIA.get(key))?.text() ?? null,
    });
  } catch (error) {
    if (error instanceof ContentError) {
      throw new EditorError(error.message.replace(`${postPath(slug)}: `, ""));
    }
    throw error;
  }
}

/**
 * Runs a whole-corpus computation for the saved post alone and returns its entry. The other posts
 * come from D1 with their status and date in the pipeline's shape; the saved post comes from its
 * fresh render and goes LAST, so its entry is at a position that cannot miss.
 */
function computeForSaved<C extends { slug: string; status: string; publishAt: Date | null }, E>(
  record: PostRecord,
  corpus: C[],
  fields: (post: C) => E,
  saved: E,
  compute: (posts: unknown[]) => Array<{ related?: unknown[]; backlinks?: unknown[] }>,
) {
  const others = corpus
    .filter((p) => p.slug !== record.slug)
    .map((p) => ({
      slug: p.slug,
      ...fields(p),
      draft: p.status === "draft",
      publishAt: p.publishAt ? p.publishAt.toISOString() : "",
    }));
  const computed = compute([
    ...others,
    { slug: record.slug, ...saved, draft: record.draft, publishAt: record.publishAt },
  ]);
  const entry = computed[computed.length - 1];
  if (!entry) throw new Error(`the corpus computation returned nothing for ${record.slug}`);
  return entry;
}

/** Only this post's list is computed here: relatedness is corpus-wide, and the other rows follow in refreshNeighbors. */
async function relatedFor(env: PublishEnv, record: PostRecord) {
  const { withRelated } = await loadPipeline();
  return computeForSaved(
    record,
    await listPostCorpusForRelated(env),
    (p) => ({ title: p.title, description: p.description, tags: p.tags }),
    { title: record.title, description: record.description, tags: record.tags },
    withRelated,
  ).related;
}

/** Only this post's list is computed here, as in relatedFor. */
async function backlinksFor(env: PublishEnv, record: PostRecord) {
  const { withBacklinks } = await loadPipeline();
  return computeForSaved(
    record,
    await listPostLinkCorpus(env),
    (p) => ({ title: p.title, html: p.html ?? "" }),
    { title: record.title, html: record.html },
    withBacklinks,
  ).backlinks;
}

/**
 * The row renderAndWrite writes, without writing it: the render plus the corpus-wide related and
 * backlinks lists. The Carrel preview renders this, so a preview is the page the save would publish.
 */
export async function renderRecord(env: PublishEnv, slug: string, raw: string) {
  const record: PostRecord = await validateAndRender(env, slug, raw);
  record.related = await relatedFor(env, record);
  record.backlinks = await backlinksFor(env, record);
  return record;
}

/**
 * The only writer of a rendered row. blobSha proves the rendered bytes are the stored bytes, so a
 * truncated fetch fails here by name.
 */
export async function renderAndWrite(
  env: PublishEnv,
  slug: string,
  raw: string,
  blobSha?: string | null,
) {
  const record = await renderRecord(env, slug, raw);

  if (blobSha && record.sourceBlobSha !== blobSha) {
    throw new EditorError(
      `the markdown rendered for "${slug}" is not the markdown the store holds: ` +
        `the rendered bytes hash to ${record.sourceBlobSha}, the stored file is ` +
        `${blobSha}. The read was truncated or the file changed mid-flight; re-read ` +
        `the file and retry.`,
    );
  }

  await syncPostToD1(env, record);

  // Purges on a draft save too (an unpublish changes every listing). A failed purge never fails the write; it is returned.
  const purged = await purgePosts(`renderAndWrite ${slug}`);

  return { record, purged };
}

export async function currentHead(env: PublishEnv) {
  return (await getHead(env)).commitSha;
}

/** True when D1's row for the post was rendered from exactly this file (the git blob sha matches). */
async function postRowIsCurrent(env: PublishEnv, slug: string, blobSha: string | null | undefined) {
  if (!blobSha) return false;
  const row = await env.DB.prepare("SELECT source_blob_sha FROM posts WHERE slug = ?1")
    .bind(slug)
    .first<{ source_blob_sha: string | null }>();
  return row?.source_blob_sha === blobSha;
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
    /** The blob sha of this post's file as the caller loaded it; Carrel's version of a post. Undefined: no check. */
    expectedBlobSha?: string | null;
    isNew: boolean;
    /** Required: there is no safe default for an identity. */
    actor: Actor;
  },
) {
  const { actor } = options;

  const existing = await readFile(env, postPath(options.slug));

  if (options.isNew && existing) {
    throw new EditorError(`A post with the slug "${options.slug}" already exists.`, {
      field: "slug",
    });
  }

  const decision = decide({
    actor,
    incomingRaw: options.raw,
    priorRaw: existing ? existing.content : null,
  });
  const raw = decision.raw;

  const gated = await validateAndRender(env, options.slug, raw);

  const written = await commitUnlessUnchanged(env, {
    existing,
    raw,
    rowIsCurrent: () => postRowIsCurrent(env, options.slug, gated.sourceBlobSha),
    commit: () =>
      commitFiles(env, {
        expectedHeadSha: options.expectedHeadSha,
        expectedBlobs: blobGuard(postPath(options.slug), options.expectedBlobSha),
        message: taggedMessage(actor, `${options.isNew ? "Add" : "Update"} post: ${gated.title}`),
        changes: [{ path: postPath(options.slug), content: raw }],
      }),
  });
  const unchanged = written.action !== "commit";
  if (written.action === "noop") {
    return {
      commitSha: written.commitSha,
      record: gated,
      askSync: null,
      neighbors: null,
      purged: null as PurgeOutcome,
      d1Retried: false,
      firstPublished: decision.firstPublished,
      published: false,
      outcome: decision.outcome,
      unchanged: true,
    };
  }
  const { commitSha, blobShas } = written;

  // No compensating revert, ever: undoing the commit would destroy the source to repair a derived index.
  let record = gated;
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
    console.error(
      JSON.stringify({ alert: "divergence-clear-failed", detail: errorMessage(error) }),
    );
  }

  const neighbors = await refreshNeighborsAfterSave(env, record.slug);

  const askSync = await askSyncAfterWrite(env, `post saved: ${record.slug}`);

  return {
    commitSha,
    record,
    askSync,
    /** Other posts' related and backlinks lists rewritten by this save, or why they could not be. */
    neighbors,
    /** False when the cache purge failed or was never reached, null when the runtime cannot purge. */
    purged,
    d1Retried: converged.retried,
    firstPublished: decision.firstPublished,
    published: decision.published,
    outcome: decision.outcome,
    unchanged,
  };
}

export async function deletePost(
  env: PublishEnv,
  options: {
    slug: string;
    expectedHeadSha?: string | null;
    expectedBlobSha?: string;
    actor: Actor;
  },
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
    // Carrel names a post by its blob sha: a file changed since it was loaded is refused at the head.
    expectedBlobs: blobGuard(postPath(options.slug), options.expectedBlobSha),
    message: taggedMessage(actor, `Remove post: ${options.slug}`),
    changes: [{ path: postPath(options.slug), content: null }],
  });

  // The file is gone, so a failed D1 delete is recorded and retried, as in savePost.
  let purged: PurgeOutcome = false;
  await convergeWithRetry({
    write: async () => {
      ({ purged } = await deletePostFromD1(env, options.slug));
    },
    recordDivergence: (facts) => recordDivergence(env, facts),
    slug: options.slug,
    commitSha,
  });

  return {
    commitSha,
    purged,
    askRemoval: await askSyncAfterWrite(env, `post deleted: ${options.slug}`),
  };
}

/**
 * A renamed post's rows under its old slug and its search records, cleared (site-api v0.17.0 rename): the file and its
 * history have moved to the new slug, whose save writes the rows again and asks the Ask index to sync. No sync here: a
 * slow one between the move and that save left a post moved but never saved when the request was cut off.
 */
export async function forgetPostRows(env: PublishEnv, slug: string) {
  return deletePostFromD1(env, slug);
}

/** Every row arrives through renderAndWrite, the same door a save uses, with the blob sha to prove its bytes. */
export async function regenerateAllFromRepo(env: PublishEnv) {
  const files = await listPostFiles(env);

  // An empty listing is a broken read or a deleted directory; converging on it would delete every row.
  if (files.length === 0) {
    throw new EditorError(
      "content/posts listed no markdown files. An empty corpus is not a state " +
        "this site has ever had, so this refuses rather than deleting every row.",
    );
  }

  // Through deletePostFromD1, the one delete door: a bare row delete would leave the post in /search
  // and its media_refs blocking its images' deletion forever.
  const keep = files.map((f) => f.slug);
  // One JSON parameter, not a placeholder per post, which D1 refuses past 100 (the pattern of db/media.ts).
  const orphans = await env.DB.prepare(
    `SELECT slug FROM posts WHERE source_path IS NOT NULL AND slug NOT IN (SELECT value FROM json_each(?1))`,
  )
    .bind(JSON.stringify(keep))
    .all<{ slug: string }>();
  let unpurged = 0;
  for (const { slug } of orphans.results ?? []) {
    if ((await deletePostFromD1(env, slug)).purged === false) unpurged += 1;
  }

  for (const entry of files) {
    const slug = entry.slug;
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
