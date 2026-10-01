import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheTags } from "~/lib/seo";
import { isToolName, runTool } from "~/lib/operator/api.server";
import { rosterPath } from "~/lib/roster/compile.mjs";
import { action, loader } from "~/routes/api.carrel.v1.$";
import ContentPage, { headers as contentPageHeaders, loader as pageLoader } from "~/routes/content-page";
import { headers as homeHeaders, loader as homeLoader } from "~/routes/home";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext, textsOf } from "./route-helpers";
import { SYNTHETIC_COHORTS, cohortFile, seedPages, seedRoster } from "./seed";
import { testEnv } from "./test-env";

/* A roster edit goes live with no build and no deploy: Carrel saves it through site-api's adapter (the one
 * write path), the save validates it with the code CI runs, commits it, writes the D1 row, purges the two pages
 * that embed the roster, and the NEXT request for /teaching/phage-discovery and the home page carries it
 * (job_06a07623695b, docs/ROSTER.md). The repository is the source and D1 is derived (hard rule 18). Every name
 * here is a placeholder. */

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const HEAD = "a".repeat(40);
const PAGE = "/teaching/phage-discovery";
const [CURRENT, EARLIER] = SYNTHETIC_COHORTS;
const SLUG = String(CURRENT.year);
const ID = `roster.${SLUG}`;
const FILE = rosterPath(SLUG);
const PHOTO_FILE = `public${CURRENT.photo.src}`;
const ADDED = "Example Person Added Through Carrel";

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
const operator = { kind: "operator", id: "test" } as const;

/** The rendered roster section of the program page, and the loader data behind it. */
async function programPage() {
  const data = await pageLoader({ request: new Request(`${ORIGIN}${PAGE}`), context: routeContext(), params: {} } as never);
  const html = renderRoute(PAGE, ContentPage, { loaderData: data });
  return { data, html, names: await textsOf(html, "section[aria-labelledby=roster] li") };
}
async function homeFacts() {
  const result = await homeLoader({ request: new Request(`${ORIGIN}/`), params: {}, context: routeContext() } as never);
  return (result as unknown as { data: { discovery: { researchers: number; cohorts: number; since: number } } }).data.discovery;
}
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
const purgedTags = () => purge.mock.calls.flatMap(([options]) => options.tags);

let gh: GitHubStub;
let currentFile: string;

beforeAll(async () => {
  await seedPages([PAGE]);
  currentFile = await cohortFile(CURRENT);
});

beforeEach(async () => {
  await resetRoster();
  gh = stubGitHub({
    [FILE]: currentFile,
    [rosterPath(String(EARLIER.year))]: await cohortFile(EARLIER),
    [PHOTO_FILE]: "x",
  });
  purge.mockClear();
});

afterEach(() => {
  gh.restore();
});

/** An empty table, then the synthetic cohorts: each case starts from a roster in step with its files. */
async function resetRoster() {
  await testEnv.DB.prepare("DELETE FROM roster").run();
  await seedRoster();
}

describe("an edit through the adapter is live at the next request", () => {
  it("shows a new name on the program page and in the home page's count, with no build or deploy", { timeout: 180_000 }, async () => {
    const before = await programPage();
    expect(before.names).not.toContain(ADDED);
    const countBefore = (await homeFacts()).researchers;

    const edited = await cohortFile({ ...CURRENT, researchers: [...CURRENT.researchers, ADDED] });
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: edited,
      expectedVersion: HEAD,
      changeId: "chg-roster",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-roster" });

    // The repository is the source, and it holds the edit.
    expect(gh.files.get(FILE)).toBe(edited);
    expect((commits()[0]?.body as { message?: string } | undefined)?.message).toContain("[carrel:chg-roster]");

    // The very next request carries it: the page's roster and the home page's count.
    const after = await programPage();
    expect(after.names).toContain(ADDED);
    expect(after.names).toHaveLength(before.names.length + 1);
    expect((await homeFacts()).researchers).toBe(countBefore + 1);

    // The file read back through Carrel is the edit, at the head.
    const read = (await (await get(`${PREFIX}/content/${ID}`)).json()) as { source: string; kind: string; version: string };
    expect(read.kind).toBe("roster");
    expect(read.source).toBe(edited);
  });

  it("a new cohort is a new file, and a cohort listed newest first changes the home page's counts", { timeout: 180_000 }, async () => {
    const before = await homeFacts();
    const year = CURRENT.year + 1;
    const created = await send("PUT", `${PREFIX}/content/roster.${year}/draft`, {
      source: await cohortFile({ year, photo: null, researchers: ["Example Person Seven"] }),
      expectedVersion: null,
      changeId: "chg-new-cohort",
    });
    expect(created.status, await created.clone().text()).toBe(200);
    expect(gh.files.has(rosterPath(String(year)))).toBe(true);

    expect(await homeFacts()).toEqual({ ...before, researchers: before.researchers + 1, cohorts: before.cohorts + 1 });
    const { data } = await programPage();
    expect((data as { roster: Array<{ year: number }> }).roster.map((c) => c.year)[0]).toBe(year);
  });

  it("an unchanged save commits nothing and purges nothing", { timeout: 180_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: currentFile,
      expectedVersion: HEAD,
      changeId: "chg-same",
    });
    expect(response.status).toBe(200);
    expect(commits()).toHaveLength(0);
    expect(purge).not.toHaveBeenCalled();
  });
});

describe("a save purges every page that embeds the roster", () => {
  it("sends the content pages' tag and the home page's, and the pages carry exactly those tags", { timeout: 180_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: await cohortFile({ ...CURRENT, researchers: [...CURRENT.researchers, ADDED] }),
      expectedVersion: HEAD,
      changeId: "chg-purge",
    });
    expect(response.status, await response.clone().text()).toBe(200);

    const purged = purgedTags();
    expect(purged).toContain("content-pages");
    expect(purged).toContain(cacheTags());

    // The tags a purge sends are the tags the two pages are served with, so neither can be left stale.
    const pageTags = (new Headers(contentPageHeaders()).get("cache-tag") ?? "").split(",");
    const homeTags = (new Headers(homeHeaders({ loaderHeaders: new Headers() } as never)).get("cache-tag") ?? "").split(",");
    expect(pageTags.some((tag) => purged.includes(tag))).toBe(true);
    expect(homeTags.some((tag) => purged.includes(tag))).toBe(true);
  });
});

describe("a save is held to what CI holds", () => {
  it("REFUSES a field the roster never had, with the message, and commits nothing", async () => {
    const bad = (await cohortFile(CURRENT)).replace("year: 2031", "year: 2031\nemail: someone@example.com");
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: bad, expectedVersion: HEAD, changeId: "chg-bad" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/email is not a roster field/);
    expect(commits()).toHaveLength(0);
    expect(gh.files.get(FILE)).toBe(currentFile);
  });

  it("REFUSES a photograph the repository does not hold", async () => {
    const source = await cohortFile({ ...CURRENT, photo: { ...CURRENT.photo, src: "/phage-hunters/not-there.webp" } });
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source, expectedVersion: HEAD, changeId: "chg-photo" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/is not in the repository/);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES an id that is not a year, so no other path can be read or written through it", async () => {
    const response = await send("PUT", `${PREFIX}/content/roster.notes/draft`, { source: currentFile, expectedVersion: null, changeId: "chg-slug" });
    expect(response.status).toBe(422);
    expect(commits()).toHaveLength(0);
    expect((await get(`${PREFIX}/content/roster.notes`)).status).toBe(404);
  });

  it("REFUSES a stale version, names the current one, and commits nothing", async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: await cohortFile({ ...CURRENT, researchers: [...CURRENT.researchers, ADDED] }),
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: HEAD });
    expect(commits()).toHaveLength(0);
  });

  it("has no draft state: a cohort cannot be unpublished, and the answer says how to remove one", async () => {
    const response = await send("POST", `${PREFIX}/content/${ID}/unpublish`, { expectedVersion: HEAD, changeId: "chg-down" });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/no draft state/);
    expect(commits()).toHaveLength(0);
    expect((await programPage()).names.length).toBeGreaterThan(0);
  });
});

describe("a lost row is repaired from the file, never the reverse", () => {
  it("rewrites the row on an unchanged save and commits nothing", { timeout: 180_000 }, async () => {
    await testEnv.DB.prepare("DELETE FROM roster WHERE slug = ?1").bind(SLUG).run();
    expect((await homeFacts()).cohorts).toBe(SYNTHETIC_COHORTS.length - 1);

    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: currentFile, expectedVersion: HEAD, changeId: "chg-repair" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(commits()).toHaveLength(0);
    expect((await homeFacts()).cohorts).toBe(SYNTHETIC_COHORTS.length);
  });
});

describe("an empty table is a fault, never an empty roster", () => {
  it("the program page and the home page refuse to render with no cohorts", async () => {
    await testEnv.DB.prepare("DELETE FROM roster").run();
    await expect(programPage()).rejects.toThrow(/roster table is empty/);
    await expect(homeFacts()).rejects.toThrow(/roster table is empty/);
  });
});

describe("Carrel lists cohorts beside posts, and the operator reads them and cannot save one", () => {
  it("shows each cohort as kind roster under its roster.<year> id", async () => {
    const res = (await (await get(`${PREFIX}/content?limit=100&q=${SLUG}`)).json()) as {
      items: Array<{ id: string; kind: string; path: string | null; status: string }>;
    };
    expect(res.items.find((i) => i.id === ID)).toMatchObject({ kind: "roster", path: `${PAGE}#year-${SLUG}`, status: "published" });
  });

  it("list_roster and get_roster read the fields the public page shows, and there is no save tool", async () => {
    const list = await runTool(operatorEnv(), operator, "list_roster", {});
    expect(list).toMatchObject({ ok: true });
    const data = (list as { data: { count: number; cohorts: Array<Record<string, unknown>> } }).data;
    expect(data.count).toBe(SYNTHETIC_COHORTS.length);
    expect(data.cohorts[0]).toEqual({
      slug: SLUG,
      year: CURRENT.year,
      photo: CURRENT.photo.src,
      researchers: CURRENT.researchers.length,
    });

    const one = await runTool(operatorEnv(), operator, "get_roster", { slug: SLUG });
    expect(one).toMatchObject({ ok: true, data: { slug: SLUG, errors: [], cohort: { year: CURRENT.year, photo: CURRENT.photo } } });
    // The fields of the public page and no others.
    const cohort = (one as { data: { cohort: Record<string, unknown> } }).data.cohort;
    expect(Object.keys(cohort).sort()).toEqual(["photo", "researchers", "year"]);

    expect(await runTool(operatorEnv(), operator, "get_roster", { slug: "../x" })).toMatchObject({ ok: false, status: 400 });
    expect(await runTool(operatorEnv(), operator, "get_roster", { slug: "1999" })).toMatchObject({ ok: false, status: 404 });
    // The roster is edited through Carrel and nowhere else, so no save tool exists.
    expect(isToolName("save_roster")).toBe(false);
  });
});
