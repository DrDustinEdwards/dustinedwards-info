import { env } from "cloudflare:test";

import { SITE_ORIGIN } from "~/lib/seo";

import { seedPost } from "./seed";

/* Shared by the three webmention files: the endpoint, the moderation queue and the post loader. */

export const TARGET_SLUG = "a-mentioned-post";
export const TARGET = `${SITE_ORIGIN}/blog/${TARGET_SLUG}`;

export async function mentionRow(sourceUrl: string) {
  return env.DB.prepare(`SELECT * FROM webmentions WHERE source_url = ?1`)
    .bind(sourceUrl)
    .first<{
      id: number;
      status: string;
      author_name: string | null;
      author_url: string | null;
      excerpt: string | null;
      failure_reason: string | null;
      target_slug: string;
    }>();
}

/** Each file's `beforeEach`. */
export async function resetMentions() {
  /* Emptied between cases: D1 persists for the whole file and the global-cap case asserts an
   * exact count. */
  await env.DB.prepare(`DELETE FROM webmentions`).run();
  await seedPost(TARGET_SLUG);
}
