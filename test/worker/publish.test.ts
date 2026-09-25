import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from "vitest";

import { claimMediaKeyForDelete, upsertMediaRecord } from "~/db";
import {
  EditorError,
  deletePost,
  renderAndWrite,
  savePost,
  syncPostToD1,
  validateAndRender,
} from "~/lib/editor/publish.server";
import { PolicyError } from "~/lib/editor/publish-policy.mjs";
import { GitHubError } from "~/lib/editor/github.server";
import { DIVERGENCE_ERROR_NAME } from "~/lib/editor/converge.mjs";
import { postPath } from "~/lib/content/pipeline.mjs";
import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";

import { post } from "./fixtures";
import { stubGitHub, type GitHubStub } from "./github-stub";

/* Ask and R2 are absent on purpose: `syncAskForPost` returns null with no `AI_SEARCH`
 * binding, and the save must succeed anyway. */

const publishEnv = () => env as unknown as Parameters<typeof savePost>[0];

let gh: GitHubStub;

beforeEach(() => {
  gh = stubGitHub();
});

afterEach(() => {
  gh.restore();
});

/* Only `batch` fails: it is the one statement `syncPostToD1` depends on, and failing
 * anything wider would break the corpus read that runs before it. */
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
  it("lands the markdown at the post's path and changes no other file", async () => {
    const seed = {
      [postPath("neighbour")]: post("neighbour"),
      "README.md": "# A file a save must not touch\n",
    };
    gh.restore();
    gh = stubGitHub(seed);

    const raw = post("one-file");
    await savePost(publishEnv(), {
      slug: "one-file",
      raw,
      isNew: true,
      actor: { kind: "admin" },
    });

    expect(Object.fromEntries(gh.files)).toEqual({ ...seed, [postPath("one-file")]: raw });
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

  it("keeps a cited image from being deleted while any citation of it remains", async () => {
    const key = "dustin-edwards-abcd1234abcd1234-800x600.png";
    await env.MEDIA.put(key, "image bytes");
    await upsertMediaRecord(env as never, { key, alt: "", storage: "r2", kind: "image" });

    const image = `![alt](/media/${key})`;
    const save = (body: string, isNew: boolean) =>
      savePost(publishEnv(), {
        slug: "cites",
        raw: post("cites", { body }),
        isNew,
        actor: { kind: "admin" },
      });

    await save(`A paragraph.\n\n${image}\n\nAnother paragraph.\n\n${image}\n`, true);
    expect(await claimMediaKeyForDelete(env as never, key)).toBe(false);
    expect(await env.MEDIA.get(key)).not.toBeNull();

    await save(`A paragraph.\n\n${image}\n`, false);
    expect(await claimMediaKeyForDelete(env as never, key)).toBe(false);
    expect(await env.MEDIA.get(key)).not.toBeNull();

    /* The refusals above were the citations, not a missing row. */
    await save("A paragraph with no image.\n", false);
    expect(await claimMediaKeyForDelete(env as never, key)).toBe(true);
  });

  it("records two citations whose parts collide under a space join as two rows", async () => {
    /* The pipeline's forms carry no spaces, so no rendered post produces this
     * pair; the writer is handed it directly to prove the dedup keeps both. */
    const record = (await validateAndRender(publishEnv(), "collide", post("collide"))) as Record<
      string,
      unknown
    >;
    record.mediaRefs = [
      { key: "og/cover-1.png", form: "inline", detail: "line 3 alt" },
      { key: "og/cover-1.png", form: "inline line", detail: "3 alt" },
    ];
    await syncPostToD1(publishEnv(), record);

    expect(await countRows("media_refs", "WHERE source_id = ?1", "collide")).toBe(2);
  });

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

    /* The guard runs before any blob, so a refused save writes nothing anywhere. */
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
    /* The commit lands first with no compensating revert: a D1 fault leaves the repo
     * ahead rather than undoing authoritative writing to tidy a derived index. */
    const raw = post("retried");
    const result = await savePost(flakyD1(1), {
      slug: "retried",
      raw,
      isNew: true,
      actor: { kind: "admin" },
    });

    expect(result.d1Retried).toBe(true);
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
    expect((error as Error).message).toContain("diverged");
    expect((error as Error).message).toContain("Do NOT save again");

    expect(gh.files.get(postPath("diverged"))).toBe(raw);
    expect(await countRows("posts", "WHERE slug = ?1", "diverged")).toBe(0);

    /* The record goes to KV, never D1: D1 is the store that just failed. */
    const stored = await env.APP_KV.get("publish:divergence:diverged");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ slug: "diverged" });
  });

  it("writes nothing to the database when the commit fails", async () => {
    /* The ref update is the commit's last step, so every other part of the
     * commit has already been sent when it fails. */
    gh.failNext("/git/refs/heads/main", 5);
    const postsBefore = await countRows("posts");

    await expect(
      savePost(publishEnv(), {
        slug: "never-committed",
        raw: post("never-committed", {
          body: "Body.\n\n![alt](/media/dustin-edwards-feed1234feed1234-400x300.png)\n",
        }),
        isNew: true,
        actor: { kind: "admin" },
      }),
    ).rejects.toBeInstanceOf(GitHubError);

    expect(gh.files.has(postPath("never-committed"))).toBe(false);
    expect(await countRows("posts")).toBe(postsBefore);
    expect(await countRows("search_docs", "WHERE doc_uid = ?1", "post:never-committed")).toBe(0);
    expect(await countRows("media_refs", "WHERE source_id = ?1", "never-committed")).toBe(0);
  });

  it("answers the operator with a 500 that says the commit landed when D1 fails twice", async () => {
    const raw = post("committed-anyway");
    const result = await runTool(
      flakyD1(2) as never,
      { kind: "operator", id: "test" },
      "save_post",
      { slug: "committed-anyway", raw, isNew: true },
    );

    expect(result).toMatchObject({ ok: false, status: 500, detail: { committed: true } });
    expect(gh.files.get(postPath("committed-anyway"))).toBe(raw);
  });
});

describe("renderAndWrite", () => {
  it("REFUSES to write a row when the rendered bytes are not the committed blob", async () => {
    await expect(
      renderAndWrite(publishEnv(), "mismatched", post("mismatched"), "0".repeat(40)),
    ).rejects.toBeInstanceOf(EditorError);

    expect(await countRows("posts", "WHERE slug = ?1", "mismatched")).toBe(0);
    expect(await countRows("search_docs", "WHERE doc_uid = ?1", "post:mismatched")).toBe(0);
  });
});

describe("the FTS indexes", () => {
  const INDEXES = ["posts_fts", "search_identity", "search_prose"];
  const ftsEquality = async () =>
    (await runHealthChecks(publishEnv())).checks.find((c) => c.name === "fts-equality");

  it("stay consistent with their content through a save and a delete, and drift is reported", async () => {
    for (const slug of ["fts-kept", "fts-gone"]) {
      await savePost(publishEnv(), {
        slug,
        raw: post(slug),
        isNew: true,
        actor: { kind: "admin" },
      });
    }
    await deletePost(publishEnv(), { slug: "fts-gone", actor: { kind: "admin" } });

    /* Rank 1 checks each index against its external content table, not only itself. */
    for (const index of INDEXES) {
      await env.DB.prepare(`INSERT INTO ${index} (${index}, rank) VALUES ('integrity-check', 1)`).run();
    }
    expect(await ftsEquality()).toMatchObject({ ok: true });

    /* A hook, not a `finally`: a rebuild that threw there would replace the assertion's failure. */
    onTestFinished(async () => {
      await env.DB.prepare(`INSERT INTO posts_fts (posts_fts) VALUES ('rebuild')`).run();
    });
    await env.DB.prepare(`INSERT INTO posts_fts (posts_fts) VALUES ('delete-all')`).run();
    expect(await ftsEquality()).toMatchObject({ ok: false });
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
    /* Leftover media_refs would permanently refuse a media delete, because the
     * resolver and the table disagree and the union fails closed. */
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
    /* The policy check comes first so a refused caller cannot learn which slugs exist
     * from the difference between two error messages. */
    expect(gh.calls.slice(before)).toHaveLength(0);
    expect(await countRows("posts", "WHERE slug = ?1", "operator-cannot-delete")).toBe(1);
  });
});
