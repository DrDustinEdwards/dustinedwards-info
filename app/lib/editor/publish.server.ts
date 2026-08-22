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

import { createContext } from "react-router";

import { memoizeOnce } from "~/lib/once.mjs";
import { imageSize } from "image-size";

import { serializeArtifact } from "~/lib/content/artifact.mjs";
// The page half of the search corpus. Imported rather than read from disk: this
// runs in the Worker, where both files come from the bundle. Ruling 3 of
// colophon-page.md.
import stackData from "../../../content/generated/stack.json";
import featuresData from "../../../content/features.json";
import projectsData from "../../../content/projects.json";
import playgroundData from "../../../content/playground.json";
import { colophonPages } from "~/lib/colophon-sections.mjs";
import { playgroundPages } from "~/lib/playground-page.mjs";
import { projectsPages } from "~/lib/projects-page.mjs";
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
import {
  commitFiles,
  getHead,
  readFile,
  readBinaryFile,
  GitHubError,
} from "./github.server";
import { decide, decideDelete, PolicyError, type Actor } from "./publish-policy.mjs";
import { revokeAllPreviewLinks } from "~/lib/preview-links.server";

export { GitHubError, PolicyError };
export type { Actor };

/**
 * The page half of the corpus, computed ONCE at module scope.
 *
 * A pure function of three committed JSON files, so there is nothing
 * per-request about it. **Known residual, recorded rather than hidden:** these
 * come from the bundle, so they are whatever was deployed. If `stack.json`,
 * `features.json` or `projects.json` changes on main and the Worker is not
 * redeployed, a save from the editor writes page records the next
 * `build:content` will not reproduce, and `check:content` reports it as a byte
 * difference. Same shape as the social-card gap, and the repair is the same:
 * deploy. `npm run ship` does both, which is why a roster change is a deploy
 * AND a sync rather than either alone.
 *
 * The ORDER matches `scripts/build-content.mjs`. It does not have to, because
 * `recordsForPages` sorts by uid before emitting, but two callers assembling
 * the same list differently is a difference waiting to become a defect.
 */
const PAGE_INPUTS = [
  ...colophonPages(stackData, featuresData),
  ...projectsPages(projectsData),
  ...playgroundPages(playgroundData),
];

const ARTIFACT_PATH = "content/generated/posts.json";

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
export { postPath };

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
 * BOTH BRANCHES EXIST TO AGREE WITH `scripts/lib/content.mjs`, and finding B002
 * is that neither did. Dimensions are written into the stored HTML by
 * `rehypeImageDimensions`, so they are part of the gated artifact: whatever
 * this returns, `build:content` has to return too, from a clone, with no
 * bindings and no network.
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
 * Exported so the admin preview route resolves images exactly as a save does.
 * There must not be a second implementation: preview's whole claim is that what
 * it renders is what publishes.
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

// Serialization lives in app/lib/content/artifact.mjs so this path and
// scripts/build-content.mjs cannot disagree about the artifact's shape. An
// editor save that wrote a different shape would redden check:content on main.

/**
 * Reads the committed artifact and returns its posts, so a save can splice one
 * entry without re-rendering every other post.
 */
/**
 * ONE artifact read per request, shared by everything that needs it.
 *
 * **This is deduplication, not a cache, and the distinction is the whole
 * justification.** Nothing here survives the request, nothing is served stale,
 * and no TTL has to be reasoned about. Two callers asking the same question
 * inside one request get one answer instead of two, which is a fact about the
 * request rather than a policy about freshness. Tier 1.5 forbids caching added
 * to hide a slow path; this hides nothing, and the slow path is named below.
 *
 * **What it costs today, measured on production.** `loadArtifact` is not a
 * database read. It is `readFile` against the GitHub Contents API: an HTTPS
 * round trip off Cloudflare's network to api.github.com, for
 * `content/generated/posts.json`, which is 601,683 bytes and arrives base64
 * encoded at roughly 802,000, then gets `atob`ed, `TextDecoder`ed and
 * `JSON.parse`d in the Worker. Measured at 283 to 528ms per call.
 *
 * **It was happening TWICE on /admin/media.** The layout's Ask drift check
 * loads it for the badge, and the media loader's citation resolver loads it
 * again to scan for keys. `askStatusReader` memoized its own use and nothing
 * bridged the two, so the second call paid full price for bytes already in
 * memory.
 *
 * Request scope is enforced by construction: the memo is a closure created per
 * request by the admin middleware and reached through a context. A module-level
 * map keyed on `env` would have looked equivalent and been a CROSS-REQUEST
 * cache, because Workers reuse one `env` object for the life of an isolate,
 * and it would have served a stale corpus after a publish with nothing to say
 * so.
 */
export function artifactReader(
  env: PublishEnv,
  /**
   * The read itself, injectable for two reasons.
   *
   * FIRST, so the memo is testable. The property that matters is "called once
   * per request no matter how many callers ask", and that is unobservable from
   * outside unless something can count the calls. Without this parameter the
   * memo could silently stop memoizing and every test would still pass.
   *
   * SECOND, so instrumentation lands INSIDE the memo. `admin.tsx` passes a
   * timed `loadArtifact`, which makes the `artifact_load` mark fire once, on
   * whichever caller reaches it first. Wrapping the returned reader instead
   * would emit a near-zero mark of the same name on every memo hit and make
   * the Server-Timing header ambiguous about how many reads actually happened,
   * which is the exact question the mark exists to answer.
   */
  load: (env: PublishEnv) => Promise<any[]> = loadArtifact,
) {
  // The memo itself lives in `once.mjs`, dependency-free, because the property
  // "called once" is unobservable without a counter and nothing can import a
  // `.ts` module behind a `~/` alias to count it.
  return memoizeOnce(() => load(env));
}

/**
 * The per-request reader, for callers that are not handed one directly.
 *
 * `load` is null when no middleware set it, which is every non-admin path.
 * A caller that finds null falls back to reading the artifact itself, so this
 * is an optimisation a route may opt into and never a requirement.
 */
export const artifactContext = createContext<{ load: (() => Promise<any[]>) | null }>({
  load: null,
});

export async function loadArtifact(env: PublishEnv) {
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

/**
 * Orders the artifact and recomputes cross-post data.
 *
 * `withRelated` runs over the WHOLE list, not just the post being saved.
 * Relatedness is a property of the corpus: adding or retagging one post changes
 * the related list of every post it shares a tag with. Splicing one entry and
 * leaving the rest would make the committed artifact disagree with the next
 * build, which is precisely what the gate exists to catch.
 */
function sortBySlug(posts: any[]) {
  const ordered = posts
    .slice()
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return withRelated(ordered);
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
    /** Defaults to the human admin, so the browser editor is unchanged. */
    actor?: Actor;
  },
) {
  const actor: Actor = options.actor ?? { kind: "admin" };

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

  // Rendered from the STAMPED markdown, so the committed file and the artifact
  // entry describe the same bytes and check:content stays green.
  const record = await validateAndRender(env, options.slug, raw);

  const posts = await loadArtifact(env);
  const next = sortBySlug([
    ...posts.filter((p) => p.slug !== options.slug),
    record,
  ]);

  const { commitSha } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: commitMessage(actor, options.isNew ? "Add" : "Update", record.title),
    changes: [
      { path: postPath(options.slug), content: raw },
      { path: ARTIFACT_PATH, content: serializeArtifact(next, PAGE_INPUTS) },
    ],
  });

  // Only now, with the commit landed, does the database change.
  await syncPostToD1(env, record);

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

/** Deletes a post: the file, the artifact entry, and the rows, in that order. */
export async function deletePost(
  env: PublishEnv,
  options: { slug: string; expectedHeadSha?: string | null; actor?: Actor },
) {
  const actor: Actor = options.actor ?? { kind: "admin" };

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

  const posts = await loadArtifact(env);
  const next = sortBySlug(posts.filter((p) => p.slug !== options.slug));

  const { commitSha } = await commitFiles(env, {
    expectedHeadSha: options.expectedHeadSha,
    message: commitMessage(actor, "Remove", options.slug),
    changes: [
      { path: postPath(options.slug), content: null },
      { path: ARTIFACT_PATH, content: serializeArtifact(next, PAGE_INPUTS) },
    ],
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
           further_reading, og_title, og_description, related, updated_at)
         VALUES (?1, 'post', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
           ?13, ?14, ?15, ?16, ?17, ?18, ?19, unixepoch())
         ON CONFLICT(slug) DO UPDATE SET
           kind = excluded.kind, title = excluded.title, body = excluded.body,
           html = excluded.html, description = excluded.description, status = excluded.status,
           publish_at = excluded.publish_at, cover_image = excluded.cover_image,
           cover_alt = excluded.cover_alt, reading_time_minutes = excluded.reading_time_minutes,
           source_path = excluded.source_path, toc = excluded.toc, featured = excluded.featured,
           series = excluded.series, part = excluded.part,
           further_reading = excluded.further_reading, og_title = excluded.og_title,
           og_description = excluded.og_description, related = excluded.related,
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
    // The primary key includes form and detail, so the same image cited twice on
    // one line in one form is one row. Deduped rather than left to fail a batch
    // that also carries the post itself.
    const id = `${ref.key} ${ref.form} ${ref.detail ?? ""}`;
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
 * could never be removed from the library. `Regenerate all` does not repair it
 * either: it loops the posts still in the artifact and never issues a scoped
 * delete for a slug that is gone. Only a full `sync:content`, which rewrites
 * the table wholesale, cleared it.
 *
 * In the same batch as the post row, for the reason `mediaRefStatements` gives:
 * a delete either records that the citations are gone or does not happen.
 */
export async function deletePostFromD1(env: PublishEnv, slug: string) {
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
