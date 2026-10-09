import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registryHandlers } from "~/lib/carrel/registry-handler.server";
import { gitBlobSha } from "~/lib/content/hashes.mjs";
import { runHealthChecks } from "~/lib/health/checks.server";
import { runTool } from "~/lib/operator/api.server";
import { RegistryInvalid, saveRegistryItem } from "~/kb/registry/save.server";

import { stubGitHub, type GitHubStub } from "./github-stub";

/* The registry framework, end to end, with no real kind: the registry ships with none (app/kb/registry/kinds.mjs),
 * so this file brings one, a "widget", and holds the save, sync_registry, the registry-drift check, the operator's
 * reads and Carrel's handler to it. Each case starts from an empty registry table and a repository ahead of it. */

vi.mock("~/kb/registry/kinds.mjs", () => ({
  KINDS: Object.freeze({
    widget: {
      singular: "widget",
      plural: "widgets",
      fields: {
        color: {
          required: true,
          check: (value: unknown) => (["red", "blue"].includes(String(value)) ? null : `${JSON.stringify(value)} is not red or blue`),
        },
        paper: {
          check: async (value: unknown, { host }: { host: { paper: (slug: string) => Promise<boolean> } }) =>
            (await host.paper(String(value))) ? null : `paper ${String(value)} is not a publication of this site`,
        },
      },
    },
  }),
  kindKeys: () => ["widget"],
}));

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const operator = { kind: "operator", id: "test" } as const;
const carrel = { kind: "carrel", changeId: "chg-registry" } as const;
const gitEnv = () => env as unknown as Parameters<typeof saveRegistryItem>[0];

/* The wide dash the house style refuses, built here so this file carries none itself. */
const WIDE = String.fromCharCode(0x2014);

const RED = "---\nname: A red widget\ncolor: red\n---\n";
const BLUE = "---\nname: A blue widget\ncolor: blue\n---\n";
const PATHS = { red: "content/registry/widget/a-red.md", blue: "content/registry/widget/a-blue.md" };

const rowFor = (kind: string, id: string) =>
  env.DB.prepare("SELECT kind, id, name, status, record, source_blob_sha FROM registry WHERE kind = ?1 AND id = ?2")
    .bind(kind, id)
    .first<{ kind: string; id: string; name: string; status: string; record: string; source_blob_sha: string }>();
const count = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM registry").first<{ n: number }>())?.n ?? -1;
const driftCheck = async () => (await runHealthChecks(env as never)).checks.find((c) => c.name === "registry-drift");
const sync = () => runTool(operatorEnv(), operator, "sync_registry", {});
const purgedTags = () => purge.mock.calls.flatMap(([options]) => options.tags);
const commits = () => gh.calls.filter((c) => c.method === "POST" && c.path.endsWith("/git/commits"));

let gh: GitHubStub;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM registry").run();
  gh = stubGitHub({});
  purge.mockClear();
});

afterEach(() => {
  gh.restore();
});

describe("sync_registry and the registry-drift check", () => {
  it("an empty registry is converged: no files and no rows is nothing to do, and the check agrees", { timeout: 120_000 }, async () => {
    expect((await driftCheck())?.ok).toBe(true);
    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 0, removed: 0, expected: 0, present: 0, converged: true });
    expect(purge).not.toHaveBeenCalled();
  });

  it("converges unrowed files, reports them as drift first, writes the shared columns and the record, purges its tag, and is idempotent", { timeout: 120_000 }, async () => {
    gh.files.set(PATHS.red, RED);
    gh.files.set(PATHS.blue, BLUE);
    expect((await driftCheck())?.ok).toBe(false);

    const first = await sync();
    expect(first.ok, JSON.stringify(first)).toBe(true);
    if (first.ok) expect(first.data).toMatchObject({ repaired: 2, removed: 0, expected: 2, present: 2, converged: true });
    expect(await count()).toBe(2);
    const row = await rowFor("widget", "a-red");
    expect(row).toMatchObject({ kind: "widget", id: "a-red", name: "A red widget", status: "published", source_blob_sha: await gitBlobSha(RED) });
    // The name and the status are columns; the record holds only the kind's own fields.
    expect(JSON.parse(row?.record ?? "{}")).toEqual({ color: "red", paper: null });
    expect(purgedTags()).toEqual(["registry"]);
    expect((await driftCheck())?.ok).toBe(true);

    const again = await sync();
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.data).toMatchObject({ repaired: 0, removed: 0, converged: true });
  });

  it("re-compiles an item edited through git, adds a new one and removes a row whose file is gone", { timeout: 120_000 }, async () => {
    gh.files.set(PATHS.red, RED);
    gh.files.set(PATHS.blue, BLUE);
    expect((await sync()).ok).toBe(true);

    const edited = RED.replace("color: red", "color: blue");
    gh.files.set(PATHS.red, edited);
    gh.files.set("content/registry/widget/a-new.md", "---\nname: A new widget\ncolor: red\ndraft: true\n---\n");
    gh.files.delete(PATHS.blue);
    const drifted = await driftCheck();
    expect(drifted?.ok).toBe(false);
    expect(drifted?.detail).toContain("1 sha-changed");
    expect(drifted?.detail).toContain("1 row(s) with no file");

    const result = await sync();
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ repaired: 2, removed: 1, converged: true });
    expect(await count()).toBe(2);
    expect(JSON.parse((await rowFor("widget", "a-red"))?.record ?? "{}")).toMatchObject({ color: "blue" });
    expect(await rowFor("widget", "a-blue")).toBeNull();
    expect(await rowFor("widget", "a-new")).toMatchObject({ status: "draft" });
  });

  it("REFUSES an empty file set while rows exist, instead of deleting every row", { timeout: 120_000 }, async () => {
    gh.files.set(PATHS.red, RED);
    expect((await sync()).ok).toBe(true);
    gh.files.delete(PATHS.red);
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("empty set");
    }
    expect(await count()).toBe(1);
  });

  it("makes no row for a file the validator refuses, naming it, and converges the rest", { timeout: 120_000 }, async () => {
    gh.files.set(PATHS.red, RED);
    gh.files.set("content/registry/widget/stray.md", "---\nname: Stray\ncolor: green\nstock: 40\n---\n");
    const result = await sync();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
      expect(result.error).toContain("content/registry/widget/stray.md fails");
      expect(JSON.stringify(result.detail)).toContain("stock is not a widget field");
    }
    expect(await rowFor("widget", "stray")).toBeNull();
    expect(await count()).toBe(1);
  });
});

describe("a registry save is held to what CI holds", () => {
  it("creates an item: commits the file, writes the row, purges the registry tag, and says so", { timeout: 120_000 }, async () => {
    const saved = await saveRegistryItem(gitEnv(), { slug: "widget/a-red", raw: RED, isNew: true, actor: carrel });
    expect(saved).toMatchObject({ slug: "widget/a-red", created: true, unchanged: false, sourceBlobSha: await gitBlobSha(RED) });
    expect(gh.files.get(PATHS.red)).toBe(RED);
    expect(await rowFor("widget", "a-red")).toMatchObject({ name: "A red widget", source_blob_sha: await gitBlobSha(RED) });
    expect(purgedTags()).toEqual(["registry"]);
    expect(commits()).toHaveLength(1);
  });

  it("an unchanged save commits nothing and says so", { timeout: 120_000 }, async () => {
    await saveRegistryItem(gitEnv(), { slug: "widget/a-red", raw: RED, isNew: true, actor: carrel });
    const before = commits().length;
    purge.mockClear();
    const again = await saveRegistryItem(gitEnv(), { slug: "widget/a-red", raw: RED, isNew: false, actor: carrel });
    expect(again.unchanged).toBe(true);
    expect(commits().length).toBe(before);
    expect(purge).not.toHaveBeenCalled();
  });

  it("REFUSES a file the validator fails, with every message, and commits nothing", { timeout: 120_000 }, async () => {
    const bad = `---\nname: A bad widget ${WIDE} here\ncolor: green\npaper: no-such-paper\nstock: 40\n---\nA body.\n`;
    const error = await saveRegistryItem(gitEnv(), { slug: "widget/a-bad", raw: bad, isNew: true, actor: carrel }).catch((e) => e);
    expect(error).toBeInstanceOf(RegistryInvalid);
    const message = [error.message, ...(error.errors ?? [])].join("\n");
    expect(message).toMatch(/wide dash/);
    expect(message).toMatch(/color: "green" is not red or blue/);
    expect(message).toMatch(/paper: paper no-such-paper is not a publication of this site/);
    expect(message).toMatch(/stock is not a widget field/);
    expect(message).toMatch(/the body must be empty/);
    expect(commits()).toHaveLength(0);
    expect(await count()).toBe(0);
  });

  it("REFUSES an address that is not <kind>/<id>, a kind that does not exist, and a name two items of a kind share", { timeout: 120_000 }, async () => {
    for (const slug of ["widget", "widget/Bad Id", "gadget/a-red", "../pages/about"]) {
      await expect(saveRegistryItem(gitEnv(), { slug, raw: RED, isNew: true, actor: carrel })).rejects.toBeInstanceOf(RegistryInvalid);
    }
    await saveRegistryItem(gitEnv(), { slug: "widget/a-red", raw: RED, isNew: true, actor: carrel });
    const twin = await saveRegistryItem(gitEnv(), { slug: "widget/another", raw: RED, isNew: true, actor: carrel }).catch((e) => e);
    expect(twin).toBeInstanceOf(RegistryInvalid);
    expect([twin.message, ...(twin.errors ?? [])].join("\n")).toMatch(/widget\/another and widget\/a-red are both named "A red widget"/);
  });

  it("holds the publish policy: an operator may save a draft but not publish for the first time", { timeout: 120_000 }, async () => {
    const draft = "---\nname: A draft widget\ncolor: red\ndraft: true\n---\n";
    await expect(saveRegistryItem(gitEnv(), { slug: "widget/a-draft", raw: draft, isNew: true, actor: operator })).resolves.toMatchObject({ created: true });
    expect(await rowFor("widget", "a-draft")).toMatchObject({ status: "draft" });
    await expect(saveRegistryItem(gitEnv(), { slug: "widget/a-red", raw: RED, isNew: true, actor: operator })).rejects.toThrow(/first time/);
    expect(await rowFor("widget", "a-red")).toBeNull();
  });
});

describe("the operator's reads and Carrel's handler", () => {
  it("list_registry and get_registry read the rows and the file, and say what is missing", { timeout: 120_000 }, async () => {
    gh.files.set(PATHS.red, RED);
    gh.files.set("content/registry/widget/a-gap.md", '---\nname: A gap widget\ncolor: red\npaper: "MISSING: Dustin has not named the paper"\n---\n');
    expect((await sync()).ok).toBe(true);

    const list = await runTool(operatorEnv(), operator, "list_registry", {});
    expect(list.ok, JSON.stringify(list)).toBe(true);
    if (list.ok) {
      const data = list.data as { count: number; items: Array<{ slug: string; name: string; status: string }> };
      expect(data.count).toBe(2);
      expect(data.items.map((i) => i.slug)).toEqual(["widget/a-gap", "widget/a-red"]);
    }
    expect((await runTool(operatorEnv(), operator, "list_registry", { kind: "gadget" })).ok).toBe(false);

    const one = await runTool(operatorEnv(), operator, "get_registry", { slug: "widget/a-gap" });
    expect(one.ok, JSON.stringify(one)).toBe(true);
    if (one.ok) {
      expect(one.data).toMatchObject({ slug: "widget/a-gap", errors: [], gaps: [{ field: "paper", reason: "Dustin has not named the paper" }] });
    }
    expect(await runTool(operatorEnv(), operator, "get_registry", { slug: "widget/nothing" })).toMatchObject({ ok: false, status: 404 });
    expect(await runTool(operatorEnv(), operator, "get_registry", { slug: "../x" })).toMatchObject({ ok: false, status: 400 });
  });

  it("serves one Carrel handler per kind, lists and reads its items, and unpublish sets the draft flag", { timeout: 120_000 }, async () => {
    gh.files.set(PATHS.red, RED);
    expect((await sync()).ok).toBe(true);
    const handlers = registryHandlers(gitEnv());
    expect(handlers.map((h) => h.kind)).toEqual(["widget"]);
    const [widget] = handlers;
    if (!widget) throw new Error("no widget handler");

    expect((await widget.list({})).map((s) => s.id)).toEqual(["a-red"]);
    const doc = await widget.get("a-red");
    expect(doc).toMatchObject({ kind: "widget", title: "A red widget", status: "published", source: RED });
    expect(await widget.get("Not An Id")).toBeNull();

    const result = await widget.unpublish("a-red", { changeId: "chg-unpublish", expectedVersion: String(doc?.version) });
    expect(result).toMatchObject({ id: "a-red", status: "draft" });
    expect(gh.files.get(PATHS.red)).toContain("draft: true");
    expect(await rowFor("widget", "a-red")).toMatchObject({ status: "draft" });
  });
});
