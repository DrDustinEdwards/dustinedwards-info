/**
 * The editor's write path, end to end.
 *
 *   browser -> action -> gates -> GitHub commit (one markdown file) -> render -> D1
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

import { mediaRefKey } from "~/lib/media-ref-key.mjs";
import { purgePost, purgePosts } from "~/lib/cache-purge.server";
import { recordsForPost } from "~/lib/search/records.mjs";
import { askAvailable, removeAskPost, syncAskPost } from "~/lib/search/ask.server";

import {
  ContentError,
  findWideDashes,
  postPath,
  renderPost,
  withRelated,
} from "~/lib/content/pipeline.mjs";
// Side-effect import: installs the Worker WASM loader before anything renders.
import "~/lib/content/wasm.server";
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
import { listPostCorpusForRelated } from "~/db";
import { revokeAllPreviewLinks } from "~/lib/preview-links.server";

export { GitHubError, PolicyError };
export type { Actor };

/**
 * Where a post's source file lives, as ONE statement of the rule.
 *
 * Exported since 2026-08-11. It was module-private, and the path was
 * consequently restated in SEVEN other places, including two more `postPath`
 * definitions of its own in the history and revisions routes. Measured with an
 * anchored grep over 92 files before the collapse:
 *
 *   publish.server.ts:64          the definition
 *   operator/api.server.ts:183    get_post
 *   operator/api.server.ts:236    delete_post
 *   admin.posts.$slug.edit.tsx:21 and :59
 *   admin.posts.$slug.history.tsx:32   a second definition
 *   admin.posts.$slug.revisions.tsx:31 a third definition
 *   admin.preview.ts:46
 *
 * Same class as `visibilityClause` and `SLUG_PATTERN` earlier the same week: N
 * statements of one rule with only some of them bound to each other. A bulk
 * retag would have added a ninth.
 */
/*
 * RE-EXPORTED, not defined here, since 2026-08-22. The definition moved to
 * `pipeline.mjs` beside `SLUG_PATTERN` because that module built the same path
 * independently for the artifact's `sourcePath`, which made hard rule 6's
 * "stated ONCE" false by one. Re-exporting keeps all eight importers here
 * unchanged; the string now exists in exactly one place.
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
 * A first publication that nobody has confirmed yet.
 *
 * NOT AN ERROR, and it is a distinct class rather than an `EditorError` for
 * that reason: nothing failed and nothing was refused. The write stopped one
 * step short of the commit because the ceremony has not been answered, and the
 * editor turns this into a server-rendered second step exactly as an
 * unconfirmed delete becomes one (`app/lib/destructive.mjs` states the shape).
 *
 * Thrown rather than returned so the ceremony cannot be skipped by a caller
 * that forgets to read a flag, and thrown from `savePost` rather than checked
 * in the route because `savePost` is where the prior file is read, which is the
 * only place that knows whether this IS a first publication.
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
 * BOTH BRANCHES EXIST TO AGREE WITH `scripts/lib/content.mjs`, and finding B002
 * is that neither did. Dimensions are written into the stored HTML by
 * `rehypeImageSources`, so they are part of the rendered HTML the
 * determinism gate compares: whatever this returns, `build:content` has to
 * return too, from a clone, with no bindings and no network.
 *
 * `/media/*` is resolved from the KEY. Those blobs live only in R2, so reading
 * bytes here was something the Node build could never match; the first
 * `/media/` citation would have committed HTML that `build:content` could not
 * reproduce. The key carries `-<w>x<h>` and both resolvers call the same
 * `dimensionsFromKey`, so nothing is fetched and nothing can drift.
 *
 * `public/*` is read from the REPOSITORY at the pinned ref, not from
 * `SITE_ORIGIN`. That was the second half of B002: the origin serves the
 * DEPLOYED asset while the build measures the working tree, so an image
 * retouched and committed but not yet deployed gave the two writers different
 * numbers for the same src. The repo is what a clone builds from, so the repo
 * is what this measures.
 *
 * THE PLACEHOLDER IS READ FROM THE REPOSITORY TOO, and from the same ref, which
 * is the whole reason it is not read from the bundled copy of the manifest this
 * Worker already imports. That copy is the manifest as of the last DEPLOY. The
 * dimensions three lines up come from the repository as of NOW, and a render
 * that mixed the two vintages would bake a placeholder from one commit beside a
 * measurement from another. B002 is exactly that class of mistake, one store
 * further out. One read per render rather than one per image: the manifest does
 * not change between two images in the same document.
 *
 * Exported so the admin preview route resolves images exactly as a save does.
 * There must not be a second implementation: preview's whole claim is that what
 * it renders is what publishes.
 */
export function makeResolveImage(env: PublishEnv) {
  /** The committed manifest, fetched at most once per resolver. */
  let manifest: Promise<AssetManifest> | null = null;
  const placeholders = async () => {
    manifest ??= readFile(env, ASSET_MANIFEST_PATH).then((file) => {
      // A manifest that is missing or unparseable yields no placeholders rather
      // than failing the save. The value is an enhancement, the gate that keeps
      // it current is `check:content`, and refusing to publish a post because a
      // generated artifact could not be read would be a new way to lose an
      // article. It is logged, because silence here is the drift.
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
            `are keyed <hash>-<width>x<height>.<ext>; re-upload it to get a ` +
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
    // Absent for anything the manifest does not cover, which is every static
    // asset that is not a content raster. Absent is a real answer: the image
    // renders without a placeholder, exactly as it did before this existed.
    const placeholder = (await placeholders())[src]?.lqip;
    return { width: size.width, height: size.height, ...(placeholder ? { placeholder } : {}) };
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
  // The first offender is guarded by VALUE rather than by the list length: same
  // refusal, and it is what lets the message below read its fields.
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
 * The saved post's related list, computed against the D1 corpus.
 *
 * Relatedness is a property of the whole corpus, and the corpus now lives in
 * D1: the committed artifact that used to carry it is gone. Only THIS post's
 * list is computed and written, which is exactly what the old save path
 * persisted too: it recomputed `related` across the artifact but synced only
 * the saved post's row, so every other row's copy waited for the next bulk
 * sync then and still does.
 */
async function relatedFor(env: PublishEnv, record: any) {
  const corpus = await listPostCorpusForRelated(env);
  const others = corpus
    .filter((p) => p.slug !== record.slug)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      tags: p.tags,
      draft: p.status === "draft",
      // ISO strings, matching the shape `withRelated` compares in the build:
      // string order over ISO timestamps IS chronological order.
      publishAt: p.publishAt ? p.publishAt.toISOString() : "",
    }));
  // The saved post goes LAST, so `withRelated`, which maps in input order,
  // returns its entry at a position that cannot miss. `find` with a fallback
  // would be a substituting fallback on a can't-happen branch (rule 13).
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
 * THE ONLY DOOR TO A RENDERED ROW.
 *
 * Renders one post through the shared pipeline and writes everything a
 * rendered post owns in D1: the posts row (both provenance hashes included),
 * the FTS rebuild, its search_docs records, and its media_refs. `savePost`,
 * the operator API (through `savePost`), the content-drift repair and
 * `regenerateAllFromRepo` all come through here; nothing else may write a
 * rendered row, because two writers of one row shape is the drift the
 * committed artifact used to exist to catch.
 *
 * `blobSha`, when given, is the git blob sha of the file the REPOSITORY
 * holds, from a directory listing, a Contents read, or the commit that just
 * landed. `renderPost` hashes the bytes it rendered into
 * `record.sourceBlobSha`, so the equality check proves the rendered bytes ARE
 * the committed bytes: a truncated fetch or a file changing mid-flight fails
 * here, by name, instead of writing a row whose provenance lies.
 */
export async function renderAndWrite(
  env: PublishEnv,
  slug: string,
  raw: string,
  blobSha?: string | null,
) {
  // `related` is corpus-scope and is attached below, which the pipeline's
  // inferred record type does not carry; the same widening the artifact
  // writers did implicitly.
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
  await syncPostToD1(env, record);

  /*
   * THE CACHE PURGE, AT THE ONE DOOR. Ruling 17, 2026-09-05.
   *
   * ## WHY HERE AND NOT AT FIVE CALL SITES
   *
   * Ruling 17 names five writes that purge `posts`: a publish, an unpublish, a
   * save of a published post, a content-drift repair, and the operator's corpus
   * sync. Every one of them reaches D1 through THIS FUNCTION, because hard rule
   * 18 already made it the one door and `regenerateAllFromRepo` the one bulk
   * form. Wiring the purge to the door rather than to the five callers means a
   * sixth writer added later is purged by construction rather than by somebody
   * remembering, which is the same argument that put the door here.
   *
   * ## IT PURGES ON A DRAFT SAVE TOO, AND THAT IS THE ACCEPTED COST
   *
   * A draft save changes nothing a reader can see, so this purge is wasted work
   * on those. The alternative is a condition on the record's status, and the
   * condition is where this gets subtly wrong: an UNPUBLISH writes a row whose
   * status is draft while changing every public listing, so "skip drafts" would
   * skip the one case that most needs the purge. Being right about unpublish is
   * worth a handful of unnecessary purges a day on a single-author site.
   *
   * Purge rate limits are the Free-tier zone limits regardless of plan. If that
   * ever binds, the fix is a condition that reads the PREVIOUS status rather
   * than this one, not a condition on the incoming record.
   *
   * It cannot fail this write: `purgePosts` reads `success`, logs, and returns
   * a boolean. Hard rule 18's second clause, a failed index write never reverts
   * the source, applied to a cache.
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
 * The commit carries exactly the markdown. The full render runs TWICE by
 * design: once here as the gate in FRONT of the commit, because a post that
 * fails frontmatter validation or image resolution must never land on main
 * (a committed post the pipeline refuses would redden the next build), and
 * once inside `renderAndWrite` AFTER it, because D1 is written only from a
 * row the one door produced. Rendering is deterministic; the determinism gate
 * in check:content proves that on every run, and one duplicated render costs
 * an admin save less than a second door would cost the repo.
 */
export async function savePost(
  env: PublishEnv,
  options: {
    slug: string;
    raw: string;
    expectedHeadSha?: string | null;
    isNew: boolean;
    /**
     * WHO IS WRITING. REQUIRED, with no default, since 2026-08-28.
     *
     * It was `actor?: Actor` defaulting to `{ kind: "admin" }`, which is the
     * most privileged principal on the site: the capability table gives admin
     * `write`, `firstPublish` and `destroy`, and operator and smoke each less.
     * So a call site that forgot to say who was asking was granted everything,
     * silently, and the four call sites that omitted it were all reached from
     * request handlers.
     *
     * They were in fact all admin paths, so nothing was wrong on the wire. That
     * is the point: the default was RIGHT four times out of four and would have
     * been wrong the first time somebody added a fifth caller on a path that
     * was not, with no diagnostic anywhere. A required field turns that into a
     * typecheck failure naming the file.
     *
     * Fail-closed would have been `{ kind: "operator" }`, and that is worse
     * rather than safer: it would quietly downgrade a real admin action and the
     * failure would be a refusal nobody could explain. There is no safe default
     * for an identity, which is why there is none.
     */
    actor: Actor;
    /**
     * WHETHER THIS REQUEST CARRIES THE AUTHOR'S CONFIRMATION of a first
     * publication, on a path that HAS a ceremony.
     *
     * Three-valued on purpose, and the third value is the useful one. `true`
     * and `false` are the editor answering; ABSENT means "this caller has no
     * ceremony", which is the truth for the operator API (whom `decide()`
     * refuses a first publication outright, so a confirmation would be a
     * question asked of something that may not answer it) and for the posts
     * index's bulk repair (which publishes nothing).
     *
     * So the check below tests `=== false` rather than falsiness. A caller that
     * says nothing is not a caller that said no, and collapsing the two would
     * make every existing call site start refusing writes it is allowed to
     * make. The only way to reach the ceremony is to opt into it.
     */
    firstPublishConfirmed?: boolean;
  },
) {
  const { actor } = options;

  // The existing file is read BEFORE anything is rendered, because it carries
  // the only authoritative answer to "has this post ever been published", and
  // because a write refused by policy should not pay for a render first.
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
   * THE CEREMONY, CHECKED AGAINST THE PRIOR FILE AND BEFORE ANY WORK.
   *
   * `decide()` has just read the committed file, so `published-first` is the
   * authoritative answer to "is this the moment this post becomes public",
   * rather than anything the request asserted about itself. Refusing here costs
   * no render and no commit, and nothing has been written when it throws.
   *
   * It sits AFTER `decide()` deliberately, so a policy refusal still wins: a
   * credential that may not publish at all is told that, not asked to confirm.
   */
  if (decision.outcome === "published-first" && options.firstPublishConfirmed === false) {
    throw new FirstPublishConfirmationRequired();
  }

  // Rendered from the STAMPED markdown, and rendered BEFORE the commit: this
  // is the gate, and its result is deliberately discarded. The row D1 gets is
  // the one `renderAndWrite` produces after the commit lands.
  const gated = await validateAndRender(env, options.slug, raw);

  const { commitSha, blobShas } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: commitMessage(actor, options.isNew ? "Add" : "Update", gated.title),
    changes: [{ path: postPath(options.slug), content: raw }],
  });

  /*
   * ONLY NOW, WITH THE COMMIT LANDED, DOES THE DATABASE CHANGE, and from here
   * the repo is ahead until the index catches up.
   *
   * **THE ORDER IS THE DESIGN AND IS NOT THE DEFECT.** The repo is the source
   * of truth; D1 is a derived index. So there is no compensating revert, and
   * there must never be one: undoing the commit to tidy the index would destroy
   * the authoritative copy to repair the derived one. A stale index serves
   * slightly old data; a reverted commit is lost writing.
   *
   * What the 2026-08-22 audit actually caught is the other half of its own
   * sentence, "with no record". A transient D1 failure now retries once, and a
   * persistent one is RECORDED where `sync_status` can see it and raised as an
   * error that names the post, the commit and the repair. Grounds on
   * `convergeWithRetry`.
   *
   * The recorder writes to KV, never to D1, because D1 is the store that just
   * failed and a record of that failure kept there is absent exactly when it is
   * wanted.
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
   * A SUCCESSFUL WRITE CLEARS ANY EARLIER DIVERGENCE FOR THIS SLUG. Without
   * this the status surface would keep reporting a fault that a later save had
   * already repaired, and a stale alarm is how a real one stops being read.
   * It does not throw: failing to clear a record is strictly less bad than
   * failing the save that just succeeded.
   */
  try {
    await clearDivergence(env, options.slug);
  } catch (error) {
    console.error("failed to clear a divergence record after a successful save", error);
  }

  /*
   * DRAFT PREVIEW LINKS DIE WHEN THE POST STOPS BEING A DRAFT. Feature G.
   *
   * `decision.published` is the incoming file's `draft: false`, so this fires on
   * a first publication, on a republication, AND on an ordinary save of a post
   * that is already live. The last of those revokes nothing because there is
   * nothing to revoke, and asking costs one KV list.
   *
   * AFTER the D1 sync, deliberately. The read path decides by asking the
   * database for `status = 'draft'`, so revoking BEFORE the row moved would open
   * a window in which the token is already gone and the row still says draft.
   * This order has no window in the direction that matters.
   *
   * IT DOES NOT THROW, and that is safe rather than convenient. A surviving
   * token is INERT: `/preview/:token` re-asks the database on every request
   * rather than trusting that this ran, so a failed revocation costs the author
   * a stale row in the drawer's list, not a leak. That is the same asymmetry the
   * Ask sync below is built on, and it is why the read path re-checks at all.
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

  // The AI index is downstream of D1 and MUST NOT be able to fail a save.
  // A post that is committed, rendered and searchable but briefly missing from
  // Ask is a degraded enhancement; a save that fails after the commit landed
  // would leave the repo and the database disagreeing about whether it
  // happened. Same asymmetry as the OG card gap, and recorded next to it.
  const askSync = await syncAskForPost(env, record);

  return {
    commitSha,
    record,
    askSync,
    /**
     * True when the first D1 write failed and the retry succeeded. The save is
     * fine; this exists so a retry is visible rather than silent, because a
     * database that needs a second attempt on every save is a fault that would
     * otherwise never surface.
     */
    d1Retried: converged.retried,
    /**
     * How many preview links this save revoked. `null` when the post did not
     * move out of draft and nothing was attempted, `-1` when the attempt threw.
     * Three states rather than a count, because "0 revoked" and "never asked"
     * and "asked and failed" are different facts and a bare number tells them
     * apart only by accident.
     */
    previewLinksRevoked,
    firstPublished: decision.firstPublished,
    published: decision.published,
    // What the save DID, for the editor to report. Named by the policy module
    // because only it read the prior file, and the prior file is the only thing
    // that can tell a first publication from a republication.
    outcome: decision.outcome,
  };
}

/**
 * Marks who wrote the commit.
 *
 * An operator's commits must be distinguishable in history from Dustin's, so
 * `git log` answers "did an agent write this" without anyone having to
 * cross-reference anything. The marker names the operator id, because "an
 * agent" is not a useful answer once there is more than one.
 */
function commitMessage(actor: Actor, verb: string, title: string) {
  const base = `${verb} post: ${title}`;
  return actor.kind === "operator" ? `${base} [operator:${actor.id}]` : base;
}

/**
 * Pushes one post into the Ask index, reporting failure instead of raising.
 *
 * Returns null when Ask is not configured, which is the ordinary state on a
 * deployment with the binding removed.
 */
async function syncAskForPost(env: PublishEnv, record: { slug: string }) {
  if (!askAvailable(env)) return null;
  try {
    const result = await syncAskPost(env, record);
    /*
     * A PARTIAL UPLOAD IS NOT `ok`. `syncAskPost` no longer throws when a
     * single record fails, so without this the editor would be told the index
     * write succeeded while some of the post was missing from it, which is the
     * silent half of the defect the retry was added for.
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
  // `actor` is REQUIRED here for the reason `savePost` records at length: the
  // default was the most privileged principal, and deletion is the capability
  // the table is strictest about.
  options: { slug: string; expectedHeadSha?: string | null; actor: Actor },
) {
  const { actor } = options;

  /*
   * **THE POLICY DECISION, BEFORE ANY READ OR WRITE.**
   *
   * Until 2026-08-17 this function took `actor` and used it ONLY to build the
   * commit message below, so there was no policy path at all: an operator token
   * forbidden by `decide()` from making a post public for the FIRST time was
   * permitted to DESTROY that same post, over the network through
   * `/api/operator`. Least privilege says the destructive verb needs more
   * authority than the publishing one, not less.
   *
   * First statement in the function deliberately. Placing it after the file
   * read would still refuse, but it would let an unauthorised caller probe
   * which slugs exist by the difference between two error messages.
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

  // Same asymmetry as the save path: the AI index is downstream and cannot fail
  // the delete. A deleted post still answerable through Ask is the one failure
  // that matters here, so it is reported rather than swallowed.
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
           cover_image, cover_alt, reading_time_minutes, source_path, toc, featured, series, part,
           further_reading, og_title, og_description, related, source_blob_sha, render_hash,
           updated_at)
         VALUES (?1, 'post', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
           ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, unixepoch())
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
 * The media citations this post emitted, replacing whatever it had before.
 *
 * SCOPED TO THIS SLUG, which is the difference from `sync:content`. That writer
 * holds the whole corpus and so replaces every `source_type='post'` row at once;
 * this one re-rendered exactly one post and must not touch another post's refs.
 * Both derive the refs from `renderPost`, so neither can invent a form the other
 * would not, which is the same both-writers rule `records.mjs` and `withRelated`
 * live under.
 *
 * In the same batch as the post write, so a save either records its citations or
 * does not happen. A post whose body no longer references an image, with the ref
 * left behind, would refuse a delete forever for a citation that is gone.
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
     * The primary key includes form and detail, so the same image cited twice on
     * one line in one form is one row. Deduped rather than left to fail a batch
     * that also carries the post itself.
     *
     * THE SEPARATOR IS THE WHOLE CORRECTNESS ARGUMENT, and it lives here now
     * because this is the LIVE writer. This line joined on a SPACE until
     * 2026-08-25, while the NUL-joined `mediaRefKey` (whose docblock argues the
     * point, and whose test proves it) was reachable only from a dead function.
     * The argument was written down, tested, and attached to nothing that runs.
     *
     * A printable separator COLLIDES: under a space, the refs
     * ("k", "inline", "line 3 alt") and ("k", "inline line", "3 alt") produce
     * the same key, so the second is dropped as a duplicate and a post citing
     * two different images silently records one. Details really do carry
     * spaces; the pipeline emits `detail: "cover image"`. NUL cannot occur in a
     * media key, a form or a detail, so the join is unambiguous.
     *
     * The shapes differ and that is deliberate rather than sloppy: the pipeline
     * emits `key` and the table column is `media_key`, so the adaptation is
     * made here at the one call site rather than by widening the helper to
     * accept two field names, which would make the helper the second owner of
     * a naming difference.
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
 * Statements that replace one post's search records.
 *
 * Records are derived per post, so a save only has to replace its own. That is
 * what makes this safe to do incrementally where `related` is not: relatedness
 * is a property of the whole corpus and has to be recomputed across it, whereas
 * a post's sections depend on nothing but that post's own markdown.
 *
 * Derivation goes through the same app/lib/search/records.mjs the build script
 * uses. There is one indexer, for the same reason there is one renderer.
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
 * Removes a post's rows. Tag rows stay, matching the bulk sync's behaviour.
 *
 * THE `media_refs` DELETE IS FINDING B003, and it is the one line here that is
 * not merely tidiness. A save already scope-clears that slug's refs through
 * `mediaRefStatements`, and the bulk sync clears every `source_type='post'` row
 * before rewriting them, so delete was the only lifecycle edge that left them.
 *
 * The consequence was not a stale row, it was a permanently refused delete. The
 * media delete action fails closed on EITHER channel, the refs table or the
 * resolver scan, and it is right to: refs are precise and the scan is a
 * conservative superset, so the union is what makes a refcount safe once blobs
 * are shared. But after a post was deleted the resolver correctly reported zero
 * citations while `media_refs` still claimed one, so the image it had cited
 * could never be removed from the library. `Regenerate all` did not repair it
 * either at the time: it looped the posts that still existed and never issued
 * a scoped delete for a slug that was gone. Only a full `sync:content`, which
 * rewrites the table wholesale, cleared it.
 *
 * In the same batch as the post row, for the reason `mediaRefStatements` gives:
 * a delete either records that the citations are gone or does not happen.
 */
export async function deletePostFromD1(env: PublishEnv, slug: string) {
  // The row is going, so every listing that carried it is stale AND the post's
  // own page must stop being served from cache. Both tags, because the page and
  // the listings are different entries. Purged BEFORE the delete rather than
  // after, deliberately: a purge that lands first can only cost a re-render of
  // a page that still exists, where one that lands after a slow delete could
  // re-store the page it was meant to remove.
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
 * Re-renders every post in the repository into D1.
 *
 * THE REBUILD DOOR, and the one RECOVERY.md points at: one Contents directory
 * listing (which carries every file's blob sha for free), one read per file,
 * and `renderAndWrite` per post, so every row arrives through the same door a
 * save uses (rule 18: a derived store is repaired through its derivation).
 * The blob sha from the listing rides along so each render proves it rendered
 * the bytes the repository holds.
 *
 * The recovery path for drift between commits made from a clone and commits
 * made in the editor, and the bulk half of the content-drift repair.
 */
export async function regenerateAllFromRepo(env: PublishEnv) {
  const entries = await listDirectory(env, "content/posts");
  const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));

  // SCOPE, ASSERTED. An empty listing here is a deleted content directory or
  // a broken read, and "sync 0 posts, delete every row" is the destructive
  // reading of both. Refuse rather than converge on an empty corpus.
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
