import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicationRow } from "~/db/publications";
import { getCitationCounts, refreshCitations } from "~/lib/citations.server";
import { decodeContentId, encodeContentId } from "~/lib/carrel/content-id.mjs";
import { runTool } from "~/lib/operator/api.server";
import { isToolName, toolNames } from "~/lib/operator/descriptors";
import { publicationPath } from "~/lib/publications/parse.mjs";
import { renderPublicationFile } from "~/lib/publications/serialize.mjs";
import { action, loader } from "~/routes/api.carrel.v1.$";
import { loader as bibAllLoader } from "~/routes/publications[.bib]";
import Publications, { headers as indexHeaders, loader as indexLoader } from "~/routes/publications";
import Paper, { headers as paperHeaders, loader as paperLoader } from "~/routes/publications.$slug";
import { loader as twinLoader } from "~/routes/publications.$slug[.md]";
import { loader as sitemapLoader } from "~/routes/sitemap";
import { isCitationRefreshWindow, refreshCitationsWeekly } from "../../workers/watchdog";

import godfather from "../../content/publications/10-1128-mra-00888-24.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext } from "./route-helpers";
import { seedCitations, seedPublications } from "./seed";
import { testEnv } from "./test-env";

/*
 * A PUBLICATION EDIT GOES LIVE WITH NO DEPLOY (the publications job, 2026-10-01). Everything below goes
 * through the real Carrel route, so the package's guard, the registry's ids, the publication handler, the
 * shared validator, commitUnlessUnchanged, the D1 write and the cache purge are the ones that run in
 * production. GitHub is the recorded stub; nothing here builds anything. Each refusal also checks that the
 * repository did not change.
 */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
/** The stub's fixed head: the version every write here must name to land. */
const HEAD = "a".repeat(40);

const SLUG = "10-1128-mra-00888-24";
const ID = encodeContentId("publication", SLUG);

const headersFor = () => ({
  authorization: `Bearer ${testEnv.CARREL_SITE_KEY}`,
  "content-type": "application/json",
  "cf-connecting-ip": "203.0.113.9",
});

const argsFor = (request: Request) => ({ request, context: routeContext(), params: {} }) as never;

function get(url: string): Promise<Response> {
  return loader(argsFor(new Request(url, { headers: headersFor() })));
}

function send(method: "PUT" | "POST", url: string, body: unknown): Promise<Response> {
  return action(argsFor(new Request(url, { method, headers: headersFor(), body: JSON.stringify(body) })));
}

/** A manuscript with no DOI yet: the kind of record the tool exists to add. */
function manuscript(overrides: Record<string, unknown> = {}) {
  return renderPublicationFile(
    {
      slug: "cryo-em-example-manuscript",
      id: "edwards-2026-cryo-em-example",
      status: "submitted",
      draft: true,
      type: "article",
      title: "An example cryo-EM manuscript under review",
      authors: ["Dustin Edwards", "Example Coauthor"],
      journal: "Example Journal",
      year: 2026,
      topics: ["bacteriophages"],
      access: "external",
      isOpenAccess: false,
      summary: "A fixture that stands for a submitted manuscript with no DOI.",
      selected: false,
      abstract: "An abstract.",
      ...overrides,
    },
    null,
  );
}

let gh: GitHubStub;

beforeAll(async () => {
  await seedPublications();
  await seedCitations();
}, 240_000);

beforeEach(() => {
  // The hosted paper's PDF is in the repository, so the save's existence check finds it.
  gh = stubGitHub({
    [publicationPath(SLUG)]: godfather,
    [`public/research/publications/${SLUG}/dustin-edwards-${SLUG}.pdf`]: "%PDF-1.4 fixture",
  });
});

afterEach(() => {
  gh.restore();
});

async function pageData(slug: string) {
  return paperLoader({
    request: new Request(`${ORIGIN}/research/publications/${slug}/`),
    params: { slug },
    context: routeContext(),
  } as never);
}

async function twin(slug: string) {
  return (await twinLoader({
    request: new Request(`${ORIGIN}/research/publications/${slug}.md`),
    params: { slug },
    context: routeContext(),
  } as never)) as Response;
}

describe("the registry's ids", () => {
  it("keeps a bare slug for a post and prefixes every other kind with a dot, which a slug may itself contain", () => {
    expect(encodeContentId("post", "a-post")).toBe("a-post");
    expect(encodeContentId("publication", "10-1128-mra-00888-24")).toBe("publication.10-1128-mra-00888-24");
    expect(decodeContentId("a-post")).toEqual({ kind: "post", slug: "a-post" });
    expect(decodeContentId("publication.a.b")).toEqual({ kind: "publication", slug: "a.b" });
  });
});

describe("an edit through the Carrel adapter reaches the page on the next request", () => {
  it("changes the page, the twin and the stored row with no build and no deploy", async () => {
    const before = (await pageData(SLUG)) as { paper: { summary: string } };
    const edited = godfather.replace(/^summary: .*$/m, 'summary: "A sentence an edit through Carrel put on the paper."');
    expect(edited).not.toBe(godfather);
    expect(before.paper.summary).not.toContain("an edit through Carrel");

    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: edited,
      expectedVersion: HEAD,
      changeId: "chg-live-edit",
    });
    expect(response.status).toBe(200);
    // Saved through saveDraft, a live paper stays live, and the answer carries the contract's id.
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-live-edit" });
    expect(gh.files.get(publicationPath(SLUG))).toBe(edited);
    const commit = gh.calls.find((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
    expect((commit?.body as { message?: string } | undefined)?.message).toContain("[carrel:chg-live-edit]");

    const after = (await pageData(SLUG)) as { paper: { summary: string } };
    expect(after.paper.summary).toBe("A sentence an edit through Carrel put on the paper.");
    const html = renderRoute(`/research/publications/${SLUG}/`, Paper, { loaderData: after });
    expect(html).toContain("A sentence an edit through Carrel put on the paper.");
    expect(await (await twin(SLUG)).text()).not.toBe("");
    const row = await getPublicationRow(testEnv as never, SLUG);
    expect(row?.status).toBe("published");
  });

  it("does nothing for a save that is byte-identical to the committed file", async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: godfather,
      expectedVersion: HEAD,
      changeId: "chg-unchanged",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, version: HEAD });
    expect(gh.calls.some((c) => c.method === "POST" && c.path.endsWith("/git/commits"))).toBe(false);
    expect(gh.calls.some((c) => c.method === "POST" && c.path.endsWith("/git/blobs"))).toBe(false);
  });
});

describe("a new record", () => {
  it("is a draft until it is published, and then it is on the page, the twin and the sitemap", async () => {
    const source = manuscript();
    const created = await send("PUT", `${PREFIX}/content/publication.cryo-em-example-manuscript/draft`, {
      source,
      expectedVersion: null,
      changeId: "chg-new",
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({ id: "publication.cryo-em-example-manuscript", status: "draft" });
    expect(gh.files.get(publicationPath("cryo-em-example-manuscript"))).toBe(source);

    // A draft is not public: its page and twin answer as absent.
    await expect(pageData("cryo-em-example-manuscript")).rejects.toMatchObject({ status: 404 });
    expect((await twin("cryo-em-example-manuscript")).status).toBe(404);

    const listed = (await (await get(`${PREFIX}/content?q=cryo-em`)).json()) as { items: Array<{ id: string; kind: string; status: string }> };
    expect(listed.items).toEqual([expect.objectContaining({ id: "publication.cryo-em-example-manuscript", kind: "publication", status: "draft" })]);

    const published = await send("POST", `${PREFIX}/content/publication.cryo-em-example-manuscript/publish`, {
      expectedVersion: (await (await get(`${PREFIX}/content/publication.cryo-em-example-manuscript`)).json() as { version: string }).version,
      changeId: "chg-publish",
    });
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ status: "published" });

    // A manuscript has no DOI: the page says so by leaving it out, and carries no Scholar tags.
    const page = (await pageData("cryo-em-example-manuscript")) as { paper: { doi: string | null; stage: string } };
    expect(page.paper).toMatchObject({ doi: null, stage: "submitted" });
    const html = renderRoute("/research/publications/cryo-em-example-manuscript/", Paper, { loaderData: page });
    expect(html).toContain("submitted");
    expect(html).not.toContain("doi.org/null");
    const body = await (await twin("cryo-em-example-manuscript")).text();
    expect(body).toContain("# An example cryo-EM manuscript under review");

    const sitemap = await ((await sitemapLoader({ request: new Request(`${ORIGIN}/sitemap.xml`), params: {}, context: routeContext() } as never)) as Response).text();
    expect(sitemap).toContain("/research/publications/cryo-em-example-manuscript/");
  });
});

describe("everything a save changes carries the tag it purges", () => {
  it("tags the index, a page, the exports and the twin with one tag, which a save purges with the home and search pages' tag", async () => {
    expect(new Headers(indexHeaders()).get("Cache-Tag")).toBe("publications");
    expect(new Headers(paperHeaders()).get("Cache-Tag")).toBe("publications");
    const bib = (await bibAllLoader({ request: new Request(`${ORIGIN}/research/publications.bib`), params: {}, context: routeContext() } as never)) as Response;
    expect(bib.headers.get("cache-tag")).toBe("publications");
    expect((await twin(SLUG)).headers.get("cache-tag")).toBe("publications");
  });

  it("lists only the published papers on the index and keeps a draft out of it", async () => {
    await testEnv.DB.prepare("UPDATE publications SET status = 'draft' WHERE slug = ?1").bind(SLUG).run();
    try {
      const data = (await indexLoader({ request: new Request(`${ORIGIN}/research/publications`), params: {}, context: routeContext() } as never)) as {
        items: Array<{ slug: string }>;
      };
      expect(data.items.some((p) => p.slug === SLUG)).toBe(false);
      expect(data.items.length).toBeGreaterThan(30);
      expect(renderRoute("/research/publications", Publications, { loaderData: data })).not.toContain(SLUG);
      await expect(pageData(SLUG)).rejects.toMatchObject({ status: 404 });
    } finally {
      await testEnv.DB.prepare("UPDATE publications SET status = 'published' WHERE slug = ?1").bind(SLUG).run();
    }
  });
});

describe("a file the validator refuses", () => {
  it("answers with every message and commits nothing", async () => {
    const source = manuscript({
      title: 'A "quoted" title',
      authors: ["Dustin Edwards", ""],
      topics: ["not-a-topic"],
      summary: "One sentence. And a second one.",
    });
    const response = await send("PUT", `${PREFIX}/content/publication.cryo-em-example-manuscript/draft`, {
      source,
      expectedVersion: null,
      changeId: "chg-bad",
    });
    expect(response.status).toBe(422);
    const text = JSON.stringify(await response.json());
    for (const field of ["title:", "authors[1]:", "topics[0]:", "summary:"]) expect(text).toContain(field);
    expect(gh.files.has(publicationPath("cryo-em-example-manuscript"))).toBe(false);
    expect(gh.calls.some((c) => c.method === "POST" && c.path.endsWith("/git/commits"))).toBe(false);
  });

  it("REFUSES a hosted paper whose PDF is not in the repository", async () => {
    gh.files.delete(`public/research/publications/${SLUG}/dustin-edwards-${SLUG}.pdf`);
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: godfather.replace(/^summary: .*$/m, 'summary: "A different sentence."'),
      expectedVersion: HEAD,
      changeId: "chg-no-pdf",
    });
    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain("is not in the repository");
    expect(gh.files.get(publicationPath(SLUG))).toBe(godfather);
  });

  it("REFUSES a slug that would not fit a Carrel content id", async () => {
    const slug = "a".repeat(195);
    const response = await send("PUT", `${PREFIX}/content/publication.${slug}/draft`, {
      source: manuscript({ slug }),
      expectedVersion: null,
      changeId: "chg-long",
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(gh.files.has(publicationPath(slug))).toBe(false);
  });
});

describe("the operator reads publications and has no tool to write one", () => {
  const operatorEnv = () => testEnv as unknown as Parameters<typeof runTool>[0];
  const operator = { kind: "operator", id: "test" } as const;

  it("lists every row with a draft flag and a count, and reads one file with its record", async () => {
    const list = await runTool(operatorEnv(), operator, "list_publications", {});
    expect(list.ok).toBe(true);
    const data = (list as { data: { count: number; publications: Array<{ slug: string; draft: boolean }> } }).data;
    expect(data.count).toBeGreaterThanOrEqual(36);
    expect(data.publications.find((p) => p.slug === SLUG)).toMatchObject({ draft: false });

    const one = await runTool(operatorEnv(), operator, "get_publication", { slug: SLUG });
    expect(one).toMatchObject({ ok: true, data: { slug: SLUG, draft: false, errors: [] } });
    expect((await runTool(operatorEnv(), operator, "get_publication", { slug: "nope" })).ok).toBe(false);
  });

  it("has no save_publication or save_page: a publication is written through Carrel, never through this surface", () => {
    expect(isToolName("save_publication")).toBe(false);
    expect(isToolName("save_page")).toBe(false);
    // sync_publications writes nothing the repository does not already hold: it converges D1 to the files.
    expect(toolNames().filter((name) => /publication/.test(name))).toEqual([
      "sync_publications",
      "list_publications",
      "get_publication",
    ]);
  });
});

describe("the citation count is never blank while it refreshes", () => {
  const DOI = "10.1128/mra.00888-24";
  const openAlex = (status: number, count?: number) =>
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith("https://api.openalex.org/")) throw new Error(`unexpected fetch ${url}`);
      return status === 200
        ? new Response(JSON.stringify({ cited_by_count: count, id: "https://openalex.org/W1" }), { status })
        : new Response("no", { status });
    });

  async function setRow(count: number, fetchedAt: string) {
    await testEnv.DB.prepare(
      `INSERT OR REPLACE INTO publication_citations (doi, count, url, fetched_at) VALUES (?1, ?2, 'https://openalex.org/W1', ?3)`,
    )
      .bind(DOI.toLowerCase(), count, fetchedAt)
      .run();
  }

  async function read(env: object = {}) {
    const ctx = createExecutionContext();
    const counts = await getCitationCounts(routeContext(ctx, env), [DOI]);
    await waitOnExecutionContext(ctx);
    return counts[DOI];
  }

  it("serves the stale count at once and the refreshed one on the next read", async () => {
    await setRow(5, "2026-01-01");
    openAlex(200, 7);
    const first = await read({ OPENALEX_API_KEY: "k" });
    expect(first?.count).toBe(5);
    expect((await read({ OPENALEX_API_KEY: "k" }))?.count).toBe(7);
  });

  it("keeps the last count when the refresh fails, and says so in the log", async () => {
    await setRow(5, "2026-01-01");
    openAlex(500);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await read({ OPENALEX_API_KEY: "k" }))?.count).toBe(5);
    expect((await read({ OPENALEX_API_KEY: "k" }))?.count).toBe(5);
    expect(errors.mock.calls.some(([line]) => String(line).includes("citation-count-failed"))).toBe(true);
    errors.mockRestore();
  });

  it("returns every failure from a bulk refresh and leaves each count where it was", async () => {
    await setRow(5, "2026-01-01");
    openAlex(500);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await refreshCitations({ ...testEnv, OPENALEX_API_KEY: "k" } as never, [DOI]);
    errors.mockRestore();
    expect(result.refreshed).toBe(0);
    expect(result.failures).toEqual([expect.objectContaining({ doi: DOI, stage: "openalex-status" })]);
    expect((await read())?.count).toBe(5);
  });

  it("is refreshed by the operator tool, and a partial failure is a 502 that names the DOI", async () => {
    await setRow(5, "2026-01-01");
    openAlex(500);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await runTool(
      { ...testEnv, OPENALEX_API_KEY: "k" } as never,
      { kind: "operator", id: "test" },
      "refresh_citations",
      { dois: [DOI] },
    );
    errors.mockRestore();
    expect(result).toMatchObject({ ok: false, status: 502, detail: { failures: [{ doi: DOI }] } });
  });

  it("never lets an older snapshot overwrite a newer read", async () => {
    await setRow(9, "2026-09-30");
    await testEnv.DB.prepare(
      `INSERT INTO publication_citations (doi, count, url, fetched_at) VALUES (?1, 1, NULL, '2026-09-12')
       ON CONFLICT(doi) DO UPDATE SET count = excluded.count, fetched_at = excluded.fetched_at WHERE excluded.fetched_at > publication_citations.fetched_at`,
    )
      .bind(DOI.toLowerCase())
      .run();
    expect((await read())?.count).toBe(9);
  });
});

describe("the watchdog's weekly citation refresh", () => {
  const sunday = Date.UTC(2026, 9, 4, 3, 0);

  it("falls in one firing of the fifteen-minute cron a week", () => {
    expect(isCitationRefreshWindow(sunday)).toBe(true);
    expect(isCitationRefreshWindow(sunday + 14 * 60_000)).toBe(true);
    expect(isCitationRefreshWindow(sunday + 15 * 60_000)).toBe(false);
    expect(isCitationRefreshWindow(sunday - 15 * 60_000)).toBe(false);
    expect(isCitationRefreshWindow(sunday + 24 * 60 * 60_000)).toBe(false);
    expect(isCitationRefreshWindow(Number.NaN)).toBe(false);
  });

  it("calls refresh_citations through the site binding, and raises what the tool refused", async () => {
    const calls: unknown[] = [];
    const site = (status: number, payload: unknown) =>
      ({
        SITE: {
          fetch: async (_url: string, init: RequestInit) => {
            calls.push(JSON.parse(String(init.body)));
            return new Response(JSON.stringify(payload), { status });
          },
        },
      }) as never;

    expect(await refreshCitationsWeekly(site(200, { data: { refreshed: 36 } }), "tok", sunday)).toBeNull();
    expect(calls).toEqual([{ tool: "refresh_citations", args: {} }]);
    expect(await refreshCitationsWeekly(site(200, {}), "tok", sunday + 3 * 24 * 60 * 60_000)).toBeNull();
    expect(calls).toHaveLength(1);

    const failed = await refreshCitationsWeekly(
      site(502, { error: "1 of 36 failed", detail: { failures: [{ doi: "10.1/x", stage: "openalex-status" }] } }),
      "tok",
      sunday,
    );
    expect(failed).toContain("10.1/x (openalex-status)");
    expect(await refreshCitationsWeekly(site(200, {}), "", sunday)).toContain("OPERATOR_TOKEN");
  });
});
