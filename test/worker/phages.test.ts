import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isToolName, runTool } from "~/lib/operator/api.server";
import { savePhage } from "~/lib/phages/save.server";
import { action, loader } from "~/routes/api.carrel.v1.$";
import ContentPage, { loader as pageLoader } from "~/routes/content-page";
import { loader as twinLoader } from "~/routes/content-page[.md]";

import acornPhage from "../../content/phages/acorn15.md?raw";
import arloPhage from "../../content/phages/arlo.md?raw";
import phagesPage from "../../content/pages/research-phages.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext } from "./route-helpers";
import { seedPages, seedPhages } from "./seed";
import { testEnv } from "./test-env";

/* A phage-table edit goes live with no build and no deploy: Carrel saves it through site-api's adapter (the one
 * write path), the save validates it with the code CI runs, commits it, re-derives the page the table is drawn
 * into and writes the phage's row, and the NEXT request for /research/phages and its markdown twin carries the edit
 * (job_005b85bf32fc, docs/PHAGES.md). The repository is the source and D1 is derived (hard rule 18). */

// The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one.
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const HEAD = "a".repeat(40);
const PATH = "/research/phages";
const SLUG = "acorn15";
const ID = `phage.${SLUG}`;
const FILE = "content/phages/acorn15.md";
const PAGE_FILE = "content/pages/research-phages.md";
const ROW = "| [Acorn15](#acorn15) | 2017 | *M. smegmatis* mc²155 | Hood County | [PhagesDB](https://phagesdb.org/phages/Acorn15/) |  |";
const EDITED_ROW = ROW.replace("Hood County", "Parker County");
/** Arlo names a genome paper, so the repository holds one for the save to find. */
const PAPER_FILE = "content/publications/10-1128-mra-01242-18.md";
const NEW_PHAGE = "---\nname: Zeta\nyear: 2026\nhost: foliorum\ncounty: Erath County\nphagesdb: null\n---\n";

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

async function pageData() {
  return pageLoader({ request: new Request(`${ORIGIN}${PATH}`), context: routeContext(), params: {} } as never);
}
/** The page as a visitor's request gets it: the route's loader, then its component, with its JSON-LD blocks. */
async function html() {
  return renderRoute(PATH, ContentPage, { loaderData: await pageData() });
}
async function twin() {
  return twinLoader({ request: new Request(`${ORIGIN}${PATH}.md`), context: routeContext(), params: {} } as never);
}
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
const searchBodies = async () =>
  (await testEnv.DB.prepare("SELECT body FROM search_docs WHERE url LIKE ?1").bind(`${PATH}%`).all<{ body: string }>()).results.map((r) => r.body);
const rowFor = (slug: string) =>
  testEnv.DB.prepare("SELECT slug, source_blob_sha FROM phages WHERE slug = ?1").bind(slug).first<{ slug: string; source_blob_sha: string }>();

let gh: GitHubStub;

beforeAll(async () => {
  await seedPages([PATH]);
  await seedPhages();
});

beforeEach(async () => {
  purge.mockClear();
  // Each case starts from the rows the sync writes, so one case's edit never leaks into the next.
  await testEnv.DB.prepare("DELETE FROM phages").run();
  await seedPages([PATH]);
  await seedPhages();
  gh = stubGitHub({ [FILE]: acornPhage, "content/phages/arlo.md": arloPhage, [PAPER_FILE]: "x", [PAGE_FILE]: phagesPage });
});

afterEach(() => {
  gh.restore();
});

describe("a phage edit through the adapter is live at the next request", () => {
  // Cold pipeline (shiki, KaTeX) plus the page compile: longer than the default 30 s.
  it("shows the edit on the page, its twin and its search record, with no build or deploy", { timeout: 240_000 }, async () => {
    const before = await html();
    const acornRow = (county: string) => new RegExp(`<td><a href="#acorn15">Acorn15</a></td>\\s*<td>2017</td>\\s*<td><em>M\\. smegmatis</em> mc²155</td>\\s*<td>${county}</td>`);
    expect(before).toMatch(acornRow("Hood County"));
    const twinBefore = await (await twin()).text();
    expect(twinBefore).toContain(ROW);
    expect(twinBefore).not.toContain(EDITED_ROW);

    const edited = acornPhage.replace("county: Hood County", "county: Parker County");
    expect(edited).not.toBe(acornPhage);
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: edited, expectedVersion: HEAD, changeId: "chg-phage" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-phage" });

    // The repository is the source, and it holds the edit; the page file was never touched.
    expect(gh.files.get(FILE)).toBe(edited);
    expect(gh.files.get(PAGE_FILE)).toBe(phagesPage);
    expect(commits()).toHaveLength(1);
    expect((commits()[0]?.body as { message?: string } | undefined)?.message).toContain("[carrel:chg-phage]");

    // The next request for the page carries the edit, in the table and in the Acorn15 section.
    const page = await html();
    expect(page).not.toMatch(acornRow("Hood County"));
    expect(page).toMatch(acornRow("Parker County"));
    expect(page).toContain("Found in 2017, Parker County, Texas.");

    // Its twin, the other face of the same page, carries the same edit.
    const res = await twin();
    expect(res.status).toBe(200);
    const twinAfter = await res.text();
    expect(twinAfter).toContain(EDITED_ROW);
    expect(twinAfter).not.toContain(ROW);

    // And the page's search record, so site search and Ask see it.
    expect((await searchBodies()).some((body) => body.includes("Parker County"))).toBe(true);

    // The file read back through Carrel is the edit, and the phage is listed as its own kind.
    const read = (await (await get(`${PREFIX}/content/${ID}`)).json()) as { source: string; kind: string };
    expect(read.kind).toBe("phage");
    expect(read.source).toBe(edited);
    const list = (await (await get(`${PREFIX}/content?limit=100&q=acorn`)).json()) as { items: Array<{ id: string; kind: string; path: string | null }> };
    expect(list.items.find((i) => i.id === ID)).toMatchObject({ kind: "phage", path: `${PATH}#acorn15` });
  });

  it("a new phage is drawn into the table, the sections, the twin and the dataset facts", { timeout: 240_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/phage.zeta/draft`, { source: NEW_PHAGE, expectedVersion: null, changeId: "chg-new" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(gh.files.get("content/phages/zeta.md")).toBe(NEW_PHAGE);

    const page = await html();
    expect(page).toContain('<a href="#zeta">Zeta</a>');
    expect(page).toMatch(/<h3 id="zeta">Zeta/);
    expect(await (await twin()).text()).toContain("| [Zeta](#zeta) | 2026 | *M. foliorum* | Erath County |  |  |");
    expect(page).toContain('"temporalCoverage":"2017/2026"');
    expect((await pageData()).page.dataset?.rows).toBe(81);
    expect((await rowFor("zeta"))?.slug).toBe("zeta");
  });

  it("a phage that names a genome paper the repository holds saves, and its paper link is in the table and the twin", { timeout: 240_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/phage.arlo/draft`, {
      source: arloPhage.replace("county: Erath County", "county: Parker County"),
      expectedVersion: HEAD,
      changeId: "chg-arlo",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await html()).toContain('<a href="/research/publications/10-1128-mra-01242-18/">Paper</a>');
    expect(await (await twin()).text()).toContain("| Parker County | [PhagesDB](https://phagesdb.org/phages/Arlo/) | [Paper](/research/publications/10-1128-mra-01242-18/) |");
  });

  it("an unchanged save commits nothing and says so", { timeout: 240_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: acornPhage, expectedVersion: HEAD, changeId: "chg-same" });
    expect(response.status).toBe(200);
    expect(commits()).toHaveLength(0);
    expect(purge).not.toHaveBeenCalled();
  });
});

describe("a phage change purges the pages tag, because the page embeds the table", () => {
  it("purges content-pages, the tag the page's HTML and its twin carry, and only that", { timeout: 240_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: acornPhage.replace("county: Hood County", "county: Parker County"),
      expectedVersion: HEAD,
      changeId: "chg-purge",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const tags = purge.mock.calls.flatMap(([options]) => options.tags);
    expect(tags).toEqual(["content-pages"]);

    // The tag purged is the one the page's twin carries (its HTML carries it beside the long-standing "pages").
    expect((await twin()).headers.get("cache-tag")).toBe("content-pages");
    expect((await pageData()).page.path).toBe(PATH);
  });
});

describe("a save is held to what CI holds", () => {
  it("REFUSES a file the validator fails, with every message, and commits nothing", async () => {
    const wide = String.fromCharCode(0x2014);
    const bad = acornPhage.replace("year: 2017", "year: soon").replace("---\n", "---\nsample: soil\n").concat(`\nA sentence ${wide} with a dash.\n`);
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: bad, expectedVersion: HEAD, changeId: "chg-bad" });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/wide dash/);
    expect(body.message).toMatch(/sample is not a phage field/);
    expect(body.message).toMatch(/year is "soon"/);
    expect(commits()).toHaveLength(0);
    expect(gh.files.get(FILE)).toBe(acornPhage);
  });

  it("REFUSES a genome paper this site does not hold, a record that is not the phage's own, and a stale version", async () => {
    const paper = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: acornPhage.replace(/\n---\n$/, "\npaper: not-a-paper-here\n---\n"),
      expectedVersion: HEAD,
      changeId: "chg-paper",
    });
    expect(paper.status).toBe(422);
    expect(((await paper.json()) as { message: string }).message).toMatch(/paper not-a-paper-here is not a publication of this site/);

    // Allene's record is Allene's alone: a second phage cannot claim it.
    const claim = await send("PUT", `${PREFIX}/content/phage.allenetwo/draft`, {
      source: "---\nname: AlleneTwo\nyear: 2026\nhost: null\ncounty: null\nphagesdb: Allene\n---\n",
      expectedVersion: null,
      changeId: "chg-claim",
    });
    expect(claim.status).toBe(422);
    expect(((await claim.json()) as { message: string }).message).toMatch(/not AlleneTwo's record/);

    const stale = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: acornPhage.replace("county: Hood County", "county: Parker County"),
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: "version-conflict", currentVersion: HEAD });
    expect(commits()).toHaveLength(0);
  });

  it("has no draft state: a phage cannot be unpublished, and the answer says how to remove one", async () => {
    const response = await send("POST", `${PREFIX}/content/${ID}/unpublish`, { expectedVersion: HEAD, changeId: "chg-down" });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(await response.json())).toMatch(/delete its file from content\/phages/);
    expect(commits()).toHaveLength(0);
  });
});

describe("a derived write that fails never reverts the commit (hard rule 18)", () => {
  it("leaves the commit in place, names the repair, and the drift is repaired from the file", { timeout: 240_000 }, async () => {
    // The page the table is drawn into no longer compiles, so the derived write fails after the commit.
    gh.files.set(PAGE_FILE, phagesPage.replace(/^title: .*$/m, "title: "));
    const edited = acornPhage.replace("county: Hood County", "county: Parker County");
    await expect(
      savePhage(testEnv as never, { slug: SLUG, raw: edited, expectedHeadSha: HEAD, isNew: false, actor: { kind: "carrel", changeId: "chg-fail" } }),
    ).rejects.toThrow(/WAS committed as .* and the database index could not be updated/);

    // The source holds the edit; D1 still holds the old row and the old page: nothing claims the new one.
    expect(gh.files.get(FILE)).toBe(edited);
    expect(await (await twin()).text()).toContain(ROW);

    // The repair is a re-run from the repository once the page compiles again: an unchanged save rewrites the rows.
    gh.files.set(PAGE_FILE, phagesPage);
    const repaired = await savePhage(testEnv as never, { slug: SLUG, raw: edited, expectedHeadSha: HEAD, isNew: false, actor: { kind: "carrel", changeId: "chg-repair" } });
    expect(repaired.unchanged).toBe(true);
    expect(commits()).toHaveLength(1);
    expect(await (await twin()).text()).toContain(EDITED_ROW);
  });
});

describe("the operator reads phages and cannot save one", () => {
  it("list_phages and get_phage read, and there is no save tool", { timeout: 240_000 }, async () => {
    const list = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "list_phages", {});
    expect(list).toMatchObject({ ok: true });
    const data = (list as { data: { count: number; phages: Array<{ slug: string; name: string; year: number; county: string | null }> } }).data;
    expect(data.count).toBe(80);
    expect(data.phages[0]).toMatchObject({ slug: "acorn15", name: "Acorn15", year: 2017, county: "Hood County" });
    // Only the table's own fields: nothing beyond the public shape reaches the operator.
    expect(Object.keys(data.phages[0] ?? {}).sort()).toEqual(["county", "formerly", "host", "name", "note", "paper", "phagesdb", "slug", "year"]);

    const one = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_phage", { slug: SLUG });
    expect(one).toMatchObject({ ok: true, data: { slug: SLUG, raw: acornPhage, errors: [], phage: { name: "Acorn15" } } });
    expect(await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_phage", { slug: "nothing" })).toMatchObject({ ok: false, status: 404 });
    expect(await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_phage", { slug: "Not A Slug" })).toMatchObject({ ok: false, status: 400 });

    // Content is edited through Carrel and nowhere else (docs/PHAGES.md), so no save tool exists.
    expect(isToolName("save_phage")).toBe(false);
  });
});
