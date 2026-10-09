import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import { renderAndWrite } from "~/lib/editor/publish.server";
import { paperMarkdownPath, paperPath } from "~/lib/publications/paths.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { links as rootLinks } from "~/root";
import { meta as homeMeta } from "~/routes/home";
import {
  loader as postLoader,
  meta as postMeta,
  middleware as postMiddleware,
} from "~/routes/blog.$slug";
import { loader as twinLoader } from "~/routes/blog.$slug[.md]";
import { contentPageMarkdownPath } from "~/lib/content-pages.mjs";
import { loader as contentPageLoader, meta as contentPageMeta } from "~/routes/content-page";
import { loader as paperLoader, meta as paperMeta } from "~/routes/publications.$slug";
import { loader as paperTwinLoader } from "~/routes/publications.$slug[.md]";
import { loader as robotsLoader } from "~/routes/robots";
import { loader as llmsLoader } from "~/routes/llms";
import { loader as llmsFullLoader } from "~/routes/llms-full[.txt]";
import { loader as sitemapLoader } from "~/routes/sitemap";
import { runTool } from "~/lib/operator/api.server";
import { procedurePath } from "~/kb/procedures/parse.mjs";
import { loader as procedureLoader, meta as procedureMeta } from "~/routes/procedure";
import { loader as procedureTwinLoader } from "~/routes/procedure[.md]";

import llmsTxt from "../../content/llms.txt?raw";
import isolation from "../../content/procedures/phage-isolation.md?raw";

import { post } from "./fixtures";
import { seedDictionary, seedPages, seedPublications } from "./seed";
import { routeContext, throughMiddleware } from "./route-helpers";
import { stubGitHub } from "./github-stub";
import { equipmentRepoFiles, reagentRepoFiles, strainRepoFiles } from "./seed";

/*
 * THE AGENT PATH WITH NO VISIBLE LINK (job_5670dd43eef2, 2026-09-27): nothing a person sees points an
 * agent at the machine surfaces, so these cases walk the routes an agent actually takes. robots.txt names
 * the sitemap and llms.txt; the head of a page with a markdown twin declares it with
 * <link rel="alternate" type="text/markdown">; every twin and both llms files answer with a
 * Link: rel="canonical" naming the HTML page; and the sitemap lists HTML pages only.
 *
 * The home page has no twin and is reached through llms.txt and llms-full.txt. Research and teaching
 * pages have twins at the page path plus `.md`.
 *
 * The paper twins are a route since publications moved to D1: their canonical Link, noindex and cache tag
 * are asserted here with the paper's head and its llms.txt listing.
 */

type Loader = (args: never) => unknown;

const ARTICLE = { slug: "agent-path-kestrel", term: "kestrelagentterm" };
const RESEARCH_PAGE = "/research";
const PROTOCOL_PAGE = "/research/protocols/phage-isolation";
const PAPER_SLUG = "10-1128-mra-00888-24";

const publishEnv = () => env as unknown as Parameters<typeof renderAndWrite>[0];

async function get(loader: Loader, path: string, params: Record<string, string> = {}, headers: HeadersInit = {}) {
  return loader({
    request: new Request(`${SITE_ORIGIN}${path}`, { headers }),
    params,
    context: routeContext(),
  } as never);
}

async function response(loader: Loader, path: string, params: Record<string, string> = {}) {
  const result = await get(loader, path, params);
  expect(result, `${path} did not answer with a Response`).toBeInstanceOf(Response);
  return result as Response;
}

type Descriptor = Record<string, unknown>;

const markdownAlternates = (descriptors: readonly unknown[]) =>
  (descriptors as Descriptor[]).filter(
    (d) => d && d.tagName === "link" && d.rel === "alternate" && d.type === "text/markdown",
  );

const canonical = (path: string) => `<${SITE_ORIGIN}${path}>; rel="canonical"`;

/** Every `<loc>` in the sitemap, as paths. */
async function sitemapPaths() {
  const body = await (await response(sitemapLoader as Loader, "/sitemap.xml")).text();
  return [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? "").slice(SITE_ORIGIN.length) || "/");
}

beforeAll(async () => {
  /* The paper rows sync:content writes, from the files in content/publications/. */
  await seedPublications();
  // The pages are drawn from D1 (docs/PAGES.md): the rows build:content compiles, as sync:content writes them.
  await seedPages();
  await seedDictionary();
  /* The row sync:content writes from content/llms.txt; the migrations leave an older seed in its place. */
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('llms.txt', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(llmsTxt)
    .run();
  await renderAndWrite(
    publishEnv(),
    ARTICLE.slug,
    post(ARTICLE.slug, {
      title: "Agent Path Kestrel",
      date: "2026-07-01",
      draft: false,
      body: `An article about ${ARTICLE.term}.\n\n## Details\n\nMore about ${ARTICLE.term}.\n`,
    }),
  );
  /* The protocol is a procedure (docs/PROCEDURES.md): its row arrives through save_procedure, the
   * same compile and write sync:content and the operator API use, from the repository's file. */
  const gh = stubGitHub({ [procedurePath("phage-isolation")]: isolation, ...strainRepoFiles, ...reagentRepoFiles, ...equipmentRepoFiles });
  try {
    const saved = await runTool(
      env as unknown as Parameters<typeof runTool>[0],
      { kind: "admin" },
      "save_procedure",
      { slug: "phage-isolation", raw: isolation, isNew: false },
    );
    expect(saved.ok, JSON.stringify(saved)).toBe(true);
  } finally {
    gh.restore();
  }
}, 240_000);

describe("discovery an agent starts from", () => {
  it("robots.txt names both the sitemap and llms.txt", async () => {
    const body = await (await response(robotsLoader as Loader, "/robots.txt")).text();
    expect(body).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
    expect(body).toContain(`${SITE_ORIGIN}/llms.txt`);
  });

  it("every page's head declares the feeds", () => {
    const feeds = (rootLinks() as unknown as Descriptor[]).filter((d) => d.rel === "alternate");
    expect(feeds.map((d) => d.type).sort()).toEqual(["application/feed+json", "application/rss+xml"]);
    for (const feed of feeds) expect(String(feed.href)).toMatch(/^https:\/\/.+\/writing\/(rss\.xml|feed\.json)$/);
  });

  it("llms.txt and llms-full.txt name the home page as canonical", async () => {
    for (const [loader, path] of [
      [llmsLoader, "/llms.txt"],
      [llmsFullLoader, "/llms-full.txt"],
    ] as const) {
      const res = await response(loader as Loader, path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("link"), path).toBe(canonical("/"));
      expect(res.headers.get("x-robots-tag"), path).toBe("noindex");
    }
  });
});

describe("the home page: no twin, so llms.txt and llms-full.txt are its agent path", () => {
  it("declares no markdown alternate, and llms.txt describes the site and names llms-full.txt", async () => {
    expect(markdownAlternates(homeMeta())).toEqual([]);
    const llms = await (await response(llmsLoader as Loader, "/llms.txt")).text();
    expect(llms).toMatch(/^# dustinedwards\.info\n/);
    expect(llms).toContain("/llms-full.txt");
    expect(llms).toContain(`- [Home](${SITE_ORIGIN}/):`);
  });
});

describe("an article: head, twin, canonical, full text", () => {
  it("the head and the Link header declare the twin", async () => {
    const result = (await get(postLoader as Loader, `/writing/${ARTICLE.slug}`, { slug: ARTICLE.slug })) as {
      data: unknown;
      init: { headers: Record<string, string> };
    };
    const alternates = markdownAlternates(postMeta({ loaderData: result.data } as never));
    expect(alternates.map((d) => d.href)).toEqual([`${SITE_ORIGIN}/writing/${ARTICLE.slug}.md`]);
    expect(result.init.headers.Link).toContain(
      `<${SITE_ORIGIN}/writing/${ARTICLE.slug}.md>; rel="alternate"; type="text/markdown"`,
    );
  });

  it("the twin is markdown and names the post as canonical, by path and by Accept", async () => {
    const byPath = await response(twinLoader as Loader, `/writing/${ARTICLE.slug}.md`, { slug: ARTICLE.slug });
    expect(byPath.status).toBe(200);
    expect(byPath.headers.get("content-type")).toContain("text/markdown");
    expect(byPath.headers.get("link")).toBe(canonical(`/writing/${ARTICLE.slug}`));
    expect(await byPath.text()).toContain(ARTICLE.term);

    const args = {
      request: new Request(`${SITE_ORIGIN}/writing/${ARTICLE.slug}`, { headers: { accept: "text/markdown" } }),
      params: { slug: ARTICLE.slug },
      context: routeContext(),
    } as never;
    const negotiated = (await throughMiddleware(postMiddleware, postLoader as never, args)) as Response;
    expect(negotiated.headers.get("content-type")).toContain("text/markdown");
    expect(negotiated.headers.get("link")).toBe(canonical(`/writing/${ARTICLE.slug}`));
  });

  it("llms-full.txt carries the article's full text", async () => {
    const full = await (await response(llmsFullLoader as Loader, "/llms-full.txt")).text();
    expect(full).toContain(`URL: /writing/${ARTICLE.slug}`);
    expect(full).toContain(ARTICLE.term);
  });
});

describe("a research page and a protocol: head, twin, and llms.txt", () => {
  it(`${PROTOCOL_PAGE} renders its steps, links its twin, and llms.txt lists the page`, async () => {
    const loaderData = (await get(procedureLoader as Loader, PROTOCOL_PAGE, { slug: "phage-isolation" })) as {
      record: { path: string; sections: unknown[] };
    };
    expect(loaderData.record.path).toBe(PROTOCOL_PAGE);
    expect(loaderData.record.sections.length).toBeGreaterThan(3);
    expect(markdownAlternates(procedureMeta({ loaderData } as never)).map((d) => d.href)).toEqual([
      `${SITE_ORIGIN}${PROTOCOL_PAGE}.md`,
    ]);
    const twin = await response(procedureTwinLoader as Loader, `${PROTOCOL_PAGE}.md`, { slug: "phage-isolation" });
    expect(twin.headers.get("link")).toBe(canonical(PROTOCOL_PAGE));
    expect(await twin.text()).toContain("# ");

    const llms = await (await response(llmsLoader as Loader, "/llms.txt")).text();
    expect(llms).toContain(`](${SITE_ORIGIN}${PROTOCOL_PAGE}):`);
  });

  it.each([RESEARCH_PAGE])("%s renders its text, links its twin, and llms.txt lists the page", async (path) => {
    const { page } = (await get(contentPageLoader as Loader, path)) as {
      page: { path: string; html: string; title: string };
    };
    expect(page.path).toBe(path);
    expect(page.html.length).toBeGreaterThan(200);
    expect(markdownAlternates(contentPageMeta({ loaderData: { page } } as never)).map((d) => d.href)).toEqual([
      `${SITE_ORIGIN}${contentPageMarkdownPath(path)}`,
    ]);

    const llms = await (await response(llmsLoader as Loader, "/llms.txt")).text();
    expect(llms).toContain(`](${SITE_ORIGIN}${path})`);
    expect(llms).toContain("/software/{name}");
  });
});

describe("a paper: head declares the twin, llms.txt lists it", () => {
  it("the head links the markdown twin and llms.txt lists the same URL", async () => {
    const loaderData = await get(paperLoader as Loader, paperPath(PAPER_SLUG), { slug: PAPER_SLUG });
    const alternates = markdownAlternates(paperMeta({ loaderData } as never));
    expect(alternates.map((d) => d.href)).toEqual([`${SITE_ORIGIN}${paperMarkdownPath(PAPER_SLUG)}`]);

    const llms = await (await response(llmsLoader as Loader, "/llms.txt")).text();
    expect(llms).toContain(`](${SITE_ORIGIN}${paperMarkdownPath(PAPER_SLUG)}):`);
  });

  it("the twin is markdown from D1 and names the paper page as canonical, noindex, tagged for the purge", async () => {
    const twin = await response(paperTwinLoader as Loader, paperMarkdownPath(PAPER_SLUG), { slug: PAPER_SLUG });
    expect(twin.status).toBe(200);
    expect(twin.headers.get("content-type")).toContain("text/markdown");
    expect(twin.headers.get("link")).toBe(canonical(paperPath(PAPER_SLUG)));
    expect(twin.headers.get("x-robots-tag")).toBe("noindex");
    expect(twin.headers.get("cache-tag")).toBe("publications");
    expect(await twin.text()).toMatch(/^---\nid: "edwards-2025-godfather"\n/);
  });

  it("a slug that is no paper's answers 404", async () => {
    const res = await response(paperTwinLoader as Loader, "/research/publications/not-a-paper.md", { slug: "not-a-paper" });
    expect(res.status).toBe(404);
  });
});

describe("the sitemap lists HTML pages only", () => {
  it("has the article, the paper and the content pages, and no twin or llms file", async () => {
    const paths = await sitemapPaths();
    expect(paths).toContain("/");
    expect(paths).toContain(`/writing/${ARTICLE.slug}`);
    expect(paths).toContain(paperPath(PAPER_SLUG));
    expect(paths).toContain(RESEARCH_PAGE);
    expect(paths).toContain(PROTOCOL_PAGE);
    expect(paths.filter((p) => /\.(md|txt)$/.test(p))).toEqual([]);
  });
});
