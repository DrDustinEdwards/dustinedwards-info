import { env } from "cloudflare:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProcedureView } from "~/components/procedure";
import { runTool } from "~/lib/operator/api.server";
import { procedurePath } from "~/lib/procedures/parse.mjs";
import { saveRegistryItem } from "~/lib/registry/save.server";
import { loader as pageLoader } from "~/routes/procedure";

import isolation from "../../content/procedures/phage-isolation.md?raw";
import { routeContext } from "./route-helpers";
import { stubGitHub, type GitHubStub } from "./github-stub";
import { reagentRepoFiles } from "./seed";

/* A protocol names its host strains by id (docs/REGISTRY.md): the file types no designation or collection number, the compile
 * reads the strains from the repository into the record, and a change to a strain reaches every protocol that names it. The
 * files are the repository's own: the phage isolation protocol and both strain records. */

const STRAIN_FILES = import.meta.glob("../../content/registry/strain/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const registryFiles = Object.fromEntries(Object.entries(STRAIN_FILES).map(([path, raw]) => [`content/registry/strain/${path.split("/").pop()}`, raw]));
const FOLIORUM = "content/registry/strain/foliorum.md";
const SLUG = "phage-isolation";
const PAGE = `https://example.com/research/protocols/${SLUG}`;

/* The runtime's own `cache` has no settable purge here, so the module is wrapped with a recording one. */
const purge = vi.hoisted(() => vi.fn(async (_options: { tags: string[] }) => ({ success: true })));
vi.mock("cloudflare:workers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("cloudflare:workers")>()),
  cache: { purge },
}));

const operatorEnv = () => env as unknown as Parameters<typeof runTool>[0];
const gitEnv = () => env as unknown as Parameters<typeof saveRegistryItem>[0];
const operator = { kind: "operator", id: "test" } as const;
const carrel = { kind: "carrel", changeId: "chg-strain" } as const;

let gh: GitHubStub;
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM procedures").run();
  await env.DB.prepare("DELETE FROM registry").run();
  gh = stubGitHub({ [procedurePath(SLUG)]: isolation, ...registryFiles, ...reagentRepoFiles });
  purge.mockClear();
});
afterEach(() => {
  gh.restore();
});

const save = async () => {
  const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: isolation });
  expect(saved.ok, JSON.stringify(saved)).toBe(true);
};
const record = async () => (await pageLoader({ request: new Request(PAGE), context: routeContext(), params: { slug: SLUG } } as never)).record;
const stored = async () =>
  JSON.parse((await env.DB.prepare("SELECT record FROM procedures WHERE slug = ?1").bind(SLUG).first<{ record: string }>())?.record ?? "{}") as {
    hostStrains: Array<{ id: string; name: string; collectionNumber: string | null }>;
    hostStrain: string | null;
  };

describe("a protocol that names its host strains by id", () => {
  it("compiles with the registry's facts in its record, and the file types none", { timeout: 120_000 }, async () => {
    expect(isolation).not.toContain("700084");
    expect(isolation).not.toContain("B-24224");
    await save();
    const { hostStrains, hostStrain } = await stored();
    expect(hostStrains.map((s) => s.id)).toEqual(["smegmatis", "foliorum"]);
    expect(hostStrains[1]).toMatchObject({ name: "Microbacterium foliorum NRRL B-24224", collectionNumber: "B-24224" });
    expect(hostStrain).toBe("Mycobacterium smegmatis mc²155; Microbacterium foliorum NRRL B-24224");
  });

  it("links each strain from the page's Host strain fact", { timeout: 120_000 }, async () => {
    await save();
    const html = renderToStaticMarkup(createElement(ProcedureView, { record: await record(), count: 1, factor: 1 }));
    expect(html).toContain('<a href="/research/lab/strains/foliorum">Microbacterium foliorum NRRL B-24224</a>');
    expect(html).toContain('<a href="/research/lab/strains/smegmatis">Mycobacterium smegmatis mc²155</a>');
  });

  it("is refused, naming the strain, when the registry does not hold it", { timeout: 120_000 }, async () => {
    gh.files.delete("content/registry/strain/foliorum.md");
    const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: isolation });
    expect(saved.ok).toBe(false);
    expect(JSON.stringify(saved)).toMatch(/host_strain\[foliorum\] names no strain in the lab registry/);
  });
});

describe("a change to a strain reaches the protocols that name it", () => {
  it("a registry save rewrites the protocol's row from its file, and purges the registry and the procedures", { timeout: 120_000 }, async () => {
    await save();
    purge.mockClear();
    const edited = (registryFiles[FOLIORUM] ?? "").replace('collection_number: "B-24224"', 'collection_number: "B-24225"').replace("NRRL B-24224", "NRRL B-24225");
    expect(edited).not.toBe(registryFiles[FOLIORUM]);
    await saveRegistryItem(gitEnv(), { slug: "strain/foliorum", raw: edited, isNew: false, actor: carrel });
    expect((await stored()).hostStrains[1]?.collectionNumber).toBe("B-24225");
    const tags = purge.mock.calls.flatMap(([options]) => options.tags);
    expect(tags).toContain("registry");
    expect(tags).toContain("procedures");
  });

  it("a strain made a draft stops the save, naming the protocol that can no longer name it", { timeout: 120_000 }, async () => {
    await save();
    const draft = (registryFiles[FOLIORUM] ?? "").replace("name: ", "draft: true\nname: ");
    await expect(saveRegistryItem(gitEnv(), { slug: "strain/foliorum", raw: draft, isNew: false, actor: carrel })).rejects.toThrow(
      /phage-isolation no longer compiles[\s\S]*is a draft in the lab registry/,
    );
  });

  it("sync_registry recompiles every protocol that names a strain, so an edit made through git reaches it", { timeout: 120_000 }, async () => {
    await save();
    gh.files.set(FOLIORUM, (registryFiles[FOLIORUM] ?? "").replace('collection_number: "B-24224"', 'collection_number: "B-24226"').replace("NRRL B-24224", "NRRL B-24226"));
    const synced = await runTool(operatorEnv(), operator, "sync_registry", {});
    expect(synced.ok, JSON.stringify(synced)).toBe(true);
    if (synced.ok) expect(synced.data).toMatchObject({ protocolsRefreshed: 1 });
    expect((await stored()).hostStrains[1]?.collectionNumber).toBe("B-24226");
  });
});

describe("a protocol that names a strain only as an organism", () => {
  const organismOnly = isolation.replace("host_strain:\n  - strain: smegmatis\n  - strain: foliorum\n", "host_strain: not applicable\n");

  it("carries the registry's words for it, and a strain save rewrites the protocol that names it", { timeout: 120_000 }, async () => {
    expect(organismOnly).not.toBe(isolation);
    gh.files.set(procedurePath(SLUG), organismOnly);
    const saved = await runTool(operatorEnv(), operator, "save_procedure", { slug: SLUG, raw: organismOnly });
    expect(saved.ok, JSON.stringify(saved)).toBe(true);
    const names = async () =>
      (JSON.parse((await env.DB.prepare("SELECT record FROM procedures WHERE slug = ?1").bind(SLUG).first<{ record: string }>())?.record ?? "{}") as { organismNames: Record<string, string> }).organismNames;
    expect(await names()).toEqual({ smegmatis: "Mycobacterium smegmatis", foliorum: "Microbacterium foliorum" });
    const edited = (registryFiles[FOLIORUM] ?? "").replace("organism: \"Microbacterium foliorum\"", "organism: \"Microbacterium foliorum (renamed)\"").replace("name: \"Microbacterium foliorum NRRL B-24224\"", "name: \"Microbacterium foliorum (renamed) NRRL B-24224\"");
    expect(edited).not.toBe(registryFiles[FOLIORUM]);
    await saveRegistryItem(gitEnv(), { slug: "strain/foliorum", raw: edited, isNew: false, actor: carrel });
    expect((await names()).foliorum).toBe("Microbacterium foliorum (renamed)");
  });
});
