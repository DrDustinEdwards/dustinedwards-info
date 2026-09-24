import { createExecutionContext, env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RouterContextProvider, createRoutesStub } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";

import { renderAndWrite } from "~/lib/editor/publish.server";
import { cloudflareContext } from "~/lib/context";
import { syncAskCorpus, syncAskPost } from "~/lib/search/ask.server";
import { seriesPath } from "~/lib/series-path.mjs";
import { SITE_ORIGIN } from "~/lib/seo";
import { tagPath } from "~/lib/tag-path.mjs";
import Home, { loader as homeLoader } from "~/routes/home";
import { loader as blogIndexLoader } from "~/routes/blog._index";
import { loader as postLoader } from "~/routes/blog.$slug";
import { loader as twinLoader } from "~/routes/blog.$slug[.md]";
import { loader as rssLoader } from "~/routes/blog.rss[.xml]";
import { loader as atomLoader } from "~/routes/blog.atom[.xml]";
import { loader as jsonFeedLoader } from "~/routes/blog.feed[.json]";
import { loader as tagLoader } from "~/routes/blog.tags.$tag";
import { loader as tagRssLoader } from "~/routes/blog.tags.$tag.rss[.xml]";
import { loader as tagFeedLoader } from "~/routes/blog.tags.$tag.feed[.json]";
import { loader as seriesLoader } from "~/routes/blog.series.$series";
import { loader as seriesRssLoader } from "~/routes/blog.series.$series.rss[.xml]";
import { loader as seriesFeedLoader } from "~/routes/blog.series.$series.feed[.json]";
import { loader as sitemapLoader } from "~/routes/sitemap";
import { loader as llmsLoader } from "~/routes/llms";
import { loader as llmsFullLoader } from "~/routes/llms-full[.txt]";
import { loader as searchLoader, middleware as searchMiddleware } from "~/routes/search";

/* The published post is the control that proves each surface was actually read. */

type Loader = (args: never) => unknown;

const SERIES = "Crawl Series";
const TAG = "crawltag";

const LIVE = {
  slug: "crawl-live-heron",
  title: "Visible Heron Essay",
  term: "heronliveterm",
};
const DRAFT = {
  slug: "crawl-draft-quokka",
  title: "Unlisted Quokka Manuscript",
  term: "quokkadraftterm",
};
const SCHEDULED = {
  slug: "crawl-scheduled-narwhal",
  title: "Embargoed Narwhal Dispatch",
  term: "narwhalfutureterm",
};
const HIDDEN = [DRAFT, SCHEDULED];

/** Newest first, with the term repeated more in older posts so relevance and date disagree. */
const SORTED = Array.from({ length: 6 }, (_, i) => ({
  slug: `crawl-sort-${i + 1}`,
  date: `2026-0${6 - i}-01`,
  repeats: i + 1,
}));

function markdown(
  slug: string,
  fm: { title: string; date: string; draft: boolean; tags: string[]; series?: [string, number] },
  body: string,
) {
  return [
    "---",
    `title: "${fm.title}"`,
    `slug: ${slug}`,
    `description: "A description for ${slug} that is long enough to read like real frontmatter."`,
    `date: ${fm.date}`,
    `tags: [${fm.tags.join(", ")}]`,
    `draft: ${fm.draft}`,
    ...(fm.series ? [`series: "${fm.series[0]}"`, `part: ${fm.series[1]}`] : []),
    "---",
    "",
    body,
  ].join("\n");
}

const publishEnv = () => env as unknown as Parameters<typeof renderAndWrite>[0];

function routeContext(overrides: Record<string, unknown> = {}) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: { ...env, ...overrides } as never,
    ctx: createExecutionContext(),
  });
  return context;
}

async function read(
  loader: Loader,
  path: string,
  params: Record<string, string> = {},
  headers: HeadersInit = {},
): Promise<{ status: number; text: string }> {
  try {
    const result = await loader({
      request: new Request(`${SITE_ORIGIN}${path}`, { headers }),
      params,
      context: routeContext(),
    } as never);
    if (result instanceof Response) return { status: result.status, text: await result.text() };
    return { status: 200, text: JSON.stringify(result) };
  } catch (thrown) {
    if (thrown instanceof Response) return { status: thrown.status, text: await thrown.text() };
    const init = (thrown as { init?: { status?: number } }).init;
    if (init?.status) return { status: init.status, text: JSON.stringify(thrown) };
    throw thrown;
  }
}

/** `/search` asked for JSON, which its middleware answers before the page loader runs. */
async function searchJson(query: string) {
  const request = new Request(`${SITE_ORIGIN}/search${query}`, {
    headers: { accept: "application/json" },
  });
  const args = { request, params: {}, context: routeContext() } as never;
  const run = async (index: number): Promise<unknown> => {
    const handler = searchMiddleware[index] as unknown as
      | ((a: never, next: () => Promise<unknown>) => Promise<unknown>)
      | undefined;
    return handler ? handler(args, () => run(index + 1)) : searchLoader(args);
  };
  const response = (await run(0)) as Response;
  return (await response.json()) as {
    total: number;
    results: Array<{ url: string; title: string; publishedAt: string | null }>;
  };
}

async function searchPage(query: string) {
  return (await searchLoader({
    request: new Request(`${SITE_ORIGIN}/search${query}`),
    params: {},
    context: routeContext(),
  } as never)) as {
    result: { total: number; hits: Array<{ url: string; title: string; publishAt: number | null }> };
  };
}

function expectOnlyLive(text: string, surface: string) {
  expect(text, `${surface} did not show the published post`).toContain(LIVE.slug);
  expectNoHidden(text, surface);
}

function expectNoHidden(text: string, surface: string) {
  for (const hidden of HIDDEN) {
    expect(text, `${surface} leaked ${hidden.slug}`).not.toContain(hidden.slug);
    expect(text, `${surface} leaked "${hidden.title}"`).not.toContain(hidden.title);
  }
}

/** Every record the render door returned, so the Ask sync can be handed exactly what a save hands it. */
const written: Record<string, Awaited<ReturnType<typeof renderAndWrite>>> = {};

async function write(slug: string, raw: string) {
  written[slug] = await renderAndWrite(publishEnv(), slug, raw);
}

beforeAll(async () => {
  for (const s of SORTED) {
    await write(
      s.slug,
      markdown(s.slug, { title: `Sorting sample ${s.slug}`, date: s.date, draft: false, tags: ["sorting"] }, [
        `${Array(s.repeats).fill("sortterm").join(" ")} opens this post.`,
        "",
        "## Later",
        "",
        "The sortterm appears in this section as well.",
        "",
      ].join("\n")),
    );
  }

  /* Hidden posts first, so the live post's related and backlink lists are computed with them in the corpus. */
  const linkingBody = (term: string) =>
    [
      `This mentions crawlshared and ${term}, and links to [the live post](/blog/${LIVE.slug}).`,
      "",
      "## Details",
      "",
      `More about ${term} and crawlshared.`,
      "",
    ].join("\n");
  await write(
    DRAFT.slug,
    markdown(
      DRAFT.slug,
      { title: DRAFT.title, date: "2026-07-02", draft: true, tags: [TAG], series: [SERIES, 2] },
      linkingBody(DRAFT.term),
    ),
  );
  await write(
    SCHEDULED.slug,
    markdown(
      SCHEDULED.slug,
      { title: SCHEDULED.title, date: "2099-01-01", draft: false, tags: [TAG], series: [SERIES, 3] },
      linkingBody(SCHEDULED.term),
    ),
  );
  await write(
    LIVE.slug,
    markdown(
      LIVE.slug,
      { title: LIVE.title, date: "2026-07-01", draft: false, tags: [TAG], series: [SERIES, 1] },
      [
        `This mentions crawlshared and ${LIVE.term}.`,
        "",
        "## Details",
        "",
        `More about ${LIVE.term} and crawlshared.`,
        "",
      ].join("\n"),
    ),
  );
  /* Nine full renders, and the layer's case budget does not cover hooks. */
}, 120_000);

describe("the draft and the scheduled post are on no public surface", () => {
  const tagParam = tagPath(TAG).split("/").pop() as string;
  const seriesParam = seriesPath(SERIES).split("/").pop() as string;

  it("listings, feeds, the sitemap and llms-full show only the published post", async () => {
    const surfaces: Array<[string, Loader, string, Record<string, string>?]> = [
      ["home", homeLoader as Loader, "/"],
      ["blog index", blogIndexLoader as Loader, "/blog"],
      ["blog index by tag", blogIndexLoader as Loader, `/blog?tag=${TAG}`],
      ["blog index by year", blogIndexLoader as Loader, "/blog?year=2026"],
      ["tag page", tagLoader as Loader, tagPath(TAG), { tag: tagParam }],
      ["tag rss", tagRssLoader as Loader, `${tagPath(TAG)}/rss.xml`, { tag: tagParam }],
      ["tag json feed", tagFeedLoader as Loader, `${tagPath(TAG)}/feed.json`, { tag: tagParam }],
      ["series page", seriesLoader as Loader, seriesPath(SERIES), { series: seriesParam }],
      ["series rss", seriesRssLoader as Loader, `${seriesPath(SERIES)}/rss.xml`, { series: seriesParam }],
      [
        "series json feed",
        seriesFeedLoader as Loader,
        `${seriesPath(SERIES)}/feed.json`,
        { series: seriesParam },
      ],
      ["rss", rssLoader as Loader, "/blog/rss.xml"],
      ["atom", atomLoader as Loader, "/blog/atom.xml"],
      ["json feed", jsonFeedLoader as Loader, "/blog/feed.json"],
      ["sitemap", sitemapLoader as Loader, "/sitemap.xml"],
      ["llms-full.txt", llmsFullLoader as Loader, "/llms-full.txt"],
    ];

    for (const [surface, loader, path, params] of surfaces) {
      const { status, text } = await read(loader, path, params);
      expect(status, surface).toBe(200);
      expectOnlyLive(text, surface);
    }

    /* Served from a stored setting rather than from posts, so there is no published control to find. */
    expectNoHidden((await read(llmsLoader as Loader, "/llms.txt")).text, "llms.txt");
  });

  it("the post page, its related posts, backlinks and series parts omit both", async () => {
    const page = await read(postLoader as Loader, `/blog/${LIVE.slug}`, { slug: LIVE.slug });
    expect(page.status).toBe(200);
    expect(page.text).toContain(LIVE.title);
    expectNoHidden(page.text, "the live post page");

    const twin = await read(twinLoader as Loader, `/blog/${LIVE.slug}.md`, { slug: LIVE.slug });
    expect(twin.status).toBe(200);
    expect(twin.text).toContain(LIVE.term);
    expectNoHidden(twin.text, "the live markdown twin");
  });

  it("the hidden posts' own URLs and markdown twins are 404", async () => {
    for (const hidden of HIDDEN) {
      const page = await read(postLoader as Loader, `/blog/${hidden.slug}`, { slug: hidden.slug });
      expect(page.status, hidden.slug).toBe(404);
      expectNoHidden(page.text, `${hidden.slug} page`);

      const twin = await read(twinLoader as Loader, `/blog/${hidden.slug}.md`, { slug: hidden.slug });
      expect(twin.status, `${hidden.slug}.md`).toBe(404);
      expect(twin.text).not.toContain(hidden.term);
    }
  });

  it("search, as a page and as JSON, by text, by tag filter and by browse, finds only the live post", async () => {
    for (const query of [
      "?q=crawlshared",
      `?q=crawlshared&tag=${TAG}`,
      `?tag=${TAG}`,
      "?q=details",
    ]) {
      const page = await searchPage(query);
      const json = await searchJson(query);
      expect(page.result.total, query).toBeGreaterThan(0);
      expectOnlyLive(JSON.stringify(page.result.hits), `/search${query}`);
      expectOnlyLive(JSON.stringify(json.results), `/search${query} as JSON`);
    }

    for (const hidden of HIDDEN) {
      expect((await searchPage(`?q=${hidden.term}`)).result.total, hidden.term).toBe(0);
      expect((await searchJson(`?q=${hidden.term}`)).total, `${hidden.term} as JSON`).toBe(0);
    }
    expect((await searchPage(`?q=${LIVE.term}`)).result.total).toBeGreaterThan(0);
  });

  it("the Ask index is sent only the published post", async () => {
    const items = new Map<string, string>();
    const aiSearch = {
      items: {
        upload: async (key: string, body: string) => {
          items.set(key, body);
          return { id: key, key };
        },
        list: async () => ({
          result: [...items.keys()].map((key) => ({ id: key, key })),
          result_info: { total_count: items.size },
        }),
        delete: async (id: string) => {
          items.delete(id);
        },
      },
    };
    const askEnv = {
      ...env,
      AI_SEARCH: aiSearch,
      ASSETS: { fetch: async () => new Response("A paper's markdown twin.") },
    } as unknown as Env;

    await syncAskCorpus(askEnv);
    for (const slug of [DRAFT.slug, SCHEDULED.slug, LIVE.slug]) {
      await syncAskPost(askEnv, written[slug] as never);
    }

    const postKeys = [...items.keys()].filter((key) => key.startsWith("blog/"));
    expect(postKeys.some((key) => key.includes(LIVE.slug))).toBe(true);
    for (const hidden of HIDDEN) {
      expect(postKeys.filter((key) => key.includes(hidden.slug)), hidden.slug).toEqual([]);
      expect([...items.values()].join("\n")).not.toContain(hidden.term);
    }
  });
});

describe("search sorted by date", () => {
  it("continues newest first from page 1 into page 2", async () => {
    const first = (await searchPage("?q=sortterm&sort=date&page=1")).result;
    const second = (await searchPage("?q=sortterm&sort=date&page=2")).result;
    expect(first.total).toBeGreaterThan(first.hits.length);
    expect(second.hits.length).toBeGreaterThan(0);

    const dates = [...first.hits, ...second.hits].map((hit) => hit.publishAt ?? 0);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));

    /* The control: relevance puts the oldest post first here, so date order is not an accident of the corpus. */
    const oldest = SORTED.reduce((a, b) => (a.date < b.date ? a : b));
    const relevance = (await searchPage("?q=sortterm")).result.hits;
    expect(relevance[0]?.url).toContain(oldest.slug);
  });
});

describe("the home page's post count", () => {
  function renderHome(loaderData: unknown) {
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => createElement(Home as never, { loaderData, params: {}, matches: [] }),
      },
    ]);
    return renderToStaticMarkup(createElement(Stub, { initialEntries: ["/"] }));
  }

  async function countLink() {
    const html = renderHome(
      await homeLoader({
        request: new Request(`${SITE_ORIGIN}/`),
        params: {},
        context: routeContext(),
      } as never),
    );
    const counts: string[] = [];
    await new HTMLRewriter()
      .on('a[href="/blog"]', {
        text(chunk) {
          counts.push(chunk.text);
        },
      })
      .transform(new Response(html))
      .text();
    const match = /(\d+)\s+posts?\b/.exec(counts.join(" "));
    return match ? Number(match[1]) : null;
  }

  it("counts the published posts and follows the seed", async () => {
    const published = SORTED.length + 1;
    expect(await countLink()).toBe(published);

    const extra = "crawl-count-extra";
    const raw = (draft: boolean) =>
      markdown(extra, { title: "Counted Extra", date: "2026-05-15", draft, tags: ["sorting"] }, "A body.\n");
    await write(extra, raw(false));
    expect(await countLink()).toBe(published + 1);

    await write(extra, raw(true));
    expect(await countLink()).toBe(published);
  });
});
