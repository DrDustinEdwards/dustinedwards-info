import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pageSourcePath } from "~/lib/pages/compile.mjs";
import { isToolName, runTool } from "~/lib/operator/api.server";
import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL, SITE_ORIGIN } from "~/lib/seo";
import { action, loader } from "~/routes/api.carrel.v1.$";
import { loader as pageLoader } from "~/routes/content-page";
import { loader as twinLoader } from "~/routes/content-page[.md]";
import { loader as sitemapLoader } from "~/routes/sitemap";

import foxhound from "../../content/pages/software-foxhound.md?raw";

import { versionCases } from "./carrel-version-cases";
import { stubGitHub, versionOf, type GitHubStub } from "./github-stub";
import { routeContext } from "./route-helpers";
import { seedPages } from "./seed";
import { testEnv } from "./test-env";

/* A page edit goes live with no build and no deploy: Carrel saves it through site-api's adapter (the one
 * write path), the save validates it with the code CI runs, commits it, writes the D1 row, and the NEXT
 * request for the page and its markdown twin carries the edit (job_dc67fd83c24b, docs/PAGES.md). The
 * repository is the source and D1 is derived (hard rule 18). */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const PATH = "/software/foxhound";
const SLUG = "software-foxhound";
const ID = `page.${SLUG}`;
const FILE = pageSourcePath(SLUG);
const ADDED = "This sentence was added through Carrel and is live without a deploy.";

const headersFor = (key: string) => ({
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  "cf-connecting-ip": "203.0.113.9",
});
const argsFor = (request: Request) => ({ request, context: routeContext(), params: {} }) as never;
const get = (url: string) => loader(argsFor(new Request(url, { headers: headersFor(testEnv.CARREL_SITE_KEY) })));
function send(method: "PUT" | "POST", url: string, body: unknown): Promise<Response> {
  return action(
    argsFor(new Request(url, { method, headers: headersFor(testEnv.CARREL_SITE_KEY), body: JSON.stringify(body) })),
  );
}

const operatorEnv = () => testEnv as unknown as Parameters<typeof runTool>[0];

/** The loader data for the page, or the 404 it throws. */
async function pageData(path = PATH) {
  return pageLoader({ request: new Request(`${ORIGIN}${path}`), context: routeContext(), params: {} } as never);
}
async function twin(path = PATH) {
  return twinLoader({ request: new Request(`${ORIGIN}${path}.md`), context: routeContext(), params: {} } as never);
}
async function sitemapPaths() {
  const res = (await sitemapLoader({
    request: new Request(`${ORIGIN}/sitemap.xml`),
    context: routeContext(),
    params: {},
  } as never)) as Response;
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? "").slice(SITE_ORIGIN.length) || "/");
}
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));

let gh: GitHubStub;

beforeAll(async () => {
  await seedPages();
});

beforeEach(() => {
  gh = stubGitHub({ [FILE]: foxhound });
});

afterEach(() => {
  gh.restore();
});

describe("an edit through the adapter is live at the next request", () => {
  // Cold pipeline (shiki, KaTeX) plus the compile: longer than the default 30 s.
  it("shows the edit on the page and its markdown twin, with no build or deploy", { timeout: 180_000 }, async () => {
    expect((await pageData()).page.html).not.toContain(ADDED);
    expect(await (await twin()).text()).not.toContain(ADDED);

    const edited = `${foxhound.trimEnd()}\n\n${ADDED}\n`;
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: edited,
      expectedVersion: await versionOf(gh, FILE),
      changeId: "chg-page",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-page" });

    // The repository is the source, and it holds the edit.
    expect(gh.files.get(FILE)).toBe(edited);
    const message = (commits()[0]?.body as { message?: string } | undefined)?.message;
    expect(message).toContain("[carrel:chg-page]");

    // The page and its twin carry it.
    expect((await pageData()).page.html).toContain(ADDED);
    const res = await twin();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(ADDED);

    // Its search record carries it too, so Ask and site search see the edit.
    const hits = await testEnv.DB.prepare("SELECT count(*) AS n FROM search_docs WHERE url LIKE ?1 AND body LIKE ?2")
      .bind(`${PATH}%`, `%added through Carrel%`)
      .first<{ n: number }>();
    expect(hits?.n).toBeGreaterThan(0);

    // And the file read back through Carrel is the edit, at the head.
    const read = (await (await get(`${PREFIX}/content/${ID}`)).json()) as { source: string; kind: string; version: string };
    expect(read.kind).toBe("page");
    expect(read.version).not.toBe("");
    expect(read.source).toBe(edited);
  });

  it("an unchanged save commits nothing and says so", { timeout: 180_000 }, async () => {
    const before = commits().length;
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: foxhound,
      expectedVersion: await versionOf(gh, FILE),
      changeId: "chg-same",
    });
    expect(response.status).toBe(200);
    expect(commits().length).toBe(before);
  });
});

describe("a save is held to what CI holds", () => {
  it("REFUSES a file the validator fails, with every message, and commits nothing", async () => {
    const wide = String.fromCharCode(0x2014);
    const bad = foxhound.replace(/^title: .*$/m, "title: ").concat(`\nA sentence ${wide} with a dash.\n`);
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: bad,
      expectedVersion: await versionOf(gh, FILE),
      changeId: "chg-bad",
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/wide dash/);
    expect(commits()).toHaveLength(0);
    expect(gh.files.get(FILE)).toBe(foxhound);
  });

  it("REFUSES a page no registered path names, and says a save cannot create one", async () => {
    const response = await send("PUT", `${PREFIX}/content/page.software-brand-new/draft`, {
      source: foxhound,
      expectedVersion: null,
      changeId: "chg-new",
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/cannot create a page/);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES a stale version, names the current one, and commits nothing", async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: `${foxhound.trimEnd()}\n\nAnother edit.\n`,
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: await versionOf(gh, FILE) });
    expect(commits()).toHaveLength(0);
  });
});

describe("a draft is not public", () => {
  it("unpublish takes the page, its twin and its sitemap entry down, and publish restores them", { timeout: 180_000 }, async () => {
    expect(await sitemapPaths()).toContain(PATH);

    const down = await send("POST", `${PREFIX}/content/${ID}/unpublish`, { expectedVersion: await versionOf(gh, FILE), changeId: "chg-down" });
    expect(down.status, await down.clone().text()).toBe(200);
    const downBody = (await down.json()) as { status: string; version: string };
    expect(downBody.status).toBe("draft");
    expect(gh.files.get(FILE)).toMatch(/^draft: true$/m);

    await expect(pageData()).rejects.toMatchObject({ init: { status: 404 } });
    expect((await twin()).status).toBe(404);
    expect(await sitemapPaths()).not.toContain(PATH);
    const hits = await testEnv.DB.prepare("SELECT count(*) AS n FROM search_docs WHERE url LIKE ?1").bind(`${PATH}%`).first<{ n: number }>();
    expect(hits?.n).toBe(0);

    const up = await send("POST", `${PREFIX}/content/${ID}/publish`, { expectedVersion: downBody.version, changeId: "chg-up" });
    expect(up.status, await up.clone().text()).toBe(200);
    expect(await up.json()).toMatchObject({ status: "published" });
    expect((await pageData()).page.path).toBe(PATH);
    expect((await twin()).status).toBe(200);
    expect(await sitemapPaths()).toContain(PATH);
  });
});

describe("the twin answers as the static file it replaced did", () => {
  it("carries the headers every routed twin carries, and a path with no page answers 404", async () => {
    await seedPages([PATH]);
    const res = await twin();
    expect(res.headers.get("content-type")).toMatch(/^text\/markdown/);
    expect(res.headers.get("cache-control")).toBe(SHARED_CACHE_CONTROL);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("link")).toBe(canonicalLink(PATH));
    expect(res.headers.get("cache-tag")).toBe("content-pages");
    expect((await twin("/software/not-a-page")).status).toBe(404);
  });
});

describe("a lost row is repaired from the file, never the reverse", () => {
  it("rewrites the row on an unchanged save and commits nothing", { timeout: 180_000 }, async () => {
    await testEnv.DB.prepare("DELETE FROM pages WHERE slug = ?1").bind(SLUG).run();
    await expect(pageData()).rejects.toMatchObject({ init: { status: 404 } });

    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: foxhound,
      expectedVersion: await versionOf(gh, FILE),
      changeId: "chg-repair",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(commits()).toHaveLength(0);
    expect((await pageData()).page.path).toBe(PATH);
  });
});

describe("Carrel lists pages beside posts", () => {
  it("shows each page as kind page under its page.<slug> id", async () => {
    const res = (await (await get(`${PREFIX}/content?limit=100&q=foxhound`)).json()) as {
      items: Array<{ id: string; kind: string; path: string | null; status: string }>;
    };
    expect(res.items.find((i) => i.id === ID)).toMatchObject({ kind: "page", path: PATH, status: "published" });
  });
});

describe("the operator reads pages and cannot save one", () => {
  it("list_pages and get_page read, and there is no save tool", { timeout: 180_000 }, async () => {
    const list = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "list_pages", {});
    expect(list).toMatchObject({ ok: true });
    const data = (list as { data: { count: number; pages: Array<{ path: string; draft: boolean }> } }).data;
    expect(data.count).toBeGreaterThanOrEqual(30);
    expect(data.pages.find((p) => p.path === PATH)).toMatchObject({ draft: false });

    const one = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_page", { path: PATH });
    expect(one).toMatchObject({ ok: true, data: { slug: SLUG, raw: foxhound, errors: [] } });

    // Content is edited through Carrel and nowhere else (docs/PAGES.md), so no save tool exists.
    expect(isToolName("save_page")).toBe(false);
  });
});

versionCases({
  name: "page",
  id: ID,
  file: FILE,
  edit: () => `${foxhound.trimEnd()}\n\n${ADDED}\n`,
  gh: () => gh,
  get,
  send,
  timeout: 240000,
});
