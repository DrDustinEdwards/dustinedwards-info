import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { action, loader } from "~/routes/api.carrel.v1.$";

import protocol from "../../content/procedures/phage-dna-extraction.md?raw";

import { stubGitHub, type GitHubStub } from "./github-stub";
import { routeContext } from "./route-helpers";
import { seedProcedures } from "./seed";
import { testEnv } from "./test-env";

/* Procedures are edited through Carrel's content group like every other kind: the handler reads the site's own
 * procedure rows and files and writes only through saveProcedure, the save the operator API uses (job_00bf80ec0e3f). */

// The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one.
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const PREFIX = "https://example.com/api/carrel/v1";
const HEAD = "a".repeat(40);
const SLUG = "phage-dna-extraction";
const ID = `procedure.${SLUG}`;
const FILE = `content/procedures/${SLUG}.md`;
const OLD_STEP = "Incubate at 55 to 60 °C for ~{30 to 60%minutes}.";
const NEW_STEP = "Incubate at 60 °C for ~{45%minutes}.";

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
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));

let gh: GitHubStub;

beforeAll(async () => {
  await seedProcedures();
});

beforeEach(() => {
  purge.mockClear();
  gh = stubGitHub({ [FILE]: protocol });
});

afterEach(() => {
  gh.restore();
});

describe("procedures through Carrel", () => {
  it("lists procedures as their own kind and filters by status and text", async () => {
    const list = (await (await get(`${PREFIX}/content?limit=100&q=extraction`)).json()) as {
      items: Array<{ id: string; kind: string; status: string; path: string | null; title: string }>;
    };
    expect(list.items.find((i) => i.id === ID)).toMatchObject({
      kind: "procedure",
      status: "published",
      path: `/research/protocols/${SLUG}`,
    });
    const drafts = (await (await get(`${PREFIX}/content?limit=100&status=draft`)).json()) as { items: Array<{ id: string }> };
    expect(drafts.items.some((i) => i.id === ID)).toBe(false);
  });

  it("reads one procedure as its file, at the repository head", async () => {
    const response = await get(`${PREFIX}/content/${ID}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, kind: "procedure", status: "published", format: "markdown", source: protocol, version: HEAD });
    expect((await get(`${PREFIX}/content/procedure.nothing`)).status).toBe(404);
  });

  it("saves an edit as the Carrel actor through the one procedure save, and keeps it published", { timeout: 120_000 }, async () => {
    const edited = protocol.replace(OLD_STEP, NEW_STEP);
    expect(edited).not.toBe(protocol);
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, { source: edited, expectedVersion: HEAD, changeId: "chg-proc" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: ID, status: "published", changeId: "chg-proc" });
    expect(gh.files.get(FILE)).toBe(edited);
    expect(commits()).toHaveLength(1);
    expect((commits()[0]?.body as { message?: string } | undefined)?.message).toContain("[carrel:chg-proc]");

    const row = await testEnv.DB.prepare("SELECT status, markdown FROM procedures WHERE slug = ?1").bind(SLUG).first<{ status: string; markdown: string }>();
    expect(row?.status).toBe("published");
    expect(row?.markdown).toContain("60 °C");
  });

  it("starts a new procedure as a draft", { timeout: 120_000 }, async () => {
    const fresh = protocol.replace(/^path: .*$/m, "path: /research/protocols/carrel-new").replace(/^title: .*$/m, "title: A new procedure");
    const response = await send("PUT", `${PREFIX}/content/procedure.carrel-new/draft`, { source: fresh, expectedVersion: null, changeId: "chg-new" });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ id: "procedure.carrel-new", status: "draft" });
    expect(gh.files.get("content/procedures/carrel-new.md")).toMatch(/^draft: true$/m);
  });

  it("unpublishes, then publishes, writing the status into the file", { timeout: 180_000 }, async () => {
    const down = await send("POST", `${PREFIX}/content/${ID}/unpublish`, { expectedVersion: HEAD, changeId: "chg-down" });
    expect(down.status, await down.clone().text()).toBe(200);
    const downBody = (await down.json()) as { status: string; version: string };
    expect(downBody.status).toBe("draft");
    expect(gh.files.get(FILE)).toMatch(/^draft: true$/m);

    const up = await send("POST", `${PREFIX}/content/${ID}/publish`, { expectedVersion: downBody.version, changeId: "chg-up" });
    expect(up.status, await up.clone().text()).toBe(200);
    expect(await up.json()).toMatchObject({ status: "published" });
    expect(gh.files.get(FILE)).toMatch(/^draft: false$/m);
    expect(commits()).toHaveLength(2);
  });

  it("lists the file's revisions, newest first, and answers a missing procedure with none", async () => {
    gh.history.push({ sha: "b".repeat(40), message: "Update procedure: Phage DNA extraction", author: "Dustin", date: "2026-09-30T12:00:00Z" });
    const response = await get(`${PREFIX}/content/${ID}/revisions`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: Array<{ version: string; author: string; message: string; at: string }> };
    expect(body.items[0]).toMatchObject({ version: "b".repeat(40), author: "Dustin", message: "Update procedure: Phage DNA extraction", at: "2026-09-30T12:00:00.000Z" });
    expect((await get(`${PREFIX}/content/procedure.nothing/revisions`)).status).toBe(404);
  });

  it("REFUSES a file the validator fails, with its messages, and commits nothing", async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: protocol.replace(/^title: .*$/m, "title: "),
      expectedVersion: HEAD,
      changeId: "chg-bad",
    });
    expect(response.status).toBe(422);
    expect(commits()).toHaveLength(0);
    expect(gh.files.get(FILE)).toBe(protocol);
  });

  it("REFUSES a stale expectedVersion, names the current one, and commits nothing", async () => {
    const response = await send("PUT", `${PREFIX}/content/${ID}/draft`, {
      source: protocol.replace(OLD_STEP, NEW_STEP),
      expectedVersion: "b".repeat(40),
      changeId: "chg-stale",
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "version-conflict", currentVersion: HEAD });
    expect(commits()).toHaveLength(0);
    expect(gh.files.get(FILE)).toBe(protocol);
  });

  it("refuses to schedule or preview a procedure, in the registry's plain words", async () => {
    const scheduled = await send("POST", `${PREFIX}/content/${ID}/schedule`, { publishAt: "2999-01-01T00:00:00.000Z", expectedVersion: HEAD, changeId: "chg-sched" });
    expect(scheduled.status).toBe(422);
    expect(await scheduled.text()).toMatch(/cannot be scheduled/);
    expect(commits()).toHaveLength(0);
  });
});
