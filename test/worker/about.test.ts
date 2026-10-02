import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { pageSourcePath } from "~/lib/pages/compile.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { action } from "~/routes/api.carrel.v1.$";
import About, { headers, loader as aboutLoader, meta as aboutMeta } from "~/routes/about";
import { loader as sitemapLoader } from "~/routes/sitemap";

import aboutFile from "../../content/pages/about.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext } from "./route-helpers";
import { seedPages } from "./seed";
import { testEnv } from "./test-env";

/* About is a page row (docs/PAGES.md): Carrel saves content/pages/about.md through site-api's adapter, the one
 * write path, and the NEXT request for /about carries the edit, with no build and no deploy. Its route keeps
 * its own layout and its ProfilePage JSON-LD; only the prose and the front matter moved. It has no markdown
 * twin and no search record, as before. */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const HEAD = "a".repeat(40);
const SLUG = "about";
const ID = `page.${SLUG}`;
const FILE = pageSourcePath(SLUG);
const ADDED = "This sentence was added through Carrel and is live without a deploy.";

const headersFor = (key: string) => ({
  authorization: `Bearer ${key}`,
  "content-type": "application/json",
  "cf-connecting-ip": "203.0.113.9",
});
const argsFor = (request: Request) => ({ request, context: routeContext(), params: {} }) as never;
const send = (method: "PUT" | "POST", url: string, body: unknown) =>
  action(argsFor(new Request(url, { method, headers: headersFor(testEnv.CARREL_SITE_KEY), body: JSON.stringify(body) })));

/** The loader data for /about, or the 404 it throws. */
const aboutData = () => aboutLoader({ request: new Request(`${ORIGIN}/about`), context: routeContext(), params: {} } as never);
const aboutHtml = async () => renderRoute("/about", About, { loaderData: await aboutData() });
async function sitemapPaths() {
  const res = (await sitemapLoader({ request: new Request(`${ORIGIN}/sitemap.xml`), context: routeContext(), params: {} } as never)) as Response;
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? "").slice(SITE_ORIGIN.length) || "/");
}
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));

let gh: GitHubStub;

beforeAll(async () => {
  await seedPages(["/about"]);
});

beforeEach(() => {
  gh = stubGitHub({ [FILE]: aboutFile });
});

afterEach(() => {
  gh.restore();
});

describe("an About edit through the adapter is live at the next request", () => {
  it("shows the edit on /about with no build or deploy, and leaves the layout and structured data alone", { timeout: 180_000 }, async () => {
    const before = await aboutHtml();
    expect(before).not.toContain(ADDED);
    expect(before).toContain('"@type":"ProfilePage"');
    expect(before).toContain('class="about-photo"');

    const edited = `${aboutFile.trimEnd()}\n\n${ADDED}\n`;
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: edited, expectedVersion: HEAD, changeId: "chg-about" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-about" });

    // The repository is the source, and it holds the edit.
    expect(gh.files.get(FILE)).toBe(edited);
    expect((commits()[0]?.body as { message?: string } | undefined)?.message).toContain("[carrel:chg-about]");

    // The next request carries it, inside the same layout and the same ProfilePage.
    const after = await aboutHtml();
    expect(after).toContain(ADDED);
    expect(after).toContain('"@type":"ProfilePage"');
    expect(after).toContain('class="about-photo"');

    // A save through the adapter purges what the page is cached under.
    expect(headers().get("cache-tag")).toBe("pages,content-pages");

    // And the description is the front matter's, which the meta and the JSON-LD both state.
    const data = await aboutData();
    expect(aboutMeta({ loaderData: data } as never)).toEqual(expect.arrayContaining([{ title: "Dustin Edwards | About the virologist at Tarleton State" }]));
  });

  it("an unchanged save commits nothing", { timeout: 180_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: aboutFile, expectedVersion: HEAD, changeId: "chg-same" });
    expect(response.status).toBe(200);
    expect(commits()).toHaveLength(0);
  });
});

describe("a save is held to what CI holds", () => {
  it("REFUSES an About with no prose (the render floor check:content held), commits nothing and keeps the page", async () => {
    const blank = `${aboutFile.split("\n---\n")[0]}\n---\n\nToo short.\n`;
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: blank, expectedVersion: HEAD, changeId: "chg-blank" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/floor 200/);
    expect(commits()).toHaveLength(0);
    expect(await aboutHtml()).toContain("Department Head of Biological Sciences");
  });

  it("REFUSES a missing seo_title and a link the URL allowlist refuses", async () => {
    const noSeo = aboutFile.replace(/^seo_title: .*$/m, "");
    const first = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: noSeo, expectedVersion: HEAD, changeId: "chg-seo" });
    expect(first.status).toBe(422);
    expect(((await first.json()) as { message: string }).message).toMatch(/seo_title is required/);

    const bad = `${aboutFile.trimEnd()}\n\n[x](javascript:alert(1))\n`;
    const second = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: bad, expectedVersion: HEAD, changeId: "chg-link" });
    expect(second.status).toBe(422);
    expect(commits()).toHaveLength(0);
  });
});

describe("About has a route of its own", () => {
  it("is in the sitemap while published, once, in its place, and writes no search record", { timeout: 180_000 }, async () => {
    const paths = await sitemapPaths();
    expect(paths.filter((p) => p === "/about")).toHaveLength(1);
    expect(paths.indexOf("/about")).toBe(1);

    const edited = `${aboutFile.trimEnd()}\n\n${ADDED}\n`;
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: edited, expectedVersion: HEAD, changeId: "chg-search" });
    expect(response.status, await response.clone().text()).toBe(200);
    const hits = await testEnv.DB.prepare("SELECT count(*) AS n FROM search_docs WHERE url LIKE '/about%'").first<{ n: number }>();
    expect(hits?.n).toBe(0);
  });

  it("unpublish takes the page and its sitemap entry down, and publish restores them", { timeout: 180_000 }, async () => {
    const down = await send("POST", `${PREFIX}/content/${ID}/unpublish`, { expectedVersion: HEAD, changeId: "chg-down" });
    expect(down.status, await down.clone().text()).toBe(200);
    const downBody = (await down.json()) as { status: string; version: string };
    expect(downBody.status).toBe("draft");

    await expect(aboutData()).rejects.toMatchObject({ init: { status: 404 } });
    expect(await sitemapPaths()).not.toContain("/about");

    const up = await send("POST", `${PREFIX}/content/${ID}/publish`, { expectedVersion: downBody.version, changeId: "chg-up" });
    expect(up.status, await up.clone().text()).toBe(200);
    expect(await aboutHtml()).toContain("Department Head of Biological Sciences");
    expect(await sitemapPaths()).toContain("/about");
  });
});

describe("a lost row is repaired from the file, never the reverse", () => {
  it("rewrites the row on an unchanged save and commits nothing", { timeout: 180_000 }, async () => {
    await testEnv.DB.prepare("DELETE FROM pages WHERE slug = ?1").bind(SLUG).run();
    await expect(aboutData()).rejects.toMatchObject({ init: { status: 404 } });

    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: aboutFile, expectedVersion: HEAD, changeId: "chg-repair" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(commits()).toHaveLength(0);
    expect(await aboutHtml()).toContain("Department Head of Biological Sciences");
  });
});
