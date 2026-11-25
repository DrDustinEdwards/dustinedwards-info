// The other posts' related and backlinks lists, re-derived after a save.

import { purgePosts } from "~/lib/cache-purge.server";
import { loadPipeline } from "~/lib/content/load-pipeline.server";
import { listPostCorpusForRelated, listPostDerivedLists, listPostLinkCorpus } from "~/db";
import { errorMessage } from "@dustinedwards/site-runtime/log";
import type { PublishEnv } from "./post-rows.server";

/**
 * After a save, the OTHER posts whose related or backlinks lists the save changed: a post the saved one
 * now links to or shares a tag with, and one that had it in a list and no longer does. The lists are
 * derived over the whole corpus by the pipeline's own withRelated and withBacklinks, the pass the bulk
 * sync runs, since relatedness is a property of the set; that is in memory, over rows a save already
 * reads. Only rows whose stored lists differ are written, in one batch, and only those two columns:
 * another post's save must not move its `updated_at`, blob sha or render hash.
 *
 * Returns the slugs it rewrote. Throws on a failed read or write: the caller reports it.
 */
async function refreshNeighbors(env: PublishEnv, savedSlug: string) {
  const { withRelated, withBacklinks } = await loadPipeline();
  const [related, links, stored] = await Promise.all([
    listPostCorpusForRelated(env),
    listPostLinkCorpus(env),
    listPostDerivedLists(env),
  ]);
  const htmlBySlug = new Map(links.map((p) => [p.slug, p.html ?? ""]));
  const derived = withBacklinks(
    withRelated(
      related.map((p) => ({
        slug: p.slug,
        title: p.title,
        description: p.description,
        tags: p.tags,
        html: htmlBySlug.get(p.slug) ?? "",
        draft: p.status === "draft",
        publishAt: p.publishAt ? p.publishAt.toISOString() : "",
      })),
    ),
  ) as Array<{ slug: string; related: unknown[]; backlinks: unknown[] }>;

  const storedBySlug = new Map(stored.map((p) => [p.slug, p]));
  const changed = derived.flatMap((post) => {
    const row = storedBySlug.get(post.slug);
    if (post.slug === savedSlug || !row) return [];
    const relatedJson = JSON.stringify(post.related);
    const backlinksJson = JSON.stringify(post.backlinks);
    // The bulk sync stores an empty backlinks list as NULL and a save as "[]": the same answer.
    if (relatedJson === (row.related ?? "[]") && backlinksJson === (row.backlinks ?? "[]"))
      return [];
    return [{ slug: post.slug, relatedJson, backlinksJson }];
  });
  if (changed.length === 0) return [];

  await env.DB.batch(
    changed.map((c) =>
      env.DB.prepare(`UPDATE posts SET related = ?1, backlinks = ?2 WHERE slug = ?3`).bind(
        c.relatedJson,
        c.backlinksJson,
        c.slug,
      ),
    ),
  );
  return changed.map((c) => c.slug);
}

/**
 * The save's neighbor refresh, reported rather than raised: the commit and the saved row have landed, and
 * undoing either would destroy the source to repair derived lists. A failure is returned for the caller
 * to show and logged as an alert; the next save of any post re-derives and rewrites every stale list,
 * as does the ship's sync.
 */
export async function refreshNeighborsAfterSave(env: PublishEnv, slug: string) {
  try {
    const updated = await refreshNeighbors(env, slug);
    // The save's own purge ran before these rows changed, so a page re-stored in between would keep the old lists.
    const purged = updated.length > 0 ? await purgePosts(`refreshNeighbors ${slug}`) : null;
    return { ok: true as const, updated, purged };
  } catch (error) {
    console.error(
      JSON.stringify({ alert: "neighbor-refresh-failed", slug, detail: errorMessage(error) }),
    );
    return {
      ok: false as const,
      message:
        `The post saved, but the related and backlinks lists of the other posts could not be ` +
        `refreshed: ${errorMessage(error)}. Their lists stay as they were until the next save ` +
        `of any post or the next content sync.`,
    };
  }
}
