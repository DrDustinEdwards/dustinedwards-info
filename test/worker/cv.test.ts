import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CV_PAGE } from "~/lib/cv/entries.mjs";
import { CV_FILES, cvSourcePath } from "~/lib/cv/parse.mjs";
import { publicationPath } from "~/lib/publications/parse.mjs";
import { isToolName, runTool } from "~/lib/operator/api.server";
import { canonicalLink } from "~/lib/markdown-twin";
import { SHARED_CACHE_CONTROL } from "~/lib/seo";
import { action, loader } from "~/routes/api.carrel.v1.$";
import Cv, { headers as cvHeaders, loader as cvLoader } from "~/routes/cv";
import { loader as chartsLoader } from "~/routes/cv.charts[.json]";
import { loader as twinLoader } from "~/routes/cv[.md]";

import godfather from "../../content/publications/10-1128-mra-00888-24.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext } from "./route-helpers";
import { seedCv, seedPublications } from "./seed";
import { testEnv } from "./test-env";

/* A CV edit goes live with no build and no deploy: Carrel saves it through site-api's adapter (the one write
 * path), the save validates it with the code CI runs, commits it, writes the D1 row and the CV's search records,
 * and the NEXT request for the page, its markdown twin and its charts carries the edit (docs/CV.md). The
 * repository is the source and D1 is derived (hard rule 18). */

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const HEAD = "a".repeat(40);

const FILES = import.meta.glob("../../content/cv/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const rawOf = (slug: string) => {
  const found = FILES[`../../content/cv/${slug}.md`];
  if (found === undefined) throw new Error(`no content/cv/${slug}.md`);
  return found;
};
const repository = () => Object.fromEntries(CV_FILES.map(({ slug }) => [cvSourcePath(slug), rawOf(slug)]));

const ADDED_GRANT = "Added Through Carrel Equipment Award";
const grants = rawOf("grants");
const editedGrants = grants.replace(
  "entries:\n",
  `entries:\n  - year: 2026\n    amount: 4321\n    title: ${ADDED_GRANT}\n    funder: Example Foundation\n    areas: []\n    role: recipient\n`,
);
const profile = rawOf("profile");
const editedProfile = profile.replace("national: 170", "national: 171");

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

/** The page as /cv renders it, from the loader the route runs. */
async function cvPage(query = "") {
  const path = `/cv${query}`;
  const loaderData = await cvLoader({ request: new Request(`${ORIGIN}${path}`), context: routeContext(), params: {} } as never);
  return { loaderData, html: renderRoute("/cv", Cv, { loaderData }, path) };
}
const twin = () => twinLoader({ request: new Request(`${ORIGIN}/cv.md`), context: routeContext(), params: {} } as never);
const charts = async () =>
  (await chartsLoader({ request: new Request(`${ORIGIN}/cv/charts.json`), context: routeContext(), params: {} } as never)).text();
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
const cvSearchHits = async (needle: string) =>
  (
    await testEnv.DB.prepare("SELECT count(*) AS n FROM search_docs WHERE doc_uid = 'page:cv' AND body LIKE ?1")
      .bind(`%${needle}%`)
      .first<{ n: number }>()
  )?.n;

let gh: GitHubStub;

beforeAll(async () => {
  // The CV is joined to the publications at read time, so the papers are rows first.
  await seedPublications();
  await seedCv();
}, 300_000);

// Each case starts from the repository's CV: a save in one case never leaks its row into the next.
beforeEach(async () => {
  gh = stubGitHub(repository());
  await seedCv();
});

afterEach(() => {
  gh.restore();
});

describe("an edit through the adapter is live at the next request", () => {
  // Cold pipeline (shiki, KaTeX) plus the compile: longer than the default 30 s.
  it("shows a grant on the page, its twin, its charts and its search record, with no build or deploy", { timeout: 240_000 }, async () => {
    const before = await cvPage();
    expect(before.html).not.toContain(ADDED_GRANT);
    expect(await (await twin()).text()).not.toContain(ADDED_GRANT);
    const chartsBefore = await charts();
    expect(await cvSearchHits(ADDED_GRANT)).toBe(0);

    const response = await send("PUT", `${PREFIX}/content/cv.grants/draft`, {
      source: editedGrants,
      expectedVersion: HEAD,
      changeId: "chg-cv",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: "cv.grants", status: "published", changeId: "chg-cv" });

    // The repository is the source, and it holds the edit, under a commit that names the change.
    expect(gh.files.get(cvSourcePath("grants"))).toBe(editedGrants);
    expect((commits()[0]?.body as { message?: string } | undefined)?.message).toContain("[carrel:chg-cv]");

    // The page, its twin, its charts and its search record carry it at the next request.
    const after = await cvPage();
    expect(after.html).toContain(ADDED_GRANT);
    expect(after.loaderData.counts.grants).toBe(before.loaderData.counts.grants + 1);
    const res = await twin();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(ADDED_GRANT);
    expect(await charts()).not.toBe(chartsBefore);
    expect(await cvSearchHits(ADDED_GRANT)).toBeGreaterThan(0);

    // And the file read back through Carrel is the edit.
    const read = (await (await get(`${PREFIX}/content/cv.grants`)).json()) as { source: string; kind: string };
    expect(read.kind).toBe("cv");
    expect(read.source).toBe(editedGrants);
  });

  it("an edit to the profile reaches the page note and the twin", { timeout: 240_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/cv.profile/draft`, {
      source: editedProfile,
      expectedVersion: HEAD,
      changeId: "chg-profile",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await cvPage()).loaderData.cv.presentations.national).toBe(171);
    expect(await (await twin()).text()).toContain("171 national and regional presentations");
  });

  it("an unchanged save commits nothing", { timeout: 240_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/cv.grants/draft`, {
      source: rawOf("grants"),
      expectedVersion: HEAD,
      changeId: "chg-same",
    });
    expect(response.status).toBe(200);
    expect(commits()).toHaveLength(0);
  });
});

describe("a save is held to what CI holds", () => {
  it("REFUSES a file the validator fails, with every message, and commits nothing", async () => {
    const wide = String.fromCharCode(0x2014);
    const bad = grants.replace("amount: 3000", "amount: -1").replace("Student Research Grant", `Student ${wide} Research Grant`);
    const response = await send("PUT", `${PREFIX}/content/cv.grants/draft`, { source: bad, expectedVersion: HEAD, changeId: "chg-bad" });
    expect(response.status).toBe(422);
    const message = ((await response.json()) as { message: string }).message;
    expect(message).toMatch(/wide dash/);
    expect(message).toMatch(/amount must be dollars/);
    expect(commits()).toHaveLength(0);
    expect(gh.files.get(cvSourcePath("grants"))).toBe(grants);
  });

  it("REFUSES a paper no published record holds, naming the DOI", async () => {
    const response = await send("PUT", `${PREFIX}/content/cv.publications/draft`, {
      source: rawOf("publications").replace("entries:\n", "entries:\n  - doi: 10.9999/not-a-paper\n"),
      expectedVersion: HEAD,
      changeId: "chg-doi",
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/no published publication has DOI 10\.9999\/not-a-paper/);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES a file the whole CV cannot hold: a section out of order", async () => {
    // Put a 1999 grant first: valid alone, but its section must read newest first.
    const out = grants.replace("entries:\n", "entries:\n  - year: 1999\n    amount: 1\n    title: Out Of Order\n    areas: []\n    role: recipient\n");
    const response = await send("PUT", `${PREFIX}/content/cv.grants/draft`, { source: out, expectedVersion: HEAD, changeId: "chg-order" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/newest first/);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES a file no registration names, and says a save cannot create one", async () => {
    const response = await send("PUT", `${PREFIX}/content/cv.brand-new/draft`, { source: grants, expectedVersion: null, changeId: "chg-new" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/cannot create one/);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES a stale version, names the current one, and commits nothing", async () => {
    const response = await send("PUT", `${PREFIX}/content/cv.grants/draft`, {
      source: editedGrants,
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: HEAD });
    expect(commits()).toHaveLength(0);
  });

  it("has no draft state, so the CV cannot be unpublished", async () => {
    const response = await send("POST", `${PREFIX}/content/cv.grants/unpublish`, { expectedVersion: HEAD, changeId: "chg-down" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/no draft state/);
  });
});

describe("the CV answers as it did before it moved to D1", () => {
  it("carries the twin's headers, the charts' tag and the page's tags", async () => {
    const res = await twin();
    expect(res.headers.get("content-type")).toMatch(/^text\/markdown/);
    expect(res.headers.get("cache-control")).toBe(SHARED_CACHE_CONTROL);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("link")).toBe(canonicalLink(CV_PAGE.path));
    expect(res.headers.get("cache-tag")).toBe("cv");
    const chartsResponse = await chartsLoader({ request: new Request(`${ORIGIN}/cv/charts.json`), context: routeContext(), params: {} } as never);
    expect(chartsResponse.headers.get("cache-tag")).toBe("cv");
    // The HTML keeps its long-standing "pages" tag beside the new one.
    expect(new Headers(cvHeaders()).get("cache-tag")).toBe("pages,cv");
  });
});

/* A filter that selects nothing to chart answers as a page, never as the 500 Enarratio's "data is empty" made of it. */
describe("a filter that leaves nothing to chart", () => {
  const chartsFor = async (query: string) => {
    const res = await chartsLoader({ request: new Request(`${ORIGIN}/cv/charts.json${query}`), context: routeContext(), params: {} } as never);
    return { res, body: (await res.json()) as { timeline: string; papers: string; grants: string; students: string } };
  };
  const EMPTY = "data-cv-timeline-empty";
  const NONE = "No entries match these filters, so there is nothing to chart.";
  const UNCHARTED = "none of the entries these filters select is one of those";

  it("renders the reported URL as a page with a sentence where the chart was, and the charts answer 200", { timeout: 120_000 }, async () => {
    const query = "?type=grant&role=senior-author";
    const { loaderData, html } = await cvPage(query);
    expect(loaderData.shownIds).toHaveLength(0);
    expect(html).toContain(NONE);
    expect(html).toContain("No entries match.");
    expect(html).not.toContain('data-enarratio-x="');
    const { res, body } = await chartsFor(query);
    expect(res.status).toBe(200);
    expect(body.timeline).toContain(NONE);
    // The headline lines still draw: an empty line is an empty line.
    for (const name of ["papers", "grants", "students"] as const) expect(body[name]).toContain("<svg");
    // The twin is the whole CV, whatever the filter, and is as available as ever.
    expect((await twin()).status).toBe(200);
  });

  it("says why when entries match but none is a charted type", { timeout: 120_000 }, async () => {
    const { loaderData, html } = await cvPage("?type=service");
    expect(loaderData.shownIds.length).toBeGreaterThan(0);
    expect(html).toContain(UNCHARTED);
    expect((await chartsFor("?type=service")).body.timeline).toContain(UNCHARTED);
  });

  // Every filter the CV has, alone and in the pairs that select nothing chartable: none may throw.
  const TABLE = [
    "?role=senior-author&type=grant",
    "?type=appointment", "?type=education", "?type=course", "?type=mentoring", "?type=service", "?type=development",
    "?role=instructor", "?role=mentor", "?role=member", "?role=participant", "?role=volunteer",
    "?area=ai", "?q=zzzznomatch", "?from=2099", "?to=1900",
    "?type=mentoring&area=bacteriophages", "?role=judge&area=retroviruses", "?type=course&role=instructor",
  ];
  it.each(TABLE)("%s answers 200 on the charts and renders the page", { timeout: 120_000 }, async (query) => {
    const { res, body } = await chartsFor(query);
    expect(res.status).toBe(200);
    expect(typeof body.timeline).toBe("string");
    await cvPage(query);
  });

  it("changes nothing for a filter that selects something, and a value outside the vocabulary is dropped", { timeout: 120_000 }, async () => {
    for (const query of ["", "?type=publication", "?type=grant&from=2018&to=2022", "?q=phage"]) {
      const { html } = await cvPage(query);
      expect(html, query).toContain('data-enarratio-x="');
      expect(html, query).not.toContain(EMPTY);
    }
    const bogus = await cvPage("?type=bogus&role=bogus");
    expect(bogus.html).toBe((await cvPage()).html);
    expect(bogus.html).not.toContain(EMPTY);
  });
});

describe("a lost row is repaired from the file, never the reverse", () => {
  it("rewrites the row on an unchanged save and commits nothing", { timeout: 240_000 }, async () => {
    await testEnv.DB.prepare("DELETE FROM cv WHERE slug = 'honors'").run();
    await expect(cvPage()).rejects.toThrow(/do not make a CV/);

    const response = await send("PUT", `${PREFIX}/content/cv.honors/draft`, {
      source: rawOf("honors"),
      expectedVersion: HEAD,
      changeId: "chg-repair",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(commits()).toHaveLength(0);
    expect((await cvPage()).loaderData.cv.entries.length).toBeGreaterThan(200);
  });
});

describe("Carrel lists the CV beside the other kinds", () => {
  it("shows each file as kind cv under its cv.<slug> id", async () => {
    const res = (await (await get(`${PREFIX}/content?limit=100&q=grants`)).json()) as {
      items: Array<{ id: string; kind: string; path: string | null; status: string }>;
    };
    expect(res.items.find((i) => i.id === "cv.grants")).toMatchObject({ kind: "cv", path: CV_PAGE.path, status: "published" });
  });
});

describe("the operator reads the CV and cannot save it", () => {
  it("list_cv and get_cv read, and there is no save tool", { timeout: 240_000 }, async () => {
    const list = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "list_cv", {});
    expect(list).toMatchObject({ ok: true });
    const data = (list as { data: { count: number; files: Array<{ slug: string }> } }).data;
    expect(data.count).toBe(CV_FILES.length);
    expect(data.files.map((f) => f.slug)).toContain("grants");

    const one = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_cv", { slug: "grants" });
    expect(one).toMatchObject({ ok: true, data: { slug: "grants", raw: grants, errors: [] } });

    // Content is edited through Carrel and nowhere else (docs/CV.md), so no save tool exists.
    expect(isToolName("save_cv")).toBe(false);
  });
});

describe("the CV and the papers it cites", () => {
  const SLUG = "10-1128-mra-00888-24";
  const FILE = publicationPath(SLUG);
  const stubPaper = () => {
    gh.files.set(FILE, godfather);
    gh.files.set(`public/research/publications/${SLUG}/dustin-edwards-${SLUG}.pdf`, "%PDF-1.4 fixture");
  };

  it("a paper the CV cites cannot be unpublished from under it, and nothing is committed", { timeout: 240_000 }, async () => {
    stubPaper();
    const response = await send("POST", `${PREFIX}/content/publication.${SLUG}/unpublish`, { expectedVersion: HEAD, changeId: "chg-unpub" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/The CV cites this paper by DOI 10\.1128\/mra\.00888-24/);
    expect(commits()).toHaveLength(0);
  });

  it("a corrected paper reaches the CV page at the next request, and the CV's search record follows", { timeout: 240_000 }, async () => {
    stubPaper();
    const before = (await cvPage()).loaderData.cv.entries.find((e) => e.paper?.doi === "10.1128/mra.00888-24");
    expect(before?.paper?.venue).toContain("14(2)");
    const edited = godfather.replace(/^issue: .*$/m, 'issue: "9"');
    expect(edited).not.toBe(godfather);
    const response = await send("PUT", `${PREFIX}/content/publication.${SLUG}/draft`, { source: edited, expectedVersion: HEAD, changeId: "chg-paper" });
    expect(response.status, await response.clone().text()).toBe(200);
    const after = (await cvPage()).loaderData.cv.entries.find((e) => e.paper?.doi === "10.1128/mra.00888-24");
    expect(after?.paper?.venue).toContain("14(9)");
    expect(await (await twin()).text()).toContain("14(9)");
  });
});
