import { createExecutionContext } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getBlogPost } from "~/db";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { previewPost } from "~/lib/carrel/site-adapter.server";
import { runCarrelSchedules } from "~/lib/carrel/site-api.server";
import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { postPath } from "~/lib/content/pipeline.mjs";
import { commitFiles } from "~/lib/source/store.server";
import { renderAndWrite, renderRecord } from "~/lib/editor/publish.server";
import { documentHandlerContext, postPreviewContext } from "~/lib/context";
import { LLMS_PATH } from "~/lib/llms/validate.mjs";
import { authenticateOperator } from "~/lib/operator/auth.server";
import { loader as postLoader } from "~/routes/blog.$slug";
import { post } from "./fixtures";
import {
  putSource,
  removeSource,
  source,
  stubSources,
  versionOf,
  writes,
  type SourceStub,
  commits,
} from "./source-stub";
import { routeContext, carrelRequest } from "./route-helpers";
import { seedPost } from "./seed";
import { testEnv } from "./test-env";
import {
  HEAD,
  ORIGIN,
  PREFIX,
  argsFor,
  get,
  headersFor,
  mediaCall,
  send,
  siteEnv,
} from "./carrel-api-fixtures";

/** The title of the post a preview render was handed, through the context its `set` writes. */
function previewTitle(set: (context: RouterContextProvider) => void): string | undefined {
  const context = new RouterContextProvider();
  set(context);
  return context.get(postPreviewContext)?.title;
}

let gh: SourceStub;

beforeEach(async () => {
  gh = await stubSources();
});

afterEach(async () => {
  await gh.restore();
});

describe("the Carrel key reaches only its prefix", () => {
  it("REFUSES the Carrel key on the operator API", async () => {
    const request = new Request(`${ORIGIN}/api/operator`, {
      method: "POST",
      headers: { authorization: `Bearer ${testEnv.CARREL_SITE_KEY}` },
    });
    const result = await authenticateOperator(
      testEnv as unknown as Parameters<typeof authenticateOperator>[0],
      request,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it("REFUSES to serve a path outside /api/carrel/v1 even with the key", async () => {
    expect((await get(`${ORIGIN}/api/carrel/v2/content`)).status).toBe(404);
  });

  it("REFUSES the operator token on the Carrel prefix", async () => {
    const response = await get(`${PREFIX}/content`, testEnv.OPERATOR_TOKEN);
    expect(response.status).toBe(401);
  });
  it("answers the key on its prefix, where a list searches bodies and filters by author", async () => {
    const response = await get(`${PREFIX}/meta`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ site: { id: "dustinedwards-info" } });

    const own = post("find-own", { body: "A zymurgy paragraph about brewing.\n" });
    const guest = post("find-guest", { body: "Nothing special here.\n" }).replace(
      /^tags:/m,
      'authors: ["Guest Writer"]\ntags:',
    );
    for (const [slug, raw] of [
      ["find-own", own],
      ["find-guest", guest],
    ] as const) {
      await putSource(postPath(slug), raw);
      await seedPost(slug);
    }
    const ids = async (query: string) => {
      const response = await get(`${PREFIX}/content?${query}&limit=50`);
      expect(response.status).toBe(200);
      return ((await response.json()) as { items: { id: string }[] }).items.map((i) => i.id);
    };

    expect(await ids("q=zymurgy")).toEqual([expect.stringContaining("find-own")]);
    expect(await ids("author=Guest%20Writer")).toEqual([expect.stringContaining("find-guest")]);
    expect(await ids("author=Dustin%20Edwards")).toEqual([expect.stringContaining("find-own")]);
  });
});

describe("every write names the version it was loaded at", () => {
  it("REFUSES a stale expectedVersion, names the current one, and commits nothing", async () => {
    await putSource(postPath("carrel-stale"), post("carrel-stale"));
    const before = await source(postPath("carrel-stale"));

    const response = await send("PUT", `${PREFIX}/content/carrel-stale/draft`, {
      source: post("carrel-stale", { title: "Changed" }),
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "version-conflict",
      currentVersion: await gitBlobSha(before ?? ""),
    });
    expect(await source(postPath("carrel-stale"))).toBe(before);
  });

  it("REFUSES a version for an id that does not exist, with a null current version", async () => {
    const response = await send("POST", `${PREFIX}/content/carrel-missing/publish`, {
      expectedVersion: HEAD,
      changeId: "chg-missing",
      source: post("carrel-missing"),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "version-conflict",
      currentVersion: null,
    });
    expect((await source(postPath("carrel-missing"))) !== undefined).toBe(false);
  });

  it("REFUSES a create over an id that exists", async () => {
    await putSource(postPath("carrel-taken"), post("carrel-taken"));
    const response = await send("PUT", `${PREFIX}/content/carrel-taken/draft`, {
      source: post("carrel-taken", { title: "Other" }),
      expectedVersion: null,
      changeId: "chg-taken",
    });
    expect(response.status).toBe(409);
  });
});

/* A post's version identifies that post's file, not the repository's head, so saving one post must not make
 * every other open post look changed. */
describe("a post's version is its own", () => {
  const readVersion = async (id: string) => {
    const response = await get(`${PREFIX}/content/${id}`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { version: string }).version;
  };
  const save = (id: string, title: string, expectedVersion: string) =>
    send("PUT", `${PREFIX}/content/${id}/draft`, {
      source: post(id, { title }),
      expectedVersion,
      changeId: `chg-${id}-${title.replace(/\W+/g, "-")}`,
    });

  it("is the blob sha of the post's file at head", async () => {
    const raw = post("own-sha");
    await putSource(postPath("own-sha"), raw);
    expect(await readVersion("own-sha")).toBe(await gitBlobSha(raw));
  });

  it("does not change when another post is committed", async () => {
    await putSource(postPath("own-a"), post("own-a"));
    await putSource(postPath("own-b"), post("own-b"));
    const before = await readVersion("own-a");

    const saved = await save("own-b", "B edited", await readVersion("own-b"));
    expect(saved.status).toBe(200);

    expect(await readVersion("own-a")).toBe(before);
  });

  it("changes when this post is committed, and the save answers the new version", async () => {
    await putSource(postPath("own-c"), post("own-c"));
    const before = await readVersion("own-c");

    const saved = await save("own-c", "C edited", before);
    expect(saved.status).toBe(200);
    const answered = ((await saved.json()) as { version: string }).version;

    expect(answered).not.toBe(before);
    expect(await readVersion("own-c")).toBe(answered);
    expect(answered).toBe(await gitBlobSha((await source(postPath("own-c"))) ?? ""));
  });

  it("lets two posts be saved in one sitting without a false conflict", async () => {
    await putSource(postPath("own-d"), post("own-d"));
    await putSource(postPath("own-e"), post("own-e"));
    const d = await readVersion("own-d");
    const e = await readVersion("own-e");

    expect((await save("own-d", "D edited", d)).status).toBe(200);
    expect((await save("own-e", "E edited", e)).status).toBe(200);
  });

  it("still REFUSES a save made from a version this post has since moved past", async () => {
    await putSource(postPath("own-f"), post("own-f"));
    const opened = await readVersion("own-f");
    expect((await save("own-f", "F first", opened)).status).toBe(200);
    const afterFirst = await source(postPath("own-f"));

    const stale = await save("own-f", "F second", opened);

    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: "version-conflict",
      currentVersion: await gitBlobSha(afterFirst ?? ""),
    });
    expect(await source(postPath("own-f"))).toBe(afterFirst);
  });

  it("answers the post's own version when a create finds the id taken", async () => {
    const raw = post("own-g");
    await putSource(postPath("own-g"), raw);
    const response = await send("PUT", `${PREFIX}/content/own-g/draft`, {
      source: post("own-g", { title: "Other" }),
      expectedVersion: null,
      changeId: "chg-own-g",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ currentVersion: await gitBlobSha(raw) });
  });
});

/* The check lives in commitFiles, against the head the commit is parented on, so a change that lands between a
 * writer's read and its write is refused there whichever kind is writing. */
describe("commitFiles refuses a file that is not the one the writer loaded", () => {
  const commit = (expected: string | null) =>
    commitFiles(testEnv as never, {
      message: "Update guarded",
      changes: [{ path: "content/guarded.md", content: "after\n" }],
      expectedBlobs: { "content/guarded.md": expected },
    });
  const commits = async () => (await writes()).length;

  it("REFUSES a write over a file that changed since it was loaded, and commits nothing", async () => {
    const loaded = await gitBlobSha("before\n");
    await putSource("content/guarded.md", "changed by someone else\n");
    await expect(commit(loaded)).rejects.toMatchObject({ conflict: true, status: 409 });
    expect(await commits()).toBe(0);
    expect(await source("content/guarded.md")).toBe("changed by someone else\n");
  });

  it("REFUSES a write that expects the file absent when it exists", async () => {
    await putSource("content/guarded.md", "there\n");
    await expect(commit(null)).rejects.toMatchObject({ conflict: true });
    expect(await commits()).toBe(0);
  });

  it("commits when the file is the one that was loaded, and when an absent one is still absent", async () => {
    await putSource("content/guarded.md", "before\n");
    await commit(await gitBlobSha("before\n"));
    expect(await source("content/guarded.md")).toBe("after\n");
    await removeSource("content/guarded.md");
    await commit(null);
    expect(await commits()).toBe(2);
  });
});

describe("the first publication", () => {
  it("ALLOWS it from Carrel's key, and the commit records who published", async () => {
    const draft = post("carrel-first", { draft: true });
    await putSource(postPath("carrel-first"), draft);

    const response = await send("POST", `${PREFIX}/content/carrel-first/publish`, {
      expectedVersion: await gitBlobSha(draft),
      changeId: "chg-first",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "published", changeId: "chg-first" });
    const saved = (await source(postPath("carrel-first"))) ?? "";
    expect(saved).toMatch(/^draft: false$/m);
    expect(saved).toMatch(/^first_published: /m);
    const commit = (await writes()).map((w) => ({ body: { message: w.message } }))[0];
    const message = (commit?.body as { message?: string } | undefined)?.message;
    expect(message).toContain("[carrel:chg-first]");
  });
});

describe("status belongs to the site", () => {
  it("keeps a live post live when Carrel saves its source", async () => {
    const live = post("carrel-live", { draft: false, first_published: "2026-07-01" });
    await putSource(postPath("carrel-live"), live);
    const response = await send("PUT", `${PREFIX}/content/carrel-live/draft`, {
      source: post("carrel-live", { draft: true, title: "Edited live" }),
      expectedVersion: await gitBlobSha(live),
      changeId: "chg-live",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "published" });
    expect(await source(postPath("carrel-live"))).toMatch(/^draft: false$/m);
  });

  it("changes only the draft and publish_at lines, so keys the editor does not know survive", () => {
    const raw = `---\ntitle: "T"\ndraft: true\nwriting_status: draft\nkey_takeaways:\n  - one\n---\n\nBody\n`;
    const out = withPublication(raw, { draft: false, publishAt: "2026-12-01T09:00:00.000Z" });
    expect(out).toBe(
      `---\ntitle: "T"\ndraft: false\nwriting_status: draft\nkey_takeaways:\n  - one\npublish_at: "2026-12-01T09:00:00.000Z"\n---\n\nBody\n`,
    );
  });
});

describe("a scheduled update to a live post", () => {
  it("keeps the live post served until its time, then the cron puts the update live and drops it", async () => {
    const live = post("carrel-later", {
      draft: false,
      first_published: "2026-07-01",
      title: "Live",
    });
    await putSource(postPath("carrel-later"), live);
    const at = new Date(Date.now() + 3_600_000).toISOString();

    const response = await send("POST", `${PREFIX}/content/carrel-later/schedule`, {
      source: post("carrel-later", {
        draft: false,
        first_published: "2026-07-01",
        title: "Updated",
      }),
      publishAt: at,
      expectedVersion: await gitBlobSha(live),
      changeId: "chg-later",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "published",
      scheduledUpdate: { changeId: "chg-later" },
    });
    expect(await source(postPath("carrel-later"))).toBe(live);

    const env = siteEnv() as unknown as Env;
    const early = await runCarrelSchedules(env, createExecutionContext(), new Date());
    expect(early.applied).toHaveLength(0);

    const run = await runCarrelSchedules(
      env,
      createExecutionContext(),
      new Date(Date.parse(at) + 1000),
    );
    expect(run).toMatchObject({ applied: [{ id: "carrel-later", kind: "update" }], failed: 0 });
    const saved = (await source(postPath("carrel-later"))) ?? "";
    expect(saved).toMatch(/^title: "?Updated"?$/m);
    expect(saved).toMatch(/^draft: false$/m);
    expect((await get(`${PREFIX}/content/carrel-later/schedule`)).status).toBe(404);
  });
});

describe("the preview", () => {
  it("builds exactly the loader data the published page reads from D1", async () => {
    const raw = post("carrel-preview-match", { draft: false, first_published: "2026-07-01" });
    await putSource(postPath("carrel-preview-match"), raw);
    await renderAndWrite(siteEnv(), "carrel-preview-match", raw);
    /* Older than this run, so a preview that stamps its own time cannot match by landing in the
     * same second as the sync. */
    await testEnv.DB.prepare(`UPDATE posts SET updated_at = 1767225600 WHERE slug = ?1`)
      .bind("carrel-preview-match")
      .run();

    const published = await getBlogPost(siteEnv(), "carrel-preview-match");
    const preview = await previewPost(
      siteEnv(),
      await renderRecord(siteEnv(), "carrel-preview-match", raw),
    );

    expect(published).not.toBeNull();
    expect(preview).toEqual(published);
  });

  it('ALLOWS a draft with no front matter as "Untitled", and a save of it is still REFUSED', async () => {
    const request = new Request(`${PREFIX}/preview`, {
      method: "POST",
      headers: headersFor(testEnv.CARREL_SITE_KEY),
      body: JSON.stringify({ source: "# A heading only\n" }),
    });
    const args = argsFor(request) as unknown as { context: ReturnType<typeof routeContext> };
    args.context.set(
      documentHandlerContext,
      async (_request, set) =>
        new Response(`<title>${previewTitle(set)}</title>`, {
          headers: { "content-type": "text/html" },
        }),
    );
    const preview = await carrelRequest(args as never);
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain("<title>Untitled</title>");

    const saved = await send("PUT", `${PREFIX}/content/no-title/draft`, {
      source: "# A heading only\n",
      expectedVersion: null,
      changeId: "chg-no-title",
    });
    expect(saved.status).toBe(422);
    expect(await source(postPath("no-title"))).toBeUndefined();
  });
});

/* Media (site-api v0.2.0): the site's own store, list, reference check and delete, behind the same
 * key and limiter. Each case uploads its own bytes, so its own content-addressed key. */

/* The source at a revision, and the optional content delete. */
describe("a revision's source", () => {
  it("opens an old revision of a post, and answers 404 for a version the repository does not hold", async () => {
    await putSource(postPath("rev-open"), post("rev-open"));
    const sha = await versionOf(postPath("rev-open"));
    await putSource(postPath("rev-open"), post("rev-open", { title: "Retitled" }));
    const found = await get(`${PREFIX}/content/rev-open/revisions/${sha}`);
    expect(found.status).toBe(200);
    expect(await found.json()).toMatchObject({
      id: "rev-open",
      version: sha,
      source: post("rev-open"),
    });

    const notAVersion = await get(`${PREFIX}/content/rev-open/revisions/not-a-sha`);
    expect(notAVersion.status).toBe(404);
  });
});

describe("content delete", () => {
  const remove = (id: string, expectedVersion: string, changeId: string, key?: string) =>
    mediaCall(
      "DELETE",
      `${PREFIX}/content/${id}?expectedVersion=${encodeURIComponent(expectedVersion)}&changeId=${changeId}`,
      key ? { key } : {},
    );

  it("deletes the post at its current version, records the change id, and clears its rows", async () => {
    const raw = post("del-ok");
    await putSource(postPath("del-ok"), raw);
    await seedPost("del-ok");

    const response = await remove("del-ok", await gitBlobSha(raw), "chg-del-ok");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "del-ok", deleted: true, changeId: "chg-del-ok" });
    expect((await source(postPath("del-ok"))) !== undefined).toBe(false);
    expect(await commits()).toHaveLength(1);
    expect(JSON.stringify((await commits())[0]?.body)).toContain("[carrel:chg-del-ok]");
    expect(await getBlogPost(testEnv as never, "del-ok")).toBeNull();
  });

  it("REFUSES a stale version, names the current one, and deletes nothing", async () => {
    const raw = post("del-stale");
    await putSource(postPath("del-stale"), raw);

    const response = await remove("del-stale", "b".repeat(40), "chg-del-stale");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "version-conflict",
      currentVersion: await gitBlobSha(raw),
    });
    expect(await source(postPath("del-stale"))).toBe(raw);
    expect(await commits()).toHaveLength(0);
  });

  it("answers 404 for a post the site does not hold", async () => {
    const response = await remove("del-missing", "a".repeat(40), "chg-del-missing");
    expect(response.status).toBe(404);
    expect(await commits()).toHaveLength(0);
  });

  it("REFUSES a kind that has no delete, and deletes nothing", async () => {
    const response = await remove("page.privacy", "a".repeat(40), "chg-del-page");
    expect(response.status).toBe(422);
    expect(await commits()).toHaveLength(0);
  });

  it("REFUSES without the key", async () => {
    const raw = post("del-nokey");
    await putSource(postPath("del-nokey"), raw);
    const response = await remove("del-nokey", await gitBlobSha(raw), "chg-del-nokey", "wrong-key");
    expect(response.status).toBe(401);
    expect(await source(postPath("del-nokey"))).toBe(raw);
  });
});

describe("the v0.17.0 contract on posts", () => {
  const live = (slug: string) => post(slug, { draft: false, first_published: "2026-07-01" });
  const list = async (query: string) =>
    (await (await get(`${PREFIX}/content?${query}`)).json()) as {
      items: Array<{ id: string; trashedAt?: string | null; version?: string }>;
      filtered?: string[];
    };

  it("trashes a live post off the site, lists it only in the trash, and restores it as a draft", async () => {
    await putSource(postPath("v17-trash"), live("v17-trash"));
    await seedPost("v17-trash");

    const trashed = await send("POST", `${PREFIX}/content/v17-trash/trash`, {
      expectedVersion: await versionOf(postPath("v17-trash")),
      changeId: "chg-v17-trash",
    });
    expect(trashed.status).toBe(200);
    expect(await trashed.json()).toMatchObject({ status: "draft" });
    expect(await source(postPath("v17-trash"))).toMatch(/^draft: true$/m);

    expect((await list("limit=200")).items.map((i) => i.id)).not.toContain("v17-trash");
    const trash = await list("trashed=true&kind=post&limit=200");
    expect(trash.filtered).toEqual(["kind", "trashed"]);
    expect(trash.items).toEqual([
      expect.objectContaining({
        id: "v17-trash",
        version: await versionOf(postPath("v17-trash")),
        trashedAt: expect.any(String),
      }),
    ]);

    const version = await versionOf(postPath("v17-trash"));
    const republish = await send("POST", `${PREFIX}/content/v17-trash/publish`, {
      expectedVersion: version,
      changeId: "chg-v17-pub",
    });
    expect(republish.status).toBe(422);
    const restored = await send("POST", `${PREFIX}/content/v17-trash/restore`, {
      expectedVersion: version,
      changeId: "chg-v17-restore",
    });
    expect(await restored.json()).toMatchObject({ status: "draft" });
    expect((await list("limit=200")).items.map((i) => i.id)).toContain("v17-trash");
  });

  it("renames a live post with its history, its old address answers a permanent redirect, and deleting it leaves no rows", async () => {
    await putSource(postPath("v17-old"), live("v17-old"));
    const renamed = await send("POST", `${PREFIX}/content/v17-old/rename`, {
      newId: "v17-new",
      expectedVersion: await versionOf(postPath("v17-old")),
      changeId: "chg-v17-rename",
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      id: "v17-new",
      status: "published",
      previousPath: "/writing/v17-old",
    });
    expect(await source(postPath("v17-old"))).toBeUndefined();
    expect(await source(postPath("v17-new"))).toMatch(/^slug: v17-new$/m);
    const history = (await (await get(`${PREFIX}/content/v17-new/revisions`)).json()) as {
      items: unknown[];
    };
    expect(history.items).toHaveLength(2);

    const args = {
      request: new Request(`${ORIGIN}/writing/v17-old`),
      params: { slug: "v17-old" },
      context: routeContext(),
    };
    const moved = await (postLoader(args as never) as Promise<unknown>).catch(
      (thrown: unknown) => thrown,
    );
    expect(moved).toBeInstanceOf(Response);
    expect((moved as Response).status).toBe(301);
    expect((moved as Response).headers.get("location")).toBe(`${ORIGIN}/writing/v17-new`);

    // Trashed and deleted under its new slug, it leaves neither a trash entry nor a redirect.
    const trashed = await send("POST", `${PREFIX}/content/v17-new/trash`, {
      expectedVersion: await versionOf(postPath("v17-new")),
      changeId: "chg-v17-old-trash",
    });
    expect(trashed.status).toBe(200);
    const version = await versionOf(postPath("v17-new"));
    const deleted = await carrelRequest(
      argsFor(
        new Request(
          `${PREFIX}/content/v17-new?expectedVersion=${version}&changeId=chg-v17-old-delete`,
          { method: "DELETE", headers: headersFor(testEnv.CARREL_SITE_KEY) },
        ),
      ),
    );
    expect(deleted.status).toBe(200);
    const leftovers = await testEnv.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM content_trash WHERE content_id = 'v17-new')
            + (SELECT COUNT(*) FROM post_redirects WHERE to_slug = 'v17-new') AS n`,
    ).first<{ n: number }>();
    expect(leftovers?.n).toBe(0);
  });

  it("publishes under the date Carrel names", async () => {
    await putSource(postPath("v17-dated"), post("v17-dated"));
    const response = await send("POST", `${PREFIX}/content/v17-dated/publish`, {
      expectedVersion: await versionOf(postPath("v17-dated")),
      changeId: "chg-v17-dated",
      publishedAt: "2025-03-04T05:06:07.000Z",
    });
    expect(await response.json()).toMatchObject({ status: "published" });
    const saved = (await source(postPath("v17-dated"))) ?? "";
    expect(saved).toMatch(/^date: 2025-03-04$/m);
    expect(saved).toMatch(/^publish_at: "2025-03-04T05:06:07.000Z"$/m);
  });

  it("announces a first publish that goes live by time once, with no write", async () => {
    await putSource(postPath("v17-later"), post("v17-later"));
    const at = new Date(Date.now() + 3_600_000).toISOString();
    const scheduled = await send("POST", `${PREFIX}/content/v17-later/schedule`, {
      publishAt: at,
      expectedVersion: await versionOf(postPath("v17-later")),
      changeId: "chg-v17-later",
    });
    expect(await scheduled.json()).toMatchObject({ status: "scheduled" });
    const version = await versionOf(postPath("v17-later"));

    const env = siteEnv() as unknown as Env;
    const after = new Date(Date.parse(at) + 1000);
    const run = await runCarrelSchedules(env, createExecutionContext(), after);
    expect(run.applied).toEqual([
      expect.objectContaining({ id: "v17-later", kind: "publish", version }),
    ]);
    expect(await versionOf(postPath("v17-later"))).toBe(version);
    expect((await runCarrelSchedules(env, createExecutionContext(), after)).applied).toEqual([]);
  });

  it("serves a preview link with no key, noindex and never stored, and refuses an unknown token", async () => {
    await putSource(postPath("v17-share"), post("v17-share", { title: "Shared draft" }));
    const made = await send("POST", `${PREFIX}/preview-links`, {
      id: "v17-share",
      changeId: "chg-v17-share",
    });
    expect(made.status).toBe(201);
    const { url } = (await made.json()) as { url: string };
    const token = new URL(url).pathname.split("/").pop()!;

    const open = (path: string) => {
      const context = routeContext();
      context.set(
        documentHandlerContext,
        async (_request, set) =>
          new Response(`<title>${previewTitle(set)}</title>`, {
            headers: { "content-type": "text/html" },
          }),
      );
      return carrelRequest({
        request: new Request(`${ORIGIN}${path}`),
        params: {},
        context,
      } as never);
    };
    const page = await open(`/preview/${token}`);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("<title>Shared draft</title>");
    expect(page.headers.get("x-robots-tag")).toMatch(/noindex/);
    expect(page.headers.get("cache-control")).toMatch(/no-store/);
    expect((await open(`/preview/${"x".repeat(43)}`)).status).toBe(404);
  });
});

describe("the site-api conformance suite", () => {
  it("passes against the real step, with write probes", async () => {
    const { runConformance } = await import("@dustinedwards/site-api/conformance");
    // The list is built from D1 and the generated artifacts, the history from the repository, and the stub
    // repository holds only what a case puts there: the first listed item (llms.txt) gets its file, as the
    // deployed repository has it.
    // Other cases seed posts in D1 with no file, so the first item may be a post: it gets its file too.
    await putSource(LLMS_PATH, "# dustinedwards.info\n");
    const first = (
      (await (await get(`${PREFIX}/content?limit=1`)).json()) as { items: Array<{ id: string }> }
    ).items[0];
    if (first && !first.id.includes(".")) await putSource(postPath(first.id), post(first.id));
    // Its own counters: the site's limiter (120 a minute, counted under the key) runs in the test's one Durable Object
    // namespace, which every case before this one has spent from. Names get a prefix, so the suite counts alone.
    const suite = {
      ASK_BUDGET: {
        idFromName: (name: string) => testEnv.ASK_BUDGET.idFromName(`conformance-suite:${name}`),
        get: (id: DurableObjectId) => testEnv.ASK_BUDGET.get(id),
      },
    };
    const report = await runConformance({
      baseUrl: ORIGIN,
      key: testEnv.CARREL_SITE_KEY,
      probeWrites: true,
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        try {
          if (request.method === "GET") return await carrelRequest(argsFor(request, suite));
          // The Worker puts site-runtime's in-process render on the context (workers/app.ts); a test has no app build, so
          // this stand-in renders the post the preview handed it, which is what the preview case reads.
          const args = argsFor(request, suite) as unknown as {
            context: ReturnType<typeof routeContext>;
          };
          args.context.set(
            documentHandlerContext,
            async (_request, set) =>
              new Response(`<!doctype html><title>${previewTitle(set)}</title>`, {
                headers: { "content-type": "text/html; charset=utf-8" },
              }),
          );
          return await carrelRequest(args as never);
        } catch (thrown) {
          // A refusal outside the prefix is thrown (a Response or router data); the wire would carry it as its status.
          if (thrown instanceof Response) return thrown;
          const status = (thrown as { init?: { status?: number } }).init?.status;
          if (status) return new Response(null, { status });
          throw thrown;
        }
      }) as typeof fetch,
    });
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
