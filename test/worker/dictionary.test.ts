import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isToolName, runTool } from "~/lib/operator/api.server";
import { saveDictionaryEntry } from "~/lib/dictionary/save.server";
import { action, loader } from "~/routes/api.carrel.v1.$";
import ContentPage, { loader as pageLoader } from "~/routes/content-page";
import { loader as twinLoader } from "~/routes/content-page[.md]";

import capsidEntry from "../../content/dictionary/capsid.md?raw";
import capsidPage from "../../content/pages/software-capsid.md?raw";
import dictionaryArtifact from "../../content/generated/dictionary.json";

import { versionCases } from "./carrel-version-cases";
import { stubGitHub, versionOf, type GitHubStub } from "./github-stub";
import { renderRoute, routeContext } from "./route-helpers";
import { seedDictionary, seedPages } from "./seed";
import { testEnv } from "./test-env";

/* An entry edit goes live with no build and no deploy: Carrel saves it through site-api's adapter (the one
 * write path), the save validates it with the code CI runs, commits it, re-derives the page the entry opens and
 * writes the entry's row, and the NEXT request for the page and its markdown twin carries the edit (job_06a07623695b,
 * docs/DICTIONARY.md). The repository is the source and D1 is derived (hard rule 18). */

// The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one.
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const HEAD = "a".repeat(40);
const PATH = "/software/capsid";
const KEY = "capsid";
const ID = `dictionary.${KEY}`;
const FILE = "content/dictionary/capsid.md";
const PAGE_FILE = "content/pages/software-capsid.md";
const SENSE = "A system that stores the instructions and decisions of AI agents and coordinates their work within and across projects.";
const ADDED = "A system that stores the instructions and decisions of AI agents, and an edit saved through Carrel with no deploy.";

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

async function pageData(path = PATH) {
  return pageLoader({ request: new Request(`${ORIGIN}${path}`), context: routeContext(), params: {} } as never);
}
/** The page as a visitor's request gets it: the route's loader, then its component, with its JSON-LD blocks. */
async function html(path = PATH) {
  return renderRoute(path, ContentPage, { loaderData: await pageData(path) });
}
async function twin(path = PATH) {
  return twinLoader({ request: new Request(`${ORIGIN}${path}.md`), context: routeContext(), params: {} } as never);
}
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));
const searchBodies = async (path = PATH) =>
  (await testEnv.DB.prepare("SELECT body FROM search_docs WHERE url LIKE ?1").bind(`${path}%`).all<{ body: string }>()).results.map((r) => r.body);

let gh: GitHubStub;

beforeAll(async () => {
  await seedPages();
  await seedDictionary();
});

beforeEach(async () => {
  purge.mockClear();
  // Each case starts from the table the sync writes, so one case's edit never leaks into the next.
  await seedDictionary();
  gh = stubGitHub({
    [FILE]: capsidEntry,
    [PAGE_FILE]: capsidPage,
    // The clips are static assets; the save only asks the repository whether the file is there.
    "public/audio/capsid.mp3": "clip",
  });
});

afterEach(() => {
  gh.restore();
});

describe("an entry edit through the adapter is live at the next request", () => {
  // Cold pipeline (shiki, KaTeX) plus the page compile: longer than the default 30 s.
  it("shows the edit on the page, its JSON-LD, its markdown twin and its search record, with no build or deploy", { timeout: 180_000 }, async () => {
    expect(await html()).not.toContain("an edit saved through Carrel");
    expect(await (await twin()).text()).not.toContain("an edit saved through Carrel");

    const edited = capsidEntry.replace(SENSE, ADDED);
    expect(edited).not.toBe(capsidEntry);
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: edited, expectedVersion: await versionOf(gh, FILE), changeId: "chg-dict" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-dict" });

    // The repository is the source, and it holds the edit; the page file was never touched.
    expect(gh.files.get(FILE)).toBe(edited);
    expect(gh.files.get(PAGE_FILE)).toBe(capsidPage);
    expect(commits()).toHaveLength(1);
    const message = (commits()[0]?.body as { message?: string } | undefined)?.message;
    expect(message).toContain("[carrel:chg-dict]");

    // The page's lead, and the DefinedTerm in its structured data, are the next request's.
    const data = await pageData();
    expect(data.entry?.senses[1]).toBe(ADDED);
    const page = await html();
    expect(page).toContain("an edit saved through Carrel");
    const jsonLd = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1] ?? "{}") as { "@type": string; description?: string });
    expect(jsonLd.find((block) => block["@type"] === "DefinedTerm")?.description).toBe(ADDED);

    // Its twin leads with the new entry, in the same place the page shows it.
    const res = await twin();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(`2. *software.* ${ADDED}`);

    // The page's search record leads with it too, so Ask and site search see the edit.
    expect((await searchBodies()).some((body) => body.includes("an edit saved through Carrel"))).toBe(true);

    // And the file read back through Carrel is the edit, at the head, and the entry is listed as its own kind.
    const read = (await (await get(`${PREFIX}/content/${ID}`)).json()) as { source: string; kind: string; version: string };
    expect(read.kind).toBe("dictionary");
    expect(read.source).toBe(edited);
    const list = (await (await get(`${PREFIX}/content?limit=100&q=capsid`)).json()) as { items: Array<{ id: string; kind: string; path: string | null }> };
    expect(list.items.find((i) => i.id === ID)).toMatchObject({ kind: "dictionary", path: PATH });
  });

  it("an unchanged save commits nothing and says so", { timeout: 180_000 }, async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: capsidEntry, expectedVersion: await versionOf(gh, FILE), changeId: "chg-same" });
    expect(response.status).toBe(200);
    expect(commits()).toHaveLength(0);
  });
});

describe("an entry change purges the pages tag, because a page embeds its entry", () => {
  it("purges content-pages, the tag the page's HTML and its twin carry, and nothing is purged for an unchanged save", { timeout: 180_000 }, async () => {
    await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: capsidEntry, expectedVersion: await versionOf(gh, FILE), changeId: "chg-none" });
    expect(purge).not.toHaveBeenCalled();

    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: capsidEntry.replace(SENSE, ADDED),
      expectedVersion: await versionOf(gh, FILE),
      changeId: "chg-purge",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const tags = purge.mock.calls.flatMap(([options]) => options.tags);
    expect(tags).toContain("content-pages");

    // The tag purged is the one the page's twin carries (its HTML carries it beside the long-standing "pages").
    expect((await twin()).headers.get("cache-tag")).toBe("content-pages");
  });
});

describe("a save is held to what CI holds", () => {
  it("REFUSES a file the validator fails, with every message, and commits nothing", async () => {
    const wide = String.fromCharCode(0x2014);
    const bad = capsidEntry.replace(/^term: .*$/m, "term: ").concat(`\nA sentence ${wide} with a dash.\n`);
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: bad, expectedVersion: await versionOf(gh, FILE), changeId: "chg-bad" });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { message: string };
    expect(body.message).toMatch(/wide dash/);
    expect(body.message).toMatch(/term: is required text/);
    expect(commits()).toHaveLength(0);
    expect(gh.files.get(FILE)).toBe(capsidEntry);
  });

  it("REFUSES a clip that is not in the repository", async () => {
    gh.files.delete("public/audio/capsid.mp3");
    gh.files.set("public/audio/other.mp3", "clip");
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: capsidEntry.replace(SENSE, ADDED),
      expectedVersion: await versionOf(gh, FILE),
      changeId: "chg-clip",
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/not in the repository/);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES a path no registered Software page names", async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: capsidEntry.replace("path: /software/capsid", "path: /research/phages"),
      expectedVersion: await versionOf(gh, FILE),
      changeId: "chg-path",
    });
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/not a registered Software page/);
    expect(commits()).toHaveLength(0);
  });

  it("REFUSES a stale version, names the current one, and commits nothing", async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: capsidEntry.replace(SENSE, ADDED),
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: await versionOf(gh, FILE) });
    expect(commits()).toHaveLength(0);
  });
});

describe("a draft entry is not shown", () => {
  it("unpublish takes the lead off the page, its JSON-LD, its twin and its search record, and publish restores them", { timeout: 240_000 }, async () => {
    expect((await pageData()).entry).not.toBeNull();

    const down = await send("POST", `${PREFIX}/content/${ID}/unpublish`, { expectedVersion: await versionOf(gh, FILE), changeId: "chg-down" });
    expect(down.status, await down.clone().text()).toBe(200);
    const downBody = (await down.json()) as { status: string; version: string };
    expect(downBody.status).toBe("draft");
    expect(gh.files.get(FILE)).toMatch(/^draft: true$/m);

    // The page itself stays up: only its dictionary lead goes.
    expect((await pageData()).entry).toBeNull();
    const page = await html();
    expect(page).not.toContain("data-term-entry");
    expect(page).not.toContain("DefinedTerm");
    expect(await (await twin()).text()).not.toContain("Pronunciation audio");
    expect((await searchBodies()).some((body) => body.includes("KAP-sid"))).toBe(false);

    const up = await send("POST", `${PREFIX}/content/${ID}/publish`, { expectedVersion: downBody.version, changeId: "chg-up" });
    expect(up.status, await up.clone().text()).toBe(200);
    expect(await up.json()).toMatchObject({ status: "published" });
    expect((await pageData()).entry?.term).toBe("Capsid");
    expect(await html()).toContain("data-term-entry");
    expect(await (await twin()).text()).toContain("[Pronunciation audio](/audio/capsid.mp3)");
  });
});

describe("a derived write that fails never reverts the commit (hard rule 18)", () => {
  it("leaves the commit in place, names the repair, and the drift is repaired from the file", { timeout: 240_000 }, async () => {
    // The page the entry opens no longer compiles, so the derived write fails after the commit.
    gh.files.set(PAGE_FILE, capsidPage.replace(/^title: .*$/m, "title: "));
    const edited = capsidEntry.replace(SENSE, ADDED);
    await expect(
      saveDictionaryEntry(testEnv as never, { key: KEY, raw: edited, expectedHeadSha: HEAD, isNew: false, actor: { kind: "carrel", changeId: "chg-fail" } }),
    ).rejects.toThrow(/WAS committed as .* and the database index could not be updated/);

    // The source holds the edit; D1 still holds the old entry; the page is not left claiming the new one.
    expect(gh.files.get(FILE)).toBe(edited);
    expect((await pageData()).entry?.senses[1]).toBe(SENSE);

    // The repair is a re-run from the repository once the page compiles again: an unchanged save rewrites the row.
    gh.files.set(PAGE_FILE, capsidPage);
    const repaired = await saveDictionaryEntry(testEnv as never, { key: KEY, raw: edited, expectedHeadSha: HEAD, isNew: false, actor: { kind: "carrel", changeId: "chg-repair" } });
    expect(repaired.unchanged).toBe(true);
    expect(commits()).toHaveLength(1);
    expect((await pageData()).entry?.senses[1]).toBe(ADDED);
  });
});

describe("the operator reads entries and cannot save one", () => {
  it("list_dictionary and get_dictionary read, and there is no save tool", { timeout: 180_000 }, async () => {
    const list = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "list_dictionary", {});
    expect(list).toMatchObject({ ok: true });
    const data = (list as { data: { count: number; entries: Array<{ key: string; path: string; draft: boolean }> } }).data;
    // One per file in content/dictionary/, counted from the build's own artifact rather than typed.
    expect(data.count).toBe(dictionaryArtifact.dictionary.length);
    expect(data.entries.find((e) => e.key === KEY)).toMatchObject({ path: PATH, draft: false });

    const one = await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_dictionary", { key: KEY });
    expect(one).toMatchObject({ ok: true, data: { key: KEY, raw: capsidEntry, errors: [], entry: { term: "Capsid" } } });
    expect(await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_dictionary", { key: "nothing" })).toMatchObject({ ok: false, status: 404 });
    expect(await runTool(operatorEnv(), { kind: "operator", id: "test" }, "get_dictionary", { key: "Not A Key" })).toMatchObject({ ok: false, status: 400 });

    // Content is edited through Carrel and nowhere else (docs/DICTIONARY.md), so no save tool exists.
    expect(isToolName("save_dictionary")).toBe(false);
  });
});

versionCases({
  name: "dictionary",
  id: ID,
  file: FILE,
  edit: () => capsidEntry.replace(SENSE, ADDED),
  gh: () => gh,
  get,
  send,
  timeout: 240000,
});
