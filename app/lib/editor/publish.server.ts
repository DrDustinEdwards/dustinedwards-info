/**
 * The editor's write path, end to end.
 *
 *   browser -> action -> gates -> GitHub commit (one markdown file) -> render -> D1
 *
 * THE ORDER MATTERS: files are the source of truth, so nothing reaches D1 that is not already
 * committed, and if GitHub is unreachable the save fails whole with both stores untouched.
 *
 * The gates run here, server side, because a commit made through the GitHub API never touches the
 * local PreToolUse hooks.
 */

import { imageSize } from "image-size";

import { mediaRefKey } from "~/lib/media-ref-key.mjs";
import { purgePost, purgePosts } from "~/lib/cache-purge.server";
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

export { GitHubError, PolicyError };
export type { Actor };

/**
 * Where a post's source file lives, as ONE statement of the rule. It was module-private and the
 * path was consequently restated in seven other places, three of them their own definitions.
 */
/*
 * RE-EXPORTED, not defined here: the definition moved beside `SLUG_PATTERN` because the pipeline
 * built the same path independently, which made the URL allowlist rule's "stated ONCE" false by one.
 */

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

/**
 * A first publication that nobody has confirmed yet. NOT AN ERROR: nothing failed and nothing was
 * refused, the write stopped one step short because the ceremony has not been answered.
 *
 * Thrown rather than returned so it cannot be skipped by a caller that forgets a flag, and thrown
 * from `savePost` because that is where the prior file is read, which is the only place that knows
 * whether this IS a first publication.
 */
export class FirstPublishConfirmationRequired extends Error {
  constructor() {
    super("This post has never been public. The first publication needs confirming.");
    this.name = "FirstPublishConfirmationRequired";
  }
}

type PublishEnv = Env & { GITHUB_TOKEN?: string };

/** The half of the asset manifest this module reads. Shape owned by manifest.mjs. */
type AssetManifest = { placeholders?: Record<string, { sha: string; lqip: string }> };

/**
 * Measures an image the editor referenced.
 *
 * BOTH BRANCHES EXIST TO AGREE WITH `scripts/lib/content.mjs`, and finding B002 is that neither
 * did: dimensions go into the stored HTML, so whatever this returns the Node build must return too,
 * from a clone, with no bindings and no network. So `/media/*` resolves from the KEY, `public/*`
 * from the REPOSITORY at the pinned ref rather than the origin, and THE PLACEHOLDER FROM THAT SAME
 * REF rather than this Worker's bundled manifest, which is the manifest as of the last DEPLOY.
 *
 * Exported so preview resolves images exactly as a save does: there must not be a second
 * implementation, preview's whole claim being that what it renders is what publishes.
 */
export function makeResolveImage(env: PublishEnv) {
  /** The committed manifest, fetched at most once per resolver. */
  let manifest: Promise<AssetManifest> | null = null;
  const placeholders = async () => {
    manifest ??= readFile(env, ASSET_MANIFEST_PATH).then((file) => {
      // A missing or unparseable manifest yields no placeholders rather than failing the save: refusing
      // to publish because a generated artifact could not be read would be a new way to lose an article.
      // Logged, because silence here is the drift.
      try {
        return file ? (JSON.parse(file.content) as AssetManifest) : {};
      } catch (error) {
        console.error(
          `${ASSET_MANIFEST_PATH} did not parse; rendering without placeholders. ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
        return {};
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
    // Absent for anything the manifest does not cover. Absent is a real answer: the image renders
    // without a placeholder, exactly as it did before this existed.
    const placeholder = (await placeholders())[src]?.lqip;
    return { width: size.width, height: size.height, ...(placeholder ? { placeholder } : {}) };
  };
}

/**
 * Runs both gates against submitted markdown and renders it, before anything is written anywhere.
 * A rejection names the field or the line.
 */
export async function validateAndRender(
  env: PublishEnv,
  slug: string,
  raw: string,
) {
  const { ContentError, findWideDashes, renderPost } = await loadPipeline();
  const dashes = findWideDashes(raw);
  // The first offender is guarded by VALUE rather than by list length, which is what lets the
  // message read its fields.
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

/**
 * The saved post's related list, computed against the D1 corpus. Only THIS post's list is written:
 * relatedness is a property of the whole corpus, so every other row's copy waits for the next bulk
 * sync, exactly as it did before.
 */
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
      // ISO strings, matching what `withRelated` compares: string order over ISO timestamps IS
      // chronological order.
      publishAt: p.publishAt ? p.publishAt.toISOString() : "",
    }));
  // The saved post goes LAST, so `withRelated` returns its entry at a position that cannot miss.
  // `find` with a fallback would be a substituting fallback on a can't-happen branch (rule 13).
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

/**
 * The saved post's backlink list, computed against the D1 corpus.
 *
 * ONLY THIS POST'S LIST IS WRITTEN, exactly as `relatedFor` above writes only this post's related
 * list. Saving a post also changes the backlinks of every post it links TO, and those rows wait for
 * the next bulk sync; recomputing them here would mean writing rows this door was not asked to
 * write.
 *
 * The corpus carries rendered bodies because that is where a link is read from, and the saved post
 * goes LAST so `withBacklinks` returns its entry at a position that cannot miss.
 */
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
      // ISO strings, matching what the pipeline compares: string order over ISO timestamps IS
      // chronological order.
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
 * THE ONLY DOOR TO A RENDERED ROW. Nothing else may write one, because two writers of one row shape
 * is the drift the committed artifact used to exist to catch.
 *
 * `blobSha` proves the rendered bytes ARE the committed bytes, so a truncated fetch fails here by
 * name instead of writing a row whose provenance lies.
 */
export async function renderAndWrite(
  env: PublishEnv,
  slug: string,
  raw: string,
  blobSha?: string | null,
) {
  // `related` is corpus-scope and attached below, which the pipeline's inferred record type does not
  // carry.
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

  /*
   * THE CACHE PURGE, AT THE ONE DOOR, because every write that purges `posts` reaches D1 through this
   * function, which hard rule 18 already made the one door: wiring it here means a sixth writer added
   * later is purged by construction rather than by somebody remembering.
   *
   * IT PURGES ON A DRAFT SAVE TOO, AND THAT IS THE ACCEPTED COST. The obvious condition is where this
   * gets subtly wrong: an UNPUBLISH writes a row whose status is draft while changing every public
   * listing, so "skip drafts" would skip the case that most needs it. If the purge rate limit ever
   * makes that cost bind, the repair is a condition reading the PREVIOUS status, never one on the
   * incoming record.
   *
   * It cannot fail this write, which is hard rule 18's second clause applied to a cache.
   */
  await purgePosts(`renderAndWrite ${slug}`);

  return record;
}

/** The head commit, recorded when the editor loads and echoed back on save. */
export async function currentHead(env: PublishEnv) {
  return (await getHead(env)).commitSha;
}

/**
 * Saves a post: gates, one-file commit, then the render door.
 *
 * THE FULL RENDER RUNS TWICE BY DESIGN: once as the gate in FRONT of the commit, because a post
 * that fails validation must never land on main, and once inside `renderAndWrite` AFTER it, because
 * D1 is written only from a row the one door produced. Rendering is deterministic, and one
 * duplicated render costs a save less than a second door would cost the repo.
 */
export async function savePost(
  env: PublishEnv,
  options: {
    slug: string;
    raw: string;
    expectedHeadSha?: string | null;
    isNew: boolean;
    /**
     * WHO IS WRITING. REQUIRED, with no default: it defaulted to the most privileged principal on the
     * site, so a call site that forgot to say who was asking was granted everything, silently.
     *
     * THERE IS NO SAFE DEFAULT FOR AN IDENTITY. The fail-closed choice is worse rather than safer: it
     * would quietly downgrade a real admin action into a refusal nobody could explain.
     */
    actor: Actor;
    /**
     * WHETHER THIS REQUEST CARRIES THE AUTHOR'S CONFIRMATION. Three-valued, and the third value is the
     * useful one: ABSENT means this caller has no ceremony. So the check tests `=== false` rather than
     * falsiness, because a caller that says nothing is not a caller that said no.
     */
    firstPublishConfirmed?: boolean;
  },
) {
  const { actor } = options;

  // The existing file is read BEFORE anything is rendered: it carries the only authoritative answer
  // to "has this post ever been published", and a write refused by policy should not pay for a render.
  const existing = await readFile(env, postPath(options.slug));

  if (options.isNew && existing) {
    throw new EditorError(
      `A post with the slug "${options.slug}" already exists.`,
      { field: "slug" },
    );
  }

  // Throws PolicyError on an operator's first publish. Also stamps
  // first_published, overwriting whatever the caller sent.
  const decision = decide({
    actor,
    incomingRaw: options.raw,
    priorRaw: existing ? existing.content : null,
  });
  const raw = decision.raw;

  /*
   * THE CEREMONY, CHECKED AGAINST THE PRIOR FILE AND BEFORE ANY WORK, so `published-first` is the
   * authoritative answer rather than anything the request asserted about itself. Nothing has been
   * written when it throws.
   *
   * AFTER `decide()` deliberately, so a policy refusal still wins: a credential that may not publish
   * at all is told that, not asked to confirm.
   */
  if (decision.outcome === "published-first" && options.firstPublishConfirmed === false) {
    throw new FirstPublishConfirmationRequired();
  }

  // Rendered from the STAMPED markdown and BEFORE the commit: this is the gate, and its result is
  // deliberately discarded. The row D1 gets is the one `renderAndWrite` produces after the commit.
  const gated = await validateAndRender(env, options.slug, raw);

  const { commitSha, blobShas } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: commitMessage(actor, options.isNew ? "Add" : "Update", gated.title),
    changes: [{ path: postPath(options.slug), content: raw }],
  });

  /*
   * ONLY NOW, WITH THE COMMIT LANDED, DOES THE DATABASE CHANGE.
   *
   * **THERE IS NO COMPENSATING REVERT AND THERE MUST NEVER BE ONE**: undoing the commit to tidy the
   * index would destroy the authoritative copy to repair the derived one. A persistent failure is
   * recorded in KV rather than D1, because D1 is the store that just failed.
   */
  let record = gated;
  const converged = await convergeWithRetry({
    write: async () => {
      record = await renderAndWrite(
        env,
        options.slug,
        raw,
        blobShas[postPath(options.slug)] ?? null,
      );
    },
    recordDivergence: (facts) => recordDivergence(env, facts),
    slug: options.slug,
    commitSha,
  });

  /*
   * A SUCCESSFUL WRITE CLEARS ANY EARLIER DIVERGENCE FOR THIS SLUG, or the status surface keeps
   * reporting a fault a later save already repaired, and a stale alarm is how a real one stops being
   * read. It does not throw: failing to clear is strictly less bad than failing the save.
   */
  try {
    await clearDivergence(env, options.slug);
  } catch (error) {
    console.error("failed to clear a divergence record after a successful save", error);
  }

  /*
   * DRAFT PREVIEW LINKS DIE WHEN THE POST STOPS BEING A DRAFT, and AFTER the D1 sync: the read path
   * asks the database for `status = 'draft'`, so revoking first would open a window where the token
   * is gone and the row still says draft. It does not throw, because a surviving token is INERT.
   */
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

  // The AI index is downstream of D1 and MUST NOT be able to fail a save: a post briefly missing
  // from Ask is a degraded enhancement, where a save failing after the commit landed would leave the
  // repo and the database disagreeing about whether it happened.
  const askSync = await syncAskForPost(env, record);

  return {
    commitSha,
    record,
    askSync,
    /** True when the first D1 write failed and the retry succeeded, so a retry is visible rather than silent. */
    d1Retried: converged.retried,
    /**
     * How many preview links this save revoked: `null` when nothing was attempted, `-1` when the
     * attempt threw. Three states rather than a count, because "0 revoked", "never asked" and "asked
     * and failed" are different facts a bare number tells apart only by accident.
     */
    previewLinksRevoked,
    firstPublished: decision.firstPublished,
    published: decision.published,
    // What the save DID, named by the policy module because only it read the prior file, which is the
    // only thing that tells a first publication from a republication.
    outcome: decision.outcome,
  };
}

/**
 * Marks who wrote the commit, naming the operator id rather than "an agent", so `git log` answers
 * which one without anyone cross-referencing.
 */
function commitMessage(actor: Actor, verb: string, title: string) {
  const base = `${verb} post: ${title}`;
  return actor.kind === "operator" ? `${base} [operator:${actor.id}]` : base;
}

/** Pushes one post into the Ask index, reporting failure instead of raising. Null when Ask is not configured. */
async function syncAskForPost(env: PublishEnv, record: { slug: string }) {
  if (!askAvailable(env)) return null;
  try {
    const result = await syncAskPost(env, record);
    /*
     * A PARTIAL UPLOAD IS NOT `ok`: without this the editor would be told the index write succeeded
     * while some of the post was missing from it.
     */
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
    return { ok: false as const, message: error instanceof Error ? error.message : String(error) };
  }
}

/** Deletes a post: one commit removing the file, then the rows. */
export async function deletePost(
  env: PublishEnv,
  // `actor` is REQUIRED here for the reason `savePost` records: the default was the most privileged
  // principal, and deletion is the capability the table is strictest about.
  options: { slug: string; expectedHeadSha?: string | null; actor: Actor },
) {
  const { actor } = options;

  /*
   * **THE POLICY DECISION, BEFORE ANY READ OR WRITE.** There was no policy path here at all: an
   * operator forbidden from making a post public for the FIRST time was permitted to DESTROY it.
   *
   * First statement deliberately: after the file read it would still refuse, but would let an
   * unauthorised caller probe which slugs exist from the difference between two error messages.
   */
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

  await deletePostFromD1(env, options.slug);

  // Same asymmetry as the save path: the AI index cannot fail the delete. A deleted post still
  // answerable through Ask is the one failure that matters here, so it is reported rather than
  // swallowed.
  let askRemoved: number | null = null;
  if (askAvailable(env)) {
    try {
      askRemoved = await removeAskPost(env, options.slug);
    } catch (error) {
      console.error("ask index removal failed after delete", error);
    }
  }

  return { commitSha, askRemoved };
}

/**
 * Writes one rendered post into D1 and rebuilds the search index, in a `batch()` so the row, its
 * tags and the index move together. The FTS index is rebuilt rather than left to the per-row
 * triggers, matching what the bulk sync does.
 */
export async function syncPostToD1(env: PublishEnv, record: any) {
  const db = env.DB;
  const publishAt = Math.floor(Date.parse(record.publishAt) / 1000);
  const status = record.draft ? "draft" : "published";

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
        /*
         * The three optional head blocks. NULL rather than an empty value when absent, because
         * absent is the normal case and a written empty string would be the author saying nothing
         * in a way the page cannot tell from the author saying something.
         */
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

/**
 * The media citations this post emitted, SCOPED TO THIS SLUG, which is the difference from the bulk
 * sync: this re-rendered one post and must not touch another's refs. In the same batch as the post
 * write, so a save either records its citations or does not happen.
 */
function mediaRefStatements(db: D1Database, record: any) {
  const statements = [
    db.prepare(`DELETE FROM media_refs WHERE source_type = 'post' AND source_id = ?1`).bind(
      record.slug,
    ),
  ];
  const seen = new Set<string>();
  for (const ref of record.mediaRefs ?? []) {
    /*
     * The primary key includes form and detail, so one image cited twice in one form is one row.
     *
     * THE SEPARATOR IS THE WHOLE CORRECTNESS ARGUMENT. A printable one COLLIDES: under a space,
     * `("k", "inline", "line 3 alt")` and `("k", "inline line", "3 alt")` give the same key, so a post
     * citing two images records one. Details really do carry spaces; NUL cannot occur in any of the
     * three, so the join is unambiguous.
     */
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

/**
 * Statements that replace one post's search records. Safe to do incrementally where `related` is
 * not: a post's sections depend on nothing but that post's markdown, where relatedness is a
 * property of the whole corpus. One indexer, for the same reason there is one renderer.
 */
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

/**
 * Removes a post's rows. Tag rows stay, matching the bulk sync.
 *
 * THE `media_refs` DELETE IS FINDING B003, and the consequence was a PERMANENTLY REFUSED DELETE:
 * the resolver reported zero citations while the table still claimed one, so the image could never
 * be removed from the library.
 */
export async function deletePostFromD1(env: PublishEnv, slug: string) {
  // Both tags, because the page and the listings are different entries. Purged BEFORE the delete
  // deliberately: a purge that lands first can only cost a re-render of a page that still exists,
  // where one landing after a slow delete could re-store the page it was meant to remove.
  await purgePost(slug, `deletePostFromD1 ${slug}`);
  await purgePosts(`deletePostFromD1 ${slug}`);
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
}

/**
 * THE REBUILD DOOR, and the one RECOVERY.md points at: one directory listing, one read per file,
 * and `renderAndWrite` per post, so every row arrives through the same door a save uses, which is
 * rule 18's repair-through-the-derivation. The blob sha rides along so each render proves it
 * rendered the bytes the repository holds.
 */
export async function regenerateAllFromRepo(env: PublishEnv) {
  const entries = await listDirectory(env, "content/posts");
  const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));

  // SCOPE, ASSERTED. An empty listing is a deleted content directory or a broken read, and "sync 0
  // posts, delete every row" is the destructive reading of both. Refuse rather than converge on an
  // empty corpus.
  if (files.length === 0) {
    throw new EditorError(
      "content/posts listed no markdown files. An empty corpus is not a state " +
        "this site has ever had, so this refuses rather than deleting every row.",
    );
  }

  const keep = files.map((f) => f.name.slice(0, -".md".length));
  const placeholders = keep.map((_, i) => `?${i + 1}`).join(", ");
  await env.DB.prepare(
    `DELETE FROM posts WHERE source_path IS NOT NULL AND slug NOT IN (${placeholders})`,
  )
    .bind(...keep)
    .run();

  for (const entry of files) {
    const slug = entry.name.slice(0, -".md".length);
    const file = await readFile(env, entry.path);
    if (!file) {
      throw new EditorError(
        `"${entry.path}" vanished between the directory listing and the read. ` +
          `Main moved mid-rebuild; re-run the regenerate.`,
      );
    }
    await renderAndWrite(env, slug, file.content, entry.sha);
  }

  return { synced: files.length };
}
