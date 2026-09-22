import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deletePost, savePost } from "~/lib/editor/publish.server";
import { PolicyError } from "~/lib/editor/publish-policy.mjs";
import { GitHubError } from "~/lib/editor/github.server";
import { DIVERGENCE_ERROR_NAME } from "~/lib/editor/converge.mjs";
import { postPath } from "~/lib/content/pipeline.mjs";
import { gitBlobSha } from "~/lib/content/hashes.mjs";

import { post } from "./fixtures";
import { stubGitHub, STUB_HEAD_SHA, type GitHubStub } from "./github-stub";

/**
 * `savePost` and `deletePost`, end to end, against real D1 and a stubbed
 * GitHub.
 *
 * OBSERVATION BOUNDARY. The commit shape is asserted against the recorded
 * calls, so this proves what the code SENDS, never that GitHub does what the
 * recorded shape says. D1 is miniflare-local with `drizzle/` applied. Ask and
 * R2 are absent from this file on purpose: `syncAskForPost` returns null with
 * no `AI_SEARCH` binding, which is the documented state of a deployment
 * without it, and the save must succeed anyway.
 */

/** The env `publish.server.ts` takes, which adds the editor token to `Env`. */
const publishEnv = () => env as unknown as Parameters<typeof savePost>[0];

let gh: GitHubStub;

beforeEach(() => {
  gh = stubGitHub();
});

afterEach(() => {
  gh.restore();
});

/**
 * The same env with a D1 whose `batch` fails the first `failures` times.
 *
 * A PROXY OVER THE REAL BINDING, so every other method is the real one and the
 * successful retry writes real rows. Wrapping `batch` alone is deliberate:
 * that is the single statement `syncPostToD1` depends on, and failing anything
 * wider would break the corpus read that runs before it, which is a different
 * fault with a different remedy.
 */
function flakyD1(failures: number) {
  let remaining = failures;
  const db = env.DB;
  const proxy = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "batch") return Reflect.get(target, property, receiver);
      return async (statements: D1PreparedStatement[]) => {
        if (remaining > 0) {
          remaining -= 1;
          throw new Error("planted D1 batch failure");
        }
        return target.batch(statements);
      };
    },
  });
  return { ...env, DB: proxy } as unknown as Parameters<typeof savePost>[0];
}

async function countRows(table: string, where = "", ...binds: unknown[]) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} ${where}`)
    .bind(...binds)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

describe("savePost", () => {
  it("lands ONE file in the commit, and it is the markdown", async () => {
    const raw = post("one-file");
    await savePost(publishEnv(), {
      slug: "one-file",
      raw,
      isNew: true,
      actor: { kind: "admin" },
    });

    const trees = gh.calls.filter((c) => c.path.endsWith("/git/trees"));
    expect(trees).toHaveLength(1);
    const first = trees[0];
    if (!first) throw new Error("no tree POST was recorded");
    const tree = (first.body as { tree: Array<{ path: string }> }).tree;
    /* ONE ENTRY. Since the artifact arc a save carries markdown and nothing
     * else; a second entry would mean the corpus artifact was back in git. */
    expect(tree.map((e) => e.path)).toEqual([postPath("one-file")]);

    /*
     * THE WHOLE CALL SEQUENCE, in order, asserted as a LIST rather than by
     * spot-checking one member. The Git Data shape (blob, tree, commit, ref)
     * exists for the `expectedHeadSha` seam that the Contents write path has
     * no room for, and the leading Contents READ is the authority on whether
     * this post has ever existed, which is what `decide()` needs before any
     * render is paid for. A list is what catches an EXTRA call as well as a
     * missing one; the second read this repo used to make is gone since the
     * artifact arc, and nothing but a full list would notice it coming back.
     */
    expect(gh.calls.map((c) => `${c.method} ${c.path.split("?")[0]}`)).toEqual([
      "GET /repos/DrDustinEdwards/dustinedwards-info/contents/content/posts/one-file.md",
      "GET /repos/DrDustinEdwards/dustinedwards-info/git/ref/heads/main",
      `GET /repos/DrDustinEdwards/dustinedwards-info/git/commits/${STUB_HEAD_SHA}`,
      "POST /repos/DrDustinEdwards/dustinedwards-info/git/blobs",
      "POST /repos/DrDustinEdwards/dustinedwards-info/git/trees",
      "POST /repos/DrDustinEdwards/dustinedwards-info/git/commits",
      "PATCH /repos/DrDustinEdwards/dustinedwards-info/git/refs/heads/main",
    ]);
  });

  it("writes a posts row carrying BOTH provenance hashes", async () => {
    const result = await savePost(publishEnv(), {
      slug: "provenance",
      raw: post("provenance"),
      isNew: true,
      actor: { kind: "admin" },
    });

    const row = await env.DB.prepare(
      "SELECT slug, status, source_blob_sha, render_hash FROM posts WHERE slug = ?1",
    )
      .bind("provenance")
      .first<{ slug: string; status: string; source_blob_sha: string; render_hash: string }>();

    expect(row?.slug).toBe("provenance");
    expect(row?.status).toBe("draft");
    /* THE SOURCE SHA IS THE COMMITTED FILE'S, not a value the render invented.
     * `renderAndWrite` refuses unless they agree, so this asserts the two are
     * the same fact rather than two hashes that happen to be present. */
    expect(row?.source_blob_sha).toBe(await gitBlobSha(gh.files.get(postPath("provenance")) ?? ""));
    expect(row?.render_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.record.slug).toBe("provenance");
  });

  it("writes the fts and search_docs rows in the same batch as the post", async () => {
    await savePost(publishEnv(), {
      slug: "indexed",
      raw: post("indexed"),
      isNew: true,
      actor: { kind: "admin" },
    });

    expect(await countRows("search_docs", "WHERE doc_uid = ?1", "post:indexed")).toBeGreaterThan(0);
    /* The FTS index is rebuilt rather than left to per-row triggers, so the
     * assertion is that it holds the post, not that a trigger fired. */
    const fts = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM posts_fts WHERE posts_fts MATCH ?1",
    )
      .bind("indexed")
      .first<{ n: number }>();
    expect(fts?.n ?? 0).toBeGreaterThan(0);
  });

  it("records the media_refs a post's body cites, keyed by the NUL join", async () => {
    /*
     * ONE IMAGE CITED TWICE. The primary key is (key, form, detail) and the
     * pipeline's `detail` for an inline image is its LINE, so two citations of
     * the same blob produce two rows rather than one deduped row.
     *
     * That is the property `mediaRefKey`'s NUL join protects: the dedupe key
     * is `key \0 form \0 detail`, and under a printable separator two
     * different (form, detail) pairs can produce one string, at which point the
     * second citation is silently dropped. The assertion below is that both
     * survive, which is the observable form of the same fact.
     */
    const key = "/media/dustin-edwards-abcd1234abcd1234-800x600.png";
    await savePost(publishEnv(), {
      slug: "cites",
      raw: post("cites", {
        body: `A paragraph.\n\n![first alt](${key})\n\nAnother paragraph.\n\n![second alt](${key})\n`,
      }),
      isNew: true,
      actor: { kind: "admin" },
    });

    const rows = await env.DB.prepare(
      "SELECT media_key, form, detail FROM media_refs WHERE source_type = 'post' AND source_id = ?1",
    )
      .bind("cites")
      .all<{ media_key: string; form: string; detail: string | null }>();

    expect(rows.results.length).toBeGreaterThanOrEqual(2);
    expect(new Set(rows.results.map((r) => r.media_key))).toEqual(new Set([key.slice("/media/".length)]));
    expect(new Set(rows.results.map((r) => r.form))).toEqual(new Set(["markdown-image"]));
    /* Two DISTINCT details, so the two rows are two rows. */
    expect(new Set(rows.results.map((r) => r.detail)).size).toBe(2);
  });

  /* --------------------------------------------------------- refusals --- */

  it("REFUSES when main moved under the caller (expectedHeadSha)", async () => {
    await expect(
      savePost(publishEnv(), {
        slug: "stale",
        raw: post("stale"),
        isNew: true,
        expectedHeadSha: "0000000000000000000000000000000000000000",
        actor: { kind: "admin" },
      }),
    ).rejects.toBeInstanceOf(GitHubError);

    /* NOTHING WAS WRITTEN, which is the half that matters. The guard runs
     * before any blob, so a refused save leaves the repository and the
     * database exactly as they were. */
    expect(gh.calls.some((c) => c.path.endsWith("/git/blobs"))).toBe(false);
    expect(gh.files.has(postPath("stale"))).toBe(false);
    expect(await countRows("posts", "WHERE slug = ?1", "stale")).toBe(0);
  });

  it("REFUSES an operator's first publication, naming the policy", async () => {
    const error = await savePost(publishEnv(), {
      slug: "never-public",
      raw: post("never-public", { draft: false }),
      isNew: true,
      actor: { kind: "operator", id: "test" },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PolicyError);
    expect((error as PolicyError).policy).toBe("first-publish-requires-admin");
    expect(gh.files.has(postPath("never-public"))).toBe(false);
  });

  it("RETRIES a failed D1 write once and reports that it retried", async () => {
    /*
     * THE ORDER IS THE DESIGN. The commit lands first and there is deliberately
     * no compensating revert, so a D1 fault must leave the repo ahead and say
     * so rather than undoing authoritative writing to tidy a derived index.
     *
     * The fault is injected at the BATCH, which is the statement
     * `syncPostToD1` actually depends on, rather than inside
     * `convergeWithRetry`. Breaking the helper would test the helper; breaking
     * the store tests the path.
     */
    const raw = post("retried");
    const result = await savePost(flakyD1(1), {
      slug: "retried",
      raw,
      isNew: true,
      actor: { kind: "admin" },
    });

    expect(result.d1Retried).toBe(true);
    /* THE COMMIT STANDS, and so does the row: one attempt failed, the second
     * succeeded, and the caller is told rather than left to guess. */
    expect(gh.files.get(postPath("retried"))).toBe(raw);
    expect(await countRows("posts", "WHERE slug = ?1", "retried")).toBe(1);
  });

  it("RECORDS a divergence in KV when every attempt fails, and the commit stands", async () => {
    const raw = post("diverged");
    const error = await savePost(flakyD1(Number.POSITIVE_INFINITY), {
      slug: "diverged",
      raw,
      isNew: true,
      actor: { kind: "admin" },
    }).catch((e: unknown) => e);

    expect((error as Error).name).toBe(DIVERGENCE_ERROR_NAME);
    /* IT NAMES THE POST AND THE COMMIT, because the operator's next action
     * depends on knowing the writing is safe and a second save is useless. */
    expect((error as Error).message).toContain("diverged");
    expect((error as Error).message).toContain("Do NOT save again");

    /* THE COMMIT LANDED AND STAYS. There is no compensating revert. */
    expect(gh.files.get(postPath("diverged"))).toBe(raw);
    expect(await countRows("posts", "WHERE slug = ?1", "diverged")).toBe(0);

    /*
     * THE RECORD GOES TO KV, NEVER TO D1. D1 is the store that just failed, and
     * a record of that failure kept there is absent exactly when it is wanted.
     */
    const stored = await env.APP_KV.get("publish:divergence:diverged");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ slug: "diverged" });
  });
});

describe("deletePost", () => {
  it("lands ONE deletion commit and clears every row the post owned", async () => {
    const key = "/media/dustin-edwards-beef1234beef1234-400x300.png";
    await savePost(publishEnv(), {
      slug: "doomed",
      raw: post("doomed", { body: `Body.\n\n![alt](${key})\n` }),
      isNew: true,
      actor: { kind: "admin" },
    });
    expect(await countRows("posts", "WHERE slug = ?1", "doomed")).toBe(1);
    expect(await countRows("media_refs", "WHERE source_id = ?1", "doomed")).toBeGreaterThan(0);

    const before = gh.calls.length;
    await deletePost(publishEnv(), { slug: "doomed", actor: { kind: "admin" } });

    const tree = gh.calls
      .slice(before)
      .find((c) => c.path.endsWith("/git/trees"))?.body as { tree: Array<{ path: string; sha: string | null }> };
    /* A DELETION IS `sha: null` ON THE PATH, one entry, no blob created. */
    expect(tree.tree).toEqual([
      { path: postPath("doomed"), mode: "100644", type: "blob", sha: null },
    ]);
    expect(gh.files.has(postPath("doomed"))).toBe(false);

    expect(await countRows("posts", "WHERE slug = ?1", "doomed")).toBe(0);
    expect(await countRows("search_docs", "WHERE doc_uid = ?1", "post:doomed")).toBe(0);
    /*
     * THE `media_refs` DELETE IS FINDING B003, replayed. Leaving these behind
     * did not produce a stale row, it produced a PERMANENTLY REFUSED media
     * delete: the resolver reported zero citations while the table still
     * claimed one, and the union fails closed.
     */
    expect(await countRows("media_refs", "WHERE source_id = ?1", "doomed")).toBe(0);
  });

  it("REFUSES an operator's delete, naming the policy, before reading the file", async () => {
    await savePost(publishEnv(), {
      slug: "operator-cannot-delete",
      raw: post("operator-cannot-delete"),
      isNew: true,
      actor: { kind: "admin" },
    });

    const before = gh.calls.length;
    const error = await deletePost(publishEnv(), {
      slug: "operator-cannot-delete",
      actor: { kind: "operator", id: "test" },
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PolicyError);
    expect((error as PolicyError).policy).toBe("delete-requires-admin");
    /*
     * NOT ONE REQUEST WAS MADE. The policy decision is the first statement in
     * the function precisely so a refused caller cannot learn which slugs exist
     * from the difference between two error messages.
     */
    expect(gh.calls.slice(before)).toHaveLength(0);
    expect(await countRows("posts", "WHERE slug = ?1", "operator-cannot-delete")).toBe(1);
  });
});
