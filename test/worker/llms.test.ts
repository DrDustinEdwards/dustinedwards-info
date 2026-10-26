import { getHead } from "~/lib/source/store.server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";
import { LLMS_CACHE_TAG, LLMS_PATH, LLMS_SETTING_KEY } from "~/lib/llms/validate.mjs";
import { action, loader } from "~/routes/api.carrel.v1.$";
import { loader as llmsLoader } from "~/routes/llms";
import { SITE_ORIGIN } from "~/lib/seo";

import llmsFile from "../../content/llms.txt?raw";

import { versionCases } from "./carrel-version-cases";
import { putSource, removeSource, source, stubSources, versionOf, writes, type SourceStub } from "./source-stub";
import { routeContext } from "./route-helpers";
import { seedPages, seedProcedures, seedPublications } from "./seed";
import { testEnv } from "./test-env";

/* An llms.txt edit goes live with no build and no deploy: Carrel saves the document through site-api's
 * adapter (the one write path), the save judges it with the rules CI runs, commits it, writes the settings
 * row /llms.txt is served from, purges its cache tag, and the NEXT request carries the edit (docs/LLMS.md).
 * The repository is the source and D1 is derived. */

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const ORIGIN = "https://example.com";
const PREFIX = `${ORIGIN}/api/carrel/v1`;
const ID = "document.llms";
const ADDED = "This sentence was added through Carrel and is live without a deploy.";
const EDITED = llmsFile.replace("also builds software on Cloudflare.", `also builds software on Cloudflare. ${ADDED}`);
/** Built from its code point, so this file carries no literal wide dash. */
const WIDE_DASH = String.fromCharCode(0x2014);

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
const put = async (source: string, expectedVersion: string | null | undefined = undefined, changeId = "chg-llms") =>
  send("PUT", `${PREFIX}/content/${ID}/draft`, {
    source,
    expectedVersion: expectedVersion === undefined ? await versionOf(LLMS_PATH) : expectedVersion,
    changeId,
  });

/** What a visitor gets from /llms.txt right now. */
async function served() {
  return (await llmsLoader({
    request: new Request(`${SITE_ORIGIN}/llms.txt`),
    params: {},
    context: routeContext(),
  } as never)) as Response;
}
const row = async () =>
  (await testEnv.DB.prepare("SELECT value FROM settings WHERE key = ?1").bind(LLMS_SETTING_KEY).first<{ value: string }>())?.value ?? null;
const setRow = (value: string) =>
  testEnv.DB.prepare("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(LLMS_SETTING_KEY, value)
    .run();
const commits = async () => (await writes()).map((w) => ({ body: { message: w.message } }));
const operatorEnv = () => testEnv as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const driftCheck = async () => (await runHealthChecks(testEnv as never)).checks.find((c) => c.name === "llms-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_llms", {});

let gh: SourceStub;

beforeAll(async () => {
  // What the rules hold the file to: the pages and procedures the site has, and the papers it serves.
  await seedProcedures();
  await seedPublications();
  // One page row, the case below's: the list case reads the first 50 content items.
  await seedPages(["/accessibility"]);
}, 240_000);

beforeEach(async () => {
  await setRow(llmsFile);
  purge.mockClear();
  gh = await stubSources({ [LLMS_PATH]: llmsFile });
});

afterEach(async () => {
  await gh.restore();
});

describe("what /llms.txt serves is unchanged", () => {
  it("is the repository file byte for byte, from the row and from the bundled fallback", async () => {
    const fromRow = await served();
    expect(new TextEncoder().encode(await fromRow.text())).toEqual(new TextEncoder().encode(llmsFile));

    await testEnv.DB.prepare("DELETE FROM settings WHERE key = ?1").bind(LLMS_SETTING_KEY).run();
    expect(await (await served()).text()).toBe(llmsFile);
  });

  it("keeps its headers and gains the cache tag a save purges", async () => {
    const res = await served();
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("cache-tag")).toBe(LLMS_CACHE_TAG);
  });
});

describe("an edit through the adapter is live at the next request", () => {
  it("shows the edit at /llms.txt with no build or deploy, and purges its tag", { timeout: 120_000 }, async () => {
    expect(await (await served()).text()).not.toContain(ADDED);

    const response = await put(EDITED);
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-llms" });

    // The repository is the source, and it holds the edit.
    expect((await source(LLMS_PATH))).toBe(EDITED);
    const message = ((await commits())[0]?.body as { message?: string } | undefined)?.message;
    expect(message).toContain("[carrel:chg-llms]");

    // The next request for /llms.txt carries it, and the row is exactly the file.
    expect(await (await served()).text()).toBe(EDITED);
    expect(await row()).toBe(EDITED);
    expect(purge.mock.calls.flatMap(([options]) => options.tags)).toContain(LLMS_CACHE_TAG);

    // And the file read back through Carrel is the edit.
    const read = (await (await get(`${PREFIX}/content/${ID}`)).json()) as { source: string; kind: string; path: string };
    expect(read).toMatchObject({ kind: "document", path: "/llms.txt", source: EDITED });
  });

  it("lists the one document, and an unchanged save commits nothing", async () => {
    const list = (await (await get(`${PREFIX}/content?limit=50`)).json()) as { items: Array<{ id: string; kind: string }> };
    expect(list.items.filter((i) => i.kind === "document")).toEqual([expect.objectContaining({ id: ID, status: "published" })]);

    const before = (await commits()).length;
    const response = await put(llmsFile);
    expect(response.status).toBe(200);
    expect((await commits()).length).toBe(before);
    expect(purge).not.toHaveBeenCalled();
  });

  it("an unchanged file with a stale row rewrites the row without a commit", async () => {
    await setRow("an older llms.txt");
    const response = await put(llmsFile);
    expect(response.status).toBe(200);
    expect((await commits())).toHaveLength(0);
    expect(await row()).toBe(llmsFile);
  });

  it("publish with a source is the same save, and a document cannot be unpublished or created", async () => {
    const published = await send("POST", `${PREFIX}/content/${ID}/publish`, { source: EDITED, expectedVersion: await versionOf(LLMS_PATH), changeId: "chg-pub" });
    expect(published.status, await published.clone().text()).toBe(200);
    expect(await served().then((r) => r.text())).toBe(EDITED);

    const down = await send("POST", `${PREFIX}/content/${ID}/unpublish`, { expectedVersion: await versionOf(LLMS_PATH), changeId: "chg-down" });
    expect(down.status).toBe(422);
    expect(((await down.json()) as { message: string }).message).toMatch(/cannot be unpublished/);

    const other = await send("PUT", `${PREFIX}/content/document.other/draft`, { source: llmsFile, expectedVersion: await versionOf(LLMS_PATH), changeId: "chg-new" });
    expect(other.status).toBe(422);
    expect(((await other.json()) as { message: string }).message).toMatch(/names no document/);
  });
});

describe("a save is held to what CI holds", () => {
  it("REFUSES a file the rules fail, with every message, and commits nothing", async () => {
    const bad = llmsFile.replace("Research in retroviruses", `Research ${WIDE_DASH} in retroviruses`).replaceAll("/llms-full.txt", "/everything.txt");
    const response = await put(bad);
    expect(response.status).toBe(422);
    const message = ((await response.json()) as { message: string }).message;
    expect(message).toMatch(/no wide dash/);
    expect(message).toMatch(/URL patterns and headers an agent acts on/);
    expect((await commits())).toHaveLength(0);
    expect((await source(LLMS_PATH))).toBe(llmsFile);
    expect(await row()).toBe(llmsFile);
  });

  it("REFUSES a listed paper twin no paper produces, and a page the site does not have", async () => {
    /** The file with one more list item after the line that carries `marker`. */
    const withLineAfter = (marker: string, item: string) => {
      const next = llmsFile.replace(new RegExp(`^.*${marker}.*\\n`, "m"), (line) => `${line}${item}\n`);
      expect(next).not.toBe(llmsFile);
      return next;
    };
    const response = await put(withLineAfter("10-1128-mra-00888-24\\.md", "- [Not a paper](https://dustinedwards.info/research/publications/not-a-paper.md): 2020"));
    expect(response.status).toBe(422);
    expect(((await response.json()) as { message: string }).message).toMatch(/advertised with no paper: \/research\/publications\/not-a-paper\.md/);

    const stray = await put(withLineAfter("software/capsid\\)", "- [Not a page](https://dustinedwards.info/software/not-a-page): x"));
    expect(stray.status).toBe(422);
    expect(((await stray.json()) as { message: string }).message).toMatch(/listed but not a page: \/software\/not-a-page/);
    expect((await commits())).toHaveLength(0);
  });

  it("judges pages by their D1 rows: a draft's line may land before its publish, and is required after", async () => {
    const LINE = "- [Accessibility](https://dustinedwards.info/accessibility): what the site's checks test";
    // The file in the repository lists the page since it was published; the case starts from it without the line.
    const without = llmsFile.replace(/^- \[Accessibility\].*\n/m, "");
    expect(without).not.toBe(llmsFile);
    const withLine = without.replace(/^.*\/terms\).*\n/m, (line) => `${line}${LINE}\n`);
    expect(withLine).not.toBe(without);
    const status = (s: string) => testEnv.DB.prepare("UPDATE pages SET status = ?1 WHERE path = '/accessibility'").bind(s).run();
    try {
      await status("draft");
      // A draft: listing it is allowed, and so is leaving it out.
      expect((await put(withLine, undefined, "chg-a11y-draft")).status).toBe(200);
      await gh.restore();
      gh = await stubSources({ [LLMS_PATH]: llmsFile });
      await setRow(llmsFile);
      await status("published");
      // Published through Carrel: the line saves at once, with no deploy in between, and leaving it out is refused.
      const missing = await put(EDITED.replace(/^- \[Accessibility\].*\n/m, ""), undefined, "chg-a11y-missing");
      expect(missing.status).toBe(422);
      expect(((await missing.json()) as { message: string }).message).toMatch(/absent from content\/llms\.txt: \/accessibility/);
      const saved = await put(withLine, undefined, "chg-a11y-published");
      expect(saved.status, await saved.clone().text()).toBe(200);
    } finally {
      await status("published");
    }
  });

  it("REFUSES a stale version, names the current one, and commits nothing", async () => {
    const response = await put(EDITED, "b".repeat(40));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: await versionOf(LLMS_PATH) });
    expect((await commits())).toHaveLength(0);
  });
});

describe("get_llms, sync_llms and the llms-drift check", () => {
  it("get_llms reads the file, its rule failures and whether the row serves it", async () => {
    const same = await runTool(operatorEnv(), operator, "get_llms", {});
    expect(same.ok, JSON.stringify(same)).toBe(true);
    if (same.ok) expect(same.data).toMatchObject({ path: LLMS_PATH, raw: llmsFile, errors: [], servedFromRepository: true, headSha: (await getHead(testEnv)).commitSha });

    await setRow("an older llms.txt");
    const stale = await runTool(operatorEnv(), operator, "get_llms", {});
    if (stale.ok) expect(stale.data).toMatchObject({ servedFromRepository: false });
  });

  it("reports a row older than the file as drift, converges it, and is idempotent", { timeout: 120_000 }, async () => {
    expect((await driftCheck())?.ok).toBe(true);

    // An edit committed outside the save, which the row has not seen.
    await putSource(LLMS_PATH, EDITED);
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");

    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ repaired: 1, removed: 0, expected: 1, present: 1, converged: true });
    expect(await row()).toBe(EDITED);
    expect(await gitBlobSha((await row()) ?? "")).toBe(await gitBlobSha(EDITED));
    expect((await driftCheck())?.ok).toBe(true);
    expect(purge.mock.calls.flatMap(([options]) => options.tags)).toContain(LLMS_CACHE_TAG);

    purge.mockClear();
    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
    expect(purge).not.toHaveBeenCalled();
  });

  it("converges a missing row", async () => {
    await testEnv.DB.prepare("DELETE FROM settings WHERE key = ?1").bind(LLMS_SETTING_KEY).run();
    expect((await driftCheck())?.ok).toBe(false);
    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(await row()).toBe(llmsFile);
  });

  it("REFUSES a repository with no llms.txt instead of deleting the row", async () => {
    await removeSource(LLMS_PATH);
    await putSource("content/README.txt", "not the document");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await row()).toBe(llmsFile);
  });

  it("makes no row from a file the rules fail, naming it", async () => {
    await setRow("an older llms.txt");
    await putSource(LLMS_PATH, llmsFile.replace("Research in retroviruses", `Research ${WIDE_DASH} in retroviruses`));
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("content/llms.txt fails");
      expect(JSON.stringify(result.detail)).toContain("no wide dash");
    }
    expect(await row()).toBe("an older llms.txt");
  });
});

versionCases({
  name: "document",
  id: ID,
  file: LLMS_PATH,
  edit: () => EDITED,
  get,
  send,
  timeout: 120000,
});
